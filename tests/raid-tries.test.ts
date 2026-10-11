// HOTFIX17 §2: 토벌 도전은 시작할 때 1 차감 · 같은 판은 한 번만 정산 · 남은 도전은 0 아래로 안 내려감 · 피해 복구
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { beginRaid, cancelRaid, expectOf, repairRaidTries, settle, triesLeft, weeklyTarget } from '../src/world/raid';
import { resetProgress, P, S } from '../src/world/state';

const R = CONFIG.raid;
beforeEach(() => {
  resetProgress();
  S.gold = 0;
  S.started = true as never;
});

describe('토벌 도전 횟수', () => {
  it('시작할 때 1 차감 · 하루 한도에서 멈춤 · 0 아래로 안 내려감', () => {
    expect(triesLeft()).toBe(R.triesPerDay);
    const runs: (number | null)[] = [];
    for (let i = 0; i < R.triesPerDay + 3; i++) runs.push(beginRaid());
    expect(runs.filter((r) => r != null).length).toBe(R.triesPerDay);
    expect(triesLeft()).toBe(0);
    expect(P.raid.tries).toBe(R.triesPerDay);
  });
  it('같은 판을 여러 번 정산해도 보상·피해·차감은 한 번', () => {
    const t = weeklyTarget();
    const ex = expectOf([], t.boss);
    const run = beginRaid()!;
    const hp0 = P.raid.hpLeft;
    const a = settle(t, [], 100, 'manual', ex, run);
    const gold1 = S.gold;
    for (let i = 0; i < 5; i++) settle(weeklyTarget(), [], 100, 'manual', ex, run);
    expect(S.gold).toBe(gold1);
    expect(P.raid.hpLeft).toBe(hp0 - a.applied);
    expect(triesLeft()).toBe(R.triesPerDay - 1);
  });
  it('판이 열리지 못하면 차감을 되돌린다 (정산한 판은 안 됨)', () => {
    const run = beginRaid()!;
    cancelRaid(run);
    expect(triesLeft()).toBe(R.triesPerDay);
    const r2 = beginRaid()!;
    settle(weeklyTarget(), [], 10, 'auto', expectOf([], weeklyTarget().boss), r2);
    cancelRaid(r2);
    expect(triesLeft()).toBe(R.triesPerDay - 1);
  });
  it('복구: 이번 패치에서 오늘 횟수를 한 번 돌려주고, 그 뒤엔 한도 넘은 저장만 바로잡음', () => {
    triesLeft();
    P.raid.tries = 5;
    repairRaidTries();
    expect(P.raid.tries).toBe(0);
    expect(P.raid.fix17).toBe(true);
    P.raid.tries = 5;
    repairRaidTries();
    expect(P.raid.tries).toBe(R.triesPerDay - 1);
    expect(triesLeft()).toBe(1);
  });
});
