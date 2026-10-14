// HARVEST §1 · CHECKIN §D 가벼운 핵심 — 날짜 판정 · 리본 · 연감 도장 · 장부 기록 · 칭호
//  여기는 data·flags·state만 import한다 (meta·progress·expeditions가 부르는데, 무거운 모듈을 끌어오면 불러오기 순서가 꼬인다)
//  world/harvest.ts · world/almanac.ts · world/daybook.ts가 이걸 그대로 다시 내보낸다
import { vis } from './visual';
import { ALMANAC, HV } from '../data/harvest_cfg';
import { HARVEST_TITLE } from '../data/story/harvest';
import { flag, serverSkew } from './flags';
import { freshAlmanac, freshDaybook, freshHarvest, type AlmanacState, type HarvestState } from './hvState';
import { markDirty, P, uiHooks } from './state';

// ───────── 시각 (한국 시간 · 서버 시각) ─────────

const NOW_KEY = 'legacy-of-adventure-hvNow';
let devNow: number | null | undefined;
/** 개발·봇 빌드: 수확제 시각 강제 (ms · null = 끔) — e2e·스크린샷이 기간 전/중/마지막 밤/뒤를 흉내 낸다 (배포본에선 무시) */
export function setHvNow(t: number | null) {
  devNow = t;
  try {
    if (t == null) localStorage.removeItem(NOW_KEY);
    else localStorage.setItem(NOW_KEY, String(t));
  } catch {
    /* 이번 판만 */
  }
}
/** 지금 (서버 시각 기준 ms · 오프라인이면 기기 시계) */
export function hvNow(): number {
  if (import.meta.env.DEV) {
    if (devNow === undefined) {
      try {
        const v = localStorage.getItem(NOW_KEY);
        const t = v == null ? NaN : Number.isFinite(Number(v)) ? Number(v) : Date.parse(v);
        devNow = Number.isFinite(t) ? t : null;
      } catch {
        devNow = null;
      }
    }
    if (devNow != null) return devNow;
  }
  return Date.now() + serverSkew;
}
const KST = 9 * 3600000;
/** 한국 시간 날짜 키 'YYYY-M-D' (goldsink.kstDay와 같은 모양) */
export function kstDayOf(t: number): string {
  const d = new Date(t + KST);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

/** 날짜 칸: 시작 전 · 수확제 · 교환소만(정리 3일) · 끝 (플래그와 상관없이 — 시험용) */
export function hvPhase(now = hvNow()): 'before' | 'on' | 'shop' | 'after' {
  if (now < HV.from) return 'before';
  if (now <= HV.to) return 'on';
  if (now <= HV.shopUntil) return 'shop';
  return 'after';
}
/** 업데이트가 「열린」 뒤인가 (노을·오늘의 장부처럼 수확제와 같이 시작해 계속 남는 것) */
export const launched = (now = hvNow()) => now >= HV.from;
/** 수확제 기간 중 (플래그 켬) */
export const harvestOn = (now = hvNow()) => flag('harvestFest') && hvPhase(now) === 'on';
/** 교환소가 열려 있나 (기간 + 3일) */
export const harvestShopOn = (now = hvNow()) => flag('harvestFest') && (hvPhase(now) === 'on' || hvPhase(now) === 'shop');
/** 마지막 날(11/5 한국 시간)인가 */
export const harvestFinaleDay = (now = hvNow()) => kstDayOf(now) === HV.finaleDay;

// ───────── 수확제 상태 · 리본 ─────────

/** 다른 모듈이 채우는 것 (자랑은 growth — 무거워서 여기서 import하지 않는다) */
export const hvHooks = { brag: (_name: string) => {} };

export function hvState(): HarvestState {
  const base = freshHarvest();
  const h = (P.harvest ??= base) as HarvestState;
  for (const k of Object.keys(base) as (keyof HarvestState)[]) {
    const v = h[k];
    const b = base[k];
    if (v === undefined || v === null || typeof v !== typeof b) (h as Record<string, unknown>)[k] = b;
  }
  for (const k of ['ribbons', 'earned', 'pumpkins', 'king', 'kingUsed', 'deco', 'finale', 'seen'] as const) if (!Number.isFinite(h[k]) || h[k] < 0) h[k] = 0;
  if (!h.buy || typeof h.buy !== 'object' || Array.isArray(h.buy)) h.buy = {};
  return h;
}
/** 리본을 받는다 (모은 수도 · 200개면 칭호) — 받은 수 */
export function addRibbons(n: number): number {
  n = Math.max(0, Math.floor(n));
  if (!n) return 0;
  const h = hvState();
  h.ribbons += n;
  h.earned += n;
  checkTitle();
  markDirty();
  return n;
}
/** 1-5 칭호 「첫 수확제의 주인」: 리본 누적 200 (쓴 것 포함) */
export function checkTitle(): boolean {
  const h = hvState();
  if (h.title || h.earned < HARVEST_TITLE.need) return false;
  h.title = true;
  markDirty();
  uiHooks.toast(`칭호 「${HARVEST_TITLE.name}」을 얻었어요! (메뉴 → 칭호)`);
  hvHooks.brag(HARVEST_TITLE.name);
  return true;
}
/** 기간 중 원정 성공 → 리본 1 (30분 이상 2) — 받은 수 (0 = 기간 밖) */
export function expRibbons(minutes: number, at = hvNow()): number {
  if (!harvestOn(at)) return 0;
  return addRibbons(minutes >= HV.expLongMin ? HV.ribbonExpLong : HV.ribbonExp);
}

// ───────── 여관 연감 도장 ─────────

/** 시즌 기간인가 (시험용: 플래그와 상관없이) */
export const inSeason = (now = hvNow()) => now >= ALMANAC.from && now <= ALMANAC.to;
/** 연감이 보이나 (플래그 켬 · 시즌 중) */
export const almanacOn = (now = hvNow()) => vis('almanac') && inSeason(now);
/** 지금 도장 배수 (마지막 주 ×2) */
export const stampMult = (now = hvNow()) => (now >= ALMANAC.catchUp ? 2 : 1);

export function alState(): AlmanacState {
  const base = freshAlmanac();
  const a = (P.almanac ??= base) as AlmanacState;
  for (const k of Object.keys(base) as (keyof AlmanacState)[]) {
    const v = a[k];
    if (v === undefined || v === null || typeof v !== typeof base[k] || Array.isArray(v) !== Array.isArray(base[k])) (a as Record<string, unknown>)[k] = base[k];
  }
  if (!Number.isFinite(a.stamps) || a.stamps < 0) a.stamps = 0;
  if (!Number.isFinite(a.carry) || a.carry < 0) a.carry = 0;
  a.claimed = a.claimed.filter((n) => Number.isInteger(n) && n >= 1 && n <= ALMANAC.cells);
  // 새 시즌 시작: 지난 시즌에서 넘어온 도장을 더한다 (시즌 1은 넘어온 게 없다)
  if (a.season !== ALMANAC.season) {
    const carry = a.carry;
    Object.assign(a, freshAlmanac(), { season: ALMANAC.season, stamps: carry, carry: 0, title: a.title });
  }
  return a;
}
/** 도장 받기 (시즌 밖이면 0) — 받은 수 (마지막 주 ×2) */
export function addStamps(n: number, now = hvNow()): number {
  if (!almanacOn(now) || n <= 0) return 0;
  const a = alState();
  const got = Math.floor(n) * stampMult(now);
  a.stamps += got;
  markDirty();
  return got;
}
/** 업적을 받을 때 (같은 업적 두 번 안 셈) */
export function achStamp(id: string, now = hvNow()): number {
  if (!almanacOn(now)) return 0;
  const a = alState();
  if (a.ach.includes(id)) return 0;
  a.ach.push(id);
  return addStamps(1, now);
}

// ───────── 오늘의 장부 기록 ─────────

/** progress.track이 부른다: 장부용 누적 기록 (손님 맞이·원정 보내기·강화·장식 놓기 · 마을 부탁) */
export function dbCount(ev: string, n = 1) {
  const d = (P.daybook ??= freshDaybook());
  if (!d.cnt || typeof d.cnt !== 'object' || Array.isArray(d.cnt)) d.cnt = {};
  d.cnt[ev] = (d.cnt[ev] ?? 0) + n;
}

// ───────── 칭호 (영구) ─────────

export const hvTitles = (): { t: string; from: string }[] => [
  ...(P.harvest?.title ? [{ t: HARVEST_TITLE.name, from: `첫 번째 수확제 · ${HARVEST_TITLE.desc}` }] : []),
  ...(P.almanac?.title ? [{ t: ALMANAC.title, from: '여관 연감 시즌 1 · 30칸' }] : []),
];
