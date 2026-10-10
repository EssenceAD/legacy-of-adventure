// 전투: 피해 공식 · 연타 보너스 상한 · 평가 경계 · 소탕 70% · AUTO면 보너스 없음
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { gradeBonus, gradeOf, gradeScore, hitBonus, mobBaseHp } from '../src/combat/field';

const C = CONFIG.combat;
describe('전투', () => {
  it('연타: 10HIT마다 +1%, 최대 +10%', () => {
    expect(hitBonus(0)).toBe(0);
    expect(hitBonus(9)).toBe(0);
    expect(hitBonus(10)).toBeCloseTo(0.01);
    expect(hitBonus(57)).toBeCloseTo(0.05);
    expect(hitBonus(100)).toBeCloseTo(0.1);
    expect(hitBonus(999)).toBeCloseTo(0.1);
  });
  it('피해 공식: 추천 전투력이면 잡몹은 기본 공격 2~3대', () => {
    for (const s of [1, 5, 9]) {
      const rec = 300 * s;
      const hit = (rec / 3) * C.dmgK; // 내가 추천 전투력(1/3 파티)으로 1단 한 대
      const hits = mobBaseHp(rec, s, rec / 3) / hit;
      expect(hits).toBeGreaterThanOrEqual(2);
      expect(hits).toBeLessThanOrEqual(3);
    }
  });
  it('추천보다 아주 세면 몹도 조금 버티지만 더 빨리 잡힌다', () => {
    const rec = 900;
    const strong = mobBaseHp(rec, 3, (rec / 3) * 4) / ((rec / 3) * 4 * C.dmgK);
    expect(strong).toBeLessThan(mobBaseHp(rec, 3, rec / 3) / ((rec / 3) * C.dmgK));
  });
  it('평가 경계: 점수 90↑ S · 70↑ A · 그 아래 B', () => {
    expect(gradeOf(C.grade.s)).toBe('S');
    expect(gradeOf(C.grade.s - 0.01)).toBe('A');
    expect(gradeOf(C.grade.a)).toBe('A');
    expect(gradeOf(C.grade.a - 0.01)).toBe('B');
    // 안 맞고 빨리 끝내고 KILLS 20 → S · 많이 맞으면 B
    expect(gradeOf(gradeScore(0, 0.3, 20))).toBe('S');
    expect(gradeOf(gradeScore(15, 0.6, 5))).toBe('B');
  });
  it('소탕 70% · 자동 토벌 70%', () => {
    expect(C.sweep).toBe(0.7);
    expect(C.raidAuto).toBe(0.7);
  });
  it('AUTO를 쓰면 평가 보너스 없음 · 지면 없음', () => {
    expect(gradeBonus(true, false, 'S')).toBe(C.grade.bonus.S);
    expect(gradeBonus(true, true, 'S')).toBe(0);
    expect(gradeBonus(false, false, 'S')).toBe(0);
  });
});
