// VISUAL_SPEC 실험실: 새 화면(팔레트 · 값 위계 …)은 플래그 기본 꺼짐 — 운영자 계정 설정 「새 화면 미리 보기」로만 켜 본다.
//  켬/끔은 이 기기에만 저장되고, 바꾸면 다시 불러온다 (그림을 불러올 때 바꾸니까).
//  형철 OK → flags.json 에서 paletteV2 · calmWorld 를 true 로 (T0)
import { flag, type FlagKey } from './flags';

const KEY = 'legacy-of-adventure-visualLab';
let lab: boolean | null = null;
/** 이 기기에서 「새 화면 미리 보기」를 켰나 */
export function labOn(): boolean {
  if (lab === null)
    try {
      lab = localStorage.getItem(KEY) === 'true';
    } catch {
      lab = false;
    }
  return lab;
}
export function setLab(on: boolean) {
  lab = on;
  try {
    if (on) localStorage.setItem(KEY, 'true');
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장 못 해도 이번 판만 */
  }
}
/** 새 화면 기능 하나가 켜졌나: 플래그(모두에게) 또는 실험실(이 기기) */
export const vis = (k: Extract<FlagKey, 'paletteV2' | 'calmWorld'>): boolean => flag(k) || labOn();
