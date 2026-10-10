// 전투 개편 1차: 쿼터뷰 필드 액션 — 상태와 규칙 (그리기는 draw.ts, 조작·화면은 ui.ts)
//  좌표는 타일(마을과 같은 쿼터뷰). 주인공 1명 조종 + 동료 2명 AI. 몬스터: 다가오기 → 예고(빨간 범위 0.6초) → 공격 → 빈틈 0.8초
import { CONFIG } from '../data/config';
import type { RegionId } from '../data/items';
import { appearance, powerOf } from '../world/adventurers';
import type { Actor } from '../world/state';
import { framesFor, type CharFrames } from '../engine/sprites';
import { TH, TW } from '../engine/iso';
import { sfx } from '../audio/sfx';
import { recPower } from '../world/hunt';
import { pairOf } from '../world/chem';

const C = CONFIG.combat;
export type Job = 'knight' | 'warrior' | 'rogue' | 'mage' | 'priest' | 'hunter';
export const JOB_OF: Record<string, Job> = { knight: 'knight', dwarf: 'warrior', rogue: 'rogue', mage: 'mage', cleric: 'priest', hunter: 'hunter', hero: 'warrior' };
const RANGED = new Set<Job>(['mage', 'hunter']);
export const SKILL_NAMES: Record<Job, [string, string]> = {
  knight: ['방패 강타', '도발 함성'],
  warrior: ['회전 베기', '도약 내려찍기'],
  rogue: ['그림자 찌르기', '독 단검'],
  mage: ['화염구', '점멸'],
  priest: ['치유의 빛', '신성 일격'],
  hunter: ['연속 사격', '덫'],
};

export interface Area {
  x: number;
  y: number;
  r: number;
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
  mon?: 'slime' | 'goblin';
  st?: 'spawn' | 'move' | 'tele' | 'strike' | 'recover';
  stT?: number;
  tele?: Area;
  atk?: number;
  speed?: number;
  target?: Unit;
  dot?: { t: number; dps: number; tick: number };
  rooted?: number;
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
  kind: 'slash' | 'puff' | 'ring' | 'heal' | 'boom' | 'trap';
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
  chem: number;
  /** 필살기 컷인 (0.5초 멈춤) */
  ult: number;
  ultName: string;
  hitsTaken: number;
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
}

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
const SLOTS = [0, Math.PI * 0.75, -Math.PI * 0.25 + Math.PI * 1.5];
export function makeField(region: RegionId, stage: number, members: Actor[], auto: boolean): Field {
  const N = C.field;
  const mk = (a: Actor, i: number): Unit => {
    const job = JOB_OF[a.kind] ?? 'warrior';
    const { key, def } = appearance(a);
    const max = Math.round(C.hpBase + a.lvl * C.hpPerLv);
    return {
      id: i + 1, team: 'ally', x: N / 2 + (i ? Math.cos(SLOTS[i]) * C.allyGap : 0), y: N / 2 + 0.8 + (i ? Math.sin(SLOTS[i]) * C.allyGap : 0), slot: SLOTS[i], vx: 0, vy: 0, r: 0.32, hp: max, max, ax: 1, ay: 0, moving: false, flash: 0, stun: 0, t: 0, dead: false, deadT: 0,
      actor: a, job, power: powerOf(a), role: job === 'knight' ? 'tank' : job === 'priest' ? 'heal' : 'dps', frames: framesFor(key, def),
      combo: 0, comboT: 0, swing: 0, dodge: 0, dodgeCd: 0, inv: 0, cd: [0, 0], taunt: 0, guard: 0, atkAnim: 0,
    };
  };
  const allies = members.slice(0, 3).map(mk);
  const props: Field['props'] = [];
  // 가장자리 숲 · 안쪽 바위 몇 개 (부딪힘)
  // 안쪽은 낮은 바위만 (큰 나무는 캐릭터를 가린다 · 나무는 가장자리 숲)
  for (let i = 0; i < 4; i++) props.push({ x: 1.5 + Math.random() * (N - 3), y: 1.5 + Math.random() * (N - 3), r: 0.35, kind: 'rock' });
  const f: Field = {
    region, stage, rec: recPower(region, stage), units: [...allies], allies, me: allies[0], proj: [], fx: [], nums: [], drops: [],
    wave: 0, waveLeft: 0, time: C.timeLimit, stop: 0, shake: 0, shakeAmp: 0, chem: 0, ult: 0, ultName: '', hitsTaken: 0, autoUsed: auto, auto, kills: 0, chain: 0, chainT: 0,
    done: '', doneT: 0, stick: { x: 0, y: 0 }, holdAtk: 0, nextId: 100, stats: { teleIn: 0, dodged: 0 }, castTxt: '', castT: 0, props: props.filter((p) => Math.hypot(p.x - N / 2, p.y - N / 2) > 2.2),
  };
  spawnWave(f);
  return f;
}

function spawnWave(f: Field) {
  f.wave++;
  const N = C.field;
  const n = Math.min(C.pack[1], C.pack[0] + Math.floor(Math.random() * (2 + f.stage)));
  const goblinShare = [0.15, 0.4, 0.6][Math.min(2, f.stage - 1)] ?? 0.5;
  for (let i = 0; i < n; i++) {
    const kind: 'slime' | 'goblin' = Math.random() < goblinShare ? 'goblin' : 'slime';
    // 필드 가장자리에서 뿅
    const side = Math.floor(Math.random() * 4);
    const t = 0.8 + Math.random() * (N - 1.6);
    const [x, y] = side === 0 ? [t, 0.8] : side === 1 ? [N - 0.8, t] : side === 2 ? [t, N - 0.8] : [0.8, t];
    // 파티가 추천보다 아주 세면 몬스터도 조금 버틴다 (손맛 확인용 · 여전히 더 빨리 잡힌다)
    const avg = f.allies.reduce((a, u) => a + (u.power ?? 50), 0) / Math.max(1, f.allies.length);
    const tough = Math.pow(Math.max(1, Math.min(C.toughCap, avg / f.rec)), C.toughExp);
    const max = Math.round(f.rec * C.mobHpK[kind] * tough * (f.wave === C.waves ? 1.15 : 1));
    f.units.push({
      id: f.nextId++, team: 'mob', mon: kind, x, y, vx: 0, vy: 0, r: kind === 'slime' ? 0.3 : 0.32, hp: max, max, ax: -1, ay: 0, moving: false, flash: 0, stun: 0, t: Math.random(), dead: false, deadT: 0,
      st: 'spawn', stT: 0.45 + i * 0.08, atk: C.mobAtk + f.rec * C.mobAtkK * (kind === 'goblin' ? 1.1 : 0.9), speed: kind === 'slime' ? 0.95 : 1.9,
    });
    f.fx.push({ kind: 'puff', x, y, t: 0, dur: 0.5, big: true });
  }
  f.waveLeft = n;
}

// ───────── 피해 ─────────

const isMe = (f: Field, u: Unit) => u === f.me;
/** 아군 → 몬스터 */
export function hurtMob(f: Field, m: Unit, dmg: number, by: Unit, o: { crit?: boolean; knock?: number; heavy?: boolean; stun?: number; silent?: boolean } = {}) {
  if (m.dead || m.st === 'spawn') return;
  const crit = !!o.crit;
  dmg = Math.max(1, Math.round(dmg));
  m.hp -= dmg;
  m.flash = 1 / 30 + 0.001;
  if (o.stun) m.stun = Math.max(m.stun, o.stun);
  const kill = m.hp <= 0;
  // 넉백: 때린 쪽에서 밀려난다 (벽에 부딪히면 멈춤)
  const [nx, ny] = norm(m.x - by.x, m.y - by.y);
  const kpx = kill ? C.knock.kill : crit ? C.knock.crit : C.knock.hit;
  // 예고 중(버티는 자세)에는 30%만 밀린다
  const k = pxToTile(kpx * (o.knock ?? 1)) * 8 * (m.st === 'tele' && !kill ? 0.3 : 1);
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
  f.fx.push({ kind: 'puff', x: m.x, y: m.y, t: 0, dur: 0.55, big: true });
  // 금화·재료가 튀어나와 1초 뒤 주인공에게 빨려 온다
  for (let i = 0; i < 3 + (Math.random() < 0.5 ? 1 : 0); i++) {
    const a = Math.random() * Math.PI * 2;
    f.drops.push({ x: m.x, y: m.y, z: 0, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, vz: 40 + Math.random() * 30, t: 0, kind: i === 0 && Math.random() < 0.6 ? 'mat' : 'coin' });
  }
}

/** 몬스터 → 아군 */
function hurtAlly(f: Field, u: Unit, dmg: number, from: Unit) {
  if (u.dead || (u.inv ?? 0) > 0) return;
  dmg = Math.round(dmg * ((u.guard ?? 0) > 0 ? 0.6 : 1));
  u.hp -= dmg;
  u.flash = 1 / 30 + 0.001;
  u.hurtT = 0.22;
  const [nx, ny] = norm(u.x - from.x, u.y - from.y);
  u.vx += nx * pxToTile(C.knock.hit) * 8;
  u.vy += ny * pxToTile(C.knock.hit) * 8;
  f.nums.push({ x: u.x, y: u.y, text: String(dmg * 10), crit: false, t: 0, dx: 0 });
  if (isMe(f, u)) {
    f.hitsTaken++;
    shake(f, 1);
  }
  if (u.hp <= 0) {
    u.hp = 0;
    u.dead = true;
    if (isMe(f, u)) {
      const next = f.allies.find((a) => !a.dead);
      if (next) f.me = next;
    }
  }
}
const shake = (f: Field, amp: number) => {
  f.shake = C.shake.dur;
  f.shakeAmp = Math.max(f.shake > 0 ? f.shakeAmp : 0, amp);
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
  const crit = Math.random() < C.critChance;
  return { dmg: (u.power ?? 50) * C.dmgK * mult * (crit ? 2 : 1) * (u === f.me ? 1 : C.allyDmg), crit };
};

/** 기본 공격: 3단 콤보 (3단째 궤적 크게 · 넉백 2배) · 원거리 직업은 탄 */
export function attack(f: Field, u: Unit) {
  if (u.dead || (u.swing ?? 0) > 0 || (u.dodge ?? 0) > 0 || u.stun > 0) return;
  const stickDir = u === f.me && Math.hypot(f.stick.x, f.stick.y) > 0.2 ? norm(...screenToWorld(f.stick.x, f.stick.y)) : undefined;
  const t = aimTarget(f, u, RANGED.has(u.job!) ? 5 : 2.6, stickDir);
  if (t) faceTo(u, t);
  else if (stickDir) [u.ax, u.ay] = stickDir;
  // 직업별 기본 공격 (핫픽스 7): 빠르기·힘·사거리·부채꼴 폭이 다르다
  const J = C.jobAtk[u.job!] ?? C.jobAtk.knight;
  u.combo = (u.comboT ?? 0) > 0 ? ((u.combo ?? 0) % 3) + 1 : 1;
  u.comboT = Math.max(C.combo.window, J.swing + 0.3);
  u.swing = u.swingMax = J.swing;
  u.atkAnim = Math.min(0.2, J.swing);
  const third = u.combo === 3;
  const mult = C.combo.mult[u.combo - 1] * J.dmg;
  if (RANGED.has(u.job!)) {
    const sp = J.speed ?? 7;
    const kind = u.job === 'mage' ? 'bolt' : 'arrow';
    f.proj.push({ x: u.x, y: u.y, vx: u.ax * sp, vy: u.ay * sp, life: 5.6 / sp, dmg: mult, owner: u, kind, hit: new Set() });
    return;
  }
  // 근접: 앞쪽 부채꼴
  const range = J.range + (third ? 0.35 : 0);
  const arc = third ? Math.max(2.2, J.arc) : J.arc;
  f.fx.push({ kind: 'slash', x: u.x + u.ax * 0.35, y: u.y + u.ay * 0.35, ax: u.ax, ay: u.ay, t: 0, dur: 0.15, big: third, owner: u });
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
  u.cd![i] = C.skillCd[i];
  u.castAnim = 0.3;
  if (u === f.me) {
    f.castTxt = SKILL_NAMES[u.job!][i];
    f.castT = 0.6;
  }
  sfx('skill', { vol: u === f.me ? 1 : C.allyVol });
  const P = (mult: number) => powerHit(f, u, mult);
  const near = (r: number, cx = u.x, cy = u.y) => mobsAlive(f).filter((m) => Math.hypot(m.x - cx, m.y - cy) <= r + m.r);
  switch (`${u.job}${i}`) {
    case 'knight0': {
      // 방패 강타: 앞으로 짧게 돌진 · 기절 1초
      u.vx += u.ax * 9;
      u.vy += u.ay * 9;
      for (const m of near(1.6, u.x + u.ax, u.y + u.ay)) hurtMob(f, m, P(1.4).dmg, u, { stun: 1, knock: 1.5, silent: true });
      f.fx.push({ kind: 'slash', x: u.x + u.ax * 0.8, y: u.y + u.ay * 0.8, ax: u.ax, ay: u.ay, t: 0, dur: 0.18, big: true, owner: u });
      break;
    }
    case 'knight1':
      // 도발 함성: 주변 적이 나를 노림 · 3초 받는 피해 -40%
      u.taunt = 3;
      u.guard = 3;
      for (const m of near(3.5)) m.target = u;
      f.fx.push({ kind: 'ring', x: u.x, y: u.y, t: 0, dur: 0.5, r: 3, owner: u });
      break;
    case 'warrior0':
      f.fx.push({ kind: 'ring', x: u.x, y: u.y, t: 0, dur: 0.3, r: 1.4, owner: u });
      for (const m of near(1.4)) hurtMob(f, m, P(1.6).dmg, u, { crit: true, knock: 1.6, silent: true });
      break;
    case 'warrior1': {
      // 도약 내려찍기: 조준한 곳으로 점프
      const tg = t ?? { x: u.x + u.ax * 2, y: u.y + u.ay * 2 };
      u.x = tg.x - u.ax * 0.5;
      u.y = tg.y - u.ay * 0.5;
      f.fx.push({ kind: 'boom', x: u.x, y: u.y, t: 0, dur: 0.35, r: 1.3 });
      shake(f, 2);
      for (const m of near(1.3)) hurtMob(f, m, P(2).dmg, u, { knock: 1.8, silent: true });
      break;
    }
    case 'rogue0':
      // 그림자 찌르기: 적 등 뒤로 순간이동 후 치명타
      if (t) {
        f.fx.push({ kind: 'puff', x: u.x, y: u.y, t: 0, dur: 0.3 });
        u.x = t.x - t.ax * 0.55;
        u.y = t.y - t.ay * 0.55;
        faceTo(u, t);
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
      f.proj.push({ x: u.x, y: u.y, vx: u.ax * 6, vy: u.ay * 6, life: 0.9, dmg: 2.2, owner: u, kind: 'fire', hit: new Set() });
      break;
    case 'mage1': {
      // 점멸: 조이스틱 방향(없으면 적 반대쪽)으로 순간이동
      const d = stickDir ?? (t ? norm(u.x - t.x, u.y - t.y) : [u.ax, u.ay]);
      f.fx.push({ kind: 'puff', x: u.x, y: u.y, t: 0, dur: 0.3 });
      u.x += d[0] * 2.4;
      u.y += d[1] * 2.4;
      u.inv = 0.3;
      break;
    }
    case 'priest0': {
      // 치유의 빛: 나와 주변 아군 회복
      f.fx.push({ kind: 'heal', x: u.x, y: u.y, t: 0, dur: 0.6, r: 2.5 });
      for (const a of f.allies)
        if (!a.dead && dist(a, u) <= 2.5) {
          const h = Math.round(a.max * 0.3);
          a.hp = Math.min(a.max, a.hp + h);
          f.nums.push({ x: a.x, y: a.y, text: '+' + h * 10, crit: false, heal: true, t: 0, dx: 0 });
        }
      break;
    }
    case 'priest1':
      if (t) {
        f.fx.push({ kind: 'boom', x: t.x, y: t.y, t: 0, dur: 0.3, r: 0.7 });
        hurtMob(f, t, P(2.5).dmg, u, { stun: 0.6, crit: true, silent: true });
      }
      break;
    case 'hunter0':
      for (let k = 0; k < 3; k++) f.proj.push({ x: u.x - u.ax * k * 0.3, y: u.y - u.ay * k * 0.3, vx: u.ax * 8, vy: u.ay * 8, life: 0.7 + k * 0.05, dmg: 1, owner: u, kind: 'arrow', hit: new Set() });
      break;
    case 'hunter1':
      f.fx.push({ kind: 'trap', x: u.x + u.ax * 1.2, y: u.y + u.ay * 1.2, t: 0, dur: 6, r: 0.6, owner: u });
      break;
  }
}

/** 필살기: 케미 100% · 0.5초 멈추고 컷인 띠 → 전체 피해 */
export function ultimate(f: Field) {
  if (f.chem < 100 || f.ult > 0) return;
  f.chem = 0;
  f.ult = 0.5;
  const live = f.allies.filter((a) => !a.dead);
  let name = '합동기';
  for (const a of live) for (const b of live) if (a !== b && a.actor && b.actor && pairOf(a.actor, b.actor)) name = `${pairOf(a.actor, b.actor)!.name} · 합동기`;
  f.ultName = name;
  sfx('skill');
}
function ultHit(f: Field) {
  const sum = f.allies.filter((a) => !a.dead).reduce((s, a) => s + (a.power ?? 50), 0);
  shake(f, C.shake.boss);
  for (const m of mobsAlive(f)) {
    f.fx.push({ kind: 'boom', x: m.x, y: m.y, t: 0, dur: 0.4, r: 0.8 });
    hurtMob(f, m, (sum / 3) * C.dmgK * C.ultMult, f.me, { crit: true, knock: 2, silent: true });
  }
  sfx('crit');
}

// ───────── AI (동료 · AUTO) ─────────

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
    if (Math.random() < C.autoDodge) {
      f.stats.dodged++;
      const [nx, ny] = norm(u.x - m.tele.x, u.y - m.tele.y);
      dodge(f, u, [nx, ny]);
      return;
    }
  }
  // 힐러: 체력 50% 아래 아군을 치유
  if (u.role === 'heal' && u.cd![0] <= 0 && f.allies.some((a) => !a.dead && a.hp < a.max * 0.5 && dist(a, u) < 3.5)) return skill(f, u, 0);
  const t = aimTarget(f, u, 9);
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
  const ranged = RANGED.has(u.job!) || u.role === 'heal';
  let gx = t.x;
  let gy = t.y;
  if (u.role === 'dps' && !ranged) {
    // 딜러: 적의 등 뒤로
    gx = t.x - t.ax * 0.6;
    gy = t.y - t.ay * 0.6;
  }
  const want = ranged ? 2.6 : 0.85;
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
function moveToward(_f: Field, u: Unit, x: number, y: number, dt: number) {
  const [nx, ny] = norm(x - u.x, y - u.y);
  // 화면 속도로 맞춘 이동 속도 (가로·세로 고르게)
  const sp = C.move * 0.75;
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
  const taunter = allies.find((a) => (a.taunt ?? 0) > 0 && dist(a, m) < 4);
  if (taunter) m.target = taunter;
  if (!m.target || m.target.dead) m.target = allies.sort((a, b) => dist(a, m) - dist(b, m))[0];
  const t = m.target;
  // 예고는 조금 먼 데서부터 (넉백에 밀려도 공격이 나온다)
  const reach = m.mon === 'slime' ? 1.25 : 1.15;
  switch (m.st) {
    case 'move': {
      const d = dist(m, t);
      if (d <= reach) {
        faceTo(m, t);
        m.st = 'tele';
        m.stT = C.tele;
        const off = m.mon === 'slime' ? 0.85 : 0.75;
        m.tele = { x: m.x + m.ax * off, y: m.y + m.ay * off, r: m.mon === 'slime' ? 0.62 : 0.72 };
        return;
      }
      const [nx, ny] = norm(t.x - m.x, t.y - m.y);
      // 슬라임은 통통 튀며 (빠르기 출렁)
      const hop = m.mon === 'slime' ? 0.45 + Math.max(0, Math.sin(m.t * 6)) * 1.1 : 1;
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
        // 슬라임: 몸통 박치기 (앞으로 튀어 나간다)
        if (m.mon === 'slime') {
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

// ───────── 한 걸음 ─────────

export function step(f: Field, dt: number) {
  // 화면 흔들림 · 숫자 · 연기는 히트스톱 중에도 흐른다
  f.shake = Math.max(0, f.shake - dt);
  f.castT = Math.max(0, f.castT - dt);
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
    if (u.team === 'ally') {
      for (const k of ['swing', 'comboT', 'dodgeCd', 'inv', 'taunt', 'guard', 'atkAnim', 'castAnim', 'hurtT'] as const) u[k] = Math.max(0, (u[k] ?? 0) - dt);
      u.cd = [Math.max(0, u.cd![0] - dt), Math.max(0, u.cd![1] - dt)];
      if ((u.dodge ?? 0) > 0) {
        u.dodge! -= dt;
        const sp = C.dodge.dist / C.dodge.dur;
        u.x += u.ax * sp * dt * 0.62;
        u.y += u.ay * sp * dt * 0.62;
        u.moving = true;
      } else if (u.stun <= 0) {
        if (u === f.me && !f.auto) {
          const m = Math.hypot(f.stick.x, f.stick.y);
          if (m > 0.15) {
            const [wx, wy] = screenToWorld(f.stick.x, f.stick.y);
            const [nx, ny] = norm(wx, wy);
            // 화면에서 같은 빠르기: 세로로 갈 때 월드 거리가 더 길다
            const scr = Math.hypot(screenDx(nx, ny), ((nx + ny) * TH) / 2) || 1;
            const sp = (C.move * 16 * Math.min(1, m)) / scr;
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
  // 덫: 밟은 적 2초 묶기
  for (const fx of f.fx)
    if (fx.kind === 'trap')
      for (const m of mobsAlive(f))
        if (Math.hypot(m.x - fx.x, m.y - fx.y) < (fx.r ?? 0.6)) {
          m.rooted = 2;
          fx.t = fx.dur;
          hurtMob(f, m, (fx.owner?.power ?? 50) * C.dmgK, fx.owner ?? f.me, { silent: true, knock: 0 });
        }
  stepFx(f, dt);
  // 다음 웨이브 · 끝
  if (f.waveLeft <= 0 && !f.units.some((u) => u.team === 'mob' && !u.dead)) {
    if (f.wave >= C.waves) end(f, 'win');
    else spawnWave(f);
  }
  if (!f.allies.some((a) => !a.dead) || f.time <= 0) end(f, 'lose');
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
}

function end(f: Field, r: 'win' | 'lose') {
  if (f.done) return;
  f.done = r;
  f.doneT = 0;
  sfx(r);
}

/** 평가: S = 맞은 횟수 3번 이하 + 제한 시간 60% 안 · A = 8번 이하 · 그 밖 B */
export function grade(f: Field): 'S' | 'A' | 'B' {
  const G = C.grade;
  const used = C.timeLimit - f.time;
  if (f.hitsTaken <= G.sHits && used <= C.timeLimit * G.sTime) return 'S';
  if (f.hitsTaken <= G.aHits) return 'A';
  return 'B';
}
