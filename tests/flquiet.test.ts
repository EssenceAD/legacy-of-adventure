// FIRSTLOOK §2 화면 조용히 (flQuiet): 말풍선 줄 · 떠다니는 글씨 합치기 · 이름표 규칙 · 아래 띠 · 설정 끄기 · 플래그 끔
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { SYNC_PREF_KEYS } from '../src/save/save';
import { FLAG_DEFAULTS, setFlag } from '../src/world/flags';
import { clearBubbles, floatW, say } from '../src/world/fx';
import { setGuestNames, reloadGuestNames } from '../src/world/guestNames';
import { today, track } from '../src/world/progress';
import {
  bandHidden,
  BubbleQueue,
  mergeFloat,
  nameTagRule,
  noteVillageOpen,
  PRI,
  qb,
  quietHooks,
  quietOn,
  reloadQuietPref,
  resetVillageOpen,
  setQuietPref,
} from '../src/world/quiet';
import { P, resetProgress, uiHooks, type Actor } from '../src/world/state';
import { setLab } from '../src/world/visual';

const C = CONFIG.firstLook.quiet;
const actor = (n: string) => ({ name: n, x: 3, y: 3, hidden: false, bub: null, leaving: false }) as unknown as Actor;

beforeEach(() => {
  localStorage.clear();
  reloadQuietPref();
  reloadGuestNames();
  setLab(false);
  setFlag('flQuiet', false);
  document.body.innerHTML = '<div id="over"></div>';
  qb.reset();
});
afterEach(() => {
  setFlag('flQuiet', false);
  vi.useRealTimers();
});

describe('플래그 · 설정', () => {
  it('플래그는 기본 꺼짐 (형철 확인 전) · 끄면 조용히 아님', () => {
    expect(FLAG_DEFAULTS.flQuiet).toBe(false);
    expect(quietOn()).toBe(false);
  });
  it('플래그를 켜면 기본 켬 · 설정에서 끄면 끔 (끈 사람만 저장) · 다시 켜면 켬', () => {
    setFlag('flQuiet', true);
    expect(quietOn()).toBe(true);
    expect(localStorage.getItem('legacy-of-adventure-quietOff')).toBeNull();
    setQuietPref(false);
    expect(quietOn()).toBe(false);
    reloadQuietPref();
    expect(quietOn()).toBe(false);
    setQuietPref(true);
    expect(quietOn()).toBe(true);
  });
  it('실험실(새 화면 미리 보기)로도 켜진다', () => {
    setLab(true);
    expect(quietOn()).toBe(true);
    setLab(false);
  });
  it('설정 동기화 키에 들어 있다', () => {
    expect(SYNC_PREF_KEYS).toContain('quietOff');
  });
  it('숫자는 config 한 곳: 간격 2.5초 · 건물 상태 1 · 0.9초 · 10초', () => {
    expect(C.bubbleGapMs).toBe(2500);
    expect(C.bldMax).toBe(1);
    expect(CONFIG.bldStatus.max).toBe(3);
    expect(C.floatMs).toBe(900);
    expect(C.bandHideMs).toBe(10000);
    expect(C.tagTapSec).toBe(3);
  });
});

describe('§2-1 말풍선 줄 (BubbleQueue)', () => {
  const mk = (q: BubbleQueue, log: string[], pri: number, key: string, ms = 2800) => ({ pri, key, ms, show: () => void log.push(key) });
  it('한 번에 하나 · 끝나고 2.5초 뒤에 다음', () => {
    const q = new BubbleQueue();
    const log: string[] = [];
    expect(q.request(mk(q, log, PRI.guest, 'a'), 0)).toBe(true);
    expect(q.request(mk(q, log, PRI.guest, 'b'), 100)).toBe(false);
    expect(log).toEqual(['a']);
    q.pump(2800); // a 끝
    expect(q.showing(2800)).toBeNull();
    q.pump(2800 + 2499);
    expect(log).toEqual(['a']);
    q.pump(2800 + 2500);
    expect(log).toEqual(['a', 'b']);
  });
  it('우선순위: 안내 > 이야기·사건 > 손님 대사 (같으면 먼저 온 것)', () => {
    const q = new BubbleQueue(undefined, () => 1e9);
    const log: string[] = [];
    q.request(mk(q, log, PRI.guest, 'first'), 0);
    q.request(mk(q, log, PRI.guest, 'g1'), 10);
    q.request(mk(q, log, PRI.guest, 'g2'), 20);
    q.request(mk(q, log, PRI.story, 's'), 30);
    q.request(mk(q, log, PRI.guide, 'guide'), 40);
    let t = 0;
    for (let i = 0; i < 5; i++) q.pump((t += 2800 + 2500));
    expect(log).toEqual(['first', 'guide', 's', 'g1', 'g2']);
  });
  it('「!」(붙잡는 안내)는 놓을 때까지 다른 걸 막고 · 놓으면 간격 뒤 다음', () => {
    const q = new BubbleQueue();
    const log: string[] = [];
    expect(q.wantHold('wf', PRI.guide, 0)).toBe(true);
    q.request(mk(q, log, PRI.guest, 'g'), 10);
    expect(log).toEqual([]);
    q.wantHold('wf', PRI.guide, 1000);
    q.pump(2000);
    expect(log).toEqual([]);
    q.release('wf', 2000);
    q.pump(4499);
    expect(log).toEqual([]);
    q.pump(4500);
    expect(log).toEqual(['g']);
  });
  it('떠 있는 대사가 있으면 「!」도 기다렸다가 가장 먼저', () => {
    const q = new BubbleQueue();
    const log: string[] = [];
    q.request(mk(q, log, PRI.guest, 'g1'), 0);
    q.request(mk(q, log, PRI.guest, 'g2'), 0);
    expect(q.wantHold('wf', PRI.guide, 100)).toBe(false);
    expect(q.wantHold('wf', PRI.guide, 5300)).toBe(true);
    expect(log).toEqual(['g1']);
  });
  it('건물 상태(빈자리 채우기)는 아무것도 없고 간격이 지났을 때만', () => {
    const q = new BubbleQueue();
    const log: string[] = [];
    expect(q.idle(0)).toBe(true);
    q.request(mk(q, log, PRI.guest, 'g'), 0);
    expect(q.idle(100)).toBe(false);
    expect(q.idle(2800 + 2000)).toBe(false);
    expect(q.idle(2800 + 2500)).toBe(true);
  });
  it('오래 못 뜬 대사는 버림 · 주인이 사라진(ok=false) 대사는 건너뜀', () => {
    const q = new BubbleQueue();
    const log: string[] = [];
    q.request(mk(q, log, PRI.guest, 'a'), 0);
    q.request({ ...mk(q, log, PRI.guest, 'gone'), ok: () => false }, 10);
    q.request(mk(q, log, PRI.guest, 'b'), 20);
    q.pump(5300);
    expect(log).toEqual(['a', 'b']);
    q.request(mk(q, log, PRI.guest, 'old'), 5400);
    q.pump(5400 + C.bubbleStaleMs + 1);
    expect(log).toEqual(['a', 'b']);
  });
  it('줄은 길이 제한 (덜 급한 것부터 버림)', () => {
    const q = new BubbleQueue();
    const log: string[] = [];
    q.request(mk(q, log, PRI.guest, 'cur'), 0);
    for (let i = 0; i < C.bubbleQueueMax + 3; i++) q.request(mk(q, log, PRI.guest, 'g' + i), 1);
    q.request(mk(q, log, PRI.story, 'story'), 2);
    expect(q.q.length).toBe(C.bubbleQueueMax);
    expect(q.q.some((x) => x.key === 'story')).toBe(true);
    // 먼저 선 손님 대사가 남고 늦게 온 것이 빠짐
    expect(q.q.some((x) => x.key === 'g0')).toBe(true);
    expect(q.q.some((x) => x.key === 'g' + (C.bubbleQueueMax + 2))).toBe(false);
  });
  it('「!」가 소식 없이 멈추면(틱 끊김) 자리를 놓는다', () => {
    const q = new BubbleQueue();
    q.wantHold('wf', PRI.guide, 0);
    expect(q.showing(q.holdTtl + 1)).toBeNull();
  });
});

describe('§2-1 마을 say() 연결', () => {
  it('조용히: 손님 셋이 동시에 말해도 말풍선은 하나', () => {
    setFlag('flQuiet', true);
    const [a, b, c] = [actor('a'), actor('b'), actor('c')];
    say(a, '하나');
    say(b, '둘');
    say(c, '셋', 1, 'chem');
    expect(document.querySelectorAll('.bub').length).toBe(1);
    expect(document.querySelector('.bub')!.textContent).toBe('하나');
    // 다음은 사건(케미)이 먼저
    expect(qb.q[0].pri).toBe(PRI.guest);
    expect(qb.q.map((x) => x.pri).sort()).toEqual([PRI.story, PRI.guest]);
    clearBubbles();
  });
  it('설정 끔 = 예전 그대로 (최대 2개)', () => {
    setFlag('flQuiet', true);
    setQuietPref(false);
    const [a, b, c] = [actor('a'), actor('b'), actor('c')];
    a.x = 0;
    b.x = 40;
    c.x = 80;
    say(a, '하나');
    say(b, '둘');
    say(c, '셋');
    expect(document.querySelectorAll('.bub').length).toBe(2);
    expect(qb.q.length).toBe(0);
    clearBubbles();
  });
  it('플래그 끔 = 아무 것도 안 바뀜 (줄을 안 씀)', () => {
    const [a, b] = [actor('a'), actor('b')];
    a.x = 0;
    b.x = 40;
    say(a, '하나');
    say(b, '둘');
    expect(document.querySelectorAll('.bub').length).toBe(2);
    expect(qb.q.length + (qb.cur ? 1 : 0)).toBe(0);
    clearBubbles();
  });
});

describe('§2-4 떠다니는 글씨 합치기', () => {
  it('mergeFloat: 같은 꼴 숫자는 더하고 · 같은 글은 하나 · 다르면 따로', () => {
    expect(mergeFloat('♥ 케미 +1', '♥ 케미 +1')).toBe('♥ 케미 +2');
    expect(mergeFloat('+12', '+5')).toBe('+17');
    expect(mergeFloat('+1,200', '+900')).toBe('+2,100');
    expect(mergeFloat('뚝딱!', '뚝딱!')).toBe('뚝딱!');
    expect(mergeFloat('뚝딱!', '쿵!')).toBeNull();
    expect(mergeFloat('Lv.3!', '+12')).toBeNull();
    expect(mergeFloat('+3', '−3')).toBeNull();
  });
  it('조용히: 같은 자리 두 번 → 하나 「케미 +2」 · 작은 글씨(q) · 0.9초 뒤 사라짐', () => {
    vi.useFakeTimers();
    setFlag('flQuiet', true);
    floatW(2, 2, 34, '♥ 케미 +1', 'heart');
    floatW(2, 2, 34, '♥ 케미 +1', 'heart');
    const f = document.querySelectorAll('.flt');
    expect(f.length).toBe(1);
    expect(f[0].textContent).toBe('♥ 케미 +2');
    expect(f[0].classList.contains('q')).toBe(true);
    vi.advanceTimersByTime(C.floatMs + 1);
    expect(document.querySelectorAll('.flt').length).toBe(0);
  });
  it('끔: 예전처럼 차례대로 (0.6초 뒤 두 번째 · 1.5초)', () => {
    vi.useFakeTimers();
    floatW(7, 7, 34, '♥ 케미 +1', 'heart');
    floatW(7, 7, 34, '♥ 케미 +1', 'heart');
    expect(document.querySelectorAll('.flt').length).toBe(1);
    expect(document.querySelector('.flt')!.classList.contains('q')).toBe(false);
    vi.advanceTimersByTime(700);
    expect(document.querySelectorAll('.flt').length).toBe(2);
  });
});

describe('§2-3 이름표 규칙', () => {
  const base = { quiet: true, names: false, tier: null, regular: false, zoom: 2, tapped: false } as Parameters<typeof nameTagRule>[0];
  it('평소: 이름표 없음 · 전설·신화·영웅은 점', () => {
    expect(nameTagRule({ ...base, tier: 'legend' })).toEqual({ tag: false, alpha: 0, dot: true });
    expect(nameTagRule({ ...base, tier: 'mythic' })!.dot).toBe(true);
    expect(nameTagRule({ ...base, tier: 'hero' })!.dot).toBe(true);
    expect(nameTagRule({ ...base, regular: true })).toEqual({ tag: false, alpha: 0, dot: false });
    expect(nameTagRule(base)!.tag).toBe(false);
  });
  it('누르면 이름표 (진하게)', () => {
    expect(nameTagRule({ ...base, tapped: true })).toEqual({ tag: true, alpha: 1, dot: false });
    expect(nameTagRule({ ...base, tier: 'legend', tapped: true })!.alpha).toBe(1);
  });
  it('배율 3에서만 단골 이상 연하게 (60%) · 그냥 손님은 없음', () => {
    expect(nameTagRule({ ...base, zoom: 3, regular: true })).toEqual({ tag: true, alpha: 0.6, dot: false });
    expect(nameTagRule({ ...base, zoom: 3, tier: 'hero' })!.alpha).toBe(0.6);
    expect(nameTagRule({ ...base, zoom: 3 })!.tag).toBe(false);
    expect(nameTagRule({ ...base, zoom: 2, regular: true })!.tag).toBe(false);
  });
  it('「손님 이름 항상 보기」를 켠 사람 = 예전 그대로 (사용자 설정 우선) · 조용히 끔도 예전 그대로', () => {
    expect(nameTagRule({ ...base, names: true, tier: 'legend' })).toBeNull();
    expect(nameTagRule({ ...base, quiet: false, tier: 'legend' })).toBeNull();
  });
  it('guestNames 설정을 그대로 읽는다 (조용히가 바꾸지 않음)', () => {
    setFlag('flQuiet', true);
    setGuestNames(true);
    reloadGuestNames();
    expect(localStorage.getItem('legacy-of-adventure-guestNames')).toBe('true');
    setQuietPref(false);
    setQuietPref(true);
    expect(localStorage.getItem('legacy-of-adventure-guestNames')).toBe('true');
  });
});

describe('§2-5 아래 소문·채팅 띠', () => {
  beforeEach(() => resetVillageOpen());
  it('마을을 연 뒤 10초 숨김 · 그 뒤 보임 · 다시 열어도 처음 시각 기준', () => {
    noteVillageOpen(1000);
    expect(bandHidden(1000, true)).toBe(true);
    expect(bandHidden(1000 + C.bandHideMs - 1, true)).toBe(true);
    noteVillageOpen(9000);
    expect(bandHidden(1000 + C.bandHideMs, true)).toBe(false);
  });
  it('조용히 끔이면 숨기지 않음 · 마을을 열기 전엔 숨기지 않음', () => {
    expect(bandHidden(0, true)).toBe(false);
    noteVillageOpen(0);
    expect(bandHidden(10, false)).toBe(false);
  });
});

describe('§2-2 목표 달성 안내', () => {
  beforeEach(() => resetProgress());
  const goalUp = () => {
    P.goals = { day: today(), list: [{ id: 'send', target: 1, progress: 0, claimed: false }] };
  };
  it('조용히: 가운데 안내 상자 대신 알약 깜빡(goalNudge)', () => {
    setFlag('flQuiet', true);
    const toast = vi.spyOn(uiHooks, 'toast');
    const nudge = vi.spyOn(quietHooks, 'goalNudge');
    goalUp();
    track('expeditionSent');
    expect(P.goals.list[0]).toMatchObject({ id: 'send', progress: 1 });
    {
      expect(nudge).toHaveBeenCalled();
      expect(toast.mock.calls.some((c) => String(c[0]).includes('오늘의 목표 달성'))).toBe(false);
    }
    toast.mockRestore();
    nudge.mockRestore();
  });
  it('끔: 예전처럼 안내 상자', () => {
    const toast = vi.spyOn(uiHooks, 'toast');
    const nudge = vi.spyOn(quietHooks, 'goalNudge');
    goalUp();
    track('expeditionSent');
    expect(P.goals.list[0]).toMatchObject({ id: 'send', progress: 1 });
    {
      expect(nudge).not.toHaveBeenCalled();
      expect(toast.mock.calls.some((c) => String(c[0]).includes('오늘의 목표 달성'))).toBe(true);
    }
    toast.mockRestore();
    nudge.mockRestore();
  });
});
