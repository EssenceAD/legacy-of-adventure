// GROWTH §2·§3: 저장 칸 바로잡기 · 아끼는 영웅 ★ · 소모품 · [알림] 자랑(도배 방지) · 선물 힌트 · 단골 선물
//  다른 world 모듈이 import해도 꼬이지 않게: state · data · progress · owner(함수만)만 쓴다.
import { CONFIG } from '../data/config';
import { BONDS, bondById, GIFTS, type GiftKey } from '../data/bonds';
import { GIFT_HINTS, GUEST_GIFT } from '../data/story/gift_hints';
import { UNIQUES } from '../data/story/uniques';
import { FISH } from '../data/story/fish';
import { josa } from '../data/josa';
import { regionById, SLOTS, type RegionId } from '../data/items';
import { freshGrowth, markDirty, P, S, uiHooks, world, type Actor, type Item } from './state';
import { today } from './progress';

const G = () => CONFIG.growth;
const homeActors = () => world.home?.actors ?? world.actors;
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

/** 저장에서 온 growth 칸 바로잡기 (빠진 칸은 기본값 · 있는 값은 그대로) */
export function sanitizeGrowth() {
  const base = freshGrowth();
  const g = obj(P.growth) as Record<string, unknown>;
  const f = obj(g.fish);
  const b = obj(g.brag);
  const meal = obj(g.meal);
  P.growth = {
    favs: arr(g.favs).filter((x): x is number => typeof x === 'number').slice(0, G().favMax),
    charm: Math.max(0, Math.floor(num(g.charm))),
    whet: Math.max(0, Math.floor(num(g.whet))),
    hints: arr(g.hints).filter((x): x is string => typeof x === 'string'),
    rumorDay: typeof g.rumorDay === 'string' ? g.rumorDay : '',
    guestGift: Object.fromEntries(Object.entries(obj(g.guestGift)).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
    uniques: Object.fromEntries(Object.entries(obj(g.uniques)).filter(([k, v]) => UNIQUES.some((u) => u.id === k) && typeof v === 'number')) as Record<string, number>,
    brag: { last: num(b.last), day: typeof b.day === 'string' ? b.day : '', n: Object.fromEntries(Object.entries(obj(b.n)).filter(([, v]) => typeof v === 'number')) as Record<string, number> },
    setFirst: arr(g.setFirst).filter((x): x is string => typeof x === 'string'),
    seeded: g.seeded === true,
    bragOff: g.bragOff === true,
    fishLike: arr(g.fishLike).filter((x): x is string => typeof x === 'string'),
    fish: {
      day: typeof f.day === 'string' ? f.day : '',
      used: Math.max(0, num(f.used)),
      extra: Math.max(0, num(f.extra)),
      bag: Object.fromEntries(Object.entries(obj(f.bag)).filter(([k, v]) => FISH.some((x) => x.id === k) && typeof v === 'number' && v > 0)) as Record<string, number>,
      rec: Object.fromEntries(
        Object.entries(obj(f.rec))
          .filter(([k]) => FISH.some((x) => x.id === k))
          .map(([k, v]) => [k, { n: Math.max(0, num(obj(v).n)), max: Math.max(0, num(obj(v).max)) }]),
      ) as Record<string, { n: number; max: number }>,
      whaleDay: typeof f.whaleDay === 'string' ? f.whaleDay : '',
      trophies: Math.max(0, num(f.trophies)),
    },
    meal: typeof meal.until === 'number' && typeof meal.v === 'number' ? { until: meal.until, v: meal.v, name: String(meal.name ?? '') } : null,
  };
  void base;
}

// ───────── §3-1 아끼는 영웅 ★ ─────────

export const isFav = (a: Pick<Actor, 'id'> | null | undefined) => !!a && !!a.id && P.growth.favs.includes(a.id);
/** ★ 켜기·끄기 — 못 하면 까닭 */
export function toggleFav(a: Actor): string | null {
  const f = P.growth.favs;
  const i = f.indexOf(a.id);
  if (i >= 0) {
    f.splice(i, 1);
    markDirty();
    return null;
  }
  if (!(a.status === 'regular' || a.status === 'hero')) return '단골·영웅만 ★할 수 있어요';
  // 떠난 손님 번호는 정리
  P.growth.favs = f.filter((id) => homeActors().some((x) => x.id === id));
  if (P.growth.favs.length >= G().favMax) return `★는 ${G().favMax}명까지예요`;
  P.growth.favs.push(a.id);
  markDirty();
  return null;
}
/** 목록 정렬용: ★가 먼저 (★끼리는 ★한 순서) */
export const favRank = (a: Pick<Actor, 'id'>) => {
  const i = P.growth.favs.indexOf(a.id);
  return i < 0 ? 99 : i;
};
/** 지금 마을에 있는 ★ 손님 */
export const favActors = () => P.growth.favs.map((id) => homeActors().find((a) => a.id === id)).filter((a): a is Actor => !!a);

// ───────── §3-3 소모품 ─────────

export function addCharm(n = 1) {
  P.growth.charm += n;
  markDirty();
}
export function addWhet(n = 1) {
  P.growth.whet += n;
  markDirty();
}

// ───────── §3-5 [알림] 자랑 ─────────

export type BragKind = 'unique' | 'relic' | 'enh10' | 'tr15' | 'tr20' | 'set3' | 'fish';
/** 내 이름 (로그인했으면 닉네임 — ui가 채운다) */
export const bragHooks = { name: () => P.owner?.name ?? (S.innName || '주인') };
/** 자랑 문장 (서버가 문장을 만들 때 쓰는 인자도 같이) */
export function bragText(kind: BragKind, it?: Pick<Item, 'name'> | null, extra = ''): string {
  const n = bragHooks.name();
  const x = it?.name ?? extra;
  switch (kind) {
    case 'unique': return `★ ${n}님이 ${x}${josa(x, '을')} 손에 넣었어요!`;
    case 'relic': return `✨ ${n}님이 유물 「${x}」${josa(x, '을')} 손에 넣었어요!`;
    case 'enh10': return `⚒️ ${n}님의 장비 「${x}」${josa(x, '이')} +10 강화에 성공!`;
    case 'tr15': return `🔥 ${n}님의 「${x}」${josa(x, '이')} +15 초월에 성공!`;
    case 'tr20': return `🌟 ${n}님의 「${x}」${josa(x, '이')} +20 극의에 닿았어요!`;
    case 'set3': return `🛡️ ${n}님이 「${x}」 세트 3부위를 처음 완성했어요!`;
    case 'fish': return `🎣 ${n}님이 전설의 물고기 「${x}」${josa(x, '을')} 낚았어요!`;
  }
}
/** 자랑할 수 있나 (끄기 · 같은 사람 10분에 1번 · 같은 종류 하루 3번) — 되면 기록까지 */
export function bragAllowed(kind: BragKind, now = Date.now()): boolean {
  const g = P.growth;
  if (g.bragOff || S.visiting) return false;
  const b = g.brag;
  if (b.day !== today()) {
    b.day = today();
    b.n = {};
  }
  if (now - b.last < G().brag.gapMs) return false;
  if ((b.n[kind] ?? 0) >= G().brag.perKindDay) return false;
  b.last = now;
  b.n[kind] = (b.n[kind] ?? 0) + 1;
  markDirty();
  return true;
}
export function brag(kind: BragKind, it?: Pick<Item, 'name'> | null, extra = ''): boolean {
  if (!bragAllowed(kind)) return false;
  const text = bragText(kind, it, extra);
  // 서버는 「종류|이름」만 받아 문장을 직접 만든다 (아무 글이나 공지에 못 올리게)
  uiHooks.announce(text, 'brag', `${kind}|${(it?.name ?? extra).slice(0, 24)}`);
  return true;
}

/** §3-5: 이 손님이 끼운 장비로 세트 3부위를 처음 완성했으면 자랑 (지역마다 한 번) */
const fullSet = (a: Actor): RegionId | null => {
  const items = SLOTS.map((s) => P.bag.find((x) => x.id === a.equip?.[s])).filter((x): x is Item => !!x && x.set);
  return items.length >= 3 && items.every((x) => x.region === items[0].region) ? items[0].region : null;
};
export function checkSet3(a: Actor) {
  if (!a?.equip || S.visiting) return;
  if (!P.growth.seeded) {
    P.growth.seeded = true;
    for (const x of homeActors()) {
      const r = x === a ? null : fullSet(x);
      if (r && !P.growth.setFirst.includes(r)) P.growth.setFirst.push(r);
    }
  }
  const items = SLOTS.map((s) => P.bag.find((x) => x.id === a.equip[s])).filter((x): x is Item => !!x && x.set);
  if (items.length < 3 || !items.every((x) => x.region === items[0].region)) return;
  const r = items[0].region;
  if (P.growth.setFirst.includes(r)) return;
  P.growth.setFirst.push(r);
  markDirty();
  brag('set3', null, regionById(r as RegionId).set.name);
}

// ───────── §3-4 고유 장비 분해 ─────────

/** 같은 고유 장비를 두 번 이상 얻었으면 분해 가루 ×2 */
export const uniqueSalvageMult = (it: Pick<Item, 'uid'>) => (it.uid && (P.growth.uniques[it.uid] ?? 0) >= 2 ? G().unique.dupDustMult : 1);

// ───────── §2 선물 힌트 ─────────

export const hintKey = (id: string, k: 'like' | 'hate') => `${id}:${k}`;
export const hintSeen = (key: string) => P.growth.hints.includes(key);
function seeHint(key: string) {
  if (!P.growth.hints.includes(key)) {
    P.growth.hints.push(key);
    markDirty();
  }
}
/** 말 걸기: 인연 2단계부터 30% 확률로 기분 대사 대신 힌트 한 줄 (4단계부터 싫어함도) — 없으면 null */
export function talkHint(id: string, stage: number, rng: () => number = Math.random): string | null {
  const h = GIFT_HINTS[id];
  const c = G().hint;
  if (!h || stage < c.stage || rng() >= c.chance) return null;
  if (stage >= c.hateStage && rng() < c.hateShare) {
    seeHint(hintKey(id, 'hate'));
    return h.hate;
  }
  seeHint(hintKey(id, 'like'));
  return h.like[rng() < 0.5 ? 0 : 1];
}
/** [소문] 하루 한 번: 「○○가 요즘 「…」 이런 얘기를 하더라」 (인연을 쌓을 수 있는 사람 중) */
export function rumorHint(avail: (id: string) => boolean, rng: () => number = Math.random): string | null {
  if (P.growth.rumorDay === today()) return null;
  const list = BONDS.filter((d) => GIFT_HINTS[d.id] && avail(d.id));
  if (!list.length) return null;
  const d = list[Math.floor(rng() * list.length)];
  const st = P.ties[d.id]?.stage ?? 1;
  const hate = st >= G().hint.hateStage && rng() < G().hint.hateShare;
  const h = GIFT_HINTS[d.id];
  const line = hate ? h.hate : h.like[rng() < 0.5 ? 0 : 1];
  P.growth.rumorDay = today();
  seeHint(hintKey(d.id, hate ? 'hate' : 'like'));
  return `${d.name}${josa(d.name, '가')} 요즘 「${line.replace(/\{me\}/g, '주인장')}」 이런 얘기를 하더라`;
}

// ───────── §2 단골 선물 (BONDS에 없는 일반 단골 · 직업별 좋아하는 것 1개) ─────────

type GuestKindKey = keyof typeof GUEST_GIFT;
export const guestLikes = (a: Pick<Actor, 'kind'>): GiftKey | null => (GUEST_GIFT[a.kind as GuestKindKey]?.likes as GiftKey) ?? null;
/** 단골 말 걸기에 섞는 힌트 (30%) */
export function guestHint(a: Pick<Actor, 'kind'>, rng: () => number = Math.random): string | null {
  const g = GUEST_GIFT[a.kind as GuestKindKey];
  if (!g || rng() >= G().hint.guestChance) return null;
  seeHint(`guest:${a.kind}`);
  return g.hint;
}
export const guestGiftedToday = (a: Pick<Actor, 'id'>) => P.growth.guestGift[String(a.id)] === today();
/** 선물: 좋아하는 것 → 기분 +20 · 그날 케미 상승 +30% / 아니면 기분 +5 (하루 한 번 · 행동력은 owner가 확인) */
export function guestGiftEffect(a: Actor, g: GiftKey): 'like' | 'normal' {
  const like = guestLikes(a) === g;
  a.mood = Math.min(100, a.mood + (like ? G().guestGift.likeMood : G().guestGift.otherMood));
  P.growth.guestGift[String(a.id)] = today();
  if (like) P.growth.guestGift['chem:' + a.id] = today();
  markDirty();
  return like ? 'like' : 'normal';
}
/** 케미 상승 배수 (둘 중 하나가 오늘 좋아하는 선물을 받았으면) */
export const guestChemMult = (a: Pick<Actor, 'id'>, b: Pick<Actor, 'id'>) =>
  P.growth.guestGift['chem:' + a.id] === today() || P.growth.guestGift['chem:' + b.id] === today() ? G().guestGift.chemMult : 1;

/** §4 물고기 요리: 지금 켜진 원정 금화 +비율 */
export const mealGold = (now = Date.now()) => {
  const m = P.growth?.meal;
  return m && m.until > now ? m.v : 0;
};

/** 선물 이름 */
export const giftName = (g: GiftKey) => GIFTS[g]?.name ?? g;
export const bondName = (id: string) => bondById(id)?.name ?? id;
