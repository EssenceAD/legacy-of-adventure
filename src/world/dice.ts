// GOLDSINK §8 주사위 술내기 (그롬): 6개 주사위 점수 내기 — 먼저 3,000점
//  점수: 1 = 100 · 5 = 50 · 같은 눈 3개 = 눈 × 100 (1 세 개 = 1,000) · 1~6 스트레이트 = 1,500
//  굴릴 때마다 점수 나는 주사위를 하나 이상 떼어 놓고 더 굴릴지 멈출지 · 하나도 없으면 「꽝」(그 차례 0) · 다 떼면 6개 다시
//  판돈 base × m(r) × (1·2·5·10) · 주점 몫 = 판(판돈 × 2)의 10% · 이기면 판돈 × 2 − 10%
import { CONFIG } from '../data/config';
import { flag } from './flags';
import { gsState, mR } from './goldsink';
import { brag } from './growth';
import { addTie } from './owner';
import { markDirty, S } from './state';

const D = () => CONFIG.dice;
export type Rng = () => number;
/** 시험용으로 씨앗을 줄 수 있는 난수 */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const counts = (d: number[]) => {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const v of d) c[v]++;
  return c;
};
export const isStraight = (d: number[]) => d.length === 6 && counts(d).slice(1).every((n) => n === 1);

/** 떼어 놓은 주사위 묶음의 점수 · 점수 안 나는 주사위가 섞였으면 −1 · 빈 묶음 0 */
export function scoreSet(d: number[]): number {
  if (!d.length) return 0;
  if (isStraight(d)) return 1500;
  const c = counts(d);
  let s = 0;
  for (let v = 1; v <= 6; v++) {
    const tri = Math.floor(c[v] / 3);
    const rest = c[v] % 3;
    s += tri * (v === 1 ? 1000 : v * 100);
    if (rest) {
      if (v === 1) s += rest * 100;
      else if (v === 5) s += rest * 50;
      else return -1;
    }
  }
  return s;
}
/** 굴린 눈에 점수 나는 게 있나 (없으면 꽝) */
export function hasScore(d: number[]): boolean {
  if (isStraight(d)) return true;
  const c = counts(d);
  return c[1] > 0 || c[5] > 0 || c.some((n, v) => v > 0 && n >= 3);
}
/** 가장 높은 점수 묶음 (같으면 주사위를 덜 쓰는 쪽) — 그롬 · 「모두 고르기」 */
export function bestPick(d: number[]): { idx: number[]; score: number } {
  let bestI: number[] = [];
  let bestS = 0;
  for (let m = 1; m < 1 << d.length; m++) {
    const idx = d.map((_, i) => i).filter((i) => m & (1 << i));
    const s = scoreSet(idx.map((i) => d[i]));
    if (s > bestS || (s === bestS && s > 0 && idx.length < bestI.length)) [bestI, bestS] = [idx, s];
  }
  return { idx: bestI, score: bestS };
}

// ───────── 한 판 ─────────

export interface DiceGame {
  stake: number;
  /** [나, 그롬] */
  scores: [number, number];
  /** 0 = 나 · 1 = 그롬 */
  turn: 0 | 1;
  /** 이번에 굴린 눈 (굴리기 전이면 빈칸) */
  roll: number[];
  /** 이번 차례에 떼어 놓은 눈 */
  kept: number[];
  turnPts: number;
  /** 다음에 굴릴 주사위 수 */
  left: number;
  busts: [number, number];
  /** 이번 판에 내가 스트레이트를 굴렸나 */
  straight: boolean;
  /** 마지막 일 (UI 한 줄) */
  last: '' | 'bust' | 'bank' | 'hot';
  winner: -1 | 0 | 1;
}
export function newGame(stake: number): DiceGame {
  return { stake, scores: [0, 0], turn: 0, roll: [], kept: [], turnPts: 0, left: 6, busts: [0, 0], straight: false, last: '', winner: -1 };
}
const nextTurn = (g: DiceGame) => {
  g.turn = g.turn ? 0 : 1;
  g.roll = [];
  g.kept = [];
  g.turnPts = 0;
  g.left = 6;
  g.last = '';
};
/** 굴리기 (left개) · 꽝이면 차례 점수 0 · 차례 넘김 → 'bust' */
export function rollDice(g: DiceGame, rng: Rng = Math.random): 'ok' | 'bust' {
  if (g.winner >= 0 || g.roll.length) return 'ok';
  g.roll = Array.from({ length: g.left }, () => 1 + Math.floor(rng() * 6));
  g.last = '';
  if (g.turn === 0 && isStraight(g.roll)) g.straight = true;
  if (!hasScore(g.roll)) {
    g.busts[g.turn]++;
    g.last = 'bust';
    return 'bust';
  }
  return 'ok';
}
/** 꽝을 보여 준 뒤 차례 넘기기 */
export function passBust(g: DiceGame) {
  if (g.last === 'bust') nextTurn(g);
}
/** 고른 눈(roll의 자리)을 떼어 놓기 · 점수 안 나는 게 섞였으면 오류 */
export function keep(g: DiceGame, idx: number[]): string | null {
  if (!g.roll.length) return '먼저 굴려요';
  const u = [...new Set(idx)].filter((i) => i >= 0 && i < g.roll.length);
  if (!u.length) return '점수 나는 주사위를 하나 이상 골라요';
  const s = scoreSet(u.map((i) => g.roll[i]));
  if (s <= 0) return '점수 나는 주사위만 고를 수 있어요';
  g.kept.push(...u.map((i) => g.roll[i]));
  g.turnPts += s;
  g.left -= u.length;
  g.roll = [];
  g.last = '';
  // 다 떼었으면 6개 다시
  if (g.left <= 0) {
    g.left = 6;
    g.kept = [];
    g.last = 'hot';
  }
  return null;
}
/** 멈추기: 차례 점수를 더하고 넘긴다 (목표에 닿으면 끝) */
export function bank(g: DiceGame) {
  if (g.roll.length || g.winner >= 0) return;
  g.scores[g.turn] += g.turnPts;
  if (g.scores[g.turn] >= D().goal) {
    g.winner = g.turn;
    return;
  }
  nextTurn(g);
  g.last = 'bank';
}
/** 그롬: 이번 차례 점수가 aiStop을 넘거나 이기면 멈춤 */
export const aiWantsStop = (turnPts: number, score: number) => turnPts > D().aiStop || score + turnPts >= D().goal;
/** 그롬 한 걸음: 굴리기 → (꽝) / 가장 좋은 묶음 떼기 → 멈출지 (UI가 걸음마다 그린다) */
export function aiStep(g: DiceGame, rng: Rng = Math.random): 'roll' | 'bust' | 'keep' | 'bank' {
  if (!g.roll.length) {
    if (g.turnPts > 0 && aiWantsStop(g.turnPts, g.scores[1])) {
      bank(g);
      return 'bank';
    }
    return rollDice(g, rng) === 'bust' ? 'bust' : 'roll';
  }
  keep(g, bestPick(g.roll).idx);
  return 'keep';
}

// ───────── 판돈 · 기록 ─────────

export const stakeBase = () => Math.round(D().base * mR());
export const stakeOf = (mult: number) => stakeBase() * mult;
/** 이기면 받는 금화 (판돈 × 2 − 주점 몫 10%) · 지면 0 */
export const payout = (stake: number, win: boolean) => (win ? Math.round(stake * 2 * (1 - D().cut)) : 0);
/** 주점 몫 */
export const tavernCut = (stake: number) => Math.round(stake * 2 * D().cut);

export function diceRec() {
  const g = gsState();
  const base = { games: 0, wins: 0, streak: 0, bestStreak: 0, ach: [] as string[] };
  const r = (g.dice ??= base);
  for (const k of ['games', 'wins', 'streak', 'bestStreak'] as const) if (!Number.isFinite(r[k])) r[k] = 0;
  if (!Array.isArray(r.ach)) r.ach = [];
  return r;
}
/** 업적 (§8 → 칭호) */
export const DICE_ACH = { diceClean: '꽝 없이 3,000점', diceStraight: '스트레이트', diceStreak: '그롬에게 10연승' } as const;
export type DiceAchId = keyof typeof DICE_ACH;

/** 판 시작: 판돈을 낸다 */
export function payStake(stake: number): string | null {
  if (!flag('diceGame')) return '지금은 쉬어 가요';
  if (S.gold < stake) return '금화가 모자라요';
  S.gold -= stake;
  diceRec().games++;
  markDirty();
  return null;
}
/** 판 끝: 금화 · 인연 · 연승 · 업적(+자랑) → 새로 이룬 업적 · 10승 대사인가 */
export function settleGame(g: DiceGame): { gold: number; newAch: DiceAchId[]; winLine: boolean } {
  const r = diceRec();
  const win = g.winner === 0;
  const gold = payout(g.stake, win);
  S.gold += gold;
  const got: DiceAchId[] = [];
  const add = (id: DiceAchId) => {
    if (r.ach.includes(id)) return;
    r.ach.push(id);
    got.push(id);
    brag('dice', null, DICE_ACH[id]);
  };
  if (g.straight) add('diceStraight');
  let winLine = false;
  if (win) {
    r.wins++;
    r.streak++;
    r.bestStreak = Math.max(r.bestStreak, r.streak);
    addTie('grom', D().tieWin);
    winLine = r.wins % D().winLineEvery === 0;
    if (!g.busts[0]) add('diceClean');
    if (r.streak >= D().streakGoal) add('diceStreak');
  } else r.streak = 0;
  markDirty();
  return { gold, newAch: got, winLine };
}
