// 웅스 제보 「전설 영웅 카드가 전설 손님과 똑같아요」 — legendFrame (실험실 · 기본 꺼짐)
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeAdventurer } from '../src/world/adventurers';
import { setFlag } from '../src/world/flags';
import { sortGuests } from '../src/world/growth';
import { P, resetProgress, world, type Actor } from '../src/world/state';
import { heroCardData, heroCardHtml, heroTier, sagaFirst, TIER_NAME } from '../src/ui/heroCard';

const mk = (o: Partial<Actor>) => {
  const a = makeAdventurer(5, 5, { status: 'regular', ...o } as never);
  a.id = P.nextAdvId++;
  a.hp = 100;
  Object.assign(a, o);
  world.actors.push(a);
  return a;
};
let plain: Actor, special: Actor, guestL: Actor, hero: Actor, saga: Actor, myth: Actor;
beforeEach(() => {
  resetProgress();
  world.actors = [];
  plain = mk({ kind: 'knight', name: '평범', rarity: 'common' } as never);
  special = mk({ kind: 'knight', name: '특별', rarity: 'special' } as never);
  guestL = mk({ kind: 'mage', name: '전설손님', rarity: 'legend' } as never);
  hero = mk({ kind: 'knight', name: '영웅', rarity: 'legend' } as never);
  hero.heroId = 'h1' as never;
  saga = mk({ kind: 'rogue', name: '루나', rarity: 'legend' } as never);
  saga.legendId = 'luna';
  myth = mk({ kind: 'knight', name: '엘리시아', rarity: 'legend' } as never);
  myth.legendId = 'elysia';
  P.legacy.mythicSeeds = ['elysia'];
  (P.story.mythic ??= {}).elysia = { met: true } as never;
});
afterEach(() => setFlag('legendFrame', false));

describe('legendFrame 등급', () => {
  it('끄면 예전 그대로: 전설 영웅도 전설 손님과 같은 legend · 카드에 .lf 없음', () => {
    expect(heroTier(saga)).toBe('legend');
    expect(heroTier(guestL)).toBe('legend');
    expect(heroCardHtml(saga)).not.toContain('hcd-lf');
    expect(heroCardHtml(myth)).not.toContain('hcd-crown');
  });
  it('켜면 우선순위 신화 > 전설 영웅 > 영웅 > 전설 손님 > 특별 > 평범', () => {
    setFlag('legendFrame', true);
    expect([myth, saga, hero, guestL, special, plain].map((a) => heroTier(a))).toEqual(['mythic', 'saga', 'hero', 'legend', 'special', 'common']);
    // 영웅 표시가 같이 붙어도 전설 영웅이 먼저 · 신화가 맨 먼저
    saga.heroId = 'h2' as never;
    expect(heroTier(saga)).toBe('saga');
    expect(TIER_NAME.saga).toBe('전설 영웅');
    expect(heroCardData(saga).color).toBe('#ffd36b');
    expect(heroCardData(guestL).color).not.toBe('#ffd36b');
  });
  it('켜면 카드: 전설 영웅·신화만 금테·왕관 리본 (전설 손님은 주황 그대로) · 작은 판은 왕관만', () => {
    setFlag('legendFrame', true);
    const h = heroCardHtml(saga);
    expect(h).toContain('t-saga');
    expect(h).toContain('hcd-lf');
    expect(h).toContain('<small>전설</small>');
    expect(heroCardHtml(myth)).toContain('<small>신화</small>');
    expect(heroCardHtml(guestL)).not.toContain('hcd-lf');
    expect(heroCardHtml(hero)).not.toContain('hcd-lf');
    const sm = heroCardHtml(saga, { size: 'sm' });
    expect(sm).toContain('hcd-crown');
    expect(sm).not.toContain('<small>전설</small>');
  });
});

describe('legendFrame 정렬: 값이 같으면 전설 영웅 먼저 (★ 고정이 우선)', () => {
  const L = [
    { id: 1, v: 10, legendId: undefined },
    { id: 2, v: 10, legendId: 'luna' },
    { id: 3, v: 10, legendId: undefined },
    { id: 4, v: 20, legendId: undefined },
  ];
  const key = (a: (typeof L)[number]) => a.v;
  it('끄면 예전 순서', () => {
    expect(sortGuests(L, key, [], true, (a) => sagaFirst(a)).map((a) => a.id)).toEqual([4, 1, 2, 3]);
  });
  it('켜면 같은 값 안에서 전설 영웅 먼저 · ★ 고정은 그보다 먼저', () => {
    setFlag('legendFrame', true);
    expect(sortGuests(L, key, [], true, (a) => sagaFirst(a)).map((a) => a.id)).toEqual([4, 2, 1, 3]);
    expect(sortGuests(L, key, [3], true, (a) => sagaFirst(a)).map((a) => a.id)).toEqual([3, 4, 2, 1]);
    // ★ 고정 끄면 값 → 전설 영웅 → ★
    expect(sortGuests(L, key, [3], false, (a) => sagaFirst(a)).map((a) => a.id)).toEqual([4, 2, 3, 1]);
  });
});
