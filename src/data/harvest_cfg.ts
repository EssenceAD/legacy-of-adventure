// HARVEST_SPEC §1·§2 + CHECKIN §D (D1 오늘의 장부 · D2 여관 연감) 숫자 — config.ts를 크게 건드리지 않게 따로 둔다
//  날짜는 전부 한국 시간 실제 시각 (기기 시계가 아니라 서버 시각 · world/harvest.ts hvNow)
import { HARVEST_DATES } from './story/harvest';

export const HV = {
  /** 1-1 기간 · 교환소는 3일 더 · 마지막 밤(11/5 KST) */
  from: Date.parse(HARVEST_DATES.from),
  to: Date.parse(HARVEST_DATES.to),
  shopUntil: Date.parse(HARVEST_DATES.shopUntil),
  finaleDay: '2026-11-5',
  /** 1-4 무리 하나가 나올 때 그중 하나를 호박 도깨비로 */
  pumpkinChance: 0.1,
  /** 맡겨 두기(전투 없이 30초마다 한 판)는 판마다 이 확률로 한 마리 (전투 화면 판은 무리마다 pumpkinChance) */
  autoPumpkinChance: 0.1,
  /** 누적 n마리마다 다음 사냥에 황금 호박 대왕 (지역 보스 체력×hp · 공격×atk) */
  kingEvery: 15,
  kingHp: 0.6,
  kingAtk: 0.8,
  /** 처치 목표의 이만큼을 채우면 대왕이 나온다 */
  kingAt: 0.4,
  /** 리본: 호박 1 (지역 6~10은 2) · 대왕 10 · 원정 성공 1 (30분 이상 2) */
  ribbonPumpkin: 1,
  ribbonPumpkinHi: 2,
  hiRegion: 5,
  ribbonKing: 10,
  ribbonExp: 1,
  ribbonExpLong: 2,
  expLongMin: 30,
  /** 1-6 호박 수프 · 손님 수확제 대사 섞기 · 소문 섞기 */
  soupFood: 10,
  soupMood: 5,
  lineMix: 0.3,
  rumorMix: 0.25,
  /** 1-3 단풍잎 (화면당) · 1-5 근처 손님 효과 (칸) */
  leaves: 10,
  nearR: 2,
  mapleMood: 3,
  carriageMood: 5,
  tableFood: 5,
};

/** 1-5 수확제 교환소 (리본 값 · 최대 개수) — kind = 꾸미기 장식 종류 */
export interface HvShopItem {
  kind: string;
  name: string;
  cost: number;
  max: number;
  note?: string;
}
export const HV_SHOP: HvShopItem[] = [
  { kind: 'jack_lantern', name: '호박등', cost: 15, max: 6, note: '밤 불빛' },
  { kind: 'leaf_pile', name: '낙엽 더미', cost: 10, max: 6 },
  { kind: 'wheat_sheaf', name: '밀단', cost: 10, max: 6 },
  { kind: 'pumpkins', name: '호박 더미', cost: 15, max: 4 },
  { kind: 'hay_scarecrow', name: '건초 허수아비', cost: 25, max: 2 },
  { kind: 'maple', name: '단풍나무', cost: 30, max: 4, note: '근처 손님 기분 +3' },
  { kind: 'lantern_post', name: '등불 기둥', cost: 30, max: 4, note: '밤 불빛' },
  { kind: 'harvest_cart', name: '수확 수레', cost: 40, max: 1 },
  { kind: 'harvest_table', name: '수확제 잔칫상', cost: 40, max: 1, note: '근처 손님 포만 +5/시간' },
  { kind: 'harvest_arch', name: '수확제 아치', cost: 60, max: 1 },
  { kind: 'pumpkin_carriage', name: '호박 마차', cost: 150, max: 1, note: '2×2 · 밤 등불 · 근처 손님 기분 +5' },
];
/** 수확제에서 새로 생긴 장식 (교환소·연감으로만 얻는다 · 건설 목록엔 받은 게 있을 때만) */
export const HV_NEW_DECO = ['jack_lantern', 'leaf_pile', 'wheat_sheaf', 'lantern_post', 'harvest_table', 'harvest_arch', 'pumpkin_carriage'];

// ───────── CHECKIN §D1 오늘의 장부 ─────────
export const DAYBOOK = {
  /** 하루 후보 6 · 고르기 3 */
  cands: 6,
  pick: 3,
  /** 하나 끝낼 때마다: 금화 = gold × (최고 지역 번호 + 1) · 그 지역 재료 mats */
  gold: 60,
  mats: 3,
  /** 셋 다 하면 연감 도장 */
  stamps: 3,
  /** 이번 주 장부: 완료 누적 7·14·21에 상자 */
  week: [7, 14, 21],
};

// ───────── CHECKIN §D2 여관 연감 시즌 1 (= 수확제 + 정리 3일) ─────────
export const ALMANAC = {
  season: 'hv1',
  name: '여관 연감 · 시즌 1 수확제',
  from: Date.parse(HARVEST_DATES.from),
  to: Date.parse(HARVEST_DATES.shopUntil),
  /** 마지막 주(이 시각부터) 도장 ×2 */
  catchUp: Date.parse('2026-11-02T00:00:00+09:00'),
  cells: 30,
  /** 한 칸 = 도장 n개 */
  perCell: 2,
  /** 다음 시즌으로 넘기는 비율 (못 채웠으면 모은 도장의 30% · 다 채웠으면 넘친 도장의 30%) */
  carry: 0.3,
  title: '수확의 주인',
};
/** 연감 칸 보상 (1~30) — 장식·칭호·재료·스킬 책 위주, 금화는 적게 */
export type AlmanacReward =
  | { k: 'mats'; n: number }
  | { k: 'dust'; n: number }
  | { k: 'shards'; n: number }
  | { k: 'gold'; n: number }
  | { k: 'book'; n: number }
  | { k: 'whet'; n: number }
  | { k: 'charm'; n: number }
  | { k: 'ribbon'; n: number }
  | { k: 'tokens'; n: number }
  | { k: 'deco'; kind: string; title?: string };
export const ALMANAC_CELLS: AlmanacReward[] = [
  { k: 'mats', n: 5 }, { k: 'dust', n: 20 }, { k: 'shards', n: 3 }, { k: 'gold', n: 100 }, { k: 'book', n: 1 },
  { k: 'mats', n: 8 }, { k: 'whet', n: 1 }, { k: 'dust', n: 30 }, { k: 'ribbon', n: 10 }, { k: 'deco', kind: 'harvest_cart' },
  { k: 'mats', n: 10 }, { k: 'shards', n: 5 }, { k: 'charm', n: 1 }, { k: 'gold', n: 150 }, { k: 'book', n: 1 },
  { k: 'dust', n: 40 }, { k: 'mats', n: 12 }, { k: 'ribbon', n: 15 }, { k: 'whet', n: 1 }, { k: 'deco', kind: 'harvest_table' },
  { k: 'mats', n: 15 }, { k: 'shards', n: 5 }, { k: 'book', n: 2 }, { k: 'dust', n: 50 }, { k: 'charm', n: 1 },
  { k: 'ribbon', n: 20 }, { k: 'tokens', n: 1 }, { k: 'book', n: 2 }, { k: 'whet', n: 2 }, { k: 'deco', kind: 'harvest_arch', title: '수확의 주인' },
];
/** 스킬 책은 §F(훈련장·스킬 강화) 전까지 없다 → 그때까지 한 권 = 최고 지역 재료 n개로 바꿔 준다 */
export const BOOK_AS_MATS = 10;
