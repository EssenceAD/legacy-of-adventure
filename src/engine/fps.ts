// 핫픽스 11: 발열 줄이기 — 그리기 횟수 상한 · 배터리 절약 (규칙 갱신 30fps 고정 STEP은 그대로)
import { CONFIG } from '../data/config';
import { getPref, setPref } from '../save/save';

let saver = getPref<boolean>('saver', false);
export const saverOn = () => saver;
export function setSaver(v: boolean) {
  saver = v;
  setPref('saver', v);
}

/** 전투·토벌·티저 rAF: 이번 프레임을 건너뛸까 (120Hz 기기에서 120번 그리지 않게 · 절약이면 30) */
export function skipFrame(last: number, now: number): boolean {
  const fps = saver ? CONFIG.loop.drawFpsBattleSaver : CONFIG.loop.drawFpsBattle;
  // 0.002 = rAF 흔들림 여유 (60Hz 화면에서 프레임을 하나씩 빼먹지 않게)
  return (now - last) / 1000 < 1 / fps - 0.002;
}

/** 마지막 입력 (누르기·휠·키) — 손 안 댄 지 오래면 마을을 더 천천히 그린다 */
let lastInput = performance.now();
let kick = false;
export function noteInput() {
  lastInput = performance.now();
  kick = true;
}
/** 입력이 들어온 첫 프레임: 기다리지 말고 바로 그린다 (반응 지연 없게) */
export function takeKick(): boolean {
  const k = kick;
  kick = false;
  return k;
}
export const idleFor = () => (performance.now() - lastInput) / 1000;
