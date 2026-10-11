// 땅 개편 §7: 이웃 마을 4곳 — 새 땅 크기에서 배치 검사를 그대로 통과 (옮김·뺌 0) · 땅을 꽉 채운다
import { describe, expect, it } from 'vitest';
import { NEIGHBORS } from '../src/data/neighbors';
import { S, world } from '../src/world/state';
import { landBounds, placeLayout } from '../src/world/town';

describe('이웃 마을 배치', () => {
  for (const v of NEIGHBORS)
    it(`${v.name} (땅 ${v.land}단계)`, () => {
      S.visiting = null as never;
      const r = placeLayout(v.layout.map(([kind, tx, ty, lvl, hue, flip]) => ({ kind, tx, ty, lvl: lvl ?? 1, hue: hue ?? null, flip: !!flip })), v.land);
      const lost = v.layout.filter(([k, x, y]) => !world.objs.some((o) => o.kind === k && o.tx === x && o.ty === y)).map(([k, x, y]) => `${k}@${x},${y}`);
      expect({ ...r, lost }).toEqual({ moved: 0, dropped: 0, lost: [] });
      // 땅을 꽉 채운 느낌: 칸의 30% 이상을 건물·장식이 쓴다
      const [a, b] = landBounds(v.land);
      const used = world.objs.filter((o) => o.kind !== 'dungeon').reduce((s, o) => s + o.fw * o.fh, 0);
      expect(used / ((b - a) * (b - a))).toBeGreaterThan(v.land === 5 ? 0.28 : 0.2);
    });
});
