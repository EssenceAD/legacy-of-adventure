// 전투 개편 1차: 쿼터뷰 필드 액션 — 상태와 규칙 (그리기는 draw.ts, 조작·화면은 ui.ts)
//  좌표는 타일(마을과 같은 쿼터뷰). 주인공 1명 조종 + 동료 2명 AI. 몬스터: 다가오기 → 예고(빨간 범위 0.6초) → 공격 → 빈틈 0.8초
import { CONFIG } from '../data/config';
import { josa } from '../data/josa';
import { mythicAtk, mythicDef, mythicHeal } from '../world/mythic';
import { buffOf } from '../world/facilities';
import { shakeParams } from '../engine/shake';
import type { RegionId } from '../data/items';
import { appearance, powerOf, totalStats } from '../world/adventurers';
import { flag } from '../world/flags';
import type { Actor } from '../world/state';
import { framesFor, type CharFrames } from '../engine/sprites';
import { TH, TW } from '../engine/iso';
import { sfx } from '../audio/sfx';
import { recPower } from '../world/hunt';
import { bondOf, pairOf } from '../world/chem';
import { roleMult } from '../world/party';
import { ultName5 } from '../world/chemNews';
import { addToBag, makeItem, optSum, rollGrade } from '../world/items';
import type { Grade } from '../data/items';
import type { Item } from '../world/state';
import { monDef, REGION_BOSS, stageMons, type BossLook } from './mons';
import { partySpecial, specialSum } from '../world/uniques';
import { isBalanced, memberSynMult, synergyFx, type SynFx } from '../world/synergy';
import { resolveDmg, resolveOf, resolveTaken } from '../world/wayfind';

const HC = CONFIG.hunter;

const C = CONFIG.combat;
const RV = C.roles;
export type Job = 'knight' | 'warrior' | 'rogue' | 'mage' | 'priest' | 'hunter';
export const JOB_OF: Record<string, Job> = { knight: 'knight', dwarf: 'warrior', rogue: 'rogue', mage: 'mage', cleric: 'priest', hunter: 'hunter', hero: 'warrior' };
const RANGED = new Set<Job>(['mage', 'hunter']);
export const SKILL_NAMES: Record<Job, [string, string]> = {
  knight: ['방패 강타', '도발 함성'],
  warrior: ['회전 베기', '도약 내려찍기'],
  rogue: ['그림자 찌르기', '독 단검'],
  mage: ['화염구', '점멸'],
  priest: ['치유의 빛', '신성 일격'],
  // PARTY §1: 손님 직업 사냥꾼 — 연사(앞쪽 부채꼴 3발) · 화살비(원 범위 2초)
  hunter: ['연사', '화살비'],
};

export interface Area {
  x: number;
  y: number;
  r: number;
  /** 직선 돌진 예고: (x,y)→(x2,y2) 폭 w */
  x2?: number;
  y2?: number;
  w?: number;
}
export interface Unit {
  id: number;
  team: 'ally' | 'mob';
  x: number;
  y: number;
  /** 넉백 속도 (타일/초) */
  vx: number;
  vy: number;
  r: number;
  hp: number;
  max: number;
  /** 바라보는 방향 (월드 단위 벡터) */
  ax: number;
  ay: number;
  moving: boolean;
  flash: number;
  stun: number;
  t: number;
  dead: boolean;
  deadT: number;
  // 아군
  actor?: Actor;
  job?: Job;
  power?: number;
  role?: 'tank' | 'heal' | 'dps';
  frames?: CharFrames;
  combo?: number;
  comboT?: number;
  swing?: number;
  /** 이번 휘두르기 길이 (직업마다 빠르기가 다르다 · 공격 프레임용) */
  swingMax?: number;
  /** 따라다닐 때 내 주변 자리 (각도) */
  slot?: number;
  dodge?: number;
  dodgeCd?: number;
  inv?: number;
  cd?: [number, number];
  taunt?: number;
  guard?: number;
  atkAnim?: number;
  /** 시전 동작 · 맞은 직후 (리마스터 프레임) */
  castAnim?: number;
  hurtT?: number;
  /** AI가 지금 예고를 피할지 정했다 */
  dodgeDecided?: number;
  // 몬스터
  mon?: string;
  st?: 'spawn' | 'move' | 'tele' | 'strike' | 'recover';
  stT?: number;
  /** 이번 예고 길이 (보스는 패턴마다 다르다) */
  teleMax?: number;
  tele?: Area;
  /** 전투 2차: 정예 · 보스 · 보스가 부른 부하 */
  elite?: boolean;
  boss?: BossLook;
  minion?: boolean;
  pat?: number;
  enraged?: boolean;
  dash?: { vx: number; vy: number; t: number };
  /** 핫픽스 9: 막혀서 못 다가온 시간 · 직전 거리 */
  stuckT?: number;
  lastD?: number;
  atk?: number;
  speed?: number;
  target?: Unit;
  dot?: { t: number; dps: number; tick: number };
  rooted?: number;
  // 핫픽스 8 (2-7): 직업 모션 — 회전 베기 · 도약 · 잔상 · 도발 「!」
  spinT?: number;
  jump?: { t: number; dur: number; x0: number; y0: number; x1: number; y1: number; land: () => void };
  trail?: { x: number; y: number; t: number }[];
  alertT?: number;
  /** REGIONS2 세트: 치명타 확률 + · 받는 피해 − (0~1) */
  critAdd?: number;
  dmgCut?: number;
  /** GROWTH §3-4 고유 효과: 공격 속도 + · 한 번 일어나기(체력 비율) · 적마다 첫 공격 1초 멈춤 · 튕김 확률 · (적) 이미 멈췄나 */
  spd?: number;
  revive?: number;
  stunFirst?: boolean;
  bounce?: number;
  firstHit?: boolean;
  /** PARTY §1: 사냥꾼 뒤로 구르기 방향 (바라보는 쪽은 그대로) · 카이팅이 막힌 시간 · 빠져나가는 방향과 남은 초 */
  rollDir?: [number, number];
  kiteStuck?: number;
  kiteLast?: [number, number];
  escape?: { x: number; y: number; t: number };
  /** PARTY §2: 스킬 대기 시간 (조합 「별빛 기도」로 줄어든 값) */
  cdMax?: [number, number];
  /** ROLES §2: 방어로 줄어드는 받는 피해 (0~0.4) · §3 드워프 「아직 멀었다!」 했나 */
  defCut?: number;
  lowSaid?: boolean;
}
export interface Proj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  owner: Unit;
  kind: 'bolt' | 'arrow' | 'fire' | 'dagger';
  hit: Set<Unit>;
}
export interface Fx {
  kind: 'slash' | 'puff' | 'ring' | 'heal' | 'boom' | 'trap' | 'spr' | 'rain';
  /** PARTY §1 화살비: 다음 피해까지 남은 초 */
  tick?: number;
  /** 핫픽스 8 (2-7): Ninja Adventure 이펙트 그림 · 90° 회전 수 · 바닥에서 띄울 높이(도트) */
  spr?: string;
  q?: number;
  oy?: number;
  x: number;
  y: number;
  t: number;
  dur: number;
  ax?: number;
  ay?: number;
  big?: boolean;
  r?: number;
  owner?: Unit;
}
/** 바닥에 떨어진 장비 (가까이 가거나 판이 끝나면 줍는다) */
export interface Loot {
  x: number;
  y: number;
  z: number;
  vz: number;
  t: number;
  item: Item;
}
export const GRADE_COLOR: Record<Grade, string> = { n: '#ffffff', r: '#6aa8ff', e: '#c07aff', l: '#ffa040', a: '#ff4a4a' };

export interface Num {
  x: number;
  y: number;
  text: string;
  crit: boolean;
  heal?: boolean;
  t: number;
  dx: number;
}
export interface Drop {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  kind: 'coin' | 'mat';
}

export interface Field {
  region: RegionId;
  stage: number;
  rec: number;
  units: Unit[];
  allies: Unit[];
  me: Unit;
  proj: Proj[];
  fx: Fx[];
  nums: Num[];
  drops: Drop[];
  wave: number;
  waveLeft: number;
  time: number;
  /** 히트스톱 남은 초 (화면 전체 멈칫) */
  stop: number;
  shake: number;
  shakeAmp: number;
  /** HOTFIX15: 흔들림 끔일 때 보스 충격 = 붉은 비네트 (남은 초) */
  vign?: number;
  chem: number;
  /** 필살기 컷인 (0.5초 멈춤) */
  ult: number;
  ultName: string;
  /** 핫픽스 12 §6: 5단계 짝 전용 합동 오의인가 */
  ult5?: boolean;
  hitsTaken: number;
  /** v0.24.5 ✕ 포기 */
  quit?: boolean;
  autoUsed: boolean;
  auto: boolean;
  kills: number;
  chain: number;
  chainT: number;
  done: '' | 'win' | 'lose';
  doneT: number;
  /** 조이스틱 (화면 방향, 길이 0~1) · 공격 버튼 누르고 있음 */
  stick: { x: number; y: number };
  holdAtk: number;
  nextId: number;
  props: { x: number; y: number; r: number; kind: 'tree' | 'pine' | 'rock' }[];
  /** 확인용: AI가 예고 범위 안에 있던 횟수 · 그중 구른 횟수 */
  stats: { teleIn: number; dodged: number };
  /** 내가 쓴 스킬 이름 (아래 가운데 0.6초) */
  castTxt: string;
  castT: number;
  /** 스킬 이름 색 (직업 색 · 보스 패턴은 붉게) */
  castColor?: string;
  // ── 전투 2차 ──
  mode: 'hunt' | 'raid';
  /** 처치 목표 (채우면 정예/보스) · 지금까지 내보낸 수 */
  killGoal: number;
  spawned: number;
  elite: Unit | null;
  /** 연타: 2초 안에 계속 때리면 쌓인다 (10HIT마다 +1%, 최대 +10%) */
  hit: number;
  hitT: number;
  /** 처치 연속 (KILLS) · 최고 기록 */
  streak: number;
  streakT: number;
  maxStreak: number;
  loot: Loot[];
  picked: Item[];
  lootLog: { text: string; grade: Grade; t: number }[];
  /** 장비가 나올 확률 (처치 1마리당) */
  dropK: number;
  /** 토벌: 보스에게 준 피해 합 · 보스 체력(필드 단위) */
  raidDmg: number;
  /** 정예·보스 등장 알림 */
  banner: string;
  bannerT: number;
  /** 핫픽스 8: 조금 뒤에 할 일 (사냥꾼 연속 사격 등) */
  later?: { t: number; fn: () => void }[];
  /** REGIONS2: 보스 체력 50%에서 한 번 (지역 10 「목소리」) · 보스가 쓰러질 때 한 줄 */
  half?: () => void;
  bossLine?: string;
  /** GOLDSINK §7 끝없는 심연: 보스 그림(다른 지역 보스) · 접기 없음 */
  look?: BossLook;
  noFold?: boolean;
  /** PARTY §2: 이 판의 조합 보너스 */
  syn?: SynFx;
  /** ROLES (플래그 rolesV2): 켜졌나 · 사제 한 번 살리기 남은 횟수 · 탱·힐·딜 조합 (예고 +초) */
  roles?: boolean;
  rvLeft?: number;
  comboTele?: number;
  /** WAYFIND §2: 결의 (첫 돌파 못 한 사냥 판에서 연속 패배 → 주는 피해 + · 받는 피해 −) */
  resolve?: number;
}

/** 바라보는 쪽(월드 방향) → 화면에서 90° 회전 수 (0 오른쪽 · 1 아래 · 2 왼쪽 · 3 위) */
export function quarterOf(ax: number, ay: number): number {
  const sdx = screenDx(ax, ay);
  const sdy = ((ax + ay) * TH) / 2;
  return Math.abs(sdx) >= Math.abs(sdy) ? (sdx >= 0 ? 0 : 2) : sdy >= 0 ? 1 : 3;
}
/** 핫픽스 8 (2-7): 스킬 이름 직업 색 */
export const CAST_COLOR: Record<string, string> = { knight: '#6aa8ff', warrior: '#ff6a5a', rogue: '#c07aff', mage: '#ffa040', priest: '#ffd36b', hunter: '#7ad06a' };
/** 직업별 기본 공격 베기 그림 (원거리는 탄) */
const JOB_CUT: Record<string, string> = { knight: 'cut', warrior: 'slashcurved', rogue: 'cutdouble', priest: 'spark' };
const sprFx = (f: Field, spr: string, x: number, y: number, dur: number, o: Partial<Fx> = {}) => f.fx.push({ kind: 'spr', spr, x, y, t: 0, dur, ...o });

// ───────── 좌표 ─────────

/** 화면 방향(dx, dy) → 월드 벡터: 화면에서 같은 빠르기로 보이게 */
export function screenToWorld(dx: number, dy: number): [number, number] {
  return [(dx / (TW / 2) + dy / (TH / 2)) / 2, (dy / (TH / 2) - dx / (TW / 2)) / 2];
}
/** 월드 벡터의 화면 가로 성분 (왼쪽을 보나) */
export const screenDx = (wx: number, wy: number) => ((wx - wy) * TW) / 2;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const norm = (x: number, y: number): [number, number] => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};
/** 화면 px → 대략 타일 (넉백용) */
const pxToTile = (px: number) => px / 14;

// ───────── 만들기 ─────────

/** 동료 자리: 나를 기준으로 서로 다른 방향 (왼쪽 뒤 · 오른쪽 뒤) */
//  PARTY §3: 4번째 동료는 오른쪽 앞
const SLOTS = [0, Math.PI * 0.75, -Math.PI * 0.25 + Math.PI * 1.5, Math.PI * 0.25];
export interface FieldOpts {
  mode?: 'hunt' | 'raid';
  /** 토벌 보스 그림·이름 · 보스 체력(필드 단위) · 제한 시간 */
  raid?: { look: BossLook; hp: number; seconds: number; power: number };
  /** REGIONS2: 보스 체력 50%에서 한 번 · 보스가 쓰러질 때 띠에 한 줄 */
  half?: () => void;
  talkHalf?: (done: () => void) => void;
  bossLine?: string;
  /** GOLDSINK §7 끝없는 심연: 추천 전투력(몬스터 강함) 직접 · 보스 그림 · 접기 없음 */
  rec?: number;
  look?: BossLook;
  noFold?: boolean;
}
export function makeField(region: RegionId, stage: number, members: Actor[], auto: boolean, opts: FieldOpts = {}): Field {
  const N = C.field;
  // PARTY §3: 4번째 자리가 열리면 4명까지 (파티 창이 인원을 정한다)
  const ms = members.slice(0, CONFIG.party4.max);
  // 핫픽스 12 §2-2: 방어·공격·회복이 고루 있으면 전투력 ×1.10
  const rm = roleMult(ms);
  // PARTY §2: 조합 보너스 (공격 + · 한 우물 · 치명타 + · 받는 피해 − · 스킬 대기 − · 보스 피해 +)
  const syn = synergyFx(ms);
  // GROWTH §3-4 고유 효과 「파티 전원 받는 피해 −N%」
  const partyCut = partySpecial(ms, 'partyHp');
  const rolesOn = flag('rolesV2');
  const mk = (a: Actor, i: number): Unit => {
    const job = JOB_OF[a.kind] ?? 'warrior';
    const { key, def } = appearance(a);
    const max = Math.round(C.hpBase + a.lvl * C.hpPerLv);
    return {
      id: i + 1, team: 'ally', x: N / 2 + (i ? Math.cos(SLOTS[i]) * C.allyGap : 0), y: N / 2 + 0.8 + (i ? Math.sin(SLOTS[i]) * C.allyGap : 0), slot: SLOTS[i], vx: 0, vy: 0, r: 0.32, hp: max, max, ax: 1, ay: 0, moving: false, flash: 0, stun: 0, t: 0, dead: false, deadT: 0,
      actor: a, job, power: powerOf(a) * rm * memberSynMult(a, syn) * (1 + buffOf('power')) * mythicAtk(ms, region, !!opts.raid), role: job === 'knight' ? 'tank' : job === 'priest' ? 'heal' : 'dps', frames: framesFor(key, def),
      combo: 0, comboT: 0, swing: 0, dodge: 0, dodgeCd: 0, inv: 0, cd: [0, 0], cdMax: [C.skillCd[0] * (1 - syn.cdCut), C.skillCd[1] * (1 - syn.cdCut)], taunt: 0, guard: 0, atkAnim: 0,
      critAdd: (optSum(a, 'critPct') + specialSum(a, 'crit')) / 100 + syn.crit, dmgCut: Math.min(0.5, (optSum(a, 'dmgCut') + partyCut) / 100 + syn.dmgCut),
      spd: specialSum(a, 'speed') / 100, revive: specialSum(a, 'reviveOnce') / 100, stunFirst: specialSum(a, 'firstHitStun') > 0, bounce: specialSum(a, 'bounce') / 100,
      defCut: rolesOn ? Math.min(RV.defMax, Math.max(0, totalStats(a).def) / (Math.max(0, totalStats(a).def) + RV.defK)) : 0,
    };
  };
  const allies = ms.map(mk);
  const props: Field['props'] = [];
  // 가장자리 숲 · 안쪽 바위 몇 개 (부딪힘)
  // 안쪽은 낮은 바위만 (큰 나무는 캐릭터를 가린다 · 나무는 가장자리 숲)
  for (let i = 0; i < 7; i++) props.push({ x: 1.5 + Math.random() * (N - 3), y: 1.5 + Math.random() * (N - 3), r: 0.35, kind: 'rock' });
  const mode = opts.mode ?? 'hunt';
  const boss = stage >= 10;
  const killGoal = mode === 'raid' ? 0 : boss ? C.bossKillGoal : Math.round(C.killGoal[0] + ((C.killGoal[1] - C.killGoal[0]) * (stage - 1)) / 8);
  const f: Field = {
    region, stage, rec: opts.raid ? opts.raid.power : (opts.rec ?? recPower(region, stage)), units: [...allies], allies, me: allies[0], proj: [], fx: [], nums: [], drops: [],
    mode, killGoal, spawned: 0, elite: null, hit: 0, hitT: 0, streak: 0, streakT: 0, maxStreak: 0, loot: [], picked: [], lootLog: [], dropK: C.dropsPerRun / Math.max(1, killGoal), raidDmg: 0, banner: '', bannerT: 0,
    wave: 0, waveLeft: 0, time: opts.raid ? opts.raid.seconds : C.timeLimit, stop: 0, shake: 0, shakeAmp: 0, chem: 0, ult: 0, ultName: '', hitsTaken: 0, autoUsed: auto, auto, kills: 0, chain: 0, chainT: 0,
    done: '', doneT: 0, stick: { x: 0, y: 0 }, holdAtk: 0, nextId: 100, stats: { teleIn: 0, dodged: 0 }, castTxt: '', castT: 0, props: props.filter((p) => Math.hypot(p.x - N / 2, p.y - N / 2) > 2.2),
  };
  f.half = opts.half;
  f.bossLine = opts.bossLine;
  f.look = opts.look;
  f.noFold = opts.noFold;
  f.syn = syn;
  if (rolesOn) {
    f.roles = true;
    f.rvLeft = mode === 'raid' ? RV.revive.raid : RV.revive.hunt;
    f.comboTele = isBalanced(ms) ? RV.comboTele : 0;
    applyRolesHp(f);
  }
  f.resolve = mode === 'hunt' && !opts.raid ? resolveOf(region, stage) : 0;
  if (mode === 'raid' && opts.raid) spawnBoss(f, opts.raid.look, opts.raid.hp, N / 2 + 2.5, N / 2 - 2.5);
  else {
    // 시작: 필드 곳곳에 무리 둘 (나와 떨어진 곳)
    spawnPack(f, false);
    spawnPack(f, false);
  }
  return f;
}

// ───────── 전투 2차: 무리 · 정예 · 보스 ─────────

/**
 * ROLES §1: 아군 최대 체력 = 그 판 일반 몬스터 한 대 × 직업 배수 × (1 + (레벨−1)×0.004)
 *  기준 전투력 = min(파티 평균 전투력 × 3, 추천) — 약한데 무리하면 여전히 녹는다 · 예전 체력보다 낮아지지는 않는다 (쉬운 판을 도는 높은 레벨 보호)
 *  (시뮬레이터가 전투력을 바꾼 뒤 다시 부른다)
 */
export function applyRolesHp(f: Field) {
  if (!f.roles) return;
  const basis = Math.min(f.rec, avgPow(f) * 3);
  const atk = C.mobAtk + basis * C.mobAtkK;
  for (const u of f.allies) {
    const a = u.actor;
    if (!a) continue;
    const old = C.hpBase + a.lvl * C.hpPerLv;
    u.hp = u.max = Math.round(Math.max(old, atk * (RV.hpMult[a.kind] ?? 5) * (1 + (a.lvl - 1) * RV.lvK)));
  }
}

/** 몬스터 체력 기준: 추천 전투력 파티의 한 사람이 2~3대에 쓰러뜨릴 만큼 (스테이지가 오르면 조금씩 단단) */
export function mobBaseHp(rec: number, stage: number, avgPower: number): number {
  const hits = C.hitsToKill[0] + ((C.hitsToKill[1] - C.hitsToKill[0]) * (Math.min(10, stage) - 1)) / 9;
  // 파티가 추천보다 아주 세면 몬스터도 조금 버틴다 (여전히 더 빨리 잡힌다)
  const tough = Math.pow(Math.max(1, Math.min(C.toughCap, avgPower / Math.max(1, rec / 3))), C.toughExp);
  return (rec / 3) * C.dmgK * hits * tough;
}
const avgPow = (f: Field) => f.allies.reduce((a, u) => a + (u.power ?? 50), 0) / Math.max(1, f.allies.length);

function addMob(f: Field, id: string, x: number, y: number, o: { delay?: number; hpMul?: number; atkMul?: number; elite?: boolean; minion?: boolean } = {}): Unit {
  const d = monDef(id);
  const max = Math.round(mobBaseHp(f.rec, f.stage, avgPow(f)) * d.hp * (o.hpMul ?? 1));
  const u: Unit = {
    id: f.nextId++, team: 'mob', mon: id, x, y, vx: 0, vy: 0, r: d.r + (o.elite ? 0.08 : 0), hp: max, max, ax: -1, ay: 0, moving: false, flash: 0, stun: 0, t: Math.random(), dead: false, deadT: 0,
    st: 'spawn', stT: o.delay ?? 0.45, atk: (C.mobAtk + f.rec * C.mobAtkK * d.atk) * (o.atkMul ?? 1), speed: d.speed * (o.elite ? 1.1 : 1) * C.mobSpeed, elite: o.elite, minion: o.minion,
  };
  f.units.push(u);
  f.fx.push({ kind: 'puff', x, y, t: 0, dur: 0.5, big: true });
  return u;
}

/** 무리 하나 (5~8마리) — atEdge면 가장자리에서 들어온다 */
export function spawnPack(f: Field, atEdge: boolean) {
  const N = C.field;
  const kinds = stageMons(f.region, f.stage);
  const n = Math.min(C.pack[0] + Math.floor(Math.random() * (C.pack[1] - C.pack[0] + 1)), f.killGoal - f.spawned);
  if (n <= 0) return;
  let cx = 0;
  let cy = 0;
  for (let tries = 0; tries < 20; tries++) {
    if (atEdge) {
      const side = Math.floor(Math.random() * 4);
      const t = 1.5 + Math.random() * (N - 3);
      [cx, cy] = side === 0 ? [t, 1.2] : side === 1 ? [N - 1.2, t] : side === 2 ? [t, N - 1.2] : [1.2, t];
    } else [cx, cy] = [1.8 + Math.random() * (N - 3.6), 1.8 + Math.random() * (N - 3.6)];
    if (Math.hypot(cx - f.me.x, cy - f.me.y) > 4) break;
  }
  // 무리 안에서 한두 종이 섞인다
  const main = kinds[Math.floor(Math.random() * kinds.length)];
  for (let i = 0; i < n; i++) {
    const k = Math.random() < 0.65 ? main : kinds[Math.floor(Math.random() * kinds.length)];
    const a = Math.random() * Math.PI * 2;
    const rr = 0.4 + Math.random() * 1.1;
    const x = Math.max(0.8, Math.min(N - 0.8, cx + Math.cos(a) * rr));
    const y = Math.max(0.8, Math.min(N - 0.8, cy + Math.sin(a) * rr));
    addMob(f, k.id, x, y, { delay: 0.3 + i * 0.07 });
  }
  f.spawned += n;
  f.wave++;
}

/** 처치 목표를 채우면: 지역 정예 1마리 (x-10은 지역 보스) */
function spawnElite(f: Field) {
  const N = C.field;
  const [x, y] = [Math.max(1.5, Math.min(N - 1.5, f.me.x + (f.me.x < N / 2 ? 3.5 : -3.5))), Math.max(1.5, Math.min(N - 1.5, f.me.y + (f.me.y < N / 2 ? 2.5 : -2.5)))];
  if (f.stage >= 10) {
    const look = f.look ?? REGION_BOSS[f.region];
    spawnBoss(f, look, Math.round(mobBaseHp(f.rec, f.stage, avgPow(f)) * C.bossHp), x, y);
    return;
  }
  const kinds = stageMons(f.region, f.stage);
  const k = kinds[kinds.length - 1];
  const e = addMob(f, k.id, x, y, { delay: 0.8, hpMul: C.eliteHp, atkMul: 1.5, elite: true });
  f.elite = e;
  f.banner = `정예 ${k.name} 등장!`;
  f.bannerT = 2;
  shake(f, 2);
}

export function spawnBoss(f: Field, look: BossLook, hp: number, x: number, y: number) {
  const u: Unit = {
    id: f.nextId++, team: 'mob', mon: look.id, x, y, vx: 0, vy: 0, r: look.r, hp, max: hp, ax: -1, ay: 0, moving: false, flash: 0, stun: 0, t: 0, dead: false, deadT: 0,
    st: 'spawn', stT: 1, atk: (C.mobAtk + f.rec * C.mobAtkK) * C.bossAtk, speed: 1.2 * C.mobSpeed, boss: look, pat: 0,
  };
  f.units.push(u);
  f.elite = u;
  f.fx.push({ kind: 'puff', x, y, t: 0, dur: 0.8, big: true });
  f.banner = `${look.name} 등장!`;
  f.bannerT = 2.2;
  shake(f, C.shake.boss);
}

/** 연타 보너스 (10HIT마다 +1%, 최대 +10%) */
export const hitBonus = (hit: number) => Math.min(C.hitBonusMax, Math.floor(hit / 10) * 0.01);

// ───────── 피해 ─────────

const isMe = (f: Field, u: Unit) => u === f.me;
/** 아군 → 몬스터 */
export function hurtMob(f: Field, m: Unit, dmg: number, by: Unit, o: { crit?: boolean; knock?: number; heavy?: boolean; stun?: number; silent?: boolean; bounced?: boolean } = {}) {
  if (m.dead || m.st === 'spawn') return;
  // GROWTH §3-4: 「도토리 깎은 나무검」 적마다 첫 공격이 1초 멈춤 · 「왕슬라임 젤리 지팡이」 근처 적 하나에 튕김
  if (by.stunFirst && !m.firstHit) {
    m.firstHit = true;
    o = { ...o, stun: Math.max(o.stun ?? 0, 1) };
  }
  if (!o.bounced && (by.bounce ?? 0) > 0 && Math.random() < by.bounce!) {
    const near = f.units.filter((x) => x.team === 'mob' && x !== m && !x.dead && x.st !== 'spawn' && Math.hypot(x.x - m.x, x.y - m.y) < 2.5).sort((p, q) => Math.hypot(p.x - m.x, p.y - m.y) - Math.hypot(q.x - m.x, q.y - m.y))[0];
    if (near) hurtMob(f, near, dmg * 0.5, by, { silent: true, bounced: true });
  }
  const crit = !!o.crit;
  // 연타: 내가(직접 조작) 2초 안에 계속 때리면 HIT가 쌓이고 피해 +
  if (by === f.me && !f.auto) {
    f.hit = f.hitT > 0 ? f.hit + 1 : 1;
    f.hitT = C.hitWindow;
    dmg *= 1 + hitBonus(f.hit);
  }
  // PARTY §2: 철벽 돌격 — 보스·정예 피해 +
  if ((m.boss || m.elite) && f.syn?.bossDmg) dmg *= 1 + f.syn.bossDmg;
  if (f.resolve) dmg *= resolveDmg(f.resolve);
  dmg = Math.max(1, Math.round(dmg));
  m.hp -= dmg;
  if (f.mode === 'raid' && m.boss) f.raidDmg += Math.min(dmg, Math.max(0, m.hp + dmg));
  m.flash = 1 / 30 + 0.001;
  if (o.stun) m.stun = Math.max(m.stun, o.stun * (m.boss ? 0.3 : 1));
  const kill = m.hp <= 0;
  // 넉백: 때린 쪽에서 밀려난다 (벽에 부딪히면 멈춤)
  const [nx, ny] = norm(m.x - by.x, m.y - by.y);
  const kpx = kill ? C.knock.kill : crit ? C.knock.crit : C.knock.hit;
  // 예고 중(버티는 자세)에는 30%만 밀린다
  const k = pxToTile(kpx * (o.knock ?? 1)) * 8 * (m.st === 'tele' && !kill ? 0.3 : 1) * (m.boss ? 0.08 : m.elite ? 0.35 : 1);
  m.vx += nx * k;
  m.vy += ny * k;
  // 히트스톱: 내 타격은 늘, 동료는 치명타·막타만
  const mine = isMe(f, by);
  const hs = kill ? C.hitstop.kill : crit ? C.hitstop.crit : C.hitstop.hit;
  if (mine || crit || kill) f.stop = Math.max(f.stop, mine ? hs : hs * 0.6);
  if (crit) shake(f, C.shake.crit);
  // 숫자: 같은 대상은 옆으로 비켜서
  const same = f.nums.filter((n) => Math.abs(n.x - m.x) < 0.3 && Math.abs(n.y - m.y) < 0.3 && n.t < 0.3).length;
  f.nums.push({ x: m.x, y: m.y, text: String(dmg * 10), crit, t: 0, dx: (same % 2 ? 1 : -1) * Math.ceil(same / 2) * 7 });
  f.chem = Math.min(100, f.chem + C.chemPerHit);
  // 소리: 처치음은 따로 없다 (crit + 히트스톱) · 동료 소리는 40% 작게
  if (!o.silent) sfx(crit || kill ? 'crit' : 'hit', { vol: mine ? 1 : C.allyVol });
  if (kill) killMob(f, m);
}

function killMob(f: Field, m: Unit) {
  m.dead = true;
  m.deadT = 0;
  m.st = 'recover';
  m.tele = undefined;
  f.kills++;
  f.waveLeft--;
  f.chain = f.chainT > 0 ? f.chain + 1 : 1;
  f.chainT = 2;
  // KILLS: 4초 안에 계속 쓰러뜨리면 이어진다
  f.streak = f.streakT > 0 ? f.streak + 1 : 1;
  f.streakT = C.streakWindow;
  f.maxStreak = Math.max(f.maxStreak, f.streak);
  f.fx.push({ kind: 'puff', x: m.x, y: m.y, t: 0, dur: 0.55, big: true });
  // 장비: 원정과 같은 등급표·천장 · 정예/보스는 반드시 1개 (토벌은 장비 대신 보상표)
  if (f.mode === 'hunt' && !m.minion && (m.elite || m.boss || Math.random() < f.dropK * (1 + buffOf('luck')))) {
    const it = makeItem(f.region, rollGrade(f.region, m.boss ? 1 : 0));
    f.loot.push({ x: m.x, y: m.y, z: 0, vz: 70, t: 0, item: it });
    if (it.grade === 'e' || it.grade === 'l' || it.grade === 'a') sfx('rare');
  }
  // 금화·재료가 튀어나와 1초 뒤 주인공에게 빨려 온다
  for (let i = 0; i < 3 + (Math.random() < 0.5 ? 1 : 0); i++) {
    const a = Math.random() * Math.PI * 2;
    f.drops.push({ x: m.x, y: m.y, z: 0, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, vz: 40 + Math.random() * 30, t: 0, kind: i === 0 && Math.random() < 0.6 ? 'mat' : 'coin' });
  }
}

/** 몬스터 → 아군 */
function hurtAlly(f: Field, u: Unit, dmg: number, from: Unit, heavy = false) {
  if (u.dead || (u.inv ?? 0) > 0) return;
  let cut = (u.guard ?? 0) > 0 ? 0.6 : 1;
  if (f.roles) {
    // ROLES §3 보호: 기사 곁(1.5칸)의 동료가 보스 바닥·돌진에 맞으면 30%를 기사가 대신 받는다
    if (heavy && u.job !== 'knight') {
      const k = f.allies.find((a) => a !== u && !a.dead && a.job === 'knight' && dist(a, u) <= RV.guardR);
      if (k) {
        hurtAlly(f, k, dmg * RV.guardShare, from);
        dmg *= 1 - RV.guardShare;
        sprFx(f, 'shield', k.x, k.y, 0.4, { oy: 24 });
      }
    }
    // §3 도발 −50% · 기사 늘 −20% · 드워프 버티기(체력 30% 아래 −25%) · §2 방어
    cut = ((u.guard ?? 0) > 0 ? 1 - RV.taunt.cut : 1) * (u.job === 'knight' ? 1 - RV.knightCut : 1) * (u.actor?.kind === 'dwarf' && u.hp < u.max * RV.dwarfLow ? 1 - RV.dwarfCut : 1) * (1 - (u.defCut ?? 0));
  }
  // BUILDINGS_SPEC §3: 돌피부 물약 — 받는 피해 −15%
  dmg = Math.round(dmg * cut * (1 - buffOf('stone')) * (1 - (u.dmgCut ?? 0)) * (u.actor ? mythicDef(f.allies.map((x) => x.actor!).filter(Boolean), u.actor) : 1) * resolveTaken(f.resolve ?? 0));
  u.hp -= dmg;
  u.flash = 1 / 30 + 0.001;
  u.hurtT = 0.22;
  const [nx, ny] = norm(u.x - from.x, u.y - from.y);
  // ROLES §3: 기사는 넉백 절반 (바닥 찍기 안에서도 버틴다)
  const kb = pxToTile(C.knock.hit) * 8 * (f.roles && u.job === 'knight' ? RV.knightKnock : 1);
  u.vx += nx * kb;
  u.vy += ny * kb;
  f.nums.push({ x: u.x, y: u.y, text: String(dmg * 10), crit: false, t: 0, dx: 0 });
  if (isMe(f, u)) {
    f.hitsTaken++;
    shake(f, 1);
  }
  if (u.hp <= 0 && (u.revive ?? 0) > 0) {
    // GROWTH §3-4: 「설원 수호자의 털옷」 한 번 쓰러지면 체력 30%로 일어남
    u.hp = Math.max(1, Math.round(u.max * u.revive!));
    u.revive = 0;
    u.inv = 1;
    f.banner = `${u.actor?.name ?? '동료'}${josa(u.actor?.name ?? '동료', '이')} 다시 일어났다!`;
    f.bannerT = 1.6;
  }
  if (u.hp <= 0) {
    u.hp = 0;
    u.dead = true;
    if (isMe(f, u)) {
      // PARTY §3: 4번째 동료(AI 전용)는 셋이 다 쓰러졌을 때만 넘겨받는다
      const next = f.allies.slice(0, 3).find((a) => !a.dead) ?? f.allies.find((a) => !a.dead);
      if (next) f.me = next;
    }
    if (f.roles) reviveLater(f, u);
  } else if (f.roles && u.actor?.kind === 'dwarf' && !u.lowSaid && u.hp < u.max * RV.dwarfLow) {
    // ROLES §3 드워프 버티기
    u.lowSaid = true;
    f.banner = `${u.actor.name}: 아직 멀었다!`;
    f.bannerT = 1.2;
  }
}
/** ROLES §4 한 번 살리기: 사제가 살아 있으면 3초 뒤 체력 30%로 (사냥 1번 · 토벌 2번) */
function reviveLater(f: Field, u: Unit) {
  if ((f.rvLeft ?? 0) <= 0 || u.job === 'priest' || !f.allies.some((a) => !a.dead && a.job === 'priest')) return;
  f.rvLeft!--;
  (f.later ??= []).push({
    t: RV.revive.t,
    fn: () => {
      if (!u.dead || f.done) return;
      if (!f.allies.some((a) => !a.dead && a.job === 'priest')) {
        f.rvLeft!++;
        return;
      }
      u.dead = false;
      u.deadT = 0;
      u.hp = Math.round(u.max * RV.revive.hp);
      u.inv = 1;
      // 금빛 기둥
      sprFx(f, 'holy', u.x, u.y, 0.6, { q: 1, oy: 16 });
      f.fx.push({ kind: 'heal', x: u.x, y: u.y, t: 0, dur: 0.8, r: 0.9 });
      const nm = u.actor?.name ?? '동료';
      f.banner = `${nm}, 일어나요!`;
      f.bannerT = 1.6;
      sfx('skill_priest', { vol: C.allyVol });
    },
  });
}
const shake = (f: Field, amp: number) => {
  // HOTFIX15: 설정이 끔이면 화면은 그대로 — 보스급 충격만 가장자리 붉은 비네트 0.3초
  const p = shakeParams(amp, C.shake.dur);
  if (!p) {
    if (amp >= C.shake.boss) f.vign = 0.3;
    return;
  }
  f.shake = p.dur;
  f.shakeAmp = Math.max(f.shake > 0 ? f.shakeAmp : 0, p.amp);
};

// ───────── 아군 행동 ─────────

const mobsAlive = (f: Field) => f.units.filter((u) => u.team === 'mob' && !u.dead && u.st !== 'spawn');
/** 가장 가까운 적 · 조이스틱 방향을 우선 */
export function aimTarget(f: Field, u: Unit, maxD = 4, dir?: [number, number]): Unit | null {
  let best: Unit | null = null;
  let bs = 1e9;
  for (const m of mobsAlive(f)) {
    const d = dist(u, m);
    if (d > maxD) continue;
    let s = d;
    if (dir) {
      const [nx, ny] = norm(m.x - u.x, m.y - u.y);
      const dot = nx * dir[0] + ny * dir[1];
      s = d - dot * 1.5;
    }
    if (s < bs) {
      bs = s;
      best = m;
    }
  }
  return best;
}
const faceTo = (u: Unit, t: { x: number; y: number }) => {
  const [nx, ny] = norm(t.x - u.x, t.y - u.y);
  u.ax = nx;
  u.ay = ny;
};
const powerHit = (f: Field, u: Unit, mult: number) => {
  const crit = Math.random() < C.critChance + (u.critAdd ?? 0);
  return { dmg: (u.power ?? 50) * C.dmgK * mult * (crit ? 2 : 1) * (u === f.me ? 1 : C.allyDmg), crit };
};

/** 기본 공격: 3단 콤보 (3단째 궤적 크게 · 넉백 2배) · 원거리 직업은 탄 */
export function attack(f: Field, u: Unit) {
  if (u.dead || (u.swing ?? 0) > 0 || (u.dodge ?? 0) > 0 || u.stun > 0) return;
  const stickDir = u === f.me && Math.hypot(f.stick.x, f.stick.y) > 0.2 ? norm(...screenToWorld(f.stick.x, f.stick.y)) : undefined;
  // PARTY §1: 직접 조작하는 사냥꾼은 누르는 방향으로 쏜다 (자동 조준 없이) · 아니면 사거리 4칸 안의 적
  const bowDir = u.job === 'hunter' && u === f.me && !f.auto ? stickDir : undefined;
  const t = bowDir ? null : aimTarget(f, u, u.job === 'hunter' ? HC.range + 0.4 : RANGED.has(u.job!) ? 5 : 2.6, stickDir);
  if (t) faceTo(u, t);
  else if (stickDir) [u.ax, u.ay] = stickDir;
  // 직업별 기본 공격 (핫픽스 7): 빠르기·힘·사거리·부채꼴 폭이 다르다
  const J = C.jobAtk[u.job!] ?? C.jobAtk.knight;
  u.combo = (u.comboT ?? 0) > 0 ? ((u.combo ?? 0) % 3) + 1 : 1;
  u.comboT = Math.max(C.combo.window, J.swing + 0.3);
  u.swing = u.swingMax = J.swing * (1 - Math.min(0.5, u.spd ?? 0));
  u.atkAnim = Math.min(0.2, J.swing);
  const third = u.combo === 3;
  const mult = C.combo.mult[u.combo - 1] * J.dmg;
  if (RANGED.has(u.job!)) {
    const sp = J.speed ?? 7;
    const kind = u.job === 'mage' ? 'bolt' : 'arrow';
    f.proj.push({ x: u.x, y: u.y, vx: u.ax * sp, vy: u.ay * sp, life: (u.job === 'hunter' ? HC.range : 5.6) / sp, dmg: mult, owner: u, kind, hit: new Set() });
    return;
  }
  // 근접: 앞쪽 부채꼴 — 핫픽스 8 (2-7): 직업마다 다른 베기 (기사 찌르기 · 전사 도끼 내리찍기 · 도적 쌍단검 · 사제 지팡이 빛)
  const range = J.range + (third ? 0.35 : 0);
  const arc = third ? Math.max(2.2, J.arc) : J.arc;
  const cut = JOB_CUT[u.job!];
  if (cut) sprFx(f, cut, u.x + u.ax * 0.55, u.y + u.ay * 0.55, u.job === 'priest' ? 0.25 : 0.18, { q: quarterOf(u.ax, u.ay), oy: 12, big: third, owner: u });
  else f.fx.push({ kind: 'slash', x: u.x + u.ax * 0.35, y: u.y + u.ay * 0.35, ax: u.ax, ay: u.ay, t: 0, dur: 0.15, big: third, owner: u });
  if (u.job === 'warrior') shake(f, 1);
  for (const m of mobsAlive(f)) {
    const d = dist(u, m);
    if (d > range + m.r) continue;
    const [nx, ny] = norm(m.x - u.x, m.y - u.y);
    if (Math.acos(Math.max(-1, Math.min(1, nx * u.ax + ny * u.ay))) > arc / 2 && d > 0.45) continue;
    const h = powerHit(f, u, mult);
    hurtMob(f, m, h.dmg, u, { crit: h.crit, knock: third ? 2 : 1 });
  }
}

/** 회피(구르기): 0.35초 무적 · 쿨 1.5초 */
export function dodge(f: Field, u: Unit, dir?: [number, number]) {
  if (u.dead || (u.dodgeCd ?? 0) > 0 || u.stun > 0) return;
  let d = dir;
  // PARTY §1: 사냥꾼은 막기 대신 「뒤로 구르기」 — 바라보는 쪽은 그대로 두고 등 뒤로 (짧은 무적)
  if (u.job === 'hunter') {
    const b: [number, number] = d ?? [-u.ax, -u.ay];
    u.rollDir = roomyDir(u, b);
    u.dodge = C.dodge.dur;
    u.inv = C.dodge.inv;
    u.dodgeCd = C.dodge.cd;
    u.swing = 0;
    return;
  }
  if (!d) {
    const s = u === f.me && Math.hypot(f.stick.x, f.stick.y) > 0.2 ? norm(...screenToWorld(f.stick.x, f.stick.y)) : null;
    d = s ?? [u.ax, u.ay];
  }
  u.ax = d[0];
  u.ay = d[1];
  u.dodge = C.dodge.dur;
  u.inv = C.dodge.inv;
  u.dodgeCd = C.dodge.cd;
  u.swing = 0;
}

/** 스킬 1·2 (직업별) — 소리는 시전할 때 한 번만 */
export function skill(f: Field, u: Unit, i: 0 | 1) {
  if (u.dead || u.cd![i] > 0 || u.stun > 0 || (u.dodge ?? 0) > 0) return;
  const stickDir = u === f.me && Math.hypot(f.stick.x, f.stick.y) > 0.2 ? norm(...screenToWorld(f.stick.x, f.stick.y)) : undefined;
  const t = aimTarget(f, u, 5, stickDir);
  if (t) faceTo(u, t);
  u.cd![i] = u.cdMax?.[i] ?? C.skillCd[i];
  u.castAnim = 0.3;
  if (u === f.me) {
    f.castTxt = SKILL_NAMES[u.job!][i];
    f.castT = 0.6;
    f.castColor = CAST_COLOR[u.job!];
  }
  // 핫픽스 8 (2-8): 직업마다 다른 스킬 소리
  sfx(`skill_${u.job ?? 'warrior'}`, { vol: u === f.me ? 1 : C.allyVol });
  const P = (mult: number) => powerHit(f, u, mult);
  const near = (r: number, cx = u.x, cy = u.y) => mobsAlive(f).filter((m) => Math.hypot(m.x - cx, m.y - cy) <= r + m.r);
  switch (`${u.job}${i}`) {
    case 'knight0': {
      // 방패 강타: 앞으로 짧게 돌진 · 기절 1초
      u.vx += u.ax * 9;
      u.vy += u.ay * 9;
      for (const m of near(1.6, u.x + u.ax, u.y + u.ay)) hurtMob(f, m, P(1.4).dmg, u, { stun: 1, knock: 1.5, silent: true });
      // 방패 번쩍 (기절 별은 몹 머리 위에 따로)
      sprFx(f, 'shield', u.x + u.ax * 0.8, u.y + u.ay * 0.8, 0.3, { oy: 12 });
      break;
    }
    case 'knight1':
      // 도발 함성: 주변 적이 나를 노림 · 3초 받는 피해 -40%
      // ROLES §3: 4초 · −50% · 범위 4.5
      u.taunt = u.guard = f.roles ? RV.taunt.t : 3;
      for (const m of near(f.roles ? RV.taunt.r : 3.5)) {
        m.target = u;
        m.alertT = 0.9;
      }
      // 몸 주위 붉은 원 파동
      sprFx(f, 'circlered', u.x, u.y, 0.5, { oy: 2 });
      f.fx.push({ kind: 'ring', x: u.x, y: u.y, t: 0, dur: 0.5, r: 3, owner: u });
      break;
    case 'warrior0':
      // 회전 베기: 실제로 한 바퀴 돌며
      u.spinT = 0.4;
      sprFx(f, 'circslash', u.x, u.y, 0.3, { oy: 10 });
      for (const m of near(1.4)) hurtMob(f, m, P(1.6).dmg, u, { crit: true, knock: 1.6, silent: true });
      break;
    case 'warrior1': {
      // 도약 내려찍기: 조준한 곳으로 점프
      const tg = t ?? { x: u.x + u.ax * 2, y: u.y + u.ay * 2 };
      // 점프(그림자가 작아짐) → 착지하며 바위 가시 + 흙먼지
      u.jump = {
        t: 0, dur: 0.35, x0: u.x, y0: u.y, x1: tg.x - u.ax * 0.5, y1: tg.y - u.ay * 0.5,
        land: () => {
          sprFx(f, 'rockspike', u.x, u.y, 0.45, { oy: 14 });
          f.fx.push({ kind: 'puff', x: u.x, y: u.y, t: 0, dur: 0.45, big: true });
          shake(f, 2);
          for (const m of near(1.3)) hurtMob(f, m, P(2).dmg, u, { knock: 1.8, silent: true });
        },
      };
      u.inv = Math.max(u.inv ?? 0, 0.35);
      break;
    }
    case 'rogue0':
      // 그림자 찌르기: 적 등 뒤로 순간이동 후 치명타
      if (t) {
        // 사라졌다가 적 뒤에서 (지나간 자리에 잔상 3장) + X자 베기
        const [x0, y0] = [u.x, u.y];
        const x1 = t.x - t.ax * 0.55;
        const y1 = t.y - t.ay * 0.55;
        u.trail = [1, 2, 3].map((k) => ({ x: x0 + ((x1 - x0) * k) / 4, y: y0 + ((y1 - y0) * k) / 4, t: 0.35 + k * 0.05 }));
        f.fx.push({ kind: 'puff', x: u.x, y: u.y, t: 0, dur: 0.3 });
        u.x = x1;
        u.y = y1;
        faceTo(u, t);
        sprFx(f, 'cutx', t.x, t.y, 0.25, { oy: 12 });
        hurtMob(f, t, P(2.6).dmg * (1 / (P(1).crit ? 2 : 1)) * 2, u, { crit: true, silent: true });
      }
      break;
    case 'rogue1':
      // 독 단검: 부채꼴 3발 · 지속 피해
      for (const a of [-0.35, 0, 0.35]) {
        const c = Math.cos(a);
        const s = Math.sin(a);
        f.proj.push({ x: u.x, y: u.y, vx: (u.ax * c - u.ay * s) * 7, vy: (u.ax * s + u.ay * c) * 7, life: 0.6, dmg: 0.7, owner: u, kind: 'dagger', hit: new Set() });
      }
      break;
    case 'mage0':
      // 화염구 → 맞으면 폭발 (탄 그림 p_fire · 폭발 explosion)
      f.proj.push({ x: u.x, y: u.y, vx: u.ax * 6, vy: u.ay * 6, life: 0.9, dmg: 2.2, owner: u, kind: 'fire', hit: new Set() });
      break;
    case 'mage1': {
      // 점멸: 조이스틱 방향(없으면 적 반대쪽)으로 순간이동
      const d = stickDir ?? (t ? norm(u.x - t.x, u.y - t.y) : [u.ax, u.ay]);
      // 반짝이로 흩어졌다가 → 앞에 다시 나타남
      sprFx(f, 'spark', u.x, u.y, 0.35, { oy: 14 });
      u.x += d[0] * 2.4;
      u.y += d[1] * 2.4;
      u.inv = 0.3;
      sprFx(f, 'spark', u.x, u.y, 0.35, { oy: 14 });
      break;
    }
    case 'priest0': {
      // 치유의 빛: 지팡이를 하늘로 · 바닥에 금빛 원 · 아군 머리 위 초록 +숫자
      u.castAnim = 0.5;
      sprFx(f, 'circlegold', u.x, u.y, 0.6, { oy: 0 });
      // ROLES §4: 30% → 35% · 범위 2.5 → 3
      const hr = f.roles ? RV.healR : 2.5;
      f.fx.push({ kind: 'heal', x: u.x, y: u.y, t: 0, dur: 0.6, r: hr });
      for (const a of f.allies)
        if (!a.dead && dist(a, u) <= hr) {
          // REGIONS2: 「길 잃은 마음」이 곁에 붙어 있으면 회복이 반으로
          const blocked = f.units.some((m) => m.team === 'mob' && !m.dead && monDef(m.mon ?? '').noHeal && m.mon && dist(m, a) < 1.6);
          const h = Math.round(a.max * (f.roles ? RV.heal : 0.3) * mythicHeal(f.allies.map((x) => x.actor!).filter(Boolean)) * (blocked ? 0.5 : 1));
          a.hp = Math.min(a.max, a.hp + h);
          f.nums.push({ x: a.x, y: a.y, text: '+' + h * 10, crit: false, heal: true, t: 0, dx: 0 });
        }
      break;
    }
    case 'priest1':
      if (t) {
        // 신성 일격: 적 머리 위에서 금빛 빛기둥이 내려꽂힘 + 기절
        sprFx(f, 'holy', t.x, t.y, 0.35, { q: 1, oy: 16 });
        f.fx.push({ kind: 'boom', x: t.x, y: t.y, t: 0, dur: 0.3, r: 0.7 });
        hurtMob(f, t, P(2.5).dmg, u, { stun: 0.8, crit: true, silent: true });
      }
      break;
    case 'hunter0': {
      // PARTY §1 연사: 앞쪽 부채꼴로 화살 3발 (직접 조작이면 누르는 방향)
      if (u === f.me && !f.auto && stickDir) [u.ax, u.ay] = stickDir;
      const F = HC.fan;
      for (let k = 0; k < F.n; k++) {
        const a = (k - (F.n - 1) / 2) * F.spread;
        const c = Math.cos(a);
        const s = Math.sin(a);
        f.proj.push({ x: u.x, y: u.y, vx: (u.ax * c - u.ay * s) * F.speed, vy: (u.ax * s + u.ay * c) * F.speed, life: HC.range / F.speed, dmg: F.dmg, owner: u, kind: 'arrow', hit: new Set() });
      }
      break;
    }
    case 'hunter1': {
      // PARTY §1 화살비: 조준한 적(없으면 앞쪽) 원 범위에 2초 동안 화살이 쏟아진다
      const R = HC.rain;
      const aim = u === f.me && !f.auto && stickDir ? null : aimTarget(f, u, R.reach, stickDir);
      const dir = aim ? norm(aim.x - u.x, aim.y - u.y) : u === f.me && stickDir ? stickDir : ([u.ax, u.ay] as [number, number]);
      const reach = aim ? Math.min(R.reach, dist(u, aim)) : 2.5;
      const N = C.field;
      const x = Math.max(0.8, Math.min(N - 0.8, u.x + dir[0] * reach));
      const y = Math.max(0.8, Math.min(N - 0.8, u.y + dir[1] * reach));
      [u.ax, u.ay] = dir;
      f.fx.push({ kind: 'rain', x, y, t: 0, dur: R.dur, r: R.r, owner: u, tick: 0.05 });
      break;
    }
  }
}

/** 필살기: 케미 100% · 0.5초 멈추고 컷인 띠 → 전체 피해 */
export function ultimate(f: Field) {
  if (f.chem < 100 || f.ult > 0) return;
  f.chem = 0;
  f.ult = 0.5;
  const live = f.allies.filter((a) => !a.dead);
  let name = '합동기';
  f.ult5 = false;
  for (const a of live) for (const b of live) if (a !== b && a.actor && b.actor && pairOf(a.actor, b.actor)) name = `${pairOf(a.actor, b.actor)!.name} · 합동기`;
  // 핫픽스 12 §6: 친밀도 5단계 짝이 같이 있으면 그 짝 전용 「합동 오의」 (+20%)
  for (const a of live)
    for (const b of live)
      if (a !== b && a.actor && b.actor && bondOf(a.actor, b.actor)?.lv === 5) {
        const p = pairOf(a.actor, b.actor);
        if (p) {
          name = ultName5(p);
          f.ult5 = true;
        }
      }
  f.ultName = name;
  sfx('skill');
}
function ultHit(f: Field) {
  const sum = f.allies.filter((a) => !a.dead).reduce((s, a) => s + (a.power ?? 50), 0);
  shake(f, C.shake.boss);
  for (const m of mobsAlive(f)) {
    f.fx.push({ kind: 'boom', x: m.x, y: m.y, t: 0, dur: 0.4, r: 0.8 });
    hurtMob(f, m, (sum / 3) * C.dmgK * C.ultMult * (f.ult5 ? 1.2 : 1), f.me, { crit: true, knock: 2, silent: true });
  }
  sfx('crit');
}

// ───────── AI (동료 · AUTO) ─────────

/** v0.24.4: 9칸 안에 적이 없을 때 — 살아 있는 보스(정예), 없으면 가장 가까운 적 (거리 상관없이) */
function farTarget(f: Field, u: Unit): Unit | null {
  if (!flag('aiBossTarget')) return null;
  const e = f.elite;
  if (e && !e.dead && e.st !== 'spawn') return e;
  return aimTarget(f, u, 1e9);
}

function aiAlly(f: Field, u: Unit, dt: number) {
  // 동료끼리 너무 붙지 않게 살짝 밀어낸다 (한 덩어리로 겹치지 않게)
  for (const o of f.allies) {
    if (o === u || o.dead) continue;
    const d = dist(u, o);
    if (d < C.allyGap * 0.7 && d > 0.001) {
      const [nx, ny] = norm(u.x - o.x, u.y - o.y);
      u.x += nx * (C.allyGap * 0.7 - d) * Math.min(1, dt * 10);
      u.y += ny * (C.allyGap * 0.7 - d) * Math.min(1, dt * 10);
    }
  }
  // 예고 범위 안이면 절반쯤 구른다 (예고마다 한 번 정한다)
  for (const m of mobsAlive(f)) {
    if (m.st !== 'tele' || !m.tele) continue;
    if (Math.hypot(u.x - m.tele.x, u.y - m.tele.y) > m.tele.r + u.r) continue;
    if (u.dodgeDecided === m.id) continue;
    u.dodgeDecided = m.id;
    f.stats.teleIn++;
    // ROLES §3: 도발 중인 기사는 피하지 않고 막는다
    if (f.roles && u.job === 'knight' && (u.taunt ?? 0) > 0) continue;
    if (Math.random() < C.autoDodge) {
      f.stats.dodged++;
      const [nx, ny] = norm(u.x - m.tele.x, u.y - m.tele.y);
      dodge(f, u, [nx, ny]);
      return;
    }
  }
  // 힐러: 체력 50% 아래 아군을 치유
  if (u.role === 'heal' && u.cd![0] <= 0 && f.allies.some((a) => !a.dead && a.hp < a.max * 0.5 && dist(a, u) < (f.roles ? RV.healR : 3.5))) return skill(f, u, 0);
  if (f.roles && u.role === 'heal' && u.cd![0] <= 0) {
    // ROLES §4: 체력이 가장 낮은 동료 곁으로
    const low = f.allies.filter((a) => a !== u && !a.dead && a.hp < a.max * 0.5).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    if (low && dist(u, low) > 2) return moveToward(f, u, low.x, low.y, dt);
  }
  // ROLES §3: 기사는 보스(정예) 쪽으로 먼저 붙는다 · §4 사제는 치유가 준비되면 체력 50% 아래 동료 곁으로 (늘 따라다니면 딜이 줄어 시간 안에 못 깬다 — 실세이브 이카몰리)
  const big = f.roles && u.role === 'tank' && f.elite && !f.elite.dead && f.elite.st !== 'spawn' ? f.elite : null;
  const t = big ?? aimTarget(f, u, 9) ?? farTarget(f, u);
  if (!t) {
    // 적이 없으면 조종 캐릭터 곁의 내 자리로 (약 1.5칸, 동료마다 다른 방향)
    if (u !== f.me) {
      const a = u.slot ?? 2;
      const gx = f.me.x + Math.cos(a) * C.allyGap;
      const gy = f.me.y + Math.sin(a) * C.allyGap;
      if (Math.hypot(u.x - gx, u.y - gy) > 0.45) moveToward(f, u, gx, gy, dt);
    }
    return;
  }
  // PARTY §1: 사냥꾼은 적과 3칸 거리를 두고 쏜다 (벽·필드 끝에서 끼지 않게)
  if (u.job === 'hunter') return kite(f, u, t, dt);
  const ranged = RANGED.has(u.job!) || u.role === 'heal';
  let gx = t.x;
  let gy = t.y;
  if (u.role === 'dps' && !ranged) {
    // 딜러: 적의 등 뒤로
    gx = t.x - t.ax * 0.6;
    gy = t.y - t.ay * 0.6;
  }
  // v0.24.4: 근접은 덩치 큰 보스(r 0.6~0.85)와 겹치지 않는 거리(내 r + 보스 r)에서도 친다 — 예전엔 0.85까지 붙으려다 밀려나 AUTO로 보스를 못 때렸다
  const want = ranged ? 2.6 : flag('aiBossTarget') ? Math.max(0.85, u.r + t.r + 0.2) : 0.85;
  const d = dist(u, t);
  if (ranged && d < 1.6) moveToward(f, u, u.x * 2 - t.x, u.y * 2 - t.y, dt);
  else if (d > want) moveToward(f, u, gx, gy, dt);
  else {
    faceTo(u, t);
    if (u.cd![0] <= 0 && u.role !== 'heal' && Math.random() < 0.02) skill(f, u, 0);
    else if (u.cd![1] <= 0 && Math.random() < 0.015) skill(f, u, 1);
    else attack(f, u);
  }
}
// ───────── PARTY §1: 사냥꾼 카이팅 ─────────

/** 필드 안쪽 여유 (벽에서 이만큼은 떨어져서 물러난다) */
const roomOf = () => [HC.wallPad, C.field - HC.wallPad] as const;
/**
 * 물러날 방향 바로잡기: 벽 쪽 성분은 지운다(벽을 따라 미끄러짐). 둘 다 막혔거나(구석) 거의 0이면 필드 가운데 쪽으로 옆걸음
 */
export function roomyDir(u: { x: number; y: number }, d: [number, number]): [number, number] {
  const [lo, hi] = roomOf();
  let [x, y] = norm(d[0], d[1]);
  if ((u.x <= lo && x < 0) || (u.x >= hi && x > 0)) x = 0;
  if ((u.y <= lo && y < 0) || (u.y >= hi && y > 0)) y = 0;
  if (Math.hypot(x, y) < 0.35) {
    // 구석: 가운데로 향하되 적에게서 먼 쪽 옆으로
    const c = C.field / 2;
    const [cx, cy] = norm(c - u.x, c - u.y);
    const [px, py] = [-d[1], d[0]];
    const side = px * cx + py * cy >= 0 ? 1 : -1;
    return norm(cx * 0.6 + px * side, cy * 0.6 + py * side);
  }
  return norm(x, y);
}
function kite(f: Field, u: Unit, t: Unit, dt: number) {
  const d = dist(u, t);
  // 빠져나가는 중 (막혔을 때 잠깐 옆으로)
  if (u.escape && u.escape.t > 0) {
    u.escape.t -= dt;
    moveToward(f, u, u.x + u.escape.x, u.y + u.escape.y, dt);
    if ((u.swing ?? 0) <= 0 && d <= HC.range) attack(f, u);
    return;
  }
  // 가까운 적들(2.5칸 안) 무게 중심에서 멀어지는 쪽
  let ax = 0;
  let ay = 0;
  for (const m of mobsAlive(f)) {
    const md = dist(u, m);
    if (md > 2.5 || md < 0.001) continue;
    const w = 1 / Math.max(0.3, md);
    ax += ((u.x - m.x) / md) * w;
    ay += ((u.y - m.y) / md) * w;
  }
  if (!ax && !ay) [ax, ay] = norm(u.x - t.x, u.y - t.y);
  const tooClose = d < HC.kiteMin;
  const want = d < HC.kite * 0.85;
  if (tooClose || want) {
    const [rx, ry] = roomyDir(u, [ax, ay]);
    // 아주 가깝고 구르기가 되면 뒤로 구르기 (벽 쪽이면 옆으로)
    if (tooClose && d < 1.1 && (u.dodgeCd ?? 0) <= 0) {
      dodge(f, u, [rx, ry]);
      return;
    }
    const x0 = u.kiteLast?.[0] ?? u.x;
    const y0 = u.kiteLast?.[1] ?? u.y;
    moveToward(f, u, u.x + rx, u.y + ry, dt);
    // 막힘 감지: 물러나려는데 (지난 걸음부터) 거의 못 움직였으면 쌓인다 → 0.5초면 옆으로 빠져나간다
    const moved = Math.hypot(u.x - x0, u.y - y0);
    u.kiteLast = [u.x, u.y];
    u.kiteStuck = moved < 0.25 * C.move * 0.75 * dt * 0.62 ? (u.kiteStuck ?? 0) + dt : Math.max(0, (u.kiteStuck ?? 0) - dt);
    if ((u.kiteStuck ?? 0) > 0.5) {
      u.kiteStuck = 0;
      const c = C.field / 2;
      const [cx, cy] = norm(c - u.x, c - u.y);
      const [px, py] = [-ay, ax];
      const side = px * cx + py * cy >= 0 ? 1 : -1;
      const [ex, ey] = norm(cx + px * side, cy + py * side);
      u.escape = { x: ex, y: ey, t: 0.8 };
    }
    // 물러나면서도 쏜다 (다시 적을 본다)
    if ((u.swing ?? 0) <= 0 && d <= HC.range) attack(f, u);
    return;
  }
  u.kiteStuck = 0;
  u.kiteLast = undefined;
  if (d > HC.range - 0.3) {
    // 사거리 밖: 3칸 거리까지 다가간다
    moveToward(f, u, t.x, t.y, dt);
    return;
  }
  faceTo(u, t);
  if (u.cd![0] <= 0 && Math.random() < 0.02) skill(f, u, 0);
  else if (u.cd![1] <= 0 && Math.random() < 0.015) skill(f, u, 1);
  else attack(f, u);
}

function moveToward(_f: Field, u: Unit, x: number, y: number, dt: number) {
  const [nx, ny] = norm(x - u.x, y - u.y);
  // 화면 속도로 맞춘 이동 속도 (가로·세로 고르게)
  const sp = C.move * 0.75 * (C.jobMove[u.job!] ?? 1);
  u.x += nx * sp * dt * 0.62;
  u.y += ny * sp * dt * 0.62;
  u.ax = nx;
  u.ay = ny;
  u.moving = true;
}

// ───────── 몬스터 ─────────

function aiMob(f: Field, m: Unit, dt: number) {
  if (m.st === 'spawn') {
    m.stT! -= dt;
    if (m.stT! <= 0) m.st = 'move';
    return;
  }
  if (m.stun > 0 || (m.rooted ?? 0) > 0) {
    if (m.st === 'tele') {
      m.st = 'recover';
      m.stT = 0.3;
      m.tele = undefined;
    }
    return;
  }
  const allies = f.allies.filter((a) => !a.dead);
  if (!allies.length) return;
  const taunter = allies.find((a) => (a.taunt ?? 0) > 0 && dist(a, m) < (f.roles ? RV.taunt.r : 4));
  if (taunter) m.target = taunter;
  if (!m.target || m.target.dead) m.target = allies.sort((a, b) => dist(a, m) - dist(b, m))[0];
  if (m.boss) return aiBoss(f, m, m.target, dt);
  const t = m.target;
  const md = monDef(m.mon!);
  // 예고는 조금 먼 데서부터 (넉백에 밀려도 공격이 나온다)
  const reach = md.reach + (m.elite ? 0.15 : 0);
  switch (m.st) {
    case 'move': {
      const d = dist(m, t);
      if (d <= reach) {
        faceTo(m, t);
        m.st = 'tele';
        m.stT = m.teleMax = C.tele * (m.elite ? 1.1 : 1) + (f.comboTele ?? 0);
        const off = md.hop ? 0.85 : 0.75;
        m.tele = { x: m.x + m.ax * off, y: m.y + m.ay * off, r: md.hitR * (m.elite ? 1.35 : 1) };
        return;
      }
      const [nx, ny] = norm(t.x - m.x, t.y - m.y);
      // 핫픽스 9: 바위 등에 막혀 2초 동안 다가오지 못하면 한 칸 훌쩍 (가만히 서 있는 플레이어도 끝까지 깰 수 있게)
      if (d < (m.lastD ?? 1e9) - 0.05 * dt * 60 * 0.1) m.stuckT = 0;
      else m.stuckT = (m.stuckT ?? 0) + dt;
      m.lastD = d;
      if ((m.stuckT ?? 0) > 2) {
        m.x += nx;
        m.y += ny;
        m.stuckT = 0;
      }
      // 슬라임류는 통통 튀며 (빠르기 출렁)
      const hop = md.hop ? 0.45 + Math.max(0, Math.sin(m.t * 6)) * 1.1 : 1;
      m.x += nx * m.speed! * hop * dt * 0.62;
      m.y += ny * m.speed! * hop * dt * 0.62;
      m.ax = nx;
      m.ay = ny;
      m.moving = true;
      return;
    }
    case 'tele':
      m.stT! -= dt;
      if (m.stT! <= 0) {
        m.st = 'strike';
        m.stT = 0.18;
        // 슬라임류: 몸통 박치기 (앞으로 튀어 나간다)
        if (md.hop) {
          m.vx += m.ax * 5;
          m.vy += m.ay * 5;
        }
        for (const a of f.allies) if (!a.dead && Math.hypot(a.x - m.tele!.x, a.y - m.tele!.y) <= m.tele!.r + a.r) hurtAlly(f, a, m.atk!, m);
      }
      return;
    case 'strike':
      m.stT! -= dt;
      if (m.stT! <= 0) {
        m.st = 'recover';
        m.stT = C.recover;
        m.tele = undefined;
      }
      return;
    case 'recover':
      m.stT! -= dt;
      if (m.stT! <= 0) m.st = 'move';
      return;
  }
}

/** 보스: 다가오기 → 패턴 (직선 돌진 · 원형 내려찍기 · 부하 소환) · 체력 50%부터 빨라짐 */
function aiBoss(f: Field, m: Unit, t: Unit, dt: number) {
  const look = m.boss!;
  if (!m.enraged && m.hp < m.max * 0.5) {
    m.enraged = true;
    f.banner = `${look.name}${josa(look.name, '이')} 화났다!`;
    f.bannerT = 1.6;
    shake(f, C.shake.boss);
  }
  const fast = m.enraged ? C.bossEnrage : 1;
  if (m.dash && m.dash.t > 0) {
    m.dash.t -= dt;
    m.x += m.dash.vx * dt;
    m.y += m.dash.vy * dt;
    m.moving = true;
  }
  switch (m.st) {
    case 'move': {
      m.stT = (m.stT ?? 1.4) - dt;
      const d = dist(m, t);
      if (d > 1.2) {
        const [nx, ny] = norm(t.x - m.x, t.y - m.y);
        m.x += nx * m.speed! * fast * dt * 0.62;
        m.y += ny * m.speed! * fast * dt * 0.62;
        m.ax = nx;
        m.ay = ny;
        m.moving = true;
      }
      if ((m.stT ?? 0) > 0) return;
      // 패턴 고르기: 멀면 돌진, 가까우면 내려찍기, 가끔 부하
      const minions = f.units.filter((u) => u.minion && !u.dead).length;
      const p = (m.pat ?? 0) % 4 === 3 && minions < 6 ? 2 : d > 2.4 ? 0 : 1;
      m.pat = (m.pat ?? 0) + 1;
      faceTo(m, t);
      m.st = 'tele';
      const tl = [0.95, 1.1, 0.7][p] / fast + (f.comboTele ?? 0);
      m.stT = m.teleMax = tl;
      if (p === 0) {
        const L = 4.5;
        m.tele = { x: m.x, y: m.y, r: 0, x2: m.x + m.ax * L, y2: m.y + m.ay * L, w: 0.55 };
      } else if (p === 1) m.tele = { x: m.x, y: m.y, r: 1.9 + (m.enraged ? 0.3 : 0) };
      else m.tele = { x: m.x, y: m.y, r: 0.9 };
      (m as Unit & { curPat?: number }).curPat = p;
      f.castTxt = look.pats[p];
      f.castT = tl;
      f.castColor = '#ff8a7a';
      return;
    }
    case 'tele': {
      m.stT! -= dt;
      if (m.stT! > 0) return;
      const p = (m as Unit & { curPat?: number }).curPat ?? 1;
      const tl = m.tele!;
      m.st = 'strike';
      m.stT = 0.35;
      if (p === 0) {
        // 직선 돌진: 선 위의 아군 피해 + 보스가 끝까지 달려간다
        const L = Math.hypot(tl.x2! - tl.x, tl.y2! - tl.y);
        m.dash = { vx: ((tl.x2! - tl.x) / 0.3), vy: ((tl.y2! - tl.y) / 0.3), t: 0.3 };
        void L;
        for (const a of f.allies) if (!a.dead && segDist(a.x, a.y, tl.x, tl.y, tl.x2!, tl.y2!) <= tl.w! + a.r) hurtAlly(f, a, m.atk! * 1.3, m, true);
      } else if (p === 1) {
        for (const a of f.allies) if (!a.dead && Math.hypot(a.x - tl.x, a.y - tl.y) <= tl.r + a.r) hurtAlly(f, a, m.atk! * 1.5, m, true);
        f.fx.push({ kind: 'ring', x: tl.x, y: tl.y, t: 0, dur: 0.45, r: tl.r });
        shake(f, 3);
      } else {
        // 부하 셋
        const look2 = monDef(look.minion);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + Math.random();
          const x = Math.max(0.8, Math.min(C.field - 0.8, m.x + Math.cos(a) * 1.6));
          const y = Math.max(0.8, Math.min(C.field - 0.8, m.y + Math.sin(a) * 1.6));
          addMob(f, look2.id, x, y, { delay: 0.4, hpMul: 0.7, minion: true });
        }
      }
      return;
    }
    case 'strike':
      m.stT! -= dt;
      if (m.stT! <= 0) {
        m.st = 'recover';
        m.stT = C.recover * 1.3 / fast;
        m.tele = undefined;
      }
      return;
    case 'recover':
      m.stT! -= dt;
      if (m.stT! <= 0) {
        m.st = 'move';
        m.stT = (1.2 + Math.random() * 0.8) / fast;
      }
      return;
  }
}
const segDist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
};

// ───────── 한 걸음 ─────────

export function step(f: Field, dt: number) {
  // 화면 흔들림 · 숫자 · 연기는 히트스톱 중에도 흐른다
  f.shake = Math.max(0, f.shake - dt);
  if (f.vign) f.vign = Math.max(0, f.vign - dt);
  f.castT = Math.max(0, f.castT - dt);
  if (f.later?.length) {
    for (const l of f.later) l.t -= dt;
    const due = f.later.filter((l) => l.t <= 0);
    f.later = f.later.filter((l) => l.t > 0);
    for (const l of due) l.fn();
  }
  for (const n of f.nums) n.t += dt;
  f.nums = f.nums.filter((n) => n.t < 0.6);
  if (f.ult > 0) {
    f.ult -= dt;
    if (f.ult <= 0) ultHit(f);
    return;
  }
  if (f.stop > 0) {
    f.stop -= dt;
    for (const u of f.units) u.flash = Math.max(0, u.flash - dt);
    return;
  }
  if (f.done) {
    f.doneT += dt;
    stepFx(f, dt);
    return;
  }
  f.time -= dt;
  f.chainT = Math.max(0, f.chainT - dt);
  f.bannerT = Math.max(0, f.bannerT - dt);
  f.hitT = Math.max(0, f.hitT - dt);
  if (f.hitT <= 0) f.hit = 0;
  f.streakT = Math.max(0, f.streakT - dt);
  if (f.streakT <= 0) f.streak = 0;
  const N = C.field;
  for (const u of f.units) {
    u.t += dt;
    u.flash = Math.max(0, u.flash - dt);
    u.stun = Math.max(0, u.stun - dt);
    u.moving = false;
    if (u.dead) {
      u.deadT += dt;
      continue;
    }
    if (u.rooted) u.rooted = Math.max(0, u.rooted - dt);
    if (u.dot) {
      u.dot.t -= dt;
      u.dot.tick -= dt;
      if (u.dot.tick <= 0) {
        u.dot.tick = 0.5;
        hurtMob(f, u, u.dot.dps * 0.5, f.me, { silent: true, knock: 0 });
      }
      if (u.dot.t <= 0) u.dot = undefined;
    }
    u.alertT = Math.max(0, (u.alertT ?? 0) - dt);
    if (u.trail) {
      for (const p of u.trail) p.t -= dt;
      u.trail = u.trail.filter((p) => p.t > 0);
    }
    if (u.team === 'ally') {
      for (const k of ['swing', 'comboT', 'dodgeCd', 'inv', 'taunt', 'guard', 'atkAnim', 'castAnim', 'hurtT', 'spinT'] as const) u[k] = Math.max(0, (u[k] ?? 0) - dt);
      // 핫픽스 8: 도약 중엔 움직임·AI 없이 포물선으로 날아가 착지
      if (u.jump) {
        const j = u.jump;
        j.t += dt;
        const k = Math.min(1, j.t / j.dur);
        u.x = j.x0 + (j.x1 - j.x0) * k;
        u.y = j.y0 + (j.y1 - j.y0) * k;
        if (k >= 1) {
          u.jump = undefined;
          j.land();
        }
        continue;
      }
      u.cd = [Math.max(0, u.cd![0] - dt), Math.max(0, u.cd![1] - dt)];
      if ((u.dodge ?? 0) > 0) {
        u.dodge! -= dt;
        const sp = (C.dodge.dist / C.dodge.dur) * (u.rollDir ? HC.rollBack : 1);
        const [rx, ry] = u.rollDir ?? [u.ax, u.ay];
        u.x += rx * sp * dt * 0.62;
        u.y += ry * sp * dt * 0.62;
        u.moving = true;
        if (u.dodge! <= 0) u.rollDir = undefined;
      } else if (u.stun <= 0) {
        if (u === f.me && !f.auto) {
          const m = Math.hypot(f.stick.x, f.stick.y);
          if (m > 0.15) {
            const [wx, wy] = screenToWorld(f.stick.x, f.stick.y);
            const [nx, ny] = norm(wx, wy);
            // 화면에서 같은 빠르기: 세로로 갈 때 월드 거리가 더 길다
            const scr = Math.hypot(screenDx(nx, ny), ((nx + ny) * TH) / 2) || 1;
            const sp = (C.move * (C.jobMove[u.job!] ?? 1) * 16 * Math.min(1, m)) / scr;
            u.x += nx * sp * dt;
            u.y += ny * sp * dt;
            if ((u.swing ?? 0) <= 0) {
              u.ax = nx;
              u.ay = ny;
            }
            u.moving = true;
          }
          // 꾹 누르면 가까운 적을 자동 조준해 연속 공격
          if (f.holdAtk > C.hold) attack(f, u);
        } else aiAlly(f, u, dt);
      }
    } else aiMob(f, u, dt);
    // 넉백 (감속) · 경계 · 바위
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    u.vx *= Math.pow(0.0005, dt);
    u.vy *= Math.pow(0.0005, dt);
    u.x = Math.max(0.5, Math.min(N - 0.5, u.x));
    u.y = Math.max(0.5, Math.min(N - 0.5, u.y));
    for (const p of f.props) {
      const d = Math.hypot(u.x - p.x, u.y - p.y);
      if (d < p.r + u.r && d > 0) {
        u.x = p.x + ((u.x - p.x) / d) * (p.r + u.r);
        u.y = p.y + ((u.y - p.y) / d) * (p.r + u.r);
      }
    }
  }
  // ROLES §4: 사제 곁 3칸 동료는 초당 최대 체력 1% 회복
  if (f.roles)
    for (const a of f.allies)
      if (!a.dead && a.hp < a.max && f.allies.some((pr) => !pr.dead && pr.job === 'priest' && dist(pr, a) <= RV.aura.r)) a.hp = Math.min(a.max, a.hp + a.max * RV.aura.pct * dt);
  // 서로 겹치지 않게
  const live = f.units.filter((u) => !u.dead);
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const min = a.r + b.r;
      if (d < min && d > 0.0001) {
        const push = (min - d) / 2;
        const nx = (a.x - b.x) / d;
        const ny = (a.y - b.y) / d;
        a.x += nx * push;
        a.y += ny * push;
        b.x -= nx * push;
        b.y -= ny * push;
      }
    }
  // 탄
  for (const p of f.proj) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    for (const m of mobsAlive(f)) {
      if (p.hit.has(m) || Math.hypot(m.x - p.x, m.y - p.y) > m.r + 0.2) continue;
      p.hit.add(m);
      const h = powerHit(f, p.owner, p.dmg);
      if (p.kind === 'fire') {
        f.fx.push({ kind: 'boom', x: p.x, y: p.y, t: 0, dur: 0.35, r: 1.2 });
        sprFx(f, 'explosion', p.x, p.y, 0.45, { oy: 14 });
        for (const n of mobsAlive(f)) if (Math.hypot(n.x - p.x, n.y - p.y) <= 1.2 + n.r) hurtMob(f, n, h.dmg, p.owner, { crit: h.crit, knock: 1.3 });
        p.life = 0;
        break;
      }
      hurtMob(f, m, h.dmg, p.owner, { crit: h.crit });
      if (p.kind === 'dagger') m.dot = { t: 3, dps: (p.owner.power ?? 50) * C.dmgK * 0.4, tick: 0.5 };
      if (p.kind !== 'arrow') p.life = 0;
      else p.life = 0;
      break;
    }
  }
  f.proj = f.proj.filter((p) => p.life > 0);
  // PARTY §1 화살비: 원 안의 적에게 0.25초마다
  for (const fx of f.fx)
    if (fx.kind === 'rain' && fx.owner) {
      fx.tick = (fx.tick ?? 0) - dt;
      if (fx.tick > 0) continue;
      fx.tick += HC.rain.tick;
      for (const m of mobsAlive(f))
        if (Math.hypot(m.x - fx.x, m.y - fx.y) <= (fx.r ?? 1) + m.r) {
          const h = powerHit(f, fx.owner, HC.rain.dmg);
          hurtMob(f, m, h.dmg, fx.owner, { crit: h.crit, knock: 0.2, silent: true });
        }
    }
  // 덫: 밟은 적 2초 묶기
  for (const fx of f.fx)
    if (fx.kind === 'trap')
      for (const m of mobsAlive(f))
        if (Math.hypot(m.x - fx.x, m.y - fx.y) < (fx.r ?? 0.6)) {
          m.rooted = 2;
          fx.t = fx.dur;
          // 덩굴이 묶는다
          sprFx(f, 'plant', m.x, m.y, 0.6, { oy: 10 });
          hurtMob(f, m, (fx.owner?.power ?? 50) * C.dmgK, fx.owner ?? f.me, { silent: true, knock: 0 });
        }
  stepFx(f, dt);
  // 전투 2차: 무리가 줄면 가장자리에서 새 무리 · 목표를 채우면 정예/보스 · 정예/보스를 쓰러뜨리면 끝
  // REGIONS2: 보스 체력 50% (한 번) · 보스가 쓰러지면 한 줄
  const eb = f.elite?.boss ? f.elite : null;
  if (eb && f.half && !eb.dead && eb.hp <= eb.max * 0.5) {
    const h = f.half;
    f.half = undefined;
    h();
  }
  if (eb && eb.dead && f.bossLine) {
    f.banner = f.bossLine;
    f.bannerT = 4;
    f.bossLine = undefined;
  }
  if (f.mode === 'hunt') {
    const alive = f.units.filter((u) => u.team === 'mob' && !u.dead && !u.minion).length;
    if (!f.elite && f.spawned < f.killGoal && alive < C.refillBelow) spawnPack(f, true);
    if (!f.elite && f.kills >= f.killGoal) spawnElite(f);
    if (f.elite && f.elite.dead) end(f, 'win');
    if (!f.allies.some((a) => !a.dead) || f.time <= 0) end(f, 'lose');
  } else {
    // 토벌: 시간이 끝나면 그때까지 준 피해로 · 보스를 쓰러뜨리면 바로
    if (f.elite && f.elite.dead) end(f, 'win');
    else if (f.time <= 0) end(f, 'win');
    if (!f.allies.some((a) => !a.dead)) end(f, 'lose');
  }
  f.units = f.units.filter((u) => !(u.team === 'mob' && u.dead && u.deadT > 0.5));
}

function stepFx(f: Field, dt: number) {
  for (const x of f.fx) x.t += dt;
  f.fx = f.fx.filter((x) => x.t < x.dur);
  for (const d of f.drops) {
    d.t += dt;
    if (d.t < 1) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vz -= 260 * dt;
      d.z = Math.max(0, d.z + d.vz * dt);
      d.vx *= 0.92;
      d.vy *= 0.92;
    } else {
      // 1초 뒤 주인공에게 빨려 온다
      const k = Math.min(1, dt * (4 + (d.t - 1) * 12));
      d.x += (f.me.x - d.x) * k;
      d.y += (f.me.y - d.y) * k;
      d.z *= 0.8;
    }
  }
  f.drops = f.drops.filter((d) => !(d.t > 1 && Math.hypot(d.x - f.me.x, d.y - f.me.y) < 0.2));
  // 장비: 튀어 올랐다 떨어지고, 가까이 가거나 판이 끝나면 줍는다
  for (const l of f.loot) {
    l.t += dt;
    l.vz -= 260 * dt;
    l.z = Math.max(0, l.z + l.vz * dt);
  }
  for (const l of [...f.loot]) if ((f.done && f.doneT > 0.4) || (l.t > 0.6 && f.allies.some((a) => !a.dead && Math.hypot(a.x - l.x, a.y - l.y) < C.pickR))) pickLoot(f, l);
  for (const g of f.lootLog) g.t += dt;
}

function pickLoot(f: Field, l: Loot) {
  f.loot = f.loot.filter((x) => x !== l);
  const r = addToBag(l.item);
  if (r === 'ok') {
    f.picked.push(l.item);
    f.lootLog.push({ text: `${l.item.name} 획득!`, grade: l.item.grade, t: 0 });
    sfx('item');
  } else f.lootLog.push({ text: r === 'salvaged' ? `${l.item.name} 자동 분해` : '가방이 가득해요!', grade: l.item.grade, t: 0 });
  if (f.lootLog.length > 4) f.lootLog.splice(0, f.lootLog.length - 4);
}

function end(f: Field, r: 'win' | 'lose') {
  if (f.done) return;
  f.done = r;
  f.doneT = 0;
  sfx(r);
}

/** 평가 (전투 2차): 맞은 횟수 + 시간 + 최대 KILLS 연속 — 점수로 합쳐 S/A/B */
export function gradeScore(hits: number, timeUsedRatio: number, maxStreak: number): number {
  const G = C.grade;
  return 100 - hits * G.perHit - Math.max(0, timeUsedRatio - G.timeFree) * G.perTime + Math.min(G.streakCap, maxStreak) * G.perStreak;
}
export function gradeOf(score: number): 'S' | 'A' | 'B' {
  return score >= C.grade.s ? 'S' : score >= C.grade.a ? 'A' : 'B';
}
/** 평가 보너스: 이겼고 AUTO를 안 썼을 때만 */
export const gradeBonus = (win: boolean, autoUsed: boolean, g: 'S' | 'A' | 'B') => (win && !autoUsed ? C.grade.bonus[g] : 0);
export function grade(f: Field): 'S' | 'A' | 'B' {
  const limit = C.timeLimit;
  return gradeOf(gradeScore(f.hitsTaken, (limit - f.time) / limit, f.maxStreak));
}
