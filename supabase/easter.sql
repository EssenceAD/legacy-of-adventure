-- EASTER_SPEC — 베타 개척자 4인 표시 (운영자가 Supabase SQL Editor에서 한 번 실행)
-- 클라이언트는 profiles.pioneer 값으로만 판정한다 (id 하드코딩 없음) · 유저는 이 칸을 고칠 수 없다 (UPDATE 권한 없음)

alter table public.profiles add column if not exists pioneer text
  check (pioneer is null or pioneer in ('woongs', 'gonu', 'warmnight', 'ikamolly'));

update public.profiles set pioneer = 'woongs'    where id = '8e8970d1-babf-49dc-a303-ea1d896cc33a';  -- 웅스 · 롯데캐슬 여관
update public.profiles set pioneer = 'gonu'      where id = '21259320-1533-42a9-b6e3-c97d48021dc1';  -- 고느끼 · 꾸무적 여관
update public.profiles set pioneer = 'warmnight' where id = 'd74b728b-9d32-4d50-8bfd-736c26086482';  -- 따뜻한밤 · 머리박고힐 여관
update public.profiles set pioneer = 'ikamolly'  where id = '44ba0160-10e9-479a-b2a8-c89eed46c6d2';  -- 이카몰리 · 윈드 여관

-- 확인: 4줄이 나와야 한다
select nickname, inn_name, pioneer from public.profiles where pioneer is not null order by nickname;
