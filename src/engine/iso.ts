// 좌표 변환(타일↔화면), 카메라(드래그·줌), 깊이 정렬 값
import { CONFIG } from '../data/config';

export const N = CONFIG.map.size;
export const TW = CONFIG.map.tileW;
export const TH = CONFIG.map.tileH;

/** 타일 좌표 → 화면(논리) 좌표 (원점 기준) */
export const sx = (x: number, y: number) => ((x - y) * TW) / 2;
export const sy = (x: number, y: number) => ((x + y) * TH) / 2;

/** 화면 상태: 논리 해상도·배율·카메라·원점 */
export const view = {
  /** 논리 해상도 = 화면 크기 ÷ 배율 */
  LW: 200,
  LH: 400,
  /** 정수 배율 (1·2·3) */
  SC: CONFIG.view.defaultZoom,
  cam: { x: 0, y: 0 },
  /** 땅 개편: 카메라 기준 = 지금 땅 가운데(타일)와 크기 — 끌어 둘러볼 수 있는 범위도 여기서 */
  focus: { m: N / 2, size: N },
  /** 부드럽게 옮겨 갈 목표 (없으면 null) */
  goal: null as null | { x: number; y: number },
  /** 월드 원점의 논리 좌표 (카메라 포함) */
  OX: 0,
  OY: 0,
};

/**
 * devicePx=false(폰): zoom = CSS px 배율 (지금 그대로)
 * devicePx=true(태블릿·넓은 화면): zoom = 기기 픽셀 배율 → 도트 하나가 정확히 zoom×zoom 기기 픽셀 (흐림 없음)
 */
export function resizeCanvas(cv: HTMLCanvasElement, host: HTMLElement, zoom: number, devicePx = false) {
  const r = host.getBoundingClientRect();
  const sc = devicePx ? zoom / devicePixelRatio : zoom;
  view.SC = sc;
  view.LW = Math.max(1, Math.ceil(r.width / sc));
  view.LH = Math.max(1, Math.ceil(r.height / sc));
  cv.width = view.LW;
  cv.height = view.LH;
  cv.style.width = view.LW * sc + 'px';
  cv.style.height = view.LH * sc + 'px';
  cv.getContext('2d')!.imageSmoothingEnabled = false;
  clampCam();
}

/** 카메라가 마을 밖으로 너무 멀리 가지 않게 */
export function clampCam() {
  // 땅 개편: 지금 땅 + 숲 2~3겹까지만 (그 바깥 텅 빈 초록은 안 보이게)
  const { m, size } = view.focus;
  const r = size / 2 + 3;
  const cy0 = (m - N / 2) * TH;
  const c = view.cam;
  c.x = Math.max(-r * TW * 0.5, Math.min(r * TW * 0.5, c.x));
  c.y = Math.max(cy0 - r * TH * 0.5, Math.min(cy0 + r * TH * 0.5, c.y));
}
/** 땅 가운데가 화면 가운데에 오는 카메라 */
export const camFor = (m: number) => ({ x: 0, y: (m - N / 2) * TH });

/** 프레임마다: 맵 가운데(7,7)가 화면 가운데에 오도록 원점 계산 */
export function updateOrigin() {
  const mid = N / 2;
  view.OX = Math.round(view.LW / 2 - sx(mid, mid) - view.cam.x);
  view.OY = Math.round(view.LH * 0.5 - sy(mid, mid) - view.cam.y);
}

/** 타일 좌표(실수) → 그 칸 가운데 바닥의 논리 화면 좌표 */
export function scr(x: number, y: number): [number, number] {
  return [view.OX + sx(x, y), view.OY + sy(x, y) + TH / 2];
}

/** 화면 이벤트 → 타일 좌표(실수) */
export function toTile(cv: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
  const r = cv.getBoundingClientRect();
  const X = (clientX - r.left) / view.SC - view.OX;
  const Y = (clientY - r.top) / view.SC - view.OY;
  const a = X / (TW / 2);
  const b = Y / (TH / 2);
  return [(a + b) / 2, (b - a) / 2];
}

/** 화면 이벤트 → 논리 화면 좌표 */
export function toLogical(cv: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
  const r = cv.getBoundingClientRect();
  return [(clientX - r.left) / view.SC, (clientY - r.top) / view.SC];
}

/** 카메라가 타일 위치를 비추게 */
export function lookAt(x: number, y: number) {
  view.cam.x = sx(x, y) - sx(N / 2, N / 2);
  view.cam.y = sy(x, y) - sy(N / 2, N / 2) - view.LH * 0.15;
  clampCam();
}

// ───────── 깊이 정렬 값 (클수록 앞, 나중에 그림) ─────────
export const depthBuilding = (tx: number, ty: number, fw: number, fh: number) => tx + ty + fw + fh - 1.5;
export const depthActor = (x: number, y: number) => x + y;
export const depthWild = (x: number, y: number) => x + y + 0.6;
