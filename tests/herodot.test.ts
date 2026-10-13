// HERODOT 1단계: heroDotV2 꺼짐이면 기사·사제·도적 도트가 지금과 한 픽셀도 다르지 않다 (바꾸기 전에 잰 해시)
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { CLASSES, type ClassDef } from '../src/data/classes';
import { setFlag } from '../src/world/flags';

/** 픽셀을 기억하는 가짜 2D 컨텍스트 (fillRect만 쓰므로 그것만) */
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

const VARIANTS = (k: 'knight' | 'cleric' | 'rogue'): ClassDef[] => {
  const b = CLASSES[k];
  return [
    b,
    { ...b, elf: true, hair: '#e8a0c8', weaponColor: '#6fb0ff' },
    { ...b, dwarf: true, beard: '#3a2a3a', hair: '#3a2a3a', weapon: 'axe', face: { ...b.face, eyes: 'round', glasses: true } },
    { ...b, skin: '#d99a6c', towel: '#ffffff', weapon: 'book', weaponColor: '#ffd36b' },
    { ...b, weapon: 'staff', face: { eyes: 'happy', mouth: 'grin', blush: true } },
    { ...b, weapon: 'bow', style: 'long' },
  ];
};

async function hashOf(k: 'knight' | 'cleric' | 'rogue') {
  const { buildFrom } = await import('../src/engine/sprites');
  const h = createHash('sha256');
  for (const d of VARIANTS(k)) {
    const f = buildFrom(d);
    const c = f.cb();
    const all = [f.idle, f.walk, f.walkB, f.idleB, f.sit, f.atk, f.pray, f.sleep, c.idle, c.idleB, c.walk, c.walkB, c.atk, c.roll, c.cast, c.hurt, c.die].flat();
    for (const cv of all) expect((PIX.get(cv) ?? []).some(Boolean)).toBe(true);
    for (const cv of all) h.update(`${cv.width}x${cv.height}:` + (PIX.get(cv) ?? []).join(','));
  }
  return h.digest('hex').slice(0, 16);
}

describe('HERODOT heroDotV2 꺼짐 = 예전 그대로', () => {
  it('기사·사제·도적 프레임 해시가 바꾸기 전과 같다', async () => {
    setFlag('heroDotV2' as never, false);
    const got = { knight: await hashOf('knight'), cleric: await hashOf('cleric'), rogue: await hashOf('rogue') };
    expect(got).toEqual(BEFORE);
  });
});

const framesOf = async (d: ClassDef) => {
  const { buildFrom } = await import('../src/engine/sprites');
  const f = buildFrom(d);
  const c = f.cb();
  return { f, c, all: [f.idle, f.walk, f.walkB, f.idleB, f.sit, f.atk, f.pray, f.sleep, c.idle, c.idleB, c.walk, c.walkB, c.atk, c.roll, c.cast, c.hurt, c.die] };
};
const dump = (cvs: HTMLCanvasElement[][]) => cvs.flat().map((cv) => `${cv.width}x${cv.height}:` + (PIX.get(cv) ?? []).join(',')).join('|');

describe('HERODOT heroDotV2 켬', () => {
  it('다른 직업(마법사·전사·사냥꾼·노주인·우체부·나)은 켜도 그대로', async () => {
    for (const k of ['mage', 'dwarf', 'hunter', 'keeper', 'post', 'hero'] as const) {
      setFlag('heroDotV2' as never, false);
      const off = dump((await framesOf(CLASSES[k])).all);
      setFlag('heroDotV2' as never, true);
      const on = await framesOf(CLASSES[k]);
      expect(dump(on.all)).toBe(off);
      expect(on.f.blink).toBeUndefined();
    }
    setFlag('heroDotV2' as never, false);
  });
  it('기사·사제·도적은 새 모양 · 캔버스 크기와 프레임 수는 그대로 · 깜빡임 1프레임', async () => {
    for (const k of ['knight', 'cleric', 'rogue'] as const)
      for (const d of VARIANTS(k)) {
        setFlag('heroDotV2' as never, false);
        const a = await framesOf(d);
        setFlag('heroDotV2' as never, true);
        const b = await framesOf(d);
        expect(b.all.map((x) => x.length)).toEqual(a.all.map((x) => x.length));
        expect(b.all.flat().map((x) => `${x.width}x${x.height}`)).toEqual(a.all.flat().map((x) => `${x.width}x${x.height}`));
        expect(dump(b.all)).not.toBe(dump(a.all));
        expect(b.f.blink?.width).toBe(24);
        expect(b.c.blink?.height).toBe(33);
        // 순검정 외곽선 없음
        expect(b.all.flat().some((cv) => (PIX.get(cv) ?? []).includes('#000000'))).toBe(false);
      }
    setFlag('heroDotV2' as never, false);
  });
  it('놀러 온 개척자(EASTER 고정 모습)는 켜도 예전 그림', async () => {
    const { CAMEO_DEF } = await import('../src/world/easter');
    for (const c of Object.values(CAMEO_DEF)) {
      const d = { ...CLASSES.knight, ...c } as ClassDef;
      setFlag('heroDotV2' as never, false);
      const off = dump((await framesOf(d)).all);
      setFlag('heroDotV2' as never, true);
      expect(dump((await framesOf(d)).all)).toBe(off);
    }
    setFlag('heroDotV2' as never, false);
  });
});

const BEFORE ={ knight: 'b703f086838d1fa5', cleric: '4bb8d42d2698ad20', rogue: '7104d9090fe97940' };
