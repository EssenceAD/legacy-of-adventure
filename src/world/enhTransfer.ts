// 웅스 건의 「강화 전수」 (플래그 enhTransfer · 실험실) — 화면 없는 규칙 (시험용 · 대장간 한 화면 smithOne 이 부른다)
//  · 같은 부위만 · 받는 장비 등급 ≥ 주는 장비 등급 · 주는 장비 +minEnh 이상 · 같은 장비끼리 X · 유물 받는 장비는 유물에게서만(유물→유물은 같은 등급 규칙)
//  · 옮겨지는 단계 = 주는 단계 − (같은 등급 0 · 한 등급 위 1 · 두 등급 이상 2) − (주는 단계 +11 이상이면 1 더)
//    결과 = max(받는 단계, 옮겨지는 단계) — 받는 단계가 이미 그 이상이면 잠김(이유 보임)
//  · 강화 단계만 옮긴다 (옵션 · 고유 옵션 · 세트는 받는 장비 것 그대로)
//  · 주는 장비는 사라지고 분해 가루는 그대로 받는다 · 주는 장비를 끼고 있던 사람에게 받는 장비를 끼워 준다
//  · 비용: 받는 장비 등급 가루 + 금화 = CONFIG.growth.transfer.cost (결과 단계) · 결과 +11 이상이면 강화 보호 부적 1개
//  · 원정 중인 사람이 낀 장비는 주는 쪽·받는 쪽 모두 막는다 (원정 중엔 장비를 못 바꾸는 것과 같은 규칙)
import { CONFIG } from '../data/config';
import { GRADES, SLOT_NAME } from '../data/items';
import { salvage, smithObj } from './craft';
import { uniqueSalvageMult } from './growth';
import { equip, unequip } from './items';
import { markDirty, P, S, world, type Actor, type Item } from './state';

const TF = () => CONFIG.growth.transfer;
const SM = () => CONFIG.smith;
const homeActors = () => world.home?.actors ?? world.actors;
const ownerOf = (it: Item): Actor | undefined => (it.owner == null ? undefined : homeActors().find((a) => a.id === it.owner));
const gIdx = (it: Item) => GRADES.indexOf(it.grade);

/** 옮겨지는 단계 (받는 장비 단계와 비교 전) — 등급이 낮아지는 방향이면 −1 */
export function transferredLevel(giverEnh: number, gap: number): number {
  if (gap < 0) return -1;
  const T = TF();
  const drop = T.gradeDrop[Math.min(T.gradeDrop.length - 1, gap)] + (giverEnh > SM().maxEnhance ? T.trExtra : 0);
  return Math.max(0, giverEnh - drop);
}

/** 결과 단계 L 의 비용 (L = 1 ~ 20) */
export function transferCost(L: number): { gold: number; dust: number; charm: number } {
  const T = TF();
  const i = Math.max(0, Math.min(T.cost.dust.length - 1, L - 1));
  return { gold: L > 0 ? T.cost.gold[i] : 0, dust: L > 0 ? T.cost.dust[i] : 0, charm: L >= T.charmFrom ? 1 : 0 };
}

/** 주는 장비 분해 가루 (분해와 같은 셈) */
export function giverDust(it: Item): { dust: number; ash: number } {
  return { dust: SM().salvage[it.grade] * uniqueSalvageMult(it), ash: SM().salvageAsh[it.grade] ?? 0 };
}

export interface TransferPlan {
  /** 할 수 있나 (비용까지) */
  ok: boolean;
  /** 막힌 이유 (규칙 · 비용) — ok 면 '' */
  why: string;
  /** 규칙으로 막힘 (비용만 모자란 게 아님) — 후보 목록에서 회색 */
  rule: boolean;
  from: number;
  to: number;
  cost: { gold: number; dust: number; charm: number };
  back: { dust: number; ash: number };
  /** 받는 장비를 끼워 줄 사람 (주는 장비를 끼고 있던 사람) */
  wearer?: Actor;
  /** 받는 장비를 지금 끼고 있는 다른 사람 (그 칸은 비게 됨) */
  leaves?: Actor;
}

/** 전수 계획 (실행 전 미리 보기 · 잠김 이유) */
export function transferPlan(giver: Item, recv: Item): TransferPlan {
  const T = TF();
  const gap = gIdx(recv) - gIdx(giver);
  const to = giver === recv ? -1 : transferredLevel(giver.enh, gap);
  const cost = transferCost(Math.max(0, to));
  const base = { from: recv.enh, to, cost, back: giverDust(giver), wearer: ownerOf(giver), leaves: undefined as Actor | undefined };
  const ro = ownerOf(recv);
  if (ro && base.wearer && ro !== base.wearer) base.leaves = ro;
  const no = (why: string, rule = true): TransferPlan => ({ ok: false, why, rule, ...base });
  if (giver === recv || giver.id === recv.id) return no('같은 장비끼리는 전수할 수 없어요');
  if (giver.slot !== recv.slot) return no(`같은 부위끼리만 전수돼요 (${SLOT_NAME[giver.slot]} → ${SLOT_NAME[recv.slot]} X)`);
  if (gap < 0) return no('받는 장비 등급이 주는 장비보다 낮아요');
  // 웅스 추가 규칙: 유물(a) 받는 장비는 유물에게서만 (초월 금화 2^(n−11) · 유물 재료 구간을 낮은 등급으로 건너뛰지 않게)
  if (recv.grade === 'a' && giver.grade !== 'a') return no('유물 강화는 유물끼리만 옮길 수 있어요');
  if (giver.enh < T.minEnh) return no(`+${T.minEnh} 이상 장비만 강화를 물려줄 수 있어요`);
  if (!P.bag.includes(giver) || !P.bag.includes(recv)) return no('가방에 없는 장비예요');
  if (giver.locked) return no('잠긴 장비는 물려줄 수 없어요 (잠금을 먼저 풀어 주세요)');
  const go = base.wearer;
  if (go && go.runId != null) return no(`${go.name}님이 원정 중이라 주는 장비를 뺄 수 없어요`);
  if (ro && ro.runId != null) return no(`${ro.name}님이 원정 중이라 받는 장비를 손댈 수 없어요`);
  if (recv.enh >= to) return no(`받는 장비가 이미 +${recv.enh}예요 (전수하면 +${to})`);
  if (!smithObj()) return no('대장간이 있어야 해요');
  if (S.gold < cost.gold) return no(`금화가 모자라요 (${cost.gold.toLocaleString()} 필요)`, false);
  if ((P.dust[recv.grade] ?? 0) < cost.dust) return no(`가루가 모자라요 (${cost.dust.toLocaleString()} 필요)`, false);
  if (P.growth.charm < cost.charm) return no('+11 이상 전수엔 강화 보호 부적 1개가 필요해요', false);
  return { ok: true, why: '', rule: false, ...base };
}

/** 받는 장비(recv)에게 강화를 물려줄 수 있는 후보: 같은 부위 · +minEnh 이상 · 등급 ≤ 받는 장비 · 자기 자신 X (규칙으로 막힌 것도 이유와 함께) */
export function giverCands(recv: Item): Item[] {
  return P.bag
    .filter((x) => x !== recv && x.slot === recv.slot && x.enh >= TF().minEnh && gIdx(x) <= gIdx(recv))
    .sort((a, b) => transferredLevel(b.enh, gIdx(recv) - gIdx(b)) - transferredLevel(a.enh, gIdx(recv) - gIdx(a)) || b.enh - a.enh || a.id - b.id);
}
/** 주는 장비(giver)의 강화를 받을 수 있는 후보: 같은 부위 · 등급 ≥ 주는 장비 · 자기 자신 X — 아무도 안 낀 것 먼저 → 등급 높은 것 → 단계 낮은 것 → 새로 얻은 것 */
export function recvCands(giver: Item): Item[] {
  if (giver.enh < TF().minEnh) return [];
  return P.bag.filter((x) => x !== giver && x.slot === giver.slot && gIdx(x) >= gIdx(giver)).sort((a, b) => +(a.owner != null) - +(b.owner != null) || gIdx(b) - gIdx(a) || a.enh - b.enh || b.id - a.id);
}

export interface TransferDone {
  to: number;
  gold: number;
  dust: number;
  charm: number;
  /** 받은 분해 가루 (주는 장비 등급) · 잿빛 */
  back: number;
  ash: number;
  /** 받는 장비를 끼워 준 사람 */
  wearer?: Actor;
}

/** 실행 — 막히면 이유(글자), 되면 결과 */
export function transferEnh(giver: Item, recv: Item): TransferDone | string {
  const p = transferPlan(giver, recv);
  if (!p.ok) return p.why;
  S.gold -= p.cost.gold;
  P.dust[recv.grade] -= p.cost.dust;
  P.growth.charm -= p.cost.charm;
  // 주는 장비: 빼고 → 분해 (가루 그대로)
  const w = p.wearer;
  if (w) unequip(w, giver.slot);
  else giver.owner = null;
  const back = salvage(giver);
  // 받는 장비: 단계만 (천장은 새로) · +15 「초월한」 · +20 「극의」 이름
  recv.enh = p.to;
  delete recv.ePity;
  if (recv.tPity) recv.tPity = 0;
  const TR = SM().transcend;
  const nm = recv.name.replace(/^(초월한|극의) /, '');
  recv.name = recv.enh >= TR.max ? `극의 ${nm}` : recv.enh >= TR.nameAt ? `초월한 ${nm}` : nm;
  P.counters.enhanceMax = Math.max(P.counters.enhanceMax, recv.enh);
  if (w) equip(w, recv);
  markDirty();
  return { to: p.to, gold: p.cost.gold, dust: p.cost.dust, charm: p.cost.charm, back, ash: p.back.ash, wearer: w };
}
