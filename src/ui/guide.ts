// 5단계 1장: 왼쪽 위 임무 카드(제목 · 진행도 · 보상 아이콘) + 손가락 안내(톡톡)
// 카드를 누르면: 다 했으면 받기(버나드 한마디 → 다음 임무), 아니면 그곳을 열고 손가락이 버튼을 가리킨다.
// 1~3장은 창이 없을 때 손가락이 저절로 다음 버튼을 가리킨다.
import { CHAPTERS, GRADE_NAMES } from '../data/guide';
import { clock, conLeft } from '../world/construct';
import { chapterOf, claimMission, currentMission, guideHooks, missionProgress, rewardText, skipDone } from '../world/guide';
import { P, S, uiHooks, type TalkLine } from '../world/state';
import { huntCrew } from '../world/hunt';
import { josa } from '../data/josa';
import { startGradeAnim } from '../world/grade';
import { tempZoom } from './hud';
import { sfx } from './battle';
import { $, esc } from './common';
import { isTalking, talk } from './dialogue';
import { findKind } from '../world/town';
import { hasSpot } from '../world/tidy';
import { iconSrc, px, uiSrc } from './kit';
import { openPlace, PLACE_BTN, type Place } from './nav';
import { isWinOpen } from './windows';

let handTarget: string | null = null;
let handUntil = 0;

export function initGuide() {
  guideHooks.chapterDone = (no) => {
    const c = chapterOf(no);
    sfx('chapter');
    uiHooks.announce(`★ ${S.innName || '여관'}${josa(S.innName || '여관', '가')} 장부 ${no}장 「${c.name}」${josa(c.name, '을')} 마쳤습니다!`);
    queueChapter(no);
  };
  guideHooks.gradeUp = (g) => (pendingGrade = g);
  $('#mission').onclick = onCard;
  // 손가락: 0.4초마다 두 그림을 바꿔 톡톡
  let f = 0;
  setInterval(() => {
    if (document.hidden) return;
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
/** 마을 등급이 오를 때: 줌아웃 → 새 모습이 위에서 아래로 덮어쓰기(1.5초) → 종소리 자리 → 「○○ 여관이 '마을'이 되었습니다」 + [알림] */
let pendingGrade = -1;
export function playGradeUp(to: number, then: () => void) {
  if (S.visiting) return then();
  const from = Math.max(0, to - 1);
  const z0 = S.zoom;
  tempZoom(1);
  startGradeAnim(from, to);
  sfx('grade_up');
  setTimeout(() => {
    const name = `${S.innName || '여관'}`;
    const b = document.createElement('div');
    b.className = 'gradeban';
    b.innerHTML = `<small>마을 등급</small><b>${esc(name)}${josa(name, '이')} 「${GRADE_NAMES[to]}」${josa(GRADE_NAMES[to], '가')} 되었습니다</b>`;
    document.getElementById('view')!.appendChild(b);
    uiHooks.announce(`★ ${name}${josa(name, '이')} 「${GRADE_NAMES[to]}」${josa(GRADE_NAMES[to], '가')} 되었습니다!`);
    setTimeout(() => b.remove(), 2600);
  }, 1500);
  setTimeout(() => {
    tempZoom(z0);
    then();
  }, 3200);
}

function playChapterEnd(no: number, then: () => void) {
  const c = chapterOf(no);
  if (c.grade != null && pendingGrade === c.grade) {
    pendingGrade = -1;
    return playGradeUp(c.grade, () => playChapterEnd(no, then));
  }
  const lines: TalkLine[] = [['narr', `장부 ${no}장 「${c.name}」 완료!`], ['narr', `장 보상 — ${c.rewardText}`]];
  if (c.grade != null) lines.push(['narr', `마을 등급이 「${GRADE_NAMES[c.grade]}」${josa(GRADE_NAMES[c.grade], '가')} 되었다!`]);
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
  if (!m) {
    const g = growthGoal();
    if (g) openPlace(g.place);
    return;
  }
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
  // 핫픽스 8 (2-10): 「자동 사냥 켜 보기」는 깬 스테이지의 사냥 준비 창을 열고 「자동 사냥 켜기」를 가리킨다
  if (m.id === 'c2_auto' && guideHooks.autoHuntPrep()) {
    point('#hRepeat', 3200);
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

/** 사냥·토벌 임무인데 단골이 모두 원정 중이면: 가장 빨리 돌아오는 시간 */
function waitNote(place: string): string {
  if (place !== 'hunt' && place !== 'raid') return '';
  if (huntCrew().length) return '';
  const runs = P.runs.filter((r) => !r.result);
  if (!runs.length) return '';
  const s = Math.max(0, Math.ceil((Math.min(...runs.map((r) => r.end)) - Date.now()) / 1000));
  return ` · 단골 귀환까지 ${s}초`;
}

/** 0.5초마다 (hud): 카드 글자 · 반짝 · 손가락 자리 */
// ───────── 땅 개편 §11-3: 장부를 다 마친 뒤에도 카드가 비지 않게 — 성장 목표 (보상 없음 · 이루면 다음으로) ─────────
const lvOf = (k: string) => findKind(k as never)?.lvl ?? 0;
const GROWTH: { title: string; cur: () => number; need: number; place: Place; kind?: string }[] = [
  { title: '여관 본관 Lv.5 만들기', cur: () => lvOf('inn'), need: 5, place: 'inn', kind: 'inn' },
  { title: '땅 4단계로 넓히기', cur: () => S.land, need: 4, place: 'land' },
  { title: '주점 Lv.4 만들기', cur: () => lvOf('tavern'), need: 4, place: 'tavern', kind: 'tavern' },
  { title: '온천 Lv.3 만들기', cur: () => lvOf('bath'), need: 3, place: 'build', kind: 'bath' },
  { title: '여관 본관 Lv.8 만들기', cur: () => lvOf('inn'), need: 8, place: 'inn', kind: 'inn' },
  { title: '땅 5단계로 넓히기', cur: () => S.land, need: 5, place: 'land' },
  { title: '주점 Lv.6 만들기', cur: () => lvOf('tavern'), need: 6, place: 'tavern', kind: 'tavern' },
  { title: '여관 본관 Lv.10 만들기', cur: () => lvOf('inn'), need: 10, place: 'inn', kind: 'inn' },
];
/** CONSTRUCTION_SPEC §5: 목표 건물이 공사 중이면 「공사 중 · 2:41」 */
function conLine(kind?: string): string | null {
  const o = kind ? findKind(kind as never) : null;
  return o?.con ? `공사 중 · ${clock(conLeft(o))}` : null;
}
export const growthGoal = () => GROWTH.find((g) => g.cur() < g.need) ?? null;

export function syncGuide(force = false) {
  const card = $('#mission');
  const m = currentMission();
  // 장부를 다 마쳤으면 성장 목표 카드
  if (!m && S.started && !S.visiting && !document.querySelector('.battle, .cbt')) {
    const g = growthGoal();
    if (g) {
      card.hidden = false;
      card.classList.remove('done');
      const html = `<img class="mi" src="${iconSrc('m_quest')}" alt=""><span><small>성장 목표</small><b>${esc(g.title)}</b><em>${conLine(g.kind) ?? `${Math.min(g.cur(), g.need)}/${g.need}`}</em></span>`;
      if (card.innerHTML !== html) card.innerHTML = html;
      hideHand();
      return;
    }
  }
  // 전투 화면(토벌·사냥)이 떠 있으면 숨긴다
  if (!S.started || S.visiting || !m || document.querySelector('.battle, .cbt')) {
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
  // 핫픽스 8: 건설 임무인데 지금 땅에 놓을 자리가 없으면 알려 준다 (누르면 건설 → 자리 정리 도우미)
  const cramped = !pr.done && m.build && !findKind(m.build) && !hasSpot(m.build);
  card.innerHTML = `<img class="mi" src="${iconSrc('m_quest')}" alt=""><span><small>장부 ${ch.no}장 ${inCh}/${ch.missions.length}</small><b>${esc(m.title)}</b><em>${pr.done ? '완료! 눌러서 받기' : cramped ? '자리 부족 · 눌러서 정리' : `${pr.cur}/${pr.need}${waitNote(m.place)}`}</em></span><img class="rw" src="${iconSrc(m.reward.tokens ? 'cur_token' : m.reward.dust && !m.reward.gold ? 'cur_dust_n' : 'cur_gold')}" alt="" title="${esc(rewardText(m))}">`;
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
