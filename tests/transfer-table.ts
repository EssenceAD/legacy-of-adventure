// 웅스 건의 「강화 전수」 (플래그 enhTransfer) — 비용 표 만들기 (오프라인 · 게임은 이 계산을 안 한다)
//  +0 에서 +L 까지 「그 장비 하나를 직접 올릴 때」 드는 금화·가루의 기댓값을 정확히(가치 반복) 구한다.
//   · 강화(+1~+10): 시도마다 가루 (현재+1)²×smith.enhanceCost · 목표별 성공률(growth.enhance.rates) + 천장(실패마다 +pity, 성공하면 0)
//       목표 +greatMax 이하 성공의 great 확률로 +2 · 목표 +dropFrom 이상 실패의 dropChance 확률로 1단계 하락(부적 안 씀) · 보너스 0
//   · 초월(+11~+20): 시도마다 금화 transcend.gold×2^(목표−11) · 가루 transcend.dust×(목표−10) · 성공률 growth.transcend.rates
//       + 대장간 Lv.smithLv(초월이 열리는 최저 레벨) 보너스 perSmithLv×smithLv + 천장(실패마다 +pity) · 최소 5% · 실패해도 단계 유지
//   · 지역 재료·보스 재료·숫돌은 셈에 넣지 않는다 (전수 비용은 금화 + 가루만)
//  전수 비용 = 위 기댓값 × share(0.35) → 가루는 10 단위, 금화는 1,000 단위로 반올림 → CONFIG.growth.transfer.cost
//  PRINT=1 npx vitest run tests/transfer.test.ts 로 표를 다시 찍는다.
import { CONFIG } from '../src/data/config';

export interface BuildCost {
  dust: number;
  gold: number;
}

/** +0 → +L(1~20) 기댓값 (반올림 전) */
export function expectedBuild(L: number): BuildCost {
  const GE = CONFIG.growth.enhance;
  const GT = CONFIG.growth.transcend;
  const SM = CONFIG.smith;
  const TR = SM.transcend;
  const top = Math.min(L, SM.maxEnhance);
  let dust = 0;
  let gold = 0;
  // 강화 구간: 상태 (단계 e, 천장 k번) → +top 이상에 닿을 때까지 가루 기댓값
  if (top > 0) {
    const kMax = Math.ceil(1 / GE.pity) + 2;
    const rate = (e: number, k: number) => {
      const b = GE.rates[Math.min(GE.rates.length - 1, e)];
      return b >= 1 ? 1 : Math.min(1, b + k * GE.pity);
    };
    const V: number[][] = Array.from({ length: top + 2 }, () => new Array(kMax + 1).fill(0));
    const val = (e: number, k: number) => (e >= top ? 0 : V[e][Math.min(k, kMax)]);
    for (let it = 0; it < 200000; it++) {
      let delta = 0;
      for (let e = top - 1; e >= 0; e--)
        for (let k = 0; k <= kMax; k++) {
          const r = rate(e, k);
          const target = e + 1;
          const g = target <= GE.greatMax ? GE.great : 0;
          const up = (1 - g) * val(e + 1, 0) + g * val(Math.min(SM.maxEnhance, e + 2), 0);
          const nk = r >= 1 ? k : k + 1;
          const fail = target >= GE.dropFrom ? GE.dropChance * val(e - 1, nk) + (1 - GE.dropChance) * val(e, nk) : val(e, nk);
          const v = (e + 1) * (e + 1) * SM.enhanceCost + r * up + (1 - r) * fail;
          delta = Math.max(delta, Math.abs(v - V[e][k]));
          V[e][k] = v;
        }
      if (delta < 1e-9) break;
    }
    dust += V[0][0];
  }
  // 초월 구간: +10 → +L (단계 유지 · 천장) — 단계마다 따로 (성공하면 천장 0)
  const bonus = TR.perSmithLv * TR.smithLv;
  for (let e = SM.maxEnhance; e < L; e++) {
    const target = e + 1;
    const k = target - 10;
    const b = GT.rates[Math.min(GT.rates.length - 1, e - 10)];
    // 시도 n번째 성공률 = max(0.05, min(1, b + bonus + (n−1)×pity)) → 기대 시도 수
    let alive = 1;
    let tries = 0;
    for (let n = 0; n < 1000 && alive > 1e-12; n++) {
      tries += alive;
      const r = Math.max(0.05, Math.min(1, b + bonus + n * GT.pity));
      alive *= 1 - r;
    }
    gold += tries * TR.gold * 2 ** (target - 11);
    dust += tries * TR.dust * k;
  }
  return { dust, gold };
}

/** 표 한 줄 (반올림 규칙 그대로) */
export function transferRow(L: number, share = 0.35): BuildCost {
  const e = expectedBuild(L);
  return { dust: Math.round((e.dust * share) / 10) * 10, gold: Math.round((e.gold * share) / 1000) * 1000 };
}
