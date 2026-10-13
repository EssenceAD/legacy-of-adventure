// LAND2: 땅 넓히기 조건 — 금화 · 지역 재료 · 보스 재료 · 평판 ★(또는 ★ + 별의 심연 돌파) · 장부 장
import { bigNum, vis } from './visual';
import { CONFIG } from '../data/config';
import { BOSSES } from '../data/bosses';
import { REGIONS, type RegionId } from '../data/items';
import { chaptersDone } from './guide';
import { stars } from './progress';
import { P, S } from './state';

export interface LandReq {
  text: string;
  ok: boolean;
}
// VISUAL §5 uiKitV2(실험실)면 큰 수 줄임(bigNum) · 끄면 예전 그대로
const fmt = (n: number) => (vis('uiKitV2') ? bigNum(n) : n.toLocaleString('ko-KR'));

/** l단계로 넓히는 데 필요한 것 (한 줄씩 · 됐는지) */
export function landReqs(l: number): LandReq[] {
  const L = CONFIG.land[l - 1];
  if (!L) return [];
  const out: LandReq[] = [];
  const need = CONFIG.landStars[l - 1] ?? 0;
  const alt = L.starsAlt;
  if (need) {
    const okStar = stars() >= need || (!!alt && stars() >= alt.stars && (P.hunt.best.abyss ?? 0) >= alt.abyss);
    out.push({ text: alt ? `평판 ★${need} (또는 ★${alt.stars} + 별의 심연 ${alt.abyss} 돌파)` : `평판 ★${need}`, ok: okStar });
  }
  if (L.chapter) out.push({ text: `버나드의 장부 ${L.chapter}장`, ok: chaptersDone() >= L.chapter });
  out.push({ text: `금화 ${fmt(L.cost)}`, ok: S.gold >= L.cost });
  for (const [r, n] of Object.entries(L.mats ?? {}) as [RegionId, number][]) {
    const reg = REGIONS.find((x) => x.id === r)!;
    out.push({ text: `${reg.mat} ${fmt(n)} (${fmt(P.mats[r] ?? 0)})`, ok: (P.mats[r] ?? 0) >= n });
  }
  for (const [b, n] of Object.entries(L.bossMats ?? {})) {
    const bd = BOSSES.find((x) => x.id === b);
    out.push({ text: `${bd?.mat ?? b} ${n} (${P.bossMats[b] ?? 0})`, ok: (P.bossMats[b] ?? 0) >= n });
  }
  return out;
}
/** 못 넓히는 까닭 (되면 null) */
export function landWhy(l: number): string | null {
  const bad = landReqs(l).find((r) => !r.ok);
  return bad ? `${bad.text}이(가) 필요해요` : null;
}
/** 재료·금화를 낸다 (landWhy가 null일 때만) */
export function payLand(l: number) {
  const L = CONFIG.land[l - 1];
  S.gold -= L.cost;
  for (const [r, n] of Object.entries(L.mats ?? {}) as [RegionId, number][]) P.mats[r] = (P.mats[r] ?? 0) - n;
  for (const [b, n] of Object.entries(L.bossMats ?? {})) P.bossMats[b] = (P.bossMats[b] ?? 0) - n;
}
