// 꾸미기 낮 조명 (이카몰리 요청): 꾸미기 모드 동안은 낮 빛으로 그린다 — 게임 시계는 그대로 흐른다 (시간 상태를 안 건드림)
//  꾸미기를 끝내면 0.4초에 걸쳐 지금 시간의 빛으로 (움직임 줄이기 · 배터리 절약이면 바로)
//  DOM·게임 모듈을 불러오지 않는다 (테스트에서 그대로 쓰게)

/** 꾸미기를 끝낸 뒤 지금 시간 빛으로 돌아가는 시간 (초) */
export const DECOR_FADE_S = 0.4;

/**
 * 낮 섞임 정도 (1 = 낮 빛 그대로 · 0 = 지금 시간 빛).
 *  꾸미기 중이면 늘 1 (들어갈 땐 바로 낮) · 끝나면 dur초에 걸쳐 1 → 0 · 움직임 줄이기면 바로 0
 */
export function decorMixStep(prev: number, on: boolean, dt: number, reduce: boolean, dur = DECOR_FADE_S): number {
  if (on) return 1;
  if (reduce || !(dur > 0) || !(prev > 0)) return 0;
  const d = Number.isFinite(dt) && dt > 0 ? dt : 0;
  return Math.max(0, Math.min(1, prev) - d / dur);
}

/** 그릴 때 쓰는 밤 정도: 꾸미기 중 = 0(낮) · 끝난 뒤 = 지금 밤 정도 쪽으로 (mix 1 → 낮, 0 → 지금) */
export function decorNight(nt: number, on: boolean, mix: number): number {
  if (on) return 0;
  const m = Math.max(0, Math.min(1, mix || 0));
  return nt * (1 - m);
}
