// STORY v2: 손님 일기 — 서재 Lv3부터, 단골의 케미가 한 단계 오를 때마다 그 단골 일기 한 장 (직업_종족마다 5장)
import { DIARIES as BASE_DIARIES, DIARY_DONE } from '../data/story/v2';
import { HUNTER_DIARIES } from '../data/story/hunter';
import type { SLine } from '../data/story/v1';
import { track } from '../net/telemetry';
import { markDirty, P, type Actor } from './state';
import { bestOf } from './town';

/** PARTY §1: 사냥꾼 일기 3종 (인간·엘프·하플링) 합치기 */
const DIARIES: Record<string, { title: string; pages: string[] }> = { ...BASE_DIARIES, ...HUNTER_DIARIES };
export const diaryKey = (a: Actor) => `${a.kind}_${a.race}`;
const pages = (): Record<string, number> => (P.diaries ??= {});
export const diaryOpen = () => (bestOf('library', undefined, true)?.lvl ?? 0) >= 3;
const pending: SLine[][] = [];

/** 케미가 오를 때 (chem.addBond levelUp) — 두 사람 일기 한 장씩 */
export function diaryOnChem(a: Actor, b: Actor) {
  if (!diaryOpen()) return;
  for (const x of [a, b]) {
    const k = diaryKey(x);
    const d = DIARIES[k];
    if (!d) continue;
    const n = pages()[k] ?? 0;
    if (n >= d.pages.length) continue;
    pages()[k] = n + 1;
    markDirty();
    track('diary_page', { key: k, page: n + 1 });
    // 사냥꾼은 아직 일러스트 초상화가 없다 → 그 손님 도트 얼굴로 말한다
    const who = x.kind === 'hunter' ? '@' + x.id : `g_${k}`;
    if (n + 1 === d.pages.length) pending.push(DIARY_DONE.map(([s, t]) => (s === '@self' ? [who, t, undefined, x.name] : [s, t]) as SLine));
    else pending.push([['narr', `서재에서 「${d.title}」 ${n + 1}장을 찾았다 — 도감 「일기」에서 읽을 수 있어요`]]);
  }
}
/** 다음에 보여 줄 일기 대사 */
export const diaryTick = (): SLine[] | null => pending.shift() ?? null;
/** 도감에 쓸 목록: [키, 제목, 펼친 장들, 전체] */
export function diaryList(): { key: string; title: string; pages: string[]; total: number }[] {
  return Object.entries(DIARIES)
    .filter(([k]) => (pages()[k] ?? 0) > 0)
    .map(([k, d]) => ({ key: k, title: d.title, pages: d.pages.slice(0, pages()[k]), total: d.pages.length }));
}

/** DIRECTION §1-1 여정 지도: 다 읽은 일기 수 · 전체 일기 수 */
export function diaryDoneCount(): { done: number; total: number } {
  const all = Object.entries(DIARIES);
  return { done: all.filter(([k, d]) => (pages()[k] ?? 0) >= d.pages.length).length, total: all.length };
}
