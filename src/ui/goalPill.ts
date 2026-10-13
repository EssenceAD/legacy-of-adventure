// HOTFIX16 §2: 오늘의 목표 꺼내 놓기 — 왼쪽 위 여관 정보 카드·「🎯 오늘 2/4」 알약을 누르면 펼침 패널(진행 막대 · 받기 · 가기 · 다음 초기화까지 · 전체 보기)
import { GOAL_TEMPLATES } from '../data/goals';
import { getPref, setPref } from '../save/save';
import { claimGoal, ensureGoals } from '../world/progress';
import { markDirty, P, S } from '../world/state';
import { openGoals } from './book';
import { esc, fmt } from './common';
import { isTalking } from './dialogue';
import { openPlace, type Place } from './nav';
import { isWinOpen, toast } from './windows';
import { bindTodayPicks, todayPicksHtml } from './wayfind';

export const goalPillOn = () => !getPref<boolean>('goalPillOff', false);
export const setGoalPill = (on: boolean) => (setPref('goalPillOff', !on), syncGoalPill());

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T | null;
const ready = (g: (typeof P.goals.list)[number]) => g.progress >= g.target && !g.claimed;

/** 다음 초기화(현실 자정)까지 「3시간 12분」 */
function untilReset(): string {
  const n = new Date();
  const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).getTime() - n.getTime();
  const h = Math.floor(m / 3600000);
  const mm = Math.floor((m % 3600000) / 60000);
  return h ? `${h}시간 ${mm}분` : `${mm}분`;
}

let panel: HTMLDivElement | null = null;
let lastHtml = '';
export const goalPanelOpen = () => !!panel;
export function closeGoalPanel() {
  panel?.remove();
  panel = null;
}
export function openGoalPanel() {
  ensureGoals();
  closeGoalPanel();
  lastHtml = '';
  panel = document.createElement('div');
  panel.id = 'goalPanel';
  panel.className = 'px';
  document.getElementById('hud')!.appendChild(panel);
  drawPanel();
}
function drawPanel() {
  if (!panel) return;
  const rows = P.goals.list
    .map((g, i) => {
      const t = GOAL_TEMPLATES.find((x) => x.id === g.id);
      if (!t) return '';
      const pct = Math.round((Math.min(g.progress, g.target) / Math.max(1, g.target)) * 100);
      const btn = g.claimed ? '<button disabled>받음</button>' : ready(g) ? `<button class="rd" data-gc="${i}">받기</button>` : `<button data-gg="${t.go}">가기 ›</button>`;
      return `<div class="gpr ${g.claimed ? 'got' : ''}"><span><b>${esc(t.text(g.target))}</b><i><u style="width:${pct}%"></u></i><small>${g.progress}/${g.target} · ${fmt(t.reward.gold)}G</small></span>${btn}</div>`;
    })
    .join('');
  const html = `<div class="gph"><b>🎯 오늘의 목표</b><small>초기화까지 ${untilReset()}</small><button class="gx" aria-label="닫기">✕</button></div>${rows}${todayPicksHtml()}<button class="gall">오늘의 목표 전체 보기</button>`;
  // 1초마다 다시 그려도 그대로면 건드리지 않는다 (누르는 중인 버튼이 바뀌지 않게)
  if (html === lastHtml) return;
  lastHtml = html;
  panel.innerHTML = html;
  panel.querySelector<HTMLElement>('.gx')!.onclick = closeGoalPanel;
  panel.querySelector<HTMLElement>('.gall')!.onclick = () => (closeGoalPanel(), openGoals());
  panel.querySelectorAll<HTMLElement>('[data-gc]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = claimGoal(+b.dataset.gc!);
        if (!r) return;
        markDirty();
        toast(`목표 달성 · 금화 +${fmt(r.gold)}`);
        drawPanel();
        syncGoalPill();
      }),
  );
  bindTodayPicks(panel, closeGoalPanel);
  panel.querySelectorAll<HTMLElement>('[data-gg]').forEach((b) => (b.onclick = () => (closeGoalPanel(), openPlace(b.dataset.gg as Place))));
}

export function syncGoalPill() {
  const pill = $('#goalPill');
  if (!pill) return;
  // HOTFIX17 §1: 창·대화·전투(사냥/토벌)·사진 모드·컷신 중 하나라도 있으면 숨김 (장부 카드와 같은 조건 + 창)
  const battle = !!document.querySelector('.battle, .cbt, #cbCv, #hunt, #raid, #storyFx') || document.body.classList.contains('photo') || isWinOpen();
  // 날이 바뀌면 새 목표로 (알약이 다시 켜진다)
  if (S.started && !S.visiting) ensureGoals();
  const show = goalPillOn() && S.started && !S.visiting && !battle && !isTalking() && P.goals.list.length > 0;
  pill.hidden = !show;
  if (!show) return;
  const L = P.goals.list;
  const done = L.filter((g) => g.progress >= g.target).length;
  const allGot = L.every((g) => g.claimed);
  const any = L.some(ready);
  const text = allGot ? '🎯 오늘 끝!' : `🎯 오늘 ${done}/${L.length}`;
  if (pill.firstChild?.textContent !== text) pill.innerHTML = `${text}<i class="ndot"${any ? '' : ' hidden'}></i>`;
  else pill.querySelector<HTMLElement>('.ndot')!.hidden = !any;
  pill.classList.toggle('ready', any);
  pill.classList.toggle('over', allGot);
  placePill(pill);
}

const shown = (e: HTMLElement | null): e is HTMLElement => !!e && !e.hidden && e.offsetParent !== null;
/**
 * 알약 자리 (따밤 신고: 412px 폰에서 장부 카드 뒤로 숨음): 실제 화면 상자로 겹침을 재서 고른다
 *  1) 풍경(평가) 줄이 보이면 그 오른쪽 — 화면 오른쪽 끝을 넘거나 장부 카드·오른쪽 버튼과 겹치면 2)로
 *  2) 왼쪽 위 카드들(상태·장부·풍경) 맨 아래 바로 밑
 */
function placePill(pill: HTMLElement) {
  const hud = document.getElementById('hud');
  if (!hud) return;
  const H = hud.getBoundingClientRect();
  const ev = $('#evalbar');
  const left = [$('.top .stat'), $('#mission'), ev].filter(shown).map((e) => e.getBoundingClientRect());
  const blocks = [...left, ...[...document.querySelectorAll<HTMLElement>('.top button, #bHarm, #hSpk')].filter(shown).map((e) => e.getBoundingClientRect())];
  const w = pill.offsetWidth;
  const h = pill.offsetHeight;
  const gap = 6;
  const hits = (x: number, y: number) => x + w > H.width - gap || blocks.some((b) => H.left + x < b.right && H.left + x + w > b.left && H.top + y < b.bottom && H.top + y + h > b.top);
  const spots: [number, number][] = [];
  if (shown(ev)) {
    const r = ev.getBoundingClientRect();
    spots.push([r.right + gap - H.left, r.top + (r.height - h) / 2 - H.top]);
  }
  const low = left.length ? Math.max(...left.map((b) => b.bottom)) : 0;
  const under: [number, number] = [left.length ? Math.min(...left.map((b) => b.left)) - H.left : 10, low ? low + gap - H.top : NaN];
  const [x, y] = spots.find(([x, y]) => !hits(x, y)) ?? under;
  pill.style.left = Number.isFinite(x) ? `${Math.round(x)}px` : '';
  pill.style.top = Number.isFinite(y) ? `${Math.round(y)}px` : '';
}

export function initGoalPill() {
  const pill = document.createElement('button');
  pill.id = 'goalPill';
  pill.className = 'px';
  pill.hidden = true;
  pill.setAttribute('aria-label', '오늘의 목표');
  document.getElementById('hud')!.appendChild(pill);
  // 왼쪽 위 카드 크기가 바뀌면(장부 줄 수·글자 크기·풍경 줄 켜짐) 1초 기다리지 않고 바로 자리 다시
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => !pill.hidden && placePill(pill));
    for (const sel of ['.top .stat', '#mission', '#evalbar']) {
      const e = $(sel);
      if (e) ro.observe(e);
    }
  }
  const toggle = () => (panel ? closeGoalPanel() : openGoalPanel());
  pill.onclick = (e) => (e.stopPropagation(), toggle());
  // 왼쪽 위 여관 정보 카드 (전투력 버튼은 따로)
  const stat = $('.top .stat');
  if (stat) {
    stat.style.cursor = 'pointer';
    stat.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('#pwr') || !S.started || S.visiting) return;
      e.stopPropagation();
      toggle();
    });
  }
  // 바깥을 누르거나 창·대화가 뜨면 닫힘
  addEventListener('pointerdown', (e) => {
    if (panel && !(e.target as HTMLElement).closest('#goalPanel, #goalPill, .top .stat, #newsBand')) closeGoalPanel();
  });
  setInterval(() => {
    if (document.hidden) return;
    if (panel && (isWinOpen() || isTalking() || S.visiting)) closeGoalPanel();
    syncGoalPill();
    if (panel) drawPanel();
  }, 1000);
}
