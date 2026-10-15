// CHECKIN §J4 (플래그 confirmSheet · 형철 확인 전엔 꺼짐 — vis): 되돌릴 수 없는 행동(판매·분해·재련·포기·철거·작별·계정 삭제)의
//  확인을 「아래에서 올라오는 시트 하나」로 통일한다.
//  · 남색 기준판(.px) 그대로 · 버튼은 기존 3종(보통 = 그만두기 · 주 = 확인 · 위험(빨강) = danger)
//  · 0.22초 올라옴 · 절전/「화면 흔들림 끔」에선 바로 (품질 규칙 5)
//  · 뒤로가기 · Esc · 바깥(어두운 곳) 누르기 = 그만두기(false) — 밑의 창은 그대로 (windows.ts 맨 위 층)
//  · 바깥 누르기는 열린 뒤 0.45초 동안 무시 (터치를 떼며 따라오는 click 이 바로 닫지 않게 · 창 scrim 과 같은 규칙)
import { saverOn } from '../engine/fps';
import { shakeLv } from '../engine/shake';
import { esc } from './common';
import { pushLayer } from './windows';

export interface SheetOpts {
  title: string;
  /** 한두 줄 (글자 그대로 · HTML 아님) */
  body?: string;
  /** 확인 버튼 글 */
  ok: string;
  /** 그만두기 버튼 글 (기본 「그만두기」) */
  no?: string;
  /** 빨간(위험) 확인 버튼 */
  danger?: boolean;
  /** 세 번째 버튼 (choiceSheet · 확인 바로 오른쪽 · 보통 버튼) — 있으면 순서 [확인] [alt] [그만두기] */
  alt?: string;
}

type Pick3 = 'ok' | 'alt' | null;
let cur: { done: (v: Pick3) => void } | null = null;

/** 열린 시트가 있나 (e2e · 다른 키 처리용) */
export const sheetOpen = () => !!cur;

/** 아래 확인 시트: 확인 → true · 그만두기/뒤로/Esc/바깥 → false */
export function confirmSheet(o: SheetOpts): Promise<boolean> {
  return choiceSheet({ ...o, alt: undefined }).then((v) => v === 'ok');
}

/** 세 갈래 시트 (o.alt 버튼): 확인 → 'ok' · alt → 'alt' · 그만두기/뒤로/Esc/바깥 → null */
export function choiceSheet(o: SheetOpts): Promise<Pick3> {
  cur?.done(null);
  const view = document.getElementById('view') ?? document.body;
  const scrim = document.createElement('div');
  scrim.className = 'cshScrim';
  const el = document.createElement('section');
  el.className = 'csheet px';
  el.id = 'csheet';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  const no = `<button class="bigbtn ghost" id="cshNo">${esc(o.no ?? '그만두기')}</button>`;
  el.innerHTML = `<b class="csht">${esc(o.title)}</b>${o.body ? `<p class="sub">${esc(o.body)}</p>` : ''}<div class="btnrow cshrow${o.alt ? ' c3' : ''}">${o.alt ? '' : no}<button class="bigbtn${o.danger ? ' red' : ''}" id="cshOk">${esc(o.ok)}</button>${o.alt ? `<button class="bigbtn" id="cshAlt">${esc(o.alt)}</button>${no}` : ''}</div>`;
  const quick = saverOn() || shakeLv() === 'off';
  if (quick) el.classList.add('quick');
  view.append(scrim, el);
  const openedAt = performance.now();
  // 다음 프레임에 올린다 (transition 이 시작점부터)
  if (quick) {
    scrim.classList.add('on');
    el.classList.add('on');
  } else
    requestAnimationFrame(() => {
      scrim.classList.add('on');
      el.classList.add('on');
    });
  return new Promise<Pick3>((resolve) => {
    let off = () => {};
    const done = (v: Pick3) => {
      if (cur !== me) return;
      cur = null;
      off();
      scrim.remove();
      el.remove();
      resolve(v);
    };
    const me = { done };
    cur = me;
    off = pushLayer(() => done(null));
    (el.querySelector('#cshNo') as HTMLButtonElement).onclick = () => done(null);
    // 확인은 열린 뒤 0.35초부터 (방금 누른 손가락이 그대로 확인을 누르지 않게)
    (el.querySelector('#cshOk') as HTMLButtonElement).onclick = () => performance.now() - openedAt >= 350 && done('ok');
    const alt = el.querySelector('#cshAlt') as HTMLButtonElement | null;
    if (alt) alt.onclick = () => performance.now() - openedAt >= 350 && done('alt');
    scrim.onclick = (e) => {
      e.stopPropagation();
      if (performance.now() - openedAt < 450) return;
      done(null);
    };
  });
}
