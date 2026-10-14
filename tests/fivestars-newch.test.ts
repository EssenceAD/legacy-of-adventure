// 웅스 제보: 3막 「다섯 별의 원정대」가 장부 맨 아래에 조용히 열림 → 새 장 빨간 점 · 「새 장이 열렸어요」 1번 · 장부를 열면 3막으로 스크롤 + 점 끔
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fiveChapterNew, fiveChapterViewed, fiveNoticeTake, fiveState, fiveTick } from '../src/world/fivestars';
import { setFlag } from '../src/world/flags';
import { dotPlan, type DotInput } from '../src/world/redDots';
import { P, resetProgress, S, world } from '../src/world/state';
import { focusFiveLedger, fiveLedgerHtml } from '../src/ui/fivestars';

const none: DotInput = { mailUnread: 0, runsDone: 0, smithReady: false, ripe: 0, missionReady: false, achReady: 0, goalsReady: false, unseenDeco: 0 };
function act3() {
  P.story.act = 3;
  P.story.letter = 2;
  P.story.actDay = { 3: S.day };
}

beforeEach(() => {
  resetProgress();
  world.actors.length = 0;
  world.objs.length = 0;
  world.home = null;
  S.day = 5;
  S.started = true;
  S.visiting = null as never;
  setFlag('fiveStars', true);
});
afterEach(() => setFlag('fiveStars', false));

describe('새 장 알림', () => {
  it('장이 열리면 못 본 표시(chSeen 0) → 빨간 점(메뉴 · 임무(장부) 칸)', () => {
    act3();
    expect(fiveChapterNew()).toBe(false);
    expect(fiveTick()).toEqual({ kind: 'letter' });
    expect(P.five.chSeen).toBe(0);
    expect(fiveChapterNew()).toBe(true);
    const p = dotPlan({ ...none, fiveNew: 1 });
    expect(p.menu).toBe(true);
    expect(p.tiles.quest).toBe(true);
    expect(dotPlan(none).tiles.quest).toBe(false);
  });
  it('알림은 1번만 · 알림 뒤에도 점은 장부를 볼 때까지', () => {
    act3();
    fiveTick();
    expect(fiveNoticeTake()).toBe(true);
    expect(fiveNoticeTake()).toBe(false);
    expect(fiveChapterNew()).toBe(true);
    fiveChapterViewed();
    expect(fiveChapterNew()).toBe(false);
    expect(P.five.chSeen).toBe(2);
    expect(fiveNoticeTake()).toBe(false);
  });
  it('장부를 열면 3막 머리로 스크롤하고 점 끔', () => {
    act3();
    fiveTick();
    document.body.innerHTML = `<div id="winB"><div class="qhd">1장</div>${fiveLedgerHtml()}</div>`;
    expect(document.querySelector('.qhd.five')).toBeTruthy();
    focusFiveLedger(document.getElementById('winB')!);
    expect(fiveChapterNew()).toBe(false);
  });
  it('옛 저장: 이미 열렸는데 칸이 없으면 못 본 것으로 → 알림 1번 · 점', () => {
    const f = fiveState();
    f.open = true;
    delete (f as Partial<typeof f>).chSeen;
    expect(fiveState().chSeen).toBe(0);
    expect(fiveChapterNew()).toBe(true);
    expect(fiveNoticeTake()).toBe(true);
    expect(fiveNoticeTake()).toBe(false);
  });
  it('이웃 방문 중엔 알림 미룸', () => {
    P.five.open = true;
    S.visiting = {} as never;
    expect(fiveNoticeTake()).toBe(false);
    S.visiting = null as never;
    expect(fiveNoticeTake()).toBe(true);
  });
  it('플래그 꺼짐: 점·알림·스크롤 없음 (표시도 안 바뀜)', () => {
    P.five.open = true;
    setFlag('fiveStars', false);
    expect(fiveChapterNew()).toBe(false);
    expect(fiveNoticeTake()).toBe(false);
    fiveChapterViewed();
    expect(P.five.chSeen).toBe(0);
    document.body.innerHTML = '<div id="winB"></div>';
    focusFiveLedger(document.getElementById('winB')!);
    expect(P.five.chSeen).toBe(0);
  });
});
