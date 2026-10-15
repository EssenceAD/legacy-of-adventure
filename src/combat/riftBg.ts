// RIFTART 하늘 균열 전투 배경 — 「하늘 균열인데 심연이랑 똑같네?」 → 심연(검은 돌 바닥)이 아니라 밤하늘
//  하늘: 짙은 남색 → 보라 세로 그라데이션 · 흩어진 별 (은은한 반짝 — 동작 줄이기 · 배터리 절약이면 멈춤) · 위쪽을 가로지르는 큰 보라 금 (빛나는 금)
//  바닥: 구름 섬 (연보라 구름 · 밖은 하늘이 비치고 · 아래로 섬 그림자 몇 겹)
//  소품: asset_raw/rift/props/*.png 가 있으면 (scripts/copy-rift-art.mjs → src/data/riftArt.ts) 보스 모습마다 정해진 자리에 3~5개 · 싸우는 이들 뒤
//  정적인 층(하늘 그라데이션 · 흐린 별 · 금)은 화면 크기·모습이 바뀔 때만 다시 만든다
import { RIFT_ART } from '../data/riftArt';
import { av } from '../engine/ver';
import { saverOn } from '../engine/fps';
import type { Theme } from './theme';

export type BgMode = 'rift' | 'region';
/** 전투 배경 고르기: 하늘 균열 판만 'rift' · 나머지(사냥·토벌·심연)는 지역 테마 그대로 */
export const bgMode = (f: { world?: boolean }): BgMode => (f.world ? 'rift' : 'region');

const CLEAR = 'rgba(0,0,0,0)';
/** 구름 섬 테마 (바닥 · 바위 색 · 입자 · 빛) — 지역 테마 표(THEMES)에는 넣지 않는다 (사냥 지역이 아님) */
export const RIFT_THEME: Theme = {
  pal: { a: '#cfc3f3', b: '#ddd4f9', c: '#bcaeea', dirt: '#f1ecff', dirtD: '#a596dc', edge: '#e4dcfc', void: CLEAR, x1: '#ffffff', x2: '#b07cff', rune: '#c9a6ff' },
  floor: (wx, wy, h, n, _N, P, fbm) => {
    // 몽글몽글 구름: 큰 얼룩은 하얗게 · 얼룩 가장자리는 옅은 그늘 · 드물게 보라 별 가루
    if (h < 0.004) return P.x2;
    const g = fbm(wx * 0.8 + 5, wy * 0.8 + 11);
    if (g > 0.68) return h < 0.35 ? P.x1 : P.dirt;
    if (g > 0.62) return P.b;
    if (g < 0.3) return h < 0.45 ? P.dirtD : P.c;
    return n > 0.6 ? P.b : h < 0.1 ? P.c : P.a;
  },
  outside: (e, _x, _y, h, P) => {
    // 가장자리: 밝은 구름 테 → 바깥으로 갈수록 듬성듬성 (하늘이 비친다)
    if (e >= -0.15) return h < 0.5 ? P.edge : P.dirt;
    const k = 1 + e / 0.85;
    if (k <= 0) return P.void;
    return h < k * 0.55 ? (h < k * 0.2 ? P.x1 : P.edge) : P.void;
  },
  props: [],
  glow: {},
  particle: 'upfall',
  light: 'rift',
  rock: ['#b9a8e6', '#ece6ff', '#8a78c4'],
  band: '#9a6cf0',
};

/** 구름 섬 아래 그림자 겹 (바닥 그림 그대로 아래로 밀어 어둡게) — 같은 캔버스를 돌려준다 */
export function riftIsland(c: HTMLCanvasElement): HTMLCanvasElement {
  const x = c.getContext('2d');
  if (!x) return c;
  const sil = (col: string) => {
    const o = document.createElement('canvas');
    o.width = c.width;
    o.height = c.height;
    const y = o.getContext('2d')!;
    y.drawImage(c, 0, 0);
    y.globalCompositeOperation = 'source-in';
    y.fillStyle = col;
    y.fillRect(0, 0, o.width, o.height);
    return o;
  };
  x.globalCompositeOperation = 'destination-over';
  for (const [dy, col] of [[3, '#9c8ad6'], [7, '#6a56b0'], [11, 'rgba(52,34,104,0.65)']] as const) x.drawImage(sil(col), 0, dy);
  x.globalCompositeOperation = 'source-over';
  return c;
}

// ───────── 정해진 난수 (모습 키마다 같은 배치) ─────────
export function seedOf(key: string): number {
  let s = 2166136261;
  for (let i = 0; i < key.length; i++) s = Math.imul(s ^ key.charCodeAt(i), 16777619) >>> 0;
  return s;
}
const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

/** 빛나는 금: 위쪽을 가로지르는 꺾은선 (+ 짧은 가지 셋) — 화면 크기에 맞춘 정수 좌표 */
export function crackPath(key: string, LW: number, LH: number): { main: [number, number][]; branches: [number, number][][] } {
  const R = rng(seedOf('crack|' + key));
  const n = 9;
  const y0 = LH * (0.15 + R() * 0.05);
  const slant = (R() - 0.5) * LH * 0.08;
  const jy = Math.max(4, LH * 0.028);
  const main: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = LW * (0.04 + 0.92 * t) + (i && i < n ? (R() - 0.5) * (LW / n) * 0.5 : 0);
    const y = y0 + slant * (t - 0.5) + (i && i < n ? (R() - 0.5) * 2 * jy : 0);
    main.push([Math.round(x), Math.round(y)]);
  }
  const branches: [number, number][][] = [];
  for (let b = 0; b < 3; b++) {
    const i = 2 + Math.floor(R() * (n - 3));
    const [sx, sy] = main[i];
    const dir = R() < 0.5 ? -1 : 1;
    const len = Math.max(8, LW * (0.04 + R() * 0.04));
    const mid: [number, number] = [Math.round(sx + len * 0.5 * (R() - 0.3)), Math.round(sy + dir * len * 0.45)];
    const end: [number, number] = [Math.round(sx + len * (R() - 0.3)), Math.round(sy + dir * len * 0.85)];
    branches.push([[sx, sy], mid, end]);
  }
  return { main, branches };
}

/** 점 하나씩 선 (도트가 번지지 않게) */
function pixLine(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], w = 1) {
  let [x0, y0] = a;
  const [x1, y1] = b;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let k = 0; k < 4000; k++) {
    ctx.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) (err += dy), (x0 += sx);
    if (e2 <= dx) (err += dx), (y0 += sy);
  }
}

// ───────── 정적인 층 (캐시) ─────────
let skyCv: HTMLCanvasElement | null = null;
let crackCv: HTMLCanvasElement | null = null;
let cacheKey = '';
interface Star {
  x: number;
  y: number;
  ph: number;
  sp: number;
  big: boolean;
}
let twinkles: Star[] = [];

function build(LW: number, LH: number, key: string) {
  const R = rng(seedOf('sky|' + key));
  // 하늘
  const c = (skyCv ??= document.createElement('canvas'));
  c.width = LW;
  c.height = LH;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, LH);
  g.addColorStop(0, '#0a0f2e');
  g.addColorStop(0.5, '#1f1652');
  g.addColorStop(1, '#45297a');
  x.fillStyle = g;
  x.fillRect(0, 0, LW, LH);
  // 금 둘레 보라 성운 (아주 옅게)
  const cp = crackPath(key, LW, LH);
  for (const i of [2, 5, 8]) {
    const [cx, cy] = cp.main[i];
    const r = Math.max(LW, LH) * 0.28;
    const ng = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    ng.addColorStop(0, 'rgba(150,80,255,0.16)');
    ng.addColorStop(1, 'rgba(150,80,255,0)');
    x.fillStyle = ng;
    x.fillRect(Math.round(cx - r), Math.round(cy - r), Math.ceil(r * 2), Math.ceil(r * 2));
  }
  // 흐린 별 (움직이지 않음) — 위쪽에 더 많이
  const nDim = Math.max(40, Math.min(260, Math.round((LW * LH) / 700)));
  for (let i = 0; i < nDim; i++) {
    const sx = Math.floor(R() * LW);
    const sy = Math.floor(Math.pow(R(), 1.4) * LH);
    x.fillStyle = R() < 0.7 ? `rgba(196,176,255,${(0.18 + R() * 0.35).toFixed(2)})` : `rgba(255,246,255,${(0.3 + R() * 0.4).toFixed(2)})`;
    x.fillRect(sx, sy, 1, 1);
  }
  // 반짝이는 별 (매 장 그림)
  const nTw = Math.max(14, Math.min(48, Math.round((LW * LH) / 3000)));
  twinkles = Array.from({ length: nTw }, () => ({ x: Math.floor(R() * LW), y: Math.floor(Math.pow(R(), 1.6) * LH * 0.9), ph: R() * 6.28, sp: 0.7 + R() * 1.6, big: R() < 0.25 }));

  // 빛나는 금 (따로 · 숨쉬듯 밝기만 바뀐다)
  const k = (crackCv ??= document.createElement('canvas'));
  k.width = LW;
  k.height = LH;
  const y = k.getContext('2d')!;
  y.clearRect(0, 0, LW, LH);
  y.lineJoin = 'round';
  y.lineCap = 'round';
  const stroke = (w: number, col: string) => {
    y.strokeStyle = col;
    y.lineWidth = w;
    for (const pts of [cp.main, ...cp.branches]) {
      y.beginPath();
      pts.forEach(([px, py], i) => (i ? y.lineTo(px + 0.5, py + 0.5) : y.moveTo(px + 0.5, py + 0.5)));
      y.stroke();
    }
  };
  const base = Math.max(1, Math.round(LH / 160));
  stroke(base * 12, 'rgba(140,70,255,0.10)');
  stroke(base * 7, 'rgba(160,90,255,0.20)');
  stroke(base * 4, 'rgba(190,130,255,0.45)');
  stroke(base * 2, 'rgba(220,180,255,0.85)');
  // 가운데 하얀 심 (도트 선)
  y.fillStyle = '#fff4ff';
  for (let i = 1; i < cp.main.length; i++) pixLine(y, cp.main[i - 1], cp.main[i], base);
  y.fillStyle = '#f0dcff';
  for (const b of cp.branches) for (let i = 1; i < b.length; i++) pixLine(y, b[i - 1], b[i], 1);
}

let rmq: MediaQueryList | null | undefined;
/** 동작 줄이기 (기기 설정) · 배터리 절약 → 반짝·숨쉬기 없음 */
export function riftCalm(): boolean {
  if (rmq === undefined)
    try {
      rmq = matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      rmq = null;
    }
  return !!rmq?.matches || saverOn();
}

// ───────── 소품 (그림이 있을 때만) ─────────
const PROP_IM: Record<string, HTMLImageElement> = {};
let propsLoading = false;
export function loadRiftProps(list: readonly string[] = RIFT_ART.props): void {
  if (propsLoading || !list.length) return;
  propsLoading = true;
  for (const k of list) {
    const im = new Image();
    im.onload = () => (PROP_IM[k] = im);
    im.src = av(new URL(`assets/rift/props/${k}.png`, document.baseURI).href);
  }
}
export interface RiftPropSpot {
  k: string;
  /** 가운데 x · 아래 y (논리 px) · 크기 배수 */
  x: number;
  y: number;
  s: number;
}
/** 자리 후보: 가로 비율 · 바닥 y 비율 · 높이 비율 (섬 둘레 — 가운데는 섬과 싸우는 이들) */
const SLOTS: [number, number, number][] = [
  [0.12, 0.44, 0.3], [0.88, 0.42, 0.3], [0.07, 0.8, 0.26], [0.93, 0.82, 0.26], [0.5, 0.34, 0.22], [0.28, 1.0, 0.2], [0.72, 1.0, 0.2],
];
/** 소품 배치 (모습 키마다 같은 자리) — 3~5개 (그림이 그보다 적으면 있는 만큼) · 412 폭에서도 1280 폭에서도 화면 안 비율로 */
export function riftPropLayout(key: string, props: readonly string[], LW: number, LH: number, size: (k: string) => [number, number] | null): RiftPropSpot[] {
  if (!props.length) return [];
  const R = rng(seedOf('props|' + key));
  const want = Math.min(props.length >= 3 ? 3 + Math.floor(R() * 3) : props.length, SLOTS.length);
  const slots = SLOTS.map((s) => ({ s, r: R() })).sort((a, b) => a.r - b.r).map((o) => o.s);
  const pool = [...props].map((k) => ({ k, r: R() })).sort((a, b) => a.r - b.r).map((o) => o.k);
  const out: RiftPropSpot[] = [];
  for (let i = 0; i < want; i++) {
    const k = pool[i % pool.length];
    const wh = size(k);
    if (!wh || wh[0] <= 0 || wh[1] <= 0) continue;
    const [fx, fy, fh] = slots[i];
    let s = Math.min((LH * fh) / wh[1], (LW * 0.42) / wh[0]);
    s = s >= 1 ? Math.floor(s) : Math.max(0.25, Math.floor(s * 8) / 8);
    out.push({ k, x: Math.round(LW * fx), y: Math.round(LH * fy), s });
  }
  return out;
}
let spots: RiftPropSpot[] = [];
let spotKey = '';

/** 하늘 (그라데이션 · 별 · 소품) — 바닥보다 먼저 */
export function drawRiftSky(ctx: CanvasRenderingContext2D, LW: number, LH: number, key: string, calm: boolean) {
  const ck = `${LW}x${LH}|${key}`;
  if (ck !== cacheKey || !skyCv) {
    build(LW, LH, key);
    cacheKey = ck;
  }
  ctx.drawImage(skyCv!, 0, 0);
  const t = performance.now() / 1000;
  for (let i = 0; i < twinkles.length; i++) {
    const s = twinkles[i];
    const a = calm ? 0.75 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
    ctx.fillStyle = `rgba(255,240,255,${a.toFixed(2)})`;
    ctx.fillRect(s.x, s.y, 1, 1);
    if (s.big && a > 0.7) {
      ctx.fillStyle = `rgba(200,170,255,${(a * 0.6).toFixed(2)})`;
      ctx.fillRect(s.x - 1, s.y, 1, 1);
      ctx.fillRect(s.x + 1, s.y, 1, 1);
      ctx.fillRect(s.x, s.y - 1, 1, 1);
      ctx.fillRect(s.x, s.y + 1, 1, 1);
    }
  }
  // 소품: 그림이 있을 때만 (없으면 아무것도 안 함)
  if (RIFT_ART.props.length) {
    loadRiftProps();
    const have = RIFT_ART.props.filter((k) => PROP_IM[k]);
    const sk = `${ck}|${have.join(',')}`;
    if (sk !== spotKey) {
      spots = riftPropLayout(key, have, LW, LH, (k) => (PROP_IM[k] ? [PROP_IM[k].width, PROP_IM[k].height] : null));
      spotKey = sk;
    }
    for (const p of spots) {
      const im = PROP_IM[p.k];
      if (!im) continue;
      const w = Math.round(im.width * p.s), h = Math.round(im.height * p.s);
      ctx.drawImage(im, Math.round(p.x - w / 2), p.y - h, w, h);
    }
  }
}

/** 빛나는 금 — 바닥 위 · 싸우는 이들 아래 (섬 위 하늘에 걸린 금) · 천천히 숨쉬듯 밝아졌다 어두워짐 */
export function drawRiftCrack(ctx: CanvasRenderingContext2D, calm: boolean) {
  if (!crackCv) return;
  const a = calm ? 0.95 : 0.82 + 0.18 * Math.sin(performance.now() / 900);
  ctx.globalAlpha = a;
  ctx.drawImage(crackCv, 0, 0);
  ctx.globalAlpha = 1;
}

/** R34 균열 보스 자리: 보스 그림 위끝이 공용 체력 막대 아래 24px(화면) 밑으로 오게 화면을 얼마나 내릴지 (논리 px · 0 이상)
 *  footY 보스 발(기준점) 화면 y · ay 시트 기준점 높이(그림 위끝 = footY − ay − 1 숨쉬기) · topMin 그림 위끝이 와야 할 가장 위 (논리 px)
 *  lowY 파티 · 보스 중 가장 아래 발 y · LH 화면 높이 — 가장 아래 발이 아래 HUD(LH × 0.22) 위에 남는 만큼만 내린다 (필드가 화면 밖으로 안 나가게) */
export const RIFT_GAP = 24;
export function riftDrop(footY: number, ay: number, topMin: number, lowY: number, LH: number): number {
  const need = Math.ceil(topMin - (footY - ay - 1));
  if (need <= 0) return 0;
  const room = Math.floor(LH * 0.78 - lowY);
  return Math.max(0, Math.min(need, room));
}
/** 막대 아래끝(화면 CSS px · 캔버스 위끝 기준) → 보스 그림 위끝 최소 y (논리 px) — 1 논리 px = K / dpr CSS px */
export const riftTopMin = (barBottomCss: number, K: number, dpr: number): number => Math.ceil(((barBottomCss + RIFT_GAP) * dpr) / K);
/** combat/ui 가 재어 넣는다: 지금 균열 HUD 막대 기준 보스 그림 위끝 최소 y (논리 px · 0 = HUD 없음)
 *  점검용: drop 이번 장에 내린 만큼 · top 보스 그림 위끝 (논리 px · 숨쉬기 1px 포함) · k 논리 1px = CSS k px */
export const riftView = { topMin: 0, drop: 0, top: 0, k: 1 };
