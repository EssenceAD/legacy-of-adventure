// 방치: 꺼져 있던 동안(최대 8시간) 손님 수입 · 끝난 원정 · 자란 텃밭을 모아 "그동안 마을에서는…"
import { def } from '../data/catalog';
import { CONFIG } from '../data/config';
import type { Grade } from '../data/items';
import type { BondGain } from './chem';
import { harvest, plotLeft, plotsOf } from './craft';
import { dueRuns, resolveRun } from './expeditions';
import { P, S, world, type Run } from './state';
import { nextLevelCost } from './town';
import { idleHunt, type IdleHunt } from './hunt';

const O = CONFIG.offline;

export interface OfflineSummary {
  /** 계산에 쓴 시간 (현실 초, 8시간까지) */
  seconds: number;
  /** 실제로 꺼져 있던 시간 (현실 초) */
  away: number;
  guests: number;
  gold: number;
  /** 이번 방치 상한 (다음 땅·건물 비용 × 비율) — 걸렸으면 표시 */
  capped: boolean;
  runs: Run[];
  /** 얻은 장비: 등급별 개수 */
  items: Partial<Record<Grade, number>>;
  levelUps: string[];
  newChem: string[];
  /** 텃밭에서 저절로 거둔 채소 */
  harvested: number;
  bonds: BondGain[];
  /** 5단계: 방치 사냥 (가장 높은 스테이지 기준) */
  hunt: IdleHunt | null;
}

/** 지금 마을의 "다음 큰 지출": 다음 땅 넓히기, 땅이 끝이면 남은 레벨업 중 가장 비싼 것 */
export function nextGoalCost(): number | null {
  const land = world.home?.land ?? S.land;
  if (land < CONFIG.land.length) return CONFIG.land[land].cost;
  const objs = world.home?.objs ?? world.objs;
  const ups = objs.map((o) => (def(o.kind).levels || def(o.kind).up ? nextLevelCost(o) : null)).filter((c): c is number => c != null);
  return ups.length ? Math.max(...ups) : null;
}

/** 방치 금화: 처음 fullHours는 그대로, 그 뒤는 tailRate만큼만 → 다음 큰 지출의 capShare를 넘지 않는다 */
export function offlineGold(guests: number, realSeconds: number) {
  const hours = realSeconds / 3600;
  const eff = Math.min(hours, O.fullHours) + Math.max(0, hours - O.fullHours) * O.tailRate;
  // 현실 1분 = 게임 1시간
  const raw = Math.round(guests * eff * 60 * O.goldPerGuestPerGameHour * O.rate);
  const next = nextGoalCost();
  const cap = next == null ? Infinity : Math.round(next * O.capShare);
  return { gold: Math.min(raw, cap), capped: raw > cap };
}

/** 불러온 직후 한 번: 꺼져 있던 동안 일어난 일을 정한다 (금화는 「모두 받기」 때 들어온다) */
export function computeOffline(now = Date.now()): OfflineSummary | null {
  const away = Math.max(0, (now - P.lastSeen) / 1000);
  const seconds = Math.min(away, O.maxRealHours * 3600);
  const bonds: BondGain[] = [];
  const runs = dueRuns(now);
  const items: Partial<Record<Grade, number>> = {};
  const levelUps: string[] = [];
  const newChem: string[] = [];
  for (const r of runs) {
    const res = resolveRun(r, bonds);
    for (const it of res.items) items[it.grade] = (items[it.grade] ?? 0) + 1;
    levelUps.push(...res.levelUps);
    newChem.push(...res.newChem);
  }
  // 묵는 손님만 센다 (지나가는 손님·원정 중 제외)
  const guests = (world.home?.actors ?? world.actors).filter((a) => !a.role && a.runId == null && a.status !== 'passer').length;
  const { gold, capped } = offlineGold(guests, seconds);
  const gameHours = seconds / CONFIG.clock.realSecondsPerGameHour;
  // 쉬는 동안 체력 회복 (방에서 쉬었다)
  for (const a of world.actors) {
    if (a.role || a.runId != null) continue;
    a.hp = Math.min(100, a.hp + gameHours * 4);
    a.food = Math.max(40, Math.min(100, a.food));
  }
  // 텃밭: 다 자란 작물은 저절로 거둬 둔다
  let harvested = 0;
  for (const o of world.home?.objs ?? world.objs)
    if (o.kind === 'garden') plotsOf(o).forEach((p, i) => plotLeft(p, now) === 0 && (harvested += harvest(o, i)));
  // 방치 사냥: 손님 금화와 합쳐 방치 상한(capShare)을 넘지 않게 (원정과 합산)
  const next = nextGoalCost();
  const cap = next == null ? Infinity : Math.round(next * O.capShare);
  const hunt = seconds >= CONFIG.hunt.autoSeconds ? idleHunt(seconds, Math.max(0, cap - gold)) : null;
  P.lastSeen = now;
  if (away < O.minSecondsForSummary && !runs.length) return null;
  return { seconds, away, guests, gold, capped, runs, items, levelUps, newChem, harvested, bonds, hunt };
}
