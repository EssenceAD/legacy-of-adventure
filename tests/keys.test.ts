// 핫픽스 12 §5: 단축키 — 기본값 · 바꾸기 · 겹침 경고 · 되돌리기
import { beforeEach, describe, expect, it } from 'vitest';
import { actionOf, COMBAT_ACTIONS, keyLabel, keysFor, resetKeys, setKey, VILLAGE_ACTIONS } from '../src/engine/keys';

describe('단축키', () => {
  beforeEach(() => resetKeys());
  it('기본값: J·Space 공격 · K·Shift 구르기 · Esc 일시정지 · B 건설', () => {
    expect(actionOf('j', COMBAT_ACTIONS)).toBe('attack');
    expect(actionOf(' ', COMBAT_ACTIONS)).toBe('attack');
    expect(actionOf('Shift', COMBAT_ACTIONS)).toBe('dodge');
    expect(actionOf('Escape', COMBAT_ACTIONS)).toBe('pause');
    expect(actionOf('B', VILLAGE_ACTIONS)).toBe('build');
    expect(actionOf('b', COMBAT_ACTIONS)).toBeNull();
  });
  it('바꾸면 그 키 하나만', () => {
    expect(setKey('attack', 'L')).toBeNull();
    expect(keysFor('attack')).toEqual(['l']);
    expect(actionOf('j', COMBAT_ACTIONS)).toBeNull();
    expect(actionOf('l', COMBAT_ACTIONS)).toBe('attack');
  });
  it('같은 묶음에서 겹치면 안 바꾸고 그 동작을 알려 줌 · 다른 묶음은 괜찮음', () => {
    expect(setKey('attack', 'k')).toBe('dodge');
    expect(keysFor('attack')).toEqual(['j', ' ']);
    expect(setKey('build', 'j')).toBeNull();
  });
  it('되돌리기', () => {
    setKey('auto', 'y');
    resetKeys();
    expect(keysFor('auto')).toEqual(['t']);
  });
  it('키캡 글자', () => {
    expect(keyLabel(' ')).toBe('Space');
    expect(keyLabel('escape')).toBe('Esc');
    expect(keyLabel('u')).toBe('U');
  });
});
