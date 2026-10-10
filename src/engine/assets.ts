// 건물 PNG 로드, 밤 창문 마스크(windows.json), 지붕 색 바꾸기, 밤 색조 캐시
import { CONFIG } from '../data/config';
import { LIT_SPRITES } from '../data/catalog';
import { canvas, hsl, hslToRgb } from './pixel';

export interface SpriteMeta {
  w: number;
  h: number;
  fw: number;
  fh: number;
}

const BASE = 'assets/';
export const IMG: Record<string, HTMLImageElement> = {};
export const META: Record<string, SpriteMeta> = {};
/** 창문 불빛 마스크 (그림과 같은 크기, 창문 픽셀만 밝게) */
export const LIGHTS: Record<string, HTMLCanvasElement> = {};
/** 문 영역 [x0, y0, x1, y1] (그림 왼쪽 위 기준, 끝 포함) — sprites/doors.json */
export const DOORS: Record<string, [number, number, number, number]> = {};
/** 앞이 트인 입구(대장간·온천): 문을 "여는" 표시 없이 들어가는 모습만 가린다 */
export const OPEN_FRONT = new Set<string>();
export const PORTRAITS: Record<string, string> = {};
/** 초상화 이미지를 붙잡아 둔다 (창을 열 때 다시 디코드하지 않게) */
const PORTRAIT_IMGS: HTMLImageElement[] = [];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => fail(new Error('그림을 못 불러옴: ' + src));
    im.src = src;
  });
}

export async function loadAssets(onProgress?: (p: number) => void) {
  const [meta, windows, doors] = await Promise.all([
    fetch(BASE + 'sprites/meta.json').then((r) => r.json() as Promise<Record<string, SpriteMeta>>),
    fetch(BASE + 'sprites/windows.json').then((r) => r.json() as Promise<Record<string, [number, number][]>>),
    fetch(BASE + 'sprites/doors.json').then((r) => r.json() as Promise<Record<string, unknown>>),
  ]);
  for (const [k, v] of Object.entries(doors)) {
    if (k === '_open') (v as string[]).forEach((x) => OPEN_FRONT.add(x));
    else DOORS[k] = v as [number, number, number, number];
  }
  Object.assign(META, meta);
  const keys = Object.keys(meta);
  const ports = ['cleric', 'dwarf', 'hero', 'keeper', 'knight', 'mage', 'post', 'rogue'];
  let done = 0;
  const total = keys.length + ports.length + 1;
  const tick = () => onProgress?.(++done / total);
  await Promise.all([
    ...keys.map(async (k) => {
      IMG[k] = await loadImage(`${BASE}sprites/${k}.png`);
      if (LIT_SPRITES.includes(k)) LIGHTS[k] = windowMask(IMG[k], windows[k] || []);
      tick();
    }),
    ...ports.map(async (k) => {
      const src = `${BASE}portraits/${k}.png`;
      const im = await loadImage(src);
      // 디코드는 기다리지 않는다 (화면이 숨어 있으면 끝나지 않아 로딩이 멈춘다)
      im.decode?.().catch(() => {});
      PORTRAIT_IMGS.push(im);
      PORTRAITS[k] = src;
      tick();
    }),
    // 캔버스에 쓰는 글꼴은 미리 불러 둬야 첫 프레임부터 도트 글꼴로 나온다
    document.fonts.load('10px "Galmuri9"').then(tick, tick),
  ]);
}

/**
 * 창문 불빛 마스크: 창문 픽셀의 원래 색을 밝게 올려서 그린다
 * (노란색으로 덮어칠하지 않는다 → 창살 질감 유지)
 */
function windowMask(im: HTMLImageElement, pts: [number, number][]): HTMLCanvasElement {
  const L = canvas(im.width, im.height);
  const lx = L.getContext('2d')!;
  lx.drawImage(im, 0, 0);
  const src = lx.getImageData(0, 0, im.width, im.height);
  const out = lx.createImageData(im.width, im.height);
  for (const [y, x] of pts) {
    const i = (y * im.width + x) * 4;
    out.data[i] = Math.min(255, src.data[i] * 1.12 + 30);
    out.data[i + 1] = Math.min(255, src.data[i + 1] * 1.15 + 22);
    out.data[i + 2] = Math.min(255, src.data[i + 2] * 0.9 + 10);
    out.data[i + 3] = 255;
  }
  lx.clearRect(0, 0, im.width, im.height);
  lx.putImageData(out, 0, 0);
  return L;
}

/** 지붕 색 바꾸기: 그림 위쪽(지붕) 대표 색상 띠의 hue만 돌린다 — 시안 recolored() 그대로 */
const RECOL: Record<string, HTMLCanvasElement> = {};
export function recolored(key: string, hue: number): HTMLCanvasElement {
  const k = key + '|' + hue;
  if (RECOL[k]) return RECOL[k];
  const im = IMG[key];
  const c = canvas(im.width, im.height);
  const x = c.getContext('2d')!;
  x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, im.width, im.height);
  const D = d.data;
  const top = Math.round(im.height * 0.55);
  const hs: number[] = [];
  for (let y = 0; y < top; y++)
    for (let i = 0; i < im.width; i++) {
      const j = (y * im.width + i) * 4;
      if (!D[j + 3]) continue;
      const [h, s, l] = hsl(D[j], D[j + 1], D[j + 2]);
      if (s > 0.35 && l > 0.2 && l < 0.75) hs.push(h);
    }
  hs.sort((a, b) => a - b);
  const base = hs[hs.length >> 1] || 0;
  for (let y = 0; y < Math.min(im.height, top + 8); y++)
    for (let i = 0; i < im.width; i++) {
      const j = (y * im.width + i) * 4;
      if (!D[j + 3]) continue;
      const [h, s, l] = hsl(D[j], D[j + 1], D[j + 2]);
      const dh = Math.min(Math.abs(h - base), 360 - Math.abs(h - base));
      if (dh < 28 && s > 0.2) {
        const nh = (hue + (h - base) + 360) % 360;
        const [r, g, b] = hslToRgb(nh, Math.min(1, s * 1.05), hue === 265 ? l * 0.8 : l);
        D[j] = r;
        D[j + 1] = g;
        D[j + 2] = b;
      }
    }
  x.putImageData(d, 0, 0);
  return (RECOL[k] = c);
}

// ───────── 밤 색조: 그림을 밤 색으로 미리 물들여 단계별(0~10)로 캐시 ─────────

export function tintColor(nt: number): string {
  return `rgb(${Math.round(255 - 200 * nt)},${Math.round(255 - 175 * nt)},${Math.round(255 - 90 * nt)})`;
}

type Drawable = HTMLImageElement | HTMLCanvasElement;
const TINT = new WeakMap<Drawable, Record<number, HTMLCanvasElement>>();

/** 밤 단계 level(0~tintSteps)로 물든 그림. 0이면 원본 */
export function tinted(img: Drawable, level: number): Drawable {
  if (!level) return img;
  let m = TINT.get(img);
  if (!m) TINT.set(img, (m = {}));
  if (m[level]) return m[level];
  const c = canvas(img.width, img.height);
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = tintColor(level / CONFIG.dayNight.tintSteps);
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(img, 0, 0);
  return (m[level] = c);
}

/**
 * 밤 색조 미리 만들기: 낮↔밤이 넘어가는 1초 동안 한꺼번에 만들면 프레임이 끊기므로,
 * 부팅 뒤 프레임마다 조금씩(budgetMs) 미리 만들어 둔다.
 */
const warmQueue: [Drawable, number][] = [];
export function queueTintWarmup(imgs: Drawable[]) {
  for (let lv = CONFIG.dayNight.tintSteps; lv >= 1; lv--) for (const im of imgs) warmQueue.push([im, lv]);
}
export function pumpTintWarmup(budgetMs: number) {
  const end = performance.now() + budgetMs;
  while (warmQueue.length && performance.now() < end) {
    const [im, lv] = warmQueue.pop()!;
    tinted(im, lv);
  }
}

/** 픽셀 단위 탭 판정용 (투명 픽셀 무시) */
const HIT: Record<string, CanvasRenderingContext2D> = {};
export function alphaAt(key: string, x: number, y: number): number {
  let c = HIT[key];
  if (!c) {
    const im = IMG[key];
    c = HIT[key] = canvas(im.width, im.height).getContext('2d', { willReadFrequently: true })!;
    c.drawImage(im, 0, 0);
  }
  return c.getImageData(x | 0, y | 0, 1, 1).data[3];
}
