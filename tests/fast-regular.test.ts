// 핫픽스 10 §15: 자리가 새로 생기면 빠른 단골 제안 (규칙은 earlyRegular와 같은 방식 · 원래 06:00 규칙은 그대로)
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { makeAdventurer } from '../src/world/adventurers';
import { fastRegular, regularNeed, regularsCount, watchCapacity } from '../src/world/actors';
import { pumpEvents, clearEvents } from '../src/world/events';
import { P, S, uiHooks, world, type Actor } from '../src/world/state';
import { capacity, rebuildPaths, startTown } from '../src/world/town';

const A = CONFIG.actors;
const reg = (): Actor => makeAdventurer(5, 5, { status: 'regular' });
/** 한 시간 넘게 기분 좋게 묵은 방문 손님 */
const happy = (): Actor => Object.assign(makeAdventurer(5, 5, { status: 'visitor' }), { moodSum: 95, moodN: 1, mood: 95 });
const accept = () => (uiHooks.talk = (_l, _d, ch) => ch?.[0]?.fn());

beforeEach(() => {
  // 말풍선·떠오르는 글자가 붙을 자리
  if (!document.getElementById('over')) document.body.insertAdjacentHTML('beforeend', '<div id="over"></div>');
  S.visiting = false as never;
  S.started = true as never;
  S.land = 3;
  startTown();
  rebuildPaths();
  world.actors = [];
  P.waitlist = [];
  P.fastSlots = 0;
  P.fastRescued = true;
  P.fastHintN = 0;
  clearEvents();
  // 앞 테스트의 capacity 기억을 지운다
  S.visiting = true as never;
  watchCapacity();
  S.visiting = false as never;
});

describe('빠른 제안', () => {
  it('여관 레벨업 → 늘어난 자리만큼 fastSlots', () => {
    watchCapacity();
    const inn = world.objs.find((o) => o.kind === 'inn')!;
    inn.lvl++;
    watchCapacity();
    expect(P.fastSlots).toBe(A.perInnLevel);
    expect(P.fastHintN).toBe(1);
  });
  it('기분 좋은 방문 손님 → 1시간 뒤 바로 제안 → 받으면 fastSlots -1', () => {
    world.actors = [reg(), reg(), reg()];
    while (regularsCount() < capacity() - 1) world.actors.push(reg());
    P.fastSlots = 1;
    const g = happy();
    world.actors.push(g);
    expect(g.moodSum / g.moodN).toBeGreaterThanOrEqual(regularNeed());
    accept();
    fastRegular();
    pumpEvents(false);
    expect(g.status).toBe('regular');
    expect(P.fastSlots).toBe(0);
  });
  it('fastSlots를 다 쓰면 빠른 제안 없음 (원래 06:00 규칙)', () => {
    world.actors = [reg(), reg(), reg()];
    P.fastSlots = 0;
    const g = happy();
    world.actors.push(g);
    accept();
    fastRegular();
    pumpEvents(false);
    expect(g.status).toBe('visitor');
  });
  it('보내 주기 해도 fastSlots는 그대로', () => {
    world.actors = [reg(), reg(), reg()];
    P.fastSlots = 1;
    world.actors.push(happy());
    uiHooks.talk = (_l, _d, ch) => ch?.[1]?.fn();
    fastRegular();
    pumpEvents(false);
    expect(P.fastSlots).toBe(1);
  });
  it('대기 목록이 있으면 그쪽이 먼저 (빠른 제안은 쉼)', () => {
    world.actors = [reg(), reg(), reg()];
    P.fastSlots = 1;
    P.waitlist = [{ id: 999, kind: 'knight', name: 'W', lvl: 1, xp: 0, race: 'human', rarity: 'common', face: 0, hair: '#000' } as never];
    const g = happy();
    world.actors.push(g);
    accept();
    fastRegular();
    pumpEvents(false);
    expect(g.status).toBe('visitor');
  });
  it('옛 저장 구제: 한 번만 min(2, 빈자리)', () => {
    world.actors = [reg(), reg(), reg()];
    P.fastRescued = false;
    watchCapacity();
    expect(P.fastSlots).toBe(Math.min(2, capacity() - 3));
    P.fastSlots = 0;
    watchCapacity();
    expect(P.fastSlots).toBe(0);
  });
});
