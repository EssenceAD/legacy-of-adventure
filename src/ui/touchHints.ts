// FIRSTLOOK §3 (flTouchHints · 실험실 vis): 폰에서 키보드 안내 숨기기
//  터치 기기(pointer: coarse)면 대화창 「Z NEXT」「X SKIP」 대신 「탭: 다음」 + [건너뛰기] 버튼 · PC(마우스)는 그대로.
//  전투 버튼 모서리 키캡·⌨ 단축키 버튼은 이미 CSS(hover+fine)로 PC에서만 보인다 (keycapLabels · style.css) — 같은 규칙.
//  [건너뛰기]는 X와 같은 일을 하고, 열린 뒤 guardMs(확인 시트와 같은 0.35초) 안의 탭은 먹지 않는다 (잘못 눌러 넘김 방지).
//  플래그 꺼짐 = DOM도 동작도 예전 그대로.
import { CONFIG } from '../data/config';
import { vis } from '../world/visual';

/** 손가락 기기인가 (첫 포인터가 거친 것) */
export const isCoarse = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/** 터치용 안내를 쓰나 (플래그/실험실 + 손가락 기기) */
export const touchHintsOn = (): boolean => vis('flTouchHints') && isCoarse();

/** 대화창 안내 글자 — null = 예전 그대로(PC · 플래그 꺼짐) */
export function dlgHintLabels(touch: boolean): { next: string; skip: string } | null {
  if (!touch) return null;
  const c = CONFIG.firstLook.touch;
  return { next: c.nextLabel, skip: c.skipLabel };
}

/** 처음 본 PC 글자 (index.html 「Z NEXT」 · 「X SKIP」) — 다시 PC로 돌릴 때 */
const orig = new WeakMap<HTMLElement, { next: string; skip: string }>();
/** 대화창 .keys 를 지금 기기에 맞게 (대화가 열릴 때마다) */
export function applyDlgHints(keys: HTMLElement | null, touch = touchHintsOn()) {
  if (!keys) return;
  const btn = keys.querySelector('button');
  const txt = keys.firstChild;
  if (!btn || !txt || txt.nodeType !== 3) return;
  if (!orig.has(keys)) {
    if (!touch) return; // 꺼짐: 한 번도 안 바꿨으면 손대지 않는다
    orig.set(keys, { next: txt.textContent ?? '', skip: btn.textContent ?? '' });
  }
  const L = dlgHintLabels(touch) ?? orig.get(keys)!;
  keys.classList.toggle('touch', touch);
  if (txt.textContent !== L.next) txt.textContent = L.next;
  if (btn.textContent !== L.skip) btn.textContent = L.skip;
}

/** [건너뛰기]가 먹나 — 터치 안내가 켜졌으면 열린 뒤 guardMs 지나야 (꺼짐 = 늘 먹음) */
export function skipTapOk(openedAt: number, now = performance.now(), touch = touchHintsOn()): boolean {
  return !touch || now - openedAt >= CONFIG.firstLook.touch.guardMs;
}
