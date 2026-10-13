// v0.24.5 끝없는 심연: 나가면 그 층부터 무료로 이어가기 · 진 층만 유료 이어하기 · 10층 체크포인트(입장료)
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { REGIONS } from '../src/data/items';
import { abyssRec, checkpoints, clearFloor, contCost, cpFee, dropContinue, enterFloor, loseFloor, payContinue, resumeFloor, startAt } from '../src/world/abyss';
import { setFlag } from '../src/world/flags';
import { gsState } from '../src/world/goldsink';
import { P, resetProgress, S } from '../src/world/state';

beforeEach(() => {
  resetProgress();
  S.gold = 0;
  S.visiting = null as never;
  for (const r of REGIONS) P.hunt.best[r.id] = CONFIG.hunt.stages;
});
afterEach(() => setFlag('abyssResume', true));

describe('v0.24.5 심연 이어가기', () => {
  it('층을 시작하면 그 층이 저장 · 나가면(✕·앱 종료) 그 층부터 무료', () => {
    enterFloor(31);
    expect(resumeFloor()).toBe(31);
    expect(abyssRec().lost).toBe(0);
    S.gold = 7;
    // 다시 들어와도 금화는 그대로
    enterFloor(resumeFloor());
    expect(resumeFloor()).toBe(31);
    expect(S.gold).toBe(7);
  });
  it('깨고 「그만 · 마을로」 → 다음 층부터 무료', () => {
    enterFloor(30);
    clearFloor(30);
    expect(resumeFloor()).toBe(31);
    expect(abyssRec().lost).toBe(0);
  });
  it('새로고침(저장 → 불러오기) 뒤에도 그 층부터', () => {
    enterFloor(32);
    const saved = JSON.parse(JSON.stringify(gsState().abyss));
    resetProgress();
    gsState().abyss = saved;
    expect(resumeFloor()).toBe(32);
    // 예전 저장(cur 없음) = 0
    delete (gsState().abyss as { cur?: number }).cur;
    expect(resumeFloor()).toBe(0);
  });
  it('지면 무료 이어가기는 없어지고 유료 이어하기만', () => {
    enterFloor(12);
    loseFloor(12);
    expect(resumeFloor()).toBe(0);
    expect(abyssRec().lost).toBe(12);
    S.gold = contCost(12);
    expect(payContinue()).toEqual({ floor: 12 });
    expect(S.gold).toBe(0);
  });
  it('입장료 = 5,000 × 1.15^층 × 0.5 · 1층 무료', () => {
    expect(cpFee(1)).toBe(0);
    for (const f of [10, 20, 30]) expect(cpFee(f)).toBe(Math.round(5000 * 1.15 ** f * 0.5));
    expect(cpFee(10)).toBe(10114);
    expect(cpFee(20)).toBe(40916);
    expect(cpFee(30)).toBe(165529);
  });
  it('최고 33층 → 체크포인트 1·10·20·30', () => {
    abyssRec().best = 33;
    expect(checkpoints()).toEqual([
      { floor: 1, fee: 0 },
      { floor: 10, fee: 10114 },
      { floor: 20, fee: 40916 },
      { floor: 30, fee: 165529 },
    ]);
    abyssRec().best = 9;
    expect(checkpoints().map((c) => c.floor)).toEqual([1]);
  });
  it('체크포인트 시작: 입장료 · 금화 모자라면 오류 · 최고 층 위는 못 고름 · 이어하기 자리 지움', () => {
    const r = abyssRec();
    r.best = 33;
    loseFloor(25);
    S.gold = 1000;
    expect(startAt(30)).toEqual({ err: '금화가 모자라요' });
    expect(startAt(40)).toEqual({ err: '고를 수 없는 층이에요' });
    S.gold = 165529 + 5;
    expect(startAt(30)).toEqual({ floor: 30, fee: 165529 });
    expect(S.gold).toBe(5);
    expect(abyssRec().lost).toBe(0);
    expect(startAt(1)).toEqual({ floor: 1, fee: 0 });
    expect(S.gold).toBe(5);
  });
  it('플래그 끄면 예전 그대로: 이어가기 없음 · 체크포인트 1층만', () => {
    setFlag('abyssResume', false);
    abyssRec().best = 33;
    enterFloor(31);
    expect(resumeFloor()).toBe(0);
    clearFloor(31);
    expect(abyssRec().cur).toBe(0);
    expect(checkpoints()).toEqual([{ floor: 1, fee: 0 }]);
    loseFloor(32);
    expect(abyssRec().lost).toBe(32);
    dropContinue();
    expect(abyssRec().lost).toBe(0);
  });
});
