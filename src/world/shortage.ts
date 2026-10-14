// 전역 규칙 「회색 버튼엔 이유」 · 대장간: 비용 한 줄을 「재료 하나씩」으로 (화면 없는 규칙 — 시험용)
//  · 재료마다 필요/가진 수 · 모자라면 몇 개 (화면은 빨강 + 「−n」)
//  · 큰 버튼 글 = 가장 많이 모자란 재료 (모자란 비율이 큰 것 → 「그림자 껍질 2개 부족」)
//  · 모자란 재료를 누르면 「얻는 곳」: 지역 재료 = 「○○ 사냥·의뢰」 · 보스 재료 = 「○○ 10스테이지 사냥 · 토벌 · 부탁」
//    (토벌에 안 나오는 보스 = 「○○ 10스테이지 사냥」 · craft.ts bossHint 와 같은 기준) · 가루 = 「같은 등급 장비 분해」 · 부적 = 「토벌 참여 · 증표 상점」
import { bossById } from '../data/bosses';
import { DUST_NAME, regionById, type Grade, type RegionId } from '../data/items';
import { craftCost, enhanceBossCost, enhanceCost, transcendCost, whetCost } from './craft';
import { reforgeCost } from './reforge';
import { P, S, type Item } from './state';

export type CostKind = 'gold' | 'dust' | 'mat' | 'boss' | 'charm';
export interface CostPart {
  kind: CostKind;
  name: string;
  need: number;
  have: number;
  /** 얻는 곳 (모자랄 때 누르면 보여 줌) */
  where: string;
}

export const shortOf = (p: CostPart) => Math.max(0, Math.ceil(p.need - p.have));

export function bossWhere(id: string): string {
  const b = bossById(id);
  if (!b) return '지역 10스테이지 사냥 · 토벌 · 부탁';
  const r = regionById(b.region)?.name ?? '';
  return b.noRaid ? `${r} 10스테이지 사냥` : `${r} 10스테이지 사냥 · 토벌 · 부탁`;
}
export const regionWhere = (r: RegionId) => `${regionById(r)?.name ?? ''} 사냥·의뢰`;
export const DUST_WHERE = '같은 등급 장비 분해';
export const CHARM_WHERE = '토벌 참여 · 증표 상점';
export const GOLD_WHERE = '손님 숙박 · 의뢰 · 사냥';

export const goldPart = (need: number): CostPart => ({ kind: 'gold', name: '금화', need, have: S.gold, where: GOLD_WHERE });
export const dustPart = (g: Grade, need: number): CostPart => ({ kind: 'dust', name: DUST_NAME[g], need, have: P.dust[g] ?? 0, where: DUST_WHERE });
export const matPart = (r: RegionId, need: number): CostPart => ({ kind: 'mat', name: regionById(r)?.mat ?? '지역 재료', need, have: P.mats[r] ?? 0, where: regionWhere(r) });
export const bossPart = (id: string, need: number): CostPart => ({ kind: 'boss', name: bossById(id)?.mat ?? '보스 재료', need, have: P.bossMats[id] ?? 0, where: bossWhere(id) });
export const charmPart = (need: number): CostPart => ({ kind: 'charm', name: '강화 보호 부적', need, have: P.growth.charm ?? 0, where: CHARM_WHERE });

/** 강화 한 번 (가루 · +10으로 올릴 땐 보스 재료) */
export function enhanceParts(it: Item): CostPart[] {
  const bc = enhanceBossCost(it);
  return [dustPart(it.grade, enhanceCost(it)), ...(bc ? [bossPart(bc.boss.id, bc.n)] : [])];
}
/** 초월 한 번 (금화 · 지역 재료 · 보스 재료 · 가루) */
export function transcendParts(it: Item): CostPart[] {
  const c = transcendCost(it);
  return [goldPart(c.gold), matPart(it.region, c.mats), bossPart(c.boss.id, c.bossMats), dustPart(it.grade, c.dust)];
}
/** 세트 제작 한 개 (지역 재료 · 보스 재료 · 잿빛 가루 · 금화) */
export function craftParts(r: RegionId): CostPart[] {
  const c = craftCost(r);
  return [matPart(r, c.mats), bossPart(c.boss.id, c.bossMats), dustPart('n', c.dust), goldPart(c.gold)];
}
/** 행운의 숫돌 하나 */
export function whetParts(r: RegionId): CostPart[] {
  const c = whetCost(r);
  return [dustPart('n', c.ash), matPart(r, c.mats), goldPart(c.gold)];
}
/** 재련 한 번 (그 등급 가루 · 금화) */
export function reforgeParts(it: Item, lock: number | null = null): CostPart[] {
  const c = reforgeCost(it, lock);
  return [dustPart(c.grade, c.dust), goldPart(c.gold)];
}
/** 강화 전수 (금화 · 받는 장비 등급 가루 · +11 이상이면 부적) */
export function transferParts(cost: { gold: number; dust: number; charm: number }, recv: Item): CostPart[] {
  return [...(cost.gold ? [goldPart(cost.gold)] : []), dustPart(recv.grade, cost.dust), ...(cost.charm ? [charmPart(cost.charm)] : [])];
}

/** 가장 많이 모자란 것 (모자란 비율 → 같으면 먼저 적힌 것) · 다 있으면 null */
export function worstShort(parts: CostPart[]): CostPart | null {
  let best: CostPart | null = null;
  let br = 0;
  for (const p of parts) {
    const s = shortOf(p);
    if (!s) continue;
    const r = s / Math.max(1, p.need);
    if (r > br) {
      br = r;
      best = p;
    }
  }
  return best;
}
export const anyShort = (parts: CostPart[]) => parts.some((p) => shortOf(p) > 0);
