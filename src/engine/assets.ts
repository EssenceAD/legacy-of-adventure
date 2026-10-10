// 건물 PNG 로드, 밤 창문 마스크(windows.json), 지붕 색 바꾸기, 밤 색조 캐시
import { HEROES } from '../data/heroes';
import { LEGENDS } from '../data/legends';
import { JOBS, mcPortrait } from '../data/origins';
import { BOSSES } from '../data/bosses';
import { REGIONS } from '../data/items';
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
export type Drawable = HTMLImageElement | HTMLCanvasElement;
/** 건물 그림. 좌우 반전 그림은 키 뒤에 '~f' (예: inn~f) */
export const IMG: Record<string, Drawable> = {};
export const META: Record<string, SpriteMeta> = {};
/** 창문 불빛 마스크 (그림과 같은 크기, 창문 픽셀만 밝게) */
export const LIGHTS: Record<string, HTMLCanvasElement> = {};
/** 문 영역 [x0, y0, x1, y1] (그림 왼쪽 위 기준, 끝 포함) — sprites/doors.json */
export const DOORS: Record<string, [number, number, number, number]> = {};
/** 앞이 트인 입구(대장간·온천): 문을 "여는" 표시 없이 들어가는 모습만 가린다 */
export const OPEN_FRONT = new Set<string>();
/** 지붕 다각형 (그림 왼쪽 위 기준) — sprites/roofs.json. 지붕 색 바꾸기는 이 안에서만 */
export const ROOF_POLYS: Record<string, [number, number][][]> = {};
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
  const [meta, windows, doors, roofs] = await Promise.all([
    fetch(BASE + 'sprites/meta.json').then((r) => r.json() as Promise<Record<string, SpriteMeta>>),
    fetch(BASE + 'sprites/windows.json').then((r) => r.json() as Promise<Record<string, [number, number][]>>),
    fetch(BASE + 'sprites/doors.json').then((r) => r.json() as Promise<Record<string, unknown>>),
    fetch(BASE + 'sprites/roofs.json').then((r) => r.json() as Promise<Record<string, [number, number][][]>>),
  ]);
  Object.assign(ROOF_POLYS, roofs);
  for (const [k, v] of Object.entries(doors)) {
    if (k === '_open') (v as string[]).forEach((x) => OPEN_FRONT.add(x));
    else DOORS[k] = v as [number, number, number, number];
  }
  Object.assign(META, meta);
  const keys = Object.keys(meta);
  const ports = ['cleric', 'dwarf', 'hero', 'keeper', 'knight', 'mage', 'post', 'rogue', ...HEROES.map((h) => 'hero_' + h.id), ...LEGENDS.map((l) => 'legend_' + l.key), ...JOBS.flatMap((j) => [mcPortrait(j, 'm'), mcPortrait(j, 'f')])];
  let done = 0;
  const total = keys.length + ports.length + 1;
  const tick = () => onProgress?.(++done / total);
  await Promise.all([
    ...keys.map(async (k) => {
      const im = await loadImage(`${BASE}sprites/${k}.png`);
      IMG[k] = im;
      if (LIT_SPRITES.includes(k)) LIGHTS[k] = windowMask(im, windows[k] || (k === 'monument' ? glowPts(im) : []));
      makeFlipped(k);
      tick();
    }),
    // 토벌전: 보스(지금은 멧돼지 왕 한 장 → 나머지는 색을 돌려 임시로) · 전투 배경 · 트로피
    // 토벌전: 보스 5마리 · 지역별 전투 배경 (트로피·기념비는 meta.json 건물 그림으로 같이 불러온다)
    ...BOSSES.map((b) => loadImage(`${BASE}sprites/boss_${b.id}.png`).then((im) => (BOSS_IMG[b.id] = toCanvas(im)))),
    ...REGIONS.map((r) => loadImage(`${BASE}sprites/${r.id === 'forest' ? 'raid_bg' : 'raid_bg_' + r.id}.png`).then((im) => (RAID_BG[r.id] = im))),
    // 5단계 사냥 몬스터 10종 (왼쪽을 봄) · 마을 등급 장식 8종
    ...MOB_KEYS.map((k) => loadImage(`${BASE}monsters/mob_${k}.png`).then((im) => (MOB_IMG[k] = toCanvas(im)))),
    ...PROP_KEYS.map((k) => loadImage(`${BASE}props/${k}.png`).then((im) => (PROP_IMG[k] = toCanvas(im)))),
    loadImage(`${BASE}sprites/campfire.png`).then((im) => {
      for (let i = 0; i < im.width / FIRE_W; i++) {
        const c = canvas(FIRE_W, im.height);
        c.getContext('2d')!.drawImage(im, -i * FIRE_W, 0);
        FIRE_FRAMES.push(c);
      }
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

// ───────── 좌우 반전 그림 (건물 방향 바꾸기) ─────────

export const FLIP = '~f';
export const isFlipKey = (k: string) => k.endsWith(FLIP);
export const baseKey = (k: string) => (isFlipKey(k) ? k.slice(0, -FLIP.length) : k);

function mirror(src: Drawable): HTMLCanvasElement {
  const c = canvas(src.width, src.height);
  const x = c.getContext('2d')!;
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}

/** k~f: 그림·창문 빛·문 영역·지붕 다각형을 x' = 폭 − x 로 뒤집어 둔다 (발판은 정사각형이라 그대로) */
function makeFlipped(k: string) {
  const f = k + FLIP;
  const w = IMG[k].width;
  IMG[f] = mirror(IMG[k]);
  if (META[k]) META[f] = { ...META[k], fw: META[k].fh, fh: META[k].fw };
  if (LIGHTS[k]) LIGHTS[f] = mirror(LIGHTS[k]);
  const d = DOORS[k];
  if (d) DOORS[f] = [w - 1 - d[2], d[1], w - 1 - d[0], d[3]];
  if (OPEN_FRONT.has(k)) OPEN_FRONT.add(f);
  if (ROOF_POLYS[k]) ROOF_POLYS[f] = ROOF_POLYS[k].map((p) => p.map(([x, y]) => [w - x, y] as [number, number]));
}

// ───────── 토벌전 그림 ─────────

export const BOSS_IMG: Record<string, HTMLCanvasElement> = {};
/** 5단계: 사냥 몬스터 (assets/monsters/mob_*.png) · 마을 장식 (assets/props/*.png) */
export const MOB_KEYS = ['slime', 'wolf', 'goblin', 'mushimp', 'frog', 'bat', 'kobold', 'iceimp', 'snowwolf', 'shadow'];
export const MOB_IMG: Record<string, HTMLCanvasElement> = {};
export const PROP_KEYS = ['lamppost', 'stonewall', 'bench', 'flowerbed', 'banner', 'stall', 'fountain', 'gate'];
export const PROP_IMG: Record<string, HTMLCanvasElement> = {};
/** 그림을 정해진 배율로 (가장 가까운 픽셀) — 지역 보스(x-10)는 토벌 보스 0.6배 */
export function scaled(src: HTMLCanvasElement, k: number): HTMLCanvasElement {
  const w = Math.max(1, Math.round(src.width * k));
  const h = Math.max(1, Math.round(src.height * k));
  const c = canvas(w, h);
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, w, h);
  return c;
}
/** 전투 배경: 지역별 (숲 = raid_bg.png) */
export const RAID_BG: Partial<Record<string, HTMLImageElement>> = {};

function toCanvas(im: Drawable): HTMLCanvasElement {
  const c = canvas(im.width, im.height);
  c.getContext('2d')!.drawImage(im, 0, 0);
  return c;
}

// ───────── 모닥불: campfire.png (32×34 프레임 4장) ─────────

export const FIRE_W = 32;
export const FIRE_FRAMES: HTMLCanvasElement[] = [];

/** 불꽃 픽셀(밝은 주황·노랑) */
const isFlame = (r: number, g: number, b: number) => r > 200 && g > 90 && b < 140 && r - b > 90;

/** 밤 모닥불: 장작·돌은 밤 색으로, 불꽃은 그대로 밝게 */
const FIRE_NIGHT = new Map<HTMLCanvasElement, Record<number, HTMLCanvasElement>>();
export function fireFrame(i: number, level: number): Drawable {
  const fr = FIRE_FRAMES[i % FIRE_FRAMES.length];
  if (!level) return fr;
  let m = FIRE_NIGHT.get(fr);
  if (!m) FIRE_NIGHT.set(fr, (m = {}));
  if (m[level]) return m[level];
  const c = canvas(fr.width, fr.height);
  const x = c.getContext('2d')!;
  x.drawImage(tinted(fr, level), 0, 0);
  const src = fr.getContext('2d')!.getImageData(0, 0, fr.width, fr.height);
  const out = x.getImageData(0, 0, fr.width, fr.height);
  for (let j = 0; j < src.data.length; j += 4) {
    if (!src.data[j + 3] || !isFlame(src.data[j], src.data[j + 1], src.data[j + 2])) continue;
    for (let q = 0; q < 4; q++) out.data[j + q] = src.data[j + q];
  }
  x.putImageData(out, 0, 0);
  return (m[level] = c);
}

/** 기념비: windows.json 대신 위쪽 25% 가운데(펼친 책)의 밝은 노란 픽셀을 빛 영역으로 */
function glowPts(im: HTMLImageElement): [number, number][] {
  const c = canvas(im.width, im.height);
  const x = c.getContext('2d')!;
  x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, im.width, im.height).data;
  const pts: [number, number][] = [];
  for (let y = 0; y < Math.ceil(im.height * 0.25); y++)
    for (let i = Math.floor(im.width * 0.25); i < Math.ceil(im.width * 0.75); i++) {
      const j = (y * im.width + i) * 4;
      if (d[j + 3] && d[j] > 150 && d[j + 1] > 110 && d[j + 2] < 140) pts.push([y, i]);
    }
  return pts;
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

/**
 * 지붕 색 바꾸기: sprites/roofs.json 에 찍어 둔 "지붕 다각형" 안의 픽셀만 바꾼다
 * (예전엔 그림 위쪽 전체에서 색상만 보고 바꿔서 주점 벽까지 번졌다).
 *  · 채도 있는 지붕(대부분): 다각형 안 대표 색상 근처 픽셀의 hue만 돌린다 (빛 받는 면·그늘 면 모두 잡게 범위를 넉넉히)
 *  · 채도 없는 지붕(대장간 슬레이트): 밝기는 그대로 두고 새 색을 입힌다
 *  · 아주 밝은 픽셀(지붕창 벽·불 켜진 유리)은 건드리지 않는다
 */
const RECOL: Record<string, HTMLCanvasElement> = {};
export function recolored(key: string, hue: number): HTMLCanvasElement {
  const k = key + '|' + hue;
  if (RECOL[k]) return RECOL[k];
  const im = IMG[key];
  const c = canvas(im.width, im.height);
  const x = c.getContext('2d')!;
  x.drawImage(im, 0, 0);
  const polys = ROOF_POLYS[key];
  if (!polys) return (RECOL[k] = c);
  const d = x.getImageData(0, 0, im.width, im.height);
  const D = d.data;
  // 다각형 안 픽셀 목록
  const inside: number[] = [];
  for (let y = 0; y < im.height; y++)
    for (let i = 0; i < im.width; i++) {
      const j = (y * im.width + i) * 4;
      if (D[j + 3] && polys.some((p) => inPoly(i + 0.5, y + 0.5, p))) inside.push(j);
    }
  const hs: number[] = [];
  for (const j of inside) {
    const [h, s, l] = hsl(D[j], D[j + 1], D[j + 2]);
    if (s > 0.25 && l > 0.12 && l < 0.8) hs.push(h);
  }
  const R = CONFIG.roof;
  const dark = hue === 265; // 밤하늘은 조금 어둡게
  if (hs.length < inside.length * R.colorfulShare) {
    // 채도 없는 지붕: 새 색 입히기
    for (const j of inside) {
      const [, , l] = hsl(D[j], D[j + 1], D[j + 2]);
      if (l > R.skipLightness) continue;
      const [r, g, b] = hslToRgb(hue, R.tintSaturation, dark ? l * 0.85 : Math.min(0.75, l * 1.1 + 0.04));
      D[j] = r;
      D[j + 1] = g;
      D[j + 2] = b;
    }
  } else {
    hs.sort((a, b) => a - b);
    const base = hs[hs.length >> 1];
    for (const j of inside) {
      const [h, s, l] = hsl(D[j], D[j + 1], D[j + 2]);
      if (s < 0.15 || l > R.skipLightness) continue;
      const dh = Math.min(Math.abs(h - base), 360 - Math.abs(h - base));
      if (dh > R.hueRange) continue;
      const nh = (hue + (h - base) + 360) % 360;
      const [r, g, b] = hslToRgb(nh, Math.min(1, s * 1.05), dark ? l * 0.8 : l);
      D[j] = r;
      D[j + 1] = g;
      D[j + 2] = b;
    }
  }
  x.putImageData(d, 0, 0);
  return (RECOL[k] = c);
}

/** 점이 다각형 안인가 (짝홀 규칙) */
function inPoly(x: number, y: number, poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ───────── 밤 색조: 그림을 밤 색으로 미리 물들여 단계별(0~10)로 캐시 ─────────

export function tintColor(nt: number): string {
  return `rgb(${Math.round(255 - 200 * nt)},${Math.round(255 - 175 * nt)},${Math.round(255 - 90 * nt)})`;
}

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
