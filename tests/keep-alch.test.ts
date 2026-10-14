// 물약 재료 남겨 두기 (형철 제보 · 로또1등 여관): 주점 손님이 당근·호박·양배추·밀을 다 먹어 물약을 못 만들던 것
//  남겨 두는 수 = 작물마다 「물약 하나에 드는 가장 많은 수 × 물약 칸(공방 레벨)」 · 넘는 것만 먹는다 · 공방이 없으면 예전처럼
import fs from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import type { Kind } from '../src/data/catalog';
import { migrate } from '../src/save/save';
import { addCrop, alchReserve, canBrew, cropSpare, potionSlots, takeMeal, tavernAteToday } from '../src/world/facilities';
import { makeBait } from '../src/world/fishing';
import { addObj, placeLayout, rebuildPaths, startTown } from '../src/world/town';
import { P, resetProgress, S } from '../src/world/state';

const VEG = ['carrot', 'pumpkin', 'cabbage', 'wheat'] as const;
const put = (k: string, lvl: number) => addObj(k as never, 2, 2, { lvl });
function fresh() {
  S.visiting = false as never;
  S.land = 5;
  startTown();
  rebuildPaths();
  P.crops = {};
  P.potions = {};
  P.pantry = 0;
  P.keepAlch = true;
  P.tavernAte = { day: '', n: {} };
}

describe('물약 재료 남겨 두기 — 남겨 두는 수', () => {
  beforeEach(fresh);
  it('공방이 없으면 0 (예전처럼 다 먹음)', () => {
    for (const c of VEG) expect(alchReserve(c)).toBe(0);
    addCrop('carrot', 3);
    expect(takeMeal()).toBe(true);
    expect(takeMeal()).toBe(true);
    expect(takeMeal()).toBe(true);
    expect(takeMeal()).toBe(false);
    expect(P.crops.carrot).toBe(0);
  });
  it('물약 하나에 드는 가장 많은 수 × 칸 (Lv.5 = 칸 5)', () => {
    put('alchemy', 5);
    expect(potionSlots()).toBe(5);
    const need = (c: string) => Math.max(...Object.values(CONFIG.potions.list).map((r) => r.need[c] ?? 0));
    expect(need('carrot')).toBe(2);
    expect(need('cabbage')).toBe(3);
    expect(alchReserve('carrot')).toBe(10);
    expect(alchReserve('pumpkin')).toBe(10);
    expect(alchReserve('cabbage')).toBe(15);
    expect(alchReserve('wheat')).toBe(10);
    expect(alchReserve('herb')).toBe(15);
    expect(alchReserve('starflower')).toBe(5);
  });
  it('Lv.1 = 칸 1 · 끄면 0', () => {
    put('alchemy', 1);
    expect(alchReserve('cabbage')).toBe(3);
    P.keepAlch = false;
    expect(alchReserve('cabbage')).toBe(0);
  });
});

describe('주점 식사', () => {
  beforeEach(fresh);
  it('남겨 둔 몫 위로만 먹는다 · 가장 많이 남는 것부터 · 오늘 먹은 수를 센다', () => {
    put('alchemy', 2); // 당근·호박·밀 4 · 양배추 6
    addCrop('carrot', 7);
    addCrop('cabbage', 7);
    expect(cropSpare('carrot')).toBe(3);
    expect(cropSpare('cabbage')).toBe(1);
    let n = 0;
    while (takeMeal()) n++;
    expect(n).toBe(4);
    expect(P.crops.carrot).toBe(4);
    expect(P.crops.cabbage).toBe(6);
    expect(tavernAteToday('carrot')).toBe(3);
    expect(tavernAteToday('cabbage')).toBe(1);
    expect(tavernAteToday()).toBe(4);
    // 남겨 둔 만큼은 물약을 만들 수 있다
    addCrop('herb', 3);
    expect(canBrew('power')).toBeNull();
  });
  it('옛 채소(pantry)는 먼저 · 다 막히면 false (= 예전 「식사 없음」 처리)', () => {
    put('alchemy', 5);
    P.pantry = 2;
    addCrop('carrot', 10);
    expect(takeMeal()).toBe(true);
    expect(takeMeal()).toBe(true);
    expect(P.pantry).toBe(0);
    expect(takeMeal()).toBe(false);
    expect(P.crops.carrot).toBe(10);
  });
  it('끄면 예전처럼 다 먹는다', () => {
    put('alchemy', 5);
    P.keepAlch = false;
    addCrop('wheat', 4);
    while (takeMeal());
    expect(P.crops.wheat).toBe(0);
  });
  it('약초·별꽃은 여전히 안 먹음', () => {
    addCrop('herb', 50);
    addCrop('starflower', 50);
    expect(takeMeal()).toBe(false);
  });
  it('날이 바뀌면 오늘 먹은 수는 0부터', () => {
    P.tavernAte = { day: '2000-1-1', n: { carrot: 9 } };
    expect(tavernAteToday('carrot')).toBe(0);
    addCrop('carrot', 1);
    takeMeal();
    expect(P.tavernAte.n).toEqual({ carrot: 1 });
  });
});

describe('미끼 만들기', () => {
  beforeEach(fresh);
  it('알아서 고를 땐 남겨 둔 몫은 빼고 · 직접 고르면 그대로', () => {
    put('alchemy', 5);
    addCrop('herb', 16);
    addCrop('carrot', 10);
    const extra = P.growth.fish.extra;
    expect(makeBait()).toBeNull();
    expect(P.crops.herb).toBe(15);
    expect(makeBait()).toMatch(/남겨 둔/);
    expect(makeBait('carrot')).toBeNull();
    expect(P.crops.carrot).toBe(9);
    expect(P.growth.fish.extra).toBe(extra + 2);
  });
  it('공방이 없으면 예전처럼 가장 많은 것부터', () => {
    addCrop('herb', 3);
    addCrop('wheat', 5);
    expect(makeBait()).toBeNull();
    expect(P.crops.wheat).toBe(4);
  });
});

describe('저장', () => {
  it('옛 저장(칸 없음)은 켬 · 끈 저장은 끈 채로', () => {
    const v6 = JSON.parse(fs.readFileSync('tests/fixtures/v6.json', 'utf8'));
    const d = migrate(v6);
    resetProgress(d.progress);
    expect(P.keepAlch).toBe(true);
    expect(P.tavernAte).toEqual({ day: '', n: {} });
    resetProgress({ ...d.progress, keepAlch: false });
    expect(P.keepAlch).toBe(false);
  });
});

// 실제 저장 (로컬 전용): 형철 · 로또1등 여관 (공방 Lv.5 · 주점 Lv.6 ×2 · 하루 식사 ≈120번)
const LOTTE = 'tests/fixtures/real_hyeongcheol.json';
describe.skipIf(!fs.existsSync(LOTTE))('실제 저장 리플레이 — 로또1등 여관 하루', () => {
  function load() {
    const d = migrate(JSON.parse(fs.readFileSync(LOTTE, 'utf8')));
    resetProgress(d.progress);
    S.visiting = null as never;
    S.land = d.land;
    placeLayout(d.buildings.map((b: { kind: Kind; tx: number; ty: number; lvl: number }) => ({ kind: b.kind, tx: b.tx, ty: b.ty, lvl: b.lvl ?? 1, hue: null })), d.land);
    return d;
  }
  /**
   * 게임 하루(현실 24분) — 저장의 평균 식사 수(누적 식사 ÷ 일수)를 시간마다 고르게 · 밭 6칸에 채소를 심어
   *  자라는 시간마다 거둔다 (현실 1분 = 게임 1시간 · 하루보다 오래 걸리는 건 한낮에 한 번)
   */
  function day(d: ReturnType<typeof load>) {
    const perDay = Math.round(d.progress.counters.tavernMeals / d.day);
    const plots = ['carrot', 'carrot', 'pumpkin', 'cabbage', 'wheat', 'wheat'];
    const got: Record<string, number> = {};
    let meals = 0, produce = 0;
    for (let m = 1; m <= 24; m++) {
      for (const c of plots) {
        const g = CONFIG.garden.crops[c];
        if (m % g.minutes === 0 || (g.minutes > 24 && m === 12)) (addCrop(c, g.yield), (got[c] = (got[c] ?? 0) + g.yield));
      }
      const k = Math.round((perDay * m) / 24) - Math.round((perDay * (m - 1)) / 24);
      for (let i = 0; i < k; i++) (meals++, takeMeal() && produce++);
    }
    return { perDay, got, meals, produce };
  }
  it('켬: 하루가 지나도 당근·호박·양배추·밀이 남는다 (거둔 만큼 · 남겨 두는 수까지)', () => {
    const d = load();
    expect(potionSlots()).toBe(5);
    expect(P.keepAlch).toBe(true);
    const crops0 = { ...P.crops };
    const r = day(d);
    expect(r.perDay).toBeGreaterThan(100);
    for (const c of VEG) {
      expect(r.got[c], c).toBeGreaterThan(0);
      expect(P.crops[c], c).toBeGreaterThan(0);
      expect(P.crops[c], c).toBe(Math.min(alchReserve(c), (crops0[c] ?? 0) + r.got[c]));
    }
    // 약초·별꽃은 그대로
    expect(P.crops.herb).toBe(crops0.herb);
    expect(P.crops.starflower).toBe(crops0.starflower);
    expect(canBrew('power')).toMatch(/약초/); // 이 저장은 약초 0 — 당근은 있다
    expect(canBrew('rest')).toBeNull();
    console.log(`로또1등 하루: 식사 ${r.meals} · 작물 식사 ${r.produce} · 거둔 ${JSON.stringify(r.got)} · 남음 ${JSON.stringify(P.crops)} · 주점이 먹은 ${JSON.stringify(P.tavernAte.n)}`);
  });
  it('끔(예전): 같은 하루에 채소가 0 — 제보 재현', () => {
    const d = load();
    P.keepAlch = false;
    const r = day(d);
    for (const c of VEG) expect(P.crops[c] ?? 0, c).toBe(0);
    console.log(`로또1등 하루(끔): 식사 ${r.meals} · 작물 식사 ${r.produce}`);
  });
});
