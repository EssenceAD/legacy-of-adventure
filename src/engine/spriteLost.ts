// SPRLOST (웅스 신고: 롯데캐슬 171채 · 갤럭시 — 앱을 내렸다 오거나 채팅창을 열면 건물·나무·장식이 다 사라지고 바닥·울타리·이름표만)
//  깨진 그림 지키기의 순수한 부분: 안전망 판정(SpriteWatch) · 폰/큰 마을 캐시 상한 · sprite_lost 기록 묶기
//  DOM·그림 모듈을 불러오지 않는다 (테스트에서 그대로 쓰게)
import { CONFIG } from '../data/config';

const G = () => CONFIG.render.spriteGuard;

// ───────── 안전망: 화면에 그려야 할 그림 중 30% 넘게 3초 넘게 못 그리면 ─────────

export type WatchAct = 'none' | 'refetch' | 'button' | 'recovered';
/**
 * 프레임마다 (그리려던 그림 수 n, 못 그린 수 bad, 시각 ms)를 받아 할 일을 돌려준다.
 *  · 못 그린 비율 > badRatio 가 holdMs 넘게 이어지면 'refetch' (원본 그림 모두 다시 받기)
 *  · 다시 받은 뒤에도 holdMs 넘게 그대로면 'button' (윗줄 「그림 다시 불러오기」)
 *  · 다시 괜찮아지면 'recovered' (버튼 숨기기)
 *  · 그린 게 minDraws보다 적은 프레임(창이 덮음 등)은 판정하지 않는다 · 다시 받는 중(busy)에도
 */
export class SpriteWatch {
  /** 나쁜 상태가 시작된 시각 (-1 = 괜찮음) */
  badSince = -1;
  /** 0 보통 · 1 다시 받았음(지켜보는 중) · 2 버튼을 띄움 */
  stage: 0 | 1 | 2 = 0;
  busy = false;
  constructor(private cfg: { badRatio: number; holdMs: number; minDraws: number } = G()) {}
  frame(n: number, bad: number, now: number): WatchAct {
    if (this.busy || n < this.cfg.minDraws) return 'none';
    if (bad / n <= this.cfg.badRatio) {
      this.badSince = -1;
      if (!this.stage) return 'none';
      this.stage = 0;
      return 'recovered';
    }
    if (this.badSince < 0) this.badSince = now;
    if (now - this.badSince < this.cfg.holdMs || this.stage === 2) return 'none';
    this.badSince = now;
    if (this.stage === 0) {
      this.stage = 1;
      return 'refetch';
    }
    this.stage = 2;
    return 'button';
  }
  /** 다시 받기 시작 · 끝 (끝난 뒤부터 다시 holdMs를 잰다) */
  start() {
    this.busy = true;
  }
  done(now: number) {
    this.busy = false;
    this.badSince = this.badSince < 0 ? -1 : now;
  }
}

// ───────── 캐시 상한: 폰 · 큰 마을이면 낮춘다 ─────────

export interface CacheCaps {
  tint: number;
  recolor: number;
  hit: number;
}
/** data-size(phone|tablet|wide) · 건물 수 → 그림 캐시 상한 (둘 다 해당하면 작은 쪽) */
export function cacheCaps(size: string | undefined, buildings: number): CacheCaps {
  const R = CONFIG.render;
  const caps: CacheCaps = { tint: R.tintCacheMax, recolor: R.recolorCacheMax, hit: R.hitCacheMax };
  const low = (c: CacheCaps) => {
    caps.tint = Math.min(caps.tint, c.tint);
    caps.recolor = Math.min(caps.recolor, c.recolor);
    caps.hit = Math.min(caps.hit, c.hit);
  };
  if (size === 'phone') low(R.phoneCaps);
  if (buildings > R.bigVillage.buildings) low(R.bigVillage);
  return caps;
}

// ───────── 기기 요약 (기록용 · 개인정보 없이) ─────────

/** UA → 「운영체제-브라우저」 한 낱말 (예: android-samsung · ios-safari · android-kakao) */
export function uaClass(ua: string): string {
  const os = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Windows/i.test(ua) ? 'win' : /Mac OS X|Macintosh/i.test(ua) ? 'mac' : /CrOS/.test(ua) ? 'cros' : /Linux/i.test(ua) ? 'linux' : 'other';
  const br = /SamsungBrowser/i.test(ua)
    ? 'samsung'
    : /KAKAOTALK/i.test(ua)
      ? 'kakao'
      : /NAVER\(|NaverMatome|Whale/i.test(ua)
        ? 'naver'
        : /; wv\)/.test(ua)
          ? 'webview'
          : /EdgA?\/|Edg\//.test(ua)
            ? 'edge'
            : /Firefox|FxiOS/.test(ua)
              ? 'firefox'
              : /CriOS|Chrome\//.test(ua)
                ? 'chrome'
                : /Safari/.test(ua)
                  ? 'safari'
                  : 'other';
  return os + '-' + br;
}

// ───────── sprite_lost 기록 묶기 (스팸 막기) ─────────

export type LostPhase = 'lost' | 'reload_ok' | 'give_up' | 'refetch' | 'refetch_ok' | 'refetch_fail';
export interface LostEvent {
  phase: LostPhase;
  /** 그동안 해당된 그림 이름 수 */
  n: number;
  /** 이름 몇 개 (앞 3개) */
  some: string[];
}
/**
 * 잃음·다시 불러옴·포기를 단계마다 이름 집합으로 모았다가 gapMs에 한 번만 내보낸다 · 세션 상한 maxEvents
 */
export class LostLog {
  private pend = new Map<LostPhase, Set<string>>();
  private last = -Infinity;
  sent = 0;
  constructor(private cfg: { gapMs: number; maxEvents: number } = { gapMs: G().telemetryGapMs, maxEvents: G().telemetryMax }) {}
  add(phase: LostPhase, name: string) {
    if (this.sent >= this.cfg.maxEvents) return;
    let s = this.pend.get(phase);
    if (!s) this.pend.set(phase, (s = new Set()));
    if (s.size < 500) s.add(name.slice(0, 40));
  }
  get pending() {
    return this.pend.size > 0;
  }
  /** 다음에 내보낼 수 있는 시각 */
  readyAt() {
    return this.last + this.cfg.gapMs;
  }
  /** 시간이 됐으면 모아 둔 것을 내보낸다 (단계마다 하나씩 · 상한까지) */
  flush(now: number): LostEvent[] {
    if (!this.pend.size || now < this.readyAt()) return [];
    this.last = now;
    const out: LostEvent[] = [];
    for (const [phase, s] of this.pend) {
      if (this.sent >= this.cfg.maxEvents) break;
      this.sent++;
      out.push({ phase, n: s.size, some: [...s].slice(0, 3) });
    }
    this.pend.clear();
    return out;
  }
}

// ───────── 보내기 (track 규칙 그대로: 설정 「플레이 기록 보내기」를 끄면 track이 버린다 · 개발 빌드도 안 보냄) ─────────

const LOG = new LostLog();
/** 개발·e2e 확인용: 최근에 내보낸 sprite_lost (보내지 않는 빌드에서도 모아 둔다) */
export const lostSent: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setTimeout> | 0 = 0;
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
let sink: (name: string, props: Record<string, unknown>) => void = () => {};
/** 보낼 곳 (assets.ts 가 track을 넣는다 — 이 파일은 telemetry를 불러오지 않아 테스트에서 가볍다) */
export function setLostSink(fn: (name: string, props: Record<string, unknown>) => void) {
  sink = fn;
}
/** 기기 요약: UA 갈래 · dpr · 화면 크기 구간 */
export function deviceSummary() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const dpr = typeof devicePixelRatio === 'number' ? Math.round(devicePixelRatio * 100) / 100 : 1;
  const size = typeof document !== 'undefined' ? (document.documentElement.dataset.size ?? '?') : '?';
  return { ua: uaClass(ua), dpr, size };
}
/** 잃음·다시 불러옴·포기 하나 — 모았다가 telemetryGapMs에 한 번 sprite_lost 로 */
export function reportLost(phase: LostPhase, name: string) {
  LOG.add(phase, name);
  if (timer || !LOG.pending) return;
  timer = setTimeout(flushLost, Math.max(0, LOG.readyAt() - nowMs()));
}
function flushLost() {
  timer = 0;
  for (const e of LOG.flush(nowMs())) {
    const props = { phase: e.phase, n: e.n, some: e.some, ...deviceSummary(), vis: typeof document !== 'undefined' ? document.visibilityState : '?' };
    lostSent.push(props);
    if (lostSent.length > 50) lostSent.shift();
    sink('sprite_lost', props);
  }
  if (LOG.pending && LOG.sent < G().telemetryMax) timer = setTimeout(flushLost, Math.max(0, LOG.readyAt() - nowMs()));
}
