// PACE §2 자동 사냥 여러 파티 (플래그 huntSlots): 마이그레이션 · 칸 열림 · 한 손님 한 곳 · 금화 배수 · 방치 장비 상한 · 칸별 방치 · 금화 상한 하나
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { CHAPTERS } from '../src/data/guide';
import { makeAdventurer } from '../src/world/adventurers';
import { setFlag } from '../src/world/flags';
import { gsState } from '../src/world/goldsink';
import {
  activeAutos, autoSlotOf, autoSlots, autoTick, clearStage, freeSlot, idleHunt, idleLines, setAuto, slotChapter, slotGoldX, slotsOpen, stopAuto, syncAutos,
} from '../src/world/hunt';
import { P, resetProgress, S, world, type Actor } from '../src/world/state';
import { readSave, snapshot } from '../src/save/save';
import { dismissWhy } from '../src/world/dismiss';

const H = CONFIG.hunt;
const strong = (n: number): Actor[] => Array.from({ length: n }, () => makeAdventurer(5, 5, { lvl: 60, status: 'regular' }));
/** 장부 1~n장 끝냄 */
const chapters = (n: number) => {
  P.guide.claimed = CHAPTERS.filter((c) => c.no <= n).flatMap((c) => c.missions.map((m) => m.id));
};

beforeEach(() => {
  resetProgress();
  P.hunt.best = { forest: 3, swamp: 3 };
  S.started = true as never;
  S.visiting = false as never;
  world.home = null;
  world.actors = strong(12);
  setFlag('huntSlots', false);
  setFlag('goldsinkAutoCap', false);
});
afterEach(() => {
  setFlag('huntSlots', false);
  setFlag('goldsinkAutoCap', true);
  vi.restoreAllMocks();
});

describe('마이그레이션 (옛 auto → autos[0])', () => {
  it('옛 저장(autos 없음): 불러온 뒤 autos[0] = auto · 몇 번을 해도 같다 · 세이브 버전 그대로', () => {
    P.hunt.auto = { region: 'forest', stage: 2, members: [world.actors[0].id!], n: 5, gold: 50 };
    const snap = JSON.parse(JSON.stringify(snapshot()));
    snap.buildings = [{ kind: 'inn', tx: 5, ty: 5, lvl: 1, hue: null, flip: false }];
    delete snap.progress.hunt.autos;
    expect(snap.version).toBe(CONFIG.save.version);
    localStorage.setItem(CONFIG.save.key, JSON.stringify(snap));
    const d = readSave()!;
    resetProgress(d.progress);
    expect(P.hunt.autos).toEqual([]);
    const once = JSON.stringify(syncAutos());
    expect(P.hunt.autos[0]).toBe(P.hunt.auto);
    expect(P.hunt.autos[0]).toEqual({ region: 'forest', stage: 2, members: [world.actors[0].id!], n: 5, gold: 50 });
    syncAutos();
    syncAutos();
    expect(JSON.stringify(P.hunt.autos)).toBe(once);
  });
  it('저장에는 auto(옛 앱용)와 autos 둘 다 · 다시 불러와도 같다', () => {
    setFlag('huntSlots', true);
    chapters(6);
    expect(setAuto('forest', 1, world.actors.slice(0, 3), 0)).toBeNull();
    expect(setAuto('swamp', 2, world.actors.slice(3, 6), 2)).toBeNull();
    const snap = JSON.parse(JSON.stringify(snapshot()));
    snap.buildings = [{ kind: 'inn', tx: 5, ty: 5, lvl: 1, hue: null, flip: false }];
    expect(snap.progress.hunt.auto.region).toBe('forest');
    expect(snap.progress.hunt.autos.map((x: { region: string } | null) => x?.region ?? null)).toEqual(['forest', null, 'swamp']);
    localStorage.setItem(CONFIG.save.key, JSON.stringify(snap));
    resetProgress(readSave()!.progress);
    expect(activeAutos().map((x) => [x.i, x.a.region, x.a.stage])).toEqual([
      [0, 'forest', 1],
      [2, 'swamp', 2],
    ]);
  });
  it('옛 앱이 auto만 고친 저장: auto가 기준 (autos[0]이 낡아도 auto를 따른다)', () => {
    P.hunt.auto = null;
    (P.hunt as { autos: unknown[] }).autos = [{ region: 'forest', stage: 3, members: [1], n: 9 }, { region: 'swamp', stage: 1, members: [2] }];
    syncAutos();
    expect(P.hunt.autos[0]).toBeNull();
    expect(P.hunt.autos[1]?.region).toBe('swamp');
  });
  it('망가진 칸은 비운다 · 배열이 아니면 새로', () => {
    (P.hunt as { autos: unknown }).autos = 'x';
    syncAutos();
    expect(P.hunt.autos).toEqual([null]);
    (P.hunt as { autos: unknown[] }).autos = [null, { region: 'nope', stage: 1, members: [] }, { region: 'forest' }, 3];
    syncAutos();
    expect(P.hunt.autos).toEqual([null, null, null, null]);
  });
  it('끔: 칸은 0번 하나 · 1·2번 칸은 저장에 남고 멈춰 있다', () => {
    setFlag('huntSlots', true);
    chapters(6);
    setAuto('forest', 1, world.actors.slice(0, 3), 0);
    setAuto('forest', 1, world.actors.slice(3, 6), 1);
    setFlag('huntSlots', false);
    expect(slotsOpen()).toBe(1);
    expect(autoSlots().length).toBe(1);
    const t0 = P.hunt.idleAt;
    autoTick(t0 + H.autoSeconds * 1000);
    expect(P.hunt.auto!.n).toBe(1);
    expect(P.hunt.autos[1]!.n).toBe(0);
    // 끔이면 1번 칸 손님도 다른 곳 막지 않음 (예전 그대로)
    expect(autoSlotOf(world.actors[3].id!)).toBe(-1);
    expect(dismissWhy(world.actors[0])).toMatch(/맡겨 두기/);
    expect(dismissWhy(world.actors[3])).toBeNull();
  });
});

describe('칸 열림', () => {
  it('끔이면 늘 1칸 · 켬: 기본 1 · 장부 4장 2칸 · 6장 3칸 · 최대 slotsMax', () => {
    chapters(6);
    expect(slotsOpen()).toBe(1);
    setFlag('huntSlots', true);
    chapters(0);
    expect(slotsOpen()).toBe(1);
    chapters(3);
    expect(slotsOpen()).toBe(1);
    chapters(4);
    expect(slotsOpen()).toBe(2);
    chapters(5);
    expect(slotsOpen()).toBe(2);
    chapters(6);
    expect(slotsOpen()).toBe(3);
    expect(H.slotsMax).toBe(3);
    expect([slotChapter(0), slotChapter(1), slotChapter(2)]).toEqual([null, 4, 6]);
  });
  it('안 열린 칸엔 못 맡김', () => {
    expect(setAuto('forest', 1, world.actors.slice(0, 3), 1)).toMatch(/열리지 않은/);
    setFlag('huntSlots', true);
    chapters(4);
    expect(setAuto('forest', 1, world.actors.slice(0, 3), 2)).toMatch(/열리지 않은/);
    expect(setAuto('forest', 1, world.actors.slice(0, 3), 1)).toBeNull();
    expect(freeSlot()).toBe(0);
  });
});

describe('한 손님은 한 칸에만 · 칸마다 따로', () => {
  beforeEach(() => {
    setFlag('huntSlots', true);
    chapters(6);
  });
  it('다른 칸 손님을 넣으면 막는다 · 같은 칸 다시 맡기기는 된다', () => {
    const [a, b, c, d] = world.actors;
    expect(setAuto('forest', 1, [a, b], 0)).toBeNull();
    expect(setAuto('forest', 1, [b, c], 1)).toMatch(/1칸에서 사냥 중/);
    expect(setAuto('forest', 1, [c, d], 1)).toBeNull();
    expect(setAuto('swamp', 2, [a, b], 0)).toBeNull();
    expect(autoSlotOf(c.id!)).toBe(1);
    expect(autoSlotOf(c.id!, 1)).toBe(-1);
    expect(dismissWhy(c)).toMatch(/맡겨 두기/);
  });
  it('같은 스테이지 중복 OK · 맡기는 조건(추천 × autoRatio)은 칸마다', () => {
    const weak = makeAdventurer(5, 5, { lvl: 1, status: 'regular' });
    world.actors.push(weak);
    P.hunt.best.swamp = 10;
    expect(setAuto('forest', 1, world.actors.slice(0, 3), 0)).toBeNull();
    expect(setAuto('forest', 1, world.actors.slice(3, 6), 1)).toBeNull();
    expect(setAuto('swamp', 10, [weak], 2)).toMatch(/전투력이 부족/);
  });
  it('멈추기는 그 칸만 · 원정 나간 칸은 그 칸만 멈춘다', () => {
    setAuto('forest', 1, world.actors.slice(0, 3), 0);
    setAuto('forest', 1, world.actors.slice(3, 6), 1);
    setAuto('forest', 1, world.actors.slice(6, 9), 2);
    stopAuto('user', 1);
    expect(activeAutos().map((x) => x.i)).toEqual([0, 2]);
    for (const m of world.actors.slice(6, 9)) m.runId = 99;
    autoTick(P.hunt.idleAt + H.autoSeconds * 1000);
    expect(activeAutos().map((x) => x.i)).toEqual([0]);
    expect(P.hunt.auto!.n).toBe(1);
  });
});

describe('보상', () => {
  beforeEach(() => {
    setFlag('huntSlots', true);
    chapters(6);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  it('1칸 금화 그대로 · 2·3칸 ×slotGold (하루 금화 감소에서 빠짐 · B안) · 재료는 같다', () => {
    expect([slotGoldX(0), slotGoldX(1), slotGoldX(2)]).toEqual([1, H.slotGold, H.slotGold]);
    const ms = world.actors.slice(0, 3);
    const a = clearStage('forest', 2, ms, 1, true, true);
    const b = clearStage('forest', 2, ms, 1, true, true, H.slotGold);
    expect(Math.abs(b.gold - a.gold * H.slotGold)).toBeLessThanOrEqual(1);
    expect(b.mats).toBe(a.mats);
    // B안(형철): 하루 판 수(taper)는 1칸만 센다 — 2·3칸은 세지도 받지도 않음 → 1칸은 칸을 늘려도 지금과 같다
    setFlag('goldsinkAutoCap', true);
    const g = gsState();
    g.autoN = 0;
    setAuto('forest', 2, world.actors.slice(0, 3), 0);
    setAuto('forest', 2, world.actors.slice(3, 6), 1);
    setAuto('forest', 2, world.actors.slice(6, 9), 2);
    autoTick(P.hunt.idleAt + H.autoSeconds * 1000);
    expect(g.autoN).toBe(1);
    const [s0, s1, s2] = P.hunt.autos;
    // 파티가 달라 조합 금화 보너스가 조금 다를 수 있다 (±10%)
    expect(s1!.gold! / s0!.gold!).toBeCloseTo(H.slotGold, 1);
    expect(s2!.gold! / s0!.gold!).toBeCloseTo(H.slotGold, 1);
    expect(s1!.mats).toBe(s0!.mats);
  });
  it('autoTick은 칸 전부를 한 번에 · 돌려준 값 = 합', () => {
    setAuto('forest', 1, world.actors.slice(0, 3), 0);
    setAuto('swamp', 1, world.actors.slice(3, 6), 1);
    const g0 = S.gold;
    const r = autoTick(P.hunt.idleAt + H.autoSeconds * 1000)!;
    expect(r.gold).toBe(S.gold - g0);
    expect(P.hunt.autos.slice(0, 2).map((x) => x!.n)).toEqual([1, 1]);
    expect(P.mats.swamp).toBeGreaterThan(0);
    expect(P.mats.forest).toBeGreaterThan(0);
  });
});

describe('방치 (꺼져 있던 동안)', () => {
  beforeEach(() => {
    setFlag('huntSlots', true);
    chapters(6);
    setAuto('forest', 2, world.actors.slice(0, 3), 0);
    setAuto('forest', 2, world.actors.slice(3, 6), 1);
    setAuto('swamp', 2, world.actors.slice(6, 9), 2);
  });
  it('칸마다 한 줄 · 같은 판 수 · 2·3칸 금화 ×slotGold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const h = idleHunt(8 * 3600, Infinity)!;
    const lines = idleLines(h);
    expect(lines.length).toBe(3);
    const per = Math.floor(((8 * 3600) / H.autoSeconds) * H.idleRate);
    expect(lines.map((l) => l.clears)).toEqual([per, per, per]);
    expect(h.clears).toBe(per * 3);
    expect(lines.map((l) => l.region)).toEqual(['forest', 'forest', 'swamp']);
    expect(Math.abs(lines[1].gold - lines[0].gold * H.slotGold)).toBeLessThanOrEqual(per);
    expect(h.gold).toBe(lines.reduce((t, l) => t + l.gold, 0));
    expect(h.mats).toBe(lines.reduce((t, l) => t + l.mats, 0));
  });
  it('방치 장비 idleItemsMax는 칸 전체 합쳐서', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const h = idleHunt(8 * 3600, Infinity)!;
    const n = Object.values(h.items).reduce((t, v) => t + (v ?? 0), 0);
    expect(n).toBe(H.idleItemsMax);
    expect(idleLines(h).reduce((t, l) => t + Object.values(l.items).reduce((s, v) => s + (v ?? 0), 0), 0)).toBe(H.idleItemsMax);
  });
  it('방치 금화 상한은 칸 전체 하나 · 칸별 줄 합 = 상한 · 금고에도 상한만큼', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const g0 = S.gold;
    const h = idleHunt(8 * 3600, 100)!;
    expect(h.gold).toBe(100);
    expect(idleLines(h).reduce((t, l) => t + l.gold, 0)).toBe(100);
    expect(S.gold - g0).toBe(100);
  });
  it('끔: 0번 칸만 · 줄 하나 (예전 모양: slots 없음)', () => {
    setFlag('huntSlots', false);
    const h = idleHunt(8 * 3600, Infinity)!;
    expect(h.slots).toBeUndefined();
    expect(h.label).toMatch(/1-2$/);
    expect(idleLines(h).length).toBe(1);
  });
});

describe('소스: 판마다 훅은 한 곳', () => {
  it('autoTick → autoRun 한 곳에서 clearStage', () => {
    const src = fs.readFileSync('src/world/hunt.ts', 'utf8');
    expect(src.match(/clearStage\(a\.region as RegionId, a\.stage/g)?.length).toBe(1);
    expect(src).toMatch(/function autoRun\(a: HuntAuto, slot: number\)/);
  });
});
