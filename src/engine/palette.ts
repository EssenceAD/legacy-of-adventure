// VISUAL §1: 불러올 때 그림을 마스터 팔레트로 (파일은 그대로 → 플래그로 되돌리기) · 건물·장식은 「색 외곽선」
//  calmWorld(§2): 숲 나무를 어둡고(밝기 −20%) 채도 낮게(−25%) · 외곽선 없이
import { MASTER_PALETTE } from '../data/palette';
import { canvas } from './pixel';

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
export function toLab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const PAL = MASTER_PALETTE.map(hexRgb);
const PAL_LAB = PAL.map((c) => toLab(...c));
/** 사람·몬스터 검은 외곽선 (마지막 칸) */
const BLACK = PAL.length - 1;
const near = new Map<number, number>();
/** 가장 가까운 팔레트 칸 (Lab 거리 · 캐시) */
export function nearest(r: number, g: number, b: number): number {
  const k = (r << 16) | (g << 8) | b;
  let i = near.get(k);
  if (i !== undefined) return i;
  const l = toLab(r, g, b);
  let bd = Infinity;
  i = 0;
  for (let j = 0; j < PAL_LAB.length; j++) {
    const q = PAL_LAB[j];
    const d = (l[0] - q[0]) ** 2 + (l[1] - q[1]) ** 2 + (l[2] - q[2]) ** 2;
    if (d < bd) (bd = d), (i = j);
  }
  near.set(k, i);
  return i;
}
/** 검은 외곽선인가 (28,16,24 근처 · 아주 어두운 색) */
const isLine = (r: number, g: number, b: number) => r + g + b < 110 && Math.max(r, g, b) < 60;

export interface PalOpts {
  /** 건물·장식: 검은 외곽선 → 옆 색의 어두운 판 (사람·몬스터는 false = 검정 유지) */
  colorLine?: boolean;
}
/** 그림 → 팔레트 그림 (새 캔버스) */
export function paletteMap(src: CanvasImageSource & { width: number; height: number }, o: PalOpts = {}): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const c = canvas(w, h);
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(src, 0, 0);
  const id = x.getImageData(0, 0, w, h);
  const d = id.data;
  const orig = o.colorLine ? new Uint8ClampedArray(d) : d;
  for (let y = 0; y < h; y++)
    for (let i = 0; i < w; i++) {
      const p = (y * w + i) * 4;
      if (d[p + 3] < 8) continue;
      let r = orig[p], g = orig[p + 1], b = orig[p + 2];
      if (isLine(r, g, b)) {
        if (o.colorLine) {
          // 4방향 이웃 중 외곽선이 아닌 가장 어두운 색 → 45% 어둡게
          let best = -1, bl = Infinity;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = i + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const q = (ny * w + nx) * 4;
            if (orig[q + 3] < 128 || isLine(orig[q], orig[q + 1], orig[q + 2])) continue;
            const lum = orig[q] + orig[q + 1] + orig[q + 2];
            if (lum < bl) (bl = lum), (best = q);
          }
          if (best >= 0) {
            r = orig[best] * 0.55; g = orig[best + 1] * 0.55; b = orig[best + 2] * 0.55;
            const j = nearest(r | 0, g | 0, b | 0);
            [d[p], d[p + 1], d[p + 2]] = PAL[j];
            continue;
          }
          [d[p], d[p + 1], d[p + 2]] = PAL[0];
          continue;
        }
        [d[p], d[p + 1], d[p + 2]] = PAL[BLACK];
        continue;
      }
      const j = nearest(r, g, b);
      [d[p], d[p + 1], d[p + 2]] = PAL[j === BLACK ? 0 : j];
    }
  x.putImageData(id, 0, 0);
  return c;
}

/** calmWorld: 숲 나무 — 밝기·채도 낮추고 외곽선은 옆 색으로 녹인다 */
export function calmTree(src: CanvasImageSource & { width: number; height: number }, dark = 0.8, sat = 0.75, keepLine = false): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const c = canvas(w, h);
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(src, 0, 0);
  const id = x.getImageData(0, 0, w, h);
  const d = id.data;
  const orig = new Uint8ClampedArray(d);
  for (let p = 0; p < d.length; p += 4) {
    if (d[p + 3] < 8) continue;
    let r = orig[p], g = orig[p + 1], b = orig[p + 2];
    if (!keepLine && isLine(r, g, b)) {
      // 이웃 잎 색으로 (가장자리만 남기지 않음 → 덩어리처럼)
      const i = (p / 4) % w, y = Math.floor(p / 4 / w);
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
        const nx = i + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = (ny * w + nx) * 4;
        if (orig[q + 3] >= 128 && !isLine(orig[q], orig[q + 1], orig[q + 2])) {
          r = orig[q] * 0.7; g = orig[q + 1] * 0.7; b = orig[q + 2] * 0.7;
          break;
        }
      }
    }
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    d[p] = (l + (r - l) * sat) * dark;
    d[p + 1] = (l + (g - l) * sat) * dark;
    d[p + 2] = (l + (b - l) * sat) * dark;
  }
  x.putImageData(id, 0, 0);
  return c;
}
