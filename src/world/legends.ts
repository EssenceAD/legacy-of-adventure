// 전설 영웅 14명 (3단계 8장): 소문 → 인연 게이지 → 밤 판정(실제 날짜 하루 1번) → 방문 → 부탁 → 영입 → 증표로 ★
import { sfx } from '../audio/sfx';
// 다른 모듈은 legendHooks.bond / legendHooks.req 로만 알린다 (import가 꼬이지 않게).
import { CONFIG } from '../data/config';
import { hfx } from './harmony';
import { josa } from '../data/josa';
import { LEGENDS, legendByKey, type BondEvent, type LegendCtx, type RequestEvent } from '../data/legends';
import { REGIONS } from '../data/items';
import { makeLegend } from './adventurers';
import { arrive, sendAway } from './actors';
import { onNightFlip } from './clock';
import { queueEvent } from './events';
import { dexBonus, heroCtx, stars, today } from './progress';
import { legendHooks, markDirty, P, S, uiHooks, world, type Actor, type LegendState } from './state';
import { entrance, bestOf } from './town';
import { towerStars } from './facilities';
import { addMail } from './meta';
import { addEmber, linkedGauge, linkedScale, meetLinked, tieRequestDone } from './owner';

const L = CONFIG.legends;
const homeActors = () => world.home?.actors ?? world.actors;
const homeObjs = () => world.home?.objs ?? world.objs;
const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

export const legendOf = (key: string): LegendState | undefined => P.legends[key];

// ───────── 소문 조건 ─────────

const lvlOf = (kind: string) => bestOf(kind as never, homeObjs(), true)?.lvl ?? 0;

export function legendCtx(scale = 1): LegendCtx {
  const h = heroCtx();
  const knights = new Set(homeActors().filter((a) => a.kind === 'knight' && a.id).map((a) => a.id));
  return {
    stars: stars(),
    land: world.home?.land ?? S.land,
    trees: h.trees,
    smithLvl: lvlOf('smith'),
    trainingLvl: lvlOf('training'),
    bathLvl: lvlOf('bath'),
    gardenLvl: lvlOf('garden'),
    enhanceMax: P.counters.enhanceMax,
    forestSends: P.counters.forestSends,
    moodTopDays: P.counters.moodTopDays,
    goldTotal: P.counters.goldTotal,
    itemDexRatio: P.dex.items.length / Math.max(1, REGIONS.length * 3 * 4 + 3),
    relicEver: P.counters.relicEver > 0 || P.bag.some((it) => it.grade === 'a'),
    bossKills: (id) => (id ? P.raid.kills[id] ?? 0 : Object.values(P.raid.kills).reduce((s, v) => s + v, 0)),
    heroOwned: (id) => !!P.dex.heroes[id]?.recruited,
    heroStars: (id) => (P.dex.heroes[id]?.recruited ? P.dex.heroes[id].stars : 0),
    knightBondAtLeast: (lv) =>
      Object.entries(P.bonds).some(([k, b]) => b.lv >= lv && k.split('-').some((id) => knights.has(+id))),
    topRankWeeks: P.raid.topWeeks,
    scale,
    need: (n) => Math.ceil(n * scale),
  };
}

/** 소문 조건을 처음 맞춘 영웅: 도감 실루엣 + 힌트, [소문] 채널, 대화창 */
export function checkRumors() {
  const base = legendCtx();
  for (const d of LEGENDS) {
    if (P.legends[d.key]) continue;
    // 주인 출신의 연결 영웅: 필요 수치 70%
    const sc = linkedScale(d.key);
    if (!d.rumorWhen(sc === 1 ? base : legendCtx(sc))) continue;
    P.legends[d.key] = { st: 'rumor', gauge: 0 };
    markDirty();
    uiHooks.rumor(d.rumor);
    queueEvent(() =>
      uiHooks.talk([
        ['narr', '여관에 이상한 소문이 돌기 시작했다…'],
        ['narr', d.rumor],
        ['narr', `방랑자의 서에 새 실루엣이 떠올랐다 — ${d.title} ?`],
      ]),
    );
  }
}

// ───────── 인연 게이지 ─────────

/** 인연 활동: 그 활동을 좋아하는 (소문 열린) 영웅들의 게이지 +1~3% */
export function bond(e: BondEvent, times = 1) {
  if (S.visiting) return;
  for (const d of LEGENDS) {
    const st = P.legends[d.key];
    if (!st || st.st !== 'rumor' || !d.bond.includes(e)) continue;
    for (let i = 0; i < times; i++) st.gauge = Math.min(100, st.gauge + Math.round(rand(L.gaugeMin, L.gaugeMax) * linkedGauge(d.key) * (1 + hfx('legend'))));
    markDirty();
  }
}

// ───────── 밤 판정 (실제 날짜 하루 1번) ─────────

/** 그날 처음 맞는 게임 속 밤(22시)에: 게이지 100% = 확정, 아니면 게이지÷20 % 확률. 한 번에 한 명 */
export function judgeNight() {
  if (S.visiting || !S.started) return;
  const day = today();
  if (P.legendDay === day) return;
  P.legendDay = day;
  if (LEGENDS.some((d) => P.legends[d.key]?.st === 'visit')) return;
  const cands = LEGENDS.filter((d) => P.legends[d.key]?.st === 'rumor');
  const sure = cands.find((d) => P.legends[d.key].gauge >= 100);
  const pickd = sure ?? cands.find((d) => Math.random() * 100 < P.legends[d.key].gauge / L.judgeDiv);
  if (pickd) visit(pickd.key);
  markDirty();
}
onNightFlip((night) => night && judgeNight());

// ───────── 운명의 별 ─────────

/**
 * STARFALL §2: 「별이 쏟아지는 밤」 — 현실 토요일 21~24시(게임 밤과 상관없이). 하늘에 별똥별 여럿 · 하루 3번까지 · 게이지 2배
 */
export const showerOn = (d = new Date()) => d.getDay() === 6 && d.getHours() >= 21;
/** 오늘 잡은 별 수 (옛 저장: 오늘 잡았으면 1) */
export const starsCaught = () => (P.starDay === today() ? (P.starN ?? 1) : 0);
/** 하루 잡을 수 있는 별: 보통 1 (BUILDINGS: 마법사의 탑 Lv5면 +1) · 유성우 밤엔 유성우 수 */
export const starCap = () => (showerOn() ? CONFIG.legends.showerCatches : 1 + towerStars());
/** 오늘 잡을 별이 남았고 소문 열린 영웅이 있으면, 밤하늘(유성우 땐 언제나)에 별똥별 */
export const starAvailable = () => S.started && !S.visiting && (S.night || showerOn()) && starsCaught() < starCap() && LEGENDS.some((d) => P.legends[d.key]?.st === 'rumor');

export interface StarCatch {
  key: string;
  title: string;
  add: number;
  from: number;
  gauge: number;
  shower: boolean;
  msg: string;
}
export function catchStar(): StarCatch | null {
  if (!starAvailable()) return null;
  const n = starsCaught();
  P.starDay = today();
  P.starN = n + 1;
  const cands = LEGENDS.filter((d) => P.legends[d.key]?.st === 'rumor');
  const d = cands[(Math.random() * cands.length) | 0];
  const w = L.starWeights;
  let r = Math.random() * w.reduce((s, v) => s + v, 0);
  let add = 1;
  for (let i = 0; i < w.length; i++) if ((r -= w[i]) < 0) {
    add = i + 1;
    break;
  }
  const shower = showerOn();
  if (shower) add *= 2;
  // DECO_DROP §2: 별빛 정원이 있으면 +1%
  if ((world.home?.objs ?? world.objs).some((o) => o.kind === 'star_garden')) add += 1;
  const st = P.legends[d.key];
  const from = st.gauge;
  st.gauge = Math.min(100, st.gauge + add);
  markDirty();
  return { key: d.key, title: d.title, add, from, gauge: st.gauge, shower, msg: `운명의 별! 「${d.title} ?」의 인연 +${add}% (${st.gauge}%)${shower ? ' · 유성우 2배!' : ''}` };
}

/** STARFALL §2: 금요일에 모모 예고 편지 (그 주에 한 번) */
export function showerLetter(now = new Date()) {
  if (now.getDay() !== 5) return;
  const wk = `${now.getFullYear()}-${Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 864e5))}`;
  if (P.meta.showerWeek === wk) return;
  P.meta.showerWeek = wk;
  markDirty();
  addMail({ from: 'system', title: '모모의 편지 · 내일 밤 유성우래요~', body: '내일(토요일) 밤 9시부터 자정까지 별이 쏟아진대요! 그 시간엔 별똥별을 3번까지 잡을 수 있고, 인연도 두 배로 깊어진대요. 꼭 들러 주세요 ★', reward: {} });
}

// ───────── 방문 · 부탁 ─────────

export function visit(key: string) {
  const d = legendByKey(key)!;
  const st = P.legends[key];
  st.st = 'visit';
  st.until = Date.now() + L.visitDays * 864e5;
  st.prog = 0;
  st.seen = [];
  st.best = 0;
  const [ex, ey] = entrance();
  arrive(makeLegend(key, ex, ey));
  markDirty();
  queueEvent(() =>
    uiHooks.talk([
      ['narr', `금빛 발자국이 마을 입구에 찍혔다… 전설 영웅 「${d.title} ${d.name}」!`],
      ...d.intro.map((t) => ['legend_' + key, t, undefined, d.name] as [string, string, undefined, string]),
      ['legend_' + key, `부탁: ${d.request.text}`, undefined, d.name],
      ['narr', `${L.visitDays}일 안에 부탁을 들어주면 동료가 된다.`],
    ]),
  );
  meetLinked(key);
}

/** 부탁 진행 (방문 중인 영웅 중 그 일을 부탁한 영웅) */
export function req(e: RequestEvent, n = 1, tag?: string) {
  if (S.visiting) return;
  for (const d of LEGENDS) {
    const st = P.legends[d.key];
    if (st?.st !== 'visit' || d.request.event !== e) continue;
    if (tag) {
      // 종류를 세는 부탁 (작물 3종): 처음 보는 것만
      if (st.seen!.includes(tag)) continue;
      st.seen!.push(tag);
    }
    st.prog = (st.prog ?? 0) + n;
    markDirty();
    if (st.prog >= d.request.need) recruit(d.key);
  }
}

/** 'check' 부탁 (조건을 계속 살핀다) · 머무는 기간 끝 */
export function tickLegends() {
  if (S.visiting) return;
  const now = Date.now();
  for (const d of LEGENDS) {
    const st = P.legends[d.key];
    if (st?.st !== 'visit') continue;
    if (d.request.event === 'check' && checkDone(d.key)) {
      recruit(d.key);
      continue;
    }
    if (now > (st.until ?? 0)) fail(d.key);
  }
  checkRumors();
}

function checkDone(key: string): boolean {
  const g = homeActors().filter((a) => !a.role && !a.leaving);
  if (key === 'ceres') return g.filter((a) => a.kind === 'knight' && a.mood >= 80 && !a.legendId).length >= 3;
  if (key === 'leon') return decoScore() >= L.decoNeed;
  return false;
}

/** 마을 장식 점수: 나무·소나무 1 · 우물 4 · 게시판 3 · 모닥불 4 · 트로피 8 · 지붕 색 바꾼 건물 2 */
export function decoScore(): number {
  let s = 0;
  for (const o of homeObjs()) {
    if (o.kind === 'tree' || o.kind === 'pine') s += 1;
    else if (o.kind === 'well') s += 4;
    else if (o.kind === 'board') s += 3;
    else if (o.kind === 'fire') s += 4;
    else if (o.kind.startsWith('trophy')) s += 8;
    else if (o.kind === 'monument') s += 20;
    if (o.hue != null) s += 2;
  }
  return s;
}

const legendActor = (key: string) => homeActors().find((a) => a.legendId === key);

function recruit(key: string) {
  const d = legendByKey(key)!;
  const st = P.legends[key];
  st.st = 'joined';
  sfx('legend');
  const a = legendActor(key);
  if (a) {
    a.status = 'hero';
    a.stars = 1;
  }
  markDirty();
  tieRequestDone(key);
  addEmber(CONFIG.ember.legend);
  uiHooks.announce(`★ ${S.innName || '여관'}에 전설 영웅 「${d.title} ${d.name}」${josa(d.name, '가')} 찾아왔습니다!`, 'legend', `${d.title} ${d.name}`);
  queueEvent(() =>
    uiHooks.talk([
      ['legend_' + key, d.recruit, undefined, d.name],
      ['narr', `${d.title} ${d.name} 영입! 고유 기술 「${d.skill.name}」 · 계정 전투력 +${Math.round(L.dexBonus * 100)}% (지금 ${Math.round(dexBonus() * 100)}%)`],
    ]),
  );
}

function fail(key: string) {
  const d = legendByKey(key)!;
  const st = P.legends[key];
  st.st = 'rumor';
  st.gauge = L.failGauge;
  const a = legendActor(key);
  if (a) sendAway(a, true);
  markDirty();
  uiHooks.toast(`${d.name}${josa(d.name, '가')} 떠났어요… 인연 게이지 ${L.failGauge}% (다시 쌓으면 돼요)`);
}

// ───────── 영입 뒤 ★ (인연의 증표) ─────────

export const tokenNeed = (stars: number) => (stars >= 5 ? null : L.tokenNeeds[stars - 1]);

export function starUpLegend(a: Actor): string | null {
  if (!a.legendId || a.status !== 'hero') return '영입한 전설만 별을 올릴 수 있어요';
  const need = tokenNeed(a.stars ?? 1);
  if (need == null) return '이미 ★5예요';
  if (P.tokens < need) return `인연의 증표가 모자라요 (${P.tokens}/${need})`;
  P.tokens -= need;
  a.stars = (a.stars ?? 1) + 1;
  markDirty();
  if (a.stars === 5) uiHooks.announce(`★ ${a.name}의 유산 무기가 깨어났습니다!`);
  return null;
}

/** 부탁 버튼: 스칼렛에게 바치기 (옵션 붙은 영웅 이상 장비, 소모) · 류카에게 유물 보여 주기 (소모 안 됨) */
export function offerItem(itemId: number): string | null {
  const i = P.bag.findIndex((x) => x.id === itemId);
  const it = P.bag[i];
  if (!it || it.owner != null) return '끼우지 않은 장비만 바칠 수 있어요';
  if (!'ela'.includes(it.grade) || !it.opts.length) return '옵션 붙은 영웅 등급 이상이어야 해요';
  P.bag.splice(i, 1);
  req('offer');
  return null;
}
export function showRelic(): string | null {
  if (!P.bag.some((x) => x.grade === 'a')) return '유물 등급 장비가 없어요';
  req('showRelic');
  return null;
}

/** 새벽(0~5시, 실제 시각) 접속: 하루 한 번 */
export function dawnCheck() {
  const h = new Date().getHours();
  if (h >= 5 || P.dawnDay === today()) return;
  P.dawnDay = today();
  bond('dawnLogin');
}

/** 전설 영입 수 · 증표 */
export const legendsJoined = () => LEGENDS.filter((d) => P.legends[d.key]?.st === 'joined').length;

legendHooks.bond = (e, n) => bond(e as BondEvent, n);
legendHooks.req = (e, n, tag) => req(e as RequestEvent, n, tag);
