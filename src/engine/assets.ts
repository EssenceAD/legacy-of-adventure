// 건물 PNG 로드, 밤 창문 마스크(windows.json), 지붕 색 바꾸기, 밤 색조 캐시
import { av } from './ver';
import { track } from '../net/telemetry';
import { HEROES } from '../data/heroes';
import { LEGENDS } from '../data/legends';
import { JOBS, mcPortrait } from '../data/origins';
import { BOSSES } from '../data/bosses';
import { BASE_REGIONS, REGIONS } from '../data/items';
import { CONFIG } from '../data/config';
import { LIT_SPRITES } from '../data/catalog';
import { GUEST_KINDS, RACES } from '../data/classes';
import { canvas, hsl, hslToRgb } from './pixel';
import { canvasAlive, drawable, Lru } from './lru';

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

/** 핫픽스 13: 실패하면 0.5초·1.5초 뒤 두 번 더 (&r=n 으로 캐시 우회) — 그래도 안 되면 실패한 주소를 들고 실패 */
export class AssetError extends Error {
  constructor(public url: string) {
    super('그림을 못 불러옴: ' + url);
  }
}
function loadOnce(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => fail(new AssetError(src));
    im.src = src;
  });
}
async function loadImage(src: string): Promise<HTMLImageElement> {
  const url = av(src);
  const waits = [0, 500, 1500];
  for (let i = 0; i < waits.length; i++) {
    if (waits[i]) await new Promise((r) => setTimeout(r, waits[i]));
    try {
      return await loadOnce(i ? `${url}&r=${i}` : url);
    } catch {
      /* 다시 */
    }
  }
  throw new AssetError(url);
}
/** JSON도 같은 방식 (네트워크 먼저 — 서비스워커가 처리) */
async function loadJson<T>(path: string): Promise<T> {
  const url = av(path);
  for (const [i, w] of [0, 500, 1500].entries()) {
    if (w) await new Promise((r) => setTimeout(r, w));
    try {
      const r = await fetch(i ? `${url}&r=${i}` : url);
      if (r.ok) return (await r.json()) as T;
    } catch {
      /* 다시 */
    }
  }
  throw new AssetError(url);
}
/** 핫픽스 13: 크기표(META)에 없는 그림 — 어떤 키인지 한 번만 기록 (그 건물은 그리지 않고 넘어간다) */
const missed = new Set<string>();
export function missingMeta(key: string) {
  if (missed.has(key)) return;
  missed.add(key);
  track('error', { msg: 'meta_missing', key: key.slice(0, 60) });
}

export async function loadAssets(onProgress?: (p: number) => void) {
  const [meta, windows, doors, roofs] = await Promise.all([
    loadJson<Record<string, SpriteMeta>>(BASE + 'sprites/meta.json'),
    loadJson<Record<string, [number, number][]>>(BASE + 'sprites/windows.json'),
    loadJson<Record<string, unknown>>(BASE + 'sprites/doors.json'),
    loadJson<Record<string, [number, number][][]>>(BASE + 'sprites/roofs.json'),
  ]);
  Object.assign(ROOF_POLYS, roofs);
  for (const [k, v] of Object.entries(doors)) {
    if (k === '_open') (v as string[]).forEach((x) => OPEN_FRONT.add(x));
    else DOORS[k] = v as [number, number, number, number];
  }
  Object.assign(META, meta);
  Object.assign(WINDOWS, windows);
  const keys = Object.keys(meta);
  const ports = ['cleric', 'dwarf', 'hero', 'keeper', 'knight', 'mage', 'post', 'rogue', ...HEROES.map((h) => 'hero_' + h.id), ...LEGENDS.map((l) => 'legend_' + l.key), ...JOBS.flatMap((j) => [mcPortrait(j, 'm'), mcPortrait(j, 'f')]),
    // 초상화 작업: 손님 초상화 20장 (직업 5 × 종족 4)
    ...GUEST_KINDS.flatMap((k) => RACES.map((r) => `g_${k}_${r}`)),
    // EASTER §5: 베타 개척자 4인 초상화
    'p_woongs', 'p_gonu', 'p_warmnight', 'p_ikamolly'];
  let done = 0;
  const total = keys.length + ports.length + 1;
  const tick = () => onProgress?.(++done / total);
  await Promise.all([
    ...keys.map(async (k) => {
      const im = await loadImage(`${BASE}sprites/${k}.png`);
      setSprite(k, im);
      tick();
    }),
    // 토벌전: 옛 보스 그림(지금은 심연의 눈만 씀 — 나머지는 핫픽스 8부터 Ninja Adventure 그림) · 전투 배경 · 트로피
    // 토벌전: 보스 5마리 · 지역별 전투 배경 (트로피·기념비는 meta.json 건물 그림으로 같이 불러온다)
    ...BOSSES.filter((b) => !b.fresh).map((b) => loadImage(`${BASE}sprites/boss_${b.id}.png`).then((im) => (BOSS_IMG[b.id] = toCanvas(im)))),
    ...REGIONS.slice(0, BASE_REGIONS).map((r) => loadImage(`${BASE}sprites/${r.id === 'forest' ? 'raid_bg' : 'raid_bg_' + r.id}.png`).then((im) => (RAID_BG[r.id] = im))),
    // 5단계 사냥 몬스터 10종 (왼쪽을 봄) · 마을 등급 장식 8종
    ...MOB_KEYS.map((k) => loadImage(`${BASE}monsters/mob_${k}.png`).then((im) => named((MOB_IMG[k] = toCanvas(im)), 'mob:' + k))),
    ...PROP_KEYS.map((k) => loadImage(`${BASE}props/${k}.png`).then((im) => named((PROP_IMG[k] = toCanvas(im)), 'prop:' + k))),
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
      PORTRAITS[k] = av(src);
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
  named(IMG[f], f);
  if (LIGHTS[f]) named(LIGHTS[f], 'light:' + f);
}

// ───────── 깨진 그림 지키기 (따밤 신고: 삼성 인터넷이 메모리가 모자라면 디코드한 그림·캔버스를 버린다) ─────────
//  그리기 전에 깨진 그림(<img> complete && naturalWidth 0 · 폭 0 캔버스)이면 건너뛰고, 그 그림을 다시 불러 바꿔 끼운다.
//  기록은 세션에 그림마다 한 번: draw_fail { sprite, ua }

/** 창문 불빛 자리 (다시 불러올 때 마스크를 다시 만들려고 들고 있는다) */
const WINDOWS: Record<string, [number, number][]> = {};
/** 그림 → 이름 (기록·다시 불러오기용) */
const NAME = new WeakMap<object, string>();
function named<T extends object>(d: T, name: string): T {
  NAME.set(d, name);
  return d;
}
/** 건물 그림 넣기 (처음 불러올 때 · 다시 불러올 때 같은 길): 창문 빛 · 좌우 반전 */
function setSprite(k: string, im: HTMLImageElement) {
  IMG[k] = named(im, k);
  if (LIT_SPRITES.includes(k)) LIGHTS[k] = named(windowMask(im, WINDOWS[k] || (k === 'monument' ? glowPts(im) : [])), 'light:' + k);
  makeFlipped(k);
}
/** 아무것도 없는 1×1 (깨진 그림 대신) */
let EMPTY_CV: HTMLCanvasElement | null = null;
export const EMPTY = (): HTMLCanvasElement => (EMPTY_CV ??= canvas(1, 1));

const failed = new Set<string>();
/** 기록 보기 (개발·e2e) */
export const drawFails = () => [...failed];
const reloadAt: Record<string, { at: number; n: number }> = {};
/** 그리기 실패: 세션에 그림마다 한 번 기록 + 다시 불러오기 예약 */
export function spriteFailed(name: string) {
  if (!failed.has(name)) {
    failed.add(name);
    track('draw_fail', { sprite: name.slice(0, 60), ua: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 120) });
  }
  reloadSprite(name);
}
/** 그림 자체로 실패 알리기 (이름을 모르면 'unknown') */
export function drawFailed(d: unknown) {
  spriteFailed((d ? NAME.get(d as object) : undefined) ?? 'unknown');
}
/** 그림을 그려도 되나 — 안 되면 기록·다시 불러오기까지 하고 false */
export function okToDraw(d: Drawable | undefined | null): d is Drawable {
  if (d && drawable(d)) return true;
  if (d) drawFailed(d);
  return false;
}

const SRC_OF = (name: string): string | null => {
  if (name.startsWith('prop:')) return `${BASE}props/${name.slice(5)}.png`;
  if (name.startsWith('mob:')) return `${BASE}monsters/mob_${name.slice(4)}.png`;
  const k = baseKey(name.startsWith('light:') ? name.slice(6) : name);
  return META[k] || IMG[k] ? `${BASE}sprites/${k}.png` : null;
};
/**
 * 다시 불러오기: 반전 그림·빛 마스크가 잃어버린 캔버스면 원본에서 다시 만들고,
 * 원본 <img>가 깨졌으면 같은 주소 + 캐시 우회(&rb=시각)로 새 Image → 다 받으면 IMG(·PROP_IMG·MOB_IMG)에 바꿔 끼운다.
 */
export function reloadSprite(name: string) {
  if (name === 'unknown') return;
  const R = CONFIG.render;
  const now = performance.now();
  const st = (reloadAt[name] ??= { at: -Infinity, n: 0 });
  if (now - st.at < R.reloadGapMs || st.n >= R.reloadMax) return;
  st.at = now;
  st.n++;
  const k = baseKey(name.startsWith('light:') ? name.slice(6) : name);
  const own = !name.startsWith('prop:') && !name.startsWith('mob:');
  // 반전 그림·빛 마스크(우리가 만든 캔버스)만 잃었고 원본이 멀쩡하면 원본에서 다시 만든다
  if (own && name !== k && IMG[k] instanceof HTMLImageElement && drawable(IMG[k])) {
    forgetSprite(k);
    try {
      setSprite(k, IMG[k] as HTMLImageElement);
      return;
    } catch {
      /* 원본도 못 그리면 아래에서 다시 받는다 */
    }
  }
  const src = SRC_OF(name);
  if (!src) return;
  const im = new Image();
  im.onload = () => {
    if (!im.naturalWidth) return;
    try {
      if (name.startsWith('prop:')) PROP_IMG[name.slice(5)] = named(toCanvas(im), name);
      else if (name.startsWith('mob:')) MOB_IMG[name.slice(4)] = named(toCanvas(im), name);
      else {
        forgetSprite(k);
        setSprite(k, im);
      }
    } catch {
      /* 다음 실패 때 다시 */
    }
  };
  im.src = `${av(src)}&rb=${Date.now().toString(36)}`;
}
/** 시험용(개발 전역 __breakSprite): 그 그림을 디코드 실패한 <img>로 바꿔 끼운다 (삼성 인터넷이 그림을 버린 상황 흉내) */
export function breakSpriteForTest(k: string) {
  const im = new Image();
  im.src = 'data:image/png;base64,AAAA';
  IMG[k] = named(im, k);
  reloadAt[k] = { at: -Infinity, n: 0 };
}
export const spriteOk = (k: string) => drawable(IMG[k]);
/** 그 그림으로 만든 캐시(지붕 색·탭 판정)를 버린다 (밤 색조는 그림이 바뀌면 키가 달라져 저절로 밀려난다) */
function forgetSprite(k: string) {
  RECOL.deleteWhere((key) => key.startsWith(k + '|') || key.startsWith(k + FLIP + '|'));
  HIT.delete(k);
  HIT.delete(k + FLIP);
}

// ───────── 토벌전 그림 ─────────

export const BOSS_IMG: Record<string, HTMLCanvasElement> = {};
/** 5단계: 사냥 몬스터 (assets/monsters/mob_*.png) · 마을 장식 (assets/props/*.png) */
export const MOB_KEYS = ['slime', 'wolf', 'goblin', 'mushimp', 'frog', 'bat', 'kobold', 'iceimp', 'snowwolf', 'shadow'];
export const MOB_IMG: Record<string, HTMLCanvasElement> = {};
export const PROP_KEYS = ['lamppost', 'stonewall', 'bench', 'flowerbed', 'banner', 'stall', 'fountain', 'gate', 'flagpole', 'flower_pot', 'stone_lantern'];
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
const RECOL = new Lru<string, HTMLCanvasElement>(CONFIG.render.recolorCacheMax);
export function recolored(key: string, hue: number): HTMLCanvasElement {
  const k = key + '|' + hue;
  const hit = RECOL.get(k);
  if (hit && canvasAlive(hit)) return hit;
  const im = IMG[key];
  if (!okToDraw(im)) return EMPTY();
  const c = canvas(im.width, im.height);
  const x = c.getContext('2d');
  if (!x) return EMPTY();
  try {
    x.drawImage(im, 0, 0);
  } catch {
    drawFailed(im);
    return EMPTY();
  }
  named(c, key);
  const polys = ROOF_POLYS[key];
  if (!polys) return RECOL.set(k, c);
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
    // GROWTH §6: 밑색과 먼 색 면(별채의 갈색 비탈·초록 지붕창)까지 바꿀 건물
    const far = R.farKinds.includes(baseKey(key).replace(/\d+$/, ''));
    for (const j of inside) {
      const [h, s, l] = hsl(D[j], D[j + 1], D[j + 2]);
      if (s < R.hueOnlyMinSat || l > R.skipLightness) continue;
      // GROWTH §6: 색 있는 지붕은 색상(hue)만 바꾼다 (명도·채도 그대로) — 밑색과 가까운 색은 결을 살리고, 먼 색(별채 갈색 비탈·초록 지붕창)도 새 색으로
      const dh = Math.min(Math.abs(h - base), 360 - Math.abs(h - base));
      // 밑색과 먼 색은 채도가 충분한 지붕 면만 (굴뚝·벽 같은 연한 베이지는 그대로)
      if (dh > R.hueRange && (!far || s < R.farMinSat || l > R.farMaxLight)) continue;
      const d0 = ((h - base + 540) % 360) - 180;
      const nh = dh <= R.hueRange ? (hue + d0 * R.hueKeep + 360) % 360 : hue;
      const [r, g, b] = hslToRgb(nh, Math.min(1, s * 1.05), dark ? l * 0.8 : l);
      D[j] = r;
      D[j + 1] = g;
      D[j + 2] = b;
    }
  }
  x.putImageData(d, 0, 0);
  return RECOL.set(k, c);
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

/** 그림마다 번호 (캐시 키) — 그림이 바뀌면(다시 불러오기) 번호도 바뀌어 옛 색조는 저절로 밀려난다 */
const IDS = new WeakMap<object, number>();
let nextId = 1;
const idOf = (d: object) => {
  let i = IDS.get(d);
  if (!i) IDS.set(d, (i = nextId++));
  return i;
};
/**
 * 밤 색조 캐시: (그림 번호, 단계) → 캔버스. 상한(CONFIG.render.tintCacheMax)을 넘으면 오래 안 쓴 것부터 버린다
 * (예전엔 모든 그림 × 10단계를 다 만들어 들고 있었다 — 따밤 저장에서 캔버스 8천 장)
 */
const TINT = new Lru<string, HTMLCanvasElement>(CONFIG.render.tintCacheMax);
/** 요즘 그린 그림들 (다음 밤 단계 미리 만들기에 쓴다) — 단계 0에서도 기록 */
const touched = new Set<Drawable>();

/** 밤 단계 level(0~tintSteps)로 물든 그림. 0이면 원본 · 깨진 그림이면 빈 1×1 (기록·다시 불러오기) */
export function tinted(img: Drawable, level: number): Drawable {
  if (!okToDraw(img)) return EMPTY();
  touched.add(img);
  if (!level) return img;
  return tintOf(img, level);
}
function tintOf(img: Drawable, level: number): HTMLCanvasElement {
  const key = idOf(img) + '|' + level;
  const hit = TINT.get(key);
  if (hit) {
    if (canvasAlive(hit)) return hit;
    TINT.delete(key);
  }
  const c = canvas(img.width, img.height);
  const x = c.getContext('2d');
  if (!x) return EMPTY();
  try {
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = tintColor(level / CONFIG.dayNight.tintSteps);
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(img, 0, 0);
  } catch {
    drawFailed(img);
    return EMPTY();
  }
  const n = NAME.get(img);
  if (n) NAME.set(c, n);
  return TINT.set(key, c);
}

/**
 * 밤 색조 미리 만들기: 낮↔밤이 넘어가는 동안 한 단계에 한꺼번에 만들면 프레임이 끊기므로,
 * 다음 단계를 프레임마다 조금씩(budgetMs) 미리 만든다. 요즘 그린 그림만 (모든 그림 × 10단계를 다 만들지 않는다)
 */
const warmQueue: [Drawable, number][] = [];
let warmedFor = -1;
/** 다음 단계(level) 미리 만들기 예약 — 프레임마다 부른다: 단계가 그대로면 기록만 비우고, 바뀌면 지난 프레임에 그린 그림들을 줄 세운다 (-1 = 다음 단계 없음) */
export function warmTintLevel(level: number) {
  if (level === warmedFor) return touched.clear();
  warmedFor = level;
  warmQueue.length = 0;
  if (level <= 0 || level > CONFIG.dayNight.tintSteps) return touched.clear();
  for (const im of touched) warmQueue.push([im, level]);
  touched.clear();
}
export const tintWarmPending = () => warmQueue.length > 0;
export function pumpTintWarmup(budgetMs: number) {
  const end = performance.now() + budgetMs;
  while (warmQueue.length && performance.now() < end) {
    const [im, lv] = warmQueue.pop()!;
    if (drawable(im) && !TINT.peek(idOf(im) + '|' + lv)) tintOf(im, lv);
  }
}

/** 픽셀 단위 탭 판정용 (투명 픽셀 무시) */
const HIT = new Lru<string, CanvasRenderingContext2D>(CONFIG.render.hitCacheMax);
export function alphaAt(key: string, x: number, y: number): number {
  let c = HIT.get(key);
  if (!c || !canvasAlive(c.canvas)) {
    const im = IMG[key];
    if (!okToDraw(im)) return 0;
    const g = canvas(im.width, im.height).getContext('2d', { willReadFrequently: true });
    if (!g) return 0;
    try {
      g.drawImage(im, 0, 0);
    } catch {
      drawFailed(im);
      return 0;
    }
    c = HIT.set(key, g);
  }
  return c.getImageData(x | 0, y | 0, 1, 1).data[3];
}

/** 측정용 (개발 전역 __renderMem · e2e-render-mem): 캐시마다 장 수·상한·픽셀 */
export function assetMem() {
  const px = (it: Iterable<{ width: number; height: number }>) => {
    let n = 0;
    for (const c of it) n += c.width * c.height;
    return n;
  };
  return {
    tint: { n: TINT.size, cap: TINT.cap, px: px(TINT.values()), evicted: TINT.evicted },
    recolor: { n: RECOL.size, cap: RECOL.cap, px: px(RECOL.values()), evicted: RECOL.evicted },
    hit: { n: HIT.size, cap: HIT.cap, px: px([...HIT.values()].map((g) => g.canvas)), evicted: HIT.evicted },
    img: { n: Object.keys(IMG).length, px: px(Object.values(IMG)) },
    lights: { n: Object.keys(LIGHTS).length, px: px(Object.values(LIGHTS)) },
  };
}
