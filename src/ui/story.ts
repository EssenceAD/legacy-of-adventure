// STORY_V1 화면: 막 컷(연출 fx) + 배너 · 3막 모모 편지 → 갈림길 고르기 · 은퇴 목표(장부 「갈림길」) · 유안 · 엔딩 컷 → 엔딩 카드 · 새 여관 열기 · 앨범 「이야기」·「기억」
import { CONFIG } from '../data/config';
import { diaryTick } from '../world/diary';
import { mythicEndLines, mythicTick } from '../world/mythic';
import { TRUE_AFTER, TRUE_HINTS, TRUE_LETTER, TRUE_STAR_LINES } from '../data/story/v3';
import { endsSeen, onPickRoute, routePreDone, routeTick, trueReady } from '../world/routes';
import { openGoals, routeCard, routeCardText, routeCut, editorVisit, type RouteStoryApi } from './routes';
import { PIONEER_CREDIT } from '../data/story/easter';
import { endCredits, saveChronThumb } from './chronicle';
import { clearOverlays } from './overlays';
import { nextRegionCut } from '../world/regions2';
import { showNewRegion } from './regions2';
import { track as trackEv } from '../net/telemetry';
import { MISSIONS } from '../data/guide';
import { ACT3_LETTER, ACT_CUTS, ENDINGS as STORY_END, HEIR_ARRIVE, LEGACY_GIFTS, MEMORIES, NEW_CYCLE_CONFIRM, ROUTES, type RouteId, type SLine } from '../data/story/v1';
import { PORTRAITS } from '../engine/assets';
import { getPref, setPref, writeSave } from '../save/save';
import { blankActor } from '../world/adventurers';
import { tour } from '../world/evalTour';
import { markDirty, P, S, world } from '../world/state';
import {
  actUp, cycleLines, fill, finishStory, nextAct, openingCycle, pickRoute, rethink, retireGoals, routeChoices, storyEndCount, storyHooks, storyLines, storyTick, storyWaitDay,
} from '../world/story';
import { doorOf, findKind, placing } from '../world/town';
import { onNightFlip } from '../world/clock';
import { $, $$, esc, fmt } from './common';
import { holdLine, isTalking, talkStory } from './dialogue';
import { iconSrc } from './kit';
import { capture } from './photo';
import { closeWin, isWinOpen, openWin, setWinLock, toast } from './windows';

// ───────── 대사 틀기 (연출 포함) ─────────

let fxEl: HTMLDivElement | null = null;
function fxBox(): HTMLDivElement {
  if (!fxEl || !fxEl.isConnected) {
    fxEl = document.createElement('div');
    fxEl.id = 'storyFx';
    document.getElementById('view')!.appendChild(fxEl);
  }
  return fxEl;
}
function fxClear() {
  fxEl?.remove();
  fxEl = null;
}
/** 연출 키: dawn · night · seasons · ledger · photo */
/** EASTER: 컷신 연출을 바깥에서 (drop = 개척자 장식이 「쿵」) */
export const storyFx = { drop: () => {} };
function fx(k: string) {
  const b = fxBox();
  if (k === 'night' || k === 'dawn') {
    b.className = k;
    b.innerHTML = '';
  } else if (k === 'seasons') {
    b.className = 'seasons';
    b.innerHTML = '<i class="sea"></i>';
  } else if (k === 'ledger') {
    b.className = (b.className.includes('night') ? 'night ' : '') + 'ledger';
    b.innerHTML = `<img class="ledg" src="${iconSrc('m_quest')}" alt="">`;
  } else if (k === 'photo' || k === 'photo_mine') photoThumb();
  else if (k === 'drop') storyFx.drop();
  // STORY v2·v3 연출: 심연 · 별 · 부케 · 기둥 · 노래 · 셔터 · 별바다 · 접힘 · 반짝 글씨
  else if (['abyss', 'stars', 'bouquet', 'pillar', 'song', 'shutter', 'starsea', 'fold', 'sparkle', 'heat', 'lighthouse', 'ember', 'sky', 'deep', 'hush'].includes(k)) {
    b.className = 'sfx-' + k;
    b.innerHTML = k === 'stars' || k === 'starsea' ? '<i class="st1"></i><i class="st2"></i><i class="st3"></i>' : k === 'bouquet' ? '<i class="bq">💐</i>' : k === 'song' ? '<i class="nt">♪</i><i class="nt n2">♫</i>' : '';
  }
}
/** 엔딩 사진: 사진 모드로 마을 한 장 → 앨범 썸네일 (이 기기에만) */
let lastThumb = '';
function photoThumb() {
  try {
    // PHOTO: 사진 모드 렌더(마을만 · 넓은 틀 · 이름 글씨)로 한 장
    const cv = capture('wide', true);
    if (!cv.width) return;
    const w = 240;
    const h = Math.round((cv.height / cv.width) * w);
    const t = document.createElement('canvas');
    t.width = w;
    t.height = h;
    const x = t.getContext('2d')!;
    x.imageSmoothingEnabled = true;
    x.drawImage(cv, 0, 0, w, h);
    lastThumb = t.toDataURL('image/jpeg', 0.75);
    fxBox().classList.add('flash');
  } catch {
    lastThumb = '';
  }
}
export function playStory(src: SLine[], done?: () => void) {
  // HOTFIX20 §1: 컷신 — 남은 오버레이 정리 (끊긴 제안은 대기열로)
  clearOverlays('story');
  // 유안 초상화 = 휴먼 기사 손님 초상화
  if (!PORTRAITS.yuan && PORTRAITS.g_knight_human) PORTRAITS.yuan = PORTRAITS.g_knight_human;
  // STORY v3: 안내서 편집장 = 마법사 손님 초상화 · 별지기 = 얼굴 없이 빛나는 실루엣
  if (!PORTRAITS.editor && PORTRAITS.g_mage_human) PORTRAITS.editor = PORTRAITS.g_mage_human;
  if (!PORTRAITS.star) PORTRAITS.star = starPortrait();
  const sl = storyLines(src);
  if (!sl.length) return done?.();
  talkStory(
    sl.map((x) => x.line),
    (i) => {
      const x = sl[i];
      if (x?.fx) fx(x.fx);
      if (x?.wait) holdLine(x.wait * 1000);
    },
    () => {
      fxClear();
      done?.();
    },
  );
}
/** STORY v2·v3: 루트 화면(ui/routes)에 넘겨주는 것 */
const api: RouteStoryApi = {
  play: (l, d) => playStory(l, d),
  openLetter: () => openLetter(),
  endRoute: (r, cut) => {
    lastThumb = '';
    // DIRECTION §2-2: 크레딧 줄(개척자 · 함께 만든 사람들)은 신화 대사 뒤로
    const k = cut.findIndex((l) => l[1] === PIONEER_CREDIT);
    const head = k >= 0 ? cut.slice(0, k) : cut.slice(0, -1);
    const tail = k >= 0 ? cut.slice(k) : cut.slice(-1);
    playStory([...head, ...mythicEndLines(), ...tail], () => {
      const res = finishStory(r);
      if (lastThumb) setPref('storyThumb.' + res.id, lastThumb);
      // DIRECTION §1-3: 연대기 쪽 사진
      saveChronThumb(lastThumb);
      const mem = res.mem >= 0 ? MEMORIES[res.mem] : null;
      const card = () => endingCard(res.id, res.pts, res.first, r);
      if (mem) playStory([['narr', `기억 조각을 얻었다 — ${mem.title}`], ...mem.lines], card);
      else card();
    });
  },
};
function banner(text: string) {
  const b = document.createElement('div');
  b.className = 'gradeban';
  b.innerHTML = `<small>이야기</small><b>${esc(text)}</b>`;
  document.getElementById('view')!.appendChild(b);
  setTimeout(() => b.remove(), 2600);
}

// ───────── 차례 (1초마다) ─────────

const queue: SLine[][] = [];
const busy = () =>
  !S.started || S.visiting || isTalking() || isWinOpen() || placing.pl || tour.on || !!document.getElementById('hunt') || !!document.getElementById('raid') || !!document.getElementById('cbCv') || !($('#settle') as HTMLElement).hidden ||
  // v0.25.8: 화면 보호·UI 끄기 동안엔 이야기 대사를 띄우지 않는다 (끝난 뒤 「다녀오셨어요」 카드 위로 겹치던 것)
  document.body.classList.contains('ssaver') || document.body.classList.contains('uihide');

export function initStoryUI() {
  storyHooks.say = (l) => queue.push(l);
  storyHooks.heir = () => queue.push(['__heir'] as never);
  // 3회차부터 어느 밤 모모가 (회차마다 한 번)
  onNightFlip((n) => {
    if (!n || !S.started || S.visiting || !P.story.act) return;
    const cy = cycleLines('nightIdle');
    if (cy) queue.push(cy);
  });
  // 디버그(DEV 전용): ?story=act3 · ?story=ending:retire · ?cycle=2
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    const sq = q.get('story');
    const cy = q.get('cycle');
    const iv = setInterval(() => {
      if (!S.started || !P.story.act) return;
      clearInterval(iv);
      if (cy) P.legacy.gen = Math.max(1, +cy || 1);
      if (sq === 'act3') {
        P.story.act = 2;
        playAct(3);
      } else if (sq === 'ending:retire') Object.assign(P.story, { act: 3, letter: 2, route: 'retire', heir: 1 });
    }, 500);
    Object.assign(window, {
      __story: {
        playAct, openLetter, playRetireEnding, newInn, queue,
        /** STORY v2·v3 시험용: 루트 목표 창 · 루트 엔딩 컷 */
        goals: openRouteGoals,
        letter: openLetter,
        cut: (r: string) => playStory(routeCut(r as RouteId as never)),
        /** 시험용: 장부 전부 완료 */
        ledgerAll: () => {
          for (const m of MISSIONS) if (!P.guide.claimed.includes(m.id)) P.guide.claimed.push(m.id);
          P.guide.idx = MISSIONS.length;
          P.guide.cut = 99;
        },
      },
    });
  }
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(5, (now - last) / 1000);
    last = now;
    if (document.hidden) return;
    const l = storyTick(dt) ?? routeTick() ?? mythicTick() ?? diaryTick();
    if (l) queue.push(l);
    if (busy()) return;
    // STORY v3: 마을 루트 앞 셋을 마치면 편집장이 찾아온다
    if (P.story.route === 'town' && !P.story.flags?.visit && routePreDone('town') && !queue.length) return editorVisit(api);
    syncYuan();
    const to = nextAct();
    if (to) return playAct(to);
    // REGIONS2: 흩어진 별 · 길잡이 별 · 심연의 바닥 · 모모 편지 (마을에서 한가할 때 하나씩)
    const rc = nextRegionCut();
    if (rc) {
      trackEv('region2_cut', { kind: rc.kind, id: rc.id });
      return playStory(rc.lines, () => {
        const nr = rc.done();
        if (nr) showNewRegion(nr);
      });
    }
    const q = queue.shift();
    if (!q) return;
    if ((q as unknown as string[])[0] === '__heir') return playStory(HEIR_ARRIVE, () => syncYuan());
    playStory(q);
  }, 1000);
}

function playAct(to: 2 | 3) {
  const cut = ACT_CUTS[to === 2 ? 'act2' : 'act3'];
  actUp(to);
  const pre = to === 3 ? cycleLines('act3') ?? [] : [];
  playStory([...pre, ...cut.lines], () => {
    banner(cut.banner);
    if (to === 3) setTimeout(() => (trueReady() && !P.story.seen.includes('trueLetter') ? (P.story.seen.push('trueLetter'), playStory(TRUE_LETTER, openLetter)) : openLetter()), 2700);
  });
}

// ───────── 3막: 모모의 편지 · 갈림길 ─────────

export function openLetter() {
  const L = ACT3_LETTER;
  openWin(
    '모모의 편지',
    `<div class="sletter"><b class="g">${esc(fill(L.title))}</b>${L.body.map((t) => `<p>${esc(fill(t))}</p>`).join('')}<p class="ask">${esc(fill(L.ask))}</p></div>
    <button class="bigbtn" id="sPick">고르기</button>`,
    'storyw',
  );
  $('#sPick').onclick = () => openRoutes();
}
function openRoutes() {
  ROUTES.true.open = trueReady();
  const ch = routeChoices().filter((c) => c.id !== 'true' || trueReady());
  ch.sort((a, b) => Number(b.id === 'true') - Number(a.id === 'true'));
  openWin(
    '갈림길',
    `<p class="sub">${esc(fill(ACT3_LETTER.ask))}</p>
    <div class="steps">${ch
      .map((c) => {
        const r = ROUTES[c.id];
        return `<button class="stp sroute ${c.open ? '' : 'lock'}" data-route="${c.id}"><span><b>${esc(r.pick)}</b><small>${c.open ? `「${esc(r.name)}」` : `🔒 다음 업데이트 · ${esc(r.teaser)}`}</small>${c.top ? '<small class="good">✨ 지금 마음에 가장 가까워요</small>' : ''}</span><em>${c.open ? '›' : ''}</em></button>`;
      })
      .join('')}</div>`,
    'storyw',
  );
  $$('[data-route]').forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.route as RouteId;
        const err = pickRoute(id);
        if (err) return toast(err);
        onPickRoute(id);
        closeWin();
        const pre = cycleLines('routePick') ?? [];
        playStory([...pre, ...(ROUTES[id].pickLines ?? [])], () => {
          toast(`장부에 「갈림길」 장이 생겼어요 · ${ROUTES[id].name}`);
          markDirty();
        });
      }),
  );
}
/** 장부 「갈림길」 장: 은퇴 목표 넷 */
export function openRouteGoals() {
  if (P.story.route && P.story.route !== 'retire') return openGoals(api);
  const gs = retireGoals();
  const s = P.story;
  openWin(
    `갈림길 · ${ROUTES.retire.name}`,
    `<div class="steps">${gs.map((g) => `<div class="stp ${g.done ? 'done' : ''}"><span><b>${g.done ? '✓ ' : ''}${esc(g.title)}</b><small>${esc(g.text)}</small></span></div>`).join('')}</div>
    ${s.heir === 1 ? '<button class="bigbtn" id="sYuan">유안에게 말 걸기</button>' : ''}
    ${s.act >= 3 && !s.changed && s.heir === 0 ? '<button class="bigbtn ghost" id="sRe">모모에게 「다시 생각해 볼게」</button>' : ''}`,
    'storyw',
  );
  const y = document.getElementById('sYuan');
  if (y) y.onclick = () => (closeWin(), playRetireEnding());
  const r = document.getElementById('sRe');
  if (r)
    r.onclick = () => {
      if (!confirm('다시 고르면 이번 3막에서는 더 바꿀 수 없어요. 다시 생각해 볼까요?')) return;
      if (rethink()) openLetter();
    };
}

/** 장부 카드 (장부를 다 마친 뒤): 편지 · 갈림길 목표 — null이면 성장 목표 카드 */
export function storyCard(): { label: string; title: string; em: string; done: boolean; go: () => void } | null {
  const s = P.story;
  if (!s.act || S.visiting) return null;
  if (s.letter === 1) return { label: '모모의 편지', title: fill(ACT3_LETTER.title), em: '눌러서 답하기', done: true, go: openLetter };
  if (s.route && s.route !== 'retire' && s.heir < 2) return routeCard(api);
  if (s.route === 'retire' && s.heir < 2) {
    const gs = retireGoals();
    const n = gs.filter((g) => g.done).length;
    const g = gs.find((x) => !x.done) ?? gs[3];
    return { label: `갈림길 · ${ROUTES.retire.name} ${n}/4`, title: g.title, em: g.text, done: s.heir === 1, go: s.heir === 1 ? playRetireEnding : openRouteGoals };
  }
  return null;
}
/** 장부 카드 작은 글씨 뒤: 「🌙 ○일차에 다음 이야기」 */
export function storyWaitNote(): string {
  const d = storyWaitDay();
  return d ? ` · 🌙 ${d}일차에 다음 이야기` : '';
}

// ───────── 후계자 유안 ─────────

function syncYuan() {
  const want = P.story.heir === 1 && !S.visiting;
  const has = world.actors.find((a) => a.role === 'yuan');
  if (want && !has) {
    const inn = findKind('inn');
    if (!inn) return;
    const [dx, dy] = doorOf(inn);
    const a = blankActor('knight', '유안', dx - 0.8, dy + 0.6, 'yuan');
    a.race = 'human';
    world.actors.push(a);
  } else if (!want && has) world.actors = world.actors.filter((a) => a.role !== 'yuan');
}
/** 마을에서 유안을 누르면 */
export function tapYuan() {
  if (P.story.heir === 1) playRetireEnding();
}

// ───────── 엔딩 「조용한 은퇴」 ─────────

export function playRetireEnding() {
  if (P.story.heir !== 1 || isTalking()) return;
  closeWin();
  lastThumb = '';
  playStory([...STORY_END.retire.cut, ...mythicEndLines(), ...endCredits()], () => {
    const r = finishStory('retire');
    if (lastThumb) setPref('storyThumb.' + r.id, lastThumb);
    saveChronThumb(lastThumb);
    syncYuan();
    const mem = r.mem >= 0 ? MEMORIES[r.mem] : null;
    const card = () => endingCard(r.id, r.pts, r.first);
    if (mem) playStory([['narr', `기억 조각을 얻었다 — ${mem.title}`], ...mem.lines], card);
    else card();
  });
}
const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`);
function endingCard(id: string, pts: number, first: boolean, route: RouteId = 'retire') {
  const c = P.legacy.cards[id];
  const thumb = getPref<string>('storyThumb.' + id, '');
  openWin(
    '엔딩',
    `<div class="sendc">${thumb ? `<img class="sthumb" src="${thumb}" alt="">` : ''}<small>엔딩 ${storyEndCount()}/6</small><b>${esc(ROUTES[route].name)}</b><p>${esc(fill(route === 'retire' ? STORY_END.retire.card : routeCardText(route)))}</p></div>
    <div class="acc"><div>플레이 시간<b>${hm(c?.playMin ?? 0)}</b></div><div>운영 일수<b>${c?.day ?? 0}일</b></div><div>단골<b>${c?.regulars ?? 0}명</b></div><div>가장 친했던 단골<b>${esc(c?.fav ?? '—')}</b></div>
    <div>얻은 유산 포인트<b class="g">+${pts}${first ? ' (처음 본 엔딩 +' + CONFIG.story.legacyFirst + ')' : ''}</b></div><div>모은 유산 포인트<b>${fmt(P.legacy.pts)}</b></div></div>
    <div class="btnrow" id="sEndBtns"><button class="bigbtn" id="sAlbum">엔딩 앨범에 담기</button></div>`,
    'endw',
  );
  setWinLock(true);
  $('#sAlbum').onclick = () => {
    toast(`엔딩 앨범에 담았어요 (${storyEndCount()}/6)`);
    $('#sEndBtns').innerHTML = '<button class="bigbtn" id="sNew">새 여관 열기</button><button class="bigbtn ghost" id="sStay">이 마을에 조금 더 머물기</button>';
    $('#sNew').onclick = () => {
      setWinLock(false);
      newInn();
    };
    $('#sStay').onclick = () => {
      setWinLock(false);
      closeWin();
      toast('이 마을에 조금 더 머물러요 · 주인 정보에서 언제든 「새 여관 열기」');
    };
  };
}

// ───────── 새 여관 열기 (= 유산을 잇는다) ─────────

/** 모모의 확인 → 확인 창 → 유산 화면(새 주인 · 시작 선물). legacyCreate는 ui/owner가 채운다 */
export const storyUi = { legacyCreate: () => {} };
export function newInn() {
  closeWin();
  playStory(NEW_CYCLE_CONFIRM, () => {
    openWin(
      '새 여관 열기',
      `<p class="sub">지금 마을·건물·영웅·도감·엔딩 앨범은 그대로 이어지고, 새 주인으로 다시 시작해요.</p>
      <p class="note">주인 능력치·인연·불씨·달력과 이번 이야기(막·갈림길)는 처음부터예요. 지금 저장은 따로 백업해 둬요.</p>
      <div class="btnrow"><button class="bigbtn" id="sNewOk">계속</button><button class="bigbtn ghost" id="sNewNo">그만두기</button></div>`,
      'storyw',
    );
    $('#sNewOk').onclick = () => storyUi.legacyCreate();
    $('#sNewNo').onclick = () => closeWin();
  });
}
/** 회차 저장 백업 (save.bak.cycleN) */
export function backupCycle() {
  try {
    writeSave();
    const raw = localStorage.getItem(CONFIG.save.key);
    if (raw) localStorage.setItem(`${CONFIG.save.key}.bak.cycle${P.legacy.gen}`, raw);
  } catch {
    /* 공간이 모자라면 백업 없이 */
  }
}
/** 유산 화면의 시작 선물 칸 (포인트로 고르기) */
export function giftsHtml(sel: Set<string>): string {
  const L = P.legacy;
  const used = LEGACY_GIFTS.filter((g) => sel.has(g.id)).reduce((s, g) => s + g.cost, 0);
  const fav = L.prevFav?.name ?? '';
  return `<div class="crow col"><span>시작 선물 <small class="g">유산 포인트 ${fmt(L.pts - used)}/${fmt(L.pts)}</small></span><div class="sgifts">${LEGACY_GIFTS.map((g) => {
    const on = sel.has(g.id);
    const can = on || L.pts - used >= g.cost;
    const off = g.id === 'fav' && !fav;
    return `<button class="sgift ${on ? 'on' : ''}" data-gift="${g.id}" ${(!can || off) && !on ? 'disabled' : ''}><b>${esc(g.name)} · ${g.cost}</b><small>${esc(g.desc.replace('{fav}', fav || '단골'))}${off ? ' (없음)' : ''}</small></button>`;
  }).join('')}</div></div>${memoryRow()}`;
}
function memoryRow(): string {
  const n = Math.min(P.legacy.mem || 0, MEMORIES.length);
  if (!n) return '';
  return `<p class="note">기억 조각 ${n}/${MEMORIES.length} · 가장 최근: 「${esc(MEMORIES[n - 1].title)}」 <button class="sm" id="sMemLast">읽기</button></p>`;
}
export function bindMemoryRow() {
  const b = document.getElementById('sMemLast');
  if (b) b.onclick = () => readMemory(Math.min(P.legacy.mem, MEMORIES.length) - 1, false);
}
/** 회차 시작 컷: 2회차부터 버나드의 기억 대사 · 모모 · 옛 단골 (오프닝 앞부분 자리) */
export function playCycleOpening(gifts: string[], done: () => void) {
  // STORY v3: 진 엔딩을 본 뒤 첫 회차엔 TRUE_AFTER 한 번 (OPENING_CYCLE 대신)
  const after = P.legacy.album.includes('story_true') && !P.legacy.trueAfterSeen;
  if (after) P.legacy.trueAfterSeen = true;
  const lines: SLine[] = [...(after ? TRUE_AFTER : openingCycle()), ...(cycleLines('momoFirstTalk') ?? []), ...(gifts.includes('fav') ? cycleLines('prevFavArrive') ?? [] : [])];
  playStory(lines, done);
}

// ───────── 앨범 「이야기」 · 「기억」 ─────────

const SLOTS: RouteId[] = ['retire', 'hero', 'legend', 'town', 'love'];
export function storyAlbumHtml(): string {
  const cells = SLOTS.map((r) => {
    const id = 'story_' + r;
    const c = P.legacy.cards[id];
    if (P.legacy.album.includes(id) && c) {
      const th = getPref<string>('storyThumb.' + id, '');
      return `<button class="acell seen" data-se="${id}"><div class="ecard t-story">${th ? `<img class="sthumb" src="${th}" alt="">` : ''}<b>${esc(ROUTES[r].name)}</b><small>${c.gen}회차 · ${new Date(c.at).toLocaleDateString('ko-KR')} · 다시 보기</small></div></button>`;
    }
    return `<div class="acell"><span class="silh">?</span><small>${esc(ROUTES[r].hint)}</small></div>`;
  });
  // STORY v3: 진 엔딩 칸 — 보기 전엔 본 엔딩 수에 따라 힌트
  if (P.legacy.album.includes('story_true') && P.legacy.cards.story_true) cells.push(`<button class="acell seen" data-se="story_true"><div class="ecard t-story"><b>${esc(ROUTES.true.name)}</b><small>다시 보기</small></div></button>`);
  else {
    const n = endsSeen();
    cells.push(`<div class="acell"><span class="silh">?</span><small>${esc(TRUE_HINTS[n <= 1 ? 0 : n <= 3 ? 1 : n === 4 ? 2 : 3])}</small></div>`);
  }
  const n = Math.min(P.legacy.mem || 0, MEMORIES.length);
  const mems = MEMORIES.map((m, i) => (i < n ? `<button class="stp" data-mem="${i}"><span><b>${esc(m.title)}</b></span><em>›</em></button>` : `<div class="stp lock"><span><b>???</b><small>엔딩을 보면 하나씩</small></span></div>`)).join('');
  return `<div class="qhd"><b class="g">이야기</b><span class="note">${storyEndCount()}/6</span></div><div class="album">${cells.join('')}</div>
    <div class="qhd"><b class="g">기억</b><span class="note">${n}/${MEMORIES.length}</span></div><div class="steps">${mems}</div>`;
}
export function bindStoryAlbum(back: () => void) {
  $$('[data-se]').forEach(
    (b) =>
      (b.onclick = () => {
        closeWin();
        const r = (b.dataset.se ?? 'story_retire').slice(6) as RouteId;
        playStory(r === 'retire' ? [...STORY_END.retire.cut, ...endCredits()] : routeCut(r), back);
      }),
  );
  $$('[data-mem]').forEach((b) => (b.onclick = () => readMemory(+b.dataset.mem!, true, back)));
}
function readMemory(i: number, fromAlbum: boolean, back?: () => void) {
  const m = MEMORIES[i];
  if (!m) return;
  closeWin();
  playStory([['narr', m.title], ...m.lines], fromAlbum ? back : undefined);
}

/** STORY v3: 진 엔딩 뒤 별똥별을 잡을 때 모모 혼잣말 (하루 한 번) */
export function trueStarLine(): SLine[] | null {
  if (!P.legacy.album.includes('story_true')) return null;
  const k = 'trueStar:' + S.day;
  if (P.story.seen.includes(k)) return null;
  P.story.seen.push(k);
  return [TRUE_STAR_LINES[Math.floor(Math.random() * TRUE_STAR_LINES.length)]];
}

/** 별지기 초상화: 얼굴 없이 빛나는 실루엣 (머리·어깨) + 둘레 빛 · 반짝이 */
function starPortrait(): string {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0c0a1e';
  g.fillRect(0, 0, 64, 64);
  const r = g.createRadialGradient(32, 30, 4, 32, 30, 34);
  r.addColorStop(0, 'rgba(255,240,180,0.55)');
  r.addColorStop(1, 'rgba(255,240,180,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  // 얼굴 없는 실루엣: 머리 + 어깨, 금빛으로 번지게
  g.shadowColor = '#ffd36b';
  g.shadowBlur = 10;
  g.fillStyle = '#fff3c0';
  g.beginPath();
  g.arc(32, 25, 9, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(32, 60, 21, 20, 0, Math.PI, 0);
  g.fill();
  g.shadowBlur = 0;
  for (let i = 0; i < 14; i++) {
    g.fillStyle = i % 3 ? '#ffd36b' : '#ffffff';
    g.fillRect((Math.random() * 64) | 0, (Math.random() * 64) | 0, 1, 1);
  }
  return c.toDataURL();
}
