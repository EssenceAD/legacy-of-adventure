// 핫픽스 10: 건물 철거(치우기) — 옮기기 옆 「철거하기」 하나 + 확인 + 일부 환불. 새 시스템은 만들지 않는다.
//  환불 = (지은 값 + 올린 레벨 비용 합) × 50% · 지은 지 5분 안이면 100% · 마을 등급 장식을 옮겨 놓은 것(무료)은 0
import { CONFIG } from '../data/config';
import { def } from '../data/catalog';
import { HARMONIES } from '../data/harmony';
import { computeSets } from './harmony';
import { capacity, doorOf, rebuildPaths } from './town';
import { markDirty, world, type Building } from './state';

const B = () => CONFIG.build;

/** 철거할 수 있나 (이웃 방문 중 · 던전 같은 고정 건물 · 짓는 중 · 여관 본관 등 필수 건물은 안 됨) */
export function canRemove(o: Building, visiting = false): boolean {
  // CONSTRUCTION_SPEC §3: 공사 중이어도 철거 = 공사 취소
  if (visiting || def(o.kind).fixed || (o.build !== undefined && !o.con)) return false;
  return !B().noRemove.includes(o.kind);
}
export const isNoRemove = (o: Building) => B().noRemove.includes(o.kind);

/** 지금까지 들인 금화: 지은 값 + 올린 레벨 비용 합 */
export function spentOn(o: Building): number {
  const d = def(o.kind);
  const lv = d.levels ?? (d.up ? [d.up.cost] : []);
  return d.cost + lv.slice(0, Math.max(0, o.lvl - 1)).reduce((s, c) => s + c, 0);
}
/** 돌려받는 금화 */
export function refundOf(o: Building, now = Date.now()): { gold: number; full: boolean } {
  if (o.fromProp) return { gold: 0, full: false };
  const full = o.builtAt != null && now - o.builtAt <= B().fullRefundSec * 1000;
  return { gold: Math.floor(spentOn(o) * (full ? 1 : B().refundRate)), full };
}

/** 확인 화면에 띄울 경고: 안에 있는 손님 · 깨지는 어울림 · 별채 손님 */
export function removeEffects(o: Building) {
  const before = computeSets(world.objs);
  const after = computeSets(world.objs.filter((x) => x !== o));
  const lost = before.filter((s) => s.members.includes(o) && !after.some((a) => a.id === s.id && a.members.every((m) => s.members.includes(m))));
  const names = [...new Set(lost.map((s) => HARMONIES.find((h) => h.id === s.id)?.name ?? ''))].filter(Boolean);
  const guests = o.inside.length;
  // 별채(방): 철거하면 방이 줄어든다 → 넘치는 손님 수
  let overflow = 0;
  if (o.kind === 'cottage') {
    const stay = world.actors.filter((a) => !a.role && a.id && !a.leaving && a.status !== 'passer').length;
    overflow = Math.max(0, stay - capacity(world.objs.filter((x) => x !== o)));
  }
  return { guests, harmonies: names, overflow };
}

/** 철거 (game이 금화·연출·기록을 붙인다). 못 하면 false */
export function removeBuilding(o: Building, visiting = false): boolean {
  if (!canRemove(o, visiting) || !world.objs.includes(o)) return false;
  // 1) 안에 있던 손님은 문 앞으로 나와 그냥 서 있게 (moveBuilding과 같은 처리)
  const d = doorOf(o);
  const inside = [...o.inside];
  o.inside = [];
  for (const a of inside) Object.assign(a, { hidden: false, at: null, x: d[0], y: d[1], st: 'idle', t: 0.3, pop: 0.4 });
  // 2) 이 건물로 걸어가던 손님은 멈춰서 다시 고른다
  for (const a of world.actors) {
    if (a.door?.o === o) a.door = null;
    if (a.at === o) Object.assign(a, { at: null, hidden: false, st: 'idle', t: 0.3 });
  }
  for (const a of world.actors) if (a.door === null && a.st === 'door') Object.assign(a, { st: 'idle', t: 0.3 });
  // 4) 마을에서 빼고 길 다시
  world.objs = world.objs.filter((x) => x !== o);
  // 3) 별채면: 방이 모자라는 만큼 손님(단골 아님)은 「지나가는 손님」으로 (기존 「방 없음」 흐름)
  if (o.kind === 'cottage') {
    const stayers = () => world.actors.filter((a) => !a.role && a.id && !a.leaving && a.status !== 'passer');
    for (const a of stayers().filter((x) => x.status === 'visitor')) {
      if (stayers().length <= capacity()) break;
      a.status = 'passer';
    }
  }
  rebuildPaths();
  markDirty();
  return true;
}
