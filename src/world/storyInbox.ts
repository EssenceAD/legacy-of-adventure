// CHECKIN §A1 단골 제안 거르기 (플래그 propFilter) · §A2 이야기·관계 이벤트 모아 보기 (플래그 storyInbox)
//  설정은 기기 설정(getPref) — 케미 알림(chemNotice)과 같은 방식
import { CONFIG } from '../data/config';
import type { Rarity } from '../data/classes';
import { getPref, setPref } from '../save/save';
import { eventPolicy } from './events';
import { vis } from './visual';
import { chaptersDone } from './guide';
import { today } from './progress';
import { markDirty, P, S } from './state';

// ───────── §A1 단골 제안 받을 손님 ─────────
export type PropFilterMode = 'useful' | 'all' | 'none';
export const PROP_FILTER_NAME: Record<PropFilterMode, string> = { useful: '쓸 만한 손님만', all: '모두', none: '안 받기(대기 명단에만)' };
export const propFilterMode = (): PropFilterMode => {
  const v = getPref<string>('propFilter', 'useful');
  return v === 'all' || v === 'none' ? v : 'useful';
};
export const setPropFilterMode = (m: PropFilterMode) => setPref('propFilter', m);

type Role = 'tank' | 'heal' | 'dps';
/** 거르기 판단에 쓰는 것만 (시험하기 쉽게 순수 함수로) */
export interface PropCtx {
  rarity: Rarity;
  power: number;
  role: Role;
  /** 영웅·전설·신화·카메오 (원래대로 항상) */
  special: boolean;
  /** 지금 단골(영웅 포함)의 역할 */
  regRoles: Role[];
  /** 바꿔도 되는 가장 약한 단골의 전투력 (weakestRegular · 없으면 null) */
  weakest: number | null;
  regulars: number;
  capacity: number;
  /** 장부 몇 장을 끝냈나 */
  chapters: number;
}
/** 쓸 만한 손님: 희귀 이상 · 가장 약한 단골보다 셈 · (자리가 남았고 지금 단골에 없는 역할) */
export function usefulGuest(c: PropCtx): boolean {
  if (c.rarity !== 'common') return true;
  if (c.weakest != null && c.power > c.weakest) return true;
  return c.regulars < c.capacity && !c.regRoles.includes(c.role);
}
/** 거르지 않는 때: 단골 0명 · 장부 1장 전(온보딩 첫 단골 제안) · 영웅·전설·신화 */
export const propExempt = (c: PropCtx) => c.special || c.regulars === 0 || c.chapters < 1;
/**
 * 제안 대신 무엇을 할까
 *  ask = 원래대로 제안 · quiet = 「다음에 또 올게요!」로 조용히 떠남(대기 명단 X) · wait = 대기 명단으로(안 받기)
 */
export function propDecision(mode: PropFilterMode, c: PropCtx): 'ask' | 'quiet' | 'wait' {
  if (propExempt(c) || mode === 'all') return 'ask';
  if (mode === 'none') return 'wait';
  return usefulGuest(c) ? 'ask' : 'quiet';
}
/** 플래그 켬 + 지금 설정으로 판단 (장부 장 수는 여기서) */
export function propFilterDecide(c: Omit<PropCtx, 'chapters'>): 'ask' | 'quiet' | 'wait' {
  if (!vis('propFilter')) return 'ask';
  return propDecision(propFilterMode(), { ...c, chapters: chaptersDone() });
}
/** 오늘(게임 날) 조용히 배웅한 손님 수 → 하루 마감 정산 카드 한 줄 */
export function countQuietBye() {
  if (S.visiting || !S.started) return;
  const c = P.daily.cur;
  c.quietBye = (c.quietBye ?? 0) + 1;
  markDirty();
}

// ───────── §A2 곁이야기 ─────────
export type InboxMode = 'collect' | 'now';
export const INBOX_NAME: Record<InboxMode, string> = { collect: '모아 보기', now: '바로 보기' };
export const inboxMode = (): InboxMode => (getPref<string>('storyInbox', 'collect') === 'now' ? 'now' : 'collect');
export const setInboxMode = (m: InboxMode) => setPref('storyInbox', m);
/** 모아 두는 중인가 (플래그 켬 + 「모아 보기」) */
export const collecting = () => vis('storyInbox') && inboxMode() === 'collect';

/** 오늘(현실 날짜) 저절로 띄운 곁이야기 수 (저장에 남겨 새로 고침으로 늘지 않게) */
function inbox() {
  if (!P.inbox || typeof P.inbox !== 'object' || P.inbox.day !== today()) P.inbox = { day: today(), shown: 0 };
  return P.inbox;
}
/** main이 부팅 때 한 번: 이벤트 줄에 모아 보기 정책을 건다 */
export function initStoryInbox() {
  eventPolicy.collect = collecting;
  eventPolicy.shownToday = () => inbox().shown;
  eventPolicy.markShown = () => {
    inbox().shown++;
    markDirty();
  };
  eventPolicy.cap = () => CONFIG.storyInbox.autoPerDay;
}
