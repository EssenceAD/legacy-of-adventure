-- RAIDWEAPON §3' 「하늘 균열」 (월드 레이드 v2 · 플래그 worldRaid) — 형철이 Supabase SQL Editor에서 이 파일 전체를 한 번 실행 (여러 번 실행해도 같다)
--  ① 이 파일 전체 실행 (표 · 함수 · 권한)  →  ② 맨 아래 「첫 보스」 한 줄 실행 (체력 숫자 확인)  →  ③ (있으면) pg_cron 한 줄  →  ④ (원하면) 시험 보스
--  클라이언트는 이 SQL이 아직 없어도 깨지지 않는다 (함수가 없으면 알약·하늘 금이 안 보이고 랭킹 탭은 「준비 중」)
--  기존 데이터는 지우지 않는다 (새 표 · 새 함수만)
--
-- 규칙
--  · 회차 = 하루. 매일 05:00 KST 새 보스 (3종 순환: sky 하늘을 삼킨 것 → ember 잿불 거인 → frost 서리 뱀)
--    첫 보스만: 켜는 순간(world_seed 실행)부터 다음 05:00까지
--  · 「하루」 = 한국 시각에서 5시간을 뺀 날짜 (05:00 ~ 다음 날 04:59 가 같은 날) → world_bosses.day
--  · 한 사람 하루(= 그 보스) 3번 · 한 판 피해는 서버가 자른다: 파티 전투력 합 × c_cap · 보스 최대 체력 × c_hit_max_frac (시험 보스는 이 줄 없음)
--  · 이상치: 피해 ÷ 전투력 > c_flag_ratio 이거나 보낸 값이 잘렸으면 world_hits.flagged = true (막지 않음 · 나중에 형철/Claude가 본다)
--  · 다음 날 체력 = 전날 최대 체력 × (24시간 ÷ 전날 기간) × (처치했으면 1.15 · 못 했으면 0.8) → [c_hp_min, c_hp_max]
--    (첫날은 기간이 짧으니 하루치로 늘려서 계산)
--  · 보상은 기간이 끝난 뒤(다음 05:00) world_settle → world_rewards 표 → 클라이언트가 접속할 때 world_claim()으로 한 번만 받아 우편함에 넣는다
--    (우편함은 클라이언트 저장 안에만 있어서 서버 표로 건넨다 · claimed_at 이 있으면 다시 안 줌)
--    버닝 주말 조각 ×2 는 클라이언트가 받을 때 그 보상의 day 로 판정한다 (서버 값은 그대로)
--  · 주간 = 월요일 05:00 ~ 다음 월요일 05:00 (day 기준 date_trunc('week')) · 주가 끝나면 world_roll 이 world_settle_week
--  · pg_cron 이 없으면: 클라이언트가 앱을 켤 때 world_roll() 을 한 번 부른다 (가볍고 여러 번 불러도 같다 · 동시에 불러도 잠금으로 한 번만)
--  · 운영·테스트 계정(profiles.is_test)은 순위·상위 보상에서 빠진다 (참여·처치 보상은 받음)
--  · 숫자는 src/data/config.ts CONFIG.raidWeapon.world 와 같게 (서버 값이 진짜 · 바꾸면 둘 다)

begin;

-- ───────── 0. 상수 (여기 한 곳 · config.ts raidWeapon.world 와 같은 값) ─────────

create or replace function public.world_c(k text)
 returns numeric
 language sql
 immutable
as $$
  select (case k
    when 'tries'        then 3            -- 하루 도전 (world.tries)
    when 'cap'          then 60           -- 한 판 피해 ≤ 파티 전투력 합 × cap (world.cap)
    when 'flag_ratio'   then 35           -- 피해 ÷ 전투력 > 이 값이면 표시만 (world.flagRatio)
    when 'hit_max_frac' then 0.1          -- 한 판 피해 ≤ 보스 최대 체력 × 이 값 (world.hitMaxFrac · 시험 보스 제외)
    when 'max_power'    then 100000000    -- 전투력으로 믿는 최대값 (넘으면 이 값으로)
    when 'hp_min'       then 1000000      -- 다음 날 체력 하한 (world.hpMin)
    when 'hp_max'       then 500000000    -- 다음 날 체력 상한 (world.hpMax)
    when 'kill_mult'    then 1.15         -- 전날 처치 → × (world.killMult)
    when 'miss_mult'    then 0.8          -- 전날 못 잡음 → × (world.missMult)
    when 'd_frags'      then 1            -- 그날 참여: 무기 조각 (world.daily.frags)
    when 'd_dust'       then 40           -- 그날 참여: 잿빛 가루 (world.daily.dust)
    when 'd_kill'       then 1            -- 그날 처치 성공(참여자 모두): 조각 + (world.daily.kill)
    when 'd_top_n'      then 3            -- 그날 피해 순위 1~n위 (world.daily.topN)
    when 'd_top'        then 2            -- 그 사람들: 조각 + · 칭호 「균열의 영웅」 (world.daily.top)
    when 'w_box_top'    then 3            -- 주간 합산 1~n위: 선택 상자 1 (world.weekly.boxTop)
    when 'w_frag_top'   then 10           -- 주간 합산 ~n위: 조각 (world.weekly.fragTop)
    when 'w_frag_n'     then 3            --   그 조각 수 (world.weekly.fragN)
  end)::numeric;
$$;

-- 보스 이름 (look 키 → 이름 · 화면은 「균열 너머의 ○○」)
create or replace function public.world_boss_name(p_look text)
 returns text
 language sql
 immutable
as $$
  select case p_look when 'ember' then '잿불 거인' when 'frost' then '서리 뱀' else '하늘을 삼킨 것' end;
$$;

-- 「하루」: 한국 시각 − 5시간의 날짜 · 그 날의 시작(05:00 KST)
create or replace function public.world_day(t timestamptz)
 returns date
 language sql
 stable
as $$
  select ((t at time zone 'Asia/Seoul') - interval '5 hours')::date;
$$;
create or replace function public.world_day_start(d date)
 returns timestamptz
 language sql
 stable
as $$
  select (d + time '05:00') at time zone 'Asia/Seoul';
$$;

-- ───────── 1. 표 ─────────

create table if not exists public.world_bosses (
  id bigint generated always as identity primary key,
  name text not null,
  look text not null default 'sky',
  hp_max bigint not null check (hp_max > 0),
  hp_left bigint not null check (hp_left >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  killed_at timestamptz,
  killer uuid references auth.users(id) on delete set null,
  day date not null,
  test boolean not null default false,          -- 시험 보스 (운영자만 · 순위·보상 없음)
  notified smallint not null default 0,          -- [알림] 보낸 단계 (1 = 50% · 2 = 25% · 3 = 처치)
  settled_at timestamptz,                         -- 하루 보상 정산한 시각 (있으면 다시 안 함)
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create unique index if not exists world_bosses_one_per_day on public.world_bosses (day) where not test;
create index if not exists world_bosses_live on public.world_bosses (ends_at desc) where not test;

create table if not exists public.world_hits (
  id bigint generated always as identity primary key,
  boss_id bigint not null references public.world_bosses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dmg bigint not null check (dmg >= 0),           -- 서버가 자른 뒤 피해 (보스 체력에 들어간 값의 바탕)
  raw bigint not null default 0,                  -- 클라이언트가 보낸 값 (확인용)
  power integer not null default 0,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists world_hits_boss_user on public.world_hits (boss_id, user_id);
create index if not exists world_hits_flagged on public.world_hits (boss_id) where flagged;

create table if not exists public.world_rewards (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ref text not null,                              -- 'd:보스id' (하루) · 'w:주시작일' (주간) — 같은 사람 같은 ref 는 한 번
  kind text not null check (kind in ('daily', 'weekly')),
  day date not null,                              -- 하루 보상 = 그 보스의 day · 주간 = 그 주 마지막 날 (버닝 판정용)
  boss_id bigint references public.world_bosses(id) on delete set null,
  week date,
  payload jsonb not null default '{}'::jsonb,     -- {frags, dust, boxes, title, rank, killed, dmg, name}
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (user_id, ref)
);
create index if not exists world_rewards_unclaimed on public.world_rewards (user_id) where claimed_at is null;

create table if not exists public.world_weeks (
  week date primary key,                          -- 월요일 (day 기준)
  settled_at timestamptz not null default now()
);

-- RLS: 클라이언트는 표를 직접 읽거나 쓰지 못한다 (정책 없음 · 함수로만)
alter table public.world_bosses enable row level security;
alter table public.world_hits enable row level security;
alter table public.world_rewards enable row level security;
alter table public.world_weeks enable row level security;
revoke all on table public.world_bosses, public.world_hits, public.world_rewards, public.world_weeks from anon, authenticated;

-- ───────── 2. 보스 상태 (안에서만 쓴다) ─────────
--  {"id","name","look","hp_max","hp_left","starts_at","ends_at","day","test","killed","killer_inn","players","my_tries","my_total","my_rank","tries_max","now"}

create or replace function public.world_state(p_boss bigint, p_uid uuid)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  with tot as (
    select h.user_id, sum(h.dmg)::bigint as dmg from public.world_hits h where h.boss_id = p_boss group by h.user_id
  ),
  rk as (
    select t.user_id, t.dmg, rank() over (order by t.dmg desc) as r
      from tot t join public.profiles p on p.id = t.user_id
     where not coalesce(p.is_test, false) and t.dmg > 0
  )
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'look', b.look, 'hp_max', b.hp_max, 'hp_left', b.hp_left,
    'starts_at', b.starts_at, 'ends_at', b.ends_at, 'day', b.day, 'test', b.test,
    'killed', b.killed_at is not null,
    'killer_inn', (select p.inn_name from public.profiles p where p.id = b.killer),
    'players', (select count(*) from tot),
    'my_tries', (select count(*) from public.world_hits h where h.boss_id = b.id and h.user_id = p_uid),
    'my_total', coalesce((select t.dmg from tot t where t.user_id = p_uid), 0),
    'my_rank', (select x.r from rk x where x.user_id = p_uid),
    'tries_max', public.world_c('tries')::int,
    'now', now()
  )
  from public.world_bosses b where b.id = p_boss;
$$;

-- ───────── 3. world_current(p_test) — 지금 보스 (없으면 null) · 막대·남은 도전을 때리기 전에 보여 주기 ─────────
--  p_test = true: 운영자만 · 진행 중인 시험 보스

create or replace function public.world_current(p_test boolean default false)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $$
declare v_id bigint;
begin
  if coalesce(p_test, false) then
    if not public.is_admin() then return null; end if;
    select b.id into v_id from public.world_bosses b where b.test and now() >= b.starts_at and now() < b.ends_at order by b.id desc limit 1;
  else
    select b.id into v_id from public.world_bosses b where not b.test and now() >= b.starts_at and now() < b.ends_at order by b.starts_at desc limit 1;
  end if;
  if v_id is null then return null; end if;
  return public.world_state(v_id, auth.uid());
end $$;

-- ───────── 4. world_hit(p_boss, p_dmg, p_power) — 한 판 결과 올리기 ─────────
--  돌려주는 값: {"r":"ok","dmg":잘린 피해,"killed_now":bool, …world_state} | {"r":"login"|"no_boss"} | {"r":"ended"|"tries", …world_state}
--  보스가 이미 쓰러졌어도 기록은 남긴다 (그날 순위·참여) · 체력은 그대로 0

create or replace function public.world_hit(p_boss bigint, p_dmg bigint, p_power integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles;
  v_b public.world_bosses;
  v_n integer;
  v_pow bigint;
  v_dmg bigint;
  v_raw bigint := greatest(coalesce(p_dmg, 0), 0);
  v_after numeric;
  v_lv smallint;
  v_body text;
  v_killed boolean := false;
begin
  if v_uid is null then return jsonb_build_object('r', 'login'); end if;
  select * into v_p from public.profiles where id = v_uid;
  if v_p.id is null then return jsonb_build_object('r', 'login'); end if;
  -- 이 보스 줄을 잠근다 (동시에 때려도 체력이 한 번씩 깎임)
  select * into v_b from public.world_bosses where id = p_boss for update;
  if v_b.id is null or (v_b.test and not public.is_admin()) then return jsonb_build_object('r', 'no_boss'); end if;
  if now() < v_b.starts_at or now() >= v_b.ends_at then return jsonb_build_object('r', 'ended') || public.world_state(v_b.id, v_uid); end if;
  select count(*) into v_n from public.world_hits where boss_id = v_b.id and user_id = v_uid;
  if v_n >= public.world_c('tries') then return jsonb_build_object('r', 'tries') || public.world_state(v_b.id, v_uid); end if;

  v_pow := least(greatest(coalesce(p_power, 0), 0), public.world_c('max_power')::bigint);
  v_dmg := least(v_raw, v_pow * public.world_c('cap')::bigint);
  if not v_b.test then v_dmg := least(v_dmg, ceil(v_b.hp_max * public.world_c('hit_max_frac'))::bigint); end if;
  insert into public.world_hits (boss_id, user_id, dmg, raw, power, flagged)
  values (v_b.id, v_uid, v_dmg, v_raw, v_pow, v_raw > v_dmg or (v_pow > 0 and v_dmg::numeric / v_pow > public.world_c('flag_ratio')));

  if v_b.killed_at is null and v_dmg > 0 then
    update public.world_bosses set hp_left = greatest(0, hp_left - v_dmg) where id = v_b.id returning * into v_b;
    if v_b.hp_left = 0 then
      update public.world_bosses set killed_at = now(), killer = v_uid where id = v_b.id returning * into v_b;
      v_killed := true;
    end if;
    -- [알림] 50% · 25% · 처치 — 단계마다 한 번 (시험 보스는 없음)
    v_after := v_b.hp_left::numeric / v_b.hp_max;
    v_lv := case when v_b.hp_left = 0 then 3 when v_after <= 0.25 then 2 when v_after <= 0.5 then 1 else 0 end;
    if not v_b.test and v_lv > v_b.notified then
      update public.world_bosses set notified = v_lv where id = v_b.id;
      v_body := case v_lv
        when 3 then '🌌 ' || coalesce(v_p.inn_name, v_p.nickname) || '의 마지막 일격! 균열 너머의 ' || v_b.name || '이(가) 쓰러졌어요!'
        when 2 then '🌌 균열 너머의 ' || v_b.name || '의 체력이 25% 남았어요!'
        else '🌌 균열 너머의 ' || v_b.name || '의 체력이 절반 남았어요!' end;
      begin
        insert into public.chat_messages (user_id, channel, nickname, rep_hero, body) values (v_uid, 'notice', v_p.nickname, v_p.rep_hero, left(v_body, 100));
      exception when others then null;  -- 채팅 표가 달라도 때리기는 그대로
      end;
    end if;
  end if;
  return jsonb_build_object('r', 'ok', 'dmg', v_dmg, 'killed_now', v_killed) || public.world_state(v_b.id, v_uid);
end $$;

-- ───────── 5. world_rank(p_boss, p_limit) — 하늘 균열 순위: 그날(보스) 피해 상위 n + 내 순위 · 이번 주 합산 상위 n + 내 순위 ─────────
--  p_boss 가 null 이면 지금(또는 마지막) 보스 · 같은 피해면 같은 순위 · 줄 순서는 먼저 그 피해에 닿은 사람이 위
--  {"boss_id","day","week_start","name","day_rows":[{rank,user_id,inn_name,nickname,rep_hero,dmg}],"me_day":{rank,dmg}|null,"week_rows":[…],"me_week":{rank,dmg}|null}

create or replace function public.world_rank(p_boss bigint default null, p_limit integer default 30)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $$
declare
  v_b public.world_bosses;
  v_n integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_ws date;
  v_uid uuid := auth.uid();
  v_day jsonb;
  v_week jsonb;
  v_me_d jsonb;
  v_me_w jsonb;
begin
  if p_boss is not null then select * into v_b from public.world_bosses where id = p_boss and not test;
  else select * into v_b from public.world_bosses where not test and starts_at <= now() order by starts_at desc limit 1;
  end if;
  if v_b.id is null then return null; end if;
  v_ws := date_trunc('week', v_b.day::timestamp)::date;

  with tot as (
    select h.user_id, sum(h.dmg)::bigint as dmg, max(h.created_at) as last_at from public.world_hits h where h.boss_id = v_b.id group by h.user_id
  ), rk as (
    select t.*, rank() over (order by t.dmg desc) as r from tot t join public.profiles p on p.id = t.user_id where not coalesce(p.is_test, false) and t.dmg > 0
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('rank', x.r, 'user_id', x.user_id, 'inn_name', p.inn_name, 'nickname', p.nickname, 'rep_hero', p.rep_hero, 'dmg', x.dmg) order by x.dmg desc, x.last_at asc)
      from (select * from rk order by dmg desc, last_at asc limit v_n) x join public.profiles p on p.id = x.user_id), '[]'::jsonb),
    (select jsonb_build_object('rank', x.r, 'dmg', x.dmg) from rk x where x.user_id = v_uid)
  into v_day, v_me_d;

  with tot as (
    select h.user_id, sum(h.dmg)::bigint as dmg, max(h.created_at) as last_at
      from public.world_hits h join public.world_bosses b on b.id = h.boss_id
     where not b.test and b.day >= v_ws and b.day < v_ws + 7
     group by h.user_id
  ), rk as (
    select t.*, rank() over (order by t.dmg desc) as r from tot t join public.profiles p on p.id = t.user_id where not coalesce(p.is_test, false) and t.dmg > 0
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('rank', x.r, 'user_id', x.user_id, 'inn_name', p.inn_name, 'nickname', p.nickname, 'rep_hero', p.rep_hero, 'dmg', x.dmg) order by x.dmg desc, x.last_at asc)
      from (select * from rk order by dmg desc, last_at asc limit v_n) x join public.profiles p on p.id = x.user_id), '[]'::jsonb),
    (select jsonb_build_object('rank', x.r, 'dmg', x.dmg) from rk x where x.user_id = v_uid)
  into v_week, v_me_w;

  return jsonb_build_object('boss_id', v_b.id, 'day', v_b.day, 'week_start', v_ws, 'name', v_b.name,
    'day_rows', v_day, 'me_day', v_me_d, 'week_rows', v_week, 'me_week', v_me_w);
end $$;

-- ───────── 6. 정산: world_settle(보스) — 하루 보상 (기간이 끝난 보스만 · 한 번만) ─────────
--  그날 피해 > 0 인 사람마다 world_rewards 한 줄 (ref 'd:보스id' · 이미 있으면 그대로)

create or replace function public.world_settle(p_boss bigint)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_b public.world_bosses; v_n integer := 0; v_killed boolean;
begin
  select * into v_b from public.world_bosses where id = p_boss for update;
  if v_b.id is null or v_b.settled_at is not null or now() < v_b.ends_at then return 0; end if;
  v_killed := v_b.killed_at is not null;
  if not v_b.test then
    with tot as (
      select h.user_id, sum(h.dmg)::bigint as dmg, max(h.created_at) as last_at from public.world_hits h where h.boss_id = v_b.id group by h.user_id having sum(h.dmg) > 0
    ), rk as (
      select t.user_id, rank() over (order by t.dmg desc, t.last_at asc) as r from tot t join public.profiles p on p.id = t.user_id where not coalesce(p.is_test, false)
    )
    insert into public.world_rewards (user_id, ref, kind, day, boss_id, payload)
    select t.user_id, 'd:' || v_b.id, 'daily', v_b.day, v_b.id,
      jsonb_strip_nulls(jsonb_build_object(
        'frags', public.world_c('d_frags')::int + case when v_killed then public.world_c('d_kill')::int else 0 end
                 + case when rk.r <= public.world_c('d_top_n') then public.world_c('d_top')::int else 0 end,
        'dust', public.world_c('d_dust')::int,
        'title', case when rk.r <= public.world_c('d_top_n') then '균열의 영웅' end,
        'rank', rk.r, 'killed', v_killed, 'dmg', t.dmg, 'name', v_b.name))
    from tot t left join rk on rk.user_id = t.user_id
    on conflict (user_id, ref) do nothing;
    get diagnostics v_n = row_count;
  end if;
  update public.world_bosses set settled_at = now() where id = v_b.id;
  return v_n;
end $$;

-- ───────── 7. 정산: world_settle_week(월요일) — 주간 합산 순위 보상 (주가 끝난 뒤 · 한 번만) ─────────

create or replace function public.world_settle_week(p_week date)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_n integer := 0; v_wk date := date_trunc('week', p_week::timestamp)::date;
begin
  if v_wk + 7 > public.world_day(now()) then return 0; end if;
  insert into public.world_weeks (week) values (v_wk) on conflict (week) do nothing;
  if not found then return 0; end if;
  with tot as (
    select h.user_id, sum(h.dmg)::bigint as dmg, max(h.created_at) as last_at
      from public.world_hits h join public.world_bosses b on b.id = h.boss_id
     where not b.test and b.day >= v_wk and b.day < v_wk + 7
     group by h.user_id having sum(h.dmg) > 0
  ), rk as (
    select t.user_id, t.dmg, rank() over (order by t.dmg desc, t.last_at asc) as r from tot t join public.profiles p on p.id = t.user_id where not coalesce(p.is_test, false)
  )
  insert into public.world_rewards (user_id, ref, kind, day, week, payload)
  select rk.user_id, 'w:' || v_wk, 'weekly', v_wk + 6, v_wk,
    case when rk.r <= public.world_c('w_box_top') then jsonb_build_object('boxes', 1, 'rank', rk.r, 'dmg', rk.dmg)
         else jsonb_build_object('frags', public.world_c('w_frag_n')::int, 'rank', rk.r, 'dmg', rk.dmg) end
  from rk where rk.r <= public.world_c('w_frag_top')
  on conflict (user_id, ref) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ───────── 8. world_roll() — 정산 + 다음 보스 (여러 번·동시에 불러도 한 번만) ─────────
--  pg_cron 이 있으면 매일 05:01 · 없으면 클라이언트가 앱을 켤 때 한 번 · 돌려주는 값 = 지금 보스 id (첫 보스 전이면 null)

create or replace function public.world_roll()
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_cur bigint;
  v_last public.world_bosses;
  v_r record;
  v_look text;
  v_secs numeric;
  v_hp numeric;
  v_day date := public.world_day(now());
begin
  perform pg_advisory_xact_lock(hashtext('world_roll'));
  -- 1. 기간이 끝난 보스 정산 (시험 보스는 정산 표시만)
  for v_r in select b.id from public.world_bosses b where b.settled_at is null and now() >= b.ends_at order by b.id loop
    perform public.world_settle(v_r.id);
  end loop;
  -- 2. 끝난 주 정산
  for v_r in select distinct date_trunc('week', b.day::timestamp)::date as wk from public.world_bosses b
              where not b.test and date_trunc('week', b.day::timestamp)::date + 7 <= v_day
                and not exists (select 1 from public.world_weeks w where w.week = date_trunc('week', b.day::timestamp)::date) loop
    perform public.world_settle_week(v_r.wk);
  end loop;
  -- 3. 지금 보스가 있으면 그대로
  select b.id into v_cur from public.world_bosses b where not b.test and now() >= b.starts_at and now() < b.ends_at order by b.starts_at desc limit 1;
  if v_cur is not null then return v_cur; end if;
  -- 4. 첫 보스(world_seed) 전이면 아무것도 안 함
  select * into v_last from public.world_bosses b where not b.test order by b.starts_at desc limit 1;
  if v_last.id is null then return null; end if;
  -- 5. 다음 보스: 순환 · 체력 = 전날 최대 × (하루 ÷ 전날 기간) × 처치 1.15 / 못 잡음 0.8 → [하한, 상한]
  v_look := case v_last.look when 'sky' then 'ember' when 'ember' then 'frost' else 'sky' end;
  v_secs := greatest(3600, extract(epoch from (v_last.ends_at - v_last.starts_at)));
  v_hp := v_last.hp_max * 86400.0 / v_secs * case when v_last.killed_at is not null then public.world_c('kill_mult') else public.world_c('miss_mult') end;
  v_hp := least(public.world_c('hp_max'), greatest(public.world_c('hp_min'), round(v_hp)));
  insert into public.world_bosses (name, look, hp_max, hp_left, starts_at, ends_at, day)
  values (public.world_boss_name(v_look), v_look, v_hp::bigint, v_hp::bigint, public.world_day_start(v_day), public.world_day_start(v_day + 1), v_day)
  on conflict do nothing
  returning id into v_cur;
  return v_cur;
end $$;

-- ───────── 9. world_claim() — 내 받을 보상 (한 번만 · 받는 순간 claimed_at) ─────────
--  [{"id","kind","day","week","payload"}] · 클라이언트가 우편함 편지로 바꾼다

create or replace function public.world_claim()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_out jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  with x as (
    update public.world_rewards set claimed_at = now()
     where user_id = auth.uid() and claimed_at is null
    returning id, kind, day, week, payload
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'day', x.day, 'week', x.week, 'payload', x.payload) order by x.id), '[]'::jsonb) into v_out from x;
  return v_out;
end $$;

-- ───────── 10. 운영자용 (SQL Editor에서만 · 클라이언트 실행 금지) ─────────

-- 첫 보스: 지금부터 다음 05:00 KST 까지 (이미 진행 중인 보스가 있으면 그 id)
create or replace function public.world_seed(p_hp bigint, p_look text default 'sky')
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_id bigint; v_day date := public.world_day(now());
begin
  select b.id into v_id from public.world_bosses b where not b.test and now() >= b.starts_at and now() < b.ends_at limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.world_bosses (name, look, hp_max, hp_left, starts_at, ends_at, day)
  values (public.world_boss_name(p_look), coalesce(p_look, 'sky'), p_hp, p_hp, now(), public.world_day_start(v_day + 1), v_day)
  returning id into v_id;
  return v_id;
end $$;

-- 시험 보스: 체력 작게 · p_minutes 분 동안 · 운영자 계정(public.admins)만 보이고 때릴 수 있음 (순위·보상·[알림] 없음)
create or replace function public.world_test_boss(p_hp bigint default 3000, p_minutes integer default 120, p_look text default 'sky')
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare v_id bigint;
begin
  insert into public.world_bosses (name, look, hp_max, hp_left, starts_at, ends_at, day, test)
  values (public.world_boss_name(p_look), coalesce(p_look, 'sky'), p_hp, p_hp, now(), now() + make_interval(mins => greatest(1, p_minutes)), public.world_day(now()), true)
  returning id into v_id;
  return v_id;
end $$;

-- ───────── 11. 실행 권한 (Supabase는 새 함수마다 anon · authenticated 에 execute 를 준다 → 뺀다) ─────────

revoke all on function public.world_c(text) from public, anon, authenticated;
revoke all on function public.world_boss_name(text) from public, anon, authenticated;
revoke all on function public.world_day(timestamptz) from public, anon, authenticated;
revoke all on function public.world_day_start(date) from public, anon, authenticated;
revoke all on function public.world_state(bigint, uuid) from public, anon, authenticated;
revoke all on function public.world_settle(bigint) from public, anon, authenticated;
revoke all on function public.world_settle_week(date) from public, anon, authenticated;
revoke all on function public.world_seed(bigint, text) from public, anon, authenticated;
revoke all on function public.world_test_boss(bigint, integer, text) from public, anon, authenticated;
revoke all on function public.world_current(boolean) from public, anon;
revoke all on function public.world_hit(bigint, bigint, integer) from public, anon;
revoke all on function public.world_roll() from public, anon;
revoke all on function public.world_claim() from public, anon;
revoke all on function public.world_rank(bigint, integer) from public;
grant execute on function public.world_current(boolean) to authenticated;
grant execute on function public.world_hit(bigint, bigint, integer) to authenticated;
grant execute on function public.world_roll() to authenticated;
grant execute on function public.world_claim() to authenticated;
-- 순위는 다른 랭킹처럼 로그인 안 해도 볼 수 있게 (여관 이름 · 닉네임 · 피해만)
grant execute on function public.world_rank(bigint, integer) to anon, authenticated;

commit;

-- ═════════ ② 첫 보스 (이 파일을 실행한 뒤 · 켜는 날 밤에 한 번) ═════════
--  켜는 순간부터 다음 05:00 KST 까지가 1회차. 체력 = 「Claude가 정함」 아래 숫자 (첫 회는 짧아서 작게):
--   시트(real_woongs · 중간 헤비)에서 한 판(60초) 피해 ≈ 40만 · 운영 세이브 ≈ 400만 → 한 판 상한(체력 × 10% = 60만)에 많이 닿음
--   첫 밤(밤 10~11시 켜기 → 05:00) 참여 ≈ 15명 × 1.5판 × 평균 35만 ≈ 800만 → 600만이면 새벽 전에 쓰러질 만함
--   다음 날부터는 world_roll 이 자동: 하루치로 늘려(× 24시간 ÷ 첫 회 기간) × 1.15(처치) / × 0.8(못 잡음) — 600만·6.5시간 처치면 둘째 날 ≈ 2,550만
--
-- select public.world_seed(6000000 /* ← HP_FIRST · Claude가 정함 (600만) · 바꿔도 됨 */, 'sky');

-- ═════════ ③ (있으면) pg_cron — 매일 05:01 KST(= 20:01 UTC) 정산 + 다음 보스 ═════════
--  Database → Extensions 에서 pg_cron 이 켜져 있을 때만. 없으면 건너뛰어도 된다 (클라이언트가 앱을 켤 때 world_roll() 을 부름)
--
-- select cron.schedule('world_roll_daily', '1 20 * * *', $$select public.world_roll()$$);

-- ═════════ ④ (선택) 시험 보스 — 운영자 계정으로만 보임 · 순위·보상 없음 ═════════
--  1) 아래 한 줄 실행 (체력 3,000 · 2시간)
--  2) 운영자 계정(essencead)으로 로그인한 기기에서 브라우저 콘솔: localStorage.setItem('legacy-of-adventure-riftTest', 'true') → 새로고침
--     (+ 실험실 「새 화면 미리 보기」 켜기 · 플래그가 꺼져 있어도 실험실이면 보임) → 알약 「🌌 하늘 균열 · 시험」
--  3) 끝나면 localStorage.removeItem('legacy-of-adventure-riftTest')
--
-- select public.world_test_boss(3000, 120, 'sky');

-- ───────── 확인 (읽기만) ─────────
-- select id, name, look, hp_max, hp_left, starts_at, ends_at, day, killed_at, test, notified, settled_at from public.world_bosses order by id desc limit 5;
-- select user_id, count(*) n, sum(dmg) dmg, bool_or(flagged) flagged from public.world_hits where boss_id = (select max(id) from public.world_bosses where not test) group by user_id order by dmg desc;
-- select * from public.world_hits where flagged order by id desc limit 20;      -- 이상치 (막지 않음)
-- select kind, count(*), count(claimed_at) from public.world_rewards group by kind;
-- select p.proname, has_function_privilege('anon', p.oid, 'execute') anon_exec, has_function_privilege('authenticated', p.oid, 'execute') auth_exec
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'world_%' order by 1;
--   기대: anon_exec 는 world_rank 만 true · auth_exec 는 world_current · world_hit · world_roll · world_claim · world_rank 만 true
