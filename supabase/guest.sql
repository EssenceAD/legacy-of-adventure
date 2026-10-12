-- GUEST_SPEC — 운영자가 Supabase SQL Editor에서 한 번 실행 (클라이언트는 아래가 없어도 깨지지 않는다)
-- 대시보드: Authentication → Sign In / Providers → 「Allow anonymous sign-ins」 켜기

-- §2: 운영·테스트 계정을 이웃 목록에서 숨기는 플래그 (데이터 삭제 없음 · 유저는 못 고침)
alter table public.profiles add column if not exists is_test boolean not null default false;
update public.profiles set is_test = true where login_id = 'cholybrown';  -- 사자무리 여관 (GM)

-- §1: 게스트(아이디 g_…) → 「계정 연결하기」 때 아이디를 한 번만 바꾼다
--  (profiles의 login_id는 유저가 직접 못 고치게 되어 있어서 이 함수로만)
create or replace function public.link_guest(new_login_id text, dry_run boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cur text;
begin
  select login_id into cur from profiles where id = auth.uid();
  if cur is null then return 'no_profile'; end if;
  if left(cur, 2) <> 'g_' then return 'not_guest'; end if;
  if new_login_id !~ '^[a-z0-9_]{4,16}$' or left(new_login_id, 2) = 'g_' then return 'bad_id'; end if;
  if exists (select 1 from profiles where login_id = new_login_id) then return 'taken'; end if;
  if dry_run then return 'ok'; end if;
  update profiles set login_id = new_login_id, updated_at = now() where id = auth.uid();
  return 'ok';
end;
$$;
revoke all on function public.link_guest(text, boolean) from public, anon;
grant execute on function public.link_guest(text, boolean) to authenticated;
