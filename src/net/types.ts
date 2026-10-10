// 서버(2차: Supabase)와 주고받을 것들의 모양. 지금은 net/local.ts가 이 모양대로 로컬에만 쌓는다.
// 2차에서 net/supabase.ts를 같은 인터페이스로 만들고 net/index.ts의 한 줄만 바꾸면 된다.
import type { RaidRecord } from '../world/state';

/** 랭킹판 (3단계 6장) */
export type Board = 'raidWeek' | 'reputation' | 'dex';

export interface RankRow {
  rank: number;
  innName: string;
  owner: string;
  score: number;
  /** 대표 영웅 초상화 키 */
  portrait?: string;
  villageId?: string;
}

export interface SubmitResult {
  ok: boolean;
  /** 거부 이유 (상한 초과 등) */
  reason?: string;
}

export interface RankingService {
  /** 한 판 기록 올리기. 서버는 damage ≤ theory × recordCap 인지 다시 검사한다 */
  submit(rec: RaidRecord): Promise<SubmitResult>;
  /** 상위 n명 (로컬은 빈 목록) */
  top(board: Board, n: number): Promise<RankRow[]>;
  /** 내 순위 (로컬은 null) */
  mine(board: Board): Promise<RankRow | null>;
  readonly online: boolean;
}

export interface Account {
  id: string;
  nickname: string;
}

export interface AuthService {
  current(): Account | null;
  /** 아이디/비밀번호 로그인 · 닉네임 계정 + 복구 코드 (2차) */
  login(id: string, password: string): Promise<Account>;
  signUp(nickname: string, password: string): Promise<{ account: Account; recoveryCode: string }>;
  logout(): Promise<void>;
}

export interface CloudSaveService {
  /** 1분마다 + 앱 닫을 때 (2차) */
  push(snapshotJson: string): Promise<void>;
  pull(): Promise<string | null>;
}

export type ChatChannel = '세계' | '소문' | '알림';
export interface ChatMessage {
  ch: ChatChannel;
  who: string;
  text: string;
  at: number;
}

export interface ChatService {
  /** [세계] 실유저 채팅 (2차: Realtime, 100자·3초 1줄·금칙어·링크 금지) */
  send(text: string): Promise<SubmitResult>;
  subscribe(fn: (m: ChatMessage) => void): () => void;
  /** [알림] 시스템 방송 (전설 영입·보스 처치·랭킹 1위) — 2차에선 서버가 모두에게 뿌린다 */
  announce(text: string): void;
  readonly online: boolean;
}
