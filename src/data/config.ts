// 모든 숫자(가격·속도·확률·시간)를 이 파일 한 곳에 모은다. 밸런스는 여기서만 고친다.

export const CONFIG = {
  map: {
    /** 맵 최대 크기 (타일) */
    size: 14,
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
  },
  /** 땅 넓히기 5단계: 울타리 범위 [시작, 끝) 과 비용 */
  land: [
    { size: '6×6', from: 4, to: 10, cost: 0, opens: '여관 본관, 우물' },
    { size: '8×8', from: 3, to: 11, cost: 300, opens: '나무·모닥불 자리' },
    { size: '10×10', from: 2, to: 12, cost: 800, opens: '주점·훈련장·텃밭·게시판' },
    { size: '12×12', from: 1, to: 13, cost: 1600, opens: '대장간·객실 별채' },
    { size: '14×14', from: 0, to: 14, cost: 3000, opens: '온천, 최대 크기' },
  ],
  economy: {
    /** 시안은 2,400으로 시작. 실제 게임은 오프닝 뒤 이 금액으로 시작 */
    startGold: 1240,
    /** 손님이 건물에 들어갈 때 버는 돈 (행동별) */
    income: { sleep: 12, drink: 6, forge: 8, bath: 10 } as Record<string, number>,
    dungeonMin: 40,
    dungeonMax: 120,
  },
  build: {
    /** 비계+먼지 시간 (초) */
    constructSeconds: 2.2,
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
  },
  ui: {
    toastMs: 2200,
    /** 대화창 한 글자 간격 (ms) */
    typeMs: 32,
    chatTickMs: 5500,
  },
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
    /** 글자 크기 (px). Galmuri는 11의 배수에서 가장 또렷 */
    fonts: {
      phone: { dlg: 11, name: 11, ui: 11, small: 11, chat: 11, big: 22, tiny: 9 },
      tablet: { dlg: 22, name: 22, ui: 18, small: 14, chat: 16, big: 22, tiny: 11 },
      wide: { dlg: 22, name: 22, ui: 18, small: 14, chat: 16, big: 22, tiny: 11 },
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
  landStars: [0, 1, 2, 3, 4],
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
    /** 의뢰 걸리는 시간 (현실 분): 짧음·보통·김·아주 김 */
    tierMinutes: [5, 30, 120, 480],
    /** 걸리는 시간 단계마다 보상 배수 */
    tierReward: [1, 3, 8, 20],
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
    /** 걸리는 시간 단계마다 추천 전투력 배수 */
    tierPower: [1, 1.4, 1.9, 2.6],
    /** 성공률 = (파티 전투력 ÷ 추천) × 이 값, 최소·최대 */
    successScale: 0.85,
    successMin: 0.05,
    successMax: 0.97,
    /** 실패해도 받는 보상 비율, 깎이는 체력 */
    failReward: 0.35,
    failHp: 45,
    winHp: 15,
    partyMin: 2,
    partyMax: 4,
    /** 원정에 못 가는 체력 */
    minHp: 30,
    /** 하루 의뢰 개수, 무료 새로고침 */
    questsMin: 3,
    questsMax: 5,
    freeRefreshPerDay: 1,
    /** 동시에 보낼 수 있는 파티 = 1 + 게시판 레벨 (최대) */
    maxParties: 4,
    /** 천장: 같은 지역에서 전설이 이만큼 안 나오면 다음은 확정 (테스트할 땐 낮춘다) */
    pity: 50,
    /** 지역 재료 개수 */
    mats: [2, 4],
  },
  items: {
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
    levelCosts: [0, 500, 900, 1500, 2500],
  },
  garden: {
    plots: 3,
    /** 작물: 자라는 시간(현실 분)·씨앗 값·수확량 */
    crops: {
      carrot: { name: '당근', minutes: 10, seed: 10, yield: 3 },
      pumpkin: { name: '호박', minutes: 30, seed: 25, yield: 6 },
      cabbage: { name: '양배추', minutes: 60, seed: 40, yield: 10 },
    } as Record<string, { name: string; minutes: number; seed: number; yield: number }>,
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
  /** 시험용: 천장·원정 시간을 줄인다 (?test=1 로 열면 켜짐) */
  test: {
    pity: 3,
    timeScale: 0.02,
  },
  save: {
    key: 'legacy-of-adventure-save',
    reportKey: 'legacy-of-adventure-reports',
    version: 2,
    /** 자동 저장 간격 (초). 건설·레벨업 직후에도 저장 */
    autosaveSeconds: 10,
  },
};
