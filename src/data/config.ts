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
  },
  loop: {
    /** 게임 규칙 갱신 주기 (초) — 화면은 rAF로 따로 그린다 */
    updateStep: 1 / 30,
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
  save: {
    key: 'legacy-of-adventure-save',
    reportKey: 'legacy-of-adventure-reports',
    version: 1,
    /** 자동 저장 간격 (초). 건설·레벨업 직후에도 저장 */
    autosaveSeconds: 10,
  },
};
