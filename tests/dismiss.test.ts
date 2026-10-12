// FEEDBACK: 손님 내보내기 — 체크아웃(평판 그대로) · 단골 작별(장비 가방으로 · 옛 단골 · 추억) · 3일 안 다시 부르기(레벨·장비 그대로) · 못 내보내는 손님
import { beforeEach, describe, expect, it } from 'vitest';
import { makeAdventurer } from '../src/world/adventurers';
import { checkout, dismissWhy, farewell, formerList, recall } from '../src/world/dismiss';
import { equip, makeItem } from '../src/world/items';
import { P, S, resetProgress, world } from '../src/world/state';
import { addObj, rebuildPaths } from '../src/world/town';

beforeEach(() => {
  resetProgress();
  world.actors.length = 0;
  world.objs.length = 0;
  S.started = true as never;
  S.visiting = false as never;
  S.land = 3;
  document.body.innerHTML = '<div id="toast"></div><div id="over"></div>';
  addObj('inn', 8, 8);
  addObj('cottage', 14, 8);
  rebuildPaths();
});
const guest = (status: 'visitor' | 'regular' | 'passer', id: number, lvl = 12) => {
  const a = makeAdventurer(10, 12, { kind: 'knight', race: 'human', lvl, status });
  a.id = id;
  world.actors.push(a);
  return a;
};

describe('내보내기', () => {
  it('방문 손님 체크아웃: 떠남 · 평판 그대로', () => {
    const a = guest('visitor', 1);
    P.rep = 50;
    expect(checkout(a)).toBe(true);
    expect(a.leaving).toBe(true);
    expect(P.rep).toBe(50);
  });
  it('단골 작별: 장비는 가방으로 · 옛 단골 · 추억 이름 · 3일 안 다시 부르기 → 레벨·장비 그대로', () => {
    const a = guest('regular', 7, 25);
    const it = makeItem('forest', 'r', 'weapon');
    P.bag.push(it);
    equip(a, it);
    expect(it.owner).toBe(7);
    expect(farewell(a)).toBeTruthy();
    expect(it.owner).toBeNull();
    expect(formerList().map((x) => x.id)).toEqual([7]);
    expect(P.farewells).toContain(a.name);
    world.actors.length = 0;
    expect(recall(7)).toBeNull();
    const b = world.actors.find((x) => x.id === 7)!;
    expect(b.status).toBe('regular');
    expect(b.lvl).toBe(25);
    expect(b.equip.weapon).toBe(it.id);
    expect(formerList().length).toBe(0);
  });
  it('3일이 지나면 옛 단골에서 사라짐', () => {
    const a = guest('regular', 9);
    farewell(a);
    expect(formerList(Date.now() + 2.9 * 864e5).length).toBe(1);
    expect(formerList(Date.now() + 3.1 * 864e5).length).toBe(0);
  });
  it('못 내보내는 손님: 영웅·전설 · 원정 중 · 카메오', () => {
    const h = guest('regular', 2);
    h.heroId = 'oswin';
    expect(dismissWhy(h)).toMatch(/영웅/);
    const r = guest('regular', 3);
    r.runId = 1;
    expect(dismissWhy(r)).toMatch(/원정/);
    expect(farewell(r)).toBeNull();
    const c = guest('passer', 4);
    c.cameo = 'woongs' as never;
    expect(dismissWhy(c)).toMatch(/개척자/);
  });
});
