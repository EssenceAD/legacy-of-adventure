// FIRSTLOOK §6 캐릭터가 눈에 띄게 (flCharPop · 실험실 vis): 그림은 그대로 · 그림자 진하게 · 바깥 외곽선 남보라 · 걷는 동안 1px 통통
//  숫자는 CONFIG.firstLook.pop 한 곳 · 외곽선은 도트를 만들 때 한 번(engine/sprites.ts · 캐시 열쇠에 플래그) · 그림자·통통은 그릴 때(world/render.ts)
import { CONFIG } from '../data/config';
import { MASTER_PALETTE } from '../data/palette';
import { vis } from './visual';

export const charPopOn = (): boolean => vis('flCharPop');

/** 사람 도트 바깥 1px 외곽선 색 (마스터 팔레트 칸 · 꺼지면 null = 예전 부위색 외곽선) */
export function popOutline(on = charPopOn()): string | null {
  return on ? MASTER_PALETTE[CONFIG.firstLook.pop.outline] : null;
}

/** 발밑 그림자 디더 빈칸에 같은 색을 이 알파로 채운다 — 안쪽(체커 50%)의 평균 진하기가 shadowAdd만큼 오른다 · 꺼지면 0 (예전 그대로) */
export function shadowGap(on = charPopOn()): number {
  return on ? Math.min(1, CONFIG.firstLook.pop.shadowAdd / 0.5) : 0;
}

/** 걷기 4프레임 중 발이 지나가는 프레임(1·3)에서 통째로 위로 bobPx — 걷는 동안만 · 꺼지면 0 */
export function walkBob(walking: boolean, frame: number, on = charPopOn()): number {
  return on && walking && frame % 2 === 1 ? -CONFIG.firstLook.pop.bobPx : 0;
}
