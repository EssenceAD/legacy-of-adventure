// CHECKIN §J7 대장간 「영웅 중심 한 화면」 (플래그 smithOne · 실험실) — 화면 없는 규칙만 (시험용)
//  · 「지금 할 만한 것」 고르기 (최대 2개 · 가방 꽉 참 > ★ 초월 가능 > 강화 가능)
//  · 장비 칸 하나 → 행동 판에 보일 행동 (+10 미만 = 강화 · +10 = 초월 · 재련 가능하면 작은 [재련])
//  · 영웅 줄 (★ 먼저 → 전투력) · 영웅 줄에 없는 장비는 「가방 장비」로
import { CONFIG } from '../data/config';
import { SLOT_NAME, SLOTS, type Slot } from '../data/items';
import { powerOf } from './adventurers';
import { bulkTargets, enhanceBossCost, enhanceCost, enhanceRate, smithObj, transcendCost, transcendOpen, transcendRate } from './craft';
import { favRank } from './growth';
import { bagSize, itemById } from './items';
import { P, S, world, type Actor, type Item } from './state';

const SM = () => CONFIG.smith;
const homeActors = () => world.home?.actors ?? world.actors;

/** 강화 비용이 모자라나 (가루 · 보스 재료) — 대장간 강화 탭과 같은 기준 */
export function enhShort(it: Item): boolean {
  const bc = enhanceBossCost(it);
  return (P.dust[it.grade] ?? 0) < enhanceCost(it) || (!!bc && (P.bossMats[bc.boss.id] ?? 0) < bc.n);
}
/** 초월 비용이 모자라나 (금화 · 지역 재료 · 보스 재료 · 가루) — 초월 탭과 같은 기준 */
export function trShort(it: Item): boolean {
  const c = transcendCost(it);
  return S.gold < c.gold || (P.mats[it.region] ?? 0) < c.mats || (P.bossMats[c.boss.id] ?? 0) < c.bossMats || (P.dust[it.grade] ?? 0) < c.dust;
}

export type MainAct = 'empty' | 'nosmith' | 'enhance' | 'transcend' | 'locked' | 'max';
export interface SlotAct {
  /** 행동 판의 큰 버튼 하나 */
  main: MainAct;
  /** 옆에 작은 [재련] (옵션 있는 희귀 이상 — 재련 탭과 같은 기준) */
  reforge: boolean;
  /** 비용이 모자라 큰 버튼이 회색 */
  short: boolean;
  /** 성공률 (강화·초월일 때) */
  rate: number;
}
/** 장비 칸 하나 → 행동 판 (규칙: +10 미만 강화 · +10 초월(대장간 Lv.5부터, 아니면 잠김) · +20 최고) */
export function slotAction(it: Item | undefined, whet = false): SlotAct {
  if (!it) return { main: 'empty', reforge: false, short: false, rate: 0 };
  const reforge = it.grade !== 'n' && it.opts.length > 0;
  if (!smithObj()) return { main: 'nosmith', reforge, short: true, rate: 0 };
  if (it.enh < SM().maxEnhance) return { main: 'enhance', reforge, short: enhShort(it), rate: enhanceRate(it, whet) };
  if (!transcendOpen()) return { main: 'locked', reforge, short: true, rate: 0 };
  if (it.enh >= SM().transcend.max) return { main: 'max', reforge, short: true, rate: 0 };
  return { main: 'transcend', reforge, short: trShort(it), rate: transcendRate(it, whet) };
}

/** 영웅 줄: 단골·영웅 동료 + (그 밖에) 장비를 낀 사람 — ★ 먼저(★한 순서) → 전투력 큰 순 */
export function smithHeroes(): Actor[] {
  const owners = new Set(P.bag.map((it) => it.owner).filter((x): x is number => x != null));
  const list = homeActors().filter((a) => !!a.id && !a.cameo && !a.role && ((a.status === 'regular' || a.status === 'hero') || owners.has(a.id)));
  const pw = new Map(list.map((a) => [a, powerOf(a)]));
  return list.sort((a, b) => favRank(a) - favRank(b) || pw.get(b)! - pw.get(a)! || a.id - b.id);
}
/** 「가방 장비」: 아무도 안 낀 것 + 영웅 줄에 없는 주인이 낀 것 (잃는 것 없게) */
export function bagGear(heroes: Actor[] = smithHeroes()): Item[] {
  const ids = new Set(heroes.map((a) => a.id));
  return P.bag.filter((it) => it.owner == null || !ids.has(it.owner));
}
/** 영웅이 낀 장비 (칸 순서) */
export const heroGear = (a: Actor): { slot: Slot; it: Item | undefined }[] => SLOTS.map((slot) => ({ slot, it: itemById(a.equip?.[slot]) }));

export type PickKind = 'bag' | 'transcend' | 'enhance';
export interface SmithPick {
  kind: PickKind;
  text: string;
  /** 누르면 갈 탭: 0 장비 손질 · 2 가방 정리 */
  tab: 0 | 2;
  hero?: number;
  slot?: Slot;
}
const pctTxt = (r: number) => `${Math.round(Math.min(1, r) * 100)}%`;
/** 맨 위 「지금 할 만한 것」 (최대 n개): 가방 꽉 참 → ★ 영웅 장비 +10 초월 가능 → 강화 가능(★ 먼저 · 성공률 높은 것) */
export function smithPicks(max = 2): SmithPick[] {
  const out: SmithPick[] = [];
  const free = bagSize() - P.bag.filter((x) => x.owner == null).length;
  if (free <= 0) {
    const n = bulkTargets(['n', 'r'], { upgraded: false, keepBest: P.salvage.keepBest }).length;
    out.push({ kind: 'bag', tab: 2, text: n ? `가방 꽉 참 — 일반·희귀 ${n}개 분해` : '가방 꽉 참 — 분해할 장비 고르기' });
  }
  if (!smithObj()) return out.slice(0, max);
  const heroes = smithHeroes();
  const favs = heroes.filter((a) => favRank(a) < 99);
  // ★ 영웅 장비 +10 → 초월
  if (transcendOpen())
    for (const a of favs) {
      const g = heroGear(a).find((x) => x.it && x.it.enh >= SM().maxEnhance && x.it.enh < SM().transcend.max && !trShort(x.it));
      if (g) {
        out.push({ kind: 'transcend', tab: 0, hero: a.id, slot: g.slot, text: `${a.name} ${SLOT_NAME[g.slot]} +${g.it!.enh} → 초월 가능 (성공 ${pctTxt(transcendRate(g.it!))})` });
        break;
      }
    }
  // 강화: ★ 영웅 먼저(★한 순서) — 그중 성공률 높은 것 → 단계 낮은 것 · ★ 영웅 장비로 할 게 없으면 다른 영웅
  type Cand = { a: Actor; slot: Slot; it: Item; rate: number };
  let best = null as Cand | null;
  for (const group of [favs, heroes.filter((a) => favRank(a) >= 99)]) {
    for (const a of group)
      for (const { slot, it } of heroGear(a)) {
        if (!it || it.enh >= SM().maxEnhance || enhShort(it)) continue;
        const rate = enhanceRate(it);
        if (!best || favRank(a) < favRank(best.a) || (favRank(a) === favRank(best.a) && (rate > best.rate || (rate === best.rate && it.enh < best.it.enh)))) best = { a, slot, it, rate };
      }
    if (best) break;
  }
  const bb = best as Cand | null;
  if (bb) out.push({ kind: 'enhance', tab: 0, hero: bb.a.id, slot: bb.slot, text: `${bb.a.name} ${SLOT_NAME[bb.slot]} +${bb.it.enh + 1} 가능 (성공 ${pctTxt(bb.rate)})` });
  return out.slice(0, max);
}
