// 베타 3장: 하루 마감 정산 카드 (4초 · 탭하면 닫힘 · 설정에서 끌 수 있다)
import { getPref, setPref } from '../save/save';
import { takeSettlement, tickDaily } from '../world/daily';
import { P, S } from '../world/state';
import { placing } from '../world/town';
import { tour } from '../world/evalTour';
import { isTalking } from './dialogue';
import { fmt } from './common';
import { sfx } from './battle';
import { isWinOpen } from './windows';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
export const settleOn = () => !getPref<boolean>('settleOff', false);
export const setSettle = (on: boolean) => setPref('settleOff', !on);

let timer = 0;
function close() {
  clearTimeout(timer);
  const c = $('#settle');
  c.classList.remove('on');
  setTimeout(() => (c.hidden = true), 200);
}

export function showSettlement(): boolean {
  const s = takeSettlement();
  if (!s || !settleOn()) return false;
  const { days, sum, record } = s;
  const log = P.daily.log.slice(-7);
  const max = Math.max(1, ...log.map((d) => d.gold));
  const lastDays = new Set(days.map((d) => d.day));
  const bars = log
    .map((d) => `<i class="${lastDays.has(d.day) ? 'now' : ''}"><b style="height:${Math.max(2, Math.round((d.gold / max) * 100))}%"></b><small>${d.day}</small></i>`)
    .join('');
  const title = days.length > 1 ? `${days.length}일 치 정산 · ${days[0].day}~${sum.day}일차` : `${sum.day}일차 마감`;
  const c = $('#settle');
  c.innerHTML = `<div class="card px">
    <b class="t">${title}</b>${record ? '<p class="rec"><img src="assets/ui/star.png" alt=""> 개업 이래 최고! <img src="assets/ui/star.png" alt=""></p>' : ''}
    <div class="sts"><span><small>수입</small><b class="g">${fmt(sum.gold)} G</b></span><span><small>손님</small><b>${sum.guests}명</b></span><span><small>평균 기분</small><b>${sum.mood}</b></span><span><small>새 어울림 · 새 손님</small><b>${sum.newHarm} · ${sum.newDex}</b></span></div>
    <div class="bars">${bars}</div><small class="tap">탭하면 닫혀요</small></div>`;
  c.hidden = false;
  void c.offsetWidth;
  c.classList.add('on');
  c.classList.toggle('record', record);
  if (record) sfx('record');
  c.onclick = close;
  timer = window.setTimeout(close, 4000);
  return true;
}

let acc = 0;
export function tickSettle(dt: number) {
  tickDaily();
  acc += dt;
  if (acc < 0.5) return;
  acc = 0;
  // 마을 화면을 보고 있을 때만
  if (!S.started || S.visiting || !P.daily.pending.length) return;
  if (isWinOpen() || isTalking() || placing.pl || tour.on || document.getElementById('hunt') || document.getElementById('raid') || !$('#settle').hidden) return;
  if (!settleOn()) {
    P.daily.pending.length = 0;
    return;
  }
  showSettlement();
}
