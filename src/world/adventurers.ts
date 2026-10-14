// 모험가(손님) 만들기 · 능력치 · 경험치 · 전투력 · 겉모습
import { specialSum } from './uniques';
import { sfx } from '../audio/sfx';
import { isMythic, mythicStat } from './mythic';
import { vis } from './visual';
import { CAMEO_DEF } from './easter';
import { libraryXp } from './facilities';
import {
  CLASS_RACES, CLASS_STATS, CLASS_WEAPON, CLASSES, FACE_POOL, GUEST_KINDS, HAIR_COLORS, RACE_NAMES, RARITY_INFO,
  type ClassDef, type ClassKey, type Face, type GuestKind, type Race, type Rarity,
} from '../data/classes';
import { CONFIG } from '../data/config';
import { HUNTER_NAMES } from '../data/story/hunter';
import { heroById } from '../data/heroes';
import { GRADE_INFO, STATS, type StatKey } from '../data/items';
import { P, pick, S, world, type Actor, type Item } from './state';
import { equippedItems, gearStat, optSum, optSumOf } from './items';
import { dexBonus, heroStarBonus } from './progress';
import { bondTierBonus, legacyPower, ownerBonus, xpMult } from './owner';
import { legendByKey } from '../data/legends';
import { ownerLook } from '../data/origins';
import { isStarId, STARS } from '../data/fivestars';

const G = CONFIG.guests;

/** npc(우체부·노주인)·이웃 마을 구경꾼처럼 저장하지 않는 캐릭터도 같은 모양으로 만든다 */
export function blankActor(kind: ClassKey, name: string, x: number, y: number, role?: Actor['role']): Actor {
  return {
    kind, name, x, y, dir: 1, back: false, st: 'idle', t: Math.random() * 2, ph: Math.random() * 9, role, path: null,
    lvl: 1, hp: 80, food: 80, mood: 80, hidden: false, at: null,
    id: 0, race: 'human', rarity: 'common', xp: 0, status: 'visitor', leaveDay: 0, moodSum: 0, moodN: 0,
    equip: { weapon: null, armor: null, acc: null }, runId: null,
  };
}

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

/** 새 방문 손님 (또는 단골) */
export function makeAdventurer(x: number, y: number, opt: { kind?: GuestKind; race?: Race; rarity?: Rarity; lvl?: number; status?: Actor['status']; day?: number } = {}): Actor {
  const kind = opt.kind ?? pick(GUEST_KINDS);
  const race = opt.race ?? pick(CLASS_RACES[kind]);
  const roll = Math.random();
  const rarity: Rarity = opt.rarity ?? (roll < G.legendChance ? 'legend' : roll < G.legendChance + G.rareChance ? 'special' : 'common');
  const used = new Set(world.actors.map((a) => a.name));
  // PARTY §1: 사냥꾼은 사냥꾼 이름표에서 (다 쓰였으면 종족 이름)
  const names = kind === 'hunter' ? [...HUNTER_NAMES] : RACE_NAMES[race];
  const pool = names.filter((n) => !used.has(n));
  const a = blankActor(kind, pool.length ? pick(pool) : pick(RACE_NAMES[race]), x, y);
  a.id = P.nextAdvId++;
  a.race = race;
  a.rarity = rarity;
  a.status = opt.status ?? 'visitor';
  a.lvl = opt.lvl ?? rnd(1, 4);
  a.hp = rnd(60, 95);
  a.food = rnd(50, 90);
  a.mood = rnd(55, 85);
  a.leaveDay = (opt.day ?? 1) + rnd(G.stayDaysMin, G.stayDaysMax);
  if (rarity !== 'common') {
    // 특별·전설은 얼굴·머리색이 무작위 조합
    a.face = {
      eyes: pick(FACE_POOL.eyes),
      mouth: pick(FACE_POOL.mouth),
      brow: pick(FACE_POOL.brow),
      freckle: Math.random() < 0.3,
      scar: Math.random() < 0.2,
      glasses: Math.random() < 0.1,
    };
    a.hair = pick(HAIR_COLORS);
  }
  return a;
}

/** 영웅 손님 */
export function makeHero(id: string, x: number, y: number): Actor {
  const h = heroById(id)!;
  const a = makeAdventurer(x, y, { kind: h.kind, race: h.race, rarity: 'legend', lvl: 10, status: 'visitor' });
  a.name = h.name;
  a.heroId = id;
  a.hair = h.hair;
  a.stars = 1;
  a.leaveDay = 1e9;
  return a;
}

/** 전설 영웅 손님 (방문 → 부탁 완수 시 영입) */
export function makeLegend(key: string, x: number, y: number): Actor {
  const L = legendByKey(key)!;
  const a = makeAdventurer(x, y, { kind: L.kind, race: L.race, rarity: 'legend', lvl: 15, status: 'visitor' });
  a.name = L.name;
  a.legendId = key;
  a.hair = L.hair;
  a.stars = 1;
  a.leaveDay = 1e9;
  a.hp = a.food = a.mood = 95;
  a.goldSteps = CONFIG.legends.goldStepsSeconds;
  return a;
}

// ───────── 능력치 · 경험치 ─────────

const guestKind = (a: Actor): GuestKind => (GUEST_KINDS as readonly string[]).includes(a.kind) ? (a.kind as GuestKind) : 'knight';

/** 레벨·희귀도로 정해지는 기본 능력치 */
export function baseStats(a: Actor): Record<StatKey, number> {
  const b = CLASS_STATS[guestKind(a)];
  // FIVESTARS: 다섯 별 신화 영웅은 전설 기준 (그 위 ×1.15는 mythicStat)
  const mult = RARITY_INFO[a.rarity].mult * (a.legendId || a.starId ? 1.4 : a.heroId ? 1.25 : 1) * (1 + 0.12 * (a.lvl - 1));
  const o = {} as Record<StatKey, number>;
  for (const k of STATS) o[k] = Math.round(b[k] * mult);
  return o;
}

/** 기본 + 장비 */
export function totalStats(a: Actor): Record<StatKey, number> {
  const o = baseStats(a);
  const items = equippedItems(a);
  for (const it of items) for (const k of STATS) o[k] += gearStat(a, it, k);
  // GROWTH §3-4 고유 효과 「모든 능력치 +5%」
  const all = specialSum(a, 'allStat', items);
  if (all) for (const k of STATS) o[k] = Math.round(o[k] * (1 + all / 100));
  return o;
}

export const xpToNext = (lvl: number) => 40 + lvl * 25;

/** 경험치를 주고 레벨이 오르면 true */
export function gainXp(a: Actor, n: number): boolean {
  if (a.lvl >= G.maxLevel) return false;
  a.xp += Math.round(n * (1 + optSum(a, 'xpPct') / 100) * xpMult() * (1 + libraryXp()));
  let up = false;
  while (a.lvl < G.maxLevel && a.xp >= xpToNext(a.lvl)) {
    a.xp -= xpToNext(a.lvl);
    a.lvl++;
    up = true;
  }
  if (up && S.started && !S.visiting) sfx('levelup');
  return up;
}

// ───────── 전투력 ─────────

/**
 * 전투력 = (레벨 기본치 + 장비 합) × (1 + 도감 보너스% + 영웅★ 보너스% + 장비 옵션 전투력% + 주인 보너스%) × 전설★ × 인연 단계 × 케미 배율
 * 성장 수단은 레벨·장비·도감·케미 넷뿐. 4단계: 주인 보너스(최대 +15%) · 인연 단계(+2%/단계) · 유산 보너스(본 엔딩)
 */
export function powerOf(a: Actor, chemMult = 1): number {
  return powerCalc(a, chemMult)(equippedItems(a));
}
/** 핫픽스 12 §1: 장비만 바꿔 가며 전투력을 빨리 재는 함수 (장비와 상관없는 배수는 한 번만) */
export function powerCalc(a: Actor, chemMult = 1): (items: Item[]) => number {
  const base = Object.values(baseStats(a)).reduce((s, v) => s + v, 0);
  const m0 = 1 + dexBonus() + heroStarBonus() + ownerBonus() + legacyPower(a);
  // 전설 영웅: ★ 하나 오를 때마다 +8%
  const legend = a.legendId ? 1 + CONFIG.legends.starPowerPct * ((a.stars ?? 1) - 1) : 1;
  // MYTHIC: 신화 영웅 능력치 ×1.15
  const rest = legend * (1 + bondTierBonus(a)) * chemMult * mythicStat(a);
  return (items) => {
    let gear = 0;
    for (const it of items) for (const k of STATS) gear += gearStat(a, it, k);
    // GROWTH §3-4 고유 효과 「모든 능력치 +5%」
    const all = items.some((it) => it.uid) ? 1 + specialSum(a, 'allStat', items) / 100 : 1;
    return Math.round((base + gear) * all * (m0 + optSumOf(a, items, 'atkPct') / 100) * rest);
  };
}

// ───────── 겉모습 ─────────

/** 그림에 쓸 직업 정의: 종족·얼굴·머리색·끼운 무기를 반영 */
export function appearance(a: Actor): { key: string; def: ClassDef } {
  const base = CLASSES[a.kind];
  // 여관 주인(나): 직업별 옷 + 초상화에 맞춘 머리색
  if (a.role === 'owner' && P.owner) return { key: `owner|${P.owner.job}|${P.owner.gender}`, def: ownerLook(P.owner.job, P.owner.gender) };
  if (a.role || !(GUEST_KINDS as readonly string[]).includes(a.kind)) return { key: a.kind, def: base };
  const def: ClassDef = { ...base, face: { ...base.face, ...(a.face as Face | undefined) } };
  // 종족
  def.elf = a.race === 'elf';
  def.dwarf = a.race === 'dwarf' || a.race === 'halfling';
  def.beard = a.race === 'dwarf' ? a.hair ?? base.beard ?? base.hair : undefined;
  if (a.kind === 'dwarf' && a.race !== 'dwarf') def.helm = base.helm;
  if (a.hair) def.hair = a.hair;
  // 끼운 무기: 종류와 등급 색
  const w = equippedItems(a).find((it) => it.slot === 'weapon');
  def.weapon = w?.wkind ?? CLASS_WEAPON[guestKind(a)];
  def.weaponColor = w && w.grade !== 'n' ? GRADE_INFO[w.grade].color : undefined;
  // 전설 ★5: 전용 「유산 무기」 (금빛)
  if (a.legendId && (a.stars ?? 1) >= 5) def.weaponColor = '#ffd36b';
  // EASTER §2·§5: 놀러 온 개척자 — 고정 소품
  if (a.cameo && a.cameo in CAMEO_DEF) return { key: 'cameo|' + a.cameo, def: { ...def, ...CAMEO_DEF[a.cameo as keyof typeof CAMEO_DEF] } };
  let key = [a.kind, a.race, a.hair ?? '', JSON.stringify(a.face ?? ''), def.weapon, def.weaponColor ?? ''].join('|');
  // HERODOT 3 (heroDotV2 켰을 때만): 전설·이름 있는 영웅은 고정 겉모습 · 신화 표시 — 끄면 예전 그대로 (키도 그대로)
  // FIVESTARS ④ (fiveStars 켰을 때만): 다섯 별은 신화 단계 고정 겉모습 · 고유 무기 모양(웅스 양손 대검 등) — 끄면 예전 그대로 (키도 그대로)
  if (isStarId(a.starId) && vis('fiveStars')) {
    def.weapon = STARS[a.starId].weapon as ClassDef['weapon'];
    def.named = 'star_' + a.starId;
    def.mythic = true;
    return { key: key + '|S:' + a.starId, def };
  }
  const named = a.legendId ?? a.heroId;
  if (named && vis('heroDotV2')) {
    def.named = named;
    def.mythic = isMythic(a);
    key += '|N:' + named + (def.mythic ? ':M' : '');
  }
  return { key, def };
}
