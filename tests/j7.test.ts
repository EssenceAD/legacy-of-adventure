// CHECKIN §J7 대장간 한 화면 (smithOne): 「지금 할 만한 것」 고르기 · 장비 칸 → 행동 판 · 영웅 줄 / 가방 장비 (잃는 것 없게)
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { makeAdventurer, powerOf } from '../src/world/adventurers';
import { enhanceCost, regionBoss } from '../src/world/craft';
import { FLAG_DEFAULTS } from '../src/world/flags';
import { bagSize, equip, makeItem } from '../src/world/items';
import { bagGear, slotAction, smithHeroes, smithPicks } from '../src/world/smithOne';
import { P, resetProgress, S, world, type Actor, type Item } from '../src/world/state';
import { addObj, rebuildPaths, startTown } from '../src/world/town';

const SM = CONFIG.smith;
const mk = (name: string, lvl = 5): Actor => {
  const a = makeAdventurer(5, 5, { status: 'regular' } as never);
  a.id = P.nextAdvId++;
  a.name = name;
  a.lvl = lvl;
  world.actors.push(a);
  return a;
};
const gear = (a: Actor | null, slot: 'weapon' | 'armor' | 'acc', enh: number, grade: 'n' | 'r' | 'e' = 'n'): Item => {
  const it = makeItem('forest', grade, slot, false);
  it.enh = enh;
  P.bag.push(it);
  if (a) equip(a, it);
  return it;
};
let smith: ReturnType<typeof addObj>;
beforeEach(() => {
  resetProgress();
  S.visiting = false as never;
  S.land = 5;
  startTown();
  smith = addObj('smith', 20, 20, { lvl: 5 });
  rebuildPaths();
  world.actors = world.actors.filter((a) => a.role);
  P.bag = [];
  S.gold = 10_000_000;
  for (const g of ['n', 'r', 'e', 'l', 'a'] as const) P.dust[g] = 1_000_000;
  P.mats.forest = 10_000;
  P.bossMats[regionBoss('forest').id] = 10_000;
  P.growth.favs = [];
});

describe('§J7 플래그', () => {
  it('smithOne 기본 꺼짐 (형철 확인 전 · 실험실)', () => {
    expect(FLAG_DEFAULTS.smithOne).toBe(false);
  });
});

describe('§J7 장비 칸 → 행동 판', () => {
  it('빈 칸 → 고르기만', () => {
    expect(slotAction(undefined).main).toBe('empty');
  });
  it('+10 미만 → 강화 (성공률 · 가루 모자라면 회색)', () => {
    const it = gear(null, 'weapon', 3);
    const a = slotAction(it);
    expect(a.main).toBe('enhance');
    expect(a.short).toBe(false);
    expect(a.rate).toBeGreaterThan(0);
    P.dust.n = enhanceCost(it) - 1;
    expect(slotAction(it).short).toBe(true);
  });
  it('+10 → 초월 (대장간 Lv.5부터 · 아래면 잠김) · +20 최고', () => {
    const it = gear(null, 'weapon', SM.maxEnhance);
    expect(slotAction(it).main).toBe('transcend');
    smith.lvl = SM.transcend.smithLv - 1;
    expect(slotAction(it).main).toBe('locked');
    smith.lvl = SM.transcend.smithLv;
    it.enh = SM.transcend.max;
    expect(slotAction(it).main).toBe('max');
  });
  it('초월 비용(금화) 모자라면 회색', () => {
    const it = gear(null, 'weapon', SM.maxEnhance);
    S.gold = 0;
    expect(slotAction(it)).toMatchObject({ main: 'transcend', short: true });
  });
  it('재련: 옵션 있는 희귀 이상만 (재련 탭과 같은 기준)', () => {
    const n = gear(null, 'weapon', 0, 'n');
    const r = gear(null, 'armor', 0, 'r');
    r.opts = [{ k: 'atkPct', v: 3 }];
    const r0 = gear(null, 'acc', 0, 'r');
    r0.opts = [];
    expect(slotAction(n).reforge).toBe(false);
    expect(slotAction(r).reforge).toBe(true);
    expect(slotAction(r0).reforge).toBe(false);
  });
  it('숫돌을 켜면 성공률이 오른다', () => {
    const it = gear(null, 'weapon', 8);
    expect(slotAction(it, true).rate).toBeGreaterThan(slotAction(it, false).rate);
  });
});

describe('§J7 영웅 줄 · 가방 장비', () => {
  it('★ 먼저(★한 순서) → 전투력', () => {
    const a = mk('약한', 1);
    const b = mk('센', 30);
    const c = mk('별', 2);
    const byPw = [a, b, c].sort((p, q) => powerOf(q) - powerOf(p)).map((x) => x.name);
    expect(smithHeroes().map((x) => x.name)).toEqual(byPw);
    P.growth.favs = [a.id, c.id];
    expect(smithHeroes().map((x) => x.name)).toEqual(['약한', '별', '센']);
  });
  it('모든 장비가 영웅 칸이나 「가방 장비」 중 한 곳에 (주인 없는 끼운 장비도)', () => {
    const a = mk('브롬');
    gear(a, 'weapon', 2);
    gear(null, 'armor', 0);
    const orphan = gear(null, 'acc', 0);
    orphan.owner = 9999;
    const heroes = smithHeroes();
    const onHero = heroes.flatMap((h) => P.bag.filter((it) => it.owner === h.id));
    const bag = bagGear(heroes);
    expect(new Set([...onHero, ...bag]).size).toBe(P.bag.length);
    expect(bag).toContain(orphan);
  });
});

describe('§J7 「지금 할 만한 것」', () => {
  it('없으면 빈 줄 · 최대 2개', () => {
    expect(smithPicks()).toEqual([]);
    const a = mk('브롬');
    gear(a, 'weapon', 6);
    P.growth.favs = [a.id];
    const p = smithPicks();
    expect(p.length).toBeLessThanOrEqual(2);
    expect(p[0]).toMatchObject({ kind: 'enhance', tab: 0, hero: a.id, slot: 'weapon' });
    expect(p[0].text).toMatch(/^브롬 무기 \+7 가능 \(성공 \d+%\)$/);
  });
  it('가방 꽉 참 → 맨 앞 · 분해 개수 = 「일반·희귀 한 번에」 대상', () => {
    const a = mk('브롬');
    gear(a, 'weapon', 2);
    P.growth.favs = [a.id];
    P.salvage.keepBest = false;
    for (let i = 0; i < bagSize(); i++) gear(null, 'armor', 0);
    const p = smithPicks();
    expect(p[0]).toMatchObject({ kind: 'bag', tab: 2 });
    expect(p[0].text).toBe(`가방 꽉 참 — 일반·희귀 ${bagSize()}개 분해`);
    expect(p[1].kind).toBe('enhance');
  });
  it('★ 영웅 +10 → 초월 가능 (강화보다 앞) · 2개까지만', () => {
    const a = mk('브롬');
    gear(a, 'weapon', SM.maxEnhance);
    gear(a, 'armor', 4);
    P.growth.favs = [a.id];
    for (let i = 0; i < bagSize(); i++) gear(null, 'acc', 0);
    const p = smithPicks();
    expect(p.map((x) => x.kind)).toEqual(['bag', 'transcend']);
    expect(p[1]).toMatchObject({ hero: a.id, slot: 'weapon' });
    expect(p[1].text).toContain('+10 → 초월 가능');
  });
  it('★ 영웅 장비가 비싸서 못 하면 다른 영웅 · 가루가 모자라면 안 뜸', () => {
    const fav = mk('별');
    const it = gear(fav, 'weapon', 9);
    const other = mk('브롬');
    gear(other, 'weapon', 1, 'r');
    P.growth.favs = [fav.id];
    P.dust.n = enhanceCost(it) - 1;
    const p = smithPicks();
    expect(p[0]).toMatchObject({ kind: 'enhance', hero: other.id });
    P.dust.r = 0;
    expect(smithPicks()).toEqual([]);
  });
  it('★끼리는 ★한 순서 먼저 · 같은 영웅이면 성공률 높은(낮은 단계) 것', () => {
    const a = mk('가');
    const b = mk('나');
    gear(a, 'weapon', 8);
    gear(a, 'armor', 2);
    gear(b, 'weapon', 0);
    P.growth.favs = [a.id, b.id];
    expect(smithPicks()[0]).toMatchObject({ hero: a.id, slot: 'armor' });
  });
});
