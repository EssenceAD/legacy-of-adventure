// 문 열고 들어가기/나오기: 문 영역과 연출 위치 (월드 원점 기준 논리 px)
import { CONFIG } from '../data/config';
import { DOORS, OPEN_FRONT } from '../engine/assets';
import { sx, sy, TH } from '../engine/iso';
import type { Actor, Building } from './state';
import { doorOf, spriteOrigin } from './town';

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** 문 그림이 있는 건물만 문으로 드나든다 (훈련장·텃밭·모닥불·던전은 지금 방식 그대로) */
export const hasDoor = (o: Building) => !!(o.sprite && DOORS[o.sprite]);

/** 앞이 트인 입구(대장간·온천)는 "열린 문" 칠하기를 하지 않는다 */
export const isOpenFront = (o: Building) => !!o.sprite && OPEN_FRONT.has(o.sprite);

/** 문 영역 (끝 포함) */
export function doorRect(o: Building): Rect {
  const [ox, oy] = spriteOrigin(o);
  const [x0, y0, x1, y1] = DOORS[o.sprite!];
  return { x0: Math.round(ox) + x0, y0: Math.round(oy) + y0, x1: Math.round(ox) + x1, y1: Math.round(oy) + y1 };
}

/** 발 위치 세 곳: 문 앞 칸 / 실제 문 바로 앞 / 문 안쪽 */
export function doorPoints(o: Building) {
  const [dx, dy] = doorOf(o);
  const r = doorRect(o);
  const cx = (r.x0 + r.x1 + 1) / 2;
  return {
    stand: [sx(dx, dy), sy(dx, dy) + TH / 2] as [number, number],
    front: [cx, r.y1 + 1] as [number, number],
    inside: [cx, r.y1 + 1 - CONFIG.actors.doorStepPx] as [number, number],
  };
}

const lerp = (a: [number, number], b: [number, number], k: number): [number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/** 연출 중인 손님의 발 위치·방향 */
export function doorPose(a: Actor) {
  const d = a.door!;
  const p = doorPoints(d.o);
  const k = d.dur > 0 ? Math.min(1, d.t / d.dur) : 1;
  let from: [number, number];
  let to: [number, number];
  if (d.dir === 'in') [from, to] = d.phase === 'walk' ? [p.stand, p.front] : [p.front, p.inside];
  else [from, to] = d.phase === 'step' ? [p.inside, p.front] : [p.front, p.stand];
  const pos = lerp(from, to, k);
  // 들어갈 땐 뒷모습, 나올 땐 앞모습. 옆으로 걷는 동안은 걷는 방향을 본다
  // 옆으로 걷는 동안은 위로 올라가는 쪽이 더 클 때만 뒷모습
  const back = d.phase === 'step' ? d.dir === 'in' : from[1] - to[1] > Math.abs(to[0] - from[0]);
  const dir: 1 | -1 = Math.abs(to[0] - from[0]) > 0.5 ? (to[0] > from[0] ? 1 : -1) : a.dir;
  return { pos, back, dir, clipped: d.phase === 'step' };
}

/** 문 앞 칸 ↔ 실제 문 앞 사이를 걷는 시간 */
export function doorWalkSeconds(o: Building) {
  const p = doorPoints(o);
  return Math.hypot(p.front[0] - p.stand[0], p.front[1] - p.stand[1]) / CONFIG.actors.doorWalkPxPerSec;
}
