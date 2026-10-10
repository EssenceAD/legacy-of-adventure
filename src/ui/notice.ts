// 공지 창(!): 탭(전체/공지/업데이트/이벤트/제보) + 목록 + 본문. 새 공지가 있으면 빨간 점.
// 지금은 가짜 데이터 — 나중에 서버(공지 관리)에서 받아온다.
import { getPref, setPref } from '../save/save';
import { openWin } from './windows';

interface Notice {
  id: number;
  tag: '공지' | '업데이트' | '이벤트' | '제보';
  t: string;
  d: string;
  b: string;
}

const NOTICES: Notice[] = [
  { id: 4, tag: '공지', t: '모험의 유산 마을 v0.1', d: '2026. 10. 10.', b: '단면 탑 대신 쿼터뷰 마을로 바뀌었어요.\n· 건물을 원하는 자리에 짓기\n· 땅 넓히기 1~5단계\n· 건물 레벨업 · 지붕 색 바꾸기\n· 이웃 마을 구경' },
  { id: 3, tag: '업데이트', t: '건물을 누르면 안에 누가 있는지 보여요', d: '2026. 10. 10.', b: '여관, 주점, 온천, 대장간 안에서 쉬고 있는 손님을 확인할 수 있어요. 지붕 위 숫자는 안에 있는 손님 수예요.' },
  { id: 2, tag: '이벤트', t: '주말 던전 보상 2배 (예시)', d: '2026. 10. 11.', b: '예시 공지예요. 이벤트는 다음 단계에서 열려요.' },
  { id: 1, tag: '제보', t: '버그 · 건의는 우체부 모모에게', d: '상시', b: '마을의 모모(머리 위 !)를 누르면 편지를 쓸 수 있어요.' },
];
const TABS = ['전체', '공지', '업데이트', '이벤트', '제보'];
const latest = Math.max(...NOTICES.map((n) => n.id));

const dot = () => document.querySelector<HTMLElement>('#bNotice .dot')!;

/** 안 읽은 공지가 있으면 빨간 점 */
export function refreshNoticeDot() {
  dot().hidden = getPref('noticeSeen', 0) >= latest;
}

export function openNotices() {
  setPref('noticeSeen', latest);
  dot().hidden = true;
  openWin(
    '새 소식',
    `<div class="tabs">${TABS.map((t, i) => `<button class="tab ${i ? '' : 'on'}" data-t="${t}">${t}</button>`).join('')}</div><div class="nlist">${NOTICES.map(
      (n, i) => `<button class="nrow" data-i="${i}"><span class="tg"></span>[${n.tag}] ${n.t}</button>`,
    ).join('')}</div><div class="nbody" id="nbody"></div>`,
    'wide',
  );
  const rows = [...document.querySelectorAll<HTMLElement>('.nrow')];
  const show = (i: number) => {
    const n = NOTICES[i];
    document.getElementById('nbody')!.innerHTML = `<b>${n.t}</b><small>${n.tag} · ${n.d}</small><p>${n.b.replace(/\n/g, '<br>')}</p>`;
    rows.forEach((r) => r.classList.toggle('on', +r.dataset.i! === i));
  };
  show(0);
  rows.forEach((r) => (r.onclick = () => show(+r.dataset.i!)));
  const tabs = [...document.querySelectorAll<HTMLElement>('.tab')];
  tabs.forEach(
    (t) =>
      (t.onclick = () => {
        tabs.forEach((x) => x.classList.toggle('on', x === t));
        rows.forEach((r) => (r.hidden = t.dataset.t !== '전체' && NOTICES[+r.dataset.i!].tag !== t.dataset.t));
        const first = rows.find((r) => !r.hidden);
        if (first) show(+first.dataset.i!);
      }),
  );
}
