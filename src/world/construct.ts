// CONSTRUCTION_SPEC: 공사 시간 · 동시 공사 수 · 뚝딱 탭 · 모모의 응원 · 오프라인 완료
//  공사 정보는 Building.con — 새 짓기는 o.build(=공사 중 표시, 아직 못 씀)도 같이 켠다. 업그레이드는 건물이 그대로 일하고 레벨만 완성 때 오른다.
import { CONFIG } from '../data/config';
import { def } from '../data/catalog';
import { today } from './progress';
import { markDirty, P, S, world, type Building } from './state';
import { sizeFor, spriteFor } from './town';

declare const __BOT__: boolean;
const B = () => CONFIG.build;
/** 봇 빌드는 공사 시간 1/20 (30분 봇이 기다리기만 하지 않게) */
//  (e2e는 window.__conScale = 1 로 실제 시간을 쓴다)
const scale = () => (globalThis as { __conScale?: number }).__conScale ?? (typeof __BOT__ !== 'undefined' && __BOT__ ? 1 / 20 : 1);

export interface Con {
  kind: 'new' | 'up';
  /** 끝나는 현실 시각(ms) */
  end: number;
  /** 원래 걸리는 시간(초) — 진행률·탭 상한 */
  total: number;
  /** 목표 레벨 */
  to: number;
  /** 탭으로 줄인 초 */
  cut: number;
  /** SOCIAL §3: 각별한 이웃이 거들어 줄인 초 (원래 시간의 30%까지) */
  friendCut?: number;
  /** 업그레이드에 낸 금화 (철거 때 전액 환불) */
  cost: number;
  /** 커지는 업그레이드: 공사 전 자리 (이웃 스냅샷용) */
  from?: [number, number];
}

/** 새 건물 공사 시간(초): 1칸 장식 3초 · 건물은 비용/10초 (30~120초) */
export function newSeconds(kind: string): number {
  const d = def(kind as never);
  const [w, h] = sizeFor(kind as never, 1);
  if (w === 1 && h === 1) return B().decoSeconds * scale();
  return Math.min(B().newMax, Math.max(B().newMin, d.cost / B().newPerCostSec)) * scale();
}
/** 업그레이드 공사 시간(초): 목표 레벨 2~10 → 1·3·5·10·12·15·20·25·30분 */
export function upSeconds(to: number): number {
  const t = B().upMinutes;
  return t[Math.max(0, Math.min(t.length - 1, to - 2))] * 60 * scale();
}

/** 동시 공사 수: 처음 1곳 · 여관 Lv.4 2곳 · Lv.8 3곳 */
export function conSlots(objs: Building[] = world.objs): number {
  const inn = objs.find((o) => o.kind === 'inn')?.lvl ?? 1;
  return 1 + B().workerInnLv.filter((lv) => inn >= lv).length;
}
/** 지금 공사 중 (1칸 장식은 세지 않음 — 금방 끝나니까) */
export const activeCons = (objs: Building[] = world.objs) => objs.filter((o) => o.con && !(o.fw === 1 && o.fh === 1));
export const slotFree = (objs: Building[] = world.objs) => activeCons(objs).length < conSlots(objs);
export const conLeft = (o: Building, now = Date.now()) => (o.con ? Math.max(0, (o.con.end - now) / 1000) : 0);
export const conProgress = (o: Building, now = Date.now()) => (o.con ? Math.min(1, Math.max(0, 1 - conLeft(o, now) / Math.max(0.001, o.con.total))) : 1);
/** 「2:41」 */
export function clock(sec: number): string {
  const s = Math.ceil(sec);
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 새 짓기 공사 시작 (placeBuilding이 부른다) */
export function startNew(o: Building, now = Date.now()) {
  const total = newSeconds(o.kind);
  o.con = { kind: 'new', end: now + total * 1000, total, to: o.lvl, cut: 0, cost: 0 };
  o.build = 1;
}
/** 업그레이드 공사 시작: 커지는 레벨이면 지금 새 발판으로 공사 터를 잡는다 (레벨·효과는 완성 때) */
export function startUp(o: Building, cost: number, now = Date.now()) {
  const to = o.lvl + 1;
  const total = upSeconds(to);
  const [nw, nh] = sizeFor(o.kind, to);
  const from: [number, number] | undefined = nw !== o.fw || nh !== o.fh ? [o.tx, o.ty] : undefined;
  if (from) Object.assign(o, { tx: o.tx - (nw - o.fw), ty: o.ty - (nh - o.fh), fw: nw, fh: nh });
  o.con = { kind: 'up', end: now + total * 1000, total, to, cut: 0, cost, ...(from ? { from } : {}) };
  markDirty();
}

/** 끝난 공사 마무리 → 끝난 건물 이름 (훅이 연출) */
export const conHooks = { done: (_o: Building, _offline: boolean) => {} };
export function finishCon(o: Building, offline = false) {
  const c = o.con;
  if (!c) return;
  if (c.kind === 'up') Object.assign(o, { lvl: c.to, sprite: spriteFor(o.kind, c.to, o.flip) });
  o.con = undefined;
  o.build = undefined;
  markDirty();
  conHooks.done(o, offline);
}
/** 매 틱: 시간이 다 된 공사 마무리 (오프라인으로 끝난 것도 처음 틱에 한꺼번에) */
export function tickCons(now = Date.now(), offline = false): Building[] {
  if (S.visiting) return [];
  const done = world.objs.filter((o) => o.con && o.con.end <= now);
  for (const o of done) finishCon(o, offline);
  return done;
}

/** 뚝딱 탭: 1초 단축, 한 공사에 원래 시간의 30%까지. 줄였으면 true */
let lastTap = 0;
export function tapCon(o: Building, now = Date.now()): boolean {
  const c = o.con;
  if (!c || c.end <= now) return false;
  // BUILDINGS_SPEC §1: 상한 없음 · 매크로 수준 연타만 막는 최소 간격
  if (now - lastTap < B().tapMinMs) return true;
  lastTap = now;
  P.counters.taps = (P.counters.taps ?? 0) + 1;
  const cap = c.total * B().tapCapPct;
  if (c.cut + 1 > cap + 1e-9) return false;
  c.cut += 1;
  c.end -= 1000;
  markDirty();
  return true;
}
export const tapCapped = (o: Building) => !!o.con && o.con.cut + 1 > o.con.total * B().tapCapPct + 1e-9;

/** 하루 1번 「모모의 응원」: 공사 하나 즉시 완성 */
export const cheerReady = () => P.meta.cheerDay !== today() || (P.meta.cheerBonus ?? 0) > 0;
export function cheerCon(o: Building): boolean {
  if (!o.con || !cheerReady()) return false;
  // 오늘 몫을 먼저 쓰고, 이미 썼으면 선물로 받은 횟수에서
  if (P.meta.cheerDay !== today()) P.meta.cheerDay = today();
  else P.meta.cheerBonus = Math.max(0, (P.meta.cheerBonus ?? 0) - 1);
  finishCon(o);
  return true;
}

/** 철거: 공사 취소 — 업그레이드 비용은 전액 돌려준다 (발판도 원래대로) */
export function cancelRefund(o: Building): number {
  const c = o.con;
  if (!c) return 0;
  if (c.from) Object.assign(o, { tx: c.from[0], ty: c.from[1], fw: sizeFor(o.kind, o.lvl)[0], fh: sizeFor(o.kind, o.lvl)[1] });
  o.con = undefined;
  return c.kind === 'up' ? c.cost : 0;
}

/** 저장용 (Date.now 기준 끝 시각 그대로 — 앱을 꺼도 흐른다) */
export const saveCon = (o: Building): Con | undefined => (o.con ? { ...o.con } : undefined);
