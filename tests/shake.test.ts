// HOTFIX15: 화면 흔들림 끔(기본)/약하게/보통 — 오프셋 0 / ≤1 / 지금 값 · 옛 저장(설정 없음) = 끔
import { beforeEach, describe, expect, it } from 'vitest';
import { setShakeLv, shakeLv, shakeParams } from '../src/engine/shake';

beforeEach(() => localStorage.removeItem('legacy-of-adventure-shake'));
describe('화면 흔들림', () => {
  it('설정이 없으면(옛 저장) 끔', () => {
    expect(shakeLv()).toBe('off');
    expect(shakeParams(4, 0.12)).toBeNull();
  });
  it('약하게: 최대 1px · 0.08초', () => {
    setShakeLv('low');
    expect(shakeParams(4, 0.12)).toEqual({ amp: 1, dur: 0.08 });
    expect(shakeParams(0.5, 0.05)).toEqual({ amp: 0.5, dur: 0.05 });
  });
  it('보통: 지금 값 그대로', () => {
    setShakeLv('normal');
    expect(shakeParams(4, 0.12)).toEqual({ amp: 4, dur: 0.12 });
  });
});
