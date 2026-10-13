// v0.24.2: 여관·주점 레벨 장식을 진짜 장식으로 (플래그 innDecoObj)
//  예전: render.ts levelDeco가 화분(여관 Lv.6) · 석등(여관 Lv.9) · 술통(주점 Lv.5)을 타일 없이 덧그림 → 유저 장식과 겹치고 탭을 가림
//  지금: 그 레벨이 되면 문 근처 빈 칸에 진짜 장식으로 놓는다 (옮기기·넣어 두기 됨 · 팔기 없음 · 값 0)
//  · 자리가 없으면 보관함(P.decor.store)에 + 토스트
//  · 옛 저장: 처음 불러올 때 지금 레벨만큼 한 번 (P.meta.lvlDeco 에 기록 → 두 번 안 줌) · 제자리가 막혀 있으면 보관함
import { def, type Kind } from '../data/catalog';
import { isPathMat } from './decor';
import { flag } from './flags';
import { addObj, blocksDoor, canPlace, doorOf, findKind, inLand, pathT, paintOf, rebuildPaths, sizeFor } from './town';
import { markDirty, P, S, world, type Building } from './state';
import { N } from '../engine/iso';

export interface LvlGrant {
  id: string;
  of: 'inn' | 'tavern';
  lvl: number;
  kind: Kind;
  /** 놓을 자리 (건물 앞 줄 기준: u = 앞면을 따라 · v = 바깥으로) */
  spots: (o: Building) => [number, number][];
  noun: string;
}

/** 앞면 길이 · 문 자리 (반전이면 x/y가 바뀐다) */
const front = (o: Building) => (o.flip ? { len: o.fh, depth: o.fw, du: Math.floor(o.fh / 2) } : { len: o.fw, depth: o.fh, du: Math.floor(o.fw / 2) });
/** (u, v) → 타일 (v = 1 이 문 앞 줄) */
export function spotOf(o: Building, u: number, v: number): [number, number] {
  return o.flip ? [o.tx + o.fw - 1 + v, o.ty + u] : [o.tx + u, o.ty + o.fh - 1 + v];
}

export const LVL_GRANTS: LvlGrant[] = [
  // 화분 ×2: 앞쪽 두 모서리
  { id: 'inn6', of: 'inn', lvl: 6, kind: 'lvl_pot' as Kind, noun: '화분', spots: (o) => [spotOf(o, 0, 1), spotOf(o, front(o).len - 1, 1)] },
  // 석등 ×2: 문 양옆
  { id: 'inn9', of: 'inn', lvl: 9, kind: 'lvl_stone_lantern' as Kind, noun: '석등', spots: (o) => [spotOf(o, front(o).du - 1, 1), spotOf(o, front(o).du + 1, 1)] },
  // 술통 ×1: 오른쪽 옆면 가운데
  { id: 'tavern5', of: 'tavern', lvl: 5, kind: 'lvl_barrels' as Kind, noun: '술통', spots: (o) => [spotOf(o, front(o).len, 1 - Math.ceil(front(o).depth / 2))] },
];

export const lvlDecoHooks = { stored: (_msg: string) => {}, placed: (_o: Building) => {} };

/** 장식을 놓아도 되는 칸: 땅 안 · 빈 칸 · 남의 문 앞 아님 · 길(자동 길 · 칠한 길) 아님 */
function free(kind: Kind, x: number, y: number): boolean {
  const [fw, fh] = sizeFor(kind, 1);
  const t = { kind, tx: x, ty: y, fw, fh };
  if (!inLand(x, y) || !canPlace(t) || blocksDoor(t)) return false;
  if (pathT.has(y * N + x) || isPathMat(paintOf(x, y))) return false;
  return true;
}

/** 문 근처 빈 칸 (가까운 순 · 반경 3) */
function nearDoor(o: Building, kind: Kind): [number, number] | null {
  const [dx, dy] = doorOf(o);
  let best: [number, number] | null = null;
  let bd = 1e9;
  for (let r = 1; r <= 3; r++) {
    for (let y = dy - r; y <= dy + r; y++)
      for (let x = dx - r; x <= dx + r; x++) {
        if (Math.max(Math.abs(x - dx), Math.abs(y - dy)) !== r) continue;
        if (!free(kind, x, y)) continue;
        const d = Math.hypot(x - dx, y - dy);
        if (d < bd) (bd = d), (best = [x, y]);
      }
    if (best) return best;
  }
  return null;
}

const given = () => (P.meta.lvlDeco ??= {});

/**
 * 지금 레벨만큼 아직 안 준 레벨 장식을 준다.
 *  onLoad = true: 옛 저장(처음 한 번) — 정해진 제자리만 보고, 막혀 있으면 보관함
 *  onLoad = false: 방금 레벨업 — 제자리 → 문 근처 빈 칸 → 보관함
 *  → 놓은/넣은 개수
 */
export function grantLevelDeco(onLoad: boolean): { placed: number; stored: number } {
  const out = { placed: 0, stored: 0 };
  if (!flag('innDecoObj') || S.visiting) return out;
  const g = given();
  for (const gr of LVL_GRANTS) {
    if (g[gr.id]) continue;
    const o = findKind(gr.of);
    if (!o || o.lvl < gr.lvl) continue;
    g[gr.id] = Date.now();
    let storedHere = 0;
    for (const sp of gr.spots(o)) {
      let at: [number, number] | null = free(gr.kind, sp[0], sp[1]) ? sp : null;
      if (!at && !onLoad) at = nearDoor(o, gr.kind);
      if (at) {
        const b = addObj(gr.kind, at[0], at[1], { fromProp: true, builtAt: Date.now() });
        rebuildPaths();
        out.placed++;
        lvlDecoHooks.placed(b);
      } else {
        (P.decor.store ??= []).push({ kind: gr.kind, lvl: 1, hue: null, flip: false, fromProp: true });
        out.stored++;
        storedHere++;
      }
    }
    if (storedHere) lvlDecoHooks.stored(`${gr.of === 'inn' ? '여관' : '주점'} 앞이 꽉 차서 ${gr.noun}${josaEul(gr.noun)} 보관함에 넣어 뒀어요`);
  }
  if (out.placed || out.stored) markDirty();
  return out;
}
const josaEul = (w: string) => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? '을' : '를');

/** 레벨 장식인가 (팔기 없음) */
export const isLevelDeco = (k: string) => !!(def(k as Kind) as { levelDeco?: boolean } | undefined)?.levelDeco;
/** 덧그리기 끄기: 장식이 진짜 물건이 됐으면 render.ts는 화분·석등·술통을 그리지 않는다 */
export const decoAsObjects = () => flag('innDecoObj');
/** 시험용 */
export const _lvlWorld = () => world;
