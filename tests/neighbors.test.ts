// 땅 개편 §7 + SHOWCASE: 이웃 예시 마을 5곳 — 배치 검사 그대로 통과 (옮김·뺌 0) · 개척자 장식 없음 · 사치 장식 2개까지 · 조명 12개 이상 · 빈 잔디 20% 이상
//  설계용 글자 지도: MAP=1 npx vitest run tests/neighbors.test.ts (건물 대문자 · 장식 소문자 · 자동 길 # · 빈 잔디 .)
import { describe, expect, it } from 'vitest';
import { def } from '../src/data/catalog';
import { NEIGHBORS, type Neighbor } from '../src/data/neighbors';
import { N } from '../src/engine/iso';
import { S, world } from '../src/world/state';
import { landBounds, pathT, placeLayout, rebuildPaths } from '../src/world/town';

const LIGHTS = new Set(['fire', 'lamppost', 'double_lamp', 'string_lights', 'brazier', 'mushroom_lamp', 'mushroom_dark']);
const SHOWCASE = ['moon', 'petal', 'market', 'moss', 'spa'];

const place = (v: Neighbor) => {
  S.visiting = null as never;
  return placeLayout(v.layout.map(([kind, tx, ty, lvl, hue, flip]) => ({ kind, tx, ty, lvl: lvl ?? 1, hue: hue ?? null, flip: !!flip })), v.land);
};

describe('이웃 마을 배치', () => {
  for (const v of NEIGHBORS)
    it(`${v.name} (땅 ${v.land}단계)`, () => {
      const r = place(v);
      const lost = v.layout.filter(([k, x, y]) => !world.objs.some((o) => o.kind === k && o.tx === x && o.ty === y)).map(([k, x, y]) => `${k}@${x},${y}`);
      expect({ ...r, lost }).toMatchObject({ moved: 0, dropped: 0, lost: [] });
      // 땅을 꽉 채운 느낌: 칸의 20% 이상을 건물·장식이 쓴다
      const [a, b] = landBounds(v.land);
      const used = world.objs.filter((o) => o.kind !== 'dungeon').reduce((s, o) => s + o.fw * o.fh, 0);
      expect(used / ((b - a) * (b - a))).toBeGreaterThan(0.2);
      // 던전은 (29,18) 고정
      expect(v.layout.some(([k, x, y]) => k === 'dungeon' && x === 29 && y === 18)).toBe(true);
    });
});

describe('SHOWCASE: 예시 마을 꾸미기 규칙', () => {
  it('5곳 · 땅 크기 · 좋아요·등급 순서 = 쇼케이스 > 시장 > 꽃 > 온천 > 은신처', () => {
    const by = Object.fromEntries(NEIGHBORS.map((v) => [v.id, v]));
    for (const id of SHOWCASE) expect(by[id]).toBeTruthy();
    const order = ['moon', 'market', 'petal', 'spa', 'moss'];
    for (let i = 1; i < order.length; i++) {
      expect(by[order[i - 1]].like).toBeGreaterThan(by[order[i]].like);
      expect(by[order[i - 1]].grade ?? 0).toBeGreaterThanOrEqual(by[order[i]].grade ?? 0);
    }
    expect([by.moon.land, by.petal.land, by.market.land, by.moss.land, by.spa.land]).toEqual([7, 6, 7, 3, 6]);
  });
  for (const v of NEIGHBORS.filter((n) => SHOWCASE.includes(n.id)))
    it(`${v.name}: 개척자 장식 0 · 사치 ≤2 · 조명 ≥12 · 빈 잔디 ≥20% · 지붕 hue 하나`, () => {
      place(v);
      const kinds = v.layout.map(([k]) => k);
      expect(kinds.filter((k) => def(k).pioneerDeco)).toEqual([]);
      expect(kinds.filter((k) => def(k).luxury).length).toBeLessThanOrEqual(2);
      expect(kinds.filter((k) => LIGHTS.has(k)).length).toBeGreaterThanOrEqual(12);
      const [a, b] = landBounds(v.land);
      let free = 0;
      for (let y = a; y < b; y++) for (let x = a; x < b; x++) if (!world.objs.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh)) free++;
      expect(free / ((b - a) * (b - a))).toBeGreaterThanOrEqual(0.2);
      // 지붕을 칠할 수 있는 건물은 모두 같은 hue
      const hues = new Set(v.layout.filter(([k]) => def(k).roofable).map(([, , , , h]) => h ?? null));
      expect(hues.size).toBe(1);
      expect([...hues][0]).not.toBeNull();
      if (process.env.MAP) dump(v, free / ((b - a) * (b - a)));
    });
});

// ───────── 설계용 글자 지도 ─────────
const CH: Record<string, string> = {
  inn: 'I', tavern: 'T', cottage: 'C', smith: 'S', bath: 'B', training: 'R', garden: 'G', stable: 'H', chapel: 'P', library: 'Y', alchemy: 'A', postoffice: 'O', tower: 'W', guild: 'U', dungeon: 'D',
  hedge: 'h', stonewall2: 'w', picket_gate: '|', rose_arch: 'n', arbor: 'n', double_lamp: 'l', lamppost: 'l', string_lights: 'l', brazier: 'x', fire: 'x', mushroom_lamp: 'm', mushroom_dark: 'm',
  pine: 't', tree: 't', birch: 't', maple: 't', cherry: 't', topiary: 'o', flowerbed: 'f', tulip_box: 'f', bench: 'b', rose_bench: 'b',
  star_garden: '$', gold_fountain: '$', grand_clock: '$', rainbow_bridge: '$', gold_sign: '$', hero_statue: '$',
  koi_pond: '~', lily_pond: '~', rock_fall: '~', foot_bridge: '=', gazebo: 'g', stall: 's', fountain: 'F', windmill: 'v', clock_tower: 'k',
};
function dump(v: Neighbor, freeRatio: number) {
  S.visiting = v as never;
  rebuildPaths();
  const [a, b] = landBounds(v.land);
  const lights = v.layout.filter(([k]) => LIGHTS.has(k)).length;
  const rows: string[] = [`== ${v.id} · ${v.layout.length}개 · 조명 ${lights} · 빈 잔디 ${Math.round(freeRatio * 100)}%`, '   ' + Array.from({ length: N }, (_, i) => i % 10).join('')];
  for (let y = 0; y < N; y++) {
    let r = String(y).padStart(2) + ' ';
    for (let x = 0; x < N; x++) {
      const o = world.objs.find((q) => x >= q.tx && x < q.tx + q.fw && y >= q.ty && y < q.ty + q.fh);
      r += o ? (CH[o.kind] ?? (def(o.kind).deco ? 'd' : '?')) : pathT.has(y * N + x) ? '#' : x >= a && x < b && y >= a && y < b ? '.' : ' ';
    }
    rows.push(r);
  }
  console.log(rows.join('\n'));
  S.visiting = null as never;
}
