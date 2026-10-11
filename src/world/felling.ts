// 땅 개편 §3: 땅을 넓힐 때 — 새 범위의 나무가 바깥 → 안쪽 순서로 쓰러지고(기울기 + 먼지) 그루터기 → 풀. 약 2초
import { IMG, tinted } from '../engine/assets';
import { sx, sy, TH, view } from '../engine/iso';
import { NL } from './daynight';
import { puff } from './fx';
import type { Wild } from './ground';

interface Fall {
  x: number;
  y: number;
  k: Wild['k'];
  /** 쓰러지기 시작 시각 (초, start 기준) */
  at: number;
  dusted: boolean;
}
let falls: Fall[] = [];
let t = 0;
const TILT = 0.18;
const STUMP = 1.1;

/** 넓히기 직전의 나무 목록과 옛 땅 경계로 시작한다 */
export function startFelling(trees: Wild[], oldA: number) {
  // 새 범위 = 옛 땅 뒤쪽(작은 좌표). 바깥(옛 울타리에서 먼 것)부터
  const list = trees.filter((w) => w.k !== 'expand_sign').map((w) => ({ w, d: oldA - Math.min(w.x, w.y) }));
  list.sort((p, q) => q.d - p.d || p.w.x - q.w.x);
  const step = Math.min(0.05, 1.6 / Math.max(1, list.length));
  falls = list.map(({ w }, i) => ({ x: w.x, y: w.y, k: w.k, at: i * step, dusted: false }));
  t = 0;
}
export const fellingOn = () => falls.length > 0;

/** 바닥 다음에 (건물보다 먼저) 그린다 — 새 범위는 지금 건물보다 뒤쪽이다 */
export function drawFelling(ctx: CanvasRenderingContext2D, dt: number) {
  if (!falls.length) return;
  t += dt;
  const stump = IMG.stump ? tinted(IMG.stump, NL) : null;
  for (const f of falls) {
    const lt = t - f.at;
    const X = Math.round(view.OX + sx(f.x + 0.5, f.y + 0.5));
    const Y = Math.round(view.OY + sy(f.x + 0.5, f.y + 0.5) + TH / 2 + 3);
    if (lt < 0) {
      // 아직 서 있는 나무
      const im = IMG[f.k] && tinted(IMG[f.k], NL);
      if (im) ctx.drawImage(im, X - (im.width >> 1), Y - im.height);
      continue;
    }
    if (lt < TILT) {
      // 쓰러지는 중: 밑동을 축으로 기울기 (1~2프레임)
      const im = IMG[f.k] && tinted(IMG[f.k], NL);
      if (!im) continue;
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate((lt / TILT) * 1.2);
      ctx.drawImage(im, -(im.width >> 1), -im.height);
      ctx.restore();
      continue;
    }
    if (!f.dusted) {
      f.dusted = true;
      for (let i = 0; i < 4; i++) puff(sx(f.x + 0.5, f.y + 0.5), sy(f.x + 0.5, f.y + 0.5) + 4, '#c9bfa8', (Math.random() - 0.5) * 20, -6 - Math.random() * 8, 0.6, 2);
    }
    // 그루터기 → 풀 (서서히 사라진다)
    if (stump && lt < STUMP) {
      ctx.globalAlpha = Math.min(1, (STUMP - lt) / 0.4);
      ctx.drawImage(stump, X - (stump.width >> 1), Y - stump.height + 4);
      ctx.globalAlpha = 1;
    }
  }
  const last = falls[falls.length - 1];
  if (t - last.at > STUMP) falls = [];
}
