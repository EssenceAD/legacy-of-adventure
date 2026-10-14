// WAYFIND UI: §1 인물 머리 위 「!」 · [보여 줘]/[나중에] · 처음 써 본 반응 · 안내서 「처음 해 보기」 목록 · §3 오늘 해 볼 만한 것
import { REGIONS, type RegionId } from '../data/items';
import { track as trackEv } from '../net/telemetry';
import { getPref, setPref } from '../save/save';
import { answerBubble, bubbleFirst, checkFirsts, firstDef, firstsStatus, noteBubble, type FirstDef, type FirstGo } from '../world/firsts';
import { flag } from '../world/flags';
import { regionIdx } from '../world/hunt';
import { P, S, wfHit, world, type Actor, type TalkLine } from '../world/state';
import { bestOf } from '../world/town';
import { stuckStage, wfState } from '../world/wayfind';
import { openDexTab } from './book';
import { esc } from './common';
import { enterDecor } from './decor';
import { isTalking, talk } from './dialogue';
import { openBoard } from './expedition';
import { openGuests } from './guests';
import { navHooks, openPlace } from './nav';
import { openVillage } from './neighbors';
import { enterPhoto } from './photo';
import { isWinOpen, openBuild, openWin, showObj, toast } from './windows';
import { fsay } from '../world/visual';
import { PRI, qb, quietOn } from '../world/quiet';

export const wfBubblesOn = () => !getPref<boolean>('wfBubOff', false);
export const setWfBubbles = (on: boolean) => {
  setPref('wfBubOff', !on);
  if (!on) dropBubble();
};

const home = () => world.home?.actors ?? world.actors;
const homeObjs = () => world.home?.objs ?? world.objs;
const line = (f: FirstDef, l: [string, string]): TalkLine => [l[0], l[1], undefined, l[0] === 'post' || l[0] === 'keeper' ? undefined : f.tag];
const busy = () =>
  isWinOpen() || isTalking() || !!document.querySelector('#hunt, #raid, #storyFx, .cbt') || document.body.classList.contains('photo') || document.body.classList.contains('decor');

/** 「!」를 띄울 사람: 그 인물이 마을에 있으면 그 사람 · 없으면 모모 → 버나드 */
function hostOf(f: FirstDef): Actor | null {
  const ok = (a: Actor) => !a.hidden && !a.leaving && !a.party && a.runId == null;
  const find = (h: string) => home().find((a) => ok(a) && (h === 'npc' ? a.role === 'npc' : h === 'keeper' ? a.role === 'keeper' : a.heroId === h || a.legendId === h)) ?? null;
  return find(f.host) ?? find('npc') ?? find('keeper');
}

// ───────── 말풍선 ─────────

interface WfBub extends HTMLButtonElement {
  _a?: Actor;
  _id?: string;
}
let bub: WfBub | null = null;
function dropBubble() {
  bub?.remove();
  bub = null;
  // FIRSTLOOK §2-1: 「!」가 잡고 있던 말풍선 자리를 놓는다
  qb.release('wf', performance.now());
}
function showBubble(f: FirstDef, a: Actor) {
  // FIRSTLOOK §2-1 화면 조용히: 「!」(안내)도 말풍선 자리 하나를 잡아야 뜬다 — 다른 말풍선이 떠 있으면 끝나고 간격 뒤에 (가장 먼저)
  if (quietOn() && !qb.wantHold('wf', PRI.guide, performance.now())) {
    bub?.remove();
    bub = null;
    return;
  }
  if (bub && bub._id === f.id && bub._a === a && bub.isConnected) return;
  bub?.remove();
  bub = null;
  const over = document.getElementById('over');
  if (!over) return;
  const b = document.createElement('button') as WfBub;
  b.className = 'wfbub';
  b.textContent = '!';
  b.setAttribute('aria-label', `${f.tag}의 이야기`);
  b._a = a;
  b._id = f.id;
  b.onclick = (e) => {
    e.stopPropagation();
    openFirstTalk(f);
  };
  over.appendChild(b);
  bub = b;
  if (wfState().today !== f.id) {
    noteBubble(f.id);
    trackEv('wayfind_bubble', { id: f.id, act: 'show' });
  }
}

/** 말풍선을 눌렀을 때: 짧은 대사 + [보여 줘] [나중에] */
export function openFirstTalk(f: FirstDef) {
  dropBubble();
  const lines = f.lines().map((l) => line(f, l));
  lines.push(['narr', `처음 해 보면 선물: ${f.rewardText}`]);
  talk(lines, undefined, [
    {
      label: '보여 줘',
      fn: () => {
        answerBubble(f.id, false);
        trackEv('wayfind_bubble', { id: f.id, act: 'go' });
        goFirst(f.go(), f.id);
      },
    },
    {
      label: '나중에',
      fn: () => {
        answerBubble(f.id, true);
        trackEv('wayfind_bubble', { id: f.id, act: 'later' });
        toast('3일 뒤에 다시 알려 드릴게요');
      },
    },
  ]);
}

/** 창의 그 버튼에 반짝 테두리 3초 */
function shine(sel: string) {
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return;
    el.classList.add('wfshine');
    el.scrollIntoView?.({ block: 'nearest' });
    setTimeout(() => el.classList.remove('wfshine'), 3000);
  }, 250);
}
const objOf = (k: string) => bestOf(k as never, homeObjs(), true);
export function goFirst(go: FirstGo, id = '') {
  if (S.visiting) return toast(fsay('이웃 마을에서 돌아온 뒤에 해요', '이웃 마을에서 돌아오시면 해 드릴게요'));
  switch (go) {
    case 'pond': {
      const o = objOf('lily_pond') ?? objOf('koi_pond');
      if (!o) return openBuild();
      showObj(o);
      return shine('.fishgo');
    }
    case 'build':
      toast('「정원」 장식에서 연못을 지을 수 있어요');
      return openBuild();
    case 'guests':
      toast('마을에서 단골을 눌러 [선물하기]');
      return openGuests();
    case 'smith':
      openPlace('smith');
      return shine(id === 'whet' ? '#cWhet' : '#win .tabs .tab');
    case 'alchemy':
    case 'chapel': {
      const o = objOf(go);
      if (!o) return openBuild();
      showObj(o);
      return shine(go === 'alchemy' ? '[data-alt="1"]' : '#blessB');
    }
    case 'raid':
      return openPlace('raid');
    case 'village':
      return void openVillage();
    case 'decor':
      return enterDecor();
    case 'photo':
      return enterPhoto();
    case 'diary':
      openDexTab('손님');
      return shine('details.diary');
    case 'favors':
      openBoard(1);
      return;
  }
}

// ───────── 매초 ─────────

/** 처음 써 본 반응 (한가할 때 하나씩) */
function deliverReact(): boolean {
  const w = wfState();
  const p = w.pend.shift();
  if (!p) return false;
  const [id, got] = p.split('|');
  const f = firstDef(id);
  const tail: TalkLine[] = got ? [['narr', `🎁 처음 해 본 선물 · ${got}`]] : [];
  trackEv('wayfind_first', { id });
  if (id === 'all') talk([['keeper', '허허, 이제 이 마을 구석구석 모르는 게 없겠군.', undefined, undefined], ...tail]);
  else if (f) talk([...f.react.map((l) => line(f, l)), ...tail]);
  return true;
}

let acc = 0;
export function tickWayfind() {
  if (!S.started) return;
  // 상태로 못 세는 「처음」: 이웃 구경 · 꾸미기 · 사진 모드
  if (S.visiting) {
    wfHit('neighbor');
    dropBubble();
    return;
  }
  if (document.body.classList.contains('decor')) wfHit('decor');
  if (document.body.classList.contains('photo')) wfHit('photo');
  if (++acc % 2) return;
  checkFirsts();
  if (busy()) {
    if (bub && document.body.classList.contains('photo')) dropBubble();
    // 창·대화 동안 숨어 있는 「!」는 자리를 그대로 잡고 있는다 (닫으면 그대로 보이게)
    else if (bub && quietOn()) qb.wantHold('wf', PRI.guide, performance.now());
    return;
  }
  if (wfState().pend.length && deliverReact()) return dropBubble();
  const f = flag('wayfindBubbles') && wfBubblesOn() ? bubbleFirst() : null;
  const a = f ? hostOf(f) : null;
  if (f && a) showBubble(f, a);
  else dropBubble();
}

export function initWayfindUI() {
  // 일기를 펼치면 「일기 읽기」
  addEventListener(
    'toggle',
    (e) => {
      const d = e.target as HTMLDetailsElement;
      if (!d?.classList?.contains('diary') || !d.open) return;
      wfState().diaryKey = d.dataset.dk ?? '';
      wfHit('diary');
    },
    true,
  );
}

// ───────── 안내서 「처음 해 보기」 목록 ─────────

export function firstsListHtml(): string {
  const rows = firstsStatus()
    .map(({ f, st }) => `<div class="wfrow ${st}"><span>${st === 'done' ? '✓' : st === 'open' ? '◇' : '🔒'}</span><b>${esc(f.name)}</b><small>${st === 'done' ? '해 봤어요' : st === 'open' ? `해 볼 수 있음 · 선물 ${esc(f.rewardText)}` : '아직 잠김'}</small>${st === 'open' ? `<button class="b" data-wfgo="${f.id}">가기 ›</button>` : ''}</div>`)
    .join('');
  const n = firstsStatus().filter((x) => x.st === 'done').length;
  return `<p class="sub">${n}/${firstsStatus().length} · 다 채우면 칭호 「구석구석 아는 주인」</p><div class="wflist">${rows}</div>`;
}
export function openFirstsList() {
  openWin('안내서 · 처음 해 보기', `${firstsListHtml()}<button class="bigbtn ghost sm" id="wfBack">목차</button>`);
  bindGo(document.getElementById('winB') ?? document.body);
  document.getElementById('wfBack')!.onclick = () => wayfindHooks.manual();
}
function bindGo(root: HTMLElement, after?: () => void) {
  root.querySelectorAll<HTMLElement>('[data-wfgo]').forEach(
    (b) =>
      (b.onclick = () => {
        after?.();
        const f = firstDef(b.dataset.wfgo!);
        if (f) goFirst(f.go(), f.id);
      }),
  );
}

// ───────── §3 오늘 해 볼 만한 것 (「🎯 오늘」 패널 맨 아래) ─────────

export function todayPicksHtml(): string {
  if (!flag('todayPicks') || S.visiting) return '';
  const items: string[] = [];
  const f = firstsStatus().find((x) => x.st === 'open')?.f;
  if (f) items.push(`<button class="b" data-wfgo="${f.id}">${esc(f.name)} 해 보기 ›</button>`);
  const st = stuckStage();
  if (st) {
    const name = `${REGIONS[regionIdx(st.r)]?.name ?? ''} ${st.s}`;
    items.push(`<button class="b" data-wfhunt="${st.r}">${esc(name)} 다시 도전 (결의 ${st.n}) ›</button>`);
  }
  return items.length ? `<div class="wftoday"><b>오늘 해 볼 만한 것</b>${items.join('')}</div>` : '';
}
export function bindTodayPicks(root: HTMLElement, close: () => void) {
  bindGo(root, close);
  root.querySelectorAll<HTMLElement>('[data-wfhunt]').forEach(
    (b) =>
      (b.onclick = () => {
        close();
        trackEv('wayfind_today', { pick: 'stuck' });
        wayfindHooks.hunt(b.dataset.wfhunt as RegionId);
      }),
  );
}
/** 사냥 창 열기 (ui/hunt가 채운다 — import가 꼬이지 않게) */
export const wayfindHooks = { hunt: (_r: RegionId) => openPlace('hunt'), manual: () => navHooks.menu() };

void P;

// 개발용 (e2e)
if (import.meta.env.DEV) Object.assign(window, { __wf: { state: wfState, check: checkFirsts, talk: (id: string) => openFirstTalk(firstDef(id)!), list: openFirstsList } });
