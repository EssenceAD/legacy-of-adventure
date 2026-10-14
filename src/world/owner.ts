// 4단계: 여관 주인(나) · 인연(호감도) · 방랑의 불씨 · 엔딩 · 유산
import { sfx } from '../audio/sfx';
import { keepMythicSeeds, mythicSeedMoment } from './mythic';
import { grantLegacy } from './story';
// 주인 능력치는 전투력에 「주인 보너스 최대 +15%」로만 들어가고, 인연 단계는 그 영웅 전투력 +2%/단계.
// 다른 world 모듈이 import해도 꼬이지 않게: state · data · events · clock · progress만 쓴다. 창은 ownerHooks로.
import { BONDS, bondById, GIFTS, REPLY, STAGE_NAMES, type BondDef, type GiftKey, type ReplyStyle } from '../data/bonds';
import { hfx } from './harmony';
import { CONFIG } from '../data/config';
import { ENDINGS, endingById, type EndingDef } from '../data/endings';
import { HEROES } from '../data/heroes';
import { fillNames, josa } from '../data/josa';
import { LEGENDS } from '../data/legends';
import { LEGACY_ORIGINS, OSTATS, originByKey, type Gender, type Job, type OStat, type OriginPerk, ORIGINS } from '../data/origins';
import { onNightFlip } from './clock';
import { queueEvent } from './events';
import { repHook, stars, today } from './progress';
import { guestGiftEffect, guestGiftedToday, talkHint } from './growth';
import { FISH } from '../data/story/fish';
import { tavernBoost } from './goldsink';
import { markDirty, P, S, uiHooks, world, type Actor, type OwnerState, type TalkChoice, type TalkLine, type TieState } from './state';
import { windTavern } from './wind';
import { addChronicle } from './chronicle';
import { gatesOn } from './paceGates';

const O = CONFIG.owner;
const T = CONFIG.ties;
const E = CONFIG.ember;
const clamp100 = (v: number) => Math.max(0, Math.min(100, v));
const DAY = 864e5;

export const owner = () => P.owner;

/** ui가 채운다: 초상화 둘 마주보기 대화 · 동료 고르기 · 엔딩 보여 주기 */
export const ownerHooks = {
  duo: (_lines: TalkLine[], _right: string, _done?: () => void, _choices?: TalkChoice[], _bondUp?: boolean) => {},
  partner: (_list: BondDef[], _solo: boolean, _done: (id: string | null) => void) => {},
  ending: (_ids: string[], _partner: string | null, _rel: 'lover' | 'comrade' | undefined) => {},
  /** 우편함 (world/meta가 채운다) */
  mail: (_title: string, _body: string, _reward: { gold?: number }) => {},
  /** 배경음악: 방랑의 불씨 독백·다락 선택 (ui/sound가 채운다) */
  ember: () => {},
};

// ───────── 글자 ─────────

/** {name}=주인 이름 · {inn}=여관 이름 (조사까지) · 형/누나는 주인 성별로 */
export function fillT(s: string): string {
  const o = P.owner;
  const t = fillNames(s, { name: o?.name ?? '주인', inn: S.innName || '여관' });
  return t.replace(/형\/누나/g, o?.gender === 'f' ? '누나' : '형');
}

// ───────── 만들기 ─────────

const BANNED = ['시발', '씨발', '병신', '개새', '좆', '니미', '엿먹', 'fuck', 'shit', 'sex', '섹스', '썅'];
export function nameError(n: string): string | null {
  const v = n.trim();
  if (v.length < O.nameMin || v.length > O.nameMax) return `이름은 ${O.nameMin}~${O.nameMax}자예요`;
  if (/[<>{}\\/"'`]/.test(v)) return '쓸 수 없는 글자가 있어요';
  const low = v.toLowerCase().replace(/\s/g, '');
  if (BANNED.some((w) => low.includes(w))) return '그 이름은 쓸 수 없어요';
  return null;
}

/** 출신 정보 (6개 + 유산 세대 2개) */
export function originInfo(key: string) {
  const o = originByKey(key);
  if (o) return { title: o.title, past: o.past, start: o.start, perkText: o.perkText, cut: o.cut, linked: o.linked };
  const l = LEGACY_ORIGINS.find((x) => x.key === key) ?? LEGACY_ORIGINS[0];
  return { title: l.title, past: l.past, start: l.start, perkText: l.perkText, cut: l.cut, linked: P.legacy.prev?.linked ?? [] };
}
export const originTitle = (o: OwnerState) => originInfo(o.origin).title[o.gender === 'm' ? 0 : 1];

export function createOwner(name: string, gender: Gender, job: Job, origin: string): OwnerState {
  const info = originInfo(origin);
  const o: OwnerState = {
    name: name.trim(), gender, job, origin,
    stats: { ...info.start },
    linked: [...info.linked],
    born: Date.now(),
    statDay: today(), todayGain: {},
    energyDay: today(), energyUsed: 0,
    ember: 0, emberDay: today(), emberToday: 0, emberMarks: [],
    askAt: 0, season: 0, met: [], ended: null,
  };
  P.owner = o;
  markDirty();
  return o;
}

/** ONBOARDING §1: 첫 실행은 기본 주인(「주인장」 · 성별·직업 무작위 외형)으로 — 출신은 장부 1장을 끝낸 뒤 */
export function createPendingOwner(): OwnerState {
  const jobs: Job[] = ['knight', 'warrior', 'rogue', 'mage', 'priest', 'hunter'];
  const job = jobs[(Math.random() * jobs.length) | 0];
  const og = ORIGINS.find((x) => x.job === job)!;
  const o = createOwner('주인장', Math.random() < 0.5 ? 'm' : 'f', job, og.key);
  o.pending = true;
  o.linked = [];
  for (const k of OSTATS) o.stats[k] = 10;
  markDirty();
  return o;
}

/** 저장(클라우드 포함)에서 온 주인 데이터 바로잡기 */
export function sanitizeOwner() {
  const o = P.owner as any;
  if (!o) return;
  if (typeof o.name !== 'string' || !o.job || !o.origin) {
    P.owner = null;
    return;
  }
  o.gender = o.gender === 'f' ? 'f' : 'm';
  o.stats = Object.fromEntries(OSTATS.map((k) => [k, clamp100(Number(o.stats?.[k]) || 0)]));
  o.linked = Array.isArray(o.linked) ? o.linked : [];
  o.todayGain = o.todayGain && typeof o.todayGain === 'object' ? o.todayGain : {};
  o.emberMarks = Array.isArray(o.emberMarks) ? o.emberMarks : [];
  o.met = Array.isArray(o.met) ? o.met : [];
  for (const k of ['born', 'energyUsed', 'ember', 'emberToday', 'askAt', 'season'] as const) o[k] = Number(o[k]) || 0;
  if (!o.born) o.born = Date.now();
  o.ember = clamp100(o.ember);
  o.ended = typeof o.ended === 'string' ? o.ended : null;
  for (const [id, t] of Object.entries(P.ties)) {
    if (!bondById(id) || !t || typeof t !== 'object') delete P.ties[id];
    else {
      t.pts = clamp100(Number(t.pts) || 0);
      t.stage = Math.max(1, Math.min(5, Number(t.stage) || 1));
    }
  }
}

// ───────── 능력치 ─────────

export const stat = (k: OStat) => P.owner?.stats[k] ?? 0;

/** 행동으로 능력치 + (능력치마다 하루 최대) */
export function ownerGain(ev: string) {
  const o = P.owner;
  if (!o || S.visiting) return;
  rollDay();
  const g = O.gain[ev];
  if (!g) return;
  for (const [k, v] of Object.entries(g) as [OStat, number][]) {
    const used = o.todayGain[k] ?? 0;
    const add = Math.min(v, O.actionCapPerDay - used);
    if (add <= 0) continue;
    o.todayGain[k] = used + add;
    o.stats[k] = clamp100(o.stats[k] + add);
  }
  markDirty();
}

/** 실제 날짜가 바뀌었으면: 능력치 전체 + · 불씨 + */
function rollDay() {
  const o = P.owner;
  if (!o) return false;
  const d = today();
  if (o.statDay === d) return false;
  o.statDay = d;
  o.todayGain = {};
  for (const k of OSTATS) o.stats[k] = clamp100(o.stats[k] + O.dailyAll);
  if (!o.ended) o.ember = clamp100(o.ember + E.daily);
  markDirty();
  return true;
}

/** 매일 첫 접속(실제 날짜): 능력치 · 불씨 · 계절 · 앞 주인 편지 · 놓친 인연 이벤트 */
export function dailyOwner() {
  if (!P.owner || S.visiting || !S.started) return;
  rollDay();
  checkSeason();
  prevLetter();
  pendingTieEvents();
}

/** 주인 보너스 (0 ~ 0.15): 담력·체력·마음 */
export function ownerBonus(): number {
  if (!P.owner) return 0;
  const w = O.bonusWeights;
  return (O.bonusMax * (stat('nerve') * w.nerve + stat('hp') * w.hp + stat('heart') * w.heart)) / 100;
}

const perkOf = (p: OriginPerk) => (P.owner && !P.owner.pending && originByKey(P.owner.origin)?.perk === p ? (O.perk as Record<string, number>)[p] ?? 0 : 0);

// ── 효과 (다른 모듈이 곱해 쓴다) ──
const seasonNow = () => (P.owner ? calendar().season : -1);
/** 건물 수입 배율 */
export function incomeMult(act: string): number {
  let m = 1 + legacySum('gold');
  if (act === 'drink') m += (stat('cook') / 100) * O.cookIncome + legacySum('tavern') + windTavern() + (seasonNow() === 2 ? O.seasonBonus : 0) + tavernBoost();
  if (act === 'bath' && seasonNow() === 1) m += O.seasonBonus;
  if (act === 'sleep' && seasonNow() === 3) m += O.seasonBonus;
  return m;
}
/** 손님 기분 오르는 양 배율 */
export const moodMult = () => 1 + perkOf('mood') + legacySum('mood') + (seasonNow() === 0 ? O.seasonBonus : 0);
/** 의뢰 금화 배율 */
export const questGoldMult = () => 1 + (stat('talk') / 100) * O.talkGold + perkOf('trade');
/** 단골 제안 기분 기준을 이만큼 낮춘다 */
export const regularCut = () => (stat('talk') / 100) * O.talkRegular;
/** 강화 성공 +확률 (확정 구간은 그대로) */
export const enhanceBonus = () => (stat('craft') / 100) * O.craftEnhance + perkOf('enhance');
export const trainMult = () => 1 + perkOf('train');
export const expTimeCut = () => perkOf('expTime');
export const raidDmgMult = () => 1 + perkOf('raid');
export const repMult = () => 1 + legacySum('rep');
export const xpMult = () => 1 + legacySum('xp');

// ───────── 달력 (1계절 = 실제 7일, 1년 = 4계절) ─────────

export const SEASONS = ['봄', '여름', '가을', '겨울'];
export function calendar() {
  const o = P.owner;
  const days = o ? Math.max(0, Math.floor((Date.now() - o.born) / DAY)) : 0;
  const si = Math.floor(days / O.seasonDays);
  return { days, index: si, year: Math.floor(si / 4) + 1, season: si % 4, name: SEASONS[si % 4], dayIn: (days % O.seasonDays) + 1 };
}

const SEASON_TALK = [
  '봄이다. 여관 앞 들꽃이 피었다. 손님들 얼굴도 한결 밝다.',
  '여름이다. 시원한 물이 그리운 계절. 그래도 온천 손님은 줄지 않는다.',
  '가을이다. 주점의 스튜 냄새가 유난히 좋은 계절이다.',
  '겨울이다. 눈 오는 밤엔 빈 방이 없다. 모닥불이 고맙다.',
];
export const SEASON_EVENT = ['손님 기분', '온천 수입', '주점 수입', '숙박 수입'];
const HUE_NAME = ['분홍', '하늘색', '주황', '눈빛 파랑'];

function checkSeason() {
  const o = P.owner;
  if (!o) return;
  const c = calendar();
  if (c.index <= o.season) return;
  o.season = c.index;
  markDirty();
  queueEvent(() =>
    uiHooks.talk([
      ['narr', `${c.year}년 차 ${c.name}이 왔다.`],
      ['me', SEASON_TALK[c.season]],
      ['narr', `${c.name} 추천 지붕 색: ${HUE_NAME[c.season]} · 계절 행사: ${SEASON_EVENT[c.season]} +${Math.round(O.seasonBonus * 100)}%`],
    ]),
  );
}

// ───────── 행동력 (말 걸기·선물) ─────────

export const energyMax = () => O.energyBase + Math.floor(stat('hp') / O.energyPerHp);
export function energyLeft(): number {
  const o = P.owner;
  if (!o) return 0;
  if (o.energyDay !== today()) {
    o.energyDay = today();
    o.energyUsed = 0;
  }
  return Math.max(0, energyMax() - o.energyUsed);
}
function useEnergy() {
  energyLeft();
  P.owner!.energyUsed++;
}

// ───────── 인연 ─────────

/** 인연을 쌓을 수 있나: 마을 사람은 늘, 영웅은 동료가 된 뒤, 전설은 영입한 뒤 */
export function tieAvailable(id: string): boolean {
  const d = bondById(id);
  if (!d || !P.owner) return false;
  if (d.who === 'villager') return true;
  if (d.who === 'hero') return !!P.dex.heroes[id]?.recruited;
  return P.legends[id]?.st === 'joined';
}

export function tie(id: string): TieState {
  let t = P.ties[id];
  if (!t) t = P.ties[id] = { pts: 0, stage: 1, talkDay: '', giftDay: '', knowLike: false, knowHate: false };
  return t;
}
export const stageOf = (pts: number) => Math.min(5, 1 + Math.floor(pts / T.perStage));
export const stageName = (s: number) => STAGE_NAMES[Math.max(0, Math.min(4, s - 1))];
/** 그 사람의 지금 단계 (이벤트를 본 단계) */
export const tieStage = (id: string) => P.ties[id]?.stage ?? 1;

const isLinked = (id: string) => !!P.owner?.linked.includes(id);
const heartMult = () => 1 + (stat('heart') / 100) * T.heartSpeed;

/** 인연 +n (마음·연결 영웅 배율). raw면 배율 없이 */
export function addTie(id: string, n: number, raw = false) {
  if (!tieAvailable(id) || S.visiting) return;
  const t = tie(id);
  const v = raw || n < 0 ? n : n * heartMult() * (isLinked(id) ? T.linkedMult : 1);
  t.pts = clamp100(t.pts + v);
  markDirty();
  maybeEvent(id);
}

/** 수치가 다음 단계에 닿았으면 인연 이벤트를 줄 세운다 (한 사람에 하나씩) */
function maybeEvent(id: string) {
  const t = P.ties[id];
  if (!t || stageOf(t.pts) <= t.stage) return;
  sfx('heart');
  queueEvent(() => tieEvent(id), 'tie:' + id);
}
/** 놓친 인연 이벤트 다시 (접속 때) */
export function pendingTieEvents() {
  for (const id of Object.keys(P.ties)) if (tieAvailable(id)) maybeEvent(id);
}

const STAGE_CHOICES: Record<number, [string, string]> = {
  2: ['웃으며 이름을 불러 준다', '가볍게 고개를 끄덕인다'],
  3: ['내 이야기도 들려준다', '가만히 들어 준다'],
  4: ['어깨를 토닥여 준다', '"걱정 마"라고 말해 준다'],
};
const PLACE = ['', '', '여관 앞에서', '모닥불 곁에서', '달빛 드는 다락 창가에서', '마을 끝 언덕에서'];

/** 대사 한 줄 → 대화창 줄 ('>'면 나) */
export function evLine(d: BondDef, s: string): TalkLine {
  return s.startsWith('>') ? ['me', fillT(s.slice(1))] : [d.port, fillT(s), undefined, d.name];
}

/** 이벤트 마무리 한 줄 */
const closing = (d: BondDef, st: number, rel?: 'lover' | 'comrade'): TalkLine => ['narr', `${d.name}${josa(d.name, '과')}의 사이가 「${stageName(st)}」${josa(stageName(st), '이')} 되었다.${rel ? (rel === 'lover' ? ' 두 사람은 연인이 되었다.' : ' 두 사람은 평생의 전우가 되었다.') : ''}`];

/** 인연 이벤트: 초상화 마주보기 + 대사 + 선택지 1개 (5단계는 연인/전우) */
export function tieEvent(id: string) {
  const d = bondById(id)!;
  const t = tie(id);
  const next = t.stage + 1;
  if (next > 5 || stageOf(t.pts) < next) return;
  const lines: TalkLine[] = [['narr', `${PLACE[next]}, ${d.name} — 인연 「${stageName(next)}」`], ...d.ev[next - 2].map((s) => evLine(d, s))];
  const after = () => {
    t.stage = next;
    if (isLinked(id)) addEmber(E.linkedEvent);
    markDirty();
    uiHooks.toast(`${d.name}${josa(d.name, '과')}의 인연: ${stageName(next)}${next === 5 ? ` · ${t.rel === 'lover' ? '연인' : '전우'}` : ''}`);
    maybeEvent(id);
  };
  let choices: TalkChoice[];
  if (next === 5) {
    // MYTHIC: 전설과 인연 5 → 다음 여관에서 신화로
    mythicSeedMoment(id);
    choices = (['lover', 'comrade'] as const).map((rel) => ({
      label: rel === 'lover' ? '연인이 되자' : '평생의 전우가 되자',
      fn: () => {
        t.rel = rel;
        ownerHooks.duo([evLine(d, rel === 'lover' ? d.lover : d.comrade), closing(d, next, rel)], d.port, after, undefined, true);
      },
    }));
  } else {
    const [a, b] = STAGE_CHOICES[next];
    const pick = (n: number) => () =>
      ownerHooks.duo([evLine(d, d.good), closing(d, next)], d.port, () => {
        t.pts = clamp100(t.pts + n);
        after();
      });
    choices = [{ label: a, fn: pick(T.choiceGood) }, { label: b, fn: pick(T.choiceMeh) }];
  }
  ownerHooks.duo(lines, d.port, undefined, choices, true);
}

const AFTER_LINES = [
  '그날 이후로 {name}, 얼굴이 한결 편해 보여요.',
  '{name}, 그 이야기 또 들려줘요. 끝 말고, 그다음 이야기.',
  '떠날 수도 있었는데 여기 있어 줘서… 아니, 아무것도 아니에요.',
  '다락의 옛 장비, 요즘은 안 쳐다보네요?',
];

/** 하루 한 번 말 걸기: 그날 기분 대사 + 3지선다. 못 하면 이유 */
export function talkTo(id: string): string | null {
  const d = bondById(id);
  if (!d || !tieAvailable(id)) return '아직 인연을 쌓을 수 없어요';
  const t = tie(id);
  // PACE R17: 하루 talkPerDay번 (paceGates · 끄면 1번)
  const talkMax = gatesOn() ? O.talkPerDay : 1;
  if (t.talkDay === today() && (t.talkN ?? 1) >= talkMax) return talkMax > 1 ? `오늘은 ${talkMax}번 다 이야기했어요 (내일 또)` : '오늘은 이미 이야기했어요 (내일 또)';
  if (energyLeft() <= 0) return '오늘은 기운이 없어요 (내일 또 · 체력이 오르면 더 많이)';
  useEnergy();
  t.talkN = t.talkDay === today() ? (t.talkN ?? 1) + 1 : 1;
  t.talkDay = today();
  ownerGain('talk');
  markDirty();
  const day = Math.floor(Date.now() / DAY);
  // 엔딩을 본 뒤(계속 운영)에는 대화가 조금 바뀐다
  const after = P.owner?.ended && (day + id.length) % 2 === 0;
  // GROWTH §2: 인연 2단계부터 가끔 기분 대사 대신 선물 힌트 (직접 말하지 않음)
  const hint = after ? null : talkHint(id, t.stage);
  const mood = hint ? hint.replace(/{me}/g, P.owner?.name ?? '주인장') : after ? AFTER_LINES[(day + id.length) % AFTER_LINES.length] : d.moods[(day + id.length) % d.moods.length];
  const styles: ReplyStyle[] = ['warm', 'bold', 'tease'];
  uiHooks.talk([[d.port, fillT(mood), undefined, d.name]], undefined, styles.map((st) => ({
    label: REPLY[st],
    fn: () => {
      const ok = st === d.style;
      uiHooks.talk([[d.port, fillT(ok ? d.good : d.meh), undefined, d.name]], () => addTie(id, (ok ? T.talkGood : T.talkMeh) + hfx('talkBond')));
    },
  })));
  return null;
}

// ── 선물 ──
export function buyGift(g: GiftKey): string | null {
  const c = GIFTS[g].cost;
  if (S.gold < c) return '금화가 모자라요';
  S.gold -= c;
  P.gifts[g] = (P.gifts[g] ?? 0) + 1;
  markDirty();
  return null;
}
/** 선물: 좋아하는 것 +8 · 보통 +3 · 싫어하는 것 -3 (마음이 높을수록 +). 효과는 사람마다 하루 한 번 */
export function giveGift(id: string, g: GiftKey): { err?: string; kind?: 'like' | 'hate' | 'normal'; line?: string } {
  const d = bondById(id);
  if (!d || !tieAvailable(id)) return { err: '아직 인연을 쌓을 수 없어요' };
  if (!(P.gifts[g] > 0)) return { err: '그 선물이 가방에 없어요' };
  const t = tie(id);
  if (t.giftDay === today()) return { err: '오늘은 이미 선물했어요 (내일 또)' };
  if (energyLeft() <= 0) return { err: '오늘은 기운이 없어요 (내일 또)' };
  useEnergy();
  P.gifts[g]--;
  P.counters.giftsGiven++;
  t.giftDay = today();
  ownerGain('gift');
  const kind = g === d.likes ? 'like' : g === d.hates ? 'hate' : 'normal';
  if (kind === 'like') t.knowLike = true;
  if (kind === 'hate') t.knowHate = true;
  const base = kind === 'like' ? T.giftLike : kind === 'hate' ? T.giftHate : T.giftNormal;
  addTie(id, base > 0 ? base * (1 + (stat('heart') / 100) * T.heartGift) * (isLinked(id) ? T.linkedMult : 1) : base, true);
  const line = kind === 'like' ? `「${GIFTS[g].name}」! 이거 정말 좋아해요!` : kind === 'hate' ? `「${GIFTS[g].name}」…? 이건 좀…` : `「${GIFTS[g].name}」, 고마워요.`;
  return { kind, line };
}

/** GROWTH §4: 물고기 선물 — 좋아하는 사람(fish.ts like)이면 좋아함과 같은 인연 + · 아니면 보통 (하루 한 번·행동력은 giveGift와 같다) */
export function giveFish(id: string, fishId: string): { err?: string; kind?: 'like' | 'normal'; line?: string } {
  const d = bondById(id);
  const f = FISH.find((x) => x.id === fishId);
  if (!d || !tieAvailable(id)) return { err: '아직 인연을 쌓을 수 없어요' };
  if (!f || !f.use.includes('gift') || !((P.growth.fish.bag[fishId] ?? 0) > 0)) return { err: '그 물고기가 가방에 없어요' };
  const t = tie(id);
  if (t.giftDay === today()) return { err: '오늘은 이미 선물했어요 (내일 또)' };
  if (energyLeft() <= 0) return { err: '오늘은 기운이 없어요 (내일 또)' };
  useEnergy();
  P.growth.fish.bag[fishId]--;
  if (P.growth.fish.bag[fishId] <= 0) delete P.growth.fish.bag[fishId];
  P.counters.giftsGiven++;
  t.giftDay = today();
  ownerGain('gift');
  const like = !!f.like?.includes(id);
  if (like && !P.growth.fishLike.includes(`${id}:${fishId}`)) P.growth.fishLike.push(`${id}:${fishId}`);
  const base = like ? T.giftLike : T.giftNormal;
  addTie(id, base * (1 + (stat('heart') / 100) * T.heartGift) * (isLinked(id) ? T.linkedMult : 1), true);
  return { kind: like ? 'like' : 'normal', line: like ? `「${f.name}」! 이거 정말 좋아해요!` : `「${f.name}」, 고마워요.` };
}
/** GROWTH §2: 일반 단골에게 선물 (직업별 좋아하는 것 1개) — 하루 한 번 · 행동력 1 */
export function giveGuest(a: Actor, g: GiftKey): { err?: string; kind?: 'like' | 'normal'; line?: string } {
  if (!P.owner) return { err: '주인을 만들면 선물할 수 있어요' };
  if (!(P.gifts[g] > 0)) return { err: '그 선물이 가방에 없어요' };
  if (guestGiftedToday(a)) return { err: '오늘은 이미 선물했어요 (내일 또)' };
  if (energyLeft() <= 0) return { err: '오늘은 기운이 없어요 (내일 또)' };
  useEnergy();
  P.gifts[g]--;
  P.counters.giftsGiven++;
  ownerGain('gift');
  const kind = guestGiftEffect(a, g);
  markDirty();
  return { kind, line: kind === 'like' ? `「${GIFTS[g].name}」! 마침 이게 필요했어요!` : `「${GIFTS[g].name}」, 고마워요.` };
}

// ── 함께 원정·토벌 · 부탁 완수 (다른 모듈이 부른다) ──
const tieIdOf = (a: Actor) => a.legendId ?? a.heroId;
export function tieRun(members: Actor[]) {
  for (const a of members) {
    const id = tieIdOf(a);
    if (id) addTie(id, T.runTogether);
  }
}
export function tieRaid(members: Actor[]) {
  for (const a of members) {
    const id = tieIdOf(a);
    if (id) addTie(id, T.raidTogether);
  }
}
/** 동료가 됐다 (영웅 부탁·전설 부탁 완수): 인연 + */
export function tieRequestDone(id: string) {
  addTie(id, T.requestDone);
}
/** 연결 영웅이 처음 찾아왔다: 전용 재회 대사 (방문 대사 뒤에) */
export function meetLinked(id: string) {
  const o = P.owner;
  const og = o && originByKey(o.origin);
  if (o && og && o.linked.includes(id) && !o.met.includes(id) && og.reunion[id]) {
    o.met.push(id);
    const d = bondById(id)!;
    queueEvent(() => ownerHooks.duo([['narr', `${d.name} — 옛 인연과의 재회`], ...og.reunion[id].map((s) => evLine(d, s))], d.port), 'reunion:' + id);
  }
}

/** 인연 단계 보너스: (단계 - 1) × 2% */
export function bondTierBonus(a: Actor): number {
  const id = tieIdOf(a);
  if (!id || !P.owner) return 0;
  return (tieStage(id) - 1) * T.stagePower;
}

/** 연결 영웅: 소문 조건 70% · 인연 게이지 1.3배 */
export const linkedScale = (key: string) => (isLinked(key) ? 0.7 : 1);
export const linkedGauge = (key: string) => (isLinked(key) ? T.linkedMult : 1);

// ───────── 방랑의 불씨 ─────────

/** 불씨 + (행동이면 하루 최대까지) */
export function addEmber(n: number, action = true) {
  const o = P.owner;
  if (!o || o.ended || S.visiting) return;
  if (action) {
    if (o.emberDay !== today()) {
      o.emberDay = today();
      o.emberToday = 0;
    }
    n = Math.min(n, E.actionCapPerDay - o.emberToday);
    if (n <= 0) return;
    o.emberToday += n;
  }
  o.ember = clamp100(o.ember + n);
  markDirty();
}

/** 불씨를 한 줄로 (숫자는 숨긴다) */
export function emberText(): string {
  const e = P.owner?.ember ?? 0;
  if (P.owner?.ended) return '불씨는 조용히, 하지만 꺼지지 않고 남아 있다';
  return e >= 90 ? '가슴속 불씨가 활활 타오른다' : e >= 60 ? '가슴속 불씨가 일렁인다' : e >= 30 ? '가슴속에 작은 불씨가 깜빡인다' : '가슴속 불씨는 아직 조용하다';
}

/** 후계자: 버나드 인연 3단계 이상 또는 Lv15 이상 단골 */
export function heirName(): string | null {
  if (tieStage('bernard') >= E.heirBernard) return '노주인 버나드';
  const home = world.home?.actors ?? world.actors;
  const r = home.find((a) => !a.role && a.status === 'regular' && a.lvl >= E.heirLevel);
  return r ? `단골 ${r.name}` : null;
}
/** 같이 떠날 수 있는 동료: 인연 5단계 영웅·전설 */
export const companions = () => BONDS.filter((d) => d.who !== 'villager' && tieAvailable(d.id) && tieStage(d.id) >= 5);
export const canSolo = () => stat('nerve') >= E.soloNerve;

export function canDecide(): boolean {
  const o = P.owner;
  return !!o && !o.ended && decideDaysNow() >= E.decideDays && o.ember >= 100 && Date.now() >= o.askAt;
}
/** 불씨 결심 「며칠째」: 현실 일수 · PACE R17 시계(paceGates) — 이 회차 게임 일수 ÷ 8도 같이 세서 큰 쪽 */
export function decideDaysNow(): number {
  const real = calendar().days;
  if (!gatesOn()) return real;
  const game = Math.max(0, S.day - (P.story?.day0 ?? 1) + 1);
  return Math.max(real, Math.floor(game / CONFIG.paceGates.decideGameDiv));
}

const LEGACY_EMBERS = ['다락의 옛 장비가 달빛에 반짝인다. 앞 주인이 두고 간 것이다.', '앞 주인이 남긴 지도를 펼쳐 본다. 빈칸이 많다.', '꿈에서 앞 주인이 불렀다. "이제 네 차례다."'];

/** 밤이 되면: 불씨 30/60/90 독백 · 2년 차 + 100이면 선택 */
export function nightOwner(night: boolean) {
  const o = P.owner;
  if (!night || !o || !S.started || S.visiting || o.ended) return;
  const og = originByKey(o.origin);
  E.marks.forEach((m, i) => {
    if (o.ember < m || o.emberMarks.includes(m)) return;
    o.emberMarks.push(m);
    markDirty();
    const text = og ? og.embers[i] : LEGACY_EMBERS[i];
    queueEvent(() => {
      ownerHooks.ember();
      uiHooks.talk([['narr', '밤. 다락 창으로 달빛이 들어온다.'], ['me', fillT(text)]]);
    }, 'ember' + m);
  });
  if (canDecide()) queueEvent(askDecision, 'decide');
}
onNightFlip(nightOwner);

/** 「다락의 옛 장비 앞에 선다」: 다시 떠난다 / 아직은 아니야 / 여기가 내 자리다 */
export function askDecision() {
  if (!canDecide()) return;
  ownerHooks.ember();
  const heir = heirName();
  const comps = companions();
  const canGo = !!heir && (comps.length > 0 || canSolo());
  const lines: TalkLine[] = [['narr', fillT('밤. {name}은 다락의 옛 장비 앞에 섰다.')], ['me', '…다시 떠날 때가 온 걸까.']];
  if (!heir) lines.push(['narr', `여관을 맡길 사람이 아직 없다 (버나드와 인연 「${stageName(E.heirBernard)}」 이상 또는 Lv${E.heirLevel} 단골)`]);
  else if (!comps.length && !canSolo()) lines.push(['narr', `함께 갈 인연 「인연」 단계 동료가 없고, 홀로 가기엔 담력이 모자라다 (담력 ${E.soloNerve})`]);
  else lines.push(['narr', `여관은 ${heir}에게 맡길 수 있다.`]);
  const choices: TalkChoice[] = [
    {
      label: '다시 떠난다',
      // 아직 못 떠나면 이유를 말하고 다시 묻는다
      fn: () => (canGo ? ownerHooks.partner(comps, canSolo(), (id) => finishEnding(id === null ? 'solo' : 'go', id)) : uiHooks.talk([['me', '…아니, 아직은 떠날 수 없어. 여관을 맡길 사람도, 함께 갈 사람도 없으니.']], askDecision)),
    },
    { label: '아직은 아니야', fn: notYet },
    { label: '여기가 내 자리다', fn: () => finishEnding('stay', null) },
  ];
  uiHooks.talk(lines, undefined, choices);
}

function notYet() {
  const o = P.owner!;
  o.ember = E.notYet;
  o.askAt = Date.now() + E.askAgainDays * DAY;
  o.emberMarks = o.emberMarks.filter((m) => m <= E.notYet);
  markDirty();
  uiHooks.talk([['me', '…아직은 아니야. 이 여관엔 내가 필요해.'], ['narr', `불씨가 잦아들었다. (${E.askAgainDays}일 뒤 다시)`]]);
}

// ───────── 엔딩 ─────────

const heroesOwned = () => HEROES.filter((h) => P.dex.heroes[h.id]?.recruited).length + LEGENDS.filter((l) => P.legends[l.key]?.st === 'joined').length;

/** 여관 엔딩: 조건 순서대로 첫 번째 */
export function innEnding(): string {
  const s = stars();
  if (s >= 5 && stat('talk') >= 80 && stat('heart') >= 80) return 'inn_legend';
  if (s >= 5 && (tieStage('leon') >= 4 || tieStage('ceres') >= 4)) return 'inn_royal';
  if (stat('cook') >= 95) return 'inn_gourmet';
  if (heroesOwned() >= 20) return 'inn_home';
  return 'inn_simple';
}

/** 엔딩을 정해 앨범에 남기고 보여 준다. 진짜 엔딩이면 그 동료의 모험 엔딩도 함께 남는다 */
export function finishEnding(kind: 'go' | 'solo' | 'stay', partner: string | null) {
  const o = P.owner!;
  const ids: string[] = [];
  let rel: 'lover' | 'comrade' | undefined;
  if (kind === 'stay') ids.push(innEnding());
  else if (kind === 'solo') ids.push('solo');
  else if (partner) {
    rel = P.ties[partner]?.rel;
    const og = originByKey(o.origin);
    if (og && og.linked.includes(partner) && endingById('true_' + og.key)) ids.push('true_' + og.key);
    ids.push('adv_' + partner);
  }
  if (!ids.length) return;
  // STORY_V1 §5: 엔딩마다 유산 포인트(처음 보는 엔딩은 더) · 기억 조각 하나
  grantLegacy(ids, ids.filter((id) => !P.legacy.album.includes(id)));
  for (const id of ids) {
    if (!P.legacy.seen.includes(id)) P.legacy.seen.push(id);
    if (!P.legacy.album.includes(id)) P.legacy.album.push(id);
    P.legacy.cards[id] = { at: Date.now(), gen: P.legacy.gen, owner: o.name, job: o.job, gender: o.gender, partner: partner ?? undefined, rel };
  }
  o.ended = ids[0];
  o.ember = 0;
  // DIRECTION §1-3: 여관 연대기 한 쪽
  addChronicle(ids[0]);
  markDirty();
  ownerHooks.ending(ids, partner, rel);
}

/** 유산 보너스 합 (본 엔딩마다 한 번) */
export function legacySum(k: 'power' | 'rep' | 'gold' | 'xp' | 'mood' | 'tavern'): number {
  let s = 0;
  for (const id of P.legacy.seen) {
    const b = endingById(id)?.bonus;
    if (b && b.k === k) s += b.v;
  }
  return s;
}
export function legacyPower(a: Actor): number {
  let s = legacySum('power');
  for (const id of P.legacy.seen) {
    const b = endingById(id)?.bonus;
    if (b?.k === 'kindPower' && b.kind === a.kind) s += b.v;
  }
  return s;
}
export function bonusText(e: EndingDef): string {
  const b = e.bonus;
  const pct = `+${Math.round(b.v * 100)}%`;
  if (b.k === 'kindPower') return `${({ knight: '기사', mage: '마법사', dwarf: '전사', rogue: '도적', cleric: '사제', hunter: '사냥꾼' } as const)[b.kind]} 계열 전투력 ${pct}`;
  return ({ power: '모든 전투력', rep: '평판', gold: '모든 건물 수입', xp: '경험치', mood: '손님 기분', tavern: '주점 수입' } as const)[b.k] + ' ' + pct;
}
export const albumCount = () => `${P.legacy.album.length}/${ENDINGS.length}`;

/** 앨범 바로잡기: 4단계 첫 배포 저장은 album이 없다 → 본 엔딩(seen)으로 채운다 */
export function sanitizeAlbum() {
  const L = P.legacy;
  L.album = [...new Set([...(Array.isArray(L.album) ? L.album : []), ...(Array.isArray(L.seen) ? L.seen : [])])].filter((id) => !!endingById(id));
  L.seen = (Array.isArray(L.seen) ? L.seen : []).filter((id) => !!endingById(id));
  if (!L.cards || typeof L.cards !== 'object') L.cards = {};
}

/** 유산을 잇는다: 마을·건물·영웅·도감·트로피는 그대로, 주인·인연·불씨·달력만 새로 */
export function inheritLegacy(name: string, gender: Gender, job: Job, origin: string) {
  const o = P.owner!;
  P.legacy.prev = { name: o.name, job: o.job, gender: o.gender, origin: o.origin, ending: o.ended ?? '', linked: [...o.linked] };
  P.legacy.gen++;
  keepMythicSeeds();
  P.ties = {};
  createOwner(name, gender, job, origin);
}

/** 앞 주인 편지 (모모 배달, 하루 한 번 확률) */
const LETTERS = [
  '잘 지내나? 여관 지붕은 새로 칠했는지 궁금하군. 나는 잘 있다네.',
  '길 위에서 {inn} 이야기를 들었어. 손님들이 칭찬하더라. 자랑스럽다.',
  '여긴 별이 아주 잘 보여. 다락 창문으로 보던 별보다 조금 더 크다.',
  '버나드 영감에게 안부 전해 줘. 낚시 내기는 내가 이겼다고.',
  '가끔 스튜 냄새가 그리워. 비법은 잊지 않았겠지?',
];
function prevLetter() {
  const p = P.legacy.prev;
  if (!p || P.legacy.letterDay === today()) return;
  P.legacy.letterDay = today();
  markDirty();
  if (Math.random() >= E.letterChance) return;
  const t = LETTERS[(Math.random() * LETTERS.length) | 0];
  queueEvent(() => uiHooks.talk([['post', `편지 왔어요! 앞 주인 ${p.name}님이 보냈어요!`], ['narr', fillT(t)]]), 'letter' + today());
  // 우편함에도 남긴다 (작은 용돈과 함께)
  ownerHooks.mail(`앞 주인 ${p.name}의 편지`, fillT(t), { gold: 300 });
}

// 평판 + (유산 보너스): progress.addRep이 부른다
repHook.mult = () => repMult();
