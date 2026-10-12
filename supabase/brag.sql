-- GROWTH §3-5: [알림] 자랑 — post_notice에 'brag' 종류 추가
-- 클라이언트는 p_arg = '종류|이름' 만 보낸다 (종류: unique · relic · enh10 · tr15 · tr20 · set3 · fish). 문장은 서버가 만든다.
-- 기존 legend · boss_kill · rank1 동작은 그대로. 같은 사람 1분에 1번 제한도 그대로.
create or replace function public.post_notice(p_kind text, p_arg text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_p profiles; v_body text; v_k text; v_x text;
begin
  select * into v_p from profiles where id = auth.uid();
  if v_p.id is null then raise exception 'no_profile'; end if;
  if p_kind not in ('legend','boss_kill','rank1','brag') then raise exception 'kind'; end if;
  if exists (select 1 from chat_messages where user_id = auth.uid() and channel='notice' and created_at > now() - interval '1 minute') then return; end if;
  if p_kind = 'brag' then
    v_k := split_part(coalesce(p_arg,''), '|', 1);
    v_x := left(regexp_replace(substr(coalesce(p_arg,''), length(v_k) + 2), '[\r\n<>]', '', 'g'), 24);
    if v_k not in ('unique','relic','enh10','tr15','tr20','set3','fish') then raise exception 'brag_kind'; end if;
    v_body := case v_k
      when 'unique' then '★ ' || v_p.nickname || '님이 「' || v_x || '」을(를) 손에 넣었어요!'
      when 'relic' then '✨ ' || v_p.nickname || '님이 유물 「' || v_x || '」을(를) 손에 넣었어요!'
      when 'enh10' then '⚒️ ' || v_p.nickname || '님의 「' || v_x || '」이(가) +10 강화에 성공!'
      when 'tr15' then '🔥 ' || v_p.nickname || '님의 「' || v_x || '」이(가) +15 초월에 성공!'
      when 'tr20' then '🌟 ' || v_p.nickname || '님의 「' || v_x || '」이(가) +20 극의에 닿았어요!'
      when 'set3' then '🛡️ ' || v_p.nickname || '님이 「' || v_x || '」 세트 3부위를 처음 완성했어요!'
      else '🎣 ' || v_p.nickname || '님이 전설의 물고기 「' || v_x || '」을(를) 낚았어요!' end;
  else
    v_body := case p_kind
      when 'legend' then '★ ' || v_p.inn_name || '에 전설 영웅 「' || left(p_arg,20) || '」이(가) 찾아왔습니다!'
      when 'boss_kill' then '⚑ ' || v_p.inn_name || '이(가) 「' || left(p_arg,20) || '」을(를) 쓰러뜨렸습니다!'
      else '♛ ' || v_p.nickname || '님이 주간 토벌 1위에 올랐습니다!' end;
  end if;
  insert into chat_messages(user_id, channel, nickname, rep_hero, body) values (auth.uid(),'notice',v_p.nickname,v_p.rep_hero,left(v_body,100));
end $function$;
