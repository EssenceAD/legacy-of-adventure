// SMITH §2·§3: 일괄 강화 — 예산 한도에서 멈춤 · 멈춤 버튼 · 보스 재료 부족 · 요약 숫자 = 실제 차감 / 일괄 제작 — 최대 수 · 가방 부족 정지 · 세트 맞추기
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bulkItems, bulkPlan, bulkTick, craftMany, craftMax, missingSetSlots, startBulk } from '../src/world/bulk';
import { makeItem, bagSize } from '../src/world/items';
import { resetProgress, P, S, type Item } from '../src/world/state';
import { addObj, rebuildPaths, startTown } from '../src/world/town';

const dustSum = () => Object.values(P.dust).reduce((s, v) => s + v, 0);
function give(n: number, enh = 0, owner: number | null = null): Item[] {
  const out: Item[] = [];
  for (let i = 0; i < n; i++) {
    const it = makeItem('forest', 'n', 'weapon', false);
    it.enh = enh;
    it.owner = owner;
    P.bag.push(it);
    out.push(it);
  }
  return out;
}
beforeEach(() => {
  resetProgress();
  S.visiting = false as never;
  S.land = 5;
  startTown();
  addObj('smith', 20, 20, { lvl: 5 });
  rebuildPaths();
  P.bag = [];
  S.gold = 1_000_000;
  P.dust.n = 100_000;
});
afterEach(() => vi.restoreAllMocks());

describe('일괄 강화', () => {
  it('끼운 장비가 먼저 · 목표에 닿은 건 빼고', () => {
    const [a] = give(1, 0, null);
    const [b] = give(1, 0, 7);
    give(1, 5, null);
    const list = bulkItems({ target: 'bag', goal: 5, budget: 1, skipLocked: false });
    expect(list[0]).toBe(b);
    expect(list).toContain(a);
    expect(list.length).toBe(2);
    expect(bulkItems({ target: 'equipped', goal: 5, budget: 1, skipLocked: false })).toEqual([b]);
  });
  it('+1까지(GROWTH: +1만 확정): 요약 숫자 = 실제 차감 · 미리보기 = 실제', () => {
    give(3);
    const plan = bulkPlan({ target: 'bag', goal: 1, budget: 1, skipLocked: false });
    const d0 = dustSum();
    const r = startBulk({ target: 'bag', goal: 1, budget: 1, skipLocked: false });
    while (bulkTick(r));
    expect(r.stopped).toBe('done');
    expect(P.bag.every((it) => it.enh === 1)).toBe(true);
    expect(d0 - dustSum()).toBe(r.spentDust);
    expect(r.spentDust).toBe(plan.dust);
    expect(r.fails).toBe(0);
  });
  it('예산 한도를 넘기 전에 멈춘다', () => {
    give(5);
    P.dust.n = 1000;
    const r = startBulk({ target: 'bag', goal: 5, budget: 0.5, skipLocked: false });
    while (bulkTick(r));
    expect(r.stopped).toBe('budget');
    expect(r.spentDust).toBeLessThanOrEqual(500);
    expect(P.dust.n).toBeGreaterThanOrEqual(500);
  });
  it('멈춤 버튼', () => {
    give(3);
    const r = startBulk({ target: 'bag', goal: 5, budget: 1, skipLocked: false });
    bulkTick(r);
    r.stopped = 'user';
    expect(bulkTick(r)).toBe(false);
    expect(r.tries).toBe(1);
  });
  it('+10으로 올릴 때 보스 재료가 모자라면 그 장비는 건너뛴다 (미리보기에 몇 개 멈출지)', () => {
    give(2, 9);
    P.bossMats = {};
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(bulkPlan({ target: 'bag', goal: 10, budget: 1, skipLocked: false }).bossShort).toBe(2);
    const r = startBulk({ target: 'bag', goal: 10, budget: 1, skipLocked: false });
    while (bulkTick(r));
    expect(r.stopped).toBe('short');
    expect(P.bag.every((it) => it.enh === 9)).toBe(true);
  });
  it('잠금 장비 빼기', () => {
    const [a] = give(2);
    a.locked = true;
    expect(bulkItems({ target: 'bag', goal: 5, budget: 1, skipLocked: true }).includes(a)).toBe(false);
    expect(bulkItems({ target: 'bag', goal: 5, budget: 1, skipLocked: false }).includes(a)).toBe(true);
  });
});

describe('일괄 제작', () => {
  beforeEach(() => {
    P.mats.forest = 10_000;
    P.bossMats = { boar: 999 };
  });
  it('최대 수 = 재료·가방 중 적은 쪽 · 가방이 차면 멈추고 몇 칸 부족한지', () => {
    const free = bagSize();
    expect(craftMax('forest')).toBeLessThanOrEqual(free);
    give(free - 2);
    const b = craftMany('forest', ['weapon', 'weapon', 'weapon', 'weapon']);
    expect(b.made.length).toBe(2);
    expect(b.why).toBe('bag');
    expect(b.bagShort).toBe(2);
  });
  it('세트 맞추기: 없는 부위만', () => {
    const all = missingSetSlots('forest');
    const b = craftMany('forest', all);
    expect(b.made.length).toBe(all.length);
    expect(missingSetSlots('forest')).toEqual([]);
  });
});
