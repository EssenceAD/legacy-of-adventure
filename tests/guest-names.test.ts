// 형철 판정 (T1): 설정 「손님 이름 항상 보기」 — 기본 끔 · 이 기기에 저장 · 세이브 설정 동기화(P.prefs)로 폰·PC가 같게
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYNC_PREF_KEYS } from '../src/save/save';
import { collectPrefs, mergePrefsOnLoad } from '../src/ui/prefsSync';
import { setFlag } from '../src/world/flags';
import { GUEST_NAMES_KEY, guestNamesOn, reloadGuestNames, setGuestNames } from '../src/world/guestNames';
import { MANUAL_V2 } from '../src/data/story/manual';
import { P, resetProgress } from '../src/world/state';

const PRE = 'legacy-of-adventure-';

describe('손님 이름 항상 보기 (guestNames)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetProgress();
    reloadGuestNames();
  });
  afterEach(() => setFlag('settingsTabs', false));

  it('기본은 꺼짐', () => {
    expect(guestNamesOn()).toBe(false);
    expect(localStorage.getItem(PRE + GUEST_NAMES_KEY)).toBeNull();
  });
  it('켜면 이 기기에 저장되고 다시 읽어도 켜져 있다 · 끄면 꺼짐', () => {
    setGuestNames(true);
    expect(localStorage.getItem(PRE + 'guestNames')).toBe('true');
    reloadGuestNames();
    expect(guestNamesOn()).toBe(true);
    setGuestNames(false);
    reloadGuestNames();
    expect(guestNamesOn()).toBe(false);
  });
  it('이상한 값은 꺼짐으로', () => {
    localStorage.setItem(PRE + 'guestNames', '"yes"');
    reloadGuestNames();
    expect(guestNamesOn()).toBe(false);
  });
  it('설정 동기화 키에 들어 있다 — 세이브 쪽이 새로우면 이 기기에 쓰고 다시 읽는다', () => {
    expect(SYNC_PREF_KEYS).toContain('guestNames');
    setGuestNames(true);
    expect(collectPrefs().guestNames).toBe('true');
    setFlag('settingsTabs', true);
    P.prefs = { at: Date.now() + 1e6, v: { guestNames: 'false' } };
    expect(guestNamesOn()).toBe(true);
    expect(mergePrefsOnLoad()).toBe('save');
    expect(guestNamesOn()).toBe(false);
  });
  it('안내서에 설정 줄이 있다', () => {
    const lines = MANUAL_V2.flatMap((s) => s.lines).join('\n');
    expect(lines).toContain('손님 이름 항상 보기');
  });
});
