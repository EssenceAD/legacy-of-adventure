// STORY v2·v3 화면: 갈림길 목표 창(모든 루트) · 장부 카드 · 루트 사건(최종 토벌 · 고백 · 결혼식 · 연회 · 편집장 · 그 밤) · 루트 엔딩
import { endCredits } from './chronicle';
import { ROUTES, type RouteId, type SLine } from '../data/story/v1';
import { ROUTE_HERO, ROUTE_LOVE } from '../data/story/v2';
import { ROUTE_LEGEND, ROUTE_TOWN, ROUTE_TRUE } from '../data/story/v3';
import { CONFIG } from '../data/config';
import { REGIONS } from '../data/items';
import { DEEP_DEFEAT_HERO, DEEP_VOICE } from '../data/story/regions';
import { huntRegionOpen } from '../world/hunt';

import { powerOf } from '../world/adventurers';
import { addToBag, makeItem } from '../world/items';
import { cutCtx, expandCut, pickBouquet, regulars, routeDone, routeGoals, routeHooks, routePreDone, setFlag } from '../world/routes';
import { markDirty, P, S } from '../world/state';
import { fill, rethink } from '../world/story';
import { track } from '../net/telemetry';
import { $, esc, fmt } from './common';
import { isTalking } from './dialogue';
import { closeWin, openWin, toast } from './windows';
/** ui/story가 넘겨주는 것 (서로 import하지 않게) */
export interface RouteStoryApi {
  play: (lines: SLine[], done?: () => void) => void;
  openLetter: () => void;
  endRoute: (r: Exclude<RouteId, 'retire'>, cut: SLine[]) => void;
}

const R = () => CONFIG.story.routes;
const st = () => P.story;
const ROUTE_DATA: Record<Exclude<RouteId, 'retire'>, { cut: SLine[]; card: string }> = {
  hero: ROUTE_HERO,
  love: ROUTE_LOVE,
  legend: ROUTE_LEGEND,
  town: ROUTE_TOWN,
  true: ROUTE_TRUE,
};
export const routeCardText = (r: RouteId) => (r === 'retire' ? '' : ROUTE_DATA[r].card);

// ───────── 용사: 다락의 옛 칼 ─────────

const ATTIC = '다락의 옛 칼';
routeHooks.atticGear = () => {
  if (P.bag.some((it) => it.name === ATTIC)) return;
  const it = makeItem('abyss', 'e', 'weapon', false);
  it.name = ATTIC;
  it.enh = 0;
  addToBag(it);
  (st().flags ??= {}).attic = it.id;
  toast(`가방에 「${ATTIC}」이 들어왔어요 · 대장간에서 +5까지 강화해요`);
};
routeHooks.atticItem = () => P.bag.find((it) => it.id === st().flags?.attic || it.name === ATTIC) ?? null;

// ───────── 목표 창 ─────────

export function openGoals(api: RouteStoryApi) {
  const r = st().route as RouteId;
  const gs = routeGoals(r);
  const night = S.night;
  const actions: string[] = [];
  if (routeDone(r)) actions.push('<button class="bigbtn" id="rEnd">엔딩 보기</button>');
  else if (routePreDone(r)) {
    if (r === 'hero' && !st().flags?.final) actions.push('<button class="bigbtn" id="rAct">최종 토벌 「별을 삼킨 것」</button>');
    if (r === 'legend' && !st().flags?.feast) actions.push('<button class="bigbtn" id="rAct">연회 열기</button>');
    if (r === 'true' && !st().flags?.night) actions.push(`<button class="bigbtn" id="rAct" ${night ? '' : 'disabled'}>그 밤, 불 켜 두기${night ? '' : ' (밤에)'}</button>`);
  }
  if (r === 'love') {
    const g = gs;
    if (g[0].done && g[1].done && !st().flags?.confess) actions.push('<button class="bigbtn" id="rAct">고백 보기</button>');
    if (st().flags?.confess && !st().flags?.wed) {
      const meals = (P.counters.tavernMeals ?? 0) - (st().base?.meals ?? 0) >= R().wedMeals;
      actions.push(`<button class="bigbtn" id="rWed" ${meals && S.gold >= R().wedGold ? '' : 'disabled'}>결혼식 준비 (💰${fmt(R().wedGold)})</button>`);
    }
  }
  if (r === 'town' && routePreDone(r) && !st().flags?.visit) actions.push('<button class="bigbtn" id="rAct">편집장 맞이하기</button>');
  openWin(
    `갈림길 · ${ROUTES[r].name}`,
    `<div class="steps">${gs.map((g) => `<div class="stp ${g.done ? 'done' : ''}"><span><b>${g.done ? '✓ ' : ''}${esc(fill(g.title))}</b><small>${esc(g.text)}</small></span></div>`).join('')}</div>
    ${actions.join('')}
    ${st().act >= 3 && !st().changed && st().heir === 0 ? '<button class="bigbtn ghost" id="sRe">모모에게 「다시 생각해 볼게」</button>' : ''}`,
    'storyw',
  );
  const e = document.getElementById('rEnd');
  if (e) e.onclick = () => playRouteEnding(api);
  const a = document.getElementById('rAct');
  if (a) a.onclick = () => doAction(r, api);
  const w = document.getElementById('rWed');
  if (w)
    w.onclick = () => {
      if (S.gold < R().wedGold) return toast('금화가 모자라요');
      S.gold -= R().wedGold;
      setFlag('wed');
      track('route_event', { route: 'love', ev: 'wed' });
      toast('결혼식 준비 끝! 장부에서 엔딩을 볼 수 있어요');
      openGoals(api);
    };
  const re = document.getElementById('sRe');
  if (re)
    re.onclick = () => {
      if (!confirm('다시 고르면 이번 3막에서는 더 바꿀 수 없어요. 다시 생각해 볼까요?')) return;
      if (rethink()) api.openLetter();
    };
}

function doAction(r: RouteId, api: RouteStoryApi) {
  closeWin();
  if (r === 'hero') return finalRaid(api);
  if (r === 'legend') {
    return api.play(expandCut('legend', ROUTE_LEGEND.feast), () => {
      setFlag('feast');
      track('route_event', { route: 'legend', ev: 'feast' });
      openGoals(api);
    });
  }
  if (r === 'love') {
    return api.play(expandCut('love', ROUTE_LOVE.confess), () => {
      setFlag('confess');
      track('route_event', { route: 'love', ev: 'confess' });
      openGoals(api);
    });
  }
  if (r === 'town') return editorVisit(api);
  if (r === 'true') {
    setFlag('night');
    track('route_event', { route: 'true', ev: 'night' });
    toast('맨 위층 창가 방에 불을 켰어요');
    openGoals(api);
  }
}
/** 편집장 방문 (마을 루트 앞 셋을 마치면) — 뒤에 찍는 사진이 표지 */
export function editorVisit(api: RouteStoryApi) {
  api.play(expandCut('town', ROUTE_TOWN.visit), () => {
    setFlag('visit');
    (st().flags ??= {}).visitPhotos = P.counters.photos ?? 0;
    markDirty();
    toast('사진 모드로 마을 전경을 한 장 찍어 주세요 📷');
  });
}
/** 용사 루트 최종 토벌 (가장 센 단골 다섯) — 이기면 목표 완료
 *  REGIONS2: 심연의 바닥이 열렸으면 그 x-10 「별을 삼킨 것」(같은 존재 · 50% 목소리 · 처치 컷 HERO) · 아니면 예전처럼 별의 심연 10 */
function finalRaid(api: RouteStoryApi) {
  const party = regulars()
    .filter((a) => !a.leaving && a.runId == null)
    .sort((a, b) => powerOf(b) - powerOf(a))
    .slice(0, 5);
  if (!party.length) return toast('함께 갈 단골이 없어요');
  toast('「별을 삼킨 것」에게!');
  const deep = huntRegionOpen(REGIONS.findIndex((r) => r.id === 'deep'));
  void Promise.all([import('../combat/ui'), import('./hunt')]).then(([{ startCombat, closeCombat }, { deepDefeat }]) =>
    startCombat(deep ? 'deep' : 'abyss', 10, party, false, (res) => {
      if (res.win) {
        if (deep) {
          deepDefeat(true);
          closeCombat();
          return api.play(DEEP_DEFEAT_HERO, () => setTimeout(() => openGoals(api), 300));
        }
        setFlag('final');
        track('route_event', { route: 'hero', ev: 'final' });
        setTimeout(() => openGoals(api), 1200);
      } else toast('아직이에요… 단골들을 더 키워서 다시 도전해요');
    }, deep ? { talkHalf: (done) => api.play(DEEP_VOICE, done) } : {}),
  );
}

// ───────── 엔딩 ─────────

export function routeCut(r: Exclude<RouteId, 'retire'>): SLine[] {
  const extra: Record<string, string> = {};
  if (r === 'love') {
    const b = pickBouquet();
    extra.catch = fill(b.name);
    extra.catchSpeaker = b.who;
    extra.catchLine = fill(b.line);
  }
  void cutCtx;
  return [...expandCut(r, ROUTE_DATA[r].cut, extra), ...endCredits()];
}
export function playRouteEnding(api: RouteStoryApi) {
  const r = st().route as Exclude<RouteId, 'retire'>;
  if (!r || r === ('retire' as RouteId) || !routeDone(r) || isTalking()) return;
  closeWin();
  api.endRoute(r, routeCut(r));
}

/** 장부 카드 (은퇴 말고 루트) */
export function routeCard(api: RouteStoryApi) {
  const r = st().route as RouteId;
  const gs = routeGoals(r);
  const n = gs.filter((g) => g.done).length;
  const g = gs.find((x) => !x.done) ?? gs[3];
  const done = routeDone(r);
  return { label: `갈림길 · ${ROUTES[r].name} ${n}/4`, title: done ? '엔딩 보기' : fill(g.title), em: done ? '눌러서 이야기의 끝으로' : g.text, done, go: () => (done ? playRouteEnding(api) : openGoals(api)) };
}
void $;
