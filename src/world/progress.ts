// 성장 지표: 평판(★) · 도감(손님·아이템·케미·영웅) · 오늘의 목표 · 영웅 조건
import { CONFIG } from '../data/config';
import { GOAL_TEMPLATES, type GoalEvent } from '../data/goals';
import { HERO_SETS, HEROES, type HeroCtx } from '../data/heroes';
import { REGIONS, SLOTS, type RegionId } from '../data/items';
import { CHEM_PAIRS } from '../data/chem';
import { RACES, RARITIES, GUEST_KINDS } from '../data/classes';
import { P, S, world, type Actor, type Item } from './state';

// ───────── 평판 ★ ─────────

export function stars(): number {
  const t = CONFIG.reputation.stars;
  let s = 1;
  for (let i = 0; i < t.length; i++) if (P.rep >= t[i]) s = i + 1;
  return s;
}
export function addRep(n: number) {
  P.rep = Math.max(0, P.rep + n);
}
/** 다음 별까지 남은 점수 (최대면 0) */
export function repToNext(): number {
  const t = CONFIG.reputation.stars;
  const s = stars();
  return s >= t.length ? 0 : Math.ceil(t[s] - P.rep);
}

// ───────── 도감 ─────────

export const guestDexKey = (a: Pick<Actor, 'race' | 'kind' | 'rarity'>) => `${a.race}|${a.kind}|${a.rarity}`;
export const GUEST_DEX_TOTAL = RACES.length * GUEST_KINDS.length * RARITIES.length;
/** 유물은 심연에서만 → 칸 수: 지역5×부위3×등급4 + 심연 유물 3 */
export const ITEM_DEX_TOTAL = REGIONS.length * SLOTS.length * 4 + SLOTS.length;

/** 손님을 만나면 도감 칸이 채워진다. 새 칸이면 true */
export function dexAddGuest(a: Actor): boolean {
  if (a.role || !a.id) return false;
  const k = guestDexKey(a);
  if (P.dex.guests.includes(k)) return false;
  P.dex.guests.push(k);
  return true;
}
export function dexAddItem(it: Item): boolean {
  const k = `${it.region}|${it.slot}|${it.grade}`;
  if (P.dex.items.includes(k)) return false;
  P.dex.items.push(k);
  return true;
}

/** 계정 전체 전투력 보너스 (도감 + 영웅 등록 + 영웅 세트) */
export function dexBonus(): number {
  const D = CONFIG.dex;
  let b = P.dex.guests.length * D.guestCellPct + P.dex.items.length * D.itemCellPct;
  for (const h of HEROES) if (P.dex.heroes[h.id]?.recruited) b += h.bonus;
  for (const s of HERO_SETS) if (s.members.every((m) => P.dex.heroes[m]?.recruited)) b += s.bonus;
  return b;
}
/** 영웅 ★ 합 × 1% */
export function heroStarBonus(): number {
  let s = 0;
  for (const h of Object.values(P.dex.heroes)) if (h.recruited) s += h.stars;
  return s * CONFIG.dex.heroStarPct;
}
export const heroTitles = () => HERO_SETS.filter((s) => s.members.every((m) => P.dex.heroes[m]?.recruited)).map((s) => s.title);

/** 도감 채운 비율 보상 (25·50·75·100%) */
export const DEX_REWARDS = [
  { id: 'g25', book: 'guests', at: 0.25, gold: 500, rep: 10 },
  { id: 'g50', book: 'guests', at: 0.5, gold: 1500, rep: 20 },
  { id: 'g75', book: 'guests', at: 0.75, gold: 3000, rep: 30 },
  { id: 'g100', book: 'guests', at: 1, gold: 8000, rep: 80 },
  { id: 'i25', book: 'items', at: 0.25, gold: 500, dust: 100 },
  { id: 'i50', book: 'items', at: 0.5, gold: 1500, dust: 300 },
  { id: 'i75', book: 'items', at: 0.75, gold: 3000, dust: 600 },
  { id: 'i100', book: 'items', at: 1, gold: 8000, dust: 1500 },
] as const;
export function dexRatio(book: 'guests' | 'items') {
  return book === 'guests' ? P.dex.guests.length / GUEST_DEX_TOTAL : P.dex.items.length / ITEM_DEX_TOTAL;
}

// ───────── 오늘의 목표 (현실 날짜) ─────────

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export function ensureGoals() {
  if (P.goals.day === today()) return;
  const pool = [...GOAL_TEMPLATES];
  const list: typeof P.goals.list = [];
  for (let i = 0; i < CONFIG.goals.count && pool.length; i++) {
    const t = pool.splice((Math.random() * pool.length) | 0, 1)[0];
    list.push({ id: t.id, target: t.min + ((Math.random() * (t.max - t.min + 1)) | 0), progress: 0, claimed: false });
  }
  P.goals = { day: today(), list };
}

/** 일이 생길 때마다 불러 목표·통계를 올린다 */
export function track(event: GoalEvent, n = 1) {
  ensureGoals();
  for (const g of P.goals.list) {
    const t = GOAL_TEMPLATES.find((x) => x.id === g.id);
    if (t && t.event === event) g.progress = Math.min(g.target, g.progress + n);
  }
}

export function claimGoal(i: number): { gold: number; dust?: number } | null {
  const g = P.goals.list[i];
  if (!g || g.claimed || g.progress < g.target) return null;
  const t = GOAL_TEMPLATES.find((x) => x.id === g.id)!;
  g.claimed = true;
  S.gold += t.reward.gold;
  if (t.reward.dust) P.dust.n += t.reward.dust;
  addRep(CONFIG.reputation.goal);
  return t.reward;
}

// ───────── 영웅 ─────────

export function heroCtx(): HeroCtx {
  const objs = world.home?.objs ?? world.objs;
  const regulars = (world.home?.actors ?? world.actors).filter((a) => (a.status === 'regular' || a.status === 'hero') && !a.role);
  const bonds = Object.values(P.bonds);
  const smith = objs.find((o) => o.kind === 'smith');
  return {
    night: S.night,
    land: world.home?.land ?? S.land,
    stars: stars(),
    innLvl: objs.find((o) => o.kind === 'inn')?.lvl ?? 1,
    hasBath: objs.some((o) => o.kind === 'bath' && o.build === undefined),
    roofCount: (h) => objs.filter((o) => o.hue === h).length,
    trees: objs.filter((o) => o.kind === 'tree' || o.kind === 'pine').length,
    fires: objs.filter((o) => o.kind === 'fire').length,
    enhanceMax: P.counters.enhanceMax,
    campfireMax: P.counters.campfireMax,
    regionWins: (r: RegionId) => P.counters.regionWins[r] ?? 0,
    tavernMeals: P.counters.tavernMeals,
    legendInBag: P.bag.some((it) => it.grade === 'l' || it.grade === 'a'),
    pairsAtLeast: (lv) => bonds.filter((b) => b.lv >= lv).length,
    chemFound: P.dex.chem.length,
    crafted: (r) => (r ? P.counters.crafted[r] ?? 0 : Object.values(P.counters.crafted).reduce((s, v) => s + v, 0)),
    harvests: P.counters.harvests,
    regularsAtLeast: (lv) => regulars.filter((a) => a.lvl >= lv).length,
    smithLvl: smith?.lvl ?? 0,
  };
}

/** 아직 안 나타난 영웅 중 조건을 맞춘 영웅 (한 번에 한 명) */
export function heroReady(): string | null {
  const c = heroCtx();
  const h = HEROES.find((x) => !P.dex.heroes[x.id]?.appeared && x.appear(c));
  return h?.id ?? null;
}

export const chemFoundNames = () => CHEM_PAIRS.filter((p) => P.dex.chem.includes(p.id)).map((p) => p.name);
