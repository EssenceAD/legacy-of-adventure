// MYTHIC: 전설 영웅과 인연 5를 맺고 다음 여관을 열면, 기억을 되찾은 「신화」로 찾아온다
//  씨앗(유산) → 각성 대사 → 신화 부탁 → 별지기의 열쇠 조각 · 속마음(밤 1회) · 엔딩 한 줄 · 신화 스킬
import { MYTHIC, MYTHIC_HINT, MYTHIC_SEED_LINE, type MythicDef } from '../data/story/mythic';
import type { SLine } from '../data/story/v1';
import { LEGENDS } from '../data/legends';
import type { RegionId } from '../data/items';
import { track } from '../net/telemetry';
import { bondsOf } from './chem';
import { markDirty, P, S, world, type Actor } from './state';
import { bestOf } from './town';

export const mythicOf = (key: string | undefined): MythicDef | undefined => (key ? MYTHIC.find((m) => m.key === key) : undefined);
const seeds = (): string[] => (P.legacy.mythicSeeds ??= []);
const ms = (key: string) => ((P.story.mythic ??= {})[key] ??= {});
const homeActors = (): Actor[] => world.home?.actors ?? world.actors;
const regulars = () => homeActors().filter((a) => !a.role && a.id && (a.status === 'regular' || a.status === 'hero'));
const nameOf = (key: string) => LEGENDS.find((l) => l.key === key)?.name ?? key;

/** 신화인가: 씨앗이 있고 이번 회차에 각성 대사를 봤다 (디버그 ?mythic=key 도) */
export function isMythic(a: Actor | undefined): boolean {
  const k = a?.legendId;
  return !!k && !!mythicOf(k) && seeds().includes(k) && !!P.story.mythic?.[k]?.met;
}
const inParty = (members: Actor[], key: string) => members.some((m) => m.legendId === key && isMythic(m));

// ───────── 씨앗 ─────────

/** 인연 5를 맺은 순간 (owner.tieEvent) — 모모 한 줄은 다음 틱에 */
export function mythicSeedMoment(key: string) {
  if (!mythicOf(key) || seeds().includes(key)) return;
  (P.story.flags ??= {}).seedLine = MYTHIC.findIndex((m) => m.key === key) + 1;
  markDirty();
}
/** 다음 여관을 열기 직전 (owner.inheritLegacy): 인연 5 전설은 씨앗이 된다 */
export function keepMythicSeeds() {
  for (const [id, t] of Object.entries(P.ties ?? {})) if (t && t.stage >= 5 && mythicOf(id) && !seeds().includes(id)) seeds().push(id);
}

// ───────── 부탁 진행 ─────────

type Base = { raidKills: number; nightWins: number; low: number[]; hearts: string[]; moodDay: number; moodTop: number; streak: number };
const base = (key: string): Base => ((ms(key) as { base?: Base }).base ??= { raidKills: P.counters.raidKills ?? 0, nightWins: P.counters.nightWins ?? 0, low: regulars().filter((a) => a.lvl <= 10).map((a) => a.id), hearts: [], moodDay: S.day, moodTop: P.counters.moodTopDays, streak: 0 });

/** 부탁 진행 [지금, 목표] */
export function mythicProgress(key: string): [number, number] {
  const b = base(key);
  switch (key) {
    case 'elysia':
      return [Math.min(3, (P.counters.raidKills ?? 0) - b.raidKills), 3];
    case 'ceres':
      return [Math.min(3, regulars().filter((a) => b.low.includes(a.id) && a.lvl >= 20).length), 3];
    case 'vael':
      return [ms(key).prog ? 1 : 0, 1];
    case 'scarlet':
      return [Math.min(10, P.counters.campfireMax ?? 0), 10];
    case 'luna':
      return [Math.min(10, (P.counters.nightWins ?? 0) - b.nightWins), 10];
    case 'grom':
      return [Math.min(5, bestOf('training')?.lvl ?? 0), 5];
    case 'aria':
      return [Math.min(7, b.streak), 7];
    case 'nyx':
      return [Math.min(5, b.hearts.length), 5];
    case 'leon': {
      const seen = new Set<string>();
      for (const a of regulars()) for (const x of bondsOf(a)) if (x.lv >= 5) seen.add([a.id, x.other.id].sort().join('-'));
      return [Math.min(3, seen.size), 3];
    }
  }
  return [0, 1];
}
/** 하루가 바뀔 때: 아리아 「기분 최고인 날 연속」 */
function moodStreak(key: string) {
  const b = base(key);
  if (S.day === b.moodDay) return;
  const got = P.counters.moodTopDays > b.moodTop;
  b.streak = got ? b.streak + (S.day - b.moodDay) : 0;
  b.moodDay = S.day;
  b.moodTop = P.counters.moodTopDays;
}
/** 바엘: 별의 심연 x-10을 바엘과 함께 깸 (hunt) */
export function mythicHuntWin(region: RegionId, stage: number, members: Actor[]) {
  if (region === 'abyss' && stage >= 10 && inParty(members, 'vael')) ms('vael').prog = 1;
}
/** 닉스: 이웃 여관에 ♥ (서로 다른 곳) */
export function mythicHeart(uid: string) {
  for (const k of seeds()) if (P.story.mythic?.[k]?.met && k === 'nyx') {
    const b = base(k);
    if (!b.hearts.includes(uid)) b.hearts.push(uid);
  }
}

// ───────── 1초마다 ─────────

/** 다음에 보여 줄 대사 (각성 · 부탁 · 부탁 완료 · 속마음 · 씨앗 한 줄) */
export function mythicTick(): SLine[] | null {
  const f = (P.story.flags ??= {}) as Record<string, unknown>;
  if (typeof f.seedLine === 'number' && f.seedLine > 0) {
    const k = MYTHIC[f.seedLine - 1].key;
    delete f.seedLine;
    if (!seeds().includes(k)) seeds().push(k);
    markDirty();
    return [MYTHIC_SEED_LINE, ['narr', MYTHIC_HINT]];
  }
  const here = new Set(homeActors().map((a) => a.legendId).filter(Boolean) as string[]);
  for (const k of seeds()) {
    const m = mythicOf(k);
    if (!m || !here.has(k)) continue;
    const s = ms(k);
    if (!s.met) {
      s.met = true;
      base(k);
      track('mythic_meet', { key: k });
      markDirty();
      return [...m.awaken, ['narr', `${nameOf(k)} — 신화 「${m.title}」 · 스킬 「${m.skill.name}」: ${m.skill.desc}`], ...m.request.lines, ['narr', `신화의 부탁: ${m.request.text}`]];
    }
    if (k === 'aria') moodStreak(k);
    if (!s.done) {
      const [n, goal] = mythicProgress(k);
      if (n >= goal) {
        s.done = true;
        const shards = (P.legacy.shards ??= []);
        if (!shards.includes(m.shard)) shards.push(m.shard);
        track('mythic_done', { key: k });
        markDirty();
        return [...m.request.done, ['narr', `별지기의 열쇠 조각 「${m.shard}」을 얻었다 (${shards.length}개)`]];
      }
    }
    if (!s.heart && S.night && (P.ties?.[k]?.stage ?? 1) >= 5) {
      s.heart = true;
      markDirty();
      return m.heart;
    }
  }
  return null;
}

/** 엔딩 카드 아래: 이번 회차에 함께한 신화의 한 줄 */
export function mythicEndLines(): SLine[] {
  return seeds()
    .filter((k) => P.story.mythic?.[k]?.met)
    .map((k) => mythicOf(k)?.ending)
    .filter(Boolean) as SLine[];
}

// ───────── 신화 스킬 (파티에 있을 때) ─────────

/** 파티 공격 배율 */
export function mythicAtk(members: Actor[], region?: RegionId, boss = false): number {
  let k = 1;
  // 「함께 회차를 넘긴 단골」 = 이전 주인 때부터 있던 영웅·전설 (마을은 회차를 넘어 이어진다)
  if (inParty(members, 'elysia')) k *= P.legacy.gen > 0 && members.some((m) => m.legendId !== 'elysia' && (m.legendId || m.heroId)) ? 1.15 : 1.1;
  if (inParty(members, 'scarlet')) k *= 1.15;
  if (inParty(members, 'grom')) k *= 1.18;
  if (inParty(members, 'vael') && region === 'abyss') k *= 1.4;
  if (inParty(members, 'vael') && boss) k *= 1.05;
  if (inParty(members, 'leon') && members.length > 1 && members.every((m) => m.legendId === 'leon' || bondsOf(m).some((x) => x.lv >= 3 && members.includes(x.other)))) k *= 1.12;
  return k;
}
/** 파티가 받는 피해 배율 */
export function mythicDef(members: Actor[], a?: Actor): number {
  let k = 1;
  if (inParty(members, 'ceres')) k *= a && a.lvl <= 10 ? 0.6 : 0.75;
  if (inParty(members, 'grom')) k *= 1 - Math.min(0.2, 0.05 * members.filter((m) => m.kind === 'dwarf').length);
  return k;
}
/** 파티 회복 배율 */
export const mythicHeal = (members: Actor[]) => (inParty(members, 'aria') ? 1.4 : 1);
/** 의뢰: 시간 −20% (루나) */
export const mythicTimeCut = (members: Actor[]) => (inParty(members, 'luna') ? 0.2 : 0);
/** 의뢰: 금화 (닉스 +25% · 루나 밤 출발 +15%) */
export function mythicQuestGold(members: Actor[], night: boolean): number {
  return (inParty(members, 'nyx') ? 1.25 : 1) * (night && inParty(members, 'luna') ? 1.15 : 1);
}
/** 케미 상승 (레온 +30%) */
export const mythicChemXp = (members: Actor[]) => (inParty(members, 'leon') ? 1.3 : 1);
/** 개인 능력치 ×1.15 */
export const mythicStat = (a: Actor) => (isMythic(a) ? 1.15 : 1);

/** 디버그: ?mythic=elysia → 씨앗 심기 (DEV) */
export function debugMythic(key: string) {
  if (!mythicOf(key)) return;
  if (!seeds().includes(key)) seeds().push(key);
}
