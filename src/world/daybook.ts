// CHECKIN §D1 오늘의 장부 — 매일 한국 시간 0시(출석과 같은 기준) 후보 6개 → 3개를 골라 담는다(안 고르면 앞의 3개)
//  대부분 평소 플레이로 저절로 찬다 (진행 = 뽑았을 때 기록 값 → 지금 값 · 마을 부탁과 같은 방식)
//  하나 끝낼 때마다 작은 보상(금화·재료 소량) · 셋 다 하면 연감 도장 3 + 작은 상자 · 주간 미션 없음 — 이번 주 완료 누적 7·14·21에 상자
//  후보 섞기: CHECKIN §G 성향 점수가 아직 없어 고르게 섞는다 → daybookHooks.order (G가 들어오면 여기서 순서를 바꾼다)
import { DAYBOOK } from '../data/harvest_cfg';
import { REGIONS, type RegionId } from '../data/items';
import { addStamps, almanacOn, giveReward, giveSkillBooks } from './almanac';
import { caughtTotal } from './fishing';
import { flag } from './flags';
import { gsState, kstDay, kstWeek, topRegion } from './goldsink';
import { addCharm, addWhet } from './growth';
import { feature } from './guide';
import { hvNow, launched } from './harvest';
import { freshDaybook, type DaybookCand, type DaybookState } from './hvState';
import { gotGold, markDirty, P, S, world } from './state';

const homeObjs = () => world.home?.objs ?? world.objs;
const has = (k: string) => homeObjs().some((o) => o.kind === k && o.build === undefined);
const regulars = () => (world.home?.actors ?? world.actors).filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).length;
const cnt = (k: string) => P.daybook?.cnt?.[k] ?? 0;

export interface DayDef {
  id: string;
  text: (n: number) => string;
  /** 목표 수 범위 */
  min: number;
  max: number;
  cur: () => number;
  /** 그 사람이 열어 둔 것만 */
  can: () => boolean;
  /** 「가기」가 여는 곳 (ui/nav Place) */
  go: string;
}
export const DAY_DEFS: DayDef[] = [
  { id: 'guests', text: (n) => `손님 ${n}명 받기`, min: 3, max: 5, cur: () => cnt('guestArrive'), can: () => true, go: 'village' },
  { id: 'send', text: () => '원정 1번 보내기', min: 1, max: 1, cur: () => cnt('expeditionSent'), can: () => regulars() > 0, go: 'board' },
  { id: 'hunt', text: (n) => `사냥 ${n}판 (AUTO·소탕 포함)`, min: 3, max: 3, cur: () => P.counters.huntClears, can: () => feature('hunt'), go: 'hunt' },
  { id: 'enhance', text: () => '장비 강화 1번', min: 1, max: 1, cur: () => cnt('enhance'), can: () => has('smith') && P.bag.length > 0, go: 'smith' },
  { id: 'favor', text: () => '마을 부탁 1개 들어주기', min: 1, max: 1, cur: () => cnt('favor'), can: () => flag('villageFavors'), go: 'board' },
  { id: 'deco', text: () => '꾸미기로 장식 1개 놓기', min: 1, max: 1, cur: () => cnt('decoPlace'), can: () => true, go: 'build' },
  { id: 'fish', text: () => '낚시 1번 (물고기 1마리)', min: 1, max: 1, cur: caughtTotal, can: () => has('koi_pond') || has('lily_pond') || (P.hunt.best.coast ?? 0) > 0 || caughtTotal() > 0, go: 'village' },
  { id: 'gift', text: () => '단골에게 선물 1번', min: 1, max: 1, cur: () => P.counters.giftsGiven, can: () => !!P.owner && regulars() > 0, go: 'guests' },
  { id: 'raid', text: () => '토벌 1번', min: 1, max: 1, cur: () => P.counters.raidTries, can: () => feature('raid'), go: 'raid' },
  { id: 'photo', text: () => '사진 1장 찍기', min: 1, max: 1, cur: () => P.counters.photos, can: () => true, go: 'menu' },
  { id: 'like', text: () => '이웃 마을 좋아요 1번', min: 1, max: 1, cur: () => gsState().cnt.likes ?? 0, can: () => true, go: 'village' },
];
export const dayDef = (id: string) => DAY_DEFS.find((d) => d.id === id);

/** §G 성향 점수가 들어오면 후보 순서를 바꾸는 자리 (지금은 고르게 섞기) */
export const daybookHooks = { order: (defs: DayDef[], rng: () => number): DayDef[] => shuffle(defs, rng) };
const shuffle = <T>(a: T[], rng: () => number) => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/** 오늘의 장부가 켜져 있나 (플래그 · 수확제 시작 시각부터 계속) */
export const daybookOn = (now = hvNow()) => flag('ledgerDaily') && launched(now);

/** 칸 바로잡기 + 날·주가 바뀌었으면 새로 */
export function dbState(now = hvNow(), rng: () => number = Math.random): DaybookState {
  const base = freshDaybook();
  const d = (P.daybook ??= base) as DaybookState;
  for (const k of Object.keys(base) as (keyof DaybookState)[]) {
    const v = d[k];
    if (v === undefined || v === null || typeof v !== typeof base[k] || Array.isArray(v) !== Array.isArray(base[k])) (d as Record<string, unknown>)[k] = base[k];
  }
  if (typeof d.cnt !== 'object' || Array.isArray(d.cnt)) d.cnt = {};
  const w = kstWeek(now);
  if (d.week !== w) {
    d.week = w;
    d.weekN = 0;
    d.weekBox = [];
  }
  const day = kstDay(now);
  if (d.day !== day && !S.visiting) rollDay(d, day, rng);
  return d;
}
/** 오늘 후보 6개 뽑기 (열어 둔 것 중에서) */
export function rollDay(d: DaybookState, day: string, rng: () => number = Math.random) {
  const pool = daybookHooks.order(DAY_DEFS.filter((x) => x.can()), rng).slice(0, DAYBOOK.cands);
  d.day = day;
  d.cands = pool.map((x) => ({ id: x.id, target: x.min + Math.floor(rng() * (x.max - x.min + 1)), base: x.cur(), claimed: false }));
  d.picked = [];
  d.box = false;
  markDirty();
}

/** 고른 3개 (아직 안 골랐으면 앞의 3개) — 후보 번호 */
export function pickedIdx(d = dbState()): number[] {
  const p = d.picked.filter((i, k, a) => Number.isInteger(i) && i >= 0 && i < d.cands.length && a.indexOf(i) === k).slice(0, DAYBOOK.pick);
  if (p.length === DAYBOOK.pick || !d.cands.length) return p;
  return d.cands.map((_, i) => i).slice(0, Math.min(DAYBOOK.pick, d.cands.length));
}
/** 고른 걸 바꿀 수 있나 (아직 아무것도 안 받았을 때만) */
export const canRepick = (d = dbState()) => !d.cands.some((c) => c.claimed);
/** 3개 고르기 (번호 셋) — 안 되면 까닭 */
export function pickCands(idx: number[], d = dbState()): string | null {
  const u = [...new Set(idx)].filter((i) => Number.isInteger(i) && i >= 0 && i < d.cands.length);
  if (u.length !== Math.min(DAYBOOK.pick, d.cands.length)) return `${DAYBOOK.pick}개를 골라요`;
  if (!canRepick(d)) return '이미 받은 게 있어서 오늘은 바꿀 수 없어요';
  d.picked = u;
  markDirty();
  return null;
}

export const candProg = (c: DaybookCand) => Math.max(0, Math.min(c.target, (dayDef(c.id)?.cur() ?? 0) - c.base));
export const candDone = (c: DaybookCand) => candProg(c) >= c.target;

/** 하나 끝낼 때마다 작은 보상 (금화 소량 · 최고 지역 재료) */
export function itemRewardText(): string {
  const r = topRegion();
  return `금화 ${(DAYBOOK.gold * (r + 1)).toLocaleString('ko-KR')} · ${REGIONS[r].mat} ×${DAYBOOK.mats}`;
}
/** 고른 것 하나 받기 — 보상 글 · 안 되면 null */
export function claimCand(i: number, now = hvNow()): string | null {
  const d = dbState(now);
  const c = d.cands[i];
  if (!c || c.claimed || !candDone(c) || !pickedIdx(d).includes(i)) return null;
  // 받을 때 고른 걸 굳힌다 (안 골랐으면 앞의 3개)
  d.picked = pickedIdx(d);
  c.claimed = true;
  const r = topRegion();
  const g = DAYBOOK.gold * (r + 1);
  S.gold += g;
  gotGold(g, 'daybook');
  P.mats[REGIONS[r].id as RegionId] = (P.mats[REGIONS[r].id as RegionId] ?? 0) + DAYBOOK.mats;
  d.weekN++;
  markDirty();
  return itemRewardText();
}
/** 셋 다 받았나 (상자 받을 수 있음) */
export const allDone = (d = dbState()) => pickedIdx(d).length > 0 && pickedIdx(d).every((i) => d.cands[i]?.claimed);
export const boxReady = (d = dbState()) => !d.box && allDone(d);
/** 셋 다 → 연감 도장 3 (시즌 중) + 작은 상자 */
export function claimDayBox(now = hvNow(), rng: () => number = Math.random): { box: string; stamps: number } | null {
  const d = dbState(now);
  if (!boxReady(d)) return null;
  d.box = true;
  const stamps = addStamps(DAYBOOK.stamps, now);
  const x = rng();
  let box: string;
  if (x < 0.34) {
    addCharm(1);
    box = '강화 보호 부적 1';
  } else if (x < 0.67) {
    addWhet(1);
    box = '행운의 숫돌 1';
  } else {
    giveReward({ k: 'shards', n: 3 });
    box = '증표 조각 3';
  }
  markDirty();
  return { box, stamps };
}
/** 이번 주 상자 (7·14·21) */
export const weekReady = (d = dbState()) => DAYBOOK.week.filter((n) => d.weekN >= n && !d.weekBox.includes(n));
export function weekBoxText(n: number): string {
  return n >= 21 ? `스킬 책 1 (준비 중 → 재료) · 인연의 증표 1` : n >= 14 ? '행운의 숫돌 1 · 강화 보호 부적 1' : '잿빛 가루 ×30 · 증표 조각 3';
}
export function claimWeekBox(n: number, now = hvNow()): string | null {
  const d = dbState(now);
  if (!DAYBOOK.week.includes(n) || d.weekN < n || d.weekBox.includes(n)) return null;
  d.weekBox.push(n);
  if (n >= 21) {
    giveSkillBooks(1);
    P.tokens += 1;
  } else if (n >= 14) {
    addWhet(1);
    addCharm(1);
  } else {
    P.dust.n += 30;
    giveReward({ k: 'shards', n: 3 });
  }
  markDirty();
  return weekBoxText(n);
}
/** 빨간 점: 받을 것 (고른 것 완료 · 셋 상자 · 주간 상자) */
export function daybookDot(): boolean {
  if (!daybookOn() || S.visiting) return false;
  const d = dbState();
  return pickedIdx(d).some((i) => !d.cands[i].claimed && candDone(d.cands[i])) || boxReady(d) || weekReady(d).length > 0;
}
/** 오늘 진행 n/3 (받은 수) */
export function dayCount(d = dbState()): [number, number] {
  const p = pickedIdx(d);
  return [p.filter((i) => d.cands[i]?.claimed).length, p.length];
}

export { dbCount } from './hvLite';
/** 시즌 중 연감 진행 한 줄에 쓰는 것 */
export const stampsToday = () => (almanacOn() ? DAYBOOK.stamps : 0);
