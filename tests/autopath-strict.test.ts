// 핫픽스 v0.24.6: 자동 길 끔인데 던전 길이 다시 생김 (고느끼) — 실제 저장(로컬 전용)으로 던전 옮기기 → 마을 안 길 0칸
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import type { Kind } from '../src/data/catalog';
import { migrate } from '../src/save/save';
import { P, resetProgress, S, world } from '../src/world/state';
import { canPlace, findKind, inLand, landBounds, pathT, placeLayout, rebuildPaths, startTown } from '../src/world/town';
import { isAutoPath, paintTile } from '../src/world/decor';
import { outerRoad } from '../src/world/grade';

const N = CONFIG.map.size;
const REAL = 'tests/fixtures/real_gonu.json';
const load = () => {
  const d = migrate(JSON.parse(fs.readFileSync(REAL, 'utf8')));
  resetProgress(d.progress);
  S.visiting = null as never;
  S.land = d.land;
  placeLayout(d.buildings.map((b: { kind: Kind; tx: number; ty: number; lvl: number }) => ({ kind: b.kind, tx: b.tx, ty: b.ty, lvl: b.lvl ?? 1, hue: null })), d.land);
  rebuildPaths();
};
/** 마을 안(울타리 안) 자동 길 칸 수 — 칠한 길은 빼고 */
const insidePaths = () => [...pathT].filter((k) => { const x = k % N, y = Math.floor(k / N); return inLand(x, y) && !P.decor.paint[`${x},${y}`]; }).length;

describe.skipIf(!fs.existsSync(REAL))('자동 길 끔 · 던전 길 (고느끼 실제 저장)', () => {
  it('자동 길 끔: 지금 자리 · 던전을 마을 안 여러 자리로 옮겨도 마을 안 길 0칸', () => {
    load();
    expect(P.decor.autoPath).toBe(false);
    expect(insidePaths()).toBe(0);
    const dg = findKind('dungeon')!;
    const [a, b] = landBounds();
    let moved = 0;
    for (let y = a; y <= b && moved < 8; y += 3)
      for (let x = a; x <= b && moved < 8; x += 3) {
        if (!canPlace({ kind: 'dungeon', tx: x, ty: y, fw: dg.fw, fh: dg.fh }, dg)) continue;
        Object.assign(dg, { tx: x, ty: y });
        rebuildPaths();
        expect(insidePaths()).toBe(0);
        moved++;
      }
    expect(moved).toBeGreaterThan(0);
  });
  it('자동 길 켬: 지운 칸(noPath)은 던전·건물 옮겨도 다시 안 깔림', () => {
    load();
    P.decor.autoPath = true;
    rebuildPaths();
    const no = Object.keys(P.decor.noPath ?? {});
    expect(no.length).toBeGreaterThan(0);
    const dg = findKind('dungeon')!;
    const [a] = landBounds();
    if (canPlace({ kind: 'dungeon', tx: a + 1, ty: a + 1, fw: dg.fw, fh: dg.fh }, dg)) Object.assign(dg, { tx: a + 1, ty: a + 1 });
    const o = world.objs.find((x) => x.kind === 'smith' || x.kind === 'tavern');
    if (o) { const t = o.tx; o.tx = t + 1; if (!canPlace(o, o)) o.tx = t; }
    rebuildPaths();
    for (const k of no) { const [x, y] = k.split(',').map(Number); expect(pathT.has(y * N + x)).toBe(false); }
  });
  it('입구 길(울타리 밖)은 그대로 · 지우개로 지우면 사라지고 다시 안 생김', () => {
    load();
    const road = outerRoad();
    expect(road.length).toBeGreaterThan(0);
    const [x, y] = road[road.length - 1];
    expect(isAutoPath(x, y)).toBe(true);
    expect(paintTile(x, y, null)).toBe(true);
    expect(P.decor.noPath[`${x},${y}`]).toBe(1);
    rebuildPaths();
    expect(outerRoad().some(([a, b]) => a === x && b === y)).toBe(false);
    expect(outerRoad().length).toBe(road.length - 1);
  });
});

describe('자동 길 끔 · 던전이 숲(새 마을)', () => {
  it('울타리 밖 숲길만 남고 마을 안 길 0칸 · 자동 길 켬이면 예전처럼', () => {
    S.visiting = null as never;
    S.land = 3;
    startTown();
    P.decor = { ...P.decor, autoPath: false, paint: {}, round: {}, noPath: {}, entX: null, dgHome: null };
    rebuildPaths();
    const outside = [...pathT].filter((k) => !inLand(k % N, Math.floor(k / N))).length;
    expect(outside).toBeGreaterThan(0);
    expect(insidePaths()).toBe(0);
    P.decor.autoPath = true;
    rebuildPaths();
    expect(insidePaths()).toBeGreaterThan(0);
  });
});
