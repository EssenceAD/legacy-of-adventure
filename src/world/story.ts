// STORY_V1: 막(1→2→3) · 루트 점수(보이지 않게) · 3막 갈림길 · 「조용한 은퇴」 목표 · 회차 기억 대사 · 유산 포인트·기억 조각
//  회차 = P.legacy.gen · 엔딩 기록 = P.legacy.album/cards (기존 엔딩 앨범과 같은 곳) · 이 회차 이야기 = P.story
import { CONFIG } from '../data/config';
import { fillNames } from '../data/josa';
import { HEROES } from '../data/heroes';
import { LEGENDS } from '../data/legends';
import { REGIONS } from '../data/items';
import { CYCLE_LINES, LEGACY_GIFTS, MEMORIES, OPENING_CYCLE, RETIRE_TICKS, ROUTES, type RouteId, type SLine } from '../data/story/v1';
import { track } from '../net/telemetry';
import { onNewDay } from './clock';
import { chaptersDone, currentMission, guideCtx, townGrade } from './guide';
import { CHAPTERS } from '../data/guide';
import { markDirty, P, S, world, type Actor, type TalkLine } from './state';
import { ensureWind, rollWind, windRetire } from './wind';
import { addChronicle, backfillChronicle, keepMythicMet } from './chronicle';
import { flag } from './flags';

const A = CONFIG.story;
const st = () => P.story;
const DAY_MS = 864e5;

// ───────── 날짜 · 막 ─────────

/** 이 회차 운영 며칠째 (1부터) — 켜 둔 게임 일수 */
export const storyDay = () => Math.max(1, S.day - st().day0 + 1);
/** 이 회차의 n일차 = 화면 위 몇 일차 */
export const absDay = (n: number) => n + st().day0 - 1;

// ───────── PACE §3-1 이야기 시계 (storyClock) ─────────

const clockOn = () => flag('storyClock');
/**
 * 지금 막의 시계 출발점 (이 회차 며칠째) · 1막 = 1일 · 2막·3막은 그 막의 문턱(12·40일) 이상
 *  (라이트 유저는 이야기 시계로 게임 2일차쯤 2막에 들어가도 「12일째」에서 센다 → 2막→3막이 누구나 현실 (40−12)÷8 = 3.5일)
 */
function actStartDay(a: number): number {
  if (a <= 1) return 1;
  const d = st().actDay?.[a];
  const g = d ? Math.max(1, d - st().day0 + 1) : 1;
  return Math.max(g, a === 2 ? A.act2.day : A.act3.day);
}
/** 지금 막에 들어간 현실 시각 (없으면 0) */
const actAtOf = (a: number) => Number(st().actAt?.[a]) || 0;
/**
 * 이야기 「며칠째」(막 전환·은퇴 판정용) = max(켜 둔 게임 일수, 그 막에 들어간 날 + 현실 경과일 × realDayAs)
 *  · 오프라인 동안 게임 시계(낮밤·손님)는 그대로 — 이 계산에만 현실 날짜를 쓴다
 */
export function storyClockDay(now = Date.now()): number {
  const g = storyDay();
  const a = st().act || 1;
  const t = actAtOf(a);
  if (!clockOn() || !t) return g;
  const real = Math.max(0, (now - t) / DAY_MS);
  return Math.max(g, Math.floor(actStartDay(a) + real * A.realDayAs + 1e-9));
}
/** 「며칠째」가 day에 닿기까지 남은 현실 일수 (올림 · 시계 꺼짐/기록 없음이면 Infinity) */
export function realDaysTo(day: number, now = Date.now()): number {
  const a = st().act || 1;
  const t = actAtOf(a);
  if (!clockOn() || !t) return Infinity;
  const at = t + ((day - actStartDay(a)) / A.realDayAs) * DAY_MS;
  return Math.max(0, Math.ceil((at - now) / DAY_MS));
}
/** 「며칠째」가 day에 닿는 현실 시각 (시험·보고용 · 없으면 Infinity) */
export function realAtFor(day: number): number {
  const a = st().act || 1;
  const t = actAtOf(a);
  return !clockOn() || !t ? Infinity : t + ((day - actStartDay(a)) / A.realDayAs) * DAY_MS;
}

/**
 * 막에 들어간 현실 시각 채우기 (불러온 뒤 한 번 · 새 게임) — 옛 저장엔 없다.
 *  추정: 이 회차가 시작된 현실 시각 t0(주인 born · 건물 builtAt · 우편 at 중 가장 이른 것, 2회차부터는 직전 엔딩 이후)과
 *  마지막 저장 시각 t1 사이를 「게임 일수 비율」로 나눈 자리 = 그 막에 들어간 날. 증거가 없으면 지금(보수적 — 시계가 지금부터).
 */
export function backfillActAt(now = Date.now()): boolean {
  const s = st();
  if (!s.actAt || typeof s.actAt !== 'object') s.actAt = {};
  const a = s.act || 0;
  if (a < 1 || actAtOf(a)) return false;
  const ok = (v: unknown): v is number => typeof v === 'number' && v > 1.7e12 && v <= now;
  const ev: number[] = [];
  if (ok(P.owner?.born)) ev.push(P.owner!.born);
  for (const o of world.home?.objs ?? world.objs) if (ok(o.builtAt)) ev.push(o.builtAt);
  for (const m of P.meta.mail ?? []) if (ok(m.at)) ev.push(m.at);
  let t0 = ev.length ? Math.min(...ev) : 0;
  // 2회차부터: 이 회차는 직전 엔딩 뒤에 시작했다
  const ends = Object.values(P.legacy.cards ?? {}).map((c) => c.at).filter(ok);
  if (t0 && ends.length) t0 = Math.max(t0, Math.max(...ends));
  const t1 = ok(P.lastSeen) ? P.lastSeen : now;
  let at = now;
  if (t0 && t0 <= t1) {
    const span = Math.max(1, S.day - s.day0);
    const frac = a <= 1 || A.backfillAtStart ? 0 : Math.min(1, Math.max(0, ((s.actDay?.[a] ?? S.day) - s.day0) / span));
    at = Math.round(t0 + frac * (t1 - t0));
  }
  s.actAt[a] = at;
  track('story_clock_backfill', { act: a, at, est: at !== now, day: storyDay() });
  markDirty();
  return true;
}

/** 막 전환 조건: 진행(장부 장 수 · 영웅) · 날짜 */
export function actNeeds(to: 2 | 3): { prog: boolean; day: number } {
  const c = to === 2 ? A.act2 : A.act3;
  const prog = chaptersDone() >= c.chapters && (to === 2 || guideCtx().heroes >= A.act3.heroes);
  return { prog, day: c.day };
}
export const actReady = (to: 2 | 3) => {
  const n = actNeeds(to);
  return n.prog && storyClockDay() >= n.day;
};
/** 진행은 채웠는데 날짜가 모자라면: 다음 이야기가 오는 날(화면 일차) · 아니면 0 */
export function storyWaitDay(): number {
  const a = st().act;
  if (a < 1 || a >= 3) return 0;
  const n = actNeeds((a + 1) as 2 | 3);
  return n.prog && storyClockDay() < n.day ? absDay(n.day) : 0;
}
/**
 * 「다음 이야기」 문구 (진행은 채웠는데 날짜가 모자랄 때 · 아니면 '')
 *  · 시계 켬: 더 빠른 쪽을 앞에 — 「○일 뒤 (또는 ○일차)」 / 「○일차 (또는 ○일 뒤)」 (남은 게임 일수 ≤ 남은 현실 일수면 일차가 앞)
 */
export function storyWaitText(): string {
  const d = storyWaitDay();
  if (!d) return '';
  const n = actNeeds((st().act + 1) as 2 | 3);
  const real = realDaysTo(n.day);
  if (!Number.isFinite(real)) return `${d}일차`;
  const gameLeft = n.day - storyDay();
  const r = real <= 0 ? '곧' : `${real}일 뒤`;
  return gameLeft <= real ? `${d}일차 (또는 ${r})` : `${r} (또는 ${d}일차)`;
}
/** 다음 막으로 넘어갈 차례면 그 막 (ui가 컷을 틀고 actUp) */
export function nextAct(): 2 | 3 | null {
  const a = st().act;
  if (a === 1 && actReady(2)) return 2;
  if (a === 2 && actReady(3)) return 3;
  return null;
}
export function actUp(to: 2 | 3) {
  const s = st();
  s.act = to;
  s.actDay[to] = S.day;
  // PACE §3-1: 이 막에 들어간 현실 시각 (이야기 시계)
  s.actAt = { ...(s.actAt ?? {}), [to]: Date.now() };
  if (to === 3 && !s.letter) s.letter = 1;
  s.seen.push('tele:act' + to);
  track('act_up', { act: to, day: storyDay(), playMin: s.playMin });
  markDirty();
}

/**
 * 불러온 뒤 · 새 게임 시작 때 한 번: 빈 칸 바로잡기 · 옛 저장은 진행도로 막을 추정한다
 *  (2막까지는 조용히 · 3막은 조건이 되면 컷과 편지로 맞이하게)
 */
export function initStory(fresh: boolean) {
  const s = st();
  if (!Array.isArray(s.seen)) s.seen = [];
  if (!s.score || typeof s.score !== 'object') s.score = { hero: 0, legend: 0, town: 0, love: 0, retire: 0 };
  if (!s.actDay || typeof s.actDay !== 'object') s.actDay = {};
  if (s.route && !(s.route in ROUTES)) s.route = null;
  if (![0, 1, 2, 3].includes(s.act)) s.act = 0;
  if (!s.act) {
    s.day0 = fresh ? Math.max(1, S.day) : 1;
    s.act = !fresh && actReady(2) ? 2 : 1;
    if (s.act === 2) s.actDay[2] = S.day;
    // 옛 저장의 플레이 시간: 운영 일수로 어림 (게임 1일 ≈ 24분)
    if (!fresh && !s.playMin) s.playMin = Math.round(S.day * 24);
    markDirty();
  }
  // PACE §3-1: 막에 들어간 현실 시각 (새 게임 = 지금 · 옛 저장 = 한 번 추정)
  if (fresh) s.actAt = { [s.act]: Date.now() };
  backfillActAt();
  // HOTFIX18 §2: 추정으로 올린 막도 한 번 기록 (예전엔 조용히 올려서 act_up이 0건이었다)
  if (s.act >= 2 && !s.seen.includes('tele:act' + s.act)) {
    s.seen.push('tele:act' + s.act);
    track('act_up', { act: s.act, day: storyDay(), playMin: s.playMin, inferred: true });
    markDirty();
  }
  // 유산 포인트 · 기억 조각: 이미 본 엔딩만큼 한 번 채운다 (처음 본 엔딩이었으니 +첫 보너스)
  const L = P.legacy;
  if (!L.v14) {
    L.v14 = true;
    const n = L.album.length;
    L.pts = (L.pts || 0) + n * (A.legacyPts + A.legacyFirst);
    L.mem = Math.min(MEMORIES.length, Math.max(L.mem || 0, n));
    markDirty();
  }
  // DIRECTION §1: 옛 저장 — 본 엔딩만큼 연대기 쪽 채우기 · 2회차 이상인데 바람이 없으면 정하기 · 만난 신화 기억
  backfillChronicle();
  ensureWind();
  keepMythicMet();
}

// ───────── 루트 점수 (하루 마감 때) ─────────

export function routeScores(): Record<RouteId, number> {
  const C = P.counters;
  let reg = 0;
  REGIONS.forEach((r, i) => ((P.hunt.best[r.id] ?? 0) > 0 ? (reg = i + 1) : 0));
  const bossKills = Object.values(P.raid.kills).reduce((a, v) => a + (v || 0), 0);
  const ties = Object.values(P.ties);
  return {
    hero: reg * 10 + bossKills,
    legend: LEGENDS.filter((l) => P.legends[l.key]?.st === 'joined').length * 15,
    town: townGrade() * 10 + P.harmony.found.length * 2,
    love: ties.filter((t) => t.stage >= 5).length * 20 + ties.filter((t) => t.stage === 4).length * 8,
    retire: storyDay() + st().goodDays * 2 + Math.floor((C.harvests ?? 0) / 5),
    // STORY v3: 진 엔딩은 조건을 채운 회차에만 (맨 위로)
    true: 0,
  };
}
/** 3막 편지의 선택지: 점수 높은 순 · 맨 위에 「지금 마음에 가장 가까워요」 */
export function routeChoices(): { id: RouteId; score: number; top: boolean; open: boolean }[] {
  const sc = routeScores();
  // 진 엔딩 「별지기」는 조건이 될 때만 갈림길에 나온다
  const ids = (Object.keys(ROUTES) as RouteId[]).filter((id) => id !== 'true' || ROUTES.true.open).sort((a, b) => sc[b] - sc[a]);
  return ids.map((id, i) => ({ id, score: sc[id], top: i === 0, open: ROUTES[id].open }));
}
/** 루트 고르기 · 3막 안에서 한 번 다시 고를 수 있다 */
export function pickRoute(id: RouteId): string | null {
  const s = st();
  if (!ROUTES[id]?.open) return '다음 업데이트에서 열려요';
  if (s.route && s.route !== id && s.changed) return '이미 한 번 마음을 바꿨어요';
  if (s.route && s.route !== id) s.changed = true;
  s.route = id;
  s.letter = 2;
  track('route_pick', { route: id, scores: routeScores() });
  markDirty();
  return null;
}
/** 「다시 생각해 볼게」: 루트를 내려놓고 편지로 (3막에서 한 번) */
export function rethink(): boolean {
  const s = st();
  if (s.act < 3 || s.changed || !s.route || s.heir >= 1) return false;
  s.changed = true;
  s.route = null;
  s.letter = 1;
  markDirty();
  return true;
}

// ───────── 은퇴 목표 ─────────

export interface Goal {
  id: string;
  title: string;
  cur: number;
  need: number;
  done: boolean;
  /** 화면 줄 (「84일 남음」 · 「4/10」) */
  text: string;
}
export function retireGoals(): Goal[] {
  const s = st();
  const g = ROUTES.retire.goals!;
  // PACE §3-1: 은퇴 「며칠째」도 이야기 시계 (켜 둔 게임 일수와 3막 뒤 현실 경과일 × 8 중 큰 값)
  const day = storyClockDay();
  const harv = P.counters.harvests ?? 0;
  // DIRECTION §1-2 고요한 해: 은퇴 목표 −10%
  const days = windRetire(A.retireDays);
  const good = windRetire(A.retireGoodDays);
  const harvN = windRetire(A.retireHarvests);
  const mk = (i: number, cur: number, need: number, text: string): Goal => ({ id: g[i].id, title: fill(g[i].title), cur: Math.min(cur, need), need, done: cur >= need, text });
  return [
    mk(0, day, days, day >= days ? '완료' : `${days - day}일 남음 (${day}/${days}일)`),
    mk(1, s.goodDays, good, `${Math.min(s.goodDays, good)}/${good}일 · 평균 기분 ${A.goodMood} 이상인 날`),
    mk(2, harv, harvN, `${Math.min(harv, harvN)}/${harvN}`),
    mk(3, s.heir >= 2 ? 1 : 0, 1, s.heir === 1 ? '유안에게 말 걸기' : s.readyDay ? '내일 아침, 누군가 찾아올 것 같아요' : '앞의 목표 셋을 마치면'),
  ];
}
export const retireReady = () => retireGoals().slice(0, 3).every((g) => g.done);

/** 1초마다 (ui): 목표 완료 줄 · 후계자 차례 · 플레이 시간 — 보여 줄 대사를 돌려준다 */
let secAcc = 0;
export function storyTick(dt: number): SLine[] | null {
  const s = st();
  if (!s.act || S.visiting || !S.started) return null;
  secAcc += dt;
  if (secAcc >= 60) {
    secAcc -= 60;
    s.playMin++;
  }
  if (s.route !== 'retire' || s.heir >= 2) return null;
  for (const g of retireGoals().slice(0, 3)) {
    const k = 'goal:' + g.id;
    if (g.done && !s.seen.includes(k)) {
      s.seen.push(k);
      markDirty();
      const d = ROUTES.retire.goals!.find((x) => x.id === g.id)?.done;
      if (d) return [['narr', `갈림길 · ${g.title} ✓`], ['narr', d]];
    }
  }
  if (!s.readyDay && retireReady()) {
    s.readyDay = S.day;
    markDirty();
  }
  return null;
}

// ───────── 하루 마감 (게임 06:00) ─────────

/** ui가 채운다: 하루 한 줄 대사 · 후계자 도착 */
export const storyHooks = {
  say: (_l: SLine[]) => {},
  heir: () => {},
};
onNewDay(() => {
  if (S.visiting || !S.started || !st().act) return;
  const s = st();
  // 어제(마감된 날)의 손님 평균 기분
  const last = P.daily.log[P.daily.log.length - 1];
  if (last && last.day > s.goodLast) {
    s.goodLast = last.day;
    if (last.mood >= A.goodMood) s.goodDays++;
  }
  s.score = routeScores();
  if (s.route === 'retire' && s.heir === 0) {
    if (!s.readyDay && retireReady()) s.readyDay = S.day - 1;
    if (s.readyDay && S.day > s.readyDay) {
      s.heir = 1;
      storyHooks.heir();
    } else {
      const t = retireTick();
      if (t) storyHooks.say(t);
    }
  }
  markDirty();
});
/** 은퇴 루트 하루 한 줄 (회차마다 한 번씩) — 주인공(me)의 대꾸 줄은 앞 줄과 한 묶음 */
function retireTick(): SLine[] | null {
  const s = st();
  const groups: { k: string; lines: SLine[] }[] = [];
  RETIRE_TICKS.forEach((l, i) => {
    if (l[0] === 'me' && groups.length) groups[groups.length - 1].lines.push(l);
    else groups.push({ k: 'rt' + i, lines: [l] });
  });
  const left = groups.filter((g) => !s.seen.includes(g.k));
  if (!left.length) return null;
  const g = left[Math.floor(Math.random() * left.length)];
  s.seen.push(g.k);
  return g.lines;
}

// ───────── 글자 · 화자 · 조건 ─────────

/** 가장 친했던 단골: 단골·영웅 중 레벨이 가장 높은 (같으면 오래 묵은) 손님 */
export function favActor(): Actor | null {
  const regs = (world.home?.actors ?? world.actors).filter((a) => !a.role && a.id && (a.status === 'regular' || a.status === 'hero'));
  regs.sort((a, b) => b.lvl - a.lvl || (a.id ?? 0) - (b.id ?? 0));
  return regs[0] ?? null;
}
const favName = () => P.legacy.prevFav?.name ?? favActor()?.name ?? '단골';
const meName = () => P.owner?.name ?? `${S.innName || '여관'} 주인`;
export function fill(t: string): string {
  return fillNames(t, { inn: S.innName || '여관', me: meName(), fav: favName(), day: String(storyDay()), cycle: String(P.legacy.gen), name: meName() });
}
/** 만난 적 있나 (영웅 영입 · 전설 합류 · 인연) */
function met(id: string): boolean {
  return !!P.dex.heroes[id]?.recruited || P.legends[id]?.st === 'joined' || !!P.ties[id];
}
/** 조건 글: cycle>=2 · cycle==2 · ending:retire · met:oswin · prevFav · ! · && */
export function cond(c: string | undefined): boolean {
  if (!c) return true;
  return c.split('&&').every((part) => {
    let p = part.trim();
    let neg = false;
    if (p.startsWith('!')) {
      neg = true;
      p = p.slice(1);
    }
    let v = false;
    const m = p.match(/^cycle(>=|==|<=|>|<)(\d+)$/);
    if (m) {
      const g = P.legacy.gen;
      const n = +m[2];
      v = m[1] === '>=' ? g >= n : m[1] === '==' ? g === n : m[1] === '<=' ? g <= n : m[1] === '>' ? g > n : g < n;
    } else if (p.startsWith('ending:')) {
      const id = p.slice(7);
      v = P.legacy.album.includes(id) || P.legacy.album.includes('story_' + id);
    } else if (p.startsWith('met:')) v = met(p.slice(4));
    else if (p === 'prevFav') v = !!P.legacy.prevFav;
    return neg ? !v : v;
  });
}
/** 대사 한 줄 → 대화창 줄 + 연출 (opts.if가 안 맞는 줄은 뺀다) */
export interface StoryLine {
  line: TalkLine;
  fx?: string;
  wait?: number;
}
export function storyLines(src: SLine[]): StoryLine[] {
  const out: StoryLine[] = [];
  for (const [who, text, o] of src) {
    if (o?.if && !cond(o.if)) continue;
    const t = fill(text);
    let line: TalkLine;
    if (who === 'hero_oswin' || who.startsWith('hero_')) line = [who, t, undefined, HEROES.find((h) => 'hero_' + h.id === who)?.name ?? ''];
    else if (who === 'yuan') line = ['yuan', t, undefined, '유안'];
    // STORY v2·v3: 전설 영웅 · 안내서 편집장 · 별지기
    else if (who.startsWith('legend_')) line = [who, t, undefined, LEGENDS.find((l) => 'legend_' + l.key === who)?.name ?? ''];
    else if (who === 'editor') line = ['editor', t, undefined, '여행자 안내서 편집장'];
    else if (who === 'star') line = ['star', t, undefined, '별지기'];
    else if (who === '@fav') {
      const f = P.legacy.prevFav;
      const a = f ? (world.home?.actors ?? world.actors).find((x) => !x.role && x.name === f.name) : favActor();
      line = a ? ['@' + a.id, t] : [f?.kind ?? 'knight', t, undefined, favName()];
    } else line = [who, t];
    out.push({ line, fx: o?.fx, wait: o?.wait });
  }
  return out;
}

/** 회차 기억 대사: 그 자리(at)에서 조건이 맞으면 한 번 (회차마다) */
export function cycleLines(at: string): SLine[] | null {
  const s = st();
  for (const c of CYCLE_LINES)
    if (c.at === at && !s.seen.includes(c.id) && cond(c.when)) {
      s.seen.push(c.id);
      markDirty();
      return c.lines;
    }
  return null;
}
/** 2회차부터 오프닝 앞부분 (회차 조건에 맞는 첫 묶음) */
export function openingCycle(): SLine[] {
  for (const [k, lines] of Object.entries(OPENING_CYCLE)) if (cond(k)) return lines;
  return [];
}

// ───────── 엔딩 · 유산 ─────────

/** 엔딩을 볼 때 (모든 엔딩 공통): 유산 포인트 · 기억 조각 하나. 얻은 포인트 · 새 기억 번호(-1 = 다 모음) */
export let lastGrant = { pts: 0, mem: -1 };
export function grantLegacy(ids: string[], firstIds: string[]): { pts: number; mem: number } {
  let pts = 0;
  for (const id of ids) pts += A.legacyPts + (firstIds.includes(id) ? A.legacyFirst : 0);
  const L = P.legacy;
  L.pts = (L.pts || 0) + pts;
  let mem = -1;
  if ((L.mem || 0) < MEMORIES.length) {
    mem = L.mem || 0;
    L.mem = mem + 1;
  }
  lastGrant = { pts, mem };
  markDirty();
  return lastGrant;
}

/** 스토리 엔딩을 앨범에 남긴다 (기존 엔딩 앨범 · 카드 · 주인 「엔딩 뒤 계속 운영」) */
export function finishStory(route: RouteId) {
  const id = 'story_' + route;
  const s = st();
  const o = P.owner;
  const L = P.legacy;
  const first = !L.album.includes(id);
  if (!L.seen.includes(id)) L.seen.push(id);
  if (first) L.album.push(id);
  const regs = (world.home?.actors ?? world.actors).filter((a) => !a.role && a.id && (a.status === 'regular' || a.status === 'hero')).length;
  const g = grantLegacy([id], first ? [id] : []);
  L.cards[id] = {
    at: Date.now(), gen: L.gen, owner: o?.name ?? meName(), job: o?.job ?? 'knight', gender: o?.gender ?? 'm',
    day: storyDay(), playMin: s.playMin, regulars: regs, fav: favActor()?.name, pts: g.pts,
  };
  if (o) {
    o.ended = id;
    o.ember = 0;
  }
  s.heir = 2;
  // DIRECTION §1-3: 여관 연대기 한 쪽
  addChronicle(id);
  track('ending', { id, cycle: L.gen, playMin: s.playMin, day: storyDay() });
  markDirty();
  return { id, first, ...g };
}
/** 앨범 「이야기」 칸에서 본 스토리 엔딩 수 */
export const storyEndCount = () => P.legacy.album.filter((id) => id.startsWith('story_')).length;

/** 새 여관 열기 = 유산을 잇기 직전: 지금 회차에서 가장 친했던 단골을 기억해 둔다 */
export function rememberFav() {
  const a = favActor();
  P.legacy.prevFav = a ? { name: a.name, kind: a.kind, race: a.race } : null;
}
/** 유산을 이은 뒤: 이 회차 이야기를 처음부터 · 시작 선물 적용 */
export function startCycle(gifts: string[]): string[] {
  const s = st();
  // DIRECTION §1-1: 이 회차에 만난 신화는 회차를 넘어 기억 (여정 지도)
  keepMythicMet();
  Object.assign(s, {
    act: 1, route: null, score: { hero: 0, legend: 0, town: 0, love: 0, retire: 0 }, seen: [], day0: S.day, actDay: {},
    letter: 0, changed: false, goodDays: 0, goodLast: P.daily.log[P.daily.log.length - 1]?.day ?? 0, heir: 0, readyDay: 0, playMin: 0, actAt: { 1: Date.now() },
    base: {}, flags: {}, mythic: {},
  });
  const done: string[] = [];
  const L = P.legacy;
  for (const id of gifts) {
    const gd = LEGACY_GIFTS.find((g) => g.id === id);
    if (!gd || (L.pts || 0) < gd.cost) continue;
    L.pts -= gd.cost;
    if (id === 'gold') S.gold += A.giftGold;
    if (id === 'fav' && L.prevFav) {
      const a = (world.home?.actors ?? world.actors).find((x) => !x.role && x.name === L.prevFav!.name);
      if (a) a.lvl = Math.max(a.lvl, A.giftFavLv);
    }
    if (id === 'ledger') ledgerChapter();
    done.push(id);
  }
  // DIRECTION §1-2: 이번 회차의 바람 (2회차부터 · 직전과 다르게)
  const wind = rollWind();
  track('cycle_start', { cycle: L.gen, gift: done.join(','), wind });
  markDirty();
  return done;
}
/** 「손에 익은 장부」: 지금 장의 남은 임무를 끝낸 채로 (장 보상 기능도 연다) */
function ledgerChapter() {
  const m = currentMission();
  if (!m) return;
  const ch = CHAPTERS.find((c) => c.no === m.ch)!;
  for (const x of ch.missions)
    if (!P.guide.claimed.includes(x.id)) {
      P.guide.claimed.push(x.id);
      P.guide.idx++;
    }
  for (const u of ch.unlock) if (!P.guide.unlocked.includes(u)) P.guide.unlocked.push(u);
  P.guide.cut = Math.max(P.guide.cut, ch.no);
}
