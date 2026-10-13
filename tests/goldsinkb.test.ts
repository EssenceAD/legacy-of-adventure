// GOLDSINK B (§7 끝없는 심연 · §8 주사위 술내기) 단위 시험
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/data/config';
import { REGIONS } from '../src/data/items';
import { abyssOpen, abyssRec, clearFloor, contCost, dropContinue, floorRec, floorStage, isBossFloor, isRestFloor, loseFloor, payContinue, pickBoss, seenBossRegions } from '../src/world/abyss';
import {
  aiStep, aiWantsStop, bank, bestPick, diceRec, hasScore, isStraight, keep, newGame, passBust, payout, payStake, rollDice, scoreSet, seeded, settleGame, stakeOf, tavernCut, type DiceGame,
} from '../src/world/dice';
import { setFlag } from '../src/world/flags';
import { blessLeft, gsState } from '../src/world/goldsink';
import { recPower } from '../src/world/hunt';
import { P, resetProgress, S, uiHooks } from '../src/world/state';

const KST0 = (y: number, mo: number, d: number, h = 0) => Date.UTC(y, mo - 1, d, h - 9);
/** 정해진 눈을 차례로 내는 난수 (눈 v → (v − 0.5) / 6) */
const fixed = (vals: number[]) => {
  let i = 0;
  return () => (vals[i++ % vals.length] - 0.5) / 6;
};

beforeEach(() => {
  resetProgress();
  S.gold = 0;
  S.visiting = null as never;
  for (const r of REGIONS) P.hunt.best[r.id] = CONFIG.hunt.stages;
});
afterEach(() => vi.restoreAllMocks());

describe('§8 주사위 점수', () => {
  it('1 = 100 · 5 = 50 · 섞이면 −1', () => {
    expect(scoreSet([1])).toBe(100);
    expect(scoreSet([5])).toBe(50);
    expect(scoreSet([1, 5])).toBe(150);
    expect(scoreSet([1, 1, 5, 5])).toBe(300);
    expect(scoreSet([1, 2])).toBe(-1);
    expect(scoreSet([3])).toBe(-1);
    expect(scoreSet([])).toBe(0);
  });
  it('같은 눈 3개 = 눈 × 100 · 1 세 개 = 1,000', () => {
    expect(scoreSet([2, 2, 2])).toBe(200);
    expect(scoreSet([4, 4, 4])).toBe(400);
    expect(scoreSet([5, 5, 5])).toBe(500);
    expect(scoreSet([6, 6, 6])).toBe(600);
    expect(scoreSet([1, 1, 1])).toBe(1000);
    expect(scoreSet([1, 1, 1, 1])).toBe(1100);
    expect(scoreSet([5, 5, 5, 5])).toBe(550);
    expect(scoreSet([3, 3, 3, 3])).toBe(-1);
    expect(scoreSet([2, 2, 2, 2, 2, 2])).toBe(400);
    expect(scoreSet([3, 3, 3, 1, 5])).toBe(450);
  });
  it('1~6 스트레이트 = 1,500', () => {
    expect(isStraight([3, 1, 2, 6, 5, 4])).toBe(true);
    expect(scoreSet([3, 1, 2, 6, 5, 4])).toBe(1500);
    expect(isStraight([1, 2, 3, 4, 5])).toBe(false);
    expect(bestPick([6, 5, 4, 3, 2, 1]).score).toBe(1500);
  });
  it('꽝: 점수 나는 게 하나도 없으면', () => {
    expect(hasScore([2, 3, 4, 6, 2, 3])).toBe(false);
    expect(hasScore([2, 3, 4, 6])).toBe(false);
    expect(hasScore([2, 2, 2])).toBe(true);
    expect(hasScore([5])).toBe(true);
    const g = newGame(1000);
    g.turnPts = 300;
    expect(rollDice(g, fixed([2, 3, 4, 6, 2, 3]))).toBe('bust');
    expect(g.busts[0]).toBe(1);
    passBust(g);
    expect(g.turn).toBe(1);
    expect(g.turnPts).toBe(0);
    expect(g.scores[0]).toBe(0);
  });
  it('가장 좋은 묶음 (같은 점수면 주사위를 덜 쓰기)', () => {
    expect(bestPick([1, 1, 1, 5, 2, 3])).toEqual({ idx: [0, 1, 2, 3], score: 1050 });
    expect(bestPick([2, 3, 4, 6, 2, 3]).score).toBe(0);
  });
  it('떼기 · 멈추기 · 다 떼면 6개 다시 · 3,000점이면 끝', () => {
    const g = newGame(1000);
    rollDice(g, fixed([1, 1, 1, 5, 5, 5]));
    expect(keep(g, [0, 4])).toBeNull();
    expect(g.turnPts).toBe(150);
    expect(g.left).toBe(4);
    rollDice(g, fixed([2, 3, 4, 1]));
    expect(keep(g, [0])).toBe('점수 나는 주사위만 고를 수 있어요');
    expect(keep(g, [])).toBe('점수 나는 주사위를 하나 이상 골라요');
    expect(keep(g, [3])).toBeNull();
    bank(g);
    expect(g.scores[0]).toBe(250);
    expect(g.turn).toBe(1);
    const h = newGame(1000);
    rollDice(h, fixed([1, 2, 3, 4, 5, 6]));
    expect(h.straight).toBe(true);
    keep(h, [0, 1, 2, 3, 4, 5]);
    expect(h.left).toBe(6);
    expect(h.last).toBe('hot');
    h.scores[0] = 1600;
    bank(h);
    expect(h.winner).toBe(0);
  });
});

describe('§8 그롬 AI', () => {
  it('이번 차례가 500을 넘으면 멈춤 · 이길 점수면 멈춤', () => {
    expect(aiWantsStop(500, 0)).toBe(false);
    expect(aiWantsStop(550, 0)).toBe(true);
    expect(aiWantsStop(100, 2950)).toBe(true);
  });
  it('굴리기 → 가장 좋은 묶음 → 500 넘으면 멈춤', () => {
    const g: DiceGame = newGame(1000);
    g.turn = 1;
    const rng = fixed([1, 1, 1, 2, 3, 4]);
    expect(aiStep(g, rng)).toBe('roll');
    expect(aiStep(g, rng)).toBe('keep');
    expect(g.turnPts).toBe(1000);
    expect(aiStep(g, rng)).toBe('bank');
    expect(g.scores[1]).toBe(1000);
    expect(g.turn).toBe(0);
  });
  it('500 이하면 계속 굴림', () => {
    const g = newGame(1000);
    g.turn = 1;
    const rng = fixed([5, 2, 3, 4, 6, 2]);
    aiStep(g, rng);
    aiStep(g, rng);
    expect(g.turnPts).toBe(50);
    expect(aiStep(g, rng)).not.toBe('bank');
  });
  it('씨앗 난수로 한 판 끝까지 (같은 씨앗 = 같은 결과)', () => {
    const play = (seed: number) => {
      const rng = seeded(seed);
      const g = newGame(1000);
      for (let i = 0; i < 5000 && g.winner < 0; i++) {
        if (g.last === 'bust') {
          passBust(g);
          continue;
        }
        if (g.turn === 1) {
          aiStep(g, rng);
          continue;
        }
        // 나: 그롬과 같은 성격
        if (!g.roll.length) {
          if (g.turnPts > 300) bank(g);
          else rollDice(g, rng);
        } else keep(g, bestPick(g.roll).idx);
      }
      return [g.winner, ...g.scores];
    };
    const a = play(7);
    expect(a[0]).toBeGreaterThanOrEqual(0);
    expect(Math.max(a[1], a[2])).toBeGreaterThanOrEqual(3000);
    expect(play(7)).toEqual(a);
  });
});

describe('§8 판돈 · 주점 몫 · 기록', () => {
  it('판돈 1,000 × m(r) · 이기면 판돈 × 2 − 10%', () => {
    expect(stakeOf(1)).toBe(1000 * 2 ** (REGIONS.length - 1));
    expect(stakeOf(10)).toBe(stakeOf(1) * 10);
    expect(payout(10000, true)).toBe(18000);
    expect(payout(10000, false)).toBe(0);
    expect(tavernCut(10000)).toBe(2000);
  });
  it('판 시작에 판돈을 내고 이기면 받는다 · 연승 · 업적 · 자랑 「dice|이름」', () => {
    const ann = vi.spyOn(uiHooks, 'announce').mockImplementation(() => {});
    S.gold = 100000;
    expect(payStake(200000)).toBe('금화가 모자라요');
    expect(payStake(10000)).toBeNull();
    expect(S.gold).toBe(90000);
    const g = newGame(10000);
    g.winner = 0;
    g.straight = true;
    const r = settleGame(g);
    expect(r.gold).toBe(18000);
    expect(S.gold).toBe(108000);
    expect(r.newAch.sort()).toEqual(['diceClean', 'diceStraight']);
    expect(ann).toHaveBeenCalledWith(expect.any(String), 'brag', 'dice|스트레이트');
    expect(diceRec().streak).toBe(1);
    const l = newGame(10000);
    l.winner = 1;
    expect(settleGame(l).gold).toBe(0);
    expect(diceRec().streak).toBe(0);
  });
  it('10연승 업적 · 10승마다 대사', () => {
    const rec = diceRec();
    rec.wins = 9;
    rec.streak = 9;
    rec.ach.push('diceClean');
    const g = newGame(1000);
    g.winner = 0;
    g.busts[0] = 1;
    const r = settleGame(g);
    expect(r.winLine).toBe(true);
    expect(r.newAch).toEqual(['diceStreak']);
  });
  it('플래그를 끄면 판을 시작할 수 없다', () => {
    S.gold = 1e9;
    setFlag('diceGame', false);
    expect(payStake(1000)).not.toBeNull();
    setFlag('diceGame', true);
  });
});

describe('§7 끝없는 심연', () => {
  it('열림: 심연의 바닥 10 + 플래그', () => {
    expect(abyssOpen()).toBe(true);
    setFlag('endlessAbyss', false);
    expect(abyssOpen()).toBe(false);
    setFlag('endlessAbyss', true);
    P.hunt.best.deep = 9;
    expect(abyssOpen()).toBe(false);
  });
  it('층마다 ×1.07 복리 · 1층 = 심연의 바닥 10 · 보스 5층마다 · 쉼터 10층마다', () => {
    const base = recPower('deep', 10);
    expect(floorRec(1)).toBe(base);
    expect(floorRec(2)).toBe(Math.round(base * 1.07));
    expect(floorRec(11)).toBe(Math.round(base * 1.07 ** 10));
    expect([5, 10, 15].every(isBossFloor)).toBe(true);
    expect(isBossFloor(4)).toBe(false);
    expect(isRestFloor(10) && isRestFloor(20) && !isRestFloor(5)).toBe(true);
    expect(floorStage(5)).toBe(10);
    expect(floorStage(6)).toBe(9);
  });
  it('보스 층 보스 = 쓰러뜨린 지역 보스 중', () => {
    for (const r of REGIONS) P.hunt.best[r.id] = 0;
    P.hunt.best.forest = 10;
    P.hunt.best.deep = 10;
    expect(seenBossRegions()).toEqual(['forest', 'deep']);
    expect(pickBoss(() => 0).region).toBe('forest');
    expect(pickBoss(() => 0.99).region).toBe('deep');
  });
  it('보상: 금화 없음 · 가루·재료 · 보스 층 보스 재료 · 쉼터 축복 30분', () => {
    const now = KST0(2026, 10, 14, 12);
    S.gold = 5;
    const dn = P.dust.n;
    const out = clearFloor(10, 'forest', () => 0.99, now);
    expect(S.gold).toBe(5);
    expect(P.dust.n - dn).toBe(20 + 2 * 10);
    expect(out.bossMats).toBe(2);
    expect(out.rest).toBe(true);
    expect(blessLeft(now)).toBe(30 * 60000);
    expect(abyssRec(now).best).toBe(10);
  });
  it('이어하기 = 5,000 × 1.15^층 · 내면 그 층 · 안 내면 1층', () => {
    expect(contCost(1)).toBe(5750);
    expect(contCost(20)).toBe(Math.round(5000 * 1.15 ** 20));
    loseFloor(12);
    S.gold = 100;
    expect(payContinue()).toEqual({ err: '금화가 모자라요' });
    S.gold = contCost(12) + 1;
    expect(payContinue()).toEqual({ floor: 12 });
    expect(S.gold).toBe(1);
    expect(abyssRec().lost).toBe(0);
    expect(payContinue()).toEqual({ err: '이어할 층이 없어요' });
    loseFloor(7);
    dropContinue();
    expect(abyssRec().lost).toBe(0);
  });
  it('주간 최고 층은 한국 시간 월요일 0시에 초기화 · 최고 층은 그대로', () => {
    const sun = KST0(2026, 10, 18, 23);
    clearFloor(7, null, Math.random, sun);
    expect(abyssRec(sun).weekBest).toBe(7);
    const mon = KST0(2026, 10, 19, 0);
    expect(abyssRec(mon).weekBest).toBe(0);
    expect(abyssRec(mon).best).toBe(7);
    clearFloor(3, null, Math.random, mon);
    expect(abyssRec(mon).weekBest).toBe(3);
    expect(gsState(mon).abyss.best).toBe(7);
  });
  it('25층 자랑 「abyss|25」 (층 숫자만) · 한 번만', () => {
    const ann = vi.spyOn(uiHooks, 'announce').mockImplementation(() => {});
    clearFloor(24);
    expect(ann).not.toHaveBeenCalled();
    clearFloor(25);
    expect(ann).toHaveBeenCalledWith(expect.stringContaining('25층'), 'brag', 'abyss|25');
    P.growth.brag.last = 0;
    clearFloor(26);
    expect(ann).toHaveBeenCalledTimes(1);
  });
});
