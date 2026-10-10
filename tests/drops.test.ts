// 드랍: 등급 확률 합 100% · 천장
import { describe, expect, it } from 'vitest';
import { REGIONS } from '../src/data/items';
import { dropChances, pityLimit, rollGrade } from '../src/world/items';
import { P } from '../src/world/state';

describe('장비 드랍', () => {
  it('지역·난이도마다 일반+희귀+영웅+전설 = 100% (일반이 음수가 아님)', () => {
    for (const r of REGIONS)
      for (const tier of [0, 1, 2]) {
        const c = dropChances(r.id, tier);
        const n = 1 - c.r - c.e - c.l;
        expect(n).toBeGreaterThanOrEqual(-1e-9);
        expect(n + c.r + c.e + c.l).toBeCloseTo(1);
      }
  });
  it('천장: 횟수가 차면 전설(심연은 고대도) 확정, 그리고 0으로', () => {
    for (const r of REGIONS) {
      P.pity[r.id] = pityLimit() - 1;
      const g = rollGrade(r.id, 0);
      expect(['l', 'a']).toContain(g);
      expect(P.pity[r.id]).toBe(0);
    }
  });
  it('천장 전에는 굴릴 때마다 1씩 쌓인다 (전설이 나오면 0)', () => {
    P.pity.forest = 0;
    let n = 0;
    for (let i = 0; i < 20; i++) {
      const g = rollGrade('forest', 0);
      n = g === 'l' || g === 'a' ? 0 : n + 1;
      expect(P.pity.forest).toBe(n);
    }
  });
});
