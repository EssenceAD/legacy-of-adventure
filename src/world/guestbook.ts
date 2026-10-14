// LUXE §4 이웃 방명록 · 좋아요 (플래그 guestbook · 실험실 vis) — 규칙만 (서버·화면 없이 시험할 수 있게)
//  서버 부르기는 net/guestbook.ts · 화면은 ui/guestbook.ts
import { GB } from '../data/guestbook_cfg';
import { freshGuestbook, P, type GuestbookState } from './state';

const DAY = 86400000;
const KST = 9 * 3600000;

/** 한국 시간 날짜 'YYYY-MM-DD' (서버 day 컬럼과 같은 모양) */
export function kstDate(t = Date.now()): string {
  return new Date(t + KST).toISOString().slice(0, 10);
}
/** 이번 주 시작 = 월요일 0시(KST)의 실제 시각(ms) */
export function kstWeekStart(t = Date.now()): number {
  const dn = Math.floor((t + KST) / DAY);
  // 1970-01-01은 목요일 → (dn + 3) % 7 = 월요일부터 센 날
  return (dn - ((dn + 3) % 7)) * DAY - KST;
}
/** 주 키 = 그 주 월요일 날짜 (KST) */
export const kstWeekKey = (t = Date.now()) => kstDate(kstWeekStart(t));
/** 다음 초기화(다음 월요일 0시 KST)까지 ms */
export const untilWeekReset = (t = Date.now()) => kstWeekStart(t) + 7 * DAY - t;

/** 도장 번호가 맞나 (0~7 정수) */
export const validPhrase = (i: unknown): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < GB.phrases.length;
/** 도장 문장 (모르는 번호·예전 좋아요(null)는 '') */
export const phraseText = (i: unknown) => (validPhrase(i) ? GB.phrases[i] : '');

export type LikeBlock = 'login' | 'chapter' | 'self' | 'already' | 'phrase';
export interface LikeCtx {
  online: boolean;
  /** 끝낸 장부 장 수 */
  chapters: number;
  /** 5단계 전 저장(모두 열림) */
  legacy: boolean;
  myId: string | null;
  target: string;
  /** 오늘(KST) 이 기기에서 이미 남겼나 */
  likedToday: boolean;
  phrase: unknown;
}
/** 좋아요를 누를 수 있나 → 막는 까닭 (null = 됨). 서버도 같은 검사를 다시 한다 */
export function likeBlock(c: LikeCtx): LikeBlock | null {
  if (!c.online || !c.myId) return 'login';
  if (c.target === c.myId) return 'self';
  if (!c.legacy && c.chapters < GB.minChapter) return 'chapter';
  if (c.likedToday) return 'already';
  if (!validPhrase(c.phrase)) return 'phrase';
  return null;
}
export const BLOCK_TEXT: Record<LikeBlock | 'no_village' | 'net' | 'missing', string> = {
  login: '로그인하면 좋아요를 남길 수 있어요 (메뉴 → 계정)',
  chapter: `장부 ${GB.minChapter}장을 마치면 좋아요를 남길 수 있어요`,
  self: '내 마을엔 좋아요를 못 눌러요',
  already: '오늘은 이미 좋아요를 남겼어요 · 내일 또 와 주세요',
  phrase: '도장 한마디를 골라 주세요',
  no_village: '아직 마을 모습이 없는 여관이에요',
  net: '좋아요를 못 남겼어요 · 잠시 뒤에 다시 해 주세요',
  missing: '방명록은 준비 중이에요',
};

/** 오늘 이 기기에서 좋아요를 남긴 마을 (날이 바뀌면 비움) */
export interface LikedLog { day: string; ids: string[] }
export const likedToday = (log: LikedLog | null | undefined, uid: string, day = kstDate()) => !!log && log.day === day && log.ids.includes(uid);
export function markLiked(log: LikedLog | null | undefined, uid: string, day = kstDate()): LikedLog {
  const ids = log && log.day === day ? log.ids.filter((x) => x !== uid) : [];
  return { day, ids: [...ids, uid].slice(-200) };
}

/** 세이브 칸 바로잡기 (모양이 이상하면 기본값) */
export function gbState(): GuestbookState {
  const g = P.guestbook as Partial<GuestbookState> | undefined;
  const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  if (!g || typeof g !== 'object') P.guestbook = freshGuestbook();
  else
    P.guestbook = {
      seen: ok(g.seen) ? Math.floor(g.seen!) : 0,
      tens: ok(g.tens) ? Math.floor(g.tens!) : 0,
      week: typeof g.week === 'string' ? g.week : '',
      weekN: ok(g.weekN) ? Math.floor(g.weekN!) : 0,
    };
  return P.guestbook;
}

/** 새 좋아요 (빨간 점) = 서버 누적 − 확인한 누적 */
export const newLikes = (total: number, g: GuestbookState) => Math.max(0, Math.floor(total) - g.seen);

/**
 * 받은 좋아요 10개마다 선물 — 서버 누적 수(total)로만 센다 → 같은 묶음을 두 번 주지 않는다
 *  한 주(KST 월요일 0시) 최대 giftWeekMax번 · 넘는 묶음은 tens 를 올리지 않아 다음 주로 넘어간다
 *  돌려주는 값: 이번에 줄 선물들(차례대로) · g 는 그 자리에서 고친다
 */
export function takeGifts(g: GuestbookState, total: number, week: string): { dust?: number; deco?: string }[] {
  if (g.week !== week) {
    g.week = week;
    g.weekN = 0;
  }
  const due = Math.floor(Math.max(0, total) / GB.giftEvery) - g.tens;
  const n = Math.max(0, Math.min(due, GB.giftWeekMax - g.weekN));
  const out: { dust?: number; deco?: string }[] = [];
  for (let i = 0; i < n; i++) out.push(GB.gifts[(g.tens + i) % GB.gifts.length]);
  g.tens += n;
  g.weekN += n;
  return out;
}
/** 다음 선물까지 남은 좋아요 */
export const toNextGift = (total: number, g: GuestbookState) => Math.max(0, (g.tens + 1) * GB.giftEvery - Math.max(0, total));
