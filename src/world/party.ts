// 핫픽스 12 §2: 추천 편성 + 골고루 키울 이유 — 역할(탱·힐·딜) 조합 보너스 · 멘토 경험치 · 의뢰 조건 태그 · 「추천 편성」 점수
//  원정·사냥 공통. 수치는 CONFIG.party.
import { CONFIG } from '../data/config';
import { RACE_NAME } from '../data/classes';
import type { RegionId } from '../data/items';
import { pairById } from '../data/chem';
import { powerOf } from './adventurers';
import { bondOf } from './chem';
import { equippedItems, optSum } from './items';
import type { Actor, Quest, QuestTag } from './state';
import { isBalanced, partySynMult, role3, SYN_INFO, synergyFx } from './synergy';

const C = CONFIG.party;
export type Role = 'tank' | 'heal' | 'dps';
export const ROLE_ICON: Record<Role, string> = { tank: '🛡', heal: '✚', dps: '⚔' };
export const ROLE_NAME: Record<Role, string> = { tank: '방어', heal: '회복', dps: '공격' };
/** PARTY §2: 방어=기사·전사, 회복=사제, 공격=도적·사냥꾼·마법사 (영웅·전설도 자기 직업 그대로) */
export const roleOf = (a: Pick<Actor, 'kind'>): Role => role3(a);
/** 방어·공격·회복 각 1명 이상 (전사는 방어가 이미 있으면 공격 자리도 — synergy.isBalanced) */
export const balanced = (ms: Pick<Actor, 'kind'>[]) => isBalanced(ms);
/** 역할 조합 배율 (전투력 · 성공률용) */
export const roleMult = (ms: Pick<Actor, 'kind'>[]) => (balanced(ms) ? 1 + C.rolePowerPct : 1);
/** 역할 조합이면 체력 소모 −20% */
export const roleHpMult = (ms: Pick<Actor, 'kind'>[]) => (balanced(ms) ? 1 - C.roleHpSave : 1);
/** 같은 직업 3명 이상 → 표시만 「치우친 파티」 */
export const skewed = (ms: Pick<Actor, 'kind'>[]) => ms.some((m) => ms.filter((x) => x.kind === m.kind).length >= 3);

/** 멘토: 파티 최고 레벨 −5 이하는 경험치 ×1.5 */
export const isMentee = (a: Actor, ms: Actor[]) => ms.length > 1 && a.lvl <= Math.max(...ms.map((m) => m.lvl)) - C.mentorGap;
export const xpMultIn = (a: Actor, ms: Actor[]) => (isMentee(a, ms) ? C.mentorXp : 1);

// ───────── 의뢰 조건 태그 ─────────
const KIND_NAME: Record<string, string> = { knight: '기사', mage: '마법사', dwarf: '전사', rogue: '도적', cleric: '사제', hunter: '사냥꾼' };
/** 하루 1~2개 의뢰에 붙는 가벼운 조건 */
export function rollTag(rand: () => number = Math.random): QuestTag {
  const races = Object.keys(RACE_NAME);
  const kinds = Object.keys(KIND_NAME);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const t = rand();
  if (t < 0.3) {
    const race = pick(races);
    return { k: 'race', v: race, n: 1, text: `${RACE_NAME[race as never]} 포함 시 보상 +${Math.round(C.tagBonus * 100)}%` };
  }
  if (t < 0.5) {
    const kind = pick(kinds);
    return { k: 'noKind', v: kind, n: 0, text: `${KIND_NAME[kind]} 없이 · 보상 +${Math.round(C.tagBonus * 100)}%` };
  }
  if (t < 0.75) {
    const lv = 10;
    return { k: 'maxLvl', v: '', n: lv, text: `레벨 ${lv} 이하만 · 보상 +${Math.round(C.tagBonus * 100)}%` };
  }
  const kind = pick(kinds);
  return { k: 'kind', v: kind, n: 2, text: `${KIND_NAME[kind]} 2명 · 보상 +${Math.round(C.tagBonus * 100)}%` };
}
/** 파티가 태그를 맞췄나 */
export function tagMet(tag: QuestTag | undefined, ms: Actor[]): boolean {
  if (!tag || !ms.length) return false;
  if (tag.k === 'race') return ms.filter((m) => m.race === tag.v).length >= tag.n;
  if (tag.k === 'noKind') return !ms.some((m) => m.kind === tag.v);
  if (tag.k === 'maxLvl') return ms.every((m) => m.lvl <= tag.n);
  return ms.filter((m) => m.kind === tag.v).length >= tag.n;
}
export const tagGoldMult = (q: Quest, ms: Actor[]) => (tagMet(q.tag, ms) ? 1 + C.tagBonus : 1);

// ───────── 추천 편성 ─────────
export interface RecTarget {
  /** 추천 전투력 */
  power: number;
  region: RegionId;
  min: number;
  max: number;
  tag?: QuestTag;
}
export interface RecPick {
  members: Actor[];
  score: number;
  power: number;
  reasons: string[];
}

/** 케미 배율 (발견 여부 상관없이 실제 배율과 같게) */
function chemOf(ms: Actor[]): { mult: number; names: string[] } {
  let m = 1;
  const names: string[] = [];
  for (let i = 0; i < ms.length; i++)
    for (let j = i + 1; j < ms.length; j++) {
      const b = bondOf(ms[i], ms[j]);
      if (!b) continue;
      m += b.lv * CONFIG.chem.partyBonusPerLevel;
      const p = pairById(b.pair);
      if (p) names.push(p.name);
    }
  return { mult: m, names };
}
/** 지역 세트를 2부위 이상 낀 멤버 수 */
const regionSet = (a: Actor, r: RegionId) => equippedItems(a).filter((it) => it.set && it.region === r).length >= 2;

/**
 * 점수 — 추천 전투력까지는 크게(100점), 넘은 만큼은 아주 조금(최대 +4, 1.5배 넘으면 낭비라 감점) · 역할 +8 · 케미 단계당 +2 · 지역 세트 +2 · 멘토 +2(최대 +4) · 태그 +5
 *  인원은 적을수록 조금(+0.5/자리 남김) · 같은 점수면 레벨 합이 낮은 쪽 (키우기용)
 */
export function scoreParty(ms: Actor[], t: RecTarget, pw: Map<Actor, number>): { score: number; power: number; reasons: string[] } {
  const chem = chemOf(ms);
  let raw = 0;
  const fx = synergyFx(ms);
  const pws = ms.map((m) => (pw.get(m) ?? powerOf(m)) * (1 + (optSum(m, 'regionDmg', t.region) + optSum(m, 'anyDmg')) / 100));
  for (const v of pws) raw += v;
  // PARTY §2: 조합 보너스 (공격 + · 한 우물)
  const power = Math.round(raw * partySynMult(ms, pws, fx) * chem.mult * roleMult(ms));
  const reach = Math.min(1, power / Math.max(1, t.power));
  const over = Math.max(0, power / Math.max(1, t.power) - 1);
  const reasons: string[] = [];
  // 1.5배를 넘게 세면 낭비 → 깎는다 (센 애는 더 어려운 의뢰로)
  let s = 100 * reach + 4 * Math.min(1, over) - 6 * Math.max(0, over - 0.5);
  if (balanced(ms)) {
    s += 8;
    reasons.push(`방어·공격·회복 조합 +${Math.round(C.rolePowerPct * 100)}%`);
  }
  // PARTY §2: 다른 조합도 하나에 +1.5점 (같은 점수대에서 조합이 켜지는 쪽)
  const extra = fx.ids.filter((id) => id !== 'balanced');
  if (extra.length) {
    s += 1.5 * extra.length;
    reasons.push(extra.map((id) => `「${SYN_INFO[id].name}」`).join(' '));
  }
  if (chem.names.length) {
    s += 2 * Math.round((chem.mult - 1) / CONFIG.chem.partyBonusPerLevel);
    reasons.push(`케미 「${chem.names[0]}」${chem.names.length > 1 ? ` 외 ${chem.names.length - 1}` : ''}`);
  }
  const sets = ms.filter((m) => regionSet(m, t.region)).length;
  if (sets) s += 2 * sets;
  const mentees = ms.filter((m) => isMentee(m, ms));
  if (mentees.length) {
    s += Math.min(4, 2 * mentees.length);
    reasons.push(`${mentees.map((m) => m.name).join('·')} 경험치 ×${C.mentorXp}`);
  }
  if (tagMet(t.tag, ms)) {
    s += 5;
    reasons.push('의뢰 조건 달성');
  }
  s += 0.5 * (t.max - ms.length);
  s -= 0.001 * ms.reduce((v, m) => v + m.lvl, 0);
  return { score: s, power, reasons };
}

/** 후보 전체 조합 중 점수 최대 (min~max명) */
export function recommendParty(cands: Actor[], t: RecTarget): RecPick | null {
  const pw = new Map(cands.map((a) => [a, powerOf(a)]));
  // 너무 많으면 전투력 상위 + 레벨 하위(멘토 후보)로 줄인다 — 14명 × 5자리 ≈ 3,000 조합
  let pool = cands;
  if (pool.length > 14) {
    const byP = [...pool].sort((a, b) => pw.get(b)! - pw.get(a)!);
    const keep = new Set(byP.slice(0, 10));
    for (const a of [...pool].sort((a, b) => a.lvl - b.lvl).slice(0, 4)) keep.add(a);
    pool = [...keep];
  }
  let best: RecPick | null = null;
  const cur: Actor[] = [];
  const walk = (i: number) => {
    if (cur.length >= t.min) {
      const r = scoreParty(cur, t, pw);
      if (!best || r.score > best.score + 1e-9) best = { members: [...cur], ...r };
    }
    if (cur.length === t.max) return;
    for (let k = i; k < pool.length; k++) {
      cur.push(pool[k]);
      walk(k + 1);
      cur.pop();
    }
  };
  walk(0);
  return best;
}
