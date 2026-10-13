// 도트 그리기 도우미 — reference/core.js 이식 (색 섞기, P, Grid, 디더)

export type RGB = [number, number, number];

export const hex2rgb = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
export const rgb2hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

export function mix(a: string, b: string, t: number): string {
  const A = hex2rgb(a);
  const B = hex2rgb(b);
  return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

export const SHADOW = '#2a1630';
export const LIGHT = '#fff3d6';
export const OUTL = '#1c1018';
export const dk = (c: string, t = 0.32) => mix(c, SHADOW, t);

/**
 * 리마스터 명암 3단 (빛은 왼쪽 위): step +1 밝음 · 0 기본 · -1 어두움 · -2 외곽선
 * 어두운 쪽은 검게만 하지 않고 색상을 돌린다 — 따뜻한 색은 붉은 보라 쪽, 차가운 색은 남색 쪽. 밝은 쪽은 노란빛으로.
 */
const RAMP = new Map<string, string>();
export function ramp(c: string, step: number): string {
  if (!step) return c;
  const key = c + step;
  const hit = RAMP.get(key);
  if (hit) return hit;
  const [r, g, b] = hex2rgb(c);
  let [h, s, l] = hsl(r, g, b);
  const warm = h < 90 || h >= 300;
  const turn = (to: number, amt: number) => {
    let d = ((to - h + 540) % 360) - 180;
    d = Math.max(-amt, Math.min(amt, d));
    h = (h + d + 360) % 360;
  };
  if (step > 0) {
    turn(52, 10 * step);
    l = Math.min(0.95, l + 0.11 * step + (l > 0.85 ? -0.04 : 0));
    s = Math.min(1, s * 1.04);
  } else {
    const k = -step;
    if (s > 0.08) turn(warm ? 300 : 238, 14 * k);
    l = Math.max(0.06, l - (0.13 + (l > 0.8 ? 0.05 : 0)) * k);
    s = Math.min(1, s + 0.06 * k + (s < 0.08 ? 0.05 * k : 0));
  }
  const out = rgb2hex(...hslToRgb(h, s, l));
  RAMP.set(key, out);
  return out;
}
export const lt = (c: string, t = 0.28) => mix(c, LIGHT, t);

/** 같은 seed면 같은 수열 (xorshift) */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return c;
}

/** 2D 컨텍스트 위 도트 붓 (1단위 = 1픽셀) */
export function P(ctx: CanvasRenderingContext2D) {
  const o = {
    ctx,
    px(x: number, y: number, c: string) {
      ctx.fillStyle = c;
      ctx.fillRect(x | 0, y | 0, 1, 1);
    },
    rect(x: number, y: number, w: number, h: number, c: string) {
      if (w <= 0 || h <= 0) return;
      ctx.fillStyle = c;
      ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
    },
    /** t: c2가 차지하는 비율 0..1 */
    dither(x: number, y: number, w: number, h: number, c1: string, c2: string, t: number) {
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const X = x + i;
          const Y = y + j;
          o.px(X, Y, (BAYER[Y & 3][X & 3] + 0.5) / 16 < t ? c2 : c1);
        }
    },
    hline(x: number, y: number, w: number, c: string) {
      o.rect(x, y, w, 1, c);
    },
    vline(x: number, y: number, h: number, c: string) {
      o.rect(x, y, 1, h, c);
    },
    ell(cx: number, cy: number, rx: number, ry: number, c: string) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) o.px(x, y, c);
        }
    },
    tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: string) {
      const minx = Math.floor(Math.min(ax, bx, cx));
      const maxx = Math.ceil(Math.max(ax, bx, cx));
      const miny = Math.floor(Math.min(ay, by, cy));
      const maxy = Math.ceil(Math.max(ay, by, cy));
      const s = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
        (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
      for (let y = miny; y <= maxy; y++)
        for (let x = minx; x <= maxx; x++) {
          const X = x + 0.5;
          const Y = y + 0.5;
          const d1 = s(X, Y, ax, ay, bx, by);
          const d2 = s(X, Y, bx, by, cx, cy);
          const d3 = s(X, Y, cx, cy, ax, ay);
          const n = d1 < 0 || d2 < 0 || d3 < 0;
          const p = d1 > 0 || d2 > 0 || d3 > 0;
          if (!(n && p)) o.px(x, y, c);
        }
    },
  };
  return o;
}
export type Painter = ReturnType<typeof P>;

interface Cell {
  c: string;
  tag?: string | null;
}

/** 캐릭터용 격자: 칠한 뒤 render()가 테두리와 명암을 자동으로 넣는다 */
export function Grid(w = 22, h = 30, ox = 0, oy = 0) {
  const g: (Cell | null)[][] = Array.from({ length: h }, () => Array(w).fill(null));
  const set = (x: number, y: number, c: string, tag?: string | null) => {
    x = Math.floor(x) + ox;
    y = Math.floor(y) + oy;
    if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = { c, tag };
  };
  const o = {
    g,
    w,
    h,
    set,
    rect(x: number, y: number, W: number, H: number, c: string, tag?: string | null) {
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) set(x + i, y + j, c, tag);
    },
    ell(cx: number, cy: number, rx: number, ry: number, c: string, tag?: string | null, clip?: (x: number, y: number) => boolean) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1 && (!clip || clip(x, y))) set(x, y, c, tag);
        }
    },
    line(x0: number, y0: number, x1: number, y1: number, c: string, tag?: string | null) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
      for (let i = 0; i <= n; i++) set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c, tag);
    },
    tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: string, tag?: string | null) {
      const s = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
        (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
      for (let y = -oy; y < h - oy; y++)
        for (let x = -ox; x < w - ox; x++) {
          const X = x + 0.5;
          const Y = y + 0.5;
          const d1 = s(X, Y, ax, ay, bx, by);
          const d2 = s(X, Y, bx, by, cx, cy);
          const d3 = s(X, Y, cx, cy, ax, ay);
          if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) set(x, y, c, tag);
        }
    },
    clear(x: number, y: number) {
      if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = null;
    },
    render(opts: { outline?: string } = {}) {
      const cv = canvas(w, h);
      const ctx = cv.getContext('2d')!;
      // HERODOT: 'fx' = 빛·휘두름 궤적 — 명암·외곽선 없이 맨 위에 그대로 (예전 그림엔 없는 태그)
      const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !!g[y][x] && g[y][x]!.tag !== 'ol' && g[y][x]!.tag !== 'fx';
      // 리마스터 명암 3단 (빛은 왼쪽 위에서) · 위 부위가 드리우는 그림자 (머리카락 밑 이마, 머리 밑 옷깃)
      const out = g.map((r) => r.map((p) => (p ? { ...p } : null)));
      const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : null);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const p = g[y][x];
          if (!p || p.tag === 'flat' || p.tag === 'eye' || p.tag === 'fx') continue;
          const r = !filled(x + 1, y);
          const b = !filled(x, y + 1);
          const l = !filled(x - 1, y);
          const t = !filled(x, y - 1);
          const up = at(x, y - 1);
          const cast = !!up && up.c !== p.c && up.tag !== 'eye' && up.tag !== 'flat' && up.tag !== 'ol' && up.tag !== 'fx';
          if (r || b) out[y][x]!.c = ramp(p.c, -1);
          else if (cast) out[y][x]!.c = ramp(p.c, -1);
          else if (t || (l && !filled(x - 1, y - 1))) out[y][x]!.c = ramp(p.c, 1);
          // 오른쪽 아래 두 번째 줄은 반쯤 어둡게 (덩어리감)
          else if (!filled(x + 2, y) && !filled(x + 1, y + 1)) out[y][x]!.c = ramp(p.c, -1);
        }
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const p = out[y][x];
          if (p && p.tag !== 'fx') {
            ctx.fillStyle = p.c;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      // 선택적 외곽선: 그 부위 어두운 색보다 한 단계 더 어둡게 · 빛 받는 왼쪽 위 테두리는 한 단계 밝게
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (filled(x, y)) continue;
          const nb = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([dx, dy]) => filled(x + dx, y + dy));
          if (!nb) continue;
          if (opts.outline) {
            ctx.fillStyle = opts.outline;
          } else {
            const n = g[y + nb[1]][x + nb[0]]!;
            const lit = nb[0] === 1 || nb[1] === 1;
            const base = n.tag === 'eye' || n.tag === 'flat' ? '#5a4a5a' : n.c;
            ctx.fillStyle = mix(ramp(base, lit ? -2 : -3), OUTL, lit ? 0.35 : 0.55);
          }
          ctx.fillRect(x, y, 1, 1);
        }
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const p = g[y][x];
          if (p && p.tag === 'fx') {
            ctx.fillStyle = p.c;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      return cv;
    },
  };
  return o;
}
export type GridT = ReturnType<typeof Grid>;

// ───────── HSL (지붕 색 바꾸기용) ─────────

export function hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255].map(Math.round) as RGB;
}
