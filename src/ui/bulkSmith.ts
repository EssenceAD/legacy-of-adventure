// SMITH §2·§3 화면: 일괄 강화(초월 포함) 창 — 대상 · 목표 +N · 예산 한도 · 미리보기 · [시작]/[멈춤] · 요약 / 일괄 제작 요약 카드
import { CONFIG } from '../data/config';
import { GRADE_INFO, REGIONS, SLOT_NAME, type RegionId, type Slot } from '../data/items';
import { bulkItems, bulkPlan, bulkTick, craftMany, maxGoal, startBulk, type BulkOpts, type BulkRun, type CraftBatch } from '../world/bulk';
import { salvage } from '../world/craft';
import { P, type Item } from '../world/state';
import { $, $$, esc, fmt, itemCell } from './common';
import { closeWin, openWin, toast } from './windows';
import { enhUse } from './enhance';
import { track as trackEv } from '../net/telemetry';

const SM = () => CONFIG.smith;
const opts: BulkOpts = { target: 'equipped', goal: 5, budget: 0.5, skipLocked: false, picked: [] };
let run: BulkRun | null = null;
let timer = 0;
let startList: Item[] = [];

/** 일괄 강화 창 · trans = 초월 탭에서 열었나 (목표 기본 +15) */
export function openBulkEnhance(back: () => void, trans = false) {
  if (trans && opts.goal <= SM().maxEnhance) opts.goal = Math.min(maxGoal(), 15);
  if (!trans && opts.goal > SM().maxEnhance) opts.goal = 5;
  draw(back, trans);
}
function draw(back: () => void, trans: boolean) {
  const lo = trans ? SM().maxEnhance + 1 : 1;
  const hi = trans ? maxGoal() : SM().maxEnhance;
  opts.goal = Math.max(lo, Math.min(hi, opts.goal));
  if (run) return drawRun(back, trans);
  const p = bulkPlan(opts);
  const T = (t: BulkOpts['target'], n: string) => `<button class="${opts.target === t ? 'on' : ''}" data-bt="${t}">${n}</button>`;
  const pickList =
    opts.target === 'pick'
      ? `<div class="ilist bpick">${P.bag
          .filter((it) => it.enh < hi)
          .sort((a, b) => Number(b.owner != null) - Number(a.owner != null) || b.enh - a.enh)
          .map((it) => `<label class="irow">${itemCell(it)}<span><b style="color:${GRADE_INFO[it.grade].color}">${esc(it.name)} +${it.enh}</b></span><input type="checkbox" data-pk="${it.id}" ${(opts.picked ?? []).includes(it.id) ? 'checked' : ''}></label>`)
          .join('')}</div>`
      : '';
  openWin(
    trans ? '일괄 초월' : '일괄 강화',
    `<div class="bulkw">
      <p class="sub">대상</p><div class="btnrow seg">${T('equipped', '끼운 장비만')}${T('bag', '가방 전체')}${T('pick', '직접 고르기')}</div>
      ${pickList}
      <p class="sub">목표 <b class="g">+${opts.goal}</b>까지${!trans && opts.goal >= 7 ? ' <small>(+7부터 실패하면 30% 확률로 1단계 하락)</small>' : ''}</p>
      <input type="range" id="bGoal" min="${lo}" max="${hi}" value="${opts.goal}">
      <p class="sub">예산: 가진 금화·가루의 <b class="g">${Math.round(opts.budget * 100)}%</b>까지만</p>
      <input type="range" id="bBud" min="10" max="100" step="10" value="${Math.round(opts.budget * 100)}">
      <label class="chk"><input type="checkbox" id="bLock" ${opts.skipLocked ? 'checked' : ''}> 🔒 잠금 장비 빼기</label>
      ${trans ? '' : `<label class="chk"><input type="checkbox" id="bCharm" ${opts.charm ? 'checked' : ''} ${P.growth.charm > 0 ? '' : 'disabled'}> 🧿 부적 자동 사용 <small>(${P.growth.charm}개 · +7~+10 하락을 막을 때만 1개)</small></label>`}
      <div class="bprev"><b>미리보기</b> · 대상 ${p.items}개 · 예상${p.gold ? ` 금화 ${fmt(p.gold)} ·` : ''} 가루 ${fmt(p.dust)}${p.boss ? ` · 보스 재료 ${fmt(p.boss)}` : ''}${p.mats ? ` · 지역 재료 ${fmt(p.mats)}` : ''}${p.bossShort ? `<br><span class="bad">보스 재료가 모자라 멈출 장비 ${p.bossShort}개</span>` : ''}<br><small>실패 확률을 반영한 기대값이에요 · 예산을 넘기 전에 멈춰요</small></div>
      <div class="btnrow"><button class="bigbtn" id="bGo" ${p.items ? '' : 'disabled'}>시작</button><button class="bigbtn ghost" id="bBack">대장간으로</button></div>
    </div>`,
  );
  $$('[data-bt]').forEach((b) => (b.onclick = () => ((opts.target = b.dataset.bt as BulkOpts['target']), draw(back, trans))));
  $$('[data-pk]').forEach(
    (c) =>
      (c.onchange = () => {
        const id = +c.dataset.pk!;
        const s = new Set(opts.picked ?? []);
        if ((c as HTMLInputElement).checked) s.add(id);
        else s.delete(id);
        opts.picked = [...s];
        draw(back, trans);
      }),
  );
  ($('#bGoal') as HTMLInputElement).onchange = (e) => ((opts.goal = +(e.target as HTMLInputElement).value), draw(back, trans));
  ($('#bBud') as HTMLInputElement).onchange = (e) => ((opts.budget = +(e.target as HTMLInputElement).value / 100), draw(back, trans));
  const bc = document.getElementById('bCharm') as HTMLInputElement | null;
  if (bc) bc.onchange = () => ((opts.charm = bc.checked), draw(back, trans));
  ($('#bLock') as HTMLInputElement).onchange = (e) => ((opts.skipLocked = (e.target as HTMLInputElement).checked), draw(back, trans));
  $('#bBack').onclick = back;
  $('#bGo').onclick = () => {
    startList = bulkItems(opts);
    run = startBulk(opts);
    trackEv('bulk_enhance', { target: opts.target, goal: opts.goal, n: startList.length });
    clearInterval(timer);
    timer = window.setInterval(() => {
      if (!run) return clearInterval(timer);
      const more = bulkTick(run);
      if (!more) clearInterval(timer);
      drawRun(back, trans);
    }, 140);
    drawRun(back, trans);
  };
}
/** 진행 중 · 끝 요약 */
function drawRun(back: () => void, trans: boolean) {
  const r = run!;
  const done = !!r.stopped;
  const lines = r.log
    .slice(-6)
    .reverse()
    .map((l) => `<div class="blog ${l.ok ? 'ok' : 'no'}">${l.ok ? '깡!' : '팅…'} ${esc(l.name)} ${l.ok ? `+${l.to}` : `(+${l.to + 1} 실패)`}</div>`)
    .join('');
  const reached = startList.filter((it) => it.enh >= r.o.goal).length;
  const why = { done: '', budget: ' · 예산 한도에서 멈췄어요', short: ' · 재료가 모자라 멈췄어요', user: ' · 멈췄어요', '': '' }[r.stopped];
  const summary = `${startList.length}개 ${trans ? '초월' : '강화'} · +${r.o.goal} 도달 ${reached}개 · 실패 ${r.fails}회${r.spentGold ? ` · 금화 −${fmt(r.spentGold)}` : ''} · 가루 −${fmt(r.spentDust)}`;
  openWin(
    trans ? '일괄 초월' : '일괄 강화',
    `<div class="bulkw"><p class="sub">${done ? '<b class="g">끝!</b> ' : '진행 중… '}${summary}${why}</p><div class="blogs">${lines || '<p class="note">준비 중…</p>'}</div>
    <div class="btnrow">${done ? '<button class="bigbtn" id="bEnd">대장간으로</button>' : '<button class="bigbtn ghost" id="bStop">멈춤</button>'}</div></div>`,
  );
  const st = document.getElementById('bStop');
  if (st)
    st.onclick = () => {
      r.stopped = 'user';
      clearInterval(timer);
      drawRun(back, trans);
    };
  const en = document.getElementById('bEnd');
  if (en)
    en.onclick = () => {
      run = null;
      back();
    };
  if (done) {
    toast(summary);
    trackEv('bulk_enhance_end', { why: r.stopped, tries: r.tries, ups: r.ups, gold: r.spentGold, dust: r.spentDust });
  }
}

/** 장비 한 줄 「+5까지」·「+10까지」: 그 장비만 목표까지 바로 (예산 = 전부, 재료가 모자라면 멈춤) */
export function runToGoal(it: Item, goal: number): string {
  const r = startBulk({ target: 'pick', picked: [it.id], goal, budget: 1, skipLocked: false, charm: enhUse.charm });
  let n = 0;
  while (bulkTick(r) && n++ < 400);
  return `${esc(it.name)} +${it.enh}${it.enh >= goal ? ' 도달!' : ' (재료가 모자라 멈춤)'} · 실패 ${r.fails}회${r.spentGold ? ` · 금화 −${fmt(r.spentGold)}` : ''} · 가루 −${fmt(r.spentDust)}`;
}
/** 다음 목표 단계: +5 → +10 → (초월) +15 → +20 */
export const nextGoal = (enh: number, trans: boolean) => (enh < 5 ? 5 : enh < SM().maxEnhance ? SM().maxEnhance : trans ? (enh < 15 ? 15 : maxGoal()) : SM().maxEnhance);

// ───────── §3 일괄 제작 요약 카드 ─────────

export function craftSummary(r: RegionId, b: CraftBatch, back: () => void, slots: Slot[]) {
  const best = b.made.slice().sort((a, c) => 'nrel'.indexOf(c.grade) - 'nrel'.indexOf(a.grade))[0];
  const reg = REGIONS.find((x) => x.id === r)!;
  const normals = b.made.filter((it) => it.grade === 'n' && P.bag.includes(it) && !it.owner);
  openWin(
    '제작 결과',
    `<p class="sub">「${reg.set.name}」 ${b.made.length}/${slots.length}개 완성${b.bagShort ? ` · <span class="bad">가방 ${b.bagShort}칸 부족 — 분해하고 다시 해요</span>` : b.why && b.why !== 'bag' ? ` · <span class="bad">${esc(b.why)}</span>` : ''}</p>
    <div class="cmade">${b.made.map((it) => `<div class="cm ${it === best ? 'best' : ''}">${itemCell(it)}<small style="color:${GRADE_INFO[it.grade].color}">${esc(SLOT_NAME[it.slot])}</small></div>`).join('')}</div>
    ${best ? `<p class="note">가장 좋은 것: <b style="color:${GRADE_INFO[best.grade].color}">${esc(best.name)}</b></p>` : ''}
    <div class="btnrow"><button class="bigbtn" id="cmOk">모두 가방으로</button>${normals.length ? `<button class="bigbtn ghost" id="cmSal">일반 등급 바로 분해 (${normals.length})</button>` : ''}</div>`,
  );
  $('#cmOk').onclick = () => {
    closeWin();
    back();
  };
  const s = document.getElementById('cmSal');
  if (s)
    s.onclick = () => {
      let d = 0;
      for (const it of normals) d += salvage(it);
      toast(`일반 등급 ${normals.length}개 분해 · 가루 +${d}`);
      back();
    };
  void craftMany;
}
