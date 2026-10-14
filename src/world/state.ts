// 게임 한 판의 공유 상태. 모든 world/ ui/ 모듈이 이 객체들을 함께 본다.
import { CONFIG } from '../data/config';
import type { Kind } from '../data/catalog';
import type { ClassKey, Race, Rarity, Face } from '../data/classes';
import { REGIONS, type Grade, type OptKey, type RegionId, type Slot, type StatKey, type WeaponKind } from '../data/items';
/** 지역마다 0 (REGIONS2: 새 지역 칸도 같이) */
const perRegion = () => Object.fromEntries(REGIONS.map((r) => [r.id, 0])) as Record<RegionId, number>;
import type { Neighbor } from '../data/neighbors';
import { freshAlmanac, freshDaybook, freshHarvest } from './hvState';

/** BUILDUX §2-3: 보관함에 넣어 둔 건물·장식 (레벨·색·방향 그대로) */
/** 맡겨 둔 사냥 한 칸 · n/gold = 맡긴 뒤 판 수·금화 · mats = 맡긴 뒤 지역 재료 (huntSlots 켬일 때만 센다) */
export interface HuntAuto {
  region: string;
  stage: number;
  members: number[];
  n?: number;
  gold?: number;
  next?: boolean;
  mats?: number;
}
export interface StoredObj {
  kind: Kind;
  lvl: number;
  hue: number | null;
  flip: boolean;
  plots?: Building['plots'];
  builtAt?: number;
  paid?: number;
  fromProp?: boolean;
}

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
  role?: 'npc' | 'keeper' | 'owner' | 'yuan';
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
  /** ONBOARDING §2: 첫 손님 (누르면 체크인) */
  firstGuest?: boolean;
  /** EASTER §2: 놀러 온 베타 개척자 (금색 이름표 · 누르면 대사 · 단골 불가) · 몇 번째 대사 · 선물 줬나 */
  cameo?: string;
  cameoI?: number;
  cameoGift?: boolean;
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
  /** HOTFIX24: 인연 게이지가 100%가 된 시각 (방문 대기 순서) */
  full?: number;
  /** HOTFIX24: 「내일 밤 들르겠대요」 편지를 보냈나 */
  told?: boolean;
  /** 핫픽스 v0.23.1: 아리아 부탁 남은 시간을 한 번 다시 3일로 늘렸나 */
  ext?: boolean;
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
  /** 서버가 거부해서 다시 올려 본 횟수 */
  tries?: number;
}

/** 단골 대기 목록에 보관하는 손님 (다시 찾아올 때 이 모습 그대로) */
export type WaitGuest = Pick<Actor, 'id' | 'kind' | 'name' | 'lvl' | 'xp' | 'race' | 'rarity' | 'face' | 'hair'>;

// ═════════════ 2단계 저장 데이터 모양 ═════════════

export interface ItemOpt {
  k: OptKey;
  v: number;
  /** 지역 피해 옵션의 지역 */
  region?: RegionId;
  /** GROWTH §3-4: 고유 장비의 고유 옵션 (재련 불가) */
  u?: boolean;
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
  /** ECONOMY §2: 초월 실패가 쌓인 성공률 보너스 (천장) */
  tPity?: number;
  /** GROWTH §3-2: 강화(+1~+10) 실패가 쌓인 성공률 보너스 (성공하면 0) */
  ePity?: number;
  /** GROWTH §3-4: 고유 장비 id (data/story/uniques) */
  uid?: string;
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

/** CHECKIN §C2 세이브에 든 설정값: at = 마지막으로 바뀐 현실 시각(ms) · v = 설정 키 → localStorage 원문(JSON 문자열) */
export interface PrefsBlob {
  at: number;
  v: Record<string, string>;
}
/** 2단계 진행 데이터 (전부 저장된다) */
export function freshProgress() {
  return {
    nextAdvId: 1,
    nextItemId: 1,
    rep: 0,
    /** CHECKIN §C2 설정값을 세이브에도 (폰·PC 같게 · ui/prefsSync) — 없으면(옛 저장·플래그 끔) 저장 JSON에 안 나온다 */
    prefs: undefined as undefined | PrefsBlob,
    bag: [] as Item[],
    dust: { n: 0, r: 0, e: 0, l: 0, a: 0 } as Record<Grade, number>,
    mats: perRegion(),
    /** 텃밭 수확물 (주점 식사 품질) */
    pantry: 0,
    /** BUILDINGS_SPEC §3: 수확물 창고 (작물별 개수) · 물약 칸 · 켜진 물약 */
    crops: {} as Record<string, number>,
    potions: {} as Record<string, number>,
    buff: null as null | { id: string; until: number },
    quests: { day: '', list: [] as Quest[], refreshUsed: 0, nextId: 1, t7: true as boolean | undefined },
    runs: [] as Run[],
    nextRunId: 1,
    /** 지역별: 마지막 전설 이후 장비 수 (천장) */
    pity: perRegion(),
    dex: {
      /** 종족|직업|희귀도 */
      guests: [] as string[],
      /** 지역|부위|등급 */
      items: [] as string[],
      /** 발견한 케미 짝 id */
      chem: [] as string[],
      /** PARTY §2: 켜 본 파티 조합 id (도감 「파티」 8칸) */
      syn: [] as string[],
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
      regionWins: perRegion(),
      expeditions: 0,
      // 3단계: 전설 영웅 소문 조건용
      forestSends: 0,
      goldTotal: 0,
      moodTopDays: 0,
      relicEver: 0,
      // 5단계: 임무 확인용
      guestTalks: 0,
      /** ONBOARDING §2: 첫 손님 체크인 */
      checkins: 0,
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
      /** PHOTO_SPEC: 찍은 사진 수 */
      photos: 0,
      /** MYTHIC: 토벌 보스 처치 · 밤 출발 의뢰 성공 */
      raidKills: 0,
      nightWins: 0,
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
      /** HOTFIX17 §2: 토벌 판 번호 · 마지막으로 정산한 판 · 오늘 도전 횟수를 한 번 돌려줬나 */
      runSeq: 0,
      lastSettled: 0,
      fix17: false,
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
      /** 서버에 이미 올린 기록 (주·보스·피해·시각) — 같은 기록을 두 번 보내지 않게 (최근 60개) */
      sent: [] as string[],
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
    /** STARFALL: 오늘 잡은 별 수 (유성우 밤엔 3번까지) */
    starN: 0,
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
    /** 핫픽스: 모험에서 지쳐 돌아온 손님 id (아리아 부탁) */
    tiredAdv: [] as number[],
    /** FEEDBACK: 내보낸 단골 (실제 3일 동안 다시 부르기) · 작별한 단골 이름 (추억) */
    formerRegs: [] as import('./dismiss').FormerReg[],
    farewells: [] as string[],
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
      /** 출석 3일째 모모 편지 「톡방」 (한 번만) */
      kakaoMail: false,
      /** 핫픽스 12 §3: 원정 5번째 자리 (폐광 의뢰 3번 성공 또는 폐광 사냥 1-10 돌파) · 파티 창 「열림!」을 봤나 */
      slot5: false,
      slot5Seen: false,
      /** PARTY §3: 사냥·토벌 4번째 자리 (훈련장 Lv5 + 장부) 열림 · 모모 편지 보냈나 · 파티 창 빈 칸 반짝을 봤나 */
      party4: false,
      party4Seen: false,
      /** PARTY §2: 처음 켜진 조합 한 줄을 보여 준 id · §1 사냥꾼 출신 주인이 첫 사냥꾼 손님을 만났나 */
      synLine: [] as string[],
      hunterMet: false,
      /** CONSTRUCTION_SPEC §4: 「모모의 응원」을 쓴 날 · HOTFIX14 §5 선물로 받은 추가 횟수 */
      cheerDay: '',
      cheerBonus: 0,
      /** HOTFIX14 §5: 업데이트 선물을 받은 버전 · 선물 장식(무료로 놓기) */
      giftVer: '',
      /** STARFALL: 별똥별 첫 안내를 했나 · 유성우 예고 편지를 보낸 주 */
      starHint: false,
      /** PHOTO_SPEC: 첫 사진 모모 한마디 */
      photoHint: false,
      showerWeek: '',
      /** ONBOARDING §4·§5: 내일 선물 약속한 날 · 받았나 · 홈 화면 안내 편지 */
      d2Promise: '',
      d2Given: false,
      a2hs: false,
      /** HOTFIX14 §5: 같은 건물 2채 저장 사과 편지를 보냈나 */
      sorryDupe: false,
      giftDeco: {} as Record<string, number>,
      /** v0.24.2: 준 레벨 장식 (inn6 · inn9 · tavern5 → 준 시각) — 두 번 안 준다 */
      lvlDeco: {} as Record<string, number>,
      /** GUEST_SPEC: 게스트에게 「계정 연결」 편지를 보냈나 */
      linkMail: false,
      /** DIRECTION §2-1: 우편함에 넣은 운영자 답장 (편지 번호@답장 시각 — 답장을 고치면 다시 온다) */
      replied: [] as string[],
      /** EASTER: 금빛 편지(보냄·받음) · 카메오 일정 · 만난 개척자 · 선물 쿠폰 */
      /** HARVEST §2 노을: 업데이트 뒤 첫 노을 한 번 (DUSK_FIRST) */
      duskFirst: false,
      easter: {} as { mail?: string; got?: string; cameoDay?: number; cameoN?: number; cameoPlan?: number; met?: string[]; expCoupon?: boolean; decoCoupon?: boolean },
    },
    /** 5단계 사냥: 지역별 최고 돌파 스테이지 · 첫 돌파 · 자동 사냥 · 방치 정산 시각 */
    /** REGIONS2: 지역 6~10 — 흩어진 별 컷 · 길잡이 별 · 첫 입장 · 보스 한 줄 · 편지 · 심연의 바닥 · 별을 삼킨 것 처치 수 (world/regions2.ts) */
    regions2: { scatter: false, stars: [] as string[], entered: [] as string[], bossShown: [] as string[], letters: [] as { id: string; day: number }[], deepOpen: false, deepKills: 0 },
    hunt: {
      best: {} as Record<string, number>,
      firstClear: [] as string[],
      /** 맡겨 둔 사냥 · n/gold = 맡긴 뒤 판 수·금화 (핫픽스 10 마을 줄) */
      auto: null as null | HuntAuto,
      /** PACE §2 (huntSlots): 맡겨 둔 사냥 칸 전부 — 0번 칸은 늘 위 auto 와 같다(옛 앱·옛 코드가 auto 를 그대로 읽고 쓴다) · 1·2번 칸은 장부 4장·6장에 열린다 */
      autos: [] as (HuntAuto | null)[],
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
      pts: 0, mem: 0, v14: false, prevFav: null as null | { name: string; kind: string; race?: string },
      /** MYTHIC · STORY v2/v3 (회차를 넘어 남는다): 신화로 깨어날 전설 · 별지기의 열쇠 조각 · 진 엔딩 뒤 오프닝 봄 · 부케 받은 사람(겹치지 않게) */
      mythicSeeds: [] as string[], shards: [] as string[], trueAfterSeen: false, bouquetSeen: [] as string[],
      /** DIRECTION §1: 여관 연대기(엔딩마다 한 쪽) · 옛 저장 연대기를 채웠나 · 만난 적 있는 신화(회차를 넘어) · 여정을 다 채웠나(간판 금테) · 지난 회차의 바람 */
      chron: [] as ChronPage[], chronV: false, mythicMet: [] as string[], journeyEnd: false, lastWind: '' },
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
      /** STORY v2/v3: 루트를 고른 때의 기준값(요리·사진) · 루트 사건(최종 토벌·고백·결혼식·연회·편집장·사진·그 밤) · 신화 부탁 진행 */
      base: {} as Record<string, number>,
      flags: {} as Record<string, number>,
      mythic: {} as Record<string, { prog?: number; done?: boolean; met?: boolean; heart?: boolean }>,
      /** DIRECTION §1-2: 이번 회차의 바람 ('' = 없음 · 1회차) */
      wind: '',
    },
    /** STORY v2: 손님 일기 (직업_종족 → 열린 장 수) */
    diaries: {} as Record<string, number>,
    /**
     * 베타 1장 어울림: 발견한 조합 · 숨은 조합 힌트 단계(1~3) · 마지막 힌트를 연 날 · 「어울림 보기」
     * moved = 마을 안으로 옮긴 등급 장식 (k@x,y) · plaques = 받은 평가 현판 종류
     */
    /** GROWTH §2~§4 (world/growth.ts sanitizeGrowth가 칸을 바로잡는다) */
    growth: freshGrowth(),
    /** ECONOMY §1: 금화 출처 하루 집계 (날짜 · 출처별 합) */
    goldLog: { day: '', by: {} as Record<string, number> },
    /** GOLDSINK: 하루(한국 시간) 카운터 · 축복 · 마을 부탁 (world/goldsink.ts gsState가 칸을 바로잡는다) */
    gs: freshGoldsink(),
    /** WAYFIND: 처음 해 보기 · 결의 (world/wayfind.ts wfState가 칸을 바로잡는다) */
    wf: freshWayfind(),
    /** TOWN T2: 꾸미기 — 자동 길 켜기 · 칠한 칸 ("x,y" → 길 재질·바닥 종류) */
    /** BUILDUX: store = 보관함 · recent = 최근 놓은 장식 5개 · hintSeen = 첫 진입 안내 봄 */
    /** FEEDBACK23: entX = 옮긴 마을 입구 x (null = 여관 문 줄 · 자동) · dgHome = 던전을 처음 옮기기 전 숲속 자리 (되돌릴 수 있게) */
    decor: { autoPath: true, paint: {} as Record<string, string>, store: [] as StoredObj[], recent: [] as string[], hintSeen: false, round: {} as Record<string, number>, noPath: {} as Record<string, number>, seen: [] as string[], owned: [] as string[], bookGot: [] as number[], entX: null as number | null, dgHome: null as [number, number] | null },
    /** DECO_DROP §2 (ECONOMY §3 앞당김): 영웅 동상에 세운 전설 · 불꽃놀이 횟수 */
    luxury: { statue: '', shows: 0 },
    harmony: { found: [] as number[], hint: {} as Record<number, number>, hintDay: 0, show: false, moved: [] as string[], plaques: [] as string[], migrate: false, allDone: false },
    /**
     * 베타 3장 하루 마감 정산: 이번 날(자정까지) 모으는 중 · 지난 날들 · 아직 못 보여 준 정산 · 최고 수입
     */
    daily: {
      cur: { day: 0, gold0: -1, arrivals: 0, newHarm: 0, newDex: 0, moodSum: 0, moodN: 0, quietBye: 0 as number | undefined },
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
    /** CHECKIN §A2 모아 보기: 오늘(현실 날짜) 저절로 띄운 곁이야기 수 */
    inbox: { day: '', shown: 0 },
    /** HARVEST §1 첫 번째 가을 수확제 (world/harvest.ts hvState가 칸을 바로잡는다 · 리본·장식·칭호는 기간이 끝나도 남는다) */
    harvest: freshHarvest(),
    /** CHECKIN §D1 오늘의 장부 (world/daybook.ts) */
    daybook: freshDaybook(),
    /** CHECKIN §D2 여관 연감 (world/almanac.ts) */
    almanac: freshAlmanac(),
  };
}

/** GROWTH: 아끼는 영웅 · 소모품 · 힌트 · 고유 장비 · 자랑 기록 · 낚시 */
export function freshGrowth() {
  return {
    /** ★ 아끼는 영웅 (손님 id, 최대 6) */
    favs: [] as number[],
    /** 강화 보호 부적 · 행운의 숫돌 */
    charm: 0,
    whet: 0,
    /** 본 힌트 ("bondId:like" · "bondId:hate" · "guest:knight") · [소문] 힌트를 낸 날 */
    hints: [] as string[],
    rumorDay: '',
    /** 단골 선물: 손님 id → 준 날 · 케미 + 날 */
    guestGift: {} as Record<string, string>,
    /** 얻은 고유 장비 id → 얻은 수 */
    uniques: {} as Record<string, number>,
    /** [알림] 자랑: 마지막 시각 · 날짜 · 종류별 오늘 수 · 세트 3부위 첫 완성 지역 */
    brag: { last: 0, day: '', n: {} as Record<string, number> },
    setFirst: [] as string[],
    /** 세트 첫 완성 기록을 지금 마을 상태로 한 번 채웠나 (옛 저장에서 이미 완성된 세트는 자랑하지 않게) */
    seeded: false,
    /** 설정 「내 자랑 알림 끄기」 */
    bragOff: false,
    /** 물고기 선물로 알아낸 좋아함 ("bondId:fishId") */
    fishLike: [] as string[],
    /** 낚시: 오늘 쓴 미끼 · 만든 미끼 · 가방 · 기록(마리 수·최대 cm) · 놓아준 고래 날 */
    fish: { day: '', used: 0, extra: 0, bag: {} as Record<string, number>, rec: {} as Record<string, { n: number; max: number }>, whaleDay: '', trophies: 0 },
    /** 물고기 요리 (원정 금화 +) */
    meal: null as null | { until: number; v: number; name: string },
  };
}
export type GrowthState = ReturnType<typeof freshGrowth>;

/** GOLDSINK §5: 마을 부탁 하나 (base = 받았을 때 기록 값 · 진행 = 지금 − base) */
export interface Favor {
  id: string;
  base: number;
  target: number;
  claimed: boolean;
}
export function freshGoldsink() {
  return {
    /** 하루 카운터의 날 (한국 시간) · 유료 새로고침 수 · 변환 산 수(품목 키별) · 오늘 자동 사냥 판 수 · 오늘 부탁 바꾸기 수 */
    day: '',
    refreshPaid: 0,
    conv: {} as Record<string, number>,
    autoN: 0,
    swaps: 0,
    /** 본 대사 (계정당) · 하루 한 번 대사를 본 날 */
    seen: [] as string[],
    talkDay: {} as Record<string, string>,
    /** 축복 끝나는 시각 */
    blessUntil: 0,
    /** 직접 세는 기록 (강화·초월·재련 · 변환 · 축복 · 지역 보스 사냥 · 이웃 좋아요) */
    cnt: { smith: 0, conv: 0, bless: 0, hboss: 0, likes: 0 } as Record<string, number>,
    /** 마을 부탁: 오늘 목록 · 보너스 상자 받았나 · 주(월요일) · 이번 주 완료 · 감사 편지 받았나 */
    favors: [] as Favor[],
    box: false,
    week: '',
    weekN: 0,
    letter: false,
    /** 보너스 상자: 다음 지역 보스 고유 장비 확률 ×2 남은 횟수 · 주점 수입 +10% 날 */
    uniqueBoost: 0,
    tavernDay: '',
    /** §7 끝없는 심연: 최고 층 · 주(월요일) · 이번 주 최고 · 이어하기 할 수 있는 층(0 = 없음) · 자랑한 층 · v0.24.5 지금 오르는 층(나가면 무료로 이어가기 · 0 = 없음) */
    abyss: { best: 0, week: '', weekBest: 0, lost: 0, cur: 0, brags: [] as number[] },
    /** §8 주사위: 판 수 · 이긴 수 · 지금 연승 · 최고 연승 · 이룬 업적 id */
    dice: { games: 0, wins: 0, streak: 0, bestStreak: 0, ach: [] as string[] },
  };
}
export type GoldsinkState = ReturnType<typeof freshGoldsink>;
/** WAYFIND §1·§2 */
export function freshWayfind() {
  return {
    /** 처음 써 본 기능 · 기능이 열린 걸 처음 본 시각 · 「나중에」 누른 기능 → 다시 물어볼 시각 */
    done: [] as string[],
    avail: {} as Record<string, number>,
    later: {} as Record<string, number>,
    /** 오늘 「!」를 띄운 날(한국 시간) · 그 기능 · 옛 기록으로 done을 채웠나 · 반응을 기다리는 기능 */
    day: '',
    today: '',
    seeded: false,
    pend: [] as string[],
    /** §2: 첫 돌파 못 한 판의 연속 패배 수 ("지역-판") */
    lose: {} as Record<string, number>,
    /** 상태로 알 수 없는 「처음 써 봄」 표시 (재련·숫돌·일기·이웃 구경…) · 첫 변환 값 (돌려줄 금화) · 다 채운 칭호를 줬나 */
    hit: [] as string[],
    pay: {} as Record<string, number>,
    title: false,
    /** 마지막으로 펼친 일기 (직업_종족) — 「일기 읽기」 보상 대상 */
    diaryKey: '',
  };
}
export type WayfindState = ReturnType<typeof freshWayfind>;
/** WAYFIND §1: 처음 써 봤다고 표시 (world 어디서나 — import가 꼬이지 않게 state에 둔다) */
export function wfHit(id: string, pay?: number) {
  const w = (P as { wf?: WayfindState }).wf;
  if (!w || !Array.isArray(w.hit)) return;
  if (!w.hit.includes(id)) w.hit.push(id);
  if (pay != null && w.pay && typeof w.pay === 'object' && w.pay[id] == null) w.pay[id] = pay;
}

/** 하루 마감 정산 한 장 */
export interface DayLog {
  day: number;
  gold: number;
  guests: number;
  mood: number;
  newHarm: number;
  newDex: number;
  /** CHECKIN §A1: 조용히 배웅한 평범한 손님 (옛 기록엔 없음) */
  quietBye?: number;
}

/** 우편함: 출석·랭킹·운영자 선물·앞 주인 편지 */
export interface Mail {
  id: number;
  from: 'attend' | 'rank' | 'admin' | 'prev' | 'system';
  title: string;
  body: string;
  reward: { gold?: number; dust?: number; tokens?: number; shards?: number; gift?: string; dustR?: number; cheer?: number; deco?: string; /** ONBOARDING §4: 장비 한 개 (등급) */ gear?: string; /** EASTER: 개척자 금빛 편지 */ pioneer?: string };
  /** HOTFIX14 §5: 업데이트 선물이면 그 버전 */
  ver?: string;
  /** 편지 안 링크 버튼 (유저 톡방) */
  link?: 'kakao';
  at: number;
  claimed: boolean;
}

export interface OwnerState {
  /** ONBOARDING §1: 아직 「출신 고르기」 전 (기본 주인 · 출신 보너스·연결 영웅 없음) */
  pending?: boolean;
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
/** DIRECTION §1-3: 여관 연대기 한 쪽 (사진은 이 기기 설정 'chron.<at>'에 · 저장 크기를 키우지 않게) */
export interface ChronPage {
  /** 엔딩을 본 시각 (쪽 번호 겸 사진 키) */
  at: number;
  gen: number;
  inn: string;
  /** 엔딩 id (endings.ts) */
  ending: string;
  /** 함께한 단골 셋: 이름 · 직업 · 종족 */
  regs: { name: string; kind: string; race?: string }[];
  /** 그 회차의 바람 ('' 없음) */
  wind: string;
  /** 옛 저장에서 채운 쪽 (자세한 기록이 없을 수 있다) */
  old?: boolean;
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
  announce: (_text: string, _kind?: 'legend' | 'boss_kill' | 'rank1' | 'brag', _arg?: string) => {},
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
  gotGold(v, kind);
}

/** 금화를 벌 때마다: 누적 금화(전설 소문 조건) · 500G마다 인연 활동 · 부탁 진행 */
let goldAcc = 0;
export function gotGold(v: number, src = 'other') {
  if (v <= 0) return;
  P.counters.goldTotal += v;
  // ECONOMY §1: 금화 출처 하루 집계 (world/economy가 하루에 한 번 gold_gain으로 보낸다)
  const G = (P.goldLog ??= { day: '', by: {} });
  G.by[src] = (G.by[src] ?? 0) + Math.round(v);
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
