// HOTFIX15: 화면 흔들림 설정 — 끔(기본) / 약하게 / 보통 (「어지러워요」) · 배터리 절약이면 늘 끔
//  전투(field shake)와 마을(uiHooks.shake) 둘 다 이걸 본다
import { getPref, setPref } from '../save/save';
import { saverOn } from './fps';

export type ShakeLv = 'off' | 'low' | 'normal';
export const SHAKE_NAME: Record<ShakeLv, string> = { off: '끔', low: '약하게', normal: '보통' };
/** 지금 흔들림 단계 (저장에 없으면 끔 — 옛 유저도 끔) */
export const shakeLv = (): ShakeLv => (saverOn() ? 'off' : getPref<ShakeLv>('shake', 'off'));
export const setShakeLv = (v: ShakeLv) => setPref('shake', v);
/** 흔들림 세기·시간 (끔이면 null) — 약하게는 최대 1px · 0.08초 */
export function shakeParams(amp: number, dur: number, lv: ShakeLv = shakeLv()): { amp: number; dur: number } | null {
  if (lv === 'off') return null;
  if (lv === 'low') return { amp: Math.min(1, amp), dur: Math.min(0.08, dur) };
  return { amp, dur };
}
