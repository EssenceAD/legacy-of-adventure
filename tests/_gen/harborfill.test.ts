// 한 번 쓰는 생성기: 별무리 항구 빈 잔디 칸 → 구역별 장식으로 채우기 → src/data/harbor_fill.ts
//  채움 → 길 다시 깔기 → 새로 빈 칸 또 채움 (안 바뀔 때까지) · 문 앞·입구 둘레·길은 비움 · 칸마다 정해진 25%는 숨 쉴 틈
import { expect, it } from 'vitest';
import fs from 'node:fs';
import { NEIGHBORS } from '../../src/data/neighbors';
import { HARBOR_FILL } from '../../src/data/harbor_fill';
import { grid, inLand, pathT, placeLayout, rebuildPaths, doorOf, entrance, pondAt } from '../../src/world/town';
import { S, world } from '../../src/world/state';
import { def, type Kind } from '../../src/data/catalog';
import { N } from '../../src/engine/iso';

it('gen', () => {
  const v = NEIGHBORS.find((n) => n.id === 'harbor')!;
  S.visiting = v as never;
  // 배치표에서 예전 채움(HARBOR_FILL 줄) 빼기 — 손으로 둔 3칸짜리 줄과 겹칠 수 있어 같은 줄 수만큼만
  const left = new Map<string, number>();
  for (const f of HARBOR_FILL) left.set(f.join('|'), (left.get(f.join('|')) ?? 0) + 1);
  const base = v.layout.filter((e) => {
    const k = e.join('|');
    const n = e.length === 3 ? left.get(k) ?? 0 : 0;
    if (n > 0) {
      left.set(k, n - 1);
      return false;
    }
    return true;
  });
  const h = (x: number, y: number, k: number) => {
    let s = (x * 73856093) ^ (y * 19349663) ^ (k * 83492791);
    s = Math.imul(s ^ (s >>> 13), 1274126177);
    return ((s ^ (s >>> 16)) >>> 0) / 0xffffffff;
  };
  // 낮은 꽃밭·튤립 ~60% · 나무 ~20% · 구역 소품 ~20% (키 큰 소품이 줄지어 서면 도장 찍은 듯해서 섞어 씀)
  const F = ['flowerbed', 'tulip_box', 'flowerbed', 'tulip_box', 'flowerbed', 'tulip_box'];
  const mix = (trees: string[], props: string[]) => [...F, ...trees, ...props] as Kind[];
  const zone = (x: number, y: number): Kind[] => {
    if (x >= 25 && y >= 25) return mix(['cherry', 'maple'], ['garland_post', 'stage_light']);
    if (x <= 16 && y >= 26) return mix(['maple', 'cherry'], ['basket_pile', 'crate_pile']);
    if (x <= 14 && y <= 13) return mix(['birch', 'maple'], ['straw_bale', 'flour_sacks']);
    if (x >= 27 && y <= 12) return mix(['pine', 'birch'], ['net_rack', 'barrel_stack']);
    if (x <= 14) return mix(['birch', 'cherry'], ['star_pot', 'float_crystal']);
    if (x >= 27) return mix(['maple', 'birch'], ['star_pot', 'bench']);
    return mix(['cherry', 'maple'], ['star_pot', 'garland_post']);
  };
  const fill: [Kind, number, number][] = [];
  const toEnts = () => [...base, ...fill].map(([kind, tx, ty, lvl, hue, flip]) => ({ kind: kind as Kind, tx: tx as number, ty: ty as number, lvl: (lvl as number) ?? 1, hue: (hue as number | null) ?? null, flip: !!flip }));
  for (let round = 0; round < 8; round++) {
    placeLayout(toEnts(), v.land);
    rebuildPaths();
    const keep = new Set<number>();
    for (const o of world.objs) if (!def(o.kind).deco) { const [dx, dy] = doorOf(o); for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1]]) keep.add((dy + b) * N + dx + a); }
    const [ex, ey] = entrance();
    for (let dy = -2; dy <= 0; dy++) for (let dx = -2; dx <= 3; dx++) keep.add((ey + dy) * N + ex + dx);
    let added = 0;
    for (let y = 1; y < 41; y++)
      for (let x = 1; x < 41; x++) {
        if (!inLand(x, y) || grid[y][x] || pathT.has(y * N + x) || keep.has(y * N + x) || pondAt(x, y)) continue;
        if (h(x, y, 1) < 0.25) continue;
        const z = zone(x, y);
        fill.push([z[Math.floor(h(x, y, 2) * z.length) % z.length], x, y]);
        added++;
      }
    console.log('round', round, 'added', added, 'paths', pathT.size, 'base', base.length);
    if (!added) break;
  }
  // 모든 건물 문 앞이 길에 닿아 있나
  placeLayout(toEnts(), v.land);
  rebuildPaths();
  const noPath = world.objs.filter((o) => !def(o.kind).deco && o.kind !== 'dungeon').filter((o) => { const [dx, dy] = doorOf(o); return !pathT.has(dy * N + dx); }).map((o) => o.kind);
  console.log('noPath', noPath.join(','));
  expect(noPath).toEqual([]);
  const body = `// tests/_gen/harborfill.test.ts 가 만든다 — 별무리 항구 빈 잔디 채우기 (구역별 장식 · 길·문 앞·입구는 비움 · 칸마다 25% 숨 쉴 틈)\nimport type { Kind } from './catalog';\nexport const HARBOR_FILL: [Kind, number, number][] = [\n${fill.map((f) => `  ['${f[0]}', ${f[1]}, ${f[2]}],`).join('\n')}\n];\n`;
  fs.writeFileSync('src/data/harbor_fill.ts', body);
  console.log('fill', fill.length);
});
