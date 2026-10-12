// 렌더 메모리 (따밤 신고: Z Flip4 · 삼성 인터넷 — 건물이 그림자만 남고 사라짐)
//  LRU 캐시 · 마을 캔버스 배율 상한 · 깨진 그림 건너뛰기 · 밤 색조 캐시 상한
import { describe, expect, it } from 'vitest';
import { canvasAlive, drawable, Lru } from '../src/engine/lru';
import { canvasScale } from '../src/engine/iso';
import { assetMem, breakSpriteForTest, drawFails, IMG, okToDraw, tinted } from '../src/engine/assets';
import { CONFIG } from '../src/data/config';

describe('Lru', () => {
  it('상한을 넘으면 가장 오래 안 쓴 것부터 버린다', () => {
    const out: string[] = [];
    const c = new Lru<string, number>(3, (_v, k) => out.push(k));
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.get('a'); // a를 방금 씀 → b가 가장 오래됨
    c.set('d', 4);
    expect(c.size).toBe(3);
    expect(c.has('b')).toBe(false);
    expect([...c.keys()]).toEqual(['c', 'a', 'd']);
    expect(out).toEqual(['b']);
    expect(c.evicted).toBe(1);
  });
  it('peek은 순서를 안 바꾼다 · deleteWhere', () => {
    const c = new Lru<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.peek('a');
    c.set('c', 3);
    expect(c.has('a')).toBe(false);
    c.deleteWhere((k) => k === 'b');
    expect([...c.keys()]).toEqual(['c']);
  });
  it('화면 안(매 프레임 쓰는) 것은 화면 밖 것이 아무리 많아도 남는다', () => {
    const c = new Lru<number, number>(10);
    for (let f = 0; f < 50; f++) {
      for (let i = 0; i < 5; i++) c.get(i) ?? c.set(i, i); // 화면 안 5개
      c.set(100 + f, f); // 지나가는 화면 밖 것
    }
    for (let i = 0; i < 5; i++) expect(c.has(i)).toBe(true);
    expect(c.size).toBe(10);
  });
});

describe('깨진 그림 판정', () => {
  it('<img>: complete && naturalWidth 0 이면 깨짐 · 폭 0 캔버스는 잃은 것', () => {
    expect(drawable({ tagName: 'IMG', complete: true, naturalWidth: 0, width: 0, height: 0 })).toBe(false);
    expect(drawable({ tagName: 'IMG', complete: false, naturalWidth: 10, width: 10, height: 10 })).toBe(false);
    expect(drawable({ tagName: 'IMG', complete: true, naturalWidth: 10, width: 10, height: 10 })).toBe(true);
    expect(drawable({ tagName: 'CANVAS', width: 0, height: 10 })).toBe(false);
    expect(canvasAlive({ width: 0, height: 4 })).toBe(false);
    expect(canvasAlive({ width: 4, height: 4, getContext: () => null })).toBe(false);
    expect(canvasAlive({ width: 4, height: 4, getContext: () => ({}) })).toBe(true);
  });
  it('깨진 건물 그림: 오류 없이 빈 그림으로 넘기고 그림마다 한 번 기록', () => {
    breakSpriteForTest('t_house');
    expect(okToDraw(IMG.t_house)).toBe(false);
    const a = tinted(IMG.t_house, 4);
    const b = tinted(IMG.t_house, 0);
    expect(a.width).toBe(1);
    expect(b.width).toBe(1);
    expect(drawFails().filter((x) => x === 't_house')).toHaveLength(1);
  });
});

describe('밤 색조 캐시 상한', () => {
  it('그림이 아무리 많아도 상한까지만 들고 있는다', () => {
    const cap = CONFIG.render.tintCacheMax;
    for (let i = 0; i < cap + 50; i++) {
      const c = document.createElement('canvas');
      c.width = 4;
      c.height = 4;
      tinted(c, 1 + (i % CONFIG.dayNight.tintSteps));
    }
    expect(assetMem().tint.n).toBeLessThanOrEqual(cap);
    expect(assetMem().tint.evicted).toBeGreaterThan(0);
  });
});

describe('마을 캔버스 배율 상한 (CSS 1px당 캔버스 픽셀)', () => {
  const ratio = (sc: number) => 1 / sc;
  it('폰(CSS 배율): ×1·×2·×3은 그대로 · ×0.5는 상한 2면 그대로, 절약 1.5면 기기 픽셀 정수배로', () => {
    for (const z of [1, 2, 3]) expect(canvasScale(z, false, 2.625, 2)).toBe(z);
    expect(canvasScale(0.5, false, 2.625, 2)).toBe(0.5);
    const s = canvasScale(0.5, false, 2.625, 1.5);
    expect(ratio(s)).toBeLessThanOrEqual(1.5);
    expect(Number.isInteger(Math.round(s * 2.625 * 1e6) / 1e6)).toBe(true);
  });
  it('태블릿(기기 픽셀 배율) dpr 3 ×1: 캔버스가 CSS의 3배 → 상한 2 안으로 (도트 = 기기 픽셀 정수배)', () => {
    expect(ratio(canvasScale(1, true, 3))).toBeCloseTo(3);
    const s = canvasScale(1, true, 3, 2);
    expect(ratio(s)).toBeLessThanOrEqual(2);
    expect(s * 3).toBe(2);
    expect(canvasScale(2, true, 3, 2)).toBeCloseTo(2 / 3);
    expect(canvasScale(1, true, 1, 2)).toBe(1);
  });
});
