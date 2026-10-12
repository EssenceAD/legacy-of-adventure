// 땅 단계별로 장부 건설 임무 건물이 들어가나 (핫픽스 8): 장부 순서대로 땅을 넓히고 건물을 지으며
//  ① 아무것도 없을 때 ② 1칸 장식을 가운데부터 놓았을 때(봇·사람이 막히던 경우) — 자리 정리 도우미로 자리가 나는지
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { def, type Kind } from '../src/data/catalog';
import { CHAPTERS } from '../src/data/guide';
import { S, world } from '../src/world/state';
import { addObj, canPlace, rebuildPaths, startTown, suggestSpot, type Placement } from '../src/world/town';
import { applyTidy, hasSpot, planTidy } from '../src/world/tidy';

/** 장부의 땅·건설 임무를 순서대로 */
function steps(): (['land', number] | ['build', Kind])[] {
  const out: (['land', number] | ['build', Kind])[] = [];
  for (const ch of CHAPTERS)
    for (const m of ch.missions) {
      const src = m.check.toString();
      const land = src.match(/c\.land,\s*(\d)/);
      const has = src.match(/c\.has\(['"]([a-z_]+)['"]\)/);
      if (land) out.push(['land', +land[1]]);
      else if (has) out.push(['build', has[1] as Kind]);
    }
  return out;
}
const place = (kind: Kind) => {
  const d = def(kind);
  const pl: Placement = { kind, sprite: d.sprite, fw: d.size[0], fh: d.size[1], tx: null, ty: null, ok: false };
  suggestSpot(pl);
  if (pl.tx == null) return false;
  addObj(kind, pl.tx, pl.ty!);
  rebuildPaths();
  return true;
};
const buildings = () => world.objs.filter((o) => !def(o.kind).deco).map((o) => `${o.kind}@${o.tx},${o.ty}`);

beforeEach(() => {
  S.visiting = null as never;
  S.land = 1;
  world.objs = [];
  startTown();
  rebuildPaths();
});

describe('땅 단계와 장부 건설 임무', () => {
  it('땅 개편 + LAND2: 단계 크기 8 · 11 · 14 · 18 · 22 · 26 · 30', () => {
    expect(CONFIG.land.map((l) => l.to - l.from)).toEqual([8, 11, 14, 18, 22, 26, 30]);
  });
  it('빈 마을: 장부 순서대로 지으면 모든 건설 임무 건물이 그 시점 땅에 들어간다', () => {
    const st = steps();
    expect(st.length).toBeGreaterThan(8);
    for (const [k, v] of st) {
      if (k === 'land') S.land = Math.max(S.land, v as number);
      else expect(place(v as Kind), `${v} @ 땅 ${S.land}`).toBe(true);
    }
  });
  it('장식을 땅마다 몇 개씩 가운데부터 놓아도: 건설 임무마다 자리가 있거나, 도우미로 자리가 난다', () => {
    const decos: Kind[] = ['bench', 'flowerbed', 'lamppost', 'bench', 'flowerbed', 'lamppost', 'barrels', 'arbor', 'statue', 'banner'];
    let di = 0;
    for (const [k, v] of steps()) {
      if (k === 'land') {
        S.land = Math.max(S.land, v as number);
        for (let i = 0; i < 3 && di < decos.length; i++) place(decos[di++]);
        continue;
      }
      const kind = v as Kind;
      if (!hasSpot(kind)) {
        const plan = planTidy(kind);
        expect(plan.spot, `${kind} @ 땅 ${S.land}: 정리해도 자리 없음`).not.toBeNull();
        applyTidy(plan);
      }
      expect(place(kind), `${kind} @ 땅 ${S.land}`).toBe(true);
    }
  });
  it('도우미: 가운데 빈칸을 1칸 장식으로 채운 땅 3단계에서 훈련장 자리를 만든다 (건물은 안 옮김)', () => {
    S.land = 3;
    for (const k of ['well', 'fire', 'board', 'tavern'] as Kind[]) place(k);
    // 가운데 쪽 빈칸에만 장식을 흩어 놓아 훈련장(3×3) 자리가 사라질 때까지 (가장자리는 비어 있음)
    const [a, b] = [CONFIG.land[2].from, CONFIG.land[2].to];
    const mid = (a + b) / 2;
    const cells: [number, number][] = [];
    for (let y = a + 1; y < b - 1; y++) for (let x = a + 1; x < b - 1; x++) if ((x + y) % 2 === 0) cells.push([x, y]);
    cells.sort((p, q) => Math.hypot(p[0] - mid, p[1] - mid) - Math.hypot(q[0] - mid, q[1] - mid));
    let n = 0;
    for (const [x, y] of cells) {
      if (!hasSpot('training')) break;
      const t: Placement = { kind: 'bench', sprite: null, fw: 1, fh: 1, tx: x, ty: y, ok: false };
      if (!canPlace(t)) continue;
      addObj(n % 2 ? 'flowerbed' : 'bench', x, y);
      rebuildPaths();
      n++;
    }
    expect(hasSpot('training')).toBe(false);
    const before = buildings();
    const plan = planTidy('training');
    console.log(`장식 ${n}개로 막힘 → 정리: ${plan.moves.length}개 이동 · 자리 ${plan.spot} · 어울림 ${plan.broken}개 풀림`);
    expect(plan.spot).not.toBeNull();
    applyTidy(plan);
    expect(place('training')).toBe(true);
    // 건물은 하나도 안 움직였다
    expect(buildings().filter((b) => !b.startsWith('training'))).toEqual(before);
  });
  it('도우미: 장식을 다 옮겨도 자리가 없으면 자리 없음(→ 땅 넓히기 안내)', () => {
    S.land = 3;
    for (const k of ['well', 'fire', 'board', 'tavern'] as Kind[]) place(k);
    while (place('bench'));
    const plan = planTidy('training');
    expect(plan.spot).toBeNull();
    expect(plan.moves).toEqual([]);
  });
});
