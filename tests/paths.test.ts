// UI 경로: 그림 주소가 전부 절대 주소인가 (핫픽스 7 1번 재발 방지 — CSS 변수 속 상대 주소는 CSS 파일 기준으로 풀려 404)
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { abs, UI, uiSrc } from '../src/ui/kit';

describe('UI 그림 경로', () => {
  it('UI 키트 그림 주소는 모두 http(s)로 시작하는 절대 주소', () => {
    for (const k of UI) expect(uiSrc(k)).toMatch(/^https?:\/\//);
    expect(abs('assets/x.png')).toMatch(/^https?:\/\/.+\/assets\/x\.png$/);
  });
  it('CSS에 상대 그림 주소(url(assets/…) · url(../…))가 없다', () => {
    const css = fs.readFileSync('src/style.css', 'utf8');
    expect(css.match(/url\(\s*['"]?(?!data:|https?:|\/)[^)'"]*\.(png|jpg|gif|webp)/g) ?? []).toEqual([]);
  });
  it('JS에서 CSS 변수로 그림을 넣을 때 절대 주소를 쓴다', () => {
    for (const f of fs.readdirSync('src', { recursive: true }) as string[]) {
      if (!f.endsWith('.ts')) continue;
      const s = fs.readFileSync('src/' + f, 'utf8');
      // setProperty('--…', `url(assets/…)`) 같은 상대 주소 금지
      expect(s.match(/setProperty\([^)]*url\((?!\$\{)['"]?assets\//g) ?? [], f).toEqual([]);
    }
  });
});
