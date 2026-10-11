// HOTFIX14 §1: 하나뿐인 건물 중복(온천 2채 · 대장간 2채)과 자리 없는 건물 — 조용히 버리지 않는다
import { beforeEach, describe, expect, it } from 'vitest';
import { buildableKinds, placeLayout, type LayoutEntry } from '../src/world/town';
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

describe('하나뿐인 건물 중복', () => {
  for (const order of ['lv5', 'lv1'] as const)
    it(`롯데캐슬 (저장 순서 ${order} 먼저): 온천 1채 · Lv5가 남고 Lv1(공사 중)은 환불 목록`, () => {
      const r = placeLayout(lotte(order), 5);
      const baths = world.objs.filter((o) => o.kind === 'bath');
      expect(baths.length).toBe(1);
      expect(baths[0].lvl).toBe(5);
      expect(r.removed.map((x) => [x.e.kind, x.e.lvl, x.why])).toEqual([['bath', 1, 'dupe']]);
      // 다른 건물은 하나도 안 사라짐
      for (const k of ['inn', 'tavern', 'training', 'smith', 'garden', 'dungeon']) expect(world.objs.filter((o) => o.kind === k).length).toBe(1);
      expect(world.objs.filter((o) => o.kind === 'cottage').length).toBe(6);
    });
  it('대장간 2채: 레벨 높은 쪽 · 같으면 먼저 지은 쪽', () => {
    let r = placeLayout([E('inn', 10, 10, 1), E('smith', 2, 2, 1, { builtAt: 5 }), E('smith', 2, 8, 3, { builtAt: 9 })], 5);
    expect(world.objs.filter((o) => o.kind === 'smith').map((o) => o.lvl)).toEqual([3]);
    expect(r.removed.length).toBe(1);
    r = placeLayout([E('inn', 10, 10, 1), E('smith', 2, 2, 2, { builtAt: 9 }), E('smith', 2, 8, 2, { builtAt: 5 })], 5);
    expect(world.objs.find((o) => o.kind === 'smith')!.builtAt).toBe(5);
  });
  it('불러온 뒤 다시 저장·불러오기 해도 그대로 (두 번째엔 정리할 게 없음)', () => {
    placeLayout(lotte('lv1'), 5);
    const again = world.objs.map((o) => E(o.kind, o.tx, o.ty, o.lvl, { ...(o.con ? { con: o.con } : {}) }, !!o.flip));
    const r = placeLayout(again, 5);
    expect(r.removed.length).toBe(0);
    expect(world.objs.filter((o) => o.kind === 'bath').map((o) => o.lvl)).toEqual([5]);
  });
  it('짓기 목록: 이미 있는 하나뿐인 건물은 없음 · 별채·장식은 그대로', () => {
    placeLayout(lotte('lv5'), 5);
    const b = buildableKinds();
    for (const k of ['bath', 'smith', 'tavern', 'training', 'garden']) expect(b).not.toContain(k);
    expect(b).toContain('cottage');
    expect(b).toContain('flowerbed');
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
