-- v0.24.2 HARVEST §3: 계정 삭제 — delete_my_account(p_inn text)
--  형철이 SQL Editor에서 실행 (MCP는 삭제 구문을 막는다). 여러 번 실행해도 같다 (create or replace · revoke/grant).
--  돌려주는 값: 'ok' | 'no_auth' | 'admin' | 'wrong_name'
--  순서: 로그인 확인 → 운영자 거절 → 여관 이름 확인 → FK가 set null / 없음인 표를 먼저 지움 → auth.users 삭제(나머지는 cascade)
--  10/13 FK: cascade — profiles, saves, villages, village_likes, raid_scores, chat_blocks, account_recovery, eval_scores(profiles),
--            admins, contributor_notes, rumor_submissions / set null — chat_messages, bug_letters, chat_reports.reporter / 없음 — play_events

create or replace function public.delete_my_account(p_inn text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_inn text := btrim(coalesce(p_inn, ''));
  v_name text;
begin
  if v_uid is null then return 'no_auth'; end if;
  if exists (select 1 from public.admins a where a.user_id = v_uid) then return 'admin'; end if;

  -- 여관 이름: profiles 기준 (클라이언트가 12자로 잘라 올린다) · 없으면 villages.snapshot 쪽은 보지 않는다
  select p.inn_name into v_name from public.profiles p where p.id = v_uid;
  if v_name is null or v_inn = '' or (v_inn <> v_name and left(v_inn, 12) <> v_name) then return 'wrong_name'; end if;

  -- FK가 set null이라 남는 것 · FK 없는 것 먼저
  --  (내 채팅에 걸린 남의 신고도 같이 — chat_reports.message_id 가 chat_messages 를 가리켜도 막히지 않게)
  delete from public.chat_reports r where r.message_id in (select m.id from public.chat_messages m where m.user_id = v_uid);
  delete from public.chat_reports r where r.reporter = v_uid;
  delete from public.chat_messages m where m.user_id = v_uid;
  delete from public.bug_letters l where l.user_id = v_uid;
  delete from public.play_events e where e.user_id = v_uid;

  -- 나머지는 cascade
  delete from auth.users u where u.id = v_uid;
  return 'ok';
end $$;

revoke all on function public.delete_my_account(text) from public;
revoke all on function public.delete_my_account(text) from anon;
grant execute on function public.delete_my_account(text) to authenticated;

-- ───────── 시험 뒤 확인 (읽기만 · 테스트 계정으로 삭제한 다음) ─────────
--  1) 삭제 전에 테스트 계정 id 를 적어 둔다:
--     select id, login_id, inn_name from public.profiles where login_id = '<테스트 아이디>';
--  2) 삭제 뒤 아래 :uid 자리에 그 id 를 넣고 실행 → n 이 전부 0 이어야 한다
-- with u as (select '00000000-0000-0000-0000-000000000000'::uuid as id)
-- select 'auth.users' as t, count(*) as n from auth.users, u where auth.users.id = u.id
-- union all select 'profiles', count(*) from public.profiles p, u where p.id = u.id
-- union all select 'saves', count(*) from public.saves s, u where s.user_id = u.id
-- union all select 'villages', count(*) from public.villages v, u where v.user_id = u.id
-- union all select 'village_likes', count(*) from public.village_likes l, u where l.user_id = u.id
-- union all select 'raid_scores', count(*) from public.raid_scores r, u where r.user_id = u.id
-- union all select 'eval_scores', count(*) from public.eval_scores e, u where e.user_id = u.id
-- union all select 'chat_blocks', count(*) from public.chat_blocks b, u where b.user_id = u.id
-- union all select 'account_recovery', count(*) from public.account_recovery a, u where a.user_id = u.id
-- union all select 'admins', count(*) from public.admins a, u where a.user_id = u.id
-- union all select 'contributor_notes', count(*) from public.contributor_notes c, u where c.user_id = u.id
-- union all select 'rumor_submissions', count(*) from public.rumor_submissions r, u where r.user_id = u.id
-- union all select 'chat_messages', count(*) from public.chat_messages m, u where m.user_id = u.id
-- union all select 'bug_letters', count(*) from public.bug_letters l, u where l.user_id = u.id
-- union all select 'chat_reports', count(*) from public.chat_reports r, u where r.reporter = u.id
-- union all select 'play_events', count(*) from public.play_events e, u where e.user_id = u.id;
--  (컬럼 이름이 다르면 — 예: village_likes 가 liker_id, chat_blocks 가 blocker 등 — 그 줄만 고쳐서 실행)
--  3) 랭킹 뷰에서도 빠졌는지:
-- select count(*) from public.rank_weekly_raid where user_id = '<id>';   -- rank_reputation · rank_codex · rank_eval 도 같은 식
--  4) 같은 아이디로 다시 가입되는지 게임에서 확인
