// 10/16 예시 마을 「별무리 항구」 (땅 10 · ♥ 1등 · 목록 맨 위) — 배치 검사 그대로 통과 · 새 건물 7종 · 어울림 3 · 정문 = 입구
import { describe, expect, it } from 'vitest';
import LIST from '../src/data/buildings2.json';
import { NEIGHBORS } from '../src/data/neighbors';
import { doorOf, entrance, placeLayout, sizeFor } from '../src/world/town';
import { computeSets } from '../src/world/harmony';
import { S, world } from '../src/world/state';
import { def } from '../src/data/catalog';

describe('별무리 항구', () => {
  const v = NEIGHBORS.find((n) => n.id === 'harbor')!;
  const ents = v.layout.map(([kind, tx, ty, lvl, hue, flip]) => ({ kind, tx, ty, lvl: lvl ?? 1, hue: hue ?? null, flip: !!flip }));
  it('목록 맨 위 · 예시 마을 중 ♥ 1등 · 땅 10 · 소개 한 줄', () => {
    expect(NEIGHBORS[0].id).toBe('harbor');
    expect(Math.max(...NEIGHBORS.map((n) => n.like))).toBe(v.like);
    expect(v.land).toBe(10);
    expect(v.note).toBe('땅 10단계 · 새 건물 7종이 모두 있는 마을이에요');
    expect(v.pets).toHaveLength(3);
    expect(v.legends!.length).toBeGreaterThan(1);
  });
  it('새 건물 7종이 모두 · 여관 Lv.10 · 진짜 정문', () => {
    const kinds = new Set(ents.map((e) => e.kind as string));
    for (const b of LIST.buildings) expect(kinds.has(b.key), b.key).toBe(true);
    expect(ents.find((e) => e.kind === 'inn')!.lvl).toBe(10);
    expect(kinds.has('gate')).toBe(true);
  });
  it('겹침 없음 · 문 앞 비어 있음 · 배치 검사에서 옮겨지거나 빠진 것 없음', () => {
    const occ = new Set<string>();
    for (const e of ents) {
      const [w, h] = sizeFor(e.kind, e.lvl);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const k = `${e.tx + i},${e.ty + j}`;
          expect(occ.has(k), `${e.kind}@${e.tx},${e.ty}`).toBe(false);
          occ.add(k);
        }
    }
    for (const e of ents) {
      if (def(e.kind).deco) continue;
      const [w, h] = sizeFor(e.kind, e.lvl);
      const [dx, dy] = doorOf({ tx: e.tx, ty: e.ty, fw: w, fh: h, flip: e.flip } as never);
      expect(occ.has(`${dx},${dy}`), `${e.kind} 문 앞`).toBe(false);
    }
    S.visiting = v as never;
    const r = placeLayout(ents, v.land);
    expect([r.moved, r.dropped, r.removed.length]).toEqual([0, 0, 0]);
    // 정문이 입구를 덮는다
    const [ex, ey] = entrance();
    const g = world.objs.find((o) => o.kind === 'gate')!;
    expect(ex >= g.tx && ex < g.tx + g.fw && ey >= g.ty && ey < g.ty + g.fh).toBe(true);
    S.visiting = null as never;
  });
  it('어울림: 한밤의 공연 · 빵 굽는 냄새 · 작은 항구', () => {
    S.visiting = v as never;
    placeLayout(ents, v.land);
    const ids = computeSets(world.objs).map((s) => s.id);
    for (const id of [46, 47, 48]) expect(ids, String(id)).toContain(id);
    S.visiting = null as never;
  });
});
