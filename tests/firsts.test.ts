// WAYFIND §1 단위 시험: 옛 기록 채우기 · 2일 · 하루 한 명 · 「나중에」 3일 · 처음 써 보면 보상 · 실세이브 「!」 순서
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { answerBubble, bubbleFirst, checkFirsts, FIRSTS, noteBubble, pickFirst, seedFirsts } from '../src/world/firsts';
import { P, resetProgress, S, wfHit, world, type Building } from '../src/world/state';
import { wfState } from '../src/world/wayfind';
import { loadReal } from './wf-real';

const DAY = 86400000;
const T0 = Date.UTC(2026, 9, 14, 3);
const REAL = { 이카몰리: 'tests/fixtures/real_wf_ikamolly.json', 고느끼: 'tests/fixtures/real_wf_gonukki.json', 따밤: 'tests/fixtures/real_wf_ttabam.json', 웅스: 'tests/fixtures/real_wf_woongs.json' };
const haveReal = Object.values(REAL).every((f) => fs.existsSync(f));

beforeEach(() => {
  resetProgress();
  S.started = true;
  S.day = 10;
  S.land = 5;
  world.home = null;
  world.objs = [{ kind: 'smith', lvl: 1, tx: 0, ty: 0, fw: 2, fh: 2 } as unknown as Building];
  world.actors = [];
});

describe('§1 처음 해 보기', () => {
  it('열려 있던 기능은 바로 · 새로 열린 건 2일 뒤 · 하루 한 명 · 나중에 3일', () => {
    seedFirsts(T0);
    const f = bubbleFirst(T0)!;
    expect(f.id).toBe('fish');
    noteBubble(f.id, T0);
    expect(bubbleFirst(T0 + 1000)?.id).toBe('fish');
    answerBubble(f.id, true, T0 + 2000);
    expect(bubbleFirst(T0 + 3000)).toBeNull();
    // 다음 날: 낚시는 「나중에」 → 다른 것
    expect(bubbleFirst(T0 + DAY)?.id).not.toBe('fish');
    expect(pickFirst(T0 + 3 * DAY + 5000)?.id).toBe('fish');
  });
  it('5일차 전 새 저장은 2일을 기다린다', () => {
    S.day = 2;
    seedFirsts(T0);
    expect(bubbleFirst(T0)).toBeNull();
    checkFirsts(T0);
    expect(bubbleFirst(T0 + 2 * DAY + 1)?.id).toBe('fish');
  });
  it('처음 써 보면 done + 보상 + 반응 줄', () => {
    seedFirsts(T0);
    const n = P.growth.whet;
    P.counters.enhanceMax = 1;
    expect(checkFirsts(T0)).toContain('enhance');
    expect(P.growth.whet).toBe(n + 1);
    expect(wfState().pend.some((p) => p.startsWith('enhance|'))).toBe(true);
    wfHit('reforge');
    expect(checkFirsts(T0)).toEqual(['reforge']);
    expect(checkFirsts(T0)).toEqual([]);
  });
});

describe.skipIf(!haveReal)('§1 실세이브 「!」 순서', () => {
  for (const [who, f] of Object.entries(REAL)) {
    it(who, () => {
      loadReal(f);
      seedFirsts(T0);
      const order: string[] = [];
      for (let d = 0; d < 20; d++) {
        checkFirsts(T0 + d * DAY);
        const b = bubbleFirst(T0 + d * DAY);
        if (!b) continue;
        order.push(b.id);
        noteBubble(b.id, T0 + d * DAY);
        wfHit(b.id === 'fish' ? 'x' : b.id);
        if (b.id === 'fish') P.growth.fish.rec = { carp: { n: 1, max: 1 } };
        if (b.id === 'enhance') P.counters.enhanceMax = 1;
        if (b.id === 'bless') P.gs.cnt.bless = 1;
        if (b.id === 'raid') P.counters.raidTries = 1;
        if (b.id === 'whet') P.growth.whet = 1;
        checkFirsts(T0 + d * DAY);
      }
      const done = wfState().done.length - order.length;
      console.log(`[firsts] ${who}: 옛 기록 done ${done}/${FIRSTS.length} · 「!」 순서 ${order.join(' → ') || '없음'}`);
      if (who === '이카몰리' || who === '고느끼') expect(order.slice(0, 2)).toEqual(['fish', 'gift']);
      else expect(order.every((id) => FIRSTS.find((x) => x.id === id)?.fresh)).toBe(true);
    });
  }
});
