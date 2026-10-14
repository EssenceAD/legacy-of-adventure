// LUXE_SPEC 숫자 한 곳 (config.ts를 크게 건드리지 않게 따로) — 지금은 §3 마을 회관 꾸러미만
//  §3 플래그 bundles · 세이브 P.bundles (world/bundles.ts bdState()가 칸을 바로잡는다)
//  칸 종류: crop 작물(P.crops · 연금 예약분은 빼고) · fish 물고기(P.growth.fish.bag) · mat 지역 재료(P.mats) · dust 가루(P.dust)
//          · boss 보스 재료(P.bossMats · 보스 id) · potion 물약(P.potions) · rec 기록(바치지 않고 카운터만 확인)
//  수량은 reports/luxe/bundles.md 시뮬을 보고 고친다 (여기 숫자만 바꾸면 된다)
//  시뮬 뒤 바꾼 것 (명세 첫 안 → 지금): 주방 생선 송사리 10→6 · 붕어 5→4 · 미꾸라지 8→5 · 정어리 8→5 · 가자미 5→4 · 잔칫상 고등어 5→3 (라이트 주방 4.5일 → 2~3일)
//   · 쉼터 원정 성공 기록 50·100·200 → 50·75·100 (실세이브 헤비도 원정 성공 누적 35~57 · 하루 2~3번 → 200은 두 달)

export type BundleSlotKind = 'crop' | 'fish' | 'mat' | 'dust' | 'boss' | 'potion' | 'rec';
/** rec 칸이 보는 기록 (world/bundles.ts recValue) */
export type BundleRec = 'wins' | 'huntClears' | 'abyssBest' | 'regionsX10' | 'friends' | 'trusted' | 'gifts';
export interface BundleSlot {
  k: BundleSlotKind;
  id: string;
  n: number;
}
export interface BundleDef {
  id: string;
  name: string;
  /** 이만큼 칸을 채우면 완성 (N/칸) */
  need: number;
  slots: BundleSlot[];
}
export interface RoomDef {
  id: 'kitchen' | 'pharmacy' | 'smithy' | 'water' | 'raid' | 'shelter';
  name: string;
  /** 장부 몇 장부터 */
  chapter: number;
  /** 방 담당 (대화 화자 키 · 이름표) */
  who: string;
  tag: string;
  /** 방 완성 영구 보상 한 줄 (창에 보이는 글) */
  perk: string;
  bundles: BundleDef[];
}

const S = (k: BundleSlotKind, id: string, n: number): BundleSlot => ({ k, id, n });

export const LUXE = {
  bundles: {
    /** 꾸러미 완성 보상 (방마다 · 금화 + 가루 [등급, 개수]) */
    bundleReward: {
      kitchen: { gold: 5000, dust: ['n', 50] },
      pharmacy: { gold: 10000, dust: ['r', 10] },
      smithy: { gold: 20000, dust: ['r', 20] },
      water: { gold: 20000, dust: ['n', 150] },
      raid: { gold: 50000, dust: ['e', 5] },
      shelter: { gold: 50000, dust: ['e', 5] },
    } as Record<RoomDef['id'], { gold: number; dust: [string, number] }>,
    /** 방 완성 영구 보상 크기 */
    perks: {
      /** 주방: 단골 식사(텃밭 작물) 포만·기분 × (1 + mealQ) · 주점이 연금 예약분은 「물약 재료 남겨 두기」를 꺼도 안 먹음 */
      mealQ: 0.05,
      /** 약방: 물약 지속 시간 × (1 + potionTime) */
      potionTime: 0.2,
      /** 대장간: 강화 가루 −enhDustCut (내림 · 최소 1) · 일괄 강화 예산 한도 +bulkBudget (가진 양 × (고른 % + 10%p) · 최대 100%) */
      enhDustCut: 0.05,
      bulkBudget: 0.1,
      /** 물가: 하루 미끼 +bait · 낚시 판정 창 +fishWin초 */
      bait: 1,
      fishWin: 0.05,
      /** 토벌: 하루 도전 +raidTries · 토벌 보스 재료 × (1 + raidMats) (반올림 · 최소 +0) */
      raidTries: 1,
      raidMats: 0.1,
      /** 쉼터: 자동 사냥 칸 +huntSlot (huntSlots 칸 최대 위로 · 그래도 huntSlotMax 넘지 않음) */
      huntSlot: 1,
      huntSlotMax: 4,
    },
    /** 6방 전부: 칭호 · 「이번 주 명품」 무료 쿠폰 수 (§1 명품관이 쓴다) · 건물 */
    finalTitle: '마을을 되살린 사람',
    finalCoupon: 1,
    hallKind: 'town_hall',
    /** 첫 펫 확정 (§2 펫이 생기면 이 값을 읽어 「배부른 강아지」를 준다) */
    petGrant: 'dog',
    rooms: [
      {
        id: 'kitchen', name: '주방', chapter: 3, who: 'legend_grom', tag: '그롬',
        perk: '첫 펫 「배부른 강아지」 · 주점이 물약 재료는 절대 안 먹어요 · 식사 품질 +5%',
        bundles: [
          { id: 'k_veg', name: '채소', need: 3, slots: [S('crop', 'carrot', 20), S('crop', 'pumpkin', 10), S('crop', 'cabbage', 8), S('crop', 'wheat', 10)] },
          { id: 'k_fish', name: '생선', need: 3, slots: [S('fish', 'minnow', 6), S('fish', 'crucian', 4), S('fish', 'loach', 5), S('fish', 'sardine', 5), S('fish', 'flounder', 4)] },
          { id: 'k_feast', name: '잔칫상', need: 2, slots: [S('fish', 'seabream', 1), S('fish', 'mackerel', 3), S('fish', 'catfish', 1)] },
        ],
      },
      {
        id: 'pharmacy', name: '약방', chapter: 4, who: 'hero_morga', tag: '모르가',
        perk: '물약 지속 시간 +20%',
        bundles: [
          { id: 'p_herb', name: '약초', need: 3, slots: [S('crop', 'herb', 20), S('crop', 'starflower', 3), S('crop', 'cabbage', 10), S('crop', 'carrot', 15)] },
          { id: 'p_potion', name: '물약', need: 3, slots: [S('potion', 'power', 1), S('potion', 'stone', 1), S('potion', 'luck', 1), S('potion', 'rest', 1)] },
          { id: 'p_rare', name: '희귀 물고기', need: 2, slots: [S('fish', 'lotusfish', 1), S('fish', 'koi', 1), S('fish', 'puffer', 1), S('fish', 'babyocto', 1)] },
        ],
      },
      {
        id: 'smithy', name: '대장간', chapter: 4, who: 'hero_brok', tag: '브로크',
        perk: '강화 가루 −5% · 일괄 강화 예산 +10%p',
        bundles: [
          { id: 's_first', name: '첫 재료', need: 4, slots: [S('mat', 'forest', 30), S('mat', 'swamp', 30), S('mat', 'mine', 30), S('mat', 'ice', 30), S('mat', 'coast', 20)] },
          { id: 's_dust', name: '가루', need: 3, slots: [S('dust', 'n', 300), S('dust', 'r', 100), S('dust', 'e', 30)] },
          { id: 's_far', name: '먼 재료', need: 2, slots: [S('mat', 'dune', 20), S('mat', 'ember', 20), S('mat', 'sky', 20), S('mat', 'abyss', 20)] },
        ],
      },
      {
        id: 'water', name: '물가', chapter: 5, who: 'legend_luna', tag: '루나',
        perk: '하루 미끼 +1 · 낚시 판정 +0.05초',
        bundles: [
          { id: 'w_pond', name: '연못', need: 4, slots: [S('fish', 'minnow', 1), S('fish', 'crucian', 1), S('fish', 'loach', 1), S('fish', 'mudskipper', 1), S('fish', 'koi', 1), S('fish', 'catfish', 1)] },
          { id: 'w_sea', name: '바다', need: 4, slots: [S('fish', 'sardine', 1), S('fish', 'mackerel', 1), S('fish', 'flounder', 1), S('fish', 'seabream', 1), S('fish', 'babyocto', 1), S('fish', 'puffer', 1)] },
          { id: 'w_night', name: '밤낚시', need: 2, slots: [S('fish', 'moontrout', 1), S('fish', 'firefly', 1), S('fish', 'eel', 1)] },
        ],
      },
      {
        id: 'raid', name: '토벌 전리품', chapter: 6, who: 'hero_harald', tag: '하랄드',
        perk: '하루 토벌 도전 +1 · 토벌 보스 재료 +10%',
        bundles: [
          { id: 'r_first', name: '첫 보스', need: 3, slots: [S('boss', 'boar', 5), S('boss', 'mushroom', 5), S('boss', 'golem', 5), S('boss', 'wyvern', 5)] },
          { id: 'r_deep', name: '깊은 보스', need: 2, slots: [S('boss', 'eye', 3), S('boss', 'leviathan', 3), S('boss', 'sandblade', 3), S('boss', 'magma', 3)] },
        ],
      },
      {
        id: 'shelter', name: '모험가 쉼터', chapter: 6, who: 'hero_oswin', tag: '오스윈',
        perk: '자동 사냥 칸 +1',
        bundles: [
          { id: 'h_exp', name: '원정', need: 3, slots: [S('rec', 'wins', 50), S('rec', 'wins', 75), S('rec', 'wins', 100)] },
          { id: 'h_hunt', name: '사냥', need: 2, slots: [S('rec', 'huntClears', 300), S('rec', 'abyssBest', 10), S('rec', 'regionsX10', 3)] },
          { id: 'h_bond', name: '인연', need: 2, slots: [S('rec', 'friends', 3), S('rec', 'trusted', 1), S('rec', 'gifts', 30)] },
        ],
      },
    ] as RoomDef[],
  },
};

// ───────── §1 명품관 (플래그 luxeShop · world/luxeShop.ts · ui/luxeShop.ts) ─────────
//  상점 창 「명품관」 탭 · 장부 chapter장부터 · 산 장식은 꾸미기 보관함으로 (하나씩 · 이웃에게도 보인다)
//  값은 reports/luxe/shop.md 시뮬을 보고 여기서만 고친다
//  시뮬 뒤 바꾼 것 (명세 README → 지금): 세트 30만/80만/200만/500만 → 15만/40만/100만/250만 (중간 솔바람 하루 ~42만 · 세트 1개 19일 → 10일)
//   · 헤비(롯데캐슬 하루 ~7,700만) 「세트 전부 25~40일」은 같은 값으로는 못 맞춘다 (중간의 ~185배) — 주간 명품 6주 순환이 헤비 몫 · 주간·작은 사치 값은 그대로
export type LuxeSetId = 'moon' | 'plaza' | 'flower' | 'study';
/** 세트 효과 (어울림 효과와 같은 이름 · world/harmony.ts hfx가 더한다) — mood+moodNight = 범위 안 손님 밤 기분 · dmg = 사냥·토벌 피해 · arrive = 새 손님 방문 · xp = 모험가 경험치 */
export interface LuxeSetFx {
  mood?: number;
  moodNight?: boolean;
  dmg?: number;
  arrive?: number;
  xp?: number;
}
export interface LuxeSetDef {
  id: LuxeSetId;
  name: string;
  /** 1점 → 4점(중심) 순서 · 값 */
  items: { kind: string; price: number }[];
  fx: LuxeSetFx;
  /** 효과 한 줄 (창·어울림 목록) */
  text: string;
}
export const LUXE_SHOP = {
  /** 장부 몇 장부터 (그 전엔 탭에 자물쇠 + 이유) */
  chapter: 4,
  /** 세트 완성: 4점(중심)에서 발판 가장자리 사이 빈칸 이만큼 안에 나머지 셋 */
  setRange: 2,
  sets: [
    { id: 'moon', name: '달빛 정원', fx: { mood: 3, moodNight: true }, text: '밤 기분 +3 (세트 둘레 손님)',
      items: [{ kind: 'moon_lantern', price: 150000 }, { kind: 'silver_bench', price: 400000 }, { kind: 'moon_pond', price: 1000000 }, { kind: 'moon_gazebo', price: 2500000 }] },
    { id: 'plaza', name: '용사의 광장', fx: { dmg: 0.01 }, text: '전투력 +1% (사냥·토벌 피해)',
      items: [{ kind: 'flag_pole', price: 150000 }, { kind: 'weapon_rack', price: 400000 }, { kind: 'hero_trainer', price: 1000000 }, { kind: 'victory_arch', price: 2500000 }] },
    { id: 'flower', name: '꽃 축제', fx: { arrive: 0.03 }, text: '새 손님 방문 +3%',
      items: [{ kind: 'flower_tower', price: 150000 }, { kind: 'flower_swing', price: 400000 }, { kind: 'flower_carousel', price: 1000000 }, { kind: 'flower_clock', price: 2500000 }] },
    { id: 'study', name: '별의 서재', fx: { xp: 0.02 }, text: '모험가 경험치 +2%',
      items: [{ kind: 'star_telescope', price: 150000 }, { kind: 'float_books', price: 400000 }, { kind: 'armillary', price: 1000000 }, { kind: 'star_library', price: 2500000 }] },
  ] as LuxeSetDef[],
  /**
   * 1-2 이번 주 명품: 한국 시간 월요일 0시에 바뀐다 · 순서대로 돌아서 같은 것이 weekly.length주마다 돌아온다
   *  anchor = 0번(황금 마차)이 처음 나오는 월요일 0시 KST (2026-10-12)
   */
  weeklyAnchor: Date.UTC(2026, 9, 11, 15, 0, 0),
  weekly: [
    { kind: 'gold_carriage', price: 20000000 },
    { kind: 'dragon_nest', price: 12000000 },
    { kind: 'rainbow_fountain', price: 15000000 },
    { kind: 'sky_balloon', price: 10000000 },
    { kind: 'turtle_statue', price: 8000000 },
    { kind: 'aurora_pillar', price: 8000000 },
  ],
  /** 1-4 작은 사치 (기존 장식 색 바꾸기 · 여러 개 살 수 있다) · 매일(한국 0시) 하나 −discount */
  small: [
    { kind: 'lx_pot_blue', price: 50000 },
    { kind: 'lx_pot_mint', price: 50000 },
    { kind: 'lx_pot_violet', price: 50000 },
    { kind: 'lx_mini_fountain', price: 300000 },
    { kind: 'lx_cat_house', price: 150000 },
    { kind: 'lx_color_flag', price: 100000 },
  ],
  discount: 0.3,
  /**
   * 작은 사치 그림 = 기존 그림 색 바꾸기 (engine/assets.ts가 불러온 뒤 만든다 · 새 그림 없음)
   *  hue = 바꿀 색상(도) · band = 바꿀 줄 범위(그림 높이 비율) · cols = 바꿀 칸 범위(폭 비율) · hues = 바꿀 원래 색상 범위 · gray = 무채색에 입힐 채도
   */
  tints: {
    lx_pot_blue: { from: 'flower_pot', hue: 210, band: [0.45, 1], hues: [0, 45] },
    lx_pot_mint: { from: 'flower_pot', hue: 160, band: [0.45, 1], hues: [0, 45] },
    lx_pot_violet: { from: 'flower_pot', hue: 280, band: [0.45, 1], hues: [0, 45] },
    lx_mini_fountain: { from: 'bird_bath', hue: 340, band: [0.25, 1], gray: 0.28 },
    lx_cat_house: { from: 'cat_crate', hue: 200, band: [0.42, 1], hues: [15, 50] },
    lx_color_flag: { from: 'banner', hue: 215, band: [0, 0.8], cols: [0.41, 1], hues: [340, 30] },
  } as Record<string, { from: string; hue: number; band: [number, number]; cols?: [number, number]; hues?: [number, number]; gray?: number }>,
};
