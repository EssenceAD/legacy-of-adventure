// 핫픽스 11 §9: 목록 순서 · 여관을 넓힌 뒤 손님이 건물 위로 걷지 않게
import { beforeEach, describe, expect, it } from 'vitest';
import { claimOrder } from '../src/ui/common';
import { makeAdventurer } from '../src/world/adventurers';
import { S, world, type Actor } from '../src/world/state';
import { astar, blockedAt, rebuildPaths, startTown, upgradeObj, walkable } from '../src/world/town';
import '../src/world/actors';

describe('목록 순서 (§9-1)', () => {
  it('받기 가능 → 진행 중(진행률 높은 순) → 받음, 같은 묶음은 원래 순서', () => {
    const items = [
      { id: 'a', ready: false, got: true, ratio: 1 },
      { id: 'b', ready: false, got: false, ratio: 0.2 },
      { id: 'c', ready: true, got: false, ratio: 1 },
      { id: 'd', ready: false, got: false, ratio: 0.8 },
      { id: 'e', ready: true, got: false, ratio: 1 },
      { id: 'f', ready: false, got: true, ratio: 1 },
    ];
    expect(claimOrder(items, (x) => x).map((x) => x.id)).toEqual(['c', 'e', 'd', 'b', 'a', 'f']);
  });
});

describe('여관 확장 뒤 손님 (§9-2)', () => {
  beforeEach(() => {
    if (!document.getElementById('over')) document.body.insertAdjacentHTML('beforeend', '<div id="over"></div>');
    S.visiting = false as never;
    S.land = 3;
    startTown();
    rebuildPaths();
    world.actors = [];
  });
  const inn = () => world.objs.find((o) => o.kind === 'inn')!;
  /** 레벨업으로 새로 생기는 발판 칸 (옛 발판 밖, 새 발판 안) */
  function grownCells(): [number, number][] {
    const o = inn();
    const old = { tx: o.tx, ty: o.ty, fw: o.fw, fh: o.fh };
    const nt = { tx: o.tx - 1, ty: o.ty - 1, fw: o.fw + 1, fh: o.fh + 1 };
    const out: [number, number][] = [];
    for (let y = nt.ty; y < nt.ty + nt.fh; y++)
      for (let x = nt.tx; x < nt.tx + nt.fw; x++) if (!(x >= old.tx && x < old.tx + old.fw && y >= old.ty && y < old.ty + old.fh)) out.push([x, y]);
    return out;
  }

  it('레벨업 직후 새 발판 안에 서 있는 손님 0명', () => {
    const cells = grownCells().filter(([x, y]) => walkable(x, y));
    expect(cells.length).toBeGreaterThan(0);
    world.actors = cells.map(([x, y]) => Object.assign(makeAdventurer(x, y, { status: 'visitor' }), { st: 'idle', hidden: false }) as Actor);
    // 레벨 2가 크기가 바뀌는 단계가 아니면 바뀔 때까지 올린다
    const before = inn().fw;
    for (let i = 0; i < 3 && inn().fw === before; i++) expect(upgradeObj(inn())).toBe(true);
    expect(inn().fw).toBeGreaterThan(before);
    rebuildPaths();
    const stuck = world.actors.filter((a) => blockedAt(Math.round(a.x), Math.round(a.y)));
    expect(stuck).toHaveLength(0);
  });

  it('걷는 손님의 남은 길이 새 발판을 지나지 않는다', () => {
    const cells = grownCells().filter(([x, y]) => walkable(x, y));
    const o = inn();
    // 커질 칸을 가로지르는 길을 미리 받아 둔 손님
    const [cx, cy] = cells[0];
    let walker: Actor | null = null;
    for (const [gx, gy] of [[o.tx - 2, cy], [cx, o.ty - 2], [o.tx + o.fw + 1, cy], [cx, o.ty + o.fh + 1]] as [number, number][]) {
      for (const [sx0, sy0] of [[cx - 2, cy], [cx, cy - 2], [cx + 2, cy], [cx, cy + 2]] as [number, number][]) {
        if (!walkable(sx0, sy0) || !walkable(gx, gy)) continue;
        const p = astar(sx0, sy0, gx, gy);
        if (p && p.some(([x, y]) => cells.some(([a, b]) => a === x && b === y))) {
          walker = Object.assign(makeAdventurer(sx0, sy0, { status: 'visitor' }), { st: 'walk', path: p, hidden: false }) as Actor;
          break;
        }
      }
      if (walker) break;
    }
    expect(walker).not.toBeNull();
    world.actors = [walker!];
    const before = inn().fw;
    for (let i = 0; i < 3 && inn().fw === before; i++) upgradeObj(inn());
    rebuildPaths();
    const path = walker!.path ?? [];
    expect(path.slice(0, -1).some(([x, y]) => blockedAt(x, y))).toBe(false);
  });
});
