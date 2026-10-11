// HUNT_WORLD_SPEC §1: 지역 테마 — 지역마다 테마 · 둘레 소품은 필드 밖 · 소품 그림 파일이 다 있다 · 스테이지마다 배치가 다르다
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CONFIG } from '../src/data/config';
import { REGIONS } from '../src/data/items';
import { placeProps, THEMES, themeOf } from '../src/combat/theme';

const N = CONFIG.combat.field;

describe('사냥터 테마', () => {
  it('지역마다 자기 테마 (숲으로 대체되지 않음) · 소품 4종', () => {
    for (const r of REGIONS) {
      expect(THEMES[r.id], r.id).toBeDefined();
      expect(themeOf(r.id).props.length).toBe(4);
    }
    expect(new Set(REGIONS.map((r) => themeOf(r.id).pal.void)).size).toBe(REGIONS.length);
  });
  it('소품 그림 파일 20개가 public에 있다', () => {
    for (const t of Object.values(THEMES)) for (const k of t.props) expect(fs.existsSync(`public/assets/combat/props/${k}.png`), k).toBe(true);
  });
  it('둘레 소품은 필드 밖 1~2칸 (전투 칸과 겹치지 않음) · 스테이지마다 배치가 다르다', () => {
    for (const r of REGIONS)
      for (let s = 1; s <= 10; s++) {
        const ps = placeProps(r.id, s, N);
        expect(ps.length).toBeGreaterThan(4);
        for (const p of ps) {
          const out = p.x < -0.9 || p.y < -0.9 || p.x > N + 0.9 || p.y > N + 0.9;
          expect(out, `${r.id} ${s} ${p.x},${p.y}`).toBe(true);
          expect(Math.min(p.x, p.y)).toBeGreaterThan(-2.6);
          expect(Math.max(p.x, p.y)).toBeLessThan(N + 2.6);
        }
      }
    expect(JSON.stringify(placeProps('mine', 1, N))).not.toBe(JSON.stringify(placeProps('mine', 2, N)));
  });
});
