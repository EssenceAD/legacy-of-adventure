-- DIRECTION_SPEC §2: 테스터와 함께 쓰는 게임 — 운영자(관리자) · 제보 답장/반영 크레딧 · 함께 만든 사람들 · 소문 보내기
-- 여러 번 실행해도 괜찮게(idempotent) 썼다. 대시보드 SQL Editor에서 이 파일 전체를 한 번에 실행.
-- 원칙
--  · 새 테이블은 모두 RLS 켜기 + 클라이언트 쓰기 정책 없음 (쓰기는 security definer 함수로만, 함수 안에서 권한 확인)
--  · 운영자 판정은 public.admins (클라이언트가 읽거나 쓸 수 없음) → public.is_admin()
--  · 클라이언트는 이 SQL이 아직 없어도 동작한다 (함수가 없으면 기능을 조용히 숨김)

-- ───────── 1. 운영자 ─────────

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- 정책 없음 = anon·authenticated는 읽기·쓰기 모두 불가 (함수만 본다)
revoke all on table public.admins from anon, authenticated;

-- 운영자 계정 (아이디 essencead · 닉네임 운영자)
insert into public.admins(user_id)
select p.id from public.profiles p where p.login_id = 'essencead'
on conflict (user_id) do nothing;

create or replace function public.is_admin()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select auth.uid() is not null and exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- ───────── 2. 제보 편지: 상태 · 답장 · 반영 버전 ─────────

alter table public.bug_letters add column if not exists status text not null default '접수';
alter table public.bug_letters add column if not exists reply text;
alter table public.bug_letters add column if not exists ver_fixed text;
alter table public.bug_letters add column if not exists replied_at timestamptz;
alter table public.bug_letters add column if not exists reply_read boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bug_letters_status_chk') then
    alter table public.bug_letters add constraint bug_letters_status_chk check (status in ('접수','반영','보류'));
  end if;
end $$;
create index if not exists bug_letters_user_idx on public.bug_letters(user_id);
create index if not exists bug_letters_fixed_idx on public.bug_letters(ver_fixed) where status = '반영';

-- 내 편지는 내가 읽을 수 있다 (답장 확인용) · 고치기·지우기 정책은 여전히 없음
drop policy if exists "letter own select" on public.bug_letters;
create policy "letter own select" on public.bug_letters for select to authenticated using (auth.uid() = user_id);

-- 유저가 편지를 넣을 때 상태·답장·반영 버전을 스스로 정하지 못하게 (insert 정책은 user_id만 본다)
create or replace function public.bug_letters_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    new.status := '접수';
    new.reply := null;
    new.ver_fixed := null;
    new.replied_at := null;
    new.reply_read := false;
  end if;
  return new;
end $$;
drop trigger if exists bug_letters_guard on public.bug_letters;
create trigger bug_letters_guard before insert on public.bug_letters for each row execute function public.bug_letters_guard();

-- [운영자] 편지 목록 (닉네임 · 그 사람의 반영 수 포함) — 운영자가 아니면 빈 목록
create or replace function public.admin_list_letters(p_status text default null, p_limit integer default 200)
 returns table(id bigint, created_at timestamptz, user_id uuid, nickname text, body text, app_version text, status text, reply text, ver_fixed text, replied_at timestamptz, reply_read boolean, fixed_n integer)
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select l.id, l.created_at, l.user_id, p.nickname, l.body, l.app_version, l.status, l.reply, l.ver_fixed, l.replied_at, l.reply_read,
         (select count(*)::int from public.bug_letters x where x.user_id = l.user_id and x.status = '반영')
  from public.bug_letters l
  left join public.profiles p on p.id = l.user_id
  where public.is_admin() and (p_status is null or l.status = p_status)
  order by l.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;

-- [운영자] 상태 · 답장 · 반영 버전 바꾸기 (null = 그대로 · 빈 글 = 지우기). 답장이 바뀌면 다시 「안 읽음」 → 유저 우편함으로
create or replace function public.admin_set_letter(p_id bigint, p_status text default null, p_reply text default null, p_ver_fixed text default null)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_old text; v_new text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_status is not null and p_status not in ('접수','반영','보류') then raise exception 'bad_status'; end if;
  select l.reply into v_old from public.bug_letters l where l.id = p_id;
  if not found then raise exception 'not_found'; end if;
  v_new := nullif(btrim(left(coalesce(p_reply, ''), 1000)), '');
  update public.bug_letters l set
    status = coalesce(p_status, l.status),
    reply = case when p_reply is null then l.reply else v_new end,
    ver_fixed = case when p_ver_fixed is null then l.ver_fixed else nullif(btrim(left(p_ver_fixed, 32)), '') end,
    replied_at = case when p_reply is not null and v_new is distinct from v_old then now() else l.replied_at end,
    reply_read = case when p_reply is not null and v_new is distinct from v_old then false else l.reply_read end
  where l.id = p_id;
  return 'ok';
end $$;

-- [유저] 아직 안 받은 운영자 답장 (게임 우편함 「운영자의 답장」으로)
create or replace function public.my_letter_replies()
 returns table(id bigint, body text, reply text, status text, ver_fixed text, replied_at timestamptz)
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select l.id, l.body, l.reply, l.status, l.ver_fixed, l.replied_at
  from public.bug_letters l
  where l.user_id = auth.uid() and l.reply is not null and not l.reply_read
  order by l.replied_at nulls last, l.id
  limit 20;
$$;

-- [유저] 우편함에 넣은 답장은 읽음으로 (내 편지만)
create or replace function public.mark_replies_read(p_ids bigint[])
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_n integer;
begin
  if auth.uid() is null then return 0; end if;
  update public.bug_letters l set reply_read = true where l.user_id = auth.uid() and l.id = any(p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- [모두] 패치 노트 크레딧: 그 버전에 「반영」된 제보를 보낸 닉네임 (p_ver null = 모든 버전) · 버전은 v·-beta를 떼고 비교
create or replace function public.letter_credits(p_ver text default null)
 returns table(ver_fixed text, nickname text)
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select v.ver, v.nickname from (
    select regexp_replace(l.ver_fixed, '^v|-beta$', '', 'g') as ver, p.nickname, min(l.created_at) as first_at
    from public.bug_letters l
    join public.profiles p on p.id = l.user_id
    where l.status = '반영' and l.ver_fixed is not null and coalesce(p.is_test, false) = false
      and (p_ver is null or regexp_replace(l.ver_fixed, '^v|-beta$', '', 'g') = regexp_replace(p_ver, '^v|-beta$', '', 'g'))
    group by 1, 2
  ) v
  order by v.ver, v.first_at;
$$;

-- ───────── 3. 함께 만든 사람들 ─────────

create table if not exists public.contributor_notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  line text not null check (char_length(line) <= 60),
  updated_at timestamptz not null default now()
);
alter table public.contributor_notes enable row level security;
revoke all on table public.contributor_notes from anon, authenticated;

-- [모두] 도감 「함께 만든 사람들」: 반영 3건 이상인 유저 + 개척자(profiles.pioneer, 맨 위) · 닉네임 · 운영자가 쓴 한 줄
create or replace function public.contributors()
 returns table(nickname text, line text, fixed_n integer, pioneer text)
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  with f as (select l.user_id, count(*)::int as n from public.bug_letters l where l.status = '반영' group by l.user_id)
  select p.nickname, c.line, coalesce(f.n, 0), p.pioneer
  from public.profiles p
  left join f on f.user_id = p.id
  left join public.contributor_notes c on c.user_id = p.id
  where (coalesce(f.n, 0) >= 3 or p.pioneer is not null) and coalesce(p.is_test, false) = false
  order by (p.pioneer is null), coalesce(f.n, 0) desc, p.nickname
  limit 200;
$$;

-- [운영자] 한 줄을 쓸 사람들 (반영 1건 이상 · 개척자)
create or replace function public.admin_contributors()
 returns table(user_id uuid, nickname text, line text, fixed_n integer, pioneer text)
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  with f as (select l.user_id, count(*)::int as n from public.bug_letters l where l.status = '반영' group by l.user_id)
  select p.id, p.nickname, c.line, coalesce(f.n, 0), p.pioneer
  from public.profiles p
  left join f on f.user_id = p.id
  left join public.contributor_notes c on c.user_id = p.id
  where public.is_admin() and (coalesce(f.n, 0) >= 1 or p.pioneer is not null)
  order by coalesce(f.n, 0) desc, p.nickname
  limit 500;
$$;

-- [운영자] 한 줄 쓰기 (빈 글 = 지우기)
create or replace function public.admin_set_contributor_note(p_user uuid, p_line text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if nullif(btrim(coalesce(p_line, '')), '') is null then
    delete from public.contributor_notes c where c.user_id = p_user;
  else
    insert into public.contributor_notes(user_id, line, updated_at) values (p_user, left(btrim(p_line), 60), now())
    on conflict (user_id) do update set line = excluded.line, updated_at = now();
  end if;
  return 'ok';
end $$;

-- ───────── 4. 소문 한 줄 보내기 ─────────

create table if not exists public.rumor_submissions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 40),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.rumor_submissions enable row level security;
revoke all on table public.rumor_submissions from anon, authenticated;
create index if not exists rumor_sub_user_idx on public.rumor_submissions(user_id, created_at desc);
create index if not exists rumor_sub_status_idx on public.rumor_submissions(status, created_at desc);

-- 욕설 판정: 채팅 금칙어(banned_words) + 기본 목록 · 띄어쓰기·기호·숫자를 지우고 본다
create or replace function public.rumor_has_bad(p text)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  with n as (select lower(regexp_replace(coalesce(p, ''), '[[:space:][:punct:]0-9]', '', 'g')) as t)
  select exists (select 1 from public.banned_words b, n where length(b.word) > 0 and position(lower(b.word) in n.t) > 0)
      or (select n.t from n) ~ '(시발|씨발|씨빨|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|븅신|좆|존나|개새끼|개색|미친놈|미친년|느금|니애미|니애비|엠창|fuck|shit|bitch|asshole)';
$$;

-- [유저] 소문 보내기 → 'ok' | 'no_profile' | 'banned' | 'length' | 'link' | 'banned_word' | 'daily'
create or replace function public.submit_rumor(p_body text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_p public.profiles; v_body text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
begin
  select * into v_p from public.profiles where id = auth.uid();
  if v_p.id is null then return 'no_profile'; end if;
  if coalesce(v_p.chat_banned, false) then return 'banned'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 40 then return 'length'; end if;
  if v_body ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|kr|io|gg|me)\y)' then return 'link'; end if;
  if public.rumor_has_bad(v_body) then return 'banned_word'; end if;
  if exists (select 1 from public.rumor_submissions r where r.user_id = auth.uid()
             and (r.created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date) then return 'daily'; end if;
  insert into public.rumor_submissions(user_id, body) values (auth.uid(), v_body);
  return 'ok';
end $$;

-- [모두] 승인된 소문 (게임 [소문] 풀에 「— 닉네임」으로 섞인다) · 승인 전엔 아무에게도 안 보인다
create or replace function public.approved_rumors()
 returns table(id bigint, body text, nickname text)
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select r.id, r.body, p.nickname
  from public.rumor_submissions r
  join public.profiles p on p.id = r.user_id
  where r.status = 'approved' and not coalesce(p.chat_banned, false)
  order by r.decided_at desc nulls last, r.id desc
  limit 200;
$$;

-- [운영자] 소문 목록 (기본: 기다리는 것)
create or replace function public.admin_list_rumors(p_status text default 'pending')
 returns table(id bigint, created_at timestamptz, nickname text, body text, status text)
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select r.id, r.created_at, p.nickname, r.body, r.status
  from public.rumor_submissions r
  left join public.profiles p on p.id = r.user_id
  where public.is_admin() and (p_status is null or r.status = p_status)
  order by r.created_at desc
  limit 300;
$$;

-- [운영자] 승인 · 거절
create or replace function public.admin_set_rumor(p_id bigint, p_status text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_status not in ('pending','approved','rejected') then raise exception 'bad_status'; end if;
  update public.rumor_submissions r set status = p_status, decided_at = case when p_status = 'pending' then null else now() end where r.id = p_id;
  if not found then raise exception 'not_found'; end if;
  return 'ok';
end $$;

-- ───────── 5. 실행 권한 ─────────
-- 기본(PUBLIC) 실행 권한을 걷고 필요한 역할에만 준다

revoke all on function public.is_admin() from public;
revoke all on function public.admin_list_letters(text, integer) from public;
revoke all on function public.admin_set_letter(bigint, text, text, text) from public;
revoke all on function public.my_letter_replies() from public;
revoke all on function public.mark_replies_read(bigint[]) from public;
revoke all on function public.letter_credits(text) from public;
revoke all on function public.contributors() from public;
revoke all on function public.admin_contributors() from public;
revoke all on function public.admin_set_contributor_note(uuid, text) from public;
revoke all on function public.rumor_has_bad(text) from public;
revoke all on function public.submit_rumor(text) from public;
revoke all on function public.approved_rumors() from public;
revoke all on function public.admin_list_rumors(text) from public;
revoke all on function public.admin_set_rumor(bigint, text) from public;

-- 누구나 (로그인 없이도): 운영자인가 · 패치 노트 크레딧 · 함께 만든 사람들 · 승인된 소문
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.letter_credits(text) to anon, authenticated;
grant execute on function public.contributors() to anon, authenticated;
grant execute on function public.approved_rumors() to anon, authenticated;
-- 로그인한 사람: 내 답장 · 읽음 · 소문 보내기 · (운영자 함수는 안에서 is_admin()을 다시 확인)
grant execute on function public.my_letter_replies() to authenticated;
grant execute on function public.mark_replies_read(bigint[]) to authenticated;
grant execute on function public.submit_rumor(text) to authenticated;
grant execute on function public.admin_list_letters(text, integer) to authenticated;
grant execute on function public.admin_set_letter(bigint, text, text, text) to authenticated;
grant execute on function public.admin_contributors() to authenticated;
grant execute on function public.admin_set_contributor_note(uuid, text) to authenticated;
grant execute on function public.admin_list_rumors(text) to authenticated;
grant execute on function public.admin_set_rumor(bigint, text) to authenticated;
-- rumor_has_bad: 다른 함수 안에서만 (클라이언트 실행 권한 없음) · bug_letters_guard는 트리거 전용 (RPC로 부를 수 없다)

-- PostgREST가 새 함수를 바로 보게
notify pgrst, 'reload schema';
