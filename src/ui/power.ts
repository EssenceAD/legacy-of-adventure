// 베타 5장: 전투력 롤링 (HUD 여관 이름 옆) · 이유 한 줄 · 큰 카드
import { notePrep, powerHooks, prepDiff, tickPower, townPower } from '../world/power';
import { S } from '../world/state';
import { sfx } from './battle';
import { esc, fmt } from './common';
import { toast } from './windows';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

let rollT = 0;
/** 숫자가 촤르륵 (0.9초) */
function roll(from: number, to: number) {
  clearInterval(rollT);
  const el = $('#pwrv');
  const btn = $('#pwr');
  let i = 0;
  const N = 18;
  btn.classList.remove('up');
  void btn.offsetWidth;
  btn.classList.add('up');
  rollT = window.setInterval(() => {
    i++;
    const t = 1 - Math.pow(1 - i / N, 3);
    el.textContent = fmt(Math.round(from + (to - from) * t));
    if (i >= N) {
      clearInterval(rollT);
      rollT = 0;
    }
  }, 50);
}

let whyT = 0;
const cards: [string, string][] = [];
let carding = false;
function nextCard() {
  const c = cards.shift();
  const el = $('#pcard');
  if (!c) {
    carding = false;
    el.hidden = true;
    return;
  }
  carding = true;
  el.innerHTML = `<img src="assets/emotes/emo_sparkle.png" alt=""><span><small>강해졌다!</small><b>${esc(c[0])}</b><em>${esc(c[1])}</em></span><img src="assets/emotes/emo_sparkle.png" alt="">`;
  el.hidden = false;
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
  sfx('item');
  setTimeout(nextCard, 3000);
}

export function initPowerUI() {
  powerHooks.up = (from, to, why) => {
    roll(from, to);
    const w = $('#pwrWhy');
    w.textContent = `+${fmt(to - from)} (${why})`;
    w.hidden = false;
    clearTimeout(whyT);
    whyT = window.setTimeout(() => (w.hidden = true), 3500);
  };
  powerHooks.card = (title, text) => {
    cards.push([title, text]);
    if (!carding) nextCard();
  };
  $('#pwr').onclick = () => toast(`마을 전투력 ${fmt(townPower())} · 단골·영웅 전투력 합 (레벨·장비·도감·케미)`);
}

let acc = 1;
export function tickPowerUI(dt: number) {
  tickPower(dt);
  acc += dt;
  if (acc < 1 || S.visiting) return;
  acc = 0;
  // 롤링 중이 아니면 숫자를 맞춘다
  const el = $('#pwrv');
  const v = fmt(townPower());
  if (!rollT && el.textContent !== v) el.textContent = v;
}

/** 사냥·토벌 준비 화면 줄: 「지난번보다 +12%」 */
export function prepLine(key: string, power: number): string {
  const d = prepDiff(key, power);
  if (d == null || d === 0) return '';
  return `<small class="${d > 0 ? 'good' : 'bad'}">지난번보다 ${d > 0 ? '+' : ''}${d}%</small>`;
}
export { notePrep };
