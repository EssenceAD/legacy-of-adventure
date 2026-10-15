// 10/17 예시 마을 「별무리 항구」 — RPG 마을처럼: 길의 위계 · 구역 한 바퀴 · 비워 둘 곳 · 랜드마크 · 어울림 · 전시용 사람
import { describe, expect, it } from 'vitest';
import LIST from '../src/data/buildings2.json';
import { NEIGHBORS } from '../src/data/neighbors';
import { doorOf, entrance, inLand, pathT, placeLayout, rebuildPaths, sizeFor } from '../src/world/town';
import { computeSets } from '../src/world/harmony';
import { S, world } from '../src/world/state';
import { def } from '../src/data/catalog';
import { N } from '../src/engine/iso';

const v = NEIGHBORS.find((n) => n.id === 'harbor')!;
const ents = v.layout.map(([kind, tx, ty, lvl, hue, flip]) => ({ kind, tx, ty, lvl: lvl ?? 1, hue: hue ?? null, flip: !!flip }));
const setup = () => {
  S.visiting = v as never;
  const r = placeLayout(ents, v.land);
  rebuildPaths();
  return r;
};
const at = (x: number, y: number) => world.objs.find((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);

describe('별무리 항구', () => {
  it('목록 맨 위 · ♥ 1등 · 땅 10 · 소개 한 줄 · 펫 3 · 손으로 깐 길', () => {
    expect(NEIGHBORS[0].id).toBe('harbor');
    expect(Math.max(...NEIGHBORS.map((n) => n.like))).toBe(v.like);
    expect(v.land).toBe(10);
    expect(v.note).toBe('땅 10단계 · 새 건물 7종이 모두 있는 마을이에요');
    expect(v.pets).toHaveLength(3);
    expect(v.manualPaths).toBe(true);
  });
  it('새 건물 7종 · 여관 Lv.10 · 진짜 정문', () => {
    const kinds = new Set(ents.map((e) => e.kind as string));
    for (const b of LIST.buildings) expect(kinds.has(b.key), b.key).toBe(true);
    expect(ents.find((e) => e.kind === 'inn')!.lvl).toBe(10);
    expect(kinds.has('gate')).toBe(true);
  });
  it('겹침·물 위 없음 · 배치 검사에서 옮겨지거나 빠진 것 없음 · 정문 = 입구', () => {
    const occ = new Map<string, string>();
    for (const e of ents) {
      const [w, h] = sizeFor(e.kind, e.lvl);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const k = `${e.tx + i},${e.ty + j}`;
          expect(occ.get(k), `${e.kind}@${e.tx},${e.ty} 겹침`).toBeUndefined();
          expect(v.paint![k] === 'pond', `${e.kind}@${e.tx},${e.ty} 물 위`).toBe(false);
          occ.set(k, e.kind);
        }
    }
    const r = setup();
    expect([r.moved, r.dropped, r.removed.map((x) => `${x.e.kind}@${x.e.tx},${x.e.ty}`)]).toEqual([0, 0, []]);
    const [ex, ey] = entrance();
    const g = world.objs.find((o) => o.kind === 'gate')!;
    expect(ex >= g.tx && ex < g.tx + g.fw && ey >= g.ty && ey < g.ty + g.fh).toBe(true);
  });
  it('길: 모든 건물 문 앞이 길 · 정문에서 다 이어짐 · 막다른 길 거의 없음', () => {
    setup();
    const doors = world.objs.filter((o) => !def(o.kind).deco && o.kind !== 'dungeon');
    const noDoor = doors.filter((o) => { const [dx, dy] = doorOf(o); return !pathT.has(dy * N + dx); }).map((o) => `${o.kind}@${o.tx},${o.ty}`);
    expect(noDoor).toEqual([]);
    // 정문 칸에서 퍼지기
    const inMapLand = [...pathT].filter((k) => inLand(k % N, Math.floor(k / N)));
    const seen = new Set<number>();
    const start = [...pathT].find((k) => k % N === 20 && Math.floor(k / N) === 39)!;
    expect(start).toBeTruthy();
    const q = [start];
    seen.add(start);
    while (q.length) {
      const k = q.pop()!;
      const x = k % N;
      const y = Math.floor(k / N);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = (y + dy) * N + x + dx;
        if (pathT.has(n) && !seen.has(n)) (seen.add(n), q.push(n));
      }
    }
    const lost = inMapLand.filter((k) => !seen.has(k)).map((k) => `${k % N},${Math.floor(k / N)}`);
    expect(lost).toEqual([]);
    // 막다른 칸: 이웃 길이 하나뿐 · 건물 문 칸은 빼고
    const doorSet = new Set(doors.map((o) => { const [dx, dy] = doorOf(o); return dy * N + dx; }));
    const dead = inMapLand.filter((k) => !doorSet.has(k) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => pathT.has(k + dy * N + dx)).length <= 1).map((k) => `${k % N},${Math.floor(k / N)}`);
    console.log('막다른 칸', dead.join(' '));
    expect(dead.length).toBeLessThanOrEqual(6);
  });
  it('비워 둘 곳: 광장 가운데 · 무대 앞 · 정문 앞', () => {
    setup();
    for (let y = 22; y <= 26; y++) for (let x = 19; x <= 23; x++) expect(at(x, y)?.kind, `광장 ${x},${y}`).toBeUndefined();
    for (let x = 30; x <= 35; x++) expect(at(x, 32)?.kind, `무대 앞 ${x},32`).toBeUndefined();
    for (let y = 36; y <= 39; y++) for (const x of [20, 21]) expect(at(x, y)?.kind, `정문 앞 ${x},${y}`).toBeUndefined();
  });
  it('랜드마크: 여관 가운데 · 풍차와 학원 탑은 서로 반대 끝', () => {
    setup();
    const c = (k: string) => { const o = world.objs.find((x) => x.kind === k)!; return [o.tx + o.fw / 2, o.ty + o.fh / 2]; };
    const [ix, iy] = c('inn');
    const [mx, my] = c('grain_mill');
    const [ax, ay] = c('mage_academy');
    // 화면 가로(x − y): 풍차는 오른쪽, 학원은 왼쪽, 여관은 그 사이
    expect(mx - my).toBeGreaterThan(ix - iy + 15);
    expect(ax - ay).toBeLessThan(ix - iy - 15);
  });
  it('어울림: 한밤의 공연 · 빵 굽는 냄새 · 작은 항구', () => {
    setup();
    const ids = computeSets(world.objs).map((s) => s.id);
    for (const id of [46, 47, 48]) expect(ids, String(id)).toContain(id);
  });
  it('전시용 사람: 시장 손님 · 낚시꾼 · 마법사 · 음유시인 · 전설 둘 이상 · 모두 땅 안', () => {
    const n = v.npcs!;
    expect(n.filter((p) => p.name === '손님').length).toBeGreaterThanOrEqual(2);
    for (const who of ['낚시꾼', '견습 마법사', '음유시인']) expect(n.some((p) => p.name === who), who).toBe(true);
    expect(n.filter((p) => p.legend).length).toBeGreaterThanOrEqual(2);
    S.visiting = v as never;
    for (const p of n) expect(inLand(p.x, p.y), p.name).toBe(true);
  });
});
