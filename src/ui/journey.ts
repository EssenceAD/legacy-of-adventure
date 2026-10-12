// DIRECTION §1-1 「여정」 한 화면 — 칸마다 x/N · 누르면 그 도감 · 다 채우면 칭호 + 간판 금테 · 이번 회차의 바람
import { CONFIG } from '../data/config';
import { journeyCells, journeyComplete, syncJourney, type JourneyKey } from '../world/journey';
import { P } from '../world/state';
import { curWind, WIND_INFO } from '../world/wind';
import { openDexTab } from './book';
import { $$, esc } from './common';
import { openAlbum } from './owner';
import { openWin, toast } from './windows';

const GO: Record<JourneyKey, () => void> = {
  regions: () => openDexTab(P.regions2.scatter ? '지역' : '아이템'),
  endings: () => openAlbum(),
  mythic: () => openDexTab('신화'),
  diaries: () => openDexTab('손님'),
  uniques: () => openDexTab('고유 장비'),
  fish: () => openDexTab('낚시'),
  harmony: () => openDexTab('어울림'),
};

export function openJourney() {
  if (syncJourney()) toast(`여정을 모두 채웠어요! 칭호 「${CONFIG.direction.journeyTitle}」`);
  const cells = journeyCells();
  const done = journeyComplete(cells) || P.legacy.journeyEnd;
  const w = curWind();
  const wi = w ? WIND_INFO[w] : null;
  const sum = cells.reduce((s, c) => s + Math.min(c.cur, c.total), 0);
  const tot = cells.reduce((s, c) => s + c.total, 0);
  openWin(
    '여정',
    `<p class="sub">제 ${P.legacy.gen}회차 · 지금까지 ${sum}/${tot}</p>
    ${wi ? `<div class="jwind"><i>${wi.icon}</i><span><b>이번 회차의 바람 — ${esc(wi.name)}</b><small>${esc(wi.fx)}</small><small>${esc(wi.mood)}</small></span></div>` : P.legacy.gen < CONFIG.direction.windFrom ? '<p class="note">2회차부터 회차마다 「이번 회차의 바람」이 불어요</p>' : ''}
    ${done ? `<div class="jdone">「${esc(CONFIG.direction.journeyTitle)}」<small>여정을 모두 채웠어요 · 여관 간판에 금테가 둘렸어요</small></div>` : ''}
    <div class="jgrid">${cells
      .map(
        (c) =>
          `<button class="jcell ${c.cur >= c.total ? 'full' : ''}" data-jg="${c.key}"><i>${c.icon}</i><b>${esc(c.name)}</b><em>${c.cur}/${c.total}</em><u class="jbar"><s style="width:${Math.round((Math.min(c.cur, c.total) / Math.max(1, c.total)) * 100)}%"></s></u><small>${esc(c.how)}</small></button>`,
      )
      .join('')}</div>
    <button class="bigbtn ghost sm" id="jChron">📜 여관 연대기 (${P.legacy.chron?.length ?? 0}쪽)</button>
    <p class="jfoot">이 이야기는 끝이 있어요. 대신 회차마다 조금씩 달라요.</p>`,
  );
  $$('[data-jg]').forEach((b) => (b.onclick = () => GO[b.dataset.jg as JourneyKey]()));
  document.getElementById('jChron')!.onclick = () => openDexTab('연대기', -1);
}

if (import.meta.env.DEV) Object.assign(window, { __openJourney: openJourney });
