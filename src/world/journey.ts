// DIRECTION §1-1: 「여정」 — 완주가 보이게. 지역 · 엔딩 · 신화 · 손님 일기 · 고유 장비 · 물고기 · 어울림
//  다 채우면 칭호 「이야기의 끝을 본 주인」 + 여관 간판 금테 (P.legacy.journeyEnd — 한 번 채우면 남는다)
import { CONFIG } from '../data/config';
import { HARMONIES } from '../data/harmony';
import { REGIONS } from '../data/items';
import { FISH } from '../data/story/fish';
import { MYTHIC } from '../data/story/mythic';
import { UNIQUES } from '../data/story/uniques';
import { onNewDay } from './clock';
import { diaryDoneCount } from './diary';
import { markDirty, P } from './state';

export type JourneyKey = 'regions' | 'endings' | 'mythic' | 'diaries' | 'uniques' | 'fish' | 'harmony';
export interface JourneyCell {
  key: JourneyKey;
  name: string;
  icon: string;
  cur: number;
  total: number;
  /** 무엇을 세는지 한 줄 */
  how: string;
}

/** 지금 여정 칸들 (회차를 넘어 남는 기록으로 센다) */
export function journeyCells(): JourneyCell[] {
  const stages = CONFIG.hunt.stages;
  const regions = REGIONS.filter((r) => (P.hunt.best[r.id] ?? 0) >= stages).length;
  const endings = new Set((P.legacy.album ?? []).filter((id) => id.startsWith('story_'))).size;
  const myth = new Set([...(P.legacy.mythicMet ?? []), ...MYTHIC.filter((m) => P.story.mythic?.[m.key]?.met).map((m) => m.key)]).size;
  const di = diaryDoneCount();
  const uq = UNIQUES.filter((u) => (P.growth.uniques?.[u.id] ?? 0) > 0).length;
  const fish = FISH.filter((f) => (P.growth.fish?.rec?.[f.id]?.n ?? 0) > 0).length;
  const harm = new Set(P.harmony.found ?? []).size;
  return [
    { key: 'regions', name: '지역', icon: '🗺️', cur: regions, total: REGIONS.length, how: `지역 보스(x-${stages})를 쓰러뜨린 곳` },
    { key: 'endings', name: '엔딩', icon: '📖', cur: Math.min(endings, CONFIG.direction.endings), total: CONFIG.direction.endings, how: '갈림길에서 본 이야기의 끝' },
    { key: 'mythic', name: '신화 영웅', icon: '✦', cur: Math.min(myth, MYTHIC.length), total: MYTHIC.length, how: '기억을 되찾고 찾아온 영웅' },
    { key: 'diaries', name: '손님 일기', icon: '📔', cur: di.done, total: di.total, how: '끝까지 읽은 일기' },
    { key: 'uniques', name: '고유 장비', icon: '⚔️', cur: uq, total: UNIQUES.length, how: '한 번이라도 얻은 고유 장비' },
    { key: 'fish', name: '물고기', icon: '🐟', cur: fish, total: FISH.length, how: '낚아 본 물고기' },
    { key: 'harmony', name: '어울림', icon: '🌿', cur: Math.min(harm, HARMONIES.length), total: HARMONIES.length, how: '발견한 어울림' },
  ];
}

export const journeyComplete = (cells = journeyCells()) => cells.every((c) => c.cur >= c.total);

/** 다 채웠으면 한 번 표시 (칭호 · 간판 금테) — 바뀌면 true */
export function syncJourney(): boolean {
  if (P.legacy.journeyEnd || !journeyComplete()) return false;
  P.legacy.journeyEnd = true;
  markDirty();
  return true;
}
onNewDay(() => void syncJourney());
