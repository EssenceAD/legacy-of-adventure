// REGIONS2: 사냥 지역 6~10 — 열림 조건 · 길잡이 별 · 컷 차례(흩어진 별 → 지역 첫 입장 → 보스 → 별 → 편지 → 심연의 바닥) · 옛 저장 바로잡기
//  대사는 data/story/regions.ts 그대로. 화면(컷 틀기·창)은 ui/regions2.ts
import { CONFIG } from '../data/config';
import { BASE_REGIONS, REGIONS, type RegionId } from '../data/items';
import { DEEP_DEFEAT_HERO, DEEP_DEFEAT_PLAIN, DEEP_LINES, DEEP_OPEN, REGION_LINES, RUMORS, SCATTER_CUT } from '../data/story/regions';
import type { SLine } from '../data/story/v1';
import { markDirty, P, S } from './state';

const RC = () => CONFIG.regions2;
/** 길잡이 별이 떨어진 지역 (6~9) */
export const STAR_REGIONS = ['coast', 'dune', 'ember', 'sky'] as const;
export type StarRegion = (typeof STAR_REGIONS)[number];
export const isStarRegion = (r: string): r is StarRegion => (STAR_REGIONS as readonly string[]).includes(r);
/** 새 지역 (6~10) */
export const isNewRegion = (r: string) => REGIONS.findIndex((x) => x.id === r) >= BASE_REGIONS;
const best = (r: string) => P.hunt.best[r] ?? 0;
const R2 = () => P.regions2;

/** 모은 길잡이 별 수 */
export const starsHave = () => R2().stars.filter(isStarRegion).length;

/**
 * 지역 i(6~10)가 열렸나 — 6: 별의 심연 x-10 · 7~9: 앞 지역 x-10 · 10: 길잡이 별 4개 (= 해안·유적·화산·정원 보스 모두)
 * 1~5는 원래 규칙 그대로 (hunt.huntRegionOpen · expeditions.regionUnlocked)
 */
export function newRegionOpen(i: number): boolean {
  if (i < BASE_REGIONS || i >= REGIONS.length) return false;
  if (REGIONS[i].id === 'deep') return starsHave() >= RC().starsNeed && STAR_REGIONS.every((r) => best(r) >= CONFIG.hunt.stages);
  return best(REGIONS[i - 1].id) >= CONFIG.hunt.stages;
}
/** 열린 새 지역 id들 */
export const openNewRegions = (): RegionId[] => REGIONS.filter((_, i) => newRegionOpen(i)).map((r) => r.id);

// ───────── 옛 저장 바로잡기 (불러올 때 · 있는 값은 그대로, 빠진 칸만) ─────────

export function freshRegions2() {
  return {
    /** 별의 심연 x-10 뒤 「흩어진 별」 컷을 봤나 */
    scatter: false,
    /** 길잡이 별을 얻은 지역 (컷을 본 순서) */
    stars: [] as string[],
    /** 첫 입장 컷을 본 지역 */
    entered: [] as string[],
    /** 보스가 쓰러질 때 한 줄을 전투 안에서 보여 줬나 (안 봤으면 별 컷 앞에 붙인다) */
    bossShown: [] as string[],
    /** 다음 날 모모 편지 (얻은 날) */
    letters: [] as { id: string; day: number }[],
    /** 심연의 바닥이 열리는 컷을 봤나 */
    deepOpen: false,
    /** 「별을 삼킨 것」 처치 수 */
    deepKills: 0,
  };
}
export function sanitizeRegions2() {
  const base = freshRegions2();
  const cur = (P.regions2 ?? {}) as Partial<ReturnType<typeof freshRegions2>>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  P.regions2 = {
    scatter: cur.scatter === true,
    stars: arr(cur.stars).filter(isStarRegion),
    entered: arr(cur.entered),
    bossShown: arr(cur.bossShown),
    letters: Array.isArray(cur.letters) ? cur.letters.filter((l) => l && typeof l.id === 'string' && Number.isFinite(l.day)) : [],
    deepOpen: cur.deepOpen === true,
    deepKills: Number.isFinite(cur.deepKills) ? Math.max(0, Math.floor(cur.deepKills!)) : 0,
  };
  void base;
  // 지역별 기록에 새 지역 칸 (값이 있으면 그대로)
  for (const r of REGIONS) {
    if (!Number.isFinite(P.mats[r.id])) P.mats[r.id] = 0;
    if (!Number.isFinite(P.pity[r.id])) P.pity[r.id] = 0;
    if (!Number.isFinite(P.counters.regionWins[r.id])) P.counters.regionWins[r.id] = 0;
  }
}

// ───────── 컷 차례 ─────────

export interface R2Cut {
  kind: 'scatter' | 'star' | 'deepOpen' | 'letter';
  id: string;
  lines: SLine[];
  /** 컷이 끝난 뒤 (기록) · 새로 열린 지역이 있으면 그 id */
  done: () => RegionId | null;
}
/** 지금 틀어야 할 컷 하나 (없으면 null) — 마을에 있고 바쁘지 않을 때 1초마다 */
export function nextRegionCut(): R2Cut | null {
  const r2 = R2();
  // 1) 별의 심연 x-10 → 별 네 개가 흩어진다 (이미 깬 저장은 업데이트 뒤 처음 한 번)
  if (!r2.scatter && best('abyss') >= CONFIG.hunt.stages)
    return {
      kind: 'scatter', id: 'abyss', lines: SCATTER_CUT,
      done: () => {
        r2.scatter = true;
        markDirty();
        return 'coast';
      },
    };
  if (!r2.scatter) return null;
  // 2) 지역 6~9 보스 첫 처치 → 길잡이 별
  for (const r of STAR_REGIONS)
    if (best(r) >= CONFIG.hunt.stages && !r2.stars.includes(r)) {
      const L = REGION_LINES[r];
      return {
        kind: 'star', id: r, lines: [...(r2.bossShown.includes(r) ? [] : [L.boss]), ...L.star],
        done: () => {
          if (!r2.stars.includes(r)) r2.stars.push(r);
          r2.letters.push({ id: r, day: S.day });
          markDirty();
          return null;
        },
      };
    }
  // 3) 길잡이 별 넷 → 심연의 바닥
  if (!r2.deepOpen && newRegionOpen(REGIONS.findIndex((x) => x.id === 'deep')))
    return {
      kind: 'deepOpen', id: 'deep', lines: DEEP_OPEN,
      done: () => {
        r2.deepOpen = true;
        markDirty();
        return 'deep';
      },
    };
  // 4) 다음 날 모모 편지
  const due = r2.letters.find((l) => S.day > l.day);
  if (due && isStarRegion(due.id))
    return {
      kind: 'letter', id: due.id, lines: REGION_LINES[due.id].letter,
      done: () => {
        r2.letters = r2.letters.filter((l) => l !== due);
        markDirty();
        return null;
      },
    };
  return null;
}

/** 지역 첫 입장 (사냥 시작 전 1회) — 볼 대사 (없으면 null) · 부르면 본 걸로 */
export function takeEnterLines(r: string): SLine[] | null {
  if (!isNewRegion(r) || R2().entered.includes(r)) return null;
  R2().entered.push(r);
  markDirty();
  return r === 'deep' ? DEEP_LINES.enter : isStarRegion(r) ? REGION_LINES[r].enter : null;
}
/** 보스가 쓰러질 때 한 줄 (지역 6~9 첫 처치) */
export function bossLineFor(r: string): string | null {
  if (!isStarRegion(r) || best(r) >= CONFIG.hunt.stages) return null;
  return REGION_LINES[r].boss[1];
}
export function markBossShown(r: string) {
  if (!R2().bossShown.includes(r)) R2().bossShown.push(r);
  markDirty();
}

// ───────── 지역 10 보스 ─────────

/** 50% 「목소리」: 이번 회차에 아직 처치 전이거나, 용사 루트 최종 토벌 판 */
export const wantDeepVoice = (finalRaid = false) => finalRaid || !P.story.seen.includes('deepDefeat');
/** 처치 뒤 컷: 용사 루트(최종 토벌 직전까지 마친 회차) → HERO · 아니면 PLAIN (회차마다 한 번) */
export function deepDefeatCut(heroReady: boolean): { lines: SLine[]; hero: boolean } | null {
  R2().deepKills++;
  markDirty();
  if (heroReady) {
    if (!P.story.seen.includes('deepDefeat')) P.story.seen.push('deepDefeat');
    return { lines: DEEP_DEFEAT_HERO, hero: true };
  }
  if (P.story.seen.includes('deepDefeat')) return null;
  P.story.seen.push('deepDefeat');
  return { lines: DEEP_DEFEAT_PLAIN, hero: false };
}

// ───────── 소문 · 업적 ─────────

/** [소문]에 섞을 줄: 열린 새 지역 것만 */
export function regionRumor(): string | null {
  const open = openNewRegions().filter((r) => r in RUMORS) as (keyof typeof RUMORS)[];
  if (!open.length) return null;
  const r = open[Math.floor(Math.random() * open.length)];
  const ls = RUMORS[r];
  return ls[Math.floor(Math.random() * ls.length)];
}
/** 업적: 첫 발자국(첫 입장) · 길잡이(보스 = 별 · 지역 10은 처치) */
export const regionFirstDone = (r: string) => R2().entered.includes(r) || best(r) > 0;
export const regionGuideDone = (r: string) => (isStarRegion(r) ? R2().stars.includes(r) : best(r) >= CONFIG.hunt.stages);
