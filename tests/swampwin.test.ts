// HOTFIX14 §6: 장부 5장 「버섯 늪 원정 3번」이 사냥으로는 안 올라가 막히던 것 — 「의뢰 3번 성공 또는 사냥 2-3 돌파」
import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/guide';
import { guideCtx, missionProgress } from '../src/world/guide';
import { P } from '../src/world/state';

const all = CHAPTERS.flatMap((c) => c.missions);
const step = all.find((m) => m.id === 'c5_swampwin')!;
const wins10 = all.find((m) => m.id === 'c4_wins')!;
const setWins = (n: number) => ((P.counters.regionWins as Record<string, number>).swamp = n);
describe('버섯 늪 의뢰 3번 또는 사냥 2-3', () => {
  it('사냥 2-10 돌파 · 의뢰 0회 저장 → 바로 완료', () => {
    setWins(0);
    P.hunt.best = { forest: 10, swamp: 10 };
    expect(missionProgress(step).done).toBe(true);
    expect(step.note!(guideCtx())).toMatch(/의뢰 0\/3 · 사냥 2-3 ✓/);
  });
  it('의뢰 3번만으로도 완료', () => {
    setWins(3);
    P.hunt.best = { forest: 10 };
    expect(missionProgress(step).done).toBe(true);
  });
  it('의뢰 2번 + 사냥 2-2는 아직 (둘 중 하나를 채워야)', () => {
    setWins(2);
    P.hunt.best = { forest: 10, swamp: 2 };
    expect(missionProgress(step)).toMatchObject({ cur: 2, need: 3, done: false });
    expect(step.note!(guideCtx())).toBe('의뢰 2/3 · 사냥 2-2/3');
  });
  it('제목에 「원정」 없음', () => {
    expect(step.title).not.toMatch(/원정/);
    expect(wins10.title).not.toMatch(/원정/);
  });
});

describe('의뢰 성공 + 사냥 첫 돌파 합쳐 10번', () => {
  it('의뢰 4 + 첫 돌파 6 = 10 → 완료', () => {
    P.counters.regionWins = { forest: 4, swamp: 0, mine: 0, ice: 0, abyss: 0 } as never;
    P.hunt.firstClear = ['forest-1', 'forest-2', 'forest-3', 'forest-4', 'forest-5', 'forest-6'];
    expect(missionProgress(wins10).done).toBe(true);
  });
});
