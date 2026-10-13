// CHECKIN §C2 (T2 세이브): 설정값을 세이브(P.prefs)에 — 옵션 칸 · 옛 저장 그대로 · 불러올 때 둘 중 최근 것
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { readSave, validPrefs } from '../src/save/save';
import { collectPrefs, localPrefs, mergePrefsOnLoad, pickPrefs } from '../src/ui/prefsSync';
import { setFlag } from '../src/world/flags';
import { P, resetProgress } from '../src/world/state';

const PRE = 'legacy-of-adventure-';
const viaStorage = (d: unknown) => {
  localStorage.setItem(CONFIG.save.key, JSON.stringify(d));
  return readSave();
};

describe('설정값 세이브 (P.prefs)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetProgress();
  });
  afterEach(() => setFlag('settingsTabs', false));

  it('옛 저장(v2~v6 · 실세이브)은 prefs 칸 없이 그대로 불러온다', () => {
    for (const f of ['v2', 'v3', 'v4', 'v5', 'v6', 'beta_town']) {
      const s = viaStorage(JSON.parse(fs.readFileSync(`tests/fixtures/${f}.json`, 'utf8')))!;
      expect(s, f).not.toBeNull();
      expect(s.progress.prefs, f).toBeUndefined();
      expect(JSON.stringify(s.progress).includes('"prefs"'), f).toBe(false);
    }
  });
  it('세이브에 든 설정은 아는 키 · 문자열만 남긴다 (다른 localStorage 키는 못 건드림)', () => {
    const v = validPrefs({ at: 5, v: { shake: '"low"', save: 'evil', 'visualLab': 'true', fontStep: 2 } });
    expect(v).toEqual({ at: 5, v: { shake: '"low"' } });
    expect(validPrefs({ at: 'x', v: {} })).toBeUndefined();
    expect(validPrefs(null)).toBeUndefined();
    expect(validPrefs({ at: 1, v: [] })).toBeUndefined();
  });
  it('불러오기를 거쳐도 prefs 칸이 남는다', () => {
    const old = JSON.parse(fs.readFileSync('tests/fixtures/v6.json', 'utf8'));
    const s = viaStorage({ ...old, version: 6, progress: { ...old.progress, prefs: { at: 123, v: { shake: '"normal"' } } } })!;
    expect(s.progress.prefs).toEqual({ at: 123, v: { shake: '"normal"' } });
  });
  it('둘 중 최근 것: 세이브가 더 새로우면 세이브 · 같거나 오래면 이 기기', () => {
    const l = { at: 100, v: {} };
    expect(pickPrefs(l, { at: 200, v: {} })).toBe('save');
    expect(pickPrefs(l, { at: 100, v: {} })).toBe('local');
    expect(pickPrefs(l, { at: 50, v: {} })).toBe('local');
    expect(pickPrefs(l, undefined)).toBe('local');
  });
  it('이 기기 시각: 처음 모으면 0 (세이브가 이긴다) · 바뀌면 지금', () => {
    localStorage.setItem(PRE + 'shake', '"low"');
    expect(localPrefs(1000).at).toBe(0);
    expect(localPrefs(2000).at).toBe(0);
    localStorage.setItem(PRE + 'shake', '"normal"');
    expect(localPrefs(3000).at).toBe(3000);
    expect(collectPrefs()).toEqual({ shake: '"normal"' });
  });
  it('플래그 끔: 불러와도 아무것도 안 한다', () => {
    P.prefs = { at: Date.now() + 1e6, v: { shake: '"normal"' } };
    expect(mergePrefsOnLoad()).toBe('off');
    expect(localStorage.getItem(PRE + 'shake')).toBeNull();
  });
  it('플래그 켬: 세이브 쪽이 새로우면 이 기기에 쓴다 · 아니면 이 기기 것을 세이브로', () => {
    setFlag('settingsTabs', true);
    localStorage.setItem(PRE + 'shake', '"low"');
    P.prefs = { at: Date.now(), v: { shake: '"normal"', settleOff: 'true' } };
    expect(mergePrefsOnLoad()).toBe('save');
    expect(localStorage.getItem(PRE + 'shake')).toBe('"normal"');
    expect(localStorage.getItem(PRE + 'settleOff')).toBe('true');
    // 같은 기기에서 다시 불러오기 → 이 기기 그대로 (같은 시각)
    expect(mergePrefsOnLoad()).toBe('local');
    // 이 기기에서 바꾸면 이 기기가 최근 → 오래된 세이브를 덮어쓰지 않고 세이브에 이 기기 값
    localStorage.setItem(PRE + 'shake', '"off"');
    P.prefs = { at: 1, v: { shake: '"normal"' } };
    expect(mergePrefsOnLoad()).toBe('local');
    expect(P.prefs!.v.shake).toBe('"off"');
  });
});
