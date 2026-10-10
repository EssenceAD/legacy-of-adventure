// 5단계 1장: 왼쪽 위 임무 카드(제목 · 진행도 · 보상 아이콘) + 손가락 안내(톡톡)
// 카드를 누르면: 다 했으면 받기(버나드 한마디 → 다음 임무), 아니면 그곳을 열고 손가락이 버튼을 가리킨다.
// 1~3장은 창이 없을 때 손가락이 저절로 다음 버튼을 가리킨다.
import { CHAPTERS, GRADE_NAMES } from '../data/guide';
import { chapterOf, claimMission, currentMission, guideHooks, missionProgress, rewardText, skipDone } from '../world/guide';
import { P, S, uiHooks, type TalkLine } from '../world/state';
import { $, esc } from './common';
import { isTalking, talk } from './dialogue';
import { iconSrc, px, uiSrc } from './kit';
import { openPlace, PLACE_BTN } from './nav';
import { isWinOpen } from './windows';

let handTarget: string | null = null;
let handUntil = 0;

export function initGuide() {
  guideHooks.chapterDone = (no) => {
    const c = chapterOf(no);
    uiHooks.announce(`★ ${S.innName || '여관'}이(가) 장부 ${no}장 「${c.name}」을 마쳤습니다!`);
    queueChapter(no);
  };
  $('#mission').onclick = onCard;
  // 손가락: 0.4초마다 두 그림을 바꿔 톡톡
  let f = 0;
  setInterval(() => {
    f ^= 1;
    const h = document.getElementById('hand') as HTMLImageElement | null;
    if (h && !h.hidden) h.src = uiSrc(f ? 'hand_1' : 'hand_0');
  }, 400);
}

/** 장 끝: 큰 보상 연출 + 다음 장 컷 */
let chapterQueue: number[] = [];
function queueChapter(no: number) {
  chapterQueue.push(no);
}
function playChapterEnd(no: number, then: () => void) {
  const c = chapterOf(no);
  const lines: TalkLine[] = [['narr', `장부 ${no}장 「${c.name}」 완료!`], ['narr', `장 보상 — ${c.rewardText}`]];
  if (c.grade != null) lines.push(['narr', `마을 등급이 「${GRADE_NAMES[c.grade]}」이 되었다!`]);
  talk(lines, then);
}
/** 새 장 시작 컷 (2~3줄) */
function playCut(then: () => void) {
  const m = currentMission();
  if (!m || P.guide.cut >= m.ch) return then();
  P.guide.cut = m.ch;
  const c = chapterOf(m.ch);
  talk([['narr', `버나드의 장부 · ${c.no}장 「${c.name}」`], ...c.cut.map((t) => ['keeper', t, undefined, '노주인 버나드'] as TalkLine)], then);
}

function onCard() {
  if (isTalking()) return;
  const m = currentMission();
  if (!m) return;
  const pr = missionProgress(m);
  if (pr.done) {
    const lines = claimMission();
    talk(lines, () => {
      const ends = chapterQueue;
      chapterQueue = [];
      const next = () => {
        const no = ends.shift();
        if (no == null) {
          skipDone();
          playCut(() => syncGuide(true));
          return;
        }
        playChapterEnd(no, next);
      };
      next();
    });
    return;
  }
  // 가기 + 손가락
  openPlace(m.place);
  point(PLACE_BTN[m.place] ?? null, 2600);
}

/** 손가락이 이 버튼을 잠깐(ms) 가리킨다 */
export function point(sel: string | null, ms = 2600) {
  handTarget = sel;
  handUntil = Date.now() + ms;
}

/** 0.5초마다 (hud): 카드 글자 · 반짝 · 손가락 자리 */
export function syncGuide(force = false) {
  const card = $('#mission');
  const m = currentMission();
  // 전투 화면(토벌·사냥)이 떠 있으면 숨긴다
  if (!S.started || S.visiting || !m || document.querySelector('.battle')) {
    card.hidden = true;
    hideHand();
    return;
  }
  // 새 장 컷이 아직이면 (창·대화가 없을 때) 먼저
  if (P.guide.cut < m.ch && !isTalking() && !isWinOpen() && !force) {
    if (P.guide.idx === 0 || P.guide.claimed.length) playCut(() => syncGuide(true));
    else P.guide.cut = m.ch;
  }
  const pr = missionProgress(m);
  card.hidden = false;
  card.classList.toggle('done', pr.done);
  const ch = chapterOf(m.ch);
  const inCh = ch.missions.findIndex((x) => x.id === m.id) + 1;
  card.innerHTML = `<img class="mi" src="${iconSrc('m_quest')}" alt=""><span><small>장부 ${ch.no}장 ${inCh}/${ch.missions.length}</small><b>${esc(m.title)}</b><em>${pr.done ? '완료! 눌러서 받기' : `${pr.cur}/${pr.need}`}</em></span><img class="rw" src="${iconSrc(m.reward.tokens ? 'cur_token' : m.reward.dust && !m.reward.gold ? 'cur_dust_n' : 'cur_gold')}" alt="" title="${esc(rewardText(m))}">`;
  // 손가락: 1~3장은 창·대화가 없을 때 저절로, 그 뒤엔 카드를 눌렀을 때만
  const auto = m.ch <= 3 && !pr.done && !isWinOpen() && !isTalking();
  const sel = Date.now() < handUntil ? handTarget : auto ? PLACE_BTN[m.place] ?? null : pr.done ? '#mission' : null;
  placeHand(sel);
}

function hideHand() {
  const h = document.getElementById('hand');
  if (h) h.hidden = true;
}
function placeHand(sel: string | null) {
  const h = document.getElementById('hand') as HTMLImageElement | null;
  const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null;
  if (!h || !el || !el.offsetParent || isTalking()) return hideHand();
  const host = document.getElementById('view')!.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  // 버튼 오른쪽 아래 모서리에 손가락 끝 (정수 px)
  h.style.left = px(r.left - host.left + r.width * 0.55) + 'px';
  h.style.top = px(r.top - host.top + r.height * 0.45) + 'px';
  h.hidden = false;
}

export const guideTotal = () => `${P.guide.claimed.length}/${CHAPTERS.reduce((s, c) => s + c.missions.length, 0)}`;
