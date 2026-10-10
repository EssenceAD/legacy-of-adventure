// 로컬 전용 구현: 서버가 붙기 전(1차)엔 기록을 진행 데이터(P.raid.outbox)에 쌓아 두고, 화면엔 "2차에서 열림"을 보여 준다.
// 검증 규칙은 서버와 같게 둔다 → 2차에서 서버가 거부할 기록은 여기서도 거부된다.
import { CONFIG } from '../data/config';
import { P, type RaidRecord } from '../world/state';
import type { Account, AuthService, ChatMessage, ChatService, CloudSaveService, RankingService } from './types';

/** 한 판 기록 검사: 상한 = 전투력 기반 이론치 × recordCap */
export function validRecord(rec: RaidRecord): string | null {
  if (!Number.isFinite(rec.damage) || rec.damage < 0) return '잘못된 기록';
  if (rec.damage > rec.theory * CONFIG.raid.recordCap) return '이론상 최대 피해량을 넘었어요';
  return null;
}

export const localRanking: RankingService = {
  online: false,
  async submit(rec) {
    const why = validRecord(rec);
    if (why) return { ok: false, reason: why };
    P.raid.outbox.push(rec);
    // 너무 많이 쌓이지 않게 (주마다 최고 기록만 있으면 된다)
    if (P.raid.outbox.length > 60) P.raid.outbox.splice(0, P.raid.outbox.length - 60);
    return { ok: true };
  },
  async top() {
    return [];
  },
  async mine() {
    return null;
  },
};

export const localAuth: AuthService = {
  current: (): Account | null => null,
  login: async () => {
    throw new Error('로그인은 2차에서 열려요');
  },
  signUp: async () => {
    throw new Error('계정 만들기는 2차에서 열려요');
  },
  logout: async () => {},
};

/** 클라우드 저장: 지금은 이 기기(localStorage)만 */
export const localCloud: CloudSaveService = {
  push: async () => {},
  pull: async () => null,
};

const subs = new Set<(m: ChatMessage) => void>();
export const localChat: ChatService = {
  online: false,
  async send(text) {
    const m: ChatMessage = { ch: '세계', who: '나', text: text.slice(0, 100), at: Date.now() };
    subs.forEach((f) => f(m));
    return { ok: true };
  },
  subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
  announce(text) {
    const m: ChatMessage = { ch: '알림', who: '알림', text, at: Date.now() };
    subs.forEach((f) => f(m));
  },
};
