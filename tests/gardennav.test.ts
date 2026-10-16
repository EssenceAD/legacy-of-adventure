// 10/17 gardenNav (따스한밤 님 건의): 텃밭 순서(y → x · 새로 짓는 밭 빼기) · 모두 수확 · 모두 심기(마지막 작물 · 금화만큼)
import { beforeEach, describe, expect, it } from 'vitest';
import { addObj, startTown } from '../src/world/town';
import { bulkCrop, emptyAll, gardenList, harvestAll, plant, plantAll, plotsOf, ripeAll } from '../src/world/craft';
import { P, S, world, type Building } from '../src/world/state';
import type { Kind } from '../src/data/catalog';

let a: Building, b: Building, c: Building;
beforeEach(() => {
  S.visiting = false as never;
  S.land = 5;
  startTown();
  world.objs = world.objs.filter((o) => o.kind !== 'garden');
  P.meta.gardenLast = null;
  c = addObj('garden' as Kind, 30, 25);
  a = addObj('garden' as Kind, 26, 22);
  b = addObj('garden' as Kind, 22, 25);
  S.gold = 100000;
});
const ripen = (o: Building) => plotsOf(o).forEach((p) => ((p.crop = 'carrot'), (p.at = 0)));

describe('텃밭 넘기기 · 모두 수확 · 모두 심기', () => {
  it('순서는 마을 위치(y → x) 고정 · 새로 짓는 텃밭은 빠짐', () => {
    expect(gardenList()).toEqual([a, b, c]);
    b.build = 1;
    expect(gardenList()).toEqual([a, c]);
  });
  it('모두 수확: 모든 밭의 익은 칸만 · 다시 누르면 0', () => {
    ripen(a);
    ripen(c);
    const n = plotsOf(a).length + plotsOf(c).length;
    expect(ripeAll()).toBe(n);
    const r = harvestAll();
    expect(r.n).toBe(n);
    expect(r.got).toBeGreaterThanOrEqual(n * 3 - 1);
    expect(ripeAll()).toBe(0);
    expect(harvestAll().n).toBe(0);
  });
  it('모두 심기: 마지막으로 심은 작물(없으면 첫 작물) · 씨앗값 합계', () => {
    expect(bulkCrop()).toBe('carrot');
    plant(a, 0, 'pumpkin');
    expect(bulkCrop()).toBe('pumpkin');
    const empty = emptyAll();
    const gold = S.gold;
    const r = plantAll();
    expect(r).toEqual({ n: empty, cost: empty * 25, left: 0 });
    expect(S.gold).toBe(gold - empty * 25);
    expect(emptyAll()).toBe(0);
  });
  it('금화가 모자라면 살 수 있는 만큼만', () => {
    const empty = emptyAll();
    S.gold = 35; // 당근 10G × 3칸
    const r = plantAll('carrot');
    expect(r.n).toBe(3);
    expect(r.left).toBe(empty - 3);
    expect(S.gold).toBe(5);
  });
  it('지금 땅에서 못 심는 작물이 마지막이면 첫 작물로', () => {
    P.meta.gardenLast = 'starflower';
    S.land = 4;
    expect(bulkCrop()).toBe('carrot');
  });
});
