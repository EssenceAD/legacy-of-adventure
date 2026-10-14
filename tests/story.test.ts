// STORY_V1: 막 전환(날짜 대기 포함) · 옛 저장 막 추정 · 루트 점수·고르기 · 은퇴 목표 → 유안 · 엔딩 기록(기존 앨범) · 새 회차(남는 것·지우는 것) · 회차 대사 조건
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { MISSIONS } from '../src/data/guide';
import { MEMORIES, OPENING_CYCLE } from '../src/data/story/v1';
import { endingById } from '../src/data/endings';
import { resetProgress, P, S } from '../src/world/state';
import { setFlag } from '../src/world/flags';
import {
  actNeeds, actUp, cond, cycleLines, finishStory, grantLegacy, initStory, nextAct, openingCycle, pickRoute, rethink, retireGoals, retireReady, routeChoices, startCycle, storyDay, storyLines, storyWaitDay,
} from '../src/world/story';

const A = CONFIG.story;
/** 장부 n장까지 끝낸 것으로 */
function ledgerTo(ch: number) {
  P.guide.claimed = MISSIONS.filter((m) => m.ch <= ch).map((m) => m.id);
  P.guide.idx = P.guide.claimed.length;
}
beforeEach(() => {
  resetProgress();
  S.day = 1;
  S.started = true as never;
  S.visiting = false as never;
  S.innName = '별빛 여관';
});

describe('막 전환', () => {
  it('새 게임은 1막 · 장부 3장 + 날짜가 차야 2막 (날짜가 모자라면 기다리는 날을 알려 줌)', () => {
    initStory(true);
    expect(P.story.act).toBe(1);
    ledgerTo(3);
    S.day = 3;
    expect(nextAct()).toBeNull();
    expect(storyWaitDay()).toBe(A.act2.day);
    S.day = A.act2.day;
    expect(nextAct()).toBe(2);
    actUp(2);
    expect(P.story.act).toBe(2);
    expect(storyWaitDay()).toBe(0);
  });
  it('2→3막: 장부 7장 + 영웅 1명 이상 + 날짜 · 3막이면 모모의 편지', () => {
    initStory(true);
    actUp(2);
    ledgerTo(7);
    S.day = A.act3.day;
    // 영웅이 없으면 아직
    expect(actNeeds(3).prog).toBe(false);
    P.dex.heroes.oswin = { appeared: true, recruited: true, stars: 1 };
    expect(nextAct()).toBe(3);
    actUp(3);
    expect(P.story.letter).toBe(1);
  });
  it('옛 저장: 진행이 2막 조건이면 조용히 2막 (3막은 컷으로 맞이하게 2막까지만)', () => {
    ledgerTo(7);
    P.dex.heroes.oswin = { appeared: true, recruited: true, stars: 1 };
    S.day = 100;
    initStory(false);
    expect(P.story.act).toBe(2);
    expect(nextAct()).toBe(3);
    const fresh = () => {
      resetProgress();
      S.day = 4;
      ledgerTo(5);
      initStory(false);
    };
    fresh();
    expect(P.story.act).toBe(1);
  });
  it('옛 저장의 이미 본 엔딩 → 유산 포인트 · 기억 조각을 한 번 채움', () => {
    P.legacy.album = ['inn_simple', 'solo'];
    initStory(false);
    expect(P.legacy.pts).toBe(2 * (A.legacyPts + A.legacyFirst));
    expect(P.legacy.mem).toBe(2);
    initStory(false);
    expect(P.legacy.pts).toBe(2 * (A.legacyPts + A.legacyFirst));
  });
});

describe('갈림길 · 조용한 은퇴', () => {
  beforeEach(() => {
    initStory(true);
    actUp(2);
    actUp(3);
  });
  it('선택지 5개 점수 순 · 맨 위 하나만 ✨ · v1은 은퇴만 열림', () => {
    const ch = routeChoices();
    expect(ch.length).toBe(5);
    expect(ch.filter((c) => c.top).length).toBe(1);
    expect(ch.filter((c) => c.open).map((c) => c.id)).toEqual(['retire']);
    expect(pickRoute('hero')).toBeTruthy();
    expect(pickRoute('retire')).toBeNull();
    expect(P.story.route).toBe('retire');
  });
  it('다시 생각하기는 3막에서 한 번', () => {
    pickRoute('retire');
    expect(rethink()).toBe(true);
    expect(P.story.letter).toBe(1);
    pickRoute('retire');
    expect(rethink()).toBe(false);
  });
  it('목표: 운영 일수(남은 날로) · 기분 최고인 날 · 수확 100 → 다 차면 유안', () => {
    pickRoute('retire');
    S.day = 20;
    // PACE §3-1: 이야기 시계를 켜면 3막에 들어선 날이 「40일째」라 남은 날은 60 − 40 (끄면 예전 — 게임 일수만)
    setFlag('storyClock', false);
    const g = retireGoals();
    expect(g[0].text).toContain(`${A.retireDays - 20}일 남음`);
    setFlag('storyClock', true);
    expect(retireGoals()[0].text).toContain(`${A.retireDays - A.act3.day}일 남음`);
    expect(retireReady()).toBe(false);
    S.day = A.retireDays;
    P.story.goodDays = A.retireGoodDays;
    P.counters.harvests = A.retireHarvests;
    expect(retireReady()).toBe(true);
    expect(retireGoals()[3].done).toBe(false);
  });
});

describe('엔딩 · 새 회차', () => {
  it('은퇴 엔딩은 기존 앨범(album·cards·seen)에 · 유산 포인트 100 + 처음 50 · 기억 1', () => {
    initStory(true);
    P.owner = { name: '하나', job: 'knight', gender: 'f' } as never;
    Object.assign(P.story, { act: 3, route: 'retire', heir: 1 });
    S.day = 30;
    const r = finishStory('retire');
    expect(endingById('story_retire')?.type).toBe('story');
    expect(P.legacy.album).toContain('story_retire');
    expect(P.legacy.cards.story_retire.day).toBe(30);
    expect(r.pts).toBe(A.legacyPts + A.legacyFirst);
    expect(P.legacy.mem).toBe(1);
    expect(P.story.heir).toBe(2);
    // 두 번째는 처음 보너스 없음
    expect(grantLegacy(['story_retire'], []).pts).toBe(A.legacyPts);
  });
  it('기억 조각은 다섯 개까지', () => {
    for (let i = 0; i < 8; i++) grantLegacy(['solo'], []);
    expect(P.legacy.mem).toBe(MEMORIES.length);
  });
  it('새 회차: 이야기는 처음부터(1막 · 이 회차 일수 1) · 엔딩 앨범·유산 포인트는 남음 · 선물은 포인트로', () => {
    initStory(true);
    P.legacy.album = ['story_retire'];
    P.legacy.pts = 200;
    Object.assign(P.story, { act: 3, route: 'retire', heir: 2, goodDays: 9, seen: ['rt1'] });
    S.day = 70;
    P.legacy.gen = 2;
    const gold = S.gold;
    const got = startCycle(['gold', 'ledger', 'fav']);
    expect(P.story.act).toBe(1);
    expect(P.story.route).toBeNull();
    expect(P.story.seen).toEqual([]);
    expect(storyDay()).toBe(1);
    expect(P.legacy.album).toEqual(['story_retire']);
    // 비상금 50 + 장부 60 = 110 · 옛 단골(100)은 포인트가 모자라 빠짐
    expect(got).toEqual(['gold', 'ledger']);
    expect(P.legacy.pts).toBe(90);
    expect(S.gold).toBe(gold + A.giftGold);
    expect(P.guide.claimed.length).toBeGreaterThan(0);
  });
});

describe('회차 대사 · 조건', () => {
  it('cycle·ending·met·! 조건', () => {
    P.legacy.gen = 2;
    expect(cond('cycle>=2')).toBe(true);
    expect(cond('cycle==3')).toBe(false);
    expect(cond('ending:retire')).toBe(false);
    P.legacy.album = ['story_retire'];
    expect(cond('ending:retire')).toBe(true);
    expect(cond('!met:oswin')).toBe(true);
    P.dex.heroes.oswin = { appeared: true, recruited: true, stars: 1 };
    expect(cond('!met:oswin')).toBe(false);
    expect(cond('cycle>=2&&prevFav')).toBe(false);
  });
  it('2회차 오프닝 대사 · 회차 대사는 회차마다 한 번', () => {
    P.legacy.gen = 2;
    expect(openingCycle()).toBe(OPENING_CYCLE['cycle==2']);
    P.legacy.gen = 5;
    expect(openingCycle()).toBe(OPENING_CYCLE['cycle>=4']);
    expect(cycleLines('chapter2')).toBeTruthy();
    expect(cycleLines('chapter2')).toBeNull();
    P.legacy.gen = 1;
    resetProgress();
    expect(cycleLines('chapter2')).toBeNull();
  });
  it('대사 줄: {inn}·{me} 채움 · opts.if가 안 맞는 줄은 빠짐 · 유안·오스윈 이름표', () => {
    P.owner = { name: '하나' } as never;
    const out = storyLines([
      ['keeper', '{inn}에 어서 오게, {me}.'],
      ['narr', '못 만난 사람용', { if: '!met:oswin' }],
      ['narr', '만난 사람용', { if: 'met:oswin' }],
      ['yuan', '안녕하세요'],
      ['hero_oswin', '…'],
    ]);
    expect(out.map((x) => x.line[1])).toEqual(['별빛 여관에 어서 오게, 하나.', '못 만난 사람용', '안녕하세요', '…']);
    expect(out[2].line[3]).toBe('유안');
    expect(out[3].line[3]).toBeTruthy();
  });
});
