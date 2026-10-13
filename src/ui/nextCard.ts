// DIRECTION §3-2: 새 소식 맨 위 「다음 업데이트」 카드 — public/next.json (릴리스마다 손으로 고친다)
//  { "date": "2026-10-16", "title": "새 사냥 지역 5곳", "items": ["…"], "image": "next/regions.png" }
//  파일이 없거나 비었거나(제목·항목 둘 다 없음) 날짜가 지났으면 안 보인다
import { esc } from './common';

export interface NextUpdate {
  date?: string;
  title?: string;
  items?: string[];
  image?: string;
}

const DOW = '일월화수목금토';
/** 「2026-10-16」 → 「10/16(목)」 (모양이 다르면 그대로) */
export function nextDate(d: string | undefined): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(d ?? '').trim());
  if (!m) return String(d ?? '').trim();
  const t = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${+m[2]}/${+m[3]}(${DOW[t.getDay()]})`;
}
/** 보여 줄 만한가: 제목이나 항목이 있고, 날짜가 오늘보다 지나지 않았으면 */
export function nextValid(n: unknown, now = new Date()): n is NextUpdate {
  if (!n || typeof n !== 'object') return false;
  const x = n as NextUpdate;
  const items = Array.isArray(x.items) ? x.items.filter((s) => typeof s === 'string' && s.trim()) : [];
  if (!(typeof x.title === 'string' && x.title.trim()) && !items.length) return false;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(x.date ?? '').trim());
  if (m) {
    const end = new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59);
    if (end.getTime() < now.getTime()) return false;
  }
  return true;
}
/** 이미지 경로: 같은 사이트 안 상대 경로만 (http·// · javascript: 막기) */
const safeImg = (p: string | undefined) => (typeof p === 'string' && /^[\w\-./]+\.(png|jpe?g|webp|gif)$/i.test(p) && !p.startsWith('/') && !p.includes('..') ? p : '');

/** 카드 HTML ('' = 숨김) — 「다음 업데이트 · 10/16(목) · 새 사냥 지역 5곳 외」 */
export function nextCardHtml(n: unknown, base = '', now = new Date()): string {
  if (!nextValid(n, now)) return '';
  const items = (n.items ?? []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 6);
  const head = (n.title ?? '').trim() || items[0] || '';
  const more = items.length > (n.title?.trim() ? 0 : 1) ? ' 외' : '';
  const date = nextDate(n.date);
  const img = safeImg(n.image);
  return `<div class="nextcard"><p class="nxh"><b>다음 업데이트</b>${date ? ` · ${esc(date)}` : ''} · ${esc(head)}${more}</p>${img ? `<img class="nximg" src="${esc(base + img)}" alt="" loading="lazy">` : ''}${items.length ? `<ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}<small>업데이트는 보통 목요일 밤에 — 그 사이엔 급한 수정만 해요</small></div>`;
}

/** next.json 받기 (캐시 없이 · 실패하면 null) */
export async function loadNext(): Promise<unknown> {
  try {
    const r = await fetch(new URL(`next.json?t=${Date.now()}`, document.baseURI).href, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
