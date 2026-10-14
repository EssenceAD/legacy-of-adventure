// RAIDWEAPON §6 버닝 주말: 상태줄(오른쪽 위 알약) 모서리에 작은 🔥 — 기간 중만 · 이웃 방문 중엔 상태줄째 숨음
//  1초마다 서버 시각으로 다시 봄 (기간이 끝나면 저절로 사라짐)
import { burnOn } from '../world/burn';

export function syncBurnPill(): void {
  const stat = document.querySelector<HTMLElement>('.top .stat');
  if (!stat) return;
  let pill = document.getElementById('burnPill');
  const want = burnOn();
  if (!want) {
    if (pill) pill.hidden = true;
    return;
  }
  if (!pill) {
    pill = document.createElement('i');
    pill.id = 'burnPill';
    pill.textContent = '🔥';
    pill.setAttribute('aria-label', '버닝 주말 진행 중');
    pill.title = '오픈 기념 버닝 주말';
    stat.appendChild(pill);
  }
  pill.hidden = false;
}
export function initBurnPill(): void {
  syncBurnPill();
  setInterval(() => {
    if (!document.hidden) syncBurnPill();
  }, 1000);
}
