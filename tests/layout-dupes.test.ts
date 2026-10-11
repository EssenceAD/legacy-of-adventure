// HOTFIX14 §1: 같은 건물 여러 채(온천 2채 · 대장간 2채)는 그대로 살리고, 자리 없는 건물도 조용히 버리지 않는다
import { beforeEach, describe, expect, it } from 'vitest';
import { def } from '../src/data/catalog';
import { bestOf, buildableKinds, buildCost, placeLayout, type LayoutEntry } from '../src/world/town';
import { S, world } from '../src/world/state';

const E = (kind: string, tx: number, ty: number, lvl = 1, extra: LayoutEntry['extra'] = {}, flip = false): LayoutEntry => ({ kind: kind as never, tx, ty, lvl, hue: null, flip, extra });
/** 롯데캐슬 여관 (땅 5) 주요 건물 — 실제 저장 그대로 */
const lotte = (bathFirst: 'lv5' | 'lv1') => {
  const b5 = E('bath', 0, 16, 5, {}, true);
  const b1 = E('bath', 0, 19, 1, { con: { kind: 'new', end: Date.now() + 80000, total: 80, to: 1, cut: 0, cost: 0 }, build: 1 }, true);
  return [
    E('inn', 0, 0, 10), E('tavern', 0, 10, 6, {}, true), ...(bathFirst === 'lv5' ? [b5, b1] : [b1, b5]),
    E('cottage', 8, 0), E('cottage', 0, 6), E('cottage', 16, 0), E('cottage', 11, 7), E('cottage', 14, 7), E('cottage', 17, 7),
    E('fire', 0, 14), E('fire', 14, 20), E('training', 12, 0), E('smith', 19, 0), E('garden', 7, 18), E('dungeon', 19, 10),
  ];
};
beforeEach(() => {
  S.visiting = false as never;
  S.land = 5;
});

describe('같은 건물 여러 채 (막지 말고 허용)', () => {
  for (const order of ['lv5', 'lv1'] as const)
    it(`롯데캐슬 (저장 순서 ${order} 먼저): 온천 2채 모두 남음 · 공사 중인 온천도 그대로`, () => {
      const r = placeLayout(lotte(order), 5);
      const baths = world.objs.filter((o) => o.kind === 'bath');
      expect(baths.map((o) => o.lvl).sort()).toEqual([1, 5]);
      expect(baths.find((o) => o.lvl === 1)!.con?.kind).toBe('new');
      expect(r.removed).toEqual([]);
      for (const k of ['inn', 'tavern', 'training', 'smith', 'garden', 'dungeon']) expect(world.objs.filter((o) => o.kind === k).length).toBe(1);
      expect(world.objs.filter((o) => o.kind === 'cottage').length).toBe(6);
    });
  it('대장간 2채: 둘 다 남고 「마을 전체 효과」는 높은 레벨 한 채 기준', () => {
    placeLayout([E('inn', 10, 10, 1), E('smith', 2, 2, 1), E('smith', 2, 8, 3)], 5);
    expect(world.objs.filter((o) => o.kind === 'smith').map((o) => o.lvl).sort()).toEqual([1, 3]);
    expect(bestOf('smith')!.lvl).toBe(3);
  });
  it('불러온 뒤 다시 불러와도 그대로', () => {
    placeLayout(lotte('lv1'), 5);
    const again = world.objs.map((o) => E(o.kind, o.tx, o.ty, o.lvl, { ...(o.con ? { con: o.con } : {}) }, !!o.flip));
    const n = world.objs.length;
    const r = placeLayout(again, 5);
    expect(r.removed.length).toBe(0);
    expect(world.objs.length).toBe(n);
    expect(world.objs.filter((o) => o.kind === 'bath').length).toBe(2);
  });
  it('여관 본관·던전만 한 채: 중복이면 레벨 높은 쪽만 · 나머지는 환불 목록', () => {
    const r = placeLayout([E('inn', 10, 10, 3), E('inn', 2, 2, 1), E('dungeon', 19, 10), E('dungeon', 19, 15)], 5);
    expect(world.objs.filter((o) => o.kind === 'inn').map((o) => o.lvl)).toEqual([3]);
    expect(world.objs.filter((o) => o.kind === 'dungeon').length).toBe(1);
    expect(r.removed.map((x) => x.e.kind).sort()).toEqual(['dungeon', 'inn']);
  });
  it('짓기 목록: 온천·대장간은 있어도 또 지을 수 있고 두 번째부터 ×1.5 · 여관 본관은 안 됨', () => {
    placeLayout(lotte('lv5'), 5);
    const b = buildableKinds();
    for (const k of ['bath', 'smith', 'tavern', 'training', 'garden', 'cottage']) expect(b).toContain(k);
    expect(b).not.toContain('inn');
    expect(buildCost('bath')).toBe(Math.round(def('bath').cost * 1.5));
    expect(buildCost('flowerbed')).toBe(def('flowerbed').cost);
  });
});

describe('자리 없는 건물', () => {
  it('꽉 찬 작은 땅에 3×3 여러 채: 버리지 않고 removed 로 (부르는 쪽이 환불)', () => {
    const r = placeLayout([E('inn', 0, 0, 1), E('tavern', 0, 0), E('smith', 0, 0), E('bath', 0, 0), E('training', 0, 0), E('garden', 0, 0)], 1);
    const placed = world.objs.length;
    expect(placed + r.removed.length).toBe(6);
    expect(r.removed.every((x) => x.why === 'nospace')).toBe(true);
  });
  it('장식은 마지막: 장식이 건물 자리를 빼앗지 않음', () => {
    const decos = Array.from({ length: 30 }, (_, i) => E('flowerbed', 4 + (i % 6), 4 + Math.floor(i / 6)));
    const r = placeLayout([...decos, E('inn', 4, 4, 1), E('tavern', 5, 5)], 3);
    expect(world.objs.some((o) => o.kind === 'tavern')).toBe(true);
    expect(r.removed.every((x) => x.e.kind === 'flowerbed')).toBe(true);
  });
});
