// v0.25.23 테스터 제보 「대장간 화로 불빛이 지붕 위로 튀어나와 보임」 — 원인: 건물 뒤 모닥불의 둥근 빛·불티를 맨 위에 그렸다
//  · 창문 불빛 마스크(windows.json)는 그림 안 · 불빛 건물 레벨마다 그림 크기 안
//  · 앞 건물 그림에 가려진 불꽃 자리는 「가려짐」 (불티를 띄우지 않는다)
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { flameCovered } from '../src/world/render';
import { LIT_SPRITES } from '../src/data/catalog';

const json = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const META = json<Record<string, { w: number; h: number; fw: number; fh: number }>>('public/assets/sprites/meta.json');
const WIN = json<Record<string, [number, number][]>>('public/assets/sprites/windows.json');

describe('창문 불빛 마스크는 그림 안', () => {
  for (const k of Object.keys(WIN))
    it(k, () => {
      const m = META[k];
      expect(m, `${k} 크기표`).toBeTruthy();
      expect(LIT_SPRITES).toContain(k);
      const out = WIN[k].filter(([y, x]) => x < 0 || y < 0 || x >= m.w || y >= m.h);
      expect(out).toEqual([]);
    });
});

describe('모닥불 불꽃이 앞 건물에 가려졌나', () => {
  // 대장간 3×3 (그림 96×103) · 불투명 = 그림 전체로 친다
  const smith = { kind: 'smith', tx: 10, ty: 10, fw: 3, fh: 3, sprite: 'smith' };
  const solid = () => 255;
  const meta = { smith: META.smith };
  it('대장간 바로 뒤 (x−1, y+1) → 가려짐', () => {
    const fire = { tx: 9, ty: 11, fw: 1, fh: 1, sprite: null };
    expect(flameCovered(fire, [smith, fire], solid, meta)).toBe(true);
  });
  it('대장간 바로 뒤 (x+1, y−1) → 가려짐', () => {
    const fire = { tx: 11, ty: 9, fw: 1, fh: 1, sprite: null };
    expect(flameCovered(fire, [smith, fire], solid, meta)).toBe(true);
  });
  it('대장간 앞 (y+3) → 안 가려짐 (앞 불은 건물보다 나중에 그린다)', () => {
    const fire = { tx: 11, ty: 13, fw: 1, fh: 1, sprite: null };
    expect(flameCovered(fire, [smith, fire], solid, meta)).toBe(false);
  });
  it('뒤라도 그 자리 픽셀이 투명하면 안 가려짐', () => {
    const fire = { tx: 9, ty: 11, fw: 1, fh: 1, sprite: null };
    expect(flameCovered(fire, [smith, fire], () => 0, meta)).toBe(false);
  });
});
