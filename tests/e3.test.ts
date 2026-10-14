// CHECKIN §E 보상 순간 (checkinFx) · §J3 글 대신 카드 (uiCards): 영수증 시간 · 별 기준 · 말투 스위치 · 플래그 기본 꺼짐
import { describe, expect, it } from 'vitest';
import { FLAG_DEFAULTS, setFlag } from '../src/world/flags';
import { fsay } from '../src/world/visual';
import { battleStars, rcTiming, RC_STEP, stampDur, keyDur, STAR_TIME } from '../src/ui/checkin';

describe('E3 플래그', () => {
  it('checkinFx · uiCards 기본 꺼짐', () => {
    expect(FLAG_DEFAULTS.checkinFx).toBe(false);
    expect(FLAG_DEFAULTS.uiCards).toBe(false);
  });
  it('말투: 끄면 예전 말 · 켜면 새 말', () => {
    expect(fsay('단골로 받기', '열쇠 드릴게요')).toBe('단골로 받기');
    setFlag('checkinFx', true);
    expect(fsay('단골로 받기', '열쇠 드릴게요')).toBe('열쇠 드릴게요');
    setFlag('checkinFx', false);
  });
});

describe('E 영수증 · 도장 · 열쇠 시간', () => {
  it('한 줄 0.08초 · 전체 1초 안 · 조용하면 0.3초 안', () => {
    expect(rcTiming(5, false)).toEqual({ step: RC_STEP, total: 5 * RC_STEP });
    const long = rcTiming(30, false);
    expect(long.total).toBeLessThanOrEqual(1);
    expect(long.step * 30).toBeCloseTo(long.total);
    expect(rcTiming(5, true).total).toBeLessThanOrEqual(0.3);
    expect(rcTiming(0, false)).toEqual({ step: 0, total: 0 });
  });
  it('도장 0.4초 · 열쇠 0.6초 · 조용하면 0.3초', () => {
    expect(stampDur(false)).toBe(0.4);
    expect(keyDur(false)).toBe(0.6);
    expect(stampDur(true)).toBe(0.3);
    expect(keyDur(true)).toBe(0.3);
  });
});

describe('J3 전투 결과 별', () => {
  const L = 150;
  it('세 기준(안 쓰러짐 · 빠르게 · 역할 조합) 다 맞으면 3개', () => {
    expect(battleStars({ win: true, downs: 0, time: 40, combo: true }, L).n).toBe(3);
  });
  it('이기면 최소 1개 · 지면 0개', () => {
    expect(battleStars({ win: true, downs: 2, time: 149, combo: false }, L).n).toBe(1);
    expect(battleStars({ win: false, downs: 0, time: 10, combo: true }, L).n).toBe(0);
  });
  it('시간 기준 = 제한 시간 절반', () => {
    expect(battleStars({ win: true, downs: 0, time: L * STAR_TIME, combo: false }, L).why).toEqual([true, true, false]);
    expect(battleStars({ win: true, downs: 0, time: L * STAR_TIME + 1, combo: false }, L).n).toBe(1);
  });
});
