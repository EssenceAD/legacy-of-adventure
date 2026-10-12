// MYTHIC + STORY v2·v3: 씨앗(인연 5 → 다음 여관) · 각성 대사 한 번 · 능력치 ×1.15 · 부탁 → 열쇠 조각 · 엔딩 한 줄 · 진 엔딩 조건 · 손님 일기
import { beforeEach, describe, expect, it } from 'vitest';
import { MYTHIC, MYTHIC_SEED_LINE } from '../src/data/story/mythic';
import { DIARIES, DIARY_DONE } from '../src/data/story/v2';
import { makeAdventurer, makeLegend, powerOf } from '../src/world/adventurers';
import { addBond } from '../src/world/chem';
import { diaryKey, diaryList, diaryTick } from '../src/world/diary';
import { isMythic, keepMythicSeeds, mythicAtk, mythicEndLines, mythicProgress, mythicSeedMoment, mythicTick } from '../src/world/mythic';
import { endsSeen, trueReady } from '../src/world/routes';
import { resetProgress, P, S, world } from '../src/world/state';

beforeEach(() => {
  resetProgress();
  world.actors.length = 0;
  world.objs.length = 0;
  S.day = 1;
  S.night = false;
  document.body.innerHTML = '<div id="toast"></div>';
});
const legend = (key: string) => {
  const a = makeLegend(key, 5, 5);
  a.status = 'hero';
  a.id = 900 + MYTHIC.findIndex((m) => m.key === key);
  world.actors.push(a);
  return a;
};

describe('씨앗', () => {
  it('인연 5 순간: 모모 한 줄 + 씨앗 (한 번만)', () => {
    mythicSeedMoment('elysia');
    const l = mythicTick();
    expect(l?.[0]).toEqual(MYTHIC_SEED_LINE);
    expect(P.legacy.mythicSeeds).toEqual(['elysia']);
    mythicSeedMoment('elysia');
    expect(mythicTick()).toBeNull();
  });
  it('다음 여관을 열 때: 인연 5 전설만 씨앗 · 신화 아닌 영웅은 아님', () => {
    P.ties = { elysia: { pts: 100, stage: 5 } as never, nyx: { pts: 40, stage: 3 } as never, oswin: { pts: 100, stage: 5 } as never };
    keepMythicSeeds();
    expect(P.legacy.mythicSeeds).toEqual(['elysia']);
  });
});

describe('각성 · 능력치 · 부탁', () => {
  it('씨앗 + 마을에 있으면 각성 대사 한 번 → 신화 · 전투력 ×1.15', () => {
    const a = legend('elysia');
    const before = powerOf(a);
    P.legacy.mythicSeeds = ['elysia'];
    const l = mythicTick()!;
    expect(l[0]).toEqual(MYTHIC[0].awaken[0]);
    expect(isMythic(a)).toBe(true);
    expect(powerOf(a) / before).toBeCloseTo(1.15, 1);
    expect(mythicTick()).toBeNull();
    expect(mythicAtk([a])).toBeCloseTo(1.1);
  });
  it('엘리시아 부탁: 토벌 보스 3번 → 열쇠 조각 · 엔딩 한 줄', () => {
    legend('elysia');
    P.legacy.mythicSeeds = ['elysia'];
    mythicTick();
    expect(mythicProgress('elysia')).toEqual([0, 3]);
    P.counters.raidKills = 3;
    const l = mythicTick()!;
    expect(l[0]).toEqual(MYTHIC[0].request.done[0]);
    expect(P.legacy.shards).toEqual([MYTHIC[0].shard]);
    expect(P.story.mythic.elysia.done).toBe(true);
    expect(mythicEndLines()).toEqual([MYTHIC[0].ending]);
  });
  it('속마음: 인연 5 + 밤에 한 번', () => {
    legend('aria');
    P.legacy.mythicSeeds = ['aria'];
    mythicTick();
    P.story.mythic.aria.done = true;
    P.ties = { aria: { pts: 100, stage: 5 } as never };
    expect(mythicTick()).toBeNull();
    S.night = true;
    expect(mythicTick()).toEqual(MYTHIC.find((m) => m.key === 'aria')!.heart);
    expect(mythicTick()).toBeNull();
  });
});

describe('진 엔딩 조건', () => {
  it('엔딩 5종 + 열쇠 조각 5개', () => {
    P.legacy.album = ['story_hero', 'story_love', 'story_legend', 'story_town', 'story_retire'];
    expect(endsSeen()).toBe(5);
    P.legacy.shards = ['a', 'b', 'c', 'd'];
    expect(trueReady()).toBe(false);
    P.legacy.shards.push('e');
    expect(trueReady()).toBe(true);
  });
});

describe('손님 일기', () => {
  it('서재 Lv3 전엔 안 나옴 · 3부터 케미가 오를 때마다 한 장 · 다 모으면 주인공 대사', () => {
    const a = makeAdventurer(3, 3, { kind: 'knight', race: 'human', status: 'regular' });
    const b = makeAdventurer(4, 3, { kind: 'rogue', race: 'halfling', status: 'regular' });
    a.id = 1;
    b.id = 2;
    world.actors.push(a, b);
    const up = () => {
      const k = Object.keys(P.bonds)[0];
      const g = addBond(a, b, 1e9);
      if (k) P.bonds[k].lv = Math.min(P.bonds[k].lv, 4);
      return g;
    };
    expect(up()).toBeTruthy();
    expect(diaryList()).toEqual([]);
    world.objs.push({ kind: 'library', lvl: 3, tx: 0, ty: 0, fw: 3, fh: 3 } as never);
    for (const k of Object.keys(P.bonds)) P.bonds[k].lv = 1;
    for (const k of Object.keys(P.bonds)) P.bonds[k].xp = 0;
    addBond(a, b, 1e9);
    expect(P.diaries[diaryKey(a)]).toBe(1);
    expect(diaryTick()?.[0][0]).toBe('narr');
    P.diaries[diaryKey(a)] = DIARIES[diaryKey(a)].pages.length - 1;
    for (const k of Object.keys(P.bonds)) (P.bonds[k].lv = 1), (P.bonds[k].xp = 0);
    addBond(a, b, 1e9);
    const l = [diaryTick(), diaryTick()].find((x) => x && x[0][0] !== 'narr');
    expect(l?.[0][1]).toBe(DIARY_DONE[0][1]);
  });
});
