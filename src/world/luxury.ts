// ECONOMY §3: 뽐내기 장식 효과 — 불꽃놀이(10초, 화면 위 입자) · 영웅 동상 이름 · 금빛 간판 · 밤 빛
import { LEGENDS } from '../data/legends';
import { markDirty, P, S, world } from './state';
import { track as trackEv } from '../net/telemetry';

export const FIREWORK_COST = 100000;
export const fireworks = { until: 0, next: 0 };
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  c: string;
}
const sparks: Spark[] = [];
const COLS = ['#ffd36b', '#ff7a6a', '#8fd0ff', '#c890ff', '#9af08a', '#ffffff'];

/** 불꽃놀이 시작 (금화 100,000) — 이미 터지는 중이면 다시 못 함 */
export function launchFireworks(): string | null {
  if (S.visiting) return '이웃 마을에선 못 해요';
  if (Date.now() < fireworks.until) return '지금 불꽃놀이 중이에요';
  if (S.gold < FIREWORK_COST) return '금화가 모자라요';
  S.gold -= FIREWORK_COST;
  fireworks.until = Date.now() + 10000;
  fireworks.next = 0;
  P.luxury.shows = (P.luxury.shows ?? 0) + 1;
  trackEv('firework', { n: P.luxury.shows });
  markDirty();
  return null;
}
/** 화면(논리 px) 위에 불꽃: 0.35초마다 하나 터진다 */
export function drawFireworks(ctx: CanvasRenderingContext2D, LW: number, LH: number, dt: number) {
  const now = Date.now();
  if (now < fireworks.until && now >= fireworks.next) {
    fireworks.next = now + 350;
    const cx = LW * (0.15 + Math.random() * 0.7);
    const cy = LH * (0.1 + Math.random() * 0.3);
    const c = COLS[(Math.random() * COLS.length) | 0];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const v = 40 + Math.random() * 30;
      sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 1.2, c: i % 5 ? c : '#ffffff' });
    }
  }
  if (!sparks.length) return;
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.t -= dt;
    if (s.t <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    s.vy += 30 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.t < 0.4 && Math.floor(s.t * 20) % 2) continue;
    ctx.fillStyle = s.c;
    ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
  }
}
/** 영웅 동상에 세울 수 있는 전설 (합류한 전설) */
export const statueChoices = () => LEGENDS.filter((l) => P.legends[l.key]?.st === 'joined');
export function statueName(): string {
  const l = LEGENDS.find((x) => x.key === P.luxury.statue);
  return l ? l.name : '이름 없는 영웅';
}
export const hasLux = (k: string) => (world.home?.objs ?? world.objs).some((o) => o.kind === k);
