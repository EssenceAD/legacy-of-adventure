// 게임 ↔ 서버 이어 붙이기: 클라우드 저장(1분마다·앱 내릴 때) · 마을 모습 · 토벌 기록 · 하루 한 번 통계 · 주간 순위 판정
// 로그인 안 한 손님은 여기 함수들이 아무것도 안 한다 (지금처럼 로컬).
import { CONFIG } from '../data/config';
import { baseDexGuests, GUEST_DEX_TOTAL, ITEM_DEX_TOTAL, today } from '../world/progress';
import { HEROES } from '../data/heroes';
import { powerOf } from '../world/adventurers';
import { markDirty, P, S, world, type RaidRecord } from '../world/state';
import { gatesOn, pg } from '../world/paceGates';
import { getPref, readSave, setPref, snapshot, writeSave } from '../save/save';
import { validRecord } from './local';
import { chaptersDone, townGrade } from '../world/guide';
import { addMail, myTitle } from '../world/meta';
import { isGuest, me, mine, online, postNotice, pullSave, pushSave, pushVillage, submitRaid, updateStats } from './server';

// ───────── 마을 모습 (이웃이 보는 것) ─────────

/** 대표 영웅: 가장 센 전설·영웅 (없으면 가장 센 단골의 직업) → 초상화 키 */
export function repHero(): string | null {
  const list = (world.home?.actors ?? world.actors).filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero'));
  if (!list.length) return null;
  const best = list.sort((a, b) => (b.legendId ? 1e6 : b.heroId ? 5e5 : 0) + powerOf(b) - ((a.legendId ? 1e6 : a.heroId ? 5e5 : 0) + powerOf(a)))[0];
  return best.legendId ? 'legend_' + best.legendId : best.heroId ? 'hero_' + best.heroId : best.kind;
}

export function villageSnapshot() {
  const objs = world.home?.objs ?? world.objs;
  return {
    // v2 = 땅 개편(맵 24) 좌표. v1(맵 14)은 보는 쪽(toNeighbor)에서 옮긴다
    // v3 = LAND2(맵 32) 좌표. v1·v2는 보는 쪽(toNeighbor)에서 옮긴다
    v: 3,
    land: world.home?.land ?? S.land,
    innName: S.innName,
    // GUEST_SPEC §2: 게스트는 주인 이름 대신 「○○ 여관 주인」(보는 쪽에서)
    owner: isGuest() ? '' : (me.profile?.nickname ?? ''),
    repHero: repHero(),
    // 5단계: 마을 등급 (이웃이 보러 오면 비교하는 맛) · 칭호
    grade: townGrade(),
    title: myTitle(),
    trophies: [...P.trophies],
    // FEEDBACK23 §5: 옮긴 마을 입구 x (v3 좌표 · 옮긴 적 없으면 빼서 보는 쪽이 자동으로)
    ...(typeof P.decor.entX === 'number' ? { ent: P.decor.entX } : {}),
    layout: objs.filter((o) => o.build === undefined).map((o) => [o.kind, o.con?.from?.[0] ?? o.tx, o.con?.from?.[1] ?? o.ty, o.lvl, o.hue, !!o.flip]),
  };
}

/** 도감 완성률(%) = 손님·아이템·영웅 도감 평균 */
export function codexPct(): number {
  const g = baseDexGuests() / GUEST_DEX_TOTAL;
  const i = P.dex.items.length / ITEM_DEX_TOTAL;
  const h = HEROES.filter((x) => P.dex.heroes[x.id]?.recruited).length / HEROES.length;
  return Math.min(100, ((g + i + h) / 3) * 100);
}

// ───────── 클라우드 저장 ─────────

let pushing = false;
/** 로그인 직후 어느 저장을 쓸지 정하기 전에는 올리지 않는다 (다른 기기의 옛 마을이 클라우드를 덮지 않게) */
let ready = false;
export function setCloudReady(on: boolean) {
  ready = on;
}
/** 저장 맞추기가 끝났나 (서버 저장 고르기 창이 떠 있으면 false — 그 사이 넣은 것은 덮일 수 있다) */
export const cloudReady = () => ready;
/** 이 기기 저장이 어느 계정 것인지 (그 계정으로 올린 적이 있으면 그 사람 것) */
const OWNER = 'cloudOwner';
/** 이 기기 저장이 이미 어떤 계정 것인가 (그 계정이 로그아웃·만료됐을 때 게스트로 올리지 않게) */
export const ownedByAccount = () => !!getPref<string>(OWNER, '');
export function markOwner() {
  if (me.profile) setPref(OWNER, me.profile.id);
}

/** 지금 상태를 서버로 (저장 + 마을 모습) */
/** HARVEST §3: 계정 삭제 중엔 클라우드에 올리지 않는다 (삭제 RPC 전에 멈춘다) */
let cloudHalted = false;
export const haltCloud = (on = true) => void (cloudHalted = on);
export const cloudBusy = () => pushing;

export async function pushNow() {
  if (cloudHalted || !online() || !ready || !S.started || pushing) return;
  pushing = true;
  try {
    await pushSave(snapshot(), CONFIG.save.version);
    markOwner();
    await pushVillage(villageSnapshot(), S.innName, repHero());
    // GUEST_SPEC §1: 장부 2장을 마친 게스트에게 모모 편지 한 번 — 「계정을 연결해 주세요」
    if (isGuest() && chaptersDone() >= 2 && !P.meta.linkMail) {
      P.meta.linkMail = true;
      addMail({ from: 'system', title: '모모의 편지 · 여관을 지키는 법', body: '폰을 바꾸거나 브라우저를 지워도 여관을 지키려면 계정을 연결해 주세요! 메뉴 → 계정 → 「계정 연결하기」. 마을·금화·장비는 그대로예요.', reward: {} });
    }
  } catch {
    /* 다음 번에 다시 */
  } finally {
    pushing = false;
  }
}

let timer = 0;
export function startCloud() {
  clearInterval(timer);
  timer = window.setInterval(() => void pushNow(), CONFIG.cloud.pushSeconds * 1000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void pushNow());
  addEventListener('pagehide', () => void pushNow());
}

export interface SaveChoice {
  server: { at: number; innName: string; gold: number; day: number };
  local: { at: number; innName: string; gold: number; day: number } | null;
  data: Record<string, unknown>;
}

/** 로그인 직후: 서버 저장이 이 기기보다 새로우면 고르게 한다 (null이면 이 기기 걸 올리면 됨) */
export async function compareSaves(): Promise<SaveChoice | null> {
  const s = await pullSave();
  if (!s?.data) return null;
  const local = readSave();
  const d = s.data as { innName?: string; gold?: number; day?: number; savedAt?: number };
  // 저장 안에 든 시각으로 비교 (서버 기록 시각은 올린 시각이라 늘 더 늦다)
  const at = typeof d.savedAt === 'number' ? d.savedAt : new Date(s.updated_at).getTime();
  // 내용이 같으면 묻지 않는다
  if (local && local.innName === d.innName && local.gold === d.gold && local.day === d.day) return null;
  // 이 기기 저장이 이미 이 계정 것이고 더 새로우면 그대로 올린다. 손님 저장·다른 계정 저장이면 늘 묻는다
  if (local && getPref<string>(OWNER, '') === me.profile?.id && local.savedAt >= at - 5000) return null;
  return {
    server: { at, innName: d.innName ?? '', gold: d.gold ?? 0, day: d.day ?? 1 },
    local: local ? { at: local.savedAt, innName: local.innName, gold: local.gold, day: local.day } : null,
    data: s.data,
  };
}

/** 서버 저장으로 바꾼다 (다시 불러오기는 부르는 쪽에서) */
export function useServerSave(data: Record<string, unknown>) {
  try {
    localStorage.setItem(CONFIG.save.key, JSON.stringify({ ...data, savedAt: Date.now() }));
    markOwner();
  } catch {
    /* 무시 */
  }
}

// ───────── 토벌 기록 ─────────

/** 같은 기록인가 (주·보스·피해·시각) */
const recKey = (r: RaidRecord) => `${r.week}|${r.bossId}|${Math.round(r.damage)}|${r.at}`;
const wasSent = (r: RaidRecord) => (P.raid.sent ?? []).includes(recKey(r));
function markSent(r: RaidRecord) {
  const s = (P.raid.sent ??= []);
  if (!s.includes(recKey(r))) s.push(recKey(r));
  if (s.length > 60) s.splice(0, s.length - 60);
}
/** outbox에 넣기 (같은 기록은 한 번만 · 최근 60개) */
function toOutbox(r: RaidRecord) {
  if (wasSent(r) || P.raid.outbox.some((x) => recKey(x) === recKey(r))) return;
  P.raid.outbox.push(r);
  if (P.raid.outbox.length > 60) P.raid.outbox.splice(0, P.raid.outbox.length - 60);
}
/** 서버가 거부한 기록은 몇 번까지 다시 올려 본다 (그 뒤엔 내려놓는다) */
const MAX_TRIES = 3;
const RETRY_TEXT = '랭킹 기록이 잠시 안 올라갔어요 — 다시 올려볼게요';
/** 서버로 한 번 (보낸 기록은 표시 · 거부·오류면 outbox로) */
async function sendOne(rec: RaidRecord): Promise<'ok' | 'retry' | 'drop'> {
  if (wasSent(rec)) return 'ok';
  const r = await submitRaid({ week: rec.week, bossId: rec.bossId, damage: rec.damage, power: rec.power, theory: rec.theory, manual: rec.mode === 'manual' });
  if (r === 'ok') {
    markSent(rec);
    return 'ok';
  }
  if (r === 'rejected') {
    rec.tries = (rec.tries ?? 0) + 1;
    if (rec.tries >= MAX_TRIES) {
      // 그래도 안 되면 내려놓는다 (같은 걸 계속 두드리지 않게)
      markSent(rec);
      return 'drop';
    }
  }
  toOutbox(rec);
  return 'retry';
}

/** 한 판 기록: 로그인했으면 서버로(서버가 다시 검사), 아니면 이 기기 outbox에 쌓아 두었다가 로그인 때 */
export async function submitRecord(rec: RaidRecord): Promise<{ ok: boolean; reason?: string; online: boolean }> {
  const why = validRecord(rec);
  if (why) return { ok: false, reason: why, online: online() };
  if (!online()) {
    toOutbox(rec);
    return { ok: true, online: false };
  }
  // 올리는 중에 outbox 비우기가 같이 돌지 않게
  await flushing;
  const r = await sendOne(rec);
  markDirty();
  if (r === 'ok') void checkRank1(rec.week);
  // 토벌 기록 버그 2: 거부·오류여도 「약해서」가 아니다 — 다시 올려 본다는 안내만
  return { ok: true, reason: r === 'ok' ? undefined : RETRY_TEXT, online: true };
}

/** 로그인 뒤 쌓인 기록을 한 번에 — 동시에 두 번 돌지 않게 잠그고, 꺼낸 즉시 저장 (다시 켜도 또 보내지 않게) */
let flushing: Promise<{ ok: number; rejected: number }> = Promise.resolve({ ok: 0, rejected: 0 });
let flushRunning = false;
export function flushOutbox(): Promise<{ ok: number; rejected: number }> {
  if (flushRunning) return flushing;
  flushRunning = true;
  flushing = (async () => {
    let ok = 0;
    let rejected = 0;
    try {
      if (!online()) return { ok, rejected };
      const list = P.raid.outbox.splice(0);
      markDirty();
      writeSave();
      for (const rec of list) {
        const r = await sendOne(rec);
        if (r === 'ok') ok++;
        else if (r === 'drop') rejected++;
      }
      markDirty();
      writeSave();
      return { ok, rejected };
    } finally {
      flushRunning = false;
    }
  })();
  return flushing;
}

/** 주간 토벌 1위가 되면 [알림] (주에 한 번) */
async function checkRank1(week: string) {
  if (P.raid.rank1Week === week) return;
  const { row } = await mine('raidWeek', week);
  if (row?.rank === 1) {
    P.raid.rank1Week = week;
    await postNotice('rank1', me.profile?.nickname ?? '');
  }
}

/** 지난주 내 순위가 상위 30%였나 (진의 소문 조건). 주마다 한 번만 센다 */
export async function checkLastWeek() {
  // PACE R17: 확인 못 한 주가 여럿이면 모두 (예전엔 바로 지난주 하나만 — 그 주에 접속을 못 하면 그 전 주를 놓쳤다)
  const pend = gatesOn() ? pg().rankPending : [];
  const weeks = [...pend.filter((w) => w !== P.raid.week), ...(P.raid.prevWeek && P.raid.rankChecked !== P.raid.prevWeek && !pend.includes(P.raid.prevWeek) ? [P.raid.prevWeek] : [])];
  if (!online()) return;
  for (const wk of weeks) {
    await checkWeek(wk);
    const i = pend.indexOf(wk);
    if (i >= 0) pend.splice(i, 1);
  }
}
async function checkWeek(wk: string) {
  if (!wk || P.raid.rankChecked === wk) return;
  const { row, total } = await mine('raidWeek', wk);
  P.raid.rankChecked = wk;
  if (row && total > 0 && row.rank / total <= CONFIG.cloud.topRankShare) {
    P.raid.topWeeks++;
    // 5단계: 랭킹 보상은 우편함으로
    addMail({ from: 'rank', title: `지난주 토벌 ${row.rank}위 (상위 ${Math.max(1, Math.round((row.rank / total) * 100))}%)`, body: '주간 토벌 랭킹 상위 30% 보상이에요.', reward: { tokens: 1, gold: 1000 } });
  }
}

/** 하루 한 번 평판·도감 통계 */
export async function dailyStats() {
  if (!online() || P.statsDay === today()) return;
  P.statsDay = today();
  await updateStats(P.rep, codexPct());
}
