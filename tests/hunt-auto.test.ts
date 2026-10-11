// 핫픽스 10 §11: 사냥 「맡겨 두기」 — 수치는 그대로, 보이는 것·미션 판정만
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { MISSIONS } from '../src/data/guide';
import { missionProgress } from '../src/world/guide';
import { autoTick, recPower, setAuto, stopAuto } from '../src/world/hunt';
import { P, S, world, type Actor } from '../src/world/state';
import { makeAdventurer } from '../src/world/adventurers';

const strong = (): Actor[] => [1, 2, 3].map(() => makeAdventurer(5, 5, { lvl: 60, status: 'regular' }));

beforeEach(() => {
  P.hunt.best = { forest: 3 };
  P.hunt.auto = null;
  P.counters.huntAutoUsed = 0;
  S.started = true as never;
  S.visiting = false as never;
  world.actors = strong();
});

describe('맡겨 두기', () => {
  it('안 깬 스테이지는 못 맡김 · 미션도 안 셈', () => {
    expect(setAuto('forest', 5, world.actors)).toMatch(/깬 스테이지/);
    expect(P.counters.huntAutoUsed).toBe(0);
  });
  it('맡기면 「사냥 맡겨 두기」 미션 완료', () => {
    const m = MISSIONS.find((x) => x.id === 'c2_auto')!;
    expect(m.title).toBe('사냥 맡겨 두기');
    expect(missionProgress(m).done).toBe(false);
    expect(setAuto('forest', 1, world.actors)).toBeNull();
    expect(missionProgress(m).done).toBe(true);
  });
  it('전투 안 AUTO 버튼은 미션을 세지 않는다 (소스)', () => {
    expect(fs.readFileSync('src/combat/ui.ts', 'utf8')).not.toMatch(/noteAutoUsed/);
  });
  it('한 판마다 판 수 · 금화가 쌓이고, 수치(30초 간격)는 그대로', () => {
    expect(CONFIG.hunt.autoSeconds).toBe(30);
    expect(recPower('forest', 1)).toBeGreaterThan(0);
    setAuto('forest', 1, world.actors);
    const t0 = P.hunt.idleAt;
    expect(autoTick(t0 + 10_000)).toBeNull();
    const r1 = autoTick(t0 + 30_000)!;
    const r2 = autoTick(t0 + 60_000)!;
    expect(P.hunt.auto!.n).toBe(2);
    expect(P.hunt.auto!.gold).toBe(r1.gold + r2.gold);
    stopAuto();
    expect(P.hunt.auto).toBeNull();
  });
});
