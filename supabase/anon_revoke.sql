-- v0.24.2: Supabase 기본 권한 정리 — direction.sql 운영자 함수 · rumor_has_bad 에서 anon 실행 권한 빼기
--  Supabase는 새 함수마다 anon · authenticated 에 execute 를 직접(default privileges) 준다.
--  direction.sql 은 `from public` 만 revoke 해서 anon 직접 권한이 남아 있을 수 있다 → 여기서 지운다.
--  여러 번 실행해도 같다 (revoke/grant 는 멱등). 데이터는 건드리지 않는다.
--  direction.sql 이 먼저 실행돼 있어야 한다 (함수가 없으면 에러 → 그 줄만 확인).

begin;

-- 운영자 함수: anon · public 실행 금지 · 로그인 유저(authenticated)는 그대로 (함수 안에서 is_admin() 검사)
revoke execute on function public.admin_list_letters(text, integer) from anon, public;
revoke execute on function public.admin_set_letter(bigint, text, text, text) from anon, public;
revoke execute on function public.admin_contributors() from anon, public;
revoke execute on function public.admin_set_contributor_note(uuid, text) from anon, public;
revoke execute on function public.admin_list_rumors(text) from anon, public;
revoke execute on function public.admin_set_rumor(bigint, text) from anon, public;

grant execute on function public.admin_list_letters(text, integer) to authenticated;
grant execute on function public.admin_set_letter(bigint, text, text, text) to authenticated;
grant execute on function public.admin_contributors() to authenticated;
grant execute on function public.admin_set_contributor_note(uuid, text) to authenticated;
grant execute on function public.admin_list_rumors(text) to authenticated;
grant execute on function public.admin_set_rumor(bigint, text) to authenticated;

-- 욕설 판정 도우미: submit_rumor(security definer) 안에서만 쓴다 → 바깥에서 직접 부를 일 없음
--  anon · public 은 물론 authenticated 도 뺀다 (금칙어 목록을 하나씩 떠보는 걸 막기 · submit_rumor 는 소유자 권한이라 영향 없음)
revoke execute on function public.rumor_has_bad(text) from anon, authenticated, public;

commit;

-- 확인 (읽기만): anon 이 실행할 수 있는지 — 전부 false 여야 한다
-- select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_exec,
--        has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('admin_list_letters','admin_set_letter','admin_contributors','admin_set_contributor_note',
--                      'admin_list_rumors','admin_set_rumor','rumor_has_bad')
--  order by 1;
-- 기대값: anon_exec 전부 false · auth_exec 는 admin_* true / rumor_has_bad false
