// FEEDBACK23: §3 던전 자동 길 지우기 · §4 던전 입구 옮기기 · §5 마을 입구 옮기기
import { beforeEach, describe, expect, it } from 'vitest';
import { addObj, autoEntranceX, canMoveKind, canPlace, doorOf, dungeonHome, entrance, findKind, inLand, landBounds, outsideOk, pathT, rebuildPaths, startTown } from '../src/world/town';
import { beginStroke, canUndo, endStroke, entranceWhy, gateOnEntrance, isAutoPath, moveEntrance, paintTile, redo, rememberDungeonHome, undo } from '../src/world/decor';
import { gradeProps, propKey } from '../src/world/grade';
import { P, S, world } from '../src/world/state';
import { readSave, writeSave } from '../src/save/save';
import { N } from '../src/engine/iso';
import { CONFIG } from '../src/data/config';

beforeEach(() => {
  S.visiting = null;
  S.land = 3;
  S.innName = '시험 여관';
  startTown();
  world.actors = [];
  P.decor = { ...P.decor, autoPath: true, paint: {}, store: [], recent: [], hintSeen: false, round: {}, noPath: {}, entX: null, dgHome: null };
  while (canUndo()) undo();
  rebuildPaths();
});

const tiles = () => new Set(pathT);
/** 던전 문에서 여관 쪽으로 깔린 자동 길 칸 (문 가까운 순) */
function dungeonRoad(): [number, number][] {
  const dg = findKind('dungeon')!;
  const [dx, dy] = doorOf(dg);
  return [...pathT]
    .map((k) => [k % N, Math.floor(k / N)] as [number, number])
    .filter(([x, y]) => isAutoPath(x, y))
    .sort((a, b) => Math.hypot(a[0] - dx, a[1] - dy) - Math.hypot(b[0] - dx, b[1] - dy));
}
const erase = (x: number, y: number) => {
  beginStroke(null);
  const r = paintTile(x, y, null);
  endStroke();
  return r;
};

describe('§3 던전 자동 길 지우기', () => {
  it('던전 길 칸을 지우면 그 칸만 빠지고 돌아가는 새 길이 생기지 않는다 (땅 1단계 = 숲길이 김)', () => {
    S.land = 1;
    rebuildPaths();
    const road = dungeonRoad();
    expect(road.length).toBeGreaterThan(2);
    expect(road.some(([x, y]) => !inLand(x, y))).toBe(true);
    const before = tiles();
    const [x, y] = road[2];
    expect(erase(x, y)).toBe(true);
    expect(P.decor.noPath[`${x},${y}`]).toBe(1);
    const after = tiles();
    expect(after.has(y * N + x)).toBe(false);
    // 새로 생긴 칸 없음 (예전: 비용 8로 옆 칸에 우회 길이 깔려 「다시 생겨요」)
    expect([...after].filter((k) => !before.has(k))).toEqual([]);
    expect(before.size - after.size).toBe(1);
  });
  it('던전 숲길(땅 밖)을 전부 지워도 다시 깔리지 않는다 (다시 깔기·되돌리기 없이)', () => {
    S.land = 1;
    rebuildPaths();
    for (let i = 0; i < 40; i++) {
      const road = dungeonRoad().filter(([x, y]) => !inLand(x, y));
      if (!road.length) break;
      erase(road[0][0], road[0][1]);
    }
    rebuildPaths();
    expect(dungeonRoad().filter(([x, y]) => !inLand(x, y))).toEqual([]);
    // 되돌리기는 한 칸씩 되살린다
    undo();
    expect(dungeonRoad().filter(([x, y]) => !inLand(x, y)).length).toBe(1);
  });
  it('땅 안 자동 길(건물 → 여관)도 지운 칸 옆으로 새 길이 생기지 않는다', () => {
    const [a] = landBounds();
    addObj('training', a + 1, a + 1);
    rebuildPaths();
    const before = tiles();
    const inside = [...before].map((k) => [k % N, Math.floor(k / N)] as [number, number]).filter(([x, y]) => inLand(x, y) && isAutoPath(x, y));
    const [x, y] = inside[Math.floor(inside.length / 2)];
    erase(x, y);
    expect([...tiles()].filter((k) => !before.has(k))).toEqual([]);
  });
  it('설정값: 지운 칸 우회 비용은 config에 (0)', () => {
    expect(CONFIG.feedback23.noPathDetour).toBe(0);
  });
});

describe('§4 던전 입구 옮기기', () => {
  it('던전은 옮길 수 있다 (철거·보관은 여전히 막힘 = fixed 그대로)', () => {
    expect(canMoveKind('dungeon')).toBe(true);
    expect(canMoveKind('inn')).toBe(true);
  });
  it('땅 안 빈자리 OK · 여관 본관과 겹치면 · 땅 밖이면 안 됨', () => {
    const dg = findKind('dungeon')!;
    const [a] = landBounds();
    expect(canPlace({ kind: 'dungeon', tx: a + 1, ty: a + 1, fw: dg.fw, fh: dg.fh }, dg)).toBe(true);
    const inn = findKind('inn')!;
    expect(canPlace({ kind: 'dungeon', tx: inn.tx, ty: inn.ty, fw: dg.fw, fh: dg.fh }, dg)).toBe(false);
    expect(canPlace({ kind: 'dungeon', tx: a - 4, ty: a - 4, fw: dg.fw, fh: dg.fh }, dg)).toBe(false);
  });
  it('옮기면 자동 길이 새 자리로 따라가고, 숲속 원래 자리는 기억해 되돌릴 수 있다', () => {
    const dg = findKind('dungeon')!;
    const home: [number, number] = [dg.tx, dg.ty];
    const oldDoor = doorOf(dg);
    const [a] = landBounds();
    rememberDungeonHome(dg);
    expect(dungeonHome()).toEqual(home);
    Object.assign(dg, { tx: a + 1, ty: a + 1 });
    rebuildPaths();
    const [dx, dy] = doorOf(dg);
    expect(pathT.has(dy * N + dx)).toBe(true);
    expect(pathT.has(oldDoor[1] * N + oldDoor[0])).toBe(false);
    // 원래 숲속 자리 = 땅 밖이어도 OK (그 자리만)
    expect(outsideOk({ kind: 'dungeon', tx: home[0], ty: home[1] })).toBe(true);
    expect(canPlace({ kind: 'dungeon', tx: home[0], ty: home[1], fw: dg.fw, fh: dg.fh }, dg)).toBe(true);
    expect(canPlace({ kind: 'dungeon', tx: home[0] + 1, ty: home[1], fw: dg.fw, fh: dg.fh }, dg)).toBe(false);
    // 두 번째로 옮겨도 처음 자리를 덮어쓰지 않는다
    rememberDungeonHome(dg);
    expect(dungeonHome()).toEqual(home);
  });
  it('저장: 옮긴 자리·원래 자리가 그대로 남는다', () => {
    const dg = findKind('dungeon')!;
    const [a] = landBounds();
    rememberDungeonHome(dg);
    Object.assign(dg, { tx: a + 2, ty: a + 1 });
    writeSave();
    const d = readSave()!;
    expect(d.buildings.find((b) => b.kind === 'dungeon')).toMatchObject({ tx: a + 2, ty: a + 1 });
    expect(d.progress.decor.dgHome).toEqual([41, 30]); // LAND10: (29,18) + 12
  });
});

describe('§5 마을 입구 옮기기', () => {
  it('기본(옛 저장 = entX 없음)은 예전 그대로: 여관 문 줄 · 앞 가장자리', () => {
    const [, b] = landBounds();
    const inn = findKind('inn')!;
    expect(autoEntranceX()).toBe(doorOf(inn)[0]);
    const [ex, ey] = entrance();
    expect(ey).toBe(b - 1);
    expect(ex).toBe(doorOf(inn)[0]);
  });
  it('옮기면 입구 x가 바뀌고 손님 길(입구 → 여관)이 새 입구에서 시작 · 되돌리기/다시 하기', () => {
    const [a, b] = landBounds();
    const x = a + 1;
    expect(entranceWhy(x)).toBeNull();
    expect(moveEntrance(x)).toBeNull();
    expect(P.decor.entX).toBe(x);
    expect(entrance()).toEqual([x, b - 1]);
    expect(pathT.has((b - 1) * N + x)).toBe(true);
    undo();
    expect(P.decor.entX).toBeNull();
    expect(entrance()[0]).toBe(autoEntranceX());
    redo();
    expect(entrance()[0]).toBe(x);
  });
  it('앞 가장자리 밖 · 건물 위 · 연못 위는 안 됨', () => {
    const [a, b] = landBounds();
    expect(entranceWhy(a - 1)).toBeTruthy();
    expect(entranceWhy(b)).toBeTruthy();
    expect(entranceWhy(a + 1.5)).toBeTruthy();
    addObj('training', a + 3, b - 2);
    rebuildPaths();
    expect(entranceWhy(a + 3)).toMatch(/건물/);
    P.decor.paint[`${a + 6},${b - 1}`] = 'pond';
    expect(entranceWhy(a + 6)).toMatch(/연못/);
  });
  it('땅이 넓어지거나 좁아도 앞 가장자리 안으로 끼워 넣는다', () => {
    const [a, b] = landBounds();
    P.decor.entX = a;
    S.land = 5;
    rebuildPaths();
    expect(entrance()[0]).toBe(a);
    P.decor.entX = 2; // 지금 땅보다 왼쪽 (망가진 값)
    S.land = 3;
    rebuildPaths();
    const [ex, ey] = entrance();
    expect(ex).toBe(a);
    expect(ey).toBe(b - 1);
    P.decor.entX = 999;
    expect(entrance()[0]).toBe(b - 1);
  });
  it('입구 위 정문은 같이 옆으로 따라간다 · 따라갈 자리가 없으면 거절', () => {
    const [a, b] = landBounds();
    const [ex, ey] = entrance();
    const gate = addObj('gate', ex, ey - 1);
    rebuildPaths();
    expect(gateOnEntrance()).toBe(gate);
    const x = a + 2;
    expect(moveEntrance(x)).toBeNull();
    expect(gate.tx).toBe(x);
    expect(entrance()).toEqual([x, b - 1]);
    undo();
    expect(gate.tx).toBe(ex);
    // 정문이 따라갈 자리에 건물이 있으면 거절
    addObj('training', a + 1, b - 3);
    rebuildPaths();
    expect(entranceWhy(a + 1)).toMatch(/정문|건물/);
  });
  it('저장: entX가 남고, 옛 저장(entX 없음)은 null(자동)로 읽힌다', () => {
    const [a] = landBounds();
    moveEntrance(a + 1);
    writeSave();
    expect(readSave()!.progress.decor.entX).toBe(a + 1);
    const raw = JSON.parse(localStorage.getItem('legacy-of-adventure-save')!);
    delete raw.progress.decor.entX;
    delete raw.progress.decor.dgHome;
    localStorage.setItem('legacy-of-adventure-save', JSON.stringify(raw));
    const d = readSave()!;
    expect(d.progress.decor.entX).toBeNull();
    expect(d.progress.decor.dgHome).toBeNull();
  });
  it('등급 장식은 입구를 따라 옆으로 밀리지만 「옮겨 둔」 이름표는 그대로', () => {
    S.land = 5;
    rebuildPaths();
    const base = gradeProps(4);
    const lamp = base.find((p) => p.k === 'lamppost')!;
    const [ex0] = entrance();
    moveEntrance(ex0 - 3);
    const moved = gradeProps(4);
    const lamp2 = moved.find((p) => p.k === 'lamppost')!;
    expect(lamp2.x).toBe(lamp.x - 3);
    expect(propKey(lamp2)).toBe(propKey(lamp));
    P.harmony.moved = [propKey(lamp)];
    expect(gradeProps(4).filter((p) => p.k === 'lamppost').length).toBe(base.filter((p) => p.k === 'lamppost').length - 1);
    P.harmony.moved = [];
  });
  it('이웃 마을 모습: ent가 있으면 그 입구, 없으면 자동', async () => {
    const { toNeighbor } = await import('../src/ui/neighbors');
    const layout = [['inn', 26, 24, 1, null, false]];
    const v = toNeighbor({ user_id: 'u', likes: 0, updated_at: '', snapshot: { v: 4, land: 3, innName: 'x', owner: 'o', layout, ent: 30 } } as never)!;
    expect(v.ent).toBe(30);
    // LAND10: v3(맵 32) 입구는 배치와 같이 +12
    const v3 = toNeighbor({ user_id: 'u', likes: 0, updated_at: '', snapshot: { v: 3, land: 3, innName: 'x', owner: 'o', layout, ent: 18 } } as never)!;
    expect(v3.ent).toBe(30);
    expect(v3.layout[0].slice(1, 3)).toEqual([38, 36]);
    const w = toNeighbor({ user_id: 'u', likes: 0, updated_at: '', snapshot: { v: 3, land: 3, innName: 'x', owner: 'o', layout } } as never)!;
    expect(w.ent).toBeUndefined();
  }, 30000); // 동적 import(ui/neighbors) — 전체 테스트가 몰리면 5초를 넘겨 배포를 막던 것
});
