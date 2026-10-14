// 토벌전 (3단계 1~5장): 주간 보스(월요일 교체, 체력 누적) · 떠돌이 보스(원정에서 만남, CONFIG wanderHours) · 하루 도전(triesMax) · 소탕 · 보상 · PACE §1 연속 토벌(도전장)·주 후반 약해짐
import { BOSSES, bossById, RAID_BOSSES, type BossDef } from '../data/bosses';
import { markAdventured } from './actors';
import { pioneerRaidMult } from './easter';
import { fiveGold, fiveRaidKill } from './fivestars';
import { hfx } from './harmony';
import { CONFIG } from '../data/config';
import { josa } from '../data/josa';
import { REGIONS, type RegionId } from '../data/items';
import { submitRecord as submitOnline } from '../net/sync';
import { gainXp, powerOf } from './adventurers';
import { partyChemMult } from './chem';
import { queueEvent } from './events';
import { partyEligible, regionUnlocked } from './expeditions';
import { addRep, today, track } from './progress';
import { legendHooks, markDirty, P, S, uiHooks, world, type Actor, type RaidRecord } from './state';
import { addEmber, ownerGain, raidDmgMult, tieRaid } from './owner';
import { feature } from './guide';
import { track as trackEv } from '../net/telemetry';
import { addCharm } from './growth';
import { rollUnique } from './uniques';
import { partySynMult, synDamageMult, synergyFx } from './synergy';
import { roleMult } from './party';
import type { Item } from './state';
import { stripWind, windRaid } from './wind';
import { flag } from './flags';
import { gatesOn, queueRankWeek, wanderMet, wanderPity } from './paceGates';
import { perkRaidMats, perkRaidTries } from './bundlePerks';
import { petRaidDmg, petTry } from './pets';
import { raidFrags } from './exWeapons';
import { burnMats, burnRaidTries } from './burn';

const R = CONFIG.raid;
const homeActors = () => world.home?.actors ?? world.actors;
const regionIdx = (r: RegionId) => REGIONS.findIndex((x) => x.id === r);

// ───────── 주간 보스 ─────────

/** 이번 주 월요일 (현실 날짜, 'YYYY-M-D') */
export function mondayKey(d = new Date()): string {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${m.getFullYear()}-${m.getMonth() + 1}-${m.getDate()}`;
}
const weekIndex = () => {
  const [y, mo, da] = mondayKey().split('-').map(Number);
  return Math.round(new Date(y, mo - 1, da).getTime() / (7 * 864e5));
};

/** 열린 지역의 토벌 보스 (REGIONS2: 별을 삼킨 것은 넣지 않는다 — 엔딩 전용) */
const openBosses = () => RAID_BOSSES.filter((b) => regionUnlocked(regionIdx(b.region)));

/** 이번 주 보스: 열린 지역의 보스 중에서 주마다 돌아가며 */
function pickWeekly(): BossDef {
  const open = openBosses();
  const list = open.length ? open : [BOSSES[0]];
  return list[weekIndex() % list.length];
}

/** 주가 바뀌었으면 새 보스 (체력 가득) */
export function ensureWeek(): boolean {
  const wk = mondayKey();
  if (P.raid.week === wk && bossById(P.raid.bossId)) return false;
  const b = pickWeekly();
  if (P.raid.week && P.raid.week !== wk) {
    P.raid.prevWeek = P.raid.week;
    // PACE R17: 기록을 낸 주는 순위 확인 목록에 (온라인일 때 놓친 주까지 확인 · 진 소문)
    if (P.raid.best > 0) queueRankWeek(P.raid.week);
  }
  Object.assign(P.raid, { week: wk, bossId: b.id, hpLeft: b.hp, killed: false, best: 0, joined: false, alarmed: false, chainN: 1, chainKilled: [], weak: 0, tiredSaid: false });
  markDirty();
  return true;
}

// ───────── PACE §1 raidPace: 연속 토벌 · 도전장 · 주 후반 약해짐 ─────────

export const pace = () => flag('raidPace');
/** 하루 도전 (플래그 끄면 예전 3) */
/** LUXE §3 토벌 전리품 완성: +1 */
/** RAIDWEAPON §6 버닝 주말: +1 (기간 중만 · 서버 시각) */
export const triesMax = () => (pace() ? R.triesPerDay : R.paceOff.triesPerDay) + perkRaidTries() + burnRaidTries();
/** 이번 주 몇 번째 보스 (1부터 · 옛 저장 = 1) */
export const chainN = () => Math.max(1, P.raid.chainN || 1);
/** 이번 주 잡은 보스 (옛 저장: 지금 보스를 잡았으면 그것 하나) */
export function chainDone(): string[] {
  const l = Array.isArray(P.raid.chainKilled) ? P.raid.chainKilled : [];
  return P.raid.killed && P.raid.bossId && !l.includes(P.raid.bossId) ? [...l, P.raid.bossId] : l;
}
/** n번째 보스 보상 배수 (금화·재료) */
export const chainMult = (n = chainN()) => (pace() ? R.chainMult[Math.min(R.chainMult.length, Math.max(1, n)) - 1] ?? 1 : 1);
/** 도전장 후보: 지금 보스를 잡았고 · 이번 주 chainMax 미만 · 열린 지역 보스 중 이번 주 아직 안 잡은 것 */
export function challengeChoices(): BossDef[] {
  if (!pace()) return [];
  ensureWeek();
  if (!P.raid.killed || chainN() >= R.chainMax) return [];
  const done = chainDone();
  return openBosses().filter((b) => !done.includes(b.id));
}
/** 도전장 고르기: 그 보스가 이번 주 다음 보스로 (체력 가득) */
export function pickChallenge(id: string): boolean {
  const b = challengeChoices().find((x) => x.id === id);
  if (!b) return false;
  P.raid.chainKilled = chainDone();
  P.raid.chainN = chainN() + 1;
  Object.assign(P.raid, { bossId: b.id, hpLeft: b.hp, killed: false });
  trackEv('raid_chain', { boss: b.id, n: P.raid.chainN });
  markDirty();
  return true;
}
/** 토벌 창 맨 위 한 줄: 「이번 주 1/3 · 다음: 도전장 고르기」 (플래그 끔이면 '') */
export function chainLine(): string {
  if (!pace()) return '';
  ensureWeek();
  const n = chainN();
  const all = n >= R.chainMax && P.raid.killed;
  const more = n < R.chainMax && openBosses().some((b) => !chainDone().includes(b.id) && b.id !== P.raid.bossId);
  const next = all ? '모두 처치! 월요일에 새 보스' : n >= R.chainMax ? '이번 주 마지막 보스' : more ? '다음: 도전장 고르기' : '다음 보스는 지역을 더 열면';
  return `이번 주 ${n}/${R.chainMax} · ${next}`;
}

const KST = 9 * 36e5;
/** 이번 주 지금까지 지난 약해짐 단계 수 (한국 시간 목 0시 · 토 0시) */
export function weakDue(t = Date.now()): number {
  const dow = new Date(t + KST).getUTCDay();
  const ord = (d: number) => (d === 0 ? 7 : d);
  return R.weakDays.filter((d) => ord(dow) >= ord(d)).length;
}
/** 첫 보스가 아직 살아 있으면 주 후반에 남은 체력 −25% (단계마다 한 번) · 마을 경보 한 줄 (주에 한 번) */
export function tireBoss(t = Date.now()): boolean {
  if (!pace() || chainN() !== 1 || P.raid.killed || P.raid.hpLeft <= 0) return false;
  const due = weakDue(t);
  const w = P.raid.weak ?? 0;
  if (due <= w) return false;
  for (let i = w; i < due; i++) P.raid.hpLeft = Math.max(1, Math.round(P.raid.hpLeft * (1 - R.weakStep)));
  P.raid.weak = due;
  markDirty();
  trackEv('raid_tired', { boss: P.raid.bossId, step: due });
  return true;
}
function sayTired() {
  if (P.raid.tiredSaid || !(P.raid.weak ?? 0) || P.raid.killed) return;
  P.raid.tiredSaid = true;
  const b = bossById(P.raid.bossId);
  markDirty();
  queueEvent(() => {
    uiHooks.talk([['narr', `「${b?.name ?? '보스'}」${josa(b?.name ?? '보스', '가')} 지쳐 보여요… 남은 체력이 줄었어요. 지금이 기회!`]]);
  }, 'tired' + P.raid.week);
}

function ensureDay() {
  if (P.raid.day === today()) return;
  P.raid.day = today();
  P.raid.tries = 0;
}
export const triesLeft = () => {
  ensureDay();
  return Math.max(0, triesMax() - P.raid.tries);
};

/** HOTFIX17 §2: 토벌 한 판 = 시작할 때 도전 1 차감 + 판 번호. 남은 도전이 없으면 null */
export function beginRaid(): number | null {
  ensureDay();
  if (P.raid.tries >= triesMax()) return null;
  P.raid.tries = Math.min(triesMax(), P.raid.tries + 1);
  if (burnRaidTries() && P.raid.tries > triesMax() - burnRaidTries()) P.raid.burnDay = P.raid.day;
  P.raid.runSeq = (P.raid.runSeq ?? 0) + 1;
  markDirty();
  return P.raid.runSeq;
}
/** 시작했다가 판이 열리지 못했을 때 (정산 전이면 차감을 되돌린다) */
export function cancelRaid(runId: number) {
  if (P.raid.lastSettled === runId || P.raid.runSeq !== runId) return;
  P.raid.tries = Math.max(0, P.raid.tries - 1);
  P.raid.lastSettled = runId;
  markDirty();
}
/** HOTFIX17 §2 복구: 이번 패치에서 한 번, 오늘 토벌 도전 횟수를 돌려준다 (그 뒤로도 하루 한도를 넘은 저장은 바로잡기) */
export function repairRaidTries() {
  ensureDay();
  if (!P.raid.fix17) {
    P.raid.fix17 = true;
    P.raid.tries = 0;
    markDirty();
  } else if (P.raid.tries > triesMax() + (P.raid.burnDay === P.raid.day ? CONFIG.burn.raidTries : 0)) P.raid.tries = triesMax() - 1;
}
let lastOut: RaidOutcome | null = null;

/** 이번 주 보스 경보 (그 주에 처음 마을이 돌아갈 때 한 번): 화면 흔들림 + 대화창 */
export function maybeAlarm() {
  // 5단계: 토벌전은 장부 4장에 열린다 (예전 저장은 그대로)
  if (!S.started || S.visiting || !feature('raid')) return;
  ensureWeek();
  // PACE §1-4: 주 후반 약해짐 (경보 대화는 이번 주 첫 경보 뒤에)
  tireBoss();
  if (P.raid.alarmed) return sayTired();
  P.raid.alarmed = true;
  const b = bossById(P.raid.bossId)!;
  markDirty();
  queueEvent(() => {
    uiHooks.shake();
    uiHooks.talk([
      ['narr', '마을 밖 숲이 술렁인다…'],
      ['narr', b.alarm],
      ['narr', `이번 주 토벌: 「${b.name}」 · 권장 전투력 ${b.power.toLocaleString('ko-KR')} · 체력은 주간 동안 이어서 깎여요.`],
    ]);
  }, 'alarm' + P.raid.week);
}

// ───────── 도전 대상 ─────────

export interface RaidTarget {
  kind: 'weekly' | 'wander';
  boss: BossDef;
  hpLeft: number;
  max: number;
  /** PACE §1: 이번 주 몇 번째 보스 (주간만 · 2·3번째는 도전장 보스 — 랭킹 X · 보상 배수) */
  chain?: number;
}

export function weeklyTarget(): RaidTarget {
  ensureWeek();
  tireBoss();
  const b = bossById(P.raid.bossId)!;
  return { kind: 'weekly', boss: b, hpLeft: P.raid.hpLeft, max: b.hp, chain: chainN() };
}
export function wanderTarget(): RaidTarget | null {
  const w = P.raid.wander;
  if (!w || Date.now() > w.until || w.hpLeft <= 0) return null;
  const b = bossById(w.bossId);
  return b ? { kind: 'wander', boss: b, hpLeft: w.hpLeft, max: w.max } : null;
}

/** 원정 승리 때: 그 지역 보스를 떠돌이로 만날 수도 (wanderHours) */
export function maybeWander(region: RegionId, chanceMult = 1): BossDef | null {
  // PACE §1-3: 0.08 → 0.15 · 24 → 48시간 (플래그 끄면 예전 값)
  const W = pace() ? R : R.paceOff;
  // PACE R17 떠돌이 천장: 같은 지역 원정 승리 n번째엔 확정 (paceGates · 떠돌이가 이미 있으면 다음 기회로)
  const sure = wanderPity(region);
  if (wanderTarget() || (!sure && Math.random() >= W.wanderChance * chanceMult)) return null;
  const b = RAID_BOSSES.find((x) => x.region === region);
  if (!b) return null;
  wanderMet(region);
  const max = Math.round(b.hp * R.wanderHpShare);
  P.raid.wander = { bossId: b.id, until: Date.now() + W.wanderHours * 36e5, hpLeft: max, max };
  markDirty();
  return b;
}

// ───────── 파티 · 기대 피해량 ─────────

/** 토벌에 갈 수 있는 손님 (단골·영웅·전설, 원정 중 아님, 체력 30 이상) · J6 partyRulesV2: 방문 중인 전설(동행)도 */
export const raidCrew = () =>
  homeActors().filter(
    (a) => !a.role && !a.leaving && (a.status === 'regular' || a.status === 'hero' || (flag('partyRulesV2') && partyEligible(a))) && a.runId == null && a.hp >= CONFIG.expedition.minHp,
  );

export interface RaidExpect {
  power: number;
  chem: number;
  affinity: number;
  /** 자동 전투 기대 피해량 */
  target: number;
  /** 이론상 최대 (랭킹 기록 상한 = 이론치 × recordCap) */
  theory: number;
  /** 보스가 파티를 때리는 세기 (권장 ÷ 전투력) */
  danger: number;
}

const affinityOf = (a: Actor, b: BossDef) => (b.weak.includes(a.kind as never) ? R.weakMult : b.resist.includes(a.kind as never) ? R.resistMult : 1);

/**
 * 기대 피해 — PARTY §2: 조합 보너스(역할 +10% · 공격 + · 한 우물 · 치명타 · 보스 피해 · 스킬 대기)를 포함한다.
 *  필드 전투에서 실제로 더 들어가는 만큼 기대치도 올려서, 조합 덕에 S/A가 쉬워지지 않게 · §3: 4명이면 4명 기준 (사람 수만큼 더한다)
 */
export function expectOf(members: Actor[], b: BossDef): RaidExpect {
  const pw = members.map((m) => powerOf(m));
  const fx = synergyFx(members);
  const synM = partySynMult(members, pw, fx) * roleMult(members);
  const power = pw.reduce((s, v) => s + v, 0) * synM;
  const chem = partyChemMult(members);
  const raw = pw.reduce((s, v) => s + v, 0);
  const affinity = raw ? members.reduce((s, m, i) => s + pw[i] * affinityOf(m, b), 0) / raw : 1;
  // 4단계: 전사 출신 토벌 피해 +5%
  const base = power * R.seconds * R.dmgPerPowerSec * chem * raidDmgMult() * (1 + hfx('dmg') + hfx('raidDmg')) * synDamageMult(fx) * windRaid();
  return {
    power: Math.round(power * chem),
    chem,
    affinity,
    target: Math.round(base * affinity),
    theory: Math.round(base * R.weakMult),
    danger: Math.max(0.4, Math.min(3, b.power / Math.max(1, power * chem))),
  };
}

export function rankOf(damage: number, target: number, kill?: { killed: boolean; secs?: number }): 'S' | 'A' | 'B' | 'C' {
  let r = damage / Math.max(1, target);
  // 토벌 등급 버그: 일찍 처치할수록 피해가 60초 기대치보다 적다 → 처치하면 걸린 시간으로 보정(60 ÷ 걸린 초) · 최소 A
  if (kill?.killed) {
    r *= R.seconds / Math.max(R.killMinSecs, Math.min(R.seconds, kill.secs ?? R.seconds));
    return r >= R.rankS ? 'S' : 'A';
  }
  return r >= R.rankS ? 'S' : r >= R.rankA ? 'A' : r >= R.rankB ? 'B' : 'C';
}

// ───────── 결과 정산 ─────────

export interface RaidOutcome {
  damage: number;
  applied: number;
  killed: boolean;
  firstKill: boolean;
  rank: 'S' | 'A' | 'B' | 'C';
  gold: number;
  mats: number;
  xp: number;
  token: boolean;
  /** GROWTH §3-3: 주간 참여 보상 강화 보호 부적 · §3-4 처치 1% 고유 장비 */
  charm?: boolean;
  items?: Item[];
  personalBest: boolean;
  weekBest: boolean;
  /** PACE §1: 이번 주 몇 번째 보스 · 금화·재료 배수 */
  chain?: number;
  mult?: number;
  record?: { ok: boolean; reason?: string };
  /** RAIDWEAPON §2: 받은 무기 조각 (주간 토벌 처치) */
  frags?: number;
}

export function settle(t: RaidTarget, members: Actor[], damage: number, mode: 'auto' | 'manual' | 'sweep', ex: RaidExpect, runId: number, secs?: number): RaidOutcome {
  // HOTFIX17 §2: 같은 판을 두 번 정산하지 않는다 (도전 차감은 시작 때 beginRaid)
  if (P.raid.lastSettled === runId && lastOut) {
    trackEv('raid_settle', { runId, dup: true, mode });
    return lastOut;
  }
  P.raid.lastSettled = runId;
  const b = t.boss;
  // LUXE §2 꼬마 텐구(꺼내 둔 펫): 토벌 피해 +2% (소탕은 그대로 · 랭킹 기록은 부르는 쪽 원래 피해)
  damage = Math.max(0, Math.round(mode === 'sweep' ? damage : damage * petRaidDmg()));
  const applied = Math.min(damage, t.hpLeft);
  let killed = false;
  // PACE §1: 이번 주 n번째 보스 (2·3번째 = 도전장 · 금화·재료 배수 · 랭킹 X)
  const chain = t.kind === 'weekly' ? chainN() : 1;
  const cm = t.kind === 'weekly' ? chainMult(chain) : 1;
  if (t.kind === 'weekly') {
    P.raid.hpLeft = Math.max(0, P.raid.hpLeft - applied);
    killed = P.raid.hpLeft <= 0 && !P.raid.killed;
    if (killed) {
      P.counters.raidKills = (P.counters.raidKills ?? 0) + 1;
      P.raid.killed = true;
      // 「주간 보스를 잡은 주」는 첫 보스만 (도전장 보스는 같은 주라 다시 안 센다)
      if (chain === 1) P.raid.weeksKilled++;
      const l = Array.isArray(P.raid.chainKilled) ? P.raid.chainKilled : [];
      if (!l.includes(b.id)) l.push(b.id);
      P.raid.chainKilled = l;
    }
  } else if (P.raid.wander) {
    P.raid.wander.hpLeft = Math.max(0, P.raid.wander.hpLeft - applied);
    killed = P.raid.wander.hpLeft <= 0;
    if (killed) {
      P.raid.wander = null;
      // PACE §1-3: 떠돌이 처치도 장부 「토벌 보스 처치하기」로 센다
      P.raid.wanderKills = (P.raid.wanderKills ?? 0) + 1;
      // PACE R17: 신화 엘리시아 「토벌 보스 3」에도 떠돌이 처치를 셈 (paceGates)
      if (gatesOn()) P.counters.raidKills = (P.counters.raidKills ?? 0) + 1;
    }
  }
  // FIVESTARS 웅스 부탁: +12 장비 2개 낀 파티로 토벌 보스 처치
  if (killed) fiveRaidKill(members);
  // RAIDWEAPON §2: 주간 토벌 처치 = 무기 조각 (첫 보스 1 · 연속 2·3번째 50% 1 · 떠돌이 X · 꺼져 있으면 0)
  const frags = killed && t.kind === 'weekly' ? raidFrags(chain) : 0;
  const firstKill = killed && !P.raid.firstKills.includes(b.id);
  if (killed) P.raid.kills[b.id] = (P.raid.kills[b.id] ?? 0) + 1;
  if (firstKill) {
    P.raid.firstKills.push(b.id);
    P.trophies.push(b.id);
    if (!P.titles.includes(b.title)) P.titles.push(b.title);
  }
  const rank = mode === 'sweep' ? 'B' : rankOf(damage, ex.target, { killed, secs });
  trackEv('raid_end', { boss: b.id, dmg: damage, mode });
  // 보상: 깎은 체력만큼 (실패해도) + 처치 보너스
  const ratio = damage / Math.max(1, b.power * R.seconds * R.dmgPerPowerSec);
  // EASTER: 붉은 무사의 투구 — 토벌 금화 +3%
  // PARTY §2: 뒷골목 싸움 금화 +8%
  // PACE §1: 도전장 보스는 금화·재료 ×chainMult (고유 장비 확률·장부·업적·전설 카운트는 그대로)
  const gold = Math.round((b.gold * ratio + (killed ? b.gold * R.killGoldMult : 0)) * pioneerRaidMult() * (1 + synergyFx(members).gold) * cm * fiveGold(members));
  const mats0 = 1 + { S: 3, A: 2, B: 1, C: 0 }[rank] + (killed ? R.killMats : 0);
  // LUXE §3 토벌 전리품 완성: 재료 +10% (소수점 이월)
  // RAIDWEAPON §6 버닝: 토벌 재료 ×1.5
  const mats = burnMats(perkRaidMats(cm === 1 ? mats0 : Math.max(1, Math.round(mats0 * cm))));
  const xp = Math.round(30 * (regionIdx(b.region) + 1) * 2 * Math.min(2, ratio));
  S.gold += gold;
  S.ledger.dungeon += gold;
  P.counters.goldTotal += gold;
  P.bossMats[b.id] = (P.bossMats[b.id] ?? 0) + mats;
  for (const m of members) {
    gainXp(m, xp);
    m.hp = Math.max(1, m.hp - R.hpCost);
  }
  markAdventured(members);
  // 이번 주 참여 보상: 인연의 증표 1개
  let token = false;
  let charm = false;
  if (!P.raid.joined && t.kind === 'weekly') {
    P.raid.joined = true;
    P.tokens++;
    token = true;
    addCharm(1);
    charm = true;
  }
  const items: Item[] = [];
  if (killed) {
    // PACE R17: 같은 보스 첫 처치는 고유 장비 확정 (paceGates)
    const u = rollUnique(b.region, firstKill && gatesOn() ? 1 : CONFIG.growth.unique.raid);
    if (u) items.push(u);
  }
  let personalBest = false;
  let weekBest = false;
  if (mode !== 'sweep') {
    personalBest = damage > P.raid.personalBest;
    if (personalBest) {
      if (P.raid.personalBest > 0) legendHooks.req('raidPersonalBest');
      P.raid.personalBest = damage;
    }
    // 이번 주 최고(랭킹 기준)는 첫 보스만
    if (t.kind === 'weekly' && chain === 1 && damage > P.raid.best) {
      P.raid.best = damage;
      weekBest = true;
    }
    if (mode === 'manual' && rank === 'S') legendHooks.req('raidRankS');
  }
  legendHooks.bond('raidTry');
  legendHooks.req('goldEarned', gold);
  // 4단계: 함께 싸운 영웅·전설 인연 + · 주인 담력 · 직접 조작은 불씨 +
  if (mode !== 'sweep') {
    P.counters.raidTries++;
    // LUXE §2 펫: 토벌 도전 = 꼬마 텐구 시도 1
    petTry('raid');
    tieRaid(members);
    ownerGain('raid');
    if (mode === 'manual') {
      ownerGain('raidManual');
      addEmber(CONFIG.ember.raidManual);
    }
  }
  if (killed) {
    addRep(10);
    // 서버 [알림]은 첫 처치만 (그 뒤는 내 화면에만)
    uiHooks.announce(`★ ${S.innName || '여관'}${josa(S.innName || '여관', '가')} 「${b.name}」${josa(b.name, '를')} 쓰러뜨렸습니다!`, firstKill ? 'boss_kill' : undefined, b.name);
  }
  track('expeditionWin');
  markDirty();
  lastOut = { damage, applied, killed, firstKill, rank, gold, mats, xp, token, charm, items, personalBest, weekBest, chain, mult: cm, ...(frags ? { frags } : {}) };
  return lastOut;
}

/** 랭킹용 기록 (주간 보스, 직접·자동 한 판만). 2차에서 서버로 · PACE §1: 첫 보스만 (도전장 보스는 안 올린다) */
export async function submitRecord(t: RaidTarget, damage: number, mode: 'auto' | 'manual', ex: RaidExpect): Promise<{ ok: boolean; reason?: string; online: boolean; noWind?: boolean; chain?: boolean }> {
  if (t.kind !== 'weekly') return { ok: true, online: false };
  if ((t.chain ?? 1) > 1) return { ok: true, online: false, chain: true };
  // v0.24.2: 「전쟁의 소문」 바람 보정은 주간 랭킹 기록에서 뺀다 (전투에선 그대로)
  const wm = flag('raidNoWind') ? windRaid() : 1;
  const v = wm !== 1 ? stripWind(damage, ex.theory, wm) : { damage, theory: ex.theory };
  const rec: RaidRecord = { week: P.raid.week, bossId: t.boss.id, damage: v.damage, power: ex.power, theory: v.theory, mode, at: Date.now() };
  const r = await submitOnline(rec);
  return wm !== 1 ? { ...r, noWind: true } : r;
}

/** 소탕: 한 번 처치한 보스는 결과만 바로 받기 (자동 기대 피해량 그대로) */
export const canSweep = (b: BossDef) => (P.raid.kills[b.id] ?? 0) > 0;

/** 이번 주 누적 처치 비율 */
export const weekPct = () => {
  const t = weeklyTarget();
  return 1 - t.hpLeft / t.max;
};
