// 새 버전 알림 · 자동 업데이트 · 패치노트 (핫픽스 7 8-2 · 8-3)
//  - 앱으로 돌아올 때와 10분마다 version.json을 캐시 없이 확인 → 위쪽 띠 「새 버전 vX · 눌러서 업데이트」
//  - 누르면 저장을 먼저 끝내고 새로고침 · 전투 중이면 끝난 뒤에 띠 · 날짜가 바뀌었으면 띠 없이 바로
//  - 업데이트 후 첫 화면에 패치노트 카드 한 번
import { getPref, hasSave, setPref, writeSave } from '../save/save';
import { S } from '../world/state';
import { isWinOpen, openWin } from './windows';

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
}

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
/** 패치노트 목록: 최신만 펼침 */
export function notesListHtml(list: PatchNote[]) {
  if (!list.length) return '<p class="sub">패치노트를 불러오지 못했어요</p>';
  return `<div class="pnlist">${list
    .map((n, i) => `<details class="pn" ${i ? '' : 'open'}><summary><b>v${esc(n.version)}</b> ${esc(n.title)}<small>${esc(n.date)}</small></summary>${noteHtml(n)}</details>`)
    .join('')}</div>`;
}

export async function openPatchNotes() {
  const list = await loadPatchNotes();
  openWin('패치노트', notesListHtml(list), 'wide');
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
  for (let i = 0; i < 300 && (isWinOpen() || !document.getElementById('title')?.hidden); i++) await new Promise((r) => setTimeout(r, 1000));
  openWin(`v${n.version} 업데이트`, `<p class="pn-title">${esc(n.title)}</p>${noteHtml(n)}<p class="sub">메뉴 → 공지 → 패치노트에서 다시 볼 수 있어요</p>`, 'pncard');
}

// ───────── 새 버전 확인 ─────────

let newer: { version: string; build: string } | null = null;
let busy: () => boolean = () => false;
const bootDay = new Date().toDateString();

/** 저장 → 새로고침 (진행은 저장 마이그레이션으로 이어진다) */
export function applyUpdate() {
  try {
    if (S.started) writeSave();
  } catch {
    /* 저장 실패해도 새로고침은 한다 — 마지막 자동 저장이 남아 있다 */
  }
  location.reload();
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

export async function checkVersion() {
  if (APP_VERSION === 'dev' || import.meta.env.DEV) return;
  try {
    const r = await fetch(new URL(`version.json?t=${Date.now()}`, document.baseURI).href, { cache: 'no-store' });
    if (!r.ok) return;
    const v = (await r.json()) as { version: string; build: string };
    if (!v.build || v.build === BUILD) return;
    newer = v;
  } catch {
    return;
  }
  // 하루가 지났고 지금 바쁘지 않으면: 띠 없이 바로 새 버전으로
  if (new Date().toDateString() !== bootDay && !busy()) return applyUpdate();
  if (!busy()) showBar();
}

/** 전투가 끝나면 부른다: 미뤄 둔 띠를 이제 보여 준다 */
export function afterBusy() {
  if (newer && !busy()) showBar();
}

export function initUpdate(isBusy: () => boolean) {
  busy = isBusy;
  addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void checkVersion());
  setInterval(() => void checkVersion(), 10 * 60 * 1000);
  setTimeout(() => void checkVersion(), 15000);
}
