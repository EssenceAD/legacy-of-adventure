// TOWN T2: 꾸미기 — 길 붓(재질 5) · 바닥(4 + 연못) · 자동 길 켜고 끄기 · 여러 장식 한 번에 옮기기 · 되돌리기 10단계
//  칠한 칸은 P.decor.paint["x,y"] = 코드 (내 마을만 · 저장에 함께). 연못은 걸을 수 없고 그 위엔 못 짓는다
import { def } from '../data/catalog';
import { track as trackGoal } from './progress';
import { patchTiles } from './ground';
import { N } from '../engine/iso';
import { markDirty, P, S, world, type Building } from './state';
import { blocksDoor, canPlace, entrance, grid, inLand, landBounds, pathT, rebuildPaths, spriteFor } from './town';
import { track as trackEv } from '../net/telemetry';
import { flag } from './flags';
import { outerRoad } from './grade';

export const PATH_MATS = ['stone', 'dirt', 'brick', 'deck', 'step'] as const;
export const GROUND_KINDS = ['flower', 'sand', 'gravel', 'pond'] as const;
export type PaintCode = (typeof PATH_MATS)[number] | (typeof GROUND_KINDS)[number];
export const PAINT_NAME: Record<PaintCode, string> = {
  stone: '돌길', dirt: '흙길', brick: '벽돌', deck: '나무 데크', step: '징검다리',
  flower: '꽃밭 바닥', sand: '모래', gravel: '자갈', pond: '얕은 연못',
};
export const isPathMat = (c: string | undefined): boolean => !!c && (PATH_MATS as readonly string[]).includes(c);

/** 이웃 마을 구경 중엔 내 칠을 쓰지 않는다 */
const paintMap = (): Record<string, string> => (S.visiting ? {} : P.decor.paint);
export const paintAt = (x: number, y: number): PaintCode | undefined => paintMap()[`${x},${y}`] as PaintCode | undefined;
export const isPond = (x: number, y: number) => paintAt(x, y) === 'pond';
export const autoPathOn = () => !!S.visiting || P.decor.autoPath !== false;
/** 칠한 길 칸 (길 찾기에서 빠르게 · 바닥 그림에서 그 재질로) */
export function paintedPaths(): [number, number][] {
  const out: [number, number][] = [];
  for (const [k, c] of Object.entries(paintMap())) if (isPathMat(c)) out.push(k.split(',').map(Number) as [number, number]);
  return out;
}

// ───────── 되돌리기 · 다시 하기 (BUILDUX §2-6: 20단계 · 이번 접속 동안 · 묶음 동작은 1단계) ─────────

export type Undo = { label: string; undo: () => void; redo: () => void };
const undos: Undo[] = [];
const redos: Undo[] = [];
export const UNDO_MAX = 20;
export const canUndo = () => undos.length > 0;
export const canRedo = () => redos.length > 0;
export const undoLabel = () => undos[undos.length - 1]?.label ?? '';
export const redoLabel = () => redos[redos.length - 1]?.label ?? '';
/** 새 동작을 되돌리기에 쌓는다 (다시 하기는 비운다) */
export function pushUndo(u: Undo) {
  undos.push(u);
  redos.length = 0;
  while (undos.length > UNDO_MAX) undos.shift();
}
export function undo(): string | null {
  const u = undos.pop();
  if (!u) return null;
  u.undo();
  redos.push(u);
  rebuildPaths();
  markDirty();
  trackEv('edit_undo', { what: u.label.slice(0, 20) });
  return u.label;
}
export function redo(): string | null {
  const u = redos.pop();
  if (!u) return null;
  u.redo();
  undos.push(u);
  rebuildPaths();
  markDirty();
  trackEv('edit_redo', { what: u.label.slice(0, 20) });
  return u.label;
}

// ───────── 칠하기 ─────────

const occupied = (x: number, y: number) => world.objs.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);
/** 이 칸을 칠할 수 있나 (null = 지우기). 연못은 건물·장식이 없는 칸에만 */
/** BUILDUX §7: 자동으로 깔린 길 칸 (칠한 길 아님) */
export const isAutoPath = (x: number, y: number) => (x >= 0 && y >= 0 && x < N && y < N && pathT.has(y * N + x) && !isPathMat(paintAt(x, y))) || (flag('autoPathStrict') && !S.visiting && outerRoad().some(([a, b]) => a === x && b === y));
export function paintWhy(x: number, y: number, code: PaintCode | null): string | null {
  if (S.visiting) return '이웃 마을은 꾸밀 수 없어요';
  // 지우개는 울타리 밖 자동 길(의뢰·던전 가는 길)도 지울 수 있다
  if (code === null && isAutoPath(x, y)) return null;
  if (x < 0 || y < 0 || x >= N || y >= N || !inLand(x, y)) return '울타리 안에만 칠할 수 있어요';
  if (code === 'pond' && occupied(x, y)) return '건물·장식이 있는 칸엔 연못을 못 만들어요';
  return null;
}
/** 한 번의 붓질(누르고 떼기까지) = 되돌리기 한 단계 */
let stroke: { tiles: Map<string, string | undefined>; no: Map<string, boolean>; code: PaintCode | null; label?: string } | null = null;
export function beginStroke(code: PaintCode | null, label?: string) {
  stroke = { tiles: new Map(), no: new Map(), code, label };
}
/** BUILDUX §7: 「여기엔 자동 길을 깔지 마」 표시 바꾸기 (붓질 중이면 되돌리기에 묶는다) */
function setNo(k: string, on: boolean) {
  const no = (P.decor.noPath ??= {});
  if (!!no[k] === on) return false;
  if (stroke && !stroke.no.has(k)) stroke.no.set(k, !!no[k]);
  if (on) no[k] = 1;
  else delete no[k];
  return true;
}
/** 칸 하나 칠하기 (붓질 중이면 한 단계로 묶는다) · 바뀌었으면 true */
export function paintTile(x: number, y: number, code: PaintCode | null): boolean {
  if (paintWhy(x, y, code)) return false;
  const k = `${x},${y}`;
  const prev = P.decor.paint[k];
  // BUILDUX §7: 자동 길 칸을 지우면 기억해 두고 다시 깔지 않는다 · 길을 칠하면 그 기억은 지운다
  if (code === null && !prev && isAutoPath(x, y)) {
    setNo(k, true);
    pathT.delete(y * N + x);
    if (stroke) patchTiles([[x, y]]);
    else {
      rebuildPaths();
      markDirty();
    }
    return true;
  }
  if (code && isPathMat(code)) setNo(k, false);
  if ((prev ?? null) === code) return false;
  if (stroke && !stroke.tiles.has(k)) stroke.tiles.set(k, prev);
  if (code) P.decor.paint[k] = code;
  else delete P.decor.paint[k];
  // BUILDUX §3-3: 지우거나 재질을 바꾸면 둥근 모서리도 풀린다
  if (P.decor.round?.[k] && (!code || !isPathMat(code))) delete P.decor.round[k];
  // HOTFIX19 §1: 붓질 중엔 그 칸(+둘레)만 덧그리고, 길 다시 계산·저장은 손을 뗀 뒤 한 번
  if (stroke) patchTiles([[x, y]]);
  else {
    rebuildPaths();
    markDirty();
  }
  return true;
}
export function endStroke() {
  const s = stroke;
  stroke = null;
  if (!s || (!s.tiles.size && !s.no.size)) return;
  rebuildPaths();
  markDirty();
  const tiles = s.tiles;
  const noB = s.no;
  const noA = new Map([...noB.keys()].map((k) => [k, !!P.decor.noPath?.[k]] as const));
  const putNo = (m: Map<string, boolean>) => {
    const no = (P.decor.noPath ??= {});
    for (const [k, v] of m) {
      if (v) no[k] = 1;
      else delete no[k];
    }
  };
  const after = new Map([...tiles.keys()].map((k) => [k, P.decor.paint[k]] as const));
  const put = (m: Map<string, string | undefined>) => {
    for (const [k, v] of m) {
      if (v) P.decor.paint[k] = v;
      else delete P.decor.paint[k];
    }
  };
  pushUndo({ label: s.label ?? (s.code ? `${PAINT_NAME[s.code]} 칠하기` : '지우기'), undo: () => (put(tiles), putNo(noB)), redo: () => (put(after), putNo(noA)) });
  trackEv('path_paint', { code: s.code ?? 'erase', n: tiles.size, auto: noB.size });
  // DECO_DROP §3: 오늘의 목표 「길 10칸 칠하기」
  if (s.code && isPathMat(s.code)) trackGoal('pathPaint', [...tiles.keys()].filter((k) => P.decor.paint[k] === s.code).length);
  trackEv('edit_action', { tool: s.label ? 'fill' : s.code ? (isPathMat(s.code) ? 'path' : 'ground') : 'erase', n: tiles.size + noB.size });
}

export function setAutoPath(on: boolean) {
  const prev = autoPathOn();
  P.decor.autoPath = on;
  pushUndo({ label: on ? '자동 길 켜기' : '자동 길 끄기', undo: () => (P.decor.autoPath = prev), redo: () => (P.decor.autoPath = on) });
  rebuildPaths();
  markDirty();
}

// ───────── 여러 장식 한 번에 옮기기 ─────────

/** 범위 안의 장식 (발판이 범위에 걸치면) — 건물은 문·손님이 있어 하나씩 옮긴다 */
export function decosIn(x0: number, y0: number, x1: number, y1: number): Building[] {
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
  const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
  return world.objs.filter((o) => def(o.kind).deco && !def(o.kind).fixed && o.tx <= bx && o.tx + o.fw - 1 >= ax && o.ty <= by && o.ty + o.fh - 1 >= ay);
}
/** 무리를 (dx,dy)만큼 옮길 수 있나 — 무리끼리는 서로 비켜 준다 */
export function groupWhy(group: Building[], dx: number, dy: number): string | null {
  if (!group.length) return '고른 장식이 없어요';
  const save = group.map((o) => [o.tx, o.ty] as const);
  // 잠깐 빼고 검사 (자기들끼리 겹침은 괜찮게)
  const rest = world.objs.filter((o) => !group.includes(o));
  const all = world.objs;
  world.objs = rest;
  rebuildPaths();
  let why: string | null = null;
  for (const o of group) {
    const t = { kind: o.kind, tx: o.tx + dx, ty: o.ty + dy, fw: o.fw, fh: o.fh, flip: o.flip };
    if (!canPlace(t)) why = '여기엔 못 놓아요 (울타리 밖이거나 다른 건물과 겹쳐요)';
    else for (let j = 0; j < o.fh && !why; j++) for (let i = 0; i < o.fw && !why; i++) if (isPond(t.tx + i, t.ty + j)) why = '연못 위엔 못 놓아요';
    if (why) break;
  }
  // 무리끼리 서로 겹치지 않게 (옮겨도 모양은 그대로라 겹칠 일은 없다)
  world.objs = all;
  group.forEach((o, i) => ([o.tx, o.ty] = save[i]));
  rebuildPaths();
  return why;
}
export function moveGroup(group: Building[], dx: number, dy: number): string | null {
  const why = groupWhy(group, dx, dy);
  if (why) return why;
  const before = group.map((o) => [o, o.tx, o.ty] as const);
  for (const o of group) {
    o.tx += dx;
    o.ty += dy;
  }
  pushUndo({
    label: `장식 ${group.length}개 옮기기`,
    undo: () => before.forEach(([o, x, y]) => ((o.tx = x), (o.ty = y))),
    redo: () => before.forEach(([o, x, y]) => ((o.tx = x + dx), (o.ty = y + dy))),
  });
  rebuildPaths();
  markDirty();
  trackEv('deco_move_group', { n: group.length });
  trackEv('edit_action', { tool: 'move_group', n: group.length });
  return null;
}
/** 하나씩 옮긴 것도 되돌리기에 (꾸미기 모드에서 옮기기 창을 쓸 때) */
export function noteMove(o: Building, tx: number, ty: number, flip: boolean | undefined) {
  const [nx, ny, nf] = [o.tx, o.ty, o.flip];
  const set = (x: number, y: number, f: boolean | undefined) => ((o.tx = x), (o.ty = y), (o.flip = f), (o.sprite = spriteFor(o.kind, o.lvl, f)));
  pushUndo({ label: `${def(o.kind).name} 옮기기`, undo: () => set(tx, ty, flip), redo: () => set(nx, ny, nf) });
  trackEv('edit_action', { tool: 'move', n: 1 });
}

// ───────── FEEDBACK23 §5: 마을 입구 옮기기 (울타리 앞 가장자리를 따라 좌우로) ─────────

/** 지금 입구 칸을 덮고 있는 정문 (없으면 undefined) */
export function gateOnEntrance(): Building | undefined {
  const [ex, ey] = entrance();
  return world.objs.find((o) => o.kind === 'gate' && ex >= o.tx && ex < o.tx + o.fw && ey >= o.ty && ey < o.ty + o.fh);
}
/** 입구를 x로 옮길 수 없는 까닭 (되면 null) — 정문이 있으면 같이 옆으로 따라가야 한다 */
export function entranceWhy(x: number | null): string | null {
  if (S.visiting) return '이웃 마을은 꾸밀 수 없어요';
  const [a, b] = landBounds();
  const y = b - 1;
  if (x == null || !Number.isInteger(x) || x < a || x >= b) return '입구는 울타리 앞쪽 가장자리에만 놓아요';
  const gate = gateOnEntrance();
  const g = grid[y]?.[x];
  if (g && g !== gate) return '건물·장식이 있는 칸엔 입구를 못 놓아요';
  if (isPond(x, y)) return '연못 위엔 입구를 못 놓아요';
  if (gate) {
    const t = { kind: gate.kind, tx: gate.tx + x - entrance()[0], ty: gate.ty, fw: gate.fw, fh: gate.fh };
    // 정문 규칙(canPlace의 gateOk)은 「지금 입구 위」를 보므로 쓰지 않는다 — 같은 만큼 밀리니 새 입구 칸은 저절로 덮인다
    if (!canPlaceIgnoringGateRule(t, gate)) return '정문이 따라갈 자리가 없어요 (정문 옆을 비워 주세요)';
  }
  return null;
}
/** 정문 규칙(입구 위)만 빼고 놓을 수 있나 — 입구를 옮기는 중엔 새 입구 기준이라 */
function canPlaceIgnoringGateRule(t: { kind: Building['kind']; tx: number; ty: number; fw: number; fh: number }, gate: Building): boolean {
  for (let j = 0; j < t.fh; j++)
    for (let i = 0; i < t.fw; i++) {
      const x = t.tx + i;
      const y = t.ty + j;
      if (!inLand(x, y) || isPond(x, y)) return false;
      const g = grid[y]?.[x];
      if (g && g !== gate) return false;
    }
  return !blocksDoor(t, gate);
}
/** 입구를 x로 옮긴다 (정문도 같이) · 되돌리기 한 단계 · 안 되면 까닭 */
export function moveEntrance(x: number): string | null {
  const why = entranceWhy(x);
  if (why) return why;
  const prev = P.decor.entX ?? null;
  const gate = gateOnEntrance();
  const g0 = gate?.tx ?? 0;
  const g1 = gate ? gate.tx + x - entrance()[0] : 0;
  const set = (v: number | null, gx: number) => {
    P.decor.entX = v;
    if (gate) gate.tx = gx;
  };
  set(x, g1);
  pushUndo({ label: '마을 입구 옮기기', undo: () => set(prev, g0), redo: () => set(x, g1) });
  rebuildPaths();
  markDirty();
  trackEv('edit_action', { tool: 'entrance', n: 1 });
  return null;
}

/** FEEDBACK23 §4: 던전을 처음 옮길 때 숲속 원래 자리를 기억 (나중에 그 자리로 되돌릴 수 있게) */
export function rememberDungeonHome(o: Building) {
  if (o.kind !== 'dungeon' || P.decor.dgHome || S.visiting) return;
  if (inLand(o.tx, o.ty) && inLand(o.tx + o.fw - 1, o.ty + o.fh - 1)) return;
  P.decor.dgHome = [o.tx, o.ty];
}

// ───────── 꾸미기 모드 화면 상태 (render가 읽는다) ─────────
export const decorView = {
  on: false,
  /** 격자 + 발판 보기 */
  grid: true,
  /** 붓이 닿은 칸 · 고른 범위 · 고른 장식 · 옮기는 중인 무리 */
  hover: null as null | [number, number],
  sel: null as null | { x0: number; y0: number; x1: number; y1: number },
  picked: [] as Building[],
  ghost: null as null | { dx: number; dy: number; ok: boolean },
  /** HOTFIX19 §2: 붓·바닥·지우개를 들면 건물·장식·나무를 반투명으로 (토글 · 기본 켬) */
  fade: false,
  fadeOn: true,
  /** BUILDUX §3-2: 직선 길 미리보기 칸 */
  preview: [] as [number, number][],
  previewOk: true,
};
/** 고른 장식 모두 좌우 반전 (발판이 정사각형이라 자리는 그대로) */
export function flipGroup(group: Building[]): string | null {
  if (!group.length) return '고른 장식이 없어요';
  const before = group.map((o) => [o, !!o.flip] as const);
  for (const o of group) {
    o.flip = !o.flip;
    o.sprite = spriteFor(o.kind, o.lvl, o.flip);
  }
  const setF = (o: Building, f: boolean) => ((o.flip = f), (o.sprite = spriteFor(o.kind, o.lvl, f)));
  pushUndo({ label: `장식 ${group.length}개 반전`, undo: () => before.forEach(([o, f]) => setF(o, f)), redo: () => before.forEach(([o, f]) => setF(o, !f)) });
  trackEv('edit_action', { tool: 'flip', n: group.length });
  markDirty();
  return null;
}

// ───────── BUILDUX §3: 직선 길 · 모서리 둥글게 · 채우기 ─────────

/** 시작 → 끝을 ㄱ자로 (가로 먼저, 그다음 세로) */
export function elbowTiles(a: [number, number], b: [number, number]): [number, number][] {
  const out: [number, number][] = [];
  const sx = Math.sign(b[0] - a[0]);
  const sy = Math.sign(b[1] - a[1]);
  for (let x = a[0]; ; x += sx) {
    out.push([x, a[1]]);
    if (x === b[0] || !sx) break;
  }
  if (sy) for (let y = a[1] + sy; ; y += sy) {
    out.push([b[0], y]);
    if (y === b[1]) break;
  }
  return out.slice(0, 200);
}
/** 여러 칸을 한 번에 (되돌리기 1단계) · 칠한 칸 수 */
export function paintMany(tiles: [number, number][], code: PaintCode | null, label?: string): number {
  beginStroke(code, label);
  let n = 0;
  for (const [x, y] of tiles) if (paintTile(x, y, code)) n++;
  endStroke();
  return n;
}
/** 닫힌 영역 채우기: 누른 칸과 같은 바닥(또는 빈 풀밭)으로 이어진 칸 — 건물·울타리·다른 칠에서 멈춘다 */
export const FILL_MAX = 400;
export function fillTiles(x0: number, y0: number): [number, number][] | null {
  if (!inLand(x0, y0) || occupied(x0, y0)) return [];
  const want = paintAt(x0, y0) ?? null;
  const seen = new Set<string>([`${x0},${y0}`]);
  const out: [number, number][] = [];
  const q: [number, number][] = [[x0, y0]];
  while (q.length) {
    const [x, y] = q.shift()!;
    out.push([x, y]);
    if (out.length > FILL_MAX) return null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (!inLand(nx, ny) || occupied(nx, ny) || (paintAt(nx, ny) ?? null) !== want) continue;
      q.push([nx, ny]);
    }
  }
  return out;
}
/** 같은 길 칸을 한 번 더 누르면: 모서리 둥글게 → 한 번 더 = 지우기 (동물의 숲) · 무엇을 했는지 */
export function tapCycle(x: number, y: number): 'round' | 'erase' | null {
  const k = `${x},${y}`;
  const code = P.decor.paint[k] as PaintCode | undefined;
  if (!code || !isPathMat(code)) return null;
  const round = (P.decor.round ??= {});
  if (!round[k]) {
    round[k] = 1;
    pushUndo({ label: '모서리 둥글게', undo: () => delete (P.decor.round ??= {})[k], redo: () => ((P.decor.round ??= {})[k] = 1) });
    rebuildPaths();
    markDirty();
    trackEv('edit_action', { tool: 'round', n: 1 });
    return 'round';
  }
  beginStroke(null, '길 지우기');
  paintTile(x, y, null);
  endStroke();
  return 'erase';
}
