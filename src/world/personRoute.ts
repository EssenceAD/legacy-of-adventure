// v0.25.4 K9 「말 걸기·선물하기 한 함수」 (플래그 personActionsV2) — 어느 입구든 같은 규칙
//  말 걸기: 인연이 있고 오늘 인연 대화를 할 수 있으면 인연 대화 → 아니면 그냥 한마디(손님) → 손님이 아니면(모모·마을에 없는 인연) 인연 대화의 이유
//  선물하기: 같은 선물 고르기 창 — 줄 수 있는 사람 = 인연이 있는 사람(열린 인연) 또는 단골·영웅
export type TalkRoute = 'bond' | 'guest' | 'npc' | 'none';
export interface TalkWho {
  /** 마을 사람 id (손님 · 단골 · 영웅 · 전설). 모모·인연 창의 「마을에 없는 사람」은 없음 */
  id?: number;
  role?: string;
}
/**
 * @param bid 인연 id (없으면 null)
 * @param bondOk 인연 대화를 지금 할 수 있나 (주인 있음 · 인연 열림 · 오늘 아직 · 행동력)
 */
export function talkRoute(who: TalkWho | null, bid: string | null, bondOk: boolean): TalkRoute {
  if (bid && bondOk) return 'bond';
  if (who?.id) return 'guest';
  if (who?.role === 'npc') return 'npc';
  return 'none';
}
/** 선물하기 버튼을 보일 사람 */
export function giftable(status: string | undefined, bid: string | null, bondOpen: boolean): boolean {
  if (bid) return bondOpen;
  return status === 'regular' || status === 'hero';
}
