// 대장간(분해 → 가루 · 강화 +1~+10 · 지역 세트 제작 · 레벨) · 텃밭(심기 → 수확 → 주점 식사 품질)
import { CONFIG } from '../data/config';
import { REGIONS, type Grade, type RegionId, type Slot } from '../data/items';
import { addToBag, makeItem, rollGrade, TEST } from './items';
import { track } from './progress';
import { legendHooks, markDirty, P, S, world, type Building, type Item } from './state';

const SM = CONFIG.smith;
const homeObjs = () => world.home?.objs ?? world.objs;
export const smithObj = () => homeObjs().find((o) => o.kind === 'smith' && o.build === undefined);
export const smithLvl = () => smithObj()?.lvl ?? 0;

// ───────── 분해 ─────────

/** 가루는 등급별로 따로 쌓인다 (일반 장비 → 잿빛 가루 …) */
export const dustOf = (g: Grade) => P.dust[g];

export function salvage(it: Item): number {
  if (it.owner != null) return 0;
  const i = P.bag.indexOf(it);
  if (i < 0) return 0;
  P.bag.splice(i, 1);
  const n = SM.salvage[it.grade];
  P.dust[it.grade] += n;
  track('salvage');
  markDirty();
  return n;
}

/** 안 끼고 있는 일반 장비를 전부 분해 */
export function salvageAllCommon(): { count: number; dust: number } {
  let count = 0;
  let d = 0;
  for (const it of [...P.bag]) {
    if (it.grade !== 'n' || it.owner != null) continue;
    d += salvage(it);
    count++;
  }
  return { count, dust: d };
}

// ───────── 강화 ─────────

export const enhanceCost = (it: Item) => (it.enh + 1) * (it.enh + 1) * SM.enhanceCost;
/** 강화 가루는 그 장비 등급의 가루로 낸다. +5까지는 실패 없음, +6부터 확률 */
export const enhanceRate = (it: Item) => (it.enh < 5 ? 1 : SM.enhanceRates[it.enh - 5] ?? 0);

export function enhance(it: Item): 'ok' | 'fail' | 'max' | 'poor' | 'nosmith' {
  if (!smithObj()) return 'nosmith';
  if (it.enh >= SM.maxEnhance) return 'max';
  const cost = enhanceCost(it);
  if (P.dust[it.grade] < cost) return 'poor';
  P.dust[it.grade] -= cost;
  track('enhance');
  legendHooks.bond('enhanceTry');
  markDirty();
  // 실패해도 단계는 떨어지지 않는다 (가루만 든다)
  if (Math.random() >= enhanceRate(it)) return 'fail';
  it.enh++;
  P.counters.enhanceMax = Math.max(P.counters.enhanceMax, it.enh);
  return 'ok';
}

// ───────── 제작 ─────────

export const craftCost = (r: RegionId) => {
  const i = REGIONS.findIndex((x) => x.id === r);
  return { mats: SM.craftMats, dust: SM.craftDust * (i + 1), gold: SM.craftGold * (i + 1) };
};

/** 그 지역 세트 부위를 만든다 (대장간 레벨이 높을수록 좋은 등급) */
export function craft(r: RegionId, slot: Slot): Item | string {
  if (!smithObj()) return '대장간이 필요해요';
  const c = craftCost(r);
  if (P.mats[r] < c.mats) return '재료가 모자라요';
  if (P.dust.n < c.dust) return '가루가 모자라요';
  if (S.gold < c.gold) return '금화가 모자라요';
  P.mats[r] -= c.mats;
  P.dust.n -= c.dust;
  S.gold -= c.gold;
  const g = rollGrade(r, 1, Math.pow(SM.craftLevelBoost, smithLvl() - 1));
  const it = makeItem(r, g, slot, true);
  addToBag(it);
  P.counters.crafted[r] = (P.counters.crafted[r] ?? 0) + 1;
  track('craft');
  markDirty();
  return it;
}

// ───────── 대장간 레벨 ─────────

export const smithLevelCost = () => SM.levelCosts[smithLvl()] ?? null;

// ───────── 텃밭 ─────────

const GD = CONFIG.garden;
const scale = () => (TEST ? CONFIG.test.timeScale : 1);

export function plotsOf(o: Building) {
  o.plots ??= [];
  // 텃밭 2레벨마다 밭 +1칸
  const n = GD.plots + Math.floor((o.lvl - 1) / 2);
  while (o.plots.length < n) o.plots.push({ crop: null, at: 0 });
  return o.plots;
}

/** 남은 시간(ms). 0이면 다 자람, null이면 빈 칸 */
export function plotLeft(p: { crop: string | null; at: number }, now = Date.now()): number | null {
  if (!p.crop) return null;
  const c = GD.crops[p.crop];
  return Math.max(0, p.at + c.minutes * 60000 * scale() - now);
}

export function plant(o: Building, i: number, crop: string): string | null {
  const p = plotsOf(o)[i];
  const c = GD.crops[crop];
  if (!p || !c) return '심을 수 없어요';
  if (p.crop) return '이미 자라는 중이에요';
  if (S.gold < c.seed) return '금화가 모자라요';
  S.gold -= c.seed;
  p.crop = crop;
  p.at = Date.now();
  markDirty();
  return null;
}

export function harvest(o: Building, i: number): number {
  const p = plotsOf(o)[i];
  if (!p || plotLeft(p) !== 0) return 0;
  const n = GD.crops[p.crop!].yield;
  P.pantry += n;
  P.counters.harvests++;
  legendHooks.bond('harvest');
  legendHooks.req('newCrop', 1, p.crop!);
  p.crop = null;
  p.at = 0;
  track('harvest');
  markDirty();
  return n;
}

/** 다 자란 칸 수 (마을 전체) */
export function ripeCount(): number {
  let n = 0;
  for (const o of homeObjs()) if (o.kind === 'garden') for (const p of plotsOf(o)) if (plotLeft(p) === 0) n++;
  return n;
}
