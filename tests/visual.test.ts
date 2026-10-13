// VISUAL v0.25.0 실험실: 기본 꺼짐 · 이 기기 토글로만 켜짐 · 마스터 팔레트 56색
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { FLAG_DEFAULTS, flag } from '../src/world/flags';
import { bigNum, labOn, setLab, vis } from '../src/world/visual';
import { fmtKo } from '../src/world/goldsink';
import { MASTER_PALETTE } from '../src/data/palette';
import { nearest } from '../src/engine/palette';
import { calmForest, grassPair } from '../src/world/ground';

beforeEach(() => setLab(false));

describe('실험실 스위치', () => {
  it('플래그 기본 꺼짐 (코드 · flags.json 둘 다)', () => {
    const j = JSON.parse(fs.readFileSync('public/flags.json', 'utf8'));
    for (const k of ['paletteV2', 'calmWorld', 'hudV2', 'uiKitV2', 'visualLabOpen', 'guestSortPin', 'autoPathNone', 'boardLevelUp', 'mythicGuide'] as const) {
      expect(FLAG_DEFAULTS[k]).toBe(false);
      expect(j[k]).toBe(false);
      expect(flag(k)).toBe(false);
    }
  });
  it('토글 끔 = 지금 화면 그대로 (색 함수가 원래 값)', () => {
    expect(vis('paletteV2')).toBe(false);
    expect(vis('calmWorld')).toBe(false);
    expect(vis('hudV2')).toBe(false);
    expect(vis('uiKitV2')).toBe(false);
    expect(calmForest('#3e6a34')).toBe('#3e6a34');
    expect(grassPair('#78b84a', '#5f9a3c')).toEqual(['#78b84a', '#5f9a3c']);
  });
  it('토글 켬 = 이 기기에서만 켜짐 · 저장됨', () => {
    setLab(true);
    expect(labOn()).toBe(true);
    expect(localStorage.getItem('legacy-of-adventure-visualLab')).toBe('true');
    expect(vis('calmWorld')).toBe(true);
    expect(calmForest('#3e6a34')).not.toBe('#3e6a34');
    const [a, b] = grassPair('#78b84a', '#5f9a3c');
    // 무늬 대비가 줄었다 (두 색 차이)
    const diff = (x: string, y: string) => [1, 3, 5].reduce((s, o) => s + Math.abs(parseInt(x.slice(o, o + 2), 16) - parseInt(y.slice(o, o + 2), 16)), 0);
    expect(diff(a, b)).toBeLessThan(diff('#78b84a', '#5f9a3c') * 0.7);
    setLab(false);
    expect(localStorage.getItem('legacy-of-adventure-visualLab')).toBeNull();
  });
});

describe('§5 큰 수 줄임 (uiKitV2)', () => {
  it('한 규칙: 100만 미만은 쉼표 · 1.2M · 34M · 1.2B (HUD 금화 「9.9M」과 같게)', () => {
    expect(bigNum(999_999)).toBe('999,999');
    expect(bigNum(1_234_567)).toBe('1.2M');
    expect(bigNum(9_900_000)).toBe('9.9M');
    expect(bigNum(34_000_000)).toBe('34M');
    expect(bigNum(1_234_000_000)).toBe('1.2B');
    expect(bigNum(-2_500_000)).toBe('-2.5M');
  });
  it('끄면 금화 짧게(만·억) 그대로 · 켜면 같은 규칙', () => {
    expect(fmtKo(16_000)).toBe('1.6만');
    expect(fmtKo(120_000_000)).toBe('1.2억');
    setLab(true);
    expect(fmtKo(16_000)).toBe('16,000');
    expect(fmtKo(120_000_000)).toBe('120M');
  });
});

describe('마스터 팔레트', () => {
  it('56색 · 가장 어두운 색 남보라 · 마지막은 검은 외곽선 · palette.png와 같은 값', () => {
    expect(MASTER_PALETTE.length).toBe(56);
    expect(MASTER_PALETTE).toContain('#2b2440');
    expect(MASTER_PALETTE[55]).toBe('#1c1018');
    expect(fs.existsSync('public/assets/palette.png')).toBe(true);
  });
  it('가장 가까운 색: 팔레트 색은 자기 자신', () => {
    MASTER_PALETTE.forEach((h, i) => expect(nearest(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16))).toBe(i));
  });
});
