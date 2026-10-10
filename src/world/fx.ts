// 연기·먼지·반짝이 입자, 떠오르는 숫자, 말풍선
import { CONFIG } from '../data/config';
import { META } from '../engine/assets';
import { scr, sx, sy, TW, view } from '../engine/iso';
import { P } from '../engine/pixel';
import type { Actor, Building } from './state';

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: string;
  size: number;
}
/** 입자 좌표는 월드 원점 기준 논리 픽셀 */
let parts: Part[] = [];

export function puff(x: number, y: number, c: string, vx: number, vy: number, life: number, size: number) {
  parts.push({ x, y, vx, vy, life, max: life, c, size });
}

/** 건물 발치에서 먼지 n개 */
export function puffAt(o: Building, c: string, n: number) {
  const X = sx(o.tx, o.ty) + ((o.fw - o.fh) * TW) / 4;
  const Y = sy(o.tx + o.fw, o.ty + o.fh);
  for (let i = 0; i < n; i++) puff(X + (Math.random() - 0.5) * o.fw * 20, Y - 4, c, (Math.random() - 0.5) * 16, -8 - Math.random() * 10, 0.7, 2);
}

export function clearParts() {
  parts = [];
}

export function updDrawParts(ctx: CanvasRenderingContext2D, dt: number) {
  const p = P(ctx);
  parts = parts.filter((q) => {
    q.life -= dt;
    if (q.life <= 0) return false;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    const s = q.size * (1 + (1 - q.life / q.max) * 0.8);
    ctx.globalAlpha = Math.min(1, (q.life / q.max) * 1.5);
    p.rect((view.OX + q.x - s / 2) | 0, (view.OY + q.y - s / 2) | 0, Math.max(1, s | 0), Math.max(1, s | 0), q.c);
    ctx.globalAlpha = 1;
    return true;
  });
}

// ───────── DOM 위에 띄우는 것 (떠오르는 숫자·말풍선) ─────────

const over = () => document.getElementById('over')!;

/** 타일 위치 위로 글자가 떠올랐다 사라진다 */
export function floatW(x: number, y: number, up: number, text: string, cls = '') {
  const [X, Y] = scr(x, y);
  const e = document.createElement('div');
  e.className = 'flt ' + cls;
  e.textContent = text;
  e.style.left = X * view.SC + 'px';
  e.style.top = (Y - up) * view.SC + 'px';
  over().appendChild(e);
  setTimeout(() => e.remove(), 1500);
}

interface Bubble extends HTMLDivElement {
  _a?: Actor;
  _o?: Building;
}

/** 손님 머리 위 말풍선. p = 뜰 확률 */
export function say(a: Actor, text: string, p = 1, cls = '') {
  if (Math.random() > p || a.bub || a.hidden) return;
  const b = document.createElement('div') as Bubble;
  b.className = 'bub ' + cls;
  b.textContent = text;
  b._a = a;
  over().appendChild(b);
  a.bub = b;
  setTimeout(() => {
    b.remove();
    if (a.bub === b) a.bub = null;
  }, CONFIG.actors.bubbleMs);
}

/** 건물 지붕 위 말풍선 (안에 있는 손님 대사) */
export function bldSay(o: Building, text: string) {
  const b = document.createElement('div') as Bubble;
  b.className = 'bub';
  b.textContent = text;
  b._o = o;
  over().appendChild(b);
  setTimeout(() => b.remove(), 2600);
}

export function clearBubbles() {
  over().querySelectorAll('.bub,.flt').forEach((b) => b.remove());
}

/** 매 프레임: 말풍선을 주인 위치로 */
export function posBubbles() {
  over()
    .querySelectorAll<Bubble>('.bub')
    .forEach((b) => {
      let X: number;
      let Y: number;
      if (b._a) {
        if (b._a.hidden) {
          b.remove();
          return;
        }
        [X, Y] = scr(b._a.x, b._a.y);
        Y -= 30;
      } else if (b._o) {
        const o = b._o;
        const m = o.sprite ? META[o.sprite] : null;
        X = view.OX + sx(o.tx, o.ty) + (o.fw - o.fh) * 8;
        Y = view.OY + sy(o.tx + o.fw, o.ty + o.fh) - (m ? m.h : 20) + 6;
      } else return;
      b.style.left = Math.round(X * view.SC) + 'px';
      b.style.top = Math.round(Y * view.SC) + 'px';
      b.classList.toggle('rt', X * view.SC > view.LW * view.SC - 90);
    });
}
