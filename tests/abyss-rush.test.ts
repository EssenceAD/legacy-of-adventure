// RAIDWEAPON §1 심연 「보스 연전」 (abyssRush) · §0-4 팡파르 따로 끄기 · 무기 조각 칸
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { REGIONS, type RegionId } from '../src/data/items';
import { makeField, step } from '../src/combat/field';
import { REGION_BOSS } from '../src/combat/mons';
import { abyssRec, clearFloor, floorLoot, pickRushBoss, rushFragDue, rushLockWhy, rushOn, rushOpen, rushRec, seenBossRegions, enterFloor, resumeFloor, loseFloor, startAt } from '../src/world/abyss';
import { makeAdventurer } from '../src/world/adventurers';
import { regionBossOf } from '../src/world/hunt';
import { setFlag } from '../src/world/flags';
import { addFrags, fragCount, rwState, spendFrags } from '../src/world/frags';
import { makeFanfarePicker } from '../src/audio/fanfare';
import { P, resetProgress, S, type Actor } from '../src/world/state';

const NOW = Date.UTC(2026, 9, 14, 3); // 수요일
const seqRng = (xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};
const mk = (kind: string, lvl = 50): Actor => Object.assign(makeAdventurer(5, 5, { status: 'regular' }), { kind, lvl, race: 'human', rarity: 'common', hp: 100, mood: 80, food: 80 }) as Actor;
const snap = () => ({ dust: { ...P.dust }, deep: P.mats.deep ?? 0, boss: { ...P.bossMats } });

beforeEach(() => {
  resetProgress();
  S.gold = 0;
  S.visiting = null as never;
  for (const r of REGIONS) P.hunt.best[r.id] = CONFIG.hunt.stages;
  setFlag('abyssRush', true);
});
afterEach(() => setFlag('abyssRush', false));

describe('§1 보스 연전 열림', () => {
  it('플래그 + 한 층씩 최고 10층부터 · 막히면 이유', () => {
    abyssRec(NOW).best = 9;
    expect(rushOn()).toBe(true);
    expect(rushOpen(NOW)).toBe(false);
    expect(rushLockWhy(NOW)).toContain('10층');
    abyssRec(NOW).best = CONFIG.raidWeapon.rush.unlockBest;
    expect(rushOpen(NOW)).toBe(true);
    expect(rushLockWhy(NOW)).toBeNull();
  });
  it('플래그 끄면 아무것도 안 보이고 못 들어감 (기록·저장 칸 그대로)', () => {
    setFlag('abyssRush', false);
    abyssRec(NOW).best = 50;
    expect(rushOn()).toBe(false);
    expect(rushOpen(NOW)).toBe(false);
    // 한 층씩만 돌면 보스 연전 칸은 만들어지지도 않는다 · 조각도 없음
    clearFloor(25, null, () => 0.99, NOW);
    expect((P.gs as { abyssRush?: unknown }).abyssRush).toBeUndefined();
    expect(fragCount()).toBe(0);
  });
});

describe('§1 보스 고르기', () => {
  it('쓰러뜨린 지역 보스만', () => {
    for (const r of REGIONS) P.hunt.best[r.id] = 0;
    const got: RegionId[] = ['forest', 'deep'];
    for (const r of got) P.hunt.best[r] = CONFIG.hunt.stages;
    expect(seenBossRegions().sort()).toEqual([...got].sort());
    for (let i = 0; i < 40; i++) expect(got).toContain(pickRushBoss('', Math.random).region);
  });
  it('직전 층과 같은 보스 금지 (100번 연달아)', () => {
    let prev = '';
    for (let i = 0; i < 100; i++) {
      const b = pickRushBoss(prev, Math.random);
      if (prev) expect(b.look.id).not.toBe(REGION_BOSS[prev as RegionId].id);
      prev = b.region;
    }
  });
  it('직전 보스는 저장 칸(prev)에 남아 이어가도 연달아 안 나옴', () => {
    clearFloor(3, 'swamp', () => 0.5, NOW, 'rush');
    expect(rushRec(NOW).prev).toBe('swamp');
    for (let i = 0; i < 30; i++) expect(pickRushBoss(rushRec(NOW).prev).region).not.toBe('swamp');
  });
});

describe('§1 전투: 쫄 없음', () => {
  it('bossOnly = 처치 목표 0 · 시작 무리 없음 · 첫 걸음에 보스만', () => {
    const ms = [mk('knight'), mk('dwarf'), mk('cleric')];
    const look = REGION_BOSS.ice;
    const f = makeField('deep', CONFIG.hunt.stages, ms, true, { rec: 5000, look, bossOnly: true, music: 'abyss_rush' });
    expect(f.killGoal).toBe(0);
    expect(f.units.filter((u) => u.team === 'mob')).toHaveLength(0);
    step(f, 0.05);
    const mobs = f.units.filter((u) => u.team === 'mob');
    expect(mobs).toHaveLength(1);
    expect(mobs[0].boss?.id).toBe(look.id);
    expect(f.elite).toBe(mobs[0]);
    // 보통 심연 보스 층은 쫄부터
    const g = makeField('deep', CONFIG.hunt.stages, ms, true, { rec: 5000, look });
    expect(g.killGoal).toBe(CONFIG.combat.bossKillGoal);
    expect(g.units.filter((u) => u.team === 'mob').length).toBeGreaterThan(0);
  });
});

describe('§1 보상 = 한 층씩 그대로', () => {
  it('보스 아닌 층(7): 가루·재료 같음 · 보스 재료 없음', () => {
    const a0 = snap();
    const a = clearFloor(7, null, () => 0.99, NOW, 'floor');
    const a1 = snap();
    resetProgress();
    for (const r of REGIONS) P.hunt.best[r.id] = CONFIG.hunt.stages;
    const b0 = snap();
    const b = clearFloor(7, 'ice', () => 0.99, NOW, 'rush');
    const b1 = snap();
    expect([b.dustN, b.dustR, b.dustE, b.mats, b.bossMats]).toEqual([a.dustN, a.dustR, a.dustE, a.mats, a.bossMats]);
    expect(b.bossMats).toBe(0);
    expect(b.items).toEqual([]);
    expect(b1.dust.n - b0.dust.n).toBe(a1.dust.n - a0.dust.n);
    expect(b1.deep - b0.deep).toBe(a1.deep - a0.deep);
    expect(b1.boss).toEqual(b0.boss);
  });
  it('보스 재료·고유 장비 배수는 5층마다만', () => {
    for (let f = 1; f <= 30; f++) {
      const L = floorLoot(f);
      expect(L.bossMats > 0).toBe(f % CONFIG.abyss.bossEvery === 0);
    }
    const r = clearFloor(10, 'ice', () => 0.99, NOW, 'rush');
    expect(r.bossMats).toBe(CONFIG.abyss.bossMats);
    expect(P.bossMats[regionBossOf('ice').id]).toBe(CONFIG.abyss.bossMats);
    // 4층(보스 아님): 고유 장비 굴림 없음 (rng 0 = 무조건 걸리는 값이어도)
    expect(clearFloor(4, 'ice', () => 0, NOW, 'rush').items).toEqual([]);
  });
});

describe('§1 기록 따로', () => {
  it('보스 연전 최고 · 주간 최고는 한 층씩과 섞이지 않음', () => {
    abyssRec(NOW).best = 40;
    clearFloor(12, 'ice', () => 0.99, NOW, 'rush');
    expect(rushRec(NOW).best).toBe(12);
    expect(rushRec(NOW).weekBest).toBe(12);
    expect(abyssRec(NOW).best).toBe(40);
    // 다음 주 월요일: 주간만 초기화
    const next = NOW + 7 * 86400000;
    expect(rushRec(next).weekBest).toBe(0);
    expect(rushRec(next).best).toBe(12);
  });
  it('이어가기·진 층·체크포인트도 모드별 칸', () => {
    enterFloor(14, NOW, 'rush');
    expect(resumeFloor(NOW, 'rush')).toBe(14);
    expect(resumeFloor(NOW)).toBe(0);
    loseFloor(14, NOW, 'rush');
    expect(rushRec(NOW).lost).toBe(14);
    expect(abyssRec(NOW).lost).toBe(0);
    // 체크포인트는 보스 연전 최고 층 기준
    abyssRec(NOW).best = 60;
    rushRec(NOW).best = 15;
    expect(startAt(20, NOW, 'rush')).toEqual({ err: '고를 수 없는 층이에요' });
    S.gold = 1e9;
    expect('floor' in startAt(10, NOW, 'rush')).toBe(true);
  });
});

describe('§1 무기 조각 (25층마다)', () => {
  it('25·50층에 +1 · 같은 층은 한 주에 한 번 · 다음 주엔 다시', () => {
    for (let f = 1; f <= 50; f++) clearFloor(f, 'ice', () => 0.99, NOW, 'rush');
    expect(fragCount()).toBe(2);
    expect(rwState().got.abyss).toBe(2);
    expect(rushFragDue(25, NOW)).toBe(0);
    clearFloor(25, 'ice', () => 0.99, NOW, 'rush');
    expect(fragCount()).toBe(2);
    const next = NOW + 7 * 86400000;
    expect(rushFragDue(25, next)).toBe(1);
    expect(clearFloor(25, 'ice', () => 0.99, next, 'rush').frags).toBe(1);
    expect(fragCount()).toBe(3);
  });
  it('한 층씩 모드는 조각 없음 (§2 exWeapons가 붙인다)', () => {
    clearFloor(25, null, () => 0.99, NOW, 'floor');
    expect(fragCount()).toBe(0);
  });
  it('frags 모듈: 옛 저장(칸 없음·이상한 값) → 0 · add/spend', () => {
    delete (P as { raidWeapon?: unknown }).raidWeapon;
    expect(fragCount()).toBe(0);
    (P as { raidWeapon?: unknown }).raidWeapon = { frags: 'x' };
    expect(fragCount()).toBe(0);
    expect(addFrags(3, 'raid')).toBe(3);
    expect(addFrags(0, 'raid')).toBe(3);
    expect(spendFrags(5)).toBe(false);
    expect(spendFrags(2)).toBe(true);
    expect(fragCount()).toBe(1);
  });
});

describe('§0-4 팡파르 따로 끄기', () => {
  it('끄면 팡파르 대신 coin(null) · 켜면 다시 (45초 기록도 안 남김)', () => {
    const p = makeFanfarePicker(() => 0);
    for (const k of ['win', 'levelup', 'chapter'] as const) expect(p.pick(k, 0, false)).toBeNull();
    expect(p.pick('win', 1, true)).toBe('J1');
    expect(p.pick('levelup', 1, true)).toBe('J8');
  });
  it('설정 기본 = 켬 · 효과음 켜짐과 따로', async () => {
    const { prefs } = await import('../src/audio/engine');
    expect(prefs.fanfareOn).toBe(true);
    prefs.fanfareOn = false;
    expect(prefs.sfxOn).toBe(true);
    prefs.fanfareOn = true;
  });
});
