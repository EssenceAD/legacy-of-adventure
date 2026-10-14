// 버그 고침(플래그 없음): 티저 초상화 미리 불러오기 · 늦은 칸만 페이드인
import { describe, expect, it, vi } from 'vitest';
import { HEROES } from '../src/data/heroes';
import { PORTRAITS } from '../src/engine/assets';
import { preloadTeaserPortraits } from '../src/teaser/director';

describe('티저 초상화 미리 불러오기', () => {
  it('컷 5(영웅 5 + 아리아) · 컷 9(기사 · 레온) 초상화를 Image로 미리 요청', () => {
    const keys = [...HEROES.slice(0, 5).map((h) => 'hero_' + h.id), 'legend_aria', 'mc_knight_f', 'legend_leon'];
    for (const k of keys) PORTRAITS[k] = `/assets/portraits/${k}.png`;
    const made: string[] = [];
    const spy = vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation((v: string) => void made.push(v));
    try {
      preloadTeaserPortraits();
      preloadTeaserPortraits(); // 두 번째는 다시 안 함
    } finally {
      spy.mockRestore();
    }
    expect(made).toEqual(keys.map((k) => PORTRAITS[k]));
  });
});
