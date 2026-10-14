// FIRSTLOOK §2 화면 조용히 (플래그 flQuiet · 설정 「화면 조용히」 기본 켬) — 규칙만 (DOM·그리기는 fx.ts · bldStatusDraw.ts · wayfind.ts · render.ts · ui/quiet.ts)
//  1. 마을 위 말풍선은 한 번에 1개: 우선순위 줄 (안내 > 이야기·사건 > 손님 대사 > 건물 상태) · 2.5~4초마다 하나씩 (무작위)
//     - 손님 대사·이야기 = 잠깐 뜨는 것(ms) → 줄 서서 차례로 (버리지 않음 · 1분 넘게 못 뜬 것만)
//     - 안내 「!」 = 붙잡는 것(hold) → 자리가 나면 잡고, 놓을 때까지 다른 건 기다림
//     - 건물 상태 = 빈자리 채우기 → 아무것도 없고 간격이 지났을 때만 (다른 게 오면 바로 비켜 줌)
//  3. 이름표 규칙 (nameTagRule) · 4. 떠다니는 글씨 합치기 (mergeFloat) · 5. 아래 띠 숨김 시간 (bandHidden)
//  끄면(플래그·설정) 아무 것도 안 바뀐다 · 「손님 이름 항상 보기」를 켠 사람은 이름표 예전 그대로 (★ 사용자 설정 우선)
import { CONFIG } from '../data/config';
import { getPref, setPref } from '../save/save';
import { vis } from './visual';

const Q = () => CONFIG.firstLook.quiet;

// ───────── 설정 ─────────

/** 끈 사람만 저장 (없으면 켬 = 기본) */
export const QUIET_KEY = 'quietOff';
let prefOff: boolean | null = null;
export const quietPrefOn = (): boolean => !(prefOff ??= getPref<boolean>(QUIET_KEY, false) === true);
export function setQuietPref(on: boolean) {
  prefOff = !on;
  setPref(QUIET_KEY, !on);
  qb.reset();
}
/** 세이브 설정을 이 기기에 쓴 뒤 다시 읽기 (prefsSync) */
export const reloadQuietPref = () => (prefOff = null);
/** 지금 조용히 모드인가 (플래그 · 실험실 · 설정) */
export const quietOn = (): boolean => vis('flQuiet') && quietPrefOn();

// ───────── 1. 말풍선 하나씩 ─────────

/** 작을수록 먼저: 안내(장부 손가락·「!」) · 이야기·사건 · 손님 대사 · 건물 상태 */
export const PRI = { guide: 0, story: 1, guest: 2, bld: 3 } as const;
export type Pri = (typeof PRI)[keyof typeof PRI];

export interface QItem {
  pri: number;
  /** 같은 key 는 줄에 하나만 (나중 것이 대신) */
  key: string;
  /** 떠 있는 시간 */
  ms: number;
  /** 띄우기 — false 를 돌려주면 못 띄운 것(주인이 사라짐 등) → 다음 것 */
  show: () => boolean | void;
  /** 아직 띄울 만한가 (없으면 늘 그렇다) */
  ok?: () => boolean;
  /** 줄에 선 시각 (자동) */
  at?: number;
}

/** 말풍선 자리 하나 · 순수 (시각은 밖에서) — 시험하기 쉽게 */
export class BubbleQueue {
  cur: { key: string; pri: number; until: number } | null = null;
  /** seen = 마지막으로 「아직 잡고 있어요」라고 한 시각 (holdTtl 넘게 소식이 없으면 놓은 것으로) */
  hold: { key: string; pri: number; seen: number } | null = null;
  /** 잡으려고 기다리는 「!」 (key → 우선순위 · 줄 선 시각 · 마지막으로 부른 시각) */
  wants = new Map<string, { pri: number; at: number; seen: number }>();
  /** 붙잡는 쪽이 이만큼 안 부르면 놓은 것으로 (틱이 멈췄거나 잊었을 때 줄이 영영 막히지 않게) */
  holdTtl = 3000;
  q: QItem[] = [];
  /** 다음 말풍선이 떠도 되는 시각 */
  nextAt = -Infinity;
  /** 간격(뜬 때부터) · 사라진 뒤 최소 빈 시간 · 「!」 놓은 뒤 · 버리는 나이 · 줄 길이 — 시험에서 바꿔 끼운다 */
  every = () => {
    const [a, b] = Q().bubbleEveryMs;
    return a + Math.random() * (b - a);
  };
  blank = () => Q().bubbleBlankMs;
  holdGap = () => Q().bubbleHoldGapMs;
  stale = () => Q().bubbleStaleMs;
  max = () => Q().bubbleQueueMax;
  constructor(o: Partial<Pick<BubbleQueue, 'every' | 'blank' | 'holdGap' | 'stale' | 'max'>> = {}) {
    Object.assign(this, o);
  }
  reset() {
    this.cur = null;
    this.hold = null;
    this.wants.clear();
    this.q = [];
    this.nextAt = -Infinity;
  }
  /** 잠깐 뜨는 말풍선 줄 서기 → 바로 떴으면 true */
  request(it: QItem, now: number): boolean {
    this.q = this.q.filter((x) => x.key !== it.key);
    if (this.cur?.key === it.key) return false;
    this.q.push({ ...it, at: now });
    // 줄이 넘치면 가장 덜 급한 것 중 늦게 온 것부터 (먼저 선 사람이 먼저 — 새 대사가 밀어내지 않게)
    while (this.q.length > this.max()) {
      let w = 0;
      for (let i = 1; i < this.q.length; i++) if (this.q[i].pri > this.q[w].pri || (this.q[i].pri === this.q[w].pri && this.q[i].at! >= this.q[w].at!)) w = i;
      this.q.splice(w, 1);
    }
    this.pump(now);
    return this.cur?.key === it.key;
  }
  /** 붙잡는 말풍선(「!」) — 매 틱 불러도 된다 · 지금 잡고 있으면 true */
  wantHold(key: string, pri: number, now: number): boolean {
    if (this.hold?.key === key) {
      this.hold.seen = now;
      return true;
    }
    const w = this.wants.get(key);
    if (w) w.seen = now;
    else this.wants.set(key, { pri, at: now, seen: now });
    this.pump(now);
    return this.hold?.key === key;
  }
  /** 「!」를 내림 (잡고 있었으면 지금부터 간격) */
  release(key: string, now: number) {
    this.wants.delete(key);
    if (this.hold?.key === key) {
      this.hold = null;
      this.nextAt = now + this.holdGap();
      this.pump(now);
    }
  }
  /** 자리가 비고 간격도 지났나 (건물 상태처럼 「빈자리 채우기」용 · 줄도 비어야) */
  idle(now: number): boolean {
    this.pump(now);
    return !this.cur && !this.hold && !this.q.length && !this.wants.size && now >= this.nextAt;
  }
  /** 지금 떠 있는 것 (없으면 null) */
  showing(now: number): string | null {
    this.pump(now);
    return this.hold?.key ?? this.cur?.key ?? null;
  }
  /** 시간이 흐름: 끝난 것 치우고 · 차례가 되면 가장 급한 것 하나 */
  pump(now: number) {
    if (this.cur && now >= this.cur.until) this.cur = null;
    if (this.hold && now - this.hold.seen > this.holdTtl) {
      this.hold = null;
      this.nextAt = now + this.holdGap();
    }
    for (const [k, w] of this.wants) if (now - w.seen > this.holdTtl) this.wants.delete(k);
    if (this.cur || this.hold) return;
    if (now < this.nextAt) return;
    // 아주 오래 기다린 대사만 버림 (안내는 버리지 않음 · 주인이 사라진 대사는 아래에서 건너뜀)
    this.q = this.q.filter((x) => x.pri <= PRI.guide || now - x.at! <= this.stale());
    for (;;) {
      let best: { kind: 'q'; i: number; pri: number; at: number } | { kind: 'w'; key: string; pri: number; at: number } | null = null;
      this.q.forEach((x, i) => {
        if (!best || x.pri < best.pri || (x.pri === best.pri && x.at! < best.at)) best = { kind: 'q', i, pri: x.pri, at: x.at! };
      });
      for (const [key, w] of this.wants) if (!best || w.pri < best.pri || (w.pri === best.pri && w.at < best.at)) best = { kind: 'w', key, pri: w.pri, at: w.at };
      if (!best) return;
      const b = best as { kind: 'q'; i: number; pri: number; at: number } | { kind: 'w'; key: string; pri: number; at: number };
      if (b.kind === 'w') {
        this.wants.delete(b.key);
        this.hold = { key: b.key, pri: b.pri, seen: now };
        return;
      }
      const it = this.q.splice(b.i, 1)[0];
      if (it.ok && !it.ok()) continue;
      if (it.show() === false) continue;
      this.cur = { key: it.key, pri: it.pri, until: now + it.ms };
      // 다음은 뜬 때부터 2.5~4초 (단 이 말풍선이 사라지고 잠깐 빈 뒤)
      this.nextAt = now + Math.max(this.every(), it.ms + this.blank());
      return;
    }
  }
}
/** 마을 말풍선 자리 (하나) */
export const qb = new BubbleQueue();

/** 리뷰 ②: 말풍선 화면 안쪽 여백 (CSS px) */
export const EDGE_PAD = 8;
/** 가로 [left,right] 를 [lo,hi] 안으로 옮기는 양 (넘치게 넓으면 왼쪽 맞춤) */
export function edgeShift(left: number, right: number, lo: number, hi: number): number {
  if (right - left > hi - lo) return lo - left;
  if (left < lo) return lo - left;
  if (right > hi) return hi - right;
  return 0;
}

// ───────── 2. 가운데 덮는 알림 대신 ─────────

/** ui/quiet.ts 가 채운다: 왼쪽 위 목표 알약 깜빡 + 「받기!」 꼬리표 */
export const quietHooks = {
  goalNudge: () => {},
  /** 리뷰 ④: 장부 새 장 (still = 아직 안 봤나 · open = 장부 열기) */
  chapterNudge: (_still: () => boolean, _open: () => void) => {},
};

// ───────── 3. 이름표 ─────────

export type TagTier = 'legend' | 'mythic' | 'hero' | null;
/** 이 사람 머리 위에 무엇을: null = 예전 규칙 그대로 · 아니면 tag(이름표·투명도) / dot(등급색 점) */
export function nameTagRule(o: { quiet: boolean; names: boolean; tier: TagTier; regular: boolean; zoom: number; tapped: boolean }): { tag: boolean; alpha: number; dot: boolean } | null {
  // 조용히가 꺼졌거나 「손님 이름 항상 보기」를 켠 사람 = 예전 그대로
  if (!o.quiet || o.names) return null;
  if (o.tapped) return { tag: true, alpha: 1, dot: false };
  if (o.zoom >= Q().tagZoom - 1e-6 && (o.tier || o.regular)) return { tag: true, alpha: Q().tagAlpha, dot: false };
  return { tag: false, alpha: 0, dot: !!o.tier };
}
/** 등급색 점 (이름표 글자색과 같게) */
export const TIER_DOT: Record<'legend' | 'mythic' | 'hero', string> = { legend: '#ffd36b', mythic: '#dfe6f5', hero: '#ffffff' };

// ───────── 4. 떠다니는 글씨 합치기 ─────────

/** 「케미 +1」 「+12」 「♥ 케미 +1」 → 앞말 · 부호 · 수 · 뒷말 */
const NUM = /^(.*?)([+−-])(\d[\d,]*)(.*)$/;
/** 같은 자리의 두 글씨를 하나로: 숫자 꼴이 같으면 더하기 · 글자가 똑같으면 하나 · 아니면 null (따로) */
export function mergeFloat(a: string, b: string): string | null {
  if (a === b && !NUM.test(a)) return a;
  const x = NUM.exec(a);
  const y = NUM.exec(b);
  if (!x || !y || x[1] !== y[1] || x[2] !== y[2] || x[4] !== y[4]) return null;
  const n = +x[3].replace(/,/g, '') + +y[3].replace(/,/g, '');
  return `${x[1]}${x[2]}${x[3].includes(',') || y[3].includes(',') ? n.toLocaleString('ko-KR') : n}${x[4]}`;
}

// ───────── 5. 아래 소문·채팅 띠 ─────────

let openedAt = -1;
/** 마을을 처음 연 때 (이번 세션에서 한 번) */
export function noteVillageOpen(now: number) {
  if (openedAt < 0) openedAt = now;
}
/** 시험용 */
export const resetVillageOpen = () => (openedAt = -1);
/** 띠를 숨길 때인가 (마을을 연 뒤 bandHideMs 동안) */
export const bandHidden = (now: number, on = quietOn()): boolean => on && openedAt >= 0 && now - openedAt < Q().bandHideMs;
