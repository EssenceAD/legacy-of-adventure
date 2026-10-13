// CHECKIN §J8 건물 말풍선: 상태 → 말풍선 고르기 (우선순위 · 최대 3 · 눌러 본 건 상태가 바뀔 때까지 숨김)
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { gardenCond, selectBubbles, type BldCand } from '../src/world/bldStatus';
import { FLAG_DEFAULTS } from '../src/world/flags';
import type { Building } from '../src/world/state';

const B = (kind: string) => ({ kind, lvl: 1, tx: 0, ty: 0, fw: 2, fh: 2 }) as unknown as Building;
const cand = (o: Building, id: string, tier: 0 | 1 | 2): BldCand => ({ o, id, tier, icon: 'seed', text: id });

describe('§J8 고르기', () => {
  const g = B('garden');
  const sm = B('smith');
  const bd = B('board');
  const ch = B('chapel');
  const pd = B('lily_pond');
  it('플래그는 기본 꺼짐 (형철 확인 전)', () => {
    expect(FLAG_DEFAULTS.bldStatus).toBe(false);
  });
  it('완료 > 할 수 있음 > 진행 고리 · 최대 3개', () => {
    const dm = new Map<Building, string>();
    const got = selectBubbles([cand(g, 'grow', 2), cand(ch, 'bless', 1), cand(sm, 'enhance', 1), cand(bd, 'back', 0), cand(pd, 'fish', 1)], 3, dm);
    expect(got.map((c) => c.id)).toEqual(['back', 'enhance', 'bless']);
    expect(CONFIG.bldStatus.max).toBe(3);
  });
  it('같은 단계 안 순서: 수확 > 원정 귀환 · 가방 꽉 참 > 빈 밭 > 쉬는 파티', () => {
    const dm = new Map<Building, string>();
    const got = selectBubbles([cand(bd, 'freeparty', 1), cand(g, 'empty', 1), cand(sm, 'bagfull', 1), cand(B('board'), 'back', 0), cand(B('garden'), 'ripe', 0)], 5, dm);
    expect(got.map((c) => c.id)).toEqual(['ripe', 'back', 'bagfull', 'empty', 'freeparty']);
  });
  it('눌러 본 건물은 그 상태가 바뀔 때까지 숨김 · 나머지가 대신 올라옴', () => {
    const dm = new Map<Building, string>([[g, 'ripe']]);
    const cs = [cand(g, 'ripe', 0), cand(sm, 'enhance', 1), cand(ch, 'bless', 1), cand(pd, 'fish', 1)];
    expect(selectBubbles(cs, 3, dm).map((c) => c.id)).toEqual(['enhance', 'bless', 'fish']);
    // 그대로면 계속 숨김
    expect(selectBubbles(cs, 3, dm).some((c) => c.o === g)).toBe(false);
    // 상태가 바뀌면(다 자람 → 빈 밭) 다시 뜸 · 숨김 기록은 지워짐
    expect(selectBubbles([cand(g, 'empty', 1)], 3, dm).map((c) => c.id)).toEqual(['empty']);
    expect(dm.has(g)).toBe(false);
  });
  it('상태가 아예 사라졌다가 같은 상태로 돌아와도 다시 뜸', () => {
    const dm = new Map<Building, string>([[sm, 'bagfull']]);
    expect(selectBubbles([], 3, dm)).toEqual([]);
    expect(dm.size).toBe(0);
    expect(selectBubbles([cand(sm, 'bagfull', 1)], 3, dm).length).toBe(1);
  });
});

describe('§J8 텃밭 상태', () => {
  const now = 1_000_000_000;
  const G = (plots: { crop: string | null; at: number }[], lvl = 1) => ({ ...B('garden'), lvl, plots }) as unknown as Building;
  const min = (m: number) => m * 60000;
  it('다 자란 칸이 있으면 바구니(반짝) — 빈 칸보다 먼저', () => {
    const c = gardenCond(G([{ crop: 'carrot', at: now - min(11) }, { crop: null, at: 0 }, { crop: null, at: 0 }]), now);
    expect(c).toMatchObject({ id: 'ripe', tier: 0, icon: 'basket', shine: true });
  });
  it('빈 칸 (칸 수가 모자란 옛 저장 포함) → 씨앗', () => {
    expect(gardenCond(G([{ crop: null, at: 0 }]), now)?.id).toBe('empty');
    expect(gardenCond(G([{ crop: 'carrot', at: now }]), now)?.id).toBe('empty');
  });
  it('모두 자라는 중 → 진행 고리만 (가장 많이 자란 칸 기준)', () => {
    const c = gardenCond(G([{ crop: 'carrot', at: now - min(5) }, { crop: 'cabbage', at: now - min(6) }, { crop: 'pumpkin', at: now }]), now);
    expect(c).toMatchObject({ id: 'grow', tier: 2 });
    expect(c!.prog).toBeCloseTo(0.5, 5);
  });
});
