// 핫픽스 12 §1: 장비 자동 장착 — 한 손님 「추천 장착」(3칸 전체 조합 · 세트 효과까지) · 「모두 자동 장착」(욕심쟁이 배분) · 새 장비 추천
//  잠근 장비(🔒)는 절대 옮기지 않는다. 원정 나간 손님의 장비도 건드리지 않는다.
import { SLOTS, type Slot } from '../data/items';
import { powerCalc, powerOf } from './adventurers';
import { equip, gearStat, itemById, unequip } from './items';
import { P, world, type Actor, type Item } from './state';

export type Gear = Partial<Record<Slot, Item>>;
const listOf = (g: Gear): Item[] => SLOTS.map((s) => g[s]).filter((x): x is Item => !!x);
const homeActors = () => world.home?.actors ?? world.actors;

/** 자동 장착 대상: 집에 있는 단골·영웅 (원정 중이면 빼고) */
export const equipTargets = (): Actor[] => homeActors().filter((a) => !!a.id && (a.status === 'regular' || a.status === 'hero') && a.runId == null);

/** 이 손님이 쓸 수 있는 후보인가 — 잠금은 이미 자기가 끼고 있는 것만, 남이 낀 건 take일 때만 (그 손님이 원정 중이면 안 됨) */
function usable(a: Actor, it: Item, take: boolean): boolean {
  if (it.owner === a.id) return true;
  if (it.locked) return false;
  if (it.owner == null) return true;
  if (!take) return false;
  const o = homeActors().find((x) => x.id === it.owner);
  return !o || o.runId == null;
}

/**
 * 한 손님의 최선 조합 — 3칸 전체 조합을 다 재되, 확실히 지는 후보(능력치·공격% 둘 다 낮고 세트 이점도 없음)는 미리 뺀다.
 * 전투력 = (기본 + 장비 합) × (배수 + 공격%) 이라 두 값이 다 크거나 같으면 절대 지지 않는다 → 결과는 전수 조사와 같다.
 */
export function bestGear(a: Actor, pool: Item[], take = false): { gear: Gear; power: number } {
  const calc = powerCalc(a);
  const cands: Record<Slot, (Item | undefined)[]> = { weapon: [], armor: [], acc: [] };
  for (const s of SLOTS) {
    const cur = itemById(a.equip?.[s]);
    // 잠근 장비를 끼고 있으면 그 칸은 그대로
    if (cur?.locked) {

      cands[s] = [cur];
      continue;
    }
    const raw = pool.filter((it) => it.slot === s && usable(a, it, take));
    const score = (it: Item) => ({ st: statSum(a, it), pct: it.opts.filter((o) => o.k === 'atkPct').reduce((v, o) => v + o.v, 0) });
    const sc = new Map(raw.map((it) => [it, score(it)]));
    const beats = (x: Item, y: Item) => {
      const X = sc.get(x)!;
      const Y = sc.get(y)!;
      if (X.st < Y.st || X.pct < Y.pct) return false;
      if (y.set && !(x.set && x.region === y.region)) return false;
      return X.st > Y.st || X.pct > Y.pct || x.id < y.id || (!!x.set && !y.set);
    };
    const keep = raw.filter((y) => !raw.some((x) => x !== y && beats(x, y)));
    cands[s] = keep.length ? keep : [undefined];
  }
  let best: Gear = {};
  let bestP = -1;
  for (const w of cands.weapon)
    for (const ar of cands.armor)
      for (const ac of cands.acc) {
        const items = [w, ar, ac].filter((x): x is Item => !!x);
        const p = calc(items);
        if (p > bestP) {
          bestP = p;
          best = { weapon: w, armor: ar, acc: ac };
        }
      }
  return { gear: best, power: bestP };
}
const statSum = (a: Actor, it: Item) => (['atk', 'def', 'mag', 'agi', 'luk'] as const).reduce((v, k) => v + gearStat(a, it, k), 0);

/** 조합을 실제로 끼운다 (바뀐 칸 수) */
export function applyGear(a: Actor, g: Gear): number {
  let n = 0;
  for (const s of SLOTS) {
    const it = g[s];
    const cur = a.equip?.[s] ?? null;
    if (it && it.id !== cur) {
      equip(a, it);
      n++;
    } else if (!it && cur != null && !itemById(cur)?.locked) {
      unequip(a, s);
      n++;
    }
  }
  return n;
}

/** 손님 창 「추천 장착」 — 바뀐 칸 수와 전투력 차이 */
export function recommendEquip(a: Actor, take = false): { changed: number; gain: number } {
  const before = powerOf(a);
  const { gear, power } = bestGear(a, P.bag, take);
  if (power <= before) return { changed: 0, gain: 0 };
  const changed = applyGear(a, gear);
  return { changed, gain: powerOf(a) - before };
}

/**
 * 「모두 자동 장착」 — 영웅·전설 먼저, 그다음 레벨 높은 순 → 같은 레벨이면 전투력 순으로 남은 장비에서 최선을 고른다.
 *  잠금·원정 중 장비는 그대로. 전체 합이 줄어드는 배분이면(드묾) 「각자 지금 것 + 남는 것」 방식으로 다시 한다 → 합은 절대 안 줄어든다.
 */
export function autoEquipAll(): { people: number; gain: number } {
  const who = equipTargets();
  const order = who.slice().sort((x, y) => +!!(y.heroId || y.legendId) - +!!(x.heroId || x.legendId) || y.lvl - x.lvl || powerOf(y) - powerOf(x) || x.id! - y.id!);
  const before = new Map(who.map((a) => [a, powerOf(a)]));
  const snap = new Map(who.map((a) => [a, { ...a.equip }]));
  const total0 = [...before.values()].reduce((s, v) => s + v, 0);
  const frozen = new Set(P.bag.filter((it) => it.owner != null && !who.some((a) => a.id === it.owner)));
  const run = (pooled: boolean) => {
    const taken = new Set<Item>();
    const plan = new Map<Actor, Gear>();
    for (const a of order) {
      const pool = P.bag.filter((it) => !taken.has(it) && !frozen.has(it) && (pooled ? !it.locked || it.owner === a.id : it.owner == null || it.owner === a.id) && (!it.locked || it.owner === a.id));
      // 남의 것도 풀에 넣되 bestGear의 take 검사는 통과시킨다 (풀이 이미 걸러짐)
      const { gear } = bestGear(a, pool, true);
      for (const it of listOf(gear)) taken.add(it);
      plan.set(a, gear);
    }
    // 아무도 안 고른 장비는 벗긴다(잠금 제외) → 고른 대로 끼운다
    for (const a of who)
      for (const s of SLOTS) {
        const cur = itemById(a.equip?.[s]);
        if (cur && !cur.locked && !taken.has(cur)) unequip(a, s);
      }
    for (const a of order) applyGear(a, plan.get(a)!);
  };
  const restore = () => {
    for (const a of who) for (const s of SLOTS) if (!itemById(a.equip?.[s])?.locked) unequip(a, s);
    for (const a of who)
      for (const s of SLOTS) {
        const it = itemById(snap.get(a)![s]);
        if (it && !it.locked) equip(a, it);
      }
  };
  run(true);
  let total = who.reduce((s, a) => s + powerOf(a), 0);
  if (total < total0) {
    restore();
    run(false);
    total = who.reduce((s, a) => s + powerOf(a), 0);
  }
  const people = who.filter((a) => SLOTS.some((s) => (snap.get(a)![s] ?? null) !== (a.equip?.[s] ?? null))).length;
  return { people, gain: total - total0 };
}

/** §1-4: 새로 얻은 장비 중 「지금보다 좋아지는」 손님 한 명 (가장 크게 오르는) */
export function upgradeFor(items: Item[], also: Actor[] = []): { a: Actor; it: Item; gain: number } | null {
  let best: { a: Actor; it: Item; gain: number } | null = null;
  for (const a of [...equipTargets(), ...also.filter((x) => x.runId != null)]) {
    const calc = powerCalc(a);
    const cur = SLOTS.map((s) => itemById(a.equip?.[s])).filter((x): x is Item => !!x);
    const now = calc(cur);
    for (const it of items) {
      if (it.owner != null || it.locked || !P.bag.includes(it)) continue;
      const old = itemById(a.equip?.[it.slot]);
      if (old?.locked) continue;
      const g = calc([...cur.filter((x) => x.slot !== it.slot), it]) - now;
      if (g > 0 && (!best || g > best.gain)) best = { a, it, gain: g };
    }
  }
  return best;
}
