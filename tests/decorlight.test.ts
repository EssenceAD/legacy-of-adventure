// 꾸미기 낮 조명 (이카몰리): 꾸미기 중 = 낮 · 끝나면 0.4초에 걸쳐 지금 빛 · 움직임 줄이기 = 바로 · 게임 시계는 안 건드림
import { describe, expect, it } from 'vitest';
import { DECOR_FADE_S, decorMixStep, decorNight } from '../src/world/decorLight';
import { NL, sceneNight, setDecorDay } from '../src/world/daynight';
import { CONFIG } from '../src/data/config';
import { FLAG_DEFAULTS } from '../src/world/flags';
import { S } from '../src/world/state';
import flagsJson from '../public/flags.json';

describe('꾸미기 낮 조명 — 빛 정도', () => {
  it('꾸미기 중이면 밤이어도 낮 (섞임 1 · 밤 정도 0)', () => {
    expect(decorMixStep(0, true, 0.016, false)).toBe(1);
    expect(decorMixStep(0.3, true, 0, true)).toBe(1);
    expect(decorNight(1, true, 1)).toBe(0);
    expect(decorNight(0.6, true, 0)).toBe(0);
  });
  it('꾸미기가 아니면 지금 빛 그대로', () => {
    expect(decorMixStep(0, false, 0.016, false)).toBe(0);
    expect(decorNight(1, false, 0)).toBe(1);
    expect(decorNight(0.4, false, 0)).toBeCloseTo(0.4);
    expect(decorNight(0, false, 0)).toBe(0);
  });
  it('끝나면 0.4초에 걸쳐 낮 → 지금 빛 (고르게 줄고 · 0.4초에 끝)', () => {
    expect(DECOR_FADE_S).toBe(0.4);
    let m = decorMixStep(0, true, 0.016, false);
    const seen: number[] = [];
    let t = 0;
    while (m > 0 && t < 1) {
      m = decorMixStep(m, false, 0.05, false);
      t += 0.05;
      seen.push(m);
    }
    expect(t).toBeCloseTo(0.4, 5);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThan(seen[i - 1]);
    expect(decorMixStep(1, false, 0.1, false)).toBeCloseTo(0.75);
    expect(decorMixStep(1, false, 0.2, false)).toBeCloseTo(0.5);
    // 밤 정도도 같이: 절반이면 밤 절반
    expect(decorNight(1, false, 0.5)).toBeCloseTo(0.5);
    expect(decorNight(1, false, 0)).toBe(1);
    // 큰 dt(탭 숨김 뒤 등)도 0 아래로 안 감 · 이상한 dt는 멈춤
    expect(decorMixStep(1, false, 5, false)).toBe(0);
    expect(decorMixStep(0.5, false, NaN, false)).toBe(0.5);
    expect(decorMixStep(0.5, false, -1, false)).toBe(0.5);
  });
  it('움직임 줄이기면 끝날 때 바로 지금 빛', () => {
    expect(decorMixStep(1, false, 0.016, true)).toBe(0);
    expect(decorMixStep(1, false, 0, true)).toBe(0);
  });
});

describe('꾸미기 낮 조명 — 밤 단계 · 시계', () => {
  it('꾸미기 중 NL = 0 · 시간 상태는 그대로 · 끝나면 원래 단계', () => {
    const night = S.night;
    const nt0 = S.nightT;
    const clock = S.clock;
    S.night = true;
    S.nightT = 1;
    setDecorDay(true, 1);
    expect(NL).toBe(0);
    expect(sceneNight()).toBe(0);
    expect(S.nightT).toBe(1);
    expect(S.night).toBe(true);
    expect(S.clock).toBe(clock);
    setDecorDay(false, 0.5);
    expect(NL).toBe(CONFIG.dayNight.tintSteps);
    expect(sceneNight()).toBeCloseTo(0.5);
    setDecorDay(false, 0);
    expect(sceneNight()).toBe(1);
    S.night = night;
    S.nightT = nt0;
  });
  it('끄는 스위치는 켜진 채 (FLAG_DEFAULTS · flags.json 둘 다)', () => {
    expect(FLAG_DEFAULTS.decorDayLight).toBe(true);
    expect((flagsJson as Record<string, boolean>).decorDayLight).toBe(true);
  });
});
