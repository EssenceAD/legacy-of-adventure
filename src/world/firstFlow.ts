// CHECKIN §B 첫 30분 동선 (플래그 firstFlowFix) — 화면 없이 시험할 수 있는 순서·고르기 규칙만
import type { Actor, Item } from './state';

/**
 * §B-1 임무로 건설 창을 열 때: 임무 대상은 따로 맨 위(목록에서 빼고), 나머지는 열린 것 먼저 → 잠긴 것 아래.
 *  같은 무리 안에서는 원래 순서 그대로 (안정 정렬).
 */
export function orderBuildKinds<K>(kinds: readonly K[], target: K | null | undefined, locked: (k: K) => boolean): { top: K | null; rest: K[] } {
  const top = target != null && kinds.includes(target) ? target : null;
  const others = kinds.filter((k) => k !== top);
  return { top, rest: [...others.filter((k) => !locked(k)), ...others.filter((k) => locked(k))] };
}

/**
 * §B-3 장비 임무 바로가기: 가방의 안 낀 희귀 이상 장비를 낄 수 있는 단골·영웅 (원정 중 X).
 *  무기는 직업에 맞는 것만 (fits === false면 빼고), 방어구·장신구는 누구나.
 */
export function equipCandidates(
  actors: readonly Pick<Actor, 'id' | 'kind' | 'status' | 'runId' | 'role' | 'leaving'>[],
  bag: readonly Pick<Item, 'owner' | 'grade' | 'slot' | 'wkind' | 'locked'>[],
  fits: (a: Pick<Actor, 'kind'>, it: Pick<Item, 'slot' | 'wkind'>) => boolean | null,
): number[] {
  const loose = bag.filter((it) => it.owner == null && it.grade !== 'n');
  if (!loose.length) return [];
  return actors
    .filter((a) => !!a.id && !a.role && !a.leaving && (a.status === 'regular' || a.status === 'hero') && a.runId == null)
    .filter((a) => loose.some((it) => fits(a, it) !== false))
    .map((a) => a.id);
}
