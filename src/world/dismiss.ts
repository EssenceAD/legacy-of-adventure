// FEEDBACK: 손님 내보내기 — 방문·지나가는 손님은 체크아웃 · 단골은 작별(장비는 가방으로 · 추억에 이름) · 실제 3일 동안 「옛 단골」에서 다시 부르기
import { CONFIG } from '../data/config';
import { SLOTS } from '../data/items';
import { track } from '../net/telemetry';
import { arrive, regularsCount, sendAway } from './actors';
import { say as bubble } from './fx';
import { makeAdventurer } from './adventurers';
import { equip } from './items';
import { markDirty, P, S, world, type Actor } from './state';
import { capacity, entrance } from './town';
import { autoSlotOf } from './hunt';

const D = () => CONFIG.dismiss;
export interface FormerReg {
  id: number;
  kind: Actor['kind'];
  race: Actor['race'];
  rarity: Actor['rarity'];
  name: string;
  lvl: number;
  xp: number;
  face?: Actor['face'];
  hair?: string;
  /** 끼고 있던 장비 id (다시 부르면 가방에 그대로 있으면 다시 낀다) */
  equip: Partial<Record<(typeof SLOTS)[number], number | null>>;
  at: number;
}
const former = (): FormerReg[] => (P.formerRegs ??= []);

/** 내보낼 수 없는 까닭 (null = 내보낼 수 있음) */
export function dismissWhy(a: Actor): string | null {
  if (S.visiting) return '이웃 마을에서는 못 해요';
  if (a.cameo) return '지나가는 개척자예요';
  if (a.heroId || a.legendId || a.status === 'hero') return '영웅·전설 동료는 내보낼 수 없어요';
  if (a.runId != null) return '원정 중이에요';
  // PACE §2 huntSlots: 맡겨 둔 칸 어디든 (끔이면 0번 칸 = 예전 P.hunt.auto)
  if (a.id && autoSlotOf(a.id) >= 0) return '사냥 중이에요 (맡겨 두기)';
  if (a.leaving) return '이미 떠나는 중이에요';
  if (a.role || !a.id) return '손님이 아니에요';
  return null;
}

/** 방문·지나가는 손님: 웃으며 짐 싸서 나감 (기분 보상·불이익 없음) */
export function checkout(a: Actor): boolean {
  if (dismissWhy(a) || a.status === 'regular') return false;
  leave(a, '오늘은 이만 체크아웃할게요~');
  track('guest_dismiss', { status: a.status, lvl: a.lvl });
  return true;
}
/** 단골 작별: 작별 대사 · 장비는 가방으로 · 옛 단골(3일) · 추억에 이름 */
export function farewell(a: Actor): string | null {
  if (dismissWhy(a) || a.status !== 'regular') return null;
  const line = D().farewellLines[(Math.random() * D().farewellLines.length) | 0];
  const f = former();
  f.push({ id: a.id, kind: a.kind, race: a.race, rarity: a.rarity, name: a.name, lvl: a.lvl, xp: a.xp, face: a.face, hair: a.hair, equip: { ...a.equip }, at: Date.now() });
  if (f.length > D().formerMax) f.splice(0, f.length - D().formerMax);
  const names = (P.farewells ??= []);
  if (!names.includes(a.name)) names.push(a.name);
  leave(a, line);
  track('guest_dismiss', { status: 'regular', lvl: a.lvl });
  return line;
}
/** 기분·평판 변화 없이 떠나기 (sendAway는 평판이 오르내린다) */
function leave(a: Actor, say: string) {
  const rep = P.rep;
  sendAway(a, true);
  P.rep = rep;
  bubble(a, say, 1);
  P.waitlist = P.waitlist.filter((w) => w.id !== a.id);
  markDirty();
}

/** 옛 단골 (실제 3일 안) */
export function formerList(now = Date.now()): FormerReg[] {
  const keep = former().filter((x) => now - x.at < D().recallDays * 864e5);
  if (keep.length !== former().length) {
    P.formerRegs = keep;
    markDirty();
  }
  return keep;
}
/** 다시 부르기: 단골 자리가 있을 때만 · 레벨·경험치·장비 그대로 */
export function recall(id: number): string | null {
  const r = formerList().find((x) => x.id === id);
  if (!r) return '이미 떠난 지 오래예요';
  if (regularsCount() >= capacity()) return '단골 자리가 없어요 · 별채를 더 짓거나 단골을 내보내요';
  if (world.actors.some((a) => a.id === id)) return '이미 마을에 있어요';
  const [ex, ey] = entrance();
  const a = makeAdventurer(ex, ey, { kind: r.kind as never, race: r.race, rarity: r.rarity, lvl: r.lvl, status: 'regular' });
  Object.assign(a, { id: r.id, name: r.name, xp: r.xp, face: r.face ?? a.face, hair: r.hair ?? a.hair, status: 'regular' });
  arrive(a);
  for (const s of SLOTS) {
    const it = P.bag.find((x) => x.id === r.equip[s] && x.owner == null);
    if (it) equip(a, it);
  }
  P.formerRegs = former().filter((x) => x.id !== id);
  track('guest_recall', { lvl: r.lvl });
  markDirty();
  return null;
}
