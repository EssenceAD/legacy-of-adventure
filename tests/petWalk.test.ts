// LUXE §2 펫 걷기 시트: 칸 고르기(움직임·서기 · 위/아래/좌우 · 뒷모습 없으면 앞 · 0.18초 번갈아) · 시트 없으면 한 장 그림 · 메타 = sheets.json · 시트 복사됨
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PET_SHEETS, type PetSheet } from '../src/data/petSheets';
import { view } from '../src/engine/iso';
import { drawPet, movingUp, petFrame, petH, petSheet, type PetRT } from '../src/world/petsDraw';
import { S } from '../src/world/state';

const M6: PetSheet = { cw: 20, ch: 20, frames: 6, back: true };
const MF: PetSheet = { cw: 20, ch: 20, frames: 6, back: false };

describe('펫 걷기 — 칸 고르기', () => {
  it('가만히 = 서기 칸 (앞 0 · 뒤 3)', () => {
    for (const T of [0, 0.1, 0.2, 0.5, 3]) {
      expect(petFrame(M6, false, false, T, 0)).toBe(0);
      expect(petFrame(M6, false, true, T, 0)).toBe(3);
    }
  });
  it('움직이면 0.18초마다 걷기1/걷기2 번갈아 (앞 1·2 · 뒤 4·5)', () => {
    expect(petFrame(M6, true, false, 0, 0)).toBe(1);
    expect(petFrame(M6, true, false, 0.17, 0)).toBe(1);
    expect(petFrame(M6, true, false, 0.19, 0)).toBe(2);
    expect(petFrame(M6, true, false, 0.37, 0)).toBe(1);
    expect(petFrame(M6, true, true, 0.05, 0)).toBe(4);
    expect(petFrame(M6, true, true, 0.25, 0)).toBe(5);
    const seq = Array.from({ length: 10 }, (_, i) => petFrame(M6, true, false, i * 0.18 + 0.01, 0));
    expect(seq).toEqual([1, 2, 1, 2, 1, 2, 1, 2, 1, 2]);
  });
  it('뒷모습 없으면(back:false) 위로 가도 앞 칸', () => {
    expect(petFrame(MF, false, true, 0, 0)).toBe(0);
    expect(petFrame(MF, true, true, 0.05, 0)).toBe(1);
    expect(petFrame(MF, true, true, 0.25, 0)).toBe(2);
    expect(petFrame({ ...M6, frames: 3 }, true, true, 0.05, 0)).toBe(1);
  });
  it('화면 위쪽(sy 감소)만 뒷모습 — 아래·순수 좌우는 앞', () => {
    expect(movingUp(0, -1)).toBe(true); // 오른쪽 위
    expect(movingUp(-1, 0)).toBe(true); // 왼쪽 위
    expect(movingUp(-1, -1)).toBe(true); // 바로 위
    expect(movingUp(1, 0)).toBe(false); // 오른쪽 아래
    expect(movingUp(0, 1)).toBe(false); // 왼쪽 아래
    expect(movingUp(1, -1)).toBe(false); // 순수 오른쪽
    expect(movingUp(-1, 1)).toBe(false); // 순수 왼쪽
  });
});

// 그림 불러오기 흉내: jsdom img에 크기를 붙인다 (시트 = cw×6 · 한 장 = 16×16)
function fakeImage() {
  const im = document.createElement('img');
  const size = () => {
    const src = im.getAttribute('src') ?? '';
    const m = /pet_(\w+?)_sheet\.png/.exec(src);
    return m && PET_SHEETS[m[1]] ? [PET_SHEETS[m[1]].cw * PET_SHEETS[m[1]].frames, PET_SHEETS[m[1]].ch] : [16, 16];
  };
  Object.defineProperty(im, 'complete', { get: () => true });
  Object.defineProperty(im, 'naturalWidth', { get: () => size()[0] });
  Object.defineProperty(im, 'width', { get: () => size()[0] });
  Object.defineProperty(im, 'height', { get: () => size()[1] });
  return im;
}
function fakeCtx() {
  const calls: { sx: number; sw: number; sh: number; dx: number; dy: number }[] = [];
  const flips: number[] = [];
  const moves: [number, number][] = [];
  const ctx = {
    fillStyle: '', globalAlpha: 1,
    fillRect: () => {}, save: () => {}, restore: () => {}, translate: (x: number, y: number) => moves.push([x, y]),
    scale: (x: number) => flips.push(x),
    drawImage: (_i: unknown, sx: number, _sy: number, sw: number, sh: number, dx: number, dy: number) => calls.push({ sx, sw, sh, dx, dy }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, flips, moves };
}
const pet = (id: string, o: Partial<PetRT> = {}): PetRT => ({ id, x: 0, y: 0, path: [], dir: 1, up: false, wait: 9, moving: false, ph: 0, hearts: [], guest: true, ...o });

describe('펫 걷기 — 그리기', () => {
  const saved = { OX: view.OX, OY: view.OY, T: S.T, night: S.night };
  beforeAll(() => {
    vi.stubGlobal('Image', fakeImage);
    view.OX = 100;
    view.OY = 100;
    S.night = false as never;
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    Object.assign(view, { OX: saved.OX, OY: saved.OY });
    S.T = saved.T;
    S.night = saved.night;
  });

  it('시트 있는 펫: 고른 칸을 칸 크기로 · 발 = 칸 아래 가운데 · 왼쪽은 뒤집기', () => {
    const id = 'griffin';
    const m = PET_SHEETS[id];
    petSheet(id); // 불러오기 시작
    expect(petSheet(id)?.m).toEqual(m);
    expect(petH(id)).toBe(m.ch);
    S.T = 0.25;
    const a = fakeCtx();
    drawPet(a.ctx, pet(id, { moving: true, up: true }));
    expect(a.calls).toHaveLength(1);
    const c = a.calls[0];
    expect(c.sx).toBe(5 * m.cw); // 뒤 걷기2
    expect([c.sw, c.sh]).toEqual([m.cw, m.ch]);
    // 깡총 −1px 포함: 발(Y0) = 칸 바닥 + 1 − 1
    const X = 100;
    expect(c.dx).toBe(X - (m.cw >> 1));
    const b = fakeCtx();
    S.T = 0.5; // 가만히 깡총 없는 때
    drawPet(b.ctx, pet(id, { dir: -1 }));
    expect(b.calls[0].sx).toBe(0); // 앞 서기
    expect(b.flips).toEqual([-1]);
    expect(b.moves[0]).toEqual([X - (m.cw >> 1) + m.cw, c.dy + 1]); // 뒤집기: 칸 오른쪽 끝 기준 · 깡총 없음 = 1px 아래
  });
  it('자는 중: 움직이고 있어도 서기 칸 + 1px 낮게', () => {
    const id = 'slime';
    const m = PET_SHEETS[id];
    petSheet(id);
    S.T = 0.5;
    const a = fakeCtx();
    drawPet(a.ctx, pet(id, { up: true }));
    S.night = true as never;
    const b = fakeCtx();
    drawPet(b.ctx, pet(id, { up: true, moving: true }));
    S.night = false as never;
    expect(b.calls[0].sx).toBe(3 * m.cw); // 뒤 서기
    expect(b.calls[0].dy - a.calls[0].dy).toBe(1);
  });
  it('시트 없는 펫: 지금처럼 한 장 그림 통째로', () => {
    const id = 'nosheet_test';
    expect(petSheet(id)).toBeNull();
    const a0 = fakeCtx();
    drawPet(a0.ctx, pet(id)); // 한 장 그림 불러오기 시작 (이번엔 자리표시)
    const a = fakeCtx();
    S.T = 0.25;
    drawPet(a.ctx, pet(id, { moving: true, up: true }));
    expect(a.calls).toHaveLength(1);
    expect(a.calls[0]).toMatchObject({ sx: 0, sw: 16, sh: 16, dx: 100 - 8 });
    expect(petH(id)).toBe(16);
  });
});

describe('펫 걷기 — 시트 파일', () => {
  const RAW = 'asset_raw/pets/sheets.json';
  it.skipIf(!fs.existsSync(RAW))('메타 = asset_raw/pets/sheets.json', () => {
    const raw = JSON.parse(fs.readFileSync(RAW, 'utf8')) as Record<string, { cw: number; ch: number; frames?: number; back?: boolean }>;
    expect(Object.keys(PET_SHEETS).sort()).toEqual(Object.keys(raw).sort());
    for (const [id, m] of Object.entries(raw)) expect(PET_SHEETS[id]).toEqual({ cw: m.cw, ch: m.ch, frames: m.frames ?? 6, back: !!m.back && (m.frames ?? 6) >= 6 });
  });
  it('메타의 시트가 모두 public에 있고 크기가 맞다 (cw×frames · ch)', () => {
    expect(Object.keys(PET_SHEETS).length).toBeGreaterThan(0);
    for (const [id, m] of Object.entries(PET_SHEETS)) {
      const f = `public/assets/pets/pet_${id}_sheet.png`;
      expect(fs.existsSync(f), f).toBe(true);
      const png = PNG.sync.read(fs.readFileSync(f));
      expect([png.width, png.height], id).toEqual([m.cw * m.frames, m.ch]);
      const src = `asset_raw/pets/pet_${id}_sheet.png`;
      if (fs.existsSync(src)) expect(fs.readFileSync(f).equals(fs.readFileSync(src)), `${id} 복사본 = 원본`).toBe(true);
    }
  });
});
