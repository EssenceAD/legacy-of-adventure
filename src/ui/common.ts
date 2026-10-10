// 창 공용 도우미: 글자 이스케이프 · 숫자 · 손님 얼굴 그림 · 아이템 아이콘 칸 · 남은 시간
import { CLASSES, RACE_NAME, RARITY_INFO } from '../data/classes';
import { GRADE_INFO } from '../data/items';
import { PORTRAITS } from '../engine/assets';
import { canvas } from '../engine/pixel';
import { framesFor } from '../engine/sprites';
import { appearance } from '../world/adventurers';
import { itemIcon } from '../world/items';
import type { Actor, Item } from '../world/state';

export const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(s: string) => [...document.querySelectorAll(s)] as T[];
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
export const pct = (v: number, d = 0) => (v * 100).toFixed(d) + '%';

/** 손님 전신 그림 (종족·머리색·무기까지 보이게). 겉모습 키마다 한 번만 만든다 */
const PICS: Record<string, string> = {};
export function pic(a: Actor): string {
  if (a.role) return PORTRAITS[a.kind] || '';
  // 영웅은 전용 초상화
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

/** 이름 + 희귀도 색 */
export function nameTag(a: Actor) {
  const col = RARITY_INFO[a.rarity].color;
  const star = a.heroId ? '<span class="g">★</span>' : '';
  return `<b style="color:${a.rarity === 'common' ? 'var(--cream)' : col}">${star}${esc(a.name)}</b>`;
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

/** 창 안의 [data-end] 진행 막대·남은 시간을 1초마다 고친다 */
export function tickTimers() {
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
