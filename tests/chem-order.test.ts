// 핫픽스 11 §10: 짝꿍 대사 — 말하는 사람이 뒤바뀌지 않게
import { describe, expect, it } from 'vitest';
import { CHEM_PAIRS, orderPair, pairById, type Who } from '../src/data/chem';
import { GUEST_KINDS, RACES } from '../src/data/classes';
import { queueChemTalk } from '../src/world/actors';
import { clearEvents, pumpEvents } from '../src/world/events';
import { P, uiHooks, world, type Actor, type TalkLine } from '../src/world/state';

const who = (kind: string, race: string, extra: Partial<Who> = {}): Who => ({ kind, race, rarity: 'common', ...extra }) as Who;
/** 모든 직업 × 종족 × (보통·전설) */
const ALL: Who[] = [];
for (const k of GUEST_KINDS) for (const r of RACES) for (const rar of ['common', 'legend'] as const) ALL.push(who(k, r, { rarity: rar }));

describe('orderPair', () => {
  it('모든 짝: a·b 순서를 바꿔도 결과가 같다', () => {
    let n = 0;
    for (const p of CHEM_PAIRS)
      for (const a of ALL)
        for (const b of ALL) {
          if (a === b || !p.match(a, b)) continue;
          const [f1, s1] = orderPair(p, a, b);
          const [f2, s2] = orderPair(p, b, a);
          const first = p.first ?? (p.match as { first?: (w: Who) => boolean }).first;
          // 순서가 정해진 짝이면 두 결과가 같아야 하고 · 정해지지 않은 짝(같은 것끼리)이면 상관없다
          if (first && first(a) !== first(b)) {
            expect([f2, s2]).toEqual([f1, s1]);
            n++;
          }
        }
    expect(n).toBeGreaterThan(50);
  });
  it('dwarf-elf: 첫째는 늘 드워프 · halfling-knight: 하플링 · legend-any: 전설 아닌 쪽', () => {
    const de = pairById('dwarf-elf')!;
    for (const k1 of GUEST_KINDS)
      for (const k2 of GUEST_KINDS) {
        const d = who(k1, 'dwarf');
        const e = who(k2, 'elf');
        expect(orderPair(de, e, d)[0].race).toBe('dwarf');
        expect(orderPair(de, d, e)[0].race).toBe('dwarf');
      }
    const hk = pairById('halfling-knight')!;
    const h = who('rogue', 'halfling');
    const k = who('knight', 'human');
    expect(orderPair(hk, k, h)[0]).toBe(h);
    const la = pairById('legend-any')!;
    const L = who('mage', 'elf', { rarity: 'legend' });
    const c = who('rogue', 'human');
    expect(orderPair(la, L, c)[0]).toBe(c);
    expect(orderPair(la, c, L)[0]).toBe(c);
  });
  it('사제지간: 「스승님!」은 제자(momo2)가', () => {
    const p = pairById('L-scarlet-momo2')!;
    const sc = who('mage', 'human', { legendId: 'scarlet' });
    const mo = who('mage', 'halfling', { legendId: 'momo2' });
    expect(orderPair(p, sc, mo)[0]).toBe(mo);
    expect(p.meet[0]).toMatch(/스승님/);
  });
});

describe('queueChemTalk: 첫 줄 화자가 그 역할', () => {
  it('엘프·드워프를 엘프 먼저 넣어도 「엘프는 맥주 맛을 몰라」는 드워프가', () => {
    const elf = { id: 101, kind: 'mage', race: 'elf', rarity: 'common', name: '엘린', status: 'regular' } as unknown as Actor;
    const dw = { id: 102, kind: 'knight', race: 'dwarf', rarity: 'common', name: '브롬', status: 'regular' } as unknown as Actor;
    world.actors = [elf, dw];
    P.bonds = {} as never;
    let got: TalkLine[] = [];
    uiHooks.talk = (l) => void (got = l);
    clearEvents();
    queueChemTalk(elf, dw, 2);
    pumpEvents(false);
    expect(got[1][0]).toBe('@102');
    expect(got[1][1]).toBe('엘프는 맥주 맛을 몰라');
    expect(got[2][0]).toBe('@101');
  });
});
