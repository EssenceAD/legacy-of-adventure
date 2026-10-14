// PACE R17 판정 「지금 고칠 것」: 긴 대기를 줄이는 대안·천장·시계 (플래그 paceGates · 숫자는 CONFIG.paceGates)
//  카운터는 P.pg (옛 저장엔 없음 → pg()가 빈 칸을 채운다)
import { CONFIG } from '../data/config';
import { flag } from './flags';
import { today } from './progress';
import { freshPaceGates, legendHooks, markDirty, P } from './state';
import { ITEM_DEX_TOTAL, baseDexItems } from './progress';

const G = CONFIG.paceGates;
export const gatesOn = () => flag('paceGates');

/** 카운터 (빈 칸은 기본값) */
export function pg(): ReturnType<typeof freshPaceGates> {
  const f = freshPaceGates();
  const cur = (P as { pg?: Partial<ReturnType<typeof freshPaceGates>> }).pg;
  if (!cur || typeof cur !== 'object') return ((P as { pg?: unknown }).pg = f);
  for (const k of Object.keys(f) as (keyof typeof f)[]) if (cur[k] == null || typeof cur[k] !== typeof f[k]) (cur as Record<string, unknown>)[k] = f[k];
  return cur as ReturnType<typeof freshPaceGates>;
}

// ───────── 현실 하루 기분 (은퇴 95↑ · 아리아 90↑) ─────────

/** 게임 1시간마다 손님 평균 기분 (world/daily.ts) — 그 현실 날에 한 번이라도 넘으면 1일 */
export function moodSample(avg: number) {
  if (!gatesOn()) return;
  const g = pg();
  const d = today();
  if (avg >= CONFIG.story.goodMood && g.goodDay !== d) {
    g.goodDay = d;
    g.goodReal++;
    markDirty();
  }
  if (avg >= G.ariaMood && g.topDay !== d) {
    g.topDay = d;
    g.topReal++;
    markDirty();
  }
}
/** 은퇴 「기분 최고인 날」: 게임 날 수와 현실 날 수 중 큰 쪽 */
export const goodDaysNow = () => (gatesOn() ? Math.max(P.story.goodDays, pg().goodReal) : P.story.goodDays);
/** 아리아 「기분 최고 누적」: 게임 날 수와 현실 날 수 중 큰 쪽 · 조건 일수 */
export const moodTopNow = () => (gatesOn() ? Math.max(P.counters.moodTopDays, pg().topReal) : P.counters.moodTopDays);
export const ariaMoodNeed = () => (gatesOn() ? G.ariaMoodDays : 30);

// ───────── 원정: 증표 천장 · 바엘 2시간 · 떠돌이 천장 ─────────

/** 원정 한 판 (증표가 확률로 나왔나) → 천장이면 true (증표 1 확정) */
export function tokenPity(gotByChance: boolean): boolean {
  if (!gatesOn()) return false;
  const g = pg();
  if (gotByChance) {
    g.tokenRuns = 0;
    return false;
  }
  g.tokenRuns++;
  if (g.tokenRuns < G.tokenPityRuns) return false;
  g.tokenRuns = 0;
  return true;
}
/** 바엘이 머무는 동안 2시간~8시간 미만 의뢰 성공 n번 = 8시간 1번 (부탁 「8시간 의뢰 성공」) */
export function baelShortWin(tier: number) {
  if (!gatesOn() || P.legends.vael?.st !== 'visit') return;
  if (tier < G.baelShortTier || tier >= G.baelLongTier) return;
  const g = pg();
  g.bael2h++;
  if (g.bael2h >= G.baelShortNeed) {
    g.bael2h -= G.baelShortNeed;
    legendHooks.req('longRunWin');
  }
  markDirty();
}
export const baelNeedsLong = () => gatesOn() && P.legends.vael?.st === 'visit';
/** 떠돌이 천장: 같은 지역 원정 승리 n번째 → 확정 (떠돌이를 만나면 그 지역 0부터) */
export function wanderPity(region: string): boolean {
  if (!gatesOn()) return false;
  const g = pg();
  g.wanderWins[region] = (g.wanderWins[region] ?? 0) + 1;
  return g.wanderWins[region] >= G.wanderPityWins;
}
export function wanderMet(region: string) {
  if (gatesOn()) pg().wanderWins[region] = 0;
}

// ───────── 미미: 도감이 거의 다 찼으면 강화·고유 장비도 「새 칸」 ─────────

export const dexNearlyFull = () => ITEM_DEX_TOTAL - baseDexItems() <= G.mimiDexLeft;
/** 강화 성공(+n 이상) · 고유 장비 얻음 → 미미 인연·부탁 (도감 남은 칸이 적을 때만) */
export function mimiAlt(kind: 'enhance' | 'unique', enh = 0) {
  if (!gatesOn() || !P.legends.momo2 || P.legends.momo2.st === 'joined') return;
  if (!dexNearlyFull()) return;
  if (kind === 'enhance' && enh < G.mimiEnhance) return;
  legendHooks.bond('itemDexNew');
  legendHooks.req('itemDexNew');
}

// ───────── 전설 판정 천장 ─────────

/** 판정 밤: 게이지 n% 이상인데 m밤 연속 실패한 전설 (있으면 그 전설 확정) */
export function judgePityPick(keys: string[]): string | null {
  if (!gatesOn()) return null;
  const g = pg();
  return keys.find((k) => (P.legends[k]?.gauge ?? 0) >= G.judgePityGauge && (g.judgeFail[k] ?? 0) >= G.judgePityNights) ?? null;
}
/** 판정 뒤: 뽑힌 전설은 0 · 게이지 n% 이상인 나머지는 실패 +1 */
export function judgeAfter(keys: string[], picked: string | null) {
  if (!gatesOn()) return;
  const g = pg();
  for (const k of keys) {
    if (k === picked) g.judgeFail[k] = 0;
    else if ((P.legends[k]?.gauge ?? 0) >= G.judgePityGauge) g.judgeFail[k] = (g.judgeFail[k] ?? 0) + 1;
  }
  markDirty();
}

// ───────── 사냥 고유 장비 천장 ─────────

/** 같은 지역 x-10 처치 n번째 → 확정 (고유 장비가 나오면 그 지역 0부터) · 확률을 돌려준다 */
export function huntUniqueChance(region: string, chance: number): number {
  if (!gatesOn()) return chance;
  const g = pg();
  g.huntBoss[region] = (g.huntBoss[region] ?? 0) + 1;
  return g.huntBoss[region] >= G.huntUniquePity ? 1 : chance;
}
export function huntUniqueGot(region: string) {
  if (gatesOn()) pg().huntBoss[region] = 0;
}

// ───────── 평가단 최고 점수 (장부 c4·c6) ─────────

/** 지금 점수를 기억해 두고, 지금까지 최고 점수를 돌려준다 (시즌 기록 포함) */
export function evalBestScore(now: number): number {
  if (!gatesOn()) return now;
  const g = pg();
  if (now > g.evalBest) g.evalBest = now;
  const hist = P.evaluation.history.reduce((m, h) => Math.max(m, h.score || 0), 0);
  return Math.max(now, g.evalBest, hist);
}

// ───────── 진: 순위 확인 못 한 주 ─────────

/** 주가 바뀔 때 (world/raid.ts ensureWeek): 기록을 낸 지난주를 확인 목록에 */
export function queueRankWeek(week: string) {
  if (!gatesOn() || !week) return;
  const l = pg().rankPending;
  if (!l.includes(week)) l.push(week);
  while (l.length > 6) l.shift();
}
