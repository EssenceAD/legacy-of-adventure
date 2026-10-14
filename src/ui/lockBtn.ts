// 전역 규칙 「회색 버튼엔 이유」 (테스터 제보): 막힌 버튼은 disabled 대신 「눌리지만 실행 안 함」
//  · 겉모습은 그대로 회색 (style.css 의 [disabled] 규칙이 [aria-disabled="true"] 도 같이 칠한다)
//  · 누르면 이유를 토스트로 (disabled 는 클릭을 삼켜서 핸들러 안의 이유 토스트가 안 뜨던 문제)
//  · 버튼 바로 아래 작은 한 줄로도 이유 (lockNote)
//  쓰는 법: `<button id="x" ${lockAttr(why)}>…</button>${lockNote(why)}` — why 가 비면 둘 다 '' (보통 버튼)
//  눌림은 문서 하나에 붙인 캡처 단계 핸들러가 먼저 받아 막는다 → 버튼의 onclick 은 아예 안 불린다
import { esc } from './common';
import { CONFIG } from '../data/config';
import { toast } from './windows';

/** 이유 토스트 — 창 위로 (보통 토스트는 창 아래 층이라 큰 창에 가려진다) */
let overT = 0;
export function sayLock(s: string) {
  toast(s);
  const t = document.getElementById('toast');
  if (!t) return;
  t.classList.add('over');
  clearTimeout(overT);
  overT = window.setTimeout(() => t.classList.remove('over'), CONFIG.ui.toastMs + 400);
}

/** 막힌 버튼 표시 (버튼 태그 안에 넣는 속성 글) · 이유가 없으면 '' */
export function lockAttr(reason: string | null | undefined): string {
  if (!reason) return '';
  installLockBtn();
  return `aria-disabled="true" data-lock="${esc(reason)}"`;
}
/** 버튼 바로 아래 작은 한 줄 (이유) · 이유가 없으면 '' */
export function lockNote(reason: string | null | undefined, id = ''): string {
  return reason ? `<p class="lockwhy"${id ? ` id="${id}"` : ''}>${esc(reason)}</p>` : '';
}
/** 이미 그린 버튼을 막거나 풀기 (DOM) */
export function setLock(el: HTMLElement | null, reason: string | null | undefined) {
  if (!el) return;
  if (reason) {
    installLockBtn();
    el.setAttribute('aria-disabled', 'true');
    el.dataset.lock = reason;
  } else {
    el.removeAttribute('aria-disabled');
    delete el.dataset.lock;
  }
}
/** 그 요소(또는 조상)가 막힌 버튼이면 이유 · 아니면 null */
export function lockReason(t: EventTarget | null): string | null {
  const el = (t as Element | null)?.closest?.<HTMLElement>('[data-lock][aria-disabled="true"]');
  return el ? (el.dataset.lock ?? '') : null;
}
/** 눌림 하나 처리: 막힌 버튼이면 실행을 막고 이유를 말한다 (true = 막음) */
export function onLockClick(e: Event, say: (s: string) => void = sayLock): boolean {
  const why = lockReason(e.target);
  if (why == null) return false;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (why) say(why);
  return true;
}

let installed = false;
/** 문서에 한 번만: 캡처 단계에서 막힌 버튼 눌림을 가로챈다 */
export function installLockBtn() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', (e) => onLockClick(e), true);
}
