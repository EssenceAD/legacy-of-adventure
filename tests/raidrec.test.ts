// 토벌 기록 버그: 같은 기록을 여러 번 보내지 않기 (잠금 · 보낸 기록 표시 · 꺼낸 즉시 저장) · 거부돼도 다시 올려 보기(3번까지) · 문구
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
let answer: 'ok' | 'rejected' | 'error' = 'ok';
vi.mock('../src/net/server', async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    online: () => true,
    me: { profile: { id: 'u1', nickname: 'x' } },
    submitRaid: vi.fn(async (r: { bossId: string; damage: number }) => {
      calls.push(`${r.bossId}|${r.damage}`);
      await new Promise((ok) => setTimeout(ok, 5));
      return answer;
    }),
    mine: vi.fn(async () => ({ row: null, total: 0 })),
    postNotice: vi.fn(),
  };
});

const { flushOutbox, submitRecord } = await import('../src/net/sync');
const { P } = await import('../src/world/state');
const rec = (damage: number, at = 1000 + damage) => ({ week: '2026-W41', bossId: 'boar', damage, power: 1000, theory: 1e9, mode: 'auto' as const, at });

beforeEach(() => {
  calls.length = 0;
  answer = 'ok';
  P.raid.outbox = [];
  P.raid.sent = [];
});

describe('토벌 기록 보내기', () => {
  it('outbox 비우기가 동시에 두 번 불려도 기록마다 한 번만 보낸다', async () => {
    P.raid.outbox = [rec(10), rec(20), rec(30)];
    const [a, b] = await Promise.all([flushOutbox(), flushOutbox()]);
    expect(calls.sort()).toEqual(['boar|10', 'boar|20', 'boar|30']);
    expect(a.ok).toBe(3);
    expect(b).toEqual(a);
    expect(P.raid.outbox).toEqual([]);
  });
  it('이미 올린 기록은 outbox에 다시 들어와도 안 보낸다', async () => {
    await submitRecord(rec(50));
    P.raid.outbox = [rec(50)];
    await flushOutbox();
    expect(calls).toEqual(['boar|50']);
  });
  it('거부되면 outbox로 돌아가 다시 올려 보고, 3번째 거부에서 내려놓는다', async () => {
    answer = 'rejected';
    const r = await submitRecord(rec(70));
    expect(r.reason).toBe('랭킹 기록이 잠시 안 올라갔어요 — 다시 올려볼게요');
    expect(r.ok).toBe(true);
    expect(P.raid.outbox.length).toBe(1);
    await flushOutbox();
    expect(P.raid.outbox.length).toBe(1);
    const f = await flushOutbox();
    expect(f.rejected).toBe(1);
    expect(P.raid.outbox.length).toBe(0);
    expect(calls.length).toBe(3);
  });
  it('네트워크 오류는 outbox에 한 번만 (같은 기록 중복 없음)', async () => {
    answer = 'error';
    await submitRecord(rec(90));
    await submitRecord(rec(90));
    expect(P.raid.outbox.length).toBe(1);
  });
});

describe('토벌 처치 등급', async () => {
  const { rankOf } = await import('../src/world/raid');
  it('처치하면 최소 A · 빨리 잡을수록 S (실제 저장 재현: 붉은 텐구 523,473 / 기대치 787,913 → 예전 C)', () => {
    expect(rankOf(523473, 787913)).toBe('C');
    expect(rankOf(523473, 787913, { killed: true, secs: 60 })).toBe('A');
    expect(rankOf(523473, 787913, { killed: true, secs: 30 })).toBe('S');
    expect(rankOf(10, 787913, { killed: true, secs: 59 })).toBe('A');
  });
  it('처치 못 하면 예전 그대로', () => {
    expect(rankOf(787913 * 1.2, 787913, { killed: false })).toBe('S');
    expect(rankOf(787913 * 0.9, 787913, { killed: false, secs: 20 })).toBe('C');
  });
});
