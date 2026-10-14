// 웅스 신고 (72일차 새벽 04시 · 폰): 마을 캔버스의 울타리 밖 숲·바닥이 1~3초마다 잠깐 어두워졌다가 돌아옴
//  고친 것: 바닥 밤 색(밤 색조 + 숲 덧칠)을 매 프레임 덧칠하지 않고 (바닥 · 실제 쓴 색)마다 한 번 굽는다 · 잃은 캔버스는 죽은 것으로
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { litHex, litKey, nightLook, tintRGB, VEIL_RGB } from '../src/world/nightLook';
import { tintColor } from '../src/engine/assets';
import { canvasAlive } from '../src/engine/lru';
import { CONFIG } from '../src/data/config';

const STEPS = CONFIG.dayNight.tintSteps;

describe('밤 바닥 색 한 규칙', () => {
  it('밤 색조는 건물·손님 색조(tintColor)와 같은 값', () => {
    for (let nl = 0; nl <= STEPS; nl++) expect(`rgb(${tintRGB(nl / STEPS).join(',')})`).toBe(tintColor(nl / STEPS));
  });
  it('같은 밤 단계면 늘 같은 값 · 같은 캐시 키 (다시 굽지 않는다)', () => {
    const a = nightLook(10, STEPS, true);
    const b = nightLook(10, STEPS, true);
    expect(a).toEqual(b);
    expect(litKey('7|3||g4', a)).toBe(litKey('7|3||g4', b));
  });
  it('캐시 키는 실제로 쓴 색으로 — 단계·숲 덧칠·바닥이 다르면 다른 키', () => {
    const k = (nl: number, calm: boolean, g = '7|3||g4') => litKey(g, nightLook(nl, STEPS, calm));
    const keys = new Set([k(10, true), k(9, true), k(10, false), k(10, true, '7|4||g4'), k(1, true)]);
    expect(keys.size).toBe(5);
  });
  it('낮(0단계)은 색을 씌우지 않는다', () => {
    const L = nightLook(0, STEPS, true);
    expect(L.tint).toBeNull();
    expect(L.veil).toBe(0);
    expect(litHex('#3e6a34', L)).toBe('#3e6a34');
  });
  it('빈 곳 채움 색 = 구운 바닥과 같은 식 (multiply → 반투명 숲 덧칠)', () => {
    const L = nightLook(10, STEPS, true);
    const c = [0x3e, 0x6a, 0x34];
    const want = c.map((v, i) => Math.round(((v * L.tint![i]) / 255) * (1 - L.veil + (L.veil * VEIL_RGB[i]) / 255)));
    expect(litHex('#3e6a34', L)).toBe('#' + want.map((v) => v.toString(16).padStart(2, '0')).join(''));
    // 울타리 안(덧칠 없음)은 밤 색조만
    expect(litHex('#3e6a34', L, false)).toBe('#' + c.map((v, i) => Math.round((v * L.tint![i]) / 255).toString(16).padStart(2, '0')).join(''));
  });
});

describe('잃은 캔버스', () => {
  it('컨텍스트를 잃은 캔버스(isContextLost)는 죽은 것 → 바닥을 그 프레임에 다시 굽는다', () => {
    expect(canvasAlive({ width: 4, height: 4, getContext: () => ({ isContextLost: () => true }) })).toBe(false);
    expect(canvasAlive({ width: 4, height: 4, getContext: () => ({ isContextLost: () => false }) })).toBe(true);
  });
});

describe('그리기 순서 (회귀 막기)', () => {
  it('renderFrame 바닥 단계에 매 프레임 multiply·짝홀 자르기 덧칠이 없다', () => {
    const src = fs.readFileSync('src/world/render.ts', 'utf8');
    const body = src.slice(src.indexOf('export function renderFrame'), src.indexOf('drawFelling(ctx, dt);'));
    expect(body).toContain('litGround(ground, look)');
    expect(body).not.toContain("'multiply'");
    expect(body).not.toContain("clip('evenodd')");
  });
});
