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
/**
 * VISUAL §5 큰 수 줄임 한 규칙 (HUD 금화의 「9.9M」과 같게): 100만 미만은 그대로(1,234,567 → 쉼표) · 1.2M · 34M · 1.2B
 *  uiKitV2 일 때만 fmt()·fmtKo()·HUD 금화가 이걸 쓴다 (끄면 예전 그대로)
 */
export function bigNum(n: number): string {
  n = Math.round(n);
  const a = Math.abs(n);
  if (a < 1e6) return n.toLocaleString('ko-KR');
  const [d, u] = a >= 1e9 ? [1e9, 'B'] : [1e6, 'M'];
  const v = n / d;
  return (Math.abs(v) >= 10 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(1)) + u;
}
/** 새 화면 기능 하나가 켜졌나: 플래그(모두에게) 또는 실험실(이 기기) */
export const vis = (k: FlagKey): boolean => flag(k) || labOn();
/**
 * CHECKIN §E 말투 정리 (플래그 checkinFx · 실험실): 켜면 프런트 직원 말투, 끄면 예전 문구 그대로
 *  표 = reports/checkin/wording.md — 바꿨을 때 무슨 버튼인지 덜 분명해지는 줄은 원래 말 유지
 */
export const fsay = (old: string, neu: string): string => (vis('checkinFx') ? neu : old);
