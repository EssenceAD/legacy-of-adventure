// TOWN T3: 같은 건물 여러 채 — 땅 단계별 최대 채수 · 비용 1 → 1.5 → 2 · 두 번째 채부터 수입 70% · 예전에 더 지은 건 그대로
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { def } from '../src/data/catalog';
import { placeBuilding } from '../src/game';
import { resetProgress, S, world } from '../src/world/state';
import { addObj, buildCost, copyIncomeMult, landBounds, maxCopies, rebuildPaths, startTown } from '../src/world/town';

beforeEach(() => {
  document.body.innerHTML = '<div id="toast"></div>';
  resetProgress();
  S.visiting = false as never;
  S.land = 5;
  startTown();
  rebuildPaths();
  S.gold = 1e9;
});
describe('최대 채수', () => {
  it('땅 3단계 1채 · 4단계 2채 · 5단계 3채 · 6단계 4채 · 별채·장식은 자유 · 여관 본관 1', () => {
    expect([3, 4, 5, 6, 7].map((l) => maxCopies('bath', l))).toEqual([1, 2, 3, 4, 4]);
    expect(maxCopies('cottage', 3)).toBe(Infinity);
    expect(maxCopies('tree', 3)).toBe(Infinity);
    expect(maxCopies('inn', 7)).toBe(1);
  });
  it('최대면 더 못 짓는다 · 이미 더 있는 건 그대로', () => {
    const [a] = landBounds();
    S.land = 4;
    addObj('bath', a + 1, a + 1);
    addObj('bath', a + 5, a + 1);
    addObj('bath', a + 9, a + 1);
    rebuildPaths();
    expect(world.objs.filter((o) => o.kind === 'bath').length).toBe(3);
    expect(placeBuilding({ kind: 'bath', sprite: 'bath', fw: 3, fh: 3, tx: a + 1, ty: a + 6, ok: true })).toBe(false);
    expect(world.objs.filter((o) => o.kind === 'bath').length).toBe(3);
  });
  it('비용: 두 번째 ×1.5 · 세 번째 ×2', () => {
    const [a] = landBounds();
    expect(buildCost('smith')).toBe(def('smith').cost);
    addObj('smith', a + 1, a + 1);
    expect(buildCost('smith')).toBe(Math.round(def('smith').cost * 1.5));
    addObj('smith', a + 5, a + 1);
    expect(buildCost('smith')).toBe(def('smith').cost * 2);
  });
});
describe('수입', () => {
  it('가장 높은 레벨 한 채만 100% · 나머지 70% · 별채는 늘 100%', () => {
    const [a] = landBounds();
    const t1 = addObj('tavern', a + 1, a + 1, { lvl: 2 });
    const t2 = addObj('tavern', a + 6, a + 1, { lvl: 1 });
    expect(copyIncomeMult(t1)).toBe(1);
    expect(copyIncomeMult(t2)).toBe(CONFIG.town.copyIncome);
    const c1 = addObj('cottage', a + 1, a + 6);
    addObj('cottage', a + 4, a + 6);
    expect(copyIncomeMult(c1)).toBe(1);
  });
});
