// LUXE §3 마을 회관 — 방 완성 영구 보상 (다른 모듈이 부르는 작은 함수들 · 순환 import 없게 state·visual·숫자만 본다)
//  플래그 bundles(또는 실험실)가 꺼지면 전부 0 / 그대로 → 예전과 완전히 같다
import { LUXE } from '../data/luxe_cfg';
import { P } from './state';
import { vis } from './visual';

const K = () => LUXE.bundles.perks;
/** 켜졌나: 플래그(모두) 또는 실험실(이 기기) */
export const bdOn = (): boolean => vis('bundles');
/** 그 방을 완성했고 기능이 켜졌나 */
export const roomPerk = (id: string): boolean => bdOn() && Array.isArray(P.bundles?.rooms) && P.bundles.rooms.includes(id);

/** 주방: 텃밭 작물 식사의 포만·기분 배율 */
export const perkMealMult = () => 1 + (roomPerk('kitchen') ? K().mealQ : 0);
/** 주방: 주점이 연금 예약분은 「물약 재료 남겨 두기」를 꺼도 안 먹는다 */
export const perkKeepAlch = () => roomPerk('kitchen');
/** 약방: 물약 지속 시간 배율 */
export const perkPotionMult = () => 1 + (roomPerk('pharmacy') ? K().potionTime : 0);
/** 대장간: 강화 가루 −5% (내림 · 최소 1) */
export const perkEnhDust = (cost: number) => (roomPerk('smithy') && cost > 0 ? Math.max(1, Math.floor(cost * (1 - K().enhDustCut))) : cost);
/** 대장간: 일괄 강화 예산 +10%p (가진 양 × min(1, 고른 비율 + 이것)) */
export const perkBulkBudget = () => (roomPerk('smithy') ? K().bulkBudget : 0);
/** 물가: 하루 미끼 + */
export const perkBait = () => (roomPerk('water') ? K().bait : 0);
/** 물가: 낚시 판정 창 +초 */
export const perkFishWin = () => (roomPerk('water') ? K().fishWin : 0);
/** 토벌: 하루 도전 + */
export const perkRaidTries = () => (roomPerk('raid') ? K().raidTries : 0);
/** 토벌: 보스 재료 +10% (소수점은 다음 판으로 이월 — 작은 수에서도 평균 +10%) */
export function perkRaidMats(n: number): number {
  if (!roomPerk('raid') || n <= 0) return n;
  const b = P.bundles;
  const v = n * (1 + K().raidMats) + (Number.isFinite(b.carry) ? b.carry : 0);
  const out = Math.floor(v);
  b.carry = Math.round((v - out) * 1000) / 1000;
  return out;
}
/** 쉼터: 자동 사냥 칸 + (huntSlots 칸 최대 위 · huntSlotMax 넘지 않게는 hunt.ts가 자른다) */
export const perkHuntSlot = () => (roomPerk('shelter') ? K().huntSlot : 0);
export const perkHuntSlotMax = () => K().huntSlotMax;
