// LUXE §1 명품관 (플래그 luxeShop · 실험실 vis) — 화면 없는 규칙 (화면은 ui/luxeShop.ts · 숫자는 data/luxe_cfg.ts LUXE_SHOP)
//  1-1 세트 장식 16 (하나씩 · 보관함으로) · 세트 완성 = 4점(중심)에서 2칸 안에 나머지 셋 → 「명품 세트」 효과 (world/harmony.ts hfx · 기분 어울림)
//  1-2 이번 주 명품: 한국 시간 월요일 0시에 바뀌고 6주마다 돌아온다 · 마을 회관 쿠폰(P.bundles.coupon)이면 한 번 무료
//  1-4 작은 사치: 여러 개 · 매일(한국 0시) 하나 −30% (날짜로 정해짐)
//  플래그를 끄면: 사기·세트 효과·반짝이 모두 멈춤 (산 것·놓은 것은 그대로 · 이웃에게도 그대로 보인다)
import { CATALOG, def, type Kind } from '../data/catalog';
import { LUXE_SHOP, type LuxeSetDef, type LuxeSetFx } from '../data/luxe_cfg';
import { track } from '../net/telemetry';
import { serverSkew } from './flags';
import { chaptersDone } from './guide';
import { freshLuxe, markDirty, P, S, world, type Building, type LuxeState, type StoredObj } from './state';
import { vis } from './visual';

const L = () => LUXE_SHOP;
const DAY = 86400000;
const WEEK = 7 * DAY;
const KST = 9 * 3600000;

export const lxOn = () => vis('luxeShop');

// ───────── 시각 (서버 시각 · 시험용 바꿔 끼우기) ─────────
let fakeNow: number | null = null;
export const setLxNow = (t: number | null) => (fakeNow = t);
export const lxNow = () => fakeNow ?? Date.now() + serverSkew;

/** 이번 주 시작 = 월요일 0시(KST)의 실제 시각 */
export function weekStart(t = lxNow()): number {
  const dn = Math.floor((t + KST) / DAY);
  // 1970-01-01은 목요일 → (dn + 3) % 7 = 월요일부터 센 날
  return (dn - ((dn + 3) % 7)) * DAY - KST;
}
/** 한국 시간 날짜 'YYYY-MM-DD' */
export const kstDate = (t = lxNow()) => new Date(t + KST).toISOString().slice(0, 10);
/** 「○월 ○일」 (한국 시간) */
export function kstMonthDay(t: number): string {
  const d = new Date(t + KST);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

// ───────── 상태 ─────────

/** 빈 칸 바로잡기 (옛 저장 · 모양이 이상한 값) — 몇 번 불러도 같다 */
export function lxState(): LuxeState {
  const d = freshLuxe();
  const cur = (P as { luxe?: unknown }).luxe;
  const f = (cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : d) as LuxeState;
  for (const k of Object.keys(d) as (keyof LuxeState)[]) {
    const v = f[k] as unknown;
    const b = d[k] as unknown;
    const bad = Array.isArray(b) ? !Array.isArray(v) : typeof v !== typeof b || (typeof b === 'number' && !Number.isFinite(v as number));
    if (bad) (f as Record<string, unknown>)[k] = b;
  }
  f.got = f.got.filter((x, i, a) => typeof x === 'string' && x in CATALOG && a.indexOf(x) === i);
  f.spent = Math.max(0, f.spent);
  f.coupons = Math.max(0, Math.floor(f.coupons));
  P.luxe = f;
  return f;
}

// ───────── 열림 ─────────

/** 지금 장부 장 (5단계 전 저장은 모두 열림) */
const chapterNow = () => (P.guide?.legacy ? 99 : chaptersDone());
export const shopUnlocked = () => chapterNow() >= L().chapter;
/** 잠긴 이유 (열렸으면 '') — 탭 버튼 lockAttr */
export const lxLockWhy = () => (shopUnlocked() ? '' : `장부 ${L().chapter}장에 열려요`);

// ───────── 이번 주 명품 (1-2) ─────────

/** anchor 주부터 센 주 번호 (음수도 됨) */
export const weekNo = (t = lxNow()) => Math.round((weekStart(t) - weekStart(L().weeklyAnchor)) / WEEK);
const mod = (a: number, n: number) => ((a % n) + n) % n;
/** 이번 주 명품 */
export const weeklyItem = (t = lxNow()) => L().weekly[mod(weekNo(t), L().weekly.length)];
/** 그 명품이 다음에 돌아오는 주의 시작 (이번 주가 그 명품이면 다음 순환 · 아니면 가장 가까운 앞날) */
export function nextReturn(kind: string, t = lxNow()): number {
  const n = L().weekly.length;
  const i = L().weekly.findIndex((x) => x.kind === kind);
  if (i < 0) return NaN;
  const cur = weekNo(t);
  let ahead = mod(i - cur, n);
  if (ahead === 0) ahead = n;
  return weekStart(t) + ahead * WEEK;
}
/** 이번 주가 끝나는 시각 (다음 월요일 0시 KST) */
export const weekEnd = (t = lxNow()) => weekStart(t) + WEEK;
/** 무료 쿠폰 남은 수 (마을 회관 6방 보상) */
export const couponLeft = () => Math.max(0, Math.floor((P.bundles as { coupon?: number } | undefined)?.coupon ?? 0));

// ───────── 작은 사치 할인 (1-4) ─────────

/** 날짜 키 → 숫자 (늘 같은 값) */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** 오늘(한국 날짜) 할인하는 작은 사치 */
export const dailySaleKind = (t = lxNow()) => L().small[hashStr('lx' + kstDate(t)) % L().small.length].kind;

// ───────── 값 · 가진 것 ─────────

export type LuxeKind = 'set' | 'weekly' | 'small';
export const lxKindOf = (k: string): LuxeKind | undefined => (k in CATALOG ? def(k as Kind).luxe : undefined);
export const setOfKind = (k: string): LuxeSetDef | undefined => L().sets.find((s) => s.items.some((x) => x.kind === k));
/** 정가 */
export function basePrice(k: string): number {
  return [...L().sets.flatMap((s) => s.items), ...L().weekly, ...L().small].find((x) => x.kind === k)?.price ?? 0;
}
/** 지금 값 (작은 사치 오늘 할인 반영) */
export function priceOf(k: string, t = lxNow()): number {
  const p = basePrice(k);
  return lxKindOf(k) === 'small' && dailySaleKind(t) === k ? Math.round(p * (1 - L().discount)) : p;
}
const homeObjs = (): Building[] => world.home?.objs ?? world.objs;
/** 마을이나 보관함에 있나 (하나씩만 사는 것) */
export const ownsLuxe = (k: string) => homeObjs().some((o) => o.kind === k) || (P.decor?.store ?? []).some((s) => s.kind === k);

/** 살 수 없는 이유 ('' = 살 수 있음) — coupon = 쿠폰으로 (이번 주 명품만) */
export function buyWhy(k: string, opt: { coupon?: boolean } = {}, t = lxNow()): string {
  const lk = lxKindOf(k);
  if (!lxOn()) return '준비 중이에요';
  if (!lk) return '명품관 물건이 아니에요';
  if (S.visiting) return '내 마을에서 살 수 있어요';
  if (!shopUnlocked()) return lxLockWhy();
  if (lk !== 'small' && ownsLuxe(k)) return '이미 있어요 · 하나씩만 들일 수 있어요';
  if (lk === 'weekly' && weeklyItem(t).kind !== k) return `이번 주 명품이 아니에요 · ${kstMonthDay(nextReturn(k, t))}에 돌아와요`;
  if (opt.coupon) {
    if (lk !== 'weekly') return '쿠폰은 「이번 주 명품」에만 써요';
    if (couponLeft() <= 0) return '쿠폰이 없어요';
    return '';
  }
  const p = priceOf(k, t);
  if (S.gold < p) return `금화가 ${(p - S.gold).toLocaleString('ko-KR')} 모자라요`;
  return '';
}

/** 사기: 금화(또는 쿠폰) → 보관함에 하나 · 돌려주는 값 = 넣은 칸 (바로 놓기용) */
export function buyLuxe(k: string, opt: { coupon?: boolean } = {}, t = lxNow()): { err: string } | { ok: StoredObj; paid: number } {
  const why = buyWhy(k, opt, t);
  if (why) return { err: why };
  const st = lxState();
  const paid = opt.coupon ? 0 : priceOf(k, t);
  if (opt.coupon) {
    (P.bundles as { coupon: number }).coupon = couponLeft() - 1;
    st.coupons++;
  } else S.gold -= paid;
  st.spent += paid;
  if (!st.got.includes(k)) st.got.push(k);
  // 보관함 칸: paid = 낸 값 (팔면 그 값의 비율로 돌려받음 · 쿠폰은 0)
  const s: StoredObj = { kind: k as Kind, lvl: 1, hue: null, flip: false, paid };
  (P.decor.store ??= []).push(s);
  track('luxe_buy', { kind: k, paid, coupon: !!opt.coupon });
  markDirty();
  return { ok: s, paid };
}

// ───────── 세트 완성 (1-1) ─────────

/** 발판 사이 빈칸 (world/harmony.ts gap과 같은 셈 — 순환 import 피하려고 따로) */
const gapOf = (a: { tx: number; ty: number; fw: number; fh: number }, b: { tx: number; ty: number; fw: number; fh: number }) =>
  Math.max(Math.max(0, b.tx - (a.tx + a.fw), a.tx - (b.tx + b.fw)), Math.max(0, b.ty - (a.ty + a.fh), a.ty - (b.ty + b.fh)));
export interface LuxeSetHit {
  set: LuxeSetDef;
  members: Building[];
}
/** 이 배치에서 완성된 명품 세트 (중심 4점에서 setRange칸 안에 나머지 셋 · 공사 중은 빼고) */
export function luxeSetsIn(objs: readonly Building[]): LuxeSetHit[] {
  const out: LuxeSetHit[] = [];
  const live = objs.filter((o) => o.build === undefined && lxKindOf(o.kind) === 'set');
  if (live.length < 4) return out;
  for (const set of L().sets) {
    const center = set.items[set.items.length - 1].kind;
    for (const c of live.filter((o) => o.kind === center)) {
      const ms = [c];
      for (const it of set.items.slice(0, -1)) {
        const m = live.filter((o) => o.kind === it.kind && gapOf(c, o) <= L().setRange)[0];
        if (m) ms.push(m);
      }
      if (ms.length === set.items.length) {
        out.push({ set, members: ms });
        break;
      }
    }
  }
  return out;
}
let sig = '';
let cache: LuxeSetHit[] = [];
/** 지금 마을 (배치가 바뀌었을 때만 다시 셈) */
export function luxeSets(): LuxeSetHit[] {
  const objs = world.objs;
  let s = S.visiting ? 'v' : '';
  for (const o of objs) if (lxKindOf(o.kind) === 'set') s += `${o.kind}${o.tx},${o.ty},${o.build === undefined ? 1 : 0}|`;
  if (s !== sig) {
    sig = s;
    cache = luxeSetsIn(objs);
  }
  return cache;
}
/** 세트 효과 합 (내 마을만 · 세트마다 한 번 · 플래그 끄면 0) — harmony.ts hfx가 더한다 */
export function luxeSetFx(key: keyof LuxeSetFx): number {
  if (!lxOn() || S.visiting) return 0;
  let v = 0;
  for (const h of luxeSets()) {
    const x = h.set.fx[key];
    if (typeof x === 'number') v += x;
  }
  return v;
}
/** 기분 세트 (tickHarmonyAura가 범위 안 손님에게) */
export const luxeMoodSets = (): { mood: number; night: boolean; members: Building[] }[] =>
  !lxOn() || S.visiting ? [] : luxeSets().filter((h) => h.set.fx.mood).map((h) => ({ mood: h.set.fx.mood!, night: !!h.set.fx.moodNight, members: h.members }));
/** 이 물건이 낀 완성 세트 (건물 창 · 반짝이) */
export const luxeSetOf = (o: Building): LuxeSetHit | undefined => (lxOn() ? luxeSets().find((h) => h.members.includes(o)) : undefined);
/** 세트 모은 수 (마을 + 보관함 · 창 줄) */
export const setOwnedN = (set: LuxeSetDef) => set.items.filter((x) => ownsLuxe(x.kind)).length;
