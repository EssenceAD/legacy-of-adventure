// 아래에서 올라오는 창: 건설·땅·손님·건물·캐릭터·장부·메뉴·계정·제보
import { bigNum, vis } from '../world/visual';
import { CATALOG, def, INSIDE_TEXT, ROOFS, type Kind } from '../data/catalog';
import { flag } from '../world/flags';
import { orderBuildKinds } from '../world/firstFlow';
import { shakeLv } from '../engine/shake';
import { communityLink } from './community';
import { landReqs, landWhy } from '../world/landreq';
import { GROUPS, groupOf, markSeen, unseenDrops } from '../world/decodrop';
import { putAway, storeWhy } from '../world/store';
import { sfx } from '../audio/sfx';
import { CONFIG } from '../data/config';
import { baseKey, FIRE_FRAMES, IMG, PORTRAITS } from '../engine/assets';
import { canvas } from '../engine/pixel';
import { stars } from '../world/progress';
import { P as PG, S, world, type Building } from '../world/state';
import { buildableKinds, canMoveKind, copyIncomeMult, landNeedFor, maxCopies, maxLevel, nextLevelCost , MULTI, buildCost, countKind } from '../world/town';
import { openBoard } from './expedition';
import { openGarden, openSmith } from './smith';
import { feature, featureChapter } from '../world/guide';
import { decoLock } from '../world/harmony';
import { online, sendLetter } from '../net/server';
import { openAccount } from './account';
import { APP_VERSION } from './update';
import { track as trackEv } from '../net/telemetry';
import { holdUi } from '../audio/scene';
import * as game from '../game';
import { addReport } from '../save/save';
import { talk } from './dialogue';
import { startMove, startPlace } from './hud';
import { cheerCon, cheerReady, clock, conLeft, conProgress } from '../world/construct';
import { canRemove, isNoRemove, refundOf, removeEffects } from '../world/demolish';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string) => [...document.querySelectorAll(s)] as T[];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
// VISUAL §5 uiKitV2(실험실)면 큰 수 줄임(bigNum) · 끄면 예전 그대로
const fmt = (n: number) => (vis('uiKitV2') ? bigNum(n) : n.toLocaleString('ko-KR'));

/** 창 제목 → 안내서 쪽 (ui/menu가 채운다): 「?」 버튼 */
export const helpHook = { page: (_title: string): string | null => null, open: (_key: string) => {} };

// ───────── 창 쌓기 (핫픽스 7): 창 안에서 다른 창으로 들어가면 ← 뒤로 · Esc · 안드로이드 뒤로가기 ─────────

interface WinState {
  title: string;
  cls: string;
  /** 발(버튼 줄) — 핫픽스 8 2-6 */
  foot: Node[];
  /** 창 내용 그대로 (버튼에 단 동작까지 살아 있게 노드째 보관) */
  nodes: Node[];
}
const stack: WinState[] = [];
/** 창 때문에 쌓은 history 항목 수 · 우리가 부른 popstate는 무시 */
let histDepth = 0;
let ignorePop = 0;
/**
 * 핫픽스 11 §7: history.go(-n)는 비동기다. 되돌아가는 중에 새 창이 pushState를 하면, 늦게 끝난 되돌리기가
 * 방금 쌓은 항목을 지워 버려 다음 닫기 때 게임 페이지 밖(이전 사이트·빈 페이지 · 앱 닫힘)으로 나갔다.
 * → 되돌리기가 끝날 때까지 쌓기를 미뤄 두고(queuedPush), 되돌리기는 지금 항목 깊이보다 더 가지 않는다.
 */
let queuedPush = 0;
function pushHist() {
  if (ignorePop > 0) {
    queuedPush++;
    histDepth++;
    return;
  }
  try {
    history.pushState({ legacyWin: histDepth + 1 }, '');
    histDepth++;
  } catch {
    /* 무시 */
  }
}
function flushQueuedPush() {
  while (queuedPush > 0) {
    queuedPush--;
    try {
      history.pushState({ legacyWin: histDepth - queuedPush }, '');
    } catch {
      /* 무시 */
    }
  }
}
function dropHist(n: number) {
  if (n <= 0) return;
  // 아직 쌓지 않은(미뤄 둔) 항목부터 지운다
  const q = Math.min(n, queuedPush);
  queuedPush -= q;
  histDepth = Math.max(0, histDepth - q);
  n -= q;
  if (n <= 0) return;
  // 지금 항목이 우리가 쌓은 몇 번째인지보다 더 뒤로 가지 않는다 (게임 페이지 밖으로 나가지 않게)
  const cur = ignorePop > 0 ? histDepth : ((history.state as { legacyWin?: number } | null)?.legacyWin ?? 0);
  const go = Math.min(n, cur);
  histDepth = Math.max(0, histDepth - n);
  if (go <= 0) return;
  ignorePop++;
  history.go(-go);
}
function showHead(title: string) {
  $('#winT').textContent = title;
  const hp = helpHook.page(title);
  const hb = $('#winHelp');
  hb.hidden = !hp;
  if (hp) hb.onclick = () => helpHook.open(hp);
  $('#winBack').hidden = !stack.length;
}
/** 핫픽스 v0.23.4: 창이 열린 시각 — 터치를 떼며 브라우저가 뒤따라 보내는 click이 바로 바깥(어두운 곳)으로 가서 창을 닫지 않게 */
let openedAt = 0;
const setOpen = (on: boolean) => {
  if (on && !$('#scrim').classList.contains('on')) openedAt = performance.now();
  $('#scrim').classList.toggle('on', on);
  document.body.classList.toggle('winopen', on);
};

/** SMITH §1: 창 안에서 마지막으로 누른 버튼 (다시 그린 뒤 같은 줄 찾기용) */
let lastPress: string | null = null;
const PRESS_ATTRS = ['data-enh', 'data-sal', 'data-id', 'data-craft', 'data-eq', 'data-k', 'data-r', 'id'];
document.addEventListener(
  'pointerdown',
  (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('#winB button, #winB [data-id]');
    if (!el) return;
    const at = PRESS_ATTRS.find((k) => el.hasAttribute(k));
    lastPress = at ? `[${at}="${CSS.escape(el.getAttribute(at)!)}"]` : null;
  },
  true,
);
function flashPressed(body: HTMLElement) {
  if (!lastPress) return;
  const el = body.querySelector<HTMLElement>(lastPress);
  const row = el?.closest<HTMLElement>('.irow, .row, li') ?? el;
  if (!row) return;
  const r = row.getBoundingClientRect();
  const b = body.getBoundingClientRect();
  if (r.top < b.top || r.bottom > b.bottom) row.scrollIntoView({ block: 'nearest' });
  row.classList.remove('flash');
  void row.offsetWidth;
  row.classList.add('flash');
  setTimeout(() => row.classList.remove('flash'), 600);
}
export function openWin(title: string, html: string, cls = '') {
  const was = $('#win').classList.contains('on');
  if (!was) {
    sfx('open');
    stack.length = 0;
    pushHist();
  } else if ($('#winT').textContent !== title && !winLocked) {
    // 다른 창으로 들어간다: 지금 창을 쌓아 둔다 (같은 제목이면 다시 그리기일 뿐)
    stack.push({ title: $('#winT').textContent ?? '', cls: $('#win').className.replace(/\bon\b/, '').trim(), nodes: [...$('#winB').childNodes], foot: [...$('#winF').childNodes] });
    if (stack.length > 8) stack.shift();
    pushHist();
  }
  if ($('#winT').textContent !== title || !was) trackEv('screen_open', { name: title.slice(0, 30) });
  // SMITH §1: 같은 창·같은 탭을 다시 그리면 스크롤(세로·탭 가로)을 그대로 두고, 방금 누른 줄을 반짝
  const body = $('#winB');
  const tabOf = (root: ParentNode) => root.querySelector('.tabs .tab.on')?.textContent ?? '';
  const same = was && $('#winT').textContent === title;
  const top = body.scrollTop;
  const lefts = [...body.querySelectorAll<HTMLElement>('.tabs')].map((t) => t.scrollLeft);
  const tabBefore = tabOf(body);
  body.innerHTML = html;
  if (same && tabOf(body) === tabBefore) {
    body.scrollTop = top;
    body.querySelectorAll<HTMLElement>('.tabs').forEach((t, i) => (t.scrollLeft = lefts[i] ?? 0));
    flashPressed(body);
  } else body.scrollTop = 0;
  lastPress = null;
  splitFoot();
  $('#win').className = 'win px on ' + cls;
  showHead(title);
  setOpen(true);
}

/** 핫픽스 8 (2-6): 창 = 머리 · 몸(스크롤) · 발(버튼). 몸의 맨 끝 버튼 줄(또는 .wfoot)을 발로 옮겨 늘 화면 안 아래에 보이게 */
const FOOT = '.wfoot, .bigbtn, .btnrow, .raidgo';
function splitFoot() {
  const body = $('#winB');
  const foot = $('#winF');
  foot.replaceChildren();
  const explicit = body.querySelector<HTMLElement>(':scope > .wfoot');
  const last = explicit ?? (body.lastElementChild as HTMLElement | null);
  if (last && last.matches(FOOT)) {
    // 버튼 줄 바로 앞의 짧은 안내(note)는 몸에 남긴다 · 맨 끝 버튼들이 연달아 있으면 같이
    const take: HTMLElement[] = [last];
    let prev = last.previousElementSibling as HTMLElement | null;
    while (!explicit && prev && prev.matches('.bigbtn')) {
      take.unshift(prev);
      prev = prev.previousElementSibling as HTMLElement | null;
    }
    foot.append(...take);
  }
  foot.hidden = !foot.childElementCount;
}

/** ← 뒤로: 직전 창으로 (없으면 닫기) */
export function winBack(fromPop = false) {
  if (winLocked) return;
  const s = stack.pop();
  if (!s) return closeWin(fromPop);
  if (!fromPop) dropHist(1);
  sfx('close');
  $('#winB').replaceChildren(...s.nodes);
  $('#winF').replaceChildren(...s.foot);
  $('#winF').hidden = !s.foot.length;
  $('#win').className = s.cls + ' on';
  showHead(s.title);
}
const closeHooks: (() => void)[] = [];
/** 창이 닫힌 뒤 (다음 창이 바로 열리면 그 뒤) 부를 것 — 놓치면 안 되는 창(저장 고르기)을 다시 띄울 때 */
export const onWinClose = (f: () => void) => closeHooks.push(f);
export function closeWin(fromPop = false) {
  if ($('#win').classList.contains('on')) sfx('close');
  $('#win').classList.remove('on');
  setOpen(false);
  stack.length = 0;
  $('#winBack').hidden = true;
  if (!fromPop) dropHist(histDepth);
  else histDepth = 0;
  setTimeout(() => closeHooks.forEach((f) => f()), 0);
}
export const isWinOpen = () => $('#win').classList.contains('on');

let toastTimer = 0;
export function toastHtml(html: string, ms: number = CONFIG.ui.toastMs) {
  // 핫픽스 8 (2-9): 전투·티저 중엔 쌓아 두었다가 돌아오면 (최대 3개)
  if (holdUi(() => toastHtml(html, ms))) return;
  const e = $('#toast');
  e.innerHTML = html;
  e.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => e.classList.remove('on'), ms);
}
export const toast = (text: string) => toastHtml(`<span>${esc(text)}</span>`);

/** 꼭 골라야 하는 창(주인 만들기·엔딩 뒤 선택): ✕·바깥 눌러 닫기를 막는다 */
let winLocked = false;
export function setWinLock(v: boolean) {
  winLocked = v;
  $('#winX').hidden = v;
}
const userClose = () => !winLocked && closeWin();

/** 왼쪽 위 HUD 쌓기 (핫픽스 7): 상태 카드 → 임무 카드 → 평판 띠를 실제 높이대로 겹치지 않게 */
function stackHud() {
  const st = document.querySelector('.stat');
  if (!st) return;
  let y = st.getBoundingClientRect().bottom + 6;
  for (const id of ['#mission', '#evalbar']) {
    const e = document.querySelector<HTMLElement>(id);
    if (!e || e.hidden) continue;
    e.style.top = y + 'px';
    y += e.getBoundingClientRect().height + 4;
  }
}

export function initWindows() {
  const ro = new ResizeObserver(stackHud);
  for (const s of ['.stat', '#mission', '#evalbar']) {
    const e = document.querySelector(s);
    if (e) ro.observe(e);
  }
  addEventListener('resize', stackHud);
  // 바깥 어두운 곳: 닫기 (글을 쓰는 창은 빼고)
  $('#scrim').onclick = () => {
    if (flag('tapV2') && performance.now() - openedAt < 450) return;
    if ($('#winB').querySelector('input[type=text], input:not([type]), textarea')) return;
    userClose();
  };
  $('#winX').onclick = userClose;
  $('#winBack').onclick = () => winBack();
  // PC: Esc 한 단계씩
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isWinOpen()) return;
    e.preventDefault();
    if (stack.length) winBack();
    else userClose();
  });
  // 안드로이드 뒤로가기 (history)
  addEventListener('popstate', () => {
    if (ignorePop) {
      ignorePop--;
      // 되돌리기가 끝났다 → 그동안 미뤄 둔 창 항목을 이제 쌓는다
      if (!ignorePop) flushQueuedPush();
      return;
    }
    if (!isWinOpen()) return;
    if (winLocked) {
      // 꼭 골라야 하는 창: 뒤로가기로 닫히지 않게 다시 쌓는다
      histDepth = Math.max(0, histDepth - 1);
      pushHist();
      return;
    }
    histDepth = Math.max(0, histDepth - 1);
    if (stack.length) winBack(true);
    else closeWin(true);
  });
}

// ───────── 건설 ─────────

/** 건설 목록 썸네일: 부팅 직후 한 번 만들어 둔다 (창을 열 때 만들면 열리는 순간 끊긴다) */
const THUMBS: Partial<Record<Kind, string>> = {};
const THUMB_W = 96;
const THUMB_H = 56;

/** 모닥불 썸네일 = campfire.png 1번 프레임 */
const fireThumb = () => FIRE_FRAMES[0] ?? canvas(32, 34);

/** 창 맨 아래에 「옮기기 · 방향」 버튼 (이웃 마을은 없음 · FEEDBACK23 §4: 던전 입구도 옮길 수 있다) */
export function appendMoveButton(o: Building) {
  if (S.visiting || !canMoveKind(o.kind) || (o.build !== undefined && !o.con)) return;
  const b = document.createElement('button');
  b.className = 'bigbtn sm ghost';
  b.id = 'moveB';
  b.textContent = '옮기기 · 방향 바꾸기 ↻';
  b.onclick = () => {
    // BUILDUX §2-2: 옮기기는 언제나 무료 · 공사 중이어도 (공사는 그대로 이어진다)
    closeWin();
    startMove(o);
  };
  $('#winB').appendChild(b);
  appendRemoveButton(o);
}

/** 핫픽스 10: 옮기기 바로 아래 「철거하기」 (여관 본관 같은 필수 건물은 회색 안내만) */
function appendRemoveButton(o: Building) {
  if (isNoRemove(o)) {
    const n = document.createElement('p');
    n.className = 'note rmno';
    n.textContent = '이 건물은 철거할 수 없어요';
    $('#winB').appendChild(n);
    return;
  }
  if (!canRemove(o, !!S.visiting)) return;
  const b = document.createElement('button');
  b.className = 'bigbtn sm ghost rmbtn';
  b.id = 'rmB';
  // BUILDUX §2-3: 철거 대신 「넣어 두기」 — 레벨·색 그대로 보관함에 · 금화로 돌려받는 철거는 보관함 안에서만
  const why = storeWhy(o);
  b.textContent = '📦 넣어 두기';
  b.onclick = () => {
    if (why) {
      // 공사 중: 넣어 둘 순 없고, 공사 취소(환불 철거)는 예전처럼
      if (o.con) return openRemoveConfirm(o);
      return toast(why);
    }
    const name = def(o.kind).name;
    if (putAway([o])) {
      closeWin();
      toast(`📦 ${name}을(를) 보관함에 넣었어요 · 꾸미기 모드 「보관함」에서 꺼내요`);
    }
  };
  $('#winB').appendChild(b);
  if (why && o.con) b.textContent = '공사 취소 (철거)';
}

/** 받침 있으면 「을」 */
const eul = (s: string) => {
  const c = s.charCodeAt(s.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 ? '을' : '를';
  return /[0-9]$/.test(s) ? ('013678'.includes(s.slice(-1)) ? '을' : '를') : '을(를)';
};

/** 철거 확인 (창 쌓기: ← 뒤로 = 그만두기) · 철거 버튼은 0.5초 뒤에 눌린다 */
function openRemoveConfirm(o: Building) {
  const name = `${def(o.kind).name} Lv.${o.lvl}`;
  const r = refundOf(o);
  const fx = removeEffects(o);
  const warn: string[] = [];
  if (fx.guests) warn.push(`안에 손님 ${fx.guests}명이 있어요. 문 밖으로 나와요.`);
  if (fx.harmonies.length) warn.push(`어울림이 깨져요: ${fx.harmonies.map(esc).join(', ')} (발견 기록은 남아요)`);
  if (o.kind === 'cottage') warn.push(fx.overflow ? `묵는 손님 ${fx.overflow}명은 방이 모자라 지나가는 손님이 돼요.` : '묵던 손님은 다른 빈 방으로 옮겨요.');
  const refund = o.fromProp
    ? `<p class="rmgold">돌려받는 금화: 💰 0</p><p class="note">마을 등급 장식이라 금화는 없고, 원래 자리로 돌아가진 않아요</p>`
    : `<p class="rmgold">돌려받는 금화: 💰 ${fmt(r.gold)}</p><p class="note">${r.full ? '방금(5분 안) 지은 건물이라 전액 돌려받아요' : '지은 값 + 올린 값의 50%'}</p>`;
  openWin(
    '철거',
    `<div class="rmconf"><p class="rmq">${esc(name)} ${eul(name)} 철거할까요?</p>${refund}${warn.map((w) => `<p class="rmwarn">⚠ ${w}</p>`).join('')}</div>` +
      `<div class="btnrow rmrow"><button id="rmNo" class="bigbtn">그만두기</button><button id="rmOk" class="bigbtn red" disabled>철거하기</button></div>`,
  );
  const ok = $('#rmOk') as HTMLButtonElement;
  setTimeout(() => (ok.disabled = false), 500);
  $('#rmNo').onclick = () => winBack();
  ok.onclick = () => {
    if (ok.disabled) return;
    ok.disabled = true;
    closeWin();
    game.demolish(o);
  };
}

/** 그림을 썸네일 칸 크기에 맞춰 정수 배율로(도트가 뭉개지지 않게) 미리 그려 둔다 */
export function buildThumbs() {
  for (const k of Object.keys(CATALOG) as Kind[]) {
    const sp = CATALOG[k].sprite;
    const src: CanvasImageSource & { width: number; height: number } = sp ? IMG[sp] : fireThumb();
    if (!src) continue;
    const s = Math.max(1, Math.floor(Math.min((THUMB_W * 2) / src.width, (THUMB_H * 2) / src.height)));
    const c = canvas(src.width * s, src.height * s);
    const x = c.getContext('2d')!;
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    THUMBS[k] = c.toDataURL();
    // 미리 디코드해 두면 창을 여는 프레임에서 이미지 풀기가 일어나지 않는다
    const im = new Image();
    im.src = THUMBS[k]!;
    im.decode?.().catch(() => {});
    decoded.push(im);
  }
}
/** 디코드된 썸네일을 붙잡아 둔다 (가비지로 버려지지 않게) */
const decoded: HTMLImageElement[] = [];
const thumb = (k: Kind) => THUMBS[k] ?? '';

const GATED: Partial<Record<Kind, 'smith' | 'garden' | 'cottage'>> = { smith: 'smith', garden: 'garden', cottage: 'cottage' };

/** TOWN T2: 건설 창 「꾸미기 모드」 (ui/decor가 채운다) */
export const buildHooks = { decor: () => {}, redraw: () => {}, pathTool: () => {} };
/** BUILDUX: 보관함 등에서 쓰는 건설 썸네일 */
export const thumbOf = (k: Kind) => thumb(k);
/** CHECKIN §B-1: 건설 창에서 잠긴 건물인가 (카드 회색 · 임무로 열 때 아래로) */
function buildLocked(k: Kind): boolean {
  const d = def(k);
  const gate = GATED[k];
  const cap = maxCopies(k);
  const full = Number.isFinite(cap) && countKind(k) > 0 && countKind(k) >= cap;
  return d.unlock > S.land || (d.stars ?? 0) > stars() || (!!gate && !feature(gate)) || !!decoLock(k) || full;
}
/**
 * 건설 창 · target = CHECKIN §B-1 장부 임무의 대상 건물 (플래그 firstFlowFix):
 *  맨 위에 따로 + 반짝 테두리 3초 (탭하면 바로 끝 · 절전/흔들림 끔이면 반짝임 없이 테두리만) · 건물 목록은 열린 것 먼저, 잠긴 건 아래
 */
export function openBuild(target?: Kind) {
  if (S.visiting) return;
  const tgt = vis('firstFlowFix') && typeof target === 'string' ? target : null;
  const card = (k: Kind) => {
      const d = def(k);
      // 베타: 어울림 장식 열림 조건
      const dl = decoLock(k);
      const noStar = (d.stars ?? 0) > stars();
      // 5단계: 장부 장 보상으로 여는 건물 (대장간 3장 · 텃밭·별채 5장)
      const gate = GATED[k];
      const noGuide = !!gate && !feature(gate);
      // TOWN T3: 몇 채까지 (다 지었으면 잠김 · 땅을 넓히면 더)
      const cap = maxCopies(k);
      const full = Number.isFinite(cap) && countKind(k) > 0 && countKind(k) >= cap;
      const capMax = CONFIG.town.maxCopies[CONFIG.town.maxCopies.length - 1];
      const locked = buildLocked(k);
      // HOTFIX14 §1: 같은 건물 두 번째 채부터 비용 ↑ · 「두 번째 온천」
      const cost = buildCost(k);
      const nth = MULTI(k) ? 0 : countKind(k);
      const poor = S.gold < cost;
      // 5단계: 잠긴 건 회색 + 무엇을 하면 열리는지 한 줄
      const why = full ? `${cap}/${cap}채${cap < capMax ? ' · 땅을 넓히면 더' : ''}` : dl ? dl : noGuide ? `장부 ${featureChapter(gate!)}장에 열려요` : d.unlock > S.land ? `땅 ${d.unlock}단계에 열려요` : noStar ? `평판 ★${d.stars}에 열려요` : '';
      const sub = why ? `<small class="lock">${why}</small>` : `<small>${fmt(cost)} G</small>`;
      const nthName = nth ? `${['', '두', '세', '네', '다섯'][nth] ?? nth + 1} 번째 ` : '';
      return `<button data-k="${k}" class="${locked ? 'locked' : ''}" ${poor && !locked ? 'disabled' : ''}><img src="${thumb(k)}" alt=""><b>${nthName}${d.name}</b>${sub}${locked ? '<u class="lk"></u>' : ''}</button>`;
    };
  // DECO_DROP §2: 뽐내기 장식은 「특별 장식」 탭에
  const kinds = buildableKinds().filter((k) => decoLock(k) !== 'hide' && !def(k).luxury);
  // CHECKIN §B-1: 임무 대상은 맨 위 한 칸 · 나머지 건물은 열린 것 → 잠긴 것
  const ord = tgt ? orderBuildKinds(kinds, tgt, buildLocked) : null;
  const top = ord?.top ?? null;
  const topRow = top ? `<p class="sub">장부 임무</p><div class="cat mtarget">${card(top)}</div>` : '';
  // BUILDUX §1-8: 최근 놓은 장식 5개 바로가기
  const recent = (PG.decor.recent ?? []).filter((k) => kinds.includes(k as Kind)) as Kind[];
  const recentRow = recent.length ? `<p class="sub">최근 놓은 것</p><div class="cat recent">${recent.map(card).join('')}</div>` : '';
  // 건물 → 장식 (장식은 어울림 재료)
  // DECO_DROP §1: 장식은 묶음 탭(둘레·정원·시장·마을·나무·계절·빛·동물) · 안 본 장식은 NEW
  const unseen = new Set<string>(unseenDrops());
  const decoKinds = kinds.filter((k) => def(k).deco && k !== 'board' && k !== top);
  const g = buildGroup !== '전체' && !decoKinds.some((k) => groupOf(k) === buildGroup) ? '전체' : buildGroup;
  const gcount = (n: string) => decoKinds.filter((k) => groupOf(k) === n && unseen.has(k)).length;
  const gtabs = `<div class="dgrp">${['전체', ...GROUPS()].filter((n) => n === '전체' || decoKinds.some((k) => groupOf(k) === n)).map((n) => `<button data-dg="${n}" class="${n === g ? 'on' : ''}">${n}${n !== '전체' && gcount(n) ? ` <i class="newb">${gcount(n)}</i>` : ''}</button>`).join('')}</div>`;
  const decoCard = (k: Kind) => card(k).replace('<button data-k=', `<button data-g="${groupOf(k)}" ${g !== '전체' && groupOf(k) !== g ? 'hidden' : ''} data-k=`).replace('</b>', unseen.has(k) ? '</b><i class="newb">NEW</i>' : '</b>');
  const items = (ord ? ord.rest : kinds).filter((k) => !def(k).deco || k === 'board').map(card).join('') + `</div><p class="sub">장식 · 가까이 두면 「어울림」이 생겨요${unseen.size ? ` · <b class="g">새 장식 ${unseen.size}</b>` : ''}</p>${gtabs}<div class="cat deco">` + decoKinds.map(decoCard).join('');
  openWin('건설', `<div class="tabs" id="bT"><button class="tab on">건물</button><button class="tab" id="toLand">땅 넓히기</button><button class="tab" id="toLux">✨ 특별 장식</button><button class="tab" id="toDecor">🎨 꾸미기 모드</button></div><p class="sub">원하는 자리에 지어요 · 금화 <b class="g">${fmt(S.gold)}</b></p>${topRow}${recentRow}<div class="cat">${items}</div>`);
  if (top) glowOnce(document.querySelector<HTMLElement>('.cat.mtarget button'), CONFIG.firstFlow.glowMs);
  $('#toLand').onclick = openLand;
  $('#toDecor').onclick = () => buildHooks.decor();
  $('#toLux').onclick = () => openLuxury();
  // 묶음 탭: 창을 다시 그리지 않고 보이기만 바꾼다 (스크롤 그대로)
  $$('.dgrp [data-dg]').forEach(
    (b) =>
      (b.onclick = () => {
        buildGroup = b.dataset.dg!;
        $$('.dgrp [data-dg]').forEach((x) => x.classList.toggle('on', x === b));
        $$('.cat.deco [data-k]').forEach((c) => (c.hidden = buildGroup !== '전체' && c.dataset.g !== buildGroup));
      }),
  );
  // 본 장식은 다음부터 NEW가 아니다
  markSeen([...unseen] as Kind[]);
  $$('.cat button[data-k]').forEach(
    (b) =>
      (b.onclick = () => {
        const k = b.dataset.k as Kind;
        const dl = decoLock(k);
        if (dl && dl !== 'hide') {
          toast(dl);
          return;
        }
        const gate = GATED[k];
        if (gate && !feature(gate)) {
          toast(`버나드의 장부 ${featureChapter(gate)}장을 마치면 지을 수 있어요`);
          return;
        }
        if (def(k).unlock > S.land) {
          toast(`땅을 ${def(k).unlock}단계까지 넓히면 지을 수 있어요`);
          return;
        }
        // TOWN T3: 이미 최대 채수
        if (countKind(k) > 0 && countKind(k) >= maxCopies(k)) {
          toast(`${def(k).name}은(는) 지금 땅에서 ${maxCopies(k)}채까지예요${maxCopies(k) < CONFIG.town.maxCopies[CONFIG.town.maxCopies.length - 1] ? ' · 땅을 넓히면 더 지을 수 있어요' : ''}`);
          return;
        }
        if ((def(k).stars ?? 0) > stars()) {
          toast(`평판 ★${def(k).stars}이 되면 지을 수 있어요`);
          return;
        }
        closeWin();
        startPlace(k);
      }),
  );
}

/**
 * CHECKIN §B: 반짝 테두리 ms 동안 (1초 반짝 × n) · 창을 한 번 누르면 바로 끝
 *  절전 모드 · 「화면 흔들림 끔」이면 움직임 없이 테두리만 (★품질 규칙 5)
 */
export function glowOnce(el: HTMLElement | null, ms: number) {
  if (!el) return;
  el.classList.add('ffglow');
  el.classList.toggle('calm', shakeLv() === 'off');
  el.style.setProperty('--ffn', String(Math.max(1, Math.round(ms / 1000))));
  const end = () => {
    el.classList.remove('ffglow', 'calm');
    document.getElementById('winB')?.removeEventListener('pointerdown', end);
  };
  setTimeout(end, ms);
  document.getElementById('winB')?.addEventListener('pointerdown', end, { once: true });
}

/** DECO_DROP §1: 건설 창 장식 묶음 (기억) */
let buildGroup = '전체';

/** DECO_DROP §2: 「특별 장식」 — 금화만으로 사는 뽐내기 장식 (하나씩 · 마을 평가 가산점) */
export function openLuxury() {
  if (S.visiting) return;
  const all = (Object.keys(CATALOG) as Kind[]).filter((k) => def(k).luxury);
  const can = new Set(buildableKinds());
  const rows = all
    .map((k) => {
      const d = def(k);
      const own = world.objs.some((o) => o.kind === k);
      const lock = k === 'dragon_fossil' && !can.has(k) && !own;
      const poor = S.gold < d.cost;
      const btn = own ? '<button disabled>있어요</button>' : lock ? '<button disabled>잠김</button>' : `<button data-lux="${k}" ${poor ? 'disabled' : ''}>${fmt(d.cost)} G</button>`;
      return `<div class="irow lux"><img class="lthumb" src="${thumb(k)}" alt=""><span><b>${d.name}</b><small>${d.desc}</small></span>${btn}</div>`;
    })
    .join('');
  openWin('특별 장식', `<p class="sub">금화만으로 사는 뽐내기 장식 · 하나씩 · 마을 평가에 하나마다 +20 · 금화 <b class="g">${fmt(S.gold)}</b></p><div class="ilist">${rows}</div><button class="bigbtn ghost" id="luxBack">건설로</button>`);
  $('#luxBack').onclick = () => openBuild();
  $$('[data-lux]').forEach(
    (b) =>
      (b.onclick = () => {
        closeWin();
        startPlace(b.dataset.lux as Kind);
      }),
  );
}

// ───────── 땅 넓히기 ─────────

export function openLand() {
  if (S.visiting) return;
  const rows = CONFIG.land
    .map((L, i) => {
      const st = i + 1;
      const need = CONFIG.landStars[i] ?? 0;
      const right = st === S.land ? '현재' : st < S.land ? '완료' : `${fmt(L.cost)}G`;
      // LAND2: 다음 단계 조건을 줄줄이 (됐으면 초록 · 아니면 빨강)
      const req = st === S.land + 1 ? landReqs(st).filter((r) => !/^금화/.test(r.text)).map((r) => ` · <span class="${r.ok ? 'good' : 'bad'}">${r.text}</span>`).join('') : st > S.land && need ? ` · <span class="${stars() >= need ? 'good' : 'bad'}">평판 ★${need}</span>` : '';
      return `<button class="stp ${st === S.land ? 'cur' : ''}" data-l="${st}" ${st !== S.land + 1 ? 'disabled' : ''}><span style="grid-column:1/3"><b>${st}단계 · ${L.size}칸</b><small>${L.opens}${req}</small></span><em>${right}</em></button>`;
    })
    .join('');
  const note = S.land >= CONFIG.land.length ? '최대 크기예요!' : '한 단계씩 넓힐 수 있어요';
  openWin('땅 넓히기', `<div class="tabs"><button class="tab" id="toBuild">건물</button><button class="tab on">땅 넓히기</button></div><p class="sub">울타리를 밀어서 마을 땅을 넓혀요 · 최대 ${CONFIG.land.length}단계</p><div class="steps">${rows}</div><p class="note">${note}</p>`);
  $$('.stp').forEach(
    (b) =>
      (b.onclick = () => {
        const l = +b.dataset.l!;
        if (l !== S.land + 1) return;
        const why = landWhy(l);
        if (why) {
          toast(why);
          return;
        }
        closeWin();
        game.expandLand(l);
      }),
  );
  $('#toBuild').onclick = () => openBuild();
}

const portrait = (k: string) => PORTRAITS[k] || '';

// ───────── 건물 안 엿보기 ─────────

/** 건물 창 아래에 덧붙일 줄 (베타: 어울림 — ui/harmony가 채운다) */
export const objExtra = { html: (_o: Building) => '' };

export function showObj(o: Building) {
  // EASTER: 꾸미기 모드에서 황금 붓을 누르면 길 붓 도구
  if (o.kind === 'gold_brush' && document.body.classList.contains('decor')) return buildHooks.pathTool();
  const d = def(o.kind);
  if (!S.visiting) {
    if (o.kind === 'smith' && o.build === undefined) return openSmith(o);
    if (o.kind === 'garden' && o.build === undefined) return openGarden(o);
    if (o.kind === 'board' || o.kind === 'dungeon') {
      openBoard();
      return appendMoveButton(o);
    }
  }
  const cost = nextLevelCost(o);
  const canUp = cost != null;
  const act = d.act;
  const doing = (act && INSIDE_TEXT[act]) || '머무는 중';
  const inside = o.inside.map((a) => `<div><img src="${portrait(a.kind)}" alt="">${esc(a.name)} · ${doing}</div>`).join('') || '<div>지금은 비어 있어요</div>';
  const showInside = act && !['train', 'farm', 'fire', 'dungeon'].includes(act);
  const roofs =
    d.roofable && !S.visiting
      ? `<p class="sub" style="margin-top:10px">지붕 색</p><div class="roofs">${ROOFS.map(
          ([n, h]) => `<button data-h="${h}" title="${n}" aria-label="${n}" class="${o.hue === h ? 'on' : ''}" style="background:${h == null ? '#8a8a96' : `hsl(${h} 55% 45%)`}"></button>`,
        ).join('')}</div>`
      : '';
  const grows = d.up && o.sprite && baseKey(o.sprite) !== d.up.sprite ? '더 큰 건물로 · ' : '';
  // 땅 개편: 다음 레벨에 무엇이 바뀌는지 한 줄 · 땅 단계가 모자라면 레벨업 대신 「땅 N단계 필요」
  const note = d.levelNotes?.[o.lvl];
  const needL = landNeedFor(o);
  const landShort = canUp && needL > S.land;
  const up = o.con && !S.visiting
    ? conPanel(o)
    : canUp && !S.visiting
    ? landShort
      ? `<button class="bigbtn ghost" id="upB" disabled>Lv.${o.lvl + 1} · 땅 ${needL}단계 필요</button><p class="note">${note ? `다음: ${esc(note)}` : ''}</p>`
      : `${note ? `<p class="note uplv">Lv.${o.lvl + 1} → ${esc(note)}</p>` : ''}<button class="bigbtn" id="upB">Lv.${o.lvl + 1}/${maxLevel(o.kind)} · ${note ? '레벨업' : grows + (d.levelText ?? '')} (${fmt(cost!)} G)</button>`
    : '';
  openWin(
    // TOWN T3: 「온천 (2/3채)」
    d.name + (o.lvl > 1 ? ' Lv.' + o.lvl : '') + (!S.visiting && !MULTI(o.kind) && Number.isFinite(maxCopies(o.kind)) && maxCopies(o.kind) > 1 ? ` (${countKind(o.kind)}/${maxCopies(o.kind)}채)` : ''),
    `<p class="sub">${d.desc}${!S.visiting && countKind(o.kind) > 1 && !MULTI(o.kind) ? ` · ${copyIncomeMult(o) < 1 ? '이 채는 수입 70% (가장 높은 레벨 한 채만 100%)' : '이 채가 대표 (수입 100%)'}` : ''}</p>${S.visiting ? '' : objExtra.html(o)}${showInside ? `<b class="g">안에 있는 손님</b><div class="inside">${inside}</div>` : ''}${roofs}${up}`,
  );
  $$('.roofs button').forEach(
    (b) =>
      (b.onclick = () => {
        game.setRoof(o, b.dataset.h === 'null' ? null : +b.dataset.h!);
        $$('.roofs button').forEach((x) => x.classList.toggle('on', x === b));
      }),
  );
  appendMoveButton(o);
  const ub = document.getElementById('upB');
  if (ub) ub.onclick = () => game.upgrade(o);
  bindConPanel(o);
}

// ───────── CONSTRUCTION_SPEC §5: 건물 창의 공사 칸 ─────────
function conPanel(o: Building): string {
  const c = o.con!;
  const what = c.kind === 'up' ? `Lv.${c.to} 공사 중` : '짓는 중';
  return `<div class="conp"><b>🔨 ${what}</b><div class="cbar"><i style="width:${Math.round(conProgress(o) * 100)}%"></i></div><span class="ct" id="conT">${clock(conLeft(o))}</span>
    <p class="note">빨리 짓기는 건물을 톡톡!${c.cut ? ` <b>톡톡 ×${c.cut}</b>` : ''}${c.kind === 'up' ? ' · 공사 중에도 건물은 그대로 일해요' : ''}</p>
    ${cheerReady() ? '<button class="bigbtn sm" id="conCheer">📮 모모의 응원 · 바로 완성 (하루 1번)</button>' : '<p class="note">모모의 응원은 내일 다시 쓸 수 있어요</p>'}</div>`;
}
function bindConPanel(o: Building) {
  const ch = document.getElementById('conCheer');
  if (ch)
    ch.onclick = () => {
      if (!cheerCon(o)) return;
      closeWin();
      trackEv('con_cheer', { kind: o.kind });
      talk([['post', '사장님 화이팅~! 제가 일꾼들 간식 돌렸어요. 바로 끝났대요!']]);
    };
  const t = document.getElementById('conT');
  if (!t) return;
  const iv = setInterval(() => {
    const el = document.getElementById('conT');
    if (!el || !o.con) {
      clearInterval(iv);
      if (el && !o.con) showObj(o);
      return;
    }
    el.textContent = clock(conLeft(o));
    const bar = document.querySelector('.conp .cbar i') as HTMLElement | null;
    if (bar) bar.style.width = `${Math.round(conProgress(o) * 100)}%`;
  }, 500);
}

// ───────── 메뉴·계정 ─────────


// ───────── 우체부 모모: 제보 편지 ─────────

export function openReport() {
  // 핫픽스 7 (8-4): 편지는 로그인한 사람만 (손님에게 "잘 받았어요"라고 거짓 안내하지 않는다)
  if (!online()) {
    talk([['post', '편지는 계정이 있어야 배달할 수 있어요. 로그인하고 다시 와 주세요!']], () => {
      openWin('모모에게 편지', `<p class="sub">로그인하면 편지가 개발자님께 바로 배달돼요.</p><div class="menu"><button class="bigbtn" id="repLogin">로그인/가입하기</button></div>`);
      $('#repLogin').onclick = () => openAccount();
    });
    return;
  }
  talk(
    [
      ['post', '안녕하세요! 우체부 모모예요.'],
      ['post', '버그나 아쉬운 점이 있으면 편지로 남겨 주세요. 개발자님께 꼭 전해 드릴게요!'],
    ],
    () => {
      openWin(
        '모모에게 편지 쓰기',
        `<form class="report" id="rep"><label>종류<select id="rk"><option>버그 제보</option><option>개선 건의</option><option>칭찬</option></select></label><label>내용<textarea id="rt" rows="4" maxlength="300" placeholder="예) 온천 옆에서 손님이 길을 잃었어요"></textarea></label><button>편지 보내기</button></form><p class="note">급한 건 카톡방에서 더 빨리 답해 드려요 → ${communityLink('report', '톡방')}</p>`,
      );
      ($('#rep') as HTMLFormElement).onsubmit = (e) => {
        e.preventDefault();
        const text = ($('#rt') as HTMLTextAreaElement).value.trim();
        if (!text) {
          toast('내용을 적어 주세요');
          return;
        }
        const kind = ($('#rk') as HTMLSelectElement).value;
        const btn = $('#rep button') as HTMLButtonElement;
        btn.disabled = true;
        btn.textContent = '배달 중…';
        // 서버(bug_letters) 결과를 확인하고 나서만 "잘 받았어요"
        void sendLetter(`[${kind}] ${text.slice(0, 300)}`, `v${APP_VERSION}`).then((ok) => {
          if (ok) {
            addReport({ kind, text, at: Date.now() });
            closeWin();
            talk([['post', '편지 잘 받았어요! 운영자님이 읽고 답장하면 우편함으로 보내 드릴게요~']]);
          } else {
            btn.disabled = false;
            btn.textContent = '편지 보내기';
            talk([['post', '배달에 실패했어요. 잠시 뒤 다시 보내 주세요']]);
          }
        });
      };
    },
  );
}
