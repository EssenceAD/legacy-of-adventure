// 게임 한 판의 공유 상태. 모든 world/ ui/ 모듈이 이 객체들을 함께 본다.
import { CONFIG } from '../data/config';
import type { Kind } from '../data/catalog';
import type { ClassKey, Race, Rarity, Face } from '../data/classes';
import type { Grade, OptKey, RegionId, Slot, StatKey, WeaponKind } from '../data/items';
import type { Neighbor } from '../data/neighbors';

export interface Building {
  kind: Kind;
  tx: number;
  ty: number;
  fw: number;
  fh: number;
  /** 지금 그림 (레벨업하면 바뀜) */
  sprite: string | null;
  lvl: number;
  /** 지붕 색 hue (null = 원래 색) */
  hue: number | null;
  /** 안에 있는 손님 */
  inside: Actor[];
  /** 새로 짓는 중이면 1 (아직 못 씀) — 시간은 con */
  build?: number;
  /** CONSTRUCTION_SPEC: 공사 (새 짓기·업그레이드) */
  con?: import('./construct').Con;
  /** 완성·레벨업 때 살짝 튀는 연출 (1 → 0) */
  pop?: number;
  /** 텃밭 칸 (작물, 심은 시각 ms) */
  plots?: { crop: string | null; at: number }[];
  /** 좌우 반전 (문이 오른쪽 면으로). 그림 키는 sprite~f */
  flip?: boolean;
  /** 핫픽스 10: 지은 시각(ms) — 5분 안 철거는 전액 환불 · 마을 등급 장식을 옮겨 놓은 것(무료, 환불 없음) */
  builtAt?: number;
  fromProp?: boolean;
  /** HOTFIX14 §1: 두 번째 채부터 실제로 낸 건설비 (기본값과 다를 때만) */
  paid?: number;
}

export type ActorState = 'idle' | 'walk' | 'in' | 'atk' | 'pray' | 'sit' | 'door';

/**
 * 문 열고 들어가기/나오기 연출.
 * 들어가기: walk(문 앞 칸 → 실제 문 앞까지 걸음) → step(문 열림, 문 안쪽으로 몇 px, 문 영역으로 가려짐)
 * 나오기:   step(문 열림, 문 안에서 걸어 나옴) → walk(문 앞 칸으로)
 */
export interface DoorAnim {
  o: Building;
  dir: 'in' | 'out';
  phase: 'walk' | 'step';
  /** 지금 단계에서 흐른 시간 / 단계 길이 (초) */
  t: number;
  dur: number;
  then: () => void;
}

export interface Actor {
  kind: ClassKey;
  name: string;
  x: number;
  y: number;
  /** 1 = 화면 오른쪽, -1 = 왼쪽(좌우 반전) */
  dir: 1 | -1;
  /** 화면 안쪽(위)으로 걷는 중 → 뒷모습 */
  back: boolean;
  st: ActorState;
  /** 지금 상태의 남은 시간 (초) */
  t: number;
  /** 애니메이션 위상 (모두 같은 박자로 움직이지 않게) */
  ph: number;
  /** npc = 우체부 모모, keeper = 오프닝의 노주인, owner = 여관 주인(나) */
  role?: 'npc' | 'keeper' | 'owner';
  path: [number, number][] | null;
  then?: (() => void) | null;
  lvl: number;
  hp: number;
  food: number;
  mood: number;
  hidden: boolean;
  at: Building | null;
  party?: boolean;
  /** 나타날 때 서서히 보이기 (0.4 → 0) */
  pop?: number;
  bub?: HTMLElement | null;
  /** 노주인 퇴장처럼 사라지는 중 */
  fading?: number;
  /** 문 열고 들어가기/나오기 중 */
  door?: DoorAnim | null;

  // ── 2단계: 손님 = 수집 대상 ──
  /** 저장용 번호 (npc는 0) */
  id: number;
  race: Race;
  rarity: Rarity;
  /** 특별·전설 손님의 고유 얼굴·머리색 */
  face?: Face;
  hair?: string;
  xp: number;
  /** 방문 손님(묵음) / 단골(내 모험가) / 영웅 / 지나가는 손님(낮에만 들렀다 저녁 전에 떠남) */
  status: 'visitor' | 'regular' | 'hero' | 'passer';
  /** 방문 손님이 떠나는 날 */
  leaveDay: number;
  /** 머무는 동안 기분 평균 (단골 제안·일찍 떠나기 판단) */
  moodSum: number;
  moodN: number;
  equip: Record<Slot, number | null>;
  /** 원정 중이면 원정 번호 */
  runId: number | null;
  heroId?: string;
  /** 전설 영웅 (3단계) */
  legendId?: string;
  /** 영웅·전설 별 (1~5) */
  stars?: number;
  /** 금빛 발자국이 남는 남은 시간 (전설 방문) */
  goldSteps?: number;
  /** 마을 밖으로 걸어 나가는 중 */
  leaving?: boolean;
  /** 지금 채우러 가는 욕구 (창에 표시) */
  intent?: string;
}

export interface LegendState {
  st: 'rumor' | 'visit' | 'joined';
  gauge: number;
  /** 방문 중: 떠나는 시각(ms) · 부탁 진행 · 이미 센 것(작물 종류 등) */
  until?: number;
  prog?: number;
  seen?: string[];
  /** 연속 막기 같은 한 판 기록 */
  best?: number;
}

/** 토벌 한 판 기록 (2차에서 서버 랭킹으로 올린다) */
export interface RaidRecord {
  week: string;
  bossId: string;
  damage: number;
  power: number;
  /** 전투력 기반 이론치 (서버 검증: damage ≤ theory × recordCap) */
  theory: number;
  mode: 'auto' | 'manual';
  at: number;
}

/** 단골 대기 목록에 보관하는 손님 (다시 찾아올 때 이 모습 그대로) */
export type WaitGuest = Pick<Actor, 'id' | 'kind' | 'name' | 'lvl' | 'xp' | 'race' | 'rarity' | 'face' | 'hair'>;

// ═════════════ 2단계 저장 데이터 모양 ═════════════

export interface ItemOpt {
  k: OptKey;
  v: number;
  /** 지역 피해 옵션의 지역 */
  region?: RegionId;
}

export interface Item {
  id: number;
  region: RegionId;
  slot: Slot;
  grade: Grade;
  wkind?: WeaponKind;
  name: string;
  /** 기본 능력치 */
  stats: Partial<Record<StatKey, number>>;
  opts: ItemOpt[];
  enh: number;
  /** 세트 부위인가 (지역 세트) */
  set: boolean;
  /** 유물 고유 효과 */
  uniq?: string;
  /** 처음 얻은 칸이면 NEW! */
  isNew?: boolean;
  /** 끼고 있는 손님 id */
  owner?: number | null;
  /** 핫픽스 12 §1-3: 잠금 — 자동 장착·자동 분해에서 빠짐 */
  locked?: boolean;
}

export interface Quest {
  id: number;
  /** 새 게임 첫 원정 (30초 · 성공 · 희귀 장비 확정) */
  tutorial?: boolean;
  /** 이름이 있는 의뢰 */
  name?: string;
  region: RegionId;
  /** 걸리는 시간 단계 0~3 */
  tier: number;
  power: number;
  minutes: number;
  gold: [number, number];
  /** 핫픽스 12 §2-4: 조건 태그 (맞으면 보상 +30%, 안 맞아도 보낼 수 있음) */
  tag?: QuestTag;
  /** BUILDINGS_SPEC: 길드 특별 의뢰 (이기면 보스 재료) */
  guild?: boolean;
}

export interface QuestTag {
  k: 'race' | 'kind' | 'noKind' | 'maxLvl';
  v: string;
  n: number;
  text: string;
}

export interface Run {
  id: number;
  quest: Quest;
  members: number[];
  start: number;
  end: number;
  /** 결과가 정해졌으면 */
  result?: RunResult;
  /** 마을로 돌아왔다(받기 끝) */
  claimed?: boolean;
}

export interface RunResult {
  win: boolean;
  gold: number;
  xp: number;
  mats: number;
  items: Item[];
  /** 보고서 줄: [말하는 사람(직업 키·영웅 초상화 키·narr), 문장, 이름표] */
  report: [string, string, string?][];
  levelUps: string[];
  newChem: string[];
  /** 핫픽스 12 §6: 결과 창 한 줄 「♥ 수호의 맹세 4단계」 */
  chemUps?: string[];
}

export type IncomeKind = 'sleep' | 'drink' | 'forge' | 'bath' | 'dungeon' | 'stall';

export const S = {
  land: 1,
  night: false,
  /** 0 = 낮 ~ 1 = 밤 (부드럽게 넘어감) */
  nightT: 0,
  day: 1,
  gold: CONFIG.economy.startGold,
  innName: '',
  visiting: null as Neighbor | null,
  /** 오프닝이 끝나 마을이 돌아가는 중 */
  started: false,
  zoom: CONFIG.view.defaultZoom,
  /** 오늘의 수입 (장부) */
  ledger: { sleep: 0, drink: 0, forge: 0, bath: 0, dungeon: 0, stall: 0 } as Record<IncomeKind, number>,
  /** 게임 시간 (초, 멈춰 있으면 안 흐름) */
  time: 0,
  /** 화면 애니메이션 시간 (초) */
  T: 0,
  /** 오늘 06:00부터 흐른 게임 분 (현실 1분 = 게임 60분) */
  clock: 0,
};

/** 2단계 진행 데이터 (전부 저장된다) */
export function freshProgress() {
  return {
    nextAdvId: 1,
    nextItemId: 1,
    rep: 0,
    bag: [] as Item[],
    dust: { n: 0, r: 0, e: 0, l: 0, a: 0 } as Record<Grade, number>,
    mats: { forest: 0, swamp: 0, mine: 0, ice: 0, abyss: 0 } as Record<RegionId, number>,
    /** 텃밭 수확물 (주점 식사 품질) */
    pantry: 0,
    /** BUILDINGS_SPEC §3: 수확물 창고 (작물별 개수) · 물약 칸 · 켜진 물약 */
    crops: {} as Record<string, number>,
    potions: {} as Record<string, number>,
    buff: null as null | { id: string; until: number },
    quests: { day: '', list: [] as Quest[], refreshUsed: 0, nextId: 1 },
    runs: [] as Run[],
    nextRunId: 1,
    /** 지역별: 마지막 전설 이후 장비 수 (천장) */
    pity: { forest: 0, swamp: 0, mine: 0, ice: 0, abyss: 0 } as Record<RegionId, number>,
    dex: {
      /** 종족|직업|희귀도 */
      guests: [] as string[],
      /** 지역|부위|등급 */
      items: [] as string[],
      /** 발견한 케미 짝 id */
      chem: [] as string[],
      heroes: {} as Record<string, { appeared: boolean; recruited: boolean; stars: number }>,
      claimed: [] as string[],
    },
    /** 손님 둘 사이 친밀도 "id-id" → 짝 종류·경험치·단계 */
    bonds: {} as Record<string, { pair: string; xp: number; lv: number }>,
    counters: {
      tavernMeals: 0,
      campfireMax: 0,
      enhanceMax: 0,
      harvests: 0,
      trains: 0,
      crafted: {} as Record<string, number>,
      regionWins: { forest: 0, swamp: 0, mine: 0, ice: 0, abyss: 0 } as Record<RegionId, number>,
      expeditions: 0,
      // 3단계: 전설 영웅 소문 조건용
      forestSends: 0,
      goldTotal: 0,
      moodTopDays: 0,
      relicEver: 0,
      // 5단계: 임무 확인용
      guestTalks: 0,
      quickRuns: 0,
      goalsClaimed: 0,
      salvaged: 0,
      huntAutoUsed: 0,
      // 5단계 2차: 업적용
      huntClears: 0,
      raidTries: 0,
      giftsGiven: 0,
      shopBuys: 0,
      /** 베타: 구경거리 사건 해결 */
      eventsSolved: 0,
      /** BUILDINGS_SPEC §1: 공사 톡톡 누른 수 */
      taps: 0,
    },
    /** 토벌전: 이번 주 보스(월요일 교체) · 누적 체력 · 하루 도전 · 떠돌이 보스 · 기록 */
    raid: {
      week: '',
      bossId: '',
      hpLeft: 0,
      killed: false,
      /** 이번 주 한 판 최고 피해량 (주간 토벌 랭킹 기준) */
      best: 0,
      day: '',
      tries: 0,
      /** 이번 주 참여 보상(인연의 증표)을 받았나 */
      joined: false,
      alarmed: false,
      wander: null as null | { bossId: string; until: number; hpLeft: number; max: number },
      firstKills: [] as string[],
      kills: {} as Record<string, number>,
      personalBest: 0,
      /** 주간 보스를 처치한 주 수 (2차 전까지 「상위 30%」 대신) */
      weeksKilled: 0,
      /** 서버로 올릴 기록 (로그인 안 했을 때 쌓아 두고 로그인 뒤 한꺼번에 올린다) */
      outbox: [] as RaidRecord[],
      /** 주간 토벌 상위 30% 든 주 수 (진의 소문 조건) · 지난주 · 판정한 주 · 1위 알림 낸 주 */
      topWeeks: 0,
      prevWeek: '',
      rankChecked: '',
      rank1Week: '',
    },
    /** 보스 전용 재료 */
    bossMats: {} as Record<string, number>,
    trophies: [] as string[],
    titles: [] as string[],
    /** 핫픽스 12 §6: 케미 소식(대화창 대신 모아 두기) · 오늘 띄운 케미 대화 수 · 5단계를 찍은 짝 */
    chemNews: { list: [] as { t: number; text: string }[], unread: 0, day: '', shown: 0 },
    chem5: [] as string[],
    /** 전설 영웅: 소문 → 인연 게이지 → 방문 → 영입 */
    legends: {} as Record<string, LegendState>,
    /** 마지막으로 밤 방문 판정을 한 실제 날짜, 운명의 별을 잡은 실제 날짜, 새벽 접속을 센 날짜 */
    legendDay: '',
    starDay: '',
    dawnDay: '',
    /** 인연의 증표 */
    tokens: 0,
    /** 서버에 평판·도감 통계를 올린 실제 날짜 */
    statsDay: '',
    goals: { day: '', list: [] as { id: string; target: number; progress: number; claimed: boolean }[] },
    /** 지난 7일(게임 날) 수입 */
    week: [] as { day: number; gold: number }[],
    autoSalvage: false,
    /** HOTFIX14 §2: 일괄 분해 마지막 선택 · 자동 분해 등급(끔 / 일반 / 희귀 이하) */
    salvage: { grades: ['n'] as string[], upgraded: false, keepBest: true, auto: '' as '' | 'n' | 'r' },
    /** 단골 자리가 없을 때 단골이 되고 싶어 한 손님 (최대 3명, 자리가 나면 다시 찾아온다) */
    waitlist: [] as WaitGuest[],
    /** 핫픽스 10 §15: 단골 자리가 새로 생긴 만큼 「빠른 제안」 (받으면 하나 줄어든다) · 옛 저장 구제 1번 · 모모 안내 횟수 */
    fastSlots: 0,
    fastRescued: false,
    fastHintN: 0,
    /** 핫픽스 11: 폰에서 20분 넘게 하면 「배터리 절약」 안내 한 번 (계정당) */
    saverHint: false,
    /** 땅 개편 §4: 처음 지을 때 울타리 안 초록 안내를 봤나 */
    buildTipSeen: false,
    /** 마지막으로 켜 있던 현실 시각 (방치 계산) */
    lastSeen: Date.now(),
    /** 게임 시간으로 마지막 손님 도착 판정 시각 (게임 시) */
    lastArriveHour: 0,
    // ── 4단계: 주인공 · 인연 · 엔딩 (전부 progress 안이라 클라우드 저장에도 같이 올라간다) ──
    /** 여관 주인 = 나. null이면 다음 접속 때 「당신은 누구였나요?」 */
    owner: null as OwnerState | null,
    /** 인연(호감도) 27명: id → 수치·본 단계·오늘 말 걸기/선물·알아낸 취향·관계 */
    ties: {} as Record<string, TieState>,
    /** 선물 가방 */
    gifts: {} as Record<string, number>,
    /**
     * 5단계 가이드 임무 「버나드의 장부」: 지금 임무 번호 · 받은 임무 · 본 장 컷 · 연 기능
     * legacy = 5단계 전 저장 (기능을 잠그지 않는다 — 이미 쓰던 걸 막으면 안 된다)
     */
    guide: { idx: 0, claimed: [] as string[], cut: 0, legacy: false, unlocked: [] as string[] },
    /**
     * 5단계 2차: 업적(받은 것) · 칭호(달고 있는 것) · 출석 · 상점(오늘 진열·산 것) · 우편함 · 안내서(본 쪽)
     */
    meta: {
      ach: [] as string[],
      title: '',
      attend: { total: 0, last: '' },
      shop: { day: '', items: [] as string[], bought: [] as string[] },
      mail: [] as Mail[],
      mailNext: 1,
      welcome: false,
      /** 핫픽스 12 §3: 원정 5번째 자리 (폐광 의뢰 3번 성공 또는 폐광 사냥 1-10 돌파) · 파티 창 「열림!」을 봤나 */
      slot5: false,
      slot5Seen: false,
      /** CONSTRUCTION_SPEC §4: 「모모의 응원」을 쓴 날 · HOTFIX14 §5 선물로 받은 추가 횟수 */
      cheerDay: '',
      cheerBonus: 0,
      /** HOTFIX14 §5: 업데이트 선물을 받은 버전 · 선물 장식(무료로 놓기) */
      giftVer: '',
      /** HOTFIX14 §5: 같은 건물 2채 저장 사과 편지를 보냈나 */
      sorryDupe: false,
      giftDeco: {} as Record<string, number>,
    },
    /** 5단계 사냥: 지역별 최고 돌파 스테이지 · 첫 돌파 · 자동 사냥 · 방치 정산 시각 */
    hunt: {
      best: {} as Record<string, number>,
      firstClear: [] as string[],
      /** 맡겨 둔 사냥 · n/gold = 맡긴 뒤 판 수·금화 (핫픽스 10 마을 줄) */
      auto: null as null | { region: string; stage: number; members: number[]; n?: number; gold?: number; next?: boolean },
      idleAt: 0,
      /** 핫픽스 10: 처음 깼을 때 모모의 「맡겨 두기」 안내 (계정당 1번) */
      autoHint: false,
      /** 핫픽스 10 §13: 접어 둔 사냥 (앱을 껐다 켜면 결과를 계산해 보여 준다) */
      folded: null as null | { region: string; stage: number; members: number[]; at: number },
      /** 증표 조각 (10개 = 인연의 증표 1) */
      shards: 0,
    },
    /**
     * 유산: 세대 · seen = 이 마을에서 본 엔딩(유산 보너스 기준, 새 여관 열기 때 초기화)
     * album·cards = 엔딩 앨범(지금까지 본 엔딩 전부, 새 여관 열기를 해도 남는다) · 앞 주인
     */
    legacy: { gen: 1, seen: [] as string[], album: [] as string[], cards: {} as Record<string, EndingCard>, prev: null as PrevOwner | null, letterDay: '',
      /** STORY_V1 §5: 유산 포인트 · 모은 기억 조각 수 · 옛 저장에 포인트·기억을 한 번 채웠나 · 지난 회차 가장 친했던 단골 (이름·직업·종족) */
      pts: 0, mem: 0, v14: false, prevFav: null as null | { name: string; kind: string; race?: string } },
    /**
     * STORY_V1: 막 · 고른 루트 · 루트 점수(보이지 않게) · 이 회차에 본 대사 · 이 회차 시작 일차 · 막이 오른 일차
     * 회차를 넘어 남는 것(회차 = legacy.gen · 엔딩 = legacy.album · 유산 포인트 · 기억)은 legacy에 있다
     */
    story: {
      act: 0 as 0 | 1 | 2 | 3,
      route: null as null | string,
      score: { hero: 0, legend: 0, town: 0, love: 0, retire: 0 } as Record<string, number>,
      seen: [] as string[],
      day0: 1,
      actDay: {} as Record<string, number>,
      /** 3막 편지: 0 아직 · 1 받음(고르기 전) · 2 고름 · 루트를 한 번 바꿨나 */
      letter: 0,
      changed: false,
      /** 손님 기분 최고인 날 수 (이 회차) · 마지막으로 센 날 */
      goodDays: 0,
      goodLast: 0,
      /** 후계자: 0 아직 · 1 왔음(말 걸면 엔딩) · 2 엔딩 봄 · 목표를 다 채운 날 */
      heir: 0,
      readyDay: 0,
      /** 이 회차 플레이 시간 (분) */
      playMin: 0,
    },
    /**
     * 베타 1장 어울림: 발견한 조합 · 숨은 조합 힌트 단계(1~3) · 마지막 힌트를 연 날 · 「어울림 보기」
     * moved = 마을 안으로 옮긴 등급 장식 (k@x,y) · plaques = 받은 평가 현판 종류
     */
    harmony: { found: [] as number[], hint: {} as Record<number, number>, hintDay: 0, show: false, moved: [] as string[], plaques: [] as string[], migrate: false },
    /**
     * 베타 3장 하루 마감 정산: 이번 날(자정까지) 모으는 중 · 지난 날들 · 아직 못 보여 준 정산 · 최고 수입
     */
    daily: {
      cur: { day: 0, gold0: -1, arrivals: 0, newHarm: 0, newDex: 0, moodSum: 0, moodN: 0 },
      log: [] as DayLog[],
      pending: [] as DayLog[],
      best: 0,
    },
    /** 베타 5장: 강해지는 순간 — 마지막으로 보여 준 전투력 · 구성(이유 찾기) · 도감 단계 카드 · 사냥/토벌 준비 지난 전투력 */
    power: { shown: 0, comps: {} as Record<string, number>, dexMs: 0, prep: {} as Record<string, number> },
    /**
     * 베타 2장 여관 평가단: 이번 시즌(실제 주) · 테마 · 암행 보너스 · 평가를 마친 시즌 · 최고 등급(0 없음~4 전설) · 지난 결과
     */
    evaluation: {
      season: '',
      theme: 0,
      bonus: 0,
      secretDone: false,
      judged: '',
      best: 0,
      history: [] as { season: string; theme: number; score: number; tier: number }[],
      /** 시즌 시작 시점 수치 (이번 시즌에 늘어난 만큼만 센다) */
      base: {} as Record<string, number>,
    },
  };
}

/** 하루 마감 정산 한 장 */
export interface DayLog {
  day: number;
  gold: number;
  guests: number;
  mood: number;
  newHarm: number;
  newDex: number;
}

/** 우편함: 출석·랭킹·운영자 선물·앞 주인 편지 */
export interface Mail {
  id: number;
  from: 'attend' | 'rank' | 'admin' | 'prev' | 'system';
  title: string;
  body: string;
  reward: { gold?: number; dust?: number; tokens?: number; shards?: number; gift?: string; dustR?: number; cheer?: number; deco?: string };
  /** HOTFIX14 §5: 업데이트 선물이면 그 버전 */
  ver?: string;
  at: number;
  claimed: boolean;
}

export interface OwnerState {
  name: string;
  gender: 'm' | 'f';
  job: 'knight' | 'warrior' | 'rogue' | 'mage' | 'priest' | 'hunter';
  /** 출신 키 (ORIGINS 6개 또는 disciple · child) */
  origin: string;
  stats: Record<'hp' | 'cook' | 'talk' | 'craft' | 'nerve' | 'heart', number>;
  /** 연결된 영웅 (전설 키) */
  linked: string[];
  /** 주인이 된 실제 시각 (달력 기준) */
  born: number;
  /** 능력치 매일 상승을 받은 날 · 오늘 행동으로 오른 양 */
  statDay: string;
  todayGain: Record<string, number>;
  /** 오늘 행동력 */
  energyDay: string;
  energyUsed: number;
  /** 방랑의 불씨 (숨은 게이지) · 오늘 행동으로 오른 양 · 본 독백 · 다음 선택 시각 */
  ember: number;
  emberDay: string;
  emberToday: number;
  emberMarks: number[];
  askAt: number;
  /** 본 계절 번호 · 재회 대사를 본 연결 영웅 */
  season: number;
  met: string[];
  /** 엔딩을 봤다 (계속 운영 중) */
  ended: string | null;
}
export interface TieState {
  pts: number;
  /** 본 단계 (1 = 낯섦). 수치가 다음 단계에 닿으면 이벤트를 보고 오른다 */
  stage: number;
  talkDay: string;
  giftDay: string;
  /** 알아낸 취향 */
  knowLike: boolean;
  knowHate: boolean;
  rel?: 'lover' | 'comrade';
}
export interface EndingCard {
  at: number;
  gen: number;
  owner: string;
  job: OwnerState['job'];
  gender: OwnerState['gender'];
  partner?: string;
  rel?: 'lover' | 'comrade';
  /** STORY_V1: 스토리 엔딩 카드 — 운영 일수 · 플레이 시간(분) · 단골 수 · 가장 친한 단골 · 얻은 유산 포인트 */
  day?: number;
  playMin?: number;
  regulars?: number;
  fav?: string;
  pts?: number;
}
export interface PrevOwner {
  name: string;
  job: OwnerState['job'];
  gender: OwnerState['gender'];
  origin: string;
  ending: string;
  linked: string[];
}
export type Progress = ReturnType<typeof freshProgress>;
export const P: Progress = freshProgress();
export function resetProgress(p: Partial<Progress> = {}) {
  Object.assign(P, freshProgress(), p);
}

export const world = {
  objs: [] as Building[],
  actors: [] as Actor[],
  /** 이웃 방문 중엔 내 마을을 여기 보관 */
  home: null as { objs: Building[]; actors: Actor[]; land: number } | null,
};

// ───────── 게임 시간 예약 (setTimeout 대신: 멈추면 같이 멈춘다) ─────────
interface Job {
  at: number;
  fn: () => void;
}
const jobs: Job[] = [];
export function later(seconds: number, fn: () => void) {
  jobs.push({ at: S.time + seconds, fn });
}
export function runJobs() {
  for (let i = jobs.length - 1; i >= 0; i--) {
    if (jobs[i].at <= S.time) {
      const j = jobs.splice(i, 1)[0];
      const t0 = performance.now();
      j.fn();
      const ms = performance.now() - t0;
      if (import.meta.env.DEV && ms > 5) console.warn('느린 예약 작업', ms.toFixed(1) + 'ms', j.fn.toString().slice(0, 120));
    }
  }
}
export function clearJobs() {
  jobs.length = 0;
}

export const pick = <T>(a: readonly T[]): T => a[(Math.random() * a.length) | 0];

/** 대화 한 줄: [누가(직업 키·narr·keeper…), 대사, 'name'이면 이름 짓기, 이름표 덮어쓰기] */
export type TalkLine = [string, string, ('name' | undefined)?, string?];
export interface TalkChoice {
  label: string;
  fn: () => void;
}

/** world → ui 알림 통로 (ui 모듈이 시작할 때 채운다. 서로 import가 꼬이지 않게) */
export const uiHooks = {
  toast: (_text: string) => {},
  toastHtml: (_html: string) => {},
  /** 대화창 (끝에 고르기 버튼을 달 수 있다) */
  talk: (_lines: TalkLine[], _done?: () => void, _choices?: TalkChoice[]) => {},
  /** 원정 결과 보고서 창 */
  report: (_run: Run) => {},
  /** [소문] 채널에 한 줄 (전설 소문) */
  rumor: (_text: string) => {},
  /** [알림] 채널 방송 (전설 영입·보스 처치·주간 1위). kind가 있으면 로그인했을 때 서버가 모두에게 */
  announce: (_text: string, _kind?: 'legend' | 'boss_kill' | 'rank1', _arg?: string) => {},
  /** 화면 흔들림 (보스 경보) */
  shake: () => {},
};

/** 전설 영웅 인연 활동·부탁 진행 알림 통로 (world/legends.ts가 채운다) */
export const legendHooks = {
  bond: (_e: string, _n?: number) => {},
  req: (_e: string, _n?: number, _tag?: string) => {},
};

/** 금화 벌기: 장부에 기록 (이웃 방문 중엔 안 번다) */
export function earn(v: number, kind: IncomeKind) {
  if (S.visiting) return;
  S.gold += v;
  S.ledger[kind] += v;
  gotGold(v);
}

/** 금화를 벌 때마다: 누적 금화(전설 소문 조건) · 500G마다 인연 활동 · 부탁 진행 */
let goldAcc = 0;
export function gotGold(v: number) {
  if (v <= 0) return;
  P.counters.goldTotal += v;
  goldAcc += v;
  while (goldAcc >= 500) {
    goldAcc -= 500;
    legendHooks.bond('goldEarn');
  }
  legendHooks.req('goldEarned', v);
}

// 저장해야 할 일이 생기면 표시 → main 루프가 곧 저장한다
let dirty = false;
export const markDirty = () => {
  dirty = true;
};
export const takeDirty = () => {
  const d = dirty;
  dirty = false;
  return d;
};
