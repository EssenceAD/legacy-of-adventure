// TOWN T2: 꾸미기 — 길 붓(재질 5) · 바닥(4 + 연못) · 자동 길 켜고 끄기 · 여러 장식 한 번에 옮기기 · 되돌리기 10단계
//  칠한 칸은 P.decor.paint["x,y"] = 코드 (내 마을만 · 저장에 함께). 연못은 걸을 수 없고 그 위엔 못 짓는다
import { def } from '../data/catalog';
import { patchTiles } from './ground';
import { N } from '../engine/iso';
import { markDirty, P, S, world, type Building } from './state';
import { canPlace, inLand, rebuildPaths, spriteFor } from './town';
import { track as trackEv } from '../net/telemetry';

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

// ───────── 되돌리기 (10단계 · 이번 접속 동안) ─────────

type Undo = { label: string; undo: () => void };
const undos: Undo[] = [];
export const UNDO_MAX = 10;
export const canUndo = () => undos.length > 0;
export const undoLabel = () => undos[undos.length - 1]?.label ?? '';
function pushUndo(u: Undo) {
  undos.push(u);
  while (undos.length > UNDO_MAX) undos.shift();
}
export function undo(): string | null {
  const u = undos.pop();
  if (!u) return null;
  u.undo();
  rebuildPaths();
  markDirty();
  return u.label;
}

// ───────── 칠하기 ─────────

const occupied = (x: number, y: number) => world.objs.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);
/** 이 칸을 칠할 수 있나 (null = 지우기). 연못은 건물·장식이 없는 칸에만 */
export function paintWhy(x: number, y: number, code: PaintCode | null): string | null {
  if (S.visiting) return '이웃 마을은 꾸밀 수 없어요';
  if (x < 0 || y < 0 || x >= N || y >= N || !inLand(x, y)) return '울타리 안에만 칠할 수 있어요';
  if (code === 'pond' && occupied(x, y)) return '건물·장식이 있는 칸엔 연못을 못 만들어요';
  return null;
}
/** 한 번의 붓질(누르고 떼기까지) = 되돌리기 한 단계 */
let stroke: { tiles: Map<string, string | undefined>; code: PaintCode | null } | null = null;
export function beginStroke(code: PaintCode | null) {
  stroke = { tiles: new Map(), code };
}
/** 칸 하나 칠하기 (붓질 중이면 한 단계로 묶는다) · 바뀌었으면 true */
export function paintTile(x: number, y: number, code: PaintCode | null): boolean {
  if (paintWhy(x, y, code)) return false;
  const k = `${x},${y}`;
  const prev = P.decor.paint[k];
  if ((prev ?? null) === code) return false;
  if (stroke && !stroke.tiles.has(k)) stroke.tiles.set(k, prev);
  if (code) P.decor.paint[k] = code;
  else delete P.decor.paint[k];
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
  if (!s || !s.tiles.size) return;
  rebuildPaths();
  markDirty();
  const tiles = s.tiles;
  pushUndo({
    label: s.code ? `${PAINT_NAME[s.code]} 칠하기` : '지우기',
    undo: () => {
      for (const [k, v] of tiles) {
        if (v) P.decor.paint[k] = v;
        else delete P.decor.paint[k];
      }
    },
  });
  trackEv('path_paint', { code: s.code ?? 'erase', n: tiles.size });
}

export function setAutoPath(on: boolean) {
  const prev = autoPathOn();
  P.decor.autoPath = on;
  pushUndo({ label: on ? '자동 길 켜기' : '자동 길 끄기', undo: () => (P.decor.autoPath = prev) });
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
  pushUndo({ label: `장식 ${group.length}개 옮기기`, undo: () => before.forEach(([o, x, y]) => ((o.tx = x), (o.ty = y))) });
  rebuildPaths();
  markDirty();
  trackEv('deco_move_group', { n: group.length });
  return null;
}
/** 하나씩 옮긴 것도 되돌리기에 (꾸미기 모드에서 옮기기 창을 쓸 때) */
export function noteMove(o: Building, tx: number, ty: number, flip: boolean | undefined) {
  pushUndo({ label: `${def(o.kind).name} 옮기기`, undo: () => ((o.tx = tx), (o.ty = ty), (o.flip = flip), (o.sprite = spriteFor(o.kind, o.lvl, flip))) });
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
};
/** 고른 장식 모두 좌우 반전 (발판이 정사각형이라 자리는 그대로) */
export function flipGroup(group: Building[]): string | null {
  if (!group.length) return '고른 장식이 없어요';
  const before = group.map((o) => [o, !!o.flip] as const);
  for (const o of group) {
    o.flip = !o.flip;
    o.sprite = spriteFor(o.kind, o.lvl, o.flip);
  }
  pushUndo({ label: `장식 ${group.length}개 반전`, undo: () => before.forEach(([o, f]) => ((o.flip = f), (o.sprite = spriteFor(o.kind, o.lvl, f)))) });
  markDirty();
  return null;
}
