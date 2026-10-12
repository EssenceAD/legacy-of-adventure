// Supabase 연결 (3단계 2차). 서버 쪽(테이블·보안 규칙·함수·계정 복구)은 이미 있다 — 여기선 부르기만 한다.
// 공개 키(publishable)만 쓴다. 로그인 안 한 손님은 이 모듈을 거치지 않고 지금처럼 로컬로 논다.
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '../data/config';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

export const sb: SupabaseClient | null =
  URL && KEY ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'legacy-of-adventure-auth' } }) : null;

export interface Profile {
  id: string;
  login_id: string;
  nickname: string;
  inn_name: string;
  rep_hero: string | null;
  reputation: number;
  codex_pct: number;
  created_at: string;
}

/** 지금 로그인한 사람 (프로필까지 있어야 로그인으로 친다) */
export const me = { profile: null as Profile | null };
/** GUEST_SPEC: 게스트(익명 로그인) 계정인가 — 아이디가 g_ 로 시작 */
export const isGuest = () => !!me.profile && me.profile.login_id.startsWith(CONFIG.cloud.guestPrefix);
export const online = () => !!me.profile;

const listeners = new Set<() => void>();
export const onAuthChange = (fn: () => void) => listeners.add(fn);
const emit = () => listeners.forEach((f) => f());

// ───────── 아이디 규칙 (화면에 '이메일'이라는 말은 안 나온다) ─────────

export const LOGIN_RE = /^[a-z0-9_]{4,16}$/;
const emailOf = (loginId: string) => `${loginId}@players.legacy-of-adventure.app`;

export function checkSignUp(loginId: string, pw: string, nickname: string): string | null {
  if (!LOGIN_RE.test(loginId)) return '아이디는 영어 소문자·숫자·_ 4~16자예요';
  if (loginId.startsWith(CONFIG.cloud.guestPrefix)) return `아이디는 ${CONFIG.cloud.guestPrefix}로 시작할 수 없어요`;
  if (pw.length < 6) return '비밀번호는 6자 이상이에요';
  const n = [...nickname.trim()].length;
  if (n < 2 || n > 8) return '닉네임은 2~8자예요';
  return null;
}

/** 복구 코드: 헷갈리는 글자(0·O·1·I) 없이 16자, 4자씩 */
export function makeRecoveryCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint32Array(16));
  const s = [...r].map((v) => A[v % A.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12)}`;
}

async function loadProfile(): Promise<Profile | null> {
  if (!sb) return null;
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return null;
  const { data } = await sb.from('profiles').select('id,login_id,nickname,inn_name,rep_hero,reputation,codex_pct,created_at').eq('id', u.user.id).maybeSingle();
  return (data as Profile) ?? null;
}

/** 앱 켤 때: 남아 있는 로그인이 있으면 이어서 */
export async function initAuth() {
  if (!sb) return;
  try {
    me.profile = await loadProfile();
  } catch {
    me.profile = null;
  }
  emit();
}

const authError = (m: string) =>
  /already registered|already exists/i.test(m) ? '이미 있는 아이디예요'
    : /invalid login credentials/i.test(m) ? '아이디나 비밀번호가 맞지 않아요'
      : /rate limit|too many/i.test(m) ? '잠시 뒤에 다시 해 주세요'
        : /network|fetch/i.test(m) ? '서버에 연결할 수 없어요' : '문제가 생겼어요: ' + m;

/** 가입: 아이디·닉네임 중복 확인 → 계정 → 프로필 → 복구 코드. 성공하면 복구 코드를 돌려준다 */
export async function signUp(loginId: string, pw: string, nickname: string, innName: string): Promise<{ code: string } | { error: string }> {
  if (!sb) return { error: '서버에 연결할 수 없어요' };
  const bad = checkSignUp(loginId, pw, nickname);
  if (bad) return { error: bad };
  nickname = nickname.trim();
  const { data: dup } = await sb.from('profiles').select('login_id,nickname').or(`login_id.eq.${loginId},nickname.eq.${nickname}`);
  if (dup?.some((d) => d.login_id === loginId)) return { error: '이미 있는 아이디예요' };
  if (dup?.some((d) => d.nickname === nickname)) return { error: '이미 있는 닉네임이에요' };
  const { data, error } = await sb.auth.signUp({ email: emailOf(loginId), password: pw });
  if (error || !data.user) return { error: authError(error?.message ?? '') };
  if (!data.session) {
    const r = await sb.auth.signInWithPassword({ email: emailOf(loginId), password: pw });
    if (r.error) return { error: authError(r.error.message) };
  }
  const { error: pe } = await sb.from('profiles').insert({ id: data.user.id, login_id: loginId, nickname, inn_name: (innName || '이름 없는 여관').slice(0, 12) });
  if (pe) return { error: pe.code === '23505' ? '이미 있는 닉네임이에요' : '프로필을 만들지 못했어요: ' + pe.message };
  const code = makeRecoveryCode();
  await sb.rpc('set_recovery_code', { p_code: code });
  me.profile = await loadProfile();
  emit();
  return { code };
}

export async function login(loginId: string, pw: string): Promise<string | null> {
  if (!sb) return '서버에 연결할 수 없어요';
  if (!LOGIN_RE.test(loginId)) return '아이디는 영어 소문자·숫자·_ 4~16자예요';
  const { error } = await sb.auth.signInWithPassword({ email: emailOf(loginId), password: pw });
  if (error) return authError(error.message);
  me.profile = await loadProfile();
  if (!me.profile) return '프로필이 없는 계정이에요 (가입을 끝까지 못 했어요)';
  emit();
  return null;
}

export async function logout() {
  if (!sb) return;
  await sb.auth.signOut({ scope: 'local' }); // 이 기기만 (다른 기기는 그대로)
  me.profile = null;
  emit();
}

/** 설정 → 복구 코드 다시 받기 */
export async function regenRecovery(): Promise<string | null> {
  if (!sb || !online()) return null;
  const code = makeRecoveryCode();
  const { error } = await sb.rpc('set_recovery_code', { p_code: code });
  return error ? null : code;
}

/** 비밀번호 찾기: 아이디 + 복구 코드 + 새 비밀번호 (Edge Function recover-account) */
export async function recover(loginId: string, code: string, newPw: string): Promise<string | null> {
  if (!URL || !KEY) return '서버에 연결할 수 없어요';
  if (newPw.length < 6) return '비밀번호는 6자 이상이에요';
  try {
    const r = await fetch(`${URL}/functions/v1/recover-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ login_id: loginId.trim(), code: code.trim().toUpperCase(), new_password: newPw }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.ok) return null;
    return j.error === 'wrong_code' ? '아이디나 복구 코드가 맞지 않아요' : '바꾸지 못했어요' + (j.error ? ` (${j.error})` : '');
  } catch {
    return '서버에 연결할 수 없어요';
  }
}

// ───────── GUEST_SPEC §1: 게스트 계정 (익명 로그인) ─────────

const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, n);
/** 조용히 게스트 계정 만들기 (서버에서 익명 로그인이 꺼져 있으면 아무 일도 안 한다) · 됐으면 true */
export async function ensureGuest(innName: string): Promise<boolean> {
  if (!sb || me.profile) return !!me.profile;
  // 개발·검사(봇 빌드·자동화 브라우저)에선 진짜 서버에 계정을 만들지 않는다
  if (import.meta.env.DEV || import.meta.env.MODE === 'test' || navigator.webdriver) return false;
  try {
    let { data: u } = await sb.auth.getUser();
    if (!u.user) {
      const r = await sb.auth.signInAnonymously();
      if (r.error || !r.data.user) return false;
      u = { user: r.data.user };
    }
    // 프로필: 아이디 g_ + 12자 · 닉네임 「주인」+ 6자 (겹치면 다시)
    for (let i = 0; i < 4 && !me.profile; i++) {
      const id = u.user!.id.replace(/-/g, '');
      const { error } = await sb.from('profiles').insert({ id: u.user!.id, login_id: (CONFIG.cloud.guestPrefix + id.slice(0, 12)).slice(0, 16), nickname: '주인' + hex(6), inn_name: (innName || '이름 없는 여관').slice(0, 12) });
      if (error && error.code !== '23505') return false;
      me.profile = await loadProfile();
    }
    if (me.profile) emit();
    return !!me.profile;
  } catch {
    return false;
  }
}

/**
 * GUEST_SPEC §1: 「계정 연결하기」 — 게스트 계정에 아이디·비밀번호를 붙인다 (같은 계정 그대로 · 데이터 유지)
 * 서버: 로그인 이메일·비밀번호(updateUser) → 아이디 바꾸기(link_guest, 게스트일 때만) → 닉네임 → 복구 코드
 */
export async function linkGuest(loginId: string, pw: string, nickname: string): Promise<{ code: string } | { error: string }> {
  if (!sb || !isGuest()) return { error: '게스트 계정이 아니에요' };
  const bad = checkSignUp(loginId, pw, nickname);
  if (bad) return { error: bad };
  nickname = nickname.trim();
  const { data: dup } = await sb.from('profiles').select('id,login_id,nickname').or(`login_id.eq.${loginId},nickname.eq.${nickname}`);
  if (dup?.some((d) => d.login_id === loginId)) return { error: '이미 있는 아이디예요' };
  if (dup?.some((d) => d.nickname === nickname && d.id !== me.profile!.id)) return { error: '이미 있는 닉네임이에요' };
  // 서버에 link_guest가 있어야 아이디를 바꿀 수 있다 — 없으면 아무것도 바꾸지 않고 멈춘다
  const probe = await sb.rpc('link_guest', { new_login_id: loginId, dry_run: true });
  if (probe.error) return { error: /function|not find|does not exist/i.test(probe.error.message) ? '계정 연결은 서버 준비 중이에요. 조금만 기다려 주세요' : '연결하지 못했어요: ' + probe.error.message };
  if (probe.data !== 'ok') return { error: probe.data === 'taken' ? '이미 있는 아이디예요' : '연결하지 못했어요 (' + probe.data + ')' };
  const up = await sb.auth.updateUser({ email: emailOf(loginId), password: pw });
  if (up.error) return { error: authError(up.error.message) };
  const ln = await sb.rpc('link_guest', { new_login_id: loginId, dry_run: false });
  if (ln.error || ln.data !== 'ok') return { error: '아이디를 바꾸지 못했어요 (로그인은 새 아이디로 돼요)' };
  await sb.from('profiles').update({ nickname, updated_at: new Date().toISOString() }).eq('id', me.profile!.id);
  const code = makeRecoveryCode();
  await sb.rpc('set_recovery_code', { p_code: code });
  me.profile = await loadProfile();
  emit();
  return { code };
}

// ───────── EASTER: 베타 개척자 (profiles.pioneer — 칸이 아직 없으면 조용히 없음) ─────────

/** 내 계정의 개척자 값 */
export async function myPioneer(): Promise<string | null> {
  if (!sb || !me.profile) return null;
  const r = await sb.from('profiles').select('pioneer').eq('id', me.profile.id).maybeSingle();
  return r.error ? null : ((r.data as { pioneer?: string | null } | null)?.pioneer ?? null);
}
/** 개척자 계정들 (uid → pioneer) — 채팅 별 · 이웃 목록 금색 테두리 */
let pioneerMap: Map<string, string> | null = null;
export async function pioneers(): Promise<Map<string, string>> {
  if (pioneerMap || !sb) return pioneerMap ?? new Map();
  const r = await sb.from('profiles').select('id,pioneer').not('pioneer', 'is', null);
  pioneerMap = new Map(r.error ? [] : (r.data ?? []).map((x) => [x.id as string, x.pioneer as string]));
  return pioneerMap;
}
export const pioneerOfUid = (uid: string) => pioneerMap?.get(uid) ?? null;

// ───────── 클라우드 저장 · 마을 모습 ─────────

export async function pushSave(data: unknown, version: number) {
  if (!sb || !me.profile) return;
  await sb.from('saves').upsert({ user_id: me.profile.id, version, data, updated_at: new Date().toISOString() });
}

export async function pullSave(): Promise<{ data: Record<string, unknown>; updated_at: string } | null> {
  if (!sb || !me.profile) return null;
  const { data } = await sb.from('saves').select('data,updated_at').eq('user_id', me.profile.id).maybeSingle();
  return (data as { data: Record<string, unknown>; updated_at: string }) ?? null;
}

/** 이웃이 볼 마을 모습 + 프로필(여관 이름·대표 영웅) */
export async function pushVillage(snapshot: unknown, innName: string, repHero: string | null) {
  if (!sb || !me.profile) return;
  // villages는 snapshot·updated_at만 고칠 수 있다(좋아요 수는 서버만) → upsert 대신 고치기, 없으면 만들기
  const at = new Date().toISOString();
  const { data: upd } = await sb.from('villages').update({ snapshot, updated_at: at }).eq('user_id', me.profile.id).select('user_id');
  if (!upd?.length) await sb.from('villages').insert({ user_id: me.profile.id, snapshot, updated_at: at });
  const inn = (innName || '이름 없는 여관').slice(0, 12);
  if (me.profile.inn_name !== inn || me.profile.rep_hero !== repHero) {
    await sb.from('profiles').update({ inn_name: inn, rep_hero: repHero, updated_at: new Date().toISOString() }).eq('id', me.profile.id);
    me.profile.inn_name = inn;
    me.profile.rep_hero = repHero;
  }
}

export interface VillageRow {
  user_id: string;
  snapshot: Record<string, unknown>;
  likes: number;
  updated_at: string;
}

/** GUEST_SPEC §2: 숨길 운영·테스트 계정 (profiles.is_test · 컬럼이 아직 없으면 아이디 목록으로) */
let hiddenIds: Set<string> | null = null;
async function testIds(): Promise<Set<string>> {
  if (hiddenIds || !sb) return hiddenIds ?? new Set();
  const r = await sb.from('profiles').select('id').eq('is_test', true);
  if (!r.error) hiddenIds = new Set((r.data ?? []).map((x) => x.id as string));
  else {
    const f = await sb.from('profiles').select('id').in('login_id', CONFIG.cloud.testLogins);
    hiddenIds = new Set((f.data ?? []).map((x) => x.id as string));
  }
  return hiddenIds;
}
/** 실제 유저 마을: 최근 7일 안에 접속한 마을 · ♥ 많은 순 → 최근 순 · 내 마을·테스트 계정 빼고 */
export async function listVillages(n: number = CONFIG.cloud.neighborPage): Promise<VillageRow[]> {
  if (!sb) return [];
  const since = new Date(Date.now() - CONFIG.cloud.neighborDays * 86400000).toISOString();
  const hide = await testIds();
  let q = sb.from('villages').select('user_id,snapshot,likes,updated_at').gte('updated_at', since).order('likes', { ascending: false }).order('updated_at', { ascending: false }).limit(n + hide.size + 1);
  if (me.profile) q = q.neq('user_id', me.profile.id);
  const { data } = await q;
  return ((data as VillageRow[]) ?? []).filter((r) => !hide.has(r.user_id)).slice(0, n + 1);
}
/** 내 여관 (목록 맨 위 고정 · ♥ 확인용) */
export async function myVillage(): Promise<VillageRow | null> {
  return me.profile ? getVillage(me.profile.id) : null;
}
export async function getVillage(uid: string): Promise<VillageRow | null> {
  if (!sb) return null;
  const { data } = await sb.from('villages').select('user_id,snapshot,likes,updated_at').eq('user_id', uid).maybeSingle();
  return (data as VillageRow) ?? null;
}

/** 좋아요 (마을당 하루 1번은 서버가 막는다) → 새 좋아요 수 */
export async function likeVillage(uid: string): Promise<number | { error: string }> {
  if (!sb || !me.profile) return { error: '로그인하면 좋아요를 남길 수 있어요' };
  const { data, error } = await sb.rpc('like_village', { p_village: uid });
  if (error) return { error: /self/.test(error.message) ? '내 마을엔 좋아요를 못 눌러요' : '좋아요를 못 남겼어요' };
  return data as number;
}

// ───────── 랭킹 ─────────

export type Board = 'raidWeek' | 'reputation' | 'dex' | 'evalWeek';
export interface RankRow {
  rank: number;
  user_id: string;
  nickname: string;
  inn_name: string;
  rep_hero: string | null;
  score: number;
}

const BOARD = {
  raidWeek: { view: 'rank_weekly_raid', col: 'best_damage' },
  reputation: { view: 'rank_reputation', col: 'reputation' },
  dex: { view: 'rank_codex', col: 'codex_pct' },
  // 베타 2장: 여관 평가단 주간 점수 (서버: eval_scores 테이블 · rank_eval 뷰 · submit_eval_score 함수)
  evalWeek: { view: 'rank_eval', col: 'score' },
} as const;
/** 주마다 갈리는 판 */
const weekly = (b: Board) => b === 'raidWeek' || b === 'evalWeek';

export async function top(board: Board, n: number, week?: string): Promise<RankRow[]> {
  if (!sb) return [];
  const B = BOARD[board];
  let q = sb.from(B.view).select(`user_id,nickname,inn_name,rep_hero,${B.col}`).order(B.col, { ascending: false }).limit(n);
  if (weekly(board)) q = q.eq('week', week ?? '');
  else q = q.gt(B.col, 0);
  const { data } = await q;
  return ((data as unknown as Record<string, unknown>[]) ?? []).map((r, i) => ({
    rank: i + 1,
    user_id: r.user_id as string,
    nickname: r.nickname as string,
    inn_name: r.inn_name as string,
    rep_hero: (r.rep_hero as string) ?? null,
    score: Number(r[B.col]),
  }));
}

/** 내 순위 = 내 점수보다 높은 사람 수 + 1 · 전체 수 */
export async function mine(board: Board, week?: string): Promise<{ row: RankRow | null; total: number }> {
  if (!sb || !me.profile) return { row: null, total: 0 };
  const B = BOARD[board];
  const base = () => {
    const q = sb!.from(B.view).select('user_id', { count: 'exact', head: true });
    return weekly(board) ? q.eq('week', week ?? '') : q.gt(B.col, 0);
  };
  let mq = sb.from(B.view).select(`user_id,nickname,inn_name,rep_hero,${B.col}`).eq('user_id', me.profile.id);
  if (weekly(board)) mq = mq.eq('week', week ?? '');
  const { data } = await mq.maybeSingle();
  const { count: total } = await base();
  if (!data) return { row: null, total: total ?? 0 };
  const r = data as unknown as Record<string, unknown>;
  const score = Number(r[B.col]);
  const { count: higher } = await base().gt(B.col, score);
  return {
    row: { rank: (higher ?? 0) + 1, user_id: me.profile.id, nickname: r.nickname as string, inn_name: r.inn_name as string, rep_hero: (r.rep_hero as string) ?? null, score },
    total: total ?? 0,
  };
}

/** 토벌 기록 올리기 → 'ok' | 'rejected' (서버가 이론치×1.5·전투력 3배·하루 6판을 다시 검사) */
export async function submitRaid(rec: { week: string; bossId: string; damage: number; power: number; theory: number; manual: boolean }): Promise<'ok' | 'rejected' | 'error'> {
  if (!sb || !me.profile) return 'error';
  const { data, error } = await sb.rpc('submit_raid_score', {
    p_week: rec.week, p_boss: rec.bossId, p_damage: Math.round(rec.damage), p_power: Math.round(rec.power), p_theory: Math.round(rec.theory), p_manual: rec.manual,
  });
  if (error) return 'error';
  return data === 'ok' ? 'ok' : 'rejected';
}

/** 평가단 점수 올리기 (서버가 0~1030 범위 · 테마 · 주 1행을 다시 검사, 더 높을 때만 바꾼다) */
export async function submitEval(rec: { week: string; theme: number; score: number; parts: Record<string, number> }): Promise<'ok' | 'rejected' | 'error'> {
  if (!sb || !me.profile) return 'error';
  const { data, error } = await sb.rpc('submit_eval_score', { p_week: rec.week, p_theme: rec.theme, p_score: Math.round(rec.score), p_parts: rec.parts });
  if (error) return 'error';
  return data === 'ok' ? 'ok' : 'rejected';
}

export async function updateStats(reputation: number, codexPct: number) {
  if (!sb || !me.profile) return;
  await sb.rpc('update_stats', { p_reputation: Math.round(reputation), p_codex: Math.round(codexPct * 10) / 10 });
}

// ───────── 채팅 ─────────

export interface ChatRow {
  id: number;
  user_id: string | null;
  channel: 'world' | 'notice';
  nickname: string;
  rep_hero: string | null;
  body: string;
  created_at: string;
}

export async function recentChat(n = 50): Promise<ChatRow[]> {
  if (!sb) return [];
  const { data } = await sb.from('chat_messages').select('*').in('channel', ['world', 'notice']).order('created_at', { ascending: false }).limit(n);
  return ((data as ChatRow[]) ?? []).reverse();
}

let chatCh: RealtimeChannel | null = null;
export function subscribeChat(fn: (m: ChatRow) => void) {
  if (!sb || chatCh) return;
  chatCh = sb
    .channel('chat')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (p) => fn(p.new as ChatRow))
    .subscribe();
}

const CHAT_ERR: Record<string, string> = {
  too_new: '가입 후 하루가 지나면 [세계] 채팅을 쓸 수 있어요',
  too_fast: '조금 천천히 말해 주세요',
  banned_word: '쓸 수 없는 말이 들어 있어요',
  link: '링크는 보낼 수 없어요',
  banned: '채팅이 제한된 계정이에요',
  length: '1~100자로 써 주세요',
  no_profile: '로그인하면 [세계] 채팅을 쓸 수 있어요',
};
export async function sendChat(body: string): Promise<string | null> {
  if (!sb || !me.profile) return CHAT_ERR.no_profile;
  const { error } = await sb.rpc('send_chat', { p_body: body });
  if (!error) return null;
  const k = Object.keys(CHAT_ERR).find((x) => error.message.includes(x));
  return k ? CHAT_ERR[k] : '보내지 못했어요';
}

/** [알림]: 문장은 서버가 만든다 */
export async function postNotice(kind: 'legend' | 'boss_kill' | 'rank1', arg: string) {
  if (!sb || !me.profile) return;
  await sb.rpc('post_notice', { p_kind: kind, p_arg: arg });
}

export const blocked = new Set<string>();
export async function loadBlocks() {
  blocked.clear();
  if (!sb || !me.profile) return;
  const { data } = await sb.from('chat_blocks').select('blocked_id').eq('user_id', me.profile.id);
  for (const r of data ?? []) blocked.add(r.blocked_id as string);
}
export async function block(uid: string) {
  if (!sb || !me.profile) return;
  await sb.from('chat_blocks').insert({ user_id: me.profile.id, blocked_id: uid });
  blocked.add(uid);
}
export async function unblock(uid: string) {
  if (!sb || !me.profile) return;
  await sb.from('chat_blocks').delete().eq('user_id', me.profile.id).eq('blocked_id', uid);
  blocked.delete(uid);
}
export async function reportChat(messageId: number): Promise<boolean> {
  if (!sb || !me.profile) return false;
  const { error } = await sb.from('chat_reports').insert({ reporter: me.profile.id, message_id: messageId });
  return !error;
}

// ───────── 제보 편지 · 공지 ─────────

export async function sendLetter(body: string, appVersion: string): Promise<boolean> {
  if (!sb || !me.profile) return false;
  const { error } = await sb.from('bug_letters').insert({ user_id: me.profile.id, body: body.slice(0, 1000), app_version: appVersion });
  return !error;
}

export interface NoticeRow {
  id: number;
  title: string;
  body: string;
  created_at: string;
}
export async function listNotices(): Promise<NoticeRow[]> {
  if (!sb) return [];
  const { data } = await sb.from('notices').select('*').order('created_at', { ascending: false }).limit(30);
  return (data as NoticeRow[]) ?? [];
}
