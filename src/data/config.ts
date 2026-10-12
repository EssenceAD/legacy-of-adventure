// 모든 숫자(가격·속도·확률·시간)를 이 파일 한 곳에 모은다. 밸런스는 여기서만 고친다.

/** 어울림 효과 한 벌 (incKind 건물 수입 · 나머지는 이름 그대로) */
export interface HarmonyFx {
  incKind?: string;
  inc?: number;
  /** 밤에만 */
  night?: boolean;
  mood?: number;
  moodNight?: boolean;
  regular?: number;
  trainXp?: number;
  bath?: number;
  repDay?: number;
  harvest?: number;
  expSuccess?: number;
  scenery?: number;
  expTime?: number;
  dmg?: number;
  raidDmg?: number;
  talkBond?: number;
  enhance?: number;
  legend?: number;
  gold?: number;
  stayH?: number;
  arrive?: number;
  drunk?: number;
}

export const CONFIG = {
  map: {
    /** 맵 최대 크기 (타일) — 땅 개편: 14 → 24 (땅 22 + 앞쪽 입구 여유 2) */
    size: 24,
    tileW: 32,
    tileH: 16,
  },
  view: {
    /** 화면 배율은 정수만 (도트가 뭉개지지 않게). ＋ 버튼으로 이 순서대로 돈다 */
    zooms: [1, 2, 3],
    defaultZoom: 2,
    /** 이만큼(px) 움직이면 탭이 아니라 드래그 */
    dragThreshold: 6,
    /** 핀치: 손가락 사이 거리가 이 배만큼 벌어지거나 좁혀질 때마다 배율 한 단계 */
    pinchStep: 1.35,
  },
  loop: {
    /** 게임 규칙 갱신 주기 (초) — 화면은 rAF로 따로 그린다 */
    updateStep: 1 / 30,
    /** 창(건설·땅·손님…)이 열려 있는 동안 마을 그리기 간격 (초) — 30fps. 0.002는 rAF 흔들림 여유 */
    drawStepWhileWindow: 1 / 30 - 0.002,
    /** 핫픽스 11 발열: 마을 그리기 fps · 손 안 댄 지 idleAfterSec초 뒤 · 배터리 절약(idle) · 전투·토벌·티저 상한 */
    drawFpsVillage: 30,
    drawFpsIdle: 15,
    idleAfterSec: 60,
    drawFpsSaver: 20,
    drawFpsSaverIdle: 10,
    drawFpsBattle: 60,
    drawFpsBattleSaver: 30,
    /** 창이 마을 화면의 이 비율 이상을 덮으면 마을을 그리지 않는다 */
    coverRatio: 0.92,
  },
  // 땅 개편 (v0.10): 앞쪽(입구) 가장자리 to=22 는 단계가 바뀌어도 그대로, 뒤쪽(입구 반대)으로 커진다
  //  단계 수 5 · 비용 · 열리는 것 · 평판 별 조건은 그대로. 옛 저장은 OLD_LAND_TO 기준으로 좌표를 옮긴다 (save.ts v7)
  land: [
    { size: '8×8', from: 14, to: 22, cost: 0, opens: '여관 본관, 우물, 모닥불' },
    { size: '11×11', from: 11, to: 22, cost: 300, opens: '나무 자리' },
    { size: '14×14', from: 8, to: 22, cost: 800, opens: '주점·훈련장·텃밭·게시판·대장간' },
    { size: '18×18', from: 4, to: 22, cost: 1600, opens: '객실 별채' },
    { size: '22×22', from: 0, to: 22, cost: 3000, opens: '온천, 최대 크기' },
  ],
  /** 땅 개편 전(맵 14) 단계별 앞쪽 가장자리 — 옛 저장 좌표 옮기기용 (dx = dy = 22 - 이 값) */
  oldLandTo: [10, 11, 12, 13, 14],
  economy: {
    /** 시안은 2,400으로 시작. 실제 게임은 오프닝 뒤 이 금액으로 시작 */
    startGold: 1240,
    /** 손님이 건물에 들어갈 때 버는 돈 (행동별) */
    income: { sleep: 12, drink: 6, forge: 8, bath: 10 } as Record<string, number>,
    dungeonMin: 40,
    dungeonMax: 120,
  },
  /** ONBOARDING: 첫 손님이 오기까지 · 체크인 금화 · 이틀째 선물 금화 */
  onboard: { guestDelayMs: 2500, checkinGold: 60, day2Gold: 2000 },
  build: {
    /** 비계+먼지 시간 (초) — 예전 값 (CONSTRUCTION_SPEC 이후 안 씀) */
    constructSeconds: 2.2,
    /** CONSTRUCTION_SPEC §2: 1칸 장식 3초 · 새 건물 = 비용/10초 (30~120초) · 업그레이드 목표 Lv.2~10 분 */
    decoSeconds: 3,
    newMin: 30,
    newMax: 120,
    newPerCostSec: 10,
    upMinutes: [1, 3, 5, 10, 12, 15, 20, 25, 30],
    /** 동시 공사: 처음 1곳 + 여관 이 레벨마다 1곳 */
    workerInnLv: [4, 8],
    /** 뚝딱 탭: BUILDINGS_SPEC §1 — 상한 없음 (1 = 끝까지) · 매크로 수준 남용만 막는 최소 간격(ms) */
    tapCapPct: 1,
    tapMinMs: 50,
    /** 핫픽스 10 철거: 없으면 게임이 깨지는 건물 · 환불 비율 · 이 시간(초) 안이면 전액 */
    noRemove: ['inn'] as string[],
    refundRate: 0.5,
    fullRefundSec: 300,
  },
  dayNight: {
    /** 낮↔밤 자동 전환 간격 (초) */
    cycleSeconds: 45,
    /** 전환에 걸리는 시간 정도 (값이 클수록 빠름: 초당 이 비율만큼 다가감) */
    blendRate: 1.1,
    /** 밤 색조를 몇 단계로 나눠 캐시할지 */
    tintSteps: 10,
  },
  actors: {
    /** 손님 수 = base + 여관 레벨×perInnLevel + 별채 수×perCottage */
    capBase: 2,
    perInnLevel: 2,
    perCottage: 2,
    /** 걷는 속도 (타일/초). 던전 파티는 조금 빠르다 */
    walkSpeed: 1.7,
    partySpeed: 2.4,
    /** 낮에 건물로 갈 확률, 그중 숙박 아닌 건물을 고를 확률 */
    dayBuildingChance: 0.42,
    nonSleepChance: 0.8,
    /** 밤에 모닥불로 갈 확률 (모닥불이 있을 때) */
    nightFireChance: 0.35,
    /** 대기 중 말풍선 확률 */
    idleTalkChance: 0.3,
    /** 케미: 거리(타일), 확률 */
    chemDistance: 2.5,
    chemChance: 0.5,
    /** 쉬고 있는 짝을 몇 초마다 살필지, 케미가 한 번 뜬 뒤 다음까지 최소 간격(초) */
    chemScanSeconds: 1,
    chemCooldown: 8,
    /** 건물 안에 머무는 시간 (초) */
    stay: { sleepNight: 14, sleepDay: 5, otherMin: 4, otherMax: 8 },
    /** 밤에 숙박 건물 안에서 더 머물 확률 */
    nightStayMore: 0.8,
    /** 바깥 행동 시간 (초) */
    trainMin: 3,
    trainMax: 5,
    farmTime: 3,
    fireMin: 5,
    fireMax: 9,
    /** 수련 중 레벨이 오를 확률 */
    trainLevelUpChance: 0.3,
    bubbleMs: 2800,
    /** 문 열고 들어가기·나오기: 문턱을 넘는 시간(초), 문 안쪽으로 걸어 들어가는 거리(px) */
    doorSeconds: 0.6,
    doorStepPx: 7,
    /** 문 앞 칸에서 실제 문 앞까지 걸어가는 속도 (px/초) */
    doorWalkPxPerSec: 40,
    /** 밤에 열린 문 안쪽 불빛 */
    doorNightLight: '#ffb860',
    doorNightAlpha: 0.6,
  },
  dungeon: {
    /** 파티 출발 간격 (초) */
    intervalSeconds: 15,
    /** 던전 안에 머무는 시간 (초) */
    insideSeconds: 6,
    partyMin: 2,
    partyMax: 3,
  },
  /** 말풍선 대사 (상황별) */
  lines: {
    idle: ['방 좋네~', '오늘 던전 갈까?', '배고프다…', '이 마을 맘에 들어', '주인장 최고!'],
    drink: ['캬~!', '한 잔 더!', '건배!!'],
    pet: ['착하지~', '갈기가 부드러워', '오늘도 잘 달렸니?'],
    pray: ['오늘도 무사히…', '고마워요', '조용하다'],
    read: ['이 책 재밌네', '음… 그렇구나', '한 장만 더'],
    brew: ['보글보글', '무슨 냄새지?', '반짝인다!'],
    mail: ['집에 편지 써야지', '답장 왔을까?'],
    stargaze: ['별이 많다', '저 별 이름이 뭐더라'],
    brag: ['내가 그 보스를…', '다음 의뢰는 내 거!', '길드에 이름 올렸다!'],
    train: ['하앗!', '받아라!'],
    farm: ['쑥쑥 자라라~'],
    bath: ['아~ 시원하다', '피로가 싹…'],
    forge: ['깡! 깡!'],
    sleep: ['드르렁…'],
    fire: ['불멍 최고…', '옛날 얘기 해줄까?'],
    party: ['던전 가자!'],
  } as Record<string, string[]>,
  /** 지붕 색 바꾸기 (sprites/roofs.json 다각형 안에서만) */
  roof: {
    /** 대표 색상에서 이만큼(도) 안의 픽셀만 돌린다 — 빛 받는 면과 그늘 면을 함께 잡게 넉넉히 */
    hueRange: 42,
    /** 이보다 밝은 픽셀(지붕창 벽·불 켜진 유리)은 그대로 */
    skipLightness: 0.8,
    /** 다각형 안에서 채도 있는 픽셀이 이 비율보다 적으면 "채도 없는 지붕"으로 보고 색을 입힌다 */
    colorfulShare: 0.3,
    tintSaturation: 0.38,
  },
  upgrade: {
    inn: 600,
    tavern: 500,
    /** 땅 개편: 여관 본관 Lv.2~10 · 주점 Lv.2~6 비용 */
    innLevels: [600, 1500, 3000, 4500, 6500, 9000, 12000, 16000, 21000],
    tavernLevels: [500, 1500, 3000, 5000, 8000],
    /** 여관 Lv.3까지는 방 +2, 그 뒤로는 +1 (단골이 너무 많으면 관리가 번거롭다) */
    innRoomsFullUntil: 3,
    /** 주점 레벨당 수입 · Lv.4부터 케미 확률 배수 */
    tavernIncomePerLevel: 0.15,
    tavernChemFrom: 4,
    tavernChemMult: 1.3,
  },
  ui: {
    toastMs: 2200,
    /** 대화창 한 글자 간격 (ms) */
    typeMs: 32,
  },
  /** [소문] 채팅: 다음 줄까지 (ms), 여러 줄 대화 확률·줄 간격 */
  chat: { minMs: 9000, maxMs: 22000, threadChance: 0.25, threadGapMs: 5000 },
  /** 모닥불 그림 (campfire.png): 프레임 넘김 간격, 칸 중심이 프레임 아래에서 몇 px 위인지 */
  fire: { frameSeconds: 0.15, baseFromBottom: 7 },
  /** 배치 미리보기 */
  placement: { dim: 0.3, ghostAlpha: 0.75, bobPx: 2, snapSeconds: 0.12, dragLiftPx: 40, longPressMs: 400 },
  /** 핫픽스 3: 화면 크기 3단계(짧은 변 기준)와 글자 크기 */
  UI_SCALE: {
    /** 짧은 변이 이 이상이면 태블릿 */
    tabletMin: 600,
    /** 짧은 변이 이 이상이거나, 가로÷세로가 wideAspect 이상이면 넓은 화면 */
    wideMin: 1024,
    wideAspect: 1.3,
    /** 태블릿·넓은 화면 배율(기기 픽셀 기준 정수). 기본값 = 마을이 짧은 변의 fill 안에 드는 가장 큰 정수 */
    wideZooms: [1, 2, 3, 4],
    fill: [0.7, 0.85],
    /** 글자 크기 (px) */
    fonts: {
      // 핫픽스 7 글자 체계: 제목 20 · 대사 17 · 본문 16 · 알림 15 · 작은 글 13 · 마을 말풍선 14 (PC도 같은 비율 ×1.12)
      phone: { dlg: 17, name: 16, ui: 16, notice: 15, small: 13, chat: 14, bub: 14, big: 20, tiny: 12 },
      tablet: { dlg: 19, name: 18, ui: 18, notice: 17, small: 15, chat: 16, bub: 15, big: 22, tiny: 13 },
      wide: { dlg: 19, name: 18, ui: 18, notice: 17, small: 15, chat: 16, bub: 15, big: 22, tiny: 13 },
    } as Record<'phone' | 'tablet' | 'wide', Record<string, number>>,
    /** 설정 → 글자 크기: 보통 · 크게 · 아주 크게 */
    userScales: [1, 1.25, 1.5],
    userLabels: ['보통', '크게', '아주 크게'],
    /** 대화창 초상화 크기 (64px 그림을 정수배로) */
    portrait: { phone: 96, tablet: 128, wide: 128 } as Record<'phone' | 'tablet' | 'wide', number>,
    /** 맵 밖 숲을 몇 칸 더 그릴지 (넓은 화면에서 빈 곳 없게) */
    groundRing: 12,
  },
  // ═════════════ 2단계: 파밍 · 성장 · 케미 ═════════════

  /** 게임 안 시간: 현실 1분 = 게임 1시간. 하루 24분(낮 16분 06–22시 / 밤 8분 22–06시) */
  clock: {
    realSecondsPerGameHour: 60,
    dayStartHour: 6,
    nightStartHour: 22,
  },
  /** 땅 넓히기에 필요한 평판 별 (단계 1~5) */
  // 핫픽스 8: 땅 4단계 ★3 → ★2 (장부 4장 대장간 자리가 없을 때 땅을 넓힐 수 있게)
  landStars: [0, 1, 2, 2, 4],
  /** 꺼져 있던 동안 (방치) */
  offline: {
    /** 이만큼(현실 시간)까지만 쌓인다 */
    maxRealHours: 8,
    /** 게임 1시간마다 손님 1명이 버는 평균 금화 */
    goldPerGuestPerGameHour: 15,
    /** 방치 수입 비율 (손님 4명 3시간 ≈ 2,160G가 되게 맞춤) */
    rate: 0.2,
    /** 처음 이 시간(현실)까지는 그대로 쌓이고, 그 뒤로는 tailRate만큼만 */
    fullHours: 3,
    tailRate: 0.15,
    /** 방치 금화는 다음 땅 넓히기(땅이 끝이면 가장 비싼 레벨업) 비용의 이 비율을 넘지 않는다 */
    capShare: 0.8,
    /** 이보다 짧게 꺼져 있었으면 요약 창을 띄우지 않는다 (현실 초) */
    minSecondsForSummary: 60,
  },
  guests: {
    /** 새 손님이 오는지 살피는 간격(게임 시간)과 확률 */
    arriveEveryGameHours: 2,
    arriveChance: 0.6,
    /** 방문 손님이 묵는 날 수 */
    stayDaysMin: 1,
    stayDaysMax: 3,
    /** 기분 평균이 이 이상이면 단골 제안, 이 미만이면 일찍 떠남 */
    regularMood: 70,
    leaveMood: 35,
    /** 단골 대기 목록 최대 (자리가 나면 다시 찾아와 제안) */
    waitlistMax: 3,
    /** 지나가는 손님: 정원이 차도 낮에 들른다. 이 시각(게임 시) 전까지 오고, 이 시각에 떠난다. 동시에 최대 몇 명 */
    passerFromHour: 7,
    passerUntilHour: 15,
    passerLeaveHour: 18,
    passerMax: 3,
    passerChance: 0.5,
    /** 새 게임 시작 때 노주인이 남겨 둔 단골 수 */
    startRegulars: 2,
    /** 희귀도 확률 (특별·전설) */
    rareChance: 0.18,
    legendChance: 0.03,
    maxLevel: 50,
  },
  /** 욕구 (0~100). 게임 1시간당 변화와 채우는 양 */
  needs: {
    foodPerHour: -6,
    moodLowNeedPerHour: -4,
    moodCrowdedPerHour: -1,
    /** 이 아래면 그 욕구를 채우러 간다 */
    seekBelow: 60,
    /** 이 아래면 "욕구가 낮다"(기분 감소) */
    lowBelow: 30,
    sleepHp: 35,
    sleepNightHp: 70,
    meal: 35,
    mealWithProduce: 55,
    mealProduceMood: 10,
    bathHp: 20,
    bathMood: 20,
    decoMood: 12,
    fireMood: 12,
    chemMood: 8,
    trainHp: -8,
    trainXp: 25,
    farmMood: 6,
  },
  /** 원정 */
  expedition: {
    /** 의뢰 걸리는 시간 (현실 분): 짧음·보통·김·아주 김. 짧은 건 분당 효율이 좋고, 긴 건 방치용 */
    tierMinutes: [1, 10, 60, 480],
    /** 걸리는 시간 단계마다 보상 배수 */
    tierReward: [0.5, 3, 8, 20],
    /** 게시판엔 늘 이 시간(분) 이하 의뢰가 하나는 있다 */
    quickMinutes: 1,
    /** 새 게임 첫 원정: 30초 「숲 입구 정찰」, 귀환 때 희귀 장비 확정 */
    tutorial: { name: '숲 입구 정찰', minutes: 0.5, power: 60, gold: [80, 120] as [number, number] },
    /** 원정 진행 일지: 이 초 간격(최소~최대)마다 한 줄 */
    logGap: [10, 20] as [number, number],
    /** 첫 지역 첫 단계: 추천 전투력·금화·장비 확률 */
    basePower: 100,
    baseGold: [60, 120],
    baseXp: 30,
    baseDrop: { r: 0.2, e: 0.04, l: 0.005 },
    /** 지역이 올라갈수록: 시간 ×2, 보상 ×2.5, 상위 등급 확률 ×1.5, 추천 전투력 ×2.2 */
    regionTime: 2,
    regionReward: 2.5,
    regionDrop: 1.5,
    regionPower: 2.2,
    /** 걸리는 시간 단계마다 추천 전투력 배수 (1분 의뢰는 처음 단골 한 명으로도 대개 성공하게) */
    tierPower: [0.6, 1.4, 1.9, 2.6],
    /** 성공률 = (파티 전투력 ÷ 추천) × 이 값, 최소·최대 */
    successScale: 0.85,
    successMin: 0.05,
    successMax: 0.97,
    /** 실패해도 받는 보상 비율, 깎이는 체력 */
    failReward: 0.35,
    failHp: 45,
    winHp: 15,
    partyMin: 2,
    /** 짧은 의뢰(1단계)는 1명만 보내도 된다 */
    partyMinShort: 1,
    partyMax: 4,
    /** 원정에 못 가는 체력 */
    minHp: 30,
    /** 하루 의뢰 개수, 무료 새로고침 */
    questsMin: 3,
    questsMax: 5,
    freeRefreshPerDay: 1,
    /** 동시에 보낼 수 있는 파티 = 기본 + 게시판 레벨 (최대) */
    partiesBase: 2,
    maxParties: 4,
    /** 천장: 같은 지역에서 전설이 이만큼 안 나오면 다음은 확정 (테스트할 땐 낮춘다) */
    pity: 50,
    /** 지역 재료 개수 */
    mats: [2, 4],
  },
  items: {
    /** 핫픽스 12 §1: 직업에 맞는 무기(CLASS_WEAPON)를 끼면 무기 공격·마력 +15% */
    classWeaponBonus: 0.15,
    /** 등급별 능력치 배수 · 랜덤 옵션 수 */
    gradeMult: { n: 1, r: 1.4, e: 1.9, l: 2.6, a: 3.4 } as Record<string, number>,
    gradeOpts: { n: 0, r: 1, e: 2, l: 3, a: 3 } as Record<string, number>,
    /** 지역마다 능력치 배수 */
    regionStat: 1.8,
    /** 강화 1당 능력치 +% */
    enhancePct: 0.06,
    bagBase: 60,
    bagPerSmithLevel: 20,
  },
  smith: {
    /** 분해: 등급별 가루 */
    salvage: { n: 10, r: 25, e: 60, l: 150, a: 300 } as Record<string, number>,
    /** 강화 비용 = (현재 강화+1)² × 이 값 (그 장비 등급 가루) */
    enhanceCost: 10,
    maxEnhance: 10,
    /** +6부터 성공 확률 (+6 … +10) */
    enhanceRates: [0.7, 0.55, 0.4, 0.3, 0.2],
    /** 제작: 지역 재료·일반 가루·금화 */
    craftMats: 10,
    craftDust: 30,
    craftGold: 80,
    /** 대장간 레벨이 오를 때마다 상위 등급 확률 배수 */
    craftLevelBoost: 1.35,
    /** 3단계: 세트 부위 하나에 그 지역 보스 재료 · 강화로 +bossEnhanceFrom 이상 올릴 때 1번마다 보스 재료 */
    craftBossMats: 3,
    bossEnhanceFrom: 10,
    bossEnhanceMats: 1,
    levelCosts: [0, 500, 900, 1500, 2500, 4000, 6000],
  },
  garden: {
    plots: 3,
    /** 작물: 자라는 시간(현실 분)·씨앗 값·수확량 */
    crops: {
      carrot: { name: '당근', minutes: 10, seed: 10, yield: 3 },
      pumpkin: { name: '호박', minutes: 30, seed: 25, yield: 6 },
      cabbage: { name: '양배추', minutes: 60, seed: 40, yield: 10 },
      // BUILDINGS_SPEC §3
      herb: { name: '약초', minutes: 20, seed: 20, yield: 4, eat: false },
      wheat: { name: '밀', minutes: 45, seed: 30, yield: 8 },
      starflower: { name: '별꽃', minutes: 120, seed: 120, yield: 2, land: 5, eat: false },
    } as Record<string, { name: string; minutes: number; seed: number; yield: number; land?: number; eat?: boolean }>,
  },
  /**
   * BUILDINGS_SPEC §2: 새 기능 건물 7종 — 효과는 [Lv1, Lv5] 사이를 레벨에 따라 고르게 · 숫자는 여기 한 곳
   */
  newBuildings: {
    stable: { cost: 2500, levels: [3000, 5000, 8000, 12000], unlock: 3, stars: 2, timeCut: [0.05, 0.2] as [number, number], passerStayLv: 3, passerStayHours: 1 },
    chapel: { cost: 3000, levels: [3500, 6000, 9000, 14000], unlock: 3, stars: 2, heal: [0.2, 0.6] as [number, number], prayMood: 6 },
    library: { cost: 5000, levels: [6000, 9000, 14000, 20000], unlock: 4, stars: 3, xp: [0.1, 0.3] as [number, number], diaryLv: 3 },
    alchemy: { cost: 6000, levels: [7000, 11000, 16000, 24000], unlock: 4, stars: 3, boostPerLv: 0.05 },
    postoffice: { cost: 4000, levels: [4000, 7000, 10000, 15000], unlock: 4, stars: 3, mail: [0.2, 1] as [number, number], giftLv: 3 },
    tower: { cost: 10000, levels: [12000, 18000, 26000, 36000], unlock: 5, stars: 4, enhance: [0.03, 0.1] as [number, number], starLv: 5 },
    guild: { cost: 15000, levels: [18000, 26000, 36000, 50000], unlock: 5, stars: 4, gold: [0.1, 0.4] as [number, number], slotLv: 3, specialLv: 5, specialBossMats: 2 },
  },
  /** BUILDINGS_SPEC §3: 연금술 물약 (30분 · 한 번에 하나) */
  potions: {
    minutes: 30,
    list: {
      power: { name: '힘의 물약', need: { herb: 3, carrot: 2 }, desc: '사냥·의뢰 전투력 +15%', v: 0.15 },
      stone: { name: '돌피부 물약', need: { herb: 3, pumpkin: 2 }, desc: '받는 피해 −15%', v: 0.15 },
      luck: { name: '행운의 물약', need: { starflower: 1, herb: 2 }, desc: '아이템 드롭 +20%', v: 0.2 },
      rest: { name: '휴식의 물약', need: { cabbage: 3, wheat: 2 }, desc: '손님 전원 기분 +20 (바로)', v: 20 },
    } as Record<string, { name: string; need: Record<string, number>; desc: string; v: number }>,
  },
  /**
   * STORY_V1: 막 전환 · 은퇴 루트. 게임 1일 = 현실 24분(시계 1분=1시간, 켜 둔 동안만 흐름)이라
   * 명세의 「5일차≈5시간 · 16일차≈16시간」 감에 맞춰 일수를 늘렸다 (실제 시간 ≈ 일수 × 24분)
   */
  story: {
    /** 막 전환: 장부 몇 장 · 이 회차 운영 며칠째 이상 · 영웅 수 */
    act2: { chapters: 3, day: 12 },
    act3: { chapters: 7, day: 40, heroes: 1 },
    /** 은퇴: 이 회차 운영 일수 목표 (3막 40일차 진입 → 20일 ≈ 실제 8시간) */
    retireDays: 60,
    /** 손님 기분 최고인 날 = 그날 평균 기분 이 값 이상 · 모을 날 수 */
    goodMood: 95,
    retireGoodDays: 10,
    retireHarvests: 100,
    /** 유산 포인트: 엔딩마다 · 처음 보는 엔딩 더 */
    legacyPts: 100,
    legacyFirst: 50,
    /** 시작 선물: 비상금 금화 · 옛 단골 레벨 */
    giftGold: 3000,
    giftFavLv: 10,
  },
  /** HOTFIX14 §1·§5: 사라진 건물 사과 금화 */
  gifts: { sorryGold: 1000, /** HOTFIX18 §1: 이 시각(v0.11.3 배포) 전에 지은 중복만 사과 */ sorryBefore: 1791729000000, /** 서버 저장에서 이미 하나를 잃은 게 확인된 여관 (지금 저장엔 중복이 없어도 사과 편지) */ sorryInns: ['롯데캐슬 여관', '머리박고힐 여관'] as string[] },
  /** HOTFIX14 §1 임시 → TOWN_SPEC T3에서 땅 단계별 최대 채수·수입 배율과 함께 정식으로: n번째 채 건설비 배율 */
  town: { copyCost: [1, 1.5] as number[] },
  /** 핫픽스 12 §2: 역할 조합(탱·힐·딜) · 멘토 경험치 · 의뢰 조건 태그 */
  party: {
    rolePowerPct: 0.1,
    roleHpSave: 0.2,
    mentorGap: 5,
    mentorXp: 1.5,
    tagBonus: 0.3,
    /** 하루 의뢰 중 태그가 붙는 수 [최소, 최대] */
    tagsPerDay: [1, 2] as [number, number],
  },
  chem: {
    /** 친밀도 단계(2~5)에 필요한 누적 경험치 */
    levels: [0, 30, 80, 150, 250],
    townXp: 10,
    expeditionXp: 20,
    /** 같은 파티 짝 하나당 친밀도 단계 × 이 값만큼 전투력·보상 배율 + */
    partyBonusPerLevel: 0.03,
  },
  reputation: {
    /** 별 1~5에 필요한 평판 점수 */
    stars: [0, 40, 120, 300, 650],
    expeditionWin: 3,
    newRegular: 5,
    happyLeave: 1,
    angryLeave: -2,
    /** 오늘의 목표 하나 달성 */
    goal: 5,
    /** 날이 바뀔 때 손님 기분 평균: 이 이상이면 +, 이 미만이면 − */
    dailyMoodHigh: 70,
    dailyMoodLow: 40,
    dailyMoodGain: 2,
    dailyMoodLoss: -2,
  },
  /** 영웅 별: 그 영웅이 낀 케미 친밀도 단계가 오를 때마다 +1 (최대) */
  heroes: {
    maxStars: 5,
  },
  dex: {
    /** 도감 칸 하나당 전투력 + (손님·아이템) */
    guestCellPct: 0.002,
    itemCellPct: 0.002,
    /** 영웅 등록 보너스(1~3%)·★당 */
    heroStarPct: 0.01,
  },
  goals: {
    count: 3,
  },
  // ═════════════ 3단계: 토벌전 · 전설 영웅 ═════════════

  raid: {
    /** 한 판 시간(초), 파티 인원 (영웅 1 + 동료 2) */
    seconds: 60,
    partySize: 3,
    /** 하루 도전 (실제 날짜) */
    triesPerDay: 3,
    /** 권장의 이 비율 미만이면 시작 전 경고 */
    warnRatio: 0.6,
    /** 피해량 = 전투력 × 초 × dmgPerPowerSec × 상성 × 케미 (자동은 ±autoSpread 흔들림) */
    dmgPerPowerSec: 1,
    autoSpread: 0.1,
    /** 직접 조작: 자동 대비 최소·최대 */
    manualMin: 0.9,
    manualMax: 1.3,
    /** 상성 */
    weakMult: 1.2,
    resistMult: 0.85,
    /** 등급: 기대 피해 대비 */
    rankS: 1.15,
    rankA: 1.03,
    rankB: 0.95,
    /** 랭킹 기록 상한 = 이론치 × 이 값 (넘으면 거부 — 2차에서 서버가 같은 검사) */
    recordCap: 1.5,
    /** 한 판 뒤 파티 체력 감소 */
    hpCost: 20,
    /** 원정 승리 때 떠돌이 보스와 마주칠 확률 · 도전 가능 시간 · 체력 비율 */
    wanderChance: 0.08,
    wanderHours: 24,
    wanderHpShare: 0.4,
    /** 처치 보너스: 금화 = 보스 기준 금화 × 이 값, 전용 재료 */
    killGoldMult: 3,
    killMats: 5,
  },
  legends: {
    /** 인연 활동 한 번에 게이지 +min~max% */
    gaugeMin: 1,
    gaugeMax: 3,
    /** 밤 판정 확률(%) = 게이지 ÷ 이 값 */
    judgeDiv: 20,
    /** 머무는 기간(실제 일), 실패하면 게이지 */
    visitDays: 3,
    failGauge: 50,
    /** 운명의 별: +1~10% (흔한 값일수록 무겁게) */
    starWeights: [30, 20, 14, 10, 8, 6, 4, 3, 3, 2],
    /** STARFALL §2: 유성우 밤에 잡을 수 있는 별 수 */
    showerCatches: 3,
    /** ★1→2, 2→3, 3→4, 4→5 에 필요한 인연의 증표 */
    tokenNeeds: [1, 2, 3, 4],
    /** ★ 하나당 전투력 + */
    starPowerPct: 0.08,
    /** 원정에서 증표가 나올 확률 */
    tokenRunChance: 0.003,
    /** 영입 보상: 계정 전체 전투력 + */
    dexBonus: 0.03,
    /** 레온 부탁: 마을 장식 점수 */
    decoNeed: 40,
    /** 금빛 발자국이 남는 시간(초) */
    goldStepsSeconds: 12,
  },
  /** 3단계 2차: 서버 */
  cloud: {
    /** 클라우드 저장 간격 (초) */
    pushSeconds: 60,
    /** 진의 소문 조건: 주간 순위 ÷ 전체 ≤ 이 값 */
    topRankShare: 0.3,
    /** [세계]가 이만큼(ms) 조용할 때만 [소문]이 흐른다 */
    rumorQuietMs: 120000,
  },
  /** 5단계 2장: 사냥 (스테이지 돌파형) */
  hunt: {
    stages: 10,
    /** 추천 전투력 = basePower × regionPower^지역 × (1 + stagePower × (스테이지-1)) — 1-1은 처음 단골 한 명으로도 */
    basePower: 35,
    regionPower: 2.2,
    stagePower: 0.17,
    /** 한 판 제한 시간(초) · 웨이브 수 · 웨이브마다 몬스터 수 */
    seconds: 45,
    waves: 3,
    pack: [2, 4] as [number, number],
    /** 파티 초당 피해 = 전투력 × dpsK · 한 판 몬스터 체력 합 = 추천 × dpsK × stageHpSec (추천만큼이면 걷는 시간 포함 약 30초) */
    dpsK: 0.55,
    stageHpSec: 40,
    /** 붙어 있는 몬스터 하나가 파티(1000)에 주는 초당 피해 × (추천 ÷ 전투력)^dangerExp · 보스 배수 */
    mobDps: 20,
    bossMult: 3,
    dangerExp: 2,
    /** 보상: 금화(지역마다 ×2.5, 스테이지마다 +12%) · 경험치 · 지역 재료 · 장비 확률(원정과 같은 등급표·천장) */
    gold: [40, 70] as [number, number],
    goldPerStage: 0.12,
    xp: 18,
    mats: [1, 2] as [number, number],
    dropChance: 0.3,
    /** 첫 돌파: 잿빛 가루 × (지역+1) · 증표 조각 (보스는 3개, 10개 = 인연의 증표 1) */
    firstDust: 30,
    firstShards: 1,
    /** 첫 돌파 평판 (보스는 더) */
    firstRep: 2,
    firstRepBoss: 5,
    bossShards: 3,
    shardsPerToken: 10,
    /** 자동 사냥: 이 초마다 한 판 (전투력이 추천 × autoRatio 이상일 때) · 방치는 이 비율로 */
    autoSeconds: 30,
    autoRatio: 0.9,
    idleRate: 0.25,
    /** 방치 판 하나의 보상 비율 (금화·경험치·재료) */
    idleReward: 0.5,
    /** 방치 장비는 이 개수까지 */
    idleItemsMax: 8,
  },
  /** 4단계: 주인공 · 인연 · 방랑의 불씨 · 엔딩 */
  owner: {
    nameMin: 2,
    nameMax: 8,
    /** 매일 첫 접속(실제 날짜) 능력치 전체 + */
    dailyAll: 0.2,
    /** 행동으로 오르는 능력치: 한 능력치당 하루 최대 */
    actionCapPerDay: 0.6,
    /** 행동별 상승량 */
    gain: {
      expedition: { hp: 0.1 }, dangerRun: { nerve: 0.15 }, meal: { cook: 0.02 }, harvest: { cook: 0.1 },
      talk: { talk: 0.15, heart: 0.1 }, regular: { talk: 0.2 }, craft: { craft: 0.15 }, enhance: { craft: 0.1 },
      raid: { nerve: 0.2 }, raidManual: { nerve: 0.1 }, gift: { heart: 0.15 }, tired: { heart: 0.05 },
    } as Record<string, Partial<Record<'hp' | 'cook' | 'talk' | 'craft' | 'nerve' | 'heart', number>>>,
    /** 전투력 주인 보너스 최대 · 담력/체력/마음 비중 */
    bonusMax: 0.15,
    bonusWeights: { nerve: 0.4, hp: 0.3, heart: 0.3 },
    /** 요리 100 = 주점 수입 +30% · 말솜씨 100 = 의뢰 금화 +10%, 단골 기준 -5 · 손재주 100 = 강화 +3%p */
    cookIncome: 0.3,
    talkGold: 0.1,
    talkRegular: 5,
    craftEnhance: 0.03,
    /** 하루 행동력 = 기본 + 체력 ÷ 20 (말 걸기·선물 각 1) */
    energyBase: 4,
    energyPerHp: 20,
    /** 출신 보너스 */
    perk: { train: 0.1, raid: 0.05, trade: 0.05, enhance: 0.02, mood: 0.1, expTime: 0.05 },
    /** 달력: 1계절 = 실제 7일 */
    seasonDays: 7,
    /** 계절 행사: 봄 손님 기분 · 여름 온천 · 가을 주점 · 겨울 숙박 수입 + */
    seasonBonus: 0.1,
    /** 계절 추천 지붕 색 (hue) */
    seasonHue: [330, 200, 25, 210],
  },
  ties: {
    /** 단계마다 20 */
    perStage: 20,
    talkGood: 3,
    talkMeh: 1,
    giftLike: 8,
    giftNormal: 3,
    giftHate: -3,
    /** 마음 100 = 인연 오르는 속도 +50% · 선물 효과 +100% */
    heartSpeed: 0.5,
    heartGift: 1,
    linkedMult: 1.3,
    runTogether: 1,
    raidTogether: 1,
    requestDone: 5,
    /** 인연 이벤트 선택지 (앞 = +2, 뒤 = +1) */
    choiceGood: 2,
    choiceMeh: 1,
    /** 인연 단계 하나당 그 영웅 전투력 + (낯섦 = 0) */
    stagePower: 0.02,
  },
  ember: {
    daily: 0.6,
    report: 0.5,
    legend: 3,
    raidManual: 0.5,
    linkedEvent: 3,
    /** 행동으로 오르는 하루 최대 */
    actionCapPerDay: 3,
    marks: [30, 60, 90],
    /** 2년 차(실제 56일) 이후 + 불씨 100 → 선택 */
    decideDays: 56,
    /** 「아직은 아니야」 → 불씨 · 다시 묻기까지 (일) */
    notYet: 70,
    askAgainDays: 14,
    /** 후계자: 버나드 인연 이 단계 이상 또는 이 레벨 이상 단골 */
    heirBernard: 3,
    heirLevel: 15,
    /** 홀로 떠나기 담력 */
    soloNerve: 90,
    /** 앞 주인 편지 확률 (하루) */
    letterChance: 0.15,
  },
  /** 베타 1장: 어울림 — 거리·한 건물 최대 개수·발견 보상·조합별 효과 */
  harmony: {
    /** 발자국 가장자리 사이 빈칸이 이 이하면 어울린다 (대각선 포함) */
    range: 2,
    perBuilding: 3,
    /** 발견 보상: 금화 goldStep × ceil(번호/6) · 평판 */
    goldStep: 100,
    rep: 3,
    /** 손님 기분 어울림: 범위 안 손님에게 게임 1시간마다 */
    auraHours: 1,
    /** 노점: 지나가는 손님이 들러 내는 금화 (게임 1시간마다 · 노점 하나당) */
    stallGold: 14,
    /** 온천 마을(체류 +1시간): 숙박비가 이만큼 더 (시간당) */
    stayIncome: 0.5,
    /** 밤 = 20~04시 */
    nightFrom: 20,
    nightTo: 4,
    /** 조합별 효과 (data/harmony.ts의 id) */
    fx: {
      1: { incKind: 'tavern', inc: 0.2 },
      2: { mood: 10, regular: 0.1 },
      3: { trainXp: 0.2 },
      4: { bath: 0.2 },
      5: { incKind: 'inn', inc: 0.15, repDay: 1 },
      6: { harvest: 1, mood: 5 },
      7: { incKind: 'tavern', inc: 0.15, drunk: 1 },
      8: { trainXp: 0.15, expSuccess: 0.03 },
      9: { incKind: 'stall', inc: 0.3, night: true },
      10: { repDay: 2, scenery: 15 },
      11: { expTime: -0.1 },
      12: { dmg: 0.05 },
      13: { incKind: 'cottage', inc: 0.15 },
      14: { mood: 10, moodNight: true, talkBond: 1 },
      15: { enhance: 0.02 },
      16: { incKind: 'inn', inc: 0.2, night: true },
      17: { mood: 10, scenery: 10 },
      18: { incKind: 'tavern', inc: 0.1 },
      19: { legend: 0.1 },
      20: { raidDmg: 0.05 },
      21: { gold: 0.1 },
      22: { trainXp: 0.1 },
      23: { stayH: 1 },
      24: { arrive: 0.2 },
    } as Record<number, HarmonyFx>,
  },
  /**
   * 베타 2장: 여관 평가단 — 실제 1주 = 한 시즌, 테마 순환(미식 → 휴양 → 모험가 → 풍경). 점수 0~1000(+암행 보너스)
   * 재료마다 [목표치, 배점]: 목표치에 닿으면 배점 만점. 시즌 동안 늘어난 만큼(원정 성공·식사 등) 또는 지금 상태(장식·등급 등)
   * 맞춤: 한 시즌 꾸준히 = 실버(550) 근처 · 어울림을 노리고 배치 = 골드(800)
   */
  evaluation: {
    tiers: [300, 550, 800, 950],
    tierNames: ['브론즈', '실버', '골드', '전설'],
    themes: ['미식', '휴양', '모험가', '풍경'],
    /** 장부 몇 장을 마치면 평가단이 오기 시작하나 (5단계 전 저장은 바로) */
    fromChapter: 3,
    /** 마지막 날(일요일) 게임 속 이 시각 이후 마을을 보고 있으면 평가단이 온다 */
    tourHour: 17,
    secretBonus: 30,
    // 밤샘 ④-2 평가단 일주일 시뮬(tests/eval-sim): 성실히 하면 실버 · 그 주 테마 어울림을 노리면 골드가 되게 다시 맞춤
    gourmet: { meals: [200, 250], harvests: [30, 200], harmonies: [3, 300], mood: [100, 250] },
    relax: { mood: [100, 300], harmonies: [4, 350], decos: [15, 350] },
    adventure: { wins: [25, 250], huntBest: [20, 200], trains: [50, 150], raids: [6, 200], harmonies: [3, 200] },
    scenery: { decos: [15, 150], kinds: [8, 150], found: [12, 250], grade: [4, 250], roofs: [4, 200] },
    /** 테마별 어울림 (data/harmony 번호) */
    themeHarmony: { gourmet: [1, 6, 7, 18], relax: [2, 4, 5, 13, 14, 16, 17, 23], adventure: [3, 8, 11, 12, 20, 22] },
    /** 보상: 등급별 금화 · 잿빛 가루 · 증표 조각 */
    rewards: [
      { gold: 800, dust: 60, shards: 2 },
      { gold: 1600, dust: 120, shards: 4 },
      { gold: 3000, dust: 220, shards: 7 },
      { gold: 5000, dust: 400, shards: 10 },
    ],
  },
  /** 베타 4장: 구경거리 사건 — 게임 하루 0~2번(게임 1시간마다 확률), 1시간 뒤 사라짐 · 떠돌이 상인은 3시간 */
  spectacle: {
    perDay: 2,
    chancePerHour: 0.07,
    hours: 1,
    merchantHours: 3,
    /** 술통 창고 어울림이 있으면 곯아떨어진 드워프 가중치 × (1 + 이 값) */
    drunkBoost: 2,
    weight: { quarrel: 10, thief: 8, confess: 7, merchant: 8, bard: 8, lost: 7, sleepy: 7, sparkle: 10, group: 6, secret: 6 } as Record<string, number>,
    thiefGold: 60,
    bardTip: 30,
    bardMood: 15,
    calmMood: 15,
    sparkle: { mats: [2, 5], dust: [10, 30] },
  },
  /**
   * 전투 개편 1차 (손맛 프로토타입): 쿼터뷰 필드 액션 — 숲 1-1~1-3만. 나머지 스테이지·토벌 직접 전투는 2차
   * 거리 단위는 타일(마을과 같은 쿼터뷰 32×16), 시간은 초, 넉백은 화면 도트(px)
   */
  combat: {
    /** 폰 기본 배율 (CSS px per 도트) — 캐릭터·몬스터·이펙트·바닥 모두 같은 정수배 */
    scale: 3,
    /** 1차에 열린 스테이지 (숲 1-1 ~ 1-protoMax). 장부 임무의 사냥 조건도 여기까지로 본다 */
    protoMax: 3,
    /** 전투 2차: 필드를 넓히고(15칸) 무리 단위로 · 제한 시간 150초 */
    field: 15,
    timeLimit: 150,
    waves: 3,
    pack: [5, 8],
    /** 토벌: 자동 토벌(소탕 역할) 비율 · 필드 피해 기준 (전투력 합 × dmgK × 이 값 = 초당 피해, 봇으로 맞춤) */
    raidAuto: 0.7,
    raidFieldDps: 1,
    /** 한 판 처치 목표 (1 → 9스테이지) · x-10은 이만큼 잡고 보스 */
    killGoal: [30, 50],
    bossKillGoal: 24,
    /** 추천 전투력이면 잡몹이 몇 대에 쓰러지나 (1 → 10스테이지) */
    hitsToKill: [2.3, 2.9],
    /** 정예·보스 체력 (잡몹 기준 배) · 보스 공격 배 · 50%부터 빨라지는 배 */
    eliteHp: 10,
    bossHp: 45,
    bossAtk: 1.8,
    bossEnrage: 1.35,
    /** 남은 몹이 이보다 적으면 새 무리 */
    refillBelow: 5,
    /** 연타: 이 시간 안에 계속 때려야 이어짐 · 보너스 상한 / KILLS 연속 시간 */
    hitWindow: 2,
    hitBonusMax: 0.1,
    streakWindow: 4,
    /** 장비: 한 판 기대 개수(정예 확정 1개 별도) · 줍는 거리 */
    dropsPerRun: 1.2,
    pickR: 0.9,
    /** 핫픽스 9: 굼벵이 같다는 피드백 → 캐릭터 +30% · 몬스터 +25% · 구르기 거리도 이동 속도에 비례 (예고 0.6초는 그대로) */
    move: 3.2 * 1.3,
    dodge: { inv: 0.35, cd: 1.5, dist: 1.9 * 1.3, dur: 0.3 },
    mobSpeed: 1.25,
    /** 직업별 이동 체감: 도적 +10% · 기사 −5% */
    jobMove: { rogue: 1.1, knight: 0.95 } as Record<string, number>,
    combo: { window: 0.55, swing: 0.24, range: 1.05, arc: 1.25, mult: [1, 1.1, 1.6] },
    /** 직업별 기본 공격 (핫픽스 7): swing=한 번 휘두르는 초 · dmg=힘 배율 · 근접은 range·arc(부채꼴), 원거리는 speed(탄 속도)
     *  초당 힘(dmg/swing)은 비슷하게 맞추고 손맛만 다르게: 마법사 느리고 셈 · 도적 빠르고 약함 */
    jobAtk: {
      knight: { swing: 0.26, dmg: 1.0, range: 1.05, arc: 1.25 },
      warrior: { swing: 0.36, dmg: 1.45, range: 1.2, arc: 1.8 },
      rogue: { swing: 0.14, dmg: 0.55, range: 0.9, arc: 0.95 },
      priest: { swing: 0.3, dmg: 1.05, range: 1.0, arc: 1.4 },
      mage: { swing: 0.6, dmg: 2.2, range: 0, arc: 0, speed: 5 },
      hunter: { swing: 0.18, dmg: 0.7, range: 0, arc: 0, speed: 10 },
    } as Record<string, { swing: number; dmg: number; range: number; arc: number; speed?: number }>,
    /** 동료가 내 곁에 서는 거리 (타일) */
    allyGap: 1.5,
    /** 전투 줌 단계 (지금 배율에 곱함, 정수로 반올림) · 기본은 한 단계 멀리 */
    zoomSteps: [0.5, 0.75, 1],
    zoomDefault: 1,
    hold: 0.25,
    hitstop: { hit: 0.05, crit: 0.09, kill: 0.12 },
    knock: { hit: 6, crit: 12, kill: 20 },
    shake: { crit: 2, boss: 4, dur: 0.12 },
    critChance: 0.15,
    /** 피해: 전투력 × dmgK × 콤보 배율 · 몬스터 체력 = 추천 전투력 × mobHpK */
    dmgK: 0.32,
    mobHpK: { slime: 0.9, goblin: 1.15 },
    /** 파티 평균 전투력이 추천보다 세면 몬스터 체력 × (비율^toughExp, 비율은 최대 4) */
    toughExp: 0.85,
    toughCap: 6,
    /** 동료 AI 피해 배율 (내 손이 주인공이 되게) */
    allyDmg: 0.6,
    /** 몬스터 공격력 = mobAtk + 추천 전투력 × mobAtkK */
    mobAtk: 6,
    mobAtkK: 0.12,
    hpBase: 120,
    hpPerLv: 12,
    tele: 0.6,
    recover: 0.8,
    chemPerHit: 3,
    ultMult: 3.5,
    skillCd: [5, 8],
    /** AUTO: 예고 범위 안이면 이 확률로 구른다 */
    autoDodge: 0.5,
    /** 평가 · 보상 배율 */
    /** 평가 점수 = 100 − 맞은 횟수×perHit − (시간 비율−timeFree)×perTime + min(KILLS 연속, streakCap)×perStreak → s 이상 S · a 이상 A */
    grade: { perHit: 4, timeFree: 0.1, perTime: 100, perStreak: 1, streakCap: 20, s: 90, a: 70, bonus: { S: 0.3, A: 0.15, B: 0 } },
    sweep: 0.7,
    allyVol: 0.6,
  },
  /** 시험용: 천장·원정 시간을 줄인다 (?test=1 로 열면 켜짐) */
  test: {
    pity: 3,
    timeScale: 0.02,
  },
  save: {
    key: 'legacy-of-adventure-save',
    reportKey: 'legacy-of-adventure-reports',
    version: 7,
    /** 자동 저장 간격 (초). 건설·레벨업 직후에도 저장 */
    autosaveSeconds: 10,
  },
};
