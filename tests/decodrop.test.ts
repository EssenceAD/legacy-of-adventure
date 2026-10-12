// DECO_DROP: 41종 값·열림(CONFIG.deco) · 땅 단계별 수 · 눈사람 계절 · 장식 도감(마을·보관함·산 기록) · 보상 한 번 · 건설 목록
import { beforeEach, describe, expect, it } from 'vitest';
import { def } from '../src/data/catalog';
import { CONFIG } from '../src/data/config';
import { addObj, buildableKinds, startTown } from '../src/world/town';
import { bookSteps, claimBook, DROP_KINDS, groupOf, newAtLand, noteBought, openDrops, ownedDrops, seasonLock } from '../src/world/decodrop';
import { putAway } from '../src/world/store';
import { P, S, world } from '../src/world/state';

beforeEach(() => {
  S.visiting = false as never;
  S.land = 5;
  startTown();
  world.actors = [];
  P.decor = { autoPath: true, paint: {}, store: [], recent: [], hintSeen: false, round: {}, noPath: {}, seen: [], owned: [], bookGot: [] };
});

describe('값·열림', () => {
  it('41종 · 값과 땅 단계는 CONFIG.deco 그대로', () => {
    expect(DROP_KINDS.length).toBe(41);
    expect(def('hedge').cost).toBe(120);
    expect(def('hedge').unlock).toBe(2);
    expect(def('windmill').cost).toBe(6000);
    expect(def('windmill').unlock).toBe(5);
    expect(def('snowman').cost).toBe(CONFIG.deco.seasonal.snowman.cost);
  });
  it('땅 단계별 열리는 수 (계절 빼고) 0 / 7 / 19 / 31 / 40', () => {
    expect([1, 2, 3, 4, 5].map((l) => openDrops(l).filter((k) => k !== 'snowman').length)).toEqual([0, 7, 19, 31, 40]);
    expect([2, 3, 4, 5].map(newAtLand)).toEqual([7, 12, 12, 9]);
  });
  it('눈사람은 12~2월에만', () => {
    expect(seasonLock('snowman', new Date(2026, 0, 10))).toBeNull();
    expect(seasonLock('snowman', new Date(2026, 9, 10))).not.toBeNull();
    expect(seasonLock('hedge', new Date(2026, 9, 10))).toBeNull();
  });
  it('건설 목록에 들어온다 (쇼케이스 전용 아님) · 묶음 탭', () => {
    const b = buildableKinds();
    expect(b).toContain('gazebo');
    expect(b).toContain('hedge');
    expect(groupOf('beehives')).toBe('동물');
    expect(groupOf('maple')).toBe('나무');
  });
  it('용 뼈 화석은 별의 심연 10 전엔 목록에 없다', () => {
    P.hunt.best.abyss = 9;
    expect(buildableKinds()).not.toContain('dragon_fossil');
    P.hunt.best.abyss = 10;
    expect(buildableKinds()).toContain('dragon_fossil');
  });
});

describe('장식 도감', () => {
  it('마을·보관함·산 기록을 모두 센다 (넣어 둬도 그대로)', () => {
    const o = addObj('hedge', 3, 3);
    expect(ownedDrops()).toContain('hedge');
    putAway([o]);
    expect(ownedDrops()).toContain('hedge');
    noteBought('maple');
    expect(ownedDrops()).toEqual(expect.arrayContaining(['hedge', 'maple']));
  });
  it('10종 보상은 한 번 · 칭호는 20종부터', () => {
    P.decor.owned = DROP_KINDS.slice(0, 10);
    const g = S.gold;
    expect(claimBook(0)?.gold).toBe(CONFIG.deco.book[0].gold);
    expect(S.gold).toBe(g + CONFIG.deco.book[0].gold);
    expect(claimBook(0)).toBeNull();
    expect(claimBook(1)).toBeNull();
    P.decor.owned = DROP_KINDS.slice(0, 20);
    expect(claimBook(1)?.title).toBe('꾸밈의 손');
    expect(P.titles).toContain('꾸밈의 손');
    expect(bookSteps()[1].got).toBe(true);
  });
});
