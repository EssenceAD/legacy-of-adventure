// HARVEST §2 노을 (영구 · 수확제 시작 시각부터) — 게임 17:00~22:00
//  17→19: 노을 색 0 → 최대 (사진 모드 노을 multiply 색 · 세기 ×0.75)
//  19→22: 노을 → 밤 색조로 (22:00에 지금의 밤과 똑같이 — 밤 로직·S.night는 그대로, 그리기만 덧칠)
//  19:00부터 가로등·등불 빛이 서서히 (밤 불빛 0.5배 → 22:00에 1배) · 저사양(배터리 절약)은 색만
import { vis } from './visual';
import { DUSK_FIRST, DUSK_LINES } from '../data/story/harvest';
import { launched, hvNow } from './harvest';
import { markDirty, P, S, world, type Actor } from './state';

/** 사진 모드 노을 색 · 최대 세기 */
export const DUSK_RGB = '255,170,110';
export const DUSK_ALPHA = 0.45 * 0.75;
const DAY0 = 6;

export const sunsetOn = (now = hvNow()) => vis('sunset') && launched(now);

/** 게임 분(06:00부터) → 노을 세기 · 밤 앞당김(0~1) · 등불(0~1) */
export function duskOf(clock: number): { sun: number; night: number; light: number } {
  const h = DAY0 + clock / 60;
  if (h < 17) return { sun: 0, night: 0, light: 0 };
  if (h < 19) return { sun: (h - 17) / 2, night: 0, light: 0 };
  if (h < 22) {
    const k = (h - 19) / 3;
    return { sun: 1 - k, night: k, light: 0.5 * Math.min(1, (h - 19) / 0.5) + 0.5 * k };
  }
  return { sun: 0, night: 1, light: 1 };
}
/** 노을 시간인가 (17:00~22:00) */
export const isDusk = (clock = S.clock) => {
  const h = DAY0 + clock / 60;
  return h >= 17 && h < 22;
};

/**
 * 밤 색조 덧칠 색: 지금 실제 밤 단계(real 0~1)로 이미 물든 화면을 목표(target 0~1)까지 더 물들이는 multiply 색 (채널마다 c(t)/c(r))
 *  tintColor(t) = (255−200t, 255−175t, 255−90t) — null이면 덧칠 없음
 */
export function nightOverlay(target: number, real: number): [number, number, number] | null {
  if (target <= real + 0.005) return null;
  const c = (k: number, t: number) => 255 - k * t;
  const ch = (k: number) => Math.round((255 * c(k, target)) / Math.max(1, c(k, real)));
  return [ch(200), ch(175), ch(90)];
}

// ───────── 손님 노을 말풍선 · 첫 노을 ─────────

/** 이번 노을에 말한 손님 (손님당 노을 한 번에 최대 1번) */
const spoke = new Set<number>();
let spokeDay = -1;
/** 0.5초마다: 노을 시간이면 가끔 손님 말풍선 (say는 화면 쪽에서 넘겨받는다) */
export function duskTick(say: (a: Actor, t: string) => void, rng: () => number = Math.random) {
  if (!sunsetOn() || !S.started || S.visiting || !isDusk()) return;
  if (spokeDay !== S.day) {
    spokeDay = S.day;
    spoke.clear();
  }
  if (rng() > 0.06) return;
  const cand = world.actors.filter((a) => !a.role && a.id && !a.hidden && !a.bub && !a.leaving && !spoke.has(a.id));
  if (!cand.length) return;
  const a = cand[Math.floor(rng() * cand.length)];
  spoke.add(a.id);
  say(a, DUSK_LINES[Math.floor(rng() * DUSK_LINES.length)]);
}
/** 업데이트 뒤 첫 노을: 대사 한 번 (null = 아직/이미) */
export function duskFirst(): typeof DUSK_FIRST | null {
  if (!sunsetOn() || !S.started || S.visiting || !isDusk() || P.meta.duskFirst) return null;
  P.meta.duskFirst = true;
  markDirty();
  return DUSK_FIRST;
}
