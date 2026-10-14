// FIVESTARS 부탁 규칙 바꿈: 왈왈 「밤 출발」 = 현실 밤 또는 게임 안 밤(보낼 때 기록) · 고느끼 부탁 중 게임 하루 구경거리 1번 보장(그날 마지막 기회)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { makeAdventurer } from '../src/world/adventurers';
import { resolveRun, sendParty } from '../src/world/expeditions';
import { fiveNightWin, fiveSpecForce, fiveState, walwalNightRun } from '../src/world/fivestars';
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

describe('고느끼: 게임 하루 구경거리 1번 보장', () => {
  const H = F.gonu.forceHour;
  /** 게임 시각 h시로 */
  const setHour = (h: number) => void (S.clock = (((h - CONFIG.clock.dayStartHour + 24) % 24) * 60) + 5);
  const guests = () => {
    mk();
    mk();
  };

  it('목표 2번 그대로 · 마지막 기회는 23시', () => {
    expect(F.gonu.events).toBe(2);
    expect(H).toBe(23);
  });
  it('그날 사건이 없으면 마지막 기회에 확률 없이 생긴다', () => {
    guests();
    setHour(H);
    expect(fiveSpecForce(H)).toBe(true);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    tickSpectacle(true);
    expect(spectacles.length).toBe(1);
    expect(P.five.specDay).toBe(S.day);
    expect(fiveSpecForce(H)).toBe(false);
  });
  it('마을을 안 보고 있었으면 그 시간 안에서 다시 시도', () => {
    guests();
    setHour(H);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    tickSpectacle(false);
    expect(spectacles.length).toBe(0);
    tickSpectacle(true);
    expect(spectacles.length).toBe(1);
  });
  it('마지막 기회가 아닌 시간엔 보장 없음', () => {
    expect(fiveSpecForce(H - 1)).toBe(false);
    guests();
    setHour(H - 1);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    tickSpectacle(true);
    expect(spectacles.length).toBe(0);
  });
  it('그날 이미 사건이 있었으면 보장 없음', () => {
    P.five.specDay = S.day;
    guests();
    setHour(H);
    expect(fiveSpecForce(H)).toBe(false);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    tickSpectacle(true);
    expect(spectacles.length).toBe(0);
  });
  it('어제 사건은 오늘 보장을 막지 않는다', () => {
    P.five.specDay = S.day - 1;
    expect(fiveSpecForce(H)).toBe(true);
  });
  it('부탁을 채웠거나 · 장이 안 열렸거나 · 플래그 꺼짐이면 보장 없음', () => {
    P.five.done = ['gonu'];
    expect(fiveSpecForce(H)).toBe(false);
    P.five.done = [];
    P.five.open = false;
    expect(fiveSpecForce(H)).toBe(false);
    P.five.open = true;
    setFlag('fiveStars', false);
    expect(fiveSpecForce(H)).toBe(false);
    guests();
    setHour(H);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    tickSpectacle(true);
    expect(spectacles.length).toBe(0);
  });
  it('옛 저장(specDay 없음)은 0으로', () => {
    delete (P.five as Partial<typeof P.five>).specDay;
    expect(fiveState().specDay).toBe(0);
  });
});
