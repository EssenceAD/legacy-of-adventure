// 핫픽스 12 §5: 단축키 — 기본값 · 바꾸기 · 겹침 경고 · 되돌리기
import { beforeEach, describe, expect, it } from 'vitest';
import { actionOf, capKey, COMBAT_ACTIONS, keyLabel, keysFor, keysShown, resetKeys, setKey, VILLAGE_ACTIONS } from '../src/engine/keys';

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
  it('v0.24.4 키캡 = 실제로 눌리는 키: Space 공격 · Shift 구르기 · 1·2·3 스킬1·스킬2·합동기', () => {
    const want = { attack: ' ', dodge: 'shift', s1: '1', s2: '2', ult: '3' } as const;
    for (const [a, k] of Object.entries(want)) {
      expect(capKey(a as never)).toBe(k);
      expect(actionOf(k, COMBAT_ACTIONS)).toBe(a);
      expect(keysShown(a as never).sort()).toEqual([...keysFor(a as never)].sort());
    }
    expect(['attack', 'dodge', 's1', 's2', 'ult'].map((a) => keyLabel(capKey(a as never)))).toEqual(['Space', 'Shift', '1', '2', '3']);
    // 바꾼 키는 그 키가 키캡에
    setKey('s1', 'q');
    expect(capKey('s1')).toBe('q');
    expect(actionOf('q', COMBAT_ACTIONS)).toBe('s1');
  });
});
