// 유저 톡방 (카카오톡 오픈채팅): 주소는 CONFIG.community.kakao 한 곳 · 늘 새 창(외부 브라우저/카카오톡) · 자동 팝업 없음
//  누를 때 play_events에 community_click {from}
import { CONFIG } from '../data/config';
import { track } from '../net/telemetry';
import { flag } from '../world/flags';

/** 톡방 링크를 게임 안에 보일까 (flag communityLinks · 꺼지면 메뉴·공지 카드·편지 링크·제보 폼 줄 모두 숨김) */
export const communityOn = () => flag('communityLinks');

/** 톡방 링크 (a 태그) — 누르면 기록은 아래 문서 클릭 리스너가 */
export const communityLink = (from: string, label: string, cls = 'kakao') =>
  !communityOn() ? '' : `<a class="${cls}" href="${CONFIG.community.kakao}" target="_blank" rel="noopener noreferrer" data-cm="${from}">${label}</a>`;

/** 채굴 스핀오프로 가는 버튼 (a 태그 · 새 탭) — 누르면 play_events 에 mine_click {from} */
export const mineButton = (from: string) =>
  `<a class="mineGo" href="${CONFIG.mine.url}" target="_blank" rel="noopener noreferrer" data-mine="${from}">⛏ 채굴하러 가기</a>`;

/** 이미 이스케이프된 본문 속 http(s) 주소를 눌리는 링크로 (새 탭). 끝의 문장부호는 링크에서 뺀다 */
export const linkify = (html: string) =>
  html.replace(/https?:\/\/[^\s<]+/g, (m) => {
    const tail = m.match(/[.,!?)\]…]+$/)?.[0] ?? '';
    const url = tail ? m.slice(0, -tail.length) : m;
    return `<a class="nlink" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${tail}`;
  });

/** 메뉴 버튼 등 a 태그가 아닌 곳에서 열 때 */
export function openCommunity(from: string) {
  if (!communityOn()) return;
  track('community_click', { from });
  window.open(CONFIG.community.kakao, '_blank', 'noopener,noreferrer');
}

let bound = false;
/** 톡방 링크 누름 기록 (한 번만 묶는다) */
export function initCommunity() {
  if (bound) return;
  bound = true;
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[data-cm]') as HTMLAnchorElement | null;
      if (a) track('community_click', { from: a.dataset.cm });
      const m = (e.target as HTMLElement | null)?.closest?.('a[data-mine]') as HTMLAnchorElement | null;
      if (m) track('mine_click', { from: m.dataset.mine });
    },
    true,
  );
}

/** 새 소식 「공지」 맨 위 고정 카드 */
export const communityCard = () =>
  !communityOn() ? '' : `<div class="kcard"><b>💬 용사님들 모이는 카톡방이 생겼어요!</b><small>제보·수다·꿀팁 환영</small>${communityLink('notice', '들어가기', 'kakao kbtn')}</div>`;
