// FIRSTLOOK §1 첫 화면 카메라 (플래그 flFirstCam · 숫자 CONFIG.firstLook.cam) — 규칙만 (배율 바꾸기·그리기는 main.ts · ui/guide.ts · render.ts)
//  1. 새 세이브는 여관 본관 가운데에서 시작 (P.firstCam = 1) — PC 배율 3 · 폰 배율 2 (형철 10/14 23:10: 폰은 3이 너무 가까움)
//  2. PC: 장부 2장을 마치거나 땅을 처음 넓히면 배율 2로 한 번 부드럽게 물러남 (P.firstCam = 2 · 그 뒤 지금처럼)
//     폰: 물러나지 않고 배율 2 그대로 (P.firstCam ≥ 1 이면 늘 2 — 배율을 직접 고르면 그것)
//  3. (뺌 — 형철 23:20: 배율 2에선 숲 옮기기 필요 없음)
//  4. 「땅 넓히기 ○G」 팻말 글씨는 장부 1장을 마친 뒤에만 (첫날 첫 화면 = 팻말 그림만)
//  ★ 옛 저장(P.firstCam = 0)·배율을 고른 적 있는 기기는 아무것도 안 바뀐다 · 플래그를 끄면 아무 일도 없다
import { CONFIG } from '../data/config';
import { CHAPTERS } from '../data/guide';
import { clampCam, N, sx, sy, view } from '../engine/iso';
import { P } from './state';
import { vis } from './visual';

const C = () => CONFIG.firstLook.cam;

export const firstCamOn = (): boolean => vis('flFirstCam');

/** 지금 「새 세이브 가까이」인가 (배율 3 · 여관 가운데) */
export const firstCamClose = (): boolean => firstCamOn() && P.firstCam === 1;

/** 새 게임: 이 세이브는 가까이에서 시작 (플래그 끔이면 0 그대로 = 옛 동작) */
export function markNewSave() {
  if (firstCamOn()) P.firstCam = 1;
}

/** 고를 수 있는 배율 중 v에 가장 가까운 것 */
export const nearestZoom = (v: number, zs: number[]) => zs.reduce((b, z) => (Math.abs(z - v) < Math.abs(b - v) ? z : b), zs[0]);

/**
 * 카메라를 놓을 때(땅 가운데 맞추기) 배율: 새 세이브 + 고른 배율 없음이면 PC startZoom(가까이일 때만) · 폰 phoneZoom(늘), 아니면 null (= 지금 규칙)
 *  hold = 타이틀 뒤 배경 마을 (거기선 안 함)
 */
export function firstCamZoom(zs: number[], hasPref: boolean, hold = false, phone = false): number | null {
  if (hold || hasPref || !firstCamOn()) return null;
  if (phone) return P.firstCam >= 1 ? nearestZoom(C().phoneZoom, zs) : null;
  return P.firstCam === 1 ? nearestZoom(C().startZoom, zs) : null;
}

/** 여관 본관 그림 가운데가 화면 가운데에 오는 카메라 (논리 px) */
export function innCam(inn: { tx: number; ty: number; fw: number; fh: number }) {
  const cx = inn.tx + inn.fw / 2;
  const cy = inn.ty + inn.fh / 2;
  return { x: sx(cx, cy) - sx(N / 2, N / 2), y: sy(cx, cy) - sy(N / 2, N / 2) - C().innLift };
}

/**
 * 1. 새 세이브 카메라 = 여관 본관 가운데 (배율을 바꾼 뒤)
 *  폰(배율 2)은 가로를 phoneCamX(논리 px · 0 = 땅 가운데 줄 · 음수 = 왼쪽 팻말 쪽)로 — 여관 문 · 첫 손님 길 · 우물 · 땅 넓히기 팻말(글씨까지)이 한 화면에
 */
export function placeFirstCam(inn: { tx: number; ty: number; fw: number; fh: number } | null | undefined, phone = false) {
  if (!inn) return;
  const c = innCam(inn);
  view.cam.x = phone ? C().phoneCamX : c.x;
  view.cam.y = c.y;
  view.goal = null;
  clampCam();
}

/** 2. 땅을 넓혔을 때: 물러날 차례면 true (한 번만) */
export function pullOnLand(): boolean {
  if (!firstCamClose()) return false;
  P.firstCam = 2;
  return true;
}

/** 2. 장부 장을 마쳤을 때: 2장 이상이면 물러날 차례 (마을 등급 연출이 끝나며 배율을 되돌릴 때 takePull로 가져간다) */
let pending = false;
export function pullOnChapter(no: number): boolean {
  if (no < 2 || !firstCamClose()) return false;
  P.firstCam = 2;
  pending = true;
  return true;
}
/** 등급 연출이 배율을 되돌릴 때: 물러날 배율 (없으면 null) */
export function takePull(zs: number[]): number | null {
  if (!pending) return null;
  pending = false;
  return nearestZoom(C().pullZoom, zs);
}
/** 등급 연출 없이(이웃 방문 중 등) 끝났을 때 남은 물러나기 */
export const pullPending = () => pending;
export const resetPull = () => (pending = false);

/** 물러날 배율 */
export const pullZoom = (zs: number[]) => nearestZoom(C().pullZoom, zs);

/** 4. 「땅 넓히기 ○G」 글씨를 보일까: 장부 1장을 마쳤으면 (5단계 전 옛 저장 legacy 도 마친 것으로 · 플래그 끔이면 늘) */
export function signLabelOn(g: { claimed: string[]; legacy?: boolean } = P.guide): boolean {
  if (!firstCamOn() || g.legacy) return true;
  const ch1 = CHAPTERS.find((c) => c.no === 1);
  return !ch1 || ch1.missions.every((m) => g.claimed.includes(m.id));
}

/** 물러나기 연출 (main.ts가 채운다: 배율 바꾸고 0.6초 동안 화면 크기를 이어 붙임) */
export const firstCamFx = { pull: (_to: number) => {} };

/**
 * 새 세이브 가까이일 때 첫 손님 안내가 카메라를 문 쪽으로 옮기려 하면: 그 칸이 이미 화면 안쪽(가장자리 15% 빼고)이면 여관 가운데를 그대로 둔다
 *  (플래그 끔·옛 저장이면 false = 지금처럼 옮김)
 */
export function keepFirstCam(x: number, y: number): boolean {
  if (!firstCamClose()) return false;
  const X = view.OX + sx(x, y);
  const Y = view.OY + sy(x, y);
  return X > view.LW * 0.15 && X < view.LW * 0.85 && Y > view.LH * 0.15 && Y < view.LH * 0.85;
}
