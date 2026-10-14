// CHECKIN §E 여관다운 보상 순간 (플래그 checkinFx) + §J3 글 대신 카드 (플래그 uiCards) — 둘 다 형철 확인 전 꺼짐 · 「새 화면 미리 보기」(vis)
//  ★품질 5: 연출은 1초 안쪽 · 탭하면 바로 끝 · 절전·「화면 흔들림 끔」(기본)이면 0.3초 이하
//  그림(asset_raw/checkin → public/assets): 도장 stamp_checkin · stamp_almanac · 열쇠 key_room · 상자 box_crate/gift/chest (icons) · 영수증 종이 receipt_9 (ui · 9-slice 8)
//  프런트 종소리(체크인·모두 받기·영수증 끝)는 아직 없음 → 지금 소리 그대로 (새 소리 안 넣음)
import { shakeLv } from '../engine/shake';
import { GRADE_INFO } from '../data/items';
import { itemIcon } from '../world/items';
import { roleOf, type Role } from '../world/party';
import { regularHooks } from '../world/actors';
import type { Actor, Item } from '../world/state';
import { vis } from '../world/visual';
import { esc, fmt, itemCell, portrait } from './common';
import { heroCardHtml } from './heroCard';
import { iconSrc, uiSrc, type IconKey } from './kit';

/** §E 켜졌나 (말투는 world/visual fsay) */
export const fxOn = () => vis('checkinFx');
/** §J3 켜졌나 */
export const cardsOn = () => vis('uiCards');
/** 조용한 연출 (흔들림 끔 · 절전) → 0.3초 이하 */
export const calmFx = () => shakeLv() === 'off';
const CALM = 0.3;

/** 탭(화면 어디든 누르기)하면 바로 끝 — 한 번만 */
function onTap(fn: () => void): () => void {
  const h = () => fn();
  addEventListener('pointerdown', h, { capture: true, once: true });
  return () => removeEventListener('pointerdown', h, { capture: true });
}

// ───────── §E 체크아웃 영수증 (원정·사냥 결과) ─────────

export interface RcLine {
  /** 왼쪽 이름 · 오른쪽 값 */
  k: string;
  v: string;
  /** 금빛 줄 (희귀 이상) */
  g?: boolean;
  it?: Item;
}
/** 한 줄 0.08초 · 전체 1초 안 (조용하면 0.3초 안) */
export const RC_STEP = 0.08;
export const RC_MAX = 1;
export function rcTiming(n: number, calm = calmFx()): { step: number; total: number } {
  const total = Math.min(n * RC_STEP, calm ? CALM : RC_MAX);
  return { step: n ? total / n : 0, total };
}
/** 희귀 이상 (일반 빼고 전부) */
export const rareItem = (it: Item) => it.grade !== 'n';
export const itemLine = (it: Item): RcLine => ({ k: `${GRADE_INFO[it.grade].name} ${it.name}`, v: it.enh ? `+${it.enh}` : '1개', g: rareItem(it), it });
export function receiptHtml(lines: RcLine[], head = '체크아웃 영수증'): string {
  if (!lines.length) return '';
  const row = (l: RcLine) =>
    `<p class="rc-l${l.g ? ' rc-g' : ''}">${l.it ? `<img class="rc-ic" src="${itemIcon(l.it)}" alt="">` : ''}<span>${esc(l.k)}</span><i></i><em>${esc(l.v)}</em></p>`;
  return `<div class="rcpt" data-rcpt><p class="rc-h"><img src="${iconSrc('stamp_checkin', true)}" alt=""><b>${esc(head)}</b></p>${lines.map(row).join('')}</div>`;
}
/** 시험용: 마지막 영수증 */
const rc = { n: 0, step: 0, total: 0, at: 0, doneAt: 0, skipped: false, done: true };
/** 창(또는 결과 카드)에 막 그린 영수증을 한 줄씩 찍는다 · 탭하면 다 찍힘 */
export function playReceipt(root: ParentNode = document) {
  const el = root.querySelector<HTMLElement>('[data-rcpt]:not(.rc-play)');
  if (!el) return;
  const ls = [...el.querySelectorAll<HTMLElement>('.rc-l')];
  const { step, total } = rcTiming(ls.length);
  Object.assign(rc, { n: ls.length, step, total, at: performance.now(), doneAt: 0, skipped: false, done: false });
  el.classList.add('rc-play');
  ls.forEach((l) => l.classList.add('rc-wait'));
  const timers: number[] = [];
  let off = () => {};
  const end = (skipped: boolean) => {
    if (rc.done) return;
    timers.forEach(clearTimeout);
    off();
    ls.forEach((l) => l.classList.remove('rc-wait'));
    el.classList.add('rc-done');
    Object.assign(rc, { done: true, skipped, doneAt: performance.now() });
  };
  ls.forEach((l, i) => timers.push(window.setTimeout(() => l.classList.remove('rc-wait'), step * 1000 * i)));
  timers.push(window.setTimeout(() => end(false), total * 1000 + 20));
  off = onTap(() => end(true));
}

// ───────── §E 숙박부 도장 「쿵」 (출석 · 장부 3개 · 연감) ─────────

export type StampKind = 'checkin' | 'ledger' | 'almanac';
const STAMP_ICON: Record<StampKind, IconKey> = { checkin: 'stamp_checkin', ledger: 'stamp_checkin', almanac: 'stamp_almanac' };
/** 「쿵」 길이 (초): 0.4 · 조용하면 0.3 */
export const stampDur = (calm = calmFx()) => (calm ? CALM : 0.4);
const st = { kind: '' as string, at: 0, dur: 0, n: 0 };
/**
 * 도장 「쿵」 0.4초 — anchor(출석 칸 · 숙박 카드 · 장부 줄)가 있으면 그 위에 찍혀 남고, 없으면 화면 가운데에 찍혔다가 사라진다 (전체 1초 안)
 *  D 묶음(장부 3개 완료 · 연감)도 이걸 부른다: stampFx('ledger') · stampFx('almanac', 칸)
 *  checkinFx가 꺼져 있으면 아무것도 안 함
 */
export function stampFx(kind: StampKind, anchor?: HTMLElement | null): HTMLElement | null {
  if (!fxOn()) return null;
  const dur = stampDur();
  Object.assign(st, { kind, at: performance.now(), dur, n: st.n + 1 });
  const im = document.createElement('img');
  im.src = iconSrc(STAMP_ICON[kind]);
  im.alt = '';
  im.className = `stampfx ${anchor ? 'on-el' : 'mid'}${calmFx() ? ' calm' : ''}`;
  im.style.setProperty('--sd', `${dur}s`);
  if (anchor) {
    anchor.classList.add('stamped');
    anchor.appendChild(im);
    const off = onTap(() => im.classList.add('rc-done'));
    setTimeout(off, dur * 1000 + 50);
    return im;
  }
  document.body.appendChild(im);
  const end = () => im.remove();
  const t = setTimeout(end, Math.min(1000, dur * 1000 + 500));
  onTap(() => {
    clearTimeout(t);
    end();
  });
  return im;
}

// ───────── §E 단골 · 동료 순간 ─────────

/** 첫 원정 열쇠 건네기 (0.6초 · 조용하면 0.3) */
export const keyDur = (calm = calmFx()) => (calm ? CALM : 0.6);
const ky = { at: 0, dur: 0, n: 0 };
export function keyFx() {
  if (!fxOn()) return;
  const dur = keyDur();
  Object.assign(ky, { at: performance.now(), dur, n: ky.n + 1 });
  document.querySelectorAll('.keyfx').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = `keyfx${calmFx() ? ' calm' : ''}`;
  el.style.setProperty('--kd', `${dur}s`);
  el.innerHTML = `<img src="${iconSrc('key_room')}" alt=""><small>첫 원정 · 열쇠 건네 드렸어요</small>`;
  document.body.appendChild(el);
  const end = () => el.remove();
  const t = setTimeout(end, dur * 1000 + 50);
  onTap(() => {
    clearTimeout(t);
    end();
  });
}
/** 단골 되면: 숙박 카드(영웅 카드)에 도장 하나 (카드 0.9초 · 도장 0.4초) */
export function regularStamp(a: Actor) {
  if (!fxOn()) return;
  document.querySelectorAll('.regfx').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = 'regfx';
  el.innerHTML = `${heroCardHtml(a, { still: true, auto: false })}<small>단골 되셨어요!</small>`;
  document.body.appendChild(el);
  const card = el.querySelector<HTMLElement>('.hcd');
  stampFx('checkin', card);
  const end = () => el.remove();
  const t = setTimeout(end, calmFx() ? 700 : 950);
  onTap(() => {
    clearTimeout(t);
    end();
  });
}

// ───────── §J3 레벨업 · 해금 배너 (가운데 · 반짝 · 1초 뒤 사라짐) ─────────

const bn = { at: 0, title: '', n: 0 };
export function bannerFx(title: string, sub = '레벨업!') {
  if (!cardsOn()) return;
  Object.assign(bn, { at: performance.now(), title, n: bn.n + 1 });
  document.querySelectorAll('.lvban').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = `lvban${calmFx() ? ' calm' : ''}`;
  el.innerHTML = `<small>${esc(sub)}</small><b>${esc(title)}</b>`;
  document.body.appendChild(el);
  const end = () => el.remove();
  const t = setTimeout(end, 1000);
  onTap(() => {
    clearTimeout(t);
    end();
  });
}

// ───────── §J3 전투 결과 카드 (별 1~3 · MVP · 드랍 칸) ─────────

/** 별 기준: 안 쓰러짐 · 제한 시간 절반 안 · 역할 조합(탱·힐·딜) — 이기면 최소 1개 */
export const STAR_TIME = 0.5;
export interface StarIn {
  win: boolean;
  downs?: number;
  time: number;
  combo?: boolean;
}
export function battleStars(r: StarIn, limit: number): { n: number; why: [boolean, boolean, boolean] } {
  const why: [boolean, boolean, boolean] = [(r.downs ?? 0) === 0, r.time <= limit * STAR_TIME, !!r.combo];
  return { n: r.win ? Math.max(1, why.filter(Boolean).length) : 0, why };
}
export function starsHtml(r: StarIn, limit: number): string {
  if (!r.win) return '';
  const s = battleStars(r, limit);
  const lbl = ['안 쓰러짐', '빠르게', '역할 조합'];
  return `<div class="bstars" data-stars="${s.n}"><span class="bst">${[0, 1, 2].map((i) => `<img src="${uiSrc(i < s.n ? 'star' : 'star_empty')}" alt="">`).join('')}</span><span class="bwhy">${lbl.map((t, i) => `<i class="${s.why[i] ? 'on' : ''}">${s.why[i] ? '✓' : '·'} ${t}</i>`).join('')}</span></div>`;
}
/** MVP 한 마디 (역할마다) */
const MVP_LINE: Record<Role, string> = { tank: '다들 제 뒤에 계셨죠? 든든했죠!', heal: '한 분도 안 다치게 하는 게 제 일이에요', dps: '제일 많이 때린 건 저예요!' };
export function mvpHtml(a: Actor | null | undefined): string {
  if (!a) return '';
  return `<div class="bmvp" data-mvp="${a.id}"><img src="${portrait(a)}" alt=""><span><small>MVP</small><b>${esc(a.name)}</b><q>${esc(MVP_LINE[roleOf(a)])}</q></span></div>`;
}
/** 드랍 칸 (장비 그림 칸 격자) */
export function dropsHtml(items: Item[]): string {
  return `<div class="bdrops">${items.length ? items.map((it) => itemCell(it)).join('') : '<small class="note">장비 드랍 없음</small>'}</div>`;
}

// ───────── §J3 한 줄 카드 (의뢰 · 부탁 · 장부) ─────────

/** 보상 칸 금화 짧게 (폭 360에서 안 꺾이게): 1만 이상은 「1.5만」 */
export const shortG = (n: number) => (n >= 1e4 ? `${n >= 1e5 ? Math.round(n / 1e4) : Math.round(n / 1e3) / 10}만` : fmt(n));
/** 보상 칸 상자: 금화 크기에 따라 나무 상자 · 선물 상자 · 보물 상자 */
export const boxFor = (tier: 0 | 1 | 2): IconKey => (['box_crate', 'box_gift', 'box_chest'] as const)[tier];
/** 아이콘 + (진행 막대) + 보상 칸 + 버튼 한 줄 */
export function lineCard(o: { ic: string; title: string; sub?: string; prog?: [number, number]; box: IconKey; reward: string; btn: string; cls?: string; attrs?: string; tag?: 'div' | 'button' }): string {
  const tag = o.tag ?? 'div';
  const bar = o.prog ? `<i class="lc-bar"><u style="width:${Math.round((Math.min(o.prog[0], o.prog[1]) / Math.max(1, o.prog[1])) * 100)}%"></u></i><small class="lc-n">${fmt(Math.min(o.prog[0], o.prog[1]))}/${fmt(o.prog[1])}</small>` : '';
  return `<${tag} class="j3row ${o.cls ?? ''}" ${o.attrs ?? ''}><img class="lc-ic" src="${o.ic}" alt=""><span class="lc-main"><b>${o.title}</b>${o.sub ? `<small>${o.sub}</small>` : ''}${bar}</span><span class="lc-rw"><img src="${iconSrc(o.box)}" alt=""><small>${o.reward}</small></span>${o.btn}</${tag}>`;
}

regularHooks.made = (a) => regularStamp(a);

/** 시험용 */
export const _checkin = { rc: () => ({ ...rc }), stamp: () => ({ ...st }), key: () => ({ ...ky }), banner: () => ({ ...bn }) };
if (import.meta.env.DEV) Object.assign(window, { __checkin: { ..._checkin, stampFx, keyFx, bannerFx, regularStamp } });
