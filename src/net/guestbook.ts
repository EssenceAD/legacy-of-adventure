// LUXE §4 이웃 방명록 · 좋아요 — 서버 부르기 (supabase/guestbook.sql)
//  SQL이 아직 없으면(함수 없음) 조용히 'missing' → 화면은 「준비 중」 · 좋아요는 예전 like_village(p_village)로
//  공개 키만 쓴다. 검사(로그인 · 장부 2장 · 자기 마을 · 하루 한 번)는 서버가 다시 한다
import { GB } from '../data/guestbook_cfg';
import { validPhrase } from '../world/guestbook';
import { me, sb } from './server';

export interface GbRow { from_user: string; inn_name: string; nickname: string; rep_hero: string | null; phrase: number | null; day: string; at: string }
export interface GbBook { week: number; total: number; rows: GbRow[] }
export interface PopRow { rank: number; user_id: string; nickname: string; inn_name: string; rep_hero: string | null; likes: number }
export interface PopBoard { rows: PopRow[]; me: { rank: number; likes: number } | null }
export interface TopLast { user_id: string; inn_name: string; nickname: string; rep_hero: string | null; likes: number }

/** 함수가 서버에 없다는 오류인가 (PostgREST PGRST202 · Postgres 42883) */
export const isMissing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist|schema cache/i.test(e.message ?? ''));

/** 이번 실행에서 서버에 방명록 함수가 없다고 확인됨 (다시 묻지 않는다 · 앱을 다시 켜면 다시 확인) */
export const gbServer = { missing: false };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown, n = 40) => (typeof v === 'string' ? v.slice(0, n) : '');

export type LikeResult = { ok: true; likes: number } | { ok: false; why: 'login' | 'phrase' | 'self' | 'no_village' | 'chapter' | 'already' | 'missing' | 'net' };

/** 도장 한마디와 함께 좋아요 */
export async function likeWithStamp(uid: string, phrase: number): Promise<LikeResult> {
  if (!sb || !me.profile) return { ok: false, why: 'login' };
  if (!validPhrase(phrase)) return { ok: false, why: 'phrase' };
  if (uid === me.profile.id) return { ok: false, why: 'self' };
  if (gbServer.missing) return { ok: false, why: 'missing' };
  try {
    const { data, error } = await sb.rpc('like_village', { p_village: uid, p_phrase: phrase });
    if (error) {
      if (isMissing(error)) {
        gbServer.missing = true;
        return { ok: false, why: 'missing' };
      }
      return { ok: false, why: 'net' };
    }
    const r = (data ?? {}) as { r?: string; likes?: number };
    if (r.r === 'ok') return { ok: true, likes: num(r.likes) };
    const why = (['login', 'phrase', 'self', 'no_village', 'chapter', 'already'] as const).find((k) => k === r.r);
    return { ok: false, why: why ?? 'net' };
  } catch {
    return { ok: false, why: 'net' };
  }
}

/** 내 방명록 (로그인 · 함수 없음 · 오류면 null) */
export async function myGuestbook(limit = GB.recent): Promise<GbBook | null> {
  if (!sb || !me.profile || gbServer.missing) return null;
  try {
    const { data, error } = await sb.rpc('my_guestbook', { p_limit: limit });
    if (error) {
      if (isMissing(error)) gbServer.missing = true;
      return null;
    }
    if (!data || typeof data !== 'object') return null;
    const d = data as { week?: unknown; total?: unknown; rows?: unknown };
    const rows = (Array.isArray(d.rows) ? d.rows : [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof (x as { from_user?: unknown }).from_user === 'string')
      .map((x) => ({
        from_user: x.from_user as string, inn_name: str(x.inn_name, 12) || '이름 없는 여관', nickname: str(x.nickname, 8), rep_hero: typeof x.rep_hero === 'string' ? x.rep_hero : null,
        phrase: typeof x.phrase === 'number' ? x.phrase : null, day: str(x.day, 10), at: str(x.at, 40),
      }));
    return { week: num(d.week), total: num(d.total), rows };
  } catch {
    return null;
  }
}

const popRow = (x: Record<string, unknown>): PopRow => ({
  rank: num(x.rank), user_id: String(x.user_id), nickname: str(x.nickname, 8), inn_name: str(x.inn_name, 12) || '이름 없는 여관', rep_hero: typeof x.rep_hero === 'string' ? x.rep_hero : null, likes: num(x.likes),
});

/** 이번 주 인기 마을 (함수 없음 · 오류면 null) */
export async function weeklyPopular(limit = GB.popularTop): Promise<PopBoard | null> {
  if (!sb || gbServer.missing) return null;
  try {
    const { data, error } = await sb.rpc('weekly_popular', { p_limit: limit });
    if (error) {
      if (isMissing(error)) gbServer.missing = true;
      return null;
    }
    const d = (data ?? {}) as { rows?: unknown; me?: unknown };
    const rows = (Array.isArray(d.rows) ? d.rows : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof (x as { user_id?: unknown }).user_id === 'string').map(popRow);
    const m = d.me && typeof d.me === 'object' ? (d.me as Record<string, unknown>) : null;
    return { rows, me: m && me.profile ? { rank: num(m.rank), likes: num(m.likes) } : null };
  } catch {
    return null;
  }
}

/** 지난주 1위 (없으면 null) — 한 번 받아 두고 다시 쓰기 (주가 바뀌면 다시) */
let lastTop: { week: string; v: TopLast | null } | null = null;
export async function lastWeekTop(week: string): Promise<TopLast | null> {
  if (lastTop?.week === week) return lastTop.v;
  if (!sb || gbServer.missing) return null;
  try {
    const { data, error } = await sb.rpc('last_week_popular');
    if (error) {
      if (isMissing(error)) gbServer.missing = true;
      return null;
    }
    const x = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    const v = x && typeof x.user_id === 'string' ? { user_id: x.user_id, inn_name: str(x.inn_name, 12) || '이름 없는 여관', nickname: str(x.nickname, 8), rep_hero: typeof x.rep_hero === 'string' ? x.rep_hero : null, likes: num(x.likes) } : null;
    lastTop = { week, v };
    return v;
  } catch {
    return null;
  }
}
/** 시험용 */
export function _resetGbNet() {
  gbServer.missing = false;
  lastTop = null;
}
