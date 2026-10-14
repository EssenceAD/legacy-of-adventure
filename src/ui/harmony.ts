// 베타 1장: 어울림 화면 — 발견 배너 · 「어울림 보기」 토글 · 마을 등급 장식 옮기기 · 건물 창의 어울림 줄
import { bigNum, vis } from '../world/visual';
import { av } from '../engine/ver';
import { addMail } from '../world/meta';
import { say } from '../world/fx';
import { PRI } from '../world/quiet';
import { track as trackEv } from '../net/telemetry';
import { def, type Kind } from '../data/catalog';
import { HARMONIES, harmonyById } from '../data/harmony';
import { advanceHint, dailyHarmonyRep, harmonyHooks, hintText, setsOf, type HSet } from '../world/harmony';
import { harmonyAnim } from '../world/harmonyDraw';
import { MOVABLE_PROPS, propKey, type Prop } from '../world/grade';
import { onNewDay } from '../world/clock';
import { markDirty, P, S, uiHooks, world, type Building } from '../world/state';
import { iconSrc } from './kit';
import { sfx } from './battle';
import { closeWin, objExtra, openWin, toast } from './windows';
import { startPlace } from './hud';
import { esc } from './common';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
// VISUAL §5 uiKitV2(실험실)면 큰 수 줄임(bigNum) · 끄면 예전 그대로
const fmt = (n: number) => (vis('uiKitV2') ? bigNum(n) : n.toLocaleString('ko-KR'));

/** 발견 연출 차례 (한 번에 하나씩) */
import { holdUi } from '../audio/scene';
const queue: { s: HSet; gold: number }[] = [];
let showing = false;
function next() {
  // 핫픽스 8 (2-9): 전투·티저 중이면 돌아올 때까지 미룬다
  if (queue.length && holdUi(next)) return;
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
    b.innerHTML = `<img src="${av('assets/emotes/emo_sparkle.png')}" alt=""><span><small>새 어울림 발견!</small><b>${esc(h.name)}</b><em>${esc(h.text)}</em><i>금화 +${fmt(q.gold)} · 평판 +3</i></span><img src="${av('assets/emotes/emo_sparkle.png')}" alt="">`;
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
  // 핫픽스: 옮길 수 없는 등급 장식(표지판·돌담·화분·석등·깃대)도 눌렀을 때 무엇인지 알려 준다
  if (!MOVABLE_PROPS.includes(pr.k)) return toast('마을 등급 장식 · 마을 등급이 오를 때 생겨요 (이 장식은 옮길 수 없어요)');
  const k = pr.k as Kind;
  const d = def(k);
  openWin(
    d.name,
    `<p class="sub">마을 등급 장식 · 꾸미기에서 마을 안으로 옮길 수 있어요</p><p>${esc(d.desc)}</p><p class="note">마을 안으로 옮기면(무료) 어울림 계산에 들어가요. 한번 옮기면 원래 자리 장식은 사라져요.</p><button class="bigbtn" id="propMove">마을 안으로 옮기기</button>`,
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
    trackEv('harmony_found', { id: s.id });
    // TOWN T4: 가까운 손님이 그 어울림을 칭찬
    praise(s);
    queue.push({ s, gold });
    markDirty();
    if (!showing) next();
  };
  harmonyHooks.complete = () => {
    addMail({ from: 'system', title: '모모의 편지 · 어울림 도감 완성!', body: '마을의 어울림을 전부 찾으셨어요! 칭호 「어울림 장인」과 작은 선물을 보내요.', reward: { deco: 'fountain' } });
    uiHooks.toast('🏅 어울림 도감 완성 · 칭호 「어울림 장인」');
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

/** TOWN T4: 새 어울림 곁 손님 한 명이 칭찬 (말풍선) */
function praise(s: HSet) {
  const name = HARMONIES.find((h) => h.id === s.id)?.name;
  if (!name) return;
  const c = s.members[0];
  const near = world.actors.filter((a) => !a.role && !a.hidden && Math.hypot(a.x - (c.tx + c.fw / 2), a.y - (c.ty + c.fh / 2)) < 8).sort(() => Math.random() - 0.5)[0];
  if (near) setTimeout(() => say(near, pickLine([`「${name}」 멋지다!`, `와, ${name}이에요!`, `여기 ${name} 생겼네요~`]), 2, '', PRI.story), 1500);
}
const pickLine = (l: string[]) => l[(Math.random() * l.length) | 0];
