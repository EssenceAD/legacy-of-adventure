// STARFALL §1: 별을 잡으면 그 영웅의 실루엣 초상화 + 「???」 + 게이지 막대가 차오르는 작은 카드 · 오늘 잡았으면 밤 버튼 옆 ★
import { PORTRAITS } from '../engine/assets';
import { starsCaught } from '../world/legends';
import type { StarCatch } from '../world/legends';
import { esc } from './common';

let hideT = 0;
export function showStarCard(c: StarCatch) {
  let el = document.getElementById('starCard');
  if (!el) {
    el = document.createElement('div');
    el.id = 'starCard';
    el.className = 'px';
    (document.getElementById('view') ?? document.body).appendChild(el);
  }
  const src = PORTRAITS['legend_' + c.key] ?? '';
  el.innerHTML = `<img class="sil" src="${src}" alt=""><div><small>★ 운명의 별${c.shower ? ' · 유성우 2배' : ''}</small><b>${esc(c.title)} ???</b><div class="sg"><i style="width:${c.from}%"></i></div><em>인연 +${c.add}% → ${c.gauge}%</em></div>`;
  el.hidden = false;
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
  // 게이지가 차오른다
  requestAnimationFrame(() => {
    const bar = el!.querySelector<HTMLElement>('.sg i');
    if (bar) bar.style.width = `${c.gauge}%`;
  });
  clearTimeout(hideT);
  hideT = window.setTimeout(() => (el!.hidden = true), 2800);
  syncStarMark();
}
/** 밤 버튼 옆 작은 ★ (오늘 잡았으면 · 내일 다시) */
export function syncStarMark() {
  const m = document.getElementById('starMark');
  if (m) m.hidden = starsCaught() === 0;
}
