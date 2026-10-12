// DIRECTION §1-3: 「여관 연대기」 — 엔딩을 볼 때마다 한 쪽 (회차 · 여관 이름 · 엔딩 · 함께한 단골 셋 · 사진 · 회차의 바람)
//  쪽 기록은 저장(P.legacy.chron)에 · 사진은 이 기기 설정('chron.<at>')에 (저장·클라우드 크기를 키우지 않게)
//  옛 저장: 본 엔딩(앨범 · 카드)만큼 한 번 채운다 — 자세한 기록이 없으면 최소한의 쪽
import { endingById } from '../data/endings';
import { MYTHIC } from '../data/story/mythic';
import { markDirty, P, S, world, type Actor, type ChronPage } from './state';

/** 연대기 쪽 수 상한 (아주 오래 하면 오래된 것부터) */
const MAX = 300;

/** 지금 마을에서 가장 친한 단골 셋 (단골·영웅 · 레벨 높은 순 → 오래 묵은 순) */
export function topRegulars(n = 3): ChronPage['regs'] {
  const list = (world.home?.actors ?? world.actors).filter((a: Actor) => !a.role && a.id && (a.status === 'regular' || a.status === 'hero'));
  list.sort((a, b) => b.lvl - a.lvl || (a.id ?? 0) - (b.id ?? 0));
  return list.slice(0, n).map((a) => ({ name: a.name, kind: a.kind, race: a.race }));
}

const chron = (): ChronPage[] => (Array.isArray(P.legacy.chron) ? P.legacy.chron : (P.legacy.chron = []));

/** 엔딩을 볼 때 한 쪽 (같은 시각 같은 엔딩은 한 번만) */
export function addChronicle(ending: string, at = Date.now()): ChronPage {
  const list = chron();
  const dup = list.find((c) => c.ending === ending && c.gen === P.legacy.gen && !c.old);
  if (dup) return dup;
  const page: ChronPage = { at, gen: P.legacy.gen, inn: S.innName || '이름 없는 여관', ending, regs: topRegulars(), wind: typeof P.story.wind === 'string' ? P.story.wind : '' };
  list.push(page);
  if (list.length > MAX) list.splice(0, list.length - MAX);
  markDirty();
  return page;
}

/** 옛 저장: 앨범에 있는 엔딩마다 쪽이 없으면 (카드가 있으면 그 기록으로) 한 번 채운다 */
export function backfillChronicle(): number {
  const L = P.legacy;
  if (L.chronV) return 0;
  L.chronV = true;
  const list = chron();
  let n = 0;
  for (const id of Array.isArray(L.album) ? L.album : []) {
    if (!endingById(id) || list.some((c) => c.ending === id)) continue;
    const card = L.cards?.[id];
    const fav = card?.fav ? (world.home?.actors ?? world.actors).find((a) => !a.role && a.name === card.fav) : undefined;
    list.push({
      at: card?.at ?? 0,
      gen: card?.gen ?? 1,
      inn: S.innName || '이름 없는 여관',
      ending: id,
      regs: card?.fav ? [{ name: card.fav, kind: fav?.kind ?? card.job ?? 'knight', race: fav?.race }] : [],
      wind: '',
      old: true,
    });
    n++;
  }
  list.sort((a, b) => a.at - b.at || a.gen - b.gen);
  markDirty();
  return n;
}

/** 이 회차에 만난 신화를 회차를 넘어 기억 (새 회차가 P.story.mythic을 비우기 전에) */
export function keepMythicMet() {
  const L = P.legacy;
  if (!Array.isArray(L.mythicMet)) L.mythicMet = [];
  for (const m of MYTHIC) if (P.story.mythic?.[m.key]?.met && !L.mythicMet.includes(m.key)) L.mythicMet.push(m.key);
}
