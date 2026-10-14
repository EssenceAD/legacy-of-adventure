// FIRSTLOOK §3 flTouchHints: 손가락 기기 ↔ 마우스 → 대화창 안내 글자 · [건너뛰기] = X와 같은 일 · 0.35초 막이 · 꺼짐 = 그대로
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFlag } from '../src/world/flags';
import { applyDlgHints, dlgHintLabels, skipTapOk, touchHintsOn } from '../src/ui/touchHints';
import { CONFIG } from '../src/data/config';

let coarse = false;
const mm = (q: string) => ({ matches: q.includes('coarse') ? coarse : q.includes('fine') ? !coarse : false, media: q, addEventListener() {}, removeEventListener() {} });
const DLG = `<div id="view"><div id="dlg" hidden>
  <div class="keys">Z NEXT<button id="dSkip">X SKIP</button></div>
  <div id="dDuo" hidden><img id="dDuoL" alt="" /><img id="dDuoR" alt="" /></div>
  <div class="box px"><img id="dPort" alt="" /><span id="dName"></span><p id="dText"></p><span class="more">▼</span></div>
  <div id="dChoice" hidden></div></div>
  <div id="namebox" hidden><input id="nameIn"><button id="nameOk"></button><div id="nameSug"></div></div></div>`;

beforeEach(() => {
  coarse = false;
  vi.stubGlobal('matchMedia', mm);
  document.body.innerHTML = DLG;
  setFlag('flTouchHints', false);
});
afterEach(() => {
  setFlag('flTouchHints', false);
  vi.unstubAllGlobals();
});
const keys = () => document.querySelector<HTMLElement>('#dlg .keys')!;

describe('flTouchHints 글자', () => {
  it('꺼짐: 손가락 기기라도 그대로 (DOM 안 건드림)', () => {
    coarse = true;
    expect(touchHintsOn()).toBe(false);
    applyDlgHints(keys());
    expect(keys().textContent).toBe('Z NEXTX SKIP');
    expect(keys().classList.contains('touch')).toBe(false);
  });
  it('켬 + 마우스(fine): 그대로', () => {
    setFlag('flTouchHints', true);
    expect(touchHintsOn()).toBe(false);
    expect(dlgHintLabels(false)).toBeNull();
    applyDlgHints(keys());
    expect(keys().textContent).toBe('Z NEXTX SKIP');
  });
  it('켬 + 손가락(coarse): 「탭: 다음」 + [건너뛰기] · 다시 마우스면 PC 글자로', () => {
    setFlag('flTouchHints', true);
    coarse = true;
    expect(touchHintsOn()).toBe(true);
    applyDlgHints(keys());
    expect(keys().firstChild!.textContent).toBe(CONFIG.firstLook.touch.nextLabel);
    expect(document.getElementById('dSkip')!.textContent).toBe(CONFIG.firstLook.touch.skipLabel);
    expect(keys().classList.contains('touch')).toBe(true);
    expect(keys().textContent).not.toMatch(/NEXT|SKIP/);
    coarse = false;
    applyDlgHints(keys());
    expect(keys().textContent).toBe('Z NEXTX SKIP');
    expect(keys().classList.contains('touch')).toBe(false);
  });
  it('막이: 터치면 guardMs 안의 탭은 안 먹음 · 꺼짐이면 늘 먹음', () => {
    const g = CONFIG.firstLook.touch.guardMs;
    expect(g).toBe(350);
    expect(skipTapOk(1000, 1000 + g - 1, true)).toBe(false);
    expect(skipTapOk(1000, 1000 + g, true)).toBe(true);
    expect(skipTapOk(1000, 1001, false)).toBe(true);
  });
});

describe('대화창 [건너뛰기] = X와 같은 일', () => {
  it('켬 + 손가락: 0.35초 뒤 [건너뛰기]가 X처럼 대화를 끝낸다 · 그 전 탭은 무시', async () => {
    setFlag('flTouchHints', true);
    coarse = true;
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(10_000);
    const D = await import('../src/ui/dialogue');
    D.initDialogue();
    const done = vi.fn();
    D.talk([['narr', '하나'], ['narr', '둘'], ['narr', '셋']], done);
    expect(keys().textContent).toContain(CONFIG.firstLook.touch.nextLabel);
    now.mockReturnValue(10_100);
    document.getElementById('dSkip')!.click();
    expect(D.isTalking()).toBe(true);
    expect(done).not.toHaveBeenCalled();
    now.mockReturnValue(10_400);
    document.getElementById('dSkip')!.click();
    expect(D.isTalking()).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    // X 키로도 같은 결과
    const done2 = vi.fn();
    D.talk([['narr', '하나'], ['narr', '둘']], done2);
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    expect(done2).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });
  it('꺼짐: [X SKIP] 은 바로 먹고 글자도 그대로', async () => {
    coarse = true;
    const D = await import('../src/ui/dialogue');
    D.initDialogue();
    const done = vi.fn();
    D.talk([['narr', '하나'], ['narr', '둘']], done);
    expect(keys().textContent).toBe('Z NEXTX SKIP');
    document.getElementById('dSkip')!.click();
    expect(done).toHaveBeenCalledTimes(1);
  });
});
