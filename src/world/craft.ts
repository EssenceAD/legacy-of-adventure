// 대장간(분해 → 가루 · 강화 +1~+10 · 지역 세트 제작 · 레벨) · 텃밭(심기 → 수확 → 주점 식사 품질)
import { bestOf, landNeedFor, nextLevelCost } from './town';
import { towerEnhance } from './facilities';
import { gsState } from './goldsink';
import { addCrop } from './facilities';
import { DUST_NAME, SLOTS } from '../data/items';
import { track as trackEv } from '../net/telemetry';
import { sfx } from '../audio/sfx';
import { CONFIG } from '../data/config';
import { BOSSES, bossById } from '../data/bosses';
import { josa } from '../data/josa';
import { REGIONS, type Grade, type RegionId, type Slot } from '../data/items';
import { addToBag, itemPower, makeItem, optSum, rollGrade, TEST } from './items';
import { track } from './progress';
import { legendHooks, markDirty, P, S, wfHit, world, type Building, type Item } from './state';
import { mimiAlt } from './paceGates';
import { enhanceBonus, ownerGain, stat } from './owner';
import { bfx, hfx } from './harmony';
import { enhRateOf, rollEnhance, rollTranscend, trRateOf } from './enhRules';
import { brag, uniqueSalvageMult } from './growth';
import { windHarvest } from './wind';

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
  // GROWTH §3-4: 같은 고유 장비 두 번째부터는 가루 2배
  const n = SM.salvage[it.grade] * uniqueSalvageMult(it);
  P.dust[it.grade] += n;
  // HOTFIX21: 희귀 이상은 잿빛 가루도 같이
  P.dust.n += SM.salvageAsh[it.grade] ?? 0;
  P.counters.salvaged++;
  track('salvage');
  markDirty();
  return n;
}

/** 안 끼고 있는 일반 장비를 전부 분해 (예전 버튼과 같은 결과 — 강화·세트도 포함, 남기기 없음) */
/** 분해 한 개로 얻는 것 (글자) — 「푸른 가루 +25 · 잿빛 가루 +10」 */
export function salvageText(g: Grade): string {
  const ash = SM.salvageAsh[g] ?? 0;
  return `${DUST_NAME[g]} +${SM.salvage[g]}${ash ? ` · ${DUST_NAME.n} +${ash}` : ''}`;
}
/** HOTFIX21: 가루 바꾸기 (높은 가루 → 잿빛) · 바꾼 잿빛 수 */
export function swapDust(g: Grade, count: number): number {
  const rate = SM.dustSwap[g];
  count = Math.min(Math.floor(count), P.dust[g]);
  if (!rate || count <= 0) return 0;
  P.dust[g] -= count;
  P.dust.n += count * rate;
  trackEv('dust_swap', { g, count });
  markDirty();
  return count * rate;
}
/** 잿빛 가루가 need만큼 모자랄 때 푸른 → 보랏빛 → 황금 순으로 채운다 · 채운 잿빛 수 */
export function fillAsh(need: number): number {
  let got = 0;
  for (const g of ['r', 'e', 'l'] as Grade[]) {
    if (got >= need) break;
    const rate = SM.dustSwap[g];
    got += swapDust(g, Math.min(P.dust[g], Math.ceil((need - got) / rate)));
  }
  return got;
}
/** 바꿀 수 있는 잿빛 총량 */
export const swappableAsh = () => (['r', 'e', 'l'] as Grade[]).reduce((s, g) => s + P.dust[g] * (SM.dustSwap[g] ?? 0), 0);

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
export function bulkPreview(grades: Grade[], o: BulkOpts = {}): Record<Grade, { n: number; dust: number; ash?: number }> {
  const out = {} as Record<Grade, { n: number; dust: number; ash?: number }>;
  for (const g of ['n', 'r', 'e', 'l', 'a'] as Grade[]) out[g] = { n: 0, dust: 0 };
  for (const it of bulkTargets(['n', 'r', 'e', 'l', 'a'], o)) {
    out[it.grade].n++;
    out[it.grade].dust += SM.salvage[it.grade];
    out[it.grade].ash = (out[it.grade].ash ?? 0) + (SM.salvageAsh[it.grade] ?? 0);
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
    const ash = SM.salvageAsh[it.grade] ?? 0;
    if (ash) dust.n = (dust.n ?? 0) + ash;
    count++;
  }
  return { count, dust };
}

// ───────── 강화 ─────────

export const enhanceCost = (it: Item) => (it.enh + 1) * (it.enh + 1) * SM.enhanceCost;
/** 강화 성공 보너스 합 (주인 손재주 · 어울림 · 마법사의 탑 · 불꽃 대장장이 세트) */
export const enhanceBonusAll = () => enhanceBonus() + hfx('enhance') + towerEnhance() + setEnhance();
/** GROWTH §3-2: 강화 가루는 그 장비 등급의 가루로 낸다. +1만 확정, 그다음은 목표별 확률 + 보너스 + 그 장비 천장 (+ 숫돌) */
export const enhanceRate = (it: Item, whet = false) => enhRateOf(it.enh, enhanceBonusAll(), it.ePity ?? 0, whet ? CONFIG.growth.whet.add : 0);
/** 마지막 강화·초월의 자세한 결과 (대성공 · 하락 · 부적이 막음 · 쓴 소모품) — 반환값('ok'·'fail')은 예전 그대로 */
export const lastEnh = { great: false, drop: false, saved: false, usedCharm: false, usedWhet: false };
export interface EnhOpts {
  /** 강화 보호 부적 쓰기 (하락이 일어날 때만 1개 쓴다) */
  charm?: boolean;
  /** 행운의 숫돌 쓰기 (이번 시도에 1개) */
  whet?: boolean;
}
/** REGIONS2: 「불꽃 대장장이」 세트 — 마을 단골 중 가장 높은 강화 성공 + */
export const setEnhance = () => Math.max(0, ...(world.home?.actors ?? world.actors).filter((a) => !a.role && a.equip).map((a) => optSum(a, 'enhPct'))) / 100;

export function enhance(it: Item, o: EnhOpts = {}): 'ok' | 'fail' | 'max' | 'poor' | 'boss' | 'nosmith' {
  Object.assign(lastEnh, { great: false, drop: false, saved: false, usedCharm: false, usedWhet: false });
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
  gsState().cnt.smith++;
  ownerGain('enhance');
  markDirty();
  // GROWTH §3-2: 목표별 확률 · +7~+10 실패 30% 하락(부적) · 천장 · 대성공
  const G = P.growth;
  const whet = !!o.whet && G.whet > 0;
  if (whet) {
    G.whet--;
    lastEnh.usedWhet = true;
  }
  const r = rollEnhance(it.enh, it.ePity ?? 0, enhanceBonusAll(), { whet, charm: !!o.charm && G.charm > 0 });
  if (r.saved) {
    G.charm--;
    lastEnh.usedCharm = true;
  }
  const before = it.enh;
  it.enh = r.enh;
  if (r.pity > 0) it.ePity = Math.round(r.pity * 1000) / 1000;
  else delete it.ePity;
  Object.assign(lastEnh, { great: r.great, drop: r.drop, saved: r.saved });
  if (!r.ok) {
    sfx('fail');
    return 'fail';
  }
  sfx(r.great ? 'rare' : 'levelup');
  P.counters.enhanceMax = Math.max(P.counters.enhanceMax, it.enh);
  // PACE R17: 아이템 도감이 거의 다 찼으면 강화 +n 성공도 미미의 「새 칸」
  mimiAlt('enhance', it.enh);
  if (before < SM.maxEnhance && it.enh >= SM.maxEnhance) brag('enh10', it);
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
/** GROWTH §3-2: 목표별(+11 40% → +20 6%) + 대장간 Lv당 + 세트 + 천장(실패마다 +2%p) (+ 숫돌) */
export function transcendRate(it: Item, whet = false): number {
  const lv = smithObj()?.lvl ?? 0;
  return trRateOf(it.enh, TR().perSmithLv * lv + setEnhance(), it.tPity ?? 0, whet ? CONFIG.growth.whet.add : 0);
}
export type TranscendResult = 'ok' | 'fail' | 'max' | 'locked' | 'notten' | 'gold' | 'mats' | 'boss' | 'dust';
export function transcend(it: Item, o: EnhOpts = {}): TranscendResult {
  Object.assign(lastEnh, { great: false, drop: false, saved: false, usedCharm: false, usedWhet: false });
  if (!transcendOpen()) return 'locked';
  if (it.enh < SM.maxEnhance) return 'notten';
  if (it.enh >= TR().max) return 'max';
  const c = transcendCost(it);
  if (S.gold < c.gold) return 'gold';
  if ((P.mats[it.region] ?? 0) < c.mats) return 'mats';
  if ((P.bossMats[c.boss.id] ?? 0) < c.bossMats) return 'boss';
  if ((P.dust[it.grade] ?? 0) < c.dust) return 'dust';
  S.gold -= c.gold;
  gsState().cnt.smith++;
  P.mats[it.region] -= c.mats;
  P.bossMats[c.boss.id] -= c.bossMats;
  P.dust[it.grade] -= c.dust;
  markDirty();
  const whet = !!o.whet && P.growth.whet > 0;
  if (whet) {
    P.growth.whet--;
    lastEnh.usedWhet = true;
  }
  const lv = smithObj()?.lvl ?? 0;
  const r = rollTranscend(it.enh, it.tPity ?? 0, TR().perSmithLv * lv + setEnhance(), { whet });
  if (!r.ok) {
    // 분재형: 단계는 그대로 · 다음 시도 +2%p (GROWTH §3-2)
    it.tPity = Math.round(r.pity * 1000) / 1000;
    sfx('fail');
    return 'fail';
  }
  sfx('levelup');
  it.enh++;
  it.tPity = 0;
  if (it.enh === TR().nameAt || it.enh === TR().max) brag(it.enh === TR().max ? 'tr20' : 'tr15', it);
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
  // REGIONS2: 별을 삼킨 것은 토벌에 안 나온다 → 심연의 바닥 x-10 사냥
  if (bossById(id)?.noRaid) return `${m}${josa(m, '는')} 「심연의 바닥 10」 보스 사냥에서 얻을 수 있어요`;
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

// ───────── GROWTH §3-3: 행운의 숫돌 (잿빛 가루 80 + 그 지역 재료 10 + 금화 2,000 × 지역 배수) ─────────

export const whetCost = (r: RegionId) => {
  const W = CONFIG.growth.whet;
  const i = REGIONS.findIndex((x) => x.id === r);
  return { ash: W.ash, mats: W.mats, gold: W.gold * (i + 1) };
};
export function craftWhet(r: RegionId): string | null {
  if (!smithObj()) return '대장간이 필요해요';
  const c = whetCost(r);
  if ((P.mats[r] ?? 0) < c.mats) return '재료가 모자라요';
  if (P.dust.n < c.ash) return '가루가 모자라요';
  if (S.gold < c.gold) return '금화가 모자라요';
  P.mats[r] -= c.mats;
  P.dust.n -= c.ash;
  S.gold -= c.gold;
  P.growth.whet++;
  wfHit('whet');
  track('craft');
  markDirty();
  return null;
}

// ───────── 대장간 레벨 ─────────

export const smithLevelCost = () => SM.levelCosts[smithLvl()] ?? null;

// ───────── 텃밭 ─────────

const GD = CONFIG.garden;
const scale = () => (TEST ? CONFIG.test.timeScale : 1);

export function plotsOf(o: Building) {
  o.plots ??= [];
  // 텃밭 2레벨마다 밭 +1칸
  const n = gardenPlots(o.lvl);
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
  // DIRECTION §1-2 풍년: 수확 +30%
  const n = windHarvest(GD.crops[p.crop!].yield + bfx(o, 'harvest'));
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

// ───────── v0.25.4 텃밭 레벨업 (gardenLevelUp) ─────────
/** 레벨 → 밭 칸 수 (2레벨마다 +1: Lv.1~2 = 3칸 · Lv.3~4 = 4칸 · Lv.5~6 = 5칸) */
export const gardenPlots = (lvl: number) => GD.plots + Math.floor((lvl - 1) / 2);
/** 텃밭 창 맨 위 줄: up = 올릴 수 있음 · land = 땅 단계 모자람 · con = 공사 중 · max = 끝 */
export function gardenLevelState(o: Building): { lv: number; plots: number; next: number | null; cost: number | null; state: 'up' | 'land' | 'con' | 'max'; needLand: number } {
  const lv = o.lvl;
  const cost = nextLevelCost(o);
  const needLand = landNeedFor(o);
  const base = { lv, plots: gardenPlots(lv), needLand };
  if (o.build !== undefined || o.con) return { ...base, next: null, cost: null, state: 'con' };
  if (cost == null) return { ...base, next: null, cost: null, state: 'max' };
  return { ...base, next: gardenPlots(lv + 1), cost, state: needLand > (world.home?.land ?? S.land) ? 'land' : 'up' };
}
