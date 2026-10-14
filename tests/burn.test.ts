// RAIDWEAPON §6 (10/15 정정) 오픈 기념 버닝 주말: 기간(KST) 경계 · 서버 시각만 (기기 시계 조작 무시) · 사냥·의뢰 경험치·금화 ×2 · 재료 ×1.5 · 토벌 도전 +1 · 균열 날짜 배수 · 플래그 끔 = 아무것도 안 함
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { makeAdventurer } from '../src/world/adventurers';
import { burnBandText, burnLeftText, burnMats, burnMult, burnOn, burnRaidTries, burnRiftMult, burnWindow } from '../src/world/burn';
import { noteServerDate, setFlag, setServerAnchor } from '../src/world/flags';
import { clearStage, idleHunt } from '../src/world/hunt';
import { resolveRun, sendParty } from '../src/world/expeditions';
import { clearFloor } from '../src/world/abyss';
import { beginRaid, expectOf, repairRaidTries, settle, triesLeft, triesMax, weeklyTarget } from '../src/world/raid';
import { P, resetProgress, S, world, type Quest, type Run } from '../src/world/state';

const B = CONFIG.burn;
const kst = (s: string) => Date.parse(`${s}+09:00`);
const START = kst('2026-10-17T00:00:00');
const END = kst('2026-10-18T23:59:59');
/** 서버 시각 server 를 지금 받은 것처럼 (기기 시계 = 지금 그대로) */
const serverAt = (server: number) => setServerAnchor({ server, perf: performance.now(), wall: Date.now() });

beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div><div id="over"></div>';
  world.actors = [];
  world.home = null;
  S.started = true;
  S.visiting = null as never;
  setFlag('burnWeekend', true);
  setServerAnchor(null);
});
afterEach(() => {
  setFlag('burnWeekend', false);
  setServerAnchor(null);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('기간 · 서버 시각', () => {
  it('config 기간 = 10/17 00:00 ~ 10/18 23:59:59 KST (끝 초 포함)', () => {
    expect(burnWindow()).toEqual({ from: START, to: END + 1000 });
  });
  it('경계 (서버 시각 주입)', () => {
    for (const [t, on] of [
      [START - 1000, false],
      [START, true],
      [kst('2026-10-18T12:00:00'), true],
      [END, true],
      [END + 999, true],
      [END + 1000, false],
    ] as const) {
      serverAt(t);
      expect(burnOn(), new Date(t).toISOString()).toBe(on);
      expect(burnOn(t)).toBe(on);
    }
  });
  it('flags.json Date 머리 → 켬 (기기 시계는 10/15 그대로)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(kst('2026-10-15T20:00:00'));
    noteServerDate(new Date(kst('2026-10-17T09:00:00')).toUTCString());
    expect(burnOn()).toBe(true);
  });
  it('서버 시각을 못 받았으면 꺼짐 (기기 시계가 기간 안이어도)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(kst('2026-10-17T12:00:00'));
    expect(burnOn()).toBe(false);
    expect(burnMult('gold')).toBe(1);
  });
  it('기기 시계를 기간으로 돌려도 안 켜짐', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(kst('2026-10-16T12:00:00'));
    serverAt(kst('2026-10-16T12:00:00'));
    expect(burnOn()).toBe(false);
    vi.setSystemTime(kst('2026-10-17T12:00:00')); // 기기 시계만 하루 앞으로
    expect(burnOn()).toBe(false);
  });
  it('기기 시계가 틀려 있어도(이틀 늦음) 서버 기준으로 켜짐', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(kst('2026-10-15T12:00:00'));
    serverAt(kst('2026-10-17T12:00:00'));
    expect(burnOn()).toBe(true);
  });
  it('잠자기로 performance.now()가 멈춰도 기간이 끝났으면 꺼짐 (기기 시계 쪽 추정이 막음)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const wall = kst('2026-10-18T23:00:00');
    vi.setSystemTime(wall);
    setServerAnchor({ server: wall, perf: performance.now(), wall });
    expect(burnOn()).toBe(true);
    vi.setSystemTime(wall + 2 * 3600000); // 기기 시계 2시간 흐름 · perf 는 거의 그대로
    expect(burnOn()).toBe(false);
  });
  it('플래그 끔 = 꺼짐 · 배수 1 · 띠 글 없음', () => {
    serverAt(kst('2026-10-17T12:00:00'));
    setFlag('burnWeekend', false);
    expect(burnOn()).toBe(false);
    for (const k of ['exp', 'gold', 'mats', 'riftFrags'] as const) expect(burnMult(k)).toBe(1);
    expect(burnRaidTries()).toBe(0);
    expect(burnBandText()).toBe('');
    expect(burnRiftMult('2026-10-17')).toBe(1);
  });
  it('배수 · 남은 시간 글', () => {
    const t = kst('2026-10-17T21:40:00');
    expect(burnMult('exp', t)).toBe(B.expGold);
    expect(burnMult('gold', t)).toBe(B.expGold);
    expect(burnMult('mats', t)).toBe(B.mats);
    expect(burnMult('riftFrags', t)).toBe(B.riftFrags);
    expect(burnLeftText(t)).toBe('1일 2시간');
    expect(burnLeftText(kst('2026-10-18T21:30:00'))).toBe('2시간 30분');
    expect(burnLeftText(kst('2026-10-18T23:50:00'))).toBe('10분');
    expect(burnBandText(t)).toBe('🔥 오픈 기념 버닝 주말 · 경험치·골드 2배');
  });
  it('재료 ×1.5 · 소수점은 확률 (1 → 1 또는 2)', () => {
    const t = START + 1;
    expect(burnMats(2, () => 0.9, t)).toBe(3);
    expect(burnMats(1, () => 0.4, t)).toBe(2);
    expect(burnMats(1, () => 0.6, t)).toBe(1);
    expect(burnMats(0, () => 0, t)).toBe(0);
    expect(burnMats(3, () => 0, START - 1)).toBe(3);
  });
});

describe('균열 조각: 한국 날짜', () => {
  it('10/17 · 10/18 = ×2 · 앞뒤 날 = ×1 · 두 모양 다', () => {
    expect(burnRiftMult('2026-10-17')).toBe(B.riftFrags);
    expect(burnRiftMult('2026-10-18')).toBe(B.riftFrags);
    expect(burnRiftMult('2026-10-16')).toBe(1);
    expect(burnRiftMult('2026-10-19')).toBe(1);
    expect(burnRiftMult('2026-10-18')).toBe(2);
    expect(burnRiftMult('2026-9-17')).toBe(1);
    expect(burnRiftMult('nope')).toBe(1);
  });
});

describe('사냥', () => {
  const run = () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const g0 = S.gold;
    const m0 = P.mats.mine;
    const r = clearStage('mine', 3, [], 1, false);
    vi.restoreAllMocks();
    return { gold: S.gold - g0, xp: r.xp, mats: P.mats.mine - m0 };
  };
  it('경험치·금화 ×2 · 재료 ×1.5 (기간 중만)', () => {
    serverAt(START - 60000);
    const off = run();
    serverAt(START + 60000);
    const on = run();
    expect(Math.abs(on.gold - off.gold * 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(on.xp - off.xp * 2)).toBeLessThanOrEqual(1);
    expect(on.mats).toBe(Math.ceil(off.mats * 1.5));
    setFlag('burnWeekend', false);
    expect(run()).toEqual(off);
  });
  it('방치 사냥(꺼져 있던 동안)엔 배수 없음', () => {
    P.hunt.best.mine = 3;
    const a = makeAdventurer(5, 5, { status: 'regular', lvl: 20 });
    a.id = P.nextAdvId++;
    world.actors.push(a);
    const go = () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const r = idleHunt(3600, 1e12);
      vi.restoreAllMocks();
      return r && { gold: r.gold, xp: r.xp, mats: r.mats };
    };
    serverAt(START - 60000);
    const off = go();
    serverAt(START + 60000);
    const on = go();
    expect(off).not.toBeNull();
    expect(on).toEqual(off);
  });
});

describe('의뢰', () => {
  const mk = () => {
    const a = makeAdventurer(5, 5, { status: 'regular', lvl: 20 });
    a.id = P.nextAdvId++;
    a.hp = 100;
    world.actors.push(a);
    return a;
  };
  const go = (end: number) => {
    // 손님 직업·태그도 무작위라 만들 때부터 고정
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    world.actors = [];
    const q: Quest = { id: 99, region: 'forest', tier: 0, power: 1, minutes: 1, gold: [100, 200] };
    P.quests.list = [q];
    const r = sendParty(q, [mk(), mk()]) as Run;
    r.end = end;
    const res = resolveRun(r, []);
    vi.restoreAllMocks();
    return res;
  };
  it('기간 안에 끝난 의뢰를 기간 중에 받으면 경험치·금화 ×2 · 재료 ×1.5', () => {
    serverAt(START + 3600000);
    const off = (setFlag('burnWeekend', false), go(START + 1000));
    setFlag('burnWeekend', true);
    const on = go(START + 1000);
    expect(off.win && on.win).toBe(true);
    expect(Math.abs(on.gold - off.gold * 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(on.xp - off.xp * 2)).toBeLessThanOrEqual(1);
    expect(on.mats).toBe(Math.floor(off.mats * 1.5) + (0.01 < (off.mats * 1.5) % 1 ? 1 : 0));
  });
  it('기간 전에 끝나 쌓여 있던 보고서 · 기간 뒤에 받는 보고서는 그대로', () => {
    serverAt(START + 3600000);
    setFlag('burnWeekend', false);
    const off = go(START - 1000);
    setFlag('burnWeekend', true);
    expect(go(START - 1000).gold).toBe(off.gold);
    serverAt(END + 3600000);
    expect(go(END - 1000).gold).toBe(off.gold);
  });
});

describe('심연 · 토벌', () => {
  it('심연 층 재료 ×1.5 (기간 중만)', () => {
    serverAt(START - 60000);
    const off = clearFloor(10, null, () => 0.99);
    serverAt(START + 60000);
    const on = clearFloor(10, null, () => 0.99);
    expect(on.mats).toBe(Math.floor(off.mats * 1.5));
    expect(on.bossMats).toBe(Math.floor(off.bossMats * 1.5));
    expect(on.dustN).toBe(off.dustN);
  });
  it('토벌 도전 +1 은 기간 중만 · 끝나면 원래대로', () => {
    serverAt(START - 60000);
    const base = triesMax();
    serverAt(START + 60000);
    expect(triesMax()).toBe(base + B.raidTries);
    expect(triesLeft()).toBe(base + B.raidTries);
    serverAt(END + 1000);
    expect(triesMax()).toBe(base);
    setFlag('burnWeekend', false);
    serverAt(START + 60000);
    expect(triesMax()).toBe(base);
  });
  it('버닝 +1 도전까지 쓴 날: 부팅 바로잡기가 깎지 않음', () => {
    serverAt(START + 60000);
    repairRaidTries();
    const max = triesMax();
    for (let i = 0; i < max; i++) expect(beginRaid()).not.toBeNull();
    expect(beginRaid()).toBeNull();
    expect(P.raid.burnDay).toBe(P.raid.day);
    setServerAnchor(null); // 다시 켰는데 서버 시각을 아직 못 받음
    repairRaidTries();
    expect(P.raid.tries).toBe(max);
    expect(triesLeft()).toBe(0);
  });
  it('토벌 재료 ×1.5', () => {
    const go = () => {
      const t = weeklyTarget();
      const id = beginRaid()!;
      const b0 = P.bossMats[t.boss.id] ?? 0;
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      settle(t, [], 1, 'manual', expectOf([], t.boss), id);
      vi.restoreAllMocks();
      return (P.bossMats[t.boss.id] ?? 0) - b0;
    };
    serverAt(START - 60000);
    const off = go();
    serverAt(START + 60000);
    const on = go();
    expect(on).toBe(Math.floor(off * 1.5));
  });
});
