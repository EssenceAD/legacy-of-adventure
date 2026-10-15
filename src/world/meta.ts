// 5단계 4장: 업적 · 칭호 · 출석(7일·28일) · 상점(일일 진열) · 우편함 — 가볍게, 전부 progress 안이라 클라우드 저장에도 같이
import { sfx } from '../audio/sfx';
import type { Grade } from '../data/items';
import { addToBag, makeItem } from './items';
import { postMailMult } from './facilities';
import { ACHIEVEMENTS, type AchDef, type AchStat } from '../data/achieve';
import { evalTitles } from './evaluation';
import { GIFT_KEYS, GIFTS, type GiftKey } from '../data/bonds';
import { CONFIG } from '../data/config';
import { FISH } from '../data/story/fish';
import { CATALOG } from '../data/catalog';
import { track } from '../net/telemetry';
import { flag } from './flags';
import { HEROES, HERO_SETS } from '../data/heroes';
import { REGIONS, type RegionId } from '../data/items';
import { LEGENDS } from '../data/legends';
import { gainXp } from './adventurers';
import { chaptersDone, feature, townGrade } from './guide';
import { regionUnlocked, slot5Ready } from './expeditions';
import { stars, today } from './progress';
import { regionFirstDone, regionGuideDone } from './regions2';
import { markDirty, P, S, uiHooks, world, type Mail } from './state';
import { ownerHooks } from './owner';
import { party4Ready } from './party4';
import { chem5Titles, title5 } from './chemNews';
import { fsay } from './visual';
import { achStamp, hvTitles } from './hvLite';
import { petCount, petsOn } from './pets';
import { addFrags, exOn, rwState } from './frags';
import { riftDay } from './riftDay';

const homeActors = () => world.home?.actors ?? world.actors;

// ───────── 업적 ─────────

function stat(k: AchStat, d?: AchDef): number {
  const C = P.counters;
  switch (k) {
    case 'expeditions': return C.expeditions;
    case 'wins': return Object.values(C.regionWins).reduce((s, v) => s + v, 0);
    case 'huntBest': return Object.values(P.hunt.best).reduce((s, v) => s + v, 0);
    case 'huntClears': return C.huntClears;
    case 'raidTries': return C.raidTries;
    case 'bossKills': return Object.values(P.raid.kills).reduce((s, v) => s + v, 0);
    case 'regulars': return homeActors().filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).length;
    case 'heroes': return HEROES.filter((h) => P.dex.heroes[h.id]?.recruited).length + LEGENDS.filter((l) => P.legends[l.key]?.st === 'joined').length;
    case 'chem': return P.dex.chem.length;
    case 'dexGuests': return P.dex.guests.length;
    case 'dexItems': return P.dex.items.length;
    case 'enhance': return C.enhanceMax;
    case 'crafted': return Object.values(C.crafted).reduce((s, v) => s + v, 0);
    case 'harvests': return C.harvests;
    case 'meals': return C.tavernMeals;
    case 'gold': return C.goldTotal;
    case 'land': return world.home?.land ?? S.land;
    case 'innLv': return (world.home?.objs ?? world.objs).find((o) => o.kind === 'inn')?.lvl ?? 1;
    case 'stars': return stars();
    case 'ties5': return Object.values(P.ties).filter((t) => t.stage >= 5).length;
    case 'endings': return P.legacy.album.length;
    case 'attend': return P.meta.attend.total;
    case 'guide': return P.guide.claimed.length;
    case 'gifts': return C.giftsGiven;
    case 'shop': return C.shopBuys;
    case 'talks': return C.guestTalks;
    case 'grade': return townGrade();
    case 'harmony': return P.harmony.found.length;
    case 'events': return C.eventsSolved ?? 0;
    case 'evalBest': return P.evaluation.best;
    case 'taps': return P.counters.taps ?? 0;
    case 'photos': return P.counters.photos ?? 0;
    case 'regFirst': return d?.region && regionFirstDone(d.region) ? 1 : 0;
    case 'regGuide': return d?.region && regionGuideDone(d.region) ? 1 : 0;
    // GROWTH §4
    case 'fishN': return Object.values(P.growth.fish.rec).reduce((s, r) => s + r.n, 0);
    case 'fishKinds': return FISH.filter((x) => (P.growth.fish.rec[x.id]?.n ?? 0) > 0).length;
    case 'fishLegend': return FISH.filter((x) => x.grade === 'l' && (P.growth.fish.rec[x.id]?.n ?? 0) > 0).length;
    // GOLDSINK §8
    case 'diceAch': return d && P.gs?.dice?.ach?.includes(d.id) ? 1 : 0;
    // LUXE §2 (꺼지면 0)
    case 'pets': return petsOn() ? petCount() : 0;
  }
}

export function achProgress(d: AchDef) {
  const cur = stat(d.stat, d);
  return { cur: Math.min(cur, d.need), need: d.need, done: cur >= d.need, claimed: P.meta.ach.includes(d.id) };
}
/** 숨김 업적이 보이나: 이뤘거나 장부 7장을 마쳤으면 */
export const achVisible = (d: AchDef) => !d.hidden || achProgress(d).done || chaptersDone() >= 7;
/** 업적 창에 보이는 목록 (LUXE §2 펫 업적은 플래그 pets가 켜졌을 때만) */
export const achList = (): AchDef[] => ACHIEVEMENTS.filter((d) => d.stat !== 'pets' || petsOn());
/** 받을 수 있는 업적 수 (메뉴 빨간 점) */
export const achReady = () => ACHIEVEMENTS.filter((d) => !P.meta.ach.includes(d.id) && achProgress(d).done).length;

export function claimAch(id: string): AchDef['reward'] | null {
  const d = ACHIEVEMENTS.find((x) => x.id === id);
  if (!d || P.meta.ach.includes(id) || !achProgress(d).done) return null;
  P.meta.ach.push(id);
  sfx('coin');
  if (d.reward.gold) S.gold += d.reward.gold;
  if (d.reward.dust) P.dust.n += d.reward.dust;
  // CHECKIN §D2: 시즌 중 업적 받기 = 연감 도장 1
  achStamp(id);
  markDirty();
  return d.reward;
}

// ───────── 칭호 ─────────

/** 가진 칭호: 업적 · 토벌 첫 처치 · 영웅 세트 · 본 엔딩 */
export function titlesOwned(): { t: string; from: string }[] {
  const out: { t: string; from: string }[] = [];
  for (const d of ACHIEVEMENTS) if (d.reward.title && P.meta.ach.includes(d.id)) out.push({ t: d.reward.title, from: `업적 「${d.name}」` });
  for (const t of P.titles) out.push({ t, from: '토벌 첫 처치' });
  for (const t of evalTitles()) out.push({ t, from: '여관 평가단 골드' });
  for (const s of HERO_SETS) if (s.members.every((m) => P.dex.heroes[m]?.recruited)) out.push({ t: s.title, from: `영웅 세트 「${s.name}」` });
  if (P.legacy.album.length) out.push({ t: '이야기를 끝맺은 자', from: '엔딩 1개 이상' });
  if (P.guide.claimed.length >= 40) out.push({ t: '버나드의 후계자', from: '장부 7장' });
  for (const p of chem5Titles()) out.push({ t: title5(p), from: `케미 「${p.name}」 5단계` });
  // DIRECTION §1-1: 여정을 다 채우면
  if (P.legacy.journeyEnd) out.push({ t: CONFIG.direction.journeyTitle, from: '여정 완주' });
  // HARVEST §1-5 「첫 수확제의 주인」 · CHECKIN §D2 연감 30칸 「수확의 주인」 (영구)
  out.push(...hvTitles());
  // RAIDWEAPON §3' 하늘 균열 그날 피해 1~3위 「균열의 영웅」 — 편지를 받은 균열의 하루 동안만 (다음 05:00 KST까지)
  const rd = riftDay(Date.now());
  for (const m of P.meta.mail) if (m.claimed && m.reward.title && m.reward.titleUntil && m.reward.titleUntil >= rd) out.push({ t: m.reward.title, from: '하늘 균열 (오늘 하루)' });
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.t) ? false : (seen.add(x.t), true)));
}
export function setTitle(t: string) {
  P.meta.title = titlesOwned().some((x) => x.t === t) ? t : '';
  markDirty();
}
/** 이름표에 붙는 칭호 (없으면 '') */
export const myTitle = () => (P.meta.title && titlesOwned().some((x) => x.t === P.meta.title) ? P.meta.title : '');

// ───────── 우편함 ─────────

export function addMail(m: Omit<Mail, 'id' | 'at' | 'claimed'>) {
  P.meta.mail.unshift({ ...m, id: P.meta.mailNext++, at: Date.now(), claimed: false });
  // 오래된 받은 편지는 30통까지만
  const keep = P.meta.mail.filter((x) => !x.claimed).length;
  P.meta.mail = P.meta.mail.slice(0, Math.max(30, keep));
  markDirty();
}
export const mailWaiting = () => P.meta.mail.filter((m) => !m.claimed && hasReward(m)).length;
const hasReward = (m: Mail) => !!(m.reward.gear || m.reward.gold || m.reward.dust || m.reward.tokens || m.reward.shards || m.reward.gift || m.reward.dustR || m.reward.cheer || m.reward.deco || m.reward.frags || m.reward.boxes || m.reward.title);
/** EASTER: 편지를 열 때 화면 쪽이 하는 일 */
export const mailHooks = { pioneer: (_id: string) => {} };
export function claimMail(id: number): Mail['reward'] | null {
  const m = P.meta.mail.find((x) => x.id === id);
  if (!m || m.claimed) return null;
  m.claimed = true;
  if (hasReward(m)) sfx('coin');
  const r = m.reward;
  // BUILDINGS_SPEC: 우체국 — 편지 보상 +%
  const pm = postMailMult();
  if (r.gold) S.gold += Math.round(r.gold * pm);
  if (r.dust) P.dust.n += Math.round(r.dust * pm);
  if (r.tokens) P.tokens += r.tokens;
  if (r.shards) {
    P.hunt.shards += r.shards;
    while (P.hunt.shards >= CONFIG.hunt.shardsPerToken) {
      P.hunt.shards -= CONFIG.hunt.shardsPerToken;
      P.tokens++;
    }
  }
  if (r.gift) P.gifts[r.gift] = (P.gifts[r.gift] ?? 0) + 1;
  // HOTFIX14 §5
  if (r.dustR) P.dust.r += r.dustR;
  if (r.cheer) P.meta.cheerBonus = (P.meta.cheerBonus ?? 0) + r.cheer;
  if (r.deco) P.meta.giftDeco[r.deco] = (P.meta.giftDeco[r.deco] ?? 0) + 1;
  // ONBOARDING §4: 장비 한 개 (가방이 꽉 차면 다음에)
  if (r.gear) addToBag(makeItem('forest', r.gear as Grade));
  // RAIDWEAPON §3' 하늘 균열: 조각 · 선택 상자 (전용 무기가 꺼져 있으면 조각 모듈이 아무것도 안 함) · 하루 칭호는 받은 날까지
  if (r.frags) addFrags(r.frags, 'world');
  if (r.boxes && exOn()) rwState().boxes += Math.floor(r.boxes);
  if (r.title) r.titleUntil = riftDay(Date.now());
  if (m.ver) track('gift_claim', { ver: m.ver });
  // EASTER: 금빛 편지를 열면 컷신
  if (r.pioneer) mailHooks.pioneer(r.pioneer);
  markDirty();
  return r;
}
/** 우편함: 받음·읽음 편지만 지운다 (안 받은 보상이 있는 편지는 못 지움 · 운영자 답장은 서버엔 그대로) */
export function deleteMail(id: number): boolean {
  const i = P.meta.mail.findIndex((m) => m.id === id && m.claimed);
  if (i < 0) return false;
  P.meta.mail.splice(i, 1);
  markDirty();
  return true;
}
export const readMailCount = () => P.meta.mail.filter((m) => m.claimed).length;
export function deleteReadMail(): number {
  const n = readMailCount();
  P.meta.mail = P.meta.mail.filter((m) => !m.claimed);
  if (n) markDirty();
  return n;
}
export function claimAllMail(): number {
  let n = 0;
  for (const m of P.meta.mail) if (!m.claimed && claimMail(m.id)) n++;
  return n;
}
export const rewardLine = (r: Mail['reward']) =>
  [r.gold ? `금화 ${r.gold.toLocaleString('ko-KR')}` : '', r.dust ? `잿빛 가루 ${r.dust}` : '', r.tokens ? `인연의 증표 ${r.tokens}` : '', r.shards ? `증표 조각 ${r.shards}` : '', r.gift ? GIFTS[r.gift as GiftKey]?.name ?? '' : '', r.dustR ? `푸른 가루 ${r.dustR}` : '', r.cheer ? `모모의 응원 ${r.cheer}회` : '', r.deco ? `${(CATALOG as Record<string, { name: string }>)[r.deco]?.name ?? '장식'} 1개` : '', r.gear ? '희귀 장비 1개' : '', r.frags ? `무기 조각 ${r.frags}` : '', r.boxes ? `선택 상자 ${r.boxes}` : '', r.title ? `칭호 「${r.title}」(하루)` : '']
    .filter(Boolean)
    .join(' · ');

// ───────── 출석 (7일 보상판 · 28일 누적) ─────────

/** 7일 보상판 (도는 칸) */
export const ATTEND7: Mail['reward'][] = [{ gold: 200 }, { dust: 40 }, { gift: 'tea' }, { gold: 400 }, { shards: 3 }, { dust: 80 }, { tokens: 1 }];
/** 28일 누적: 7·14·21·28일째 큰 보상 */
export const ATTEND28: Record<number, Mail['reward']> = { 7: { gold: 1000 }, 14: { dust: 200 }, 21: { tokens: 2 }, 28: { gold: 5000, dust: 300 } };

/** 매일 첫 접속(실제 날짜): 도장 → 보상은 우편함으로 */
export function dailyAttend(): number | null {
  const a = P.meta.attend;
  if (a.last === today()) return null;
  a.last = today();
  a.total++;
  const day = ((a.total - 1) % 7) + 1;
  addMail({ from: 'attend', title: `출석 ${a.total}일째 도장`, body: `7일 보상판 ${day}일째 보상이에요.`, reward: ATTEND7[day - 1] });
  const big = ATTEND28[((a.total - 1) % 28) + 1];
  if (big) addMail({ from: 'attend', title: `누적 출석 ${((a.total - 1) % 28) + 1}일 보상`, body: fsay('꾸준히 와 줘서 고마워요!', '꾸준히 들러 주셔서 고마워요!'), reward: big });
  // 출석 3일째: 모모 편지 한 통 — 유저 톡방 (한 번만)
  if (a.total >= 3 && !P.meta.kakaoMail && flag('communityLinks')) {
    P.meta.kakaoMail = true;
    addMail({ from: 'system', title: '💌 모모의 편지', body: '다른 여관 주인님들도 만나 볼래요? 용사님들이 모이는 카톡방이 있어요!', reward: {}, link: 'kakao' });
  }
  return a.total;
}

// ───────── 상점 (일일 진열 5칸 + 고정 품목) ─────────

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  cost: number;
  desc: string;
  can?: () => boolean;
  give: () => void;
  /** GROWTH §3-3 증표 상점: 금화 대신 인연의 증표로 산다 */
  tokens?: number;
}
const regionMats = (r: RegionId, n: number, cost: number): ShopItem => ({
  id: 'mat_' + r, name: `${REGIONS.find((x) => x.id === r)!.mat} ×${n}`, icon: 'cur_seed', cost, desc: '세트 제작 재료', can: () => regionUnlocked(REGIONS.findIndex((x) => x.id === r)),
  give: () => (P.mats[r] += n),
});
export const SHOP_POOL: ShopItem[] = [
  regionMats('forest', 10, 300), regionMats('swamp', 10, 700), regionMats('mine', 10, 1500), regionMats('ice', 10, 3000),
  { id: 'dust_n', name: '잿빛 가루 ×60', icon: 'cur_dust_n', cost: 400, desc: '강화·제작', give: () => (P.dust.n += 60) },
  { id: 'dust_r', name: '푸른 가루 ×20', icon: 'cur_dust_r', cost: 900, desc: '희귀 장비 강화', give: () => (P.dust.r += 20) },
  { id: 'dust_e', name: '보랏빛 가루 ×10', icon: 'cur_dust_e', cost: 2000, desc: '영웅 장비 강화', give: () => (P.dust.e += 10) },
  { id: 'shards', name: '증표 조각 ×2', icon: 'cur_token', cost: 1500, desc: '10개 = 인연의 증표', give: () => (P.hunt.shards += 2) },
  { id: 'xp', name: '모험가의 물약', icon: 'm_heroes', cost: 700, desc: '단골·영웅 모두 경험치 +60', give: () => homeActors().filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).forEach((a) => gainXp(a, 60)) },
  ...GIFT_KEYS.map((g) => ({ id: 'gift_' + g, name: `${GIFTS[g].name} (특가)`, icon: 'm_bond', cost: Math.round(GIFTS[g].cost * 0.7), desc: '인연 선물', give: () => (P.gifts[g] = (P.gifts[g] ?? 0) + 1) })),
];
/** 고정 품목 */
export const SHOP_FIXED: ShopItem[] = [
  { id: 'seed', name: '씨앗 꾸러미', icon: 'cur_seed', cost: 150, desc: '주점 채소 +5 (식사 품질)', give: () => (P.pantry += 5) },
  // GROWTH §3-3: 증표 상점 — 강화 보호 부적 (실패해도 단계가 안 떨어짐)
  { id: 'charm', name: '강화 보호 부적', icon: 'cur_token', cost: 0, tokens: CONFIG.growth.charm.tokenCost, desc: '+7~+10 강화 실패 때 단계 하락을 막아요 (인연의 증표)', give: () => (P.growth.charm += 1) },
];
export function ensureShop() {
  const sh = P.meta.shop;
  if (sh.day === today()) return;
  sh.day = today();
  sh.bought = [];
  const pool = SHOP_POOL.filter((x) => !x.can || x.can());
  const pick: string[] = [];
  while (pick.length < 5 && pool.length) pick.push(pool.splice((Math.random() * pool.length) | 0, 1)[0].id);
  sh.items = pick;
  markDirty();
}
export const shopOpen = () => feature('shop');
export function buyShop(id: string): string | null {
  ensureShop();
  const it = [...SHOP_POOL, ...SHOP_FIXED].find((x) => x.id === id);
  if (!it) return '없는 물건이에요';
  const daily = SHOP_POOL.includes(it);
  if (daily && P.meta.shop.bought.includes(id)) return '오늘은 다 팔렸어요 (내일 새로 들어와요)';
  if (it.tokens) {
    if (P.tokens < it.tokens) return '인연의 증표가 모자라요';
    P.tokens -= it.tokens;
  } else if (S.gold < it.cost) return '금화가 모자라요';
  else S.gold -= it.cost;
  it.give();
  if (daily) P.meta.shop.bought.push(id);
  P.counters.shopBuys++;
  markDirty();
  return null;
}

ownerHooks.mail = (title, body, reward) => addMail({ from: 'prev', title, body, reward });

/** 5단계 처음 켤 때 한 번: 운영자 선물 */
/**
 * 핫픽스 12 §3: 5번째 원정 자리 열기 — 결과 창·게시판·접속 때 확인.
 *  접속 때 열리면(이미 폐광까지 간 저장) 모모 편지, 플레이 중에 열리면 모모가 바로 알려 준다.
 */
export function checkSlot5(login = false): boolean {
  if (P.meta.slot5 || !slot5Ready()) return false;
  P.meta.slot5 = true;
  markDirty();
  if (login) {
    addMail({ from: 'system', title: '모모의 편지 · 원정 자리 하나 더!', body: '그동안 고생하셨어요 — 원정 자리 하나 더! 폐광까지 다녀온 사장님네 단골이라면 다섯 명도 거뜬해요.', reward: {} });
    uiHooks.toast('모모 편지: 원정 5번째 자리가 열렸어요!');
  } else uiHooks.talk([['post', '폐광까지 다녀오셨네요! 이제 원정에 다섯 명까지 데려갈 수 있어요~ 파티 창을 열어 봐요!']]);
  return true;
}

/**
 * PARTY §3: 사냥·토벌 4번째 자리 (훈련장 Lv5 + 장부) — 열리는 순간 모모 편지 한 번 (접속 때·파티 창·건물·장부 때 확인)
 */
export function checkParty4(): boolean {
  if (P.meta.party4 || !party4Ready()) return false;
  P.meta.party4 = true;
  markDirty();
  addMail({ from: 'system', title: '모모의 편지 · 4번째 자리', body: '훈련장 교관이 그러는데, 이제 넷이서도 손발이 맞는대요!', reward: {} });
  uiHooks.toast('모모 편지: 사냥·토벌 4번째 자리가 열렸어요!');
  return true;
}

/**
 * HOTFIX14 §5: 업데이트 선물 — 패치노트에 gift 가 있는 버전에서 처음 켜면 모모 편지 한 통 (버전당 한 번, 원래 하던 플레이어만)
 */
export function updateGift(ver: string, gift: Mail['reward'] | undefined, veteran: boolean) {
  if (!gift || P.meta.giftVer === ver) return;
  P.meta.giftVer = ver;
  markDirty();
  if (!veteran) return;
  addMail({ from: 'system', title: '모모의 편지 · 업데이트 선물', body: '잦은 업데이트로 불편을 드렸어요. 늘 고마워요! 작은 선물을 담았어요~', reward: gift, ver });
  uiHooks.toast(fsay('우편함에 업데이트 선물이 왔어요', '업데이트 선물, 우편함에 넣어 뒀어요'));
}

export function welcomeMail() {
  if (P.meta.welcome) return;
  P.meta.welcome = true;
  addMail({ from: 'admin', title: '운영자 선물 · 5단계 업데이트', body: '사냥터와 버나드의 장부가 열렸어요! 작은 선물을 보내요.', reward: { gold: 1000, dust: 100 } });
  uiHooks.toast(fsay('우편함에 선물이 왔어요', '선물이 와서 우편함에 넣어 뒀어요'));
}
