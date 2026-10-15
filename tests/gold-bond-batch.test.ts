// 이어하기 멈춤(replay #tCont 클릭 시간 초과): 방치 사냥 수천 판 × 500G마다 bond 한 번씩 → 손님 장비를 매번 훑어 몇 초 멈췄다
//  gotGold는 500G 묶음을 한 번에 bond(n)으로 · bond는 배율을 한 번만 센다 · 결과(게이지 범위)는 그대로
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { bond } from '../src/world/legends';
import { gotGold, legendHooks, P, resetProgress } from '../src/world/state';

beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div>';
});
describe('금화 → 전설 인연 (묶어서)', () => {
  it('gotGold: 500G마다 n번을 bond 한 번으로 (남는 금화는 다음에)', () => {
    const spy = vi.spyOn(legendHooks, 'bond');
    // 앞에서 남은 금화(500 미만)가 있을 수 있다 → 10 또는 11
    gotGold(5250);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe('goldEarn');
    expect([10, 11]).toContain(spy.mock.calls[0][1]);
    // 1000G씩 다섯 번 = 정확히 10번 (남는 금화는 그대로 이어짐)
    spy.mockClear();
    for (let i = 0; i < 5; i++) gotGold(1000);
    expect(spy.mock.calls.reduce((t, c) => t + (c[1] ?? 1), 0)).toBe(10);
    spy.mockRestore();
  });
  it('bond(n): 게이지는 n번 올린 범위 안 · 100에서 멈춤', () => {
    const L = CONFIG.legends;
    P.legends.vivian = { st: 'rumor', gauge: 0 };
    bond('goldEarn', 5);
    const g = P.legends.vivian.gauge;
    expect(g).toBeGreaterThanOrEqual(5 * L.gaugeMin);
    expect(g).toBeLessThanOrEqual(Math.min(100, 5 * L.gaugeMax * 3));
    bond('goldEarn', 10000);
    expect(P.legends.vivian.gauge).toBe(100);
    expect(P.legends.vivian.full).toBeTruthy();
  });
  it('많이 벌어도 빠르게 (수천 번 → 한 번)', () => {
    P.legends.vivian = { st: 'rumor', gauge: 0 };
    const t0 = performance.now();
    for (let i = 0; i < 3000; i++) gotGold(40000);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(P.legends.vivian.gauge).toBe(100);
  });
});
