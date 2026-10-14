// FIVESTARS 부탁 규칙 바꿈: 왈왈 「밤 출발」 = 현실 밤 또는 게임 안 밤(보낼 때 기록) · 고느끼 부탁 중 현실 하루(한국 시간) 구경거리 1번 보장(그날 첫 세션 게임 1시간 안)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { makeAdventurer } from '../src/world/adventurers';
import { resolveRun, sendParty } from '../src/world/expeditions';
import { fiveNightWin, fiveSpecForce, fiveSpecSeen, fiveState, walwalNightRun } from '../src/world/fivestars';
import { setFlag } from '../src/world/flags';
import { spectacles, tickSpectacle } from '../src/world/spectacle';
import { P, resetProgress, S, world, type Actor, type Quest, type Run } from '../src/world/state';

const F = CONFIG.fiveStars;
const at = (h: number) => new Date(2026, 9, 14, h, 30).getTime();
const mk = (hp = 100) => {
  const a = makeAdventurer(5, 5, { status: 'regular', lvl: 20 });
  a.id = P.nextAdvId++;
  a.hp = hp;
  world.actors.push(a);
  return a;
};
let day = 100;

beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div><div id="over"></div>';
  world.actors = [];
  world.objs.length = 0;
  world.home = null;
  spectacles.length = 0;
  S.day = day++;
  S.clock = 0;
  S.night = false;
  S.started = true;
  S.visiting = null as never;
  setFlag('fiveStars', true);
  const f = fiveState();
  f.open = true;
});
afterEach(() => {
  setFlag('fiveStars', false);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('왈왈 「밤 출발 원정」', () => {
  it('현실 밤(20~04시) 출발이면 셈', () => {
    expect(walwalNightRun({ start: at(21), gameNight: false })).toBe(true);
    expect(walwalNightRun({ start: at(2), gameNight: false })).toBe(true);
  });
  it('현실 낮이어도 게임 안 밤에 보냈으면 셈', () => {
    expect(walwalNightRun({ start: at(13), gameNight: true })).toBe(true);
  });
  it('현실 낮 + 게임 낮이면 안 셈', () => {
    expect(walwalNightRun({ start: at(13), gameNight: false })).toBe(false);
  });
  it('옛 기록(gameNight 없음)은 현실 시각만', () => {
    expect(walwalNightRun({ start: at(13) })).toBe(false);
    expect(walwalNightRun({ start: at(22) })).toBe(true);
  });
  it('보낼 때 게임 밤을 기록 → 현실 낮에 성공 귀환해도 왈왈 칸 +1', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(13));
    S.night = true;
    const ms = [mk(), mk()];
    const q: Quest = { id: 99, region: 'forest', tier: 0, power: 1, minutes: 1, gold: [10, 20] };
    P.quests.list = [q];
    const run = sendParty(q, ms) as Run;
    expect(typeof run).not.toBe('string');
    expect(run.gameNight).toBe(true);
    S.night = false;
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    resolveRun(run, []);
    expect(run.result?.win).toBe(true);
    expect(ms.every((m) => m.hp >= F.walwal.hp)).toBe(true);
    expect(P.five.walwalNights).toBe(1);
  });
  it('게임 낮 · 현실 낮 출발은 안 셈', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at(13));
    const ms = [mk(), mk()];
    const q: Quest = { id: 98, region: 'forest', tier: 0, power: 1, minutes: 1, gold: [10, 20] };
    P.quests.list = [q];
    const run = sendParty(q, ms) as Run;
    expect(run.gameNight).toBe(false);
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    resolveRun(run, []);
    expect(P.five.walwalNights).toBe(0);
  });
  it('체력 60 미만으로 돌아온 사람이 있으면 안 셈', () => {
    const a = mk(100);
    const b = mk(F.walwal.hp - 1);
    fiveNightWin([a, b]);
    expect(P.five.walwalNights).toBe(0);
    b.hp = F.walwal.hp;
    fiveNightWin([a, b]);
    expect(P.five.walwalNights).toBe(1);
  });
});

describe('고느끼: 현실 하루(한국 시간) 구경거리 1번 보장', () => {
  const W = F.gonu.forceWithinGameHours;
  /** 한국 시간 2026-10-d h:mi → ms */
  const kst = (d: number, h: number, mi = 0) => Date.UTC(2026, 9, d, h - 9, mi);
  /** 게임 시각 h시 m분으로 */
  const setHour = (h: number, m = 5) => void (S.clock = ((h - CONFIG.clock.dayStartHour + 24) % 24) * 60 + m);
  const guests = () => {
    mk();
    mk();
  };
  const nowAt = (t: number) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(t);
  };

  it('목표 2번 그대로 · 보장 창은 게임 1시간 (옛 23시 강제는 없음)', () => {
    expect(F.gonu.events).toBe(2);
    expect(W).toBe(1);
    expect('forceHour' in F.gonu).toBe(false);
  });
  it('오늘 사건이 없으면 오늘 첫 세션 게임 1시간 안에 확률 없이 1번', () => {
    nowAt(kst(14, 12));
    guests();
    setHour(10);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    tickSpectacle(true);
    expect(spectacles.length).toBe(1);
    expect(P.five.specKst).toBe('2026-10-14');
    expect(P.five.sessKst).toBe('2026-10-14');
    expect(fiveSpecForce()).toBe(false);
    S.clock += 20;
    tickSpectacle(true);
    expect(spectacles.length).toBe(1);
  });
  it('마을을 안 보고 있었으면 그 1시간 안에서 다시 시도 (매시 굴림이 안 걸려도)', () => {
    nowAt(kst(14, 12));
    guests();
    setHour(10, 10);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    tickSpectacle(false);
    expect(spectacles.length).toBe(0);
    S.clock += 40; // 같은 게임 시 · 시작 뒤 40분
    tickSpectacle(true);
    expect(spectacles.length).toBe(1);
  });
  it('세션 시작 뒤 게임 1시간이 지나면 보장 끝', () => {
    nowAt(kst(14, 12));
    guests();
    setHour(10);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    tickSpectacle(false);
    S.clock += W * 60 + 1;
    expect(fiveSpecForce()).toBe(false);
    tickSpectacle(true);
    expect(spectacles.length).toBe(0);
  });
  it('게임 밤(07시 전)에도 보장 사건은 생긴다', () => {
    nowAt(kst(14, 21));
    guests();
    setHour(2);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    tickSpectacle(true);
    expect(spectacles.length).toBe(1);
  });
  it('오늘(한국 날짜) 이미 사건이 있었으면 보장 없음', () => {
    nowAt(kst(14, 12));
    P.five.specKst = '2026-10-14';
    guests();
    setHour(10);
    expect(fiveSpecForce()).toBe(false);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    tickSpectacle(true);
    expect(spectacles.length).toBe(0);
  });
  it('어제 사건은 오늘 보장을 막지 않는다', () => {
    nowAt(kst(14, 12));
    P.five.specKst = '2026-10-13';
    expect(fiveSpecForce()).toBe(true);
  });
  it('한국 시간 날짜 경계: 23:59에 생긴 사건은 00:01의 새 날 보장을 막지 않는다 (now 주입)', () => {
    setHour(10);
    expect(fiveSpecForce(kst(14, 23, 59))).toBe(true);
    fiveSpecSeen(kst(14, 23, 59));
    expect(P.five.specKst).toBe('2026-10-14');
    expect(fiveSpecForce(kst(14, 23, 59))).toBe(false);
    // 세션이 자정을 넘어 이어져도 새 한국 날짜의 첫 호출이 새 세션 시작
    S.clock += 2;
    expect(fiveSpecForce(kst(15, 0, 1))).toBe(true);
    expect(P.five.sessKst).toBe('2026-10-15');
    // UTC로는 같은 날(14:59 / 15:01 UTC)이라도 한국 날짜로 갈린다
    expect(new Date(kst(14, 23, 59)).getUTCDate()).toBe(new Date(kst(15, 0, 1)).getUTCDate());
  });
  it('부탁을 채웠거나 · 장이 안 열렸거나 · 플래그 꺼짐이면 보장 없음', () => {
    nowAt(kst(14, 12));
    P.five.done = ['gonu'];
    expect(fiveSpecForce()).toBe(false);
    P.five.done = [];
    P.five.open = false;
    expect(fiveSpecForce()).toBe(false);
    P.five.open = true;
    setFlag('fiveStars', false);
    expect(fiveSpecForce()).toBe(false);
    guests();
    setHour(10);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    tickSpectacle(true);
    expect(spectacles.length).toBe(0);
  });
  it('옛 저장(새 칸 없음 · 옛 specDay만)은 기본값으로 · 바로 보장 대상', () => {
    const f = P.five as unknown as Record<string, unknown>;
    delete f.specKst;
    delete f.sessKst;
    delete f.sessAt;
    f.specDay = 7;
    const s = fiveState();
    expect(s.specKst).toBe('');
    expect(s.sessKst).toBe('');
    expect(s.sessAt).toBe(0);
    nowAt(kst(14, 12));
    expect(fiveSpecForce()).toBe(true);
  });
});
