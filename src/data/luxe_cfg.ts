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

/**
 * LUXE §1-3 영웅 의상실 (플래그 outfits) — 숫자 한 곳
 *  ② 의상 값: 영웅 10 = 200만 · 전설 14 = 300만~500만(얻기 어려운 전설일수록 비쌈 · 소문 조건 기준) · 다섯 별 = 500만
 *  ① 의상: 인연 「친구」(3단계) 보상 — 다섯 별은 인연(ties)이 없어서 합류 + 밤 단골 대화(heart)를 들은 때를 「친구」로 본다
 */
export const LUXE_OUTFITS = {
  /** ① 주는 인연 단계 (3 = 친구) */
  friendStage: 3,
  price: {
    hero: 2_000_000,
    star: 5_000_000,
    legend: {
      elysia: 3_000_000, ceres: 3_000_000, luna: 3_000_000, grom: 3_000_000, sylas: 3_000_000, vivian: 3_000_000,
      aria: 4_000_000, nyx: 4_000_000, leon: 4_000_000, momo2: 4_000_000, scarlet: 4_000_000,
      vael: 5_000_000, ryuka: 5_000_000, jin: 5_000_000,
    } as Record<string, number>,
    /** 표에 없는 전설 (안전값) */
    legendDefault: 4_000_000,
  },
  /** 초상화 색 바꾸기: 옷 색에 가까운 픽셀만 (HSL 거리) · 배경은 테두리에서 번지는 비슷한 색 */
  portrait: {
    maxDist: 0.34,
    bgStep: 22,
    /** 이보다 작은 덩어리는 안 바꿈 (점 얼룩 방지) */
    minRegion: 12,
    /** 옷 색이 깔끔하게 안 옮겨지는 초상화 → 테두리만 의상 장식 색 (비교 시트 보고 정함) */
    //  자동으로 옷 영역이 깔끔하게 잡히는 9명(리라 · 모르가 · 오스윈 · 세릴 · 엘리시아 · 닉스 · 미미 · 이카몰리 · 따뜻한밤)만 초상화 옷 색까지 · 나머지 20명은 테두리 (reports/luxe/outfits/sheet_*_portrait_auto.png)
    frameOnly: ['kael', 'brok', 'pip', 'harald', 'nova', 'twins', 'ceres', 'vael', 'scarlet', 'luna', 'grom', 'aria', 'leon', 'sylas', 'ryuka', 'vivian', 'jin', 'woongs', 'gonu', 'walwal'] as string[],
  },
};
