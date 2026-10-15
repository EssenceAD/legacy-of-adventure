// LAND10: 땅 8·9·10단계 — 크기(4칸씩 뒤·옆으로) · 비용(7단계 ×3·×6·×10) · 평판 ★6(= 7단계와 같은 조건) · 맵 44 · 저장 v8 → v9(+12) · 이웃 모습 v3 → v4
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { def, START_TOWN, type Kind } from '../src/data/catalog';
import { NEIGHBORS } from '../src/data/neighbors';
import { clampCam, N, view } from '../src/engine/iso';
import { migrate, readSave } from '../src/save/save';
import { P, S, world } from '../src/world/state';
import { inLand, landBounds, placeLayout } from '../src/world/town';
import { landReqs, landWhy } from '../src/world/landreq';
import { groundSpan } from '../src/world/ground';

const L = CONFIG.land;

describe('LAND10 땅 단계 설정', () => {
  it('10단계 · 8·9·10 = 34·38·42칸 (3→7단계처럼 4칸씩) · 앞쪽 가장자리 42 그대로 · 맵 44', () => {
    expect(L.length).toBe(10);
    expect(N).toBe(44);
    expect(L.map((l) => l.to - l.from)).toEqual([8, 11, 14, 18, 22, 26, 30, 34, 38, 42]);
    expect(L.map((l) => l.size)).toEqual(['8×8', '11×11', '14×14', '18×18', '22×22', '26×26', '30×30', '34×34', '38×38', '42×42']);
    for (const l of L) expect(l.to).toBe(42);
    expect(L[9].from).toBe(0);
    expect(L[9].to + 2).toBe(N); // 앞쪽 입구 여유 2칸 (LAND2와 같게)
  });
  it('비용 = 7단계 × 3 · × 6 · × 10 (금화 · 지역 재료 · 보스 재료 같은 비율) · 장부 7장', () => {
    const base = L[6];
    for (const [i, m] of [[7, 3], [8, 6], [9, 10]] as const) {
      const s = L[i];
      expect(s.cost, `${i + 1}단계 금화`).toBe(base.cost * m);
      expect(s.mats).toEqual(Object.fromEntries(Object.entries(base.mats!).map(([k, v]) => [k, v * m])));
      expect(s.bossMats).toEqual(Object.fromEntries(Object.entries(base.bossMats!).map(([k, v]) => [k, v * m])));
      expect(s.chapter).toBe(base.chapter);
    }
    expect([L[7].cost, L[8].cost, L[9].cost]).toEqual([6_000_000, 12_000_000, 20_000_000]);
  });
  it('평판 ★6 · 별은 ★5가 끝 → 7단계와 같은 대체 조건(★5 + 별의 심연 10 돌파)', () => {
    expect(CONFIG.landStars.length).toBe(10);
    expect(CONFIG.landStars.slice(6)).toEqual([6, 6, 6, 6]);
    // 평판 별은 다섯 단계뿐 (★6 칸은 없다)
    expect(CONFIG.reputation.stars.length).toBe(5);
    for (const i of [7, 8, 9]) expect(L[i].starsAlt).toEqual(L[6].starsAlt);
  });
  it('조건 줄: ★6(또는 ★5 + 심연 10) · 장부 7장 · 금화 · 재료 3종 · 보스 재료', () => {
    const rep5 = CONFIG.reputation.stars[4];
    P.rep = rep5;
    P.hunt.best.abyss = 9;
    S.gold = 0;
    const r = landReqs(8);
    expect(r[0]).toMatchObject({ text: '평판 ★6 (또는 ★5 + 별의 심연 10 돌파)', ok: false });
    expect(r.some((x) => /금화 6,000,000/.test(x.text))).toBe(true);
    expect(r.length).toBe(1 + 1 + 1 + 3 + 1);
    P.hunt.best.abyss = 10;
    expect(landReqs(10)[0].ok).toBe(true);
    expect(landWhy(10)).toMatch(/장부|금화|필요/);
  });
});

describe('LAND10 경계 · 카메라 · 바닥 그림', () => {
  it('단계마다 앞 단계를 다 품고 · 새 게임 건물은 1단계 땅 안 · 던전은 앞쪽 오른쪽 가장자리 (41,30)', () => {
    for (let s = 2; s <= L.length; s++) {
      const [a, b] = landBounds(s);
      const [pa, pb] = landBounds(s - 1);
      expect(a <= pa && b >= pb).toBe(true);
    }
    for (const [k, x, y] of START_TOWN) if (!def(k).fixed) expect(inLand(x, y, 1)).toBe(true);
    expect(START_TOWN.find(([k]) => k === 'dungeon')!.slice(1)).toEqual([41, 30]);
  });
  it('카메라 범위 = 땅 가운데 ± (크기/2 + 3) — 10단계도 맵 안쪽', () => {
    for (const s of [7, 10]) {
      const [a, b] = landBounds(s);
      view.focus = { m: (a + b) / 2, size: b - a };
      view.cam = { x: 1e6, y: 1e6 };
      clampCam();
      const r = (b - a) / 2 + 3;
      expect(view.cam.x).toBeCloseTo(r * CONFIG.map.tileW * 0.5);
      view.cam = { x: -1e6, y: -1e6 };
      clampCam();
      expect(view.cam.x).toBeCloseTo(-r * CONFIG.map.tileW * 0.5);
    }
  });
  it('바닥 그림 범위: 1~7단계는 LAND2 때와 같은 56칸(1792×896) · 8·9·10단계만 60·64·68칸', () => {
    const M = CONFIG.UI_SCALE.groundRing;
    for (let s = 1; s <= 7; s++) expect(groundSpan(s)).toEqual([0, N + M]);
    expect([8, 9, 10].map((s) => { const [a, b] = groundSpan(s); return b - a; })).toEqual([60, 64, 68]);
    const [a, b] = groundSpan(10);
    expect([(b - a) * CONFIG.map.tileW, (b - a) * CONFIG.map.tileH]).toEqual([2176, 1088]);
  });
  it('예시 마을(맵 32 배치표)은 +12 해서 내보낸다 — 땅 안 · 옮김·뺌 0', () => {
    for (const v of NEIGHBORS) {
      S.visiting = null as never;
      const r = placeLayout(v.layout.map(([kind, tx, ty, lvl, hue, flip]) => ({ kind, tx, ty, lvl: lvl ?? 1, hue: hue ?? null, flip: !!flip })), v.land);
      expect(r, v.name).toMatchObject({ moved: 0, dropped: 0, removed: [] });
    }
  });
});

/** v8(맵 32) 저장 하나 — 좌표가 들어가는 칸을 모두 채운다 */
function v8save() {
  const d = JSON.parse(fs.readFileSync('tests/fixtures/v6.json', 'utf8'));
  d.version = 8;
  d.land = 7;
  d.buildings = [
    { kind: 'inn', tx: 20, ty: 18, lvl: 3, hue: null },
    { kind: 'dungeon', tx: 10, ty: 10, lvl: 1, hue: null },
    { kind: 'well', tx: 25, ty: 27, lvl: 1, hue: null, con: { kind: 'up', end: 1, total: 10, to: 2, cut: 0, cost: 100, from: [25, 27] } },
    { kind: 'bench', tx: 0, ty: 0, lvl: 1, hue: null },
    { kind: 'flowerbed', tx: 29, ty: 29, lvl: 1, hue: null },
  ];
  d.adventurers = d.adventurers.slice(0, 1).map((a: object) => ({ ...a, x: 3.5, y: 28.25 }));
  d.progress.decor = { autoPath: false, paint: { '1,2': 'stone', '29,29': 'flower' }, round: { '1,2': 1 }, noPath: { '30,22': 1 }, entX: 21, dgHome: [29, 18], store: [] };
  d.progress.harmony = { ...(d.progress.harmony ?? {}), moved: ['lamppost@15,32', 'stall@slot:g2_stall', 'bench@slot:3,31'] };
  return d;
}

describe('LAND10 저장 옮기기 (v8 → v9 · +12)', () => {
  it('건물 · 공사 원래 자리 · 손님 · 칠한 칸 · 둥근 모서리 · 지운 길 · 입구 x · 던전 원래 자리 · 옛 등급 장식 이름표 모두 +12 · 자리 id 이름표는 그대로', () => {
    const old = v8save();
    const d = migrate(JSON.parse(JSON.stringify(old)));
    expect(d.version).toBe(9);
    expect(d.land).toBe(7);
    expect(d.buildings.map((b: { tx: number; ty: number }) => [b.tx, b.ty])).toEqual(old.buildings.map((b: { tx: number; ty: number }) => [b.tx + 12, b.ty + 12]));
    expect(d.buildings[2].con.from).toEqual([37, 39]);
    expect([d.adventurers[0].x, d.adventurers[0].y]).toEqual([15.5, 40.25]);
    expect(d.progress.decor.paint).toEqual({ '13,14': 'stone', '41,41': 'flower' });
    expect(d.progress.decor.round).toEqual({ '13,14': 1 });
    expect(d.progress.decor.noPath).toEqual({ '42,34': 1 });
    expect(d.progress.decor.entX).toBe(33);
    expect(d.progress.decor.dgHome).toEqual([41, 30]);
    expect(d.progress.decor.autoPath).toBe(false);
    expect(d.progress.harmony.moved).toEqual(['lamppost@27,44', 'stall@slot:g2_stall', 'bench@slot:15,43']);
  });
  it('입구 x · 던전 원래 자리가 없는(null) 저장은 그대로 null', () => {
    const old = v8save();
    old.progress.decor.entX = null;
    old.progress.decor.dgHome = null;
    const d = migrate(old);
    expect(d.progress.decor.entX).toBeNull();
    expect(d.progress.decor.dgHome).toBeNull();
  });
  it('v9 저장은 다시 옮기지 않는다 · 원본은 .bak8에 한 번', () => {
    localStorage.clear();
    const old = v8save();
    localStorage.setItem(CONFIG.save.key, JSON.stringify(old));
    const s = readSave()!;
    expect(s.version).toBe(9);
    expect(JSON.parse(localStorage.getItem(CONFIG.save.key + '.bak8')!).version).toBe(8);
    const again = migrate(JSON.parse(JSON.stringify(s)));
    expect(again.buildings.map((b: { tx: number }) => b.tx)).toEqual(s.buildings.map((b) => b.tx));
  });
  it('7단계 이하 저장의 땅 단계는 그대로 (8단계 이상은 넓혀야)', () => {
    for (const land of [1, 5, 7]) {
      const old = v8save();
      old.land = land;
      expect(migrate(old).land).toBe(land);
    }
  });
});

// 실제 유저 저장(로컬 전용) — 옮긴 뒤 배치 검사: 뺌 0 · 돌려준 것 0 · 건물 수 그대로 · 옮긴 건물 말고는 +12(+8) 자리 그대로
const REALS = fs.existsSync('tests/fixtures') ? fs.readdirSync('tests/fixtures').filter((f) => /^real_.*\.json$/.test(f)) : [];
describe.skipIf(!REALS.length)('LAND10 실제 저장 (로컬)', () => {
  for (const f of REALS)
    it(f, () => {
      const old = JSON.parse(fs.readFileSync(`tests/fixtures/${f}`, 'utf8'));
      const k = (old.version < 8 ? CONFIG.v7.shift : 0) + CONFIG.v8.shift;
      const d = migrate(JSON.parse(JSON.stringify(old)));
      expect(d.version).toBe(9);
      expect(d.buildings.length).toBe(old.buildings.length);
      for (let i = 0; i < d.buildings.length; i++) expect([d.buildings[i].tx - old.buildings[i].tx, d.buildings[i].ty - old.buildings[i].ty]).toEqual([k, k]);
      S.visiting = null as never;
      S.land = d.land;
      const r = placeLayout(d.buildings.map((b: { kind: Kind; tx: number; ty: number; lvl: number; flip?: boolean }) => ({ kind: b.kind, tx: b.tx, ty: b.ty, lvl: b.lvl ?? 1, hue: null, flip: !!b.flip })), d.land);
      expect(r.dropped).toBe(0);
      expect(r.removed).toEqual([]);
      expect(world.objs.length).toBe(d.buildings.length);
    });
});
