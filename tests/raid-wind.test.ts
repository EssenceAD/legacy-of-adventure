// v0.24.2: 「전쟁의 소문」 바람 보정(+15%)은 전투엔 그대로, 주간 랭킹 기록(submit_raid_score)에선 뺀다
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sent: { damage: number; theory: number; power: number }[] = [];
vi.mock('../src/net/sync', () => ({
  submitRecord: async (rec: { damage: number; theory: number; power: number }) => {
    sent.push(rec);
    return { ok: true, online: true };
  },
}));

import { CONFIG } from '../src/data/config';
import { setFlag } from '../src/world/flags';
import { submitRecord, weeklyTarget } from '../src/world/raid';
import { P, resetProgress } from '../src/world/state';
import { stripWind, windRaid } from '../src/world/wind';

const ex = { power: 1000, chem: 1, affinity: 1, target: 5000, theory: 11500, danger: 1 };

describe('raid record without wind', () => {
  beforeEach(() => {
    resetProgress();
    sent.length = 0;
    setFlag('raidNoWind', true);
  });
  it('stripWind: 피해·이론치를 같은 비율로 나눈다 (서버 상한 검사 그대로 통과)', () => {
    const v = stripWind(11500, 11500, 1.15);
    expect(v).toEqual({ damage: 10000, theory: 10000 });
    expect(stripWind(100, 200, 0)).toEqual({ damage: 100, theory: 200 });
  });
  it('전쟁의 소문: 보낸 기록은 ÷1.15 · noWind 표시', async () => {
    P.story.wind = 'war';
    expect(windRaid()).toBeCloseTo(1 + CONFIG.direction.wind.war.raidDmg);
    const r = await submitRecord(weeklyTarget(), 11500, 'manual', ex);
    expect(r.noWind).toBe(true);
    expect(sent[0].damage).toBe(Math.round(11500 / windRaid()));
    expect(sent[0].theory).toBe(Math.round(11500 / windRaid()));
    expect(sent[0].power).toBe(1000);
    expect(sent[0].damage).toBeLessThanOrEqual(sent[0].theory * CONFIG.raid.recordCap);
  });
  it('다른 바람·플래그 끔이면 그대로', async () => {
    P.story.wind = 'calm';
    let r = await submitRecord(weeklyTarget(), 11500, 'manual', ex);
    expect(r.noWind).toBeUndefined();
    expect(sent[0].damage).toBe(11500);
    P.story.wind = 'war';
    setFlag('raidNoWind', false);
    r = await submitRecord(weeklyTarget(), 11500, 'auto', ex);
    expect(r.noWind).toBeUndefined();
    expect(sent[1].damage).toBe(11500);
    setFlag('raidNoWind', true);
  });
});
