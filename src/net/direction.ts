// DIRECTION §2: 서버 부르기 — 제보 답장 · 반영 크레딧 · 함께 만든 사람들 · 소문 보내기 · 운영자 제보함
//  서버에 supabase/direction.sql이 아직 없으면(함수 없음) 기능을 조용히 숨긴다: 오류·토스트 없이 빈 값
import { creditsByVer } from '../data/credits';
import { me, onAuthChange, sb } from './server';

/** 서버에 없다고 확인된 함수 (한 번 없으면 이번 실행 동안 다시 안 부른다) */
const missing = new Set<string>();
const isMissing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist|schema cache/i.test(e.message ?? ''));

/** 함수 부르기: 성공 → data · 실패(없음·오류·서버 없음) → null (절대 던지지 않는다) */
export async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!sb || missing.has(fn)) return null;
  try {
    const { data, error } = await sb.rpc(fn, args ?? {});
    if (error) {
      if (isMissing(error)) missing.add(fn);
      return null;
    }
    return (data ?? null) as T | null;
  } catch {
    return null;
  }
}
export const fnMissing = (fn: string) => missing.has(fn);
/** 시험용 */
export const _resetDirection = () => {
  missing.clear();
  admin = false;
  rumorsReady = false;
  approved = [];
  contribs = null;
};

// ───────── 운영자 ─────────

let admin = false;
/** 운영자 계정인가 (서버 is_admin · 로그인할 때마다 다시) */
export const amAdmin = () => admin && !!me.profile;
export async function refreshAdmin(): Promise<boolean> {
  admin = !!me.profile && (await call<boolean>('is_admin')) === true;
  return admin;
}
onAuthChange(() => void refreshAdmin());

export interface LetterRow {
  id: number;
  created_at: string;
  user_id: string;
  nickname: string | null;
  body: string;
  app_version: string | null;
  status: '접수' | '반영' | '보류';
  reply: string | null;
  ver_fixed: string | null;
  replied_at: string | null;
  reply_read: boolean;
  fixed_n: number;
}
export const adminLetters = async (status: string | null = null) => (await call<LetterRow[]>('admin_list_letters', { p_status: status, p_limit: 200 })) ?? [];
export async function adminSetLetter(id: number, patch: { status?: string; reply?: string; ver?: string }): Promise<boolean> {
  return (await call<string>('admin_set_letter', { p_id: id, p_status: patch.status ?? null, p_reply: patch.reply ?? null, p_ver_fixed: patch.ver ?? null })) === 'ok';
}
export interface RumorRow {
  id: number;
  created_at: string;
  nickname: string | null;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
}
export const adminRumors = async (status: string | null = 'pending') => (await call<RumorRow[]>('admin_list_rumors', { p_status: status })) ?? [];
export const adminSetRumor = async (id: number, status: RumorRow['status']) => (await call<string>('admin_set_rumor', { p_id: id, p_status: status })) === 'ok';
export interface AdminContrib {
  user_id: string;
  nickname: string;
  line: string | null;
  fixed_n: number;
  pioneer: string | null;
}
export const adminContributors = async () => (await call<AdminContrib[]>('admin_contributors')) ?? [];
export const adminSetNote = async (uid: string, line: string) => (await call<string>('admin_set_contributor_note', { p_user: uid, p_line: line })) === 'ok';

// ───────── 제보 답장 (유저) ─────────

export interface ReplyRow {
  id: number;
  body: string;
  reply: string;
  status: string;
  ver_fixed: string | null;
  replied_at: string | null;
}
export async function myReplies(): Promise<ReplyRow[]> {
  if (!me.profile) return [];
  return (await call<ReplyRow[]>('my_letter_replies')) ?? [];
}
export async function markRepliesRead(ids: number[]): Promise<boolean> {
  if (!ids.length || !me.profile) return false;
  return (await call<number>('mark_replies_read', { p_ids: ids })) != null;
}

// ───────── 반영 크레딧 · 함께 만든 사람들 ─────────

/** 버전 → 제보한 닉네임들 (서버가 없으면 빈 Map) */
export async function letterCredits(): Promise<Map<string, string[]>> {
  const rows = await call<{ ver_fixed: string; nickname: string }[]>('letter_credits', { p_ver: null });
  return creditsByVer(rows ?? []);
}
export interface Contributor {
  nickname: string;
  line: string | null;
  fixed_n: number;
  pioneer: string | null;
}
let contribs: Contributor[] | null = null;
/** 함께 만든 사람들 (한 번 받아 두고 · 서버가 없으면 빈 목록) */
export async function contributors(force = false): Promise<Contributor[]> {
  if (contribs && !force) return contribs;
  contribs = (await call<Contributor[]>('contributors')) ?? [];
  return contribs;
}
/** 받아 둔 목록 (엔딩 크레딧처럼 기다릴 수 없는 곳) */
export const contributorsCached = () => contribs ?? [];

// ───────── 소문 보내기 ─────────

let rumorsReady = false;
let approved: { id: number; body: string; nickname: string }[] = [];
/** 승인된 소문을 받아 둔다 — 함수가 있으면 「소문 보내기」도 켠다 */
export async function loadApprovedRumors(): Promise<{ id: number; body: string; nickname: string }[]> {
  const r = await call<{ id: number; body: string; nickname: string }[]>('approved_rumors');
  rumorsReady = r != null;
  approved = r ?? [];
  return approved;
}
export const approvedRumors = () => approved;
/** 「소문 보내기」를 쓸 수 있나: 서버 함수가 있고 로그인했을 때 */
export const rumorSendReady = () => rumorsReady && !!me.profile;

const RUMOR_ERR: Record<string, string> = {
  no_profile: '로그인하면 소문을 보낼 수 있어요',
  banned: '채팅이 제한된 계정이에요',
  length: '1~40자로 써 주세요',
  link: '링크는 보낼 수 없어요',
  banned_word: '쓸 수 없는 말이 들어 있어요',
  daily: '소문은 하루에 하나만 보낼 수 있어요',
};
/** 보내기 → null(성공) | 안내 문구 */
export async function submitRumor(body: string): Promise<string | null> {
  if (!sb || !me.profile) return RUMOR_ERR.no_profile;
  const r = await call<string>('submit_rumor', { p_body: body });
  if (r === 'ok') return null;
  return (r && RUMOR_ERR[r]) || '보내지 못했어요. 잠시 뒤에 다시 해 주세요';
}
