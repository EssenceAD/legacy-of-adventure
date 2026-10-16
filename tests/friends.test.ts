// SOCIAL §3·§4 각별한 이웃 — 내 저장 쪽 규칙: 공사 −10%(한 번 최대 30분) · 건물당 친구 도움 30%까지 · 스냅샷 공사 표 · 도움 반영 = 편지함 기록
import { beforeEach, describe, expect, it } from 'vitest';
import { addObj, startTown } from '../src/world/town';
import { applyHelp, conKey, conSnapshot, friendCut } from '../src/world/friends';
import { P, S, world, type Building } from '../src/world/state';
import type { Kind } from '../src/data/catalog';

const NOW = 1_800_000_000_000;
let o: Building;
beforeEach(() => {
  S.visiting = false as never;
  S.land = 5;
  startTown();
  P.meta.mail = [];
  o = addObj('tavern' as Kind, 20, 20);
  o.con = { kind: 'up', end: NOW + 2 * 3600e3, total: 7200, to: 2, cut: 0, cost: 0 };
});

describe('각별한 이웃 — 공사 거들기', () => {
  it('남은 시간의 10% (2시간 → 12분)', () => {
    expect(friendCut(o, 0.1, NOW)).toBeCloseTo(720);
    expect(o.con!.end).toBe(NOW + 7200e3 - 720e3);
  });
  it('한 번에 최대 30분', () => {
    o.con = { kind: 'up', end: NOW + 10 * 3600e3, total: 36000, to: 2, cut: 0, cost: 0 };
    expect(friendCut(o, 0.1, NOW)).toBe(1800);
  });
  it('건물 하나에 친구 도움 합계는 원래 시간의 30%까지', () => {
    let sum = 0;
    for (let i = 0; i < 20; i++) sum += friendCut(o, 0.1, NOW);
    expect(sum).toBeCloseTo(7200 * 0.3);
    expect(friendCut(o, 0.1, NOW)).toBe(0);
  });
  it('스냅샷 공사 표 · 이름표', () => {
    expect(conKey(o)).toBe('tavern@20,20');
    const snap = conSnapshot(world.objs);
    expect(snap['tavern@20,20']).toEqual([o.con!.end, 7200]);
  });
  it('도움 반영 → 알림 · 편지함 기록(고마워요) · 다 지은 건물이면 줄이지 않음', () => {
    const line = applyHelp({ id: 7, from_user: 'x', nickname: '에이', kind: 'con', target: 'tavern@20,20', amount: 10, created_at: '' });
    expect(line).toMatch(/에이님이 주점 공사를 거들어 줬어요/);
    expect(P.meta.mail[0]).toMatchObject({ from: 'friend', thank: 7 });
    const miss = applyHelp({ id: 8, from_user: 'x', nickname: '에이', kind: 'con', target: 'smith@1,1', amount: 10, created_at: '' });
    expect(miss).toMatch(/이미 다 지었어요/);
  });
});
