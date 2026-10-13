// K9 · 「사람 행동은 어느 입구에서 열어도 같은 버튼 묶음」 — 사람 버튼 부품 하나
//  지금: 손님·영웅 상세 창의 [말 걸기] [선물하기] (마을에서 누르는 작은 메뉴 personMenu와 같은 행동)
//  다음(C·J6·J7·J8): 정보·장비·파티·작별을 같은 부품으로 — 표는 reports/checkin/actions.md
import type { Actor } from '../world/state';
import { S } from '../world/state';
import { flag } from '../world/flags';
import { openGiftPick } from './personMenu';

/** 이 사람에게 지금 보일 버튼들 (talk = 말 걸기를 이 창이 그린다) */
export function personActionsHtml(a: Actor, o: { talk: boolean }): string {
  if (S.visiting || a.runId != null) return '';
  const talk = o.talk ? '<button class="bigbtn sm" id="aTalk">말 걸기</button>' : '';
  const gift = flag('heroDetailGift') && (a.status === 'regular' || a.status === 'hero') ? '<button class="bigbtn sm" id="aGift">선물하기</button>' : '';
  return talk + gift;
}
/** 버튼 연결 (말 걸기는 부르는 쪽 함수를 받는다) */
export function bindPersonActions(a: Actor, talk: (a: Actor) => void) {
  const t = document.getElementById('aTalk');
  if (t) t.onclick = () => talk(a);
  const g = document.getElementById('aGift');
  if (g) g.onclick = () => openGiftPick(a);
}
