// GROWTH §3-2·§7: 강화 확률 시뮬레이션 10만 회 (천장 · 하락 · 대성공 포함 · 부적 있음/없음) — 옛 규칙 vs 새 규칙
//  단계별: +(n−1)에서 시작해 +n에 닿을 때까지 평균 시도 수 · 가루(그 등급) · 초월은 금화 — 하락하면 다시 올라오는 비용까지
//  보너스(주인 손재주·탑·세트)는 0, 초월은 대장간 Lv5(+5%p) 기준. 표는 콘솔에 찍힌다 (SIM=1 이면 10만 회, 아니면 2만 회로 빠르게)
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { rollEnhance, rollTranscend } from '../src/world/enhRules';

const RUNS = process.env.SIM ? 100_000 : 20_000;
const SM = CONFIG.smith;
const dustOf = (enh: number) => (enh + 1) * (enh + 1) * SM.enhanceCost;
const trGold = (enh: number) => SM.transcend.gold * 2 ** (enh - 10);
const trDust = (enh: number) => SM.transcend.dust * (enh - 9);
// 옛 규칙 (v0.20 이전)
const OLD_RATES = [0.7, 0.55, 0.4, 0.3, 0.2];
const oldEnh = (enh: number, rng: () => number) => rng() < (enh < 5 ? 1 : OLD_RATES[enh - 5]);
const SMITH5 = 0.05;
const oldTr = (enh: number, pity: number, rng: () => number) => rng() < Math.max(0.05, Math.min(1, 0.6 - 0.04 * (enh - 10) + SMITH5 + pity));

// 시드 난수 (재현 가능)
function rng(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Stat { tries: number; dust: number; gold: number; charms: number; drops: number }
/** from → to 까지 (to에 닿거나 넘으면 끝) */
function climb(from: number, to: number, mode: 'old' | 'new' | 'charm', r: () => number): Stat {
  const s: Stat = { tries: 0, dust: 0, gold: 0, charms: 0, drops: 0 };
  let enh = from;
  let pity = 0;
  let tp = 0;
  let guard = 0;
  while (enh < to && guard++ < 100000) {
    s.tries++;
    if (enh < SM.maxEnhance) {
      s.dust += dustOf(enh);
      if (mode === 'old') {
        if (oldEnh(enh, r)) enh++;
      } else {
        const x = rollEnhance(enh, pity, 0, { charm: mode === 'charm' }, r);
        if (x.saved) s.charms++;
        if (x.drop) s.drops++;
        enh = x.enh;
        pity = x.pity;
      }
    } else {
      s.dust += trDust(enh);
      s.gold += trGold(enh);
      if (mode === 'old') {
        if (oldTr(enh, tp, r)) {
          enh++;
          tp = 0;
        } else tp += SM.transcend.pity;
      } else {
        const x = rollTranscend(enh, tp, SMITH5, {}, r);
        enh = x.enh;
        tp = x.pity;
      }
    }
  }
  return s;
}
function avg(from: number, to: number, mode: 'old' | 'new' | 'charm', seed: number): Stat {
  const r = rng(seed);
  const t: Stat = { tries: 0, dust: 0, gold: 0, charms: 0, drops: 0 };
  for (let i = 0; i < RUNS; i++) {
    const s = climb(from, to, mode, r);
    t.tries += s.tries;
    t.dust += s.dust;
    t.gold += s.gold;
    t.charms += s.charms;
    t.drops += s.drops;
  }
  return { tries: t.tries / RUNS, dust: t.dust / RUNS, gold: t.gold / RUNS, charms: t.charms / RUNS, drops: t.drops / RUNS };
}
const f1 = (v: number) => v.toFixed(2);
const f0 = (v: number) => Math.round(v).toLocaleString('en-US');

describe(`강화 시뮬레이션 (${RUNS.toLocaleString()}회)`, () => {
  it('단계별 · 누적 표 (옛 vs 새 · 부적 없음/있음)', () => {
    const rows: string[] = ['| 목표 | 옛 시도 | 새 시도 | 새+부적 시도 | 옛 가루 | 새 가루 | 새+부적 가루 | 부적 사용 | 하락 횟수 |', '|---|---|---|---|---|---|---|---|---|'];
    for (let n = 1; n <= 10; n++) {
      const o = avg(n - 1, n, 'old', n);
      const w = avg(n - 1, n, 'new', 100 + n);
      const c = avg(n - 1, n, 'charm', 200 + n);
      rows.push(`| +${n} | ${f1(o.tries)} | ${f1(w.tries)} | ${f1(c.tries)} | ${f0(o.dust)} | ${f0(w.dust)} | ${f0(c.dust)} | ${f1(c.charms)} | ${f1(w.drops)} |`);
      // 옛 규칙 +1~+5 확정 · 새 규칙은 +1만 확정
      if (n <= 5) expect(o.tries).toBe(1);
      if (n === 1) expect(w.tries).toBe(1);
      // 부적이 있으면 더 싸거나 같다
      expect(c.dust).toBeLessThanOrEqual(w.dust * 1.03);
    }
    const o10 = avg(0, 10, 'old', 7);
    const w10 = avg(0, 10, 'new', 8);
    const c10 = avg(0, 10, 'charm', 9);
    rows.push(`| **+0→+10 누적** | ${f1(o10.tries)} | ${f1(w10.tries)} | ${f1(c10.tries)} | ${f0(o10.dust)} | ${f0(w10.dust)} | ${f0(c10.dust)} | ${f1(c10.charms)} | ${f1(w10.drops)} |`);
    const tr: string[] = ['| 목표 | 옛 시도 | 새 시도 | 옛 금화 | 새 금화 | 옛 가루 | 새 가루 |', '|---|---|---|---|---|---|---|'];
    for (let n = 11; n <= 20; n++) {
      const o = avg(n - 1, n, 'old', 300 + n);
      const w = avg(n - 1, n, 'new', 400 + n);
      tr.push(`| +${n} | ${f1(o.tries)} | ${f1(w.tries)} | ${f0(o.gold)} | ${f0(w.gold)} | ${f0(o.dust)} | ${f0(w.dust)} |`);
      expect(w.tries).toBeGreaterThanOrEqual(o.tries * 0.95);
    }
    const o20 = avg(10, 20, 'old', 11);
    const w20 = avg(10, 20, 'new', 12);
    tr.push(`| **+10→+20 누적** | ${f1(o20.tries)} | ${f1(w20.tries)} | ${f0(o20.gold)} | ${f0(w20.gold)} | ${f0(o20.dust)} | ${f0(w20.dust)} |`);
    console.log(`\n강화 +1~+10 (가루 = 그 장비 등급 가루 · ${RUNS.toLocaleString()}회)\n${rows.join('\n')}\n\n초월 +11~+20 (대장간 Lv5 · ${RUNS.toLocaleString()}회)\n${tr.join('\n')}\n`);
    // 끝은 보이게: 새 규칙 +0→+10 평균 시도가 무한히 길지 않다 (천장)
    expect(w10.tries).toBeLessThan(200);
    expect(w10.tries).toBeGreaterThan(o10.tries);
  }, 120_000);
});
