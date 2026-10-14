// 웅스 건의 「강화 전수」 (플래그 enhTransfer): 단계 표(등급 차 × 단계 · 초월 포함) · 비용 표(오프라인 기댓값 × 35%와 일치) ·
//  잠김(받는 쪽이 더 높음 · 다른 부위 · 낮은 등급 · 같은 장비 · 주는/받는 사람 원정 중) · 낀 장비 → 받는 장비 자동 장착 · 분해 가루 · 부적
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { makeAdventurer } from '../src/world/adventurers';
import { regionBoss } from '../src/world/craft';
import { giverCands, giverDust, recvCands, transferCost, transferEnh, transferPlan, transferredLevel } from '../src/world/enhTransfer';
import { FLAG_DEFAULTS } from '../src/world/flags';
import { equip, makeItem } from '../src/world/items';
import { type Grade } from '../src/data/items';
import { P, resetProgress, S, world, type Actor, type Item } from '../src/world/state';
import { addObj, rebuildPaths, startTown } from '../src/world/town';
import { transferRow } from './transfer-table';

const TF = CONFIG.growth.transfer;
const SM = CONFIG.smith;
const mk = (name: string): Actor => {
  const a = makeAdventurer(5, 5, { status: 'regular' } as never);
  a.id = P.nextAdvId++;
  a.name = name;
  world.actors.push(a);
  return a;
};
const gear = (grade: Grade, enh: number, slot: 'weapon' | 'armor' | 'acc' = 'weapon', a: Actor | null = null): Item => {
  const it = makeItem('forest', grade, slot, false);
  it.enh = enh;
  P.bag.push(it);
  if (a) equip(a, it);
  return it;
};
beforeEach(() => {
  resetProgress();
  S.visiting = false as never;
  S.land = 5;
  startTown();
  addObj('smith', 20, 20, { lvl: 5 });
  rebuildPaths();
  world.actors = world.actors.filter((a) => a.role);
  P.bag = [];
  S.gold = 100_000_000;
  for (const g of ['n', 'r', 'e', 'l', 'a'] as const) P.dust[g] = 1_000_000;
  P.bossMats[regionBoss('forest').id] = 100;
  P.growth.charm = 5;
});

describe('플래그', () => {
  it('enhTransfer 기본 꺼짐 (형철 확인 전 · 실험실)', () => {
    expect(FLAG_DEFAULTS.enhTransfer).toBe(false);
  });
});

describe('옮겨지는 단계 표 (등급 차 × 단계)', () => {
  it('+3 ~ +20 전부: 같은 등급 그대로 · 한 등급 위 −1 · 두 등급 이상 −2 · +11 이상 −1 더', () => {
    for (let lv = 3; lv <= 20; lv++) {
      const tr = lv >= 11 ? 1 : 0;
      expect(transferredLevel(lv, 0)).toBe(lv - tr);
      expect(transferredLevel(lv, 1)).toBe(lv - 1 - tr);
      expect(transferredLevel(lv, 2)).toBe(lv - 2 - tr);
      expect(transferredLevel(lv, 3)).toBe(lv - 2 - tr);
      expect(transferredLevel(lv, 4)).toBe(lv - 2 - tr);
      expect(transferredLevel(lv, -1)).toBe(-1);
    }
  });
  it('보기: +10 → +10/+9/+8 · +11 → +10/+9/+8 · +12 → +11 · +20 → +17', () => {
    expect([0, 1, 2].map((g) => transferredLevel(10, g))).toEqual([10, 9, 8]);
    expect([0, 1, 2].map((g) => transferredLevel(11, g))).toEqual([10, 9, 8]);
    expect(transferredLevel(12, 0)).toBe(11);
    expect(transferredLevel(20, 4)).toBe(17);
  });
  it('실제 장비로 (모든 등급 쌍)', () => {
    const G: Grade[] = ['n', 'r', 'e', 'l', 'a'];
    for (let gi = 0; gi < G.length; gi++)
      for (let ri = 0; ri < G.length; ri++)
        for (const lv of [3, 7, 10, 11, 15, 20]) {
          P.bag = [];
          const g = gear(G[gi], lv);
          const r = gear(G[ri], 0);
          const p = transferPlan(g, r);
          if (G[ri] === 'a' && G[gi] !== 'a') {
            expect(p.ok).toBe(false);
            expect(p.why).toBe('유물 강화는 유물끼리만 옮길 수 있어요');
            continue;
          }
          if (ri < gi) {
            expect(p.ok).toBe(false);
            expect(p.why).toMatch('등급');
            continue;
          }
          const gap = ri - gi;
          expect(p.to).toBe(lv - (gap === 0 ? 0 : gap === 1 ? 1 : 2) - (lv >= 11 ? 1 : 0));
          expect(p.ok).toBe(true);
        }
  });
});

describe('비용 표', () => {
  it('CONFIG.growth.transfer.cost = +0에서 직접 올릴 때 기댓값 × 35% (가루 10 · 금화 1,000 단위)', () => {
    for (let L = 1; L <= 20; L++) {
      const r = transferRow(L, TF.share);
      expect([L, TF.cost.dust[L - 1], TF.cost.gold[L - 1]]).toEqual([L, r.dust, r.gold]);
    }
  });
  it('단계가 오를수록 비싸짐 · +10까지 금화 0 · +11부터 금화 + 부적 1', () => {
    for (let L = 2; L <= 20; L++) expect(TF.cost.dust[L - 1]).toBeGreaterThan(TF.cost.dust[L - 2]);
    for (let L = 1; L <= 10; L++) expect(transferCost(L)).toMatchObject({ gold: 0, charm: 0 });
    for (let L = 11; L <= 20; L++) expect(transferCost(L).gold).toBeGreaterThan(0);
    expect(transferCost(11).charm).toBe(1);
    expect(transferCost(10).charm).toBe(0);
  });
});

describe('잠김 (이유 보임)', () => {
  it('받는 장비가 이미 같거나 높음', () => {
    const g = gear('n', 8);
    const r = gear('r', 7);
    const p = transferPlan(g, r);
    expect(p.ok).toBe(false);
    expect(p.rule).toBe(true);
    expect(p.why).toBe('받는 장비가 이미 +7예요 (전수하면 +7)');
    r.enh = 6;
    expect(transferPlan(g, r).ok).toBe(true);
  });
  it('다른 부위', () => {
    const p = transferPlan(gear('n', 8, 'weapon'), gear('r', 0, 'armor'));
    expect(p.ok).toBe(false);
    expect(p.why).toMatch('같은 부위');
  });
  it('낮은 등급', () => {
    const p = transferPlan(gear('e', 8), gear('r', 0));
    expect(p.ok).toBe(false);
    expect(p.why).toBe('받는 장비 등급이 주는 장비보다 낮아요');
  });
  it('같은 장비', () => {
    const it = gear('e', 8);
    const p = transferPlan(it, it);
    expect(p.ok).toBe(false);
    expect(p.why).toMatch('같은 장비');
    expect(giverCands(it)).not.toContain(it);
    expect(recvCands(it)).not.toContain(it);
  });
  it('+3 미만은 줄 수 없음 · 잠긴 장비도', () => {
    const g = gear('n', 2);
    expect(transferPlan(g, gear('n', 0)).why).toMatch('+3 이상');
    g.enh = 5;
    g.locked = true;
    expect(transferPlan(g, gear('n', 0)).why).toMatch('잠긴');
  });
  it('주는 사람이 원정 중 → 막힘', () => {
    const a = mk('아리');
    const g = gear('r', 9, 'weapon', a);
    const r = gear('e', 0);
    expect(transferPlan(g, r).ok).toBe(true);
    a.runId = 7;
    const p = transferPlan(g, r);
    expect(p.ok).toBe(false);
    expect(p.why).toBe('아리님이 원정 중이라 주는 장비를 뺄 수 없어요');
    expect(transferEnh(g, r)).toBe(p.why);
    expect(P.bag).toContain(g);
  });
  it('받는 사람이 원정 중 → 막힘', () => {
    const b = mk('보라');
    const g = gear('r', 9);
    const r = gear('e', 0, 'weapon', b);
    b.runId = 3;
    const p = transferPlan(g, r);
    expect(p.ok).toBe(false);
    expect(p.why).toBe('보라님이 원정 중이라 받는 장비를 손댈 수 없어요');
  });
  it('비용 모자람은 rule=false (규칙은 맞음)', () => {
    const g = gear('n', 9);
    const r = gear('n', 0);
    P.dust.n = 0;
    const p = transferPlan(g, r);
    expect(p.ok).toBe(false);
    expect(p.rule).toBe(false);
    expect(p.why).toMatch('가루');
  });
  it('후보: 같은 부위 · +3 이상 · 등급 같거나 낮은 것만 받기 후보', () => {
    const r = gear('e', 0);
    const ok1 = gear('n', 3);
    const ok2 = gear('e', 9);
    gear('n', 2); // +3 미만
    gear('l', 9); // 등급 높음
    gear('n', 9, 'armor'); // 다른 부위
    expect(giverCands(r).map((x) => x.id).sort()).toEqual([ok1.id, ok2.id].sort());
  });
});

describe('유물 규칙 (웅스 추가)', () => {
  it('유물 받는 장비 + 유물 아닌 주는 장비 → 막힘 (이유 글)', () => {
    for (const g of ['n', 'r', 'e', 'l'] as Grade[]) {
      P.bag = [];
      const p = transferPlan(gear(g, 12), gear('a', 0));
      expect(p.ok).toBe(false);
      expect(p.rule).toBe(true);
      expect(p.why).toBe('유물 강화는 유물끼리만 옮길 수 있어요');
      expect(transferEnh(P.bag[0], P.bag[1])).toBe('유물 강화는 유물끼리만 옮길 수 있어요');
      expect(P.bag.length).toBe(2);
    }
  });
  it('유물 → 유물: 같은 등급 규칙 (그대로 · +11 이상은 −1)', () => {
    for (const lv of [3, 8, 10, 11, 15, 20]) {
      P.bag = [];
      const g = gear('a', lv);
      const r = gear('a', 0);
      const p = transferPlan(g, r);
      expect(p.ok).toBe(true);
      expect(p.to).toBe(lv >= 11 ? lv - 1 : lv);
    }
    P.bag = [];
    const g = gear('a', 15);
    const r = gear('a', 2);
    transferEnh(g, r);
    expect(r.enh).toBe(14);
  });
  it('유물 아닌 받는 장비는 그대로 (전설 ← 일반 −2 · 전설 ← 전설 그대로)', () => {
    expect(transferPlan(gear('n', 9), gear('l', 0))).toMatchObject({ ok: true, to: 7 });
    expect(transferPlan(gear('e', 12), gear('l', 0))).toMatchObject({ ok: true, to: 10 });
    expect(transferPlan(gear('l', 12), gear('l', 0))).toMatchObject({ ok: true, to: 11 });
  });
});

describe('실행', () => {
  it('강화 단계만 옮김 (옵션·고유·세트는 받는 장비 것) · 비용 정확히 · 분해 가루 받음', () => {
    const g = gear('r', 9);
    const r = gear('e', 2);
    const opts = JSON.stringify(r.opts);
    const set = r.set;
    const gold = S.gold;
    const dustE = P.dust.e;
    const dustR = P.dust.r;
    const ash = P.dust.n;
    const back = giverDust(g);
    const res = transferEnh(g, r);
    expect(typeof res).toBe('object');
    expect(r.enh).toBe(8);
    expect(JSON.stringify(r.opts)).toBe(opts);
    expect(r.set).toBe(set);
    expect(P.bag).not.toContain(g);
    expect(S.gold).toBe(gold - TF.cost.gold[7]);
    expect(P.dust.e).toBe(dustE - TF.cost.dust[7]);
    expect(P.dust.r).toBe(dustR + SM.salvage.r);
    expect(P.dust.n).toBe(ash + SM.salvageAsh.r);
    expect(back).toEqual({ dust: SM.salvage.r, ash: SM.salvageAsh.r });
  });
  it('주는 장비를 낀 사람 → 받는 장비를 그 칸에 끼워 줌', () => {
    const a = mk('아리');
    const g = gear('n', 10, 'acc', a);
    const r = gear('r', 0, 'acc');
    const res = transferEnh(g, r);
    expect(typeof res).toBe('object');
    expect(a.equip.acc).toBe(r.id);
    expect(r.owner).toBe(a.id);
    expect((res as { wearer?: Actor }).wearer).toBe(a);
  });
  it('주는 장비가 가방에 있으면 받는 장비 착용은 그대로', () => {
    const b = mk('보라');
    const g = gear('n', 6);
    const r = gear('n', 0, 'weapon', b);
    transferEnh(g, r);
    expect(r.enh).toBe(6);
    expect(b.equip.weapon).toBe(r.id);
  });
  it('+11 이상 결과: 부적 1개 필요 · 쓰임 · 천장 초기화 · 「초월한」 이름', () => {
    const g = gear('e', 17);
    const r = gear('e', 0);
    r.ePity = 0.06;
    P.growth.charm = 0;
    const p = transferPlan(g, r);
    expect(p.to).toBe(16);
    expect(p.ok).toBe(false);
    expect(p.why).toMatch('부적');
    P.growth.charm = 2;
    const gold = S.gold;
    transferEnh(g, r);
    expect(r.enh).toBe(16);
    expect(P.growth.charm).toBe(1);
    expect(S.gold).toBe(gold - TF.cost.gold[15]);
    expect(r.ePity).toBeUndefined();
    expect(r.name.startsWith('초월한 ')).toBe(true);
  });
  it('+10 이하 결과엔 부적 안 씀', () => {
    const g = gear('n', 10);
    const r = gear('n', 0);
    transferEnh(g, r);
    expect(r.enh).toBe(10);
    expect(P.growth.charm).toBe(5);
  });
  it('고유 장비 중복(두 번째부터)은 분해 가루 배수도 그대로', () => {
    const g = gear('l', 5);
    g.uid = 'u_test';
    P.growth.uniques.u_test = 2;
    const r = gear('l', 0);
    const d = P.dust.l;
    transferEnh(g, r);
    expect(P.dust.l).toBe(d - TF.cost.dust[4] + SM.salvage.l * CONFIG.growth.unique.dupDustMult);
  });
});
