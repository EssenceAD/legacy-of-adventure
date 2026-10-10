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
  /** 공사 중이면 남은 초 */
  build?: number;
  /** 완성·레벨업 때 살짝 튀는 연출 (1 → 0) */
  pop?: number;
  /** 텃밭 칸 (작물, 심은 시각 ms) */
  plots?: { crop: string | null; at: number }[];
  /** 좌우 반전 (문이 오른쪽 면으로). 그림 키는 sprite~f */
  flip?: boolean;
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
}

export type IncomeKind = 'sleep' | 'drink' | 'forge' | 'bath' | 'dungeon';

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
  ledger: { sleep: 0, drink: 0, forge: 0, bath: 0, dungeon: 0 } as Record<IncomeKind, number>,
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
    /** 단골 자리가 없을 때 단골이 되고 싶어 한 손님 (최대 3명, 자리가 나면 다시 찾아온다) */
    waitlist: [] as WaitGuest[],
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
     * 유산: 세대 · seen = 이 마을에서 본 엔딩(유산 보너스 기준, 새 여관 열기 때 초기화)
     * album·cards = 엔딩 앨범(지금까지 본 엔딩 전부, 새 여관 열기를 해도 남는다) · 앞 주인
     */
    legacy: { gen: 1, seen: [] as string[], album: [] as string[], cards: {} as Record<string, EndingCard>, prev: null as PrevOwner | null, letterDay: '' },
  };
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
