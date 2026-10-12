// DIRECTION §1-3 「여관 연대기」(도감 탭 · 책처럼 넘겨 보기) · §2-2 「함께 만든 사람들」(도감 탭 · 엔딩 크레딧 줄)
import { CONFIG } from '../data/config';
import { endingById } from '../data/endings';
import { PIONEER_CREDIT, PIONEERS, type PioneerId } from '../data/story/easter';
import { PORTRAITS } from '../engine/assets';
import { contributors, contributorsCached, type Contributor } from '../net/direction';
import { getPref, setPref } from '../save/save';
import { P, type ChronPage } from '../world/state';
import { WIND_INFO, type WindId } from '../world/wind';
import { CLASSES } from '../data/classes';
import { esc } from './common';

// ───────── 사진 ─────────

/** 사진 모드에서 찍은 마지막 한 장 (작게 · 이 기기에만) — 연대기 쪽 사진 */
export function rememberPhoto(cv: HTMLCanvasElement) {
  try {
    const w = 240;
    const h = Math.max(1, Math.round((cv.height / Math.max(1, cv.width)) * w));
    const t = document.createElement('canvas');
    t.width = w;
    t.height = h;
    const x = t.getContext('2d')!;
    x.imageSmoothingEnabled = true;
    x.drawImage(cv, 0, 0, w, h);
    setPref('photoLast', { gen: P.legacy.gen, src: t.toDataURL('image/jpeg', 0.75) });
  } catch {
    /* 사진이 없어도 연대기는 쓴다 */
  }
}
/** 방금 쓴 연대기 쪽에 사진: 이 회차에 사진 모드로 찍은 마지막 한 장 → 없으면 엔딩 장면 사진 */
export function saveChronThumb(endingShot = '') {
  const page = P.legacy.chron?.[P.legacy.chron.length - 1];
  if (!page) return;
  const last = getPref<{ gen: number; src: string } | null>('photoLast', null);
  const src = last && last.gen === page.gen && last.src ? last.src : endingShot;
  if (src) setPref('chron.' + page.at, src);
}
export const chronThumb = (c: ChronPage) => getPref<string>('chron.' + c.at, '') || (c.old ? getPref<string>('storyThumb.' + c.ending, '') : '');

// ───────── 연대기 쪽 ─────────

const portOf = (r: ChronPage['regs'][number]) => PORTRAITS[`g_${r.kind}_${r.race ?? 'human'}`] ?? PORTRAITS[`g_${r.kind}_human`] ?? '';
const kindName = (k: string) => (CLASSES as Record<string, { name: string }>)[k]?.name ?? '';

/** 한 쪽 (n = 0부터) */
export function chronPageHtml(n: number): string {
  const list = P.legacy.chron ?? [];
  if (!list.length) return '<div class="chron empty"><p class="sub">아직 엔딩을 본 적이 없어요</p><p class="note">엔딩을 볼 때마다 이 책에 한 쪽씩 쌓여요 — 회차 · 여관 이름 · 함께한 단골 · 마을 사진 · 그 회차의 바람</p></div>';
  const i = Math.max(0, Math.min(list.length - 1, n));
  const c = list[i];
  const e = endingById(c.ending);
  const w = c.wind && c.wind in WIND_INFO ? WIND_INFO[c.wind as WindId] : null;
  const th = chronThumb(c);
  const regs = c.regs.length
    ? c.regs.map((r) => `<div class="chreg">${portOf(r) ? `<img src="${portOf(r)}" alt="">` : `<i>${esc([...r.name][0] ?? '?')}</i>`}<b>${esc(r.name)}</b><small>${esc(kindName(r.kind))}</small></div>`).join('')
    : '<p class="note">이때의 단골 기록은 남아 있지 않아요</p>';
  return `<div class="chron"><div class="chpage">
    <p class="chno">제 ${c.gen}회차${c.at ? ` · ${new Date(c.at).toLocaleDateString('ko-KR')}` : ''}</p>
    <h4 class="chinn">${esc(c.inn)}</h4>
    <p class="chend">「${esc(e?.title ?? c.ending)}」</p>
    ${th ? `<img class="chthumb" src="${th}" alt="">` : '<div class="chthumb none">사진 없음</div>'}
    <p class="chh">함께한 단골</p><div class="chregs">${regs}</div>
    <p class="chwind">${w ? `${w.icon} 이 회차의 바람 — ${esc(w.name)}` : c.old ? '옛 기록에서 옮겨 적은 쪽' : '바람 없는 첫 회차'}</p>
  </div>
  <div class="chnav"><button class="bigbtn ghost sm" data-chp="${i - 1}" ${i <= 0 ? 'disabled' : ''}>◀</button><span>${i + 1} / ${list.length}쪽</span><button class="bigbtn ghost sm" data-chp="${i + 1}" ${i >= list.length - 1 ? 'disabled' : ''}>▶</button></div></div>`;
}

// ───────── 함께 만든 사람들 ─────────

const PIONEER_ORDER = Object.keys(PIONEERS) as PioneerId[];
/** 도감 탭: 개척자 넷(금테 · 맨 위) + 반영 3건 이상 테스터 (서버에서 받아 채운다) */
export function contribHtml(): string {
  const pion = PIONEER_ORDER.map((id) => `<div class="ctb gold"><img src="${PORTRAITS['p_' + id] ?? ''}" alt=""><span><b>${esc(PIONEERS[id].name)}</b><small>개척자 · 「${esc(PIONEERS[id].title)}」</small></span></div>`).join('');
  return `<p class="sub">함께 만든 사람들</p><p class="note">베타 개척자와, 보내 준 제보가 ${CONFIG.direction.contributorMin}건 이상 게임에 반영된 분들이에요. 한 줄은 운영자가 썼어요.</p><div class="ctbs">${pion}</div><div class="ctbs" id="ctbList">${contribRows(contributorsCached())}</div>`;
}
function contribRows(list: Contributor[]): string {
  const rows = list.filter((c) => !c.pioneer);
  if (!rows.length) return `<p class="note">제보가 ${CONFIG.direction.contributorMin}건 반영되면 여기에 이름이 올라요 · 메뉴 → 모모에게 편지</p>`;
  return rows.map((c) => `<div class="ctb"><span><b>${esc(c.nickname)}</b><small>${c.line ? esc(c.line) : `반영 ${c.fixed_n}건`}</small></span></div>`).join('');
}
/** 탭을 연 뒤: 서버 목록으로 채우기 (서버가 없으면 그대로) */
export async function fillContrib() {
  const list = await contributors(true);
  const el = document.getElementById('ctbList');
  if (el) el.innerHTML = contribRows(list);
}

/** 엔딩 크레딧: 개척자 줄 다음에 「함께 만든 사람들」 이름 (받아 둔 목록이 있을 때만) */
export function contribCreditLine(): string | null {
  const names = contributorsCached()
    .filter((c) => !c.pioneer)
    .map((c) => c.nickname)
    .filter(Boolean);
  return names.length ? `함께 만든 사람들 — ${names.join(' · ')}` : null;
}
/** 엔딩 컷 마지막 줄들: 개척자 → 함께 만든 사람들 */
export function endCredits(): [string, string][] {
  const c = contribCreditLine();
  return [['narr', PIONEER_CREDIT], ...(c ? ([['narr', c]] as [string, string][]) : [])];
}
