// 전역 규칙 「회색 버튼엔 이유」 · 비용 한 줄 그리기 (대장간 강화·초월·제작·재련·전수 · 일괄 강화 미리보기)
//  재료마다 「이름 필요/가진」 · 모자라면 빨강 + 「−n」 · 모자란 재료를 누르면 바로 아래 「얻는 곳: …」 한 줄
//  큰 버튼 글·이유 = 가장 많이 모자란 재료 「그림자 껍질 2개 부족」 (lockBtn 의 lockAttr 에 그대로 넣는다)
import { shortOf, worstShort, type CostPart } from '../world/shortage';
import { esc, fmt } from './common';
import { sayLock } from './lockBtn';

/** 「그림자 껍질 2개 부족」 · 금화는 「금화 1,200 부족」 */
export function shortLabel(p: CostPart): string {
  const s = shortOf(p);
  return p.kind === 'gold' ? `금화 ${fmt(s)} 부족` : `${p.name} ${fmt(s)}개 부족`;
}
/** 가장 많이 모자란 재료의 글 (버튼 글 · 막힌 이유) · 다 있으면 null */
export function shortWhy(parts: CostPart[]): string | null {
  const w = worstShort(parts);
  return w ? shortLabel(w) : null;
}
/** 눌렀을 때 토스트: 「그림자 껍질 2개 부족 · 얻는 곳: 심연의 바닥 10스테이지 사냥」 */
export function shortTip(parts: CostPart[]): string | null {
  const w = worstShort(parts);
  return w ? `${shortLabel(w)} · 얻는 곳: ${w.where}` : null;
}
/** 재료 하나 「그림자 껍질 5/3 −2」 (필요/가진 — 예전 대장간 글과 같은 순서) */
export function partHtml(p: CostPart): string {
  const s = shortOf(p);
  const body = `${esc(p.name)} ${fmt(p.need)}/${fmt(p.have)}`;
  if (!s) return `<span class="cst">${body}</span>`;
  installWhere();
  return `<span class="cst bad" role="button" tabindex="0" data-where="${esc(p.where)}">${body}<b class="sh">−${fmt(s)}</b></span>`;
}
/** 비용 한 줄 + (숨은) 얻는 곳 줄 · lead = 앞 글 (「비용: 」) · cls = note/sub */
export function costLine(parts: CostPart[], lead = '', cls = 'note'): string {
  return `<p class="${cls} costln">${lead}${parts.map(partHtml).join(' · ')}</p><p class="whereln" hidden></p>`;
}

/** 모자란 재료 눌림: 같은 줄 바로 아래 「얻는 곳」 (줄이 없으면 토스트) */
export function onWhereClick(e: Event): boolean {
  const el = (e.target as Element | null)?.closest?.<HTMLElement>('.cst[data-where]');
  if (!el) return false;
  const where = el.dataset.where ?? '';
  const text = `얻는 곳: ${where}`;
  const ln = el.closest('.costln')?.nextElementSibling as HTMLElement | null;
  // 버튼 아래 한 줄이 이미 같은 곳을 말하고 있으면 그 줄만 반짝 (같은 글 두 줄 X)
  const same = [...(ln?.parentElement?.querySelectorAll<HTMLElement>('.lockwhy') ?? [])].find((x) => x.textContent === text);
  if (same) {
    same.classList.remove('flash');
    void same.offsetWidth;
    same.classList.add('flash');
    if (ln) ln.hidden = true;
  } else if (ln?.classList.contains('whereln')) {
    ln.textContent = text;
    ln.hidden = false;
  } else sayLock(`${el.textContent?.replace(/−.*$/, '').trim() ?? ''} · ${text}`);
  e.stopPropagation();
  return true;
}
let installed = false;
function installWhere() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', (e) => onWhereClick(e), true);
  document.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && onWhereClick(e));
}
