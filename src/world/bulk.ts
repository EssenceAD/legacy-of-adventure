// SMITH §2·§3: 일괄 강화(초월 포함) · 일괄 제작 — 계획(미리보기) · 한 번씩 진행(멈춤 가능) · 요약
import { CONFIG } from '../data/config';
import { SLOTS, type Grade, type RegionId, type Slot } from '../data/items';
import { craft, craftCost, enhance, enhanceBossCost, enhanceCost, enhanceRate, transcend, transcendCost, transcendOpen, transcendRate } from './craft';
import { bagSize, itemPower } from './items';
import { P, S, world, type Item } from './state';
import { favRank } from './growth';

const favOf = (it: Item) => {
  const o = it.owner == null ? null : (world.home?.actors ?? world.actors).find((a) => a.id === it.owner);
  return o ? favRank(o) : 99;
};

const SM = () => CONFIG.smith;
export type BulkTarget = 'equipped' | 'bag' | 'pick';
export interface BulkOpts {
  target: BulkTarget;
  /** 목표 강화 단계 (+1 ~ +10, 초월이 열리면 +20) */
  goal: number;
  /** 가진 금화·가루의 이 비율까지만 쓴다 (0~1) */
  budget: number;
  /** 잠금 장비 빼기 */
  skipLocked: boolean;
  /** 직접 고르기 */
  picked?: number[];
  /** GROWTH §3-3: 강화 보호 부적 자동 사용 (하락이 일어날 때만 1개) */
  charm?: boolean;
}
export const maxGoal = () => (transcendOpen() ? SM().transcend.max : SM().maxEnhance);

/** 대상: 끼운 장비 우선 → 전투력이 큰 순 */
export function bulkItems(o: BulkOpts): Item[] {
  return P.bag
    .filter((it) => it.enh < o.goal)
    .filter((it) => (o.target === 'equipped' ? it.owner != null : o.target === 'pick' ? (o.picked ?? []).includes(it.id) : true))
    .filter((it) => !(o.skipLocked && it.locked))
    // GROWTH §3-1: ★ 아끼는 영웅이 낀 장비 먼저
    .sort((a, b) => favOf(a) - favOf(b) || Number(b.owner != null) - Number(a.owner != null) || itemPower(b) - itemPower(a));
}

/** 한 단계 올리는 기대 비용 (실패 확률 반영: 1 / 성공률 번) */
function stepCost(it: Item, enh: number): { gold: number; dust: number; boss: number; bossId: string; mats: number; tries: number } {
  const ghost = { ...it, enh } as Item;
  if (enh < SM().maxEnhance) {
    const rate = Math.max(0.05, enhanceRate(ghost));
    const bc = enhanceBossCost(ghost);
    return { gold: 0, dust: enhanceCost(ghost) / rate, boss: bc ? bc.n / rate : 0, bossId: bc?.boss.id ?? '', mats: 0, tries: 1 / rate };
  }
  const c = transcendCost(ghost);
  const rate = Math.max(0.05, transcendRate({ ...ghost, tPity: enh === it.enh ? it.tPity : 0 } as Item));
  return { gold: c.gold / rate, dust: c.dust / rate, boss: c.bossMats / rate, bossId: c.boss.id, mats: c.mats / rate, tries: 1 / rate };
}

export interface BulkPlan {
  items: number;
  gold: number;
  dust: number;
  boss: number;
  mats: number;
  /** 보스 재료가 모자라 멈출 장비 수 */
  bossShort: number;
  /** 재료별 기대 비용 (미리보기 빨강 −n) — 가루 등급별 · 보스 재료별 · 지역 재료별 */
  by: { dust: Partial<Record<Grade, number>>; boss: Record<string, number>; mats: Partial<Record<RegionId, number>> };
}
/** 미리보기 (기대값) */
export function bulkPlan(o: BulkOpts): BulkPlan {
  const list = bulkItems(o);
  const p: BulkPlan = { items: list.length, gold: 0, dust: 0, boss: 0, mats: 0, bossShort: 0, by: { dust: {}, boss: {}, mats: {} } };
  const add = <K extends string>(m: Partial<Record<K, number>>, k: K, v: number) => v && (m[k] = (m[k] ?? 0) + v);
  const bossLeft: Record<string, number> = { ...P.bossMats };
  for (const it of list) {
    let short = false;
    for (let e = it.enh; e < o.goal; e++) {
      const c = stepCost(it, e);
      p.gold += c.gold;
      p.dust += c.dust;
      p.mats += c.mats;
      add(p.by.dust, it.grade, c.dust);
      add(p.by.mats, it.region, c.mats);
      if (c.boss) add(p.by.boss, c.bossId, c.boss);
      if (c.boss) {
        p.boss += c.boss;
        bossLeft[c.bossId] = (bossLeft[c.bossId] ?? 0) - c.boss;
        if (bossLeft[c.bossId] < 0) short = true;
      }
    }
    if (short) p.bossShort++;
  }
  for (const k of ['gold', 'dust', 'boss', 'mats'] as const) p[k] = Math.round(p[k]);
  for (const m of [p.by.dust, p.by.boss, p.by.mats] as Record<string, number>[]) for (const k in m) m[k] = Math.round(m[k]);
  return p;
}

/** 진행 상태 (한 번 누를 때마다 tick) */
export interface BulkRun {
  o: BulkOpts;
  queue: Item[];
  /** 쓸 수 있는 한도 (시작 때 가진 양 × budget) */
  limGold: number;
  limDust: number;
  spentGold: number;
  spentDust: number;
  /** 대성공으로 건너뛴 단계의 가루 (한 번 두드리는 값 · 형철 판정: 요약에 「아꼈어요」) */
  savedDust: number;
  tries: number;
  fails: number;
  ups: number;
  reached: number;
  stopped: '' | 'done' | 'budget' | 'short' | 'user';
  log: { name: string; to: number; ok: boolean }[];
}
const dustTotal = () => Object.values(P.dust).reduce((s, v) => s + v, 0);
export function startBulk(o: BulkOpts): BulkRun {
  return { o, queue: bulkItems(o), limGold: Math.floor(S.gold * o.budget), limDust: Math.floor(dustTotal() * o.budget), spentGold: 0, spentDust: 0, savedDust: 0, tries: 0, fails: 0, ups: 0, reached: 0, stopped: '', log: [] };
}
/** 한 번 두드린다 · 끝났으면 false */
export function bulkTick(r: BulkRun): boolean {
  if (r.stopped) return false;
  while (r.queue.length && r.queue[0].enh >= r.o.goal) {
    r.reached++;
    r.queue.shift();
  }
  const it = r.queue[0];
  if (!it) {
    r.stopped = 'done';
    return false;
  }
  // 예산: 이번 한 번이 한도를 넘으면 멈춘다
  const trans = it.enh >= SM().maxEnhance;
  const needGold = trans ? transcendCost(it).gold : 0;
  const needDust = trans ? transcendCost(it).dust : enhanceCost(it);
  if (r.spentGold + needGold > r.limGold || r.spentDust + needDust > r.limDust) {
    r.stopped = 'budget';
    return false;
  }
  const g0 = S.gold;
  const d0 = dustTotal();
  const e0 = it.enh;
  const res = trans ? transcend(it) : enhance(it, { charm: !!r.o.charm });
  r.spentGold += g0 - S.gold;
  r.spentDust += d0 - dustTotal();
  if (res === 'ok' || res === 'fail') {
    r.tries++;
    if (res === 'ok') r.ups++;
    // 대성공: 한 번에 2단계 이상 → 건너뛴 단계의 한 번 비용만큼 아낌
    if (res === 'ok' && !trans) for (let e = e0 + 1; e < Math.min(it.enh, r.o.goal); e++) r.savedDust += enhanceCost({ ...it, enh: e } as Item);
    else r.fails++;
    r.log.push({ name: it.name, to: it.enh, ok: res === 'ok' });
    return true;
  }
  // 재료가 모자란 장비는 건너뛴다 (다른 장비는 계속)
  r.queue.shift();
  if (!r.queue.length) r.stopped = r.ups || r.reached ? 'done' : 'short';
  return !!r.queue.length;
}

// ───────── §3 일괄 제작 ─────────

/** 재료·금화·가루·가방으로 만들 수 있는 최대 수 */
export function craftMax(r: RegionId): number {
  const c = craftCost(r);
  const free = bagSize() - P.bag.filter((x) => x.owner == null).length;
  return Math.max(0, Math.min(free, Math.floor(P.mats[r] / Math.max(1, c.mats)), Math.floor(P.dust.n / Math.max(1, c.dust)), Math.floor(S.gold / Math.max(1, c.gold)), c.bossMats ? Math.floor((P.bossMats[c.boss.id] ?? 0) / c.bossMats) : 99));
}
export interface CraftBatch {
  made: Item[];
  /** 멈춘 까닭 (다 만들었으면 '') */
  why: string;
  bagShort: number;
}
/** n개 만들기 (가방이 차면 멈춤) */
export function craftMany(r: RegionId, slots: Slot[]): CraftBatch {
  const made: Item[] = [];
  let why = '';
  for (let i = 0; i < slots.length; i++) {
    const free = bagSize() - P.bag.filter((x) => x.owner == null).length;
    if (free <= 0) {
      why = 'bag';
      return { made, why, bagShort: slots.length - i };
    }
    const it = craft(r, slots[i]);
    if (typeof it === 'string') {
      why = it;
      break;
    }
    made.push(it);
  }
  return { made, why, bagShort: 0 };
}
/** 세트 맞추기: 그 지역 세트에서 아직 없는 부위만 */
export function missingSetSlots(r: RegionId): Slot[] {
  return SLOTS.filter((s) => !P.bag.some((it) => it.set && it.region === r && it.slot === s));
}
