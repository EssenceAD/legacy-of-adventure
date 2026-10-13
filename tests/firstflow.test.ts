// CHECKIN §B 첫 30분 동선 (firstFlowFix): 건설 목록 순서 · 장비 임무 반짝 대상
import { describe, expect, it } from 'vitest';
import { equipCandidates, orderBuildKinds } from '../src/world/firstFlow';
import { fitsClass } from '../src/world/items';
import { FLAG_DEFAULTS } from '../src/world/flags';
import { MISSIONS } from '../src/data/guide';

describe('§B-1 건설 목록: 임무 대상 맨 위 · 잠긴 건 아래', () => {
  const kinds = ['inn', 'smith', 'tavern', 'fire', 'well', 'bath'];
  const locked = (k: string) => k === 'smith' || k === 'bath';
  it('대상은 따로 맨 위, 나머지는 열린 것 → 잠긴 것 (원래 순서 유지)', () => {
    expect(orderBuildKinds(kinds, 'fire', locked)).toEqual({ top: 'fire', rest: ['inn', 'tavern', 'well', 'smith', 'bath'] });
  });
  it('대상이 잠겨 있어도 맨 위', () => {
    expect(orderBuildKinds(kinds, 'smith', locked).top).toBe('smith');
    expect(orderBuildKinds(kinds, 'smith', locked).rest).toEqual(['inn', 'tavern', 'fire', 'well', 'bath']);
  });
  it('목록에 없는 대상 · 대상 없음 → top 없음', () => {
    expect(orderBuildKinds(kinds, 'castle', locked).top).toBeNull();
    expect(orderBuildKinds(kinds, null, locked).rest).toEqual(['inn', 'tavern', 'fire', 'well', 'smith', 'bath']);
  });
  it('장부 건설 임무는 모두 대상 건물이 있다 (모닥불 → fire)', () => {
    expect(MISSIONS.find((m) => m.id === 'c1_fire')?.build).toBe('fire');
  });
});

describe('§B-3 장비 임무: 낄 수 있는 사람', () => {
  const A = (id: number, kind: string, extra: object = {}) => ({ id, kind, status: 'regular', runId: null, ...extra }) as never;
  it('희귀 이상 · 안 낀 장비가 없으면 아무도', () => {
    expect(equipCandidates([A(1, 'knight')], [{ owner: null, grade: 'n', slot: 'armor' } as never], fitsClass)).toEqual([]);
    expect(equipCandidates([A(1, 'knight')], [{ owner: 1, grade: 'r', slot: 'armor' } as never], fitsClass)).toEqual([]);
  });
  it('방어구는 누구나 · 원정 중 · 방문 손님 · 직원은 빼고', () => {
    const acts = [A(1, 'knight'), A(2, 'mage', { runId: 5 }), A(3, 'priest', { status: 'visitor' }), A(4, 'rogue', { role: 'npc' }), A(5, 'archer', { status: 'hero' })];
    expect(equipCandidates(acts, [{ owner: null, grade: 'r', slot: 'armor' } as never], fitsClass)).toEqual([1, 5]);
  });
  it('무기는 직업에 맞는 사람만', () => {
    const acts = [A(1, 'knight'), A(2, 'mage')];
    const ids = equipCandidates(acts, [{ owner: null, grade: 'r', slot: 'weapon', wkind: 'staff' } as never], fitsClass);
    expect(ids).toEqual(acts.filter((a) => fitsClass(a, { slot: 'weapon', wkind: 'staff' } as never) !== false).map((a: { id: number }) => a.id));
    expect(ids.length).toBe(1);
  });
});

describe('§B 플래그', () => {
  it('firstFlowFix 기본 꺼짐 (실험실 「새 화면 미리 보기」로 켬)', () => expect(FLAG_DEFAULTS.firstFlowFix).toBe(false));
});
