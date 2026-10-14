// CHECKIN §K2 왼쪽 가장자리 아이콘 줄 (새 HUD hudV2 안 · 플래그 leftIcons)
//  「오늘의 장부」 · 「수확제」(기간 중) · 「여관 연감」(시즌 중) — 최대 3개, 세로 한 줄 · 빨간 점 규칙(C4) 그대로 · 기간 끝난 건 사라짐
import { almanacDot, almanacOn } from '../world/almanac';
import { daybookDot, daybookOn } from '../world/daybook';
import { flag } from '../world/flags';
import { shopDot } from '../world/harvest';
import { S } from '../world/state';
import { openAlmanac } from './almanac';
import { openDaybook } from './daybook';
import { hvIconOn, openHarvestShop } from './harvest';
import { iconSrc, type IconKey } from './kit';

interface LeftIcon {
  id: string;
  icon: IconKey;
  label: string;
  on: () => boolean;
  dot: () => boolean;
  open: () => void;
}
const ICONS: LeftIcon[] = [
  { id: 'liBook', icon: 'm_quest', label: '오늘의 장부', on: () => daybookOn(), dot: daybookDot, open: () => openDaybook(0) },
  { id: 'liHv', icon: 'cur_ribbon', label: '수확제', on: hvIconOn, dot: shopDot, open: () => openHarvestShop() },
  { id: 'liAlm', icon: 'stamp_almanac', label: '여관 연감', on: () => almanacOn(), dot: almanacDot, open: () => openAlmanac() },
];

let box: HTMLDivElement | null = null;
/** 새 HUD를 켰을 때만 (initHud2 뒤) */
export function initLeftIcons() {
  if (!document.body.classList.contains('hud2')) return;
  box = document.createElement('div');
  box.id = 'leftIcons';
  for (const it of ICONS) {
    const b = document.createElement('button');
    b.id = it.id;
    b.className = 'ibtn px hb';
    b.hidden = true;
    b.setAttribute('aria-label', it.label);
    b.innerHTML = `<img src="${iconSrc(it.icon, true)}" alt=""><small>${it.label}</small>`;
    b.onclick = (e) => {
      e.stopPropagation();
      it.open();
    };
    box.appendChild(b);
  }
  document.getElementById('hud')!.appendChild(box);
  syncLeftIcons();
  setInterval(() => {
    if (!document.hidden) syncLeftIcons();
  }, 500);
}
/** 보일 것 · 빨간 점 (0.5초마다) */
export function syncLeftIcons() {
  if (!box) return;
  const show = flag('leftIcons') && S.started && !S.visiting;
  box.hidden = !show;
  if (!show) return;
  let n = 0;
  for (const it of ICONS) {
    const b = document.getElementById(it.id);
    if (!b) continue;
    const on = n < 3 && it.on();
    if (b.hidden === on) b.hidden = !on;
    if (on) {
      b.style.setProperty('--li', String(n));
      n++;
      const d = it.dot();
      if (b.classList.contains('rdot') !== d) b.classList.toggle('rdot', d);
    }
  }
}
