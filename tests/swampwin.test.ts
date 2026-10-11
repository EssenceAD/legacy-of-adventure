// HOTFIX14 §6: 장부 5장 「버섯 늪 원정 3번」이 사냥으로는 안 올라가 막히던 것 — 의뢰 성공 + 사냥 돌파를 같이 센다
import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/guide';
import { missionProgress } from '../src/world/guide';
import { P } from '../src/world/state';

const step = CHAPTERS.flatMap((c) => c.missions).find((m) => m.id === 'c5_swampwin')!;
describe('버섯 늪 3번', () => {
  it('사냥만 한 저장(버섯 늪 2-5까지 돌파 · 의뢰 0번)도 바로 완료', () => {
    (P.counters.regionWins as Record<string, number>).swamp = 0;
    P.hunt.best = { forest: 10, swamp: 5 };
    expect(missionProgress(step).done).toBe(true);
  });
  it('의뢰 2번 + 사냥 1스테이지 = 3', () => {
    (P.counters.regionWins as Record<string, number>).swamp = 2;
    P.hunt.best = { forest: 10, swamp: 1 };
    expect(missionProgress(step).done).toBe(true);
  });
  it('둘 다 없으면 0/3', () => {
    (P.counters.regionWins as Record<string, number>).swamp = 0;
    P.hunt.best = { forest: 10 };
    expect(missionProgress(step)).toMatchObject({ cur: 0, need: 3, done: false });
  });
  it('제목에서 「원정」을 빼고 의뢰·사냥 둘 다 적음', () => {
    expect(step.title).not.toMatch(/원정/);
    expect(step.title).toMatch(/의뢰/);
    expect(step.title).toMatch(/사냥/);
  });
});
