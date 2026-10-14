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

/**
 * 장면(sw×sh 도트)을 무대(bw×bh CSS px)에 꽉 채우기(cover): 정수 배율(도트가 번지지 않게) 중 가장 작은 것으로 무대를 다 덮고,
 *  넘치는 쪽은 가운데를 기준으로 자른다 (기기 픽셀에 맞춰 반올림) · extra = 그보다 몇 단계 더 (다락 줌인)
 */
export function coverFit(sw: number, sh: number, bw: number, bh: number, dpr: number, extra = 0): Fit {
  const k = Math.max(1, Math.ceil(Math.max((bw * dpr) / sw, (bh * dpr) / sh) - 1e-6)) + extra;
  const w = (sw * k) / dpr;
  const h = (sh * k) / dpr;
  const px = (v: number) => Math.round(v * dpr) / dpr;
  return { k, w, h, left: px((bw - w) / 2), top: px((bh - h) / 2) };
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
