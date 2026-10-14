// 베타 3장: 하루 마감 정산 — 게임 속 자정에 그날 수입·손님 수·평균 기분·새 어울림/새 손님을 한 장으로
//  (☀ 버튼으로 아침까지 건너뛰어 자정을 놓쳤으면 아침 6시에 마감한다)
import { hourNow, onNewDay } from './clock';
import { P, S, world, type DayLog } from './state';
import { moodSample } from './paceGates';

/** 이번 날 모으기 시작 */
function open() {
  P.daily.cur = { day: S.day, gold0: P.counters.goldTotal, arrivals: 0, newHarm: 0, newDex: 0, moodSum: 0, moodN: 0, quietBye: 0 };
}

/** 마감: 기록에 넣고 보여 줄 차례에 둔다 */
function close() {
  const c = P.daily.cur;
  if (c.gold0 < 0) return open();
  const log: DayLog = {
    day: c.day,
    gold: Math.max(0, P.counters.goldTotal - c.gold0),
    guests: c.arrivals,
    mood: c.moodN ? Math.round(c.moodSum / c.moodN) : 0,
    newHarm: c.newHarm,
    newDex: c.newDex,
    // CHECKIN §A1: 조용히 배웅한 평범한 손님 (0이면 안 남긴다 · 옛 저장엔 없음)
    ...(c.quietBye ? { quietBye: c.quietBye } : {}),
  };
  P.daily.log.push(log);
  while (P.daily.log.length > 7) P.daily.log.shift();
  P.daily.pending.push(log);
  while (P.daily.pending.length > 7) P.daily.pending.shift();
  open();
  // 다음 자정까지는 같은 게임 날로 센다 (자정 뒤 06시까지는 아직 S.day)
  P.daily.cur.day = S.day + 1;
}

/** 손님 도착 · 새 어울림 · 새 손님 도감 (각 모듈에서 부른다) */
export const dailyAdd = (k: 'arrivals' | 'newHarm' | 'newDex', n = 1) => {
  if (S.visiting || !S.started) return;
  P.daily.cur[k] += n;
};

let lastHour = -1;
let moodHour = -1;
export function tickDaily() {
  if (S.visiting || !S.started) return;
  if (P.daily.cur.gold0 < 0) open();
  const h = hourNow();
  // 자정 넘김 (23 → 0)
  if (lastHour === 23 && h === 0) close();
  lastHour = h;
  // 게임 1시간마다 손님 기분
  const ah = S.day * 24 + h;
  if (ah !== moodHour) {
    moodHour = ah;
    const g = world.actors.filter((a) => !a.role && a.id && !a.hidden && a.runId == null);
    if (g.length) {
      const avg = g.reduce((s, a) => s + a.mood, 0) / g.length;
      P.daily.cur.moodSum += avg;
      // PACE R17: 현실 하루에 한 번이라도 평균 기분 95↑(은퇴) · 90↑(아리아)면 그날도 1일
      moodSample(avg);
      P.daily.cur.moodN++;
    }
  }
}

/** 자정을 건너뛰고(☀) 아침이 됐으면 그때 마감 */
onNewDay(() => {
  if (S.visiting || !S.started) return;
  if (P.daily.cur.day < S.day) close();
});

/** 보여 줄 정산 (여러 날이 쌓였으면 합쳐서 한 장) */
export function takeSettlement(): { days: DayLog[]; sum: DayLog; record: boolean; prevBest: number } | null {
  const days = P.daily.pending.splice(0);
  if (!days.length) return null;
  const sum: DayLog = {
    day: days[days.length - 1].day,
    gold: days.reduce((s, d) => s + d.gold, 0),
    guests: days.reduce((s, d) => s + d.guests, 0),
    mood: Math.round(days.reduce((s, d) => s + d.mood, 0) / days.length),
    newHarm: days.reduce((s, d) => s + d.newHarm, 0),
    newDex: days.reduce((s, d) => s + d.newDex, 0),
    quietBye: days.reduce((s, d) => s + (d.quietBye ?? 0), 0),
  };
  const prevBest = P.daily.best;
  const top = Math.max(...days.map((d) => d.gold));
  const record = top > prevBest && P.daily.log.length > 1;
  P.daily.best = Math.max(prevBest, top);
  return { days, sum, record, prevBest };
}
