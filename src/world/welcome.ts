// v0.25.4 CHECKIN §C3 「다녀오셨어요」 (플래그 welcomeBack · 실험실)
//  방치 요약(OfflineSummary)을 첫 화면 카드로 · 7일 이상 만이면 「오랜만이에요」 선물 상자
//  선물 = 금화(수입 장부의 하루 평균 × 2) + 예배당 축복 30분 — 「모두 받기」 한 번에 같이 (저장 구조는 그대로: 금화·축복 시간만)
//  스킬 책은 §F(스킬 강화) 뒤에 — 아직 없음
import { addBlessMin } from './goldsink';
import { markDirty, P, S } from './state';

export const LONG_AWAY_DAYS = 7;
export const GIFT_BLESS_MIN = 30;
/** 7일 이상 꺼져 있었나 (현실 초) */
export const longAway = (awaySec: number) => awaySec >= LONG_AWAY_DAYS * 86400;
/** 수입 장부(지난 7일)의 하루 평균 — 장부가 비었으면 0 */
export function avgDailyIncome(week: readonly { gold: number }[] = P.week): number {
  const days = week.slice(-7);
  return days.length ? Math.round(days.reduce((s, d) => s + d.gold, 0) / days.length) : 0;
}
export interface WelcomeGift {
  gold: number;
  blessMin: number;
}
/** 오랜만 선물 (7일 미만이면 null) · 장부가 비었으면 금화는 이번 방치 금화만큼(최소 100) */
export function welcomeGift(awaySec: number, week: readonly { gold: number }[] = P.week, fallback = 0): WelcomeGift | null {
  if (!longAway(awaySec)) return null;
  const avg = avgDailyIncome(week);
  return { gold: Math.max(100, avg > 0 ? avg * 2 : fallback), blessMin: GIFT_BLESS_MIN };
}
/** 「모두 받기」 때 선물 넣기 */
export function grantWelcome(g: WelcomeGift, now = Date.now()) {
  S.gold += g.gold;
  addBlessMin(g.blessMin, now);
  markDirty();
}
