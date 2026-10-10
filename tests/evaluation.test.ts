// 평가단: 테마 순환(서버 계산과 같은지) · 점수 상한 1030 · 등급 경계
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { themeOf, tierOf } from '../src/world/evaluation';

const E = CONFIG.evaluation;
describe('여관 평가단', () => {
  it('테마 순환: 서버와 같은 값 (10-5=2 · 10-12=3 · 10-19=0 · 10-26=1)', () => {
    expect(themeOf('2026-10-5')).toBe(2);
    expect(themeOf('2026-10-12')).toBe(3);
    expect(themeOf('2026-10-19')).toBe(0);
    expect(themeOf('2026-10-26')).toBe(1);
  });
  it('테마마다 재료 만점 합 = 1000 · 암행 보너스 30 → 상한 1030', () => {
    for (const t of ['gourmet', 'relax', 'adventure', 'scenery'] as const) {
      const sum = Object.values(E[t] as Record<string, number[]>).reduce((s, [, max]) => s + max, 0);
      expect(sum).toBe(1000);
    }
    expect(1000 + E.secretBonus).toBe(1030);
  });
  it('등급 경계 300/550/800/950', () => {
    expect(E.tiers).toEqual([300, 550, 800, 950]);
    expect([0, 299, 300, 549, 550, 799, 800, 949, 950, 1030].map(tierOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});
