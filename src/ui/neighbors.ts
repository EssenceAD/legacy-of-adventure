// 이웃 마을: 실제 유저 마을(villages.snapshot) + 예시 마을. 그릴 때 핫픽스 4 배치 검사(placeLayout)를 그대로 거친다.
import type { Kind } from '../data/catalog';
import { mythicHeart } from '../world/mythic';
import { CATALOG } from '../data/catalog';
import { NEIGHBORS, type Neighbor } from '../data/neighbors';
import * as game from '../game';
import { PORTRAITS } from '../engine/assets';
import { getVillage, likeVillage, listVillages, myVillage, online, pioneerOfUid, pioneers, sb, searchVillages, suggestVillages, type VillageRow } from '../net/server';
import { weeklyPopular, type PopRow } from '../net/guestbook';
import { flag } from '../world/flags';
import { CONFIG } from '../data/config';
import { bigMapShift } from '../save/save';
import { S } from '../world/state';
import { cleanPetIds } from '../world/pets';
import { $$, bindTabs, esc, fmt, tabs } from './common';
import { gbHasNew, gbOn, lastTopHtml, loadGuestbook, pollGuestbook } from './guestbook';
import { isWinOpen, openWin, toast } from './windows';
import { portSrc } from './outfitPort';
import { isOutfitId } from '../data/outfits';
import { outfitsOn } from '../world/outfits';

/** 서버 마을 모습 → 이웃 (모양이 이상하면 null — 화면은 안 깨지게) */
export function toNeighbor(r: VillageRow): Neighbor | null {
  const s = r.snapshot as { v?: number; land?: number; innName?: string; owner?: string; layout?: unknown[]; repHero?: string | null; grade?: number };
  if (!s || !Array.isArray(s.layout)) return null;
  const layout = s.layout
    .filter((e): e is unknown[] => Array.isArray(e) && typeof e[0] === 'string' && (e[0] as string) in CATALOG)
    .map((e) => [e[0] as Kind, Number(e[1]), Number(e[2]), Number(e[3]) || 1, typeof e[4] === 'number' ? e[4] : null, !!e[5]] as Neighbor['layout'][number]);
  if (!layout.some((e) => e[0] === 'inn')) return null;
  // 땅 개편 전(v1, 맵 14) 마을: 내 저장과 같은 규칙으로 좌표를 옮긴다
  // LAND2: v1(맵 14) → v7 옮김 + 8 · v2(맵 24) → +8
  // LAND10: v1·v2 → (위) + 12 · v3(맵 32) → +12 · v4(맵 44) 그대로
  const ver = s.v ?? 1;
  const k = ver < 4 ? (ver < 3 ? (ver < 2 ? bigMapShift(Number(s.land) || 1) : 0) + CONFIG.v7.shift : 0) + CONFIG.v8.shift : 0;
  if (k) {
    for (const e of layout) {
      e[1] += k;
      e[2] += k;
    }
  }
  return {
    id: 'u:' + r.user_id,
    uid: r.user_id,
    name: (s.innName || '이름 없는 여관').slice(0, 12),
    // GUEST_SPEC §2: 주인 이름이 없으면(게스트) 「○○ 여관 주인」
    owner: (s.owner || '').slice(0, 8),
    land: Math.max(1, Math.min(CONFIG.land.length, Math.floor(Number(s.land) || 1))),
    like: r.likes ?? 0,
    repHero: s.repHero ?? null,
    // LUXE §1-3: 그 마을 대표 영웅이 입은 의상 (모르는 id면 기본 옷)
    repOutfit: isOutfitId((s as { repOutfit?: unknown }).repOutfit) ? ((s as { repOutfit: string }).repOutfit) : null,
    grade: Math.max(0, Math.min(4, Math.floor(Number(s.grade) || 0))),
    title: typeof (s as { title?: unknown }).title === 'string' ? ((s as { title: string }).title).slice(0, 12) : '',
    layout,
    // FEEDBACK23 §5: 옮긴 입구 (v3부터만 · 숫자가 아니면 자동)
    // LAND10: v3 입구는 맵 32 좌표 → +12 (layout과 같은 만큼)
    ...(ver >= 3 && Number.isFinite((s as { ent?: unknown }).ent) ? { ent: Math.round(Number((s as { ent: number }).ent)) + (ver < 4 ? CONFIG.v8.shift : 0) } : {}),
    // LUXE §2: 꺼내 둔 펫 (아는 id · 3개까지 · 없으면 빼기)
    ...(cleanPetIds((s as { pets?: unknown }).pets).length ? { pets: cleanPetIds((s as { pets?: unknown }).pets) } : {}),
  };
}

/** LUXE §1-3: 대표 영웅 초상화 (그 마을이 입힌 의상 색 · outfits 꺼짐이면 원래 그림) */
const repPort = (v: Neighbor) => portSrc(v.repHero, outfitsOn() ? (v.repOutfit ?? null) : null);

let real: Neighbor[] = [];
let mineRow: Neighbor | null = null;
let more = false;
/** LUXE §4: 「🏆 지난주 인기 마을」 줄 (guestbook 끔·서버 준비 전이면 '') */
let topRow = '';
let page = CONFIG.cloud.neighborPage;
/** 「주인 ○○」 · 이름이 없으면 「○○ 여관 주인」 */
export const ownerLine = (v: Neighbor) => (v.owner ? `주인 ${v.owner}` : `${v.name} 주인`);

/** LUXE §4: 이웃 창 탭 (0 이웃 여관 · 1 방명록) — guestbook 켰을 때만 탭이 보인다 */
let nbTab = 0;
const NB_TABS = ['이웃 여관', '방명록'];
const tabBar = (i: number) => (gbOn() && sb ? tabs(NB_TABS, i, 'nbT') : '');
function bindNbTabs() {
  if (!gbOn() || !sb) return;
  bindTabs('nbT', (k) => void openVillage(k));
  // 새 좋아요 → 「방명록」 탭에 빨간 점 (redDots 규칙: 받을 것이 있는 곳에만)
  document.querySelector<HTMLElement>('#nbT .tab[data-t="1"]')?.classList.toggle('rdot', gbHasNew());
}

export async function openVillage(tab = 0) {
  if (S.visiting) {
    game.goHome();
    return;
  }
  nbTab = gbOn() && sb ? tab : 0;
  if (nbTab === 1) {
    let n = 0;
    const draw = (html: string) => {
      // 불러오는 사이 창을 닫았거나 다른 창·탭으로 갔으면 다시 열지 않는다
      if (n++ > 0 && (nbTab !== 1 || !isWinOpen() || S.visiting || document.getElementById('winT')?.textContent !== '마을 · 이웃 여관')) return;
      openWin('마을 · 이웃 여관', tabBar(1) + html);
      bindNbTabs();
    };
    await loadGuestbook(draw, (u) => void visitUser(u));
    return;
  }
  if (flag('nbTabs')) return openNbTabs();
  const liked = game.likedSet();
  const fakeRows = NEIGHBORS.map(
    (v, i) => `<button class="stp" data-f="${i}"><span style="grid-column:1/3"><b>${v.name}</b><small>예시 마을 · 주인 ${v.owner} · 땅 ${v.land}단계</small></span>${gbOn() ? '' : `<em>♥ ${fmt(v.like + (liked.has(v.id) ? 1 : 0))}</em>`}</button>`, // LUXE §4 (형철): 방명록이 켜지면 예시 마을엔 ♥ 수를 안 보인다 (가짜 숫자)
  ).join('');
  const draw = (loading: boolean) => {
    // GUEST_SPEC §2: 내 여관을 맨 위에 고정 (♥ 확인용 · 누르면 아무 일 없음)
    const mineRowHtml = mineRow ? `<div class="stp real mine"><img src="${(mineRow.repHero && repPort(mineRow)) || PORTRAITS.hero || ''}" alt=""><span><b>내 여관 · ${esc(mineRow.name)}</b><small>이웃들이 보는 내 마을</small></span><em>♥ ${fmt(mineRow.like)}</em></div>` : '';
    const realRows = real
      .map(
        (v, i) =>
          `<button class="stp real${v.uid && pioneerOfUid(v.uid) ? ' pioneer' : ''}" data-r="${i}" data-u="${esc(v.uid ?? '')}"><img src="${(v.repHero && repPort(v)) || PORTRAITS.hero || ''}" alt=""><span><b>${esc(v.name)}</b><small>${esc(ownerLine(v))} · 땅 ${v.land}단계</small></span><em>♥ ${fmt(v.like)}</em></button>`,
      )
      .join('');
    openWin(
      '마을 · 이웃 여관',
      `${tabBar(0)}<p class="sub">다른 여관주인의 마을을 구경하고 좋아요를 남겨요${online() ? ' (마을마다 하루 한 번)' : ' · 로그인하면 좋아요가 서버에 남아요'}</p>
      ${sb ? `<p class="sub g">실제 여관 <small>최근 ${CONFIG.cloud.neighborDays}일 · ♥ 많은 순</small></p><div class="steps">${topRow}${mineRowHtml}${loading ? '<p class="note">불러오는 중…</p>' : realRows || '<p class="note">아직 다른 여관이 없어요</p>'}${more && !loading ? '<button class="bigbtn sm ghost" id="nbMore">더 보기</button>' : ''}</div>` : ''}
      <p class="sub g">예시 마을</p><div class="steps">${fakeRows}</div>`,
    );
    bindNbTabs();
    const tb = document.querySelector<HTMLElement>('[data-gbtop]');
    if (tb) tb.onclick = () => void visitUser(tb.dataset.gbtop!);
    game.setVisitList([...real, ...NEIGHBORS]);
    $$('.stp[data-f]').forEach((b) => (b.onclick = () => game.visit(NEIGHBORS[+b.dataset.f!])));
    $$('.stp[data-r]').forEach((b) => (b.onclick = () => game.visit(real[+b.dataset.r!])));
    const mb = document.getElementById('nbMore');
    if (mb) mb.onclick = () => void load(page + CONFIG.cloud.neighborPage);
  };
  const load = async (n: number) => {
    page = n;
    // LUXE §4: 방명록 새 좋아요(탭 빨간 점) — pollMin분에 한 번만 실제로 묻는다
    const [rows, mine, , top] = await Promise.all([listVillages(n), myVillage(), pioneers(), lastTopHtml(), gbOn() ? pollGuestbook() : null]);
    topRow = top;
    more = rows.length > n;
    real = rows.slice(0, n).map(toNeighbor).filter((x): x is Neighbor => !!x);
    mineRow = mine ? toNeighbor(mine) : null;
    // 불러오는 사이 창을 닫았거나(이웃 방문·다른 창) 방문 중이면 다시 열지 않는다 — 닫힌 창도 제목(#winT)은 남아 있어서 예전엔 늦게 온 응답이 목록 창을 다시 띄웠다 (돌아온 마을에서 끊긴 단골 제안이 막힘)
    if (nbTab === 0 && isWinOpen() && !S.visiting && document.getElementById('winT')?.textContent === '마을 · 이웃 여관') draw(false);
  };
  draw(!!sb);
  if (!sb) return;
  await load(CONFIG.cloud.neighborPage);
}

// ───────── SOCIAL_SPEC §1 (nbTabs): 이웃 목록 4탭 — ⭐ 각별한 이웃 · 추천 8곳 · 인기 10 · 찾기 ─────────
//  예전: 최근 7일 · ♥순 30곳 + 더 보기 → 유저가 늘면 끝없는 스크롤. 지금: 한 화면에 8~10곳 · 무한 스크롤 없음 · 내 여관 줄은 맨 위

type NbSub = 'friend' | 'sug' | 'pop' | 'find';
const NB_SUBS: [NbSub, string][] = [['friend', '⭐ 각별한 이웃'], ['sug', '추천'], ['pop', '인기'], ['find', '찾기']];
const WIN_T = '마을 · 이웃 여관';
let nbSub: NbSub = 'sug';
/** 지금 탭에 보이는 실제 마을 (방문 다음/이전 목록) */
let shown: Neighbor[] = [];
/** 「다른 여관 보기 ↻」로 이미 보여 준 곳 (다음 8곳에서 빼기 · 다 돌면 처음부터) */
let seen: string[] = [];
let sugCache: Neighbor[] | null = null;
let findQ = '';
let findRows: Neighbor[] | null = null;
let popRows: PopRow[] | null = null;
let popMe: { rank: number; likes: number } | null = null;
const stillHere = () => nbTab === 0 && isWinOpen() && !S.visiting && document.getElementById('winT')?.textContent === WIN_T;

const villageRow = (v: Neighbor, i: number) =>
  `<button class="stp real${v.uid && pioneerOfUid(v.uid) ? ' pioneer' : ''}" data-r="${i}" data-u="${esc(v.uid ?? '')}"><img src="${(v.repHero && repPort(v)) || PORTRAITS.hero || ''}" alt=""><span><b>${esc(v.name)}</b><small>${esc(ownerLine(v))} · 땅 ${v.land}단계</small></span><em>♥ ${fmt(v.like)}</em></button>`;
const mineHtml = () =>
  mineRow ? `<div class="stp real mine"><img src="${(mineRow.repHero && repPort(mineRow)) || PORTRAITS.hero || ''}" alt=""><span><b>내 여관 · ${esc(mineRow.name)}</b><small>이웃들이 보는 내 마을</small></span><em>♥ ${fmt(mineRow.like)}</em></div>` : '';
const exampleHtml = () =>
  `<details class="nbex"><summary>예시 마을 ${NEIGHBORS.length}곳 <small>(아직 이웃이 적어서 보여 드려요)</small></summary><div class="steps">${NEIGHBORS.map((v, i) => `<button class="stp" data-f="${i}"><span style="grid-column:1/3"><b>${v.name}</b><small>예시 마을 · 주인 ${v.owner} · 땅 ${v.land}단계</small></span></button>`).join('')}</div></details>`;

function subBody(loading: boolean): string {
  if (!sb) return `<p class="note">서버에 연결하지 못해 예시 마을만 보여요</p>${exampleHtml()}`;
  if (nbSub === 'friend')
    return `<p class="note">⭐ <b>각별한 이웃</b>은 곧 열려요 — 서로 맺으면 친구 마을에 들러 공사를 거들고 선물을 주고받을 수 있어요${online() ? '' : '<br>로그인하면 각별한 이웃을 맺을 수 있어요'}</p>`;
  if (nbSub === 'sug') {
    if (loading && !sugCache) return '<p class="note">불러오는 중…</p>';
    const rows = sugCache ?? [];
    return `<p class="sub g">추천 여관 <small>요즘 들르는 · 비슷한 땅 · 새로 온 여관</small></p><div class="steps">${rows.length ? rows.map(villageRow).join('') : '<p class="note">아직 다른 여관이 없어요</p>'}</div>
      <button class="bigbtn sm ghost" id="nbAgain" ${loading ? 'disabled' : ''}>↻ 다른 여관 보기</button>${rows.length < CONFIG.social.exampleUnder ? exampleHtml() : ''}`;
  }
  if (nbSub === 'pop') {
    if (loading && !popRows) return '<p class="note">불러오는 중…</p>';
    const rows = popRows ?? [];
    const meLine = popMe ? `<p class="note">내 여관: 이번 주 ${popMe.rank ? `${popMe.rank}위 · ` : ''}♥ ${fmt(popMe.likes)}</p>` : '';
    return `${topRow}<p class="sub g">이번 주 인기 <small>♥ 많은 순 ${CONFIG.social.popTop}곳</small></p><div class="steps">${
      rows.length
        ? rows.map((r, i) => `<button class="stp real" data-p="${i}"><img src="${portSrc(r.rep_hero, null) || PORTRAITS.hero || ''}" alt=""><span><b>${r.rank}. ${esc(r.inn_name)}</b><small>${r.nickname ? `주인 ${esc(r.nickname)}` : `${esc(r.inn_name)} 주인`}</small></span><em>♥ ${fmt(r.likes)}</em></button>`).join('')
        : '<p class="note">이번 주엔 아직 좋아요를 받은 여관이 없어요</p>'
    }</div>${meLine}`;
  }
  // 찾기
  const res = findRows == null ? '' : findRows.length ? `<div class="steps">${findRows.map(villageRow).join('')}</div>` : `<p class="note">「${esc(findQ)}」${josaRo(findQ)} 찾은 여관이 없어요</p>`;
  return `<form class="nbfind" id="nbFind"><input id="nbQ" value="${esc(findQ)}" placeholder="여관 이름·닉네임 (2글자 이상)" autocomplete="off" enterkeyhint="search" maxlength="20"><button class="bigbtn sm" ${loading ? 'disabled' : ''}>찾기</button></form>${loading ? '<p class="note">찾는 중…</p>' : res}`;
}
const josaRo = (w: string) => {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '로';
  const j = (c - 0xac00) % 28;
  return j && j !== 8 ? '으로' : '로';
};

function drawNb(loading = false) {
  const subs = `<div class="tabs sm nbsub" id="nbS">${NB_SUBS.map(([k, n]) => `<button class="tab ${k === nbSub ? 'on' : ''}" data-ns="${k}">${n}</button>`).join('')}</div>`;
  openWin(WIN_T, `${tabBar(0)}${subs}<div class="steps nbmine">${mineHtml()}</div>${subBody(loading)}`);
  bindNbTabs();
  shown = nbSub === 'sug' ? (sugCache ?? []) : nbSub === 'find' ? (findRows ?? []) : [];
  game.setVisitList([...shown, ...NEIGHBORS]);
  $$('#nbS [data-ns]').forEach((b) => (b.onclick = () => void switchSub(b.dataset.ns as NbSub)));
  $$('.stp[data-f]').forEach((b) => (b.onclick = () => game.visit(NEIGHBORS[+b.dataset.f!])));
  $$('.stp[data-r]').forEach((b) => (b.onclick = () => game.visit(shown[+b.dataset.r!])));
  $$('.stp[data-p]').forEach((b) => (b.onclick = () => void visitUser(popRows![+b.dataset.p!].user_id)));
  const tb = document.querySelector<HTMLElement>('[data-gbtop]');
  if (tb) tb.onclick = () => void visitUser(tb.dataset.gbtop!);
  const again = document.getElementById('nbAgain');
  if (again) again.onclick = () => void loadSug(true);
  const f = document.getElementById('nbFind') as HTMLFormElement | null;
  if (f)
    f.onsubmit = (e) => {
      e.preventDefault();
      void runFind((document.getElementById('nbQ') as HTMLInputElement).value);
    };
  if (nbSub === 'find' && !loading && findRows == null) (document.getElementById('nbQ') as HTMLInputElement | null)?.focus();
}

async function loadSug(next: boolean) {
  if (next) seen = [...new Set([...seen, ...(sugCache ?? []).map((v) => v.uid!).filter(Boolean)])].slice(-CONFIG.social.seenMax);
  drawNb(true);
  let rows = await suggestVillages(CONFIG.social.suggestN, seen);
  // 다 돌았으면 처음부터
  if (next && !rows.length && seen.length) {
    seen = [];
    rows = await suggestVillages(CONFIG.social.suggestN, []);
  }
  sugCache = rows.map(toNeighbor).filter((x): x is Neighbor => !!x);
  if (stillHere() && nbSub === 'sug') drawNb(false);
}
async function loadPop() {
  drawNb(true);
  const [board, top] = await Promise.all([weeklyPopular(CONFIG.social.popTop), lastTopHtml()]);
  topRow = top;
  if (board) {
    popRows = board.rows.slice(0, CONFIG.social.popTop);
    popMe = board.me;
  } else {
    // 방명록 서버가 아직 없으면 ♥ 누적 순 (예전 목록)
    const rows = (await listVillages(CONFIG.social.popTop)).slice(0, CONFIG.social.popTop);
    popRows = rows.map((r, i) => {
      const v = toNeighbor(r);
      return { rank: i + 1, user_id: r.user_id, nickname: v?.owner ?? '', inn_name: v?.name ?? '이름 없는 여관', rep_hero: v?.repHero ?? null, likes: r.likes ?? 0 };
    });
    popMe = null;
  }
  if (stillHere() && nbSub === 'pop') drawNb(false);
}
async function runFind(q: string) {
  findQ = q.trim().slice(0, 20);
  if ([...findQ].length < 2) {
    toast('두 글자 이상 적어 주세요');
    return;
  }
  drawNb(true);
  const rows = await searchVillages(findQ);
  findRows = rows.map(toNeighbor).filter((x): x is Neighbor => !!x);
  if (stillHere() && nbSub === 'find') drawNb(false);
}
async function switchSub(k: NbSub) {
  nbSub = k;
  try {
    localStorage.setItem('legacy-of-adventure-nbSub', k);
  } catch {
    /* 기억 못 해도 괜찮다 */
  }
  if (k === 'sug' && !sugCache) return loadSug(false);
  if (k === 'pop') return loadPop();
  drawNb(false);
}

async function openNbTabs() {
  try {
    const k = localStorage.getItem('legacy-of-adventure-nbSub') as NbSub | null;
    // 각별한 이웃(P2 friends)이 아직이면 추천부터
    if (k && NB_SUBS.some(([x]) => x === k) && k !== 'friend') nbSub = k;
  } catch {
    /* 기본 = 추천 */
  }
  sugCache = null;
  drawNb(true);
  if (!sb) return;
  const [mine] = await Promise.all([myVillage(), pioneers(), gbOn() ? pollGuestbook() : null]);
  mineRow = mine ? toNeighbor(mine) : null;
  if (!stillHere()) return;
  if (nbSub === 'sug') return loadSug(false);
  if (nbSub === 'pop') return loadPop();
  drawNb(false);
}

/** 랭킹에서 누르면 그 마을로 */
export async function visitUser(uid: string) {
  const r = await getVillage(uid);
  const v = r && toNeighbor(r);
  if (!v) return toast('아직 마을 모습이 없는 여관이에요');
  game.visit(v);
}

/** 실제 마을 좋아요: 서버가 하루 한 번만 받는다 (숫자가 그대로면 오늘 이미 누른 것) */
export async function likeReal(v: Neighbor): Promise<boolean> {
  const before = v.like;
  const r = await likeVillage(v.uid!);
  if (typeof r !== 'number') {
    toast(r.error);
    return false;
  }
  v.like = r;
  if (r !== before) mythicHeart(v.uid!);
  if (r === before) {
    toast('오늘은 이미 좋아요를 남겼어요 · 내일 또 와 주세요');
    return false;
  }
  return true;
}
