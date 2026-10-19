// FISH_QOL_1019 (이카몰리 건의): 회관 물고기 칸 표시 · 잔칫상 연못 물고기 · 🎯 노리기 (×4 · 6번 빗나가면 확정) · 지금 사는 물고기 · 시간대 안내
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { CHAPTERS } from '../src/data/guide';
import { REGIONS } from '../src/data/items';
import { bundleById, donate, slotWhere, wantedFish } from '../src/world/bundles';
import { aimOf, cast, land, pickFish, setAim, timeLeft } from '../src/world/fishing';
import { setFlag } from '../src/world/flags';
import { sanitizeGrowth } from '../src/world/growth';
import { rebuildPaths, startTown } from '../src/world/town';
import { P, resetProgress, S } from '../src/world/state';

const A = CONFIG.growth.fish.aim;
const DAY = { night: false, dawn: false };
const NIGHT = { night: true, dawn: false };
beforeEach(() => {
  resetProgress();
  S.visiting = null as never;
  S.land = 5;
  startTown();
  rebuildPaths();
  P.guide.claimed = CHAPTERS.flatMap((c) => c.missions.map((m) => m.id));
  P.guide.legacy = true;
  setFlag('bundles', true);
});
afterEach(() => setFlag('bundles', false));

describe('A 회관 물고기 칸', () => {
  it('장소 · 시간대 · 등급 · 해안이 잠기면 언제 열리는지', () => {
    const feast = bundleById('k_feast')!.b;
    const at = (id: string) => slotWhere(feast.slots.find((s) => s.id === id)!);
    expect(at('catfish')).toBe('마을 연못 · 🌙 밤 · 희귀');
    expect(at('crucian')).toBe('마을 연못 · 언제나 · 흔함');
    expect(at('seabream')).toBe('🔒 등대 해안 — 별의 심연 10단계 돌파 후');
    for (const r of REGIONS.slice(0, 5)) P.hunt.best[r.id] = CONFIG.hunt.stages;
    expect(at('seabream')).toBe('등대 해안 · 언제나 · 희귀');
  });
  it('회관이 바라는 물고기 = 열린 방 · 안 채운 칸', () => {
    expect(wantedFish().has('catfish')).toBe(true);
    expect(wantedFish().has('koi')).toBe(true);
  });
});

describe('B 잔칫상', () => {
  it('연못 물고기(비단잉어 · 황금 붕어)만으로 완성', () => {
    const feast = bundleById('k_feast')!.b;
    expect(feast.need).toBe(2);
    expect(feast.slots.map((s) => s.id)).toEqual(['seabream', 'mackerel', 'catfish', 'koi', 'crucian']);
    Object.assign(P.growth.fish.bag, { koi: 1, crucian: 5 });
    donate('k_feast', 3);
    const r = donate('k_feast', 4);
    expect(typeof r).toBe('object');
    expect((r as { bundle?: string }).bundle).toBeTruthy();
  });
});

describe('C 🎯 노리기', () => {
  it('노린 물고기는 가중치 ×4', () => {
    const n = 4000;
    const rate = () => Array.from({ length: n }, () => pickFish('pond', Math.random, NIGHT).id === 'catfish').filter(Boolean).length / n;
    const base = rate();
    setAim('catfish');
    const aimed = rate();
    expect(aimed).toBeGreaterThan(base * 2.5);
  });
  it('다른 물고기만 6번 걸리면 7번째는 확정 · 놓치면 셈 그대로 · 낚으면 0', () => {
    S.night = true;
    S.clock = (23 - CONFIG.clock.dayStartHour) * 60;
    setAim('catfish');
    const never = () => 0.999999; // 가중치 맨 끝(전설) 쪽으로 — 메기가 안 걸리게
    for (let i = 0; i < A.pity; i++) {
      P.growth.fish.extra = 99;
      expect(cast('pond', never)!.fish.id).not.toBe('catfish');
    }
    expect(P.growth.fish.aim!.miss).toBe(A.pity);
    const c = cast('pond', never)!;
    expect(c.fish.id).toBe('catfish');
    expect(P.growth.fish.aim!.miss).toBe(A.pity);
    land(c);
    expect(P.growth.fish.aim!.miss).toBe(0);
  });
  it('전설은 못 노림 · 시간대가 바뀌어 없어지면 아무거나', () => {
    setAim('kingkoi');
    expect(P.growth.fish.aim).toBeUndefined();
    setAim('catfish');
    expect(aimOf('pond', NIGHT)?.id).toBe('catfish');
    expect(aimOf('pond', DAY)).toBeNull();
    expect(P.growth.fish.aim).toBeUndefined();
  });
  it('저장해도 남음 (모르는 값은 아무거나)', () => {
    setAim('catfish');
    P.growth.fish.aim!.miss = 3;
    sanitizeGrowth();
    expect(P.growth.fish.aim).toEqual({ id: 'catfish', miss: 3 });
    (P.growth.fish as { aim: unknown }).aim = { id: 'nope', miss: 2 };
    sanitizeGrowth();
    expect(P.growth.fish.aim).toBeUndefined();
  });
});

describe('E 시간대 안내', () => {
  it('낮 = 밤(22시)까지 · 밤 = 아침까지 · 새벽(4시)까지', () => {
    S.night = false;
    S.clock = (19 - CONFIG.clock.dayStartHour) * 60; // 19시
    expect(timeLeft()).toMatchObject({ next: '밤', min: 3 });
    S.night = true;
    S.clock = (23 - CONFIG.clock.dayStartHour) * 60; // 23시
    expect(timeLeft()).toMatchObject({ next: '낮', min: 7, dawnMin: 5 });
  });
});
