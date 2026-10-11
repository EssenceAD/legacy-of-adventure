// 핫픽스 11 §6-1: 상태 카드 1줄 — 금화가 길어져도 날짜와 겹치지 않게, 칸이 모자라면 날짜 글자를 줄인다
//  「100일차 23시」 → 「100일 23시」 → 「23시」
import { hourNow } from '../world/clock';
import { S } from '../world/state';

let lastKey = '';
export function fitDay(force = false) {
  const el = document.getElementById('dayv');
  const gv = document.getElementById('goldv');
  if (!el) return;
  const h = String(hourNow()).padStart(2, '0');
  const key = `${S.day}|${h}|${gv?.textContent ?? ''}|${innerWidth}|${document.documentElement.dataset.fs ?? ''}`;
  if (!force && key === lastKey) return;
  lastKey = key;
  el.classList.remove('tight');
  const fits = () => el.scrollWidth <= el.clientWidth + 0.5;
  for (const t of [`${S.day}일차 ${h}시`, `${S.day}일 ${h}시`, `${h}시`]) {
    el.textContent = t;
    if (fits()) return;
  }
  // 그래도 넘치면 글자를 조금 작게
  el.classList.add('tight');
}
