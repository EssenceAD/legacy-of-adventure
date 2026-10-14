// LUXE_SPEC 숫자 한 곳 (config.ts를 크게 건드리지 않게 따로) — §3 마을 회관 꾸러미 · §2 펫(PETS)
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

// ───────── §2 펫 「동물 친구」 (플래그 pets · 세이브 P.pets — world/pets.ts petState()가 칸을 바로잡는다) ─────────
//  한 줄 = 펫 하나: 나오는 활동(src) · 기본 확률 p · 천장 pity(= 확률의 2배 시도에서 확정 · PACE 규칙) · 효과 수치 fx(꺼내 둔 3마리만 · 쓰다듬은 날 ×2)
export type PetSrc = 'hunt' | 'fish' | 'harvest' | 'enhance' | 'expedition' | 'raid' | 'abyss' | 'brew' | 'meal' | 'star';
export interface PetDef {
  id: string;
  name: string;
  src: PetSrc;
  p: number;
  pity: number;
  fx: number;
  /** 효과 한 줄 (도감·메뉴) */
  fxText: string;
  /** 나오는 곳 (도감) */
  where: string;
  /** 못 만났을 때 도감 힌트 한 줄 */
  hint: string;
}
export const PETS = {
  defs: [
    { id: 'raccoon', name: '아기 너구리', src: 'hunt', p: 1 / 1200, pity: 2400, fx: 0.02, fxText: '사냥 금화 +2%', where: '사냥 스테이지 클리어', hint: '사냥터 덤불이 바스락거려요…' },
    { id: 'otter', name: '아기 수달', src: 'fish', p: 1 / 250, pity: 500, fx: 0.03, fxText: '낚시 판정 창 +0.03초', where: '낚시 성공', hint: '물가에서 뭔가 철벙…' },
    { id: 'mole', name: '꼬마 두더지', src: 'harvest', p: 1 / 300, pity: 600, fx: 0.1, fxText: '텃밭 수확량 +1 (10% 확률)', where: '텃밭 수확', hint: '텃밭 흙이 볼록 솟았다 꺼져요…' },
    { id: 'salamander', name: '불도마뱀', src: 'enhance', p: 1 / 400, pity: 800, fx: 0.02, fxText: '강화·초월 가루 −2%', where: '강화·초월 시도', hint: '대장간 불씨 속에 작은 꼬리가…?' },
    { id: 'griffin', name: '아기 그리핀', src: 'expedition', p: 1 / 250, pity: 500, fx: 0.03, fxText: '원정 시간 −3%', where: '원정 성공', hint: '원정대 짐 위에 깃털 한 가닥이…' },
    { id: 'tengu', name: '꼬마 텐구', src: 'raid', p: 1 / 60, pity: 120, fx: 0.02, fxText: '토벌 피해 +2%', where: '토벌 도전', hint: '토벌 길목에서 작은 부채 소리가…' },
    { id: 'starcat', name: '별고양이', src: 'abyss', p: 1 / 150, pity: 300, fx: 0.02, fxText: '심연 피해 +2%', where: '심연 층 클리어', hint: '심연 계단 아래서 반짝이는 눈이…' },
    { id: 'slime', name: '물약 슬라임', src: 'brew', p: 1 / 120, pity: 240, fx: 0.1, fxText: '물약 재료 1개 덜 (10% 확률)', where: '물약 만들기', hint: '공방 솥이 혼자 꿀렁거려요…' },
    { id: 'puppy', name: '배부른 강아지', src: 'meal', p: 1 / 800, pity: 1600, fx: 1, fxText: '식사한 손님 기분 +1', where: '주점 단골 식사 · 마을 회관 「주방」', hint: '주점 식탁 밑에서 꼬리가 살랑…' },
    { id: 'starfox', name: '별여우', src: 'star', p: 1 / 20, pity: 40, fx: 0.03, fxText: '별똥별을 잡아도 3% 확률로 한 번 더', where: '별똥별 잡기', hint: '별똥별 꼬리에 여우 꼬리가 섞였어요…?' },
  ] as PetDef[],
  /** 천장 게이지가 이만큼 넘으면 그 활동에 한 줄 힌트 (1번) */
  hintAt: 0.5,
  hintLine: '…어디선가 작은 발소리가 들려요',
  /** 마을에 꺼내 둘 수 있는 수 (효과도 이 펫들만) */
  outMax: 3,
  /** 쓰다듬은 날 효과 배수 */
  patMult: 2,
  /** 마을 회관 「주방」 첫 펫 (bundles petGrant 'dog' → 이 펫) */
  bundlePet: 'puppy',
  /** 10마리 다 = 명품관 「펫 놀이터」(2×2 장식) 해금 · 장식 종류 키 (§1 명품관이 등록·판매) */
  playgroundKind: 'pet_playground',
  /** 마을 움직임: 여관 문에서 떠도는 반경(칸) · 속도(칸/초) · 주인 따라가기 확률(새 목표마다) · 손님 옆 하트 확률(초당) */
  roam: 3,
  speed: 0.9,
  follow: 0.25,
  heart: 0.25,
};

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
