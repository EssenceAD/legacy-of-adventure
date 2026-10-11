// 핫픽스 10: 건물 철거 — 환불 · 필수 건물 · 별채 손님 · 임무 보상 1회 · 저장 후 다시 불러와도 안 돌아옴
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { MISSIONS } from '../src/data/guide';
import { claimMission } from '../src/world/guide';
import { canRemove, refundOf, removeBuilding, removeEffects } from '../src/world/demolish';
import { addObj, buildableKinds, capacity, placeLayout, startTown } from '../src/world/town';
import { P, S, world, type Actor } from '../src/world/state';
import { readSave, snapshot, writeSave } from '../src/save/save';

const MIN = 60_000;

beforeEach(() => {
  S.visiting = false as never;
  S.land = 3;
  startTown();
  world.actors = [];
});

describe('환불', () => {
  it('Lv1 = 지은 값의 50%', () => {
    const o = addObj('training', 2, 2, { builtAt: Date.now() - 10 * MIN });
    expect(refundOf(o)).toEqual({ gold: Math.floor(350 * 0.5), full: false });
  });
  it('Lv3 = (지은 값 + 올린 값 2번) × 50%', () => {
    const o = addObj('training', 2, 2, { lvl: 3 });
    expect(refundOf(o).gold).toBe(Math.floor((350 + 400 + 700) * 0.5));
  });
  it('마을 등급 장식을 옮겨 놓은 것은 0', () => {
    const o = addObj('training', 2, 2, { fromProp: true, builtAt: Date.now() });
    expect(refundOf(o).gold).toBe(0);
  });
  it('5분 안이면 전액 · 5분 지나면 절반', () => {
    const now = Date.now();
    const o = addObj('training', 2, 2, { builtAt: now - 4 * MIN });
    expect(refundOf(o, now)).toEqual({ gold: 350, full: true });
    expect(refundOf(o, now + 2 * MIN)).toEqual({ gold: 175, full: false });
  });
});

describe('철거', () => {
  it('여관 본관(noRemove)은 철거 안 됨', () => {
    expect(CONFIG.build.noRemove).toContain('inn');
    const inn = world.objs.find((o) => o.kind === 'inn')!;
    expect(canRemove(inn)).toBe(false);
    expect(removeBuilding(inn)).toBe(false);
    expect(world.objs).toContain(inn);
  });
  it('이웃 방문 중 · 짓는 중은 안 됨', () => {
    const o = addObj('training', 2, 2);
    expect(removeBuilding(o, true)).toBe(false);
    const b = addObj('garden', 6, 2, { build: 1 });
    expect(removeBuilding(b)).toBe(false);
  });
  it('철거하면 사라지고, 하나뿐인 건물은 건설 목록에 다시 나온다', () => {
    const o = addObj('gate', 2, 2);
    expect(buildableKinds()).not.toContain('gate');
    expect(removeBuilding(o)).toBe(true);
    expect(world.objs).not.toContain(o);
    expect(buildableKinds()).toContain('gate');
  });
  it('손님 있는 별채 철거: 다 밖으로 · 갇힌 손님 없음 · 넘치는 손님은 지나가는 손님', () => {
    const cot = addObj('cottage', 2, 2);
    const cap = capacity();
    const guests = Array.from({ length: cap }, (_, i) => ({ id: i + 1, status: 'visitor', hidden: false, at: null, x: 0, y: 0, st: 'idle', inside: [] }) as unknown as Actor);
    // 두 명은 별채 안에서 자는 중
    for (const a of guests.slice(0, 2)) Object.assign(a, { hidden: true, at: cot, st: 'in' });
    cot.inside.push(...guests.slice(0, 2));
    world.actors = guests;
    const fx = removeEffects(cot);
    expect(fx.guests).toBe(2);
    expect(fx.overflow).toBe(CONFIG.actors.perCottage);
    expect(removeBuilding(cot)).toBe(true);
    for (const a of world.actors) {
      expect(a.hidden).toBe(false);
      expect(a.at).toBeNull();
    }
    const stay = world.actors.filter((a) => a.status !== 'passer').length;
    expect(stay).toBeLessThanOrEqual(capacity());
  });
});

describe('임무 보상은 한 번만', () => {
  it('짓기 → 철거 → 다시 짓기: 「모닥불 짓기」 보상 1회', () => {
    world.objs = world.objs.filter((o) => o.kind !== 'fire');
    P.guide.idx = MISSIONS.findIndex((m) => m.id === 'c1_fire');
    P.guide.claimed = MISSIONS.slice(0, P.guide.idx).map((m) => m.id);
    S.gold = 0;
    const f = addObj('fire', 3, 3);
    claimMission(true);
    const after1 = S.gold;
    expect(after1).toBe(80);
    expect(removeBuilding(f)).toBe(true);
    addObj('fire', 3, 3);
    claimMission(true);
    expect(P.guide.claimed.filter((x) => x === 'c1_fire').length).toBe(1);
    // 다음 임무(아직 안 한 일)는 완료되지 않으니 금화는 그대로
    expect(S.gold).toBe(after1);
  });
});

describe('저장', () => {
  it('저장 → 불러오기에 철거한 건물이 돌아오지 않는다', () => {
    const o = addObj('training', 2, 2, { builtAt: 123 });
    S.started = true as never;
    writeSave();
    expect(readSave()!.buildings.some((b) => b.kind === 'training' && b.builtAt === 123)).toBe(true);
    removeBuilding(o);
    writeSave();
    const d = readSave()!;
    expect(d.buildings.some((b) => b.kind === 'training')).toBe(false);
    placeLayout(d.buildings.map((b) => ({ ...b, hue: b.hue ?? null })), d.land);
    expect(world.objs.some((x) => x.kind === 'training')).toBe(false);
    expect(snapshot().buildings.some((b) => b.kind === 'training')).toBe(false);
  });
});
