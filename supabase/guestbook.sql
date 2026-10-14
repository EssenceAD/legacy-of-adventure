-- LUXE §4 이웃 방명록 · 좋아요 — 형철이 Supabase SQL Editor에서 이 파일 전체를 한 번 실행 (여러 번 실행해도 같다)
--  클라이언트는 이 SQL이 아직 없어도 깨지지 않는다 (함수가 없으면 방명록·인기 마을은 「준비 중」, 좋아요는 예전 like_village(p_village) 로)
--  기존 데이터는 지우지 않는다 (컬럼·인덱스·정책·함수만 더한다)
--
-- 이미 있는 표 village_likes(village_id, user_id, day · PK(village_id, user_id, day) · 65행)를 그대로 넓힌다
--   명세 이름 ↔ 실제 컬럼:  to_user = village_id (좋아요를 받은 마을 주인)  ·  from_user = user_id (누른 사람)
--   unique(from_user, to_user, day) = 이미 있는 PK 가 그 역할 (이름만 다름)
--   이름을 바꾸지 않는 이유: 예전 like_village(p_village) 가 이 컬럼 이름을 쓰고 있어서 (옛 클라이언트가 깨지지 않게)
--
-- 하루 = 한국 날짜 (Asia/Seoul) · 주 = 월요일 0시(KST) 시작 — date_trunc('week') 는 ISO 주(월요일 시작)
--
-- 장부 2장 검사 (서버에서 할 수 있는 만큼):
--   saves.data.progress.guide.legacy = true  또는  claimed 에 장부 1·2장 임무 id 14개가 모두 있음 (src/data/guide.ts 1·2장 · 바뀌면 같이 고칠 것)
--   또는 villages.snapshot.grade >= 1 (2장 보상 = 마을 등급 「쉼터」)
--   ※ 저장·마을 모습은 유저가 직접 올리는 값이라 완벽한 검사는 아니다 (부계정 남용을 귀찮게 하는 정도) · 클라이언트도 같은 검사를 먼저 한다
--   ※ 클라우드 저장은 1분마다 올라가서, 방금 2장을 끝낸 사람은 1분쯤 뒤부터 누를 수 있다

begin;

-- ───────── 1. 표 넓히기 ─────────

alter table public.village_likes add column if not exists id bigint generated always as identity;
alter table public.village_likes add column if not exists phrase smallint;          -- 도장 한마디 0~7 (예전 좋아요는 null = 도장 없음)
alter table public.village_likes add column if not exists created_at timestamptz not null default now();  -- 예전 행은 이 SQL을 실행한 시각
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'village_likes_phrase_chk') then
    alter table public.village_likes add constraint village_likes_phrase_chk check (phrase is null or (phrase between 0 and 7));
  end if;
end $$;
create index if not exists village_likes_to_day on public.village_likes (village_id, day);
create index if not exists village_likes_to_at on public.village_likes (village_id, created_at desc);
create index if not exists village_likes_day on public.village_likes (day);

-- ───────── 2. RLS: insert 는 본인만 · select 는 받은 사람(to_user)만 ─────────
--  예전 정책 이름을 모르니 이 표의 정책을 모두 지우고 다시 만든다 (데이터는 그대로)
--  예전 like_village(p_village) 는 security definer 라서 정책과 상관없이 그대로 동작한다

alter table public.village_likes enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'village_likes' loop
    execute format('drop policy %I on public.village_likes', r.policyname);
  end loop;
end $$;
create policy "likes insert self" on public.village_likes for insert to authenticated
  with check (user_id = auth.uid() and village_id <> auth.uid());
create policy "likes select received" on public.village_likes for select to authenticated
  using (village_id = auth.uid());
revoke all on table public.village_likes from anon;
revoke update, delete on table public.village_likes from authenticated;

-- ───────── 3. 장부 2장 검사 (안에서만 쓴다) ─────────

create or replace function public.gb_chapter_ok(p_uid uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select exists (
    select 1 from public.saves s
     where s.user_id = p_uid
       and ( coalesce(s.data #>> '{progress,guide,legacy}', '') = 'true'
          or coalesce(s.data #> '{progress,guide,claimed}', '[]'::jsonb) ?& array[
               'c1_checkin','c1_fire','c1_scout',
               'c1_talk','c1_equip','c1_quick','c1_goal','c2_well','c2_harm','c2_hunt1','c2_auto','c2_hunt5','c2_reg','c2_land'] )
  ) or exists (
    select 1 from public.villages v
     where v.user_id = p_uid
       and coalesce(v.snapshot ->> 'grade', '') ~ '^[0-9]+$'
       and (v.snapshot ->> 'grade')::int >= 1
  );
$$;

-- ───────── 4. like_village(p_village, p_phrase) — 도장 한마디와 함께 좋아요 ─────────
--  돌려주는 값 jsonb: {"r":"ok","likes":n} | {"r":"login"|"phrase"|"self"|"no_village"|"chapter"|"already"}
--  예전 like_village(p_village uuid) 는 그대로 둔다 (이름이 같고 인자가 달라서 PostgREST 가 인자 이름으로 구분한다)

create or replace function public.like_village(p_village uuid, p_phrase smallint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_likes integer;
begin
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid) then return jsonb_build_object('r', 'login'); end if;
  if p_phrase is null or p_phrase < 0 or p_phrase > 7 then return jsonb_build_object('r', 'phrase'); end if;
  if p_village is null or p_village = v_uid then return jsonb_build_object('r', 'self'); end if;
  if not exists (select 1 from public.villages v where v.user_id = p_village) then return jsonb_build_object('r', 'no_village'); end if;
  if not public.gb_chapter_ok(v_uid) then return jsonb_build_object('r', 'chapter'); end if;
  insert into public.village_likes (village_id, user_id, day, phrase) values (p_village, v_uid, v_day, p_phrase)
    on conflict do nothing;
  if not found then return jsonb_build_object('r', 'already'); end if;
  update public.villages set likes = likes + 1 where user_id = p_village returning likes into v_likes;
  return jsonb_build_object('r', 'ok', 'likes', coalesce(v_likes, 0));
end $$;

-- ───────── 5. my_guestbook(p_limit) — 내 방명록: 이번 주 · 누적 · 최근 n개 ─────────
--  {"week":n,"total":n,"week_start":"2026-10-12","rows":[{"from_user","inn_name","nickname","rep_hero","phrase","day","at"}]}

create or replace function public.my_guestbook(p_limit integer default 30)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_ws date := date_trunc('week', now() at time zone 'Asia/Seoul')::date;
  v_n integer := least(greatest(coalesce(p_limit, 30), 1), 50);
begin
  if v_uid is null then return null; end if;
  return jsonb_build_object(
    'week', (select count(*) from public.village_likes l where l.village_id = v_uid and l.day >= v_ws),
    'total', (select count(*) from public.village_likes l where l.village_id = v_uid),
    'week_start', v_ws,
    'rows', coalesce((
      select jsonb_agg(x order by x.at desc) from (
        select l.user_id as from_user, p.inn_name, p.nickname, p.rep_hero, l.phrase, l.day, l.created_at as at
          from public.village_likes l
          left join public.profiles p on p.id = l.user_id
         where l.village_id = v_uid
         order by l.created_at desc
         limit v_n
      ) x), '[]'::jsonb)
  );
end $$;

-- ───────── 6. weekly_popular(p_limit) — 이번 주 인기 마을 (월요일 0시 KST부터 받은 좋아요) ─────────
--  {"week_start":"…","rows":[{"rank","user_id","nickname","inn_name","rep_hero","likes"}],"me":{"rank","likes"}|null}
--  같은 수면 같은 순위 · 줄 순서는 먼저 그 수에 닿은 마을이 위 · 운영·테스트 계정(is_test) 빼고

create or replace function public.weekly_popular(p_limit integer default 30)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  with ws as (select date_trunc('week', now() at time zone 'Asia/Seoul')::date as d),
  agg as (
    select l.village_id as uid, count(*)::int as likes, max(l.created_at) as last_at
      from public.village_likes l, ws
     where l.day >= ws.d
     group by l.village_id
  ),
  ranked as (
    select a.uid, a.likes, a.last_at, rank() over (order by a.likes desc) as rk
      from agg a join public.profiles p on p.id = a.uid
     where not coalesce(p.is_test, false)
  )
  select jsonb_build_object(
    'week_start', (select d from ws),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object('rank', r.rk, 'user_id', r.uid, 'nickname', p.nickname, 'inn_name', p.inn_name, 'rep_hero', p.rep_hero, 'likes', r.likes) order by r.likes desc, r.last_at asc)
        from (select * from ranked order by likes desc, last_at asc limit least(greatest(coalesce(p_limit, 30), 1), 100)) r
        join public.profiles p on p.id = r.uid), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', r.rk, 'likes', r.likes) from ranked r where r.uid = auth.uid())
  );
$$;

-- ───────── 7. last_week_popular() — 지난주 1위 (이웃 목록 맨 위 「🏆 지난주 인기 마을」) ─────────
--  {"user_id","inn_name","nickname","rep_hero","likes","week_start"} | null · 같은 수면 먼저 닿은 마을

create or replace function public.last_week_popular()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  with ws as (select date_trunc('week', now() at time zone 'Asia/Seoul')::date as d)
  select (
    select jsonb_build_object('user_id', a.uid, 'inn_name', p.inn_name, 'nickname', p.nickname, 'rep_hero', p.rep_hero, 'likes', a.likes, 'week_start', (select d - 7 from ws))
      from (
        select l.village_id as uid, count(*)::int as likes, max(l.created_at) as last_at
          from public.village_likes l, ws
         where l.day >= ws.d - 7 and l.day < ws.d
         group by l.village_id
      ) a
      join public.profiles p on p.id = a.uid
     where not coalesce(p.is_test, false)
     order by a.likes desc, a.last_at asc
     limit 1
  );
$$;

-- ───────── 8. 실행 권한 (Supabase는 새 함수마다 anon 에 execute 를 준다 → 뺀다) ─────────

revoke all on function public.gb_chapter_ok(uuid) from public, anon, authenticated;
revoke all on function public.like_village(uuid, smallint) from public, anon;
revoke all on function public.my_guestbook(integer) from public, anon;
revoke all on function public.weekly_popular(integer) from public;
revoke all on function public.last_week_popular() from public;
grant execute on function public.like_village(uuid, smallint) to authenticated;
grant execute on function public.my_guestbook(integer) to authenticated;
-- 인기 마을 순위는 다른 랭킹 뷰처럼 로그인 안 해도 볼 수 있게 (여관 이름 · 닉네임 · 수만)
grant execute on function public.weekly_popular(integer) to anon, authenticated;
grant execute on function public.last_week_popular() to anon, authenticated;

commit;

-- ───────── 확인 (읽기만) ─────────
-- select column_name, data_type from information_schema.columns where table_schema='public' and table_name='village_likes' order by ordinal_position;
--   기대: village_id · user_id · day · id · phrase · created_at
-- select policyname, cmd from pg_policies where tablename = 'village_likes';
--   기대: likes insert self (INSERT) · likes select received (SELECT) 둘만
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args, has_function_privilege('anon', p.oid, 'execute') as anon_exec
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname in ('like_village','my_guestbook','weekly_popular','last_week_popular','gb_chapter_ok') order by 1, 2;
--   기대: like_village(p_village uuid) 옛것 + like_village(p_village uuid, p_phrase smallint) 새것 · anon_exec 는 weekly_popular · last_week_popular 만 true
-- select public.weekly_popular(5);   -- SQL Editor(로그인 없음)에선 me = null
