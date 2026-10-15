// 공지 창(!): 탭(전체/공지/업데이트/이벤트/제보) + 목록 + 본문. 새 공지가 있으면 빨간 점.
// 기본 공지 + 서버 공지(notices).
import { getPref, setPref } from '../save/save';
import { communityCard } from './community';
import { openWin } from './windows';
import { listNotices } from '../net/server';
import { loadPatchNotes, notesListHtml } from './update';
import { loadNext, nextCardHtml } from './nextCard';
import { letterCredits } from '../net/direction';

interface Notice {
  id: number;
  tag: '공지' | '업데이트' | '이벤트' | '제보';
  t: string;
  d: string;
  b: string;
}

const NOTICES: Notice[] = [
  { id: 6, tag: '업데이트', t: '🌌 v0.25.46 — 정식 오픈! 하늘 균열 · 명품관 · 동물 친구', d: '2026. 10. 15.', b: "· 🌌 하늘 균열: 마을 하늘에 균열이 열리면 모두 함께 하나의 보스를 깎아요. 하루 3번 · 매일 05:00 새 보스.\n· 🗡 전용 무기 19자루: 무기 조각을 모아 선택 상자로 · ★5 영웅이 깨워요.\n· 💎 명품관 · 👗 영웅 의상 · 🐾 동물 친구 · 🏛 마을 회관 · 💌 이웃 방명록이 열렸어요.\n· 🔥 이번 주말(10/17~18) 오픈 기념 버닝: 경험치·골드 2배, 재료 1.5배, 균열 조각 2배, 토벌 +1.\n함께 해 주셔서 고마워요. 즐거운 체크인 되세요!" },
  { id: 5, tag: '업데이트', t: '🌙 v0.25.42 — 마을이 한결 보기 좋아졌어요', d: '2026. 10. 15.', b: "· 처음 여는 여관이 더 가까이, 크게 보여요.\n· 마을 말풍선이 겹치지 않고 하나씩 차례로 떠요. 이름표는 누를 때만 보여요.\n· 휴대폰에서는 키보드 안내 대신 「탭: 다음」과 [건너뛰기] 버튼이 나와요.\n· 티저와 타이틀 화면이 휴대폰 화면을 꽉 채워요.\n· 오른쪽 버튼 줄을 「⋯」 하나로 접었어요(낮밤·소리·사진·UI 끄기는 그 안에).\n· 손님과 펫의 그림자와 외곽선이 또렷해졌어요.\n· 새 음악 9곡과 승리 팡파르 3종이 들어왔어요(지난 업데이트). 반복 사냥 때는 팡파르 대신 작은 동전 소리만 나요.\n화면 설정 「화면 조용히」를 끄면 예전처럼 볼 수 있어요." },
  { id: 4, tag: '공지', t: '용사님, 체크인하실게요~ 마을 v0.1', d: '2026. 10. 10.', b: '단면 탑 대신 쿼터뷰 마을로 바뀌었어요.\n· 건물을 원하는 자리에 짓기\n· 땅 넓히기 1~5단계\n· 건물 레벨업 · 지붕 색 바꾸기\n· 이웃 마을 구경' },
  { id: 3, tag: '업데이트', t: '건물을 누르면 안에 누가 있는지 보여요', d: '2026. 10. 10.', b: '여관, 주점, 온천, 대장간 안에서 쉬고 있는 손님을 확인할 수 있어요. 지붕 위 숫자는 안에 있는 손님 수예요.' },
  { id: 2, tag: '이벤트', t: '주말 던전 보상 2배 (예시)', d: '2026. 10. 11.', b: '예시 공지예요. 이벤트는 다음 단계에서 열려요.' },
  { id: 1, tag: '제보', t: '버그 · 건의는 우체부 모모에게', d: '상시', b: '마을의 모모(머리 위 !)를 누르면 편지를 쓸 수 있어요.' },
];
const TABS = ['전체', '공지', '업데이트', '이벤트', '제보', '패치노트'];

/**
 * HOTFIX18 §4: 업데이트 뒤 첫 실행에 패치 노트 대신 보여 줄 「새로 생긴 것」 — 핵심 2~3개 · [해 보기]
 *  go: 누르면 열 곳 (main이 highlightGo에 채운다)
 */
export type HighlightGo = 'decor' | 'photo' | 'night' | 'build' | 'village' | 'hunt';
export interface Highlight {
  icon: string;
  text: string;
  label: string;
  go: HighlightGo;
}
export const HIGHLIGHTS: Record<string, Highlight[]> = {
  '0.17.7-beta': [
    { icon: '🗺️', text: '땅 6·7단계 — 30×30까지 넓혀요 (재료·장부 7장 필요)', label: '땅 보기', go: 'build' },
  ],
  '0.17.4-beta': [
    { icon: '🌷', text: '새 장식 41종 — 둘레·정원·시장·나무·빛·동물… 땅 단계마다 열려요', label: '장식 보기', go: 'build' },
    { icon: '✨', text: '특별 장식 8종 — 황금 분수 · 영웅 동상 · 축제 불꽃놀이', label: '구경하기', go: 'build' },
    { icon: '📖', text: '장식 도감 — 10·20·41종 모으면 금화와 칭호', label: '구경하기', go: 'build' },
  ],
  '0.17.3-beta': [
    { icon: '🏗️', text: '꾸미기 모드에서 꾹 눌러 들고 옮기기 · ✓✕↻ 버튼이 건물 옆에', label: '꾸며 보기', go: 'decor' },
    { icon: '📦', text: '보관함 — 철거 대신 넣어 두고 언제든 꺼내 놓기', label: '꾸며 보기', go: 'decor' },
    { icon: '📏', text: '직선 길 · 둥근 모서리 · 바닥 채우기 · 자동 길도 지우개로', label: '길 그리기', go: 'decor' },
  ],
  '0.17.1-beta': [
    { icon: '🎨', text: '꾸미기 모드 — 길을 직접 그리고, 연못·꽃밭 바닥, 장식 여러 개 한 번에 옮기기', label: '꾸며 보기', go: 'decor' },
    { icon: '🏘️', text: '이웃 마을 다섯 곳이 새 단장 — 정자·풍차·벚나무 장식 구경', label: '구경 가기', go: 'village' },
    { icon: '📸', text: '사진 모드 — 내 마을을 배경화면 크기로 한 장', label: '찍어 보기', go: 'photo' },
  ],
};
export const highlightGo: Record<HighlightGo, () => void> = { decor: () => {}, photo: () => {}, night: () => {}, build: () => {}, village: () => {}, hunt: () => {} };

let latest = Math.max(...NOTICES.map((n) => n.id));

/** 서버 공지(notices, 운영자가 대시보드에서 씀)를 맨 위에 더한다 */
export async function loadServerNotices() {
  try {
    const rows = await listNotices();
    for (const r of rows) {
      const id = 1000 + r.id;
      if (NOTICES.some((n) => n.id === id)) continue;
      NOTICES.push({ id, tag: '공지', t: esc(r.title), d: new Date(r.created_at).toLocaleDateString('ko-KR'), b: esc(r.body) });
    }
    NOTICES.sort((a, b) => b.id - a.id);
    latest = Math.max(...NOTICES.map((n) => n.id));
    refreshNoticeDot();
  } catch {
    /* 서버가 안 되면 기본 공지만 */
  }
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

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
    `<div id="nxCard"></div><div class="tabs">${TABS.map((t, i) => `<button class="tab ${i ? '' : 'on'}" data-t="${t}">${t}</button>`).join('')}</div><div id="kPin">${communityCard()}</div><div class="nlist">${NOTICES.map(
      (n, i) => `<button class="nrow" data-i="${i}"><span class="tg"></span>[${n.tag}] ${n.t}</button>`,
    ).join('')}</div><div class="nbody" id="nbody"></div>`,
    'wide',
  );
  // DIRECTION §3-2: 맨 위 「다음 업데이트」 카드 (public/next.json · 없으면 안 보임)
  void loadNext().then((n) => {
    const el = document.getElementById('nxCard');
    if (el) el.innerHTML = nextCardHtml(n);
  });
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
        // 패치노트 탭: 버전별로 접고 펼치기 (운영자 공지는 「공지」 탭 그대로)
        const list = document.querySelector<HTMLElement>('.nlist')!;
        list.hidden = t.dataset.t === '패치노트';
        document.getElementById('kPin')!.hidden = t.dataset.t !== '전체' && t.dataset.t !== '공지';
        if (t.dataset.t === '패치노트') {
          // DIRECTION §2-1: 버전마다 반영 크레딧 줄 (서버가 없으면 없이)
          void Promise.all([loadPatchNotes(), letterCredits()]).then(([n, c]) => {
            const el = document.getElementById('nbody');
            if (el) el.innerHTML = notesListHtml(n, c);
          });
          return;
        }
        rows.forEach((r) => (r.hidden = t.dataset.t !== '전체' && NOTICES[+r.dataset.i!].tag !== t.dataset.t));
        const first = rows.find((r) => !r.hidden);
        if (first) show(+first.dataset.i!);
      }),
  );
}
