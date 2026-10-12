// GROWTH §3-4: 대장간 「재련」 탭 — 옵션 하나 다시 굴리기 · 하나 잠그면 비용 ×2 · 고유 옵션(★)은 그대로
import { DUST_NAME, GRADE_INFO, OPT_INFO, regionById } from '../data/items';
import { reforge, reforgeCost, reforgeWhy, rerollable } from '../world/reforge';
import { P, S, world, type Item, type ItemOpt } from '../world/state';
import { $, $$, esc, fmt, itemCell } from './common';
import { openWin, toast } from './windows';
import { track as trackEv } from '../net/telemetry';

const optText = (o: ItemOpt) => OPT_INFO[o.k].label(o.v, o.region ? regionById(o.region).name : undefined);
const ownerName = (it: Item) => (it.owner == null ? '' : ((world.home?.actors ?? world.actors).find((a) => a.id === it.owner)?.name ?? ''));

/** 탭 본문: 옵션 있는 장비 (★ 영웅 장비가 위) */
export function reforgeTab(list: Item[]): string {
  const rows = list
    .filter((it) => it.grade !== 'n' && it.opts.length)
    .map((it) => `<div class="irow">${itemCell(it, `data-id="${it.id}"`)}<span><b style="color:${GRADE_INFO[it.grade].color}">${esc(it.name)}${it.enh ? ` +${it.enh}` : ''}</b><small>${it.opts.map((o) => (o.u ? '★' : '') + esc(optText(o))).join(' · ')}</small></span><button data-rf="${it.id}">재련</button></div>`)
    .join('');
  return `<p class="note">랜덤 옵션 하나를 다시 굴려요 (그 등급 가루 + 금화) · 옵션 하나를 잠그면 비용 2배 · ★ 고유 옵션은 그대로</p><div class="ilist">${rows || '<p class="note">옵션이 있는 장비(희귀 이상)가 없어요</p>'}</div>`;
}

let lockIdx: number | null = null;
let lockFor = 0;
export function openReforge(it: Item, back: () => void, changed = -1) {
  if (!it || !P.bag.includes(it)) return back();
  if (lockFor !== it.id) {
    lockFor = it.id;
    lockIdx = null;
  }
  const c = reforgeCost(it, lockIdx);
  const why = reforgeWhy(it, lockIdx);
  const cand = rerollable(it, lockIdx);
  const own = ownerName(it);
  const rows = it.opts
    .map(
      (o, i) =>
        `<div class="rfopt ${i === changed ? 'new' : ''} ${o.u ? 'uopt' : ''}"><span>${o.u ? '★ ' : ''}${esc(optText(o))}${o.u ? ' <small>(고유 · 재련 불가)</small>' : i === lockIdx ? ' <small>🔒 잠금</small>' : cand.includes(i) ? ' <small>🎲</small>' : ''}</span>${o.u ? '' : `<button class="ghost" data-lk="${i}">${i === lockIdx ? '잠금 풀기' : '잠그기'}</button>`}</div>`,
    )
    .join('');
  openWin(
    `재련 · ${it.name}`,
    `<div class="idet">${itemCell(it)}<div><b style="color:${GRADE_INFO[it.grade].color}">${esc(it.name)}${it.enh ? ` +${it.enh}` : ''}</b><small>${GRADE_INFO[it.grade].name}${own ? ` · ${esc(own)} 착용` : ''}</small></div></div>
    <div class="rfopts">${rows}</div>
    <p class="note">🎲 표시 중 하나가 무작위로 바뀌어요${lockIdx != null ? ' · 잠금 → 비용 2배' : ''}</p>
    <p class="sub">비용: ${DUST_NAME[c.grade]} ${fmt(c.dust)}/${fmt(P.dust[c.grade] ?? 0)} · 금화 ${fmt(c.gold)}/${fmt(S.gold)}</p>
    ${why ? `<p class="sub bad">${esc(why)}</p>` : ''}
    <div class="btnrow"><button class="bigbtn" id="rfGo" ${why ? 'disabled' : ''}>재련하기</button><button class="bigbtn ghost" id="rfBack">돌아가기</button></div>`,
  );
  $$('[data-lk]').forEach(
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.lk!;
        lockIdx = lockIdx === i ? null : i;
        openReforge(it, back);
      }),
  );
  $('#rfGo').onclick = () => {
    const r = reforge(it, lockIdx);
    if ('err' in r) return toast(r.err);
    trackEv('reforge', { grade: it.grade, lock: lockIdx != null, k: r.after.k });
    toast(`재련! ${optText(r.before)} → ${optText(r.after)}`);
    openReforge(it, back, r.idx);
  };
  $('#rfBack').onclick = back;
}
