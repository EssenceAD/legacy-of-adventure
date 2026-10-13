// v0.25.2 §I: #19 손님 정렬 ★ 고정 · 게시판 레벨업(파티 = 2 + Lv, 최대 4 → Lv.2 끝 · 옛 Lv.3 저장 그대로 「최대」)
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { manualLines } from '../src/ui/menu';
import { setLab } from '../src/world/visual';
import { def } from '../src/data/catalog';
import { sortGuests } from '../src/world/growth';
import { addObj, maxLevel, nextLevelCost, rebuildPaths, startTown } from '../src/world/town';
import { boardState, fullPartyHint, maxParties, sendParty } from '../src/world/expeditions';
import { setFlag } from '../src/world/flags';
import { P, S, world, type Run } from '../src/world/state';
import * as game from '../src/game';

describe('#19 손님 정렬 · ★ 맨 위 고정', () => {
  const L = [
    { id: 1, lvl: 5 },
    { id: 2, lvl: 30 },
    { id: 3, lvl: 12 },
    { id: 4, lvl: 20 },
    { id: 5, lvl: 1 },
  ];
  const key = (a: { lvl: number }) => a.lvl;
  it('고정 켬: ★ 묶음이 먼저 — ★끼리도 정렬 기준대로 (★한 순서 아님)', () => {
    // ★한 순서 = 5, 3 → 예전엔 5(Lv1)가 3(Lv12)보다 위였다 (「정렬이 안 돼요」)
    expect(sortGuests(L, key, [5, 3], true).map((a) => a.id)).toEqual([3, 5, 2, 4, 1]);
  });
  it('고정 끔: ★도 섞여 정렬 · 같으면 ★ 먼저', () => {
    expect(sortGuests(L, key, [5, 3], false).map((a) => a.id)).toEqual([2, 4, 3, 1, 5]);
    const tie = [{ id: 1, lvl: 3 }, { id: 2, lvl: 3 }];
    expect(sortGuests(tie, key, [2], false).map((a) => a.id)).toEqual([2, 1]);
  });
  it('원본은 그대로 · ★ 없으면 고정 켬/끔 같음', () => {
    const copy = L.map((a) => a.id);
    sortGuests(L, key, [], true);
    expect(L.map((a) => a.id)).toEqual(copy);
    expect(sortGuests(L, key, [], true)).toEqual(sortGuests(L, key, [], false));
  });
});

describe('게시판 레벨업', () => {
  beforeAll(() => setFlag('boardLevelUp', true));
  afterAll(() => setFlag('boardLevelUp', false));
  beforeEach(() => {
    if (!document.getElementById('over')) document.body.insertAdjacentHTML('beforeend', '<div id="over"></div><div id="scrim"></div><div id="win"></div><button id="winBack"></button><div id="winB"></div><div id="toast"></div>');
    S.visiting = false as never;
    S.started = true as never;
    S.land = 5;
    startTown();
    for (const o of world.objs.filter((x) => x.kind === 'board')) world.objs.splice(world.objs.indexOf(o), 1);
    rebuildPaths();
    P.runs = [];
  });
  const run = (id: number) => ({ id, members: [], quest: {} as never, start: 0, end: 1e15, result: null }) as unknown as Run;

  it('catalog: levels [300] → 최대 Lv.2 · 플래그 끄면 예전 표 (실험실 켜면 새 표)', () => {
    expect(def('board').levels).toEqual([300]);
    expect(maxLevel('board')).toBe(2);
    setFlag('boardLevelUp', false);
    try {
      expect(def('board').levels).toEqual([300, 800, 1600]);
      setLab(true);
      expect(def('board').levels).toEqual([300]);
    } finally {
      setLab(false);
      setFlag('boardLevelUp', true);
    }
  });
  it('파티 = 2 + 게시판 Lv · 없음 → 짓기 안내 · Lv.1 → Lv.2로 · Lv.2 → 최대', () => {
    expect(boardState().state).toBe('none');
    expect(maxParties()).toBe(2);
    expect(fullPartyHint()).toBe('게시판을 지으면 1파티 더');
    const b = addObj('board', 3, 3);
    expect(maxParties()).toBe(3);
    expect(boardState()).toMatchObject({ state: 'up', lv: 1, cost: 300 });
    expect(fullPartyHint()).toBe('게시판을 Lv.2로 올리면 1파티 더');
    b.lvl = 2;
    expect(maxParties()).toBe(4);
    expect(boardState().state).toBe('max');
    expect(nextLevelCost(b)).toBeNull();
    expect(fullPartyHint()).toBe('지금은 4파티가 최대예요');
  });
  it('옛 저장 Lv.3·4 게시판: 레벨은 그대로 · 파티 4 · 표시 「최대」 · 더 못 올림', () => {
    const b = addObj('board', 3, 3, { lvl: 3 });
    expect(b.lvl).toBe(3);
    expect(maxParties()).toBe(4);
    expect(boardState()).toMatchObject({ state: 'max', lv: 3 });
    S.gold = 1e6;
    game.upgrade(b);
    expect(b.lvl).toBe(3);
    expect(b.con).toBeFalsy();
  });
  it('레벨업은 다른 건물과 같은 공사 규칙 (금화 · 공사 · 끝나면 Lv.2)', () => {
    const b = addObj('board', 3, 3);
    S.gold = 1000;
    game.upgrade(b);
    expect(S.gold).toBe(700);
    expect(b.con?.to).toBe(2);
    expect(boardState().state).toBe('con');
    expect(fullPartyHint()).toBe('게시판 공사가 끝나면 1파티 더');
  });
  it('꽉 찼을 때 출발 막힘 문구 = 안내 문구 (플래그 끄면 예전 문구)', () => {
    addObj('board', 3, 3);
    P.runs = [run(1), run(2), run(3)];
    expect(sendParty({} as never, [])).toBe('동시에 3파티까지 · 게시판을 Lv.2로 올리면 1파티 더');
    setFlag('boardLevelUp', false);
    try {
      expect(sendParty({} as never, [])).toBe('동시에 3파티까지 보낼 수 있어요 (게시판 레벨업)');
    } finally {
      setFlag('boardLevelUp', true);
    }
  });
});


describe('안내서 줄 (@플래그 · !플래그)', () => {
  it('꺼짐: 예전 줄만 · 켬(실험실): 새 줄만', () => {
    const L = ['보통 줄', '!autoPathNone 예전', '@autoPathNone 새 줄'];
    expect(manualLines(L)).toEqual(['보통 줄', '예전']);
    setLab(true);
    try {
      expect(manualLines(L)).toEqual(['보통 줄', '새 줄']);
    } finally {
      setLab(false);
    }
  });
});
