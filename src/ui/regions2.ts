// REGIONS2 화면: 새 지역이 열렸을 때 창(HOTFIX14 §3 「새 지역이 열렸어요」 배너와 같은 모양) · 컷 연출 키(CSS)
import { REGIONS, type RegionId } from '../data/items';
import { track } from '../net/telemetry';
import { esc } from './common';
import { closeWin, openWin } from './windows';

/** 새 지역 창: 「새 지역이 열렸어요! ✨」 + 바로 가기 (사냥 창의 그 지역 탭) */
export function showNewRegion(id: RegionId) {
  const r = REGIONS.find((x) => x.id === id);
  if (!r) return;
  track('region_open', { region: id, via: 'cut' });
  openWin(
    '새 지역',
    `<div class="newreg"><span>새 지역이 열렸어요! ✨</span><b>${esc(r.name)}</b><small>${esc(r.mat)} · 세트 「${esc(r.set.name)}」</small><button class="a" id="nrGo">바로 가기</button></div>`,
  );
  const b = document.getElementById('nrGo');
  if (b)
    b.onclick = () => {
      closeWin();
      void import('./hunt').then(({ openHunt }) => openHunt(id));
    };
}
