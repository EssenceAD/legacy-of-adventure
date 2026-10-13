// GOLDSINK §1~§5: 쌓이는 금화에 쓸 곳 — 의뢰 새로고침(유료) · 연금술 변환 · 예배당 축복 · 자동 사냥 금화 완만하게 · 마을 부탁
//  값은 전부 「기준 × m(r)」 (m = 2^사냥 최고 지역 번호) · 하루 카운터는 한국 시간 0시 · 주간은 한국 시간 월요일 0시
import { CONFIG } from '../data/config';
import { flag } from './flags';
import { bigNum, vis } from './visual';
import { BOSSES } from '../data/bosses';
import { REGIONS, type RegionId } from '../data/items';
import { fLv } from './facilities';
import { freshGoldsink, markDirty, P, S, wfHit, type GoldsinkState } from './state';

const GS = () => CONFIG.goldsink;
const DAY = 86400000;
const KST = 9 * 3600000;

// ───────── 날짜 (한국 시간) ─────────

/** 한국 시간 날짜 키 'YYYY-M-D' */
export function kstDay(t = Date.now()): string {
  const d = new Date(t + KST);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}
/** 한국 시간 주 키 (월요일 0시 시작) */
export function kstWeek(t = Date.now()): string {
  const dn = Math.floor((t + KST) / DAY);
  // 1970-01-01은 목요일 → (dn + 3) % 7 = 월요일부터 센 날
  return 'w' + kstDay((dn - ((dn + 3) % 7)) * DAY - KST);
}
/** 다음 한국 시간 0시까지 (ms) */
export const untilKstMidnight = (t = Date.now()) => DAY - ((t + KST) % DAY);

// ───────── 상태 ─────────

/** 칸 바로잡기 + 날·주가 바뀌었으면 초기화 */
export function gsState(now = Date.now()): GoldsinkState {
  const base = freshGoldsink();
  const g = (P.gs ??= base) as GoldsinkState;
  for (const k of Object.keys(base) as (keyof GoldsinkState)[]) if (g[k] === undefined || g[k] === null) (g as Record<string, unknown>)[k] = base[k];
  for (const k of Object.keys(base.cnt)) if (!Number.isFinite(g.cnt[k])) g.cnt[k] = 0;
  const d = kstDay(now);
  if (g.day !== d) {
    g.day = d;
    g.refreshPaid = 0;
    g.conv = {};
    g.autoN = 0;
    g.swaps = 0;
    g.favors = [];
    g.box = false;
  }
  const w = kstWeek(now);
  if (g.week !== w) {
    g.week = w;
    g.weekN = 0;
    g.letter = false;
  }
  return g;
}

/** 사냥 최고 지역 번호 r (한 스테이지라도 깬 가장 먼 지역 · 숲 0 … 심연의 바닥 9) */
export function topRegion(): number {
  let r = 0;
  REGIONS.forEach((x, i) => {
    if ((P.hunt.best[x.id] ?? 0) > 0) r = i;
  });
  return r;
}
export const mOf = (i: number) => 2 ** Math.max(0, i);
export const mR = () => mOf(topRegion());
const ridx = (r: string) => REGIONS.findIndex((x) => x.id === r);

/** 금화 짧게: 9,800 · 1.6만 · 51만 · 1.2억 */
export function fmtKo(n: number): string {
  // VISUAL §5 uiKitV2(실험실): 큰 수 줄임은 한 규칙(M)으로
  if (vis('uiKitV2')) return bigNum(n);
  n = Math.round(n);
  const one = (v: number) => (v < 10 ? (Math.round(v * 10) / 10).toString() : Math.round(v).toLocaleString('ko-KR'));
  if (n >= 1e8) return one(n / 1e8) + '억';
  if (n >= 1e4) return one(n / 1e4) + '만';
  return n.toLocaleString('ko-KR');
}

/** 대사를 하루 한 번 / 계정당 한 번 */
export function onceDay(key: string, now = Date.now()): boolean {
  const g = gsState(now);
  if (g.talkDay[key] === kstDay(now)) return false;
  g.talkDay[key] = kstDay(now);
  markDirty();
  return true;
}
export function onceEver(key: string): boolean {
  const g = gsState();
  if (g.seen.includes(key)) return false;
  g.seen.push(key);
  markDirty();
  return true;
}

// ───────── §1 의뢰 새로고침 (유료) ─────────

/** n번째(0부터) 유료 새로고침 값 */
export const refreshCost = (n = gsState().refreshPaid, m = mR()) => Math.round(GS().refresh.base * m * GS().refresh.grow ** n);
/** 금화를 내고 새로고침할 수 있으면 값을 빼고 true */
export function payRefresh(): boolean {
  if (!flag('goldsinkRefresh')) return false;
  const g = gsState();
  const c = refreshCost(g.refreshPaid);
  if (S.gold < c) return false;
  S.gold -= c;
  g.refreshPaid++;
  markDirty();
  return true;
}

// ───────── §2 연금술 변환 ─────────

export interface ConvItem {
  key: string;
  name: string;
  /** 한 번에 받는 수 */
  qty: number;
  first: number;
  rise: number;
  cap: number;
  bought: number;
  have: number;
}
/** 처치한 보스 (토벌 처치 · 지역 x-10 사냥 돌파) */
export const bossKilled = (id: string) => {
  const b = BOSSES.find((x) => x.id === id);
  if (!b) return false;
  return (P.hunt.best[b.region] ?? 0) >= CONFIG.hunt.stages || (P.raid.kills[id] ?? 0) > 0 || P.raid.firstKills.includes(id);
};
const DUST_NAME: Record<string, [string, 'n' | 'r' | 'e' | 'l']> = { ash: ['잿빛 가루', 'n'], dustR: ['희귀 가루', 'r'], dustE: ['영웅 가루', 'e'], dustL: ['전설 가루', 'l'] };
export function convItems(): ConvItem[] {
  if (!flag('goldsinkConvert')) return [];
  const g = gsState();
  const C = GS().conv;
  const top = mR();
  const out: ConvItem[] = [];
  const mk = (key: string, kind: string, name: string, m: number, have: number) => {
    const c = C[kind];
    out.push({ key, name, qty: c.qty, first: Math.round(c.first * m), rise: c.rise, cap: c.cap, bought: g.conv[key] ?? 0, have });
  };
  REGIONS.forEach((r, i) => {
    if ((P.hunt.best[r.id] ?? 0) > 0) mk('mat:' + r.id, 'mat', r.mat, mOf(i), P.mats[r.id] ?? 0);
  });
  for (const k of ['ash', 'dustR', 'dustE', 'dustL']) mk(k, k, DUST_NAME[k][0], top, P.dust[DUST_NAME[k][1]] ?? 0);
  for (const b of BOSSES) if (bossKilled(b.id)) mk('boss:' + b.id, 'boss', b.mat, mOf(ridx(b.region)), P.bossMats[b.id] ?? 0);
  mk('whet', 'whet', '행운의 숫돌', top, P.growth.whet);
  return out;
}
export const convItem = (key: string) => convItems().find((x) => x.key === key) ?? null;
/** k번째(0부터) 값 = 첫 값 × (1 + 오름 × k) */
export const convPrice = (it: Pick<ConvItem, 'first' | 'rise'>, k: number) => Math.round(it.first * (1 + it.rise * k));
/** 오늘 산 수 다음부터 q개 합 */
export function convTotal(it: ConvItem, q: number): number {
  let s = 0;
  for (let k = it.bought; k < it.bought + q; k++) s += convPrice(it, k);
  return s;
}
/** 금화·하루 최대 안에서 살 수 있는 수 */
export function convMax(it: ConvItem, gold = S.gold): number {
  let q = 0;
  let s = 0;
  while (it.bought + q < it.cap) {
    const p = convPrice(it, it.bought + q);
    if (s + p > gold) break;
    s += p;
    q++;
  }
  return q;
}
export function buyConv(key: string, q: number): string | null {
  if (!fLv('alchemy')) return '연금술 공방을 지으면 열려요';
  const it = convItem(key);
  if (!it) return '아직 바꿀 수 없어요';
  q = Math.floor(q);
  if (q < 1) return '수량을 골라요';
  if (it.bought + q > it.cap) return `오늘은 ${it.cap - it.bought}번까지 살 수 있어요`;
  const cost = convTotal(it, q);
  if (S.gold < cost) return '금화가 모자라요';
  S.gold -= cost;
  const n = it.qty * q;
  const [kind, id] = key.split(':');
  if (kind === 'mat') P.mats[id as RegionId] = (P.mats[id as RegionId] ?? 0) + n;
  else if (kind === 'boss') P.bossMats[id] = (P.bossMats[id] ?? 0) + n;
  else if (kind === 'whet') P.growth.whet += n;
  else P.dust[DUST_NAME[kind][1]] += n;
  const g = gsState();
  // WAYFIND §1: 첫 변환 값은 돌려준다
  if (!g.cnt.conv) wfHit('convert', cost);
  g.conv[key] = it.bought + q;
  g.cnt.conv++;
  markDirty();
  return null;
}

// ───────── §3 예배당 축복 ─────────

export const blessCost = () => Math.round(GS().bless.base * mR());
export const blessLeft = (now = Date.now()) => Math.max(0, gsState(now).blessUntil - now);
export const blessed = (now = Date.now()) => blessLeft(now) > 0;
/** 지금 축복 효과 (없으면 0) · 예배당 레벨마다 +perLv */
export function blessFx(k: 'xp' | 'drop' | 'expTime' | 'mood', now = Date.now()): number {
  if (!blessed(now)) return 0;
  const B = GS().bless;
  return B[k] + B.perLv * Math.max(0, fLv('chapel') - 1);
}
/** 더 받을 수 있나 (남은 시간 + 2시간이 8시간을 넘지 않게) */
export const blessRoom = (now = Date.now()) => blessLeft(now) <= (GS().bless.maxHours - GS().bless.hours) * 3600000;
export function buyBless(now = Date.now()): { err: string } | { ext: boolean } {
  if (!flag('goldsinkBless')) return { err: '지금은 쉬어 가요' };
  if (!fLv('chapel')) return { err: '예배당이 필요해요' };
  if (!blessRoom(now)) return { err: `축복은 최대 ${GS().bless.maxHours}시간까지예요` };
  const c = blessCost();
  if (S.gold < c) return { err: '금화가 모자라요' };
  const ext = blessed(now);
  S.gold -= c;
  addBlessMin(GS().bless.hours * 60, now);
  gsState(now).cnt.bless++;
  markDirty();
  return { ext };
}
export function addBlessMin(min: number, now = Date.now()) {
  const g = gsState(now);
  g.blessUntil = Math.min(now + GS().bless.maxHours * 3600000, Math.max(now, g.blessUntil) + min * 60000);
  markDirty();
}

/** §5 마을 부탁 보상: 오늘 주점 수입 +10% */
export const tavernBoost = () => (P.gs?.tavernDay && P.gs.tavernDay === kstDay() ? GS().favor.tavernBoost : 0);

// ───────── §4 자동 사냥 금화 ─────────

/** 오늘 n판째(0부터)의 금화 비율 */
export function taperAt(n: number): number {
  for (const [upto, v] of GS().taper.steps) if (n < upto) return v;
  return GS().taper.steps[GS().taper.steps.length - 1][1];
}
/** 자동·방치·접은 판 하나: 오늘 판 수를 세고 금화 비율을 돌려준다 */
export function autoGoldMult(now = Date.now()): number {
  if (!flag('goldsinkAutoCap')) return 1;
  const g = gsState(now);
  const v = taperAt(g.autoN);
  g.autoN++;
  return v;
}
/** 사냥 창 한 줄용: 오늘 판 수 · 지금 비율 · 이 구간 끝 */
export function taperInfo(now = Date.now()) {
  const n = gsState(now).autoN;
  const mult = taperAt(n);
  const step = GS().taper.steps.find(([upto]) => n < upto);
  return { n, mult, upto: step && Number.isFinite(step[0]) ? step[0] : 0 };
}
