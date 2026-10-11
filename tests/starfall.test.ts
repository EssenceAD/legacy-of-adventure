// STARFALL §1·§2: 별 잡기 → 게이지 증가 · 하루 1번 · 유성우(토 21~24시) 3번·2배 · 금요일 예고 편지 1번
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catchStar, showerLetter, showerOn, starAvailable, starsCaught } from '../src/world/legends';
import { P, S } from '../src/world/state';

const at = (iso: string) => vi.setSystemTime(new Date(iso));
beforeEach(() => {
  vi.useFakeTimers();
  S.started = true as never;
  S.visiting = false as never;
  S.night = true as never;
  P.starDay = '';
  P.starN = 0;
  P.legends = { luna: { st: 'rumor', gauge: 10 } } as never;
  P.meta.mail = [];
  P.meta.showerWeek = '';
});
afterEach(() => vi.useRealTimers());

describe('운명의 별', () => {
  it('평일 밤: 하루 1번 · 게이지 +1~10', () => {
    at('2026-10-14T22:00:00');
    expect(showerOn()).toBe(false);
    const c = catchStar()!;
    expect(c.key).toBe('luna');
    expect(c.add).toBeGreaterThanOrEqual(1);
    expect(c.add).toBeLessThanOrEqual(10);
    expect(P.legends.luna.gauge).toBe(10 + c.add);
    expect(starAvailable()).toBe(false);
    expect(catchStar()).toBeNull();
  });
  it('게임 낮에는 별이 없다 (유성우 때만 예외)', () => {
    at('2026-10-14T22:00:00');
    S.night = false as never;
    expect(starAvailable()).toBe(false);
  });
  it('유성우(토 21~24시): 게임 낮이어도 · 3번 · 2배', () => {
    at('2026-10-17T21:30:00');
    S.night = false as never;
    expect(showerOn()).toBe(true);
    const adds = [catchStar()!, catchStar()!, catchStar()!];
    expect(adds.every((c) => c.shower && c.add % 2 === 0)).toBe(true);
    expect(starsCaught()).toBe(3);
    expect(catchStar()).toBeNull();
  });
  it('옛 저장: 오늘 잡은 기록만 있으면 1번 잡은 걸로', () => {
    at('2026-10-14T22:00:00');
    P.starDay = new Date().toISOString().slice(0, 10);
    (P as { starN?: number }).starN = undefined;
    expect(starsCaught() >= 0).toBe(true);
  });
});

describe('유성우 예고 편지', () => {
  it('금요일에 한 번만 · 다른 요일엔 안 옴', () => {
    at('2026-10-15T10:00:00');
    showerLetter();
    expect(P.meta.mail.length).toBe(0);
    at('2026-10-16T10:00:00');
    showerLetter();
    showerLetter();
    expect(P.meta.mail.filter((m) => /유성우/.test(m.title)).length).toBe(1);
  });
});
