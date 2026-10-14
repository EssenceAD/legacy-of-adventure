// CHECKIN §J8 건물 머리 위 「상태 말풍선」 — 상태 고르기 (그리기는 bldStatusDraw.ts)
//  「지금 나 이거 안 하고 있네」가 마을만 봐도 보이게. 글자 없이 아이콘 하나 · 한 번에 최대 3개.
//  우선순위: 완료(받을 것) > 할 수 있음 > 진행 고리 · 눌러서 창을 연 건물은 그 상태가 바뀔 때까지 다시 안 띄움.
//  건너뛴 것: 훈련장 「단련」(F 이전 — 아직 없음) · 연금술 「오늘 무료·할인 변환」(그런 장치 없음 — 값은 날마다 첫 값부터 오를 뿐)
//            · 대장간 「제작 완료」(제작은 바로 끝남 — 기다리는 제작이 없음)
import { CONFIG } from '../data/config';
import { getPref, setPref } from '../save/save';
import { enhanceBossCost, enhanceCost, plotLeft, smithObj } from './craft';
import { activeRuns, canSend, maxParties } from './expeditions';
import { fLv } from './facilities';
import { baitLeft } from './fishing';
import { flag } from './flags';
import { blessCost, blessed } from './goldsink';
import { bagSize, equippedItems } from './items';
import { P, S, world, type Building } from './state';
import { bestOf } from './town';
import { vis } from './visual';

export type BldIcon = 'seed' | 'basket' | 'pray' | 'hammer' | 'flag' | 'flag_gray' | 'rod' | 'dummy' | 'flask';
/** 0 완료(받을 것) · 1 할 수 있음 · 2 진행 고리(말풍선 없이) */
export type BldTier = 0 | 1 | 2;
export interface BldCond {
  /** 상태 이름 (같은 건물에서 이게 바뀌면 「상태가 바뀜」) */
  id: string;
  tier: BldTier;
  icon: BldIcon;
  text: string;
  /** 반짝 (받을 것) */
  shine?: boolean;
  /** 진행 고리 0..1 */
  prog?: number;
}
export interface BldCand extends BldCond {
  o: Building;
}

/** 같은 단계 안에서 먼저 보일 순서 */
const ORDER = ['ripe', 'back', 'bagfull', 'empty', 'freeparty', 'enhance', 'bless', 'fish', 'grow'];
const rank = (c: BldCond) => c.tier * 100 + Math.max(0, ORDER.indexOf(c.id));

// ───────── 설정 · 숨김 ─────────

/** 설정(알림 탭) 「건물 알림 말풍선」 — 기본 켬 */
let prefOn: boolean | null = null;
export const bldBubblesOn = () => (prefOn ??= getPref<boolean>('bldBubbles', true) !== false);
export const setBldBubbles = (on: boolean) => {
  prefOn = on;
  setPref('bldBubbles', on);
};
/** L2 UI 끄기(구경 모드) — 다른 묶음이 body.uihide 를 단다 (합칠 때 그 함수로 바꿔도 됨) */
export const uiHidden = () => typeof document !== 'undefined' && document.body.classList.contains('uihide');
/** L1 화면 보호 — 다른 묶음이 만든다 · 지금은 body.ssaver 로 본다 (합칠 때 진짜 함수로) */
export const screenSaverOn = () => typeof document !== 'undefined' && document.body.classList.contains('ssaver');
/** 말풍선을 아예 안 띄우는 때 (플래그 · 설정 · 이웃 마을 · UI 끄기 · 화면 보호). 사진·꾸미기·배치는 그리는 쪽에서 */
export const bubblesHidden = () => !vis('bldStatus') || !bldBubblesOn() || !!S.visiting || uiHidden() || screenSaverOn();

// ───────── 건물별 상태 ─────────

const homeObjs = () => world.home?.objs ?? world.objs;
const homeActors = () => world.home?.actors ?? world.actors;
const ready = (o: Building | undefined): o is Building => !!o && o.build === undefined && !o.con;
const GD = CONFIG.garden;
const SM = CONFIG.smith;

/** 텃밭 하나: 다 자람 > 빈 밭 > 자라는 중(고리) — plotsOf()처럼 칸을 늘리지 않고 읽기만 */
export function gardenCond(o: Building, now = Date.now()): BldCond | null {
  const n = GD.plots + Math.floor((o.lvl - 1) / 2);
  const ps = o.plots ?? [];
  let ripe = false;
  let empty = ps.length < n;
  let best = -1;
  for (const p of ps.slice(0, n)) {
    if (!p.crop) {
      empty = true;
      continue;
    }
    if (!GD.crops[p.crop]) continue;
    const left = plotLeft(p, now)!;
    if (left === 0) ripe = true;
    else best = Math.max(best, Math.min(1, Math.max(0, (now - p.at) / (now - p.at + left))));
  }
  if (ripe) return { id: 'ripe', tier: 0, icon: 'basket', text: '수확할 수 있어요!', shine: true };
  if (empty) return { id: 'empty', tier: 1, icon: 'seed', text: '작물이 없어요!' };
  if (best >= 0) return { id: 'grow', tier: 2, icon: 'seed', text: '쑥쑥 자라는 중', prog: best };
  return null;
}

/** ★ 아끼는 영웅이 낀 장비 중 지금 강화할 수 있는 것이 있나 (가루·보스 재료) */
export function favEnhanceable(): boolean {
  const favs = P.growth?.favs ?? [];
  if (!favs.length) return false;
  for (const a of homeActors()) {
    if (a.id == null || !favs.includes(a.id) || a.role) continue;
    for (const it of equippedItems(a)) {
      if (it.enh >= SM.maxEnhance) continue;
      if ((P.dust[it.grade] ?? 0) < enhanceCost(it)) continue;
      const bc = enhanceBossCost(it);
      if (bc && (P.bossMats[bc.boss.id] ?? 0) < bc.n) continue;
      return true;
    }
  }
  return false;
}
export const bagFull = () => P.bag.filter((x) => !x.owner).length >= bagSize();

export function smithCond(): BldCond | null {
  if (bagFull()) return { id: 'bagfull', tier: 1, icon: 'hammer', text: '가방이 꽉 찼어요' };
  if (favEnhanceable()) return { id: 'enhance', tier: 1, icon: 'hammer', text: '강화할 수 있어요' };
  return null;
}
function boardCond(): BldCond | null {
  if (P.runs.some((r) => r.result && !r.claimed)) return { id: 'back', tier: 0, icon: 'flag', text: '원정대가 돌아왔어요!', shine: true };
  if (activeRuns().length >= maxParties()) return null;
  const free = homeActors().filter((a) => canSend(a) === null).length;
  if (free >= CONFIG.expedition.partyMinShort) return { id: 'freeparty', tier: 1, icon: 'flag_gray', text: '쉬는 파티가 있어요' };
  return null;
}
function chapelCond(): BldCond | null {
  if (!flag('goldsinkBless') || !fLv('chapel') || blessed()) return null;
  if (S.gold < blessCost()) return null;
  return { id: 'bless', tier: 1, icon: 'pray', text: '기도 드리고 축복 받아요!' };
}
function pondCond(): BldCond | null {
  if (baitLeft() <= 0 || (P.growth.fish.used ?? 0) > 0) return null;
  return { id: 'fish', tier: 1, icon: 'rod', text: '입질이 있어요!' };
}

/** 지금 마을의 후보 (건물 종류마다 하나 — 텃밭이 여럿이면 가장 급한 한 채) */
export function collectCands(now = Date.now()): BldCand[] {
  const out: BldCand[] = [];
  let garden: BldCand | null = null;
  for (const o of homeObjs()) {
    if (o.kind !== 'garden' || !ready(o)) continue;
    const c = gardenCond(o, now);
    if (c && (!garden || rank(c) < rank(garden))) garden = { ...c, o };
  }
  if (garden) out.push(garden);
  const add = (o: Building | undefined, c: BldCond | null) => {
    if (ready(o) && c) out.push({ ...c, o });
  };
  const objs = homeObjs();
  const sm = smithObj();
  if (sm) add(sm, smithCond());
  add(bestOf('board', objs, true) ?? bestOf('guild', objs, true), boardCond());
  add(bestOf('chapel', objs, true), chapelCond());
  const pond = bestOf('lily_pond', objs, true) ?? bestOf('koi_pond', objs, true);
  if (pond) add(pond, pondCond());
  return out;
}

// ───────── 고르기 (최대 3 · 우선순위 · 눌러 본 건 상태가 바뀔 때까지 숨김) ─────────

/** 눌러서 창을 연 건물 → 그때의 상태 id (상태가 바뀌거나 사라지면 지움) */
const dismissed = new Map<Building, string>();
export function dismissBubble(o: Building, id: string) {
  dismissed.set(o, id);
}
/**
 * 후보 → 보일 것: 숨긴 상태는 빼고(상태가 바뀌었으면 숨김을 풀고) · 단계·순서대로 · 최대 max개
 *  (dm 은 시험용 — 기본은 이 모듈의 숨김 목록)
 */
export function selectBubbles(cands: BldCand[], max = CONFIG.bldStatus.max, dm: Map<Building, string> = dismissed): BldCand[] {
  const now = new Map(cands.map((c) => [c.o, c.id]));
  for (const [o, id] of [...dm]) if (now.get(o) !== id) dm.delete(o);
  return cands
    .filter((c) => dm.get(c.o) !== c.id)
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, max);
}
/** 시험용 */
export const clearDismissed = () => dismissed.clear();
