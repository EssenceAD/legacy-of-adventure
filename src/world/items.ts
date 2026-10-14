// 장비: 만들기(등급·랜덤 옵션·세트) · 천장 · 가방 · 장착 · 옵션 합 · 아이콘
import { bestOf } from './town';
import { sfx } from '../audio/sfx';
import { CONFIG } from '../data/config';
import { heroById } from '../data/heroes';
import { CLASS_WEAPON, GUEST_KINDS, type GuestKind } from '../data/classes';
import { legendByKey } from '../data/legends';
import {
  GRADE_INFO, OPT_INFO, REGIONS, ROLL_KEYS, BASE_REGIONS, SLOT_STATS, SLOTS, WEAPON_KINDS, itemName, regionById,
  type Grade, type OptKey, type RegionId, type Slot, type StatKey,
} from '../data/items';
import { canvas, dk, lt, P as Paint } from '../engine/pixel';
import { P, pick, S, world, type Actor, type Item, type ItemOpt } from './state';
import { dexAddItem } from './progress';
import { brag, checkSet3 } from './growth';
import { starSkillOpt } from './fivestars';

const I = CONFIG.items;
const E = CONFIG.expedition;
const regionIdx = (r: RegionId) => REGIONS.findIndex((x) => x.id === r);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** 시험 모드(?test=1): 천장을 낮춘다 */
export const TEST = typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1';
export const pityLimit = () => (TEST ? CONFIG.test.pity : E.pity);

/** 유물(a) 등급이 나오는 지역: 별의 심연 · 심연의 바닥 (REGIONS2) */
const relicOf = (r: RegionId) => !!regionById(r).relic;
/** 등급 굴리기. 지역 단계·의뢰 길이에 따라 상위 등급 확률이 오르고, 천장에 닿으면 전설 확정 */
export function rollGrade(region: RegionId, tier: number, boost = 1): Grade {
  const ri = regionIdx(region);
  const m = Math.pow(E.regionDrop, ri) * (1 + 0.5 * tier) * boost;
  P.pity[region]++;
  if (P.pity[region] >= pityLimit()) {
    P.pity[region] = 0;
    return relicOf(region) && Math.random() < 0.3 ? 'a' : 'l';
  }
  const r = Math.random();
  const pl = E.baseDrop.l * m;
  const pe = E.baseDrop.e * m;
  const pr = E.baseDrop.r * m;
  let g: Grade = 'n';
  if (r < pl) g = relicOf(region) && Math.random() < 0.3 ? 'a' : 'l';
  else if (r < pl + pe) g = 'e';
  else if (r < pl + pe + pr) g = 'r';
  if (g === 'l' || g === 'a') P.pity[region] = 0;
  return g;
}

export function makeItem(region: RegionId, grade: Grade, slot: Slot = pick(SLOTS), set = Math.random() < 0.3): Item {
  const ri = regionIdx(region);
  const scale = 6 * Math.pow(I.regionStat, ri) * I.gradeMult[grade];
  const stats: Partial<Record<StatKey, number>> = {};
  const [s1, s2] = SLOT_STATS[slot];
  stats[s1] = Math.round(scale * rnd(0.85, 1.15));
  stats[s2] = Math.round(scale * 0.5 * rnd(0.7, 1.2));
  const opts: ItemOpt[] = [];
  const keys = ROLL_KEYS;
  for (let i = 0; i < I.gradeOpts[grade]; i++) {
    const k = pick(keys.filter((x) => !opts.some((o) => o.k === x)));
    const inf = OPT_INFO[k];
    const v = Math.round(rnd(inf.min, inf.max) * (1 + 0.25 * ri));
    opts.push(k === 'regionDmg' ? { k, v, region: pick(REGIONS.slice(0, Math.max(BASE_REGIONS, ri + 1))).id } : { k, v });
  }
  const wkind = slot === 'weapon' ? pick(WEAPON_KINDS) : undefined;
  const it: Item = {
    id: P.nextItemId++, region, slot, grade, wkind, stats, opts, enh: 0, set,
    name: itemName(region, slot, wkind, (Math.random() * 1000) | 0),
  };
  if (grade === 'a') it.uniq = regionById(region).relic ?? '별빛의 가호';
  return it;
}

/** 강화 반영 능력치 */
export function itemStat(it: Item, k: StatKey): number {
  return Math.round((it.stats[k] ?? 0) * (1 + it.enh * I.enhancePct));
}
export const itemPower = (it: Item) => Object.keys(it.stats).reduce((s, k) => s + itemStat(it, k as StatKey), 0);

// ───────── 핫픽스 12 §1-1: 직업 무기 궁합 ─────────
/** 이 손님 직업에 맞는 무기인가 (무기가 아니면 null) */
export function fitsClass(a: Pick<Actor, 'kind'>, it: Pick<Item, 'slot' | 'wkind'>): boolean | null {
  if (it.slot !== 'weapon' || !it.wkind) return null;
  const kind = (GUEST_KINDS as readonly string[]).includes(a.kind) ? (a.kind as GuestKind) : 'knight';
  return CLASS_WEAPON[kind] === it.wkind;
}
/** 이 손님이 꼈을 때의 능력치 — 맞는 무기면 공격·마력 +15% */
export function gearStat(a: Pick<Actor, 'kind'>, it: Item, k: StatKey): number {
  const v = itemStat(it, k);
  return fitsClass(a, it) && (k === 'atk' || k === 'mag') ? Math.round(v * (1 + I.classWeaponBonus)) : v;
}

// ───────── 가방 ─────────

export const bagSize = () => {
  const smith = bestOf('smith');
  return I.bagBase + (smith ? (smith.lvl - 1) * I.bagPerSmithLevel : 0);
};

/** 가방에 넣기. 도감에 처음이면 NEW!. 가득 차면(자동 분해 켜짐 + 일반) 가루로 */
export function addToBag(it: Item): 'ok' | 'salvaged' | 'full' {
  it.isNew = dexAddItem(it);
  const inBag = P.bag.filter((x) => !x.owner).length;
  if (inBag >= bagSize()) {
    // HOTFIX14 §2: 자동 분해 등급 (옛 저장의 켬 = 일반)
    const lv = P.salvage?.auto || (P.autoSalvage ? 'n' : '');
    if (!it.locked && ((lv === 'n' && it.grade === 'n') || (lv === 'r' && (it.grade === 'n' || it.grade === 'r')))) {
      P.dust[it.grade] += CONFIG.smith.salvage[it.grade];
      return 'salvaged';
    }
    // 가득 차도 버리지는 않는다 (넘친 칸은 빨갛게 보여 준다)
    P.bag.push(it);
    return 'full';
  }
  P.bag.push(it);
  if (S.started) sfx(['e', 'l', 'a'].includes(it.grade) ? 'rare' : 'item');
  // GROWTH §3-5: 유물은 [알림] 자랑 (고유 장비는 grantUnique가 따로)
  if (S.started && it.grade === 'a' && !it.uid) brag('relic', it);
  return 'ok';
}

export const itemById = (id: number | null | undefined) => (id == null ? undefined : P.bag.find((x) => x.id === id));

export function equippedItems(a: Actor): Item[] {
  if (!a.equip) return [];
  const out: Item[] = [];
  for (const s of SLOTS) {
    const it = itemById(a.equip[s]);
    if (it) out.push(it);
  }
  return out;
}

/** 끼우기 (다른 손님이 끼고 있었으면 빼서 옮긴다) */
export function equip(a: Actor, it: Item) {
  if (it.owner != null && it.owner !== a.id) {
    const prev = world.actors.find((x) => x.id === it.owner);
    if (prev) prev.equip[it.slot] = null;
  }
  const old = itemById(a.equip[it.slot]);
  if (old) old.owner = null;
  a.equip[it.slot] = it.id;
  it.owner = a.id;
  it.isNew = false;
  // GROWTH §3-5: 세트 3부위 첫 완성 자랑
  if (it.set && S.started) checkSet3(a);
}

export function unequip(a: Actor, slot: Slot) {
  const it = itemById(a.equip[slot]);
  if (it) it.owner = null;
  a.equip[slot] = null;
}

/** 장비 옵션 + 세트 효과 + 영웅 기술의 합 (예: timeCut 12 → −12%) */
export function optSum(a: Actor, k: OptKey, region?: RegionId): number {
  return optSumOf(a, equippedItems(a), k, region);
}
/** 끼운 장비 대신 주어진 장비로 (추천 장착 계산용) */
export function optSumOf(a: Actor, items: Item[], k: OptKey, region?: RegionId): number {
  let v = 0;
  for (const it of items) for (const o of it.opts) if (o.k === k && (k !== 'regionDmg' || o.region === region)) v += o.v;
  // 세트: 같은 지역 세트 부위 2·3개
  const count: Partial<Record<RegionId, number>> = {};
  for (const it of items) if (it.set) count[it.region] = (count[it.region] ?? 0) + 1;
  for (const [r, n] of Object.entries(count) as [RegionId, number][]) {
    const s = regionById(r).set;
    if (n >= 2 && s.two.k === k && (k !== 'regionDmg' || r === region)) v += s.two.v;
    if (n >= 3 && s.three.k === k && (k !== 'regionDmg' || r === region)) v += s.three.v;
  }
  if (a.heroId) {
    const sk = heroById(a.heroId)?.skill;
    if (sk && sk.k === k) v += sk.v * (1 + 0.2 * ((a.stars ?? 1) - 1));
  }
  if (a.legendId) {
    // 전설 고유 기술: ★3부터 강화(×1.5)
    const sk = legendByKey(a.legendId)?.skill;
    if (sk && sk.k === k && (k !== 'regionDmg' || sk.region === region)) v += sk.v * ((a.stars ?? 1) >= 3 ? 1.5 : 1);
  }
  // FIVESTARS: 다섯 별 신화 영웅 고유 스킬 (플래그 fiveStars)
  if (a.starId) v += starSkillOpt(a, k);
  return v;
}

// ───────── 아이콘 (16×16 도트: 부위 모양 × 등급 색 × 소재 색) ─────────

const ICONS: Record<string, string> = {};
export function itemIcon(it: Pick<Item, 'slot' | 'grade' | 'region' | 'wkind'>): string {
  const key = `${it.slot}|${it.grade}|${it.region}|${it.wkind ?? ''}`;
  if (ICONS[key]) return ICONS[key];
  const c = canvas(16, 16);
  const p = Paint(c.getContext('2d')!);
  const g = GRADE_INFO[it.grade];
  const mat = regionById(it.region).color;
  p.rect(0, 0, 16, 16, '#1c1018');
  p.rect(1, 1, 14, 14, g.dark);
  p.rect(1, 1, 14, 1, g.color);
  p.rect(1, 14, 14, 1, g.color);
  p.rect(1, 1, 1, 14, g.color);
  p.rect(14, 1, 1, 14, g.color);
  const metal = it.grade === 'n' ? '#c9d1dc' : lt(g.color, 0.3);
  if (it.slot === 'weapon') {
    const w = it.wkind ?? 'sword';
    if (w === 'sword') {
      for (let i = 0; i < 7; i++) p.px(4 + i, 11 - i, metal);
      p.rect(3, 10, 3, 3, mat);
    } else if (w === 'axe') {
      for (let i = 0; i < 8; i++) p.px(4 + i, 12 - i, '#8a5a34');
      p.rect(8, 3, 4, 5, metal);
    } else if (w === 'staff') {
      for (let i = 0; i < 9; i++) p.px(4 + i, 13 - i, '#8a5a34');
      p.ell(11.5, 4.5, 2.2, 2.2, mat);
    } else if (w === 'dagger') {
      for (let i = 0; i < 4; i++) p.px(6 + i, 10 - i, metal);
      p.rect(4, 10, 3, 2, mat);
    } else if (w === 'bow') {
      // PARTY §1: 활 — 나무 활대(호) + 시위 + 소재 색 손잡이
      for (let i = 0; i < 9; i++) p.px(4 + i, 12 - i, metal);
      for (const [x, y] of [[4, 11], [4, 10], [5, 8], [6, 6], [8, 5], [10, 4], [11, 4], [12, 4], [13, 3]] as const) p.px(x, y, '#8a5a34');
      for (const [x, y] of [[5, 12], [7, 12], [9, 11], [11, 9], [12, 7], [13, 5]] as const) p.px(x, y, '#8a5a34');
      p.rect(7, 7, 2, 2, mat);
    } else {
      p.rect(4, 4, 8, 9, mat);
      p.rect(5, 5, 6, 7, dk(mat, 0.35));
      p.rect(7, 6, 2, 3, metal);
    }
  } else if (it.slot === 'armor') {
    p.rect(4, 4, 8, 9, metal);
    p.rect(6, 4, 4, 2, g.dark);
    p.rect(4, 8, 8, 1, mat);
    p.rect(3, 4, 1, 4, metal);
    p.rect(12, 4, 1, 4, metal);
  } else {
    p.ell(8, 9, 3.5, 3.5, '#e8b94a');
    p.ell(8, 9, 2, 2, g.dark);
    p.rect(7, 3, 3, 3, mat);
  }
  return (ICONS[key] = c.toDataURL());
}

/** 등급 굴림 확률 미리보기 (보상 표시) */
export function dropChances(region: RegionId, tier: number) {
  const m = Math.pow(E.regionDrop, regionIdx(region)) * (1 + 0.5 * tier);
  // 깊은 지역·긴 의뢰는 합이 100%를 넘는다 → 희귀를 남은 몫으로 자른다 (굴림 결과는 같다: 일반이 안 나올 뿐)
  const l = Math.min(1, E.baseDrop.l * m);
  const e = Math.min(1 - l, E.baseDrop.e * m);
  return { r: Math.max(0, Math.min(1 - l - e, E.baseDrop.r * m)), e, l };
}
