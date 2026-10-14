// FIRSTLOOK §1 첫 화면 카메라 (flFirstCam): 새 세이브 PC 배율 3 · 폰 배율 2 + 여관 가운데 · 옛 저장 그대로 · PC 물러나기 한 번 · 폰은 2 그대로 · 팻말 글씨(장부 1장 뒤) · 플래그 끔
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { CHAPTERS } from '../src/data/guide';
import { N, sx, sy, updateOrigin, view } from '../src/engine/iso';
import { FLAG_DEFAULTS, setFlag } from '../src/world/flags';
import {
  firstCamClose,
  firstCamZoom,
  innCam,
  markNewSave,
  placeFirstCam,
  pullOnChapter,
  pullOnLand,
  resetPull,
  signLabelOn,
  takePull,
} from '../src/world/firstCam';
import { P, resetProgress } from '../src/world/state';
import { setLab } from '../src/world/visual';

const C = CONFIG.firstLook.cam;
const ZS = [1, 2, 3];
const INN = { tx: 24, ty: 24, fw: 3, fh: 3 };

beforeEach(() => {
  localStorage.clear();
  setLab(false);
  setFlag('flFirstCam', false);
  resetProgress();
  resetPull();
  view.focus = { m: 26, size: 8 };
  view.cam.x = 0;
  view.cam.y = 0;
  view.goal = null;
});
afterEach(() => setFlag('flFirstCam', false));

describe('플래그 끔 = 아무 일 없음', () => {
  it('기본 꺼짐 · 새 게임도 0 그대로 · 배율·물러나기·팻말 모두 지금처럼', () => {
    expect(FLAG_DEFAULTS.flFirstCam).toBe(false);
    markNewSave();
    expect(P.firstCam).toBe(0);
    expect(firstCamClose()).toBe(false);
    expect(firstCamZoom(ZS, false)).toBeNull();
    expect(pullOnLand()).toBe(false);
    expect(pullOnChapter(2)).toBe(false);
    expect(takePull(ZS)).toBeNull();
    expect(signLabelOn({ claimed: [] })).toBe(true);
    expect(firstCamZoom(ZS, false, false, true)).toBeNull();
  });
  it('저장에 1이 남아 있어도 플래그를 끄면 가까이 안 함', () => {
    P.firstCam = 1;
    expect(firstCamZoom(ZS, false)).toBeNull();
  });
  it('실험실로도 켜진다', () => {
    setLab(true);
    markNewSave();
    expect(P.firstCam).toBe(1);
    setLab(false);
  });
});

describe('1. 새 세이브 = 배율 3 · 여관 본관 가운데', () => {
  beforeEach(() => setFlag('flFirstCam', true));
  it('새 게임이면 배율 3 (목록에 없으면 가장 가까운 것)', () => {
    markNewSave();
    expect(P.firstCam).toBe(1);
    expect(firstCamZoom(ZS, false)).toBe(3);
    expect(firstCamZoom([0.5, 1, 2, 3], false)).toBe(3);
    expect(firstCamZoom([1, 2, 3, 4], false)).toBe(C.startZoom);
    expect(firstCamZoom([1, 2], false)).toBe(2);
  });
  it('폰은 배율 2 · 물러난 뒤(firstCam 2)에도 2 그대로 · PC는 물러난 뒤 지금 규칙', () => {
    markNewSave();
    expect(firstCamZoom([0.5, 1, 2, 3], false, false, true)).toBe(C.phoneZoom);
    expect(C.phoneZoom).toBe(2);
    expect(pullOnLand()).toBe(true);
    expect(firstCamZoom([0.5, 1, 2, 3], false, false, true)).toBe(2);
    expect(firstCamZoom([1, 2, 3, 4], false, false, false)).toBeNull();
    expect(firstCamZoom([0.5, 1, 2, 3], true, false, true)).toBeNull();
  });
  it('★ 배율을 고른 적 있는 기기는 그대로 · 타이틀 배경 마을도 안 함', () => {
    markNewSave();
    expect(firstCamZoom(ZS, true)).toBeNull();
    expect(firstCamZoom(ZS, false, true)).toBeNull();
  });
  it('여관 본관 그림 가운데가 화면 가운데 (lift만큼 위)', () => {
    const c = innCam(INN);
    view.LW = 137;
    view.LH = 287;
    view.cam.x = c.x;
    view.cam.y = c.y;
    updateOrigin();
    const X = view.OX + sx(25.5, 25.5);
    const Y = view.OY + sy(25.5, 25.5) - C.innLift;
    expect(Math.abs(X - view.LW / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(Y - view.LH / 2)).toBeLessThanOrEqual(1);
    expect(c.x).toBe(sx(25.5, 25.5) - sx(N / 2, N / 2));
  });
  it('placeFirstCam: 여관 가운데 (숲 옮기기 없음 — 형철 23:20)', () => {
    view.LW = 206;
    view.LH = 430;
    placeFirstCam(INN);
    expect(view.cam.y).toBe(innCam(INN).y);
    expect(view.cam.x).toBe(innCam(INN).x);
    expect(view.goal).toBeNull();
  });
});

describe('★ 옛 저장은 그대로', () => {
  it('옛 저장(firstCam 없음 → 0)은 플래그를 켜도 가까이 안 함 · 물러나기 없음', () => {
    setFlag('flFirstCam', true);
    resetProgress({ guide: { idx: 30, claimed: [], cut: 3, legacy: false, unlocked: [] } });
    expect(P.firstCam).toBe(0);
    expect(firstCamZoom(ZS, false)).toBeNull();
    expect(pullOnLand()).toBe(false);
    expect(pullOnChapter(2)).toBe(false);
    expect(P.firstCam).toBe(0);
  });
});

describe('2. 물러나기는 한 번', () => {
  beforeEach(() => setFlag('flFirstCam', true));
  it('땅을 처음 넓히면 한 번 → 그 뒤엔 지금처럼', () => {
    markNewSave();
    expect(pullOnLand()).toBe(true);
    expect(P.firstCam).toBe(2);
    expect(firstCamZoom(ZS, false)).toBeNull();
    expect(pullOnLand()).toBe(false);
    expect(pullOnChapter(2)).toBe(false);
  });
  it('장부 1장은 아님 · 2장을 마치면 등급 연출이 배율 2를 가져감 (한 번)', () => {
    markNewSave();
    expect(pullOnChapter(1)).toBe(false);
    expect(P.firstCam).toBe(1);
    expect(pullOnChapter(2)).toBe(true);
    expect(P.firstCam).toBe(2);
    expect(takePull(ZS)).toBe(C.pullZoom);
    expect(takePull(ZS)).toBeNull();
    expect(pullOnLand()).toBe(false);
  });
  it('0.6초', () => expect(C.pullMs).toBe(600));
});

describe('4. 「땅 넓히기 ○G」 글씨', () => {
  it('켜면 장부 1장을 마친 뒤에만 (첫날 첫 화면 = 그림만) · 옛 저장(legacy)은 늘', () => {
    setFlag('flFirstCam', true);
    const ids = CHAPTERS.find((c) => c.no === 1)!.missions.map((m) => m.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(signLabelOn({ claimed: [] })).toBe(false);
    expect(signLabelOn({ claimed: ids.slice(0, -1) })).toBe(false);
    expect(signLabelOn({ claimed: ids })).toBe(true);
    expect(signLabelOn({ claimed: [], legacy: true })).toBe(true);
    resetProgress();
    expect(signLabelOn()).toBe(false);
  });
});
