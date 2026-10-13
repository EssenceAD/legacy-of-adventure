// GOLDSINK §7 끝없는 심연: 심연의 바닥 10을 깬 사람에게 · 1층부터 끝없이 (층마다 강함 ×1.07 복리)
//  5층마다 보스(그동안 쓰러뜨린 지역 보스 중 무작위 · 그림 그대로) · 10층마다 쉼터(축복 30분) · 금화 보상 없음(가루·재료)
//  진 층에서 이어하려면 5,000 × 1.15^층 금화 (안 내면 1층부터) · 기록 = 최고 층 · 주간 최고 층(한국 시간 월요일) · 25/50/100층 [알림] 자랑
import { CONFIG } from '../data/config';
import { REGION_BOSS, type BossLook } from '../combat/mons';
import { REGIONS, type RegionId } from '../data/items';
import { flag } from './flags';
import { addBlessMin, gsState, kstWeek } from './goldsink';
import { brag } from './growth';
import { best, recPower, regionBossOf } from './hunt';
import { rollUnique } from './uniques';
import { markDirty, P, S, type Item } from './state';

const A = () => CONFIG.abyss;
export type AbyssRec = ReturnType<typeof abyssRec>;

/** 기록 칸 (없으면 만들고 · 주가 바뀌었으면 주간 최고 초기화) */
export function abyssRec(now = Date.now()) {
  const g = gsState(now);
  const base = { best: 0, week: '', weekBest: 0, lost: 0, brags: [] as number[] };
  const a = (g.abyss ??= base);
  for (const k of ['best', 'weekBest', 'lost'] as const) if (!Number.isFinite(a[k])) a[k] = 0;
  if (typeof a.week !== 'string') a.week = '';
  if (!Array.isArray(a.brags)) a.brags = [];
  const w = kstWeek(now);
  if (a.week !== w) {
    a.week = w;
    a.weekBest = 0;
  }
  return a;
}

/** 열렸나: 심연의 바닥 10 돌파 + 플래그 */
export const abyssOpen = () => flag('endlessAbyss') && best('deep') >= CONFIG.hunt.stages;
export const isBossFloor = (f: number) => f > 0 && f % A().bossEvery === 0;
export const isRestFloor = (f: number) => f > 0 && f % A().restEvery === 0;
/** 층의 추천 전투력 (= 몬스터 강함) · 1층 = 심연의 바닥 10 */
export const floorRec = (f: number) => Math.round(recPower('deep', CONFIG.hunt.stages) * A().grow ** (Math.max(1, f) - 1));
/** 전투 필드에 넘길 스테이지 (보스 층 = 10 → 처치 목표 뒤 보스 · 아니면 9) */
export const floorStage = (f: number) => (isBossFloor(f) ? CONFIG.hunt.stages : CONFIG.hunt.stages - 1);
/** 이어하기 값 */
export const contCost = (f: number) => Math.round(A().contBase * A().contGrow ** f);

/** 보스 층 후보: 그동안 쓰러뜨린 지역 보스 (지역 x-10 돌파) */
export const seenBossRegions = (): RegionId[] => REGIONS.filter((r) => best(r.id) >= CONFIG.hunt.stages).map((r) => r.id);
export function pickBoss(rng: () => number = Math.random): { region: RegionId; look: BossLook } {
  const rs = seenBossRegions();
  const region = rs.length ? rs[Math.floor(rng() * rs.length) % rs.length] : 'deep';
  return { region, look: REGION_BOSS[region] };
}

export interface FloorReward {
  floor: number;
  dustN: number;
  dustR: number;
  dustE: number;
  mats: number;
  bossMats: number;
  bossMat: string;
  items: Item[];
  rest: boolean;
  /** 새 최고 층 · 이번에 자랑한 층 */
  record: boolean;
  bragged: number;
}

/** 층 보상 계산만 (금화 없음) */
export function floorLoot(f: number) {
  const C = A();
  const boss = isBossFloor(f);
  return {
    dustN: Math.round(C.dustN[0] + C.dustN[1] * f),
    dustR: 1 + Math.floor(f / C.dustREvery),
    dustE: boss ? 1 + Math.floor(f / C.dustEEvery) : 0,
    mats: C.matBase + Math.floor(f / C.matEvery),
    bossMats: boss ? C.bossMats : 0,
  };
}

/** 층을 깼다: 보상 · 쉼터 · 기록 · 자랑 (bossRegion = 보스 층에 나온 보스의 지역) */
export function clearFloor(f: number, bossRegion: RegionId | null = null, rng: () => number = Math.random, now = Date.now()): FloorReward {
  const L = floorLoot(f);
  P.dust.n += L.dustN;
  P.dust.r += L.dustR;
  P.dust.e += L.dustE;
  P.mats.deep = (P.mats.deep ?? 0) + L.mats;
  const items: Item[] = [];
  let bossMat = '';
  if (L.bossMats) {
    const br = bossRegion ?? 'deep';
    const b = regionBossOf(br);
    P.bossMats[b.id] = (P.bossMats[b.id] ?? 0) + L.bossMats;
    bossMat = b.mat;
    // 보스 층: 고유 장비 확률 ×2 (지역 보스 사냥과 같은 기준)
    const u = rollUnique(br, CONFIG.growth.unique.hunt * A().uniqueMult, rng);
    if (u) items.push(u);
  }
  const rest = isRestFloor(f);
  if (rest) addBlessMin(A().restMin, now);
  const rec = abyssRec(now);
  const record = f > rec.best;
  rec.best = Math.max(rec.best, f);
  rec.weekBest = Math.max(rec.weekBest, f);
  rec.lost = 0;
  let bragged = 0;
  for (const n of A().brags)
    if (f >= n && !rec.brags.includes(n) && !S.visiting) {
      // 자랑은 하루 한도·간격이 있어 못 했으면 다음 층에서 다시
      if (brag('abyss', null, String(n))) {
        rec.brags.push(n);
        bragged = n;
      }
      break;
    }
  markDirty();
  return { floor: f, ...L, bossMat, items, rest, record, bragged };
}

/** 진 층 (또는 그만 내려간 다음 층): 이어하기 자리 */
export function loseFloor(f: number, now = Date.now()) {
  abyssRec(now).lost = Math.max(1, f);
  markDirty();
}
/** 이어하기: 금화를 내고 진 층부터 (낸 층을 돌려준다) · 없거나 금화가 모자라면 오류 */
export function payContinue(now = Date.now()): { err: string } | { floor: number } {
  const rec = abyssRec(now);
  if (!rec.lost) return { err: '이어할 층이 없어요' };
  const c = contCost(rec.lost);
  if (S.gold < c) return { err: '금화가 모자라요' };
  S.gold -= c;
  const floor = rec.lost;
  rec.lost = 0;
  const g = gsState(now);
  g.cnt.abyssCont = (g.cnt.abyssCont ?? 0) + 1;
  markDirty();
  return { floor };
}
/** 1층부터 (이어하기 포기) */
export function dropContinue(now = Date.now()) {
  abyssRec(now).lost = 0;
  markDirty();
}
