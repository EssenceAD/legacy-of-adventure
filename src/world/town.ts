// 건물 배치·점유 격자·길찾기(A*)·땅 단계
import { CATALOG, def, START_TOWN, type Kind } from '../data/catalog';
import { CONFIG } from '../data/config';
import type { Neighbor } from '../data/neighbors';
import { N } from '../engine/iso';
import { S, world, type Building } from './state';

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

export function addObj(kind: Kind, tx: number, ty: number, extra: Partial<Building> = {}): Building {
  const d = def(kind);
  const o: Building = {
    kind, tx, ty, fw: d.size[0], fh: d.size[1], sprite: d.sprite, lvl: 1, hue: null, inside: [], ...extra,
  };
  world.objs.push(o);
  return o;
}

export function startTown() {
  world.objs = [];
  for (const [k, x, y] of START_TOWN) addObj(k, x, y);
}

export function neighborTown(v: Neighbor) {
  world.objs = [];
  for (const [k, x, y, lv, hue] of v.layout) {
    const o = addObj(k, x, y, { hue: hue ?? null });
    if ((lv ?? 1) > 1) upgradeObj(o, true);
  }
}

/** 문 앞 칸: 발판 앞(아래) 가운데 */
export function doorOf(o: Building): [number, number] {
  return [o.tx + Math.floor(o.fw / 2), o.ty + o.fh];
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
  return !o || o.kind === 'training' || o.kind === 'garden';
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
  pathT.add(hub[1] * N + hub[0]);
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
}

/** 지금 배치 모드 (null이면 아님) */
export const placing = { pl: null as Placement | null };

/** 지을 수 있나: 발판 전부 땅 안 + 안 겹침 + 문 앞 칸 비어 있음(장식 제외) */
export function canPlace(o: { kind: Kind; tx: number | null; ty: number | null; fw: number; fh: number }, ignore?: Building): boolean {
  if (o.tx == null || o.ty == null) return false;
  for (let j = 0; j < o.fh; j++)
    for (let i = 0; i < o.fw; i++) {
      const x = o.tx + i;
      const y = o.ty + j;
      if (!inLand(x, y)) return false;
      const g = grid[y]?.[x];
      if (g && g !== ignore) return false;
    }
  if (!def(o.kind).deco) {
    const dx = o.tx + Math.floor(o.fw / 2);
    const dy = o.ty + o.fh;
    if (!inLand(dx, dy)) return false;
    const g = grid[dy]?.[dx];
    if (g && g !== ignore) return false;
  }
  return true;
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

/** 레벨업: 앞 꼭짓점은 그대로, 뒤로 커진다. 뒤가 막혔으면 false */
export function upgradeObj(o: Building, silent = false): boolean {
  const up = def(o.kind).up;
  if (!up || o.sprite === up.sprite) return false;
  const nt = { kind: o.kind, tx: o.tx - (up.size[0] - o.fw), ty: o.ty - (up.size[1] - o.fh), fw: up.size[0], fh: up.size[1] };
  if (!silent && (!canPlace(nt, o) || blocksDoor(nt, o))) return false;
  Object.assign(o, { tx: nt.tx, ty: nt.ty, fw: nt.fw, fh: nt.fh, sprite: up.sprite, lvl: o.lvl + 1 });
  return true;
}

/** 지을 수 있는 목록 (고정·이미 있는 유일 건물 제외) */
export function buildableKinds(): Kind[] {
  return (Object.keys(CATALOG) as Kind[]).filter((k) => {
    const d = def(k);
    return !d.fixed && !(d.unique && world.objs.some((o) => o.kind === k));
  });
}
