// 핫픽스 v0.23.1: 아리아 부탁 — 모험에서 지쳐 돌아온 손님(체력 60 미만) 기억 · 진행 중이던 부탁 남은 시간 한 번 다시 3일
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { LEGENDS } from '../src/data/legends';
import { markAdventured } from '../src/world/actors';
import { makeAdventurer } from '../src/world/adventurers';
import { extendAriaOnce } from '../src/world/legends';
import { P, resetProgress } from '../src/world/state';

beforeEach(() => {
  resetProgress();
  document.body.innerHTML = '<div id="toast"></div>';
});
describe('아리아 부탁', () => {
  it('모험에서 체력 60 미만으로 돌아온 손님만 기억 (중복 없음)', () => {
    const a = makeAdventurer(1, 1, { status: 'regular' });
    const b = makeAdventurer(1, 1, { status: 'regular' });
    a.id = 1;
    b.id = 2;
    a.hp = 55;
    b.hp = 80;
    markAdventured([a, b]);
    markAdventured([a]);
    expect(P.tiredAdv).toEqual([1]);
  });
  it('진행 중인 부탁: 한 번만 남은 시간 3일로', () => {
    P.legends.aria = { st: 'visit', gauge: 100, until: Date.now() + 3600e3, prog: 4 };
    const t0 = Date.now();
    expect(extendAriaOnce(t0)).toBe(true);
    expect(P.legends.aria.until).toBe(t0 + CONFIG.legends.visitDays * 864e5);
    expect(P.legends.aria.prog).toBe(4);
    expect(extendAriaOnce(t0 + 1000)).toBe(false);
    P.legends.nyx = { st: 'rumor', gauge: 10 };
    resetProgress();
    expect(extendAriaOnce()).toBe(false);
  });
  it('부탁 문구', () => {
    expect(LEGENDS.find((l) => l.key === 'aria')!.request.text).toBe('모험에서 지쳐 돌아온 손님(체력 60 미만)이 방이나 온천에서 쉬고 일어나기 10번');
  });
});
