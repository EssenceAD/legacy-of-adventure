// v0.25.4 CHECKIN §C3 「다녀오셨어요」 카드 (플래그 welcomeBack · 실험실)
//  방치 요약(OfflineSummary)을 접속 첫 화면 카드로: 받을 금화 · 다녀간 손님 · 끝난 원정 · 다 자란 것 (4칸) + [모두 받기] 한 번
//  7일 이상 만이면 같은 카드 위에 「오랜만이에요」 선물 상자(box_gift 그림) — 금화(하루 평균 수입×2) + 예배당 축복 30분 · 「그동안 바뀐 것」 패치 노트 제목 3줄
//  끄면 예전 「그동안 마을에서는…」 창 그대로 (ui/expedition.ts showOffline)
import { CONFIG } from '../data/config';
import { GRADE_INFO, GRADES, type Grade } from '../data/items';
import type { OfflineSummary } from '../world/offline';
import { markDirty, P, S } from '../world/state';
import { grantWelcome, welcomeGift } from '../world/welcome';
import { esc, fmt } from './common';
import { iconSrc } from './kit';
import { loadPatchNotes } from './update';
import { closeWin, openWin, toast } from './windows';
import { fsay } from '../world/visual';

const awayText = (sec: number) => {
  const d = Math.floor(sec / 86400);
  if (d >= 1) return `${d}일 만이에요`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h ? `${h}시간 ` : ''}${m}분 동안`;
};

/** 「그동안 바뀐 것」: 꺼 둔 날 이후 패치 노트 제목 (새것부터 3개) */
export function changedTitles(list: { date: string; title: string }[], sinceMs: number, n = 3): string[] {
  const since = new Date(sinceMs + 9 * 3600e3).toISOString().slice(0, 10);
  return list.filter((x) => x.date >= since).slice(0, n).map((x) => x.title);
}

export function showWelcome(s: OfflineSummary) {
  const wins = s.runs.filter((r) => r.result!.win).length;
  const runGold = s.runs.reduce((t, r) => t + r.result!.gold, 0);
  const huntGold = s.hunt?.gold ?? 0;
  const gift = welcomeGift(s.away, P.week, s.gold);
  const items = (Object.entries(s.items) as [Grade, number][])
    .sort((p, q) => GRADES.indexOf(q[0]) - GRADES.indexOf(p[0]))
    .map(([g, n]) => `<b style="color:${GRADE_INFO[g].color}">${GRADE_INFO[g].name} ${n}</b>`)
    .join(' · ');
  const over = s.away > s.seconds + 1 ? `<p class="note">방치 보상은 최대 ${CONFIG.offline.maxRealHours}시간까지만 쌓여요</p>` : '';
  const tile = (ic: string, label: string, val: string) => `<div class="wbt"><img src="${ic}" alt=""><span><small>${label}</small><b>${val}</b></span></div>`;
  const giftHtml = gift
    ? `<div class="wbgift"><img src="${iconSrc('box_gift')}" alt=""><span><b class="g">오랜만이에요!</b><small>선물 상자 · 금화 +${fmt(gift.gold)} · 예배당 축복 ${gift.blessMin}분</small></span></div>
      <div class="wbnews" id="wbNews" hidden><b class="g">그동안 바뀐 것</b><ul></ul></div>`
    : '';
  const extra = [
    runGold || huntGold ? fsay(`원정·사냥 금화 +${fmt(runGold + huntGold)}은 이미 금고에`, `원정·사냥 금화 +${fmt(runGold + huntGold)}은 금고에 넣어 뒀어요`) : '',
    items ? `얻은 장비: ${items}` : '',
    s.levelUps.length ? `레벨업: ${s.levelUps.map(esc).join(', ')}` : '',
    s.newChem.length ? `<span class="heart">새 케미: ${s.newChem.map(esc).join(', ')}</span>` : '',
    s.hunt ? `방치 사냥 ${esc(s.hunt.label)} ${s.hunt.clears}판` : '',
  ].filter(Boolean);
  openWin(
    '다녀오셨어요',
    `<p class="sub">${awayText(s.away)}${s.capped ? ' · 손님 금화는 다음 목표 비용의 80%까지' : ''}</p>${over}
    ${giftHtml}
    <div class="wbgrid">
      ${tile(iconSrc('cur_gold'), '받을 금화', `+${fmt(s.gold + (gift?.gold ?? 0))}`)}
      ${tile(iconSrc('m_guests'), fsay('다녀간 손님', '묵고 가신 손님'), `${s.guests}명`)}
      ${tile(iconSrc('m_expedition'), '끝난 원정', s.runs.length ? `${s.runs.length}개 · 성공 ${wins}` : '없음')}
      ${tile(iconSrc('m_garden'), '다 자란 것', s.harvested ? fsay(`${s.harvested}개 거둠`, `${s.harvested}개 거둬 뒀어요`) : '없음')}
    </div>
    ${extra.length ? `<div class="offl">${extra.map((t) => `<div>· ${t}</div>`).join('')}</div>` : ''}
    <button class="bigbtn" id="offOk">모두 받기</button>`,
    'welcome',
  );
  if (gift)
    void loadPatchNotes().then((list) => {
      const box = document.getElementById('wbNews');
      const t = changedTitles(list, Date.now() - s.away * 1000);
      if (!box || !t.length) return;
      box.querySelector('ul')!.innerHTML = t.map((x) => `<li>${esc(x)}</li>`).join('');
      box.hidden = false;
    });
  document.getElementById('offOk')!.onclick = () => {
    S.gold += s.gold;
    if (gift) grantWelcome(gift);
    for (const r of s.runs) r.claimed = true;
    P.runs = P.runs.filter((r) => !r.claimed);
    markDirty();
    closeWin();
    toast(`${fsay(`금화 +${fmt(s.gold + (gift?.gold ?? 0))}`, `금화 +${fmt(s.gold + (gift?.gold ?? 0))} 금고에 넣어 드렸어요`)}${gift ? ` · 축복 ${gift.blessMin}분` : ''}`);
  };
}
