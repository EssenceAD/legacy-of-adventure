// 성장 지표: 평판(★) · 도감(손님·아이템·케미·영웅) · 오늘의 목표 · 영웅 조건
import { bestOf } from './town';
import { openDrops, ownedDrops } from './decodrop';
import { sfx } from '../audio/sfx';
import { CONFIG } from '../data/config';
import { GOAL_TEMPLATES, type GoalEvent, type GoalTemplate } from '../data/goals';
import { HERO_SETS, HEROES, type HeroCtx } from '../data/heroes';
import { BASE_REGIONS, REGIONS, SLOTS, type RegionId } from '../data/items';
import { CHEM_PAIRS } from '../data/chem';
import { RACES, RARITIES, GUEST_KINDS, BASE_GUEST_KINDS } from '../data/classes';
import { legendHooks, P, S, uiHooks, world, type Actor, type Item } from './state';

// ───────── 평판 ★ ─────────

export function stars(): number {
  const t = CONFIG.reputation.stars;
  let s = 1;
  for (let i = 0; i < t.length; i++) if (P.rep >= t[i]) s = i + 1;
  return s;
}
/** 4단계 유산 보너스(평판 +%) — owner.ts가 채운다 (import가 꼬이지 않게) */
export const repHook = { mult: () => 1 };
export function addRep(n: number) {
  P.rep = Math.max(0, P.rep + (n > 0 ? n * repHook.mult() : n));
  if (n > 0) legendHooks.bond('repGain');
}
/** 다음 별까지 남은 점수 (최대면 0) */
export function repToNext(): number {
  const t = CONFIG.reputation.stars;
  const s = stars();
  return s >= t.length ? 0 : Math.ceil(t[s] - P.rep);
}

// ───────── 도감 ─────────

export const guestDexKey = (a: Pick<Actor, 'race' | 'kind' | 'rarity'>) => `${a.race}|${a.kind}|${a.rarity}`;
//  PARTY §1: 비율(보상·기념비·완성률)은 처음 다섯 직업 칸으로 — 사냥꾼 칸은 전투력 보너스만 더한다 (옛 진행이 깎이지 않게)
export const GUEST_DEX_TOTAL = RACES.length * BASE_GUEST_KINDS.length * RARITIES.length;
/** 사냥꾼까지 모든 칸 (표시용) */
export const GUEST_DEX_ALL = RACES.length * GUEST_KINDS.length * RARITIES.length;
/** 처음 다섯 직업 칸 수 */
export const baseDexGuests = () => P.dex.guests.filter((k) => (BASE_GUEST_KINDS as readonly string[]).includes(k.split('|')[1])).length;
/** 유물은 심연에서만 → 칸 수: 지역5×부위3×등급4 + 심연 유물 3 */
//  REGIONS2: 비율(보상·기념비·전설 조건)은 처음 다섯 지역 칸으로 — 새 지역 칸은 전투력 보너스만 더한다 (옛 진행이 깎이지 않게)
export const ITEM_DEX_TOTAL = BASE_REGIONS * SLOTS.length * 4 + SLOTS.length;
const BASE_IDS = new Set(REGIONS.slice(0, BASE_REGIONS).map((r) => r.id as string));
/** 처음 다섯 지역 도감 칸 수 */
export const baseDexItems = () => P.dex.items.filter((k) => BASE_IDS.has(k.split('|')[0])).length;

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
  legendHooks.bond('itemDexNew');
  legendHooks.req('itemDexNew');
  return true;
}

/** 계정 전체 전투력 보너스 (도감 + 영웅 등록 + 영웅 세트) */
export function dexBonus(): number {
  const D = CONFIG.dex;
  let b = P.dex.guests.length * D.guestCellPct + P.dex.items.length * D.itemCellPct;
  for (const h of HEROES) if (P.dex.heroes[h.id]?.recruited) b += h.bonus;
  for (const s of HERO_SETS) if (s.members.every((m) => P.dex.heroes[m]?.recruited)) b += s.bonus;
  // 전설 영웅 영입: 한 명마다 +3%
  b += Object.values(P.legends).filter((l) => l.st === 'joined').length * CONFIG.legends.dexBonus;
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
/** 「유산의 기념비」: 손님·아이템·영웅 도감 중 하나라도 100% */
export function monumentUnlocked(): boolean {
  return dexRatio('guests') >= 1 || dexRatio('items') >= 1 || HEROES.every((h) => P.dex.heroes[h.id]?.recruited);
}
export function dexRatio(book: 'guests' | 'items') {
  return book === 'guests' ? baseDexGuests() / GUEST_DEX_TOTAL : baseDexItems() / ITEM_DEX_TOTAL;
}

// ───────── 오늘의 목표 (현실 날짜) ─────────

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** 5단계: 지금 할 수 있는 목표인가 (그 건물을 지었나 · 단골이 2명 이상인가) */
export function goalAvailable(t: GoalTemplate): boolean {
  if (!t.needs) return true;
  const home = world.home ?? world;
  // DECO_DROP §3: 아직 안 산 장식이 열려 있어야
  if (t.needs === 'newDeco') return openDrops().some((k) => !ownedDrops().includes(k));
  if (t.needs === 'regulars2') return home.actors.filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).length >= 2;
  return home.objs.some((o) => o.kind === t.needs && o.build === undefined);
}

export function ensureGoals() {
  if (P.goals.day === today()) {
    // 오늘 목록에 아직 못 하는 목표(손도 안 댄 것)가 있으면 할 수 있는 걸로 바꾼다 (예전 저장)
    for (const g of P.goals.list) {
      const t = GOAL_TEMPLATES.find((x) => x.id === g.id);
      if (!t || goalAvailable(t) || g.progress > 0 || g.claimed) continue;
      const alt = GOAL_TEMPLATES.find((x) => !x.first && goalAvailable(x) && !P.goals.list.some((y) => y.id === x.id));
      if (alt) Object.assign(g, { id: alt.id, target: alt.min, progress: 0 });
    }
    return;
  }
  // 새 게임 첫날: 첫 원정을 기다리는 동안 할 수 있는 셋 (모닥불 · 손님 말 걸기 · 지붕 색)
  if (!P.goals.day && P.counters.expeditions === 0) {
    P.goals = { day: today(), list: GOAL_TEMPLATES.filter((t) => t.first).map((t) => ({ id: t.id, target: t.min, progress: 0, claimed: false })) };
    return;
  }
  // 지금 할 수 있는 것만 후보로 (잠긴 건물·기능을 시키지 않는다)
  const pool = GOAL_TEMPLATES.filter((t) => !t.first && goalAvailable(t));
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
    if (!t || t.event !== event || g.progress >= g.target) continue;
    g.progress = Math.min(g.target, g.progress + n);
    if (g.progress >= g.target) uiHooks.toast(`오늘의 목표 달성! 「${t.text(g.target)}」 · 메뉴 → 오늘의 목표에서 받아요`);
  }
}

export function claimGoal(i: number): { gold: number; dust?: number } | null {
  const g = P.goals.list[i];
  if (!g || g.claimed || g.progress < g.target) return null;
  const t = GOAL_TEMPLATES.find((x) => x.id === g.id)!;
  g.claimed = true;
  sfx('coin');
  P.counters.goalsClaimed++;
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
  const smith = bestOf('smith', objs);
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
