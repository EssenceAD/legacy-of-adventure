// 대장간(분해 → 가루 · 강화 +1~+10 · 지역 세트 제작 · 레벨) · 텃밭(심기 → 수확 → 주점 식사 품질)
import { bestOf } from './town';
import { towerEnhance } from './facilities';
import { addCrop } from './facilities';
import { SLOTS } from '../data/items';
import { sfx } from '../audio/sfx';
import { CONFIG } from '../data/config';
import { BOSSES, bossById } from '../data/bosses';
import { josa } from '../data/josa';
import { REGIONS, type Grade, type RegionId, type Slot } from '../data/items';
import { addToBag, itemPower, makeItem, rollGrade, TEST } from './items';
import { track } from './progress';
import { legendHooks, markDirty, P, S, world, type Building, type Item } from './state';
import { enhanceBonus, ownerGain, stat } from './owner';
import { bfx, hfx } from './harmony';

const SM = CONFIG.smith;
const homeObjs = () => world.home?.objs ?? world.objs;
export const smithObj = () => bestOf('smith', homeObjs(), true);
export const smithLvl = () => smithObj()?.lvl ?? 0;

// ───────── 분해 ─────────

/** 가루는 등급별로 따로 쌓인다 (일반 장비 → 잿빛 가루 …) */
export const dustOf = (g: Grade) => P.dust[g];

export function salvage(it: Item): number {
  if (it.owner != null || it.locked) return 0;
  const i = P.bag.indexOf(it);
  if (i < 0) return 0;
  P.bag.splice(i, 1);
  const n = SM.salvage[it.grade];
  P.dust[it.grade] += n;
  P.counters.salvaged++;
  track('salvage');
  markDirty();
  return n;
}

/** 안 끼고 있는 일반 장비를 전부 분해 (예전 버튼과 같은 결과 — 강화·세트도 포함, 남기기 없음) */
export function salvageAllCommon(): { count: number; dust: number } {
  const r = salvageBulk(['n'], { upgraded: true, keepBest: false });
  return { count: r.count, dust: r.dust.n ?? 0 };
}

// ───────── HOTFIX14 §2: 등급별 일괄 분해 ─────────
export interface BulkOpts {
  /** 강화 +1 이상 · 세트 장비도 포함 (기본 끔) */
  upgraded?: boolean;
  /** 부위(무기·갑옷·장신구)마다 가방에서 전투력 가장 높은 것 하나는 남김 (기본 켬) */
  keepBest?: boolean;
}
/** 분해 대상 (끼운 것 · 잠금은 늘 빠짐) */
export function bulkTargets(grades: Grade[], o: BulkOpts = {}): Item[] {
  const keep = new Set<Item>();
  if (o.keepBest ?? true)
    for (const s of SLOTS) {
      const best = P.bag.filter((it) => it.slot === s && it.owner == null).sort((a, b) => itemPower(b) - itemPower(a))[0];
      if (best) keep.add(best);
    }
  return P.bag.filter((it) => grades.includes(it.grade) && it.owner == null && !it.locked && !keep.has(it) && (o.upgraded || (it.enh < 1 && !it.set)));
}
/** 미리 보기: 등급별 개수 · 얻을 가루 */
export function bulkPreview(grades: Grade[], o: BulkOpts = {}): Record<Grade, { n: number; dust: number }> {
  const out = {} as Record<Grade, { n: number; dust: number }>;
  for (const g of ['n', 'r', 'e', 'l', 'a'] as Grade[]) out[g] = { n: 0, dust: 0 };
  for (const it of bulkTargets(['n', 'r', 'e', 'l', 'a'], o)) {
    out[it.grade].n++;
    out[it.grade].dust += SM.salvage[it.grade];
  }
  void grades;
  return out;
}
export function salvageBulk(grades: Grade[], o: BulkOpts = {}): { count: number; dust: Partial<Record<Grade, number>> } {
  const dust: Partial<Record<Grade, number>> = {};
  let count = 0;
  for (const it of bulkTargets(grades, o)) {
    const d = salvage(it);
    if (!d) continue;
    dust[it.grade] = (dust[it.grade] ?? 0) + d;
    count++;
  }
  return { count, dust };
}

// ───────── 강화 ─────────

export const enhanceCost = (it: Item) => (it.enh + 1) * (it.enh + 1) * SM.enhanceCost;
/** 강화 가루는 그 장비 등급의 가루로 낸다. +5까지는 실패 없음, +6부터 확률 */
export const enhanceRate = (it: Item) => (it.enh < 5 ? 1 : Math.min(1, (SM.enhanceRates[it.enh - 5] ?? 0) + enhanceBonus() + hfx('enhance') + towerEnhance()));

export function enhance(it: Item): 'ok' | 'fail' | 'max' | 'poor' | 'boss' | 'nosmith' {
  if (!smithObj()) return 'nosmith';
  if (it.enh >= SM.maxEnhance) return 'max';
  const cost = enhanceCost(it);
  if (P.dust[it.grade] < cost) return 'poor';
  const bc = enhanceBossCost(it);
  if (bc && (P.bossMats[bc.boss.id] ?? 0) < bc.n) return 'boss';
  P.dust[it.grade] -= cost;
  if (bc) P.bossMats[bc.boss.id] -= bc.n;
  track('enhance');
  legendHooks.bond('enhanceTry');
  ownerGain('enhance');
  markDirty();
  // 실패해도 단계는 떨어지지 않는다 (가루만 든다)
  if (Math.random() >= enhanceRate(it)) {
    sfx('fail');
    return 'fail';
  }
  sfx('levelup');
  it.enh++;
  P.counters.enhanceMax = Math.max(P.counters.enhanceMax, it.enh);
  return 'ok';
}

// ───────── ECONOMY §2: 초월 +11 ~ +20 ─────────

const TR = () => SM.transcend;
/** 초월 탭이 열렸나 (대장간 Lv5부터) */
export const transcendOpen = () => (smithObj()?.lvl ?? 0) >= TR().smithLv;
/** 다음 초월 단계의 비용 (n = 11 ~ 20) */
export function transcendCost(it: Item) {
  const n = it.enh + 1;
  const k = n - 10;
  return { n, gold: TR().gold * 2 ** (n - 11), mats: TR().mats * k, boss: regionBoss(it.region), bossMats: TR().boss * k, dust: TR().dust * k };
}
export function transcendRate(it: Item): number {
  const n = it.enh + 1;
  const lv = smithObj()?.lvl ?? 0;
  return Math.max(0.05, Math.min(1, TR().rate - TR().step * (n - 11) + TR().perSmithLv * lv + (it.tPity ?? 0)));
}
export type TranscendResult = 'ok' | 'fail' | 'max' | 'locked' | 'notten' | 'gold' | 'mats' | 'boss' | 'dust';
export function transcend(it: Item): TranscendResult {
  if (!transcendOpen()) return 'locked';
  if (it.enh < SM.maxEnhance) return 'notten';
  if (it.enh >= TR().max) return 'max';
  const c = transcendCost(it);
  if (S.gold < c.gold) return 'gold';
  if ((P.mats[it.region] ?? 0) < c.mats) return 'mats';
  if ((P.bossMats[c.boss.id] ?? 0) < c.bossMats) return 'boss';
  if ((P.dust[it.grade] ?? 0) < c.dust) return 'dust';
  const rate = transcendRate(it);
  S.gold -= c.gold;
  P.mats[it.region] -= c.mats;
  P.bossMats[c.boss.id] -= c.bossMats;
  P.dust[it.grade] -= c.dust;
  markDirty();
  if (Math.random() >= rate) {
    // 분재형: 단계는 그대로 · 다음 시도 +5%p
    it.tPity = (it.tPity ?? 0) + TR().pity;
    sfx('fail');
    return 'fail';
  }
  sfx('levelup');
  it.enh++;
  it.tPity = 0;
  // +15 「초월한」 · +20 「극의」 (이름 앞에)
  const base = it.name.replace(/^(초월한|극의) /, '');
  it.name = it.enh >= TR().max ? `극의 ${base}` : it.enh >= TR().nameAt ? `초월한 ${base}` : base;
  P.counters.enhanceMax = Math.max(P.counters.enhanceMax, it.enh);
  return 'ok';
}

// ───────── 제작 ─────────

/** 그 지역 보스 (재료를 주는 보스) */
export const regionBoss = (r: RegionId) => BOSSES.find((b) => b.region === r)!;

export const craftCost = (r: RegionId) => {
  const i = REGIONS.findIndex((x) => x.id === r);
  return { mats: SM.craftMats, dust: SM.craftDust * (i + 1), gold: SM.craftGold * (i + 1), boss: regionBoss(r), bossMats: SM.craftBossMats };
};

/** 강화 한 번에 드는 보스 재료 (+10 이상 올릴 때만) */
export const enhanceBossCost = (it: Item) => (it.enh + 1 >= SM.bossEnhanceFrom ? { boss: regionBoss(it.region), n: SM.bossEnhanceMats } : null);

/** 보스 재료가 모자랄 때 안내 */
export const bossHint = (id: string) => {
  const m = bossById(id)?.mat ?? '보스 재료';
  return `${m}${josa(m, '는')} 「${bossById(id)?.name ?? '보스'}」 토벌에서 얻을 수 있어요`;
};

/** 그 지역 세트 부위를 만든다 (대장간 레벨이 높을수록 좋은 등급) */
export function craft(r: RegionId, slot: Slot): Item | string {
  if (!smithObj()) return '대장간이 필요해요';
  const c = craftCost(r);
  if (P.mats[r] < c.mats) return '재료가 모자라요';
  if (P.dust.n < c.dust) return '가루가 모자라요';
  if (S.gold < c.gold) return '금화가 모자라요';
  if ((P.bossMats[c.boss.id] ?? 0) < c.bossMats) return bossHint(c.boss.id);
  P.mats[r] -= c.mats;
  P.dust.n -= c.dust;
  S.gold -= c.gold;
  P.bossMats[c.boss.id] -= c.bossMats;
  // 주인 손재주 100 = 상위 등급 확률 ×1.5
  const g = rollGrade(r, 1, Math.pow(SM.craftLevelBoost, smithLvl() - 1) * (1 + stat('craft') / 200));
  const it = makeItem(r, g, slot, true);
  addToBag(it);
  P.counters.crafted[r] = (P.counters.crafted[r] ?? 0) + 1;
  track('craft');
  ownerGain('craft');
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
  if (c.land && (world.home?.land ?? S.land) < c.land) return `땅 ${c.land}단계에서 심을 수 있어요`;
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
  const n = GD.crops[p.crop!].yield + bfx(o, 'harvest');
  // BUILDINGS_SPEC §3: 작물별 창고 (주점은 먹을 수 있는 것을 자동으로 · 공방은 골라 쓴다)
  addCrop(p.crop!, n);
  P.counters.harvests++;
  legendHooks.bond('harvest');
  ownerGain('harvest');
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
