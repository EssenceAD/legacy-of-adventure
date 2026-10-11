// 땅 개편 §9: 단계마다 땅이 서로 포함 · 입구·던전 길 · 옛 저장(1·3·5단계) 좌표 옮기기 — 상대 위치 같음 · 겹침 0 · 땅 밖 0
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { CATALOG, def, START_TOWN, type Kind } from '../src/data/catalog';
import { bigMapShift, migrate } from '../src/save/save';
import { S, world } from '../src/world/state';
import { astar, doorOf, entrance, findKind, inLand, landBounds, placeLayout, rebuildPaths, startTown } from '../src/world/town';

const N = CONFIG.map.size;
const v6 = () => JSON.parse(fs.readFileSync('tests/fixtures/v6.json', 'utf8'));
/** 옛 저장 픽스처: v6 저장을 그 단계 옛 땅(맵 14) 모양으로 */
function oldSave(land: number) {
  const d = v6();
  d.land = land;
  const OLD = [[4, 10], [3, 11], [1, 12], [1, 13], [0, 14]][land - 1];
  // 그 단계 옛 땅 안에 들어가는 건물만 · 5단계는 가장자리(0, 13)에 하나씩 더
  d.buildings = d.buildings.filter((b: { kind: Kind; tx: number; ty: number }) => {
    const [w, h] = CATALOG[b.kind].size;
    return def(b.kind).fixed || (b.tx >= OLD[0] && b.ty >= OLD[0] && b.tx + w <= OLD[1] && b.ty + h <= OLD[1]);
  });
  if (land === 5) d.buildings.push({ kind: 'bench', tx: 0, ty: 0, lvl: 1, hue: null }, { kind: 'flowerbed', tx: 13, ty: 13, lvl: 1, hue: null }, { kind: 'lamppost', tx: 0, ty: 13, lvl: 1, hue: null });
  return d;
}

describe('땅 단계', () => {
  it('맵 24 · 단계마다 앞쪽 가장자리 22 그대로 · 다음 단계가 앞 단계를 다 품는다', () => {
    expect(N).toBe(24);
    for (let s = 1; s <= 5; s++) {
      const [a, b] = landBounds(s);
      expect(b).toBe(22);
      expect(a).toBeGreaterThanOrEqual(0);
      if (s > 1) {
        const [pa, pb] = landBounds(s - 1);
        expect(a <= pa && b >= pb).toBe(true);
      }
    }
  });
  it('단계마다 입구 → 여관 문 · 던전 문 → 여관 문 길이 이어진다 (새 게임 배치)', () => {
    for (let s = 1; s <= 5; s++) {
      S.visiting = null as never;
      S.land = s;
      startTown();
      rebuildPaths();
      const inn = findKind('inn')!;
      const hub = doorOf(inn);
      const [ex, ey] = entrance();
      expect(astar(ex, ey, hub[0], hub[1]), `입구 ${s}단계`).not.toBeNull();
      const dg = findKind('dungeon')!;
      const dd = doorOf(dg);
      expect(astar(dd[0], dd[1], hub[0], hub[1], true), `던전 ${s}단계`).not.toBeNull();
      // 새 게임 건물(던전 빼고)은 1단계 땅 안
      for (const [k, x, y] of START_TOWN) if (!def(k).fixed) expect(inLand(x, y, 1)).toBe(true);
    }
  });
});

describe('옛 저장 옮기기 (v6 → v7)', () => {
  for (const land of [1, 3, 5])
    it(`${land}단계 저장: 상대 위치 같음 · 겹침 0 · 땅 밖 0 · 맵 밖 0`, () => {
      const old = oldSave(land);
      const k = bigMapShift(land);
      const d = migrate(JSON.parse(JSON.stringify(old)));
      expect(d.version).toBe(7);
      const nb = d.buildings as { kind: Kind; tx: number; ty: number; lvl: number }[];
      expect(nb.length).toBe(old.buildings.length);
      // 상대 위치: 던전(고정) 빼고 모두 같은 만큼 옮겨졌다
      for (let i = 0; i < nb.length; i++) {
        if (def(nb[i].kind).fixed) continue;
        expect([nb[i].tx - old.buildings[i].tx, nb[i].ty - old.buildings[i].ty]).toEqual([k, k]);
      }
      // 실제 배치: 옮김·뺌 0 · 겹침 0 · 고정이 아니면 새 땅 안
      S.visiting = null as never;
      S.land = land;
      const r = placeLayout(nb.map((b) => ({ kind: b.kind, tx: b.tx, ty: b.ty, lvl: b.lvl ?? 1, hue: null })), land);
      expect(r).toEqual({ moved: 0, dropped: 0 });
      const cells = new Set<string>();
      for (const o of world.objs) {
        for (let y = o.ty; y < o.ty + o.fh; y++)
          for (let x = o.tx; x < o.tx + o.fw; x++) {
            expect(cells.has(`${x},${y}`), `겹침 ${o.kind}@${x},${y}`).toBe(false);
            cells.add(`${x},${y}`);
            expect(x >= 0 && y >= 0 && x < N && y < N).toBe(true);
            if (!def(o.kind).fixed) expect(inLand(x, y, land), `${o.kind}@${x},${y} 땅 밖`).toBe(true);
          }
      }
      // 손님 좌표도 같은 만큼
      expect(d.adventurers[0].x - old.adventurers[0].x).toBe(k);
    });
  it('옮긴 마을 등급 장식 기록(k@x,y)도 같은 만큼', () => {
    const old = oldSave(3);
    old.progress.harmony = { ...(old.progress.harmony ?? {}), moved: ['lamppost@5,12', 'bench@7,13'] };
    const d = migrate(old);
    const k = bigMapShift(3);
    expect(d.progress.harmony.moved).toEqual([`lamppost@${5 + k},${12 + k}`, `bench@${7 + k},${13 + k}`]);
  });
  it('1단계 저장의 던전은 맵 안 (새 게임 던전 자리)', () => {
    const d = migrate(oldSave(1));
    const dg = d.buildings.find((b: { kind: string }) => b.kind === 'dungeon');
    const sz = CATALOG.dungeon.size;
    expect(dg.tx + sz[0] <= N && dg.ty + sz[1] <= N).toBe(true);
  });
});

describe('여관 Lv.10 · 주점 Lv.6 (§11)', () => {
  it('방: Lv.1~3 +2씩, Lv.4부터 +1 (Lv.10 = 15) · 레벨업마다 빠른 단골 자리도 늘어난다', async () => {
    const { capacity, upgradeObj } = await import('../src/world/town');
    const { watchCapacity } = await import('../src/world/actors');
    const { P } = await import('../src/world/state');
    S.visiting = null as never;
    S.started = true as never;
    S.land = 5;
    startTown();
    rebuildPaths();
    world.actors = [];
    const inn = findKind('inn')!;
    const caps = [capacity()];
    P.fastSlots = 0;
    P.fastRescued = true;
    watchCapacity();
    for (let lv = 2; lv <= 10; lv++) {
      expect(upgradeObj(inn), `Lv.${lv}`).toBe(true);
      rebuildPaths();
      watchCapacity();
      caps.push(capacity());
    }
    expect(caps).toEqual([4, 6, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(P.fastSlots).toBe(15 - 4);
  });
  it('그림 단계: Lv.2 inn3(4×4) · Lv.5 inn5(5×5) · Lv.8 inn8(5×5) — 커질 때 뒤로 (앞 꼭짓점 그대로)', async () => {
    const { upgradeObj } = await import('../src/world/town');
    S.land = 5;
    startTown();
    rebuildPaths();
    const inn = findKind('inn')!;
    const front = () => [inn.tx + inn.fw, inn.ty + inn.fh];
    const f0 = front();
    const seen: string[] = [];
    for (let lv = 2; lv <= 10; lv++) {
      upgradeObj(inn);
      seen.push(`${inn.lvl}:${inn.sprite}:${inn.fw}`);
      expect(front()).toEqual(f0);
    }
    expect(seen).toEqual(['2:inn3:4', '3:inn3:4', '4:inn3:4', '5:inn5:5', '6:inn5:5', '7:inn5:5', '8:inn8:5', '9:inn8:5', '10:inn8:5']);
  });
  it('필요한 땅: 여관 Lv.4는 땅 3단계부터 · 주점은 Lv.6까지', async () => {
    const { landNeedFor, maxLevel } = await import('../src/world/town');
    expect(landNeedFor({ kind: 'inn', lvl: 3 })).toBe(3);
    expect(maxLevel('inn')).toBe(10);
    expect(maxLevel('tavern')).toBe(6);
  });
});
