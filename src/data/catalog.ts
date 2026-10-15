// 건물 목록: 이름·발판·가격·손님 행동·레벨업 그림·열리는 땅 단계
import { vis } from '../world/visual';
import { CONFIG } from './config';
import { LUXE_SHOP } from './luxe_cfg';

export type Act = 'sleep' | 'drink' | 'forge' | 'bath' | 'train' | 'farm' | 'fire' | 'dungeon' | 'pet' | 'pray' | 'read' | 'brew' | 'mail' | 'stargaze' | 'brag';

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
  /** TOWN T1: 이웃 쇼케이스 마을에만 (건설 목록엔 T5에서 땅·장부·평판·어울림 보상으로 연다) */
  showcase?: boolean;
  /** DECO_DROP §2: 뽐내기 장식 (건설 창 「특별 장식」 탭 · 금화만 · 하나씩) */
  luxury?: boolean;
  /** LUXE §1 명품관 장식 (상점 「명품관」 탭에서만 · 산 건 보관함으로 · 건설 목록에 없음) — set 세트 · weekly 이번 주 명품 · small 작은 사치 */
  luxe?: 'set' | 'weekly' | 'small';
  /** EASTER: 베타 개척자 전용 장식 (그 사람만 · 건설 목록에 없음 · 팔 수 없음) */
  pioneerDeco?: boolean;
  /** v0.24.2: 여관·주점 레벨 장식 (그 레벨이 되면 저절로 · 건설 목록에 없음 · 팔 수 없음 · 값 0) */
  levelDeco?: boolean;
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
  // BUILDINGS_SPEC §2: 새 기능 건물 7종
  stable: { name: '마구간', sprite: 'stable', size: [3, 3], cost: CONFIG.newBuildings.stable.cost, act: 'pet', unlock: 3, stars: 2, levels: CONFIG.newBuildings.stable.levels, levelText: '의뢰 시간 −5% → −20%', desc: '의뢰 시간 단축 · Lv3부터 지나가는 손님이 1시간 더 머물러요 · 말 쓰다듬기' },
  chapel: { name: '작은 예배당', sprite: 'chapel', size: [3, 3], cost: CONFIG.newBuildings.chapel.cost, act: 'pray', unlock: 3, stars: 2, levels: CONFIG.newBuildings.chapel.levels, levelText: '체력 회복 +20% → +60%', desc: '의뢰·사냥 뒤 체력 회복이 빨라져요 · 밤 기도' },
  library: { name: '서재', sprite: 'library', size: [3, 3], cost: CONFIG.newBuildings.library.cost, act: 'read', unlock: 4, stars: 3, levels: CONFIG.newBuildings.library.levels, levelText: '단골 경험치 +10% → +30%', desc: '단골 경험치 +% · Lv3부터 「손님 일기」' },
  alchemy: { name: '연금술 공방', sprite: 'alchemy', size: [3, 3], cost: CONFIG.newBuildings.alchemy.cost, act: 'brew', unlock: 4, stars: 3, levels: CONFIG.newBuildings.alchemy.levels, levelText: '물약 칸 +1 · 물약 효과 +5%', desc: '텃밭 작물로 물약 만들기 (사냥·의뢰 버프)' },
  postoffice: { name: '우체국', sprite: 'post', size: [2, 2], cost: CONFIG.newBuildings.postoffice.cost, act: 'mail', unlock: 4, stars: 3, levels: CONFIG.newBuildings.postoffice.levels, levelText: '편지 보상 +20% → +100%', desc: '모모 편지 보상 +% · Lv3부터 이웃에게 선물 (준비 중)' },
  tower: { name: '마법사의 탑', sprite: 'tower', size: [2, 2], cost: CONFIG.newBuildings.tower.cost, act: 'stargaze', unlock: 5, stars: 4, levels: CONFIG.newBuildings.tower.levels, levelText: '강화 성공 +3%p → +10%p', desc: '강화 성공률 ↑ · Lv5 운명의 별 하루 2번' },
  guild: { name: '모험가 길드 회관', sprite: 'guild', size: [4, 4], cost: CONFIG.newBuildings.guild.cost, act: 'brag', unlock: 5, stars: 4, levels: CONFIG.newBuildings.guild.levels, levelText: '의뢰 보상 +10% → +40%', desc: '의뢰 보상 +% · Lv3 의뢰 자리 +1 · Lv5 길드 특별 의뢰' },
  well: { name: '우물', sprite: 'well', size: [1, 1], cost: 80, deco: true, unlock: 1, desc: '마을 장식 · 주변 기분 +' },
  // v0.25.2 §I: 파티 = 2 + 게시판 Lv (최대 4) → 게시판은 Lv.2가 끝 (Lv.3 이상 옛 저장은 그대로 · 표시는 「최대」) · 플래그 끄면 예전 표
  board: { name: '의뢰 게시판', sprite: 'board', size: [1, 1], cost: 120, deco: true, unlock: 3, get levels() { return vis('boardLevelUp') ? [300] : [300, 800, 1600]; }, levelText: '동시에 보낼 파티 +1', desc: '의뢰를 받아 던전에 나가요' },
  tree: { name: '나무', sprite: 'tree', size: [1, 1], cost: 20, deco: true, unlock: 2, desc: '장식' },
  pine: { name: '소나무', sprite: 'pine', size: [1, 1], cost: 20, deco: true, unlock: 2, desc: '장식' },
  fire: { name: '모닥불', sprite: null, size: [1, 1], cost: 60, deco: true, act: 'fire', unlock: 1, desc: '밤이면 손님들이 둘러앉아요' },
  // 3단계: 보스 첫 처치 트로피 (장식, 무료, 처치한 보스만). 그림은 보스 그림으로 코드에서 만든다
  // 베타 1장: 어울림 장식 (열리는 조건은 world/harmony.ts decoLock)
  bench: { name: '벤치', sprite: 'bench', size: [1, 1], cost: 60, deco: true, unlock: 1, desc: '앉아 쉬는 자리 · 어울림 재료' },
  thanks_basket: { name: '감사 꽃바구니', sprite: 'thanks_basket', size: [1, 1], cost: 0, deco: true, unlock: 1, desc: '업데이트 선물 · 보기만 해도 기분 좋아요' },
  flowerbed: { name: '꽃밭', sprite: 'flowerbed', size: [1, 1], cost: 80, deco: true, unlock: 1, desc: '꽃향기 · 어울림 재료' },
  lvl_pot: { name: '여관 화분', sprite: 'flower_pot', size: [1, 1], cost: 0, deco: true, levelDeco: true, unlock: 1, desc: '여관 Lv.6 기념 화분 · 옮기거나 넣어 둘 수 있어요' },
  lvl_stone_lantern: { name: '여관 석등', sprite: 'stone_lantern', size: [1, 1], cost: 0, deco: true, levelDeco: true, unlock: 1, desc: '여관 Lv.9 기념 석등 · 밤엔 은은한 불빛' },
  lvl_barrels: { name: '주점 술통', sprite: 'barrels', size: [1, 1], cost: 0, deco: true, levelDeco: true, unlock: 1, desc: '주점 Lv.5 기념 술통 · 옮기거나 넣어 둘 수 있어요' },
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
  // REGIONS2 §3: 지역 6~9 토벌 트로피
  trophy_leviathan: { name: '등대 불씨', sprite: 'trophy_leviathan', size: [1, 1], cost: 0, deco: true, unique: true, unlock: 1, desc: '첫 처치 트로피 · 이웃이 방문하면 보여요' },
  trophy_sandblade: { name: '검귀의 가면', sprite: 'trophy_sandblade', size: [1, 1], cost: 0, deco: true, unique: true, unlock: 1, desc: '첫 처치 트로피 · 이웃이 방문하면 보여요' },
  trophy_magma: { name: '식은 용암 왕관', sprite: 'trophy_magma', size: [1, 1], cost: 0, deco: true, unique: true, unlock: 1, desc: '첫 처치 트로피 · 이웃이 방문하면 보여요' },
  trophy_skydragon: { name: '구름 왕관', sprite: 'trophy_skydragon', size: [1, 1], cost: 0, deco: true, unique: true, unlock: 1, desc: '첫 처치 트로피 · 이웃이 방문하면 보여요' },
  monument: { name: '유산의 기념비', sprite: 'monument', size: [2, 2], cost: 0, deco: true, unique: true, unlock: 1, desc: '도감 100% 보상 · 밤엔 책이 은은하게 빛나요' },
  // DECO_DROP §2 (ECONOMY §3): 뽐내기 장식 8종 (asset_raw/luxury)
  gold_fountain: { name: '황금 분수', sprite: 'gold_fountain', size: [2, 2], cost: 300000, deco: true, unique: true, luxury: true, unlock: 1, desc: '밤에 금빛으로 빛나요' },
  hero_statue: { name: '영웅 동상', sprite: 'hero_statue', size: [1, 1], cost: 500000, deco: true, unique: true, luxury: true, unlock: 1, desc: '영입한 전설 영웅 하나를 골라 동상으로 (이름판)' },
  rainbow_bridge: { name: '무지개 아치 다리', sprite: 'rainbow_bridge', size: [2, 1], cost: 800000, deco: true, unique: true, luxury: true, unlock: 1, desc: '밤엔 돌이 은은히 빛나요' },
  grand_clock: { name: '대형 시계탑', sprite: 'grand_clock', size: [2, 2], cost: 1200000, deco: true, unique: true, luxury: true, unlock: 1, desc: '여섯 시간마다 종이 울려요' },
  star_garden: { name: '별빛 정원', sprite: 'star_garden', size: [3, 3], cost: 2000000, deco: true, unique: true, luxury: true, unlock: 1, desc: '운명의 별 인연 +1%' },
  dragon_fossil: { name: '용 뼈 화석', sprite: 'dragon_fossil', size: [3, 3], cost: 3000000, deco: true, unique: true, luxury: true, unlock: 1, desc: '별의 심연 10(보스)을 깨야 살 수 있어요' },
  gold_sign: { name: '여관 금빛 간판', sprite: 'gold_sign', size: [1, 1], cost: 5000000, deco: true, unique: true, luxury: true, unlock: 1, desc: '금판에 여관 이름이 새겨져요' },
  firework_stand: { name: '축제 불꽃', sprite: 'firework_stand', size: [1, 1], cost: 100000, deco: true, unique: true, luxury: true, unlock: 1, desc: '누르면 불꽃놀이 10초 (한 번에 100,000G)' },
  // EASTER: 베타 개척자 4인 전용 장식 (asset_raw/easter)
  duck_spa: { name: '온천 오리상', sprite: 'duck_spa', size: [2, 2], cost: 0, deco: true, unique: true, pioneerDeco: true, unlock: 1, desc: '절대 사라지지 않는 온천의 오리 · 근처 손님 기분 ↑ · 온천 옆이면 「쌍둥이 온천」' },
  gold_brush: { name: '황금 붓', sprite: 'gold_brush', size: [1, 1], cost: 0, deco: true, unique: true, pioneerDeco: true, unlock: 1, desc: '마을의 붓 · 근처 길이 은은히 반짝 · 꾸미기 모드에서 누르면 길 붓' },
  red_helmet: { name: '붉은 무사의 투구', sprite: 'red_helmet', size: [1, 1], cost: 0, deco: true, unique: true, pioneerDeco: true, unlock: 1, desc: '붉은 밤의 무사 · 밤엔 등불 · 토벌 금화 +3%' },
  pinwheel_light: { name: '바람개비 등대', sprite: 'pinwheel_light', size: [1, 1], cost: 0, deco: true, unique: true, pioneerDeco: true, unlock: 1, desc: '첫 바람 · 바람개비가 빙글빙글 · 의뢰 시간 −3%' },
  // FIVESTARS (플래그 fiveStars): 다섯 별 깃발(마지막 보상) · 왈왈콩선생 「밤길 방울」(다섯 번째 개척자) — 그림은 임시로 깃발·가로등 (도트는 다음 단계)
  five_flag: { name: '다섯 별 깃발', sprite: 'banner', size: [1, 1], cost: 0, deco: true, unique: true, pioneerDeco: true, unlock: 1, desc: '다섯 별의 원정대 · 근처에서 파티가 출발하면 기분 ↑' },
  night_bell: { name: '밤길 방울', sprite: 'lamppost', size: [1, 1], cost: 0, deco: true, unique: true, pioneerDeco: true, unlock: 1, desc: '밤길의 선생님 · 근처 손님 기분 ↑ · 밤 출발 원정 시간 −3%' },
  // LUXE §3 (플래그 bundles): 마을 회관 — 6방 꾸러미를 다 채우면 보관함에 (놓을 자리는 직접) · 그림 town_hall.png (형철 그림)
  town_hall: { name: '마을 회관', sprite: 'town_hall', size: [2, 3], cost: 0, deco: true, unique: true, pioneerDeco: true, unlock: 1, desc: '마을 회관 꾸러미를 다 채운 마을 · 예전엔 여기서 마을 잔치가 열렸대요' },
  // GROWTH §4: 물고기 박제 (낚시 창 「박제하기」로 받아 무료로 놓기)
  fish_firefly: { name: '반딧불 물고기 박제', sprite: 'fish_firefly', size: [1, 1], cost: 0, deco: true, unlock: 1, desc: '낚시 기념 박제 · 물속의 반딧불' },
  fish_kingkoi: { name: '왕관 쓴 황금 잉어 박제', sprite: 'fish_kingkoi', size: [1, 1], cost: 0, deco: true, unlock: 1, desc: '낚시 기념 박제 · 연못의 왕' },
  fish_lanternfish: { name: '등대 초롱아귀 박제', sprite: 'fish_lanternfish', size: [1, 1], cost: 0, deco: true, unlock: 1, desc: '낚시 기념 박제 · 밤바다의 초롱' },
  fish_starwhale: { name: '아기 별고래 박제', sprite: 'fish_starwhale', size: [1, 1], cost: 0, deco: true, unlock: 1, desc: '낚시 기념 박제 · 등에 별이 박힌 아기 고래' },
  // HARVEST §1-5: 수확제 장식 (교환소·여관 연감으로만 받는다 · 받은 게 있을 때만 건설 목록에 · 무료로 놓기)
  jack_lantern: { name: '호박등', sprite: 'jack_lantern', size: [1, 1], cost: 0, deco: true, unlock: 1, desc: '첫 수확제 · 밤이면 속에서 촛불이 일렁여요' },
  leaf_pile: { name: '낙엽 더미', sprite: 'leaf_pile', size: [1, 1], cost: 0, deco: true, unlock: 1, desc: '첫 수확제 · 바스락 소리가 나요' },
  wheat_sheaf: { name: '밀단', sprite: 'wheat_sheaf', size: [1, 1], cost: 0, deco: true, unlock: 1, desc: '첫 수확제 · 올해 거둔 밀' },
  lantern_post: { name: '등불 기둥', sprite: 'lantern_post', size: [1, 1], cost: 0, deco: true, unlock: 1, desc: '첫 수확제 · 호박 등불이 줄줄이 · 밤 불빛' },
  harvest_table: { name: '수확제 잔칫상', sprite: 'harvest_table', size: [1, 1], cost: 0, deco: true, unlock: 1, desc: '첫 수확제 · 근처 손님 포만 +5/시간' },
  harvest_arch: { name: '수확제 아치', sprite: 'harvest_arch', size: [1, 1], cost: 0, deco: true, unlock: 1, desc: '첫 수확제 · 아래를 지나가면 한 해 운이 좋아진대요' },
  pumpkin_carriage: { name: '호박 마차', sprite: 'pumpkin_carriage', size: [2, 2], cost: 0, deco: true, unique: true, unlock: 1, desc: '첫 수확제 · 밤 등불 · 근처 손님 기분 +5' },
  // LUXE §1 명품관 (플래그 luxeShop): 세트 16 · 이번 주 명품 6 (asset_raw/luxe → public/assets/sprites) · 작은 사치 6 (기존 그림 색 바꾸기 · data/luxe_cfg tints) — 값은 data/luxe_cfg LUXE_SHOP
  moon_lantern: { name: '달빛 등롱', sprite: 'moon_lantern', size: [1, 1], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '밤이면 푸른 달빛이 번져요 · 달빛 정원 1' },
  silver_bench: { name: '은빛 벤치', sprite: 'silver_bench', size: [1, 1], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '달빛 정원 2' },
  moon_pond: { name: '월광 연못', sprite: 'moon_pond', size: [2, 2], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '물 위로 은빛 반짝이 · 달빛 정원 3' },
  moon_gazebo: { name: '초승달 정자', sprite: 'moon_gazebo', size: [3, 3], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '밤에 등롱 셋이 켜져요 · 달빛 정원 중심' },
  flag_pole: { name: '깃발 기둥', sprite: 'flag_pole', size: [1, 1], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '깃발이 펄럭여요 · 용사의 광장 1' },
  weapon_rack: { name: '무기 진열대', sprite: 'weapon_rack', size: [1, 1], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '용사의 광장 2' },
  hero_trainer: { name: '훈련 동상', sprite: 'hero_trainer', size: [2, 2], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '가끔 칼끝이 번쩍 · 용사의 광장 3' },
  victory_arch: { name: '승리의 개선문', sprite: 'victory_arch', size: [2, 1], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '아래를 지나는 손님이 흥얼거려요 · 용사의 광장 중심' },
  flower_tower: { name: '꽃바구니 탑', sprite: 'flower_tower', size: [1, 1], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '꽃잎이 흩날려요 · 꽃 축제 1' },
  flower_swing: { name: '꽃 그네', sprite: 'flower_swing', size: [1, 1], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '그네가 살랑 · 꽃 축제 2' },
  flower_carousel: { name: '꽃 회전목마', sprite: 'flower_carousel', size: [2, 2], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '통통 돌아가요 · 꽃 축제 3' },
  flower_clock: { name: '꽃 시계탑', sprite: 'flower_clock', size: [3, 3], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '정각마다 종이 울려요 · 꽃 축제 중심' },
  star_telescope: { name: '별자리 망원경', sprite: 'star_telescope', size: [1, 1], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '밤에 렌즈가 반짝 · 별의 서재 1' },
  float_books: { name: '떠다니는 책더미', sprite: 'float_books', size: [1, 1], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '책이 둥실 · 별의 서재 2' },
  armillary: { name: '천구의', sprite: 'armillary', size: [2, 2], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '별 반짝이 · 별의 서재 3' },
  star_library: { name: '별빛 도서탑', sprite: 'star_library', size: [2, 2], cost: 0, deco: true, unique: true, luxe: 'set', unlock: 1, desc: '밤이면 창에 불빛 · 별의 서재 중심' },
  gold_carriage: { name: '황금 마차', sprite: 'gold_carriage', size: [3, 2], cost: 0, deco: true, unique: true, luxe: 'weekly', unlock: 1, desc: '이번 주 명품 · 금빛 반짝' },
  dragon_nest: { name: '용 둥지 장식', sprite: 'dragon_nest', size: [2, 2], cost: 0, deco: true, unique: true, luxe: 'weekly', unlock: 1, desc: '이번 주 명품 · 알 하나가 가끔 들썩여요' },
  rainbow_fountain: { name: '무지개 분수', sprite: 'rainbow_fountain', size: [2, 2], cost: 0, deco: true, unique: true, luxe: 'weekly', unlock: 1, desc: '이번 주 명품 · 무지개 물방울' },
  sky_balloon: { name: '하늘 열기구', sprite: 'sky_balloon', size: [2, 2], cost: 0, deco: true, unique: true, luxe: 'weekly', unlock: 1, desc: '이번 주 명품 · 둥실둥실' },
  turtle_statue: { name: '여관 수호 거북 동상', sprite: 'turtle_statue', size: [2, 2], cost: 0, deco: true, unique: true, luxe: 'weekly', unlock: 1, desc: '이번 주 명품 · 가끔 눈을 깜빡여요' },
  aurora_pillar: { name: '오로라 기둥', sprite: 'aurora_pillar', size: [1, 1], cost: 0, deco: true, unique: true, luxe: 'weekly', unlock: 1, desc: '이번 주 명품 · 색이 천천히 바뀌어요' },
  lx_pot_blue: { name: '꽃화분 (파랑)', sprite: 'lx_pot_blue', size: [1, 1], cost: 0, deco: true, luxe: 'small', unlock: 1, desc: '작은 사치 · 파란 화분' },
  lx_pot_mint: { name: '꽃화분 (민트)', sprite: 'lx_pot_mint', size: [1, 1], cost: 0, deco: true, luxe: 'small', unlock: 1, desc: '작은 사치 · 민트 화분' },
  lx_pot_violet: { name: '꽃화분 (보라)', sprite: 'lx_pot_violet', size: [1, 1], cost: 0, deco: true, luxe: 'small', unlock: 1, desc: '작은 사치 · 보라 화분' },
  lx_mini_fountain: { name: '작은 분수', sprite: 'lx_mini_fountain', size: [1, 1], cost: 0, deco: true, luxe: 'small', unlock: 1, desc: '작은 사치 · 분홍 대리석 물그릇' },
  lx_cat_house: { name: '고양이 집', sprite: 'lx_cat_house', size: [1, 1], cost: 0, deco: true, luxe: 'small', unlock: 1, desc: '작은 사치 · 파란 칠 고양이 상자' },
  lx_color_flag: { name: '색 깃발', sprite: 'lx_color_flag', size: [1, 1], cost: 0, deco: true, luxe: 'small', unlock: 1, desc: '작은 사치 · 하늘색 깃발' },
  dungeon: { name: '던전 입구', sprite: 'dungeon', size: [3, 3], cost: 0, unique: true, fixed: true, act: 'dungeon', unlock: 1, desc: '파티가 원정을 떠나요' },
  // TOWN T1/T5: 꾸미기 장식 41종 (asset_raw/deco_final) — 지금은 이웃 쇼케이스 마을에만 · 값·여는 조건은 T5에서
  cat_crate: { name: '고양이 상자', sprite: 'cat_crate', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '고양이 상자' },
  beehives: { name: '벌통', sprite: 'beehives', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '벌통' },
  dog_house: { name: '강아지 집', sprite: 'dog_house', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '강아지 집' },
  chicken_coop: { name: '닭장', sprite: 'chicken_coop', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '닭장' },
  rock_fall: { name: '바위 폭포', sprite: 'rock_fall', size: [2, 2], cost: 0, deco: true, showcase: true, unlock: 1, desc: '바위 폭포' },
  koi_pond: { name: '잉어 연못', sprite: 'koi_pond', size: [2, 2], cost: 0, deco: true, showcase: true, unlock: 1, desc: '잉어 연못' },
  birdhouse: { name: '새집', sprite: 'birdhouse', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '새집' },
  swing: { name: '그네', sprite: 'swing', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '그네' },
  string_lights: { name: '전구 기둥', sprite: 'string_lights', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '전구 기둥' },
  double_lamp: { name: '쌍가로등', sprite: 'double_lamp', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '쌍가로등' },
  brazier: { name: '화로', sprite: 'brazier', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '화로' },
  mushroom_dark: { name: '파란 버섯', sprite: 'mushroom_dark', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '파란 버섯' },
  mushroom_lamp: { name: '빛나는 버섯', sprite: 'mushroom_lamp', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '빛나는 버섯' },
  picnic: { name: '피크닉', sprite: 'picnic', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '피크닉' },
  tulip_box: { name: '튤립 화단', sprite: 'tulip_box', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '튤립 화단' },
  signpost: { name: '이정표', sprite: 'signpost', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '이정표' },
  bird_bath: { name: '새 물그릇', sprite: 'bird_bath', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '새 물그릇' },
  snowman: { name: '눈사람', sprite: 'snowman', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '눈사람' },
  pumpkins: { name: '호박 더미', sprite: 'pumpkins', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '호박 더미' },
  hay_scarecrow: { name: '건초 허수아비', sprite: 'hay_scarecrow', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '건초 허수아비' },
  harvest_cart: { name: '수확 수레', sprite: 'harvest_cart', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '수확 수레' },
  maple: { name: '단풍나무', sprite: 'maple', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '단풍나무' },
  cherry: { name: '벚나무', sprite: 'cherry', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '벚나무' },
  birch: { name: '자작나무', sprite: 'birch', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '자작나무' },
  topiary: { name: '동그란 화분 나무', sprite: 'topiary', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '동그란 화분 나무' },
  knight_statue: { name: '기사 동상', sprite: 'knight_statue', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '기사 동상' },
  clock_tower: { name: '시계탑', sprite: 'clock_tower', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '시계탑' },
  windmill: { name: '풍차', sprite: 'windmill', size: [2, 2], cost: 0, deco: true, showcase: true, unlock: 1, desc: '풍차' },
  water_pump: { name: '펌프', sprite: 'water_pump', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '펌프' },
  gazebo: { name: '정자', sprite: 'gazebo', size: [2, 2], cost: 0, deco: true, showcase: true, unlock: 1, desc: '정자' },
  lily_pond: { name: '연꽃 연못', sprite: 'lily_pond', size: [2, 2], cost: 0, deco: true, showcase: true, unlock: 1, desc: '연꽃 연못' },
  foot_bridge: { name: '아치 다리', sprite: 'foot_bridge', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '아치 다리' },
  rose_bench: { name: '장미 벤치', sprite: 'rose_bench', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '장미 벤치' },
  fruit_stall: { name: '과일 수레', sprite: 'fruit_stall', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '과일 수레' },
  flower_cart: { name: '꽃 수레', sprite: 'flower_cart', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '꽃 수레' },
  barrel_stack: { name: '술통 더미', sprite: 'barrel_stack', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '술통 더미' },
  shop_sign: { name: '간판 기둥', sprite: 'shop_sign', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '간판 기둥' },
  hedge: { name: '산울타리', sprite: 'hedge', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '산울타리' },
  rose_arch: { name: '장미 아치', sprite: 'rose_arch', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '장미 아치' },
  stonewall2: { name: '돌담', sprite: 'stonewall2', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '돌담' },
  picket_gate: { name: '흰 울타리 문', sprite: 'picket_gate', size: [1, 1], cost: 0, deco: true, showcase: true, unlock: 1, desc: '흰 울타리 문' },
} satisfies Record<string, BuildingDef>;

// DECO_DROP §1: 꾸미기 장식 41종 값·여는 땅 단계는 CONFIG.deco에서
for (const [land, row] of Object.entries(CONFIG.deco.land)) for (const [k, cost] of Object.entries(row)) Object.assign((CATALOG as Record<string, BuildingDef>)[k], { cost, unlock: +land });
for (const [k, s] of Object.entries(CONFIG.deco.seasonal)) Object.assign((CATALOG as Record<string, BuildingDef>)[k], { cost: s.cost, unlock: 1 });
// LUXE §1: 명품관 값 (data/luxe_cfg LUXE_SHOP 한 곳)
for (const it of [...LUXE_SHOP.sets.flatMap((x) => x.items), ...LUXE_SHOP.weekly, ...LUXE_SHOP.small]) Object.assign((CATALOG as Record<string, BuildingDef>)[it.kind], { cost: it.price });

export type Kind = keyof typeof CATALOG;
export const def = (k: Kind): BuildingDef => CATALOG[k];

/** 밤에 창문 불이 켜지는 그림 */
export const LIT_SPRITES = ['inn', 'inn3', 'inn5', 'inn8', 'tavern', 'tavern2', 'tavern4', 'smith', 'cottage', 'bath', 'monument'];

/**
 * 대장간 화덕 바닥 빛 (그림 왼쪽 위 기준, 안 뒤집은 그림): 입구 밑변 가운데 앞 바닥의 납작한 타원 [cx, cy, rx, ry] · 입구 윗변 y (openTop)
 *  빛은 cy − ry 아래(바닥 쪽)로만 — 입구 위 들보·지붕으로는 절대 올라가지 않는다 (scripts/light-openings.json 의 smith 입구와 맞춤)
 */
export const FORGE_GLOW: Record<string, { cx: number; cy: number; rx: number; ry: number; openTop: number; openBottom: number }> = {
  smith: { cx: 29, cy: 76, rx: 17, ry: 6, openTop: 47, openBottom: 74 },
};

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
  pet: '말 쓰다듬는 중',
  pray: '기도하는 중',
  read: '책 읽는 중',
  brew: '공방 구경 중',
  mail: '편지 부치는 중',
  stargaze: '별 보는 중',
  brag: '의뢰 자랑 중',
  sleep: '자는 중',
  drink: '한잔 중',
  bath: '온천욕 중',
  forge: '장비 손질 중',
};

/** 새 게임 시작 배치 (땅 1단계) */
// 땅 개편: 맵 24 · 1단계 땅 [14,22). 옛 (6,4)·(5,8)에 +12 · 던전은 1단계 땅 밖 오른쪽 뒤 (맵 안에 들어가게)
export const START_TOWN: [Kind, number, number][] = [
  // LAND2: 맵 32 · +8 · LAND10: 맵 44 · +12
  ['inn', 38, 36],
  ['dungeon', 41, 30],
  ['well', 37, 40],
];
