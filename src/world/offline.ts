// 방치: 꺼져 있던 동안(최대 8시간) 손님 수입 · 끝난 원정 · 자란 텃밭을 모아 "그동안 마을에서는…"
import { CONFIG } from '../data/config';
import type { BondGain } from './chem';
import { ripeCount } from './craft';
import { dueRuns, resolveRun } from './expeditions';
import { P, world, type Run } from './state';

const O = CONFIG.offline;

export interface OfflineSummary {
  /** 계산에 쓴 시간 (현실 초, 8시간까지) */
  seconds: number;
  /** 실제로 꺼져 있던 시간 (현실 초) */
  away: number;
  guests: number;
  gold: number;
  runs: Run[];
  ripe: number;
  bonds: BondGain[];
}

/** 불러온 직후 한 번: 꺼져 있던 동안 일어난 일을 정한다 (금화는 「모두 받기」 때 들어온다) */
export function computeOffline(now = Date.now()): OfflineSummary | null {
  const away = Math.max(0, (now - P.lastSeen) / 1000);
  const seconds = Math.min(away, O.maxRealHours * 3600);
  const bonds: BondGain[] = [];
  const runs = dueRuns(now);
  for (const r of runs) resolveRun(r, bonds);
  const guests = (world.home?.actors ?? world.actors).filter((a) => !a.role && a.runId == null).length;
  // 현실 1분 = 게임 1시간
  const gameHours = seconds / CONFIG.clock.realSecondsPerGameHour;
  const gold = Math.round(guests * gameHours * O.goldPerGuestPerGameHour * O.rate);
  // 쉬는 동안 체력·배고픔 조금 회복 (방에서 쉬었다)
  for (const a of world.actors) {
    if (a.role || a.runId != null) continue;
    a.hp = Math.min(100, a.hp + gameHours * 4);
    a.food = Math.max(40, Math.min(100, a.food));
  }
  P.lastSeen = now;
  if (away < O.minSecondsForSummary && !runs.length) return null;
  return { seconds, away, guests, gold, runs, ripe: ripeCount(), bonds };
}
