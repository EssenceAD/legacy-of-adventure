// CHECKIN §J4 누르는 느낌 (플래그 pressFeel · 형철 확인 전엔 꺼짐 — vis) + 엄지 자리 body 클래스 (thumbZone)
//  · 버튼을 누르면 적어도 0.08초 「눌림」(살짝 어둡게 · 9-slice 버튼은 1px 아래로 — 새 그림 없음, style.css body.j4press)
//  · 안드로이드 폰에서만 아주 짧은 진동 (설정 「진동」 = 저장 키 haptics · 없으면 켬) — iOS·PC는 진동 없음(기능 확인)
//  · 끄면 body 클래스도 리스너도 없음 → 예전과 똑같다
import { getPref } from '../save/save';
import { vis } from '../world/visual';

const MIN_MS = 80;
const BUZZ_MS = 8;
const SEL = 'button, [role="button"], .tab';

/** 진동을 낼 수 있는 기기인가: 안드로이드 · 손가락 화면 · navigator.vibrate 있음 */
export function canBuzz(): boolean {
  try {
    return typeof navigator.vibrate === 'function' && /Android/i.test(navigator.userAgent) && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
/** 설정 「진동」 (C2 설정 기본 탭 · 키 haptics · 기본 켬) */
export const hapticsOn = () => getPref<boolean>('haptics', true) !== false;
/** 짧은 진동 한 번 (못 내면 조용히) */
export function buzz(ms = BUZZ_MS) {
  if (!hapticsOn() || !canBuzz()) return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* 무시 */
  }
}

let cur: HTMLElement | null = null;
let t0 = 0;
let offT = 0;
/** 시험용: 마지막 진동 요청 수 */
export const _press = { buzzes: 0 };

function release() {
  const el = cur;
  if (!el) return;
  cur = null;
  const wait = Math.max(0, MIN_MS - (performance.now() - t0));
  clearTimeout(offT);
  offT = window.setTimeout(() => el.classList.remove('prs'), wait);
}

export function initPressFeel() {
  document.body.classList.toggle('j4thumb', vis('thumbZone'));
  if (!vis('pressFeel')) return;
  document.body.classList.add('j4press');
  addEventListener(
    'pointerdown',
    (e) => {
      if (e.button > 0) return;
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(SEL);
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
      if (cur && cur !== el) cur.classList.remove('prs');
      clearTimeout(offT);
      cur = el;
      t0 = performance.now();
      el.classList.add('prs');
      // 전투 버튼(연타)은 진동 없이 눌림만
      if (!el.closest('.cbt')) {
        _press.buzzes++;
        buzz();
      }
    },
    { capture: true, passive: true },
  );
  for (const ev of ['pointerup', 'pointercancel'] as const) addEventListener(ev, release, { capture: true, passive: true });
}
