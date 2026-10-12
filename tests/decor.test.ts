// TOWN T2: 칠하기(길·바닥) · 연못은 못 걷고 못 짓는다 · 자동 길 끄기 · 무리 옮기기 · 되돌리기
import { beforeEach, describe, expect, it } from 'vitest';
import { beginStroke, decosIn, endStroke, moveGroup, paintTile, paintWhy, setAutoPath, undo } from '../src/world/decor';
import { resetProgress, P, S, world } from '../src/world/state';
import { addObj, canPlace, landBounds, pathT, rebuildPaths, startTown, walkable } from '../src/world/town';
import { N } from '../src/engine/iso';

beforeEach(() => {
  resetProgress();
  S.visiting = false as never;
  S.land = 5;
  startTown();
  rebuildPaths();
});
const free = (): [number, number] => {
  const [a, b] = landBounds();
  for (let y = b - 4; y > a; y--) for (let x = a + 1; x < b - 4; x++) if ([0, 1, 2, 3].every((i) => [0, 1, 2].every((j) => !world.objs.some((o) => x + i >= o.tx && x + i < o.tx + o.fw && y + j >= o.ty && y + j < o.ty + o.fh)))) return [x, y];
  throw new Error('no space');
};

describe('꾸미기', () => {
  it('길 붓: 칠한 길은 길(pathT) · 되돌리기 한 번에 붓질 한 번', () => {
    const [x, y] = free();
    beginStroke('brick');
    for (let i = 0; i < 4; i++) paintTile(x + i, y, 'brick');
    endStroke();
    expect(P.decor.paint[`${x + 3},${y}`]).toBe('brick');
    expect(pathT.has(y * N + x + 2)).toBe(true);
    undo();
    expect(P.decor.paint[`${x},${y}`]).toBeUndefined();
  });
  it('연못: 걸을 수 없고 그 위엔 못 짓는다 · 건물 칸엔 연못 못 만듦 · 울타리 밖은 못 칠함', () => {
    const [x, y] = free();
    paintTile(x, y, 'pond');
    expect(walkable(x, y)).toBe(false);
    expect(canPlace({ kind: 'well', tx: x, ty: y, fw: 1, fh: 1 })).toBe(false);
    const inn = world.objs.find((o) => o.kind === 'inn')!;
    expect(paintWhy(inn.tx, inn.ty, 'pond')).toBeTruthy();
    expect(paintWhy(-1, -1, 'stone')).toBeTruthy();
  });
  it('자동 길 끄기: 건물↔여관 길이 사라지고 칠한 길은 남는다 · 다시 켜면 그대로', () => {
    addObj('tavern', 3, 14);
    rebuildPaths();
    const n0 = pathT.size;
    const [x, y] = free();
    paintTile(x, y, 'stone');
    setAutoPath(false);
    expect(pathT.size).toBeLessThan(n0);
    expect(pathT.has(y * N + x)).toBe(true);
    setAutoPath(true);
    expect(pathT.size).toBeGreaterThanOrEqual(n0);
  });
  it('여러 장식 한 번에 옮기기 · 땅 밖으로는 못 옮김 · 되돌리기', () => {
    const [x, y] = free();
    const hs = [0, 1, 2].map((i) => addObj('hedge', x + i, y));
    rebuildPaths();
    const g = decosIn(x, y, x + 2, y);
    expect(g.length).toBe(3);
    expect(moveGroup(g, 0, 1)).toBeNull();
    expect(hs.every((o) => o.ty === y + 1)).toBe(true);
    expect(moveGroup(g, 0, 40)).toBeTruthy();
    undo();
    expect(hs.every((o) => o.ty === y)).toBe(true);
  });
});
