// SPRLOST (웅스 신고: 롯데캐슬 · 갤럭시 — 앱을 내렸다 오거나 채팅창을 열면 건물·나무·장식이 다 사라지고 새로고침 전까지 안 돌아옴)
//  원인: 깨진 그림 다시 불러오기 횟수(reloadMax 5)가 세션 누적 → 같은 그림을 다섯 번 잃으면 끝
//  · 다시 불러오기에 성공하면 횟수 0 · 앱으로 돌아오면/화면 크기가 바뀌면 모두 0
//  · 안전망(30% 넘게 3초 넘게 못 그림 → 원본 모두 다시 받기 → 그래도면 버튼) · 폰/큰 마을 캐시 상한 · sprite_lost 기록 묶기
import { afterEach, describe, expect, it } from 'vitest';
import { assetMem, breakSpriteForTest, IMG, okToDraw, refetchAllSprites, reloadCounts, resetReloadCounters, setImageLoaderForTest, spriteOk, takeDrawStats } from '../src/engine/assets';
import { cacheCaps, LostLog, SpriteWatch, uaClass } from '../src/engine/spriteLost';
import { initSpriteGuard, spriteGuardFrame } from '../src/engine/spriteGuard';
import { CONFIG } from '../src/data/config';

/** jsdom에서 「받은 그림」 흉내: 다 받았고 크기가 있는 <img> */
function fakeImage(w = 16, h = 16): HTMLImageElement {
  const im = new Image();
  Object.defineProperty(im, 'complete', { value: true });
  Object.defineProperty(im, 'naturalWidth', { value: w });
  Object.defineProperty(im, 'naturalHeight', { value: h });
  Object.defineProperty(im, 'width', { value: w });
  Object.defineProperty(im, 'height', { value: h });
  return im;
}
const okLoader = () => setImageLoaderForTest(async () => fakeImage());
const badLoader = () => setImageLoaderForTest(async (src) => Promise.reject(new Error(src)));
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};
/** 잃고 → 그리려다 실패(다시 불러오기 시도) → 받기 끝날 때까지 */
async function loseAndDraw(k: string) {
  breakSpriteForTest(k, 'canvas');
  expect(okToDraw(IMG[k])).toBe(false);
  await flush();
}

afterEach(() => setImageLoaderForTest(null));

describe('다시 불러오기 횟수 (SPRLOST)', () => {
  it('성공하면 그 그림 횟수 0 → 같은 그림을 6번(+) 잃어도 매번 되살아남', async () => {
    okLoader();
    for (let i = 0; i < CONFIG.render.reloadMax + 3; i++) {
      await loseAndDraw('t_same');
      expect(spriteOk('t_same')).toBe(true);
      expect(reloadCounts().t_same).toBe(0);
    }
  });
  it('계속 실패하면 reloadMax번에서 멈춘다 (예전과 같음) · 그다음 성공하면 다시 0', async () => {
    badLoader();
    for (let i = 0; i < CONFIG.render.reloadMax + 2; i++) await loseAndDraw('t_fail');
    expect(reloadCounts().t_fail).toBe(CONFIG.render.reloadMax);
    expect(spriteOk('t_fail')).toBe(false);
    resetReloadCounters();
    expect(reloadCounts().t_fail).toBe(0);
    okLoader();
    await loseAndDraw('t_fail');
    expect(spriteOk('t_fail')).toBe(true);
    expect(reloadCounts().t_fail).toBe(0);
  });
  it('앱으로 돌아오면(visibilitychange → visible) · 화면 크기가 바뀌면(resize) 모두 0 · 숨을 때는 그대로', async () => {
    const btn = document.createElement('button');
    btn.hidden = true;
    initSpriteGuard({ button: btn, buildings: () => 10 });
    const exhaust = async () => {
      badLoader();
      for (let i = 0; i < CONFIG.render.reloadMax + 1; i++) await loseAndDraw('t_vis');
      expect(reloadCounts().t_vis).toBe(CONFIG.render.reloadMax);
    };
    let vs: DocumentVisibilityState = 'hidden';
    Object.defineProperty(document, 'visibilityState', { get: () => vs, configurable: true });
    await exhaust();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(reloadCounts().t_vis).toBe(CONFIG.render.reloadMax);
    vs = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(reloadCounts().t_vis).toBe(0);
    await exhaust();
    window.dispatchEvent(new Event('resize'));
    expect(reloadCounts().t_vis).toBe(0);
    // 0이 되면 다음 그리기에서 다시 받아 되살아난다
    okLoader();
    await loseAndDraw('t_vis');
    expect(spriteOk('t_vis')).toBe(true);
  });
  it('그리기 통계: 깨진 그림 대신 넘긴 빈 1×1은 세지 않는다', () => {
    takeDrawStats();
    const c = document.createElement('canvas');
    okToDraw(c);
    breakSpriteForTest('t_stat', 'canvas');
    okToDraw(IMG.t_stat);
    expect(takeDrawStats()).toEqual({ n: 2, bad: 1 });
    expect(takeDrawStats()).toEqual({ n: 0, bad: 0 });
  });
});

describe('안전망 판정 (SpriteWatch)', () => {
  const cfg = { badRatio: 0.3, holdMs: 3000, minDraws: 8 };
  it('30% 넘게 못 그린 상태가 3초를 넘어야 다시 받기 · 30% 딱은 괜찮음', () => {
    const w = new SpriteWatch(cfg);
    expect(w.frame(100, 30, 0)).toBe('none');
    expect(w.frame(100, 31, 0)).toBe('none');
    expect(w.frame(100, 31, 2999)).toBe('none');
    expect(w.frame(100, 31, 3000)).toBe('refetch');
  });
  it('중간에 괜찮아지면 시계가 처음부터', () => {
    const w = new SpriteWatch(cfg);
    w.frame(10, 9, 0);
    w.frame(10, 0, 2000);
    expect(w.frame(10, 9, 2500)).toBe('none');
    expect(w.frame(10, 9, 5400)).toBe('none');
    expect(w.frame(10, 9, 5500)).toBe('refetch');
  });
  it('그린 게 minDraws보다 적은 프레임(창이 덮음)은 판정하지 않는다', () => {
    const w = new SpriteWatch(cfg);
    expect(w.frame(7, 7, 0)).toBe('none');
    expect(w.frame(7, 7, 10000)).toBe('none');
    expect(w.badSince).toBe(-1);
  });
  it('다시 받는 동안은 쉬고, 끝난 뒤 3초 넘게 그대로면 버튼 · 괜찮아지면 recovered', () => {
    const w = new SpriteWatch(cfg);
    w.frame(20, 20, 0);
    expect(w.frame(20, 20, 3000)).toBe('refetch');
    w.start();
    expect(w.frame(20, 20, 9000)).toBe('none');
    w.done(9000);
    expect(w.frame(20, 20, 11999)).toBe('none');
    expect(w.frame(20, 20, 12000)).toBe('button');
    expect(w.frame(20, 20, 20000)).toBe('none');
    expect(w.frame(20, 0, 20100)).toBe('recovered');
    expect(w.stage).toBe(0);
  });
  it('다시 받아서 되살아나면 버튼 없이 recovered', () => {
    const w = new SpriteWatch(cfg);
    w.frame(20, 20, 0);
    expect(w.frame(20, 20, 3000)).toBe('refetch');
    w.start();
    w.done(3500);
    expect(w.frame(20, 1, 3600)).toBe('recovered');
  });
  it('원본 모두 다시 받기: 건물 그림을 바꿔 끼우고 횟수 0', async () => {
    okLoader();
    breakSpriteForTest('t_house', 'canvas');
    const r = await refetchAllSprites();
    expect(r.fail).toBe(0);
    expect(r.ok).toBeGreaterThan(0);
    expect(Object.values(reloadCounts()).every((n) => n === 0)).toBe(true);
  });
});

describe('캐시 상한 (폰 · 큰 마을)', () => {
  const R = CONFIG.render;
  it('보통은 그대로 · 폰이면 phoneCaps · 큰 마을이면 bigVillage · 둘 다면 작은 쪽', () => {
    expect(cacheCaps('wide', 50)).toEqual({ tint: R.tintCacheMax, recolor: R.recolorCacheMax, hit: R.hitCacheMax });
    expect(cacheCaps('phone', 50)).toEqual({ tint: R.phoneCaps.tint, recolor: R.phoneCaps.recolor, hit: R.phoneCaps.hit });
    expect(cacheCaps('wide', R.bigVillage.buildings + 1)).toEqual({ tint: R.bigVillage.tint, recolor: R.bigVillage.recolor, hit: R.bigVillage.hit });
    const both = cacheCaps('phone', 171);
    expect(both.tint).toBe(Math.min(R.phoneCaps.tint, R.bigVillage.tint));
    expect(both.hit).toBe(Math.min(R.phoneCaps.hit, R.bigVillage.hit));
    expect(R.phoneCaps.tint).toBeLessThanOrEqual(R.tintCacheMax / 2);
  });
  it('data-size=phone 이면 그림 캐시 상한이 실제로 낮아진다 (프레임마다 다시 본다)', () => {
    document.documentElement.dataset.size = 'phone';
    initSpriteGuard({ button: null, buildings: () => 171 });
    spriteGuardFrame(1e9);
    const m = assetMem();
    expect(m.tint.cap).toBe(Math.min(R.phoneCaps.tint, R.bigVillage.tint));
    expect(m.recolor.cap).toBe(Math.min(R.phoneCaps.recolor, R.bigVillage.recolor));
    expect(m.hit.cap).toBe(Math.min(R.phoneCaps.hit, R.bigVillage.hit));
  });
});

describe('sprite_lost 기록 묶기', () => {
  it('gapMs에 한 번 · 단계마다 이름 수 · 세션 상한', () => {
    const L = new LostLog({ gapMs: 10000, maxEvents: 3 });
    for (let i = 0; i < 50; i++) L.add('lost', 's' + (i % 20));
    L.add('reload_ok', 's1');
    const a = L.flush(0);
    expect(a).toEqual([
      { phase: 'lost', n: 20, some: ['s0', 's1', 's2'] },
      { phase: 'reload_ok', n: 1, some: ['s1'] },
    ]);
    L.add('lost', 'x');
    expect(L.flush(5000)).toEqual([]);
    expect(L.flush(10000)).toHaveLength(1);
    L.add('give_up', 'y');
    expect(L.flush(30000)).toEqual([]); // 상한 3
    expect(L.pending).toBe(false);
  });
  it('UA 갈래', () => {
    expect(uaClass('Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36')).toBe('android-samsung');
    expect(uaClass('Mozilla/5.0 (Linux; Android 14; SM-S918N; wv) AppleWebKit/537.36 Chrome/121.0 Mobile Safari/537.36 KAKAOTALK 10.4.5')).toBe('android-kakao');
    expect(uaClass('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('ios-safari');
    expect(uaClass('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/121.0 Mobile Safari/537.36')).toBe('android-chrome');
  });
});
