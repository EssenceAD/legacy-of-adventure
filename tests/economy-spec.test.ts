// ECONOMY_SPEC: §1 사냥 금화(심연 방치 ≈ 0.26배) · 재료 1.5배 · §2 초월 비용·확률·실패 유지·천장 · §3 특별 장식(하나씩·불꽃 반복)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { REGIONS } from '../src/data/items';
import { transcend, transcendCost, transcendRate } from '../src/world/craft';
import { clearStage } from '../src/world/hunt';
import { launchFireworks, FIREWORK_COST } from '../src/world/luxury';
import { resetProgress, P, S, world, type Item } from '../src/world/state';
import { addObj, buildableKinds, rebuildPaths, startTown } from '../src/world/town';

beforeEach(() => {
  resetProgress();
  S.visiting = false as never;
  S.land = 5;
  startTown();
  rebuildPaths();
});
afterEach(() => vi.restoreAllMocks());

describe('§1 사냥 수입', () => {
  it('심연 방치: 예전(지역 배수 2.5, 금화 ×1) 대비 금화 ≈ 0.26배 · 재료 1.5배', () => {
    const EC = CONFIG.economy;
    const ri = REGIONS.findIndex((r) => r.id === 'abyss');
    const ratio = (EC.huntGold * Math.pow(EC.regionReward, ri)) / Math.pow(2.5, ri);
    expect(ratio).toBeGreaterThan(0.24);
    expect(ratio).toBeLessThan(0.28);
    expect(EC.matMult).toBe(1.5);
  });
  it('한 판 보상에 반영 (rnd 고정): 금화 ×0.65 · 2.0 배수 · 재료 ×1.5 · 보스 반복 재료 +1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const H = CONFIG.hunt;
    const g0 = S.gold;
    const m0 = P.mats.mine;
    const r = clearStage('mine', 3, [], 1, false);
    const ri = REGIONS.findIndex((x) => x.id === 'mine');
    expect(r.gold).toBe(Math.round(H.gold[0] * Math.pow(2, ri) * (1 + H.goldPerStage * 2) * 0.65));
    expect(S.gold - g0).toBe(r.gold);
    expect(P.mats.mine - m0).toBe(Math.round(H.mats[0] * 1.5));
    clearStage('mine', 10, [], 1, false);
    const again = clearStage('mine', 10, [], 1, false);
    expect(again.bossMats).toBe(2);
  });
});

describe('§2 초월', () => {
  const item = (): Item => ({ id: 1, region: 'forest', slot: 'weapon', grade: 'e', name: '이끼 검', stats: { atk: 10 }, opts: [], enh: 10, set: false }) as Item;
  beforeEach(() => {
    addObj('smith', 2, 14, { lvl: 5 });
    rebuildPaths();
    S.gold = 1e9;
    P.mats.forest = 1e6;
    P.bossMats[transcendCost(item()).boss.id] = 1e6;
    P.dust.e = 1e6;
  });
  it('비용표: +11 금화 2만 · +15 32만 · 재료 30×k · 보스 k · 가루 50×k', () => {
    const it = item();
    expect(transcendCost(it)).toMatchObject({ n: 11, gold: 20000, mats: 30, bossMats: 1, dust: 50 });
    it.enh = 14;
    expect(transcendCost(it)).toMatchObject({ n: 15, gold: 320000, mats: 150, bossMats: 5, dust: 250 });
    it.enh = 19;
    expect(transcendCost(it).gold).toBe(20000 * 2 ** 9);
  });
  it('성공률: 60% − 4%p/단계 + 대장간 Lv당 1%p · 실패하면 단계 유지 + 다음 +5%p · 성공하면 천장 초기화', () => {
    const it = item();
    expect(transcendRate(it)).toBeCloseTo(0.6 + 0.05, 5);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(transcend(it)).toBe('fail');
    expect(it.enh).toBe(10);
    expect(it.tPity).toBeCloseTo(0.05);
    expect(transcendRate(it)).toBeCloseTo(0.7, 5);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(transcend(it)).toBe('ok');
    expect(it.enh).toBe(11);
    expect(it.tPity).toBe(0);
  });
  it('+15 「초월한」 · +20 「극의」 · 그 위로는 max · +10 아니면 불가 · 대장간 Lv5 아래면 잠김', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const it = item();
    for (let i = 0; i < 5; i++) transcend(it);
    expect(it.name).toBe('초월한 이끼 검');
    for (let i = 0; i < 5; i++) transcend(it);
    expect(it.enh).toBe(20);
    expect(it.name).toBe('극의 이끼 검');
    expect(transcend(it)).toBe('max');
    expect(transcend({ ...item(), enh: 7 })).toBe('notten');
    world.objs.find((o) => o.kind === 'smith')!.lvl = 4;
    expect(transcend(item())).toBe('locked');
  });
});

describe('§3 특별 장식', () => {
  it('하나씩만 · 용 뼈 화석은 심연 10 뒤', () => {
    expect(buildableKinds()).toContain('gold_fountain');
    expect(buildableKinds()).not.toContain('dragon_fossil');
    P.hunt.best.abyss = 10;
    expect(buildableKinds()).toContain('dragon_fossil');
    addObj('gold_fountain', 3, 3);
    expect(buildableKinds()).not.toContain('gold_fountain');
  });
  it('불꽃놀이: 10만 G마다 반복 · 터지는 중엔 다시 못 함', () => {
    S.gold = FIREWORK_COST * 2;
    expect(launchFireworks()).toBeNull();
    expect(launchFireworks()).toBeTruthy();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11000);
    expect(launchFireworks()).toBeNull();
    expect(S.gold).toBe(0);
    expect(P.luxury.shows).toBe(2);
  });
});
