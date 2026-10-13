// GOLDSINK §8 주사위 술내기 창 — 주점 탁자 위 · 주사위는 코드 그림(흰 6면체 · 점) · 새 그림 없음
import { CONFIG } from '../data/config';
import { flag } from '../world/flags';
import { fmtKo } from '../world/goldsink';
import {
  aiStep, bank, bestPick, DICE_ACH, diceRec, keep, newGame, passBust, payStake, payout, rollDice, scoreSet, seeded, settleGame, stakeOf, tavernCut, type DiceGame, type Rng,
} from '../world/dice';
import { findKind } from '../world/town';
import { S, world, type Actor } from '../world/state';
import { track as trackEv } from '../net/telemetry';
import { esc, fmt } from './common';
import { sfx } from './battle';
import { openWin, toast } from './windows';

const D = () => CONFIG.dice;
const TITLE = '주사위 술내기 · 그롬';
const LINE = {
  start: '주사위 한 판? 좋지! 지는 쪽이 오늘 술값이다!',
  bust: '하하하! 꽝이다, 꽝! 술 한 잔 더!',
  gromLose: '…주사위가 기울었어. 분명 기울었다고.',
  gromWin: '드워프 손목을 이길 생각은 마라! 한 판 더?',
  win10: '자네… 혹시 주사위에 마법 건 거 아니지? 아리아한테 물어봐야겠군.',
};
let g: DiceGame | null = null;
let sel = new Set<number>();
let rng: Rng = Math.random;
let say = '';
let stepMs = 0;
let aiT = 0;
let endInfo: { gold: number; ach: string[]; winLine: boolean } | null = null;

/** 그롬과 한 판 할 수 있나: 플래그 · 그롬 · 밤 · 주점 · 내 마을 */
export const canDice = (a: Actor) => flag('diceGame') && a.legendId === 'grom' && S.night && !S.visiting && !!findKind('tavern');
export const diceWhyNot = () => (!S.night ? '그롬은 밤에 주점에서 주사위를 굴려요' : !findKind('tavern') ? '주점이 있어야 해요' : '');

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const die = (v: number, attr = '', cls = '') => `<button class="die ${cls}" ${attr} aria-label="${v}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'p' : ''}"></i>`).join('')}</button>`;
const bubble = () => (say ? `<p class="dsay"><b>그롬</b> “${esc(say)}”</p>` : '');
const isOpen = () => document.getElementById('winT')?.textContent === TITLE && !!document.getElementById('win')?.classList.contains('on');

/** 판돈 고르기 */
export function openDice() {
  if (!flag('diceGame')) return toast('지금은 쉬어 가요');
  clearTimeout(aiT);
  // 판 중에 창을 닫았다가 다시 오면: 그 판은 진 걸로
  if (g && g.winner < 0) {
    g.winner = 1;
    settleGame(g);
  }
  g = null;
  endInfo = null;
  say = LINE.start;
  const r = diceRec();
  const btns = D()
    .mults.map((m) => {
      const st = stakeOf(m);
      return `<button class="bigbtn ${S.gold < st ? 'ghost' : ''}" data-dm="${m}" ${S.gold < st ? 'disabled' : ''}>×${m} · ${fmtKo(st)} G<small>이기면 ${fmtKo(payout(st, true))} G</small></button>`;
    })
    .join('');
  openWin(
    TITLE,
    `<div class="dtable">${bubble()}
    <p class="note">6개를 굴려 점수 나는 주사위를 하나 이상 떼어 놓고 → 더 굴릴지 멈출지. 하나도 없으면 「꽝」(그 차례 0점). 먼저 ${fmt(D().goal)}점.</p>
    <p class="note">1 = 100 · 5 = 50 · 같은 눈 3개 = 눈 × 100 · 1 세 개 = 1,000 · 1~6 스트레이트 = 1,500 · 다 떼면 6개 다시</p>
    <p class="note">판돈을 걸고 이기면 판돈 × 2 − 주점 몫 ${Math.round(D().cut * 100)}% · 지면 판돈을 잃어요</p>
    <div class="dstakes">${btns}</div>
    <p class="sub">${fmt(r.games)}판 · ${fmt(r.wins)}승 · 지금 ${r.streak}연승 (최고 ${r.bestStreak})</p></div>`,
    'dicew',
  );
  document.querySelectorAll<HTMLElement>('[data-dm]').forEach((b) => (b.onclick = () => start(stakeOf(+b.dataset.dm!))));
}

function start(stake: number) {
  const err = payStake(stake);
  if (err) return toast(err);
  sfx('coin');
  g = newGame(stake);
  sel = new Set();
  say = '';
  trackEv('dice_start', { stake });
  draw();
}

function draw() {
  if (!g) return;
  const G = g;
  const mine = G.turn === 0 && G.winner < 0;
  const picked = [...sel].map((i) => G.roll[i]);
  const ps = scoreSet(picked);
  const bust = G.last === 'bust';
  let btns = '';
  if (G.winner >= 0) btns = '';
  else if (!mine) btns = '<p class="cen note">그롬이 굴리는 중…</p>';
  else if (bust) btns = '<button class="bigbtn" id="dPass">넘기기</button>';
  else if (!G.roll.length) btns = `<button class="bigbtn red" id="dRoll">굴리기 · ${G.left}개</button>${G.turnPts ? `<button class="bigbtn ghost" id="dBank">멈추기 · +${fmt(G.turnPts)}</button>` : ''}`;
  else {
    const ok = ps > 0 ? '' : 'disabled';
    btns = `<button class="bigbtn red" id="dKR" ${ok}>떼고 굴리기</button><button class="bigbtn" id="dKB" ${ok}>떼고 멈추기 · +${fmt(G.turnPts + Math.max(0, ps))}</button><button class="bigbtn ghost sm" id="dAll">점수 나는 것 모두</button>`;
  }
  const end = G.winner >= 0 && endInfo
    ? `<div class="dend ${G.winner === 0 ? 'good' : 'bad'}"><h3>${G.winner === 0 ? '이겼다!' : '졌다…'}</h3><p>${G.winner === 0 ? `금화 +${fmtKo(endInfo.gold)} G (판돈 ${fmtKo(G.stake)} × 2 − 주점 몫 ${fmtKo(tavernCut(G.stake))})` : `판돈 ${fmtKo(G.stake)} G를 잃었어요`}</p>${endInfo.ach.map((a) => `<p class="g">업적 「${esc(a)}」! (업적에서 칭호를 받아요)</p>`).join('')}<div class="btnrow"><button class="bigbtn" id="dAgain">한 판 더</button><button class="bigbtn ghost" id="dQuit">그만</button></div></div>`
    : '';
  openWin(
    TITLE,
    `<div class="dtable">
    <div class="dscore"><span class="${G.turn === 0 ? 'on' : ''}">나 <b id="dMe">${fmt(G.scores[0])}</b></span><small>${fmt(D().goal)}점 · 판돈 ${fmtKo(G.stake)}</small><span class="${G.turn === 1 ? 'on' : ''}">그롬 <b id="dGr">${fmt(G.scores[1])}</b></span></div>
    ${bubble()}
    <p class="dturn">${G.winner >= 0 ? '' : mine ? '내 차례' : '그롬 차례'}${G.winner < 0 ? ` · 이번 차례 <b id="dTurn">${fmt(G.turnPts)}</b>${mine && G.roll.length && ps > 0 ? ` <span class="g">+${fmt(ps)}</span>` : ''}` : ''}</p>
    ${bust ? '<p class="dbust">꽝!</p>' : G.last === 'hot' ? '<p class="cen g">다 떼었다! 6개 다시</p>' : ''}
    <div class="drow kept">${G.kept.map((v) => die(v, 'disabled', 'k')).join('')}</div>
    <div class="drow roll" id="dRollRow">${G.roll.map((v, i) => die(v, mine && !bust ? `data-di="${i}"` : 'disabled', sel.has(i) ? 'sel' : '')).join('')}</div>
    <div class="dbtns">${btns}</div>${end}</div>`,
    'dicew',
  );
  const on = (id: string, f: () => void) => {
    const b = document.getElementById(id);
    if (b) b.onclick = f;
  };
  document.querySelectorAll<HTMLElement>('[data-di]').forEach(
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.di!;
        if (sel.has(i)) sel.delete(i);
        else sel.add(i);
        draw();
      }),
  );
  on('dRoll', () => myRoll());
  on('dBank', () => {
    bank(G);
    afterBank();
  });
  on('dAll', () => {
    sel = new Set(bestPick(G.roll).idx);
    draw();
  });
  on('dKR', () => {
    const e = keep(G, [...sel]);
    if (e) return toast(e);
    sel = new Set();
    myRoll();
  });
  on('dKB', () => {
    const e = keep(G, [...sel]);
    if (e) return toast(e);
    sel = new Set();
    bank(G);
    afterBank();
  });
  on('dPass', () => {
    passBust(G);
    say = '';
    gromTurn();
  });
  on('dAgain', () => openDice());
  on('dQuit', () => {
    g = null;
    document.getElementById('winX')?.click();
  });
}

function myRoll() {
  if (!g) return;
  sfx('tap');
  if (rollDice(g, rng) === 'bust') say = LINE.bust;
  else say = '';
  draw();
}
function afterBank() {
  if (!g) return;
  if (g.winner >= 0) return finish();
  say = '';
  gromTurn();
}

/** 그롬 차례: 걸음마다 그린다 (창을 닫으면 멈췄다가 다시 열면 이어서 · 창이 없으면 몰수) */
function gromTurn() {
  if (!g) return;
  draw();
  const G = g;
  const step = () => {
    if (g !== G) return;
    if (!isOpen()) {
      // 판 중에 창을 닫으면 진 걸로
      G.winner = 1;
      return finish(false);
    }
    const r = aiStep(G, rng);
    if (r === 'bust') {
      say = '쳇!';
      draw();
      aiT = window.setTimeout(() => {
        passBust(G);
        say = '';
        draw();
      }, stepMs || D().aiStepMs * 2);
      return;
    }
    if (r === 'bank') {
      if (G.winner >= 0) return finish();
      say = '';
      draw();
      return;
    }
    draw();
    aiT = window.setTimeout(step, stepMs || D().aiStepMs);
  };
  aiT = window.setTimeout(step, stepMs || D().aiStepMs);
}

function finish(show = true) {
  if (!g) return;
  const r = settleGame(g);
  trackEv('dice_end', { stake: g.stake, win: g.winner === 0, me: g.scores[0], grom: g.scores[1] });
  endInfo = { gold: r.gold, ach: r.newAch.map((id) => DICE_ACH[id]), winLine: r.winLine };
  say = g.winner === 0 ? (r.winLine ? LINE.win10 : LINE.gromLose) : LINE.gromWin;
  if (g.winner === 0) sfx('coin');
  if (show && isOpen()) draw();
}

/** 개발 · e2e: 씨앗 · 그롬 속도 · 상태 */
export const _dice = {
  seed: (n: number) => (rng = seeded(n)),
  speed: (ms: number) => (stepMs = ms),
  game: () => g,
  open: openDice,
  world: () => world.actors.filter((a) => a.legendId === 'grom').length,
};
