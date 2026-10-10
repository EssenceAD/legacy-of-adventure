// 경제: 방치 보상 상한 · 하루 1번 제한(실제 날짜)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { offlineGold } from '../src/world/offline';
import { dailyAttend } from '../src/world/meta';
import { P, S, world } from '../src/world/state';

const O = CONFIG.offline;
afterEach(() => vi.useRealTimers());
describe('경제', () => {
  it('방치 금화: 처음 3시간은 그대로, 그 뒤는 15%만', () => {
    // 상한이 없는 상태(땅 끝 · 레벨업할 건물 없음)에서 모양만 본다
    S.land = CONFIG.land.length;
    world.objs = [];
    const per = (h: number) => offlineGold(4, h * 3600).gold;
    const a = per(3);
    const b = per(6);
    expect(b - a).toBeCloseTo(a * O.tailRate, -1);
  });
  it('방치 금화는 다음 큰 지출의 상한 비율을 넘지 않는다', () => {
    S.land = 1;
    const r = offlineGold(50, O.maxRealHours * 3600 * 10);
    expect(r.capped).toBe(true);
  });
  it('출석은 하루(실제 날짜) 1번만 · 다음 날 다시', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 11, 10));
    P.meta.attend = { total: 0, last: '' };
    expect(dailyAttend()).toBe(1);
    expect(dailyAttend()).toBeNull();
    vi.setSystemTime(new Date(2026, 9, 11, 23, 59));
    expect(dailyAttend()).toBeNull();
    vi.setSystemTime(new Date(2026, 9, 12, 0, 1));
    expect(dailyAttend()).toBe(2);
  });
});
