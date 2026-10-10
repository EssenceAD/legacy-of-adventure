// 대화창: 초상화 + 이름표 + 한 글자씩 타이핑 + ▼. Z/엔터/탭 = 다음, X = 건너뛰기(이름 짓기는 못 건너뜀)
import { speakerName } from '../data/classes';
import { CONFIG } from '../data/config';
import { PORTRAITS } from '../engine/assets';
import { S } from '../world/state';

/** [누가, 대사, 'name'이면 이 줄 다음에 여관 이름 짓기] — 누가: narr(해설)·hero·keeper·post·직업 */
export type Line = [string, string, 'name'?];

interface Talk {
  lines: Line[];
  i: number;
  done?: () => void;
  typing: boolean;
  wait: boolean;
  /** 이 대화에서 이름을 지었나 */
  named: boolean;
  full: string;
  iv: number;
}

let DQ: Talk | null = null;
export const isTalking = () => DQ !== null;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

/** 이름을 정했을 때 (main이 이름표·HUD를 갱신) */
let onNamed: (name: string) => void = () => {};
export function setOnNamed(fn: (name: string) => void) {
  onNamed = fn;
}

export function talk(lines: Line[], done?: () => void) {
  if (DQ) clearInterval(DQ.iv);
  DQ = { lines, i: 0, done, typing: false, wait: false, named: false, full: '', iv: 0 };
  $('#dlg').hidden = false;
  $('#view').classList.add('talking');
  showLine();
}

function showLine() {
  if (!DQ) return;
  const [who, txt, opt] = DQ.lines[DQ.i];
  const d = $('#dlg');
  const narr = who === 'narr';
  d.classList.toggle('narr', narr);
  const port = $<HTMLImageElement>('#dPort');
  port.src = PORTRAITS[who] || '';
  port.hidden = narr;
  $('#dName').textContent = speakerName(who, S.innName);
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
    }
  }, CONFIG.ui.typeMs);
}

function endTalk() {
  if (!DQ) return;
  const d = DQ.done;
  clearInterval(DQ.iv);
  DQ = null;
  $('#dlg').hidden = true;
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

/** 오프닝 (시안 대사 그대로) */
export const OPENING: Line[] = [
  ['narr', '골드는 늘 모자랐다.'],
  ['narr', '목숨 걸고 던전에서 번 돈은, 여관 숙박비로 고스란히 사라지곤 했다.'],
  ['keeper', '자네, 셈이 꽤 빠르더군. 내 장부 정리를 그렇게 빨리 하는 사람은 처음 봤네.'],
  ['hero', '하하, 맨날 돈이 모자라서 계산만 늘었죠.'],
  ['keeper', '나도 이제 허리가 예전 같지 않아. 이 여관… 자네가 맡아 주지 않겠나?'],
  ['hero', '제가요? 칼밖에 쥐어 본 적이 없는데요?'],
  ['keeper', '칼 쥐는 손이나 장부 쥐는 손이나 매한가지일세. 손님 마음을 읽는 눈이 더 중요하지.'],
  ['keeper', '자, 간판부터 새로 달아야겠지. 여관 이름을 지어 주게.', 'name'],
  ['keeper', '{name}이라… 좋은 이름이군. 손님들이 몰려올 걸세.'],
  ['keeper', '지금은 여관 하나뿐이지만, 울타리를 밀고 땅을 넓혀 가게. 주점도, 온천도, 대장간도 자네 마음대로 지으면 되네.'],
  ['keeper', '모르는 게 있으면 마을로 찾아오게. 난 이제 낚시나 하러 가겠네. 허허!'],
  ['narr', '그렇게, 전직 모험가의 여관 마을이 시작되었다.'],
];
