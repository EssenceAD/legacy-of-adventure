// 아자 건의 10/23: 일괄 분해 「고유 장비 남기기」 · 장비 옵션 한 줄 · 「다락의 옛 칼」 잃어버리면 다시 (잠근 채)
import { beforeEach, describe, expect, it } from 'vitest';
import { REGIONS, SLOTS } from '../src/data/items';
import { bulkTargets, bulkUniqueKept, salvageBulk } from '../src/world/craft';
import { makeItem } from '../src/world/items';
import { P } from '../src/world/state';
import { optLine } from '../src/ui/guests';
import { atticRepair } from '../src/ui/routes';
import { routeHooks } from '../src/world/routes';

const mk = (grade: 'n' | 'r' | 'e' | 'l' | 'a', extra: Record<string, unknown> = {}) => Object.assign(makeItem(REGIONS[0].id, grade as never, SLOTS[0], false), extra);
beforeEach(() => {
  P.bag = [];
  P.dust = { n: 0, r: 0, e: 0, l: 0, a: 0 };
  P.salvage = { grades: ['a'], upgraded: false, keepBest: false, keepUnique: true, auto: '' };
});

describe('고유 장비 남기기', () => {
  it('기본 켬: 유물 일괄 분해에서 고유(uid)만 남는다', () => {
    const u = mk('a', { uid: 'u1' });
    P.bag = [mk('a'), mk('a'), u];
    expect(bulkTargets(['a'], { keepBest: false })).not.toContain(u);
    expect(bulkUniqueKept({})).toBe(1);
    const r = salvageBulk(['a'], { keepBest: false });
    expect(r.count).toBe(2);
    expect(P.bag).toEqual([u]);
  });
  it('끄면 예전처럼 고유도 분해 대상', () => {
    const u = mk('a', { uid: 'u1' });
    P.bag = [mk('a'), u];
    expect(bulkTargets(['a'], { keepBest: false, keepUnique: false })).toContain(u);
    expect(bulkUniqueKept({ keepUnique: false })).toBe(0);
  });
});

describe('장비 옵션 한 줄', () => {
  it('옵션 · ★고유 · 세트가 한 줄로', () => {
    const it1 = mk('l', { opts: [{ k: 'atkPct', v: 5 }, { k: 'atkPct', v: 3, u: true }], set: true });
    const h = optLine(it1);
    expect(h).toContain('optln');
    expect(h).toContain('uopt');
    expect(h).toContain('세트');
    expect(optLine(mk('n', { opts: [] }))).toContain('옵션 없음');
  });
});

describe('다락의 옛 칼', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="toast"></div>';
    P.story.route = 'hero';
    P.story.seen = [];
    P.story.flags = {};
  });
  it('분해 등으로 없어지면 다시 넣고 잠근다 (한 번)', () => {
    expect(routeHooks.atticItem()).toBeNull();
    expect(atticRepair()).toBe(true);
    const it = routeHooks.atticItem() as { locked?: boolean; enh: number };
    expect(it).toBeTruthy();
    expect(it.locked).toBe(true);
    expect(atticRepair()).toBe(false);
    expect(P.bag.filter((x) => x.name === '다락의 옛 칼')).toHaveLength(1);
  });
  it('가방에 있는데 잠금이 없으면 잠그기만', () => {
    atticRepair();
    const it = routeHooks.atticItem() as { locked?: boolean };
    it.locked = false;
    expect(atticRepair()).toBe(false);
    expect(it.locked).toBe(true);
  });
  it('목표를 이미 이뤘거나 다른 루트면 건드리지 않음', () => {
    P.story.seen = ['goal:h_gear'];
    expect(atticRepair()).toBe(false);
    expect(routeHooks.atticItem()).toBeNull();
    P.story.seen = [];
    P.story.route = 'love';
    expect(atticRepair()).toBe(false);
  });
});
