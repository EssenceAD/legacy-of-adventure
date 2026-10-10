// 베타 1장: 어울림 화면 — 발견 배너 · 「어울림 보기」 토글 · 마을 등급 장식 옮기기 · 건물 창의 어울림 줄
import { def, type Kind } from '../data/catalog';
import { harmonyById } from '../data/harmony';
import { advanceHint, dailyHarmonyRep, harmonyHooks, hintText, setsOf, type HSet } from '../world/harmony';
import { harmonyAnim } from '../world/harmonyDraw';
import { MOVABLE_PROPS, propKey, type Prop } from '../world/grade';
import { onNewDay } from '../world/clock';
import { markDirty, P, S, uiHooks, type Building } from '../world/state';
import { iconSrc } from './kit';
import { sfx } from './battle';
import { closeWin, objExtra, openWin } from './windows';
import { startPlace } from './hud';
import { esc } from './common';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const fmt = (n: number) => n.toLocaleString('ko-KR');

/** 발견 연출 차례 (한 번에 하나씩) */
const queue: { s: HSet; gold: number }[] = [];
let showing = false;
function next() {
  const q = queue.shift();
  if (!q) {
    showing = false;
    return;
  }
  showing = true;
  const h = harmonyById(q.s.id);
  harmonyAnim.push({ set: q.s, t0: S.T });
  sfx('harmony');
  // 점선이 이어진 뒤(0.8초) 가운데 배너
  setTimeout(() => {
    const b = $('#hBanner');
    b.innerHTML = `<img src="assets/emotes/emo_sparkle.png" alt=""><span><small>새 어울림 발견!</small><b>${esc(h.name)}</b><em>${esc(h.text)}</em><i>금화 +${fmt(q.gold)} · 평판 +3</i></span><img src="assets/emotes/emo_sparkle.png" alt="">`;
    b.hidden = false;
    b.classList.remove('go');
    void b.offsetWidth;
    b.classList.add('go');
    uiHooks.rumor(`${S.innName || '어느 여관'}에 「${h.name}」 어울림이 생겼대`);
    setTimeout(() => {
      b.hidden = true;
      next();
    }, 3200);
  }, 800);
}

/** 건물 창에 붙일 어울림 줄 */
export function harmonyRows(o: Building): string {
  const list = setsOf(o);
  if (!list.length) return '';
  return `<div class="hrows">${list
    .map((s) => {
      const h = harmonyById(s.id);
      return `<p><img src="${iconSrc('harmony', true)}" alt=""><b>${esc(h.name)}</b> <small>${esc(h.text)}</small></p>`;
    })
    .join('')}</div>`;
}

/** 마을 등급 장식을 눌렀을 때: 마을 안으로 옮기면 어울림 재료가 된다 */
export function openPropInfo(pr: Prop) {
  if (S.visiting) return;
  if (!MOVABLE_PROPS.includes(pr.k)) return;
  const k = pr.k as Kind;
  const d = def(k);
  openWin(
    d.name,
    `<p class="sub">마을 등급 장식 · 울타리 밖에 있어요</p><p>${esc(d.desc)}</p><p class="note">마을 안으로 옮기면(무료) 어울림 계산에 들어가요. 한번 옮기면 원래 자리 장식은 사라져요.</p><button class="bigbtn" id="propMove">마을 안으로 옮기기</button>`,
  );
  $('#propMove').onclick = () => {
    closeWin();
    startPlace(k, propKey(pr));
  };
}

export function syncHarmonyToggle() {
  const b = $('#bHarm');
  b.classList.toggle('on', P.harmony.show);
  b.setAttribute('aria-pressed', String(P.harmony.show));
}

export function initHarmonyUI() {
  objExtra.html = harmonyRows;
  harmonyHooks.found = (s, gold) => {
    queue.push({ s, gold });
    markDirty();
    if (!showing) next();
  };
  $('#bHarm').onclick = () => {
    P.harmony.show = !P.harmony.show;
    syncHarmonyToggle();
    uiHooks.toast(P.harmony.show ? '어울림 보기 켬 · 금빛 점선이 이어진 곳이 어울림이에요' : '어울림 보기 끔');
    markDirty();
  };
  syncHarmonyToggle();
  // 하루가 지나면: 매일 평판(여신의 가호 · 광장) · 숨은 어울림 힌트 한 단계
  onNewDay(() => {
    if (S.visiting) return;
    dailyHarmonyRep();
    const h = advanceHint();
    if (h) uiHooks.toastHtml(`<b>어울림 힌트</b> · ${esc(hintText(h))}`);
  });
}
