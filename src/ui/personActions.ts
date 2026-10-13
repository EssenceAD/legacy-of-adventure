// K9 · 「사람 행동은 어느 입구에서 열어도 같은 버튼 묶음」 — 사람 버튼 부품 하나
//  지금: 손님·영웅 상세 창의 [말 걸기] [선물하기] (마을에서 누르는 작은 메뉴 personMenu와 같은 행동)
//  v0.25.4 (personActionsV2): 말 걸기·선물하기는 이 파일의 talkPerson · giftPerson 하나로 — 마을 작은 메뉴 · 손님 상세 · 인연 창(owner openTie) 모두
//  다음(J6·J7·J8): 정보·장비·파티·작별을 같은 부품으로 — 표는 reports/checkin/actions.md
import type { Actor } from '../world/state';
import { P, S, world } from '../world/state';
import { flag } from '../world/flags';
import { vis } from '../world/visual';
import { talkTo, tieAvailable } from '../world/owner';
import { giftable, talkRoute } from '../world/personRoute';
import { bondIdOf, openGiftPick } from './personMenu';
import { talkGuest } from './guests';
import { talk } from './dialogue';
import { closeWin, toast } from './windows';

/** 이 사람에게 지금 보일 버튼들 (talk = 말 걸기를 이 창이 그린다) */
export function personActionsHtml(a: Actor, o: { talk: boolean }): string {
  if (S.visiting || a.runId != null) return '';
  const talkB = o.talk ? '<button class="bigbtn sm" id="aTalk">말 걸기</button>' : '';
  const v2 = vis('personActionsV2');
  const bid = v2 ? bondIdOf(a) : null;
  const canGift = v2 ? !!P.owner && giftable(a.status, bid, !!bid && tieAvailable(bid)) : flag('heroDetailGift') && (a.status === 'regular' || a.status === 'hero');
  const gift = canGift ? '<button class="bigbtn sm" id="aGift">선물하기</button>' : '';
  return talkB + gift;
}
/** 버튼 연결 (말 걸기는 부르는 쪽 함수를 받는다 · personActionsV2면 늘 talkPerson) */
export function bindPersonActions(a: Actor, talkFn: (a: Actor) => void) {
  const t = document.getElementById('aTalk');
  if (t) t.onclick = () => (vis('personActionsV2') ? talkPerson(a) : talkFn(a));
  const g = document.getElementById('aGift');
  if (g) g.onclick = () => openGiftPick(a);
}

/** 인연 id로 마을에 있는 그 사람 (영웅·전설 · 모모) */
export function actorOfBond(bid: string): Actor | null {
  const list = world.home?.actors ?? world.actors;
  if (bid === 'momo') return list.find((x) => x.role === 'npc') ?? null;
  return list.find((x) => !x.role && (x.legendId === bid || x.heroId === bid)) ?? null;
}

const MOMO_HI = '주인님! 오늘도 배달 열심히 할게요~';
/**
 * 말 걸기 한 함수: 인연이 있으면 하루 한 번 인연 대화(힌트 포함) → 이미 했거나 못 하면 그냥 한마디(손님) → 모모는 인사
 *  a = 마을 사람 (인연 창에서 마을에 없는 사람이면 null + bid)
 */
export function talkPerson(a: Actor | null, bidIn?: string | null) {
  const bid = bidIn ?? (a ? bondIdOf(a) : null);
  const bondOk = !!bid && !!P.owner && tieAvailable(bid);
  const r = talkRoute(a, bid, bondOk);
  if (r === 'bond') {
    // 인연 대화는 창 위에 겹치지 않게 먼저 닫는다
    const err = talkTo(bid!);
    if (!err) return closeWin();
    if (a?.id) return talkGuest(a);
    if (a?.role === 'npc') return closeWin(), talk([['post', MOMO_HI]]);
    return toast(err);
  }
  if (r === 'guest') return talkGuest(a!);
  if (r === 'npc') return closeWin(), talk([['post', MOMO_HI]]);
  toast(bid && !tieAvailable(bid) ? '아직 인연을 쌓을 수 없어요' : '지금은 이야기할 수 없어요');
}

/** 선물하기 한 함수: 같은 선물 고르기 창 (마을에 없는 인연은 bid로) */
export function giftPerson(a: Actor | null, bid?: string) {
  openGiftPick(a, bid);
}
