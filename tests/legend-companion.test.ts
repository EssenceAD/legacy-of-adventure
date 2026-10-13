// v0.25.2 버그: 방문 중인 전설(루나)도 의뢰·사냥 파티에 「동행」 — 루나 부탁 「루나를 파티에 넣고 숲 의뢰 성공」을 깰 수 있게
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAdventurer } from '../src/world/adventurers';
import { regularsCount } from '../src/world/actors';
import { canSend, isCompanion, partyEligible, resolveRun, sendParty } from '../src/world/expeditions';
import { huntCrew } from '../src/world/hunt';
import { setFlag } from '../src/world/flags';
import { tickLegends } from '../src/world/legends';
import { P, resetProgress, world, type Actor, type Quest } from '../src/world/state';

const mk = (o: Partial<Actor>) => {
  const a = makeAdventurer(5, 5, { status: 'regular', ...o } as never);
  a.id = P.nextAdvId++;
  a.hp = 100;
  world.actors.push(a);
  return a;
};
let luna: Actor;
beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div><div id="over"></div>';
  world.actors = [];
  P.legends.luna = { st: 'visit', gauge: 100, until: Date.now() + 2 * 864e5, prog: 0 };
  luna = mk({ status: 'visitor', kind: 'rogue' } as never);
  luna.legendId = 'luna';
  luna.name = '루나';
});
afterEach(() => {
  setFlag('legendCompanion', true);
  vi.restoreAllMocks();
});

describe('방문 중인 전설 = 동행', () => {
  it('의뢰·사냥 파티에 낄 수 있다 · 단골 자리 수엔 안 셈', () => {
    expect(isCompanion(luna)).toBe(true);
    expect(partyEligible(luna)).toBe(true);
    expect(canSend(luna)).toBeNull();
    expect(huntCrew()).toContain(luna);
    expect(regularsCount()).toBe(0);
    // 그냥 방문 손님은 여전히 못 감
    const v = mk({ status: 'visitor' } as never);
    expect(canSend(v)).toBe('방문 손님은 원정에 못 가요');
  });
  it('플래그 끄면 예전처럼 못 감', () => {
    setFlag('legendCompanion', false);
    expect(canSend(luna)).toBe('방문 손님은 원정에 못 가요');
    expect(huntCrew()).not.toContain(luna);
  });
  it('루나와 숲 의뢰 성공 → 부탁 완료(동료) · 다녀와도 방문객이던 상태에서 영웅으로', () => {
    const b = mk({ kind: 'knight' } as never);
    const q: Quest = { id: 99, region: 'forest', tier: 1, power: 1, minutes: 1, gold: [10, 20] };
    P.quests.list = [q];
    const run = sendParty(q, [luna, b]);
    expect(typeof run).not.toBe('string');
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    resolveRun(run as never, []);
    expect(P.legends.luna.st).toBe('joined');
    expect(luna.status).toBe('hero');
  });
  it('방문 시간은 계속 흐름 · 원정 중에 끝나면 돌아온 뒤에 떠난다', () => {
    luna.runId = 7;
    P.legends.luna.until = Date.now() - 1000;
    tickLegends();
    expect(P.legends.luna.st).toBe('visit');
    luna.runId = null;
    tickLegends();
    expect(P.legends.luna.st).toBe('rumor');
  });
});
