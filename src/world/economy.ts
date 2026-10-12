// ECONOMY_SPEC §1: 금화 출처 하루 집계 → 날이 바뀌면 gold_gain 한 번 (사냥·의뢰·숙박·주점… 비율을 보고 다시 맞춘다)
import { track } from '../net/telemetry';
import { markDirty, P } from './state';
import { today } from './progress';

export function flushGoldLog() {
  const G = (P.goldLog ??= { day: '', by: {} });
  const d = today();
  if (G.day === d) return;
  const total = Object.values(G.by).reduce((s, v) => s + v, 0);
  if (G.day && total > 0) track('gold_gain', { day: G.day, total, ...G.by });
  P.goldLog = { day: d, by: {} };
  markDirty();
}
