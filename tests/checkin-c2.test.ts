// CHECKIN C (v0.25.4 · ck-c2): K6 다시 보내기 의뢰 고르기 · §C4 빨간 점 규칙 · 텃밭 레벨 · 말 걸기 갈래 · §C3 오랜만 선물
import { beforeEach, describe, expect, it } from 'vitest';
import { makeAdventurer } from '../src/world/adventurers';
import { addObj, startTown } from '../src/world/town';
import { gardenLevelState, gardenPlots, plotsOf } from '../src/world/craft';
import { makeQuest, pickResendQuest, resendPlan } from '../src/world/expeditions';
import { dotPlan, mailUnread, type DotInput } from '../src/world/redDots';
import { giftable, talkRoute } from '../src/world/personRoute';
import { avgDailyIncome, longAway, welcomeGift } from '../src/world/welcome';
import { P, S, world, type Building, type Quest, type Run } from '../src/world/state';
import { FLAG_DEFAULTS } from '../src/world/flags';
import { today } from '../src/world/progress';
import { changedTitles } from '../src/ui/welcome';

const q = (id: number, region: Quest['region'], tier: number, o: Partial<Quest> = {}): Quest => ({ id, region, tier, power: 100, minutes: 1, gold: [1, 2], ...o });

describe('K6 다시 보내기: 의뢰 고르기', () => {
  it('같은 지역·같은 길이가 먼저', () => {
    const list = [q(1, 'mine', 2), q(2, 'forest', 3), q(3, 'forest', 2)];
    expect(pickResendQuest({ region: 'forest', tier: 2 }, list)?.id).toBe(3);
  });
  it('없으면 같은 길이 · 가까운 지역', () => {
    const list = [q(1, 'forest', 4), q(2, 'abyss' as never, 2), q(3, 'mine', 2)];
    // forest(0) 기준: mine이 abyss보다 가까움
    expect(pickResendQuest({ region: 'forest', tier: 2 }, list)?.id).toBe(3);
  });
  it('그것도 없으면 같은 지역 · 가까운 길이', () => {
    const list = [q(1, 'forest', 5), q(2, 'forest', 3), q(3, 'mine', 6)];
    expect(pickResendQuest({ region: 'forest', tier: 2 }, list)?.id).toBe(2);
  });
  it('튜토리얼 · 길드 특별 의뢰는 안 고름 · 맞는 게 없으면 null', () => {
    expect(pickResendQuest({ region: 'forest', tier: 2 }, [q(1, 'forest', 2, { tutorial: true }), q(2, 'forest', 2, { guild: true })])).toBeNull();
    expect(pickResendQuest({ region: 'forest', tier: 2 }, [q(1, 'mine', 4)])).toBeNull();
  });
  describe('resendPlan (파티 · 이유)', () => {
    let run: Run;
    beforeEach(() => {
      startTown();
      world.actors = [];
      P.runs = [];
      const ms = [0, 1, 2].map(() => Object.assign(makeAdventurer(5, 5, { status: 'regular', lvl: 10 }), { hp: 100 }));
      world.actors.push(...ms);
      P.quests.day = today();
      run = { id: 1, quest: makeQuest('forest', 2), members: ms.map((m) => m.id), start: 0, end: 1, result: { win: true, gold: 1, xp: 1, mats: 1, items: [], report: [], levelUps: [], newChem: [] } as never };
      P.runs.push(run);
    });
    it('같은 지역·길이 의뢰가 있으면 같은 파티로 (same)', () => {
      P.quests.list = [makeQuest('forest', 2)];
      const p = resendPlan(run);
      expect('why' in p).toBe(false);
      if (!('why' in p)) {
        expect(p.same).toBe(true);
        expect(p.members.map((m) => m.id)).toEqual(run.members);
      }
    });
    it('의뢰가 없으면 이유 (게시판엔 1분 의뢰만 · 다른 지역·길이)', () => {
      P.quests.list = [];
      const p = resendPlan({ ...run, quest: makeQuest('sky', 5) });
      expect(P.quests.list.every((x) => x.region !== 'sky' && x.tier !== 5)).toBe(true);
      expect('why' in p && p.why).toMatch(/의뢰가 없어요/);
    });
    it('체력이 낮은 파티원이 있으면 그 사람 이름 + 이유', () => {
      P.quests.list = [makeQuest('forest', 2)];
      world.actors[1].hp = 1;
      const p = resendPlan(run);
      expect('why' in p && p.why).toContain(world.actors[1].name);
    });
    it('마을에 없는 파티원 · 튜토리얼 의뢰', () => {
      P.quests.list = [makeQuest('forest', 2)];
      world.actors.pop();
      expect('why' in resendPlan(run)).toBe(true);
      expect('why' in resendPlan({ ...run, quest: { ...run.quest, tutorial: true } })).toBe(true);
    });
  });
});

describe('§C4 빨간 점 규칙', () => {
  const zero: DotInput = { mailUnread: 0, runsDone: 0, smithReady: false, ripe: 0, missionReady: false, achReady: 0, goalsReady: false, unseenDeco: 0 };
  it('받을 게 없으면 점 하나도 없음', () => {
    const p = dotPlan(zero);
    expect([p.exp, p.menu, p.build, p.mission, ...Object.values(p.tiles)].some(Boolean)).toBe(false);
  });
  it('원정 끝남 → 원정 버튼 + 메뉴 원정 칸 (메뉴 버튼엔 안 켬)', () => {
    const p = dotPlan({ ...zero, runsDone: 1 });
    expect(p.exp).toBe(true);
    expect(p.tiles.exp).toBe(true);
    expect(p.menu).toBe(false);
  });
  it('우편 · 업적 · 대장간 · 텃밭 → 메뉴 버튼 점 + 그 칸', () => {
    for (const [k, t] of [['mailUnread', 'mail'], ['achReady', 'ach'], ['ripe', 'garden']] as const) {
      const p = dotPlan({ ...zero, [k]: 2 });
      expect(p.menu).toBe(true);
      expect(p.tiles[t]).toBe(true);
    }
    const s = dotPlan({ ...zero, smithReady: true });
    expect(s.menu && s.tiles.smith).toBe(true);
  });
  it('장부 받을 보상 → 장부 카드 · 임무 칸 / 목표 → 목표 칸 / 안 본 장식 → 건설 (숫자 대신 점)', () => {
    const m = dotPlan({ ...zero, missionReady: true });
    expect(m.mission && m.tiles.quest).toBe(true);
    expect(dotPlan({ ...zero, goalsReady: true }).tiles.goals).toBe(true);
    expect(dotPlan({ ...zero, unseenDeco: 5 }).build).toBe(true);
  });
  it('안 읽은 편지 = 아직 안 연 편지 (보상 없는 편지 포함)', () => {
    P.meta.mail = [{ id: 1, at: 0, claimed: false, from: 'system', title: 'a', body: '', reward: {} } as never, { id: 2, at: 0, claimed: true, from: 'system', title: 'b', body: '', reward: { gold: 5 } } as never];
    expect(mailUnread()).toBe(1);
  });
});

describe('텃밭 레벨', () => {
  let g: Building;
  beforeEach(() => {
    startTown();
    g = addObj('garden', 10, 10) as Building;
    S.land = 9;
  });
  it('2레벨마다 밭 +1칸 (Lv.1~2 = 3 · 3~4 = 4 · 5~6 = 5)', () => {
    expect([1, 2, 3, 4, 5, 6].map(gardenPlots)).toEqual([3, 3, 4, 4, 5, 5]);
    g.lvl = 3;
    g.plots = undefined;
    expect(plotsOf(g).length).toBe(4);
  });
  it('레벨 줄 상태: 올릴 수 있음 → 비용 · 다음 칸 수 / Lv.6 최대 / 공사 중', () => {
    g.lvl = 2;
    const s = gardenLevelState(g);
    expect(s.state).toBe('up');
    expect(s.cost).toBe(600);
    expect(s.next).toBe(4);
    g.lvl = 6;
    expect(gardenLevelState(g).state).toBe('max');
    g.lvl = 3;
    g.con = { kind: 'up', end: 0, total: 1, to: 4, cut: 0, cost: 1 } as never;
    expect(gardenLevelState(g).state).toBe('con');
  });
});

describe('말 걸기 · 선물하기 갈래 (한 함수)', () => {
  it('인연이 있고 오늘 인연 대화가 되면 인연 대화', () => {
    expect(talkRoute({ id: 3 }, 'mira', true)).toBe('bond');
    expect(talkRoute(null, 'mira', true)).toBe('bond');
  });
  it('인연 대화가 안 되면(이미 함·없음) 손님은 그냥 한마디 · 모모는 인사 · 마을에 없는 인연은 안 됨', () => {
    expect(talkRoute({ id: 3 }, 'mira', false)).toBe('guest');
    expect(talkRoute({ id: 3 }, null, false)).toBe('guest');
    expect(talkRoute({ role: 'npc' }, 'momo', false)).toBe('npc');
    expect(talkRoute(null, 'mira', false)).toBe('none');
  });
  it('선물하기: 인연은 열려 있어야 · 그 밖엔 단골·영웅만', () => {
    expect(giftable('hero', 'mira', true)).toBe(true);
    expect(giftable('hero', 'mira', false)).toBe(false);
    expect(giftable('regular', null, false)).toBe(true);
    expect(giftable('visitor', null, false)).toBe(false);
  });
});

describe('§C3 오랜만 선물', () => {
  it('7일 이상만 · 금화 = 하루 평균 × 2 · 축복 30분', () => {
    const week = [{ gold: 1000 }, { gold: 3000 }];
    expect(longAway(6.9 * 86400)).toBe(false);
    expect(welcomeGift(6 * 86400, week)).toBeNull();
    expect(avgDailyIncome(week)).toBe(2000);
    expect(welcomeGift(8 * 86400, week)).toEqual({ gold: 4000, blessMin: 30 });
  });
  it('장부가 비었으면 이번 방치 금화 (최소 100)', () => {
    expect(welcomeGift(8 * 86400, [], 0)?.gold).toBe(100);
    expect(welcomeGift(8 * 86400, [], 700)?.gold).toBe(700);
  });
  it('「그동안 바뀐 것」: 꺼 둔 날 이후 새것부터 3개', () => {
    const list = [
      { date: '2026-10-14', title: 'd' },
      { date: '2026-10-12', title: 'c' },
      { date: '2026-10-10', title: 'b' },
      { date: '2026-10-08', title: 'a' },
      { date: '2026-10-01', title: 'old' },
    ];
    expect(changedTitles(list, Date.parse('2026-10-05T00:00:00+09:00'))).toEqual(['d', 'c', 'b']);
    expect(changedTitles(list, Date.parse('2026-10-13T00:00:00+09:00'))).toEqual(['d']);
  });
});

describe('플래그', () => {
  it('C 묶음 일곱 개는 기본 꺼짐', () => {
    for (const k of ['welcomeBack', 'redDots', 'bulkTidy', 'resendRun', 'gardenLevelUp', 'personActionsV2', 'actionsTidy'] as const) expect(FLAG_DEFAULTS[k]).toBe(false);
  });
});
