// CONSTRUCTION_SPEC: 시간 표 · 동시 공사 수 · 탭 30% 상한 · 오프라인 완료 · 철거 환불 · 공사 중에도 여관 손님 받음 · 커지는 업그레이드 공사 터
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { def } from '../src/data/catalog';
import { cheerCon, cheerReady, conProgress, conSlots, finishCon, newSeconds, slotFree, startNew, startUp, tapCon, tickCons, upSeconds } from '../src/world/construct';
import { addObj, capacity, findKind, nextLevelCost, rebuildPaths, sizeFor, startTown } from '../src/world/town';
import { P, S, world } from '../src/world/state';
import * as game from '../src/game';

const B = CONFIG.build;
beforeEach(() => {
  if (!document.getElementById('over')) document.body.insertAdjacentHTML('beforeend', '<div id="over"></div><div id="win"></div><div id="winB"></div><div id="toast"></div>');
  S.visiting = false as never;
  S.started = true as never;
  S.land = 5;
  startTown();
  rebuildPaths();
  P.meta.cheerDay = '';
  // 시험용 건물 (자리 검사 없이 땅 구석에)
  if (!findKind('tavern')) addObj('tavern', 2, 2);
  if (!findKind('smith')) addObj('smith', 2, 8);
});

describe('공사 시간 표', () => {
  it('1칸 장식 3초 · 새 건물 비용/10초 (30~120초)', () => {
    expect(newSeconds('lamppost')).toBe(B.decoSeconds);
    const d = def('tavern');
    expect(newSeconds('tavern')).toBe(Math.min(120, Math.max(30, d.cost / 10)));
    for (const k of ['smith', 'bath', 'cottage', 'tavern'] as const) {
      expect(newSeconds(k)).toBeGreaterThanOrEqual(30);
      expect(newSeconds(k)).toBeLessThanOrEqual(120);
    }
  });
  it('업그레이드: Lv.2 1분 … Lv.10 30분', () => {
    expect(upSeconds(2)).toBe(60);
    expect(upSeconds(5)).toBe(10 * 60);
    expect(upSeconds(10)).toBe(30 * 60);
  });
});

describe('동시 공사 수', () => {
  it('처음 1곳 · 여관 Lv.4 2곳 · Lv.8 3곳', () => {
    const inn = findKind('inn')!;
    inn.lvl = 1;
    expect(conSlots()).toBe(1);
    inn.lvl = 4;
    expect(conSlots()).toBe(2);
    inn.lvl = 8;
    expect(conSlots()).toBe(3);
  });
  it('자리가 차면 새 공사 못 함 (1칸 장식은 세지 않음)', () => {
    findKind('inn')!.lvl = 1;
    const tav = findKind('tavern')!;
    expect(slotFree()).toBe(true);
    startUp(tav, 100);
    expect(slotFree()).toBe(false);
  });
});

describe('뚝딱 탭', () => {
  it('탭마다 1초 · 원래 시간의 30%까지', () => {
    const o = world.objs.find((x) => x.kind === 'inn')!;
    o.lvl = 4;
    startUp(o, 0, 1_000_000);
    const total = o.con!.total;
    let n = 0;
    while (tapCon(o, 1_000_000)) n++;
    expect(n).toBe(Math.floor(total * B.tapCapPct));
    expect(o.con!.end).toBe(1_000_000 + (total - n) * 1000);
  });
});

describe('완성 · 오프라인', () => {
  it('끝 시각이 지나면 완성: 업그레이드는 그때 레벨이 오른다', () => {
    const o = findKind('inn')!;
    o.lvl = 2;
    startUp(o, 0, 0);
    expect(o.lvl).toBe(2);
    tickCons(o.con!.end - 1);
    expect(o.lvl).toBe(2);
    tickCons(o.con!.end + 1, true);
    expect(o.lvl).toBe(3);
    expect(o.con).toBeUndefined();
  });
  it('공사 중에도 여관은 손님을 받는다 (방 수는 완성 전 레벨 그대로)', () => {
    const o = findKind('inn')!;
    o.lvl = 3;
    const cap = capacity();
    startUp(o, 0);
    expect(capacity()).toBe(cap);
    expect(o.build).toBeUndefined();
    finishCon(o);
    expect(capacity()).toBeGreaterThan(cap);
  });
  it('새 짓기: 공사 중엔 못 씀(build) → 완성 뒤 씀', () => {
    const o = findKind('smith')!;
    startNew(o, 0);
    expect(o.build).toBe(1);
    expect(conProgress(o, o.con!.end / 2)).toBeCloseTo(0.5, 2);
    tickCons(o.con!.end + 1);
    expect(o.build).toBeUndefined();
  });
  it('커지는 업그레이드: 공사 시작 때 새 발판으로 공사 터', () => {
    const o = findKind('inn')!;
    o.lvl = 1;
    const [nw] = sizeFor('inn', 2);
    const tx = o.tx;
    startUp(o, 0);
    expect(o.fw).toBe(nw);
    expect(o.tx).toBe(tx - (nw - sizeFor('inn', 1)[0]));
    expect(o.lvl).toBe(1);
    expect(o.con!.from).toEqual([tx, expect.any(Number)]);
  });
});

describe('철거 · 모모의 응원', () => {
  it('업그레이드 공사 중 철거 → 그 업그레이드 비용 전액 환불', () => {
    const o = findKind('tavern')!;
    const cost = nextLevelCost(o)!;
    S.gold = 0;
    o.builtAt = 0;
    startUp(o, cost);
    // 화면(HUD)이 없는 시험 환경이라 금화 반영 뒤의 화면 갱신 오류는 무시
    try {
      game.demolish(o);
    } catch {
      /* syncHud */
    }
    expect(world.objs.includes(o)).toBe(false);
    expect(S.gold).toBeGreaterThanOrEqual(cost);
  });
  it('하루 1번 즉시 완성', () => {
    const o = findKind('inn')!;
    o.lvl = 5;
    startUp(o, 0);
    expect(cheerReady()).toBe(true);
    expect(cheerCon(o)).toBe(true);
    expect(o.lvl).toBe(6);
    startUp(o, 0);
    expect(cheerCon(o)).toBe(false);
  });
});
