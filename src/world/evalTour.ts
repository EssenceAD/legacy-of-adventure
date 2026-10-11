// 베타 2장: 평가단 순회 — 깃 달린 모자 3명이 입구에서 들어와 건물마다 들러 이모트(♥ / ? / !)를 띄우고 나간다
import { av } from '../engine/ver';
import { def } from '../data/catalog';
import type { ClassDef } from '../data/classes';
import { IMG, tinted } from '../engine/assets';
import { depthActor, sx, sy, TH, view } from '../engine/iso';
import { framesFor, type CharFrames } from '../engine/sprites';
import { NL } from './daynight';
import { harmonySets } from './harmony';
import { objTL } from './render';
import { S, world, type Building } from './state';
import { astar, doorOf, entrance } from './town';

const LOOK: ClassDef = {
  name: '평가단', face: { eyes: 'calm', mouth: 'flat', brow: 'angry' } as ClassDef['face'], hair: '#3a2a24', style: 'short', cloth: '#5a3a6a', arm: '#5a3a6a', pants: '#2a2440', boots: '#3a2418', accent: '#e8b94a', weapon: 'book', hat: 'feather', hatc: '#2a2440',
};
let FR: CharFrames | null = null;
const EMO: Record<string, HTMLImageElement> = {};
export const emote = (k: string) => {
  if (!EMO[k]) {
    EMO[k] = new Image();
    EMO[k].src = av(`assets/emotes/emo_${k}.png`);
  }
  return EMO[k];
};

interface Walker {
  x: number;
  y: number;
  dir: 1 | -1;
}
export const tour = {
  on: false,
  stops: [] as Building[],
  i: 0,
  path: [] as [number, number][],
  wait: 0,
  trail: [] as [number, number][],
  walkers: [] as Walker[],
  emotes: [] as { o: Building; k: string; t0: number }[],
  leaving: false,
  done: () => {},
};
const SPEED = 2.4;

/** 이 건물에 대한 평가단 반응: 어울림에 속하면 ♥, 장식만 덩그러니면 ?, 비어 있는 큰 건물이면 ! */
function reaction(o: Building): string {
  if (harmonySets().some((s) => s.members.includes(o))) return 'heart';
  if (!def(o.kind).deco && def(o.kind).act && !o.inside.length && o.kind !== 'inn') return 'alert';
  return 'question';
}

export function startTour(done: () => void) {
  const big = world.objs.filter((o) => !def(o.kind).deco && o.kind !== 'dungeon' && o.build === undefined);
  const deco = world.objs.filter((o) => def(o.kind).deco && o.kind !== 'board' && harmonySets().some((s) => s.members.includes(o))).slice(0, 3);
  // 입구에서 가까운 순서로 이어 걷기
  const [ex, ey] = entrance();
  const left = [...big, ...deco];
  const stops: Building[] = [];
  let cx = ex;
  let cy = ey;
  while (left.length && stops.length < 7) {
    left.sort((a, b) => Math.hypot(doorOf(a)[0] - cx, doorOf(a)[1] - cy) - Math.hypot(doorOf(b)[0] - cx, doorOf(b)[1] - cy));
    const o = left.shift()!;
    stops.push(o);
    [cx, cy] = doorOf(o);
  }
  Object.assign(tour, { on: true, stops, i: 0, path: [], wait: 0.6, trail: [], emotes: [], leaving: false, done });
  tour.walkers = [0, 1, 2].map((k) => ({ x: ex, y: ey + 1 + k * 0.6, dir: -1 as const }));
}

const target = (o: Building): [number, number] => {
  const d = doorOf(o);
  return def(o.kind).deco ? [Math.min(d[0], o.tx + o.fw), Math.min(d[1] + 0, o.ty + o.fh)] : d;
};

export function stepTour(dt: number) {
  if (!tour.on) return;
  const L = tour.walkers[0];
  if (tour.wait > 0) {
    tour.wait -= dt;
    if (tour.wait <= 0 && !tour.path.length) nextLeg();
    follow();
    return;
  }
  if (!tour.path.length) return nextLeg();
  const [tx, ty] = tour.path[0];
  const dx = tx - L.x;
  const dy = ty - L.y;
  const d = Math.hypot(dx, dy);
  const step = SPEED * dt;
  if (d <= step) {
    L.x = tx;
    L.y = ty;
    tour.path.shift();
    if (!tour.path.length) arrive();
  } else {
    L.x += (dx / d) * step;
    L.y += (dy / d) * step;
    L.dir = dx - dy >= 0 ? 1 : -1;
  }
  tour.trail.unshift([L.x, L.y]);
  if (tour.trail.length > 60) tour.trail.pop();
  follow();
}

function follow() {
  tour.walkers.forEach((w, k) => {
    if (!k) return;
    const p = tour.trail[Math.min(tour.trail.length - 1, k * 14)];
    if (!p) return;
    w.dir = p[0] - w.x - (p[1] - w.y) >= 0 ? 1 : -1;
    w.x = p[0];
    w.y = p[1];
  });
}

function nextLeg() {
  const L = tour.walkers[0];
  if (tour.leaving) {
    tour.on = false;
    tour.done();
    return;
  }
  const o = tour.stops[tour.i];
  const [gx, gy] = o ? target(o) : entrance();
  if (!o) {
    tour.leaving = true;
    tour.path = (astar(L.x, L.y, gx, gy) ?? [[gx, gy]]).concat([[gx, gy + 2]]);
    return;
  }
  tour.path = astar(L.x, L.y, gx, gy) ?? [[gx, gy]];
  if (tour.path.length > 1) tour.path.shift();
}

function arrive() {
  const o = tour.stops[tour.i];
  if (!o) return nextLeg();
  tour.emotes.push({ o, k: reaction(o), t0: S.T });
  tour.i++;
  tour.wait = 1.3;
}

// ───────── 그리기 ─────────

export const tourThings = () => (tour.on ? tour.walkers.map((w) => ({ d: depthActor(w.x, w.y), tx: Math.floor(w.x), ty: Math.floor(w.y), fw: 1, fh: 1, iv: w })) : []);

export function drawInspector(ctx: CanvasRenderingContext2D, w: Walker) {
  FR ||= framesFor('inspector', LOOK);
  const moving = tour.path.length > 0 && tour.wait <= 0;
  const list = moving ? FR.walk : FR.idle;
  const img = tinted(list[Math.floor(S.T * (moving ? 8 : 1.6)) % list.length], NL);
  const X = Math.round(view.OX + sx(w.x, w.y));
  const Y = Math.round(view.OY + sy(w.x, w.y) + TH / 2);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#1c1018';
  ctx.fillRect(X - 5, Y - 1, 10, 2);
  ctx.globalAlpha = 1;
  if (w.dir > 0) ctx.drawImage(img, X - 12, Y - 32);
  else {
    ctx.save();
    ctx.translate(X + 12, Y - 32);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
}

/** 건물 위 이모트 (3초 동안 톡 튀어 오르고 머문다) */
export function drawTourEmotes(ctx: CanvasRenderingContext2D) {
  for (const e of tour.emotes) {
    const t = S.T - e.t0;
    if (t > 6) continue;
    const im = emote(e.k);
    if (!im.complete) continue;
    const o = e.o;
    const top = o.sprite && IMG[o.sprite] ? objTL(o)[1] : Math.round(view.OY + sy(o.tx, o.ty)) - 24;
    const X = Math.round(view.OX + sx(o.tx + o.fw / 2, o.ty + o.fh / 2) - im.width);
    const bob = t < 0.3 ? Math.round((0.3 - t) * 20) : Math.round(Math.sin(t * 4));
    ctx.drawImage(im, X, top - 6 - im.height * 2 + bob, im.width * 2, im.height * 2);
  }
}
