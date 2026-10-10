// 대화창: 초상화 + 이름표 + 한 글자씩 타이핑 + ▼. Z/엔터/탭 = 다음, X = 건너뛰기(이름 짓기는 못 건너뜀)
import { speakerName } from '../data/classes';
import { CONFIG } from '../data/config';
import { PORTRAITS } from '../engine/assets';
import { mcPortrait } from '../data/origins';
import { P, S, type TalkChoice, type TalkLine } from '../world/state';

/** [누가, 대사, 'name'이면 이 줄 다음에 여관 이름 짓기, 이름표] — 누가: narr(해설)·hero·keeper·post·직업 */
export type Line = TalkLine;

interface Talk {
  lines: Line[];
  i: number;
  done?: () => void;
  /** 마지막 줄 뒤에 고르기 버튼 */
  choices?: TalkChoice[];
  typing: boolean;
  wait: boolean;
  /** 이 대화에서 이름을 지었나 */
  named: boolean;
  full: string;
  iv: number;
  /** 인연 이벤트: 오른쪽에 설 사람 초상화 키 (왼쪽은 나) */
  duo?: string;
}

/** 나(주인)의 초상화 · 이름. 'me'는 늘 나, 오프닝의 'hero'도 주인이 있으면 나 */
const myPort = () => (P.owner ? PORTRAITS[mcPortrait(P.owner.job, P.owner.gender)] : PORTRAITS.hero) || '';
const isMe = (who: string) => who === 'me' || (who === 'hero' && !!P.owner);

let DQ: Talk | null = null;
export const isTalking = () => DQ !== null;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

/** 이름을 정했을 때 (main이 이름표·HUD를 갱신) */
let onNamed: (name: string) => void = () => {};
export function setOnNamed(fn: (name: string) => void) {
  onNamed = fn;
}

export function talk(lines: Line[], done?: () => void, choices?: TalkChoice[]) {
  if (DQ) clearInterval(DQ.iv);
  DQ = { lines, i: 0, done, choices, typing: false, wait: false, named: false, full: '', iv: 0 };
  $('#dChoice').hidden = true;
  $('#dlg').hidden = false;
  $('#view').classList.add('talking');
  showLine();
}

/** 인연 이벤트: 나(왼쪽)와 그 사람(오른쪽) 초상화가 마주본다 */
export function talkDuo(lines: Line[], right: string, done?: () => void, choices?: TalkChoice[]) {
  talk(lines, done, choices);
  if (DQ) {
    DQ.duo = right;
    showLine();
  }
}

function showLine() {
  if (!DQ) return;
  const [who, txt, opt, nameTag] = DQ.lines[DQ.i];
  const d = $('#dlg');
  const narr = who === 'narr';
  d.classList.toggle('narr', narr);
  const port = $<HTMLImageElement>('#dPort');
  const me = isMe(who);
  port.src = me ? myPort() : PORTRAITS[who] || '';
  port.hidden = narr;
  $('#dName').textContent = me && P.owner ? P.owner.name : nameTag ?? speakerName(who, S.innName);
  // 마주보기: 말하는 쪽만 밝게
  const duo = $('#dDuo');
  d.classList.toggle('duo', !!DQ.duo);
  duo.hidden = !DQ.duo;
  if (DQ.duo) {
    const L = $<HTMLImageElement>('#dDuoL');
    const R = $<HTMLImageElement>('#dDuoR');
    L.src = myPort();
    R.src = PORTRAITS[DQ.duo] || '';
    L.classList.toggle('dim', !narr && !me);
    R.classList.toggle('dim', !narr && me);
  }
  $('#dName').hidden = narr;
  const t = txt.replace('{name}', S.innName);
  const el = $('#dText');
  el.textContent = '';
  clearInterval(DQ.iv);
  DQ.typing = true;
  DQ.full = t;
  let k = 0;
  const q = DQ;
  q.iv = window.setInterval(() => {
    el.textContent = t.slice(0, ++k);
    if (k >= t.length) {
      clearInterval(q.iv);
      q.typing = false;
      if (opt === 'name') askName();
      else askChoice();
    }
  }, CONFIG.ui.typeMs);
}

/** 마지막 줄을 다 보여 줬으면 고르기 버튼 */
function askChoice() {
  if (!DQ || !DQ.choices?.length || DQ.i !== DQ.lines.length - 1) return;
  DQ.wait = true;
  const box = $('#dChoice');
  box.innerHTML = '';
  for (const c of DQ.choices) {
    const b = document.createElement('button');
    b.className = 'px';
    b.textContent = c.label;
    b.onclick = (e) => {
      e.stopPropagation();
      box.hidden = true;
      if (DQ) DQ.wait = false;
      endTalk();
      c.fn();
    };
    box.appendChild(b);
  }
  box.hidden = false;
}

function endTalk() {
  if (!DQ) return;
  const d = DQ.done;
  clearInterval(DQ.iv);
  DQ = null;
  $('#dlg').hidden = true;
  $('#dDuo').hidden = true;
  $('#dlg').classList.remove('duo');
  $('#view').classList.remove('talking');
  d?.();
}

export function nextLine() {
  if (!DQ) return;
  if (DQ.typing) {
    // 타이핑 중이면 한 번에 다 보여 준다
    clearInterval(DQ.iv);
    $('#dText').textContent = DQ.full;
    DQ.typing = false;
    if (DQ.lines[DQ.i][2] === 'name') askName();
    else askChoice();
    return;
  }
  if (DQ.wait) return;
  DQ.i++;
  if (DQ.i >= DQ.lines.length) {
    endTalk();
    return;
  }
  showLine();
}

/** 건너뛰기 — 이름을 아직 안 지었으면 이름 짓기 줄로 */
export function skipTalk() {
  if (!DQ || DQ.wait) return;
  clearInterval(DQ.iv);
  const nl = DQ.lines.findIndex((l) => l[2] === 'name');
  if (nl > DQ.i) {
    DQ.i = nl;
    showLine();
    return;
  }
  if (nl === DQ.i && !DQ.named) {
    // 이름 짓기 줄에서는 건너뛰지 않고 바로 이름 칸을 연다
    $('#dText').textContent = DQ.full;
    DQ.typing = false;
    askName();
    return;
  }
  // 고르기가 있는 대화는 마지막 줄로 건너뛴다 (고르지 않고 끝낼 수 없다)
  if (DQ.choices?.length) {
    DQ.i = DQ.lines.length - 1;
    showLine();
    return;
  }
  endTalk();
}

function askName() {
  if (!DQ) return;
  DQ.wait = true;
  const nb = $('#namebox');
  nb.hidden = false;
  const inp = $<HTMLInputElement>('#nameIn');
  inp.value = S.innName.replace(/\s*여관$/, '');
  setTimeout(() => inp.focus(), 50);
  const ok = (e?: Event) => {
    e?.stopPropagation();
    e?.preventDefault();
    let v = inp.value.trim() || '별빛';
    v = v.replace(/\s*여관$/, '');
    S.innName = v + ' 여관';
    nb.hidden = true;
    if (DQ) {
      DQ.wait = false;
      DQ.named = true;
    }
    onNamed(S.innName);
    nextLine();
  };
  $('#nameOk').onclick = ok;
  inp.onkeydown = (e) => {
    if (e.key === 'Enter') ok(e);
  };
}

export function initDialogue() {
  $('#dlg').onclick = (e) => {
    if ((e.target as HTMLElement).closest('#dSkip')) return;
    nextLine();
  };
  $('#dSkip').onclick = (e) => {
    e.stopPropagation();
    skipTalk();
  };
  addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!DQ) return;
    if ('zZ '.includes(e.key) || e.key === 'Enter') {
      e.preventDefault();
      nextLine();
    }
    if (e.key === 'x' || e.key === 'X') skipTalk();
  });
}
