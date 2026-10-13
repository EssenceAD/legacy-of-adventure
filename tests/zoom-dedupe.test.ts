// v0.24.4 zoomDedupe: 줌 목록의 배율은 화면에서 모두 다른 크기 (dpr 2.6에서 ×1 = ×2이던 문제)
import { afterEach, describe, expect, it } from 'vitest';
import { setFlag } from '../src/world/flags';
import { snapZoom, zoomList, zoomSC, type SizeClass } from '../src/ui/screen';

afterEach(() => setFlag('zoomDedupe', true));

describe('줌 목록 = 서로 다른 크기', () => {
  for (const dpr of [1, 2, 2.6, 3])
    for (const size of ['phone', 'wide'] as SizeClass[])
      for (const saver of [false, true])
        it(`dpr ${dpr} · ${size} · 절약 ${saver ? '켬' : '끔'}`, () => {
          const zs = zoomList(size, dpr, saver);
          const scs = zs.map((z) => zoomSC(z, size, dpr, saver));
          expect(zs.length).toBeGreaterThanOrEqual(2);
          expect(new Set(scs.map((v) => v.toFixed(6))).size).toBe(zs.length);
          // 커질수록 크기도 커진다
          for (let i = 1; i < scs.length; i++) expect(scs[i]).toBeGreaterThan(scs[i - 1]);
        });
  it('웅스(dpr 2.6 넓은 화면): ×1과 ×2가 같은 크기라 하나만', () => {
    expect(zoomSC(1, 'wide', 2.6, false)).toBeCloseTo(zoomSC(2, 'wide', 2.6, false));
    expect(zoomList('wide', 2.6, false)).toEqual([2, 3, 4]);
  });
  it('dpr 2 + 절약: ×0.5 = ×1 → 하나만', () => {
    expect(zoomList('phone', 2, true)).toEqual([1, 2, 3]);
  });
  it('걸러진 배율은 같은 크기 배율로 붙는다', () => {
    expect(snapZoom(1, [2, 3, 4])).toBeDefined();
  });
  it('플래그 끄면 예전 목록', () => {
    setFlag('zoomDedupe', false);
    expect(zoomList('wide', 2.6, false)).toEqual([1, 2, 3, 4]);
  });
});
