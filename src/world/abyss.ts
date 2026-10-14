// GOLDSINK §7 끝없는 심연: 심연의 바닥 10을 깬 사람에게 · 1층부터 끝없이 (층마다 강함 ×1.07 복리)
//  5층마다 보스(그동안 쓰러뜨린 지역 보스 중 무작위 · 그림 그대로) · 10층마다 쉼터(축복 30분) · 금화 보상 없음(가루·재료)
//  v0.24.5: 나가면(✕·앱 종료·마을로) 그 층부터 무료로 이어가기(cur) · 진 층만 유료 이어하기(lost) · 10층 체크포인트(입장료 = 이어하기 값 × 0.5)
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
import { petTry } from './pets';

const A = () => CONFIG.abyss;
export type AbyssRec = ReturnType<typeof abyssRec>;

/** 기록 칸 (없으면 만들고 · 주가 바뀌었으면 주간 최고 초기화) */
export function abyssRec(now = Date.now()) {
  const g = gsState(now);
  const base = { best: 0, week: '', weekBest: 0, lost: 0, cur: 0, brags: [] as number[] };
  const a = (g.abyss ??= base);
  for (const k of ['best', 'weekBest', 'lost', 'cur'] as const) if (!Number.isFinite(a[k])) a[k] = 0;
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
/** v0.24.5 */
export const resumeOn = () => flag('abyssResume');
/** 체크포인트 입장료 (1층 = 무료) */
export const cpFee = (f: number) => (f <= 1 ? 0 : Math.round(A().contBase * A().contGrow ** f * A().cpFeeMult));
/** 새로 시작할 수 있는 층: 1층 + 최고 층 이하의 10층 단위 */
export function checkpoints(bestFloor = abyssRec().best): { floor: number; fee: number }[] {
  const out = [{ floor: 1, fee: 0 }];
  if (!resumeOn()) return out;
  for (let f = A().cpEvery; f <= bestFloor; f += A().cpEvery) out.push({ floor: f, fee: cpFee(f) });
  return out;
}
/** 체크포인트에서 새로 시작: 입장료를 내고 (이어하기·이어가기 자리는 지운다) */
export function startAt(f: number, now = Date.now()): { err: string } | { floor: number; fee: number } {
  const cp = checkpoints(abyssRec(now).best).find((c) => c.floor === f);
  if (!cp) return { err: '고를 수 없는 층이에요' };
  if (S.gold < cp.fee) return { err: '금화가 모자라요' };
  S.gold -= cp.fee;
  const rec = abyssRec(now);
  rec.lost = 0;
  rec.cur = 0;
  if (cp.fee) {
    const g = gsState(now);
    g.cnt.abyssCp = (g.cnt.abyssCp ?? 0) + 1;
  }
  markDirty();
  return { floor: f, fee: cp.fee };
}
/** 층을 시작할 때마다 저장 (싸우다 앱을 꺼도 그 층부터) */
export function enterFloor(f: number, now = Date.now()) {
  if (!resumeOn()) return;
  abyssRec(now).cur = Math.max(1, f);
  markDirty();
}
/** 무료로 이어갈 층 (없으면 0) */
export const resumeFloor = (now = Date.now()) => (resumeOn() ? abyssRec(now).cur : 0);

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
  // LUXE §2 펫: 심연 층 클리어 = 별고양이 시도 1
  petTry('abyss', rng);
  const rec = abyssRec(now);
  const record = f > rec.best;
  rec.best = Math.max(rec.best, f);
  rec.weekBest = Math.max(rec.weekBest, f);
  rec.lost = 0;
  // v0.24.5: 깼으면 다음 층이 이어갈 자리 (「그만 · 마을로」도 무료)
  rec.cur = resumeOn() ? f + 1 : 0;
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
  const rec = abyssRec(now);
  rec.lost = Math.max(1, f);
  rec.cur = 0;
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
  const rec = abyssRec(now);
  rec.lost = 0;
  rec.cur = 0;
  markDirty();
}
