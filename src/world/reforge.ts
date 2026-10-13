// GROWTH §3-4: 옵션 재련 — 랜덤 옵션 하나를 다시 굴림 (그 등급 가루 + 금화) · 옵션 하나 잠그면 비용 ×2 · 고유 옵션은 재련 불가
import { CONFIG } from '../data/config';
import { BASE_REGIONS, OPT_INFO, REGIONS, ROLL_KEYS, type Grade } from '../data/items';
import { markDirty, P, S, wfHit, type Item, type ItemOpt } from './state';
import { gsState } from './goldsink';

const RF = () => CONFIG.growth.reforge;
/** 재련할 수 있는 옵션 번호들 (고유 옵션 · 잠근 옵션 빼고) */
export const rerollable = (it: Item, lock: number | null = null) => it.opts.map((o, i) => (o.u || i === lock ? -1 : i)).filter((i) => i >= 0);
export function reforgeCost(it: Item, lock: number | null = null): { dust: number; gold: number; grade: Grade } {
  const m = lock != null ? RF().lockMult : 1;
  return { dust: (RF().dust[it.grade] ?? 0) * m, gold: (RF().gold[it.grade] ?? 0) * m, grade: it.grade };
}
/** 못 하면 까닭 */
export function reforgeWhy(it: Item, lock: number | null = null): string | null {
  if (!it.opts.length || it.grade === 'n') return '옵션이 있는 장비만 재련할 수 있어요';
  if (lock != null && (lock < 0 || lock >= it.opts.length || it.opts[lock].u)) return '그 옵션은 잠글 수 없어요';
  if (!rerollable(it, lock).length) return '다시 굴릴 옵션이 없어요';
  const c = reforgeCost(it, lock);
  if ((P.dust[it.grade] ?? 0) < c.dust) return '가루가 모자라요';
  if (S.gold < c.gold) return '금화가 모자라요';
  return null;
}
/** 옵션 하나 새로 굴리기 (그 장비 지역 단계만큼 값이 커진다 — 처음 만들 때와 같은 식) */
export function rollOpt(it: Item, others: ItemOpt[], rng: () => number = Math.random): ItemOpt {
  const ri = Math.max(0, REGIONS.findIndex((r) => r.id === it.region));
  const keys = ROLL_KEYS.filter((k) => !others.some((o) => o.k === k));
  const k = keys[Math.floor(rng() * keys.length)];
  const inf = OPT_INFO[k];
  const v = Math.round((inf.min + rng() * (inf.max - inf.min)) * (1 + 0.25 * ri));
  if (k === 'regionDmg') {
    const regs = REGIONS.slice(0, Math.max(BASE_REGIONS, ri + 1));
    return { k, v, region: regs[Math.floor(rng() * regs.length)].id };
  }
  return { k, v };
}
export function reforge(it: Item, lock: number | null = null, rng: () => number = Math.random): { err: string } | { idx: number; before: ItemOpt; after: ItemOpt } {
  const why = reforgeWhy(it, lock);
  if (why) return { err: why };
  const c = reforgeCost(it, lock);
  P.dust[it.grade] -= c.dust;
  S.gold -= c.gold;
  gsState().cnt.smith++;
  wfHit('reforge');
  const cand = rerollable(it, lock);
  const idx = cand[Math.floor(rng() * cand.length)];
  const before = it.opts[idx];
  const after = rollOpt(it, it.opts.filter((_, i) => i !== idx), rng);
  it.opts = it.opts.map((o, i) => (i === idx ? after : o));
  markDirty();
  return { idx, before, after };
}
