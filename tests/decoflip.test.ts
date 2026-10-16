// 10/17 decoFlip (이카몰리 건의): 장식 좌우 반전 — 정사각형 아닌 장식은 발판 가로·세로가 바뀜 · 자리 없으면 막힘 · 글자 있는 장식은 안 됨
import { beforeEach, describe, expect, it } from 'vitest';
import { def, type Kind } from '../src/data/catalog';
import { addObj, footFor, placeLayout, rebuildPaths, startTown } from '../src/world/town';
import { flipGroup, undo } from '../src/world/decor';
import { setFlag } from '../src/world/flags';
import { P, S, world } from '../src/world/state';

beforeEach(() => {
  S.visiting = false as never;
  S.land = 10;
  startTown();
  world.actors = [];
  P.decor = { autoPath: true, paint: {}, store: [], recent: [], hintSeen: false, round: {}, noPath: {}, seen: [], owned: [], bookGot: [], entX: null, dgHome: null };
  setFlag('decoFlip', true);
  rebuildPaths();
});
const K = (k: string) => k as Kind;

describe('decoFlip', () => {
  it('발판: 2×1 장식은 반전하면 1×2 · 정사각형·건물은 그대로 · 플래그 끄면 그대로', () => {
    expect(footFor(K('market_tent'), 1, false)).toEqual([2, 1]);
    expect(footFor(K('market_tent'), 1, true)).toEqual([1, 2]);
    expect(footFor(K('coin_fountain'), 1, true)).toEqual([2, 2]);
    expect(footFor(K('town_hall'), 1, true)).toEqual(def(K('town_hall')).deco ? [3, 2] : [2, 3]);
    setFlag('decoFlip', false);
    expect(footFor(K('market_tent'), 1, true)).toEqual([2, 1]);
  });
  it('놓기·불러오기(배치표)도 반전 발판으로', () => {
    const o = addObj(K('wood_pier'), 30, 30, { flip: true });
    expect([o.fw, o.fh]).toEqual([1, 2]);
    // 반전 부두(1×2) 바로 오른쪽 칸(31,30)에 장식이 있어도 겹치지 않는다
    world.objs = [];
    const r = placeLayout(
      [
        { kind: K('inn'), tx: 18, ty: 15, lvl: 1, hue: null },
        { kind: K('wood_pier'), tx: 30, ty: 30, lvl: 1, hue: null, flip: true },
        { kind: K('crate_pile'), tx: 31, ty: 30, lvl: 1, hue: null },
      ],
      10,
    );
    expect(r.moved).toBe(0);
    const pier = world.objs.find((x) => x.kind === 'wood_pier')!;
    expect([pier.tx, pier.ty, pier.fw, pier.fh]).toEqual([30, 30, 1, 2]);
  });
  it('여러 개 뒤집기: 자리가 막히면 「공간이 부족해요」 · 되면 발판까지 · 되돌리기', () => {
    const tent = addObj(K('market_tent'), 30, 30);
    const block = addObj(K('crate_pile'), 30, 31);
    rebuildPaths();
    expect(flipGroup([tent])).toBe('공간이 부족해요');
    expect([tent.flip, tent.fw, tent.fh]).toEqual([undefined, 2, 1]);
    world.objs = world.objs.filter((x) => x !== block);
    rebuildPaths();
    expect(flipGroup([tent])).toBeNull();
    expect([tent.flip, tent.fw, tent.fh]).toEqual([true, 1, 2]);
    undo();
    expect([!!tent.flip, tent.fw, tent.fh]).toEqual([false, 2, 1]);
  });
  it('글자 있는 장식은 뒤집지 않는다', () => {
    for (const k of ['plaque_gold', 'gold_sign', 'board', 'shop_sign', 'shop_board', 'monument']) expect(def(K(k)).noFlip, k).toBe(true);
    const s = addObj(K('shop_board'), 30, 30);
    expect(flipGroup([s])).toBe('글자가 있는 장식은 뒤집을 수 없어요');
    expect(s.flip).toBeFalsy();
  });
});
