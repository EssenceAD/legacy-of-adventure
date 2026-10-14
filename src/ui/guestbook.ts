// LUXE §4 이웃 방명록 · 좋아요 (플래그 guestbook · 실험실 vis) — 화면 쪽
//  방문 화면 [👍 좋아요] → 도장 한마디 8개 중 하나 · 이웃 창 「방명록」 탭 · 랭킹 「이번 주 인기 마을」 탭 · 이웃 목록 맨 위 「🏆 지난주 인기 마을」
//  서버(supabase/guestbook.sql)가 아직 없으면: 방명록·인기 마을은 「준비 중」 · 좋아요는 예전처럼(도장 없이)
import { GB } from '../data/guestbook_cfg';
import type { Neighbor } from '../data/neighbors';
import { PORTRAITS } from '../engine/assets';
import { gbServer, lastWeekTop, likeWithStamp, myGuestbook, weeklyPopular, type GbBook } from '../net/guestbook';
import { gbCache, pollGuestbook } from '../net/gbSync';
import { me, online, sb } from '../net/server';
import { track } from '../net/telemetry';
import { getPref, setPref } from '../save/save';
import { chaptersDone } from '../world/guide';
import { BLOCK_TEXT, gbState, kstWeekKey, likeBlock, likedToday, markLiked, newLikes, phraseText, toNextGift, untilWeekReset, type LikedLog } from '../world/guestbook';
import { markDirty, P } from '../world/state';
import { vis } from '../world/visual';
import { $$, esc, fmt } from './common';
import { closeWin, isWinOpen, openWin, toast } from './windows';

export const gbOn = () => vis('guestbook');

const LIKED = 'gbLiked';
const likedLog = () => getPref<LikedLog | null>(LIKED, null);
const portrait = (k: string | null) => (k && PORTRAITS[k]) || PORTRAITS.hero || '';

/** 좋아요 막는 까닭 (도장 고르기 전 · 도장은 아직 안 골랐으니 0번으로 검사) */
function gate(v: Neighbor) {
  return likeBlock({ online: online(), chapters: chaptersDone(), legacy: !!P.guide.legacy, myId: me.profile?.id ?? null, target: v.uid ?? '', likedToday: likedToday(likedLog(), v.uid ?? ''), phrase: 0 });
}

/**
 * 방문 화면 [👍 좋아요] (실제 유저 마을): 도장 한마디 고르기 창 → 서버
 *  onLiked(새 좋아요 수) — 남겼을 때만 · fallback() — 서버에 새 함수가 없을 때 예전 좋아요로
 */
export function openStampSheet(v: Neighbor, onLiked: (likes: number) => void, fallback: () => void) {
  if (gbServer.missing) return fallback();
  const why = gate(v);
  let pick = -1;
  const draw = () => {
    const btns = GB.phrases.map((p, i) => `<button class="gbst ${i === pick ? 'on' : ''}" data-p="${i}" ${why ? 'disabled' : ''}>${esc(p)}</button>`).join('');
    openWin(
      '방명록 도장',
      `<p class="sub"><b>${esc(v.name)}</b>에 좋아요와 함께 도장 한마디를 남겨요</p>
      <p class="note">마을마다 하루 한 번 · 정해진 문장 중에서 골라요</p>
      <div class="gbstamps">${btns}</div>
      ${why ? `<p class="note gbwhy">${esc(BLOCK_TEXT[why])}</p>` : ''}
      <button class="bigbtn" id="gbGo" ${why || pick < 0 ? 'disabled' : ''}>👍 좋아요 남기기</button>`,
      'gbwin',
    );
    $$('.gbst[data-p]').forEach(
      (b) =>
        (b.onclick = () => {
          pick = +b.dataset.p!;
          draw();
        }),
    );
    const go = document.getElementById('gbGo') as HTMLButtonElement | null;
    if (go) go.onclick = () => void send(go);
  };
  const send = async (btn: HTMLButtonElement) => {
    btn.disabled = true;
    const r = await likeWithStamp(v.uid!, pick);
    if (r.ok) {
      setPref(LIKED, markLiked(likedLog(), v.uid!));
      track('gb_like', { phrase: pick });
      if (isWinOpen() && document.getElementById('winT')?.textContent === '방명록 도장') closeWin();
      toast(`👍 「${GB.phrases[pick]}」 도장을 남겼어요`);
      onLiked(r.likes);
      return;
    }
    if (r.why === 'missing') {
      // 서버 준비 전: 예전 좋아요 (도장 없이)
      if (isWinOpen()) closeWin();
      return fallback();
    }
    if (r.why === 'already') setPref(LIKED, markLiked(likedLog(), v.uid!));
    toast(BLOCK_TEXT[r.why === 'no_village' ? 'no_village' : r.why === 'net' ? 'net' : r.why]);
    btn.disabled = false;
  };
  draw();
}

// ───────── 이웃 창 「방명록」 탭 ─────────

const fmtDay = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${+m[2]}/${+m[3]}` : '';
};

/** 방명록 탭 몸 (불러온 뒤) */
export function guestbookHtml(b: GbBook | null, loading: boolean): string {
  if (!sb) return '<p class="note">서버에 연결할 수 없어요</p>';
  if (!online()) return '<p class="note">로그인하면 이웃들이 남긴 좋아요와 도장이 여기에 쌓여요 (메뉴 → 계정)</p>';
  if (loading) return '<p class="note">불러오는 중…</p>';
  if (!b) return `<p class="note">${gbServer.missing ? '방명록은 준비 중이에요 · 곧 열려요' : '방명록을 불러오지 못했어요 · 잠시 뒤에 다시 열어 주세요'}</p>`;
  const g = gbState();
  const left = toNextGift(b.total, g);
  const capped = g.week === kstWeekKey() && g.weekN >= GB.giftWeekMax;
  const rows = b.rows
    .map(
      (r) =>
        `<button class="stp real gbrow" data-u="${esc(r.from_user)}"><img src="${portrait(r.rep_hero)}" alt=""><span><b>${esc(r.inn_name)}</b><small>${r.phrase == null ? '♥ 좋아요' : `「${esc(phraseText(r.phrase))}」`}</small></span><em>${fmtDay(r.day)}</em></button>`,
    )
    .join('');
  return `<div class="gbstat"><span><b>${fmt(b.week)}</b><small>이번 주 좋아요</small></span><span><b>${fmt(b.total)}</b><small>누적</small></span></div>
    <p class="note">${capped ? `이번 주 선물 ${GB.giftWeekMax}번을 다 받았어요 · 다음 주 월요일에 이어서` : `좋아요 ${GB.giftEvery}개마다 우편함으로 작은 선물 (한 주 ${GB.giftWeekMax}번까지) · 다음 선물까지 ${fmt(left)}개`}</p>
    <p class="sub g">최근 ${GB.recent}개 <small>누르면 그 마을로</small></p>
    <div class="steps">${rows || '<p class="note">아직 남긴 이웃이 없어요 · 마을을 꾸미고 이웃 마을에도 놀러 가 보세요</p>'}</div>`;
}

/** 방명록 탭을 열었다: 새로 불러와 그리고, 본 것으로 표시 (빨간 점 끔) */
export async function loadGuestbook(draw: (html: string) => void, visit: (uid: string) => void) {
  draw(guestbookHtml(null, !!sb && online()));
  if (!sb || !online()) return;
  const b = await myGuestbook();
  if (b) {
    gbCache.total = b.total;
    const g = gbState();
    if (g.seen !== b.total) {
      g.seen = b.total;
      markDirty();
    }
    track('gb_open', { week: b.week, total: b.total });
  }
  draw(guestbookHtml(b, false));
  $$('.gbrow[data-u]').forEach(
    (el) =>
      (el.onclick = () => {
        const u = el.dataset.u!;
        if (u === me.profile?.id) return toast('내 마을이에요');
        visit(u);
      }),
  );
}

/** 빨간 점: 새 좋아요가 왔나 (방명록 탭을 열면 꺼짐) */
export const gbHasNew = () => gbOn() && online() && newLikes(gbCache.total, gbState()) > 0;

// ───────── 🏆 지난주 인기 마을 (이웃 목록 맨 위) ─────────

export async function lastTopHtml(): Promise<string> {
  if (!gbOn() || !sb) return '';
  const t = await lastWeekTop(kstWeekKey());
  if (!t) return '';
  return `<button class="stp real gbtop" data-gbtop="${esc(t.user_id)}"><img src="${portrait(t.rep_hero)}" alt=""><span><b>🏆 지난주 인기 마을 · ${esc(t.inn_name)}</b><small>주인 ${esc(t.nickname)} · 지난주 좋아요 ${fmt(t.likes)}개</small></span><em>보러 가기</em></button>`;
}

// ───────── 랭킹 「이번 주 인기 마을」 ─────────

export async function popularHtml(): Promise<string> {
  const b = await weeklyPopular();
  if (!b) return `<p class="note">${gbServer.missing ? '이번 주 인기 마을은 준비 중이에요 · 곧 열려요' : '불러오지 못했어요'}</p>`;
  const h = Math.floor(untilWeekReset() / 3600000);
  const reset = h >= 24 ? `${Math.floor(h / 24)}일 ${h % 24}시간` : `${h}시간`;
  const row = (r: { rank: number; user_id: string; inn_name: string; nickname: string; rep_hero: string | null; likes: number }, mine: boolean) =>
    `<button class="rkrow ${mine ? 'me' : ''} ${r.rank <= 3 ? 'top' + r.rank : ''}" data-u="${esc(r.user_id)}"><em>${r.rank}</em><img src="${portrait(r.rep_hero)}" alt=""><span><b>${esc(r.inn_name)}</b><small>${esc(r.nickname)}</small></span><i>👍 ${fmt(r.likes)}</i></button>`;
  const mineLine = online()
    ? b.me
      ? `<p class="sub">내 순위</p>${row({ rank: b.me.rank, user_id: me.profile!.id, inn_name: me.profile!.inn_name, nickname: me.profile!.nickname, rep_hero: me.profile!.rep_hero, likes: b.me.likes }, true)}`
      : '<p class="note">이번 주 받은 좋아요가 아직 없어요</p>'
    : '<p class="note">로그인하면 내 순위가 보여요 (메뉴 → 계정)</p>';
  return `<p class="note">이번 주(월요일 0시부터) 이웃에게 받은 좋아요 · 초기화까지 ${reset} · 1위는 다음 한 주 이웃 목록 맨 위에 「🏆 지난주 인기 마을」</p>${mineLine}
    <p class="sub">이번 주 인기 마을 상위 ${GB.popularTop}</p>
    <div class="rklist">${b.rows.map((r) => row(r, r.user_id === me.profile?.id)).join('') || '<p class="note">이번 주엔 아직 아무도 없어요 · 이웃 마을에 좋아요를 남겨 보세요!</p>'}</div>
    <p class="note">누르면 그 마을을 구경해요</p>`;
}

/** 클라우드 저장 때 같이 (pollMin분마다): 방명록 수 → 빨간 점 · 선물 */
export { pollGuestbook };
