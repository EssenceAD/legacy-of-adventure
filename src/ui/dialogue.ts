// 대화창: 초상화 + 이름표 + 한 글자씩 타이핑 + ▼. Z/엔터/탭 = 다음, X = 건너뛰기(이름 짓기는 못 건너뜀)
import { GUEST_KINDS, speakerName } from '../data/classes';
import { portSrc } from './outfitPort';
import { appearance } from '../world/adventurers';
import { portrait } from './common';
import { CONFIG } from '../data/config';
import { PORTRAITS } from '../engine/assets';
import { mcPortrait } from '../data/origins';
import { P, S, world, type Actor, type TalkChoice, type TalkLine } from '../world/state';
import { applyDlgHints, skipTapOk } from './touchHints';

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
  /** 인연 단계가 오르는 긴 대화 — 이때만 곡 15 */
  bondUp?: boolean;
  /** ONBOARDING §0: 이 대화의 이름 (건너뛰기 기록) */
  tag?: string;
  /** STORY_V1: 줄마다 연출(fx) · 이 시각(ms)까지 다음 줄로 못 넘김(wait) */
  onLine?: (i: number) => void;
  hold?: number;
}

/** 나(주인)의 초상화 · 이름. 'me'는 늘 나, 오프닝의 'hero'도 주인이 있으면 나 */
const myPort = () => (P.owner ? PORTRAITS[mcPortrait(P.owner.job, P.owner.gender)] : PORTRAITS.hero) || '';
const isMe = (who: string) => who === 'me' || (who === 'hero' && !!P.owner);

let DQ: Talk | null = null;
/** FIRSTLOOK §3: 대화가 열린 때 (터치 [건너뛰기] 막이) */
let dlgOpenedAt = 0;
export const isTalking = () => DQ !== null;
/** 핫픽스 11: 글자가 찍히는 중 (타자 효과) — 이때는 마을 그리기를 늦추지 않는다 */
export const isTyping = () => !!DQ?.typing;
/** 인연 이벤트(초상화 마주보기) 중 — 배경음악 「마주 앉은 밤」 */
export const isDuo = () => !!DQ?.duo;
export const isBondUp = () => !!DQ?.bondUp;

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
  // FIRSTLOOK §3: 폰이면 「탭: 다음」 + [건너뛰기] (끄면 그대로) · 건너뛰기 0.35초 막이 시작
  dlgOpenedAt = performance.now();
  applyDlgHints(document.querySelector<HTMLElement>('#dlg .keys'));
  $('#dlg').hidden = false;
  $('#view').classList.add('talking');
  showLine();
}

/** ONBOARDING §0: 건너뛰기를 누르면 (tag, 줄 번호) — main이 퍼널로 */
export const dialogueHooks = { skip: (_tag: string, _i: number) => {} };
/** 이름 붙은 대화 (건너뛰기를 퍼널로 기록) */
export function talkTagged(tag: string, lines: Line[], done?: () => void) {
  talk(lines, done);
  if (DQ) DQ.tag = tag;
}

/** STORY_V1: 막 컷 · 엔딩 컷 — 줄이 뜰 때마다 onLine(줄 번호) (연출 · 기다림) */
export function talkStory(lines: Line[], onLine: (i: number) => void, done?: () => void) {
  talk(lines, done);
  if (DQ) {
    DQ.onLine = onLine;
    onLine(0);
  }
}
/** 지금 줄을 ms 동안 못 넘기게 (대사의 wait) */
export function holdLine(ms: number) {
  if (DQ) DQ.hold = Date.now() + ms;
}

/** 인연 이벤트: 나(왼쪽)와 그 사람(오른쪽) 초상화가 마주본다 */
export function talkDuo(lines: Line[], right: string, done?: () => void, choices?: TalkChoice[], bondUp = false) {
  talk(lines, done, choices);
  if (DQ) {
    DQ.duo = right;
    DQ.bondUp = bondUp;
    showLine();
  }
}

/** 핫픽스 9: 화자 → 이름표 + 초상화를 한 묶음으로.
 *  '@id'는 그 손님 · 직업 키 + 이름표면 그 이름의 손님을 찾아 그 손님의 도트 얼굴(성별·직업이 실제와 같게).
 *  영웅·전설·NPC는 전용 초상화. */
export function resolveSpeaker(who: string, nameTag?: string): { actor: Actor | null; port: string; name: string } {
  const all = [...world.actors, ...(world.home?.actors ?? [])].filter((a) => a.id && !a.role);
  let actor: Actor | null = null;
  if (who.startsWith('@')) actor = all.find((a) => a.id === +who.slice(1)) ?? null;
  else if ((GUEST_KINDS as readonly string[]).includes(who) && nameTag) actor = all.find((a) => a.name === nameTag) ?? null;
  if (actor) return { actor, port: portrait(actor), name: actor.name };
  // EASTER: 카메오는 id가 0 — 전용 초상화 키 p_<id>로 말한다
  if (who.startsWith('p_') && PORTRAITS[who]) return { actor: null, port: PORTRAITS[who], name: nameTag ?? who };
  // LUXE §1-3: 입은 의상 색 (한 함수 portSrc)
  return { actor: null, port: portSrc(who), name: nameTag ?? speakerName(who, S.innName) };
}
/** 대사 줄을 만들 때: 손님이면 '@id', 영웅·전설은 전용 초상화 키 */
export const speakerOf = (a: Actor) => (a.heroId ? 'hero_' + a.heroId : a.legendId ? 'legend_' + a.legendId : '@' + a.id);

function showLine() {
  if (!DQ) return;
  const [who, txt, opt, nameTag] = DQ.lines[DQ.i];
  const d = $('#dlg');
  const narr = who === 'narr';
  d.classList.toggle('narr', narr);
  const port = $<HTMLImageElement>('#dPort');
  const me = isMe(who);
  const sp = me ? null : resolveSpeaker(who, nameTag);
  port.src = me ? myPort() : sp!.port;
  port.hidden = narr;
  const dn = $('#dName');
  dn.textContent = me && P.owner ? P.owner.name : sp!.name;
  // 초상화 작업 §2: 같은 직업·종족 손님끼리 구분 — 이름표 옆 머리색 점 (이름표가 밝은 판이라 이름 색은 그대로)
  const ac = me ? null : sp!.actor;
  // 옛 손님은 hair가 저장돼 있지 않다 → 실제로 그려지는 머리색
  const hair = ac ? (ac.hair ?? appearance(ac).def.hair) : null;
  if (hair) {
    const dot = document.createElement('i');
    dot.className = 'hdot';
    dot.style.background = hair;
    dn.appendChild(dot);
  }
  // 마주보기: 말하는 쪽만 밝게
  const duo = $('#dDuo');
  d.classList.toggle('duo', !!DQ.duo);
  duo.hidden = !DQ.duo;
  if (DQ.duo) {
    const L = $<HTMLImageElement>('#dDuoL');
    const R = $<HTMLImageElement>('#dDuoR');
    L.src = myPort();
    R.src = portSrc(DQ.duo);
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

/** HOTFIX20: 화면 전환으로 대화를 끊는다 (done은 부르지 않음 — 부른 쪽이 다시 대기열에) */
export function abortTalk() {
  if (!DQ) return;
  clearInterval(DQ.iv);
  DQ = null;
  $('#dlg').hidden = true;
  $('#dDuo').hidden = true;
  $('#dChoice').hidden = true;
  $('#dlg').classList.remove('duo');
  $('#view').classList.remove('talking');
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
  if (DQ.wait || Date.now() < (DQ.hold ?? 0)) return;
  DQ.i++;
  if (DQ.i >= DQ.lines.length) {
    endTalk();
    return;
  }
  showLine();
  DQ?.onLine?.(DQ.i);
}

/** 건너뛰기 — 이름을 아직 안 지었으면 이름 짓기 줄로 */
export function skipTalk() {
  if (!DQ || DQ.wait) return;
  // ONBOARDING §0: 몇 번째 줄에서 건너뛰었나
  if (DQ.tag) dialogueHooks.skip(DQ.tag, DQ.i);
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
  // ONBOARDING §1: 추천 이름 3개 (누르면 바로 결정) · 그대로 쓰기
  const SUG = ['별빛', '달빛', '솔바람', '들꽃', '은하수', '모닥불', '바람결', '이슬', '햇살', '오솔길', '구름', '꽃마루'];
  const pool = SUG.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  inp.value = S.innName.replace(/\s*여관$/, '') || pool[0];
  const sug = document.getElementById('nameSug');
  if (sug) {
    sug.innerHTML = pool.map((n) => `<button data-sug="${n}">${n}</button>`).join('');
    sug.querySelectorAll<HTMLElement>('[data-sug]').forEach(
      (b) =>
        (b.onclick = (e) => {
          inp.value = b.dataset.sug!;
          ok(e);
        }),
    );
  }
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
    if (!skipTapOk(dlgOpenedAt)) return;
    skipTalk();
  };
  // ONBOARDING §1: 길게 누르면 빨리 넘기기 (고르기·이름 칸에선 멈춤)
  let holdT = 0;
  let holdIv = 0;
  const stopHold = () => {
    clearTimeout(holdT);
    clearInterval(holdIv);
    holdT = holdIv = 0;
  };
  $('#dlg').addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('#dSkip, #dChoice, #namebox')) return;
    stopHold();
    holdT = window.setTimeout(() => (holdIv = window.setInterval(() => (DQ && !DQ.wait ? nextLine() : stopHold()), 110)), 450);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) $('#dlg').addEventListener(ev, stopHold);
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
