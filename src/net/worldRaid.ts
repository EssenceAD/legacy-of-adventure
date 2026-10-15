// RAIDWEAPON §3' 하늘 균열 — 서버 부르기 (supabase/world_raid.sql)
//  SQL이 아직 없으면(함수 없음) 조용히 'missing' → 화면은 알약·하늘 금 없음 · 랭킹 탭 「준비 중」 (오류 토스트 없음)
//  공개 키만 쓴다. 검사(기간 · 하루 3번 · 피해 상한 · 순위)는 서버가 한다 — 클라이언트는 보여 주기·미리 자르기만
import { isMissing } from './guestbook';
import { me, sb } from './server';

export interface RiftBoss {
  id: number;
  name: string;
  look: string;
  hpMax: number;
  hpLeft: number;
  startsAt: number;
  endsAt: number;
  day: string;
  test: boolean;
  killed: boolean;
  killerInn: string | null;
  players: number;
  myTries: number;
  myTotal: number;
  myRank: number | null;
  triesMax: number;
  /** 서버 시각 (ms) — 받은 순간 기기 시계와의 차이를 잰다 */
  now: number;
}
/** 순위 한 줄 — 서버는 user_id·닉네임을 돌려주지 않는다 (여관 이름 · 대표 영웅 · 피해 · 순위 · 내 줄이면 mine) */
export interface RiftRankRow { rank: number; inn_name: string; rep_hero: string | null; dmg: number; mine: boolean }
/** 내 순위 (서버가 auth.uid() 로 계산 · 순위에 없으면 rank null — 기록 없음 · 테스트 계정) */
export interface RiftMe { rank: number | null; dmg: number }
export interface RiftRank { bossId: number; day: string; weekStart: string; name: string; dayRows: RiftRankRow[]; meDay: RiftMe | null; weekRows: RiftRankRow[]; meWeek: RiftMe | null }
export interface RiftReward { id: number; kind: 'daily' | 'weekly'; day: string; week: string | null; payload: { frags?: number; dust?: number; boxes?: number; title?: string; rank?: number; killed?: boolean; dmg?: number; name?: string } }
export type HitResult = { ok: true; dmg: number; killedNow: boolean; boss: RiftBoss } | { ok: false; why: 'login' | 'no_boss' | 'ended' | 'tries' | 'missing' | 'net'; boss?: RiftBoss };

/** 이번 실행에서 서버에 균열 함수가 없다고 확인됨 (앱을 다시 켜면 다시 확인) */
export const riftServer = { missing: false };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown, n = 40) => (typeof v === 'string' ? v.slice(0, n) : '');
const time = (v: unknown) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : 0;
};

/** 서버 jsonb → RiftBoss (모양이 이상하면 null) */
export function parseBoss(d: unknown): RiftBoss | null {
  if (!d || typeof d !== 'object') return null;
  const x = d as Record<string, unknown>;
  if (x.id == null || !(num(x.hp_max) > 0)) return null;
  return {
    id: num(x.id), name: str(x.name, 20) || '하늘을 삼킨 것', look: str(x.look, 12) || 'sky', hpMax: num(x.hp_max), hpLeft: Math.max(0, num(x.hp_left)),
    startsAt: time(x.starts_at), endsAt: time(x.ends_at), day: str(x.day, 10), test: x.test === true, killed: x.killed === true, killerInn: typeof x.killer_inn === 'string' ? x.killer_inn.slice(0, 16) : null,
    players: num(x.players), myTries: num(x.my_tries), myTotal: num(x.my_total), myRank: x.my_rank == null ? null : num(x.my_rank), triesMax: num(x.tries_max) || 3, now: time(x.now) || Date.now(),
  };
}

async function rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; err: 'missing' | 'net' | null }> {
  if (!sb) return { data: null, err: 'net' };
  if (riftServer.missing) return { data: null, err: 'missing' };
  try {
    const { data, error } = await sb.rpc(fn, args);
    if (error) {
      if (isMissing(error)) {
        riftServer.missing = true;
        return { data: null, err: 'missing' };
      }
      return { data: null, err: 'net' };
    }
    return { data, err: null };
  } catch {
    return { data: null, err: 'net' };
  }
}

/** 정산 + 다음 보스 (pg_cron 이 없을 때 · 세션마다 한 번) */
export async function worldRoll(): Promise<void> {
  if (!me.profile) return;
  await rpc('world_roll');
}

/** 지금 보스 (없음 · 함수 없음 · 오류면 null) · test = 운영자 시험 보스 */
export async function worldCurrent(test = false): Promise<RiftBoss | null> {
  if (!me.profile) return null;
  const { data } = await rpc('world_current', { p_test: test });
  return parseBoss(data);
}

/** 한 판 올리기 */
export async function worldHit(boss: number, dmg: number, power: number): Promise<HitResult> {
  if (!me.profile) return { ok: false, why: 'login' };
  const { data, err } = await rpc('world_hit', { p_boss: boss, p_dmg: Math.max(0, Math.round(dmg)), p_power: Math.max(0, Math.min(2_000_000_000, Math.round(power))) });
  if (err) return { ok: false, why: err };
  const x = (data ?? {}) as Record<string, unknown>;
  const b = parseBoss(x);
  if (x.r === 'ok' && b) return { ok: true, dmg: num(x.dmg), killedNow: x.killed_now === true, boss: b };
  const why = (['login', 'no_boss', 'ended', 'tries'] as const).find((k) => k === x.r);
  return { ok: false, why: why ?? 'net', boss: b ?? undefined };
}

const rankRow = (x: Record<string, unknown>): RiftRankRow => ({
  rank: num(x.rank), inn_name: str(x.inn_name, 12) || '이름 없는 여관', rep_hero: typeof x.rep_hero === 'string' ? x.rep_hero : null, dmg: num(x.dmg), mine: x.mine === true,
});
const rows = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && num((x as { rank?: unknown }).rank) > 0).map(rankRow);
/** 내 순위·내 피해 합 (서버 my_rank·my_total) — 로그인 안 했거나 순위도 피해도 없으면 null */
const meOf = (rank: unknown, total: unknown): RiftMe | null => {
  if (!me.profile) return null;
  const r = rank == null ? null : num(rank) || null;
  const t = num(total);
  return r == null && !(t > 0) ? null : { rank: r, dmg: t };
};

/** 순위 (그날 · 이번 주) — 함수 없음이면 'missing' · 보스가 아직 없거나 오류면 null */
export async function worldRank(limit: number, boss: number | null = null): Promise<RiftRank | null | 'missing'> {
  const { data, err } = await rpc('world_rank', { p_boss: boss, p_limit: limit });
  if (err === 'missing') return 'missing';
  if (err || !data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  return { bossId: num(d.boss_id), day: str(d.day, 10), weekStart: str(d.week_start, 10), name: str(d.name, 20), dayRows: rows(d.day_rows), meDay: meOf(d.my_rank, d.my_total), weekRows: rows(d.week_rows), meWeek: meOf(d.my_week_rank, d.my_week_total) };
}

/** 받을 보상 (서버가 받는 순간 claimed 로 바꾼다 — 한 번만) */
export async function worldClaim(): Promise<RiftReward[]> {
  if (!me.profile) return [];
  const { data } = await rpc('world_claim');
  return (Array.isArray(data) ? data : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && (x as { id?: unknown }).id != null)
    .map((x) => {
      const p = (x.payload && typeof x.payload === 'object' ? x.payload : {}) as Record<string, unknown>;
      const n = (k: string) => (p[k] == null ? undefined : Math.max(0, Math.floor(num(p[k]))));
      return {
        id: num(x.id), kind: x.kind === 'weekly' ? 'weekly' : 'daily', day: str(x.day, 10), week: typeof x.week === 'string' ? x.week : null,
        payload: { frags: n('frags'), dust: n('dust'), boxes: n('boxes'), title: typeof p.title === 'string' ? p.title.slice(0, 12) : undefined, rank: n('rank'), killed: p.killed === true, dmg: n('dmg'), name: typeof p.name === 'string' ? p.name.slice(0, 20) : undefined },
      } as RiftReward;
    });
}

/** 시험용 */
export function _resetRiftNet() {
  riftServer.missing = false;
}
