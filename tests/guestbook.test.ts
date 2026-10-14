// LUXE §4 이웃 방명록 · 좋아요: 하루 한 번 · 자기 마을 X · 도장 번호 검사 · 장부 2장 · 10개마다 선물(주 5번) · 서버 함수 없을 때 조용히 · KST 주 경계
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Res = { data: unknown; error: { code?: string; message: string } | null };
const net = vi.hoisted(() => ({
  calls: [] as { fn: string; args: unknown }[],
  handler: (_fn: string, _args: unknown): Res => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.x in the schema cache' } }),
  profile: null as null | { id: string; nickname: string; login_id: string; inn_name: string; rep_hero: string | null },
  hasSb: true,
}));
vi.mock('../src/net/server', async (orig) => {
  const o = await orig<Record<string, unknown>>();
  const me = { get profile() { return net.profile; } };
  const sbObj = { rpc: async (fn: string, args: unknown) => { net.calls.push({ fn, args }); return net.handler(fn, args); } };
  return { ...o, me, online: () => !!net.profile, onAuthChange: () => {}, get sb() { return net.hasSb ? sbObj : null; } };
});

import { GB } from '../src/data/guestbook_cfg';
import { _resetGbNet, gbServer, isMissing, lastWeekTop, likeWithStamp, myGuestbook, weeklyPopular } from '../src/net/guestbook';
import { gbCache, pollGuestbook } from '../src/net/gbSync';
import { setFlag } from '../src/world/flags';
import {
  gbState, kstDate, kstWeekKey, kstWeekStart, likeBlock, likedToday, markLiked, newLikes, phraseText, takeGifts, toNextGift, untilWeekReset, validPhrase, type LikeCtx,
} from '../src/world/guestbook';
import { dotPlan } from '../src/world/redDots';
import { freshGuestbook, P, resetProgress } from '../src/world/state';

const ME = { id: 'me-uid', nickname: '형철', login_id: 'tester', inn_name: '시험 여관', rep_hero: null };
const ctx = (o: Partial<LikeCtx> = {}): LikeCtx => ({ online: true, chapters: 2, legacy: false, myId: 'me-uid', target: 'other', likedToday: false, phrase: 3, ...o });

beforeEach(() => {
  resetProgress();
  _resetGbNet();
  net.calls.length = 0;
  net.profile = null;
  net.hasSb = true;
  net.handler = () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
  gbCache.total = 0;
  gbCache.at = 0;
  setFlag('guestbook', false);
  localStorage.clear();
});

describe('도장 한마디', () => {
  it('정해진 8개 · 번호는 0~7 정수만', () => {
    expect(GB.phrases).toEqual(['꾸밈이 예뻐요', '밤 풍경 최고', '펫이 귀여워요', '영웅 의상 멋져요', '또 올게요', '길이 예뻐요', '명품 부럽다', '잘 쉬다 가요']);
    for (const i of [0, 3, 7]) expect(validPhrase(i)).toBe(true);
    for (const i of [-1, 8, 1.5, '1', null, undefined, NaN]) expect(validPhrase(i)).toBe(false);
    expect(phraseText(4)).toBe('또 올게요');
    expect(phraseText(null)).toBe('');
    expect(phraseText(99)).toBe('');
  });
});

describe('좋아요 막기 (클라이언트 · 서버도 같은 검사)', () => {
  it('로그인 · 자기 마을 · 장부 2장 · 하루 한 번 · 도장', () => {
    expect(likeBlock(ctx())).toBeNull();
    expect(likeBlock(ctx({ online: false }))).toBe('login');
    expect(likeBlock(ctx({ myId: null }))).toBe('login');
    expect(likeBlock(ctx({ target: 'me-uid' }))).toBe('self');
    expect(likeBlock(ctx({ chapters: 1 }))).toBe('chapter');
    expect(likeBlock(ctx({ chapters: 0, legacy: true }))).toBeNull();
    expect(likeBlock(ctx({ likedToday: true }))).toBe('already');
    expect(likeBlock(ctx({ phrase: 8 }))).toBe('phrase');
  });
  it('하루 한 번: 같은 날(KST)은 이미 남김 · 다음 날엔 다시', () => {
    const d1 = '2026-10-14';
    const log = markLiked(null, 'a', d1);
    expect(likedToday(log, 'a', d1)).toBe(true);
    expect(likedToday(log, 'b', d1)).toBe(false);
    expect(likedToday(log, 'a', '2026-10-15')).toBe(false);
    const log2 = markLiked(log, 'b', '2026-10-15');
    expect(log2).toEqual({ day: '2026-10-15', ids: ['b'] });
  });
});

describe('한국 시간 날짜 · 주 (월요일 0시 KST)', () => {
  it('일요일 23:59:59 KST는 지난주 · 월요일 0시 KST부터 새 주', () => {
    const mon0 = Date.parse('2026-10-18T15:00:00Z'); // = 10/19(월) 00:00 KST
    expect(kstWeekKey(mon0 - 1000)).toBe('2026-10-12');
    expect(kstWeekKey(mon0)).toBe('2026-10-19');
    expect(kstWeekStart(mon0 + 3 * 86400000)).toBe(mon0);
    expect(untilWeekReset(mon0 - 1000)).toBe(1000);
    expect(kstDate(Date.parse('2026-10-14T14:59:59Z'))).toBe('2026-10-14');
    expect(kstDate(Date.parse('2026-10-14T15:00:00Z'))).toBe('2026-10-15');
  });
});

describe('받은 좋아요 10개마다 선물 · 한 주 5번', () => {
  it('서버 누적 수로만 센다 → 두 번 주지 않는다', () => {
    const g = freshGuestbook();
    expect(takeGifts(g, 9, 'w1')).toHaveLength(0);
    expect(takeGifts(g, 25, 'w1')).toHaveLength(2);
    expect(takeGifts(g, 25, 'w1')).toHaveLength(0);
    expect(takeGifts(g, 29, 'w1')).toHaveLength(0);
    expect(takeGifts(g, 30, 'w1')).toHaveLength(1);
    expect(g.tens).toBe(3);
  });
  it('주 최대 5번 · 넘는 몫은 다음 주로 (사라지지 않음)', () => {
    const g = freshGuestbook();
    expect(takeGifts(g, 120, 'w1')).toHaveLength(GB.giftWeekMax);
    expect(takeGifts(g, 120, 'w1')).toHaveLength(0);
    expect(g.tens).toBe(5);
    expect(takeGifts(g, 120, 'w2')).toHaveLength(5);
    expect(takeGifts(g, 120, 'w3')).toHaveLength(2);
    expect(g.tens).toBe(12);
  });
  it('선물 차례 = 가루 · 꽃바구니 돌아가며 · 누적이 줄어도(탈퇴) 되돌리지 않음', () => {
    const g = freshGuestbook();
    const out = takeGifts(g, 30, 'w1');
    expect(out).toEqual([GB.gifts[0], GB.gifts[1], GB.gifts[2]]);
    expect(takeGifts(g, 5, 'w1')).toHaveLength(0);
    expect(g.tens).toBe(3);
    expect(toNextGift(35, g)).toBe(5);
  });
  it('세이브 칸 바로잡기 · 새 좋아요(빨간 점)', () => {
    (P as { guestbook: unknown }).guestbook = { seen: -3, tens: 'x', week: 5, weekN: 2.7 };
    expect(gbState()).toEqual({ seen: 0, tens: 0, week: '', weekN: 2 });
    (P as { guestbook: unknown }).guestbook = undefined;
    expect(gbState()).toEqual(freshGuestbook());
    expect(newLikes(4, { ...freshGuestbook(), seen: 1 })).toBe(3);
    expect(newLikes(1, { ...freshGuestbook(), seen: 4 })).toBe(0);
  });
  it('빨간 점: 새 좋아요면 아래 「마을」 · 메뉴 · 이웃 칸', () => {
    const base = { mailUnread: 0, runsDone: 0, smithReady: false, ripe: 0, missionReady: false, achReady: 0, goalsReady: false, unseenDeco: 0 };
    expect(dotPlan(base).village).toBe(false);
    const p = dotPlan({ ...base, gbNew: 1 });
    expect(p.village && p.menu && p.tiles.neighbor).toBe(true);
  });
});

describe('서버 (SQL 실행 전 · 후)', () => {
  it('함수가 없으면 조용히 missing · 한 번 없으면 다시 안 부른다', async () => {
    net.profile = ME;
    expect(await likeWithStamp('other', 2)).toEqual({ ok: false, why: 'missing' });
    expect(gbServer.missing).toBe(true);
    expect(await myGuestbook()).toBeNull();
    expect(await weeklyPopular()).toBeNull();
    expect(await lastWeekTop('2026-10-12')).toBeNull();
    expect(net.calls).toHaveLength(1);
    expect(isMissing({ code: '42883', message: 'function does not exist' })).toBe(true);
    expect(isMissing({ code: '23505', message: 'duplicate' })).toBe(false);
  });
  it('로그인 안 함 · 자기 마을 · 잘못된 도장은 서버를 부르지 않는다', async () => {
    expect(await likeWithStamp('other', 1)).toEqual({ ok: false, why: 'login' });
    net.profile = ME;
    expect(await likeWithStamp('me-uid', 1)).toEqual({ ok: false, why: 'self' });
    expect(await likeWithStamp('other', 8)).toEqual({ ok: false, why: 'phrase' });
    expect(await likeWithStamp('other', -1)).toEqual({ ok: false, why: 'phrase' });
    expect(net.calls).toHaveLength(0);
  });
  it('좋아요: 인자 · 결과(ok · already · chapter) · 네트워크 오류', async () => {
    net.profile = ME;
    net.handler = (_f, a) => ({ data: (a as { p_phrase: number }).p_phrase === 0 ? { r: 'already' } : (a as { p_phrase: number }).p_phrase === 1 ? { r: 'chapter' } : { r: 'ok', likes: 12 }, error: null });
    expect(await likeWithStamp('other', 5)).toEqual({ ok: true, likes: 12 });
    expect(net.calls[0]).toEqual({ fn: 'like_village', args: { p_village: 'other', p_phrase: 5 } });
    expect(await likeWithStamp('other', 0)).toEqual({ ok: false, why: 'already' });
    expect(await likeWithStamp('other', 1)).toEqual({ ok: false, why: 'chapter' });
    net.handler = () => ({ data: null, error: { code: '500', message: 'boom' } });
    expect(await likeWithStamp('other', 2)).toEqual({ ok: false, why: 'net' });
    expect(gbServer.missing).toBe(false);
  });
  it('방명록 · 인기 마을 모양이 이상해도 깨지지 않는다', async () => {
    net.profile = ME;
    net.handler = (fn) =>
      fn === 'my_guestbook'
        ? { data: { week: 3, total: '41', rows: [{ from_user: 'a', inn_name: '솔바람', nickname: '솔', rep_hero: null, phrase: 4, day: '2026-10-14', at: 'x' }, null, { nope: 1 }] }, error: null }
        : { data: { rows: [{ rank: 1, user_id: 'a', nickname: '솔', inn_name: '솔바람', rep_hero: null, likes: 9 }, 'bad'], me: { rank: 4, likes: 2 } }, error: null };
    const b = await myGuestbook();
    expect(b).toMatchObject({ week: 3, total: 41 });
    expect(b!.rows).toHaveLength(1);
    const p = await weeklyPopular();
    expect(p!.rows).toHaveLength(1);
    expect(p!.me).toEqual({ rank: 4, likes: 2 });
  });
});

describe('클라우드 저장 때 방명록 확인 → 우편함 선물', () => {
  it('플래그 끄면 아무것도 안 함 · 켜면 10개마다 편지 (pollMin 안엔 다시 안 물음)', async () => {
    net.profile = ME;
    let total = 23;
    net.handler = () => ({ data: { week: total, total, rows: [] }, error: null });
    await pollGuestbook(1_000_000);
    expect(net.calls).toHaveLength(0);
    setFlag('guestbook', true);
    const mails = () => P.meta.mail.filter((m) => m.title === '💌 방명록 선물').length;
    await pollGuestbook(1_000_000);
    expect(mails()).toBe(2);
    expect(gbCache.total).toBe(23);
    total = 31;
    await pollGuestbook(1_000_000 + 60_000);
    expect(mails()).toBe(2);
    await pollGuestbook(1_000_000 + GB.pollMin * 60000);
    expect(mails()).toBe(3);
    expect(P.guestbook.tens).toBe(3);
  });
  it('서버 함수가 없으면 선물도 · 오류도 없이 그대로', async () => {
    net.profile = ME;
    setFlag('guestbook', true);
    await pollGuestbook(5_000_000, true);
    expect(P.meta.mail.length).toBe(0);
    expect(P.guestbook).toEqual(freshGuestbook());
  });
});
