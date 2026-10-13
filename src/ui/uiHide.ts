// CHECKIN §L2 (uiHide): UI 끄기 = 구경 모드
//  · 👁 버튼(예전 HUD: 오른쪽 버튼 줄 「소리」 아래 · 새 HUD: 오른쪽 작은 버튼 줄 맨 아래) → 모든 UI가 숨고 마을만
//    (손님 걷기·낮밤·날씨 그대로 · 확대·이동 됨 — 짧게 누르기는 아무것도 열지 않는다)
//  · 화면 아무 데나 두 번 누르기 · 뒤로가기 · Esc → 복귀 · 오른쪽 위 작은 [📷] → 사진 모드(찍기·틀)로 넘어감
//  · 숨긴 동안 대기 이벤트(단골 제안 등)는 안 띄운다 (main.ts busy) — 「새 이야기」 배지에 쌓이기만
import { vis } from '../world/visual';
import { S } from '../world/state';
import { track as trackEv } from '../net/telemetry';
import { enterPhoto } from './photo';

let on = false;
/** 뒤로가기로 닫으려고 쌓은 history 항목이 지금 맨 위인가 */
let pushed = false;
let ignorePop = 0;
let lastTap = 0;
export const uiHidden = () => on;

export function enterUiHide() {
  if (on || !vis('uiHide') || !S.started) return;
  on = true;
  document.body.classList.add('uihide');
  const bar = document.createElement('div');
  bar.id = 'uiHideBar';
  bar.innerHTML = `<button class="ibtn px" id="uhPhoto" aria-label="사진 모드">📷</button><small>두 번 누르면 돌아와요</small>`;
  document.getElementById('view')!.appendChild(bar);
  bar.querySelector<HTMLElement>('#uhPhoto')!.onclick = (e) => {
    e.stopPropagation();
    exitUiHide();
    enterPhoto();
  };
  addEventListener('keydown', onKey, true);
  try {
    history.pushState({ legacyUiHide: 1 }, '');
    pushed = true;
  } catch {
    pushed = false;
  }
  trackEv('ui_hide', { on: true });
}
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  exitUiHide();
}
export function exitUiHide(fromPop = false) {
  if (!on) return;
  on = false;
  document.body.classList.remove('uihide');
  document.getElementById('uiHideBar')?.remove();
  removeEventListener('keydown', onKey, true);
  // 우리가 쌓은 항목이 아직 맨 위면 걷어 낸다 (그 popstate는 무시)
  if (!fromPop && pushed && (history.state as { legacyUiHide?: number } | null)?.legacyUiHide) {
    ignorePop++;
    history.back();
  }
  pushed = false;
}
/** main.ts tap(): 숨긴 동안 짧게 누르기 — 두 번(0.35초 안)이면 복귀, 한 번은 아무것도 안 함 */
export function uiHideTap() {
  const now = performance.now();
  if (now - lastTap < 350) {
    lastTap = 0;
    exitUiHide();
  } else lastTap = now;
}

export function initUiHide() {
  addEventListener('popstate', () => {
    if (ignorePop) return void ignorePop--;
    if (on) exitUiHide(true);
  });
  if (!vis('uiHide')) return;
  const b = document.createElement('button');
  b.id = 'bEye';
  b.className = 'ibtn px hb';
  b.setAttribute('aria-label', 'UI 끄기 (구경 모드)');
  b.innerHTML = '<b>👁</b><small>구경</small>';
  b.onclick = (e) => {
    e.stopPropagation();
    enterUiHide();
  };
  document.getElementById('hud')!.appendChild(b);
}
