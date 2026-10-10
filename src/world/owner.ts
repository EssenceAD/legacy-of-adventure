// 4단계(주인공 · 인연 · 엔딩) 자리만 잡아 둔다. 지금은 모두 0.
// 4단계 명세: 주인 능력치는 전투력에 「주인 보너스 최대 +15%」로만, 인연 단계는 영웅 전투력 +2%/단계.
import type { Actor } from './state';

/** 주인 능력치 보너스 (0 ~ 0.15). 4단계에서 체력·요리·말솜씨·손재주·담력·마음으로 계산 */
export const OWNER_BONUS_MAX = 0.15;
export function ownerBonus(): number {
  return 0;
}

/** 인연(호감도) 단계 보너스: 단계 × 2% (4단계). 지금은 0 */
export const BOND_TIER_PCT = 0.02;
export function bondTierBonus(_a: Actor): number {
  return 0;
}
