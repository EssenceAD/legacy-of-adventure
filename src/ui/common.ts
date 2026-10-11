// 창 공용 도우미: 글자 이스케이프 · 숫자 · 손님 얼굴 그림 · 아이템 아이콘 칸 · 남은 시간
import { CLASSES, RACE_NAME, RARITY_INFO } from '../data/classes';
import { GRADE_INFO } from '../data/items';
import { PORTRAITS } from '../engine/assets';
import { canvas } from '../engine/pixel';
import { framesFor } from '../engine/sprites';
import { appearance } from '../world/adventurers';
import { itemIcon } from '../world/items';
import type { Actor, Item } from '../world/state';
import { sfx } from '../audio/sfx';

export const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(s: string) => [...document.querySelectorAll(s)] as T[];
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
export const pct = (v: number, d = 0) => (v * 100).toFixed(d) + '%';

/** 손님 전신 그림 (종족·머리색·무기까지 보이게). 겉모습 키마다 한 번만 만든다 */
const PICS: Record<string, string> = {};
export function pic(a: Actor): string {
  if (a.role) return PORTRAITS[a.kind] || '';
  // 영웅·전설은 전용 초상화
  if (a.legendId && PORTRAITS['legend_' + a.legendId]) return PORTRAITS['legend_' + a.legendId];
  if (a.heroId && PORTRAITS['hero_' + a.heroId]) return PORTRAITS['hero_' + a.heroId];
  const { key, def } = appearance(a);
  if (PICS[key]) return PICS[key];
  const f = framesFor(key, def).idle[0];
  // 위쪽 머리·몸만 잘라 정사각형으로
  const c = canvas(24, 24);
  const x = c.getContext('2d')!;
  x.drawImage(f, 0, -6);
  return (PICS[key] = c.toDataURL());
}

/**
 * 초상화 작업: 대화창·손님 정보 창에 쓰는 큰 얼굴 — 손님이면 직업×종족 일러스트 초상화 (g_직업_종족).
 * 영웅·전설·NPC는 전용 초상화, 그림이 없으면 도트 얼굴(pic). 작은 목록 아이콘은 pic 그대로(마을 모습과 이어지게).
 */
export function portrait(a: Actor): string {
  if (a.role || a.legendId || a.heroId) return pic(a);
  return PORTRAITS[`g_${a.kind}_${a.race ?? 'human'}`] || pic(a);
}

/** 이름 + 희귀도 색 */
export function nameTag(a: Actor) {
  const col = RARITY_INFO[a.rarity].color;
  const star = a.legendId ? `<span class="legend-mark">✦${(a.stars ?? 1) >= 5 ? '✦' : ''}</span>` : a.heroId ? '<span class="g">★</span>' : '';
  return `<b class="${a.legendId ? 'legend-name' : ''}" style="color:${a.rarity === 'common' ? 'var(--cream)' : col}">${star}${esc(a.name)}</b>`;
}
export const kindText = (a: Actor) => `${RACE_NAME[a.race]} ${CLASSES[a.kind].name}`;

/** 아이템 칸 (등급 테두리 · 강화 · NEW! · 전설 이상 반짝) */
export function itemCell(it: Item, extra = '') {
  const g = GRADE_INFO[it.grade];
  return `<span class="ic g-${it.grade}" style="--gc:${g.color}" ${extra}><img src="${itemIcon(it)}" alt="">${it.enh ? `<i>+${it.enh}</i>` : ''}${it.isNew ? '<u>NEW</u>' : ''}${it.owner != null ? '<s>E</s>' : ''}</span>`;
}

/** 남은 시간 글자 */
export function leftText(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
  if (s >= 60) return `${Math.floor(s / 60)}분 ${s % 60}초`;
  return `${s}초`;
}
export const minText = (m: number) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10}시간` : `${Math.round(m)}분`);

export function bar(label: string, v: number, color: string, max = 100) {
  const w = Math.max(0, Math.min(100, (v / max) * 100));
  return `<div class="bar"><span>${label}</span><i><b style="width:${w}%;background:${color}"></b></i><em>${Math.round(v)}</em></div>`;
}

/**
 * 핫픽스 10 §10: 진행 막대가 있는 창(원정 게시판 · 텃밭)이 열린 채로 일이 끝나면 그 자리에서 다시 그린다.
 * 창이 등록: 제목 · 「새로 끝난 게 있나」 · 다시 그리기. 다른 창이 위에 쌓여 있으면(제목이 다르면) 건너뜀.
 */
let live: { title: string; due: () => boolean; redraw: () => void } | null = null;
export const liveWin = (title: string, due: () => boolean, redraw: () => void) => (live = { title, due, redraw });
function tickLive() {
  const w = document.querySelector('#win');
  if (!live || !w?.classList.contains('on')) return;
  if (document.querySelector('#winT')?.textContent !== live.title) return;
  if (!live.due()) return;
  const body = $('#winB');
  const top = body.scrollTop;
  live.redraw();
  body.scrollTop = top;
  for (const e of $$('#winB .fresh')) e.classList.add('flash');
  sfx('mission');
}

/**
 * 핫픽스 11 §9-1: 목록 순서 — ① 받기 가능 → ② 진행 중(진행률 높은 순) → ③ 받음(맨 아래). 같은 묶음 안은 원래 순서
 */
export function claimOrder<T>(items: T[], st: (x: T) => { ready: boolean; got: boolean; ratio: number }): T[] {
  const g = (s: { ready: boolean; got: boolean }) => (s.got ? 2 : s.ready ? 0 : 1);
  return items
    .map((x, i) => ({ x, i, s: st(x) }))
    .sort((a, b) => g(a.s) - g(b.s) || (g(a.s) === 1 ? b.s.ratio - a.s.ratio : 0) || a.i - b.i)
    .map((e) => e.x);
}
/** 받기 뒤 다시 그릴 때 스크롤이 맨 위로 튀지 않게 */
export function keepScroll(fn: () => void) {
  const b = document.getElementById('winB');
  const top = b?.scrollTop ?? 0;
  fn();
  if (b) b.scrollTop = top;
}

/** 창 안의 [data-end] 진행 막대·남은 시간을 1초마다 고친다 */
export function tickTimers() {
  tickLive();
  const now = Date.now();
  for (const el of $$('[data-end]')) {
    const st = +el.dataset.start!;
    const en = +el.dataset.end!;
    const b = el.querySelector('b');
    if (b) b.style.width = Math.min(100, ((now - st) / Math.max(1, en - st)) * 100) + '%';
    const t = el.querySelector('em');
    if (t) t.textContent = now >= en ? '돌아오는 중…' : leftText(en - now);
  }
}

/** 탭 버튼 줄 */
export function tabs(names: string[], cur: number, id: string) {
  return `<div class="tabs" id="${id}">${names.map((n, i) => `<button class="tab ${i === cur ? 'on' : ''}" data-t="${i}">${n}</button>`).join('')}</div>`;
}
export function bindTabs(id: string, fn: (i: number) => void) {
  $$(`#${id} .tab`).forEach((b) => (b.onclick = () => fn(+b.dataset.t!)));
}
