// SOCIAL_SPEC §2~§4 「각별한 이웃」 화면 (플래그 friends) — ⭐ 탭 목록 · 맺기/수락/끊기 · 친구 마을에서 공사 거들기·선물 · 편지함 「고마워요」
//  P3(우정 상점 · 텃밭·펫 도움 · 「!」 요청)은 아직
import { CONFIG } from '../data/config';
import { def } from '../data/catalog';
import { flag } from '../world/flags';
import { markDirty, P, S, world, type Building, type Mail } from '../world/state';
import { conLeft, clock } from '../world/construct';
import { addMail } from '../world/meta';
import { addTokens, applyHelp, social } from '../world/friends';
import { claimHelp, claimThanks, friendAnswer, friendList, friendRemove, friendRequest, friendServer, sendHelp, thankHelp, type FriendRow } from '../net/friends';
import { me, online } from '../net/server';
import { esc, fmt } from './common';
import { closeWin, openWin, toast } from './windows';
import { portSrc } from './outfitPort';
import { PORTRAITS } from '../engine/assets';
import { confirmSheet } from './confirmSheet';

const SC = CONFIG.social;
export const friendsOn = () => flag('friends');
let rows: FriendRow[] | null = null;
let loadedAt = 0;
export const friendRows = () => rows ?? [];
export const friendOf = (uid?: string) => (uid ? rows?.find((r) => r.other === uid) ?? null : null);

export async function loadFriends(force = false): Promise<FriendRow[] | null> {
  if (!friendsOn() || !online()) return null;
  if (!force && rows && Date.now() - loadedAt < 30_000) return rows;
  const r = await friendList();
  if (r) {
    rows = r;
    loadedAt = Date.now();
  }
  return rows;
}

const ago = (iso: string | null) => {
  if (!iso) return '접속 기록 없음';
  const m = Math.max(0, (Date.now() - Date.parse(iso)) / 60000);
  return m < 5 ? '방금 접속' : m < 60 ? `${Math.round(m)}분 전` : m < 60 * 24 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 60 / 24)}일 전`;
};
const face = (r: FriendRow) => `<img src="${(r.rep_hero && portSrc(r.rep_hero, null)) || PORTRAITS.hero || ''}" alt="">`;

/** ⭐ 탭 몸 (이웃 창이 그린다) — rows가 없으면 불러오는 중 */
export function friendTabHtml(): string {
  if (!online()) return '<p class="note">⭐ 로그인하면 각별한 이웃을 맺을 수 있어요 — 서로 맺으면 친구 마을에 들러 공사를 거들고 선물을 주고받아요</p>';
  if (friendServer.missing) return '<p class="note">⭐ 각별한 이웃은 곧 열려요 (준비 중)</p>';
  if (!rows) return '<p class="note">불러오는 중…</p>';
  const ok = rows.filter((r) => r.status === 'ok');
  const inc = rows.filter((r) => r.status === 'in');
  const out = rows.filter((r) => r.status === 'out');
  const head = `<p class="sub g">🤝 우정 증표 <b>${fmt(social().tokens)}</b> <small>· 각별한 이웃 ${ok.length}/${SC.friendMax} · 하루 ${SC.helpPerDay}번까지 도울 수 있어요</small></p>`;
  const incHtml = inc.length
    ? `<p class="sub">받은 신청</p><div class="steps">${inc.map((r) => `<div class="stp real fr">${face(r)}<span><b>${esc(r.inn_name)}</b><small>주인 ${esc(r.nickname)}</small></span><em><button class="bigbtn sm" data-fra="${r.other}">수락</button><button class="bigbtn sm ghost" data-frd="${r.other}">거절</button></em></div>`).join('')}</div>`
    : '';
  const okHtml = ok.length
    ? `<div class="steps">${ok.map((r) => `<div class="stp real fr"><button class="frgo" data-frv="${r.other}">${face(r)}<span><b>${esc(r.inn_name)}</b><small>주인 ${esc(r.nickname)} · ${ago(r.last_seen)}${r.can_help ? ` · 오늘 도움 ${r.helped_today}/${SC.helpPerFriend}` : ' · 맺은 지 얼마 안 돼 아직 못 거들어요'}</small></span></button><em><button class="bigbtn sm ghost" data-frx="${r.other}" aria-label="끊기">⋯</button></em></div>`).join('')}</div>`
    : '<p class="note">아직 각별한 이웃이 없어요 · 이웃 마을을 구경하다 「＋ 각별한 이웃 신청」을 눌러 보세요</p>';
  const outHtml = out.length ? `<p class="note">신청 보냄: ${out.map((r) => esc(r.inn_name)).join(' · ')}</p>` : '';
  return head + incHtml + okHtml + outHtml;
}
/** ⭐ 탭 단추 · visit = 그 마을로 · redraw = 탭 다시 그리기 */
export function bindFriendTab(visit: (uid: string) => void, redraw: () => void) {
  const q = <T extends HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];
  q('[data-frv]').forEach((b) => (b.onclick = () => visit(b.dataset.frv!)));
  q('[data-fra]').forEach((b) => (b.onclick = async () => answer(b.dataset.fra!, true).then(redraw)));
  q('[data-frd]').forEach((b) => (b.onclick = async () => answer(b.dataset.frd!, false).then(redraw)));
  q('[data-frx]').forEach(
    (b) =>
      (b.onclick = async () => {
        const r = friendOf(b.dataset.frx);
        if (!(await confirmSheet({ title: `${r?.inn_name ?? '이 여관'}과 각별한 이웃을 끊을까요?`, body: '상대에게 알림은 가지 않아요', ok: '끊기', danger: true }))) return;
        const res = await friendRemove(b.dataset.frx!);
        toast(res === 'ok' ? '각별한 이웃을 끊었어요' : '지금은 끊지 못했어요');
        await loadFriends(true);
        redraw();
      }),
  );
}
async function answer(uid: string, ok: boolean) {
  const r = await friendAnswer(uid, ok);
  toast(r === 'ok' ? '🤝 각별한 이웃이 되었어요!' : r === 'declined' ? '신청을 거절했어요' : r === 'full' ? `각별한 이웃은 ${SC.friendMax}명까지예요` : r === 'none' ? '이미 처리된 신청이에요' : '지금은 답하지 못했어요');
  // 편지함의 그 신청 편지는 읽음으로
  for (const m of P.meta.mail) if (m.freq === uid) m.claimed = true;
  markDirty();
  await loadFriends(true);
}

// ───────── 이웃 마을 방문 화면 ─────────
/** 방문 바 아래 한 줄: 신청 · 수락 · 선물 (방문할 때마다 다시 그림) */
export async function visitFriendBar() {
  document.getElementById('vFriend')?.remove();
  const v = S.visiting;
  if (!friendsOn() || !v?.uid || !online() || v.uid === me.profile?.id) return;
  // 방문할 때마다 새로 (방금 수락됐을 수 있다)
  await loadFriends(true);
  if (S.visiting?.uid !== v.uid) return;
  const r = friendOf(v.uid);
  const bar = document.createElement('div');
  bar.id = 'vFriend';
  bar.className = 'px';
  if (friendServer.missing) return;
  if (!r) bar.innerHTML = `<button class="bigbtn sm" id="vfReq">＋ 각별한 이웃 신청</button>`;
  else if (r.status === 'out') bar.innerHTML = `<small>⭐ 각별한 이웃 신청을 보냈어요</small>`;
  else if (r.status === 'in') bar.innerHTML = `<small>⭐ 각별한 이웃 신청이 왔어요</small><button class="bigbtn sm" id="vfAcc">수락</button>`;
  else bar.innerHTML = `<small>⭐ 각별한 이웃 · ${r.can_help ? `오늘 도움 ${r.helped_today}/${SC.helpPerFriend} · 공사 중인 건물을 누르면 거들어요` : '맺은 지 얼마 안 돼 아직 못 거들어요'}</small>${r.can_help ? '<button class="bigbtn sm" id="vfGift">🎁 선물</button>' : ''}`;
  document.getElementById('visitbar')?.after(bar);
  const req = document.getElementById('vfReq');
  if (req)
    req.onclick = async () => {
      const res = await friendRequest(v.uid!);
      toast(
        res === 'sent' ? '각별한 이웃 신청을 보냈어요 · 상대가 수락하면 맺어져요' : res === 'accepted' ? '🤝 각별한 이웃이 되었어요!' : res === 'already' ? '이미 각별한 이웃이에요' : res === 'full' ? `각별한 이웃은 ${SC.friendMax}명까지예요` : res === 'test' ? '이 여관과는 맺을 수 없어요' : '지금은 신청하지 못했어요',
      );
      await loadFriends(true);
      void visitFriendBar();
    };
  const acc = document.getElementById('vfAcc');
  if (acc) acc.onclick = () => void answer(v.uid!, true).then(visitFriendBar);
  const gift = document.getElementById('vfGift');
  if (gift) gift.onclick = () => void help('gift', 'gift').then(visitFriendBar);
}
export const hideFriendBar = () => document.getElementById('vFriend')?.remove();

const WHY: Record<string, string> = {
  daylimit: `오늘은 ${SC.helpPerDay}번 다 도왔어요 · 내일 또 와요`,
  friendlimit: `이 이웃은 오늘 ${SC.helpPerFriend}번 다 도왔어요`,
  same: '오늘은 이미 거들었어요',
  newfriend: '맺은 지 얼마 안 돼 아직 못 거들어요 (1시간 뒤부터)',
  notfriend: '각별한 이웃만 거들 수 있어요',
  login: '로그인하면 거들 수 있어요',
  test: '이 여관은 거들 수 없어요',
};
async function help(kind: 'con' | 'gift', target: string): Promise<boolean> {
  const v = S.visiting;
  if (!v?.uid) return false;
  const r = await sendHelp(v.uid, kind, target);
  if (!r.ok) {
    toast(WHY[r.why ?? ''] ?? '지금은 거들지 못했어요');
    return false;
  }
  if (r.tokens) addTokens(r.tokens);
  toast(`${kind === 'gift' ? '🎁 선물을 두고 왔어요' : '🔨 공사를 거들었어요'}${r.tokens ? ` · 🤝 우정 증표 +${r.tokens}` : ''}`);
  await loadFriends(true);
  return true;
}

/** 이웃 마을: 친구면 공사 중인 건물에 공사 표시 (그 마을 스냅샷 con) — 내 공사 진행 그림이 그대로 그려진다 */
export function applyVisitCon() {
  const v = S.visiting;
  if (!friendsOn() || !v?.uid || !v.con) return;
  for (const o of world.objs) {
    const c = v.con[`${o.kind}@${o.tx},${o.ty}`];
    if (c && c[0] > Date.now()) o.con = { kind: 'up', end: c[0], total: c[1], to: o.lvl, cut: 0, cost: 0 };
  }
}
/** 이웃 마을에서 건물을 눌렀을 때: 친구의 공사 중 건물이면 「공사 거들기」 창 · 처리했으면 true */
export function friendBuildingTap(o: Building): boolean {
  const v = S.visiting;
  if (!friendsOn() || !v?.uid || !o.con) return false;
  const r = friendOf(v.uid);
  if (!r || r.status !== 'ok') return false;
  const key = `${o.kind}@${o.tx},${o.ty}`;
  openWin(
    `🔨 ${def(o.kind).name} 공사 중`,
    `<p class="sub">남은 시간 ${clock(conLeft(o))} · 거들면 남은 시간 −${Math.round(SC.conCutPct * 100)}% (한 번에 최대 ${SC.conCutMaxMin}분)</p><p class="note">${esc(r.inn_name)} 주인이 다음에 접속하면 줄어들어요 · 돕는 나는 🤝 우정 증표 +1</p>${r.can_help ? '<button class="bigbtn" id="fhGo">🔨 공사 거들기</button>' : '<p class="note">맺은 지 얼마 안 돼 아직 못 거들어요</p>'}`,
  );
  const go = document.getElementById('fhGo');
  if (go)
    go.onclick = async () => {
      go.setAttribute('disabled', '');
      if (await help('con', key)) {
        // 보이는 것만 살짝 줄여 둔다 (실제 반영은 주인 저장에서)
        if (o.con) o.con.end -= Math.min(conLeft(o) * SC.conCutPct, SC.conCutMaxMin * 60) * 1000;
        closeWin();
        void visitFriendBar();
      } else go.removeAttribute('disabled');
    };
  return true;
}

// ───────── 편지함: 「고마워요」 · 신청 수락/거절 ─────────
export function mailExtraHtml(m: Mail): string {
  if (m.thank && !m.thanked) return `<button class="bigbtn sm ghost" data-thank="${m.id}">💌 고마워요</button>`;
  if (m.freq && !m.claimed) return `<span class="frbtns"><button class="bigbtn sm" data-mfa="${m.freq}">수락</button><button class="bigbtn sm ghost" data-mfd="${m.freq}">거절</button></span>`;
  return '';
}
export function bindMailExtra(redraw: () => void) {
  document.querySelectorAll<HTMLElement>('[data-thank]').forEach(
    (b) =>
      (b.onclick = async () => {
        const m = P.meta.mail.find((x) => x.id === +b.dataset.thank!);
        if (!m?.thank) return;
        const r = await thankHelp(m.thank);
        m.thanked = r === 'ok' || r === 'none';
        m.claimed = true;
        markDirty();
        toast(r === 'ok' ? '💌 고마운 마음을 전했어요 · 이웃에게 증표 +1' : r === 'none' ? '이미 마음을 전했어요' : '지금은 전하지 못했어요');
        redraw();
      }),
  );
  document.querySelectorAll<HTMLElement>('[data-mfa],[data-mfd]').forEach(
    (b) => (b.onclick = () => void answer((b.dataset.mfa ?? b.dataset.mfd)!, !!b.dataset.mfa).then(redraw)),
  );
}

// ───────── 접속 중 주기적으로: 받은 도움 · 고마워요 · 새 신청 ─────────
let polling = false;
export async function pollFriends() {
  if (!friendsOn() || !online() || S.visiting || polling) return;
  polling = true;
  try {
    const evs = await claimHelp();
    for (const ev of evs) toast(applyHelp(ev));
    const th = await claimThanks();
    if (th.length) {
      addTokens(th.length * SC.tokenThanks);
      toast(`💌 ${th[0].nickname ?? '이웃'}님${th.length > 1 ? ` 외 ${th.length - 1}명` : ''}이 고마워해요 · 🤝 우정 증표 +${th.length * SC.tokenThanks}`);
    }
    const list = await loadFriends(true);
    const seen = (social().reqSeen ??= []);
    for (const r of list ?? []) {
      if (r.status !== 'in' || seen.includes(r.other)) continue;
      seen.push(r.other);
      addMail({ from: 'friend', title: `⭐ ${r.inn_name}의 각별한 이웃 신청`, body: `${r.nickname} 주인이 각별한 이웃이 되고 싶대요. 맺으면 서로 마을에 들러 공사를 거들고 선물을 주고받아요.`, reward: {}, freq: r.other });
      toast(`⭐ ${r.inn_name}에서 각별한 이웃 신청이 왔어요 · 편지함`);
    }
    if (seen.length > 100) seen.splice(0, seen.length - 100);
    markDirty();
  } finally {
    polling = false;
  }
}
let timer = 0;
export function initFriends() {
  clearInterval(timer);
  timer = window.setInterval(() => void pollFriends(), 90_000);
  setTimeout(() => void pollFriends(), 8000);
}

if (import.meta.env.DEV) Object.assign(window, { __friends: { tap: friendBuildingTap, poll: pollFriends, load: loadFriends, rows: friendRows, bar: visitFriendBar } });
