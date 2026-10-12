// BUILDUX: 보관함(넣어 두기·꺼내 놓기·팔기) · 되돌리기/다시 하기 20단계 · ㄱ자 길 · 채우기 · 자동 길 지우기(noPath) · 저장
import { beforeEach, describe, expect, it } from 'vitest';
import { addObj, landBounds, pathT, rebuildPaths, startTown } from '../src/world/town';
import { canRedo, canUndo, elbowTiles, fillTiles, paintMany, paintTile, beginStroke, endStroke, redo, undo, UNDO_MAX, isAutoPath } from '../src/world/decor';
import { putAway, refundStored, storeList, takeOut } from '../src/world/store';
import { P, S, world } from '../src/world/state';
import { readSave, writeSave } from '../src/save/save';
import { N } from '../src/engine/iso';

beforeEach(() => {
  S.visiting = false as never;
  S.land = 3;
  startTown();
  world.actors = [];
  P.decor = { autoPath: true, paint: {}, store: [], recent: [], hintSeen: false, round: {}, noPath: {} };
  while (canUndo()) undo();
  rebuildPaths();
});

describe('보관함', () => {
  it('넣어 두면 마을에서 빠지고 레벨·색·방향이 그대로 · 되돌리면 제자리', () => {
    const o = addObj('training', 2, 2, { lvl: 2, hue: 120, flip: true });
    const n0 = world.objs.length;
    expect(putAway([o])).toBe(1);
    expect(world.objs.length).toBe(n0 - 1);
    expect(storeList()[0]).toMatchObject({ kind: 'training', lvl: 2, hue: 120, flip: true });
    undo();
    const back = world.objs.find((x) => x.kind === 'training' && x.tx === 2 && x.ty === 2);
    expect(back?.lvl).toBe(2);
    expect(storeList().length).toBe(0);
    redo();
    expect(storeList().length).toBe(1);
  });
  it('꺼내 놓기는 무료 · 팔기는 환불', () => {
    const o = addObj('training', 2, 2, { lvl: 1, builtAt: Date.now() - 3_600_000 });
    putAway([o]);
    const g = S.gold;
    const b = takeOut(storeList()[0], 3, 3);
    expect(b?.tx).toBe(3);
    expect(S.gold).toBe(g);
    putAway([b!]);
    const got = refundStored(storeList()[0]);
    expect(got).toBe(Math.floor(350 * 0.5));
    expect(S.gold).toBe(g + got);
    expect(storeList().length).toBe(0);
  });
  it('여관 본관은 넣어 둘 수 없음', () => {
    const inn = world.objs.find((x) => x.kind === 'inn')!;
    expect(putAway([inn])).toBe(0);
  });
  it('저장 → 다시 읽어도 보관함이 남는다', () => {
    S.innName = '시험 여관';
    putAway([addObj('training', 2, 2)]);
    writeSave();
    expect(readSave()?.progress.decor.store.length).toBe(1);
  });
});

describe('되돌리기', () => {
  it(`${UNDO_MAX}단계까지 · 다시 하기`, () => {
    const [a] = landBounds();
    for (let i = 0; i < UNDO_MAX + 5; i++) paintMany([[a + (i % 8), a + Math.floor(i / 8)]], 'stone');
    let n = 0;
    while (canUndo()) (undo(), n++);
    expect(n).toBe(UNDO_MAX);
    expect(canRedo()).toBe(true);
    redo();
    expect(Object.keys(P.decor.paint).length).toBe(6);
  });
  it('새 동작을 하면 다시 하기는 비워진다', () => {
    const [a] = landBounds();
    paintMany([[a, a]], 'stone');
    undo();
    paintMany([[a + 1, a]], 'dirt');
    expect(canRedo()).toBe(false);
  });
});

describe('길', () => {
  it('ㄱ자: 가로 먼저, 그다음 세로 · 칸 수 = |dx|+|dy|+1', () => {
    const t = elbowTiles([2, 2], [5, 4]);
    expect(t[0]).toEqual([2, 2]);
    expect(t[3]).toEqual([5, 2]);
    expect(t[t.length - 1]).toEqual([5, 4]);
    expect(t.length).toBe(6);
    expect(elbowTiles([3, 3], [3, 3])).toEqual([[3, 3]]);
  });
  it('채우기: 닫힌 영역만 · 너무 넓으면 null', () => {
    const [a] = landBounds();
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (i === 0 || j === 0 || i === 4 || j === 4) P.decor.paint[`${a + 1 + i},${a + 1 + j}`] = 'gravel';
    const inner = fillTiles(a + 3, a + 3);
    expect(inner?.length).toBeLessThanOrEqual(9);
    S.land = 5;
    expect(fillTiles(a + 12, a + 12) === null || (fillTiles(a + 12, a + 12) ?? []).length <= 400).toBe(true);
  });
  it('자동 길 칸을 지우면 기억 → 다시 깔아도 안 생김 · 되돌리면 다시', () => {
    rebuildPaths();
    const k = [...pathT].find((v) => isAutoPath(v % N, Math.floor(v / N)));
    expect(k).toBeDefined();
    const [x, y] = [k! % N, Math.floor(k! / N)];
    beginStroke(null);
    expect(paintTile(x, y, null)).toBe(true);
    endStroke();
    expect(P.decor.noPath[`${x},${y}`]).toBe(1);
    rebuildPaths();
    expect(pathT.has(k!)).toBe(false);
    undo();
    expect(P.decor.noPath[`${x},${y}`]).toBeUndefined();
    expect(pathT.has(k!)).toBe(true);
  });
  it('지운 칸에 길을 칠하면 기억은 풀린다', () => {
    const [a] = landBounds();
    P.decor.noPath[`${a + 2},${a + 2}`] = 1;
    paintTile(a + 2, a + 2, 'stone');
    expect(P.decor.noPath[`${a + 2},${a + 2}`]).toBeUndefined();
  });
});
