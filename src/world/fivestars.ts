// FIVESTARS 「다섯 별의 원정대」 (플래그 fiveStars · 실험실 vis) — 화면 없는 규칙 (화면은 ui/fivestars.ts)
//  3막 편지 다음 모모 편지 → 장부 3막 장 5칸(개척자 다섯의 부탁 · 받은 순간 기준값 = mythic.ts base()와 같은 방식)
//  → 칸을 채우면 그 개척자가 찾아와 신화 영웅으로 합류(starId · status 'hero' = 단골 정원에 들고 내보내기 불가 · 파티 후보 그대로)
//  → 다섯 다 모이면 마지막 컷 · 보상 1번(열쇠 조각 · 「다섯 별 깃발」 · 칭호) · 밤마다 별자리
//  플래그를 끄면: 장·편지·컷·스킬·세트·별자리 모두 멈춤 (이미 합류한 영웅·받은 것은 지우지 않는다)
import { CONFIG } from '../data/config';
import { HARMONIES } from '../data/harmony';
import { REGIONS, type OptKey } from '../data/items';
import { isStarId, STAR_IDS, STARS, type StarId } from '../data/fivestars';
import { FIVE_SET_LINE, OSWIN_TALE, STARS as STAR_LINES } from '../data/story/fivestars';
import { FIVE_SHARD, FIVE_TITLE } from '../data/story/fivestars_extra';
import type { SLine } from '../data/story/v1';
import { track } from '../net/telemetry';
import { makeAdventurer } from './adventurers';
import { absHours } from './clock';
import { kstDay } from './goldsink';
import { equippedItems } from './items';
import { vis } from './visual';
import { freshFive, markDirty, P, S, world, type Actor, type FiveBase, type FiveState } from './state';

const C = () => CONFIG.fiveStars;
/** 켜졌나: 플래그(모두) 또는 실험실(이 기기) */
export const fiveOn = (): boolean => vis('fiveStars');
const homeActors = (): Actor[] => world.home?.actors ?? world.actors;
const homeObjs = () => world.home?.objs ?? world.objs;

/** 빈 칸 바로잡기 (옛 저장 · 모양이 이상한 값) */
export function fiveState(): FiveState {
  const f = (P.five ??= freshFive());
  const d = freshFive();
  for (const k of Object.keys(d) as (keyof FiveState)[]) {
    const v = f[k] as unknown;
    const b = d[k] as unknown;
    if (Array.isArray(b) ? !Array.isArray(v) : k === 'base' ? !(v === null || (typeof v === 'object' && !Array.isArray(v))) : typeof v !== typeof b) (f as Record<string, unknown>)[k] = b;
  }
  for (const k of ['done', 'joined', 'dream', 'heart'] as const) f[k] = f[k].filter((x, i, a) => isStarId(x) && a.indexOf(x) === i);
  return f;
}

// ───────── 누가 신화 「다섯 별」인가 ─────────

/** 이 손님의 다섯 별 키 (플래그 꺼짐이면 null — 그냥 영웅 동료처럼) */
export const starOf = (a: Actor | undefined | null): StarId | null => (a && isStarId(a.starId) && fiveOn() ? a.starId : null);
export const isStar = (a: Actor | undefined | null) => !!starOf(a);
const has = (ms: Actor[], id: StarId) => ms.some((m) => starOf(m) === id);
/** 파티 안 다섯 별 수 (세트) */
export const starsIn = (ms: Actor[]) => new Set(ms.map(starOf).filter(Boolean)).size;

// ───────── 본인 계정 (profiles.pioneer) ─────────

let selfStar: StarId | null = null;
export const setSelfStar = (id: string | null | undefined) => void (selfStar = isStarId(id) ? id : null);
export const selfStarId = () => selfStar;
/** 이 카드가 본인 (본인 별 배지) */
export const isSelfStar = (a: Actor | undefined | null) => !!selfStar && starOf(a) === selfStar;

// ───────── §3 스킬 · 세트 「다섯 별」 ─────────

/** 그 사람 고유 스킬 (optSum이 더한다 · 전설 고유 기술과 같은 자리) */
export function starSkillOpt(a: Actor, k: OptKey): number {
  const id = starOf(a);
  const sk = id ? STARS[id].skill : null;
  return sk && sk.k === k ? sk.v : 0;
}
/** 개인 능력치 배율 (전설 × 1.15) */
export const fiveStat = (a: Actor) => (isStar(a) ? C().statMult : 1);
/** 파티 공격 배율: 웅스 무기 강화 단계 × 1% (최대 +20%) · 따뜻한밤 공격 +10% · 세트 2명 +5% */
export function fiveAtk(ms: Actor[]): number {
  if (!fiveOn()) return 1;
  let k = 1;
  const w = ms.find((m) => starOf(m) === 'woongs');
  if (w) k *= 1 + Math.min(C().woongsEnhMax, equippedItems(w).find((it) => it.slot === 'weapon')?.enh ?? 0) / 100;
  if (has(ms, 'warmnight')) k *= 1 + C().warmAtk;
  if (starsIn(ms) >= 2) k *= 1 + C().set2Atk;
  return k;
}
/** 의뢰 시간 − (이카몰리) */
export const fiveTimeCut = (ms: Actor[]) => (has(ms, 'ikamolly') ? C().ikaTimeCut : 0);
/** 원정 체력 소모 배율 (세트 3명 −10% · 왈왈 −30%는 그 사람 hpSave 스킬) */
export const fiveHpMult = (ms: Actor[]) => (starsIn(ms) >= 3 ? 1 - C().set3Hp : 1);
/** 보상 금화 배율 (세트 4명 +5%) */
export const fiveGold = (ms: Actor[]) => (starsIn(ms) >= 4 ? 1 + C().set4Gold : 1);
/** 은밀 사건 확률 (고느끼 +20% · 닉스와 같이 쌓임 · 상한 0.8) */
export const fiveStealth = (ms: Actor[], base: number) => (has(ms, 'gonu') ? Math.min(C().stealthCap, base + C().gonuStealth) : base);
/** 밤 출발 원정 성공률 + (왈왈콩선생) */
export const fiveNightSuccess = (ms: Actor[], night: boolean) => (night && has(ms, 'walwal') ? C().walwalNight : 0);
/** 떠돌이 보스 만날 확률 배율 (따뜻한밤) */
export const fiveWanderMult = (ms: Actor[]) => (has(ms, 'warmnight') ? C().warmWander : 1);
/** 세트 4명 첫 전투: 「다섯 별」 컷 1초 (한 번만) */
export function fiveSetCutDue(ms: Actor[]): boolean {
  if (!fiveOn() || starsIn(ms) < 4) return false;
  const f = fiveState();
  if (f.cut4) return false;
  f.cut4 = true;
  markDirty();
  return true;
}

// ───────── §2 부탁 (장부 칸) ─────────

const totalWins = () => Object.values(P.counters.regionWins ?? {}).reduce((s, v) => s + (v ?? 0), 0);
const hiddenFound = () => (P.harmony?.found ?? []).filter((id) => !HARMONIES.find((h) => h.id === id)?.open);
function snapBase(): FiveBase {
  return {
    at: Date.now(),
    events: P.counters.eventsSolved ?? 0,
    hidden: hiddenFound(),
    setFirst: (P.growth?.setFirst ?? []).length,
    wins: totalWins(),
    regionWins: { ...(P.counters.regionWins ?? {}) },
    firstLen: (P.hunt?.firstClear ?? []).length,
    talks: P.counters.guestTalks ?? 0,
    harvests: P.counters.harvests ?? 0,
  };
}
const base = (): FiveBase => (fiveState().base ??= snapBase());
/** 지금 낀 세트 한 벌(같은 지역 세트 3부위)이 있는 단골·영웅 */
function fullSetWorn(): boolean {
  for (const a of homeActors()) {
    if (a.role || !a.id || !(a.status === 'regular' || a.status === 'hero')) continue;
    const n: Record<string, number> = {};
    for (const it of equippedItems(a)) if (it.set) n[it.region] = (n[it.region] ?? 0) + 1;
    if (Object.values(n).some((v) => v >= 3)) return true;
  }
  return false;
}
/** 서로 다른 지역 (받은 뒤 의뢰 성공 또는 사냥 첫 돌파) */
function newRegions(): number {
  const b = base();
  const set = new Set<string>();
  for (const r of REGIONS) if ((P.counters.regionWins?.[r.id] ?? 0) > (b.regionWins[r.id] ?? 0)) set.add(r.id);
  for (const k of (P.hunt?.firstClear ?? []).slice(b.firstLen)) set.add(k.split('-')[0]);
  return set.size;
}
export interface StarGoal {
  label: string;
  cur: number;
  need: number;
}
/** 칸 진행 (조건마다 [지금, 목표]) */
export function starGoals(id: StarId): StarGoal[] {
  const b = base();
  const f = fiveState();
  const g = (label: string, cur: number, need: number): StarGoal => ({ label, cur: Math.max(0, Math.min(need, cur)), need });
  switch (id) {
    case 'woongs':
      return [g(`+${C().woongs.enh} 장비 ${C().woongs.items}개 낀 파티로 토벌 보스 처치`, f.woongsKills, C().woongs.kills)];
    case 'gonu': {
      const fresh = hiddenFound().filter((x) => !b.hidden.includes(x)).length;
      // 숨은 어울림을 이미 다 찾았으면 그 조건은 채운 것으로 (못 채우는 칸이 없게)
      const allFound = HARMONIES.filter((h) => !h.open).every((h) => b.hidden.includes(h.id));
      const ev = (P.counters.eventsSolved ?? 0) - b.events + (C().gonu.hiddenCounts ? fresh : 0);
      return [g(C().gonu.hiddenCounts ? '구경거리 사건 해결 (숨은 어울림 발견도 셈)' : '구경거리 사건 해결', ev, C().gonu.events), g('숨은 어울림 새로 발견', allFound ? C().gonu.hidden : fresh, C().gonu.hidden)];
    }
    case 'ikamolly':
      return [g('세트 장비 한 벌(3부위)', (P.growth?.setFirst ?? []).length > b.setFirst || fullSetWorn() ? 1 : 0, C().ikamolly.sets), g('의뢰 성공', totalWins() - b.wins, C().ikamolly.wins)];
    case 'walwal':
      return [g(`밤 출발 원정 성공 (모두 체력 ${C().walwal.hp} 이상)`, f.walwalNights, C().walwal.nights), g('손님에게 말 걸기', (P.counters.guestTalks ?? 0) - b.talks, C().walwal.talks)];
    case 'warmnight':
      return [g('서로 다른 지역 (의뢰 성공·사냥 첫 돌파)', newRegions(), C().warmnight.regions), g('텃밭 수확', (P.counters.harvests ?? 0) - b.harvests, C().warmnight.harvests)];
  }
}
export const starReady = (id: StarId) => starGoals(id).every((x) => x.cur >= x.need);

/** 토벌 보스를 쓰러뜨렸을 때 (world/raid.ts settle): 파티가 낀 +12 이상 장비가 2개 이상이면 웅스 칸 */
export function fiveRaidKill(ms: Actor[]) {
  const f = fiveState();
  if (!fiveOn() || !f.open || f.done.includes('woongs')) return;
  const n = ms.reduce((s, m) => s + equippedItems(m).filter((it) => it.enh >= C().woongs.enh).length, 0);
  if (n >= C().woongs.items) {
    f.woongsKills++;
    markDirty();
  }
}
/** 현실 밤(20~04시)인가 */
export const realNightAt = (t: number) => {
  const h = new Date(t).getHours();
  return h >= 20 || h < 4;
};
/** 왈왈 부탁의 「밤 출발」: 현실 밤에 보냈거나 게임 안 밤에 보냈다 (gameNight 없는 옛 기록은 현실 시각만) */
export const walwalNightRun = (run: { start: number; gameNight?: boolean }) => realNightAt(run.start) || run.gameNight === true;
/** 밤에 출발한 원정이 성공했을 때 (world/expeditions.ts · 체력이 깎인 뒤): 모두 체력 60 이상이면 왈왈 칸 */
export function fiveNightWin(ms: Actor[]) {
  const f = fiveState();
  if (!fiveOn() || !f.open || f.done.includes('walwal') || !ms.length) return;
  if (ms.every((m) => m.hp >= C().walwal.hp)) {
    f.walwalNights++;
    markDirty();
  }
}

/** 고느끼 부탁이 진행 중 (장 열림 · 칸 안 채움 · 켜짐) */
const gonuActive = () => fiveOn() && fiveState().open && !fiveState().done.includes('gonu');
/** 구경거리 사건이 생겼다 (world/spectacle.ts spawn) — 그 한국 날짜 기록 */
export function fiveSpecSeen(now = Date.now()) {
  const f = fiveState();
  const d = kstDay(now);
  if (f.specKst === d) return;
  f.specKst = d;
  markDirty();
}
/**
 * 고느끼 부탁 중 현실 하루 구경거리 1번 보장 (world/spectacle.ts tickSpectacle이 마을이 돌아가는 동안 0.5초마다 부름)
 *  오늘(한국 날짜) 부탁 중 처음 불린 때 = 오늘 첫 세션 시작 → 게임 시각(sessAt) 기록
 *  오늘 아직 사건이 없고 그때부터 게임 forceWithinGameHours시간 안이면 true (확률 · 07~23시 · 하루 수 제한 없이 꼭)
 */
export function fiveSpecForce(now = Date.now()): boolean {
  if (!gonuActive()) return false;
  const f = fiveState();
  const d = kstDay(now);
  const t = absHours();
  // 오늘 첫 세션 · 또는 게임 시계가 뒤로 갔으면(옛 저장으로 덮임) 지금부터 다시 잰다
  if (f.sessKst !== d || t < f.sessAt) {
    f.sessKst = d;
    f.sessAt = t;
    markDirty();
  }
  return f.specKst !== d && t - f.sessAt < C().gonu.forceWithinGameHours;
}

// ───────── §1 흐름 ─────────

/** 3막 편지 다음: 3막이고 갈림길 편지에 답했거나(letter 2) 3막에 든 지 게임 하루가 지났으면 */
export function fiveLetterDue(): boolean {
  const s = P.story;
  if (!s || s.act !== 3) return false;
  return s.letter !== 1 || S.day > (s.actDay?.[3] ?? 0);
}
/** 합류 레벨: 단골 상위 3명 평균 (최소 joinLvlMin) */
function joinLevel(): number {
  const lv = homeActors()
    .filter((a) => !a.role && a.id && (a.status === 'regular' || a.status === 'hero'))
    .map((a) => a.lvl)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const avg = lv.length ? Math.round(lv.reduce((s, v) => s + v, 0) / lv.length) : 0;
  return Math.min(CONFIG.guests.maxLevel, Math.max(C().joinLvlMin, avg));
}
/** 신화 영웅 하나 만들기 (등급 신화 · 클래스 능력치 · 외형 고정) */
export function makeStar(id: StarId, x: number, y: number): Actor {
  const d = STARS[id];
  const a = makeAdventurer(x, y, { kind: d.kind, race: d.race, rarity: 'legend', lvl: joinLevel(), status: 'hero' });
  Object.assign(a, { name: d.name, starId: id, hair: d.hair, face: { ...d.face }, stars: 1, leaveDay: 1e9, hp: 95, food: 95, mood: 95 });
  return a;
}
/** 마을에 들이기 (ui가 걸어 들어오는 연출로 바꾼다) */
export const fiveHooks = {
  place: (a: Actor) => void homeActors().push(a),
  /** 세트 한마디 (ui가 알림으로) */
  setLine: (_s: string) => {},
  /** 출발 말풍선 (ui가 world/fx say로) */
  say: (_a: Actor, _s: string) => {},
  entrance: (): [number, number] => [7, 7],
};
export type FiveEvent = { kind: 'letter' } | { kind: 'join'; id: StarId; actor: Actor } | { kind: 'final' };

/** 1초마다 (ui/fivestars.ts · 한가할 때만): 다음에 보여 줄 것 */
export function fiveTick(): FiveEvent | null {
  if (!fiveOn() || S.visiting || world.home) return null;
  const f = fiveState();
  if (!f.open) {
    if (!fiveLetterDue()) return null;
    f.open = true;
    f.chSeen = 0;
    base();
    track('five_open', { day: S.day });
    markDirty();
    return { kind: 'letter' };
  }
  repairStars();
  for (const id of STAR_IDS) {
    if (!f.done.includes(id) && starReady(id)) {
      f.done.push(id);
      markDirty();
    }
    if (f.done.includes(id) && !f.joined.includes(id)) {
      f.joined.push(id);
      const [x, y] = fiveHooks.entrance();
      const a = makeStar(id, x, y);
      fiveHooks.place(a);
      track('five_join', { id, n: f.joined.length });
      markDirty();
      return { kind: 'join', id, actor: a };
    }
  }
  if (f.joined.length >= STAR_IDS.length && !f.final) {
    giveFinal();
    return { kind: 'final' };
  }
  return null;
}
/** 합류했는데 마을에 없으면(옛 기기 저장이 덮어씀 등) 다시 들인다 — 지우는 일은 없다 */
function repairStars() {
  const f = fiveState();
  for (const id of f.joined as StarId[]) {
    if (homeActors().some((a) => a.starId === id)) continue;
    const [x, y] = fiveHooks.entrance();
    fiveHooks.place(makeStar(id, x, y));
    markDirty();
  }
}
/** 마지막 보상 (1번만): 별지기의 열쇠 조각 · 장식 「다섯 별 깃발」(보관함) · 칭호 */
function giveFinal() {
  const f = fiveState();
  if (f.final) return;
  f.final = true;
  const shards = (P.legacy.shards ??= []);
  if (!shards.includes(FIVE_SHARD)) shards.push(FIVE_SHARD);
  const owned = homeObjs().some((o) => o.kind === 'five_flag') || (P.decor.store ?? []).some((s) => s.kind === 'five_flag');
  if (!owned) (P.decor.store ??= []).push({ kind: 'five_flag', lvl: 1, hue: null, flip: false, fromProp: true });
  if (!P.titles.includes(FIVE_TITLE)) P.titles.push(FIVE_TITLE);
  track('five_final', {});
  markDirty();
}
/** 밤하늘 별자리 (다섯 다 모인 뒤 · 밤) */
export const constellationOn = () => fiveOn() && fiveState().final;

/** 2막부터 카메오 대사 끝에 꿈 한 줄 (그 개척자가 아직 합류 전) */
export function dreamLine(id: string): string | null {
  if (!fiveOn() || !isStarId(id) || (P.story?.act ?? 0) < 2) return null;
  if (fiveState().joined.includes(id)) return null;
  return STAR_LINES[id].dream;
}

// ───────── 대사 파일: 출발 말풍선 · 세트 한마디 · 밤 단골 대화 · 오스윈 이야기 ─────────

/** 파티 출발 (world/expeditions.ts sendParty): 다섯 별 깃발 기분 + · 별 하나가 가끔 출발 말풍선 · 세트 「다섯 별」 인원이 처음 닿으면 한마디 */
export function fiveDepart(ms: Actor[]) {
  flagDepart(ms);
  if (!fiveOn()) return;
  const st = ms.filter((m) => starOf(m));
  if (st.length) {
    const m = st[(Math.random() * st.length) | 0];
    const pool = STAR_LINES[starOf(m)!].depart;
    if (Math.random() < C().departBubble) fiveHooks.say(m, pool[(Math.random() * pool.length) | 0]);
  }
  const n = fiveSetLineDue(ms);
  if (n) fiveHooks.setLine(FIVE_SET_LINE[n]);
}
/** 세트 「다섯 별」 인원(2·3·4) 중 처음 닿은 가장 큰 것 (한 번씩만) */
export function fiveSetLineDue(ms: Actor[]): 2 | 3 | 4 | null {
  if (!fiveOn()) return null;
  const n = Math.min(4, starsIn(ms));
  if (n < 2) return null;
  const f = fiveState();
  if (f.setSeen.includes(n)) return null;
  for (let k = 2; k <= n; k++) if (!f.setSeen.includes(k)) f.setSeen.push(k);
  markDirty();
  return n as 2 | 3 | 4;
}
/** 밤에 다섯 별 단골에게 말 걸면 한 번 (heart) */
export function fiveHeart(a: Actor): SLine[] | null {
  const id = starOf(a);
  if (!id || !S.night) return null;
  const f = fiveState();
  if (f.heart.includes(id)) return null;
  f.heart.push(id);
  markDirty();
  return STAR_LINES[id].heart;
}
/** 장이 열린 뒤 오스윈에게 말 걸면 한 번: 첫 원정대 이야기 */
export function fiveOswinTale(a: Actor): SLine[] | null {
  if (!fiveOn() || a.heroId !== 'oswin') return null;
  const f = fiveState();
  if (!f.open || f.oswin) return null;
  f.oswin = true;
  markDirty();
  return OSWIN_TALE;
}
/** 이미 합류한 개척자는 카메오로 지나가지 않는다 */
export const starJoined = (id: string) => fiveOn() && fiveState().joined.includes(id);

// ───────── 장식 효과 ─────────

/** 다섯 별 깃발: 근처(4칸)에서 파티가 출발하면 기분 + */
export function flagDepart(ms: Actor[]) {
  if (!fiveOn()) return;
  const fl = homeObjs().find((o) => o.kind === 'five_flag');
  if (!fl) return;
  const cx = fl.tx + fl.fw / 2;
  const cy = fl.ty + fl.fh / 2;
  for (const m of ms) if (Math.hypot(m.x - cx, m.y - cy) <= C().flagNear) m.mood = Math.min(100, m.mood + C().flagMood);
}

// ───────── 장부 칸 (화면용) ─────────

export interface FiveCell {
  id: StarId;
  name: string;
  goals: StarGoal[];
  done: boolean;
  joined: boolean;
}
/** 장이 열렸으면 다섯 칸 (닫혀 있으면 null — 장부에 안 보임) */
export function fiveLedger(): FiveCell[] | null {
  if (!fiveOn()) return null;
  const f = fiveState();
  if (!f.open) return null;
  return STAR_IDS.map((id) => ({ id, name: STARS[id].name, goals: starGoals(id), done: f.done.includes(id), joined: f.joined.includes(id) }));
}

// ───────── 새 장 알림 (빨간 점 · 「새 장이 열렸어요」 1번 · 장부를 열면 3막으로) ─────────

/** 장이 열렸는데 장부에서 아직 못 봤나 (빨간 점 · 장부 열면 3막으로 스크롤) */
export const fiveChapterNew = (): boolean => fiveOn() && !!P.five?.open && fiveState().chSeen < 2;
/** 「새 장이 열렸어요」 알림을 지금 띄울 차례면 true + 표시 (1번만) */
export function fiveNoticeTake(): boolean {
  if (!fiveOn() || !P.five?.open || S.visiting || world.home) return false;
  const f = fiveState();
  if (f.chSeen > 0) return false;
  f.chSeen = 1;
  markDirty();
  return true;
}
/** 장부에서 3막을 봤다 (점 끔) */
export function fiveChapterViewed() {
  if (!fiveChapterNew()) return;
  fiveState().chSeen = 2;
  markDirty();
}
