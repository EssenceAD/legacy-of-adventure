// GROWTH §3-4: 득템 연출 — 영웅 = 보라 빛기둥 · 전설 = 금빛 기둥 + 효과음 · 유물(고유 장비 포함) = 화면 반짝 + 이름 크게 1.5초
//  전투 결과 · 원정 귀환 · 토벌 결과 · 소탕에서 부른다. 화면 위에 잠깐 덮었다가 사라진다 (누르기는 그대로 통과).
import { sfx } from '../audio/sfx';
import { GRADE_INFO } from '../data/items';
import type { Item } from '../world/state';
import { esc } from './common';

const RANK: Record<string, number> = { e: 1, l: 2, a: 3 };
/** 연출할 가장 좋은 장비 (영웅 미만이면 null) */
export function fanfareOf(items: Item[]): { it: Item; kind: 'e' | 'l' | 'a' } | null {
  let best: Item | null = null;
  for (const it of items) {
    const r = (RANK[it.grade] ?? 0) + (it.uid ? 1 : 0);
    if (r > 0 && (!best || r > (RANK[best.grade] ?? 0) + (best.uid ? 1 : 0))) best = it;
  }
  if (!best) return null;
  return { it: best, kind: best.grade === 'a' ? 'a' : best.grade === 'l' ? 'l' : 'e' };
}
let last = 0;
export function dropFanfare(items: Item[] | undefined | null) {
  const f = items && fanfareOf(items);
  if (!f) return;
  // 같은 순간 두 번(결과 창 다시 그리기) 막기
  if (Date.now() - last < 400) return;
  last = Date.now();
  document.querySelectorAll('.fanfare').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = `fanfare ff-${f.kind}`;
  const label = f.it.uid ? '고유 장비' : GRADE_INFO[f.it.grade].name;
  el.innerHTML =
    f.kind === 'a'
      ? `<div class="ffflash"></div><div class="ffname big"><small>${label}</small><b>${esc(f.it.name)}</b></div>`
      : `<div class="ffpillar"></div><div class="ffname"><small>${label}</small><b>${esc(f.it.name)}</b></div>`;
  document.body.appendChild(el);
  if (f.kind !== 'e') sfx('legend');
  else sfx('rare');
  setTimeout(() => el.remove(), f.kind === 'a' ? 1700 : 1400);
}

if (import.meta.env.DEV) Object.assign(window, { __fanfare: dropFanfare });
