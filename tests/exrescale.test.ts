// 전용 무기 바탕 능력치 = 연 가장 높은 사냥 지역 기준 (6~10 지역을 열어도 별의 심연 기준 공격 246에 머물던 것 · 웅스 10/19)
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { REGIONS } from '../src/data/items';
import { exBaseRegion, exBaseStats, exRescale, makeEx } from '../src/world/exWeapons';
import { P, resetProgress } from '../src/world/state';

beforeEach(() => {
  resetProgress();
  P.guide.legacy = true;
});

describe('전용 무기 지역 기준', () => {
  it('해안~구름 정원까지 열면 바탕 지역도 거기까지 (고유 무기 없는 지역이어도)', () => {
    for (const r of REGIONS.slice(0, 8)) P.hunt.best[r.id] = CONFIG.hunt.stages;
    expect(exBaseRegion()).toBe(REGIONS[8].id);
  });
  it('가진 전용 무기는 더 높은 지역 기준으로 오르고, 강화·옵션은 그대로 · 내려가지는 않음', () => {
    const it0 = makeEx('woongs', () => 0.5, 'abyss')!;
    it0.enh = 18;
    const opts = JSON.stringify(it0.opts);
    P.bag.push(it0);
    for (const r of REGIONS.slice(0, 8)) P.hunt.best[r.id] = CONFIG.hunt.stages;
    expect(exRescale()).toBe(1);
    expect(it0.region).toBe(REGIONS[8].id);
    expect(it0.stats).toEqual(exBaseStats(REGIONS[8].id));
    expect(it0.stats.atk).toBeGreaterThan(246 * 10);
    expect(it0.enh).toBe(18);
    expect(JSON.stringify(it0.opts)).toBe(opts);
    for (const r of REGIONS) P.hunt.best[r.id] = 0;
    expect(exRescale()).toBe(0);
    expect(it0.region).toBe(REGIONS[8].id);
  });
});
