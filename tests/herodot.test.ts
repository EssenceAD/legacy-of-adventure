// HERODOT 1단계: heroDotV2 꺼짐이면 기사·사제·도적 도트가 지금과 한 픽셀도 다르지 않다 (바꾸기 전에 잰 해시)
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { CLASSES, type ClassDef, type ClassKey } from '../src/data/classes';
import { ownerLook } from '../src/data/origins';
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

const ALL: ClassKey[] = ['knight', 'cleric', 'rogue', 'mage', 'dwarf', 'hunter', 'keeper', 'post', 'hero'];
const JOBS = ['knight', 'warrior', 'rogue', 'mage', 'priest', 'hunter'] as const;
const OWNERS = (): ClassDef[] => JOBS.flatMap((j) => [ownerLook(j, 'm'), ownerLook(j, 'f')]);
const VARIANTS = (k: ClassKey | 'owner'): ClassDef[] => {
  if (k === 'owner') return OWNERS();
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

async function hashOf(k: ClassKey | 'owner') {
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
  it('9직업 + 주인(나) 겉모습 프레임 해시가 바꾸기 전과 같다', async () => {
    setFlag('heroDotV2' as never, false);
    const got: Record<string, string> = {};
    for (const k of [...ALL, 'owner' as const]) got[k] = await hashOf(k);
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
  it('새 도트 표시(dot2)가 없는 겉모습(마을 사람·구경꾼 등)은 켜도 그대로', async () => {
    for (const k of ALL) {
      const d = { ...CLASSES[k], dot2: undefined };
      setFlag('heroDotV2' as never, false);
      const off = dump((await framesOf(d)).all);
      setFlag('heroDotV2' as never, true);
      const on = await framesOf(d);
      expect(dump(on.all)).toBe(off);
      expect(on.f.blink).toBeUndefined();
    }
    setFlag('heroDotV2' as never, false);
  });
  it('9직업 + 주인 겉모습은 새 모양 · 캔버스 크기와 프레임 수는 그대로 · 깜빡임 1프레임', async () => {
    for (const k of [...ALL, 'owner' as const])
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

const BEFORE: Record<string, string> = { knight: 'b703f086838d1fa5', cleric: '4bb8d42d2698ad20', rogue: '7104d9090fe97940', mage: '91b2669581fb93f2', dwarf: 'f66f6cbe5a6fcf48', hunter: 'b04b406be0c62932', keeper: 'abe132f9ea146602', post: '52913e05621bb701', hero: '567fc3d6be87c8e1', owner: 'f680cab19f283f25' };

// ───────── 3단계: 전설 14 · 이름 있는 영웅 10 (appearance()와 같은 방식으로 만든 겉모습) ─────────
const namedDefs = async (): Promise<[string, ClassDef][]> => {
  const { LEGENDS } = await import('../src/data/legends');
  const { HEROES } = await import('../src/data/heroes');
  const mk = (kind: ClassKey, race: string, hair: string, named: string, mythic = false): ClassDef => {
    const b = CLASSES[kind];
    return { ...b, face: { ...b.face }, elf: race === 'elf', dwarf: race === 'dwarf' || race === 'halfling', beard: race === 'dwarf' ? hair : undefined, hair, named, mythic } as ClassDef;
  };
  return [
    ...LEGENDS.map((l) => [l.key, mk(l.kind, l.race, l.hair, l.key)] as [string, ClassDef]),
    ...LEGENDS.map((l) => ['M:' + l.key, mk(l.kind, l.race, l.hair, l.key, true)] as [string, ClassDef]),
    ...HEROES.map((h) => [h.id, mk(h.kind, h.race, h.hair, h.id)] as [string, ClassDef]),
  ];
};
describe('HERODOT 3단계 · 꺼짐 = 예전 그대로', () => {
  it('전설·신화·영웅 겉모습 해시가 바꾸기 전과 같다', async () => {
    setFlag('heroDotV2' as never, false);
    const h = createHash('sha256');
    const n = await namedDefs();
    expect(n.length).toBe(38);
    for (const [k, d] of n) h.update(k + '=' + dump((await framesOf(d)).all));
    expect(h.digest('hex').slice(0, 16)).toBe(NAMED_BEFORE);
  });
});
const NAMED_BEFORE = '04bb88a9bacd5428';

describe('HERODOT 3단계 · 켬', () => {
  /** 가장 아래 칠한 줄 (발바닥 외곽선) · 몸 가운데 칸 */
  const foot = (cv: HTMLCanvasElement) => {
    const px = PIX.get(cv) ?? [];
    let low = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (px[y * cv.width + x]) low = y;
    return low;
  };
  it('전설은 26×35 · 영웅은 24×33 · 시그니처 동작 1~4장 · 발 위치(화면)는 일반과 같다', async () => {
    setFlag('heroDotV2' as never, true);
    // 마을 drawActor: y = Y - 32 - (h - 33) → 발 줄 = foot - (h - 33)
    const footScreen = (cv: HTMLCanvasElement) => foot(cv) - (cv.height - 33);
    for (const [k, d] of await namedDefs()) {
      const { f, c } = await framesOf(d);
      // 같은 겉모습의 일반 손님(이름 표시 없음)과 발 줄이 같아야 한다
      const base = (await framesOf({ ...d, named: undefined, mythic: undefined })).f.idle[0];
      const legend = !(await import('../src/engine/named2')).NAMED[d.named!]?.tier.startsWith('h');
      for (const [n, cv] of [...f.idle, ...f.walk, ...f.walkB, ...f.idleB, ...f.atk, ...c.idle, ...c.atk, ...c.cast, ...c.hurt].entries()) {
        expect([cv.width, cv.height]).toEqual(legend ? [26, 35] : [24, 33]);
        expect(footScreen(cv), k + "#" + n).toBe(footScreen(base));
      }
      expect(f.sig!.length).toBeGreaterThan(0);
      expect(f.sig!.length).toBeLessThanOrEqual(4);
      expect(f.tier).toBe(legend ? (k.startsWith('M:') ? 'mythic' : 'legend') : 'hero');
      // 순검정 없음
      expect([...f.idle, ...f.sig!].some((cv) => (PIX.get(cv) ?? []).includes('#000000'))).toBe(false);
    }
    setFlag('heroDotV2' as never, false);
  });
  it('appearance(): 켜면 전설·영웅 표시 + 열쇠에 이름 · 끄면 예전 열쇠 그대로', async () => {
    const { appearance } = await import('../src/world/adventurers');
    const a = { kind: 'rogue', race: 'human', hair: '#2a2030', face: undefined, legendId: 'nyx', equip: {}, stars: 1 } as never;
    setFlag('heroDotV2' as never, false);
    const off = appearance(a);
    expect(off.def.named).toBeUndefined();
    expect(off.key).not.toContain('N:');
    setFlag('heroDotV2' as never, true);
    const on = appearance(a);
    expect(on.def.named).toBe('nyx');
    expect(on.key).toBe(off.key + '|N:nyx');
    setFlag('heroDotV2' as never, false);
  });
});
