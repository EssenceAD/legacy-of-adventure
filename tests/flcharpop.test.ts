// FIRSTLOOK §6 캐릭터가 눈에 띄게 (flCharPop): 그림자 +알파 · 바깥 외곽선 = 팔레트 0번(바깥 칸만) · 걷는 동안만 통통 · 끄면 그대로
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CLASSES } from '../src/data/classes';
import { CONFIG } from '../src/data/config';
import { MASTER_PALETTE } from '../src/data/palette';
import { FLAG_DEFAULTS, setFlag } from '../src/world/flags';
import { popOutline, shadowGap, walkBob } from '../src/world/charPop';
import { Grid, outsideOf } from '../src/engine/pixel';

/** 픽셀을 기억하는 가짜 2D 컨텍스트 (fillRect · globalAlpha만) */
const PIX = new WeakMap<HTMLCanvasElement, string[]>();
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    let px = PIX.get(this);
    if (!px || px.length !== this.width * this.height) PIX.set(this, (px = Array(this.width * this.height).fill('')));
    const cv = this;
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      imageSmoothingEnabled: false,
      fillRect(x: number, y: number, w: number, h: number) {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < cv.width && j < cv.height) px![j * cv.width + i] = String(ctx.fillStyle);
      },
    };
    return ctx;
  } as never;
});
afterEach(() => {
  setFlag('flCharPop', false);
  setFlag('heroDotV2' as never, false);
});
const P0 = MASTER_PALETTE[0];

/** 바깥 고리 = 바깥 빈칸(가장자리에서 이어진 빈칸)과 4방향으로 닿은 칠한 칸 */
function outerRing(cv: HTMLCanvasElement) {
  const px = PIX.get(cv)!;
  const W = cv.width;
  const H = cv.height;
  const out = outsideOf(W, H, (x, y) => !!px[y * W + x]);
  const ring: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!px[y * W + x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const X = x + dx, Y = y + dy;
        return X < 0 || Y < 0 || X >= W || Y >= H || out[Y * W + X];
      })) ring.push(y * W + x);
    }
  return ring;
}

describe('FIRSTLOOK §6 flCharPop', () => {
  it('기본 꺼짐 · 꺼지면 그림자 빈칸 0 · 외곽선 없음 · 통통 0', () => {
    expect(FLAG_DEFAULTS.flCharPop).toBe(false);
    expect(shadowGap()).toBe(0);
    expect(popOutline()).toBeNull();
    for (let f = 0; f < 4; f++) expect(walkBob(true, f)).toBe(0);
  });

  it('그림자: 켜면 안쪽 평균 진하기 +shadowAdd · 꺼지면 예전 칸·색 그대로 · globalAlpha 되돌림', async () => {
    const { dotShadow } = await import('../src/combat/draw');
    const rec = (gap: number) => {
      const fills: { x: number; y: number; c: string; a: number }[] = [];
      const ctx = { fillStyle: '', globalAlpha: 0.8, fillRect(x: number, y: number) { fills.push({ x, y, c: String(ctx.fillStyle), a: ctx.globalAlpha }); } };
      dotShadow(ctx as never, 0, 0, 6, 2, gap);
      expect(ctx.globalAlpha).toBe(0.8);
      return fills;
    };
    const off = rec(0);
    expect(rec(shadowGap(false))).toEqual(off);
    setFlag('flCharPop', true);
    const on = rec(shadowGap());
    // 예전 칸은 그대로 진하게 (같은 자리 · 같은 색 · 같은 알파)
    for (const f of off) expect(on).toContainEqual(f);
    // 안쪽(#1c1424) 칸 평균 알파: 예전 대비 +0.15 (전체 알파 0.8 기준)
    const core = (l: typeof on) => l.filter((f) => f.c === '#1c1424');
    const cells = core(on).length;
    const mean = (l: typeof on) => core(l).reduce((s, f) => s + f.a, 0) / cells / 0.8;
    expect(mean(on) - mean(off)).toBeGreaterThan(CONFIG.firstLook.pop.shadowAdd - 0.03);
    expect(mean(on) - mean(off)).toBeLessThan(CONFIG.firstLook.pop.shadowAdd + 0.03);
  });

  it('외곽선: Grid — 바깥 고리만 한 색 · 안쪽 구멍 외곽선은 예전 부위색', () => {
    const mk = () => {
      const G = Grid(12, 12);
      G.rect(2, 2, 8, 8, '#c24736');
      G.rect(5, 5, 2, 2, '#c24736');
      for (let y = 4; y <= 7; y++) for (let x = 4; x <= 7; x++) G.clear(x, y); // 가운데 구멍 4×4
      return G;
    };
    const a = PIX.get(mk().render())!;
    const b = PIX.get(mk().render({ outer: P0 }))!;
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 12; x++) {
        const i = y * 12 + x;
        const ring = (x === 1 || x === 10) && y >= 2 && y <= 9 || (y === 1 || y === 10) && x >= 2 && x <= 9;
        if (ring) expect(b[i], `${x},${y}`).toBe(P0);
        else expect(b[i], `${x},${y}`).toBe(a[i]);
      }
    // 구멍 안 외곽선은 있고 팔레트 0이 아니다
    expect(b[4 * 12 + 4]).not.toBe('');
    expect(b[4 * 12 + 4]).not.toBe(P0);
  });

  for (const dot2 of [false, true])
    it(`외곽선: 마을 도트(${dot2 ? '새 도트' : '예전 도트'}) — 바깥 고리 전부 팔레트 0 · 바뀐 칸은 바깥 고리뿐 · 크기 그대로 · 전투 프레임 그대로`, async () => {
      setFlag('heroDotV2' as never, dot2);
      const { buildFrom } = await import('../src/engine/sprites');
      for (const k of ['knight', 'cleric', 'rogue', 'mage', 'post'] as const) {
        const off = buildFrom(CLASSES[k]);
        setFlag('flCharPop', true);
        const on = buildFrom(CLASSES[k]);
        setFlag('flCharPop', false);
        const pairs = (['idle', 'walk', 'walkB', 'idleB', 'sit', 'atk', 'pray', 'sleep'] as const).flatMap((n) => on[n].map((cv, i) => [cv, off[n][i], n] as const));
        for (const [cvOn, cvOff, n] of pairs) {
          expect([cvOn.width, cvOn.height]).toEqual([cvOff.width, cvOff.height]);
          const A = PIX.get(cvOn)!;
          const B = PIX.get(cvOff)!;
          const ring = new Set(outerRing(cvOn));
          // 'fx'(빛 궤적)는 외곽선 위에 그대로 덮일 수 있다 → 끈 그림에서도 같은 칸이면 넘어감
          for (const i of ring) if (A[i] !== B[i] || B[i] === P0) expect(A[i]).toBe(P0);
          // 바깥 = 가장자리에서 빈칸·팔레트 0 칸만 밟아 닿는 칸 (좁은 틈의 외곽선도 바깥) — 몸 안쪽·구멍은 못 닿는다
          const ext = outsideOf(cvOn.width, cvOn.height, (x, y) => !!A[y * cvOn.width + x] && A[y * cvOn.width + x] !== P0);
          let changed = 0;
          for (let i = 0; i < A.length; i++)
            if (A[i] !== B[i]) {
              changed++;
              // 휘두름·기도 빛('fx')은 외곽선 위에 덮여 그림에선 틈을 막을 수 있다 → 그 프레임은 색만 본다
              if (n !== 'atk' && n !== 'pray') expect(!!ext[i], `${k} ${n} ${i}`).toBe(true);
              expect(A[i]).toBe(P0);
            }
          expect(changed).toBeGreaterThan(0);
        }
        // 전투 프레임은 손대지 않음
        expect(on.cb().idle.map((c) => PIX.get(c)!.join())).toEqual(off.cb().idle.map((c) => PIX.get(c)!.join()));
      }
    });

  it('전설·신화 금빛·은빛 테두리(rim)는 켜도 그대로', async () => {
    const { appearance } = await import('../src/world/adventurers');
    const { buildFrom } = await import('../src/engine/sprites');
    setFlag('heroDotV2' as never, true);
    const a = { kind: 'rogue', race: 'human', hair: '#2a2030', face: undefined, legendId: 'nyx', equip: {}, stars: 1 } as never;
    const { def } = appearance(a);
    const dump = (f: ReturnType<typeof buildFrom>) => [...f.idle, ...f.walk, ...f.sleep].map((c) => PIX.get(c)!.join()).join('|');
    const off = dump(buildFrom(def));
    setFlag('flCharPop', true);
    expect(dump(buildFrom(def))).toBe(off);
  });

  it('캐시 열쇠에 플래그: 켜고 끄면 다른 그림 · 같은 상태면 같은 그림', async () => {
    const { framesFor } = await import('../src/engine/sprites');
    const off1 = framesFor('pop-test', CLASSES.knight);
    expect(framesFor('pop-test', CLASSES.knight)).toBe(off1);
    setFlag('flCharPop', true);
    const on1 = framesFor('pop-test', CLASSES.knight);
    expect(on1).not.toBe(off1);
    expect(framesFor('pop-test', CLASSES.knight)).toBe(on1);
    setFlag('flCharPop', false);
    expect(framesFor('pop-test', CLASSES.knight)).toBe(off1);
  });

  it('통통: 걷는 동안 발이 지나가는 프레임(1·3)만 bobPx 위로 · 서 있으면 0', () => {
    setFlag('flCharPop', true);
    const b = CONFIG.firstLook.pop.bobPx;
    expect([0, 1, 2, 3].map((f) => walkBob(true, f))).toEqual([0, -b, 0, -b]);
    expect([0, 1, 2, 3].map((f) => walkBob(false, f))).toEqual([0, 0, 0, 0]);
  });

  it('만드는 시간: 켜도 거의 같다 (바깥 칸 찾기 = 격자 한 번 훑기)', async () => {
    const { buildFrom } = await import('../src/engine/sprites');
    const defs = (['knight', 'cleric', 'rogue', 'mage', 'dwarf', 'hunter'] as const).map((k) => CLASSES[k]);
    const time = () => {
      const t = performance.now();
      for (let r = 0; r < 4; r++) for (const d of defs) buildFrom(d);
      return performance.now() - t;
    };
    time();
    const off = time();
    setFlag('flCharPop', true);
    time();
    const on = time();
    console.log(`[flCharPop] buildFrom ×24: off ${off.toFixed(1)}ms · on ${on.toFixed(1)}ms (${((on / off - 1) * 100).toFixed(1)}%)`);
    expect(on).toBeLessThan(off * 1.6 + 20);
  });
});
