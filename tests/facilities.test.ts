// BUILDINGS_SPEC: 새 기능 건물 7종 효과가 레벨에 따라 실제로 바뀌는지 · 물약(재료 차감 → 30분 → 해제) · 수확물 창고 · 주점 식사
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { def } from '../src/data/catalog';
import { addCrop, brew, buffOf, canBrew, chapelHeal, drink, fLv, guildGold, guildSlot, guildSpecial, lerpLv, libraryXp, passerExtraHours, postMailMult, stableTimeCut, takeMeal, towerEnhance } from '../src/world/facilities';
import { partyMax } from '../src/world/expeditions';
import { addObj, rebuildPaths, startTown } from '../src/world/town';
import { P, S, world } from '../src/world/state';

const NB = CONFIG.newBuildings;
const put = (k: string, lvl: number) => addObj(k as never, 2, 2, { lvl });
beforeEach(() => {
  S.visiting = false as never;
  S.land = 5;
  startTown();
  rebuildPaths();
  P.crops = {};
  P.potions = {};
  P.buff = null;
  P.pantry = 0;
  P.meta.slot5 = false;
});

describe('새 기능 건물', () => {
  it('카탈로그: 7종 · 비용·레벨 4단계·열림 조건이 설정과 같음', () => {
    for (const k of ['stable', 'chapel', 'library', 'alchemy', 'postoffice', 'tower', 'guild'] as const) {
      const d = def(k);
      expect(d.cost).toBe(NB[k].cost);
      expect(d.levels).toEqual(NB[k].levels);
      expect(d.unlock).toBe(NB[k].unlock);
    }
  });
  it('없으면 효과 0 · Lv1 → Lv5 사이 고르게', () => {
    expect(stableTimeCut()).toBe(0);
    expect(lerpLv([0.05, 0.2], 1)).toBeCloseTo(0.05);
    expect(lerpLv([0.05, 0.2], 3)).toBeCloseTo(0.125);
    expect(lerpLv([0.05, 0.2], 5)).toBeCloseTo(0.2);
  });
  it('레벨을 올리면 숫자가 바뀐다 (공사 중인 건 안 셈)', () => {
    const o = put('stable', 1);
    expect(stableTimeCut()).toBeCloseTo(0.05);
    o.lvl = 5;
    expect(stableTimeCut()).toBeCloseTo(0.2);
    expect(passerExtraHours()).toBe(1);
    o.build = 1;
    expect(fLv('stable')).toBe(0);
  });
  it('예배당·서재·우체국·탑·길드', () => {
    put('chapel', 5);
    put('library', 1);
    put('postoffice', 5);
    put('tower', 1);
    const g = put('guild', 2);
    expect(chapelHeal()).toBeCloseTo(0.6);
    expect(libraryXp()).toBeCloseTo(0.1);
    expect(postMailMult()).toBeCloseTo(2);
    expect(towerEnhance()).toBeCloseTo(0.03);
    expect(guildGold()).toBeCloseTo(0.1 + 0.3 / 4);
    const base = partyMax();
    expect(guildSlot()).toBe(0);
    g.lvl = 3;
    expect(guildSlot()).toBe(1);
    expect(partyMax()).toBe(base + 1);
    expect(guildSpecial()).toBe(false);
    g.lvl = 5;
    expect(guildSpecial()).toBe(true);
  });
});

describe('수확물 · 물약', () => {
  it('주점 식사: 옛 채소 먼저 → 먹을 수 있는 작물 (약초·별꽃은 안 먹음)', () => {
    P.pantry = 1;
    addCrop('herb', 5);
    addCrop('wheat', 2);
    expect(takeMeal()).toBe(true);
    expect(P.pantry).toBe(0);
    expect(takeMeal()).toBe(true);
    expect(P.crops.wheat).toBe(1);
    takeMeal();
    expect(takeMeal()).toBe(false);
    expect(P.crops.herb).toBe(5);
  });
  it('공방 없으면 못 만듦 · 재료 차감 → 칸에 → 마시면 30분 → 끝나면 해제', () => {
    addCrop('herb', 3);
    addCrop('carrot', 2);
    expect(canBrew('power')).toMatch(/공방/);
    put('alchemy', 1);
    expect(brew('power')).toBeNull();
    expect(P.crops.herb).toBe(0);
    expect(P.potions.power).toBe(1);
    expect(brew('power')).toMatch(/모자라|가득/);
    const t = 1_000_000;
    expect(drink('power', t)).toBeNull();
    expect(buffOf('power', t + 60_000)).toBeCloseTo(0.15);
    expect(buffOf('stone', t + 60_000)).toBe(0);
    expect(buffOf('power', t + CONFIG.potions.minutes * 60_000 + 1)).toBe(0);
  });
  it('공방 Lv마다 물약 칸 +1 · 효과 +5%', () => {
    const o = put('alchemy', 3);
    addCrop('herb', 6);
    addCrop('carrot', 2);
    addCrop('pumpkin', 2);
    expect(brew('power')).toBeNull();
    expect(brew('stone')).toBeNull();
    drink('stone', 0);
    expect(buffOf('stone', 1)).toBeCloseTo(0.15 * 1.1);
    void o;
  });
  it('휴식의 물약: 바로 손님 기분 +', () => {
    put('alchemy', 1);
    world.actors = [{ id: 1, mood: 50 } as never];
    addCrop('cabbage', 3);
    addCrop('wheat', 2);
    expect(brew('rest')).toBeNull();
    expect(world.actors[0].mood).toBe(70);
  });
});
