// FIRSTLOOK §4 flTeaserFit: cover 맞춤 계산 · 플래그/실험실이 저장 불러오기 전에 먹나 · 티저는 처음 한 번만
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { applyTeaserFitClass, coverFit, shouldAutoTeaser, teaserFitOn } from '../src/teaser/fit';
import { FLAG_DEFAULTS, loadFlags, setFlag } from '../src/world/flags';
import { teaserView } from '../src/world/grade';
import { setLab } from '../src/world/visual';

beforeEach(() => {
  localStorage.clear();
  setLab(false);
  setFlag('flTeaserFit', false);
  document.body.className = '';
});
afterEach(() => {
  setLab(false);
  setFlag('flTeaserFit', false);
  teaserView.g = -1;
  vi.unstubAllGlobals();
});

describe('coverFit (꽉 채우기 · 정수 배율 · 가운데 자름)', () => {
  const cases: [string, number, number, number, number, number][] = [
    ['폰 412×860 · 전투 180×168', 180, 168, 412, 860, 2],
    ['폰 360×780 · 전투', 180, 168, 360, 780, 2],
    ['폰 412×860 · 다락 160×120', 160, 120, 412, 860, 2.625],
    ['PC 1280×800 · 전투', 180, 168, 1280, 800, 1],
    ['PC 1280×800 · 다락', 160, 120, 1280, 800, 1],
    ['정사각 600×600 · 356×200', 356, 200, 600, 600, 1.5],
    ['아주 넓음 2000×400', 180, 168, 2000, 400, 1],
  ];
  for (const [name, sw, sh, bw, bh, dpr] of cases)
    it(name, () => {
      const f = coverFit(sw, sh, bw, bh, dpr);
      expect(Number.isInteger(f.k)).toBe(true);
      // 다 덮는다
      expect(f.w).toBeGreaterThanOrEqual(bw - 1e-6);
      expect(f.h).toBeGreaterThanOrEqual(bh - 1e-6);
      // 한 단계 작으면 못 덮는다 (가장 작은 정수 배율)
      if (f.k > 1) expect(((f.k - 1) * sw) / dpr < bw - 1e-6 || ((f.k - 1) * sh) / dpr < bh - 1e-6).toBe(true);
      // 가운데 기준: 양쪽으로 잘리는 양이 같다 (기기 픽셀 반올림 1px 안)
      expect(Math.abs(-f.left - (f.w - bw + f.left))).toBeLessThanOrEqual(1 / dpr + 1e-6);
      expect(Math.abs(-f.top - (f.h - bh + f.top))).toBeLessThanOrEqual(1 / dpr + 1e-6);
      expect(f.left).toBeLessThanOrEqual(0);
      expect(f.top).toBeLessThanOrEqual(0);
      // 기기 픽셀에 맞춤
      expect(Math.abs(f.left * dpr - Math.round(f.left * dpr))).toBeLessThan(1e-6);
    });
  it('세로 화면 = 위아래 빈칸 없음 · 좌우만 잘림', () => {
    const f = coverFit(180, 168, 412, 860, 2);
    expect(f.top).toBeLessThanOrEqual(0);
    expect(f.top + f.h).toBeGreaterThanOrEqual(860);
    expect(f.left).toBeLessThan(0);
  });
  it('extra = 한 단계 더 (다락 줌인)', () => {
    const a = coverFit(160, 120, 412, 860, 2);
    const b = coverFit(160, 120, 412, 860, 2, 1);
    expect(b.k).toBe(a.k + 1);
    expect(b.left).toBeLessThan(a.left);
  });
  it('딱 맞으면 그 배율 그대로 (부동소수 오차로 한 단계 더 커지지 않음)', () => {
    expect(coverFit(100, 50, 300, 150, 1).k).toBe(3);
    expect(coverFit(100, 50, 300, 150, 1)).toMatchObject({ left: 0, top: 0 });
  });
});

describe('플래그 · 실험실 (타이틀·티저는 저장 불러오기 전)', () => {
  it('기본 꺼짐 · 저장 없이도 body 클래스 없음', () => {
    expect(FLAG_DEFAULTS.flTeaserFit).toBe(false);
    expect(teaserFitOn()).toBe(false);
    applyTeaserFitClass();
    expect(document.body.classList.contains('flteaser')).toBe(false);
  });
  it('실험실(이 기기 localStorage) — 저장이 없어도 바로 먹는다', () => {
    expect(localStorage.getItem(CONFIG.save.key)).toBeNull();
    setLab(true);
    expect(localStorage.getItem('legacy-of-adventure-visualLab')).toBe('true');
    expect(teaserFitOn()).toBe(true);
    applyTeaserFitClass();
    expect(document.body.classList.contains('flteaser')).toBe(true);
    expect(document.body.style.getPropertyValue('--flt-dim')).toBe(String(CONFIG.firstLook.title.dim));
    expect(document.body.style.getPropertyValue('--flt-k')).toBe(String(CONFIG.firstLook.title.koScale));
  });
  it('flags.json 의 flTeaserFit: true (부팅 loadFlags) — 저장 없이도', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ flTeaserFit: true }), { status: 200 }));
    await loadFlags('/');
    expect(localStorage.getItem(CONFIG.save.key)).toBeNull();
    expect(teaserFitOn()).toBe(true);
    applyTeaserFitClass();
    expect(document.body.classList.contains('flteaser')).toBe(true);
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ flTeaserFit: false }), { status: 200 }));
    await loadFlags('/');
    applyTeaserFitClass();
    expect(document.body.classList.contains('flteaser')).toBe(false);
  });
});

describe('티저는 처음 한 번만', () => {
  it('저장 없음 + 아직 안 봄 → 자동 재생 · 나머지는 타이틀로 바로', () => {
    expect(shouldAutoTeaser(false, false)).toBe(true);
    expect(shouldAutoTeaser(false, true)).toBe(false);
    expect(shouldAutoTeaser(true, false)).toBe(false);
    expect(shouldAutoTeaser(true, true)).toBe(false);
  });
});
