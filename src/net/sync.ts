// 게임 ↔ 서버 이어 붙이기: 클라우드 저장(1분마다·앱 내릴 때) · 마을 모습 · 토벌 기록 · 하루 한 번 통계 · 주간 순위 판정
// 로그인 안 한 손님은 여기 함수들이 아무것도 안 한다 (지금처럼 로컬).
import { CONFIG } from '../data/config';
import { GUEST_DEX_TOTAL, ITEM_DEX_TOTAL, today } from '../world/progress';
import { HEROES } from '../data/heroes';
import { powerOf } from '../world/adventurers';
import { P, S, world, type RaidRecord } from '../world/state';
import { getPref, readSave, setPref, snapshot } from '../save/save';
import { validRecord } from './local';
import { townGrade } from '../world/guide';
import { addMail, myTitle } from '../world/meta';
import { me, mine, online, postNotice, pullSave, pushSave, pushVillage, submitRaid, updateStats } from './server';

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
    v: 2,
    land: world.home?.land ?? S.land,
    innName: S.innName,
    owner: me.profile?.nickname ?? '',
    repHero: repHero(),
    // 5단계: 마을 등급 (이웃이 보러 오면 비교하는 맛) · 칭호
    grade: townGrade(),
    title: myTitle(),
    trophies: [...P.trophies],
    layout: objs.filter((o) => o.build === undefined).map((o) => [o.kind, o.tx, o.ty, o.lvl, o.hue, !!o.flip]),
  };
}

/** 도감 완성률(%) = 손님·아이템·영웅 도감 평균 */
export function codexPct(): number {
  const g = P.dex.guests.length / GUEST_DEX_TOTAL;
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
/** 이 기기 저장이 어느 계정 것인지 (그 계정으로 올린 적이 있으면 그 사람 것) */
const OWNER = 'cloudOwner';
export function markOwner() {
  if (me.profile) setPref(OWNER, me.profile.id);
}

/** 지금 상태를 서버로 (저장 + 마을 모습) */
export async function pushNow() {
  if (!online() || !ready || !S.started || pushing) return;
  pushing = true;
  try {
    await pushSave(snapshot(), CONFIG.save.version);
    markOwner();
    await pushVillage(villageSnapshot(), S.innName, repHero());
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

/** 한 판 기록: 로그인했으면 서버로(서버가 다시 검사), 아니면 이 기기 outbox에 쌓아 두었다가 로그인 때 */
export async function submitRecord(rec: RaidRecord): Promise<{ ok: boolean; reason?: string; online: boolean }> {
  const why = validRecord(rec);
  if (why) return { ok: false, reason: why, online: online() };
  if (!online()) {
    P.raid.outbox.push(rec);
    if (P.raid.outbox.length > 60) P.raid.outbox.splice(0, P.raid.outbox.length - 60);
    return { ok: true, online: false };
  }
  const r = await submitRaid({ week: rec.week, bossId: rec.bossId, damage: rec.damage, power: rec.power, theory: rec.theory, manual: rec.mode === 'manual' });
  if (r === 'error') {
    P.raid.outbox.push(rec);
    return { ok: true, reason: '서버에 못 올려서 나중에 다시 올려요', online: true };
  }
  if (r === 'ok') void checkRank1(rec.week);
  return { ok: r === 'ok', reason: r === 'rejected' ? '서버가 기록을 거부했어요' : undefined, online: true };
}

/** 로그인 뒤 쌓인 기록을 한 번에 (거부된 건 버린다) */
export async function flushOutbox(): Promise<{ ok: number; rejected: number }> {
  let ok = 0;
  let rejected = 0;
  if (!online()) return { ok, rejected };
  const list = P.raid.outbox.splice(0);
  for (const rec of list) {
    const r = await submitRaid({ week: rec.week, bossId: rec.bossId, damage: rec.damage, power: rec.power, theory: rec.theory, manual: rec.mode === 'manual' });
    if (r === 'ok') ok++;
    else if (r === 'rejected') rejected++;
    else P.raid.outbox.push(rec);
  }
  return { ok, rejected };
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
  const wk = P.raid.prevWeek;
  if (!online() || !wk || P.raid.rankChecked === wk) return;
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
