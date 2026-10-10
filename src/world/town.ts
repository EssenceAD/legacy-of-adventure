// 건물 배치·점유 격자·길찾기(A*)·땅 단계
import { CATALOG, def, START_TOWN, type Kind } from '../data/catalog';
import { CONFIG } from '../data/config';
import type { Neighbor } from '../data/neighbors';
import { baseKey, FLIP, META } from '../engine/assets';
import { N, sx, sy, TW } from '../engine/iso';
import { P, S, world, type Building } from './state';
import { monumentUnlocked } from './progress';

// ───────── 땅 ─────────

/** 지금 보고 있는 마을의 땅 단계 (이웃 방문 중이면 그 마을) */
export const curLand = () => (S.visiting ? S.visiting.land : S.land);

export function landBounds(stage = curLand()): [number, number] {
  const L = CONFIG.land[stage - 1];
  return [L.from, L.to];
}

export function inLand(x: number, y: number, stage = curLand()) {
  const [a, b] = landBounds(stage);
  return x >= a && x < b && y >= a && y < b;
}

const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N;

// ───────── 건물 ─────────

/** 종류·레벨·반전에 맞는 그림 키 (레벨 2부터 큰 그림) */
export function spriteFor(kind: Kind, lvl: number, flip?: boolean): string | null {
  const d = def(kind);
  const s = lvl > 1 && d.up ? d.up.sprite : d.sprite;
  return s ? s + (flip ? FLIP : '') : null;
}
export function sizeFor(kind: Kind, lvl: number): [number, number] {
  const d = def(kind);
  return lvl > 1 && d.up ? d.up.size : d.size;
}

export function addObj(kind: Kind, tx: number, ty: number, extra: Partial<Building> = {}): Building {
  const lvl = extra.lvl ?? 1;
  const [fw, fh] = sizeFor(kind, lvl);
  const o: Building = {
    kind, tx, ty, fw, fh, lvl, hue: null, inside: [], ...extra, sprite: spriteFor(kind, lvl, extra.flip),
  };
  world.objs.push(o);
  return o;
}

export function startTown() {
  world.objs = [];
  for (const [k, x, y] of START_TOWN) addObj(k, x, y);
}

export function neighborTown(v: Neighbor) {
  placeLayout(
    v.layout.map(([kind, tx, ty, lvl, hue, flip]) => ({ kind, tx, ty, lvl: lvl ?? 1, hue: hue ?? null, flip: !!flip })),
    v.land,
  );
}

// ───────── 배치표 검사 (이웃 마을·저장 데이터 공통) ─────────

export interface LayoutEntry {
  kind: Kind;
  tx: number;
  ty: number;
  lvl: number;
  hue: number | null;
  flip?: boolean;
  extra?: Partial<Building>;
}

/** 같은 종류가 여러 개여도 되는 것 (별채·장식) */
const MULTI = (k: Kind) => k === 'cottage' || !!def(k).deco;

/**
 * 배치표를 내 마을과 같은 규칙으로 놓는다: 발판 겹침 금지 · 땅 안 · 문 앞 1칸 비움 · 다른 건물 문 앞 막지 않기.
 * 어긋난 건물은 가장 가까운 빈자리로 옮기고, 그래도 없으면 뺀다. 같은 종류 중복(대장간 2개 등)도 뺀다.
 * 저장이 깨져 있거나 다른 유저 마을이 이상해도 화면은 안 깨지게. world.objs를 새로 채운다.
 */
export function placeLayout(entries: LayoutEntry[], land: number): { moved: number; dropped: number } {
  world.objs = [];
  const [lo, hi] = landBounds(land);
  const inL = (x: number, y: number) => x >= lo && x < hi && y >= lo && y < hi;
  const seen = new Set<Kind>();
  let moved = 0;
  let dropped = 0;
  // 여관·던전 먼저, 그다음 큰 건물, 장식은 마지막 (자리를 빼앗지 않게)
  const order = (e: LayoutEntry) => (e.kind === 'inn' ? 0 : e.kind === 'dungeon' ? 1 : def(e.kind).deco ? 3 : 2);
  const list = entries.filter((e) => e && e.kind in CATALOG).sort((a, b) => order(a) - order(b));
  const occupied = (x: number, y: number) => world.objs.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);
  const fits = (e: LayoutEntry, tx: number, ty: number) => {
    const [fw, fh] = sizeFor(e.kind, e.lvl);
    const fixed = !!def(e.kind).fixed;
    for (let j = 0; j < fh; j++)
      for (let i = 0; i < fw; i++) {
        const x = tx + i;
        const y = ty + j;
        if (!inMap(x, y) || (!fixed && !inL(x, y)) || occupied(x, y)) return false;
      }
    if (!def(e.kind).deco && !fixed) {
      const [dx, dy] = doorOf({ tx, ty, fw, fh, flip: e.flip });
      if (!inL(dx, dy) || occupied(dx, dy)) return false;
    }
    // 이미 놓인 건물의 문 앞 칸을 막지 않기
    for (const o of world.objs) {
      if (def(o.kind).deco) continue;
      const [dx, dy] = doorOf(o);
      if (dx >= tx && dx < tx + fw && dy >= ty && dy < ty + fh) return false;
    }
    return true;
  };
  for (const e of list) {
    if (!MULTI(e.kind)) {
      if (seen.has(e.kind)) {
        dropped++;
        continue;
      }
      seen.add(e.kind);
    }
    let spot: [number, number] | null = Number.isFinite(e.tx) && Number.isFinite(e.ty) && fits(e, e.tx, e.ty) ? [e.tx, e.ty] : null;
    // 가장 가까운 빈자리 (맨해튼 거리 순)
    for (let r = 1; !spot && r < N * 2; r++)
      for (let dy = -r; dy <= r && !spot; dy++) {
        const dx = r - Math.abs(dy);
        for (const x of dx ? [e.tx + dx, e.tx - dx] : [e.tx]) if (!spot && fits(e, x, e.ty + dy)) spot = [x, e.ty + dy];
      }
    if (!spot) {
      dropped++;
      continue;
    }
    if (spot[0] !== e.tx || spot[1] !== e.ty) moved++;
    addObj(e.kind, spot[0], spot[1], { ...e.extra, hue: e.hue, lvl: e.lvl, flip: !!e.flip });
  }
  return { moved, dropped };
}

/** 문 앞 칸: 발판 앞 왼쪽 면(y+) 가운데. 좌우 반전이면 앞 오른쪽 면(x+) 가운데 */
export function doorOf(o: { tx: number; ty: number; fw: number; fh: number; flip?: boolean }): [number, number] {
  return o.flip ? [o.tx + o.fw, o.ty + Math.floor(o.fh / 2)] : [o.tx + Math.floor(o.fw / 2), o.ty + o.fh];
}

export const findKind = (k: Kind) => world.objs.find((o) => o.kind === k);

/** 손님 수 = 2 + 여관 레벨×2 + 별채 수×2 */
export function capacity(objs = world.objs): number {
  const A = CONFIG.actors;
  const inn = objs.find((o) => o.kind === 'inn');
  // 공사 중인 별채는 아직 방이 아니다
  return A.capBase + (inn ? inn.lvl * A.perInnLevel : 0) + objs.filter((o) => o.kind === 'cottage' && o.build === undefined).length * A.perCottage;
}

// ───────── 점유 격자·길 ─────────

export let grid: (Building | null)[][] = [];
/** 흙길 칸 (y*N+x). 땅 밖이어도 던전 가는 길은 여기에 들어간다 */
export let pathT = new Set<number>();
/** 땅이나 길이 바뀌면 올라간다 → 바닥 다시 그리기 */
export let groundVersion = 0;

function occ() {
  const g: (Building | null)[][] = Array.from({ length: N }, () => Array(N).fill(null));
  for (const o of world.objs)
    for (let j = 0; j < o.fh; j++)
      for (let i = 0; i < o.fw; i++) {
        const x = o.tx + i;
        const y = o.ty + j;
        if (inMap(x, y)) g[y][x] = o;
      }
  return g;
}

/** 걸을 수 있는 칸: 땅 안(또는 땅 밖 흙길) + 건물 없음 (훈련장·텃밭은 안으로 들어가 활동) */
export function walkable(x: number, y: number, free = false): boolean {
  if (!inMap(x, y)) return false;
  if (!free && !inLand(x, y) && !pathT.has(y * N + x)) return false;
  const o = grid[y][x];
  return !o || o.kind === 'training' || o.kind === 'garden' || o.kind === 'gate';
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** A* 길찾기. 흙길 칸을 선호한다. free=true면 땅 밖도 걸을 수 있다(길 만들기용) */
export function astar(sx0: number, sy0: number, gx: number, gy: number, free = false): [number, number][] | null {
  const sx = Math.max(0, Math.min(N - 1, Math.round(sx0)));
  const sy = Math.max(0, Math.min(N - 1, Math.round(sy0)));
  if (!inMap(gx, gy)) return null;
  // 맵이 최대 14×14라 열린 목록에서 최솟값을 그냥 훑어서 고른다 (닫힌 칸은 다시 안 봄)
  const NN = N * N;
  const g = new Float32Array(NN).fill(Infinity);
  const came = new Int16Array(NN).fill(-1);
  const closed = new Uint8Array(NN);
  const open: number[] = [];
  const start = sy * N + sx;
  const goal = gy * N + gx;
  const h = (k: number) => Math.abs((k % N) - gx) + Math.abs(Math.floor(k / N) - gy);
  g[start] = 0;
  open.push(start);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (g[open[i]] + h(open[i]) < g[open[bi]] + h(open[bi])) bi = i;
    const k = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (closed[k]) continue;
    closed[k] = 1;
    if (k === goal) {
      const p: [number, number][] = [];
      for (let c = k; c !== -1; c = came[c]) p.unshift([c % N, Math.floor(c / N)]);
      return p;
    }
    const x = k % N;
    const y = Math.floor(k / N);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const nk = ny * N + nx;
      if (closed[nk] || (nk !== goal && !walkable(nx, ny, free))) continue;
      // 흙길 칸을 선호
      const ng = g[k] + 1 + (pathT.has(nk) ? -0.4 : 0);
      if (ng < g[nk]) {
        g[nk] = ng;
        came[nk] = k;
        open.push(nk);
      }
    }
  }
  return null;
}

/** 격자를 새로 만들고 흙길을 다시 깐다 (각 문 → 여관 문). 던전 가는 길은 땅 밖이어도 깐다. */
export function rebuildPaths() {
  grid = occ();
  pathT = new Set();
  const inn = findKind('inn');
  groundVersion++;
  if (!inn) return;
  const hub = doorOf(inn);
  const lay = (o: Building, free: boolean) => {
    const d = doorOf(o);
    const p = astar(d[0], d[1], hub[0], hub[1], free);
    if (p) for (const [x, y] of p) if (inMap(x, y) && !grid[y][x]) pathT.add(y * N + x);
  };
  for (const o of world.objs) {
    if (o === inn || o.kind === 'dungeon') continue;
    if (def(o.kind).deco && o.kind !== 'board') continue;
    lay(o, false);
  }
  const dg = findKind('dungeon');
  if (dg) lay(dg, true);
  // 마을 입구 → 여관 문 (손님이 걸어 들어오는 길)
  const [ex, ey] = entrance();
  const pe = astar(ex, ey, hub[0], hub[1]);
  if (pe) for (const [x, y] of pe) if (!grid[y][x] || grid[y][x]!.kind === 'gate') pathT.add(y * N + x);
  pathT.add(hub[1] * N + hub[0]);
}

/** 마을 입구: 울타리 앞쪽(화면 아래) 가장자리에서 여관 문과 같은 줄의 빈 칸 */
export function entrance(): [number, number] {
  const [a, b] = landBounds();
  const inn = findKind('inn');
  const hx = inn ? doorOf(inn)[0] : Math.floor((a + b) / 2);
  const y = b - 1;
  for (let d = 0; d < b - a; d++)
    for (const x of [hx - d, hx + d]) if (x >= a && x < b && (!grid[y]?.[x] || grid[y][x]!.kind === 'gate')) return [x, y];
  return [hx, y];
}

// ───────── 짓기 ─────────

export interface Placement {
  kind: Kind;
  sprite: string | null;
  fw: number;
  fh: number;
  tx: number | null;
  ty: number | null;
  ok: boolean;
  /** 좌우 반전 */
  flip?: boolean;
  /** 옮기는 중인 기존 건물 (새로 짓기면 없음) */
  move?: Building;
  /** 베타: 마을 등급 장식을 마을 안으로 옮기는 중 (k@x,y) — 무료 */
  prop?: string;
  /** 놓을 수 없는 까닭 */
  why?: string;
  /** 칸이 바뀐 순간 (톡 튕기는 연출) */
  snapT?: number;
}

/** 지금 배치 모드 (null이면 아님) */
export const placing = { pl: null as Placement | null };

/** 지을 수 있나: 발판 전부 땅 안 + 안 겹침 + 문 앞 칸 비어 있음(장식 제외) */
export function canPlace(o: { kind: Kind; tx: number | null; ty: number | null; fw: number; fh: number; flip?: boolean }, ignore?: Building): boolean {
  if (o.tx == null || o.ty == null) return false;
  for (let j = 0; j < o.fh; j++)
    for (let i = 0; i < o.fw; i++) {
      const x = o.tx + i;
      const y = o.ty + j;
      if (!inLand(x, y)) return false;
      const g = grid[y]?.[x];
      if (g && g !== ignore) return false;
    }
  if (o.kind === 'gate' && !gateOk(o)) return false;
  if (!def(o.kind).deco) {
    const [dx, dy] = doorOf({ tx: o.tx, ty: o.ty, fw: o.fw, fh: o.fh, flip: o.flip });
    if (!inLand(dx, dy)) return false;
    const g = grid[dy]?.[dx];
    if (g && g !== ignore) return false;
  }
  return true;
}

/** 정문: 마을 입구 길 위에만 — 발자국이 울타리 앞줄의 입구 칸을 덮어야 한다 */
export function gateOk(o: { tx: number | null; ty: number | null; fw: number; fh: number }): boolean {
  if (o.tx == null || o.ty == null) return false;
  const [ex, ey] = entrance();
  return ex >= o.tx && ex < o.tx + o.fw && ey >= o.ty && ey < o.ty + o.fh;
}

/** 다른 건물의 문 앞을 막지 않는지 */
export function blocksDoor(o: { tx: number | null; ty: number | null; fw: number; fh: number }, ignore?: Building): boolean {
  if (o.tx == null || o.ty == null) return false;
  for (const b of world.objs) {
    if (b === ignore || def(b.kind).deco) continue;
    const [dx, dy] = doorOf(b);
    if (dx >= o.tx && dx < o.tx + o.fw && dy >= o.ty && dy < o.ty + o.fh) return true;
  }
  return false;
}

/** 맵 가운데에서 가까운 첫 빈자리 */
export function suggestSpot(pl: Placement) {
  const [a, b] = landBounds();
  if (pl.kind === 'gate') {
    const [ex, ey] = entrance();
    for (const [dx, dy] of [[0, 1], [1, 1], [0, 0], [1, 0]]) {
      pl.tx = ex - dx;
      pl.ty = ey - dy;
      if (canPlace(pl) && !blocksDoor(pl)) return;
    }
  }
  const mid = N / 2;
  for (let r = 0; r < N * 2; r++)
    for (let y = a; y < b; y++)
      for (let x = a; x < b; x++) {
        if (Math.abs(x - mid) + Math.abs(y - mid) !== r) continue;
        pl.tx = x;
        pl.ty = y;
        if (canPlace(pl) && !blocksDoor(pl)) return;
      }
  pl.tx = pl.ty = null;
}

/** 다음 레벨 비용 (최대 레벨이면 null) */
export function nextLevelCost(o: Building): number | null {
  const d = def(o.kind);
  const lv = d.levels ?? (d.up ? [d.up.cost] : []);
  return lv[o.lvl - 1] ?? null;
}
export const maxLevel = (k: Kind) => 1 + (def(k).levels?.length ?? (def(k).up ? 1 : 0));

/** 레벨업. 그림이 커지는 레벨(첫 번째)은 앞 꼭짓점은 그대로, 뒤로 커진다. 뒤가 막혔으면 false */
export function upgradeObj(o: Building, silent = false): boolean {
  if (nextLevelCost(o) == null) return false;
  const up = def(o.kind).up;
  if (!up || (o.sprite && baseKey(o.sprite) === up.sprite)) {
    o.lvl++;
    return true;
  }
  const nt = { kind: o.kind, tx: o.tx - (up.size[0] - o.fw), ty: o.ty - (up.size[1] - o.fh), fw: up.size[0], fh: up.size[1] };
  if (!silent && (!canPlace(nt, o) || blocksDoor(nt, o))) return false;
  Object.assign(o, { tx: nt.tx, ty: nt.ty, fw: nt.fw, fh: nt.fh, sprite: up.sprite + (o.flip ? FLIP : ''), lvl: o.lvl + 1 });
  return true;
}

/** 지을 수 있는 목록 (고정·이미 있는 유일 건물 제외) */
export function buildableKinds(): Kind[] {
  return (Object.keys(CATALOG) as Kind[]).filter((k) => {
    const d = def(k);
    // 트로피는 그 보스를 처치했을 때만
    if (k.startsWith('trophy_') && !P.trophies.includes(k.slice(7))) return false;
    // 기념비는 손님·아이템·영웅 도감 중 하나를 100% 채웠을 때
    if (k === 'monument' && !monumentUnlocked()) return false;
    return !d.fixed && !(d.unique && world.objs.some((o) => o.kind === k));
  });
}

/** 건물 그림의 왼쪽 위 (월드 원점 기준 논리 px): 그림의 아래 가운데 = 발판 마름모의 앞 꼭짓점 */
export function spriteOrigin(o: { sprite: string | null; tx: number; ty: number; fw: number; fh: number }): [number, number] {
  const m = o.sprite ? META[o.sprite] : null;
  if (!m) return [0, 0];
  const X = sx(o.tx, o.ty) + ((o.fw - o.fh) * TW) / 4;
  const Yb = sy(o.tx + o.fw, o.ty + o.fh);
  return [X - m.w / 2, Yb - m.h + 2];
}
