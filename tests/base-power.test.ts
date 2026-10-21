// BASE_POWER_1021 (아자 건의): 맨몸 전투력 = 장비 뺀 값 · 정렬 · 내보내기 모드 순서 · 장비 모두 벗기
import { beforeEach, describe, expect, it } from 'vitest';
import { REGIONS, SLOTS } from '../src/data/items';
import { basePower, makeAdventurer, powerOf } from '../src/world/adventurers';
import { bagSize, equip, equippedItems, makeItem, unequipAll } from '../src/world/items';
import { P, S, world, type Actor } from '../src/world/state';
import { heroCardData, heroCardHtml } from '../src/ui/heroCard';
import { guestSortKey, outOrder } from '../src/ui/guests';

const reg = (lvl = 5): Actor => {
  const a = makeAdventurer(5, 5, { status: 'regular' });
  a.lvl = lvl;
  world.actors.push(a);
  return a;
};
/** 세 칸 다 끼우기 */
function dress(a: Actor) {
  for (const s of SLOTS) {
    const it = makeItem(REGIONS[0].id, 'e', s);
    P.bag.push(it);
    equip(a, it);
  }
}

beforeEach(() => {
  S.visiting = false as never;
  world.home = null as never;
  world.actors = [];
  P.bag = [];
  P.nextItemId = 1;
  P.growth.favs = [];
});

describe('맨몸 전투력', () => {
  it('장비 없으면 전투력과 같고 · 끼우면 전투력만 오르고 맨몸은 그대로', () => {
    const a = reg(10);
    const bare = basePower(a);
    expect(bare).toBe(powerOf(a));
    dress(a);
    expect(powerOf(a)).toBeGreaterThan(bare);
    expect(basePower(a)).toBe(bare);
  });
  it('카드: 장비가 있으면 회색 「맨몸」 · 없으면 생략 · 내보내기 모드면 맨몸이 큰 숫자', () => {
    const a = reg(8);
    expect(heroCardData(a).bare).toBeNull();
    expect(heroCardHtml(a)).not.toContain('hcd-bare');
    dress(a);
    expect(heroCardData(a).bare).toBe(basePower(a));
    expect(heroCardHtml(a)).toContain('맨몸');
    const big = heroCardHtml(a, { bare: true });
    expect(big).toMatch(new RegExp(`hcd-pw">${basePower(a).toLocaleString('ko-KR')}<`));
    expect(big).toContain(`장비 ${powerOf(a).toLocaleString('ko-KR')}`);
  });
});

describe('정렬 · 내보내기 모드', () => {
  it('손님 정렬 「맨몸 전투력」 키 = basePower', () => {
    const a = reg(6);
    dress(a);
    expect(guestSortKey(2)(a)).toBe(basePower(a));
    expect(guestSortKey(1)(a)).toBe(powerOf(a));
  });
  it('내보내기 모드: 맨몸 낮은 순 · 장비 많이 낀 약한 사람이 위 · ★은 맨 뒤', () => {
    const weak = reg(2);
    const mid = reg(10);
    const strong = reg(20);
    dress(weak); // 장비 포함이면 weak가 mid보다 셀 수도 있지만 맨몸은 가장 약함
    P.growth.favs = [mid.id];
    expect(outOrder([strong, mid, weak]).map((a) => a.id)).toEqual([weak.id, strong.id, mid.id]);
  });
});

describe('장비 모두 벗기', () => {
  it('끼운 장비 전부 가방으로', () => {
    const a = reg(5);
    dress(a);
    expect(unequipAll(a)).toEqual({ moved: 3, short: 0 });
    expect(equippedItems(a)).toHaveLength(0);
    expect(P.bag.every((it) => it.owner == null)).toBe(true);
  });
  it('가방이 모자라면 들어가는 만큼만 · 모자란 칸 수', () => {
    const a = reg(5);
    dress(a);
    // 빈칸 1칸만 남기기
    const fillN = bagSize() - 1;
    for (let i = 0; i < fillN; i++) P.bag.push(makeItem(REGIONS[0].id, 'n', 'acc'));
    expect(unequipAll(a)).toEqual({ moved: 1, short: 2 });
    expect(equippedItems(a)).toHaveLength(2);
  });
});
