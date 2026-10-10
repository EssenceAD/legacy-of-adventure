// 게임 안 시계: 현실 1분 = 게임 1시간. 하루는 06:00에 시작해 22:00부터 밤.
import { CONFIG } from '../data/config';
import { P, S } from './state';

const C = CONFIG.clock;
export const DAY_MINUTES = 24 * 60;
/** 06:00부터 밤(22:00)까지 게임 분 */
const NIGHT_AT = (C.nightStartHour - C.dayStartHour) * 60;

/** 지금 몇 시 (0~23) */
export const hourNow = () => Math.floor((C.dayStartHour + S.clock / 60) % 24);
/** 1일차 06:00부터 흐른 게임 시간 (시) */
export const absHours = () => (S.day - 1) * 24 + S.clock / 60;
export const isNightClock = () => S.clock >= NIGHT_AT;

type Fn = () => void;
const onDay: Fn[] = [];
const onNight: ((night: boolean) => void)[] = [];
/** 날짜가 바뀔 때(06:00) */
export const onNewDay = (f: Fn) => onDay.push(f);
/** 낮↔밤이 바뀔 때 */
export const onNightFlip = (f: (night: boolean) => void) => onNight.push(f);

function syncNight() {
  const n = isNightClock();
  if (n !== S.night) {
    S.night = n;
    onNight.forEach((f) => f(n));
  }
}

/** 하루를 넘긴다: 장부를 이번 주에 넣고 새로 시작 */
function newDay() {
  const total = Object.values(S.ledger).reduce((a, b) => a + b, 0);
  P.week.push({ day: S.day, gold: total });
  while (P.week.length > 7) P.week.shift();
  for (const k of Object.keys(S.ledger) as (keyof typeof S.ledger)[]) S.ledger[k] = 0;
  S.day++;
  onDay.forEach((f) => f());
}

/** 실제 초 dt 만큼 시계를 돌린다 */
export function tickClock(dt: number) {
  S.clock += (dt * 60) / C.realSecondsPerGameHour;
  while (S.clock >= DAY_MINUTES) {
    S.clock -= DAY_MINUTES;
    newDay();
  }
  syncNight();
}

/** ☾/☀ 버튼·오프닝: 밤(22:00)이나 다음 아침(06:00)으로 건너뛴다 */
export function jumpTo(night: boolean) {
  if (night) S.clock = Math.max(S.clock, NIGHT_AT);
  else if (S.night) {
    S.clock = 0;
    newDay();
  }
  syncNight();
}

/** 저장에서 불러온 직후: 밤 여부만 맞춘다 (콜백 없이) */
export function settleNight() {
  S.night = isNightClock();
  S.nightT = S.night ? 1 : 0;
}
