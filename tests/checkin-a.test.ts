// CHECKIN §A1 단골 제안 거르기 (propFilter) · §A2 이야기·관계 이벤트 모아 보기 (storyInbox)
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { CHAPTERS } from '../src/data/guide';
import { makeAdventurer } from '../src/world/adventurers';
import { dailyGuests, expireHeldProps, queueProposal, regularsCount } from '../src/world/actors';
import { clearEvents, eventPolicy, isSideKey, pendingSide, pumpEvents, queueEvent, queueEventFront, runFirstSide } from '../src/world/events';
import { setFlag } from '../src/world/flags';
import { initStoryInbox, propDecision, usefulGuest, type PropCtx } from '../src/world/storyInbox';
import { P, S, uiHooks, world, type Actor } from '../src/world/state';
import { capacity, rebuildPaths, startTown } from '../src/world/town';
import { takeSettlement } from '../src/world/daily';

const base: PropCtx = { rarity: 'common', power: 100, role: 'dps', special: false, regRoles: ['tank', 'heal', 'dps'], weakest: 200, regulars: 3, capacity: 3, chapters: 1 };
const c = (o: Partial<PropCtx>) => ({ ...base, ...o });

describe('§A1 거르기 판단', () => {
  it('일반·약함·자리 없음 → 거름', () => {
    expect(usefulGuest(base)).toBe(false);
    expect(propDecision('useful', base)).toBe('quiet');
  });
  it('희귀 이상은 항상 쓸 만함', () => {
    expect(propDecision('useful', c({ rarity: 'special' }))).toBe('ask');
    expect(propDecision('useful', c({ rarity: 'legend' }))).toBe('ask');
  });
  it('가장 약한 단골보다 전투력이 높으면 쓸 만함 (같으면 아님)', () => {
    expect(propDecision('useful', c({ power: 201 }))).toBe('ask');
    expect(propDecision('useful', c({ power: 200 }))).toBe('quiet');
  });
  it('자리가 남았고 없는 역할이면 쓸 만함 · 자리만 남거나 역할만 없으면 아님', () => {
    expect(propDecision('useful', c({ capacity: 4, regRoles: ['tank', 'dps'], role: 'heal' }))).toBe('ask');
    expect(propDecision('useful', c({ capacity: 4, regRoles: ['tank', 'heal', 'dps'] }))).toBe('quiet');
    expect(propDecision('useful', c({ capacity: 3, regRoles: ['tank', 'dps'], role: 'heal' }))).toBe('quiet');
  });
  it('온보딩: 단골 0명 · 장부 1장 전 · 영웅/전설/신화 → 거르지 않음 (모든 설정)', () => {
    for (const m of ['useful', 'none'] as const) {
      expect(propDecision(m, c({ regulars: 0, regRoles: [], weakest: null }))).toBe('ask');
      expect(propDecision(m, c({ chapters: 0 }))).toBe('ask');
      expect(propDecision(m, c({ special: true }))).toBe('ask');
    }
  });
  it('설정 3가지: 모두 → 제안 · 안 받기 → 대기 명단 · 쓸 만한 손님만 → 판단', () => {
    expect(propDecision('all', base)).toBe('ask');
    expect(propDecision('none', base)).toBe('wait');
    expect(propDecision('none', c({ rarity: 'special' }))).toBe('wait');
    expect(propDecision('useful', c({ rarity: 'special' }))).toBe('ask');
  });
});

describe('§A2 이벤트 나누기', () => {
  let shown = 0;
  beforeEach(() => {
    clearEvents();
    shown = 0;
    eventPolicy.collect = () => true;
    eventPolicy.shownToday = () => shown;
    eventPolicy.markShown = () => void shown++;
    eventPolicy.cap = () => 2;
  });
  afterEach(() => {
    eventPolicy.collect = () => false;
    clearEvents();
  });
  it('곁이야기 키 · 바로 볼 것', () => {
    for (const k of ['prop12', 'chem:3:2:1:2', 'tie:mira', 'ember40', 'reunion:x', 'letter2026-10-13']) expect(isSideKey(k)).toBe(true);
    for (const k of [undefined, 'run3', 'attend', 'decide', 'slot5', 'evalSeason', 'hunterMet']) expect(isSideKey(k)).toBe(false);
  });
  it('바로 볼 것이 먼저 · 곁이야기는 하루 2개까지만 저절로 · 나머지는 배지', () => {
    const ran: string[] = [];
    for (const k of ['prop1', 'chem:a', 'tie:b']) queueEvent(() => ran.push(k), k);
    queueEvent(() => ran.push('story'));
    pumpEvents(false);
    expect(ran).toEqual(['story']);
    pumpEvents(false);
    pumpEvents(false);
    pumpEvents(false);
    pumpEvents(false);
    expect(ran).toEqual(['story', 'prop1', 'chem:a']);
    expect(pendingSide()).toBe(1);
    expect(runFirstSide()).toBe(true);
    expect(ran).toEqual(['story', 'prop1', 'chem:a', 'tie:b']);
    expect(pendingSide()).toBe(0);
  });
  it('창이 있으면(busy) 아무것도 안 뜸', () => {
    let n = 0;
    queueEvent(() => n++, 'prop1');
    pumpEvents(true);
    expect(n).toBe(0);
  });
  it('끊겨 다시 앞에 넣은 제안은 바로 (모아 두지 않음)', () => {
    shown = 2;
    let n = 0;
    queueEventFront(() => n++, 'prop1');
    expect(pendingSide()).toBe(0);
    pumpEvents(false);
    expect(n).toBe(1);
  });
  it('유효하지 않게 되면(손님이 떠남) 조용히 빠진다', () => {
    let alive = true;
    queueEvent(() => {}, 'prop1', () => alive);
    expect(pendingSide()).toBe(1);
    alive = false;
    expect(pendingSide()).toBe(0);
  });
  it('모아 보기를 끄면(바로 보기·플래그 끔) 예전처럼 차례대로', () => {
    eventPolicy.collect = () => false;
    const ran: string[] = [];
    for (const k of ['prop1', 'chem:a', 'tie:b']) queueEvent(() => ran.push(k), k);
    for (let i = 0; i < 3; i++) pumpEvents(false);
    expect(ran).toEqual(['prop1', 'chem:a', 'tie:b']);
  });
});

describe('§A1·A2 실제 흐름 (actors)', () => {
  const reg = (): Actor => makeAdventurer(5, 5, { status: 'regular' });
  const guest = (o: Partial<Actor> = {}): Actor => Object.assign(makeAdventurer(5, 5, { status: 'visitor' }), { moodSum: 95, moodN: 1, mood: 95, rarity: 'common' }, o);
  beforeEach(() => {
    if (!document.getElementById('over')) document.body.insertAdjacentHTML('beforeend', '<div id="over"></div>');
    localStorage.clear();
    S.visiting = false as never;
    S.started = true as never;
    S.land = 3;
    startTown();
    rebuildPaths();
    world.actors = [];
    P.waitlist = [];
    P.guide.claimed = CHAPTERS.find((x) => x.no === 1)!.missions.map((m) => m.id);
    P.daily.cur = { day: S.day, gold0: 0, arrivals: 0, newHarm: 0, newDex: 0, moodSum: 0, moodN: 0, quietBye: 0 };
    P.daily.pending = [];
    clearEvents();
    setFlag('propFilter', true);
    setFlag('storyInbox', true);
    initStoryInbox();
  });
  afterEach(() => {
    setFlag('propFilter', false);
    setFlag('storyInbox', false);
    eventPolicy.collect = () => false;
    clearEvents();
  });
  /** 단골을 꽉 채우고, 아주 센 단골로 (평범한 손님이 더 약하게) */
  const fill = () => {
    while (regularsCount() < capacity()) world.actors.push(Object.assign(reg(), { lvl: 60 }));
  };
  it('평범한 손님: 제안 없이 떠남 · 대기 명단 X · 정산 카드 수', () => {
    fill();
    const g = guest();
    world.actors.push(g);
    let talked = 0;
    uiHooks.talk = () => void talked++;
    queueProposal(g);
    pumpEvents(false);
    expect(talked).toBe(0);
    expect(g.leaving).toBe(true);
    expect(P.waitlist.length).toBe(0);
    expect(P.daily.cur.quietBye).toBe(1);
  });
  it('정산 카드: quietBye 합 (옛 기록엔 없어도 0)', () => {
    P.daily.pending = [{ day: 1, gold: 0, guests: 0, mood: 0, newHarm: 0, newDex: 0 }, { day: 2, gold: 0, guests: 0, mood: 0, newHarm: 0, newDex: 0, quietBye: 3 }];
    expect(takeSettlement()!.sum.quietBye).toBe(3);
  });
  it('희귀 손님: 배지에 모임 → 떠나면 배지에서 빠짐', () => {
    fill();
    P.inbox = { day: '', shown: 0 };
    const g = guest({ rarity: 'special' });
    world.actors.push(g);
    eventPolicy.shownToday = () => 99; // 오늘 저절로 뜰 몫을 다 씀
    queueProposal(g);
    pumpEvents(false);
    expect(g.leaving).toBeFalsy();
    expect(pendingSide()).toBe(1);
    g.leaving = true;
    expect(pendingSide()).toBe(0);
  });
  /** 오늘 몫을 다 써서 배지에 남은 제안 하나 */
  const stored = (o: Partial<Actor>) => {
    fill();
    eventPolicy.shownToday = () => 99;
    const g = guest(o);
    world.actors.push(g);
    queueProposal(g);
    pumpEvents(false);
    expect(pendingSide()).toBe(1);
    return g;
  };
  const W = { id: 999, kind: 'knight', name: 'W', lvl: 1, xp: 0, race: 'human', rarity: 'common', face: 0, hair: '#000' } as never;
  it('마감(propHoldHours) 지남: 희귀는 대기 명단으로 (사라지지 않음)', () => {
    const g = stored({ rarity: 'special' });
    S.day += 2;
    expireHeldProps();
    expect(P.waitlist.map((w) => w.id)).toContain(g.id);
    expect(pendingSide()).toBe(0);
  });
  it('마감 지남: 일반 손님은 조용히 떠남 (대기 명단 X)', () => {
    localStorage.setItem('legacy-of-adventure-propFilter', JSON.stringify('all'));
    const g = stored({ rarity: 'common' });
    S.day += 2;
    expireHeldProps();
    expect(g.leaving).toBe(true);
    expect(P.waitlist.length).toBe(0);
    expect(pendingSide()).toBe(0);
  });
  it('마감 지남 + 대기 명단 꽉 참: 희귀는 제안을 둔 채 머묾', () => {
    const g = stored({ rarity: 'special' });
    P.waitlist = [W, W, W];
    S.day += 2;
    expireHeldProps();
    expect(g.leaving).toBeFalsy();
    expect(pendingSide()).toBe(1);
  });
  it('기분이 떨어져 떠날 때도: 모아 둔 희귀 손님은 대기 명단으로 · 꽉 찼으면 머묾', () => {
    const g = stored({ rarity: 'special', moodSum: 1, moodN: 1, mood: 1 });
    P.waitlist = [W, W, W];
    dailyGuests();
    expect(g.leaving).toBeFalsy();
    expect(pendingSide()).toBe(1);
    P.waitlist = [];
    dailyGuests();
    expect(P.waitlist.map((w) => w.id)).toContain(g.id);
    expect(pendingSide()).toBe(0);
  });
  it('「안 받기」: 대기 명단으로', () => {
    localStorage.setItem('legacy-of-adventure-propFilter', JSON.stringify('none'));
    fill();
    const g = guest({ rarity: 'special' });
    world.actors.push(g);
    queueProposal(g);
    expect(P.waitlist.map((w) => w.id)).toContain(g.id);
    expect(pendingSide()).toBe(0);
  });
  it('플래그 끔: 예전 그대로 제안', () => {
    setFlag('propFilter', false);
    setFlag('storyInbox', false);
    fill();
    const g = guest();
    world.actors.push(g);
    let talked = 0;
    uiHooks.talk = () => void talked++;
    queueProposal(g);
    pumpEvents(false);
    expect(talked).toBe(1);
    expect(g.leaving).toBeFalsy();
  });
  it('하루 저절로 뜨는 수는 설정값', () => {
    expect(CONFIG.storyInbox.autoPerDay).toBe(2);
    expect(eventPolicy.cap()).toBe(2);
  });
});
