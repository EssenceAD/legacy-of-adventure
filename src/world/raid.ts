// 토벌전 (3단계 1~5장): 주간 보스(월요일 교체, 체력 누적) · 떠돌이 보스(원정에서 만남, 24시간) · 하루 3번 · 소탕 · 보상
import { BOSSES, bossById, type BossDef } from '../data/bosses';
import { CONFIG } from '../data/config';
import { josa } from '../data/josa';
import { REGIONS, type RegionId } from '../data/items';
import { submitRecord as submitOnline } from '../net/sync';
import { gainXp, powerOf } from './adventurers';
import { partyChemMult } from './chem';
import { queueEvent } from './events';
import { regionUnlocked } from './expeditions';
import { addRep, today, track } from './progress';
import { legendHooks, markDirty, P, S, uiHooks, world, type Actor, type RaidRecord } from './state';
import { addEmber, ownerGain, raidDmgMult, tieRaid } from './owner';

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

/** 이번 주 보스: 열린 지역의 보스 중에서 주마다 돌아가며 */
function pickWeekly(): BossDef {
  const open = BOSSES.filter((b) => regionUnlocked(regionIdx(b.region)));
  const list = open.length ? open : [BOSSES[0]];
  return list[weekIndex() % list.length];
}

/** 주가 바뀌었으면 새 보스 (체력 가득) */
export function ensureWeek(): boolean {
  const wk = mondayKey();
  if (P.raid.week === wk && bossById(P.raid.bossId)) return false;
  const b = pickWeekly();
  if (P.raid.week && P.raid.week !== wk) P.raid.prevWeek = P.raid.week;
  Object.assign(P.raid, { week: wk, bossId: b.id, hpLeft: b.hp, killed: false, best: 0, joined: false, alarmed: false });
  markDirty();
  return true;
}

function ensureDay() {
  if (P.raid.day === today()) return;
  P.raid.day = today();
  P.raid.tries = 0;
}
export const triesLeft = () => {
  ensureDay();
  return R.triesPerDay - P.raid.tries;
};

/** 이번 주 보스 경보 (그 주에 처음 마을이 돌아갈 때 한 번): 화면 흔들림 + 대화창 */
export function maybeAlarm() {
  if (!S.started || S.visiting) return;
  ensureWeek();
  if (P.raid.alarmed) return;
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
}

export function weeklyTarget(): RaidTarget {
  ensureWeek();
  const b = bossById(P.raid.bossId)!;
  return { kind: 'weekly', boss: b, hpLeft: P.raid.hpLeft, max: b.hp };
}
export function wanderTarget(): RaidTarget | null {
  const w = P.raid.wander;
  if (!w || Date.now() > w.until || w.hpLeft <= 0) return null;
  const b = bossById(w.bossId);
  return b ? { kind: 'wander', boss: b, hpLeft: w.hpLeft, max: w.max } : null;
}

/** 원정 승리 때: 그 지역 보스를 떠돌이로 만날 수도 (24시간) */
export function maybeWander(region: RegionId): BossDef | null {
  if (wanderTarget() || Math.random() >= R.wanderChance) return null;
  const b = BOSSES.find((x) => x.region === region);
  if (!b) return null;
  const max = Math.round(b.hp * R.wanderHpShare);
  P.raid.wander = { bossId: b.id, until: Date.now() + R.wanderHours * 36e5, hpLeft: max, max };
  markDirty();
  return b;
}

// ───────── 파티 · 기대 피해량 ─────────

/** 토벌에 갈 수 있는 손님 (단골·영웅·전설, 원정 중 아님, 체력 30 이상) */
export const raidCrew = () =>
  homeActors().filter((a) => !a.role && !a.leaving && (a.status === 'regular' || a.status === 'hero') && a.runId == null && a.hp >= CONFIG.expedition.minHp);

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

export function expectOf(members: Actor[], b: BossDef): RaidExpect {
  const pw = members.map((m) => powerOf(m));
  const power = pw.reduce((s, v) => s + v, 0);
  const chem = partyChemMult(members);
  const affinity = power ? members.reduce((s, m, i) => s + pw[i] * affinityOf(m, b), 0) / power : 1;
  // 4단계: 전사 출신 토벌 피해 +5%
  const base = power * R.seconds * R.dmgPerPowerSec * chem * raidDmgMult();
  return {
    power: Math.round(power * chem),
    chem,
    affinity,
    target: Math.round(base * affinity),
    theory: Math.round(base * R.weakMult),
    danger: Math.max(0.4, Math.min(3, b.power / Math.max(1, power * chem))),
  };
}

export function rankOf(damage: number, target: number): 'S' | 'A' | 'B' | 'C' {
  const r = damage / Math.max(1, target);
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
  personalBest: boolean;
  weekBest: boolean;
  record?: { ok: boolean; reason?: string };
}

export function settle(t: RaidTarget, members: Actor[], damage: number, mode: 'auto' | 'manual' | 'sweep', ex: RaidExpect): RaidOutcome {
  ensureDay();
  P.raid.tries++;
  const b = t.boss;
  damage = Math.max(0, Math.round(damage));
  const applied = Math.min(damage, t.hpLeft);
  let killed = false;
  if (t.kind === 'weekly') {
    P.raid.hpLeft = Math.max(0, P.raid.hpLeft - applied);
    killed = P.raid.hpLeft <= 0 && !P.raid.killed;
    if (killed) {
      P.raid.killed = true;
      P.raid.weeksKilled++;
    }
  } else if (P.raid.wander) {
    P.raid.wander.hpLeft = Math.max(0, P.raid.wander.hpLeft - applied);
    killed = P.raid.wander.hpLeft <= 0;
    if (killed) P.raid.wander = null;
  }
  const firstKill = killed && !P.raid.firstKills.includes(b.id);
  if (killed) P.raid.kills[b.id] = (P.raid.kills[b.id] ?? 0) + 1;
  if (firstKill) {
    P.raid.firstKills.push(b.id);
    P.trophies.push(b.id);
    if (!P.titles.includes(b.title)) P.titles.push(b.title);
  }
  const rank = mode === 'sweep' ? 'B' : rankOf(damage, ex.target);
  // 보상: 깎은 체력만큼 (실패해도) + 처치 보너스
  const ratio = damage / Math.max(1, b.power * R.seconds * R.dmgPerPowerSec);
  const gold = Math.round(b.gold * ratio + (killed ? b.gold * R.killGoldMult : 0));
  const mats = 1 + { S: 3, A: 2, B: 1, C: 0 }[rank] + (killed ? R.killMats : 0);
  const xp = Math.round(30 * (regionIdx(b.region) + 1) * 2 * Math.min(2, ratio));
  S.gold += gold;
  S.ledger.dungeon += gold;
  P.counters.goldTotal += gold;
  P.bossMats[b.id] = (P.bossMats[b.id] ?? 0) + mats;
  for (const m of members) {
    gainXp(m, xp);
    m.hp = Math.max(1, m.hp - R.hpCost);
  }
  // 이번 주 참여 보상: 인연의 증표 1개
  let token = false;
  if (!P.raid.joined && t.kind === 'weekly') {
    P.raid.joined = true;
    P.tokens++;
    token = true;
  }
  let personalBest = false;
  let weekBest = false;
  if (mode !== 'sweep') {
    personalBest = damage > P.raid.personalBest;
    if (personalBest) {
      if (P.raid.personalBest > 0) legendHooks.req('raidPersonalBest');
      P.raid.personalBest = damage;
    }
    if (t.kind === 'weekly' && damage > P.raid.best) {
      P.raid.best = damage;
      weekBest = true;
    }
    if (mode === 'manual' && rank === 'S') legendHooks.req('raidRankS');
  }
  legendHooks.bond('raidTry');
  legendHooks.req('goldEarned', gold);
  // 4단계: 함께 싸운 영웅·전설 인연 + · 주인 담력 · 직접 조작은 불씨 +
  if (mode !== 'sweep') {
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
  return { damage, applied, killed, firstKill, rank, gold, mats, xp, token, personalBest, weekBest };
}

/** 랭킹용 기록 (주간 보스, 직접·자동 한 판만). 2차에서 서버로 */
export async function submitRecord(t: RaidTarget, damage: number, mode: 'auto' | 'manual', ex: RaidExpect): Promise<{ ok: boolean; reason?: string; online: boolean }> {
  if (t.kind !== 'weekly') return { ok: true, online: false };
  const rec: RaidRecord = { week: P.raid.week, bossId: t.boss.id, damage, power: ex.power, theory: ex.theory, mode, at: Date.now() };
  return submitOnline(rec);
}

/** 소탕: 한 번 처치한 보스는 결과만 바로 받기 (자동 기대 피해량 그대로) */
export const canSweep = (b: BossDef) => (P.raid.kills[b.id] ?? 0) > 0;

/** 이번 주 누적 처치 비율 */
export const weekPct = () => {
  const t = weeklyTarget();
  return 1 - t.hpLeft / t.max;
};
