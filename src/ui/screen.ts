// 화면 크기 3단계(폰·태블릿·넓은 화면) · 글자 크기 · 마을 캔버스 배율 (핫픽스 3)
// <html data-size="phone|tablet|wide"> 와 CSS 변수(--f-*, --port)를 여기서 정한다.
import { CONFIG } from '../data/config';
import { N, TW } from '../engine/iso';
import { getPref, setPref } from '../save/save';
import { S } from '../world/state';

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
export const zoomsNow = () => (screen.size === 'phone' ? CONFIG.view.zooms : U.wideZooms);

/** 마을(가로 N×TW)이 짧은 변의 fill 비율 안에 들어가는 가장 큰 정수 배율 (기기 픽셀) */
export function autoZoom(): number {
  const { w, h } = viewport();
  const dev = Math.min(w, h) * devicePixelRatio;
  const z = Math.floor((dev * U.fill[1]) / (N * TW));
  const zs = U.wideZooms;
  return Math.max(zs[0], Math.min(zs[zs.length - 1], z));
}

const zoomKey = () => (screen.size === 'phone' ? 'zoom' : 'zoom-' + screen.size);

/** 크기 구간에 맞는 배율로 (사용자가 그 구간에서 고른 배율이 있으면 그것) */
function pickZoom() {
  const zs = zoomsNow();
  const def = screen.size === 'phone' ? CONFIG.view.defaultZoom : autoZoom();
  const z = getPref<number>(zoomKey(), def);
  S.zoom = zs.includes(z) ? z : def;
}
export function saveZoom() {
  setPref(zoomKey(), S.zoom);
}

/** 글자 크기 → CSS 변수 (픽셀 글꼴이 흐려지지 않게 정수 px) */
function applyFonts() {
  const base = U.fonts[screen.size];
  const k = U.userScales[screen.fontStep] ?? 1;
  const r = document.documentElement.style;
  for (const [name, px] of Object.entries(base)) r.setProperty('--f-' + name, Math.round(px * k) + 'px');
  r.setProperty('--port', U.portrait[screen.size] + 'px');
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
