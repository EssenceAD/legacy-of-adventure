// 건물 배치·점유 격자·길찾기(A*)·땅 단계
import { vis } from './visual';
import { CATALOG, def, START_TOWN, type Kind } from '../data/catalog';
import { HV_NEW_DECO } from '../data/harvest_cfg';
import { CONFIG } from '../data/config';
import type { Neighbor } from '../data/neighbors';
import { FLIP, META } from '../engine/assets';
import { N, sx, sy, TW } from '../engine/iso';
import { P, S, world, type Building, type StoredObj } from './state';
import { monumentUnlocked } from './progress';
import { windDecorMult } from './wind';
import { flag } from './flags';

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
/** 그 레벨의 그림 단계 (없으면 기본 그림) */
function stageFor(kind: Kind, lvl: number): { sprite: string | null; size: [number, number] } {
  const d = def(kind);
  const st = d.stages ?? (d.up ? [{ from: 2, sprite: d.up.sprite, size: d.up.size }] : []);
  let cur: { sprite: string | null; size: [number, number] } = { sprite: d.sprite, size: d.size };
  for (const s of st) if (lvl >= s.from) cur = s;
  return cur;
}
export function spriteFor(kind: Kind, lvl: number, flip?: boolean): string | null {
  const s = stageFor(kind, lvl).sprite;
  return s ? s + (flip ? FLIP : '') : null;
}
export function sizeFor(kind: Kind, lvl: number): [number, number] {
  return stageFor(kind, lvl).size;
}
/** 땅 개편: 다음 레벨에 필요한 땅 단계 (없으면 0) */
export const landNeedFor = (o: { kind: Kind; lvl: number }) => def(o.kind).needLand?.[o.lvl] ?? 0;

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
/** 별채·장식 (예전 규칙의 「여러 채」 — 어울림·환불 표시 등에서 씀) */
export const MULTI = (k: Kind) => k === 'cottage' || !!def(k).deco;
/**
 * HOTFIX14 §1 (→ TOWN_SPEC T3): 마을에 한 채만 있는 건물 = 여관 본관 · 던전 · 고정 건물. 나머지(온천·대장간·주점…)는 여러 채 허용.
 *  짓기·불러오기 규칙이 같아야 한다 — 예전엔 짓기는 되는데 불러올 때 둘째를 조용히 버렸다.
 */
export const SINGLE = (k: Kind) => k === 'inn' || k === 'dungeon' || !!def(k).fixed;
/** 같은 종류 몇 채 (공사 중 포함) */
export const countKind = (k: Kind, objs = world.objs) => objs.filter((o) => o.kind === k).length;
/** TOWN T3: 지금 땅에서 이 건물을 몇 채까지 (별채·장식은 제한 없음 · 한 채뿐인 건물은 1) */
export function maxCopies(k: Kind, land = S.land): number {
  if (MULTI(k)) return Infinity;
  if (SINGLE(k)) return 1;
  const m = CONFIG.town.maxCopies;
  return m[Math.max(0, Math.min(m.length - 1, land - 1))];
}
/** TOWN T3: 두 번째 채부터 수입 70% (가장 높은 레벨 한 채만 100%) */
export function copyIncomeMult(o: Building, objs: Building[] = world.objs): number {
  if (MULTI(o.kind) || SINGLE(o.kind)) return 1;
  if (countKind(o.kind, objs) < 2) return 1;
  return bestOf(o.kind, objs, true) === o ? 1 : CONFIG.town.copyIncome;
}
/** n번째 채 건설비 (첫 채 = 기본 · 두 번째부터 CONFIG.town.copyCost 배) */
export function buildCost(k: Kind, objs = world.objs): number {
  const n = MULTI(k) ? 0 : countKind(k, objs);
  const m = CONFIG.town.copyCost;
  // DIRECTION §1-2 축제의 해: 장식 값 −15%
  return Math.round(def(k).cost * m[Math.min(n, m.length - 1)] * (def(k).deco ? windDecorMult() : 1));
}

/**
 * 배치표를 내 마을과 같은 규칙으로 놓는다: 발판 겹침 금지 · 땅 안 · 문 앞 1칸 비움 · 다른 건물 문 앞 막지 않기.
 * 어긋난 건물은 가장 가까운 빈자리로 옮긴다. 저장이 깨져 있거나 다른 유저 마을이 이상해도 화면은 안 깨지게. world.objs를 새로 채운다.
 * HOTFIX14 §1: 예전엔 같은 종류 둘째(온천 2채 등)와 자리 없는 건물을 「조용히」 버렸다 → 이제
 *  · 같은 종류 여러 채는 그대로 살린다. 한 채뿐인 건물(여관 본관·던전·고정)만 레벨 높은 것을 남기고 나머지는 removed (부르는 쪽이 전액 환불)
 *  · 큰 건물부터(발판 넓이 내림차순) 놓고 장식은 맨 마지막 → 장식이 건물 자리를 막지 않는다
 *  · 그래도 자리가 없으면 removed 로 돌려준다 (버리지 않음)
 */
export function placeLayout(entries: LayoutEntry[], land: number): { moved: number; dropped: number; removed: { e: LayoutEntry; why: 'dupe' | 'nospace' }[] } {
  world.objs = [];
  const [lo, hi] = landBounds(land);
  const inL = (x: number, y: number) => x >= lo && x < hi && y >= lo && y < hi;
  let moved = 0;
  let dropped = 0;
  const removed: { e: LayoutEntry; why: 'dupe' | 'nospace' }[] = [];
  // 같은 종류(하나뿐인 건물) 중복: 가장 좋은 하나만
  const valid = entries.filter((e) => e && e.kind in CATALOG);
  const keep = new Map<Kind, LayoutEntry>();
  const better = (a: LayoutEntry, b: LayoutEntry) =>
    a.lvl !== b.lvl ? a.lvl > b.lvl : !!a.extra?.con !== !!b.extra?.con ? !a.extra?.con : (a.extra?.builtAt ?? 0) <= (b.extra?.builtAt ?? 0);
  for (const e of valid) {
    if (!SINGLE(e.kind)) continue;
    const k = keep.get(e.kind);
    if (!k) keep.set(e.kind, e);
    else if (better(e, k)) {
      removed.push({ e: k, why: 'dupe' });
      keep.set(e.kind, e);
    } else removed.push({ e, why: 'dupe' });
  }
  const dupes = new Set(removed.map((r) => r.e));
  dropped += dupes.size;
  // 여관·던전 먼저, 그다음 큰 건물(발판 넓이 내림차순), 장식은 마지막 (자리를 빼앗지 않게)
  const area = (e: LayoutEntry) => (e.extra?.fw && e.extra?.fh ? e.extra.fw * e.extra.fh : sizeFor(e.kind, e.lvl)[0] * sizeFor(e.kind, e.lvl)[1]);
  const order = (e: LayoutEntry) => (e.kind === 'inn' ? 0 : e.kind === 'dungeon' ? 1 : def(e.kind).deco ? 3 : 2);
  const list = valid.filter((e) => !dupes.has(e)).sort((a, b) => order(a) - order(b) || area(b) - area(a));
  const occupied = (x: number, y: number) => world.objs.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);
  const fits = (e: LayoutEntry, tx: number, ty: number) => {
    // CONSTRUCTION_SPEC: 커지는 업그레이드 공사 중이면 새 발판 크기로
    const [fw, fh] = e.extra?.fw && e.extra?.fh ? [e.extra.fw, e.extra.fh] : sizeFor(e.kind, e.lvl);
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
    let spot: [number, number] | null = Number.isFinite(e.tx) && Number.isFinite(e.ty) && fits(e, e.tx, e.ty) ? [e.tx, e.ty] : null;
    // 가장 가까운 빈자리 (맨해튼 거리 순)
    for (let r = 1; !spot && r < N * 2; r++)
      for (let dy = -r; dy <= r && !spot; dy++) {
        const dx = r - Math.abs(dy);
        for (const x of dx ? [e.tx + dx, e.tx - dx] : [e.tx]) if (!spot && fits(e, x, e.ty + dy)) spot = [x, e.ty + dy];
      }
    if (!spot) {
      dropped++;
      removed.push({ e, why: 'nospace' });
      continue;
    }
    if (spot[0] !== e.tx || spot[1] !== e.ty) moved++;
    addObj(e.kind, spot[0], spot[1], { ...e.extra, hue: e.hue, lvl: e.lvl, flip: !!e.flip });
  }
  return { moved, dropped, removed };
}

/** 문 앞 칸: 발판 앞 왼쪽 면(y+) 가운데. 좌우 반전이면 앞 오른쪽 면(x+) 가운데 */
export function doorOf(o: { tx: number; ty: number; fw: number; fh: number; flip?: boolean }): [number, number] {
  return o.flip ? [o.tx + o.fw, o.ty + Math.floor(o.fh / 2)] : [o.tx + Math.floor(o.fw / 2), o.ty + o.fh];
}

/** 그 종류 중 가장 높은 레벨 한 채 (같으면 다 지은 것) — 여러 채여도 「마을 전체 효과」는 이 한 채 기준 (HOTFIX14 §1) */
export function bestOf(k: Kind, objs: Building[] = world.objs, builtOnly = false): Building | undefined {
  let b: Building | undefined;
  for (const o of objs) {
    if (o.kind !== k || (builtOnly && o.build !== undefined)) continue;
    if (!b || o.lvl > b.lvl || (o.lvl === b.lvl && b.build !== undefined && o.build === undefined)) b = o;
  }
  return b;
}
export const findKind = (k: Kind) => bestOf(k);

/** 손님 수 = 2 + 여관 레벨×2 + 별채 수×2 */
export function capacity(objs = world.objs): number {
  const A = CONFIG.actors;
  const inn = objs.find((o) => o.kind === 'inn');
  // 공사 중인 별채는 아직 방이 아니다
  // 땅 개편: 여관 Lv.3까지 레벨당 +2, Lv.4부터 +1
  const full = CONFIG.upgrade.innRoomsFullUntil;
  const innRooms = inn ? Math.min(inn.lvl, full) * A.perInnLevel + Math.max(0, inn.lvl - full) : 0;
  return A.capBase + innRooms + objs.filter((o) => o.kind === 'cottage' && o.build === undefined).length * A.perCottage;
}

// ───────── 점유 격자·길 ─────────

/** TOWN T2: 칠한 칸 (이웃 구경 중엔 없음) — 연못은 걸을 수 없고 그 위엔 못 짓는다 · 길 재질 칸은 길 */
export const paintOf = (x: number, y: number): string | undefined => (S.visiting ? undefined : P.decor?.paint?.[`${x},${y}`]);
/** BUILDUX §3-3: 모서리를 둥글린 길 칸 */
export const roundOf = (x: number, y: number): boolean => !S.visiting && !!P.decor?.round?.[`${x},${y}`];
export const pondAt = (x: number, y: number) => paintOf(x, y) === 'pond';
const PAINT_PATHS = new Set(['stone', 'dirt', 'brick', 'deck', 'step']);

export let grid: (Building | null)[][] = [];
/** 흙길 칸 (y*N+x). 땅 밖이어도 던전 가는 길은 여기에 들어간다 */
export let pathT = new Set<number>();
/** v0.25.2 §I #20: 자동 길 끔일 때 던전 가는 숲길 — 그리지 않고 걷기에만 쓰는 칸 (울타리 밖은 길 칸이어야 걸을 수 있어서) */
export let walkT = new Set<number>();
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
  if (!free && !inLand(x, y) && !pathT.has(y * N + x) && !walkT.has(y * N + x)) return false;
  if (pondAt(x, y)) return false;
  const o = grid[y][x];
  return !o || o.kind === 'training' || o.kind === 'garden' || o.kind === 'gate';
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** A* 길찾기. 흙길 칸을 선호한다. free=true면 땅 밖도 걸을 수 있다(길 만들기용) */
export function astar(sx0: number, sy0: number, gx: number, gy: number, free = false): [number, number][] | null {
  const sx = Math.max(0, Math.min(N - 1, Math.round(sx0)));
  const sy = Math.max(0, Math.min(N - 1, Math.round(sy0)));
  if (!inMap(gx, gy)) return null;
  // 맵이 최대 24×24라 열린 목록에서 최솟값을 그냥 훑어서 고른다 (닫힌 칸은 다시 안 봄)
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
      // 흙길 칸을 선호 · BUILDUX §7: 유저가 지운 칸(noPath)은 다시 안 깐다 — FEEDBACK23: 돌아가는 새 길도 만들지 않는다 (비용 0 = 같은 길에서 그 칸만 빠짐)
      const ng = g[k] + 1 + (pathT.has(nk) ? -0.4 : 0) + (avoidNo?.has(nk) ? CONFIG.feedback23.noPathDetour : 0);
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
/** BUILDUX §7: 길을 다시 깔 때만 쓰는 「지운 칸」 (손님 걷기엔 영향 없음) */
let avoidNo: Set<number> | null = null;
export function rebuildPaths() {
  grid = occ();
  pathT = new Set();
  walkT = new Set();
  avoidNo = new Set(S.visiting ? [] : Object.keys(P.decor?.noPath ?? {}).map((k) => { const [x, y] = k.split(',').map(Number); return y * N + x; }));
  const inn = findKind('inn');
  groundVersion++;
  if (!inn) return;
  const hub = doorOf(inn);
  const lay = (o: Building, free: boolean, outsideOnly = false, into = pathT) => {
    const d = doorOf(o);
    const p = astar(d[0], d[1], hub[0], hub[1], free);
    if (p) for (const [x, y] of p) if (inMap(x, y) && !grid[y][x] && !(outsideOnly && inLand(x, y))) into.add(y * N + x);
  };
  // TOWN T2: 자동 길을 끄면 건물↔여관 길은 깔지 않는다 (던전 가는 숲길·칠한 길만)
  const auto = S.visiting || P.decor?.autoPath !== false;
  for (const o of world.objs) {
    if (!auto) break;
    if (o === inn || o.kind === 'dungeon') continue;
    if (def(o.kind).deco && o.kind !== 'board') continue;
    lay(o, false);
  }
  const dg = findKind('dungeon');
  // 핫픽스 v0.24.6: 자동 길 끔이면 던전 길은 울타리 밖(숲) 칸만 — 마을 안엔 안 깐다
  // v0.25.2 §I #20: 자동 길 끔이면 던전 길도 안 그린다 (울타리 밖 포함) — 걷기용 숲길(walkT)만 남긴다
  if (dg && !auto && vis('autoPathNone')) lay(dg, true, true, walkT);
  else if (dg) lay(dg, true, !auto && flag('autoPathStrict'));
  // 마을 입구 → 여관 문 (손님이 걸어 들어오는 길)
  const [ex, ey] = entrance();
  const pe = auto ? astar(ex, ey, hub[0], hub[1]) : null;
  if (pe) for (const [x, y] of pe) if (!grid[y][x] || grid[y][x]!.kind === 'gate') pathT.add(y * N + x);
  if (auto) pathT.add(hub[1] * N + hub[0]);
  // 돌아갈 수 없어 지나간 지운 칸도 그리지 않는다 (지운 그대로 보이게)
  for (const k of avoidNo) pathT.delete(k);
  avoidNo = null;
  // TOWN T2: 칠한 길 (자동 길과 상관없이)
  if (!S.visiting) for (const [k, c] of Object.entries(P.decor?.paint ?? {})) if (PAINT_PATHS.has(c)) { const [x, y] = k.split(',').map(Number); if (inMap(x, y) && !grid[y][x]) pathT.add(y * N + x); }
  layoutHooks.after();
}

/** 핫픽스 11 §9-2: 건물 배치가 바뀐 뒤(짓기·레벨업·옮기기·철거) — actors가 채운다 (발판 위 손님 밀어내기 · 남은 길 다시) */
export const layoutHooks = { after: () => {} };
/** 건물 발판이 막고 있는 칸인가 (안으로 들어가 활동하는 훈련장·텃밭·정문은 빼고) */
export function blockedAt(x: number, y: number): boolean {
  if (!inMap(x, y)) return false;
  const o = grid[y]?.[x];
  return !!o && o.kind !== 'training' && o.kind !== 'garden' && o.kind !== 'gate';
}
/** 가장 가까운 걸을 수 있는 칸 (반경 6칸 안) */
export function nearestWalkable(x: number, y: number): [number, number] | null {
  for (let r = 1; r <= 6; r++) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!walkable(nx, ny)) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) [bd, best] = [d, [nx, ny]];
      }
    if (best) return best;
  }
  return null;
}

/** 자동 입구 줄: 여관 문과 같은 x (여관이 없으면 땅 가운데) */
export function autoEntranceX(): number {
  const [a, b] = landBounds();
  const inn = findKind('inn');
  return inn ? doorOf(inn)[0] : Math.floor((a + b) / 2);
}
/**
 * FEEDBACK23 §5: 입구를 둘 x — 꾸미기에서 옮겼으면 그 x(P.decor.entX · 이웃은 모습의 ent), 아니면 자동.
 *  땅이 넓어져도 앞 가장자리 안으로 끼워 넣는다 (옛 저장 = 없음 = 지금 그대로)
 */
export function entranceX(): number {
  const [a, b] = landBounds();
  const v = S.visiting ? S.visiting.ent : P.decor?.entX;
  const x = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : autoEntranceX();
  return Math.max(a, Math.min(b - 1, x));
}
/** 마을 입구: 울타리 앞쪽(화면 아래) 가장자리에서 입구 줄(기본 = 여관 문과 같은 줄)에 가장 가까운 빈 칸 */
export function entrance(hx = entranceX()): [number, number] {
  const [a, b] = landBounds();
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
  /** BUILDUX §2-3: 보관함에서 꺼내 놓는 중 (무료) */
  store?: StoredObj;
  /** BUILDUX §1-6: 같은 장식을 이어서 놓는 중 */
  chain?: boolean;
  /** FEEDBACK23 §5: 마을 입구를 옮기는 중 (1칸 · 울타리 앞 가장자리만) */
  ent?: boolean;
}

/** 지금 배치 모드 (null이면 아님) */
export const placing = { pl: null as Placement | null };

/** FEEDBACK23 §4: 꾸미기에서 옮길 수 있는 종류 — 고정 건물 중 던전 입구는 옮길 수 있다 (철거·보관은 여전히 안 됨) */
export const canMoveKind = (k: Kind) => !def(k).fixed || k === 'dungeon';
/** FEEDBACK23 §4: 던전이 처음 있던 숲속 자리 (처음 옮길 때 기억) — 땅 밖이어도 여기로는 되돌릴 수 있다 */
export function dungeonHome(): [number, number] | null {
  const h = S.visiting ? null : P.decor?.dgHome;
  return Array.isArray(h) && h.length === 2 && h.every(Number.isFinite) ? [h[0], h[1]] : null;
}
/** 땅 밖이어도 되는 자리인가 (던전의 숲속 원래 자리) */
export function outsideOk(o: { kind: Kind; tx: number | null; ty: number | null }): boolean {
  if (o.kind !== 'dungeon' || o.tx == null || o.ty == null) return false;
  const h = dungeonHome();
  return !!h && h[0] === o.tx && h[1] === o.ty;
}

/** 지을 수 있나: 발판 전부 땅 안 + 안 겹침 + 문 앞 칸 비어 있음(장식 제외) */
export function canPlace(o: { kind: Kind; tx: number | null; ty: number | null; fw: number; fh: number; flip?: boolean }, ignore?: Building): boolean {
  if (o.tx == null || o.ty == null) return false;
  // FEEDBACK23 §4: 던전을 숲속 원래 자리로 되돌리기 — 땅 밖이라 겹침만 본다
  if (outsideOk(o)) {
    for (let j = 0; j < o.fh; j++) for (let i = 0; i < o.fw; i++) { const g = grid[o.ty + j]?.[o.tx + i]; if (g && g !== ignore) return false; }
    return true;
  }
  for (let j = 0; j < o.fh; j++)
    for (let i = 0; i < o.fw; i++) {
      const x = o.tx + i;
      const y = o.ty + j;
      if (!inLand(x, y)) return false;
      const g = grid[y]?.[x];
      if (g && g !== ignore) return false;
      if (pondAt(x, y)) return false;
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
  // LAND2: 맵 가운데가 아니라 땅 가운데에서 가깝게
  const mid = (a + b) / 2;
  // 핫픽스 8: 큰 건물(장식 아님)은 가장자리·다른 건물에 붙여서 — 가운데부터 놓으면 땅이 조각나 나중 건물(대장간 3×3)이 들어갈 자리가 사라진다
  if (!def(pl.kind).deco && pl.fw * pl.fh >= 4) {
    let best: [number, number] | null = null;
    let bs = -1e9;
    for (let y = a; y < b; y++)
      for (let x = a; x < b; x++) {
        pl.tx = x;
        pl.ty = y;
        if (!canPlace(pl) || blocksDoor(pl)) continue;
        let touch = 0;
        for (let i = -1; i <= pl.fw; i++)
          for (const j of [-1, pl.fh]) touch += !inLand(x + i, y + j) || grid[y + j]?.[x + i] ? 1 : 0;
        for (let j = 0; j < pl.fh; j++) for (const i of [-1, pl.fw]) touch += !inLand(x + i, y + j) || grid[y + j]?.[x + i] ? 1 : 0;
        const sc = touch * 10 - (Math.abs(x + pl.fw / 2 - mid) + Math.abs(y + pl.fh / 2 - mid));
        if (sc > bs) [bs, best] = [sc, [x, y]];
      }
    if (best) {
      [pl.tx, pl.ty] = best;
      return;
    }
    pl.tx = pl.ty = null;
    return;
  }
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
  const lv = o.lvl + 1;
  const [nw, nh] = sizeFor(o.kind, lv);
  const sprite = spriteFor(o.kind, lv, o.flip);
  if (nw === o.fw && nh === o.fh) {
    // 발판 그대로 (그림만 바뀌거나 장식 단계)
    Object.assign(o, { lvl: lv, sprite });
    return true;
  }
  const nt = { kind: o.kind, tx: o.tx - (nw - o.fw), ty: o.ty - (nh - o.fh), fw: nw, fh: nh };
  if (!silent && (!canPlace(nt, o) || blocksDoor(nt, o))) return false;
  Object.assign(o, { tx: nt.tx, ty: nt.ty, fw: nt.fw, fh: nt.fh, sprite, lvl: lv });
  return true;
}

/** 지을 수 있는 목록 (고정·이미 있는 유일 건물 제외) */
export function buildableKinds(): Kind[] {
  return (Object.keys(CATALOG) as Kind[]).filter((k) => {
    const d = def(k);
    // DECO_DROP §1: 쇼케이스 장식 41종도 건설 목록에 (땅 단계·값은 CONFIG.deco) · §2 용 뼈 화석은 별의 심연 10(보스)을 깬 뒤
    // EASTER: 개척자 전용 장식은 편지로만
    if (d.pioneerDeco || d.levelDeco) return false;
    if (k === 'dragon_fossil' && (P.hunt.best.abyss ?? 0) < 10 && !world.objs.some((o) => o.kind === k)) return false;
    // 트로피는 그 보스를 처치했을 때만
    if (k.startsWith('trophy_') && !P.trophies.includes(k.slice(7))) return false;
    // 기념비는 손님·아이템·영웅 도감 중 하나를 100% 채웠을 때
    if (k === 'monument' && !monumentUnlocked()) return false;
    // HOTFIX14 §5: 선물 장식은 받은 게 있을 때만 (무료)
    if (k === 'thanks_basket') return (P.meta.giftDeco?.[k] ?? 0) > 0;
    // GROWTH §4: 물고기 박제는 박제해서 받은 게 있을 때만 (무료)
    if (k.startsWith('fish_')) return (P.meta.giftDeco?.[k] ?? 0) > 0;
    // HARVEST §1-5: 수확제 새 장식은 교환소·연감에서 받은 게 있을 때만 (무료)
    if (HV_NEW_DECO.includes(k)) return (P.meta.giftDeco?.[k] ?? 0) > 0;
    // HOTFIX14 §1: 한 채뿐인 건물(여관 본관·던전)과 unique 장식만 이미 있으면 못 지음 — 나머지는 여러 채 (두 번째부터 비용 ↑)
    return !d.fixed && !((d.unique || SINGLE(k)) && world.objs.some((o) => o.kind === k));
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
