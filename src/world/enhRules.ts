// GROWTH §3-2: 강화 규칙 (순수 함수 — 실제 강화 · 일괄 강화 · 확률 시뮬레이션이 같이 쓴다)
//  +1~+10: 목표별 성공률 · +7~+10 실패 30% 하락(부적이 막음) · 실패마다 그 장비 +3%p(성공하면 0) · 목표 +9 이하 성공의 3%는 +2
//  +11~+20(초월): 목표별 성공률 · 실패마다 +2%p · 실패해도 단계 유지
import { CONFIG } from '../data/config';

const GE = () => CONFIG.growth.enhance;
const GT = () => CONFIG.growth.transcend;

/** +enh → +enh+1 의 기본 성공률 (보너스·천장 없이) */
export const baseEnhRate = (enh: number) => GE().rates[Math.max(0, Math.min(GE().rates.length - 1, enh))];
/** +enh(10~19) → +enh+1 초월 기본 성공률 */
export const baseTrRate = (enh: number) => GT().rates[Math.max(0, Math.min(GT().rates.length - 1, enh - 10))];

/** 실제 성공률: 기본 1(확정)은 그대로, 나머지는 + 보너스 + 천장 (+ 숫돌) · 최대 1 */
export function enhRateOf(enh: number, bonus: number, pity: number, whet = 0): number {
  const b = baseEnhRate(enh);
  if (b >= 1) return 1;
  return Math.max(0, Math.min(1, b + bonus + pity + whet));
}
export function trRateOf(enh: number, bonus: number, pity: number, whet = 0): number {
  return Math.max(0.05, Math.min(1, baseTrRate(enh) + bonus + pity + whet));
}

export interface EnhRoll {
  /** 결과 강화 단계 */
  enh: number;
  /** 다음 천장 값 */
  pity: number;
  ok: boolean;
  great: boolean;
  /** 실패로 1단계 떨어졌나 · 부적이 막았나 */
  drop: boolean;
  saved: boolean;
}

/** 강화 한 번 (+1~+10) — rng는 시험·시뮬레이션용 */
export function rollEnhance(enh: number, pity: number, bonus: number, o: { whet?: boolean; charm?: boolean } = {}, rng: () => number = Math.random): EnhRoll {
  const g = GE();
  const rate = enhRateOf(enh, bonus, pity, o.whet ? CONFIG.growth.whet.add : 0);
  const target = enh + 1;
  if (rng() < rate) {
    const great = target <= g.greatMax && rng() < g.great;
    return { enh: Math.min(CONFIG.smith.maxEnhance, enh + (great ? 2 : 1)), pity: 0, ok: true, great, drop: false, saved: false };
  }
  const np = rate >= 1 ? pity : pity + g.pity;
  if (target >= g.dropFrom && rng() < g.dropChance) {
    if (o.charm) return { enh, pity: np, ok: false, great: false, drop: false, saved: true };
    return { enh: enh - 1, pity: np, ok: false, great: false, drop: true, saved: false };
  }
  return { enh, pity: np, ok: false, great: false, drop: false, saved: false };
}

/** 초월 한 번 (+11~+20) */
export function rollTranscend(enh: number, pity: number, bonus: number, o: { whet?: boolean } = {}, rng: () => number = Math.random): { enh: number; pity: number; ok: boolean } {
  const rate = trRateOf(enh, bonus, pity, o.whet ? CONFIG.growth.whet.add : 0);
  if (rng() < rate) return { enh: enh + 1, pity: 0, ok: true };
  return { enh, pity: pity + GT().pity, ok: false };
}
