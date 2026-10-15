// 밤 창문·대장간 불빛 마스크: 실제 창·화덕 입구 안에서만 (scripts/fix-light-masks.mjs · scripts/light-openings.json)
//  대장간 신고 (v0.25.48 로또1등): 화덕 빛이 입구 위 들보까지 사각형으로 올라와 윗변이 곧게 잘린 판자처럼 보였다
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { FORGE_GLOW, LIT_SPRITES } from '../src/data/catalog';
import { forgeGlowGeom } from '../src/world/daynight';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const SP = 'public/assets/sprites/';
type Shape = [number, number, number, number] | { poly: [number, number][] };
const WINDOWS: Record<string, [number, number][]> = JSON.parse(fs.readFileSync(SP + 'windows.json', 'utf8'));
const OPEN: Record<string, Shape[]> = JSON.parse(fs.readFileSync('scripts/light-openings.json', 'utf8'));
const ROOFS: Record<string, [number, number][][]> = JSON.parse(fs.readFileSync(SP + 'roofs.json', 'utf8'));

const inPoly = (poly: [number, number][], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const inShape = (s: Shape, x: number, y: number) => ('poly' in s ? inPoly(s.poly, x + 0.5, y + 0.5) : x >= s[0] && x <= s[2] && y >= s[1] && y <= s[3]);
const masked = Object.keys(OPEN);

describe('밤 불빛 마스크 = 입구 안만', () => {
  it('마스크를 쓰는 건물 그림(목욕탕·기념비 빼고)은 모두 입구 모양이 있다', () => {
    for (const k of LIT_SPRITES.filter((k) => k !== 'bath' && k !== 'monument')) expect(OPEN[k], k).toBeTruthy();
  });
  it.each(masked)('%s: 마스크 픽셀은 모두 창·입구 안 · 불투명 · (픽셀 지붕) 밖', (k) => {
    const png = PNG.sync.read(fs.readFileSync(SP + k + '.png'));
    const pts = WINDOWS[k];
    expect(pts.length).toBeGreaterThan(0);
    const out = pts.filter(([y, x]) => !OPEN[k].some((s) => inShape(s, x, y)));
    expect(out, `${k} 입구 밖 픽셀`).toEqual([]);
    for (const [y, x] of pts) expect(png.data[(y * png.width + x) * 4 + 3]).toBeGreaterThanOrEqual(128);
    // 픽셀 단위 지붕 다각형(땅 개편 새 그림)이 있으면 지붕 위 픽셀도 없어야 한다
    if ((ROOFS[k]?.length ?? 0) > 10) {
      const onRoof = pts.filter(([y, x]) => ROOFS[k].some((p) => inPoly(p, x + 0.5, y + 0.5)));
      expect(onRoof, `${k} 지붕 위 픽셀`).toEqual([]);
    }
  });
  it('대장간: 입구 위 들보(기울어진 윗변) 위로는 한 픽셀도 없다 · 상자 윗변 y=48 일자 줄 없음', () => {
    const pts = WINDOWS.smith;
    // 들보 아랫변: (18,47) → (44,60) 기울기 1/2 · 왼쪽 위 모서리는 둥글게 (14,51)
    for (const [y, x] of pts) {
      const top = x >= 18 ? 47 + (x - 18) / 2 : 47 + (18 - x);
      expect(y + 0.5, `smith (${x},${y})`).toBeGreaterThan(top);
    }
    // 예전 버그: 들보 줄(y 48) 전체 폭이 밝혀짐
    const row48 = pts.filter(([y]) => y === 48).length;
    expect(row48).toBeLessThan(4);
    // 오른쪽 기둥·버팀대(x 45↑) 없음
    expect(pts.filter(([, x]) => x >= 45)).toEqual([]);
  });
  it('windows.json 은 light-openings.json 으로 만든 결과와 같다 (손으로 고치지 않기)', () => {
    expect(() => execFileSync('node', ['scripts/fix-light-masks.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
  });
});

describe('대장간 화덕 바닥 빛', () => {
  it('빛 위쪽 끝은 입구 윗변보다 한참 아래 (바닥 쪽만)', () => {
    for (const [k, g] of Object.entries(FORGE_GLOW)) {
      const w = PNG.sync.read(fs.readFileSync(SP + k + '.png')).width;
      for (const key of [k, k + '~f']) {
        const geo = forgeGlowGeom(key, w)!;
        expect(geo).toBeTruthy();
        expect(geo.top).toBeGreaterThan(g.openTop + 10);
        expect(geo.top).toBeGreaterThanOrEqual(g.openBottom - g.ry);
        // 마스크의 가장 위 픽셀보다도 아래
        const minY = Math.min(...WINDOWS[k].map(([y]) => y));
        expect(geo.top).toBeGreaterThan(minY);
      }
      expect(forgeGlowGeom(k + '~f', w)!.cx).toBe(w - g.cx);
    }
  });
  it('대장간이 아닌 그림은 바닥 빛 없음', () => {
    expect(forgeGlowGeom('inn', 100)).toBeNull();
    expect(forgeGlowGeom(null, 100)).toBeNull();
  });
});
