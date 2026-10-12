// 화면 크기 3단계(폰·태블릿·넓은 화면) · 글자 크기 · 마을 캔버스 배율 (핫픽스 3)
// <html data-size="phone|tablet|wide"> 와 CSS 변수(--f-*, --port)를 여기서 정한다.
import { CONFIG } from '../data/config';
import { TW, view } from '../engine/iso';
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
export const zoomsNow = () => (screen.size === 'phone' ? (devicePixelRatio >= 2 ? [0.5, ...CONFIG.view.zooms] : CONFIG.view.zooms) : U.wideZooms);

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
  S.zoom = zs.includes(z) ? z : def;
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
