// DIRECTION §2: 서버가 아직 없을 때(함수 없음 · 오류) 조용히 숨김 · 답장 배달(한 번씩 · 저장 뒤 읽음) · 소문 하루 1개 · 제보함은 운영자만
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Res = { data: unknown; error: { code?: string; message: string } | null };
const net = vi.hoisted(() => ({
  calls: [] as { fn: string; args: unknown }[],
  handler: (_fn: string, _args: unknown): Res => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.x in the schema cache' } }),
  profile: null as null | { id: string; nickname: string; login_id: string },
  hasSb: true,
}));
vi.mock('../src/net/server', async (orig) => {
  const o = await orig<Record<string, unknown>>();
  const me = { get profile() { return net.profile; } };
  const sbObj = { rpc: async (fn: string, args: unknown) => { net.calls.push({ fn, args }); return net.handler(fn, args); } };
  return { ...o, me, online: () => !!net.profile, onAuthChange: () => {}, get sb() { return net.hasSb ? sbObj : null; } };
});

import {
  _resetDirection, amAdmin, approvedRumors, call, contributors, fnMissing, letterCredits, loadApprovedRumors, myReplies, refreshAdmin, rumorSendReady, submitRumor,
} from '../src/net/direction';
import { deliverReplies, replyMailBody } from '../src/world/replies';
import { kstDay, rumorSentToday } from '../src/ui/opsbox';
import { contribCreditLine, endCredits } from '../src/ui/chronicle';
import { PIONEER_CREDIT } from '../src/data/story/easter';
import { setPref } from '../src/save/save';
import { P, resetProgress } from '../src/world/state';

const missingAll = () => (net.handler = () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }));
beforeEach(() => {
  resetProgress();
  _resetDirection();
  net.calls.length = 0;
  net.profile = null;
  net.hasSb = true;
  missingAll();
  localStorage.clear();
});

describe('SQL 전 (함수 없음): 기능을 조용히 숨긴다', () => {
  it('모든 부르기가 null · 빈 값 — 던지지 않고, 한 번 없으면 다시 안 부른다', async () => {
    net.profile = { id: 'u1', nickname: '웅스', login_id: 'woongs' };
    expect(await call('is_admin')).toBeNull();
    expect(fnMissing('is_admin')).toBe(true);
    expect(await refreshAdmin()).toBe(false);
    expect(amAdmin()).toBe(false);
    expect(await contributors()).toEqual([]);
    expect((await letterCredits()).size).toBe(0);
    expect(await loadApprovedRumors()).toEqual([]);
    expect(rumorSendReady()).toBe(false);
    expect(await myReplies()).toEqual([]);
    expect(await deliverReplies()).toBe(0);
    expect(P.meta.mail).toEqual([]);
    const n = net.calls.length;
    await call('is_admin');
    expect(net.calls.length).toBe(n);
    expect(await submitRumor('안녕')).toMatch(/다시/);
  });
  it('다른 오류(네트워크 등)도 조용히 null · 함수 없음 표시는 안 한다', async () => {
    net.handler = () => ({ data: null, error: { code: '500', message: 'fetch failed' } });
    expect(await call('contributors')).toBeNull();
    expect(fnMissing('contributors')).toBe(false);
    net.handler = () => {
      throw new Error('boom');
    };
    expect(await call('contributors')).toBeNull();
  });
  it('Supabase 설정이 없는 빌드(sb = null)에서도 아무 일 없음', async () => {
    net.hasSb = false;
    net.profile = { id: 'u1', nickname: 'a', login_id: 'a' };
    expect(await refreshAdmin()).toBe(false);
    expect(await loadApprovedRumors()).toEqual([]);
    expect(await deliverReplies()).toBe(0);
    expect(net.calls.length).toBe(0);
  });
  it('엔딩 크레딧: 함께 만든 사람들이 없으면 개척자 줄만', () => {
    expect(contribCreditLine()).toBeNull();
    expect(endCredits()).toEqual([['narr', PIONEER_CREDIT]]);
  });
});

describe('SQL 뒤', () => {
  const ok = (data: unknown): Res => ({ data, error: null });
  it('운영자: is_admin = true일 때만 (로그인 필요)', async () => {
    net.handler = (fn) => ok(fn === 'is_admin');
    expect(await refreshAdmin()).toBe(false);
    net.profile = { id: 'op', nickname: '운영자', login_id: 'essencead' };
    expect(await refreshAdmin()).toBe(true);
    expect(amAdmin()).toBe(true);
    net.handler = () => ok(false);
    expect(await refreshAdmin()).toBe(false);
  });
  it('답장 → 우편함 「운영자의 답장」 한 번씩 · 저장한 뒤에 읽음 표시 · 답장을 고치면 다시 온다', async () => {
    net.profile = { id: 'u1', nickname: '웅스', login_id: 'woongs' };
    const order: string[] = [];
    let rows = [{ id: 7, body: '[버그 제보] 온천 옆에서 손님이 길을 잃었어요', reply: '고쳤어요!', status: '반영', ver_fixed: '0.23.0-beta', replied_at: 't1' }];
    net.handler = (fn) => {
      order.push(fn);
      return fn === 'my_letter_replies' ? ok(rows) : ok(rows.length);
    };
    const n = await deliverReplies(() => order.push('save'));
    expect(n).toBe(1);
    expect(order).toEqual(['my_letter_replies', 'save', 'mark_replies_read']);
    const m = P.meta.mail[0];
    expect(m).toMatchObject({ from: 'admin', title: '운영자의 답장' });
    expect(m.body).toContain('온천 옆에서 손님이 길을 잃었어');
    expect(m.body).toContain('고쳤어요!');
    expect(m.body).toContain('v0.23.0에 반영했어요');
    // 읽음 표시가 실패해 다시 와도 겹치지 않는다
    expect(await deliverReplies()).toBe(0);
    expect(P.meta.mail.length).toBe(1);
    // 답장을 고치면(시각이 바뀌면) 새로 온다
    rows = [{ ...rows[0], reply: '더 고쳤어요', replied_at: 't2' }];
    expect(await deliverReplies()).toBe(1);
    expect(P.meta.mail.length).toBe(2);
    expect(net.calls.find((c) => c.fn === 'mark_replies_read')!.args).toEqual({ p_ids: [7] });
  });
  it('답장 본문 모양 (보류 · 첫머리 없음)', () => {
    expect(replyMailBody({ id: 1, body: '', reply: '나중에요', status: '보류', ver_fixed: null, replied_at: null })).toBe('보내 주신 편지에 답장이 왔어요. · 나중에요 · 지금은 보류해 두었어요. 더 생각해 볼게요.');
  });
  it('소문 보내기: 함수가 있고 로그인했을 때만 · 서버 코드 → 안내 문구 · 하루 1개(한국 날짜)', async () => {
    net.handler = (fn) => (fn === 'approved_rumors' ? ok([{ id: 1, body: '고양이가 장화를 신었대', nickname: '웅스' }]) : ok('daily'));
    await loadApprovedRumors();
    expect(approvedRumors().length).toBe(1);
    expect(rumorSendReady()).toBe(false);
    net.profile = { id: 'u1', nickname: '웅스', login_id: 'woongs' };
    expect(rumorSendReady()).toBe(true);
    expect(await submitRumor('또 보내요')).toMatch(/하루에 하나/);
    net.handler = () => ok('banned_word');
    expect(await submitRumor('x')).toMatch(/쓸 수 없는 말/);
    net.handler = () => ok('ok');
    expect(await submitRumor('우물가 고양이')).toBeNull();
    // 이 기기 기록: 한국 날짜로 오늘
    const t = Date.UTC(2026, 9, 13, 16, 0); // 한국 14일 01시
    expect(kstDay(t)).toBe('2026-10-14');
    setPref('rumorDay', '2026-10-14');
    expect(rumorSentToday(t)).toBe(true);
    expect(rumorSentToday(t - 2 * 3600000)).toBe(false);
  });
  it('함께 만든 사람들 → 엔딩 크레딧 줄 (개척자는 빼고, 개척자 줄 다음)', async () => {
    net.handler = () => ok([{ nickname: '웅스', line: null, fixed_n: 0, pioneer: 'woongs' }, { nickname: '버그사냥꾼', line: '온천 길찾기', fixed_n: 4, pioneer: null }]);
    await contributors();
    expect(contribCreditLine()).toBe('함께 만든 사람들 — 버그사냥꾼');
    expect(endCredits()).toEqual([['narr', PIONEER_CREDIT], ['narr', '함께 만든 사람들 — 버그사냥꾼']]);
  });
  it('반영 크레딧: 버전별로 묶는다', async () => {
    net.handler = () => ok([{ ver_fixed: '0.23.0', nickname: '웅스' }, { ver_fixed: '0.23.0', nickname: '고느끼' }]);
    expect((await letterCredits()).get('0.23.0')).toEqual(['웅스', '고느끼']);
  });
});
