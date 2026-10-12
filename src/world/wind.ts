// DIRECTION §1-2: 「회차의 바람」 — 2회차부터 회차마다 하나 (직전과 겹치지 않게 · 회차 번호로 정해진다) · 회차 내내 유지
//  효과는 다른 모듈이 여기 함수를 곱해 쓴다 (바람이 없으면 전부 1 · 0 → 1회차·옛 저장은 그대로)
//  + 회차 번호로 [소문] 풀 · 영웅 첫 등장 순서를 시드 섞기 (STORY_BIBLE §4)
import { CONFIG } from '../data/config';
import { P } from './state';

export type WindId = 'festival' | 'stars' | 'harvest' | 'wayfarer' | 'war' | 'calm';
export const WIND_IDS: WindId[] = ['festival', 'stars', 'harvest', 'wayfarer', 'war', 'calm'];
const W = () => CONFIG.direction.wind;

/** 이름 · 효과 한 줄 · 분위기 한 줄 (여정 지도에 보인다) */
export const WIND_INFO: Record<WindId, { name: string; icon: string; fx: string; mood: string }> = {
  festival: { name: '축제의 해', icon: '🎏', fx: '장식 값 −15% · 밤 불빛이 더 밝게 · 주점 수입 +10%', mood: '마을 곳곳에 깃발이 올라요' },
  stars: { name: '별이 많은 해', icon: '🌠', fx: '별똥별 하루 2번 · 전설 인연 +10%', mood: '밤하늘의 별이 두 배' },
  harvest: { name: '풍년', icon: '🌾', fx: '텃밭 수확 +30% · 물고기 요리 버프 +1단계', mood: '가을빛이 마을에 내려앉아요' },
  wayfarer: { name: '길손의 해', icon: '🧳', fx: '지나가는 손님 +50% · 단골 제안이 더 쉽게', mood: '길에 손님이 많아요' },
  war: { name: '전쟁의 소문', icon: '⚔️', fx: '토벌 피해 +15% · 원정 금화 −10%', mood: '[소문] 수다가 무거워져요' },
  calm: { name: '고요한 해', icon: '🍃', fx: '손님 기분이 잘 안 떨어져요 · 은퇴 루트 목표 −10%', mood: '잔잔한 음악이 먼저 흘러요' },
};

// ───────── 시드 ─────────

/** 작은 시드 난수 (mulberry32) */
export function seeded(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 시드로 섞은 새 배열 (원본은 그대로) */
export function seedShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = [...arr];
  const r = seeded(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ───────── 바람 고르기 ─────────

/** 회차 번호(+직전 바람)로 이번 바람 — 1회차는 없음 · 직전과 겹치지 않음 · 같은 입력이면 늘 같은 바람 */
export function pickWind(gen: number, prev: string): WindId | '' {
  if (gen < CONFIG.direction.windFrom) return '';
  const cand = WIND_IDS.filter((w) => w !== prev);
  return cand[Math.floor(seeded(gen * 7919 + 101)() * cand.length)];
}
const valid = (w: unknown): w is WindId => typeof w === 'string' && (WIND_IDS as string[]).includes(w);
/** 지금 회차의 바람 ('' = 없음) */
export const curWind = (): WindId | '' => (valid(P.story?.wind) ? P.story.wind : '');
export const windIs = (w: WindId) => curWind() === w;

/** 새 회차를 열 때 (story.startCycle): 지난 바람을 기억하고 새 바람을 정한다 */
export function rollWind(): WindId | '' {
  const prev = valid(P.story.wind) ? P.story.wind : P.legacy.lastWind || '';
  if (prev) P.legacy.lastWind = prev;
  P.story.wind = pickWind(P.legacy.gen, prev);
  return P.story.wind as WindId | '';
}
/** 불러온 뒤: 2회차 이상인데 바람이 없는 옛 저장은 지금 정해 준다 (회차 번호로 · 연대기에 남은 지난 바람과 겹치지 않게) */
export function ensureWind() {
  if (P.story.wind && !valid(P.story.wind)) P.story.wind = '';
  if (P.story.wind || P.legacy.gen < CONFIG.direction.windFrom) return;
  const last = [...(P.legacy.chron ?? [])].reverse().find((c) => c.gen < P.legacy.gen && c.wind)?.wind ?? P.legacy.lastWind ?? '';
  P.story.wind = pickWind(P.legacy.gen, last);
}

// ───────── 효과 (다른 모듈이 곱해 쓴다) ─────────

/** 축제: 장식 값 배수 */
export const windDecorMult = () => (windIs('festival') ? W().festival.decorCost : 1);
/** 축제: 주점 수입 + */
export const windTavern = () => (windIs('festival') ? W().festival.tavern : 0);
/** 축제: 밤 불빛 세기 배수 (그리기) */
export const windLight = () => (windIs('festival') ? W().festival.nightLight : 1);
/** 별: 하루 별똥별 + */
export const windStars = () => (windIs('stars') ? W().stars.starCatch : 0);
/** 별: 전설 인연 게이지 + */
export const windLegend = () => (windIs('stars') ? W().stars.legendGauge : 0);
/** 풍년: 수확 개수 (소수는 확률로) */
export function windHarvest(n: number, rnd: () => number = Math.random): number {
  if (!windIs('harvest')) return n;
  const v = n * (1 + W().harvest.harvest);
  const f = Math.floor(v);
  return f + (rnd() < v - f ? 1 : 0);
}
/** 풍년: 요리 버프 등급 올리기 (n → r → e → l) */
export function windMealGrade(g: string): string {
  if (!windIs('harvest')) return g;
  const o = ['n', 'r', 'e', 'l'];
  const i = o.indexOf(g);
  return i < 0 ? g : o[Math.min(o.length - 1, i + W().harvest.mealTier)];
}
/** 길손: 지나가는 손님 확률 배수 · 단골 제안 기분 기준을 이만큼 낮춘다 */
export const windPasser = () => (windIs('wayfarer') ? W().wayfarer.passer : 1);
export const windRegularCut = () => (windIs('wayfarer') ? W().wayfarer.regularCut : 0);
/** 전쟁: 토벌 피해 배수 · 원정 금화 배수 */
export const windRaid = () => (windIs('war') ? 1 + W().war.raidDmg : 1);
export const windQuestGold = () => (windIs('war') ? 1 + W().war.questGold : 1);
/** 고요: 기분이 떨어지는 양 배수 · 은퇴 목표 배수 */
export const windMoodDecay = () => (windIs('calm') ? W().calm.moodDecay : 1);
export const windRetire = (need: number) => (windIs('calm') ? Math.max(1, Math.ceil(need * (1 - W().calm.retireCut))) : need);
/** 고요: 마을 곡을 고를 때 잔잔한 곡 목록 (확률로 · 없으면 null) */
export function windTracks(scene: string, rnd: () => number = Math.random): string[] | null {
  if (!windIs('calm')) return null;
  const t = W().calm.calmTracks[scene];
  return t?.length && rnd() < W().calm.calmMusic ? t : null;
}
/** 전쟁: [소문]에서 「토벌」 수다를 고를 확률 */
export const windHeavyRumor = () => (windIs('war') ? W().war.heavyRumor : 0);

// ───────── 시드 섞기: [소문] 풀 · 영웅 첫 등장 순서 ─────────

/** 회차 번호로 섞은 [소문] 순서 (같은 회차면 같은 순서 · 회차마다 다른 이야기) */
export const rumorOrder = <T>(pool: readonly T[], gen = P.legacy.gen) => seedShuffle(pool, gen * 104729 + 7);
/** 동시에 등장할 수 있는 영웅이 여럿이면: 2회차부터 회차 번호로 섞은 순서의 첫 영웅 (1회차는 원래 순서) */
export function heroFirst<T>(ready: readonly T[], all: readonly T[], gen = P.legacy.gen): T | undefined {
  if (ready.length <= 1 || gen < CONFIG.direction.windFrom) return ready[0];
  const ord = seedShuffle(all, gen * 15485863 + 3);
  return ord.find((h) => ready.includes(h));
}
