// WAYFIND §2: 막힘 도우미 — 같은 첫 돌파 판을 3번 연속 지면 「결의」(지면 +1 · 최대 5). 이기면 그 판 결의 초기화
//  결의 1 = 아군 피해 +4% · 받는 피해 −2% (그 판에서만) · 이미 첫 돌파한 판에는 쌓이지 않는다
import { flag } from './flags';
import { freshWayfind, markDirty, P, type WayfindState } from './state';

export const RESOLVE = { after: 3, max: 5, dmg: 0.04, cut: 0.02 } as const;

/** 칸 바로잡기 (옛 저장엔 wf가 없다) */
export function wfState(): WayfindState {
  const base = freshWayfind();
  const w = ((P as { wf?: WayfindState }).wf ??= base) as WayfindState;
  for (const k of Object.keys(base) as (keyof WayfindState)[]) {
    const v = w[k] as unknown;
    const b = base[k] as unknown;
    if (v === undefined || v === null || Array.isArray(v) !== Array.isArray(b) || typeof v !== typeof b) (w as Record<string, unknown>)[k] = b;
  }
  return w;
}

const keyOf = (r: string, s: number) => `${r}-${s}`;
/** 아직 첫 돌파 못 한 판인가 */
export const unclearedStage = (r: string, s: number) => !P.hunt.firstClear.includes(keyOf(r, s));
/** 그 판 연속 패배 수 */
export const losesAt = (r: string, s: number) => wfState().lose[keyOf(r, s)] ?? 0;
/** 지금 결의 (꺼져 있거나 첫 돌파한 판이면 0) */
export function resolveOf(r: string, s: number): number {
  if (!flag('huntResolve') || !unclearedStage(r, s)) return 0;
  return Math.min(RESOLVE.max, Math.max(0, losesAt(r, s) - (RESOLVE.after - 1)));
}
/** 결의만큼: 아군 피해 배율 · 받는 피해 배율 */
export const resolveDmg = (n: number) => 1 + RESOLVE.dmg * n;
export const resolveTaken = (n: number) => 1 - RESOLVE.cut * n;

/** 사냥 한 판 결과 (clearStage 전에 부른다) → 이 판 뒤 결의 */
export function noteHuntResult(r: string, s: number, win: boolean): number {
  const w = wfState();
  const k = keyOf(r, s);
  if (win) delete w.lose[k];
  else if (unclearedStage(r, s)) w.lose[k] = Math.min(99, (w.lose[k] ?? 0) + 1);
  markDirty();
  return win ? 0 : resolveOf(r, s);
}

/** 결의 한 줄 (준비 창 · 결과) */
export const resolveText = (n: number) => `결의 ${n} · 주는 피해 +${Math.round(RESOLVE.dmg * n * 100)}% · 받는 피해 −${Math.round(RESOLVE.cut * n * 100)}%`;

/** 지금 막혀 있는 판 (결의가 쌓인 첫 돌파 못 한 판 중 결의가 가장 큰 것) */
export function stuckStage(): { r: string; s: number; n: number } | null {
  let best: { r: string; s: number; n: number } | null = null;
  for (const k of Object.keys(wfState().lose)) {
    const i = k.lastIndexOf('-');
    const r = k.slice(0, i);
    const s = +k.slice(i + 1);
    const n = resolveOf(r, s);
    if (n > 0 && (!best || n > best.n)) best = { r, s, n };
  }
  return best;
}
