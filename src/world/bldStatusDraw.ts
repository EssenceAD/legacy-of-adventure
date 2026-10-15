// CHECKIN §J8 건물 말풍선 그리기 · 누르기 · 마우스 올리기
//  상태는 0.5초마다만 다시 고른다 (bldStatus.ts) — 프레임마다는 그림 몇 장만.
//  말풍선 22×24 (아이콘 16 + 테두리 3) · 아이콘은 (3,2) · 2~3초마다 1px 살랑 · 밤엔 등불색 테두리 · 밤 색조를 안 먹음(늘 또렷)
//  줌 ≥ textZoom(CSS px/도트) 이거나 PC에서 마우스를 올리면 짧은 글 한 줄이 옆에 붙는다.
import { CONFIG } from '../data/config';
import { pixText } from './pixText';
import { META } from '../engine/assets';
import { scr, view } from '../engine/iso';
import { canvas, P } from '../engine/pixel';
import { av } from '../engine/ver';
import { bubblesHidden, collectCands, dismissBubble, selectBubbles, type BldCand, type BldIcon } from './bldStatus';
import { EDGE_PAD, qb, quietOn } from './quiet';
import { decorView } from './decor';
import { S, type Actor, type Building } from './state';
import { placing } from './town';

const C = CONFIG.bldStatus;
const BW = 22;
const BH = 24;
const ICONS: BldIcon[] = ['seed', 'basket', 'pray', 'hammer', 'flag', 'flag_gray', 'rod', 'dummy', 'flask'];
const IM: Partial<Record<BldIcon | 'bubble', HTMLImageElement>> = {};
let NIGHT: HTMLCanvasElement | null = null;
let asked = false;
/** 그림은 처음 켤 때만 불러온다 (플래그 끔 = 요청도 없음) */
function ensureImages() {
  if (asked) return;
  asked = true;
  for (const k of ['bubble', ...ICONS] as const) {
    const im = new Image();
    im.onload = () => {
      IM[k] = im;
      if (k === 'bubble') NIGHT = lanternBubble(im);
    };
    im.src = av(`assets/ui/bubble/${k}.png`);
  }
}
/** 밤: 어두운 테두리 → 등불색 */
function lanternBubble(im: HTMLImageElement): HTMLCanvasElement | null {
  try {
    const c = canvas(im.width, im.height);
    const x = c.getContext('2d')!;
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4)
      if (d.data[i + 3] > 0 && d.data[i] + d.data[i + 1] + d.data[i + 2] < 150) {
        d.data[i] = 0xe8;
        d.data[i + 1] = 0xa0;
        d.data[i + 2] = 0x40;
      }
    x.putImageData(d, 0, 0);
    return c;
  } catch {
    return null;
  }
}

// ───────── 상태 (0.5초마다) ─────────

let shown: BldCand[] = [];
let at = -Infinity;
let wfActor: Actor | null = null;
/** 성능 기록 (개발·e2e): 상태 고르기 횟수·누적 ms · 그리기 누적 ms */
const perf = { picks: 0, pickMs: 0, draws: 0, drawMs: 0 };
function refresh(now: number) {
  at = now;
  const t0 = performance.now();
  try {
    // FIRSTLOOK §2-1 화면 조용히: 건물 상태는 한 번에 1개 (원래 3)
    shown = selectBubbles(collectCands(), quietOn() ? CONFIG.firstLook.quiet.bldMax : CONFIG.bldStatus.max);
  } catch {
    shown = [];
  }
  // WAYFIND 「!」가 떠 있는 사람 (겹치면 「!」가 먼저)
  wfActor = (document.querySelector('.wfbub') as (HTMLElement & { _a?: Actor }) | null)?._a ?? null;
  perf.picks++;
  perf.pickMs += performance.now() - t0;
}
/** 다음 프레임에 바로 다시 고르기 (눌렀을 때) */
export const bldDirty = () => (at = -Infinity);

// ───────── 자리 ─────────

interface Spot {
  c: BldCand;
  x: number;
  y: number;
  w: number;
  h: number;
}
let spots: Spot[] = [];
/** 건물 그림 위 가운데 (말풍선 꼬리 끝이 지붕 꼭대기 조금 위) */
function anchor(o: Building): [number, number] | null {
  if (!o.sprite || !META[o.sprite]) return null;
  const m = META[o.sprite];
  const [x, y] = objTLHook(o);
  return [Math.round(x + m.w / 2), y + topPad(o.sprite)];
}
/** render.ts 의 objTL (순환 import 피하려고 render 가 넣어 준다) */
let objTLHook: (o: Building) => [number, number] = () => [0, 0];
/** 그림 위쪽 투명 줄 수 (한 번 재서 기억) — 말풍선이 허공에 뜨지 않게 */
const PAD = new Map<string, number>();
let imgOf: (k: string) => CanvasImageSource & { width: number; height: number } = () => canvas(1, 1);
function topPad(k: string): number {
  const v = PAD.get(k);
  if (v !== undefined) return v;
  let pad = 0;
  try {
    const im = imgOf(k);
    const c = canvas(im.width, im.height);
    const x = c.getContext('2d')!;
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    outer: for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 0) {
      pad = y;
      break outer;
    }
  } catch {
    pad = 0;
  }
  PAD.set(k, pad);
  return pad;
}
export function setBldHooks(h: { objTL: (o: Building) => [number, number]; img: (k: string) => CanvasImageSource & { width: number; height: number } }) {
  objTLHook = h.objTL;
  imgOf = h.img;
}

// ───────── 마우스 올리기 (PC) ─────────

let hover: Building | null = null;
export const setBldHover = (o: Building | null) => (hover = o);

// ───────── 그리기 ─────────

/** 이 프레임에 말풍선을 그리나 (사진 모드는 renderFrame 이 먼저 돌아가서 안 그림 — 누르기·기록용으로 body.photo 도 봄) */
const active = () => !bubblesHidden() && !decorView.on && !placing.pl && !document.body.classList.contains('photo');
/** 지금 이 건물 위에 말풍선(고리)이 떠 있나 — 옛 「수확!」 글씨 대신 */
export const hasBubble = (o: Building) => active() && spots.some((s) => s.c.o === o);

export function drawBldStatus(ctx: CanvasRenderingContext2D, nt: number) {
  // FIRSTLOOK §2-1 화면 조용히: 건물 상태는 꼴찌 — 다른 말풍선이 떠 있거나 기다리거나 간격(2.5초) 안이면 쉰다
  if (!active() || (quietOn() && !qb.idle(performance.now()))) {
    spots = [];
    return;
  }
  ensureImages();
  const now = performance.now();
  if (now - at >= C.everyMs) refresh(now);
  const t0 = performance.now();
  const bub = IM.bubble;
  const next: Spot[] = [];
  const wf = wfRect();
  shown.forEach((c, i) => {
    const a = anchor(c.o);
    if (!a) return;
    // 2~3초마다 1px (말풍선마다 조금씩 어긋나게)
    const bob = Math.floor(S.T / C.bobSec + i * 0.37) % 2;
    if (c.tier === 2) {
      const X = a[0];
      const Y = a[1] - 6 - bob;
      const s = { c, x: X - 5, y: Y - 5, w: 11, h: 11 };
      if (wf && hit(wf, s)) return;
      ring(ctx, X, Y, c.prog ?? 0);
      next.push(s);
      return;
    }
    if (!bub) return;
    const X0 = a[0] - (BW >> 1);
    // FIRSTLOOK §2 리뷰 ②: 조용히면 화면 좌우 8px 안으로 밀고 꼬리만 건물 쪽에
    const X = quietOn() ? edgeX(X0) : X0;
    const Y = a[1] - BH + 2 - bob;
    const s = { c, x: X, y: Y, w: BW, h: BH };
    if (wf && hit(wf, s)) return;
    const img = nt > 0.5 && NIGHT ? NIGHT : bub;
    if (X === X0) ctx.drawImage(img, X, Y);
    else bubbleShifted(ctx, img, X, Y, X0);
    const ic = IM[c.icon];
    if (ic) ctx.drawImage(ic, X + 3, Y + 2);
    if (c.shine) sparkle(ctx, X + BW - 3, Y + 1, S.T + i);
    next.push(s);
    if (view.SC >= C.textZoom - 1e-6 || hover === c.o) label(ctx, X, Y, c.text, nt);
  });
  spots = next;
  perf.draws++;
  perf.drawMs += performance.now() - t0;
}

/** 화면 좌우 EDGE_PAD(CSS px) 안의 말풍선 왼쪽 (논리 px) */
function edgeX(X: number): number {
  const m = Math.ceil(EDGE_PAD / view.SC);
  return Math.max(m, Math.min(view.LW - m - BW, X));
}
/**
 * 민 말풍선 (bubble.png 22×24: 0~18줄 몸통 · 19줄 아래 테두리(9~12칸 꼬리 입구) · 20~22줄 꼬리)
 *  몸통은 X에 · 아래 테두리는 1칸을 늘려 다시 긋고 · 꼬리(9~12칸 19~22줄)는 원래 자리(X0)에 — 몸통 안쪽 3칸까지만
 */
function bubbleShifted(ctx: CanvasRenderingContext2D, img: CanvasImageSource, X: number, Y: number, X0: number) {
  ctx.drawImage(img, 0, 0, BW, 19, X, Y, BW, 19);
  ctx.drawImage(img, 0, 19, 3, 1, X, Y + 19, 3, 1);
  ctx.drawImage(img, 3, 19, 1, 1, X + 3, Y + 19, BW - 6, 1);
  ctx.drawImage(img, BW - 3, 19, 3, 1, X + BW - 3, Y + 19, 3, 1);
  const tx = Math.max(X + 3, Math.min(X + BW - 7, X0 + 9));
  ctx.drawImage(img, 9, 19, 4, 4, tx, Y + 19, 4, 4);
}

/** 진행 고리 (말풍선 없이) — 반지름 4 · 위에서 시계 방향으로 채움 */
const RING: [number, number][] = (() => {
  const pts: [number, number, number][] = [];
  for (let y = -5; y <= 5; y++)
    for (let x = -5; x <= 5; x++) {
      const r = Math.hypot(x, y);
      if (r >= 3.5 && r < 4.6) pts.push([x, y, (Math.atan2(x, -y) + 2 * Math.PI) % (2 * Math.PI)]);
    }
  return pts.sort((a, b) => a[2] - b[2]).map(([x, y]) => [x, y]);
})();
function ring(ctx: CanvasRenderingContext2D, X: number, Y: number, prog: number) {
  const p = P(ctx);
  const n = Math.round(prog * RING.length);
  RING.forEach(([x, y], k) => p.px(X + x, Y + y, k < n ? '#8fdc5e' : '#1b2230'));
}
/** 반짝 (받을 것): 2초에 0.4초만 작은 십자 */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  if (t % 2 > 0.4) return;
  const p = P(ctx);
  p.px(x, y, '#ffffff');
  p.px(x - 1, y, '#fff3b0');
  p.px(x + 1, y, '#fff3b0');
  p.px(x, y - 1, '#fff3b0');
  p.px(x, y + 1, '#fff3b0');
}
function label(ctx: CanvasRenderingContext2D, X: number, Y: number, text: string, nt: number) {
  ctx.font = '10px "Galmuri9"';
  const w = Math.ceil(ctx.measureText(text).width) + 8;
  // 오른쪽에 자리가 없으면 왼쪽 · 둘 다 모자라면 말풍선 아래 가운데 (말풍선을 가리지 않게)
  let L = X + BW + 1;
  let T = Y + 4;
  if (L + w > view.LW - 2) {
    if (X - w - 1 >= 2) L = X - w - 1;
    else {
      L = Math.max(2, Math.min(view.LW - 2 - w, X + (BW >> 1) - (w >> 1)));
      T = Y + BH + 1;
    }
  }
  const p = P(ctx);
  p.rect(L, T, w, 14, nt > 0.5 ? '#e8a040' : '#161420');
  p.rect(L + 1, T + 1, w - 2, 12, '#2a2436');
  pixText(ctx, text, L + 4, T + 2, { color: '#fff3d6', baseline: 'top' });
}

// ───────── WAYFIND 「!」와 겹침 ─────────

type Rect = { x: number; y: number; w: number; h: number };
const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** 「!」 단추 자리 (도트 좌표 · 머리 위 CSS 26×30 + 16px 띄움 → 도트로) */
function wfRect(): Rect | null {
  const a = wfActor;
  if (!a || a.hidden) return null;
  const [X, Y] = scr(a.x, a.y);
  const w = 30 / view.SC;
  const h = 48 / view.SC;
  return { x: X - w / 2, y: Y - 26 - h, w, h: h + 26 };
}

// ───────── 누르기 ─────────

/** 누른 자리의 말풍선 건물 (누르는 칸은 CSS 44px 이상) */
export function bubbleAt(mx: number, my: number): BldCand | null {
  if (!active()) return null;
  const m = Math.max(0, C.hitCss / view.SC);
  for (let i = spots.length - 1; i >= 0; i--) {
    const s = spots[i];
    const gx = Math.max(0, (m - s.w) / 2);
    const gy = Math.max(0, (m - s.h) / 2);
    if (mx >= s.x - gx && mx < s.x + s.w + gx && my >= s.y - gy && my < s.y + s.h + gy) return s.c;
  }
  return null;
}
/** 말풍선을 눌렀다: 이 상태는 바뀔 때까지 숨김 → 건물 창은 부른 쪽이 연다 */
export function tapBubble(c: BldCand) {
  dismissBubble(c.o, c.id);
  spots = spots.filter((s) => s.c !== c);
  shown = shown.filter((s) => s !== c);
  bldDirty();
}

// 개발용 (e2e)
if (import.meta.env.DEV)
  Object.assign(globalThis, { __bld: { spots: () => (active() ? spots : []).map((s) => ({ kind: s.c.o.kind, id: s.c.id, tier: s.c.tier, x: s.x, y: s.y, w: s.w, h: s.h })), perf: () => ({ ...perf }), refresh: bldDirty } });
