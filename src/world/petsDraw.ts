// LUXE §2 펫 — 마을에서 (꺼내 둔 3마리 · 이웃 방문 땐 그 마을 모습의 펫)
//  움직임은 코드: 2프레임 깡총(위 1px) · 좌우는 뒤집기 · 미끄러지듯 이동 · 밤엔 잠(Zz 말풍선 + 1px 낮추기) · 손님 옆에서 가끔 하트
//  여관 문 근처를 돌아다니고 가끔 주인 캐릭터를 따라간다. 그리기는 render.ts 깊이 정렬(캐릭터처럼 발판 기준)에 끼운다.
//  그림: assets/pets/pet_<id>.png (16~21px) · 10마리 모두 그림 있음 · 못 불러오면 중립 코드 도트 자리표시 — 못 불러와도 안 깨진다
import { dotShadow } from '../combat/draw';
import { PETS } from '../data/luxe_cfg';
import { tinted } from '../engine/assets';
import { sx, sy, TH, view, depthActor } from '../engine/iso';
import { av } from '../engine/ver';
import { NL } from './daynight';
import { petsOn, petState, pattedToday } from './pets';
import { S, world } from './state';
import { astar, bestOf, blockedAt, doorOf, walkable } from './town';

const BASE = import.meta.env.BASE_URL + 'assets/';

// ───────── 그림 (늦게 · 실패해도 괜찮게) ─────────
const DOT: Record<string, HTMLImageElement | null> = {};
const MISSING = new Set<string>();
/** 펫 마을 도트 (아직 안 불러왔으면 불러오기 시작 · 없거나 실패면 null) */
export function petDot(id: string): HTMLImageElement | null {
  if (MISSING.has(id)) return null;
  const hit = DOT[id];
  if (hit !== undefined) return hit && hit.complete && hit.naturalWidth ? hit : null;
  const im = new Image();
  DOT[id] = im;
  im.onerror = () => {
    MISSING.add(id);
    DOT[id] = null;
  };
  im.src = av(`${BASE}pets/pet_${id}.png`);
  return null;
}
/** 카드·도감 초상 주소 (없으면 화면 쪽이 자리표시로 바꾼다) */
export const petPortrait = (id: string) => av(`${BASE}portraits/petp_${id}.png`);
export const petDotUrl = (id: string) => av(`${BASE}pets/pet_${id}.png`);

// ───────── 마을에서 움직이는 펫 ─────────
export interface PetRT {
  id: string;
  /** 칸 좌표 (실수) */
  x: number;
  y: number;
  path: [number, number][];
  dir: 1 | -1;
  wait: number;
  moving: boolean;
  ph: number;
  hearts: { x: number; y: number; t: number }[];
  /** 이웃 마을 펫 (누르기 없음) */
  guest: boolean;
}
let rt: PetRT[] = [];
let rtKey = '';
const homeIds = () => (S.visiting ? (petsOn() ? (S.visiting.pets ?? []) : []) : petsOn() ? petState().out : []);
/** 여관 문 (없으면 땅 가운데쯤) */
function anchor(): [number, number] {
  const inn = bestOf('inn', world.objs);
  if (inn) {
    const [x, y] = doorOf(inn);
    return [x, y + 1];
  }
  return [16, 22];
}
/** 화면에서 가리지 않는 칸 (앞쪽 두 줄에 건물이 없음 — 작은 펫이 건물 뒤에 숨지 않게) */
const FRONT: [number, number][] = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2]];
const open = (x: number, y: number) => walkable(x, y) && FRONT.every(([dx, dy]) => !blockedAt(x + dx, y + dy));
function spotNear(cx: number, cy: number, r: number, rng: () => number = Math.random): [number, number] | null {
  let any: [number, number] | null = null;
  for (let i = 0; i < 24; i++) {
    const x = Math.round(cx + (rng() * 2 - 1) * r);
    const y = Math.round(cy + (rng() * 2 - 1) * r);
    if (open(x, y)) return [x, y];
    if (!any && walkable(x, y)) any = [x, y];
  }
  return any ?? (walkable(cx, cy) ? [cx, cy] : null);
}
function sync() {
  const ids = homeIds();
  const key = `${S.visiting?.id ?? ''}|${ids.join(',')}`;
  if (key === rtKey) return;
  rtKey = key;
  const keep = new Map(rt.map((p) => [p.id, p]));
  const [ax, ay] = anchor();
  rt = ids.map((id, i) => {
    const old = S.visiting ? null : keep.get(id);
    if (old && !old.guest) return old;
    const s = spotNear(ax, ay, 2) ?? [ax, ay];
    return { id, x: s[0], y: s[1], path: [], dir: i % 2 ? -1 : 1, wait: 0.5 + i, moving: false, ph: i * 0.37, hearts: [], guest: !!S.visiting };
  });
}
/** 새 목적지: 가끔 주인 곁 · 아니면 여관 문 근처 */
function plan(p: PetRT) {
  const owner = S.visiting ? null : world.actors.find((a) => a.role === 'owner' && !a.hidden);
  const [ax, ay] = anchor();
  const follow = owner && Math.random() < PETS.follow;
  const goal = follow ? spotNear(Math.round(owner.x), Math.round(owner.y), 1) : spotNear(ax, ay, PETS.roam);
  if (!goal) return;
  const path = astar(Math.round(p.x), Math.round(p.y), goal[0], goal[1]);
  if (path && path.length <= 16) p.path = path.slice(1);
}
function step(p: PetRT, dt: number) {
  for (const h of p.hearts) h.t += dt;
  p.hearts = p.hearts.filter((h) => h.t < 1.3);
  if (S.night) {
    p.moving = false;
    return;
  }
  if (!p.path.length) {
    p.moving = false;
    p.wait -= dt;
    if (p.wait <= 0) {
      plan(p);
      p.wait = 1.5 + Math.random() * 3;
    }
  } else {
    const [tx, ty] = p.path[0];
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    const mv = PETS.speed * dt;
    p.moving = true;
    // 화면 좌우: sx = (x − y) — 오른쪽으로 가면 1
    const sdx = dx - dy;
    if (Math.abs(sdx) > 0.01) p.dir = sdx > 0 ? 1 : -1;
    if (d <= mv) {
      p.x = tx;
      p.y = ty;
      p.path.shift();
    } else {
      p.x += (dx / d) * mv;
      p.y += (dy / d) * mv;
    }
  }
  // 손님 옆을 지나가면 가끔 하트
  if (!S.night && Math.random() < dt * PETS.heart) {
    const near = world.actors.some((a) => a.id && !a.role && !a.hidden && Math.hypot(a.x - p.x, a.y - p.y) < 1.3);
    if (near) heart(p);
  }
}
/** 하트 하나 (쓰다듬기는 여러 번 부른다) */
export function heart(p: PetRT, dx = 0) {
  p.hearts.push({ x: dx + (Math.random() * 6 - 3), y: 0, t: 0 });
}
/** 그 펫(마을에 있는 것)에 하트 n개 */
export function petHearts(id: string, n = 3) {
  const p = rt.find((x) => x.id === id && !x.guest);
  if (!p) return;
  for (let i = 0; i < n; i++) p.hearts.push({ x: (i - (n - 1) / 2) * 6, y: 0, t: -i * 0.15 });
}

/** render.ts가 매 프레임 부른다: 움직이고 깊이 정렬할 것들 */
export function petThings(dt: number): { d: number; tx: number; ty: number; fw: number; fh: number; pt: PetRT }[] {
  sync();
  if (!rt.length) return [];
  const d = Math.min(0.1, Math.max(0, dt));
  for (const p of rt) step(p, d);
  return rt.map((p) => ({ d: depthActor(p.x, p.y), tx: Math.floor(p.x), ty: Math.floor(p.y), fw: 1, fh: 1, pt: p }));
}

/** 화면 위 발 위치 (논리 픽셀) */
const feet = (p: PetRT): [number, number] => [Math.round(view.OX + sx(p.x, p.y)), Math.round(view.OY + sy(p.x, p.y) + TH / 2)];

/** 펫 하나 그리기 */
export function drawPet(ctx: CanvasRenderingContext2D, p: PetRT) {
  const [X, Y0] = feet(p);
  if (import.meta.env.DEV) drawN++;
  if (X < -30 || X > view.LW + 30 || Y0 < -40 || Y0 > view.LH + 40) return;
  const T = S.T;
  const asleep = S.night;
  // 깡총: 움직일 땐 0.18초마다 · 가만히 있을 땐 가끔 한 번 · 자면 1px 낮게
  const hop = asleep ? 0 : p.moving ? (Math.floor(T / 0.18 + p.ph * 7) % 2 ? -1 : 0) : (T + p.ph * 3) % 2.6 < 0.16 ? -1 : 0;
  const Y = Y0 + (asleep ? 1 : 0);
  dotShadow(ctx, X, Y0, 5, 2);
  const im = petDot(p.id);
  if (im) {
    const img = tinted(im, NL);
    const x = X - (im.width >> 1);
    const y = Y - im.height + 1 + hop;
    if (p.dir > 0) ctx.drawImage(img, x, y);
    else {
      ctx.save();
      ctx.translate(x + im.width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
  } else placeholder(ctx, X, Y + hop, p.dir);
  const top = Y - (im?.height ?? 12);
  if (asleep) zz(ctx, X + 6, top - 2, T + p.ph);
  for (const h of p.hearts) if (h.t >= 0) drawHeart(ctx, X + Math.round(h.x), Math.round(top - 3 - h.t * 10), Math.max(0, 1 - h.t / 1.3));
  // 쓰다듬은 날: 머리 위 작은 반짝 (가끔)
  if (!p.guest && !asleep && pattedToday(p.id) && (T + p.ph) % 3 < 0.25) {
    ctx.fillStyle = '#ffd6ec';
    ctx.fillRect(X + 4, top - 1, 1, 1);
  }
}
/** 그림을 못 불러온 펫(늦은 로딩 · 실패): 작은 중립 코드 도트 (둥근 몸 + 눈) — 특정 펫 모양 아님 */
function placeholder(ctx: CanvasRenderingContext2D, X: number, Y: number, dir: number) {
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(X + (dir > 0 ? x : -x - w), Y + y, w, h);
  };
  r(-4, -9, 8, 8, '#3a2a5a');
  r(-5, -8, 10, 6, '#3a2a5a');
  r(-3, -8, 6, 6, '#c9b8e0');
  r(-4, -7, 8, 4, '#c9b8e0');
  r(0, -6, 1, 1, '#1c1018');
  r(2, -6, 1, 1, '#1c1018');
}
function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, a: number) {
  ctx.globalAlpha = a;
  ctx.fillStyle = '#ff6fae';
  ctx.fillRect(x - 2, y, 2, 1);
  ctx.fillRect(x + 1, y, 2, 1);
  ctx.fillRect(x - 3, y + 1, 7, 1);
  ctx.fillRect(x - 2, y + 2, 5, 1);
  ctx.fillRect(x - 1, y + 3, 3, 1);
  ctx.fillRect(x, y + 4, 1, 1);
  ctx.fillStyle = '#ffd6ec';
  ctx.fillRect(x - 2, y + 1, 1, 1);
  ctx.globalAlpha = 1;
}
/** Zz 말풍선 (둥실) */
function zz(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const b = Math.round(Math.sin(t * 2) * 1);
  ctx.fillStyle = '#2a2140';
  ctx.fillRect(x - 1, y - 9 + b, 12, 8);
  ctx.fillStyle = '#f4f0ff';
  ctx.fillRect(x, y - 8 + b, 10, 6);
  ctx.fillRect(x, y - 2 + b, 2, 1);
  ctx.fillStyle = '#4a3a7a';
  // Z (4×4) · z (3×3)
  ctx.fillRect(x + 1, y - 7 + b, 4, 1);
  ctx.fillRect(x + 3, y - 6 + b, 1, 1);
  ctx.fillRect(x + 2, y - 5 + b, 1, 1);
  ctx.fillRect(x + 1, y - 4 + b, 4, 1);
  ctx.fillRect(x + 6, y - 6 + b, 3, 1);
  ctx.fillRect(x + 7, y - 5 + b, 1, 1);
  ctx.fillRect(x + 6, y - 4 + b, 3, 1);
}

/** 누른 자리의 펫 (논리 좌표 · 가장 가까운 것) */
export function petAt(mx: number, my: number): PetRT | null {
  let best: PetRT | null = null;
  let bd = 1e9;
  for (const p of rt) {
    const [X, Y] = feet(p);
    const h = petDot(p.id)?.height ?? 12;
    const d = Math.hypot(X - mx, Y - h / 2 - my);
    if (d < Math.max(9, h / 2 + 3) && d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}
let drawN = 0;
/** 시험·시트용: 그린 횟수 */
export const petDrawN = () => drawN;
/** 시험·시트용: 지금 마을 펫 */
export const petRT = () => rt;
/** 화면 좌표 (시트 스크립트용 · 논리 픽셀) */
export const petScreen = (id: string): [number, number] | null => {
  const p = rt.find((x) => x.id === id);
  return p ? feet(p) : null;
};
