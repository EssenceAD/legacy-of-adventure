// PACE R17 판정 「지금 고칠 것」 12개 — 숫자(CONFIG) · 대안 · 천장 · 시계 (플래그 paceGates)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { LEGENDS } from '../src/data/legends';
import { MISSIONS } from '../src/data/guide';
import { setFlag } from '../src/world/flags';
import { guideCtx, setEvalScoreHook } from '../src/world/guide';
import { legendCtx } from '../src/world/legends';
import { judgeNight } from '../src/world/legends';
import { moodStreak, mythicProgress } from '../src/world/mythic';
import { createOwner, decideDaysNow, ownerGain, stat, talkTo } from '../src/world/owner';
import {
  baelShortWin, dexNearlyFull, goodDaysNow, huntUniqueChance, judgeAfter, judgePityPick, mimiAlt, moodSample, moodTopNow, pg, tokenPity, wanderPity,
} from '../src/world/paceGates';
import { ITEM_DEX_TOTAL } from '../src/world/progress';
import { beginRaid, ensureWeek, expectOf, maybeWander, settle, wanderTarget, weeklyTarget } from '../src/world/raid';
import { ensureQuests } from '../src/world/expeditions';
import { legendHooks, P, resetProgress, S, uiHooks } from '../src/world/state';
import { initStory, retireGoals } from '../src/world/story';
import { UNIQUES } from '../src/data/story/uniques';

const G = CONFIG.paceGates;
const KST0 = (y: number, mo: number, d: number, h = 0) => Date.UTC(y, mo - 1, d, h - 9);

beforeEach(() => {
  resetProgress();
  S.day = 1;
  S.gold = 0;
  S.started = true as never;
  S.visiting = null as never;
  setFlag('paceGates', true);
  setFlag('raidPace', true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setFlag('paceGates', true);
  setEvalScoreHook(() => 0);
});

describe('R17 숫자 (CONFIG)', () => {
  it('1 realDayAs 10 · 3 결심 21·5 · 4 수확 50 · 5 전설 6 · 9 증표 [1,1,2,3] · 11 주 12 · 말 2 · 1.5 · 12 exp 0.05', () => {
    expect(CONFIG.story.realDayAs).toBe(10);
    expect(CONFIG.ember.decideDays).toBe(21);
    expect(CONFIG.ember.askAgainDays).toBe(5);
    expect(CONFIG.story.retireHarvests).toBe(50);
    expect(CONFIG.story.routes.legendCount).toBe(6);
    expect(CONFIG.legends.tokenNeeds).toEqual([1, 1, 2, 3]);
    expect(CONFIG.goldsink.favor.weekGoal).toBe(12);
    expect(CONFIG.owner.talkPerDay).toBe(2);
    expect(CONFIG.owner.actionCapPerDay).toBe(1.5);
    expect(CONFIG.growth.unique.exp).toBe(0.05);
  });
});

describe('R17 대안·천장·시계', () => {
  it('2 c6_eval: 지금까지 최고 점수로도 (끄면 이번 주 점수만)', () => {
    const c6 = MISSIONS.find((m) => m.id === 'c6_eval')!;
    setEvalScoreHook(() => 850);
    expect(c6.check(guideCtx())).toEqual([800, 800]);
    setEvalScoreHook(() => 120);
    expect(c6.check(guideCtx())).toEqual([800, 800]);
    setFlag('paceGates', false);
    expect(c6.check(guideCtx())).toEqual([120, 800]);
  });
  it('3 불씨 결심: 현실 일수와 이 회차 게임 일수 ÷ 8 중 큰 쪽', () => {
    createOwner('주인', 'm', 'knight', 'knight');
    initStory(true);
    expect(decideDaysNow()).toBe(0);
    S.day = 8 * 21;
    expect(decideDaysNow()).toBe(21);
    setFlag('paceGates', false);
    expect(decideDaysNow()).toBe(0);
  });
  it('4 은퇴 기분: 현실 하루에 한 번 95↑ = 1일 (게임 날과 큰 쪽)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(KST0(2026, 10, 15, 12));
    initStory(true);
    moodSample(96);
    moodSample(99);
    expect(goodDaysNow()).toBe(1);
    vi.setSystemTime(KST0(2026, 10, 16, 12));
    moodSample(80);
    expect(goodDaysNow()).toBe(1);
    moodSample(95);
    expect(goodDaysNow()).toBe(2);
    expect(retireGoals()[1].cur).toBe(2);
    P.story.goodDays = 5;
    expect(goodDaysNow()).toBe(5);
    setFlag('paceGates', false);
    P.story.goodDays = 0;
    expect(goodDaysNow()).toBe(0);
  });
  it('5 바엘: 머무는 동안 2시간 이상 의뢰 2번 = 8시간 1번 · 게시판 8시간 칸 보장', () => {
    const req = vi.spyOn(legendHooks, 'req');
    baelShortWin(4);
    expect(req).not.toHaveBeenCalled(); // 바엘이 없으면 안 셈
    P.legends.vael = { st: 'visit', gauge: 100 } as never;
    baelShortWin(4);
    baelShortWin(3); // 1시간은 안 셈
    expect(req).not.toHaveBeenCalled();
    baelShortWin(5);
    expect(req).toHaveBeenCalledWith('longRunWin');
    P.quests.day = '';
    ensureQuests();
    expect(P.quests.list.some((q) => q.tier >= G.baelLongTier)).toBe(true);
    // 받아 가서 없어져도 다시 채움
    P.quests.list = P.quests.list.filter((q) => q.tier < G.baelLongTier);
    ensureQuests();
    expect(P.quests.list.filter((q) => q.tier >= G.baelLongTier).length).toBe(1);
  });
  it('5 미미: 아이템 도감 남은 칸이 적으면 강화 +5 성공·고유 장비도 「새 칸」', () => {
    const req = vi.spyOn(legendHooks, 'req');
    P.legends.momo2 = { st: 'visit', gauge: 100 } as never;
    mimiAlt('enhance', 9);
    expect(req).not.toHaveBeenCalled(); // 도감이 비어 있으면 안 셈
    P.dex.items = Array.from({ length: ITEM_DEX_TOTAL - G.mimiDexLeft }, (_, i) => `forest|x${i}|n`);
    expect(dexNearlyFull()).toBe(true);
    mimiAlt('enhance', 4);
    expect(req).not.toHaveBeenCalled();
    mimiAlt('enhance', 5);
    mimiAlt('unique');
    expect(req).toHaveBeenCalledTimes(2);
  });
  it('5 판정 천장: 게이지 50% 이상에서 3밤 실패 → 다음 판정 밤 확정', () => {
    P.legends.aria = { st: 'rumor', gauge: 60 } as never;
    P.legends.leon = { st: 'rumor', gauge: 30 } as never;
    const keys = ['aria', 'leon'];
    for (let i = 0; i < G.judgePityNights; i++) {
      expect(judgePityPick(keys)).toBeNull();
      judgeAfter(keys, null);
    }
    expect(pg().judgeFail.leon ?? 0).toBe(0);
    expect(judgePityPick(keys)).toBe('aria');
    judgeAfter(keys, 'aria');
    expect(pg().judgeFail.aria).toBe(0);
    // 실제 판정 밤: 확률이 다 빗나가도 천장이면 방문
    pg().judgeFail.aria = G.judgePityNights;
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    P.legendDay = '';
    judgeNight();
    expect(P.legends.aria.st).toBe('visit');
  });
  it('6 아리아: 기분 최고 10일(현실 하루도) · 7일 연속은 끊기면 −2', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(KST0(2026, 10, 15, 12));
    const aria = LEGENDS.find((d) => d.key === 'aria')!;
    expect(legendCtx().ariaMoodDays).toBe(10);
    moodSample(91);
    expect(moodTopNow()).toBe(1);
    P.counters.moodTopDays = 10;
    const ctx = legendCtx();
    expect(ctx.moodTopDays).toBe(10);
    expect(aria.rumorWhen({ ...ctx, bathLvl: 5 })).toBe(true);
    setFlag('paceGates', false);
    expect(legendCtx().ariaMoodDays).toBe(30);
    setFlag('paceGates', true);
    // 연속: 5일 이어 가다 끊김 → 3
    P.story.mythic = { aria: { met: true } } as never;
    mythicProgress('aria');
    const b = (P.story.mythic.aria as unknown as { base: { streak: number; moodDay: number; moodTop: number } }).base;
    b.streak = 5;
    S.day = b.moodDay + 1;
    b.moodTop = P.counters.moodTopDays; // 그날 최고 아님
    moodStreak('aria');
    expect(b.streak).toBe(3);
  });
  it('7 신화 엘리시아: 떠돌이 처치도 토벌 보스 처치로', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    maybeWander('forest');
    vi.restoreAllMocks();
    const t = wanderTarget()!;
    const k0 = P.counters.raidKills ?? 0;
    settle(t, [], t.hpLeft + 1, 'auto', expectOf([], t.boss), beginRaid()!);
    expect(P.counters.raidKills).toBe(k0 + 1);
  });
  it('8 진: 상위 30% 3주 또는 주간 보스 처치 3주 · 기록 낸 주는 순위 확인 목록에', () => {
    const jin = LEGENDS.find((d) => d.key === 'jin')!;
    P.raid.weeksKilled = 3;
    expect(jin.rumorWhen(legendCtx())).toBe(true);
    setFlag('paceGates', false);
    expect(jin.rumorWhen(legendCtx())).toBe(false);
    setFlag('paceGates', true);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(KST0(2026, 10, 14, 12));
    ensureWeek();
    const w1 = P.raid.week;
    P.raid.best = 1000;
    vi.setSystemTime(KST0(2026, 10, 21, 12));
    ensureWeek();
    expect(pg().rankPending).toEqual([w1]);
  });
  it('9 증표: 원정 150판마다 확정 (확률로 나오면 0부터)', () => {
    let got = 0;
    for (let i = 0; i < G.tokenPityRuns - 1; i++) got += tokenPity(false) ? 1 : 0;
    expect(got).toBe(0);
    expect(tokenPity(false)).toBe(true);
    for (let i = 0; i < 100; i++) tokenPity(false);
    tokenPity(true);
    expect(pg().tokenRuns).toBe(0);
  });
  it('10 떠돌이 천장: 같은 지역 원정 승리 10번째엔 확정', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    for (let i = 0; i < G.wanderPityWins - 1; i++) expect(maybeWander('forest')).toBeNull();
    expect(maybeWander('forest')).not.toBeNull();
    expect(pg().wanderWins.forest).toBe(0);
    // 다른 지역은 따로
    P.raid.wander = null;
    expect(wanderPity('swamp')).toBe(false);
  });
  it('11 말 걸기 하루 2번 · 능력치 하루 최대 1.5', () => {
    createOwner('주인', 'm', 'knight', 'knight');
    uiHooks.talk = () => {};
    expect(talkTo('bernard')).toBeNull();
    expect(talkTo('bernard')).toBeNull();
    expect(talkTo('bernard')).toMatch(/2번 다/);
    setFlag('paceGates', false);
    expect(talkTo('momo')).toBeNull();
    expect(talkTo('momo')).toMatch(/이미/);
    const t0 = stat('talk');
    for (let i = 0; i < 30; i++) ownerGain('talk');
    expect(stat('talk') - t0).toBeLessThanOrEqual(1.5 + 1e-9);
    expect(P.owner!.todayGain.talk).toBeCloseTo(1.5, 5);
  });
  it('12 사냥 고유 장비: 같은 지역 x-10 100번째 확정 · 토벌 보스 첫 처치 확정', () => {
    for (let i = 0; i < G.huntUniquePity - 1; i++) expect(huntUniqueChance('forest', 0.005)).toBe(0.005);
    expect(huntUniqueChance('forest', 0.005)).toBe(1);
    ensureWeek();
    const t = weeklyTarget();
    const has = UNIQUES.some((u) => u.region === t.boss.region);
    const out = settle(t, [], t.hpLeft + 1, 'auto', expectOf([], t.boss), beginRaid()!);
    expect(out.firstKill).toBe(true);
    expect((out.items ?? []).length).toBe(has ? 1 : 0);
  });
});
