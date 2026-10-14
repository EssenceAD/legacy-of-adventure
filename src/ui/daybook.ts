// CHECKIN §D1 오늘의 장부 창 — 탭: 오늘의 장부(6중3) · 오늘의 목표 · 마을 부탁 · 이번 주
//  기존 「🎯 오늘의 목표」·마을 부탁을 이 창 안 탭으로 합친다 (플래그 ledgerDaily · 끄면 예전 그대로)
import { DAYBOOK } from '../data/harvest_cfg';
import { GOAL_TEMPLATES } from '../data/goals';
import { flag } from '../world/flags';
import { untilKstMidnight } from '../world/goldsink';
import { almanacOn, stampMult } from '../world/almanac';
import {
  boxReady, canRepick, candDone, candProg, claimCand, claimDayBox, claimWeekBox, dayCount, dayDef, daybookOn, dbState, itemRewardText, pickCands, pickedIdx, weekBoxText, weekReady,
} from '../world/daybook';
import { claimGoal, ensureGoals } from '../world/progress';
import { markDirty, P } from '../world/state';
import { $$, esc, fmt, keepScroll } from './common';
import { bindFavors, favorsHtml } from './goldsink';
import { iconSrc } from './kit';
import { openPlace, type Place } from './nav';
import { openWin, toast } from './windows';

/**
 * CHECKIN §E 연출 자리 (E 묶음 stampFx — 합칠 때 이어 준다): 장부 셋 다 · 연감 도장을 받은 순간
 *  allDone = 오늘의 장부 셋 다 받음(상자) · stamp = 연감 도장이 찍힘 (el = 그 버튼)
 */
export const ledgerHooks = { allDone: (_el?: HTMLElement) => {}, stamp: (_el?: HTMLElement) => {} };

let tab = 0;
/** 고르는 중 (창 안에서만 · 담기를 눌러야 저장) */
let sel: number[] | null = null;

const TABS = ['오늘의 장부', '오늘의 목표', '마을 부탁', '이번 주'];
function tabsHtml(): string {
  return `<div class="tabs" id="dbT">${TABS.map((n, i) => `<button class="tab ${i === tab ? 'on' : ''}" data-dbt="${i}">${n}</button>`).join('')}</div>`;
}

function ledgerHtml(): string {
  const d = dbState();
  const picked = pickedIdx(d);
  const can = canRepick(d);
  const cur = sel ?? picked;
  const h = Math.floor(untilKstMidnight() / 3600000);
  const m = Math.floor((untilKstMidnight() % 3600000) / 60000);
  const rows = d.cands
    .map((c, i) => {
      const def = dayDef(c.id);
      if (!def) return '';
      const on = cur.includes(i);
      const p = candProg(c);
      const done = candDone(c);
      const act = c.claimed
        ? '<button disabled>받음</button>'
        : on && picked.includes(i) && done && !sel
          ? `<button class="rd" data-dbc="${i}">받기</button>`
          : can
            ? `<button class="${on ? 'on' : ''}" data-dbp="${i}">${on ? '✓ 담음' : '담기'}</button>`
            : on
              ? `<button data-dbg="${def.go}">가기 ›</button>`
              : '<button disabled>—</button>';
      return `<div class="fvrow dbrow ${on ? 'pick' : 'off'} ${c.claimed ? 'got' : done && on ? 'ready' : ''}"><span><b>${esc(def.text(c.target))}</b><i><u style="width:${Math.round((p / c.target) * 100)}%"></u></i><small>${p}/${c.target}${on ? ` · ${esc(itemRewardText())}` : ''}</small></span>${act}</div>`;
    })
    .join('');
  const [n, of] = dayCount(d);
  const changed = sel && (sel.length !== picked.length || sel.some((i) => !picked.includes(i)));
  const pickBar = can
    ? `<p class="note">6개 중 ${DAYBOOK.pick}개를 골라 담아요 · 안 고르면 위의 ${DAYBOOK.pick}개 · 하나라도 받으면 오늘은 그대로</p>${changed ? `<button class="bigbtn sm" id="dbPick" ${(sel?.length ?? 0) === DAYBOOK.pick ? '' : 'disabled'}>이 ${DAYBOOK.pick}개로 담기</button>` : ''}`
    : '';
  const stamps = almanacOn() ? ` + 연감 도장 ${DAYBOOK.stamps * stampMult()}${stampMult() > 1 ? ' (마지막 주 ×2)' : ''}` : '';
  const box = d.box
    ? '<p class="note">오늘 상자를 받았어요 · 내일 0시에 새 장부</p>'
    : `<button class="bigbtn ${boxReady(d) ? 'flash' : ''}" id="dbBox" ${boxReady(d) ? '' : 'disabled'}><img class="kic" src="${iconSrc('box_crate', true)}" alt=""> 셋 다 하면 작은 상자${stamps} (${n}/${of})</button>`;
  return `<p class="sub">매일 한국 시간 0시에 새 장부 · ${h}시간 ${m}분 남음</p>${pickBar}<div class="dblist">${rows || '<p class="note">오늘은 장부가 비었어요</p>'}</div>${box}`;
}

function goalsHtml(): string {
  ensureGoals();
  const rows = P.goals.list
    .map((g, i) => {
      const t = GOAL_TEMPLATES.find((x) => x.id === g.id);
      if (!t) return '';
      const done = g.progress >= g.target;
      const act = g.claimed ? '<button disabled>받음</button>' : done ? `<button class="rd" data-gc="${i}">받기</button>` : `<button data-dbg="${t.go}">가기 ›</button>`;
      return `<div class="fvrow ${g.claimed ? 'got' : done ? 'ready' : ''}"><span><b>${esc(t.text(g.target))}</b><i><u style="width:${Math.round((Math.min(g.progress, g.target) / Math.max(1, g.target)) * 100)}%"></u></i><small>${g.progress}/${g.target} · 보상 ${fmt(t.reward.gold)}G${t.reward.dust ? ` + 잿빛 가루 ${t.reward.dust}` : ''}</small></span>${act}</div>`;
    })
    .join('');
  return `<p class="sub">예전 「오늘의 목표」 · 매일 바뀌어요</p>${rows || '<p class="note">오늘은 목표가 없어요</p>'}`;
}

function weekHtml(): string {
  const d = dbState();
  const ready = weekReady(d);
  const boxes = DAYBOOK.week
    .map((n) => {
      const got = d.weekBox.includes(n);
      const can = ready.includes(n);
      const ic = n >= 21 ? 'box_chest' : n >= 14 ? 'box_gift' : 'box_crate';
      return `<div class="fvrow ${got ? 'got' : can ? 'ready' : ''}"><span><b><img class="kic" src="${iconSrc(ic as never, true)}" alt=""> ${n}개 상자</b><small>${esc(weekBoxText(n))}</small></span>${got ? '<button disabled>받음</button>' : `<button class="${can ? 'rd' : ''}" data-dbw="${n}" ${can ? '' : 'disabled'}>${can ? '받기' : `${Math.min(d.weekN, n)}/${n}`}</button>`}</div>`;
    })
    .join('');
  const max = DAYBOOK.week[DAYBOOK.week.length - 1];
  return `<p class="sub">이번 주(월요일 0시부터) 장부 완료 <b class="g">${d.weekN}</b>/${max}</p><div class="bar"><span>이번 주</span><i><b style="width:${Math.min(100, (d.weekN / max) * 100)}%;background:#e8a23a"></b></i><em>${d.weekN}</em></div><p class="note">주간 미션은 따로 없어요 · 오늘의 장부를 하나 받을 때마다 1칸</p>${boxes}`;
}

/** 오늘의 장부 창 (t = 탭 번호) */
export function openDaybook(t = tab) {
  if (!daybookOn() || !flag('ledgerDaily')) return toast('오늘의 장부는 아직 열리지 않았어요');
  if (t !== tab) sel = null;
  tab = Math.max(0, Math.min(TABS.length - 1, t));
  const body = tab === 0 ? ledgerHtml() : tab === 1 ? goalsHtml() : tab === 2 ? favorsHtml() : weekHtml();
  openWin('오늘의 장부', tabsHtml() + body, 'daybook');
  $$('[data-dbt]').forEach((b) => (b.onclick = () => openDaybook(+b.dataset.dbt!)));
  $$('[data-dbg]').forEach((b) => (b.onclick = () => openPlace(b.dataset.dbg as Place)));
  const redraw = () => keepScroll(() => openDaybook(tab));
  if (tab === 2) bindFavors(redraw);
  $$('[data-dbp]').forEach(
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.dbp!;
        const cur = (sel ?? pickedIdx()).slice();
        const k = cur.indexOf(i);
        if (k >= 0) cur.splice(k, 1);
        else if (cur.length >= DAYBOOK.pick) return toast(`${DAYBOOK.pick}개까지 담아요 · 하나를 먼저 빼요`);
        else cur.push(i);
        sel = cur;
        redraw();
      }),
  );
  const pk = document.getElementById('dbPick');
  if (pk)
    pk.onclick = () => {
      const err = pickCands(sel ?? []);
      if (err) return toast(err);
      sel = null;
      toast('오늘의 장부에 담았어요');
      redraw();
    };
  $$('[data-dbc]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = claimCand(+b.dataset.dbc!);
        if (!r) return;
        toast(`장부 한 줄 완료 · ${r}`);
        redraw();
      }),
  );
  const bx = document.getElementById('dbBox');
  if (bx)
    bx.onclick = () => {
      const r = claimDayBox();
      if (!r) return;
      ledgerHooks.allDone(bx);
      if (r.stamps) ledgerHooks.stamp(bx);
      toast(`작은 상자 · ${r.box}${r.stamps ? ` · 연감 도장 +${r.stamps}` : ''}`);
      redraw();
    };
  $$('[data-gc]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = claimGoal(+b.dataset.gc!);
        if (!r) return;
        markDirty();
        toast(`목표 달성 · 금화 +${fmt(r.gold)}`);
        redraw();
      }),
  );
  $$('[data-dbw]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = claimWeekBox(+b.dataset.dbw!);
        if (!r) return;
        toast(`이번 주 상자 · ${r}`);
        redraw();
      }),
  );
}
