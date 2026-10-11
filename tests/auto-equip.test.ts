// 핫픽스 12 §1: 장비 자동 장착 — 추천 장착 = 전수 조사 최대 · 잠금 장비는 그대로 · 모두 자동 장착 후 합 ≥ 전 · 직업 무기 보너스
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/data/config';
import { CLASS_WEAPON } from '../src/data/classes';
import { REGIONS, SLOTS } from '../src/data/items';
import { makeAdventurer, powerCalc, powerOf, totalStats } from '../src/world/adventurers';
import { autoEquipAll, bestGear, recommendEquip, upgradeFor } from '../src/world/autoEquip';
import { equip, fitsClass, gearStat, itemStat, makeItem } from '../src/world/items';
import { P, S, world, type Actor, type Item } from '../src/world/state';

const reg = (lvl = 5, kind?: string): Actor => {
  const a = makeAdventurer(5, 5, { status: 'regular' });
  a.lvl = lvl;
  if (kind) a.kind = kind as never;
  return a;
};
/** 여러 지역·등급·세트가 섞인 가방 */
function fill(n: number) {
  const grades = ['n', 'r', 'e', 'l'] as const;
  for (let i = 0; i < n; i++) {
    const it = makeItem(REGIONS[i % 3].id, grades[i % 4], SLOTS[i % 3], i % 2 === 0);
    // 공격% 옵션이 붙은 것도 섞는다
    if (i % 5 === 0) it.opts.push({ k: 'atkPct', v: 3 + (i % 7) });
    P.bag.push(it);
  }
}
/** 전수 조사: 3칸 × (안 끼움 포함) 모든 조합 */
function brute(a: Actor, pool: Item[]): number {
  const calc = powerCalc(a);
  const by = (s: string) => [undefined, ...pool.filter((it) => it.slot === s)];
  let best = 0;
  for (const w of by('weapon')) for (const ar of by('armor')) for (const ac of by('acc')) best = Math.max(best, calc([w, ar, ac].filter((x): x is Item => !!x)));
  return best;
}

beforeEach(() => {
  S.visiting = false as never;
  world.home = null as never;
  world.actors = [];
  P.bag = [];
  P.nextItemId = 1;
});

describe('직업 무기 궁합', () => {
  it('맞는 무기면 공격·마력 +15% · 다른 직업용이면 그대로 · 무기 아니면 null', () => {
    const a = reg(5, 'knight');
    const w = makeItem(REGIONS[0].id, 'e', 'weapon', false);
    w.wkind = CLASS_WEAPON.knight;
    expect(fitsClass(a, w)).toBe(true);
    expect(gearStat(a, w, 'atk')).toBe(Math.round(itemStat(w, 'atk') * (1 + CONFIG.items.classWeaponBonus)));
    w.wkind = CLASS_WEAPON.mage;
    expect(fitsClass(a, w)).toBe(false);
    expect(gearStat(a, w, 'atk')).toBe(itemStat(w, 'atk'));
    const ar = makeItem(REGIONS[0].id, 'e', 'armor', false);
    expect(fitsClass(a, ar)).toBeNull();
  });
  it('전투력·능력치에 반영 (이미 끼고 있던 저장도 계산 시점에 반영)', () => {
    const a = reg(5, 'mage');
    world.actors = [a];
    const w = makeItem(REGIONS[0].id, 'l', 'weapon', false);
    w.wkind = CLASS_WEAPON.knight;
    P.bag.push(w);
    equip(a, w);
    const off = powerOf(a);
    const atkOff = totalStats(a).atk;
    w.wkind = CLASS_WEAPON.mage;
    expect(powerOf(a)).toBeGreaterThan(off);
    expect(totalStats(a).atk).toBeGreaterThan(atkOff);
  });
});

describe('추천 장착', () => {
  it('가방 20개: 결과 = 전수 조사 최대 (여러 번)', () => {
    for (let t = 0; t < 12; t++) {
      P.bag = [];
      fill(20);
      const a = reg(3 + t, ['knight', 'mage', 'dwarf', 'rogue', 'cleric'][t % 5]);
      world.actors = [a];
      expect(bestGear(a, P.bag).power).toBe(brute(a, P.bag));
    }
  });
  it('다른 단골 것은 기본으론 안 가져오고, 체크하면 가져온다', () => {
    const a = reg(5, 'knight');
    const b = reg(5, 'knight');
    world.actors = [a, b];
    const w = makeItem(REGIONS[2].id, 'l', 'weapon', false);
    P.bag.push(w);
    equip(b, w);
    expect(recommendEquip(a).changed).toBe(0);
    expect(w.owner).toBe(b.id);
    expect(recommendEquip(a, true).changed).toBe(1);
    expect(w.owner).toBe(a.id);
  });
  it('잠근 장비는 안 움직인다 (남이 낀 것·가방의 것·내가 낀 것 모두)', () => {
    const a = reg(5, 'knight');
    const b = reg(5, 'knight');
    world.actors = [a, b];
    fill(12);
    const strong = makeItem(REGIONS[2].id, 'l', 'armor', false);
    strong.locked = true;
    P.bag.push(strong);
    const weak = makeItem(REGIONS[0].id, 'n', 'weapon', false);
    weak.locked = true;
    P.bag.push(weak);
    equip(a, weak);
    recommendEquip(b, true);
    recommendEquip(a, true);
    autoEquipAll();
    expect(strong.owner ?? null).toBeNull();
    expect(weak.owner).toBe(a.id);
    expect(a.equip.weapon).toBe(weak.id);
  });
});

describe('모두 자동 장착', () => {
  it('전체 전투력 합 ≥ 전 (여러 판) · 장비는 한 명만 낀다', () => {
    for (let t = 0; t < 10; t++) {
      P.bag = [];
      world.actors = [];
      for (let i = 0; i < 6; i++) world.actors.push(reg(2 + ((i * 7 + t) % 12), ['knight', 'mage', 'dwarf', 'rogue', 'cleric'][(i + t) % 5]));
      fill(24);
      // 일부러 엉망으로 끼워 둔다
      world.actors.forEach((a, i) => SLOTS.forEach((s, j) => { const c = P.bag.filter((x) => x.slot === s && x.owner == null)[(i + j + t) % 3]; if (c) equip(a, c); }));
      if (t % 3 === 0) P.bag[t].locked = true;
      const before = world.actors.reduce((s, a) => s + powerOf(a), 0);
      const r = autoEquipAll();
      const after = world.actors.reduce((s, a) => s + powerOf(a), 0);
      expect(after).toBeGreaterThanOrEqual(before);
      expect(r.gain).toBe(after - before);
      const worn = world.actors.flatMap((a) => SLOTS.map((s) => a.equip[s]).filter((x) => x != null));
      expect(new Set(worn).size).toBe(worn.length);
      for (const a of world.actors) for (const s of SLOTS) if (a.equip[s] != null) expect(P.bag.find((x) => x.id === a.equip[s])!.owner).toBe(a.id);
      // 두 번째엔 더 할 게 없다
      expect(autoEquipAll().gain).toBe(0);
    }
  });
  it('원정 나간 손님은 건드리지 않는다', () => {
    const a = reg(9, 'knight');
    const b = reg(1, 'knight');
    b.runId = 7;
    world.actors = [a, b];
    const w = makeItem(REGIONS[2].id, 'l', 'weapon', false);
    P.bag.push(w);
    equip(b, w);
    autoEquipAll();
    expect(w.owner).toBe(b.id);
  });
});

describe('새 장비 추천', () => {
  it('지금보다 좋아지는 손님 한 명 · 아무도 안 좋아지면 null', () => {
    const a = reg(5, 'knight');
    world.actors = [a];
    const good = makeItem(REGIONS[2].id, 'l', 'weapon', false);
    P.bag.push(good);
    const r = upgradeFor([good]);
    expect(r?.a).toBe(a);
    expect(r!.gain).toBeGreaterThan(0);
    equip(a, good);
    const bad = makeItem(REGIONS[0].id, 'n', 'weapon', false);
    P.bag.push(bad);
    expect(upgradeFor([bad])).toBeNull();
  });
});
