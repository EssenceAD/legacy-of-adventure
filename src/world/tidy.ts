// 핫픽스 8: 자리 정리 도우미 — 고른 건물을 놓을 빈자리가 마을 어디에도 없을 때
//  1칸짜리 장식(벤치·꽃밭·가로등 등 · 건물은 빼고)을 가장자리 빈칸으로 옮겨 자리를 만든다.
//  먼저 계산만 해 보고(원래 자리로 되돌림) → 깨지는 어울림 수를 알려 준 뒤 → [정리하기]를 누르면 그대로 옮긴다.
import { def, type Kind } from '../data/catalog';
import { computeSets } from './harmony';
import { blocksDoor, canPlace, entrance, inLand, landBounds, pathT, rebuildPaths, suggestSpot, type Placement } from './town';
import { markDirty, world, type Building } from './state';
import { N } from '../engine/iso';

export interface TidyPlan {
  /** 옮길 장식과 새 자리 */
  moves: { o: Building; tx: number; ty: number }[];
  /** 정리하면 생기는 자리 (없으면 땅을 넓혀야 함) */
  spot: [number, number] | null;
  /** 풀리는 어울림 수 */
  broken: number;
}

const ghost = (kind: Kind): Placement => {
  const d = def(kind);
  return { kind, sprite: d.sprite, fw: d.size[0], fh: d.size[1], tx: null, ty: null, ok: false };
};
/** 지금 땅에 이 건물이 들어갈 자리가 있나 */
export function hasSpot(kind: Kind): boolean {
  const pl = ghost(kind);
  suggestSpot(pl);
  return pl.tx != null;
}

/** 옮길 수 있는 장식: 1칸 · 장식 · 정문/게시판 아님 */
const movable = (o: Building) => def(o.kind).deco && o.fw === 1 && o.fh === 1 && o.kind !== 'gate' && o.kind !== 'board' && o.build === undefined;

function setCount(objs: Building[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const s of computeSets(objs)) m.set(s.id, (m.get(s.id) ?? 0) + 1);
  return m;
}

/** 정리 계획 (계산만 하고 원래대로 되돌린다) */
export function planTidy(kind: Kind): TidyPlan {
  const [a, b] = landBounds();
  const mid = (a + b) / 2;
  const [ex] = entrance();
  const before = setCount(world.objs);
  const orig = new Map<Building, [number, number]>();
  // 가운데에 가까운 장식부터
  const decos = world.objs.filter(movable).sort((p, q) => Math.hypot(p.tx - mid, p.ty - mid) - Math.hypot(q.tx - mid, q.ty - mid));
  const moves: TidyPlan['moves'] = [];
  let spot: [number, number] | null = null;
  const edgeCells = () => {
    const out: [number, number][] = [];
    for (let y = a; y < b; y++)
      for (let x = a; x < b; x++) {
        const ring = Math.min(x - a, y - a, b - 1 - x, b - 1 - y);
        if (ring > 0) continue;
        // 입구 앞 · 흙길 · 남의 문 앞은 비운다
        if (y === b - 1 && Math.abs(x - ex) <= 1) continue;
        if (pathT.has(y * N + x)) continue;
        const t = { kind: 'bench' as Kind, tx: x, ty: y, fw: 1, fh: 1 };
        if (!canPlace(t) || blocksDoor(t)) continue;
        out.push([x, y]);
      }
    // 가운데에서 먼 칸부터 (모서리 먼저)
    return out.sort((p, q) => Math.hypot(q[0] - mid, q[1] - mid) - Math.hypot(p[0] - mid, p[1] - mid));
  };
  try {
    for (const o of decos) {
      if (hasSpot(kind)) break;
      // 이미 가장자리에 있는 장식은 그대로
      if (Math.min(o.tx - a, o.ty - a, b - 1 - o.tx, b - 1 - o.ty) === 0) continue;
      const cell = edgeCells()[0];
      if (!cell) break;
      orig.set(o, [o.tx, o.ty]);
      o.tx = cell[0];
      o.ty = cell[1];
      moves.push({ o, tx: cell[0], ty: cell[1] });
      rebuildPaths();
    }
    const pl = ghost(kind);
    suggestSpot(pl);
    spot = pl.tx != null ? [pl.tx, pl.ty!] : null;
    // 풀리는 어울림: 정리 전보다 줄어든 세트 수
    const after = setCount(world.objs);
    let broken = 0;
    for (const [id, n] of before) broken += Math.max(0, n - (after.get(id) ?? 0));
    return { moves: spot ? moves : [], spot, broken: spot ? broken : 0 };
  } finally {
    for (const [o, [x, y]] of orig) {
      o.tx = x;
      o.ty = y;
    }
    rebuildPaths();
  }
}

/** [정리하기]: 계획대로 옮긴다 */
export function applyTidy(plan: TidyPlan) {
  for (const m of plan.moves) {
    m.o.tx = m.tx;
    m.o.ty = m.ty;
    m.o.pop = 1;
  }
  rebuildPaths();
  markDirty();
}

/** 이 땅 단계에 그 크기 건물이 (아무것도 없을 때) 들어가나 — 테스트·장부 순서 확인용 */
export const fitsEmpty = (kind: Kind, land: number) => {
  const [a, b] = landBounds(land);
  const [w, h] = def(kind).size;
  return b - a >= w && b - a >= h + 1;
};
void inLand;
