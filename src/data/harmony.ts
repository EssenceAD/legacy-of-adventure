// 베타 1장: 「어울림」 24개 — 건물·장식이 서로 2칸 이내에 모이면 생긴다 (효과 수치는 config.harmony.fx)
import type { Kind } from './catalog';

/** 한 자리: 이 종류 중 하나 × n개. 첫 자리가 기준(앵커) — 나머지는 앵커에서 2칸 이내 */
export interface HarmonyPart {
  k: Kind[] | 'trophy' | 'plaque';
  n?: number;
}
export interface HarmonyDef {
  id: number;
  name: string;
  parts: HarmonyPart[];
  /** 효과 한 줄 */
  text: string;
  /** 처음부터 이름이 보인다 */
  open?: boolean;
  /** 힌트 1단계 (분위기) */
  hint: string;
  /** TOWN T4: 어울리는 거리 (기본 CONFIG.harmony.range) · 줄 어울림(같은 줄로 N개) · 구역 어울림(땅에 이름표) */
  range?: number;
  shape?: 'line';
  zone?: boolean;
}

const K = (...k: Kind[]) => k;
export const HARMONIES: HarmonyDef[] = [
  { id: 1, name: '흥겨운 밤', parts: [{ k: K('tavern') }, { k: K('fire') }], text: '주점 수입 +20%', open: true, hint: '' },
  { id: 2, name: '우물가 수다', parts: [{ k: K('well') }, { k: K('bench') }], text: '범위 안 손님 기분 +10 · 단골 제안 +10%', open: true, hint: '' },
  { id: 3, name: '대장장이 거리', parts: [{ k: K('smith') }, { k: K('training') }], text: '훈련 경험치 +20%', open: true, hint: '' },
  { id: 4, name: '꽃향기 온천', parts: [{ k: K('bath') }, { k: K('flowerbed') }], text: '온천 기분·회복 +20%', open: true, hint: '' },
  { id: 5, name: '여신의 가호', parts: [{ k: K('inn') }, { k: K('statue') }], text: '숙박 수입 +15% · 매일 평판 +1', open: true, hint: '' },
  { id: 6, name: '장미 정원', parts: [{ k: K('garden') }, { k: K('arbor') }], text: '수확량 +1 · 주변 기분 +5', open: true, hint: '' },
  { id: 7, name: '술통 창고', parts: [{ k: K('tavern') }, { k: K('barrels') }], text: '주점 수입 +15% · 술 취한 손님 사건 ↑', hint: '술 냄새와 나무 냄새가 어울릴지도…' },
  { id: 8, name: '명사수의 마당', parts: [{ k: K('training') }, { k: K('target') }], text: '훈련 경험치 +15% · 의뢰 성공률 +3%p', hint: '화살이 꽂히는 소리가 훈련장에서 들리면…' },
  { id: 9, name: '밤거리', parts: [{ k: K('stall') }, { k: K('lamppost') }], text: '밤(20~04시) 노점 수입 +30%', hint: '해가 져도 장사가 끝나지 않는 곳이 있다면…' },
  { id: 10, name: '광장', parts: [{ k: K('fountain') }, { k: K('bench') }, { k: K('flowerbed') }], text: '매일 평판 +2 · 풍경 점수 +15 (전역)', hint: '물소리 곁에 앉아 꽃을 보는 사람들…' },
  { id: 11, name: '모험가의 문', parts: [{ k: K('gate') }, { k: K('board') }], text: '원정 시간 −10% (전역)', hint: '마을에 들어서자마자 의뢰를 고를 수 있다면…' },
  { id: 12, name: '깃발 아래', parts: [{ k: K('banner') }, { k: K('training') }], text: '토벌·사냥 피해 +5% (전역)', hint: '나부끼는 천 아래서 땀 흘리면 힘이 날 것 같다…' },
  { id: 13, name: '여행자 쉼터', parts: [{ k: K('cottage') }, { k: K('well') }], text: '별채 수입 +15%', hint: '먼 길 온 손님은 방보다 물 한 모금을 먼저 찾는다…' },
  { id: 14, name: '불멍', parts: [{ k: K('fire') }, { k: K('bench') }], text: '밤 손님 기분 +10 · 말 걸기 인연 +1', hint: '불꽃을 오래 바라볼 자리가 있으면 좋겠는데…' },
  { id: 15, name: '장인의 화로', parts: [{ k: K('smith') }, { k: K('barrels') }], text: '강화 성공률 +2%p', hint: '대장장이는 일이 끝나면 꼭 한 잔을 찾는다던데…' },
  { id: 16, name: '별빛 숙소', parts: [{ k: K('inn') }, { k: K('lamppost') }], text: '밤 숙박 수입 +20%', hint: '밤늦게 도착한 손님이 길을 잃지 않으려면…' },
  { id: 17, name: '숲 속 오두막', parts: [{ k: K('cottage') }, { k: K('tree'), n: 3 }], text: '기분 +10 · 풍경 점수 +10', hint: '나무 그늘에 폭 싸인 작은 방…' },
  { id: 18, name: '향신료 텃밭', parts: [{ k: K('garden') }, { k: K('tavern') }], text: '식사 품질 ↑ → 주점 수입 +10%', hint: '갓 딴 채소가 바로 냄비로 들어간다면…' },
  { id: 19, name: '영웅의 기념비', parts: [{ k: K('monument') }, { k: K('statue') }], text: '전설 인연 게이지 +10% (전역)', hint: '옛 영웅의 이야기 곁에 여신이 서 있다면…' },
  { id: 20, name: '트로피 전당', parts: [{ k: 'plaque' }, { k: 'trophy', n: 2 }], text: '토벌 피해 +5% (전역)', hint: '자랑거리는 한데 모아야 빛나는 법…' },
  { id: 21, name: '장터', parts: [{ k: K('fountain') }, { k: K('stall'), n: 2 }], text: '모든 금화 수입 +10% (전역)', hint: '물 긷는 곳 둘레로 좌판이 늘어서면…' },
  { id: 22, name: '수련의 숲', parts: [{ k: K('training') }, { k: K('pine'), n: 2 }], text: '훈련 경험치 +10%', hint: '푸른 바늘잎 사이에서 수련하면 마음이 맑아진다…' },
  { id: 23, name: '온천 마을', parts: [{ k: K('bath') }, { k: K('inn') }, { k: K('flowerbed') }], text: '손님 체류 +1시간 (수입 증가)', hint: '자고 일어나 바로 꽃길 따라 온천에 갈 수 있다면…' },
  // TOWN T4: 줄 · 광장 · 구역 · 여러 채 어울림 (25 ~ 44)
  { id: 25, name: '가로등 길', parts: [{ k: K('lamppost'), n: 5 }], shape: 'line', text: '밤 손님 기분 +5 · 풍경 점수 +5', hint: '불빛이 한 줄로 이어지면 밤길이 무섭지 않아요…' },
  { id: 26, name: '꽃 화분 줄', parts: [{ k: K('tulip_box', 'flowerbed'), n: 4 }], shape: 'line', text: '기분 +5', hint: '꽃을 한 줄로 늘어놓으면 길이 웃어요…' },
  { id: 27, name: '노점 거리', parts: [{ k: K('stall'), n: 3 }], shape: 'line', range: 3, text: '노점 수입 +20%', hint: '노점이 줄지어 서면 사람이 몰려요…' },
  { id: 28, name: '초록 담장', parts: [{ k: K('hedge'), n: 6 }], shape: 'line', text: '풍경 점수 +5', hint: '울타리를 길게 두르면 마을이 단정해져요…' },
  { id: 29, name: '분수 광장', parts: [{ k: K('fountain', 'gold_fountain') }, { k: K('bench', 'rose_bench'), n: 2 }, { k: K('flowerbed', 'tulip_box'), n: 2 }], text: '기분 +10 · 풍경 점수 +5', hint: '물소리 곁에 앉을 자리와 꽃이 둘씩 있으면…' },
  { id: 30, name: '기사의 광장', parts: [{ k: K('knight_statue') }, { k: K('bench', 'rose_bench'), n: 2 }, { k: K('lamppost', 'double_lamp'), n: 2 }], text: '토벌 피해 +3% (전역)', hint: '기사 동상 앞에 쉬어 갈 자리와 불빛을…' },
  { id: 31, name: '시장 거리', parts: [{ k: K('fruit_stall') }, { k: K('flower_cart') }, { k: K('shop_sign') }, { k: K('barrel_stack') }], range: 4, zone: true, text: '모든 금화 수입 +3% (전역)', hint: '과일·꽃 수레·간판·술통이 한 동네에 모이면…' },
  { id: 32, name: '온천 정원', parts: [{ k: K('bath') }, { k: K('rock_fall') }, { k: K('koi_pond', 'lily_pond') }, { k: K('maple', 'cherry') }], range: 4, zone: true, text: '온천 기분·회복 +15%', hint: '온천 곁에 폭포·연못·물든 나무가 있으면…' },
  { id: 33, name: '주택가', parts: [{ k: K('cottage'), n: 3 }, { k: K('picket_gate') }, { k: K('tulip_box', 'flowerbed') }], range: 4, zone: true, text: '별채 수입 +10%', hint: '별채 셋이 모여 흰 울타리 문과 꽃을 두면…' },
  { id: 34, name: '농장 마을', parts: [{ k: K('garden') }, { k: K('chicken_coop') }, { k: K('hay_scarecrow') }, { k: K('harvest_cart') }], range: 4, zone: true, text: '수확량 +1', hint: '텃밭 곁에 닭장·허수아비·수확 수레를…' },
  { id: 35, name: '쌍둥이 주점', parts: [{ k: K('tavern'), n: 2 }], range: 8, text: '주점 손님 기분 +5 · 주점 수입 +5%', hint: '주점이 두 채면 골목이 북적여요…' },
  { id: 36, name: '쌍둥이 온천', parts: [{ k: K('bath'), n: 2 }], range: 8, text: '온천 기분·회복 +10%', hint: '온천이 두 채면… 하나가 사라져도 걱정 없겠죠?' },
  { id: 37, name: '대장간 골목', parts: [{ k: K('smith'), n: 2 }], range: 8, text: '강화 성공률 +1%p', hint: '망치 소리가 두 군데서 울리면…' },
  { id: 38, name: '정자 쉼터', parts: [{ k: K('gazebo') }, { k: K('lily_pond', 'koi_pond') }, { k: K('bench', 'rose_bench') }], text: '기분 +10', hint: '정자 곁 연못과 벤치…' },
  { id: 39, name: '벚꽃길', parts: [{ k: K('cherry'), n: 4 }], shape: 'line', range: 3, text: '풍경 점수 +10', hint: '분홍 나무가 줄지어 서면…' },
  { id: 40, name: '단풍 언덕', parts: [{ k: K('maple'), n: 3 }, { k: K('pumpkins') }], text: '기분 +5 · 풍경 점수 +5', hint: '붉은 잎 사이에 호박 더미를…' },
  { id: 41, name: '작은 동물원', parts: [{ k: K('dog_house') }, { k: K('cat_crate') }, { k: K('birdhouse') }, { k: K('chicken_coop') }], range: 3, text: '말 걸기 인연 +1 · 기분 +5', hint: '강아지·고양이·새·닭이 한자리에…' },
  { id: 42, name: '등불 축제', parts: [{ k: K('string_lights'), n: 2 }, { k: K('double_lamp'), n: 2 }, { k: K('brazier') }], range: 4, zone: true, text: '밤 숙박 수입 +10%', hint: '전구 줄과 쌍가로등, 화로가 함께 밝히면…' },
  { id: 43, name: '풍차 언덕', parts: [{ k: K('windmill') }, { k: K('garden') }, { k: K('hay_scarecrow') }], range: 3, text: '수확량 +1', hint: '바람 도는 언덕 아래 밭과 허수아비…' },
  { id: 44, name: '시계탑 광장', parts: [{ k: K('clock_tower', 'grand_clock') }, { k: K('bench', 'rose_bench'), n: 2 }, { k: K('signpost') }], text: '새 손님 방문 +5% (전역)', hint: '시계탑 아래 벤치 둘과 이정표…' },
  { id: 24, name: '대문 앞 환영', parts: [{ k: K('gate') }, { k: K('lamppost'), n: 2 }], text: '새 손님 방문 +20% (전역)', hint: '큰 문 양옆에 불이 밝혀져 있으면 누구라도 들어오고 싶겠지…' },
];
HARMONIES.sort((a, b) => a.id - b.id);
export const harmonyById = (id: number) => HARMONIES.find((h) => h.id === id)!;
