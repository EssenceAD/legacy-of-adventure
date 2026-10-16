// SOCIAL_SPEC §2~§4 「각별한 이웃」 서버 — reports/_tmp/friends.sql 의 함수만 부른다 (한도·잠금은 서버가 판단)
//  함수가 아직 없으면(SQL 적용 전) missing → 화면은 「준비 중」 · 아무것도 깨지지 않게
import { me, sb } from './server';

export interface FriendRow {
  other: string;
  status: 'ok' | 'in' | 'out';
  nickname: string;
  inn_name: string;
  rep_hero: string | null;
  last_seen: string | null;
  since: string | null;
  helped_today: number;
  can_help: boolean;
}
export interface HelpEvent {
  id: number;
  from_user: string;
  nickname: string | null;
  kind: 'con' | 'gift';
  target: string;
  amount: number;
  created_at: string;
}
export const friendServer = { missing: false };
const noFn = (e: { code?: string; message?: string } | null) => !!e && (e.code === 'PGRST202' || e.code === '42883' || /Could not find the function|does not exist/i.test(e.message ?? ''));

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T | null> {
  if (!sb || !me.profile || friendServer.missing) return null;
  try {
    const { data, error } = await sb.rpc(fn, args);
    if (error) {
      if (noFn(error)) friendServer.missing = true;
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

export const friendList = async () => (await rpc<FriendRow[]>('friend_list')) ?? null;
export const friendRequest = async (to: string) => (await rpc<string>('friend_request', { p_to: to })) ?? 'net';
export const friendAnswer = async (from: string, ok: boolean) => (await rpc<string>('friend_answer', { p_from: from, p_ok: ok })) ?? 'net';
export const friendRemove = async (other: string) => (await rpc<string>('friend_remove', { p_other: other })) ?? 'net';
export const sendHelp = async (to: string, kind: 'con' | 'gift', target: string) =>
  (await rpc<{ ok: boolean; tokens?: number; why?: string }>('send_help', { p_to: to, p_kind: kind, p_target: target })) ?? { ok: false, why: 'net' };
/** 주인: 아직 안 받은 도움을 가져간다 (서버가 applied_at을 찍으며 한 번만 돌려준다) */
export const claimHelp = async () => (await rpc<HelpEvent[]>('claim_help')) ?? [];
export const thankHelp = async (id: number) => (await rpc<string>('thank_help', { p_id: id })) ?? 'net';
/** 돕는 사람: 받은 「고마워요」 (한 번만) */
export const claimThanks = async () => (await rpc<{ id: number; to_user: string; nickname: string | null }[]>('claim_thanks')) ?? [];
