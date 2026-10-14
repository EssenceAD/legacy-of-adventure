// FIVESTARS ④ 다섯 별 도트: 다섯 키가 모두 있고 · 양손 대검 모양이 그려지고 · 궤적 색이 명세대로 · fiveStars 꺼짐이면 예전 겉모습 그대로
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { STAR_IDS, STARS } from '../src/data/fivestars';
import { CLASSES } from '../src/data/classes';
import { NAMED } from '../src/engine/named2';
import { greatsword, starKey, starTrailColor, STAR_LOOKS } from '../src/engine/stars2';
import { Grid } from '../src/engine/pixel';
import { appearance } from '../src/world/adventurers';
import { makeStar } from '../src/world/fivestars';
import { setFlag } from '../src/world/flags';

/** 픽셀을 기억하는 가짜 2D 컨텍스트 (herodot.test와 같은 방식) */
const PIX = new WeakMap<HTMLCanvasElement, string[]>();
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    let px = PIX.get(this);
    if (!px || px.length !== this.width * this.height) PIX.set(this, (px = Array(this.width * this.height).fill('')));
    const cv = this;
    const ctx = {
      fillStyle: '',
      imageSmoothingEnabled: false,
      fillRect(x: number, y: number, w: number, h: number) {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < cv.width && j < cv.height) px![j * cv.width + i] = String(ctx.fillStyle);
      },
    };
    return ctx;
  } as never;
});
afterEach(() => {
  setFlag('fiveStars' as never, false);
  setFlag('heroDotV2' as never, false);
});

describe('FIVESTARS ④ 다섯 별 도트', () => {
  it('다섯 starId 모두 도트 열쇠(NAMED star_<id>)가 있고 신화 단계(전설 크기 · 대기 동작 ≤4장 · 궤적)', () => {
    for (const id of STAR_IDS) {
      const L = NAMED[starKey(id)];
      expect(L, id).toBeTruthy();
      expect(L).toBe(STAR_LOOKS[starKey(id)]);
      expect(L.star).toBe(id);
      expect(L.tier).toBe('legend');
      expect(L.sigN).toBeGreaterThan(0);
      expect(L.sigN).toBeLessThanOrEqual(4);
      expect(L.trail).toBe('star');
    }
  });

  it('공격 궤적 색 = 명세 (웅스 금빛 · 고느끼 분홍 · 이카몰리 하늘색 · 왈왈콩선생 흰빛 · 따뜻한밤 주황)', () => {
    const want = { woongs: '#ffd36b', gonu: '#f4a3be', ikamolly: '#8fc6e0', walwal: '#ffffff', warmnight: '#ffa040' };
    for (const id of STAR_IDS) expect(starTrailColor(id)).toBe(want[id]);
  });

  it('새 무기 모양 greatsword: 다섯 자세 모두 그려지고 · 웅스 무기 · 방패 없음', () => {
    for (const mode of ['rest', 'up', 'mid', 'fwd', 'low'] as const) {
      const G = Grid(26, 35, 2, 5);
      greatsword(G, { ...CLASSES.dwarf }, 16, 11, mode);
      expect(G.g.flat().filter(Boolean).length, mode).toBeGreaterThan(10);
    }
    expect(STARS.woongs.weapon).toBe('greatsword');
    expect(NAMED.star_woongs.patch.weapon).toBe('greatsword');
    expect(NAMED.star_woongs.patch.shield).not.toBe(true);
  });

  it('켜면 마을·전투 프레임(26×35 · 신화 · 대기 동작 · 공격 궤적 색 픽셀)', async () => {
    const { framesFor } = await import('../src/engine/sprites');
    setFlag('heroDotV2' as never, true);
    setFlag('fiveStars' as never, true);
    for (const id of STAR_IDS) {
      const a = makeStar(id, 3, 3);
      const { key, def } = appearance(a);
      expect(key).toContain('|S:' + id);
      expect(def.named).toBe('star_' + id);
      expect(def.weapon).toBe(STARS[id].weapon);
      const f = framesFor(key, def);
      expect(f.tier).toBe('mythic');
      expect(f.star).toBe(id);
      expect(f.idle[0].width).toBe(26);
      expect(f.idle[0].height).toBe(35);
      expect(f.sig?.length).toBe(4);
      // 휘두름(전투 공격 2번째 장)에 그 사람 궤적 색이 있다
      const atk = f.cb().atk[1];
      expect(PIX.get(atk)!.includes(STARS[id].trail), id).toBe(true);
    }
  });

  it('fiveStars 꺼짐 → 다섯 별도 예전 겉모습 그대로 (열쇠 · 정의 같음)', () => {
    setFlag('heroDotV2' as never, true);
    for (const id of STAR_IDS) {
      const a = makeStar(id, 3, 3);
      setFlag('fiveStars' as never, false);
      const off = appearance(a);
      expect(off.def.named).toBeUndefined();
      expect(off.key).not.toContain('|S:');
      expect(off.def.weapon).not.toBe('greatsword');
      const b = { ...a, starId: undefined };
      expect(appearance(b as never)).toEqual(off);
    }
  });
});

describe('FIVESTARS ④ R21 (형철 판정)', () => {
  it('고느끼 머리 +1 · 왈왈 로브 아랫단 양쪽 −1 · 이카몰리 금테 안경 · 웅스 긴 수건', () => {
    expect(NAMED.star_gonu.patch.headPlus).toBe(1);
    expect(NAMED.star_walwal.patch.robeTrim).toBe(1);
    expect(NAMED.star_ikamolly.patch.glassesColor).toBe('#c9a46a');
    expect(STARS.ikamolly.face.glasses).toBe(true);
    expect(NAMED.star_woongs.extras).toContain('longTowel');
  });
  it('따뜻한밤 등불 빛 가운데 밝기 = 예전 × 1.4', async () => {
    const { LANTERN_A } = await import('../src/world/render');
    expect(LANTERN_A).toBeCloseTo(0.32 * 1.4);
  }, 30000);
});
