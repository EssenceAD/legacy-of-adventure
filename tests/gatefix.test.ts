// 10/16 왈왈콩 gateFix: 입구 고정 · 정문이 입구를 정함 · 정문은 울타리 앞 가장자리 어디든 · 4등급 아치 → 진짜 정문 · 어울림 인정
//  + 10/16 에펨 repPick: 대표 영웅 직접 고르기
import { beforeEach, describe, expect, it, vi } from 'vitest';

const grade = vi.hoisted(() => ({ v: 0 }));
vi.mock('../src/world/guide', async (orig) => ({ ...(await orig<typeof import('../src/world/guide')>()), townGrade: () => grade.v }));

import { addObj, autoEntranceX, buildableKinds, canPlace, entrance, entranceX, findKind, frontGate, gateOk, landBounds, pinEntrance, rebuildPaths, startTown } from '../src/world/town';
import { G4_GATE_KEY, grantGradeGate } from '../src/world/gradeGate';
import { lvlDecoHooks } from '../src/world/levelDeco';
import { computeSets } from '../src/world/harmony';
import { setFlag } from '../src/world/flags';
import { P, S, world } from '../src/world/state';
import { repHero, repKeyOf } from '../src/net/sync';
import { makeAdventurer, makeHero } from '../src/world/adventurers';

const msgs: string[] = [];
beforeEach(() => {
  S.visiting = false as never;
  S.land = 5;
  startTown();
  world.actors = [];
  P.decor = { autoPath: true, paint: {}, store: [], recent: [], hintSeen: false, round: {}, noPath: {}, seen: [], owned: [], bookGot: [], entX: null, dgHome: null };
  P.harmony.moved = [];
  (P.meta as { gradeGate?: string }).gradeGate = undefined;
  P.repPick = null;
  grade.v = 0;
  msgs.length = 0;
  lvlDecoHooks.stored = (m) => msgs.push(m);
  setFlag('gateFix', true);
  setFlag('repPick', true);
  rebuildPaths();
});
const moveInn = (dx: number) => {
  const inn = findKind('inn')!;
  inn.tx += dx;
  rebuildPaths();
};
/** 울타리 앞 가장자리에서 2×2 정문이 들어갈 빈 자리 (입구에서 먼 쪽부터) */
const frontSpot = (avoidX: number): [number, number] => {
  const [a, b] = landBounds();
  for (let x = b - 3; x >= a; x--) {
    if (Math.abs(x - avoidX) < 3) continue;
    if (canPlace({ kind: 'gate', tx: x, ty: b - 2, fw: 2, fh: 2 })) return [x, b - 2];
  }
  throw new Error('no front spot');
};

describe('gateFix 입구 고정', () => {
  it('옮긴 적 없는 입구는 지금 자리로 한 번 적고 → 여관을 옮겨도 그대로', () => {
    const before = entrance();
    expect(P.decor.entX).toBeNull();
    expect(pinEntrance()).toBe(true);
    expect(P.decor.entX).toBe(autoEntranceX());
    expect(pinEntrance()).toBe(false);
    moveInn(3);
    expect(autoEntranceX()).not.toBe(P.decor.entX);
    expect(entrance()).toEqual(before);
  });
  it('플래그 끄면 예전처럼 여관을 따라감', () => {
    setFlag('gateFix', false);
    const x0 = entrance()[0];
    expect(pinEntrance()).toBe(false);
    moveInn(3);
    expect(entrance()[0]).not.toBe(x0);
  });
});

describe('gateFix 정문 = 입구', () => {
  it('정문은 울타리 앞 가장자리 어디든 · 안쪽은 입구를 덮을 때만', () => {
    const [, b] = landBounds();
    const [gx, gy] = frontSpot(entrance()[0]);
    expect(gateOk({ tx: gx, ty: gy, fw: 2, fh: 2 })).toBe(true);
    expect(gateOk({ tx: gx, ty: b - 4, fw: 2, fh: 2 })).toBe(false);
  });
  it('앞 가장자리 정문이 입구를 정하고 · 정문을 옮기면 입구도 따라간다', () => {
    pinEntrance();
    const [gx, gy] = frontSpot(entrance()[0]);
    const g = addObj('gate', gx, gy);
    rebuildPaths();
    expect(frontGate()).toBe(g);
    expect(entranceX()).toBe(gx);
    expect(entrance()).toEqual([gx, gy + 1]);
    const [nx] = frontSpot(gx);
    g.tx = nx;
    rebuildPaths();
    expect(entrance()[0]).toBe(nx);
  });
  it('옮겨 둔 입구가 정문 두 칸 안이면 그 칸 그대로 (예전 저장)', () => {
    const [gx, gy] = frontSpot(entrance()[0]);
    addObj('gate', gx, gy);
    P.decor.entX = gx + 1;
    expect(entranceX()).toBe(gx + 1);
  });
});

describe('gateFix 4등급 아치 → 진짜 정문', () => {
  it('3등급 이하는 아무것도 안 함', () => {
    grade.v = 3;
    expect(grantGradeGate()).toBeNull();
  });
  it('4등급: 입구 위에 진짜 정문 · 아치는 감춤 · 한 번만', () => {
    grade.v = 4;
    const ent = entrance();
    expect(grantGradeGate()).toBe('placed');
    const g = world.objs.find((o) => o.kind === 'gate')!;
    expect(g).toBeTruthy();
    expect(g.fromProp).toBe(true);
    expect(entrance()).toEqual(ent);
    expect(P.harmony.moved).toContain(G4_GATE_KEY);
    expect(grantGradeGate()).toBeNull();
    expect(world.objs.filter((o) => o.kind === 'gate').length).toBe(1);
  });
  it('이미 지은 정문이 있으면 그대로 · 아치만 감춤 (중복 없음)', () => {
    grade.v = 4;
    const [gx, gy] = frontSpot(entrance()[0]);
    addObj('gate', gx, gy);
    expect(grantGradeGate()).toBe('had');
    expect(world.objs.filter((o) => o.kind === 'gate').length).toBe(1);
    expect(P.decor.store.some((s) => s.kind === 'gate')).toBe(false);
    expect(P.harmony.moved).toContain(G4_GATE_KEY);
  });
  it('입구 앞이 막혀 있으면 보관함 + 토스트 · 보관함에 있으면 새로 못 지음', () => {
    grade.v = 4;
    pinEntrance();
    const [ex, ey] = entrance();
    addObj('bench', ex - 1, ey - 1);
    addObj('bench', ex + 1, ey - 1);
    addObj('bench', ex, ey - 1);
    rebuildPaths();
    expect(grantGradeGate()).toBe('stored');
    expect(P.decor.store.filter((s) => s.kind === 'gate').length).toBe(1);
    expect(msgs.join()).toMatch(/정문/);
    expect(buildableKinds()).not.toContain('gate');
  });
  it('어울림 「모험가의 문」: 진짜 정문 + 게시판이 가까우면 인정', () => {
    grade.v = 4;
    grantGradeGate();
    const g = world.objs.find((o) => o.kind === 'gate')!;
    const spots = [[g.tx - 2, g.ty], [g.tx + 2, g.ty], [g.tx, g.ty - 2], [g.tx + 1, g.ty - 2], [g.tx - 2, g.ty + 1], [g.tx + 2, g.ty + 1]];
    const at = spots.find(([x, y]) => canPlace({ kind: 'board', tx: x, ty: y, fw: 1, fh: 1 }));
    expect(at).toBeTruthy();
    const old = world.objs.filter((o) => o.kind === 'board');
    world.objs = world.objs.filter((o) => o.kind !== 'board');
    addObj('board', at![0], at![1]);
    expect(computeSets(world.objs).some((s) => s.id === 11)).toBe(true);
    world.objs.push(...old);
  });
});

describe('repPick 대표 영웅', () => {
  const setup = () => {
    const reg = makeAdventurer(5, 5, { kind: 'mage' as never, status: 'regular', lvl: 1 });
    const hero = makeHero('kael', 6, 6);
    hero.status = 'hero';
    world.actors = [reg, hero];
    return { reg, hero };
  };
  it('고른 사람이 있으면 그 얼굴 · 떠나면 자동', () => {
    const { reg, hero } = setup();
    const auto = repHero();
    expect(auto).toBe('hero_kael');
    P.repPick = repKeyOf(reg);
    expect(P.repPick).toBe('g:' + reg.id);
    expect(repHero()).toBe(reg.kind);
    world.actors = [hero];
    expect(repHero()).toBe('hero_kael');
  });
  it('플래그 끄면 자동', () => {
    const { reg } = setup();
    P.repPick = repKeyOf(reg);
    setFlag('repPick', false);
    expect(repHero()).toBe('hero_kael');
  });
});
