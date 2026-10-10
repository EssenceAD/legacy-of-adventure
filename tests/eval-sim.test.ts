// 평가단 일주일 시뮬레이션 (밤샘 ④-2): 「성실히 하면 실버, 어울림을 노리면 골드」가 맞는지 — 테마 4개 모두
//  중반 플레이어(장부 3~4장 · 땅 3 · 손님 6) 한 주를 숫자로 놓고 점수 재료 공식(min(1, 값/필요)×만점)에 넣는다.
//  잰 값: 손님 4명이 현실 30분에 주점 식사 15번, 손님 평균 기분 98 (개발 서버에서 게임을 빨리 돌려 측정)
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { tierOf } from '../src/world/evaluation';

const E = CONFIG.evaluation;
type Week = Record<string, number>;
const pts = (part: number[], v: number) => Math.round(Math.min(1, v / part[0]) * part[1]);
function score(theme: 'gourmet' | 'relax' | 'adventure' | 'scenery', w: Week): number {
  const T = E[theme] as Record<string, number[]>;
  return Object.entries(T).reduce((s, [k, part]) => s + pts(part, w[k] ?? 0), 0);
}
/** 성실: 하루 두 번 · 30분씩 · 할 일은 다 하지만 어울림은 우연히 생긴 1개쯤 */
const diligent: Week = {
  meals: (15 / 4) * 6 * 7, harvests: 3 * 2 * 7, mood: 92, harmonies: 1,
  decos: 9, wins: 2 * 6 * 7, huntBest: 15, trains: 35, raids: 3 * 7,
  kinds: 6, found: 5, grade: 3, roofs: 2,
};
/** 어울림을 노림: 성실 + 그 주 테마 어울림을 일부러 맞춰 놓고 장식·지붕 색도 챙김 */
const harmony: Week = { ...diligent, harmonies: 4, decos: 13, kinds: 8, found: 10, roofs: 4 };
const name = (s: number) => ['없음', '브론즈', '실버', '골드', '전설'][tierOf(s)];

describe('평가단 한 주', () => {
  for (const t of ['gourmet', 'relax', 'adventure', 'scenery'] as const) {
    it(`${t}: 성실 → 실버 · 어울림 → 골드`, () => {
      const a = score(t, diligent);
      const b = score(t, harmony);
      console.log(`${t}: 성실 ${a}(${name(a)}) · 어울림 ${b}(${name(b)})`);
      expect(name(a)).toBe('실버');
      expect(name(b)).toBe('골드');
    });
  }
});
