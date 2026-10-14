// 연기·먼지·반짝이 입자, 떠오르는 숫자, 말풍선
import { CONFIG } from '../data/config';
import { META } from '../engine/assets';
import { scr, sx, sy, TW, view } from '../engine/iso';
import { P } from '../engine/pixel';
import type { Actor, Building } from './state';
import { saverOn } from '../engine/fps';
import { mergeFloat, PRI, qb, quietOn } from './quiet';

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

/** 짓기·철거·땅 넓히기 먼지 같은 한 번짜리 연출이 도는 중인가 (굴뚝 연기처럼 늘 있는 입자는 빼고) */
let burstUntil = 0;
export const burstOn = () => performance.now() < burstUntil;
export function puff(x: number, y: number, c: string, vx: number, vy: number, life: number, size: number) {
  // 핫픽스 11: 배터리 절약이면 입자 절반
  if (saverOn() && Math.random() < 0.5) return;
  parts.push({ x, y, vx, vy, life, max: life, c, size });
}

/** 건물 발치에서 먼지 n개 */
export function puffAt(o: Building, c: string, n: number, burst = true) {
  if (burst) burstUntil = performance.now() + 1500;
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

/** 핫픽스 9: 같은 자리에서 뜨는 숫자는 0.6초 간격으로 차례대로 (겹쳐 읽히지 않게) */
const floatNext = new Map<string, number>();
/** 타일 위치 위로 글자가 떠올랐다 사라진다 */
export function floatW(x: number, y: number, up: number, text: string, cls = '') {
  const key = `${Math.round(x)},${Math.round(y)}`;
  const now = performance.now();
  // FIRSTLOOK §2-4 화면 조용히: 같은 자리에 막 뜬 글씨가 있으면 합쳐서 하나로 (「케미 +1」 두 번 → 「케미 +2」)
  if (quietOn()) {
    const live = floatLive.get(key);
    if (live && live.e.isConnected && now - live.at < CONFIG.firstLook.quiet.floatMergeMs) {
      const m = mergeFloat(live.text, text);
      if (m !== null) {
        live.text = m;
        live.e.textContent = m;
        return;
      }
    }
  }
  const at = Math.max(now, floatNext.get(key) ?? 0);
  floatNext.set(key, at + 600);
  if (at > now + 3000) return; // 너무 밀리면 버린다
  if (at > now) {
    setTimeout(() => floatNow(x, y, up, text, cls), at - now);
    return;
  }
  floatNow(x, y, up, text, cls);
}
/** FIRSTLOOK §2-4: 자리마다 지금 떠 있는 글씨 (합치기용) */
const floatLive = new Map<string, { e: HTMLElement; text: string; at: number }>();
function floatNow(x: number, y: number, up: number, text: string, cls: string) {
  const [X, Y] = scr(x, y);
  const e = document.createElement('div');
  const q = quietOn();
  // 조용히: 글자 한 단계 작게 · 0.9초 (style.css .flt.q)
  e.className = 'flt ' + cls + (q ? ' q' : '');
  e.textContent = text;
  e.style.left = X * view.SC + 'px';
  e.style.top = (Y - up) * view.SC + 'px';
  over().appendChild(e);
  const key = `${Math.round(x)},${Math.round(y)}`;
  if (q) floatLive.set(key, { e, text, at: performance.now() });
  setTimeout(
    () => {
      e.remove();
      if (floatLive.get(key)?.e === e) floatLive.delete(key);
    },
    q ? CONFIG.firstLook.quiet.floatMs : 1500,
  );
}

interface Bubble extends HTMLDivElement {
  _a?: Actor;
  _o?: Building;
}

// 핫픽스 9: 말풍선은 동시에 최대 2개 · 화면 거리 80px 안의 말풍선이 있으면 차례(큐)로
const MAX_BUB = 2;
const NEAR_PX = 80;
const bubQ: { a: Actor; text: string; cls: string }[] = [];
const bubXY = (a: Actor): [number, number] => {
  const [X, Y] = scr(a.x, a.y);
  return [X * view.SC, (Y - 30) * view.SC];
};
function bubbleRoom(a: Actor): boolean {
  const list = [...over().querySelectorAll<Bubble>('.bub')];
  if (list.length >= MAX_BUB) return false;
  const [x, y] = bubXY(a);
  return !list.some((b) => b._a && Math.hypot(bubXY(b._a)[0] - x, bubXY(b._a)[1] - y) < NEAR_PX);
}
function nextBubble() {
  for (let i = 0; i < bubQ.length; i++) {
    const q = bubQ[i];
    if (q.a.hidden || q.a.bub || q.a.leaving) {
      bubQ.splice(i--, 1);
      continue;
    }
    if (!bubbleRoom(q.a)) continue;
    bubQ.splice(i, 1);
    showBubble(q.a, q.text, q.cls);
    return;
  }
}
/** FIRSTLOOK §2-1: 말풍선 자리 줄의 이름 (사람·건물마다 하나) */
const qid = new WeakMap<object, number>();
let qn = 0;
const qkey = (k: string, o: object) => {
  let n = qid.get(o);
  if (n === undefined) qid.set(o, (n = ++qn));
  return k + n;
};
/**
 * 손님 머리 위 말풍선. p = 뜰 확률
 *  pri = FIRSTLOOK §2 화면 조용히의 차례 (안내 · 이야기·사건 · 손님 대사) — 없으면 케미(chem)는 사건, 나머지는 손님 대사
 */
export function say(a: Actor, text: string, p = 1, cls = '', pri?: number) {
  if (Math.random() > p || a.bub || a.hidden) return;
  if (quietOn()) {
    const can = () => !a.hidden && !a.bub && !a.leaving;
    qb.request({ pri: pri ?? (cls.includes('chem') ? PRI.story : PRI.guest), key: qkey('a', a), ms: CONFIG.actors.bubbleMs, ok: can, show: () => (can() ? showBubble(a, text, cls) : false) }, performance.now());
    return;
  }
  if (!bubbleRoom(a)) {
    // 자리가 없으면 차례를 기다린다 (오래된 것부터 버림)
    if (!bubQ.some((q) => q.a === a)) bubQ.push({ a, text, cls });
    if (bubQ.length > 6) bubQ.shift();
    return;
  }
  showBubble(a, text, cls);
}
function showBubble(a: Actor, text: string, cls: string) {
  const b = document.createElement('div') as Bubble;
  b.className = 'bub ' + cls;
  b.textContent = text;
  b._a = a;
  over().appendChild(b);
  a.bub = b;
  setTimeout(() => {
    b.remove();
    if (a.bub === b) a.bub = null;
    nextBubble();
  }, CONFIG.actors.bubbleMs);
}

/** 건물 지붕 위 말풍선 (안에 있는 손님 대사) — 핫픽스 9: 자리가 없으면 띄우지 않음 · FIRSTLOOK §2: 조용히면 손님 대사 줄에 */
export function bldSay(o: Building, text: string) {
  if (quietOn()) {
    qb.request({ pri: PRI.guest, key: qkey('o', o), ms: 2600, show: () => bldBubble(o, text) }, performance.now());
    return;
  }
  if (over().querySelectorAll('.bub').length >= MAX_BUB) return;
  bldBubble(o, text);
}
function bldBubble(o: Building, text: string) {
  const b = document.createElement('div') as Bubble;
  b.className = 'bub';
  b.textContent = text;
  b._o = o;
  over().appendChild(b);
  setTimeout(() => b.remove(), 2600);
}

export function clearBubbles() {
  over().querySelectorAll('.bub,.flt').forEach((b) => b.remove());
  floatLive.clear();
  qb.reset();
}

/** 매 프레임: 말풍선을 주인 위치로 */
export function posBubbles() {
  // FIRSTLOOK §2-1: 차례가 된 말풍선 띄우기
  if (quietOn()) qb.pump(performance.now());
  over()
    .querySelectorAll<Bubble>('.bub, .wfbub')
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
  // 핫픽스 9: 그래도 겹치면 뒤의 것을 위로 밀어 쌓는다
  const list = [...over().querySelectorAll<HTMLElement>('.bub')];
  for (let i = 1; i < list.length; i++) {
    const r = list[i].getBoundingClientRect();
    for (let j = 0; j < i; j++) {
      const q = list[j].getBoundingClientRect();
      if (r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top) {
        list[i].style.top = Math.round(parseFloat(list[i].style.top) - (r.bottom - q.top) - 4) + 'px';
      }
    }
  }
}
