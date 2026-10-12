// GROWTH §2: 마을에서 사람을 누르면 작은 메뉴 [말 걸기] [선물하기] (+ 정보) · 선물 고르기(아이콘 · 개수 · ♥/✕ 알아낸 취향 · 💭 본 힌트)
import { bondById, GIFT_KEYS, GIFTS, type GiftKey } from '../data/bonds';
import { CONFIG } from '../data/config';
import { FISH } from '../data/story/fish';
import { josa } from '../data/josa';
import { energyLeft, energyMax, giveFish, giveGift, giveGuest, talkTo, tieAvailable } from '../world/owner';
import { guestGiftedToday, guestLikes, hintKey, hintSeen } from '../world/growth';
import { today } from '../world/progress';
import { markDirty, P, S, type Actor } from '../world/state';
import { $, $$, esc } from './common';
import { speakerOf, talk } from './dialogue';
import { showActor, talkGuest } from './guests';
import { openGifts } from './owner';
import { closeWin, openReport, openWin, toast } from './windows';
import { track as trackEv } from '../net/telemetry';

/** 선물 아이콘 (그림이 없어 이모지) */
export const GIFT_ICON: Record<GiftKey, string> = { tea: '🍵', trinket: '📿', cake: '🍰', ale: '🍺', book: '📕', gem: '💎', flower: '💐', jerky: '🥓', whet: '🪨', candle: '🕯️', map: '🗺️', toy: '🪀' };
const fishIcon = (id: string) => `<img class="fishic" src="${import.meta.env.BASE_URL}assets/fish/${id}.png" alt="">`;

/** 이 사람의 인연 id (모모 = 우체부 npc · 영웅·전설) — 없으면 null */
export function bondIdOf(a: Actor): string | null {
  if (a.role === 'npc') return 'momo';
  const id = a.legendId ?? a.heroId;
  return id && bondById(id) ? id : null;
}

let menuEl: HTMLElement | null = null;
export function closePersonMenu() {
  menuEl?.remove();
  menuEl = null;
}
/** 작은 메뉴 (누른 자리 근처) */
export function openPersonMenu(a: Actor, x: number, y: number) {
  closePersonMenu();
  const bid = bondIdOf(a);
  const npc = a.role === 'npc';
  const el = document.createElement('div');
  el.id = 'pmenu';
  el.className = 'pmenu card px';
  const name = npc ? '모모' : a.name;
  el.innerHTML = `<b class="pmname">${esc(name)}</b><button id="pmTalk">💬 말 걸기</button><button id="pmGift">🎁 선물하기</button>${npc ? '<button id="pmLetter" class="ghost">✉️ 편지 쓰기</button>' : a.id ? '<button id="pmInfo" class="ghost">📋 정보</button>' : ''}`;
  document.body.appendChild(el);
  menuEl = el;
  const r = el.getBoundingClientRect();
  el.style.left = `${Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2))}px`;
  el.style.top = `${Math.max(8, Math.min(innerHeight - r.height - 8, y - r.height - 18))}px`;
  const on = (id: string, f: () => void) => {
    const b = document.getElementById(id);
    if (b)
      b.onclick = (e) => {
        e.stopPropagation();
        closePersonMenu();
        f();
      };
  };
  on('pmTalk', () => talkPerson(a, bid));
  on('pmGift', () => openGiftPick(a));
  on('pmInfo', () => showActor(a));
  on('pmLetter', () => openReport());
  // 메뉴 밖을 누르면 닫힘 (이번 탭이 끝난 뒤부터)
  setTimeout(() => {
    const off = (e: Event) => {
      if (!menuEl || menuEl.contains(e.target as Node)) return;
      closePersonMenu();
      removeEventListener('pointerdown', off, true);
    };
    addEventListener('pointerdown', off, true);
  }, 0);
}

/** 말 걸기: 인연이 있으면 하루 한 번 인연 대화(힌트 포함), 아니면(이미 했거나 단골) 그냥 한마디 */
function talkPerson(a: Actor, bid: string | null) {
  if (bid && P.owner && tieAvailable(bid)) {
    const err = talkTo(bid);
    if (!err) return;
    if (!a.id) return toast(err);
  }
  if (a.id) return talkGuest(a);
  talk([['post', '주인님! 오늘도 배달 열심히 할게요~']]);
}

const heartMark = '<i class="gmark like" title="좋아함">♥</i>';
const hateMark = '<i class="gmark hate" title="싫어함">✕</i>';
const hintMark = '<i class="gmark hint" title="좋아한다는 얘기를 들은 것 같아요">💭</i>';
const hintHate = '<i class="gmark hint hate" title="싫어한다는 얘기를 들은 것 같아요">🌧</i>';

/** 선물 고르기 창 */
export function openGiftPick(a: Actor) {
  const bid = bondIdOf(a);
  const d = bid ? bondById(bid) : null;
  const name = a.role === 'npc' ? '모모' : a.name;
  if (!P.owner) return toast('주인을 만들면 선물할 수 있어요');
  if (bid && !tieAvailable(bid)) return toast('아직 인연을 쌓을 수 없어요');
  const guest = !d;
  if (guest && !(a.status === 'regular')) return toast('선물은 단골·영웅·전설·마을 사람에게 줄 수 있어요');
  const t = bid ? P.ties[bid] : null;
  const done = guest ? guestGiftedToday(a) : t?.giftDay === today();
  const owned = GIFT_KEYS.filter((g) => (P.gifts[g] ?? 0) > 0);
  const fish = guest ? [] : FISH.filter((f) => f.use.includes('gift') && (P.growth.fish.bag[f.id] ?? 0) > 0);
  const mark = (g: GiftKey) => {
    if (d) {
      if (t?.knowLike && g === d.likes) return heartMark;
      if (t?.knowHate && g === d.hates) return hateMark;
      if (g === d.likes && hintSeen(hintKey(d.id, 'like'))) return hintMark;
      if (g === d.hates && hintSeen(hintKey(d.id, 'hate'))) return hintHate;
      return '';
    }
    const like = guestLikes(a);
    if (g === like && hintSeen(`guestknow:${a.kind}`)) return heartMark;
    if (g === like && hintSeen(`guest:${a.kind}`)) return hintMark;
    return '';
  };
  const rows = [
    ...owned.map((g) => `<button class="gpick" data-gg="${g}"><span class="gic">${GIFT_ICON[g]}</span><span>${esc(GIFTS[g].name)}<small>×${P.gifts[g]}</small></span>${mark(g)}</button>`),
    ...fish.map((f) => `<button class="gpick" data-gf="${f.id}"><span class="gic">${fishIcon(f.id)}</span><span>${esc(f.name)}<small>×${P.growth.fish.bag[f.id]}</small></span>${bid && P.growth.fishLike.includes(`${bid}:${f.id}`) ? heartMark : ''}</button>`),
  ].join('');
  openWin(
    `선물하기 · ${name}`,
    `<p class="sub">하루 한 번 · 행동력 ${energyLeft()}/${energyMax()}${done ? ' · <b class="bad">오늘은 이미 선물했어요</b>' : ''}${guest ? ` · 단골은 좋아하는 것을 받으면 기분 +${CONFIG.growth.guestGift.likeMood} · 그날 케미 +${Math.round((CONFIG.growth.guestGift.chemMult - 1) * 100)}%` : ''}</p>
    <p class="note">♥ 좋아함 · ✕ 싫어함 (줘 보고 알아낸 것) · 💭 그런 얘기를 들은 것 같은 것 (줘 봐야 확실해요)</p>
    ${rows ? `<div class="gpicks">${rows}</div>` : `<p class="note">가방에 선물이 없어요</p><button class="bigbtn" id="gpShop">🎁 선물 가게로 (주인 창 → 인연 → 선물 가게)</button>`}
    ${rows ? '<button class="bigbtn sm ghost" id="gpShop">선물 가게</button>' : ''}`,
    'giftw',
  );
  const sh = document.getElementById('gpShop');
  if (sh) sh.onclick = () => openGifts(bid ?? undefined);
  $$('[data-gg]').forEach((b) => (b.onclick = () => give(a, bid, b.dataset.gg as GiftKey, null)));
  $$('[data-gf]').forEach((b) => (b.onclick = () => give(a, bid, null, b.dataset.gf!)));
  void $;
}

function give(a: Actor, bid: string | null, g: GiftKey | null, fishId: string | null) {
  const name = a.role === 'npc' ? '모모' : a.name;
  if (!bid) {
    const r = giveGuest(a, g!);
    if (r.err) return toast(r.err);
    if (r.kind === 'like' && !P.growth.hints.includes(`guestknow:${a.kind}`)) P.growth.hints.push(`guestknow:${a.kind}`);
    markDirty();
    trackEv('gift', { to: 'guest', kind: r.kind });
    closeWin();
    return talk([[speakerOf(a), r.line!], ['narr', r.kind === 'like' ? `${name}의 기분이 크게 좋아졌다! (오늘 케미 상승 +${Math.round((CONFIG.growth.guestGift.chemMult - 1) * 100)}%)` : `${name}의 기분이 조금 좋아졌다.`]]);
  }
  const d = bondById(bid)!;
  const r = fishId ? giveFish(bid, fishId) : giveGift(bid, g!);
  if (r.err) return toast(r.err);
  trackEv('gift', { to: bid, kind: r.kind, fish: !!fishId });
  closeWin();
  talk([[d.port, r.line!, undefined, d.name], ['narr', r.kind === 'like' ? `${d.name}${josa(d.name, '가')} 좋아하는 것을 알아냈다!` : r.kind === 'hate' ? `${d.name}${josa(d.name, '는')} 이걸 싫어한다…` : '인연이 조금 깊어졌다.']]);
  markDirty();
  void S;
}

// 개발용 (e2e)
if (import.meta.env.DEV) Object.assign(window, { __giftPick: openGiftPick, __growthLikes: (id: string) => bondById(id)?.likes, __personMenu: openPersonMenu });
