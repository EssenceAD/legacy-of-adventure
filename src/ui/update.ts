// 새 버전 알림 · 자동 업데이트 · 패치노트 (핫픽스 7 8-2 · 8-3)
//  - 앱으로 돌아올 때와 10분마다 version.json을 캐시 없이 확인 → 위쪽 띠 「새 버전 vX · 눌러서 업데이트」
//  - 누르면 저장을 먼저 끝내고 새로고침 · 전투 중이면 끝난 뒤에 띠 · 날짜가 바뀌었으면 띠 없이 바로
//  - 업데이트 후 첫 화면에 패치노트 카드 한 번
import { getPref, hasSave, setPref, writeSave } from '../save/save';
import { HIGHLIGHTS, highlightGo, type Highlight } from './notice';
import { track as trackEv } from '../net/telemetry';
import { S } from '../world/state';
import { creditLine, normVer } from '../data/credits';
import { letterCredits } from '../net/direction';
import { closeWin, isWinOpen, openWin, toast } from './windows';

declare const __APP_VERSION__: string;
declare const __BUILD__: string;
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';

export interface PatchNote {
  version: string;
  date: string;
  title: string;
  items: string[];
  fixes: string[];
  /** HOTFIX14 §5: 이 버전의 업데이트 선물 (있을 때만) */
  gift?: { gold?: number; dust?: number; dustR?: number; cheer?: number; deco?: string };
  /** DIRECTION §3-1: 정기 업데이트(목요일) · 핫픽스 — 없으면 정기로 친다 (옛 노트) · 업데이트 선물은 정기에만 */
  kind?: '정기' | '핫픽스';
}

/** 버전 a ≤ b (0.11.3-beta 꼴) */
export const verLE = (a: string, b: string) => {
  const p = (v: string) => v.replace(/-.*/, '').split('.').map(Number);
  const [x, y] = [p(a), p(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  return true;
};
/** HOTFIX14 §5 + DIRECTION §3-1: 지금 버전 이하에서 가장 새 「정기」 업데이트 선물 (핫픽스 선물은 주지 않는다) */
export const giftNote = (list: PatchNote[], ver: string) => list.find((x) => x.gift && x.kind !== '핫픽스' && verLE(x.version, ver));

let notes: PatchNote[] | null = null;
export async function loadPatchNotes(): Promise<PatchNote[]> {
  if (notes) return notes;
  try {
    const r = await fetch(new URL('patchnotes.json', document.baseURI).href, { cache: 'no-cache' });
    notes = r.ok ? ((await r.json()) as PatchNote[]) : [];
  } catch {
    notes = [];
  }
  return notes;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** 한 버전 (접고 펼치는 목록에도 · 카드에도) */
export function noteHtml(n: PatchNote) {
  return `${n.items.length ? `<ul class="pn-items">${n.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}${
    n.fixes.length ? `<p class="pn-h">고친 것</p><ul class="pn-fixes">${n.fixes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''
  }`;
}
/** 패치노트 목록: 최신만 펼침 · DIRECTION §2-1 반영 크레딧 줄 · §3-1 정기/핫픽스 표시 */
export function notesListHtml(list: PatchNote[], credits?: Map<string, string[]>) {
  if (!list.length) return '<p class="sub">패치노트를 불러오지 못했어요</p>';
  return `<div class="pnlist">${list
    .map((n, i) => {
      const cl = creditLine(credits?.get(normVer(n.version)) ?? []);
      return `<details class="pn" ${i ? '' : 'open'}><summary><b>v${esc(n.version)}</b>${n.kind ? ` <i class="pnk ${n.kind === '핫픽스' ? 'hot' : ''}">${esc(n.kind)}</i>` : ''} ${esc(n.title)}<small>${esc(n.date)}</small></summary>${noteHtml(n)}${cl ? `<p class="pn-credit">${esc(cl)}</p>` : ''}</details>`;
    })
    .join('')}</div>`;
}

export async function openPatchNotes() {
  const list = await loadPatchNotes();
  openWin('패치노트', notesListHtml(list, await letterCredits()), 'wide');
}

/** 업데이트 후 첫 화면: 카드 한 번 (새 플레이어는 띄우지 않고 기록만) */
export async function maybeShowPatchCard() {
  const seen = getPref<string>('lastVersion', '');
  if (seen === APP_VERSION || APP_VERSION === 'dev') return;
  setPref('lastVersion', APP_VERSION);
  if (!seen && !hasSave()) return;
  const n = (await loadPatchNotes()).find((x) => x.version === APP_VERSION);
  if (!n) return;
  // 다른 창(방치 요약·출석 등)이 떠 있으면 닫힐 때까지 기다렸다가 (겹쳐 쌓지 않게)
  for (let i = 0; i < 300 && (isWinOpen() || !document.getElementById('title')?.hidden || !document.getElementById('dlg')?.hidden); i++) await new Promise((r) => setTimeout(r, 1000));
  // HOTFIX18 §4: 핵심 기능이 있으면 패치 노트 대신 「새로 생긴 것」 카드 (다시 보지 않기를 고르면 예전처럼 패치 노트)
  const hl = HIGHLIGHTS[APP_VERSION];
  if (hl?.length && !getPref<boolean>('hlOff', false)) return showHighlights(hl);
  openWin(`v${n.version} 업데이트`, `<p class="pn-title">${esc(n.title)}</p>${noteHtml(n)}<p class="sub">메뉴 → 공지 → 패치노트에서 다시 볼 수 있어요</p>`, 'pncard');
}

/** HOTFIX18 §4: 「새로 생긴 것」 카드 — 아이콘 · 한 줄 · [해 보기] · 다시 보지 않기 · 패치 노트 전체 */
export function showHighlights(hl: Highlight[]) {
  openWin(
    '새로 생긴 것',
    `<div class="hl">${hl.map((h, i) => `<div class="hlrow"><i>${h.icon}</i><span>${esc(h.text)}</span><button class="bigbtn sm" data-hl="${i}">${esc(h.label)}</button></div>`).join('')}</div>
    <div class="btnrow"><button class="bigbtn ghost sm" id="hlAll">패치 노트 전체</button><button class="bigbtn ghost sm" id="hlOff">다시 보지 않기</button></div>`,
    'hlcard',
  );
  document.querySelectorAll<HTMLElement>('[data-hl]').forEach(
    (b) =>
      (b.onclick = () => {
        const h = hl[+b.dataset.hl!];
        trackEv('highlight_go', { go: h.go, ver: APP_VERSION });
        closeWin();
        highlightGo[h.go]();
      }),
  );
  document.getElementById('hlAll')!.onclick = () => openPatchNotes();
  document.getElementById('hlOff')!.onclick = () => {
    setPref('hlOff', true);
    closeWin();
    toast('다음부턴 패치 노트로 보여 드릴게요');
  };
}

// ───────── 새 버전 확인 ─────────

let newer: { version: string; build: string } | null = null;
let busy: () => boolean = () => false;
const bootDay = new Date().toDateString();

/**
 * 저장 → 새 서비스워커 받기 → 자리 잡을 때까지(controllerchange, 최대 3초) 기다림 → 새로고침.
 *  핫픽스 13: 예전엔 바로 reload 해서 아이폰 홈 화면 앱에서 옛 SW 교체·캐시 지우기와 그림 150여 개 로딩이 겹쳐 「그림을 불러오지 못했어요」가 났다.
 */
let applying = false;
export async function applyUpdate() {
  if (applying) return;
  applying = true;
  try {
    if (S.started) writeSave();
  } catch {
    /* 저장 실패해도 새로고침은 한다 — 마지막 자동 저장이 남아 있다 */
  }
  const bar = document.getElementById('updNow') ?? document.getElementById('updBar');
  if (bar) bar.textContent = '새 버전 받는 중…';
  await waitNewWorker(3000);
  location.reload();
}
async function waitNewWorker(ms: number) {
  try {
    const sw = navigator.serviceWorker;
    const reg = sw && (await sw.getRegistration());
    if (!reg) return;
    const changed = new Promise<void>((r) => sw.addEventListener('controllerchange', () => r(), { once: true }));
    await Promise.race([reg.update().catch(() => {}), new Promise((r) => setTimeout(r, ms))]);
    // 새 SW가 설치·대기 중이면 자리 잡을 때까지 (skipWaiting → activate → clients.claim → controllerchange)
    if (reg.installing || reg.waiting) {
      reg.waiting?.postMessage('skipWaiting');
      await Promise.race([changed, new Promise((r) => setTimeout(r, ms))]);
    }
  } catch {
    /* 서비스워커가 없거나 막혀 있으면 그냥 새로고침 */
  }
}

function showBar() {
  if (!newer) return;
  let bar = document.getElementById('updBar');
  if (!bar) {
    bar = document.createElement('button');
    bar.id = 'updBar';
    bar.className = 'px';
    bar.onclick = applyUpdate;
    document.getElementById('app')?.appendChild(bar) ?? document.body.appendChild(bar);
  }
  bar.textContent = `새 버전 v${newer.version.replace(/-beta$/, '')} · 눌러서 업데이트`;
  bar.hidden = false;
}

// ───────── 핫픽스 10 §14: 새 버전 알림 창 (가운데 · 뒤 어둡게) ─────────
//  「지금 다시 시작」 = applyUpdate · 「조금 있다가」 = 창 닫고 띠는 남김 → 10분 뒤 다시 창
//  version.json의 force: true면 「조금 있다가」 없음 · ✕·Esc·뒤로로 못 닫음 (창 쌓기와 따로 노는 덮개)
const LATER_MS = 10 * 60 * 1000;
let popAt = 0;
let popOn = false;

async function popupHtml(v: { version: string; force?: boolean }) {
  // 새 버전의 패치노트 (옛 목록 캐시 말고 서버에서 새로)
  let lines: string[] = [];
  try {
    const r = await fetch(new URL(`patchnotes.json?t=${Date.now()}`, document.baseURI).href, { cache: 'no-store' });
    const n = r.ok ? ((await r.json()) as PatchNote[]).find((x) => x.version === v.version) : null;
    if (n) lines = [...n.items, ...n.fixes].slice(0, 3);
  } catch {
    /* 미리 보기 없이 */
  }
  return `<div class="updcard px"><p class="updt">🛎 새 버전이 나왔어요! <b>(v${esc(v.version.replace(/-beta$/, ''))})</b></p>
    <p class="updm"><b>모모</b> 여관 수리가 끝났어요~ 다시 문 열어 주세요!</p>
    ${lines.length ? `<ul class="updl">${lines.map((t) => `<li>${esc(t.replace(/\*\*/g, ''))}</li>`).join('')}</ul>` : ''}
    ${v.force ? '<p class="updf">꼭 받아야 하는 업데이트예요 · 진행은 저장돼요</p>' : ''}
    <div class="updb"><button class="bigbtn" id="updNow">지금 다시 시작</button>${v.force ? '' : '<button class="bigbtn ghost" id="updLater">조금 있다가</button>'}</div></div>`;
}

async function showPopup() {
  if (!newer || popOn || busy()) return;
  popOn = true;
  const v = newer;
  const el = document.createElement('div');
  el.id = 'updPop';
  el.innerHTML = await popupHtml(v);
  (document.getElementById('view') ?? document.body).appendChild(el);
  el.querySelector<HTMLElement>('#updNow')!.onclick = applyUpdate;
  const later = el.querySelector<HTMLElement>('#updLater');
  if (later)
    later.onclick = () => {
      el.remove();
      popOn = false;
      popAt = Date.now() + LATER_MS;
      showBar();
    };
}

export async function checkVersion() {
  if (APP_VERSION === 'dev' || import.meta.env.DEV) return;
  try {
    const r = await fetch(new URL(`version.json?t=${Date.now()}`, document.baseURI).href, { cache: 'no-store' });
    if (!r.ok) return;
    const v = (await r.json()) as { version: string; build: string; force?: boolean };
    if (!v.build || v.build === BUILD) return;
    newer = v;
  } catch {
    return;
  }
  // 하루가 지났고 지금 바쁘지 않으면: 창 없이 바로 새 버전으로
  if (new Date().toDateString() !== bootDay && !busy()) return applyUpdate();
  pump();
}
/** 바쁘지 않고 때가 됐으면 창 (전투·토벌·대화 중이면 끝난 뒤) */
function pump() {
  if (!newer || popOn || busy()) return;
  if ((newer as { force?: boolean }).force || Date.now() >= popAt) void showPopup();
}

/** 전투가 끝나면 부른다: 미뤄 둔 창을 이제 보여 준다 */
export function afterBusy() {
  pump();
}

/** 시험용(개발 서버): version.json 대신 가짜 새 버전 */
export function _fakeNewer(v: { version: string; build: string; force?: boolean }) {
  newer = v;
  popAt = 0;
  pump();
}

export function initUpdate(isBusy: () => boolean) {
  busy = isBusy;
  addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void checkVersion());
  setInterval(() => void checkVersion(), 5 * 60 * 1000);
  setTimeout(() => void checkVersion(), 15000);
  // 바쁜 게 끝났는지 · 「조금 있다가」 10분이 지났는지
  setInterval(pump, 2000);
  // 알림 창이 떠 있으면 Esc가 뒤의 창을 닫지 않게 (창은 버튼으로만)
  addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && document.getElementById('updPop')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
}
