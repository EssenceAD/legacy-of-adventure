// GROWTH §4 연못 낚시: 미끼(하루 5 + 여관 5레벨마다 1 · 작물 1개 = 1) · 물고기 고르기(장소·시간대·등급) · 판정 · 기록 · 요리 · 팔기 · 박제 · 고래 놓아주기
import { CONFIG } from '../data/config';
import { FISH, FISH_LINES, type FishDef } from '../data/story/fish';
import { josa } from '../data/josa';
import { DAY_MINUTES, hourNow } from './clock';
import { cropSpare } from './facilities';
import { brag } from './growth';
import { addMail } from './meta';
import { today } from './progress';
import { bestOf } from './town';
import { gotGold, markDirty, P, S, uiHooks, world } from './state';
import { windMealGrade } from './wind';
import { perkBait, perkFishWin } from './bundlePerks';
import { petFishWin, petTry } from './pets';
import { dockReward, dockTrophy } from './buildings2';
import { hfx } from './harmony';

const F = () => CONFIG.growth.fish;
export type FishWhere = 'pond' | 'sea';
export const fishById = (id: string) => FISH.find((f) => f.id === id);
export const GRADE_FISH: Record<FishDef['grade'], { name: string; color: string }> = {
  n: { name: '흔함', color: '#9a9aa6' },
  r: { name: '희귀', color: '#4f8fe0' },
  e: { name: '영웅', color: '#a35bd6' },
  l: { name: '전설', color: '#f2a13a' },
};
/** 박제 장식 종류 (catalog 키) */
export const trophyKind = (id: string) => `fish_${id}`;
export const TROPHY_FISH = FISH.filter((f) => f.use.includes('trophy'));

// ───────── 미끼 ─────────

const innLv = () => bestOf('inn', world.home?.objs ?? world.objs)?.lvl ?? 1;
/** LUXE §3 물가 완성: +1 */
export const baitMax = () => F().baitDaily + Math.floor(innLv() / F().baitPerInnLv) + perkBait();
function rollDay() {
  const f = P.growth.fish;
  if (f.day !== today()) {
    f.day = today();
    f.used = 0;
  }
}
/** 오늘 남은 미끼 (하루 몫 + 작물로 만든 것) */
export function baitLeft(): number {
  rollDay();
  const f = P.growth.fish;
  return Math.max(0, baitMax() - f.used) + f.extra;
}
/** 작물 1개 → 미끼 1개 (가장 많은 작물부터 · 알아서 고를 땐 물약 재료로 남겨 둔 몫은 빼고) */
export function makeBait(crop?: string): string | null {
  const id = crop ?? Object.keys(P.crops).map((k) => [k, cropSpare(k)] as const).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!crop && !id && Object.values(P.crops).some((n) => n > 0)) return '물약 재료로 남겨 둔 작물뿐이에요 (연금술 공방에서 끌 수 있어요)';
  if (!id || !((P.crops[id] ?? 0) > 0)) return '텃밭 작물이 없어요 (텃밭에서 거둬요)';
  P.crops[id]--;
  P.growth.fish.extra++;
  markDirty();
  return null;
}
function useBait(): boolean {
  rollDay();
  const f = P.growth.fish;
  if (f.used < baitMax()) f.used++;
  else if (f.extra > 0) f.extra--;
  else return false;
  markDirty();
  return true;
}

// ───────── 물고기 고르기 ─────────

/** 지금 시간대 (게임 시계): dawn ⊂ 낮 */
export function timeNow(): { night: boolean; dawn: boolean } {
  const h = hourNow();
  const [a, b] = F().dawn;
  return { night: S.night, dawn: h >= a && h < b };
}
/** FISH_QOL_1019 E: 다음 시간대까지 현실 분 (게임 시계 · 낮→밤 22시 / 밤→아침 6시) + 새벽(4시)까지 (새벽이 아니고 밤 4시 전일 때) */
export function timeLeft(): { next: '밤' | '낮'; min: number; dawnMin: number | null } {
  const C = CONFIG.clock;
  const real = (gameMin: number) => Math.max(1, Math.ceil(((gameMin / 60) * C.realSecondsPerGameHour) / 60));
  const nightAt = (C.nightStartHour - C.dayStartHour) * 60;
  const dawnAt = (((F().dawn[0] - C.dayStartHour) % 24) + 24) % 24 * 60;
  const t = timeNow();
  const dawnMin = !t.dawn && S.clock < dawnAt ? real(dawnAt - S.clock) : null;
  return S.night ? { next: '낮', min: real(DAY_MINUTES - S.clock), dawnMin } : { next: '밤', min: real(nightAt - S.clock), dawnMin };
}
const timeOk = (f: FishDef, t = timeNow()) => !f.time || (f.time === 'night' ? t.night : f.time === 'day' ? !t.night : t.dawn);
/** 지금 낚을 수 있는 물고기 */
export const fishPool = (where: FishWhere, t = timeNow()) => FISH.filter((f) => f.where === where && timeOk(f, t));

// ───────── FISH_QOL_1019 🎯 노리기 (이카몰리 건의) ─────────

/** 노릴 수 있는 물고기 (지금 시간대 · 전설 빼고) */
export const aimPool = (where: FishWhere, t = timeNow()) => fishPool(where, t).filter((f) => f.grade !== 'l');
/** 지금 노리는 물고기 — 그 자리·시간대에 없으면 「아무거나」로 되돌리고 셈도 처음부터 */
export function aimOf(where: FishWhere, t = timeNow()): FishDef | null {
  const a = P.growth.fish.aim;
  if (!a) return null;
  const f = aimPool(where, t).find((x) => x.id === a.id);
  if (!f) {
    P.growth.fish.aim = undefined;
    markDirty();
  }
  return f ?? null;
}
/** 노리기 고르기 ('' = 아무거나) */
export function setAim(id: string) {
  P.growth.fish.aim = id && fishById(id)?.grade !== 'l' ? { id, miss: 0 } : undefined;
  markDirty();
}

export function pickFish(where: FishWhere, rng: () => number = Math.random, t = timeNow()): FishDef {
  const pool = fishPool(where, t);
  const aim = aimOf(where, t);
  // 노린 채 다른 물고기만 pity번 걸렸으면 이번 입질은 그 물고기
  if (aim && P.growth.fish.aim!.miss >= F().aim.pity) return aim;
  // BUILDINGS2 낚시 선착장: 박제가 되는 물고기가 더 잘 걸린다
  const tw = dockTrophy();
  const w = pool.map((f) => (F().weight[f.grade] ?? 1) * ((f.use as readonly string[] | undefined)?.includes('trophy') ? tw : 1) * (f === aim ? F().aim.mult : 1));
  let r = rng() * w.reduce((s, v) => s + v, 0);
  for (let i = 0; i < pool.length; i++) if ((r -= w[i]) < 0) return pool[i];
  return pool[pool.length - 1];
}
export const rollSize = (f: FishDef, rng: () => number = Math.random) => Math.round((f.size[0] + rng() * (f.size[1] - f.size[0])) * 10) / 10;

export interface Cast {
  where: FishWhere;
  fish: FishDef;
  size: number;
  /** 입질 시각(초) · 판정 창(초) · 전체 길이(초) */
  bite: number;
  win: number;
  len: number;
}
/** 시험용: 다음 물고기를 정한다 (DEV) */
export const fishForce = { id: '' };
/** 던지기 — 미끼 1개 (없으면 null) */
export function cast(where: FishWhere, rng: () => number = Math.random): Cast | null {
  if (!useBait()) return null;
  const fish = (fishForce.id && fishById(fishForce.id)) || pickFish(where, rng);
  fishForce.id = '';
  // 노린 물고기가 아닌 게 걸리면 셈 +1 (노린 물고기를 놓치면 셈은 그대로 · 낚으면 land에서 0)
  const a = P.growth.fish.aim;
  if (a && a.id !== fish.id) a.miss++;
  const bite = F().biteFrom + rng() * (F().biteTo - F().biteFrom);
  return { where, fish, size: rollSize(fish, rng), bite, win: fish.win + perkFishWin() + petFishWin(), len: F().seconds };
}
/** 판정: 입질 뒤 판정 창 안에 눌렀나 (t = 던진 뒤 누른 시각 · 초) */
export const judge = (c: Pick<Cast, 'bite' | 'win'>, t: number) => t >= c.bite && t <= c.bite + c.win;

export interface Catch {
  fish: FishDef;
  size: number;
  first: boolean;
  record: boolean;
}
/** 낚았다: 가방 · 기록 · 전설은 자랑 */
export function land(c: Pick<Cast, 'fish' | 'size'>): Catch {
  const f = P.growth.fish;
  const r = (f.rec[c.fish.id] ??= { n: 0, max: 0 });
  const first = r.n === 0;
  const record = c.size > r.max;
  r.n++;
  if (record) r.max = c.size;
  f.bag[c.fish.id] = (f.bag[c.fish.id] ?? 0) + 1;
  if (f.aim?.id === c.fish.id) f.aim.miss = 0;
  // LUXE §2 펫: 낚시 성공 = 아기 수달 시도 1
  petTry('fish');
  markDirty();
  if (c.fish.grade === 'l') brag('fish', null, `${c.fish.name}(${c.size}cm)`);
  return { fish: c.fish, size: c.size, first, record };
}
export const missLine = (rng: () => number = Math.random) => FISH_LINES.miss[Math.floor(rng() * FISH_LINES.miss.length)];
export const biteLine = (rng: () => number = Math.random) => FISH_LINES.bite[Math.floor(rng() * FISH_LINES.bite.length)];

// ───────── 쓰임 ─────────

const take = (id: string) => {
  const b = P.growth.fish.bag;
  if (!((b[id] ?? 0) > 0)) return false;
  b[id]--;
  if (b[id] <= 0) delete b[id];
  return true;
};
/** 팔기 */
export function sellFish(id: string): number {
  const f = fishById(id);
  if (!f || !take(id)) return 0;
  // BUILDINGS2 낚시 선착장 · 어울림 「작은 항구」: 파는 값 +
  const price = Math.round(f.price * (1 + dockReward() + hfx('fish')));
  S.gold += price;
  gotGold(price, 'fish');
  markDirty();
  return price;
}
/** 주점 물고기 요리: 원정 금화 + (지속 시간 동안 · 새로 하면 바뀐다) */
export function cookFish(id: string, now = Date.now()): string | null {
  const f = fishById(id);
  if (!f || !f.use.includes('cook')) return '요리할 수 없는 물고기예요';
  if (!take(id)) return '그 물고기가 없어요';
  P.growth.meal = { until: now + F().meal.minutes * 60000, v: F().meal.v[windMealGrade(f.grade)] ?? 0.05, name: `${f.name} 요리` };
  markDirty();
  return null;
}
export { mealGold } from './growth';
/** 박제: 물고기 1마리 → 1×1 장식 (무료로 놓기) */
export function stuffFish(id: string): string | null {
  const f = fishById(id);
  if (!f || !f.use.includes('trophy')) return '박제할 수 없는 물고기예요';
  if (!take(id)) return '그 물고기가 없어요';
  const k = trophyKind(id);
  P.meta.giftDeco[k] = (P.meta.giftDeco[k] ?? 0) + 1;
  P.growth.fish.trophies++;
  markDirty();
  return null;
}
/** 아기 별고래 놓아주기 → 다음 날 모모 편지 */
export function releaseFish(id: string): string | null {
  if (!take(id)) return '그 물고기가 없어요';
  if (id === 'starwhale') P.growth.fish.whaleDay = today();
  markDirty();
  return FISH_LINES.release;
}
/** 매일 첫 접속: 고래를 놓아준 다음 날이면 모모 편지 */
export function dailyFishing() {
  const f = P.growth.fish;
  if (!f.whaleDay || f.whaleDay === today()) return;
  f.whaleDay = '';
  markDirty();
  const [who, text] = FISH_LINES.whaleLetter;
  addMail({ from: 'system', title: '모모의 편지 · 바다의 노래', body: text, reward: {} });
  uiHooks.talk([[who, text]]);
}

// ───────── 기록 (도감 · 업적) ─────────

export const caughtKinds = () => FISH.filter((f) => (P.growth.fish.rec[f.id]?.n ?? 0) > 0).length;
export const caughtTotal = () => Object.values(P.growth.fish.rec).reduce((s, r) => s + r.n, 0);
export const legendCaught = () => FISH.filter((f) => f.grade === 'l' && (P.growth.fish.rec[f.id]?.n ?? 0) > 0).length;
/** 최대어 (크기가 가장 큰 기록) */
export function biggest(): { fish: FishDef; size: number } | null {
  let best: { fish: FishDef; size: number } | null = null;
  for (const f of FISH) {
    const m = P.growth.fish.rec[f.id]?.max ?? 0;
    if (m > 0 && (!best || m > best.size)) best = { fish: f, size: m };
  }
  return best;
}
export const fishGiftable = () => FISH.filter((f) => f.use.includes('gift') && (P.growth.fish.bag[f.id] ?? 0) > 0);
export const fishNameJ = (f: FishDef, j: string) => `${f.name}${josa(f.name, j)}`;
