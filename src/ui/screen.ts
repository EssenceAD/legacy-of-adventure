// 화면 크기 3단계(폰·태블릿·넓은 화면) · 글자 크기 · 마을 캔버스 배율 (핫픽스 3)
// <html data-size="phone|tablet|wide"> 와 CSS 변수(--f-*, --port)를 여기서 정한다.
import { CONFIG } from '../data/config';
import { canvasScale, TW, view } from '../engine/iso';
import { saverOn } from '../engine/fps';
import { flag } from '../world/flags';
import { vis } from '../world/visual';
import { getPref, setPref } from '../save/save';
import { S } from '../world/state';
import { snap } from './kit';

const U = CONFIG.UI_SCALE;
export type SizeClass = 'phone' | 'tablet' | 'wide';

export const screen = {
  size: 'phone' as SizeClass,
  /** 태블릿·넓은 화면: 배율을 기기 픽셀 기준 정수로 (흐림 없이) */
  devicePx: false,
  /** 사용자 글자 크기 단계 (0 보통 · 1 크게 · 2 아주 크게) */
  fontStep: 0,
};

function viewport() {
  const vv = window.visualViewport;
  return { w: vv?.width ?? innerWidth, h: vv?.height ?? innerHeight };
}

export function sizeClass(w: number, h: number): SizeClass {
  const short = Math.min(w, h);
  if (short >= U.wideMin || w / h >= U.wideAspect) return 'wide';
  if (short >= U.tabletMin) return 'tablet';
  return 'phone';
}

/** 지금 크기 구간에서 고를 수 있는 배율 */
/** LAND2: 폰에서 기기 픽셀 2배 이상이면 ×0.5 (논리 1px = 기기 1px · 도트 그대로) — 손으로만 고른다 (자동 배율은 그대로) */
const rawZooms = (size: SizeClass, dpr: number) => (size === 'phone' ? (dpr >= 2 ? [0.5, ...CONFIG.view.zooms] : CONFIG.view.zooms) : U.wideZooms);
/** 지금 캔버스 픽셀 상한 (배터리 절약이면 더 낮게) */
export const dprCapNow = (saver = saverOn()) => (saver ? CONFIG.render.dprCapSaver : CONFIG.render.dprCap);
/** 이 배율이 화면에서 실제로 내는 크기 (view.SC) */
export const zoomSC = (z: number, size: SizeClass = screen.size, dpr = devicePixelRatio || 1, saver = saverOn()) => canvasScale(z, size !== 'phone', dpr, dprCapNow(saver));
/**
 * v0.24.4 zoomDedupe: 상한(dprCap)에 걸려 같은 크기가 되는 배율은 하나만 (dpr 2.6 넓은 화면 ×1·×2 = 0.77 · dpr 2 + 절약 ×0.5·×1 = 1)
 *  — 매번 지금 상한·절약 모드로 계산 · 버튼·핀치·휠이 같은 목록
 */
export function zoomList(size: SizeClass, dpr: number, saver: boolean): number[] {
  const zs = rawZooms(size, dpr);
  if (!flag('zoomDedupe')) return zs;
  const out: number[] = [];
  const seen: number[] = [];
  for (const z of zs) {
    const sc = zoomSC(z, size, dpr, saver);
    // 같은 크기면 큰 배율 쪽 이름을 남긴다 (상한에 걸리면 크기가 위로 올림되어 큰 배율과 같아진다)
    const i = seen.findIndex((v) => Math.abs(v - sc) < 1e-6);
    if (i >= 0) out[i] = z;
    else {
      seen.push(sc);
      out.push(z);
    }
  }
  return out;
}
export const zoomsNow = () => zoomList(screen.size, devicePixelRatio || 1, saverOn());
/** 목록에 없는 배율(걸러졌거나 예전 저장값) → 같은 크기의 배율, 없으면 크기가 가장 가까운 배율 */
export function snapZoom(z: number, zs = zoomsNow()): number {
  if (zs.includes(z)) return z;
  const sc = zoomSC(z);
  return zs.reduce((b, v) => (Math.abs(zoomSC(v) - sc) < Math.abs(zoomSC(b) - sc) - 1e-9 ? v : b), zs[0]);
}
/** 목록에서 지금 배율의 자리 (걸러진 배율이면 같은 크기 자리) */
export const zoomIdx = (z: number, zs = zoomsNow()) => zs.indexOf(snapZoom(z, zs));

/**
 * 땅 개편 §5: 지금 땅(가로 size×TW)이 화면 짧은 변의 70~80%를 채우는 정수 배율.
 *  정수 배율이라 딱 맞지 않으면 75%에 가장 가까운 것 (95%를 넘지 않게) — 다 넘으면 가장 작은 배율(끌어서 둘러보기)
 */
function bestZoom(zs: number[], short: number, size: number): number {
  let best = zs[0];
  let bd = Infinity;
  for (const z of zs) {
    const r = (size * TW * z) / short;
    if (r > 0.95) continue;
    const d = Math.abs(r - 0.75);
    if (d < bd) [bd, best] = [d, z];
  }
  return best;
}
/** PC·태블릿 (기기 픽셀 배율) */
export function autoZoom(size = view.focus.size): number {
  const { w, h } = viewport();
  return bestZoom(U.wideZooms, Math.min(w, h) * devicePixelRatio, size);
}
/** 폰 (CSS 픽셀 배율) · 그 밖은 autoZoom */
export function landZoom(size = view.focus.size): number {
  if (screen.size !== 'phone') return autoZoom(size);
  const { w, h } = viewport();
  return bestZoom(CONFIG.view.zooms, Math.min(w, h), size);
}

const zoomKey = () => (screen.size === 'phone' ? 'zoom' : 'zoom-' + screen.size);

/** 크기 구간에 맞는 배율로 (사용자가 그 구간에서 고른 배율이 있으면 그것) */
function pickZoom() {
  const zs = zoomsNow();
  const def = landZoom();
  const z = getPref<number>(zoomKey(), def);
  S.zoom = zs.includes(z) ? z : flag('zoomDedupe') ? snapZoom(z, zs) : def;
}
/** 사용자가 이 크기 구간에서 배율을 고른 적이 있나 */
export const hasZoomPref = () => getPref<number | null>(zoomKey(), null) !== null;
export function saveZoom() {
  setPref(zoomKey(), S.zoom);
}

/** 글자 크기 → CSS 변수 (픽셀 글꼴이 흐려지지 않게 정수 px) */
function applyFonts() {
  const base = U.fonts[screen.size];
  const k = U.userScales[screen.fontStep] ?? 1;
  const r = document.documentElement.style;
  for (const [name, px] of Object.entries(base)) r.setProperty('--f-' + name, Math.round(px * k) + 'px');
  // VISUAL §5 uiKitV2 (실험실): 3개 크기 변수 (body.ui2 가 --f-* 를 이것으로 모은다)
  if (vis('uiKitV2')) for (const [name, px] of Object.entries(U.fontsV2[screen.size])) r.setProperty('--fs-' + name, Math.round(px * k) + 'px');
  // 초상화(64px 그림)는 기기 픽셀 정수배로 (README 0장)
  r.setProperty('--port', snap(64, U.portrait[screen.size]) + 'px');
}

export function setFontStep(i: number) {
  screen.fontStep = Math.max(0, Math.min(U.userScales.length - 1, i));
  setPref('fontStep', screen.fontStep);
  applyFonts();
}

let onChange: () => void = () => {};
/** 화면이 바뀌면(크기·회전) 캔버스를 다시 맞춘다 */
export function setOnScreenChange(fn: () => void) {
  onChange = fn;
}

/** 크기 구간을 다시 계산 (바뀌었으면 배율도 다시) */
export function updateScreen(force = false) {
  const { w, h } = viewport();
  const size = sizeClass(w, h);
  const changed = size !== screen.size;
  screen.size = size;
  screen.devicePx = size !== 'phone';
  document.documentElement.dataset.size = size;
  applyFonts();
  // 사용자가 고른 배율이 없으면 크기가 바뀔 때마다 자동 배율을 다시 고른다
  if (changed || force || getPref<number | null>(zoomKey(), null) == null) pickZoom();
  onChange();
}

export function initScreen() {
  screen.fontStep = getPref<number>('fontStep', 0);
  updateScreen(true);
  let t = 0;
  const later = () => {
    clearTimeout(t);
    t = window.setTimeout(() => updateScreen(), 120);
  };
  addEventListener('resize', later);
  addEventListener('orientationchange', later);
  window.visualViewport?.addEventListener('resize', later);
  // 창 크기 이벤트가 안 오는 경우(임베드·개발 도구 기기 흉내)도 놓치지 않게
  const host = document.getElementById('view');
  if (host && 'ResizeObserver' in window) new ResizeObserver(later).observe(host);
}
