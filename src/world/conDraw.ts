// CONSTRUCTION_SPEC §1: 공사 연출 — 흙 공사 터 + 말뚝·줄 · 아래부터 지어 올라가는 건물(위쪽은 청사진 실루엣) · 진행선의 판자 발판 + X자 버팀목
//  · 망치질하는 드워프 일꾼(노란 안전모) 1~2명 + 먼지·「뚝딱!」 · 재료 더미(80%까지) · 머리 위 진행 막대 + 남은 시간 · 밤엔 등불
//  그림 파일 없이 코드 도트 (1px 외곽선). 공사 중인 건물만 그린다.
import { sfx } from '../audio/sfx';
import { canvas, P } from '../engine/pixel';
import { canvasAlive, Lru } from '../engine/lru';
import { CONFIG } from '../data/config';
import { sx, sy, TH, view } from '../engine/iso';
import { clock, conLeft, conProgress } from './construct';
import { NL } from './daynight';
import { floatW, puff } from './fx';
import { S, type Building } from './state';

const INK = '#2a1a14';
/** 청사진 실루엣 (그림마다 한 번) */
const sil = new Lru<CanvasImageSource, HTMLCanvasElement>(CONFIG.render.silCacheMax);
export const silMem = () => ({ n: sil.size, cap: sil.cap, evicted: sil.evicted });
function silhouette(im: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
  let c = sil.get(im);
  if (c && canvasAlive(c)) return c;
  c = canvas(im.width, im.height);
  const g = c.getContext('2d')!;
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#9fc4e8';
  g.fillRect(0, 0, im.width, im.height);
  sil.set(im, c);
  return c;
}

/** 공사 터: 흙 마름모 (발판 전체) */
function site(ctx: CanvasRenderingContext2D, o: Building) {
  ctx.fillStyle = '#8f6c49';
  for (let j = 0; j < o.fh; j++)
    for (let i = 0; i < o.fw; i++) {
      const X = view.OX + sx(o.tx + i, o.ty + j);
      const Y = view.OY + sy(o.tx + i, o.ty + j);
      for (let k = 0; k < TH; k++) {
        const hw = (k < TH / 2 ? k + 1 : TH - k) * 2;
        ctx.fillRect(X - hw, Y + k, hw * 2, 1);
      }
    }
  // 흙 알갱이
  const p = P(ctx);
  for (let j = 0; j < o.fh; j++)
    for (let i = 0; i < o.fw; i++) {
      const X = view.OX + sx(o.tx + i, o.ty + j);
      const Y = view.OY + sy(o.tx + i, o.ty + j);
      p.px(X - 4 + ((i * 7 + j * 3) % 8), Y + 3 + ((i + j * 5) % 4), '#6f5136');
      p.px(X + 3 - ((i * 3 + j) % 6), Y + 5 + ((i * 2 + j) % 3), '#a8835a');
    }
}
/** 네 모서리 말뚝 + 줄 한 바퀴 */
function stakes(ctx: CanvasRenderingContext2D, o: Building, front: boolean) {
  const pts: [number, number][] = [
    [o.tx, o.ty],
    [o.tx + o.fw, o.ty],
    [o.tx + o.fw, o.ty + o.fh],
    [o.tx, o.ty + o.fh],
  ].map(([x, y]) => [Math.round(view.OX + sx(x, y)), Math.round(view.OY + sy(x, y) + TH / 2)]);
  const p = P(ctx);
  // 뒤쪽 두 개(0·1·3)는 건물 그리기 전, 앞쪽(2)은 뒤
  const idx = front ? [2] : [0, 1, 3];
  ctx.strokeStyle = '#e8d6a8';
  ctx.lineWidth = 1;
  if (!front) {
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const [x, y] = pts[i % 4];
      if (i) ctx.lineTo(x + 0.5, y - 4.5);
      else ctx.moveTo(x + 0.5, y - 4.5);
    }
    ctx.stroke();
  }
  for (const i of idx) {
    const [x, y] = pts[i];
    p.rect(x - 1, y - 8, 3, 9, INK);
    p.rect(x, y - 7, 1, 7, '#9a6a3a');
  }
}

/** 망치질 일꾼 (7×11 도트) — 프레임 0: 망치 위 / 1: 내려침 */
function worker(ctx: CanvasRenderingContext2D, x: number, y: number, f: number, dir: 1 | -1) {
  const p = P(ctx);
  const X = (dx: number) => x + dx * dir;
  // 외곽선 덩어리 → 색
  p.rect(Math.min(X(-3), X(3)), y - 11, 7, 11, 'rgba(0,0,0,0)');
  // 다리
  p.rect(X(-2), y - 3, 2, 3, '#3a3a52');
  p.rect(X(1), y - 3, 2, 3, '#3a3a52');
  // 몸통 (멜빵 작업복)
  p.rect(X(-3), y - 7, 7, 4, INK);
  p.rect(X(-2), y - 7, 5, 4, '#c0623a');
  p.px(X(0), y - 6, '#f2c230');
  // 얼굴 + 수염
  p.rect(X(-2), y - 10, 5, 3, '#f0c8a0');
  p.rect(X(-2), y - 8, 5, 1, '#8a5a30');
  p.px(X(1), y - 9, INK);
  // 노란 안전모
  p.rect(X(-3), y - 12, 7, 2, INK);
  p.rect(X(-2), y - 12, 5, 2, '#f2c230');
  p.px(X(-1), y - 12, '#fff2a0');
  // 팔 + 망치
  if (f === 0) {
    p.rect(X(3), y - 10, 1, 4, '#f0c8a0');
    p.rect(X(3), y - 13, 1, 3, '#7a4a2a');
    p.rect(X(2), y - 14, 3, 2, '#9aa0b0');
  } else {
    p.rect(X(3), y - 7, 3, 1, '#f0c8a0');
    p.rect(X(5), y - 7, 3, 1, '#7a4a2a');
    p.rect(X(7), y - 8, 2, 3, '#9aa0b0');
  }
}

/** 재료 더미: 판자 더미 + 돌 더미 (공사 터 앞 오른쪽) */
function piles(ctx: CanvasRenderingContext2D, o: Building) {
  const X = Math.round(view.OX + sx(o.tx + o.fw, o.ty + o.fh - 0.5)) + 4;
  const Y = Math.round(view.OY + sy(o.tx + o.fw, o.ty + o.fh - 0.5)) + 6;
  const p = P(ctx);
  for (let i = 0; i < 3; i++) {
    p.rect(X - 1, Y - 2 - i * 2, 12, 2, INK);
    p.rect(X, Y - 2 - i * 2, 10, 1, i % 2 ? '#c08a52' : '#a87444');
  }
  const st: [number, number][] = [[14, 0], [18, 0], [16, -3], [21, -1]];
  for (const [dx, dy] of st) {
    p.rect(X + dx - 1, Y + dy - 3, 4, 3, INK);
    p.rect(X + dx, Y + dy - 3, 2, 2, '#9a9aa8');
  }
}

const lastF = new WeakMap<Building, number>();
let tapSnd = 0;
/** 공사 중 건물 그리기 (drawObj가 부른다) */
export function drawConstruction(ctx: CanvasRenderingContext2D, o: Building, im: HTMLCanvasElement | HTMLImageElement, x: number, y: number) {
  const prog = conProgress(o);
  site(ctx, o);
  stakes(ctx, o, false);
  const W = im.width;
  const H = im.height;
  // 위쪽: 청사진 실루엣 · 아래쪽: 진행률만큼 진짜 그림
  ctx.globalAlpha = 0.3;
  ctx.drawImage(silhouette(im), x, y);
  ctx.globalAlpha = 1;
  const h = Math.max(1, Math.round(H * (0.08 + 0.92 * prog)));
  ctx.drawImage(im, 0, H - h, W, h, x, y + H - h, W, h);
  const line = y + H - h;
  const p = P(ctx);
  // 진행선의 판자 발판 2줄 + 아래 X자 버팀목
  const L = x + Math.round(W * 0.12);
  const R = x + Math.round(W * 0.88);
  if (prog < 1) {
    const bl = Math.min(y + H - 6, line + 2);
    ctx.strokeStyle = '#7a4c28';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const sh = Math.min(14, y + H - bl - 2);
    if (sh > 3)
      for (const [a, b] of [[L, R], [L + (R - L) / 2, R]] as [number, number][]) {
        ctx.moveTo(a + 0.5, bl + 0.5);
        ctx.lineTo(b + 0.5, bl + sh + 0.5);
        ctx.moveTo(b + 0.5, bl + 0.5);
        ctx.lineTo(a + 0.5, bl + sh + 0.5);
      }
    ctx.stroke();
    for (let k = 0; k < 2; k++) {
      p.rect(L - 1, bl - 3 + k * 3, R - L + 2, 3, INK);
      p.rect(L, bl - 2 + k * 3, R - L, 1, k ? '#a87444' : '#c89458');
    }
    // 일꾼 (4×4 이상이면 2명)
    const n = o.fw >= 4 || o.fh >= 4 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const wx = Math.round(L + (R - L) * (n === 1 ? 0.5 : i ? 0.72 : 0.28));
      const f = Math.floor(S.T * 3.2 + i * 0.5) % 2;
      worker(ctx, wx, bl - 3, f, i ? -1 : 1);
      // 내려칠 때 먼지 + 가끔 글씨
      const key = f * 10 + i;
      const prev = lastF.get(o) ?? -1;
      if (f === 1 && prev !== key && i === 0) {
        puff(wx + 8 - view.OX, bl - 4 - view.OY, '#efe2c6', (Math.random() - 0.5) * 16, -12, 0.5, 2);
        if (Math.random() < 0.08) floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 40 + Math.round(h * 0.6), Math.random() < 0.5 ? '뚝딱!' : '쿵!');
      }
      if (i === 0) lastF.set(o, key);
      // 밤: 일꾼 옆 등불
      if (NL > 0.25) {
        const lx = wx + (i ? -7 : 7);
        const ly = bl - 9;
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 14);
        g.addColorStop(0, `rgba(255,210,120,${0.45 * NL})`);
        g.addColorStop(1, 'rgba(255,210,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(lx - 14, ly - 14, 28, 28);
        p.rect(lx - 1, ly - 2, 3, 4, INK);
        p.px(lx, ly - 1, '#ffd36b');
        p.px(lx, ly, '#ffb040');
      }
    }
    // 화면에 보일 때만 망치 소리 (1.2~2초 간격 · 작게)
    const cv = ctx.canvas;
    if (S.T > tapSnd && x + W > 0 && x < cv.width && y + H > 0 && y < cv.height) {
      tapSnd = S.T + 1.2 + Math.random() * 0.8;
      sfx(Math.random() < 0.7 ? 'tap' : 'build', { vol: 0.25 });
    }
  }
  if (prog < 0.8) piles(ctx, o);
  stakes(ctx, o, true);
  // 머리 위 진행 막대 + 남은 시간
  const bx = Math.round(x + W / 2 - 16);
  const by = Math.round(y + H - h - 14 > y - 14 ? Math.max(y - 12, line - 16) : y - 12);
  p.rect(bx - 1, by - 1, 34, 6, INK);
  p.rect(bx, by, 32, 4, '#3a3048');
  p.rect(bx, by, Math.max(1, Math.round(32 * prog)), 4, '#6fd04b');
  p.rect(bx, by, Math.max(1, Math.round(32 * prog)), 1, '#a8f080');
  ctx.font = '8px "Galmuri9"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const t = clock(conLeft(o));
  ctx.fillStyle = INK;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillText(t, bx + 16 + dx, by - 2 + dy);
  ctx.fillStyle = '#fff3d6';
  ctx.fillText(t, bx + 16, by - 2);
}
