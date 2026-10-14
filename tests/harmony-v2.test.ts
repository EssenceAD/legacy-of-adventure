// K10 harmonyV2: 어울림마다 최소 부품을 「허용 거리 끝」에 놓았을 때 성립 · 구역은 이어진 덩어리 · 같은 이름 장식 · 붐비는 실제 저장에서 앞 어울림이 다 가져가지 않음
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { def, type Kind } from '../src/data/catalog';
import { HARMONIES, type HarmonyDef, type HarmonyPart } from '../src/data/harmony';
import { migrate } from '../src/save/save';
import { setFlag } from '../src/world/flags';
import { capOf, computeSets, gap } from '../src/world/harmony';
import { resetProgress, S, world, type Building } from '../src/world/state';
import { placeLayout } from '../src/world/town';

const H = CONFIG.harmony;
const kindOf = (p: HarmonyPart): Kind => (p.k === 'trophy' ? 'trophy_boar' : p.k === 'plaque' ? 'plaque_bronze' : p.k[0]) as Kind;
const mk = (k: Kind, tx: number, ty: number): Building => {
  const [fw, fh] = def(k).size;
  return { kind: k, tx, ty, fw, fh, lvl: 1 } as Building;
};
/** 부품 목록 (n 펼침) */
const items = (h: HarmonyDef) => h.parts.flatMap((p) => Array.from({ length: p.n ?? 1 }, () => kindOf(p)));

/** 앵커 둘레 8자리에 「정확히 R칸」 떨어뜨려 놓기 */
function around(h: HarmonyDef): Building[] {
  const R = h.range ?? H.range;
  const [k0, ...rest] = items(h);
  const a = mk(k0, 40, 40);
  const out = [a];
  const slot = (i: number, k: Kind): Building => {
    const [fw, fh] = def(k).size;
    const X = [a.tx + a.fw + R, a.tx, a.tx - R - fw, a.tx, a.tx + a.fw + R, a.tx - R - fw, a.tx - R - fw, a.tx + a.fw + R][i];
    const Y = [a.ty, a.ty + a.fh + R, a.ty, a.ty - R - fh, a.ty + a.fh + R, a.ty + a.fh + R, a.ty - R - fh, a.ty - R - fh][i];
    return mk(k, X, Y);
  };
  rest.forEach((k, i) => out.push(slot(i, k)));
  for (const o of out.slice(1)) expect(gap(a, o)).toBe(R);
  return out;
}
/** 한 줄로 이어 놓기: 앞 물건과 사이 R칸 (줄 어울림 · 구역 어울림 「덩어리」 시험) */
function chain(h: HarmonyDef): Building[] {
  const R = h.range ?? H.range;
  const out: Building[] = [];
  let x = 40;
  for (const k of items(h)) {
    const o = mk(k, x, 40);
    out.push(o);
    x += o.fw + R;
  }
  return out;
}
const forms = (objs: Building[], id: number) => computeSets(objs).some((s) => s.id === id);

beforeEach(() => setFlag('harmonyV2', true));
afterEach(() => setFlag('harmonyV2', true));

describe('K10 어울림마다 최소 부품 · 거리 끝', () => {
  for (const h of HARMONIES) {
    it(`#${h.id} ${h.name}`, () => {
      const layout = h.shape === 'line' || h.zone ? chain(h) : around(h);
      expect(forms(layout, h.id)).toBe(true);
      // 한 칸 더 멀면 안 됨 (줄·덩어리는 마지막 것을 한 칸 밀기 · 둘레는 첫 번째 자리를 한 칸 밀기)
      const far = layout.map((o) => ({ ...o }));
      const last = far[far.length - 1];
      if (h.shape === 'line' || h.zone) last.tx += 1;
      else far[1].tx += far[1].tx > far[0].tx ? 1 : -1;
      const still = computeSets(far).filter((s) => s.id === h.id);
      expect(still.some((s) => s.members.length === items(h).length && s.members.every((m) => far.includes(m)))).toBe(false);
    });
  }
});

describe('K10 규칙', () => {
  it('구역 어울림은 앵커가 아니라 이어진 덩어리 — 옛 규칙은 실패, 새 규칙은 성립 (#31 시장 거리)', () => {
    const h = HARMONIES.find((x) => x.id === 31)!;
    const layout = chain(h); // 과일 수레 ─4칸─ 꽃 수레 ─4칸─ 간판 ─4칸─ 술통 더미 : 과일 수레에서 끝까지 > 4칸
    expect(gap(layout[0], layout[3])).toBeGreaterThan(h.range!);
    setFlag('harmonyV2', false);
    expect(forms(layout, 31)).toBe(false);
    setFlag('harmonyV2', true);
    expect(forms(layout, 31)).toBe(true);
  });
  it('같은 이름 「술통 더미」(barrels)로도 시장 거리 · 「장미 아치」(rose_arch)로도 장미 정원', () => {
    const m = [mk('fruit_stall', 10, 10), mk('flower_cart', 11, 10), mk('shop_sign', 12, 10), mk('barrels', 13, 10)];
    expect(forms(m, 31)).toBe(true);
    setFlag('harmonyV2', false);
    expect(forms(m, 31)).toBe(false);
    setFlag('harmonyV2', true);
    expect(forms([mk('garden', 10, 10), mk('rose_arch', 13, 10)], 6)).toBe(true);
  });
  it('1칸 장식은 어울림 개수 제한 없음 · 큰 건물은 3개 그대로', () => {
    // 벤치 하나: 우물가 수다(2) · 불멍(14) · 광장(10, 분수 기준) · 정자 쉼터(38, 정자 기준) — 넷
    const bench = mk('bench', 20, 20);
    const objs = [bench, mk('well', 18, 20), mk('fire', 22, 20), mk('fountain', 20, 22), mk('flowerbed', 22, 23), mk('gazebo', 17, 17), mk('lily_pond', 17, 15)];
    const ids = computeSets(objs).filter((s) => s.members.includes(bench)).map((s) => s.id);
    expect(ids.sort((a, b) => a - b)).toEqual([2, 10, 14, 38]);
    setFlag('harmonyV2', false);
    expect(computeSets(objs).filter((s) => s.members.includes(bench)).length).toBe(H.perBuilding);
  });
  it('먼저 한 세트씩: 앞 어울림의 추가 세트가 큰 건물 자리를 다 써도 뒤 어울림이 성립 (#35 쌍둥이 주점)', () => {
    // 주점 둘 · 각자 모닥불·술통 → 흥겨운 밤(1)·술통 창고(7)가 두 세트씩, 텃밭은 두 번째 주점 곁(향신료 텃밭 18)
    //  옛 규칙: 두 번째 주점이 1·7·18로 3개 꽉 참 → 쌍둥이 주점(35) 실패 · 새 규칙: 한 세트씩 먼저라 성립
    const objs = [mk('tavern', 10, 10), mk('tavern', 16, 10), mk('fire', 8, 10), mk('fire', 20, 10), mk('barrels', 10, 8), mk('barrels', 16, 8), mk('garden', 16, 14)];
    setFlag('harmonyV2', false);
    expect(forms(objs, 35)).toBe(false);
    setFlag('harmonyV2', true);
    expect(forms(objs, 35)).toBe(true);
    for (const id of [1, 7, 18]) expect(forms(objs, id)).toBe(true);
  });
});

describe('형철 #22 큰 건물 크기별 어울림 개수', () => {
  it('capOf: 2×2 → 4 · 3×3 → 6 · 그 밖(2×1·4×4·5×5) → 3', () => {
    expect(capOf({ fw: 2, fh: 2 })).toBe(4);
    expect(capOf({ fw: 3, fh: 3 })).toBe(6);
    for (const [fw, fh] of [[2, 1], [4, 4], [5, 5], [1, 1]]) expect(capOf({ fw, fh })).toBe(H.perBuilding);
    expect(H.perBuilding).toBe(3);
  });
  it('3×3 주점 한 채가 어울림 4개(1·7·18·35)에 — 옛 3개 제한이면 쌍둥이 주점이 빠짐', () => {
    const objs = () => [mk('tavern', 10, 10), mk('tavern', 16, 10), mk('fire', 8, 10), mk('barrels', 10, 8), mk('garden', 10, 14)];
    const o = objs();
    expect(computeSets(o).filter((s) => s.members.includes(o[0])).map((s) => s.id).sort((a, b) => a - b)).toEqual([1, 7, 18, 35]);
    const keep = H.perBuildingBySize;
    H.perBuildingBySize = {};
    try {
      const p = objs();
      expect(computeSets(p).filter((s) => s.members.includes(p[0])).length).toBe(3);
      expect(forms(p, 35)).toBe(false);
    } finally {
      H.perBuildingBySize = keep;
    }
  });
  it('2×2 분수는 4개까지 · 5번째는 안 됨 (가짜 어울림 5개로 시험)', () => {
    const fake = [901, 902, 903, 904, 905].map((id, i) => ({ id, name: 'x' + id, text: '', hint: '', parts: [{ k: ['fountain'] as Kind[] }, { k: [(['bench', 'flowerbed', 'lamppost', 'statue', 'well'] as Kind[])[i]] }] }));
    const keep = HARMONIES.splice(0, HARMONIES.length, ...fake);
    try {
      const f = mk('fountain', 20, 20);
      const objs = [f, mk('bench', 18, 20), mk('flowerbed', 22, 20), mk('lamppost', 20, 18), mk('statue', 20, 22), mk('well', 23, 23)];
      expect(computeSets(objs).filter((s) => s.members.includes(f)).length).toBe(4);
    } finally {
      HARMONIES.splice(0, HARMONIES.length, ...keep);
    }
  });
});

const SAVES = ['tests/fixtures/real_gonu_harm.json', 'tests/fixtures/real_hyeongcheol.json'];
describe.skipIf(!SAVES.every((f) => fs.existsSync(f)))('K10 실제 저장 (붐비는 마을)', () => {
  it('새 규칙에서 성립 어울림이 줄지 않고 · 규칙 탓에 막힌 것 0', () => {
    for (const f of SAVES) {
      const d = migrate(JSON.parse(fs.readFileSync(f, 'utf8')));
      resetProgress(d.progress);
      S.visiting = null as never;
      S.land = d.land;
      const r = placeLayout(d.buildings.map((b: { kind: Kind; tx: number; ty: number; lvl: number; flip?: boolean }) => ({ kind: b.kind, tx: b.tx, ty: b.ty, lvl: b.lvl ?? 1, hue: null, flip: !!b.flip })), d.land);
      expect(r.moved).toBe(0);
      setFlag('harmonyV2', false);
      const old = new Set(computeSets(world.objs).map((s) => s.id));
      setFlag('harmonyV2', true);
      const now = new Set(computeSets(world.objs).map((s) => s.id));
      for (const id of old) expect(now.has(id)).toBe(true);
      // 혼자 계산하면 성립하는 어울림은 새 규칙에서도 성립
      for (const h of HARMONIES) {
        if (now.has(h.id)) continue;
        const keep = HARMONIES.splice(0, HARMONIES.length, h);
        const alone = computeSets(world.objs).some((s) => s.id === h.id);
        HARMONIES.splice(0, HARMONIES.length, ...keep);
        if (!alone) continue;
        // 명세: 큰 건물은 크기별 제한 (형철 #22: 2×2 4 · 3×3 6 · 나머지 3) — 혼자 계산할 때 쓰는 큰 건물이 이미 다른 어울림 3개에 들어 있으면 허용 (보고)
        const full = world.objs.filter((o) => !(def(o.kind).deco && o.fw === 1 && o.fh === 1) && computeSets(world.objs).filter((x) => x.members.includes(o)).length >= capOf(o) && h.parts.some((p) => kindOf(p) === o.kind));
        expect(full.length, `#${h.id} ${h.name}`).toBeGreaterThan(0);
        console.log(f, `#${h.id} ${h.name}: 큰 건물 개수 제한 (${full.map((o) => def(o.kind).name).join(', ')})`);
      }
      console.log(f, '옛', old.size, '→ 새', now.size);
    }
  });
});
