// PACE §1 raidPace: 연속 토벌(도전장) · 보상 배수 · 랭킹은 첫 보스만 · 하루 4번 · 주 후반 약해짐 · 떠돌이 0.15·48시간 · 떠돌이도 c7_kill
// PACE §3-1 storyClock: 「며칠째」 = max(게임 일수, 막 들어간 날 + 현실 경과일 × 8) · 옛 저장 막 시각 추정 · 기다리던 실세이브 3개
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { bossById } from '../src/data/bosses';
import { MISSIONS } from '../src/data/guide';
import { blankActor } from '../src/world/adventurers';
import { setFlag } from '../src/world/flags';
import { guideCtx } from '../src/world/guide';
import {
  beginRaid, chainDone, chainLine, chainMult, chainN, challengeChoices, ensureWeek, expectOf, maybeWander, pickChallenge, settle, submitRecord, tireBoss, triesLeft, triesMax, wanderTarget, weakDue, weeklyTarget,
} from '../src/world/raid';
import { P, resetProgress, S, world, type Building } from '../src/world/state';
import { actUp, backfillActAt, initStory, nextAct, realAtFor, realDaysTo, retireGoals, storyClockDay, storyDay, storyWaitDay, storyWaitText } from '../src/world/story';
import { readSave } from '../src/save/save';

const R = CONFIG.raid;
const A = CONFIG.story;
const DAY = 864e5;
/** 한국 시간 → UTC ms */
const KST0 = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h - 9, mi);

beforeEach(() => {
  resetProgress();
  S.gold = 0;
  S.day = 1;
  S.started = true as never;
  S.visiting = null as never;
  setFlag('raidPace', true);
  setFlag('storyClock', true);
  // 숲·늪·폐광 열기
  P.counters.regionWins.forest = 3;
  P.counters.regionWins.swamp = 3;
});
afterEach(() => {
  vi.useRealTimers();
  setFlag('raidPace', true);
  setFlag('storyClock', true);
});

/** 지금 주간 보스를 잡는다 (한 판 · 자동) */
function killWeekly() {
  const t = weeklyTarget();
  const run = beginRaid()!;
  return { t, out: settle(t, [], t.hpLeft + 1, 'auto', expectOf([], t.boss), run) };
}

describe('PACE §1 연속 토벌', () => {
  it('첫 보스를 잡으면 도전장 — 열린 지역 보스 중 이번 주 안 잡은 것만 · 최대 3마리', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(KST0(2026, 10, 13, 12)); // 화요일
    ensureWeek();
    expect(challengeChoices()).toEqual([]);
    expect(chainLine()).toBe('이번 주 1/3 · 다음: 도전장 고르기');
    const first = P.raid.bossId;
    const k1 = killWeekly();
    expect(k1.out.killed).toBe(true);
    expect(k1.out.chain).toBe(1);
    expect(P.raid.weeksKilled).toBe(1);
    const ch = challengeChoices().map((b) => b.id);
    expect(ch).not.toContain(first);
    expect(ch.length).toBe(2);
    expect(pickChallenge(first)).toBe(false);
    expect(pickChallenge(ch[0])).toBe(true);
    expect(chainN()).toBe(2);
    expect(P.raid.hpLeft).toBe(bossById(ch[0])!.hp);
    expect(P.raid.killed).toBe(false);
    expect(chainLine()).toBe('이번 주 2/3 · 다음: 도전장 고르기');
    const k2 = killWeekly();
    expect(k2.out.chain).toBe(2);
    // 주간 보스를 잡은 「주」는 한 번만
    expect(P.raid.weeksKilled).toBe(1);
    expect(chainDone()).toEqual([first, ch[0]]);
    expect(challengeChoices().map((b) => b.id)).toEqual([ch[1]]);
    expect(pickChallenge(ch[1])).toBe(true);
    expect(chainLine()).toBe('이번 주 3/3 · 이번 주 마지막 보스');
    killWeekly();
    expect(challengeChoices()).toEqual([]);
    expect(chainLine()).toBe('이번 주 3/3 · 모두 처치! 월요일에 새 보스');
    // 처치 수 (장부·업적·전설)는 마리마다 그대로
    expect(Object.values(P.raid.kills).reduce((a, b) => a + b, 0)).toBe(3);
    expect(P.counters.raidKills).toBe(3);
    // 다음 주: 다시 1/3
    vi.setSystemTime(KST0(2026, 10, 20, 12));
    ensureWeek();
    expect(chainN()).toBe(1);
    expect(P.raid.chainKilled).toEqual([]);
  });
  it('보상: 2번째 ×0.5 · 3번째 ×0.3 (금화·재료 · CONFIG) · 경험치 그대로', () => {
    expect(chainMult(1)).toBe(1);
    expect(chainMult(2)).toBe(R.chainMult[1]);
    expect(R.chainMult[1]).toBeLessThan(1);
    expect(chainMult(3)).toBe(R.chainMult[2]);
    expect(R.chainMult[2]).toBeLessThan(R.chainMult[1]);
    ensureWeek();
    killWeekly();
    const id = challengeChoices()[0].id;
    pickChallenge(id);
    const b = bossById(id)!;
    const t = weeklyTarget();
    const ex = expectOf([], b);
    const dmg = Math.round(b.power * R.seconds * R.dmgPerPowerSec * 0.5); // 처치 못 하는 한 판
    const out = settle(t, [], dmg, 'auto', ex, beginRaid()!);
    expect(out.killed).toBe(false);
    expect(out.mult).toBe(R.chainMult[1]);
    const gold1 = Math.round(b.gold * 0.5);
    expect(out.gold).toBe(Math.round(gold1 * R.chainMult[1]));
  });
  it('랭킹은 첫 보스만: 도전장 보스는 기록을 안 올리고 이번 주 최고도 안 바뀜', async () => {
    ensureWeek();
    const t1 = weeklyTarget();
    const r1 = settle(t1, [], 1000, 'manual', expectOf([], t1.boss), beginRaid()!);
    expect(r1.weekBest).toBe(true);
    expect(P.raid.best).toBe(1000);
    killWeekly();
    pickChallenge(challengeChoices()[0].id);
    const t2 = weeklyTarget();
    expect(t2.chain).toBe(2);
    const out = settle(t2, [], 50000, 'manual', expectOf([], t2.boss), beginRaid()!);
    expect(out.weekBest).toBe(false);
    expect(P.raid.best).not.toBe(50000);
    const rec = await submitRecord(t2, 50000, 'manual', expectOf([], t2.boss));
    expect(rec.chain).toBe(true);
    expect(rec.online).toBe(false);
    expect(P.raid.outbox.length).toBe(0);
  });
  it('하루 도전 4번 (연속 보스와 같이) · 플래그 끄면 3번', () => {
    expect(triesMax()).toBe(4);
    for (let i = 0; i < 6; i++) beginRaid();
    expect(triesLeft()).toBe(0);
    expect(P.raid.tries).toBe(4);
    setFlag('raidPace', false);
    expect(triesMax()).toBe(3);
    expect(challengeChoices()).toEqual([]);
    expect(chainLine()).toBe('');
  });
  it('옛 저장(이번 주 첫 보스를 이미 잡음 · 새 칸 없음)도 바로 도전장', () => {
    ensureWeek();
    const id = P.raid.bossId;
    Object.assign(P.raid, { hpLeft: 0, killed: true });
    for (const k of ['chainN', 'chainKilled', 'weak', 'tiredSaid', 'wanderKills'] as const) delete (P.raid as Record<string, unknown>)[k];
    expect(chainN()).toBe(1);
    expect(chainDone()).toEqual([id]);
    expect(challengeChoices().length).toBe(2);
    expect(pickChallenge(challengeChoices()[0].id)).toBe(true);
    expect(chainN()).toBe(2);
  });
});

describe('PACE §1-4 주 후반 약해짐', () => {
  it('한국 시간 목 0시 −25% · 토 0시 −25% 더 (첫 보스가 살아 있을 때만 · 단계마다 한 번)', () => {
    expect(weakDue(KST0(2026, 10, 14, 23, 59))).toBe(0); // 수
    expect(weakDue(KST0(2026, 10, 15, 0, 0))).toBe(1); // 목
    expect(weakDue(KST0(2026, 10, 16, 12))).toBe(1); // 금
    expect(weakDue(KST0(2026, 10, 17, 0, 0))).toBe(2); // 토
    expect(weakDue(KST0(2026, 10, 18, 23))).toBe(2); // 일
    expect(weakDue(KST0(2026, 10, 19, 0, 1))).toBe(0); // 월
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(KST0(2026, 10, 14, 12));
    ensureWeek();
    const hp0 = P.raid.hpLeft;
    expect(tireBoss()).toBe(false);
    vi.setSystemTime(KST0(2026, 10, 15, 1));
    expect(tireBoss()).toBe(true);
    expect(P.raid.hpLeft).toBe(Math.round(hp0 * 0.75));
    expect(tireBoss()).toBe(false);
    vi.setSystemTime(KST0(2026, 10, 17, 1));
    weeklyTarget(); // 창을 열 때도 적용
    expect(P.raid.hpLeft).toBe(Math.round(Math.round(hp0 * 0.75) * 0.75));
    expect(P.raid.weak).toBe(2);
  });
  it('토요일에 처음 들어와도 두 단계 한 번에 · 잡은 보스·도전장 보스는 안 약해짐 · 플래그 끔이면 그대로', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(KST0(2026, 10, 17, 9));
    ensureWeek();
    const hp0 = bossById(P.raid.bossId)!.hp;
    weeklyTarget();
    expect(P.raid.hpLeft).toBe(Math.round(Math.round(hp0 * 0.75) * 0.75));
    killWeekly();
    pickChallenge(challengeChoices()[0].id);
    const hp2 = P.raid.hpLeft;
    P.raid.weak = 0;
    expect(tireBoss()).toBe(false);
    expect(P.raid.hpLeft).toBe(hp2);
    resetProgress();
    setFlag('raidPace', false);
    ensureWeek();
    const h = P.raid.hpLeft;
    expect(tireBoss()).toBe(false);
    expect(P.raid.hpLeft).toBe(h);
  });
});

describe('PACE §1-3 떠돌이 보스', () => {
  it('0.15 · 48시간 (끄면 0.08 · 24시간)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(KST0(2026, 10, 14, 12));
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(maybeWander('forest')).not.toBeNull();
    expect(P.raid.wander!.until - Date.now()).toBe(48 * 36e5);
    P.raid.wander = null;
    setFlag('raidPace', false);
    expect(maybeWander('forest')).toBeNull();
    rnd.mockReturnValue(0.07);
    expect(maybeWander('forest')).not.toBeNull();
    expect(P.raid.wander!.until - Date.now()).toBe(24 * 36e5);
    rnd.mockRestore();
  });
  it('떠돌이 처치도 장부 「토벌 보스 처치하기」(c7_kill)', () => {
    const m = MISSIONS.find((x) => x.id === 'c7_kill')!;
    expect(m.title).toBe('토벌 보스 처치하기');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    maybeWander('forest');
    vi.restoreAllMocks();
    const t = wanderTarget()!;
    expect(m.check(guideCtx())).toEqual([0, 1]);
    settle(t, [], t.hpLeft + 1, 'auto', expectOf([], t.boss), beginRaid()!);
    expect(P.raid.wanderKills).toBe(1);
    expect(P.raid.weeksKilled).toBe(0);
    expect(m.check(guideCtx())).toEqual([1, 1]);
    setFlag('raidPace', false);
    expect(m.check(guideCtx())).toEqual([0, 1]);
  });
});

// ───────── §3-1 이야기 시계 ─────────

function ledgerTo(ch: number) {
  P.guide.claimed = MISSIONS.filter((m) => m.ch <= ch).map((m) => m.id);
  P.guide.idx = P.guide.claimed.length;
}

describe('PACE §3-1 이야기 시계', () => {
  it('며칠째 = max(게임 일수, 막 들어간 날 + 현실 경과일 × 8)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = KST0(2026, 10, 10, 10);
    vi.setSystemTime(t0);
    initStory(true);
    expect(P.story.actAt![1]).toBe(t0);
    ledgerTo(3);
    S.day = 2;
    expect(nextAct()).toBeNull();
    // 1막 → 2막: 1 + 1.375일 × 8 = 12일째
    vi.setSystemTime(t0 + 1.375 * DAY);
    expect(storyClockDay()).toBe(12);
    expect(nextAct()).toBe(2);
    actUp(2);
    expect(P.story.actAt![2]).toBe(t0 + 1.375 * DAY);
    // 2막 → 3막: 게임 2일차에 2막에 들었어도 시계는 12일째에서 → 12 + 현실 3.5일 × 8 = 40
    for (const h of ['alric', 'oswin', 'mira']) P.dex.heroes[h] = { recruited: true } as never;
    ledgerTo(7);
    const at2 = t0 + 1.375 * DAY;
    vi.setSystemTime(at2 + 3.45 * DAY);
    expect(storyClockDay()).toBe(12 + Math.floor(3.45 * 8));
    expect(nextAct()).toBeNull();
    expect(storyWaitDay()).toBe(40);
    expect(realDaysTo(40)).toBe(1);
    expect(storyWaitText()).toBe('1일 뒤 (또는 40일차)');
    vi.setSystemTime(at2 + 3.5 * DAY);
    expect(storyClockDay()).toBe(40);
    expect(nextAct()).toBe(3);
  });
  it('헤비 유저는 지금과 같거나 빠름 (게임 일수가 크면 그대로) · 시계 끔이면 게임 일수만', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(KST0(2026, 10, 10, 10));
    initStory(true);
    S.day = 30;
    expect(storyClockDay()).toBe(30);
    vi.setSystemTime(KST0(2026, 10, 15, 10));
    expect(storyClockDay()).toBe(41);
    setFlag('storyClock', false);
    expect(storyClockDay()).toBe(30);
    expect(storyClockDay()).toBe(storyDay());
  });
  it('「다음 이야기」 더 빠른 쪽이 앞: 남은 게임 일수 ≤ 남은 현실 일수면 「○일차 (또는 ○일 뒤)」', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = KST0(2026, 10, 10, 10);
    vi.setSystemTime(t0);
    initStory(true);
    ledgerTo(3);
    S.day = 11;
    // 남은 게임 1일 · 현실 1.25일 → 2일 뒤
    expect(storyWaitText()).toBe('12일차 (또는 2일 뒤)');
    S.day = 3;
    expect(storyWaitText()).toBe('2일 뒤 (또는 12일차)');
  });
  it('은퇴(60일)도 3막 들어간 뒤 현실 일수 × 8', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = KST0(2026, 10, 10, 10);
    vi.setSystemTime(t0);
    initStory(true);
    Object.assign(P.story, { act: 3, actDay: { 2: 12, 3: 40 }, actAt: { 3: t0 } });
    S.day = 41;
    expect(retireGoals()[0].done).toBe(false);
    vi.setSystemTime(t0 + 2.5 * DAY);
    expect(storyClockDay()).toBe(60);
    expect(retireGoals()[0].done).toBe(true);
  });
  it('옛 저장 추정: 회차 시작(가장 이른 born·builtAt·우편) ~ 마지막 저장을 게임 일수 비율로 · 증거 없으면 지금', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = KST0(2026, 10, 15, 12);
    vi.setSystemTime(now);
    const start = KST0(2026, 10, 11, 12);
    const last = KST0(2026, 10, 14, 12);
    Object.assign(P.story, { act: 2, day0: 1, actDay: { 2: 12 } });
    delete (P.story as Record<string, unknown>).actAt;
    S.day = 34;
    P.owner = { born: start + DAY } as never;
    world.objs = [{ builtAt: start } as unknown as Building];
    world.home = null;
    P.lastSeen = last;
    expect(backfillActAt()).toBe(true);
    expect(P.story.actAt![2]).toBe(Math.round(start + (11 / 33) * (last - start)));
    expect(backfillActAt()).toBe(false);
    // 증거 없음 → 지금부터
    delete (P.story as Record<string, unknown>).actAt;
    P.owner = null as never;
    world.objs = [];
    P.meta.mail = [];
    backfillActAt();
    expect(P.story.actAt![2]).toBe(now);
  });
});

// ───────── 기다리던 실세이브 (tests/fixtures/real_pace_* · 로컬 전용) ─────────

const REAL = { 꾸무적: 'tests/fixtures/real_pace_kkumujeok.json', 머리박고힐: 'tests/fixtures/real_pace_meoribak.json', 솔바람: 'tests/fixtures/real_pace_solbaram.json' };
const haveReal = Object.values(REAL).every((f) => fs.existsSync(f));
function loadReal(f: string) {
  localStorage.setItem(CONFIG.save.key, fs.readFileSync(f, 'utf8'));
  const d = readSave()!;
  resetProgress(d.progress);
  S.day = d.day;
  S.started = true as never;
  world.home = null;
  world.objs = d.buildings.map((b) => ({ ...b, inside: [] }) as unknown as Building);
  world.actors = d.adventurers.map((a) => Object.assign(blankActor(a.kind, a.name, a.x, a.y), a));
  return d;
}
/** 배포 직후 첫 접속 (한국 시간 10/15 오전 10시로 가정) */
const LOGIN = KST0(2026, 10, 15, 10);
const fmtK = (t: number) => {
  const d = new Date(t + 9 * 36e5);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} KST`;
};

describe.skipIf(!haveReal)('PACE §3-1 기다리던 실세이브 (배포 직후 첫 접속)', () => {
  for (const [name, f] of Object.entries(REAL))
    it(`${name}: 2막 · 장부 다 채움 → 3막 판정`, () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(LOGIN);
      const d = loadReal(f);
      initStory(false);
      expect(P.story.act).toBe(2);
      const at = P.story.actAt![2];
      const ready = nextAct() === 3;
      const when = realAtFor(A.act3.day);
      // 보고용 한 줄
      console.log(
        `[PACE] ${name}: ${d.day}일차 · 2막 들어간 날 ${P.story.actDay[2]}일차 · 추정 2막 시각 ${fmtK(at)} · 10/15 10:00 접속 며칠째 ${storyClockDay()} → ${ready ? '3막!' : `기다림 — 3막 ${fmtK(when)} (현실 ${realDaysTo(A.act3.day)}일 뒤) 또는 게임 ${A.act3.day - storyDay()}일 더`}`,
      );
      expect(at).toBeLessThan(LOGIN);
      expect(at).toBeGreaterThan(KST0(2026, 10, 10));
      // 3막이 늦어도 「2막에 들어간 뒤 현실 3.5일」 안에는 온다
      expect(when - at).toBeLessThanOrEqual(((A.act3.day - (P.story.actDay[2] - P.story.day0 + 1)) / A.realDayAs) * DAY + 1);
      vi.setSystemTime(Math.max(LOGIN, when));
      expect(nextAct()).toBe(3);
    });
});

describe.skipIf(!haveReal)('PACE §3-1 실세이브 — 너그러운 추정(backfillAtStart) 비교', () => {
  for (const [name, f] of Object.entries(REAL))
    it(`${name}: 회차 시작을 2막 시각으로 보면`, () => {
      const C = A as { backfillAtStart: boolean };
      C.backfillAtStart = true;
      try {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(LOGIN);
        loadReal(f);
        initStory(false);
        const when = realAtFor(A.act3.day);
        console.log(`[PACE-alt] ${name}: 2막 시각 ${fmtK(P.story.actAt![2])} · 10/15 10:00 며칠째 ${storyClockDay()} → ${nextAct() === 3 ? '3막!' : `3막 ${fmtK(when)}`}`);
        expect(P.story.actAt![2]).toBeLessThan(LOGIN);
      } finally {
        C.backfillAtStart = false;
      }
    });
});
