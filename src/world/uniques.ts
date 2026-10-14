// GROWTH §3-4: 고유 장비 15종 (data/story/uniques.ts) — 만들기 · 나오는 곳(사냥 보스 · 토벌 처치 · 고지역 8시간 원정) · 고유 효과(special)
import { CONFIG } from '../data/config';
import { OPT_INFO, REGIONS, ROLL_KEYS, BASE_REGIONS, type RegionId } from '../data/items';
import { UNIQUES, type UniqueDef } from '../data/story/uniques';
import { addToBag, makeItem } from './items';
import { brag } from './growth';
import { markDirty, P, pick, type Actor, type Item, type ItemOpt } from './state';
import { mimiAlt } from './paceGates';

export const uniqueById = (id: string | undefined) => (id ? UNIQUES.find((u) => u.id === id) : undefined);
export const uniquesOf = (r: RegionId) => UNIQUES.filter((u) => u.region === r);
export const hasUniques = (r: RegionId) => UNIQUES.some((u) => u.region === r);

/** 고유 장비 한 개 (유물 등급 · 고유 옵션 1 + 일반 옵션 3) */
export function makeUnique(d: UniqueDef): Item {
  const it = makeItem(d.region as RegionId, 'a', d.slot, false);
  it.name = d.name;
  it.uid = d.id;
  if (d.slot === 'weapon') it.wkind = d.wkind ?? it.wkind;
  delete it.uniq;
  const ri = REGIONS.findIndex((r) => r.id === d.region);
  const u: ItemOpt = d.opt.k === 'regionDmg' ? { k: d.opt.k, v: d.opt.v, region: d.region as RegionId, u: true } : { k: d.opt.k, v: d.opt.v, u: true };
  const opts: ItemOpt[] = [u];
  for (let i = 0; i < 3; i++) {
    const k = pick(ROLL_KEYS.filter((x) => !opts.some((o) => o.k === x)));
    const inf = OPT_INFO[k];
    const v = Math.round((inf.min + Math.random() * (inf.max - inf.min)) * (1 + 0.25 * ri));
    opts.push(k === 'regionDmg' ? { k, v, region: pick(REGIONS.slice(0, Math.max(BASE_REGIONS, ri + 1))).id } : { k, v });
  }
  it.opts = opts;
  return it;
}

/** 얻음: 가방 · 도감 · 처음이면 [알림] 자랑 */
export function grantUnique(d: UniqueDef): Item {
  const it = makeUnique(d);
  addToBag(it);
  const n = (P.growth.uniques[d.id] ?? 0) + 1;
  P.growth.uniques[d.id] = n;
  markDirty();
  if (n === 1) brag('unique', it);
  // PACE R17: 도감이 거의 다 찼으면 고유 장비도 미미의 「새 칸」
  mimiAlt('unique');
  return it;
}

/** 확률 굴리기 — 지역에 고유 장비가 있으면 그중 하나 */
export function rollUnique(r: RegionId, chance: number, rng: () => number = Math.random): Item | null {
  const list = uniquesOf(r);
  if (!list.length || rng() >= chance) return null;
  return grantUnique(list[Math.floor(rng() * list.length)]);
}
/** 고지역 8시간 원정: 그 지역 것이 없으면(지역 6~10) 고유 장비 전체에서 하나 */
export function rollUniqueAny(r: RegionId, chance: number, rng: () => number = Math.random): Item | null {
  if (rng() >= chance) return null;
  const list = uniquesOf(r).length ? uniquesOf(r) : UNIQUES;
  return grantUnique(list[Math.floor(rng() * list.length)]);
}

// ───────── 고유 효과 (special) ─────────

/** special 글의 숫자 (예: 「치명타 +8%」 → 8) */
export const specialValue = (d: UniqueDef) => Number(/(\d+)%/.exec(d.special?.text ?? '')?.[1] ?? 0);
const equipped = (a: Actor): Item[] => (a.equip ? (['weapon', 'armor', 'acc'] as const).map((s) => P.bag.find((x) => x.id === a.equip[s])).filter((x): x is Item => !!x) : []);
/** 이 손님이 낀 고유 효과 합 (%) — 없으면 0 */
export function specialSum(a: Actor, key: string, items: Item[] = equipped(a)): number {
  let v = 0;
  for (const it of items) {
    const d = uniqueById(it.uid);
    if (d?.special?.key === key) v += specialValue(d) || 1;
  }
  return v;
}
export const hasSpecial = (a: Actor, key: string, items?: Item[]) => specialSum(a, key, items) > 0;
/** 파티 중 누구라도 */
export const partySpecial = (ms: Actor[], key: string) => ms.reduce((s, m) => s + specialSum(m, key), 0);

/** 고유 장비 칸 (도감) — 얻은 것만 공개 */
export const uniqueDexCount = () => UNIQUES.filter((u) => (P.growth.uniques[u.id] ?? 0) > 0).length;
export { UNIQUES };
void CONFIG;
