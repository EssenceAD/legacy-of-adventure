// FIRSTLOOK §4 (flTeaserFit · 실험실 vis): 티저·타이틀이 폰 화면을 채우게 — 규칙만 (DOM은 director.ts · 타이틀 배경은 game.ts)
//  타이틀·티저는 저장을 불러오기 전에 뜬다: loadFlags()가 끝난 뒤 · 실험실(localStorage)은 vis()가 바로 읽는다
import { CONFIG } from '../data/config';
import { vis } from '../world/visual';

export const teaserFitOn = (): boolean => vis('flTeaserFit');

export interface Fit {
  /** 기기 픽셀 정수 배율 */
  k: number;
  /** CSS 크기 · 자리 (무대 왼쪽 위 기준 · 음수 = 그만큼 잘림) */
  w: number;
  h: number;
  left: number;
  top: number;
}

export interface FitOpts {
  /** 그보다 몇 단계 더 (다락 줌인) */
  extra?: number;
  /** 확대 상한: 폭 맞춤 배율 × maxZoom (넘치면 위아래는 흐린 배경) · 기본 = 끝없음(순수 cover) */
  maxZoom?: number;
  /** 이 가로 범위(장면 도트)가 통째로 보이게 가운데를 옮김 (보스) */
  focus?: [number, number];
  /** 장면 전체가 보이게 (자르지 않음 · 남는 곳은 흐린 배경) */
  contain?: boolean;
}

/**
 * 장면(sw×sh 도트)을 무대(bw×bh CSS px)에 맞추기 — 정수 배율(도트가 번지지 않게)
 *  cover: 무대를 다 덮는 가장 작은 정수 배율 · maxZoom이면 폭 맞춤 × maxZoom 까지만 · contain: 장면 전체가 들어가는 가장 큰 정수 배율
 *  넘치는 쪽은 가운데(또는 focus 범위 가운데)를 기준으로 자르고, 장면 끝 밖은 보이지 않게 · 모자라는 쪽은 가운데 (기기 픽셀에 맞춰 반올림)
 */
export function coverFit(sw: number, sh: number, bw: number, bh: number, dpr: number, o: FitOpts = {}): Fit {
  const wf = (bw * dpr) / sw;
  const hf = (bh * dpr) / sh;
  const eps = 1e-6;
  let k = o.contain ? Math.floor(Math.min(wf, hf) + eps) : Math.ceil(Math.max(wf, hf) - eps);
  if (!o.contain && o.maxZoom) k = Math.min(k, Math.floor(wf * o.maxZoom + eps));
  k = Math.max(1, k) + (o.extra ?? 0);
  const w = (sw * k) / dpr;
  const h = (sh * k) / dpr;
  const px = (v: number) => Math.round(v * dpr) / dpr;
  const s = w / sw;
  const cx = o.focus ? (o.focus[0] + o.focus[1]) / 2 : sw / 2;
  const left = w > bw ? Math.min(0, Math.max(bw - w, bw / 2 - cx * s)) : (bw - w) / 2;
  return { k, w, h, left: px(left), top: px((bh - h) / 2) };
}

/** 처음 한 번만 자동 재생: 저장이 없고 아직 본 적 없을 때 (본 순간 seen을 남긴다 → 두 번째부터 타이틀로 바로) */
export const shouldAutoTeaser = (hasSave: boolean, seen: boolean): boolean => !hasSave && !seen;

/** 타이틀 제목 크기·어둡기를 CSS 변수로 (켜졌을 때 body.flteaser) */
export function applyTeaserFitClass(body: HTMLElement = document.body) {
  const on = teaserFitOn();
  body.classList.toggle('flteaser', on);
  if (!on) return;
  const c = CONFIG.firstLook.title;
  body.style.setProperty('--flt-dim', String(c.dim));
  body.style.setProperty('--flt-k', String(c.koScale));
  body.style.setProperty('--flt-pad', c.fitPad + 'px');
}
