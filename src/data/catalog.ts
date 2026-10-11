// 건물 목록: 이름·발판·가격·손님 행동·레벨업 그림·열리는 땅 단계
import { CONFIG } from './config';

export type Act = 'sleep' | 'drink' | 'forge' | 'bath' | 'train' | 'farm' | 'fire' | 'dungeon';

export interface BuildingDef {
  name: string;
  /** 그림 키 (public/assets/sprites/<키>.png). 모닥불은 코드로 그린다 */
  sprite: string | null;
  /** 발판 [가로, 세로] 타일 */
  size: [number, number];
  cost: number;
  /** 손님 행동 */
  act?: Act;
  /** 장식: 문 앞 칸 검사를 하지 않는다 */
  deco?: boolean;
  /** 하나만 (여관, 던전) */
  unique?: boolean;
  /** 자리 고정 (던전) — 건설 목록에 안 나온다 */
  fixed?: boolean;
  /** 이 땅 단계부터 지을 수 있다 */
  unlock: number;
  /** 2단계: 평판 별이 이만큼 있어야 지을 수 있다 */
  stars?: number;
  /** 레벨업: 더 큰 그림으로. 앞 꼭짓점은 그대로, 뒤로 커진다 */
  up?: { sprite: string; size: [number, number]; cost: number };
  /** 땅 개편: 레벨마다 그림 단계 (from 레벨부터 이 그림·발판). up 은 첫 단계와 같다 */
  stages?: { from: number; sprite: string; size: [number, number] }[];
  /** 땅 개편: 그 레벨(인덱스 = 레벨-1)을 만들려면 필요한 땅 단계 */
  needLand?: number[];
  /** 땅 개편: 레벨별로 무엇이 바뀌는지 (인덱스 = 레벨-1) — 건물 창 「다음 레벨」 한 줄 */
  levelNotes?: string[];
  /** 2단계: 레벨 비용 (Lv.2, Lv.3 … 순서). 길이 + 1 = 최대 레벨 */
  levels?: number[];
  /** 레벨마다 무엇이 좋아지는지 */
  levelText?: string;
  /** 지붕 색을 바꿀 수 있는지 */
  roofable?: boolean;
  desc: string;
}

export const CATALOG = {
  inn: {
    name: '여관 본관', sprite: 'inn', size: [3, 3], cost: 0, act: 'sleep', unique: true, unlock: 1, roofable: true,
    up: { sprite: 'inn3', size: [4, 4], cost: CONFIG.upgrade.inn },
    // 땅 개편: Lv.10까지 · Lv.5 inn5 · Lv.8 inn8 (뒤로 커진다) · 그 사이 레벨은 코드로 덧그리는 장식 (render.ts levelDeco)
    stages: [{ from: 2, sprite: 'inn3', size: [4, 4] }, { from: 5, sprite: 'inn5', size: [5, 5] }, { from: 8, sprite: 'inn8', size: [5, 5] }],
    levels: CONFIG.upgrade.innLevels, needLand: [1, 1, 2, 3, 3, 4, 4, 5, 5, 5], levelText: '방이 늘어요',
    levelNotes: ['', '방 +2 · 더 큰 여관으로', '방 +2 · 문 옆에 등불', '방 +1 · 처마에 등불 줄 · 일꾼 +1 (동시 공사 2곳)', '방 +1 · 종탑과 별관이 생겨요', '방 +1 · 창가에 화분', '방 +1 · 굴뚝 연기가 하나 더', '방 +1 · 탑이 둘 선 큰 여관으로 · 일꾼 +1 (동시 공사 3곳)', '방 +1 · 문 앞에 석등', '방 +1 · 깃발과 금빛 간판'],
    desc: '손님이 묵는 곳. 레벨이 오르면 방이 늘어요',
  },
  cottage: { name: '객실 별채', sprite: 'cottage', size: [2, 2], cost: 300, act: 'sleep', unlock: 4, roofable: true, desc: '방 2칸이 늘어나요' },
  tavern: {
    name: '주점', sprite: 'tavern', size: [3, 3], cost: 400, act: 'drink', unlock: 3, roofable: true,
    up: { sprite: 'tavern2', size: [4, 4], cost: CONFIG.upgrade.tavern },
    // 땅 개편: Lv.6까지 · Lv.4 tavern4 (전구 줄 테라스) · 레벨마다 주점 수입 +15% · Lv.4부터 단골 테이블(케미 ↑)
    stages: [{ from: 2, sprite: 'tavern2', size: [4, 4] }, { from: 4, sprite: 'tavern4', size: [4, 4] }],
    levels: CONFIG.upgrade.tavernLevels, levelText: '주점 수입 +15%',
    levelNotes: ['', '수입 +15% · 더 넓은 주점', '수입 +15% · 테라스 등불', '수입 +15% · 전구 줄 테라스 · 단골 테이블 (케미 ↑)', '수입 +15% · 술통이 쌓여요', '수입 +15% · 깃발과 금빛 간판'],
    desc: '모험가들이 모여 떠들어요 · 케미 발생 ↑',
  },
  smith: { name: '대장간', sprite: 'smith', size: [3, 3], cost: 600, act: 'forge', unlock: 3, stars: 2, roofable: true, levels: CONFIG.smith.levelCosts.slice(1), levelText: '가방 +20칸 · 제작 등급 ↑', desc: '장비 강화 · 파밍한 재료로 제작' },
  bath: { name: '온천', sprite: 'bath', size: [3, 3], cost: 800, act: 'bath', unlock: 5, stars: 3, levels: [1200, 2000, 3200, 5000], levelText: '회복·기분 +15%', desc: '피로 회복 · 기분 ↑' },
  training: { name: '훈련장', sprite: 'training', size: [3, 3], cost: 350, act: 'train', unlock: 3, levels: [400, 700, 1100, 1600, 2200, 3000, 4000], levelText: '수련 경험치 +20%', desc: '모험가 레벨업 · 허수아비를 팹니다' },
  garden: { name: '텃밭', sprite: 'garden', size: [3, 3], cost: 200, act: 'farm', unlock: 3, levels: [300, 600, 1000, 1600, 2400], levelText: '2레벨마다 밭 +1칸', desc: '식재료 수확 · 식사 품질 ↑' },
  well: { name: '우물', sprite: 'well', size: [1, 1], cost: 80, deco: true, unlock: 1, desc: '마을 장식 · 주변 기분 +' },
  board: { name: '의뢰 게시판', sprite: 'board', size: [1, 1], cost: 120, deco: true, unlock: 3, levels: [300, 800, 1600], levelText: '동시에 보낼 파티 +1', desc: '의뢰를 받아 던전에 나가요' },
  tree: { name: '나무', sprite: 'tree', size: [1, 1], cost: 20, deco: true, unlock: 2, desc: '장식' },
  pine: { name: '소나무', sprite: 'pine', size: [1, 1], cost: 20, deco: true, unlock: 2, desc: '장식' },
  fire: { name: '모닥불', sprite: null, size: [1, 1], cost: 60, deco: true, act: 'fire', unlock: 1, desc: '밤이면 손님들이 둘러앉아요' },
  // 3단계: 보스 첫 처치 트로피 (장식, 무료, 처치한 보스만). 그림은 보스 그림으로 코드에서 만든다
  // 베타 1장: 어울림 장식 (열리는 조건은 world/harmony.ts decoLock)
  bench: { name: '벤치', sprite: 'bench', size: [1, 1], cost: 60, deco: true, unlock: 1, desc: '앉아 쉬는 자리 · 어울림 재료' },
  thanks_basket: { name: '감사 꽃바구니', sprite: 'flowerbed', size: [1, 1], cost: 0, deco: true, unlock: 1, desc: '업데이트 선물 · 보기만 해도 기분 좋아요' },
  flowerbed: { name: '꽃밭', sprite: 'flowerbed', size: [1, 1], cost: 80, deco: true, unlock: 1, desc: '꽃향기 · 어울림 재료' },
  barrels: { name: '술통 더미', sprite: 'barrels', size: [1, 1], cost: 120, deco: true, unlock: 1, desc: '주점 뒷마당 냄새 · 어울림 재료' },
  target: { name: '과녁', sprite: 'target', size: [1, 1], cost: 150, deco: true, unlock: 1, desc: '활 연습 · 어울림 재료' },
  arbor: { name: '장미 아치', sprite: 'arbor', size: [1, 1], cost: 200, deco: true, unlock: 1, desc: '장미 넝쿨 문 · 어울림 재료' },
  lamppost: { name: '가로등', sprite: 'lamppost', size: [1, 1], cost: 150, deco: true, unlock: 1, desc: '밤길을 밝혀요 · 어울림 재료' },
  statue: { name: '여신상', sprite: 'statue', size: [1, 1], cost: 400, deco: true, unlock: 1, desc: '여행자를 지키는 여신 · 어울림 재료' },
  stall: { name: '노점', sprite: 'stall', size: [2, 2], cost: 500, deco: true, unlock: 1, desc: '지나가는 손님이 들러 금화를 내요' },
  fountain: { name: '분수', sprite: 'fountain', size: [2, 2], cost: 900, deco: true, unlock: 1, desc: '마을 광장의 상징 · 어울림 재료' },
  banner: { name: '깃발', sprite: 'banner', size: [1, 1], cost: 200, deco: true, unlock: 1, desc: '토벌 기념 깃발 · 어울림 재료' },
  gate: { name: '정문', sprite: 'gate', size: [2, 2], cost: 1500, deco: true, unique: true, unlock: 1, desc: '마을 입구 길 위에만 · 손님이 지나다녀요' },
  plaque_bronze: { name: '평가 현판 (브론즈)', sprite: 'plaque_bronze', size: [2, 2], cost: 0, deco: true, unique: true, unlock: 1, desc: '여관 평가단 브론즈 기념' },
  plaque_silver: { name: '평가 현판 (실버)', sprite: 'plaque_silver', size: [2, 2], cost: 0, deco: true, unique: true, unlock: 1, desc: '여관 평가단 실버 기념' },
  plaque_gold: { name: '평가 현판 (골드)', sprite: 'plaque_gold', size: [2, 2], cost: 0, deco: true, unique: true, unlock: 1, desc: '여관 평가단 골드 기념' },
  trophy_boar: { name: '거대 너구리 꼬리', sprite: 'trophy_boar', size: [1, 1], cost: 0, deco: true, unique: true, unlock: 1, desc: '첫 처치 트로피 · 이웃이 방문하면 보여요' },
  trophy_mushroom: { name: '왕슬라임 왕관', sprite: 'trophy_mushroom', size: [1, 1], cost: 0, deco: true, unique: true, unlock: 1, desc: '첫 처치 트로피 · 이웃이 방문하면 보여요' },
  trophy_golem: { name: '붉은 무사 투구', sprite: 'trophy_golem', size: [1, 1], cost: 0, deco: true, unique: true, unlock: 1, desc: '첫 처치 트로피 · 이웃이 방문하면 보여요' },
  trophy_wyvern: { name: '텐구 가면', sprite: 'trophy_wyvern', size: [1, 1], cost: 0, deco: true, unique: true, unlock: 1, desc: '첫 처치 트로피 · 이웃이 방문하면 보여요' },
  trophy_eye: { name: '심연의 눈 조각', sprite: 'trophy_eye', size: [1, 1], cost: 0, deco: true, unique: true, unlock: 1, desc: '첫 처치 트로피 · 이웃이 방문하면 보여요' },
  monument: { name: '유산의 기념비', sprite: 'monument', size: [2, 2], cost: 0, deco: true, unique: true, unlock: 1, desc: '도감 100% 보상 · 밤엔 책이 은은하게 빛나요' },
  dungeon: { name: '던전 입구', sprite: 'dungeon', size: [3, 3], cost: 0, unique: true, fixed: true, act: 'dungeon', unlock: 1, desc: '파티가 원정을 떠나요' },
} satisfies Record<string, BuildingDef>;

export type Kind = keyof typeof CATALOG;
export const def = (k: Kind): BuildingDef => CATALOG[k];

/** 밤에 창문 불이 켜지는 그림 */
export const LIT_SPRITES = ['inn', 'inn3', 'inn5', 'inn8', 'tavern', 'tavern2', 'tavern4', 'smith', 'cottage', 'bath', 'monument'];

/** 굴뚝 연기 자리 (그림 왼쪽 위 기준) */
export const SMOKE: Record<string, [number, number][]> = {
  inn: [[44, 8]],
  inn3: [[47, 26], [100, 26]],
  tavern: [[67, 10]],
  tavern2: [[100, 8]],
  // 땅 개편 새 그림
  inn5: [[42, 18], [100, 38]],
  inn8: [[84, 18], [150, 38]],
  tavern4: [[118, 8]],
  smith: [[69, 12]],
  cottage: [],
  bath: [[30, 74]],
};

/** 지붕 색 5종: [이름, 색상(hue) — null은 원래 색] */
export const ROOFS: [string, number | null][] = [
  ['원래', null],
  ['청석', 215],
  ['단풍', 8],
  ['숲', 100],
  ['밤하늘', 265],
];

/** 건물 안에 있을 때 하는 일 */
export const INSIDE_TEXT: Partial<Record<Act, string>> = {
  sleep: '자는 중',
  drink: '한잔 중',
  bath: '온천욕 중',
  forge: '장비 손질 중',
};

/** 새 게임 시작 배치 (땅 1단계) */
// 땅 개편: 맵 24 · 1단계 땅 [14,22). 옛 (6,4)·(5,8)에 +12 · 던전은 1단계 땅 밖 오른쪽 뒤 (맵 안에 들어가게)
export const START_TOWN: [Kind, number, number][] = [
  ['inn', 18, 16],
  ['dungeon', 21, 10],
  ['well', 17, 20],
];
