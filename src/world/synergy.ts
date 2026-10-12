// PARTY §2: 파티 조합 보너스 — 역할 3개(방어·공격·회복) + 직업 짝 · 여러 개 동시에(합산) · 케미 짝 보너스와 따로
//  사냥·토벌·원정 파티 창이 같은 함수로 미리 보여 주고, 전투(field)·원정·토벌 기대 피해가 같은 수치를 쓴다. 수치는 CONFIG.synergy.
import { CONFIG } from '../data/config';
import { CLASSES, GUEST_KINDS } from '../data/classes';
import { SYNERGY_FIRST } from '../data/story/hunter';
import type { SLine } from '../data/story/v1';
import { baseStats, totalStats } from './adventurers';
import { markDirty, P, type Actor } from './state';

const C = CONFIG.synergy;
export type SynId = 'balanced' | 'guard' | 'shadow' | 'starlight' | 'ironwall' | 'barrage' | 'alley' | 'same';
export const SYN_IDS: SynId[] = ['balanced', 'guard', 'shadow', 'starlight', 'ironwall', 'barrage', 'alley', 'same'];

type K = Pick<Actor, 'kind'>;
const has = (ms: K[], k: string) => ms.some((m) => m.kind === k);
const count = (ms: K[], k: string) => ms.filter((m) => m.kind === k).length;

/** 이름 · 아이콘 · 조건 글 · 효과 글 */
export const SYN_INFO: Record<SynId, { name: string; icon: string; cond: string; eff: string; battleOnly?: boolean }> = {
  balanced: { name: '균형 잡힌 파티', icon: '⚖', cond: '방어·공격·회복 각 1명 이상', eff: `전투력 +${pc(C.balanced.power)} · 받는 피해 −${pc(C.balanced.dmgCut)}` },
  guard: { name: '수호의 맹세', icon: '🛡', cond: '기사 + 사제', eff: `받는 피해 −${pc(C.guard.dmgCut)}` },
  shadow: { name: '그림자 사냥', icon: '🗡', cond: '도적 + 사냥꾼', eff: `치명타 +${pc(C.shadow.crit)}`, battleOnly: true },
  starlight: { name: '별빛 기도', icon: '✨', cond: '마법사 + 사제', eff: `스킬 대기 시간 −${pc(C.starlight.cdCut)}`, battleOnly: true },
  ironwall: { name: '철벽 돌격', icon: '🧱', cond: '전사 + 기사', eff: `보스 피해 +${pc(C.ironwall.bossDmg)}`, battleOnly: true },
  barrage: { name: '원거리 포화', icon: '🏹', cond: '사냥꾼 + 마법사', eff: `공격 +${pc(C.barrage.atk)}` },
  alley: { name: '뒷골목 싸움', icon: '💰', cond: '전사 + 도적', eff: `금화 +${pc(C.alley.gold)}` },
  same: { name: '한 우물', icon: '🔁', cond: `같은 직업 ${C.same.n}명 이상`, eff: `그 직업 기본 능력치 +${pc(C.same.stat)}` },
};
function pc(v: number) {
  return `${Math.round(v * 100)}%`;
}

// ───────── 역할 ─────────
export type Role3 = 'tank' | 'heal' | 'dps';
/** 방어 = 기사·전사 · 회복 = 사제 · 공격 = 도적·사냥꾼·마법사 (영웅·전설도 자기 직업 그대로) */
export const role3 = (a: K): Role3 => (a.kind === 'knight' || a.kind === 'dwarf' ? 'tank' : a.kind === 'cleric' ? 'heal' : 'dps');
/**
 * 방어·공격·회복이 다 있나. 전사는 방어지만, 방어가 이미 한 명 있으면 공격 자리도 채운다
 *  (예전 「탱(기사)·힐·딜(전사 포함)」 조합이 그대로 켜지게 — 옛 파티의 보너스가 줄지 않는다)
 */
export function isBalanced(ms: K[]): boolean {
  if (!has(ms, 'cleric')) return false;
  const tanks = ms.filter((m) => role3(m) === 'tank').length;
  if (!tanks) return false;
  if (ms.some((m) => role3(m) === 'dps')) return true;
  return has(ms, 'dwarf') && tanks >= 2;
}

/** 한 우물: 3명 이상인 직업 (없으면 null) */
export function sameKind(ms: K[]): string | null {
  for (const k of GUEST_KINDS) if (count(ms, k) >= C.same.n) return k;
  return null;
}

/** 지금 켜지는 조합 (표 순서) */
export function synergiesOf(ms: K[]): SynId[] {
  const out: SynId[] = [];
  if (isBalanced(ms)) out.push('balanced');
  if (has(ms, 'knight') && has(ms, 'cleric')) out.push('guard');
  if (has(ms, 'rogue') && has(ms, 'hunter')) out.push('shadow');
  if (has(ms, 'mage') && has(ms, 'cleric')) out.push('starlight');
  if (has(ms, 'dwarf') && has(ms, 'knight')) out.push('ironwall');
  if (has(ms, 'hunter') && has(ms, 'mage')) out.push('barrage');
  if (has(ms, 'dwarf') && has(ms, 'rogue')) out.push('alley');
  if (sameKind(ms)) out.push('same');
  return out;
}

export interface SynFx {
  ids: SynId[];
  /** 전투력 배 − 1 (원거리 포화 「공격 +6%」 · 균형의 +10%는 roleMult가 따로) */
  atk: number;
  /** 받는 피해 − (합 · 상한 dmgCutMax) */
  dmgCut: number;
  crit: number;
  cdCut: number;
  bossDmg: number;
  gold: number;
  same: string | null;
}
export function synergyFx(ms: K[]): SynFx {
  const ids = synergiesOf(ms);
  const on = (id: SynId) => ids.includes(id);
  return {
    ids,
    atk: on('barrage') ? C.barrage.atk : 0,
    dmgCut: Math.min(C.dmgCutMax, (on('balanced') ? C.balanced.dmgCut : 0) + (on('guard') ? C.guard.dmgCut : 0)),
    crit: on('shadow') ? C.shadow.crit : 0,
    cdCut: on('starlight') ? C.starlight.cdCut : 0,
    bossDmg: on('ironwall') ? C.ironwall.bossDmg : 0,
    gold: on('alley') ? C.alley.gold : 0,
    same: sameKind(ms),
  };
}

/** 한 사람의 전투력 배율 (조합 · 균형의 역할 보너스는 빼고) — 한 우물은 그 직업 「기본 능력치」 몫에만 +15% */
export function memberSynMult(a: Actor, fx: SynFx): number {
  let m = 1 + fx.atk;
  if (fx.same && a.kind === fx.same) {
    const base = Object.values(baseStats(a)).reduce((s, v) => s + v, 0);
    const tot = Object.values(totalStats(a)).reduce((s, v) => s + v, 0);
    m *= 1 + C.same.stat * (tot > 0 ? Math.min(1, base / tot) : 1);
  }
  return m;
}
/** 파티 전체 전투력 배율 (사람마다 다른 한 우물을 전투력 가중 평균으로) */
export function partySynMult(ms: Actor[], pw: number[], fx = synergyFx(ms)): number {
  const sum = pw.reduce((s, v) => s + v, 0);
  if (!sum) return 1 + fx.atk;
  return ms.reduce((s, m, i) => s + pw[i] * memberSynMult(m, fx), 0) / sum;
}

/** 원정 체력 소모 − (균형 잡힌 파티는 원래 있던 역할 보너스 「체력 소모 −20%」가 대신하므로 빼고) */
export const expHpCut = (fx: SynFx) => Math.max(0, fx.dmgCut - (fx.ids.includes('balanced') ? C.balanced.dmgCut : 0));
/** PARTY §1 사냥꾼 개성: 숲·정원(구름 정원 = sky) 지역 피해 +10% (원정·의뢰) */
export const hunterRegionPct = (a: Pick<Actor, 'kind'>, region: string) => (a.kind === 'hunter' && CONFIG.hunter.regions.includes(region) ? CONFIG.hunter.regionDmg : 0);
/** 사냥꾼이 한 명이라도 있으면 원정 시간 −5% */
export const hunterTimeCut = (ms: Pick<Actor, 'kind'>[]) => (has(ms, 'hunter') ? CONFIG.hunter.timeCut : 0);

/** 토벌 기대 피해에 넣는 필드 피해 배율 (치명타 기대값 · 보스 피해 · 스킬 대기) — 전투력 배율은 따로 */
export function synDamageMult(fx: SynFx): number {
  const cc = CONFIG.combat.critChance;
  const crit = (1 + cc + fx.crit) / (1 + cc);
  return crit * (1 + fx.bossDmg) * (1 + (fx.cdCut / (1 - fx.cdCut)) * C.skillShare);
}

// ───────── 「한 명만 바꾸면 ○○」 ─────────

export interface SynHint {
  id: SynId;
  /** 빼는 사람 (빈자리에 넣으면 없음) · 넣을 직업 */
  out?: Actor;
  inKind: string;
  text: string;
}
/** 지금 꺼진 조합 중 한 명만 바꾸면(빈자리면 한 명 더하면) 켜지는 것 — 후보 손님 중에서 실제로 가능한 것만 */
export function synergyHint(ms: Actor[], cands: Actor[], max: number): SynHint | null {
  if (!ms.length) return null;
  const now = new Set(synergiesOf(ms));
  const pool = cands.filter((c) => !ms.includes(c));
  const kinds = [...new Set(pool.map((c) => c.kind))];
  const name = (k: string) => (CLASSES as Record<string, { name: string }>)[k]?.name ?? k;
  for (const id of SYN_IDS) {
    if (now.has(id)) continue;
    for (const k of kinds) {
      if (ms.length < max) {
        const t = [...ms, { kind: k } as Actor];
        if (synergiesOf(t).includes(id)) return { id, inKind: k, text: `${name(k)} 한 명 더하면 「${SYN_INFO[id].name}」` };
      }
      for (const o of ms) {
        if (o.kind === k) continue;
        const t = ms.map((m) => (m === o ? ({ kind: k } as Actor) : m));
        const got = synergiesOf(t);
        // 바꿔서 다른 조합을 잃으면 덜 좋은 힌트 — 그래도 켜지면 알려 준다 (잃는 게 없는 걸 먼저 찾는다)
        if (got.includes(id) && [...now].every((x) => got.includes(x))) return { id, out: o, inKind: k, text: `한 명만 바꾸면 「${SYN_INFO[id].name}」 — ${o.name} 대신 ${name(k)}` };
      }
    }
  }
  for (const id of SYN_IDS) {
    if (now.has(id)) continue;
    for (const k of kinds)
      for (const o of ms) {
        if (o.kind === k) continue;
        if (synergiesOf(ms.map((m) => (m === o ? ({ kind: k } as Actor) : m))).includes(id)) return { id, out: o, inKind: k, text: `한 명만 바꾸면 「${SYN_INFO[id].name}」 — ${o.name} 대신 ${name(k)}` };
      }
  }
  return null;
}

// ───────── 도감 「파티」 · 처음 켜질 때 한 줄 ─────────

/** 켜 본 조합을 도감에 적는다. 새로 적힌 것들 */
export function recordSynergies(ms: K[]): SynId[] {
  const seen = (P.dex.syn ??= []);
  const fresh = synergiesOf(ms).filter((id) => !seen.includes(id));
  if (fresh.length) {
    seen.push(...fresh);
    markDirty();
  }
  return fresh;
}
/** 사냥·토벌 시작: 처음 켜진 조합의 한 줄 (한 조합당 한 번 · 여러 개면 표 순서 첫 번째만, 나머지는 다음 판에) */
export function takeSynergyLine(ms: K[]): { id: SynId; line: SLine } | null {
  recordSynergies(ms);
  const shown = (P.meta.synLine ??= []);
  const id = synergiesOf(ms).find((x) => !shown.includes(x));
  if (!id) return null;
  shown.push(id);
  markDirty();
  return { id, line: SYNERGY_FIRST[id] };
}
