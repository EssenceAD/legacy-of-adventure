// HARVEST §3: 계정 삭제 — 계정 창 맨 아래 빨간 버튼 → ① 안내 → ② 여관 이름 그대로 → ③ 3초 길게 누르기(게이지)
//  로그인 안 한 여관: guest 문구 + 이 기기 저장만 지운다 · 운영자 계정은 버튼을 숨긴다(서버도 거절)
//  중요: 삭제 RPC를 부르기 '전에' 자동 저장·클라우드 올리기를 멈춘다 (지운 뒤 저장이 다시 올라가지 않게)
import { ACCOUNT_DELETE_TEXT as T } from '../data/story/account';
import { call, amAdmin, refreshAdmin } from '../net/direction';
import { logout, me, online } from '../net/server';
import { cloudBusy, haltCloud } from '../net/sync';
import { haltSaves } from '../save/save';
import { flag } from '../world/flags';
import { S } from '../world/state';
import { $, esc } from './common';
import { closeWin, onWinClose, openWin, toast } from './windows';
import { confirmSheet } from './confirmSheet';
import { vis } from '../world/visual';

const HOLD_MS = 3000;
const PREFIX = 'legacy-of-adventure';

/** 시험용: RPC 바꿔 끼우기 · 부른 기록 */
export const _delTest = { rpc: null as null | ((inn: string) => Promise<string | null>), calls: [] as string[], reload: true };

/** 계정 창 맨 아래 줄 (꺼져 있거나 운영자면 빈 문자열) */
export function deleteRowHtml(): string {
  if (!flag('accountDelete') || amAdmin()) return '';
  return `<div class="acdel"><button id="acDel">${esc(T.button)}</button></div>`;
}
/** 줄을 붙인 뒤 연결 — 운영자 확인이 늦게 오면 그때 숨긴다 */
export function bindDeleteRow(guest: boolean) {
  const b = document.getElementById('acDel');
  if (!b) return;
  b.onclick = () => openDelete(guest);
  if (!guest && me.profile)
    void refreshAdmin().then((a) => {
      if (a) document.querySelector('.acdel')?.remove();
    });
}

const expectedName = () => S.innName || me.profile?.inn_name || '';

/** ① 안내 */
export function openDelete(guest = !online()) {
  if (!flag('accountDelete')) return;
  if (!guest && amAdmin()) return;
  // J4 confirmSheet: ① 안내는 아래 확인 시트로 (빨강 [다음] → ② 이름 → ③ 길게 누르기는 그대로)
  if (vis('confirmSheet')) {
    void confirmSheet({ title: T.title, body: guest ? T.guest : T.body.join('\n'), ok: '다음', no: '돌아가기', danger: true }).then((ok) => ok && stepName(guest));
    return;
  }
  const body = guest ? `<p class="sub">${esc(T.guest)}</p>` : T.body.map((l, i) => `<p class="${i === 0 ? 'sub bad' : 'sub'}">${esc(l)}</p>`).join('');
  openWin(T.title, `<div class="acdelw" data-step="1">${body}</div><div class="btnrow"><button class="bigbtn ghost" id="adBack">돌아가기</button><button class="bigbtn red" id="adNext">다음</button></div>`);
  $('#adBack').onclick = () => closeWin();
  $('#adNext').onclick = () => stepName(guest);
}

/** ② 여관 이름 그대로 */
function stepName(guest: boolean) {
  const want = expectedName();
  openWin(
    T.title,
    `<div class="acdelw" data-step="2"><form class="report acc-form" id="adF"><label>${esc(T.confirmLabel)}<input id="adInn" type="text" placeholder="${esc(want)}" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="24"></label></form></div>
    <div class="btnrow"><button class="bigbtn ghost" id="adBack">돌아가기</button><button class="bigbtn red" id="adNext">다음</button></div>`,
  );
  const go = () => {
    const v = ($('#adInn') as HTMLInputElement).value.trim();
    if (!v || v !== want.trim()) return toast(T.wrongName);
    stepHold(guest, v);
  };
  ($('#adF') as HTMLFormElement).onsubmit = (e) => {
    e.preventDefault();
    go();
  };
  $('#adBack').onclick = () => closeWin();
  $('#adNext').onclick = go;
}

/** ③ 3초 길게 누르기 (누르는 동안 게이지 · 떼면 처음부터) */
function stepHold(guest: boolean, inn: string) {
  openWin(
    T.title,
    `<div class="acdelw" data-step="3"><p class="sub">${esc(T.hold)}</p>
    <button class="adhold" id="adHold"><i id="adGauge"></i><span>${esc(T.button)}</span></button></div>
    <div class="btnrow"><button class="bigbtn ghost" id="adBack">돌아가기</button></div>`,
  );
  $('#adBack').onclick = () => closeWin();
  const btn = $('#adHold') as HTMLButtonElement;
  const gauge = $('#adGauge') as HTMLElement;
  let t0 = 0;
  let raf = 0;
  let fired = false;
  const stop = () => {
    cancelAnimationFrame(raf);
    t0 = 0;
    if (!fired) gauge.style.width = '0%';
  };
  const tick = () => {
    if (!t0 || fired) return;
    const p = Math.min(1, (performance.now() - t0) / HOLD_MS);
    gauge.style.width = `${Math.round(p * 100)}%`;
    if (p >= 1) {
      fired = true;
      btn.disabled = true;
      void doDelete(guest, inn);
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  btn.onpointerdown = (e) => {
    e.preventDefault();
    if (fired) return;
    t0 = performance.now();
    raf = requestAnimationFrame(tick);
  };
  btn.onpointerup = stop;
  btn.onpointerleave = stop;
  btn.onpointercancel = stop;
  btn.oncontextmenu = (e) => e.preventDefault();
}

/** 이 기기의 게임 키 전부 (저장 · 백업 · 설정 · 로그인 토큰 · 기록) + 캐시 */
export async function wipeLocal() {
  try {
    const ks: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(PREFIX) || k.startsWith('tapMiss:'))) ks.push(k);
    }
    for (const k of ks) localStorage.removeItem(k);
  } catch {
    /* 저장소가 막혀 있으면 넘어간다 */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* 무시 */
  }
  try {
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
  } catch {
    /* 무시 */
  }
}

async function doDelete(guest: boolean, inn: string) {
  const name = S.innName || inn;
  // 1) 자동 저장 · 클라우드 올리기부터 멈춘다 (진행 중인 올리기는 끝날 때까지 잠깐 기다림)
  haltSaves(true);
  haltCloud(true);
  for (let i = 0; i < 30 && cloudBusy(); i++) await new Promise((r) => setTimeout(r, 100));
  if (!guest) {
    _delTest.calls.push(inn);
    const r = _delTest.rpc ? await _delTest.rpc(inn) : await call<string>('delete_my_account', { p_inn: inn });
    if (r !== 'ok') {
      // 못 지웠으면 저장을 다시 켠다
      haltSaves(false);
      haltCloud(false);
      openWin(T.title, `<p class="sub bad" id="adErr" data-code="${esc(String(r ?? 'error'))}">${esc(r === 'wrong_name' ? T.wrongName : T.fail)}</p><div class="btnrow"><button class="bigbtn" id="adOk">확인</button></div>`);
      $('#adOk').onclick = () => closeWin();
      return;
    }
    try {
      await logout();
    } catch {
      /* 이미 지워진 계정 — 토큰만 지우면 된다 */
    }
    me.profile = null;
  }
  await wipeLocal();
  openWin(T.title, `<p class="sub" id="adDone">${esc(T.done.replace('{inn}', name || '여관'))}</p><div class="btnrow"><button class="bigbtn" id="adOk">확인</button></div>`);
  // 확인(또는 ✕) → 타이틀로 (새로 불러오면 저장이 없으니 처음 화면)
  const toTitle = () => {
    if (_delTest.reload) location.reload();
  };
  onWinClose(toTitle);
  $('#adOk').onclick = () => closeWin();
}
