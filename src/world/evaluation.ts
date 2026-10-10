// 베타 2장: 「여관 평가단」 — 실제 1주 = 시즌, 테마(미식·휴양·모험가·풍경) 순환. 점수 0~1000 → 브론즈·실버·골드·전설
//  마지막 날(일요일) 게임 속 저녁: 평가단 3명이 마을을 돌고(ui/evaluation) → 결과 카드 · 보상 · 현판 · 아쉬움 힌트
import { CONFIG } from '../data/config';
import { def } from '../data/catalog';
import { HARMONIES } from '../data/harmony';
import { bumpHint, harmonySets } from './harmony';
import { chaptersDone, townGrade } from './guide';
import { hourNow } from './clock';
import { mondayKey } from './raid';
import { markDirty, P, S, world } from './state';

const E = CONFIG.evaluation;
export type ThemeKey = 'gourmet' | 'relax' | 'adventure' | 'scenery';
export const THEME_KEYS: ThemeKey[] = ['gourmet', 'relax', 'adventure', 'scenery'];
export const THEME_ICON = ['eval_gourmet', 'eval_relax', 'eval_adventure', 'eval_scenery'] as const;
export const themeName = (t: number) => E.themes[t] ?? '';

const weekIndex = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(new Date(y, m - 1, d).getTime() / (7 * 864e5));
};
export const themeOf = (key: string) => ((weekIndex(key) % 4) + 4) % 4;
/** 평가단이 오기 시작했나 (장부 3장을 마치면 · 5단계 전 저장은 바로) */
export const evalOpen = () => !S.visiting && (P.guide.legacy || chaptersDone() >= E.fromChapter);

// ───────── 점수 재료 ─────────

const C = () => P.counters;
const wins = () => Object.values(C().regionWins).reduce((s, v) => s + v, 0);
/** 시즌이 시작될 때 찍어 두는 누적 수치 (늘어난 만큼만 센다) */
function snapshot(): Record<string, number> {
  return { meals: C().tavernMeals, harvests: C().harvests, wins: wins(), trains: C().trains, raids: C().raidTries ?? 0, moodSum: 0, moodN: 0 };
}
const delta = (k: string, now: number) => Math.max(0, now - (P.evaluation.base[k] ?? now));
const decos = () => world.objs.filter((o) => def(o.kind).deco && o.kind !== 'board' && o.kind !== 'dungeon');
function moodAvg(): number {
  const b = P.evaluation.base;
  if (b.moodN) return b.moodSum / b.moodN;
  const g = world.actors.filter((a) => !a.role && a.id && !a.hidden);
  return g.length ? g.reduce((s, a) => s + a.mood, 0) / g.length : 60;
}
const themeSets = (ids: number[]) => harmonySets().filter((s) => ids.includes(s.id)).length;

export interface EvalPart {
  key: string;
  label: string;
  value: number;
  need: number;
  pts: number;
  max: number;
}
const part = (key: string, label: string, value: number, [need, max]: number[]): EvalPart => ({
  key, label, value: Math.round(value), need, max, pts: Math.round(Math.min(1, value / need) * max),
});

/** 이번 시즌 테마의 점수 재료 (내 마을만) */
export function evalParts(theme = P.evaluation.theme): EvalPart[] {
  if (S.visiting) return [];
  const g = E.gourmet;
  const r = E.relax;
  const a = E.adventure;
  const sc = E.scenery;
  const TH = E.themeHarmony;
  switch (THEME_KEYS[theme]) {
    case 'gourmet':
      return [
        part('meals', '주점 식사', delta('meals', C().tavernMeals), g.meals),
        part('harvests', '텃밭 수확', delta('harvests', C().harvests), g.harvests),
        part('harmonies', '식사 어울림', themeSets(TH.gourmet), g.harmonies),
        part('mood', '식사 뒤 기분', moodAvg(), g.mood),
      ];
    case 'relax':
      return [
        part('mood', '손님 평균 기분', moodAvg(), r.mood),
        part('harmonies', '휴식 어울림', themeSets(TH.relax), r.harmonies),
        part('decos', '장식', decos().length, r.decos),
      ];
    case 'adventure':
      return [
        part('wins', '원정 성공', delta('wins', wins()), a.wins),
        part('huntBest', '사냥 최고 스테이지', Object.values(P.hunt.best).reduce((s, v) => s + v, 0), a.huntBest),
        part('trains', '훈련', delta('trains', C().trains), a.trains),
        part('raids', '토벌 도전', delta('raids', C().raidTries ?? 0), a.raids),
      ];
    default: {
      const roofs = new Set(world.objs.filter((o) => def(o.kind).roofable).map((o) => String(o.hue))).size;
      return [
        part('decos', '장식 수', decos().length, sc.decos),
        part('kinds', '장식 종류', new Set(decos().map((o) => o.kind)).size, sc.kinds),
        part('found', '어울림 발견', P.harmony.found.length, sc.found),
        part('grade', '마을 등급', townGrade(), sc.grade),
        part('roofs', '지붕 색 다양성', roofs, sc.roofs),
      ];
    }
  }
}
/** 지금 점수 (0~1000 + 암행 보너스) */
export const evalScore = () => evalParts().reduce((s, p) => s + p.pts, 0) + P.evaluation.bonus;
/** 등급 0(없음) ~ 4(전설) */
export const tierOf = (score: number) => E.tiers.filter((t) => score >= t).length;
export const tierName = (t: number) => (t ? E.tierNames[t - 1] : '등급 없음');
export const nextTier = (score: number) => E.tiers.find((t) => score < t) ?? null;

// ───────── 아쉬움 힌트 (가장 낮았던 재료 → 숨은 어울림 힌트로) ─────────

const MISS: Record<string, [string, number[]]> = {
  'gourmet.meals': ['주점이 더 붐볐다면 맛 평가가 좋았을 텐데… 모닥불 곁의 주점은 늘 시끌벅적하던데.', [1, 7]],
  'gourmet.harvests': ['갓 딴 채소가 부엌 가까이 있었다면…', [18, 6]],
  'gourmet.harmonies': ['술 냄새와 나무 냄새가 어울리는 곳이 있었다면 더 맛있었을 텐데…', [7, 18]],
  'gourmet.mood': ['배는 불렀는데 앉아 쉴 자리가 아쉬웠다…', [14, 2]],
  'relax.mood': ['손님들이 불을 바라보며 쉴 자리가 있었다면…', [14, 2]],
  'relax.harmonies': ['온천 옆에 꽃이 있었다면 손님들이 더 쉬었을 텐데…', [23, 4, 17]],
  'relax.decos': ['물소리 곁에 앉아 꽃을 볼 수 있는 광장이 있었다면…', [10, 17]],
  'adventure.wins': ['마을에 들어서자마자 의뢰를 고를 수 있었다면…', [11, 8]],
  'adventure.huntBest': ['나부끼는 깃발 아래서 땀 흘렸다면 더 깊이 갔을 텐데…', [12]],
  'adventure.trains': ['훈련장에서 화살 꽂히는 소리가 들리지 않던데…', [8, 22]],
  'adventure.raids': ['자랑할 트로피를 한데 모아 두면 사기가 오르지 않을까…', [20, 12]],
  'scenery.decos': ['장식이 조금 더 있었다면 사진이 잘 나왔을 텐데…', [10, 21]],
  'scenery.kinds': ['좌판이 늘어선 장터 하나쯤 있었으면…', [21, 9]],
  'scenery.found': ['건물들이 서로 어울리는 모습을 더 보고 싶었다…', []],
  'scenery.grade': ['마을이 조금만 더 컸다면… 장부를 넘겨 보면 길이 있을 거야.', []],
  'scenery.roofs': ['지붕이 다 같은 색이라 조금 심심했다…', [24, 16]],
};
export function missHint(theme: number, parts: EvalPart[]): { text: string; harmony: number | null } {
  const low = [...parts].sort((a, b) => a.pts / a.max - b.pts / b.max)[0];
  const [text, ids] = MISS[`${THEME_KEYS[theme]}.${low?.key}`] ?? ['다음엔 더 좋아지겠지…', []];
  const pool = ids.length ? ids : HARMONIES.filter((h) => !h.open).map((h) => h.id);
  const id = pool.find((i) => !P.harmony.found.includes(i) && !HARMONIES.find((h) => h.id === i)!.open) ?? null;
  return { text, harmony: id };
}

// ───────── 시즌 ─────────

/** ui가 채운다: 새 시즌 알림 · 지난 시즌 결과(평가단 순회 없이) */
export const evalHooks = {
  seasonStart: (_theme: number) => {},
  result: (_r: EvalResult) => {},
};
export interface EvalResult {
  season: string;
  theme: number;
  score: number;
  tier: number;
  parts: EvalPart[];
  miss: { text: string; harmony: number | null };
  reward: { gold: number; dust: number; shards: number } | null;
  plaques: string[];
  title: string | null;
}

/** 0.5초마다: 시즌이 바뀌었으면 지난 시즌 결과 → 새 시즌 시작 */
export function ensureSeason() {
  if (!evalOpen() || !S.started) return;
  const key = mondayKey();
  const ev = P.evaluation;
  if (ev.season === key) return;
  // 지난 시즌을 아직 평가받지 않았다 (마지막 날 접속하지 않음) → 지금 상태로 바로 결과
  if (ev.season && ev.judged !== ev.season) evalHooks.result(judge());
  Object.assign(ev, { season: key, theme: themeOf(key), bonus: 0, secretDone: false, base: snapshot() });
  markDirty();
  evalHooks.seasonStart(ev.theme);
}

/** 게임 1시간마다: 손님 평균 기분 기록 (휴양·미식 재료) */
let moodHour = -1;
export function sampleMood() {
  if (!evalOpen() || !P.evaluation.season) return;
  const h = Math.floor(S.day * 24 + hourNow());
  if (h === moodHour) return;
  moodHour = h;
  const g = world.actors.filter((a) => !a.role && a.id && !a.hidden && a.runId == null);
  if (!g.length) return;
  const b = P.evaluation.base;
  b.moodSum = (b.moodSum ?? 0) + g.reduce((s, a) => s + a.mood, 0) / g.length;
  b.moodN = (b.moodN ?? 0) + 1;
}

/** 오늘이 시즌 마지막 날(일요일)이고 저녁이면 평가단이 올 차례 */
export const tourDue = () =>
  evalOpen() && S.started && !!P.evaluation.season && P.evaluation.judged !== P.evaluation.season && new Date().getDay() === 0 && hourNow() >= E.tourHour;

/** 평가 확정: 보상 · 첫 현판 · 칭호 · 기록 */
export function judge(): EvalResult {
  const ev = P.evaluation;
  const parts = evalParts(ev.theme);
  const score = Math.min(1000 + E.secretBonus, parts.reduce((s, p) => s + p.pts, 0) + ev.bonus);
  const tier = tierOf(score);
  const miss = missHint(ev.theme, parts);
  if (miss.harmony) bumpHint(miss.harmony);
  const reward = tier ? E.rewards[tier - 1] : null;
  if (reward) {
    S.gold += reward.gold;
    P.dust.n += reward.dust;
    P.hunt.shards += reward.shards;
  }
  const plaques: string[] = [];
  for (const [t, k] of [[1, 'plaque_bronze'], [2, 'plaque_silver'], [3, 'plaque_gold']] as const)
    if (tier >= t && !P.harmony.plaques.includes(k)) {
      P.harmony.plaques.push(k);
      plaques.push(k);
    }
  const title = tier >= 3 ? `${themeName(ev.theme)} 명소` : null;
  ev.history.push({ season: ev.season, theme: ev.theme, score, tier });
  if (ev.history.length > 20) ev.history.shift();
  ev.best = Math.max(ev.best, tier);
  ev.judged = ev.season;
  markDirty();
  return { season: ev.season, theme: ev.theme, score, tier, parts, miss, reward, plaques, title };
}

/** 평가 칭호 (골드 이상 받은 테마) */
export const evalTitles = () => [...new Set(P.evaluation.history.filter((h) => h.tier >= 3).map((h) => `${themeName(h.theme)} 명소`))];
