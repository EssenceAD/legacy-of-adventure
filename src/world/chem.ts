// 케미 본편: 두 손님 사이의 친밀도(1~5단계) · 숨은 짝 발견 · 파티 배율
import { CONFIG } from '../data/config';
import { matchPair, pairById, type ChemPair, type Who } from '../data/chem';
import { P, uiHooks, world, type Actor } from './state';

const C = CONFIG.chem;

export const bondKey = (a: Actor, b: Actor) => (a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`);

/** 두 손님의 짝 조합 (없으면 undefined) */
export const pairOf = (a: Actor, b: Actor): ChemPair | undefined =>
  a.role || b.role || !a.id || !b.id ? undefined : matchPair(a as unknown as Who, b as unknown as Who);

export function bondOf(a: Actor, b: Actor) {
  return P.bonds[bondKey(a, b)];
}

export interface BondGain {
  pair: ChemPair;
  a: Actor;
  b: Actor;
  /** 처음 발견한 짝인가 */
  discovered: boolean;
  /** 단계가 올랐으면 새 단계 */
  levelUp: number | null;
}

/** 친밀도를 올린다 (짝이 아니면 null) */
export function addBond(a: Actor, b: Actor, xp: number): BondGain | null {
  const pair = pairOf(a, b);
  if (!pair) return null;
  const k = bondKey(a, b);
  const bond = (P.bonds[k] ??= { pair: pair.id, xp: 0, lv: 1 });
  const discovered = !P.dex.chem.includes(pair.id);
  if (discovered) P.dex.chem.push(pair.id);
  bond.xp += xp;
  let levelUp: number | null = null;
  while (bond.lv < 5 && bond.xp >= C.levels[bond.lv]) {
    bond.lv++;
    levelUp = bond.lv;
    // 영웅: 그 영웅이 낀 친밀도가 오를 때마다 별 +1
    for (const h of [a, b]) starUp(h);
  }
  return { pair, a, b, discovered, levelUp };
}

function starUp(h: Actor) {
  if (!h.heroId || h.status !== 'hero') return;
  const s = h.stars ?? 1;
  if (s >= CONFIG.heroes.maxStars) return;
  h.stars = s + 1;
  const d = P.dex.heroes[h.heroId];
  if (d) d.stars = h.stars;
  uiHooks.toast(`${h.name} ★${h.stars}! 기술이 강해지고 계정 전투력이 올라요`);
}

/** 내 마을 손님들 (이웃 방문 중이어도) */
const homeActors = () => world.home?.actors ?? world.actors;

/** 같은 파티 짝의 배율: 1 + Σ(단계 × 3%) + 케미 옵션 */
export function partyChemMult(members: Actor[], chemPct = 0): number {
  let m = 1;
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++) {
      const b = bondOf(members[i], members[j]);
      if (b) m += b.lv * C.partyBonusPerLevel * (1 + chemPct / 100);
    }
  return m;
}

/** 이 손님의 짝들 (발견한 것만) */
export function bondsOf(a: Actor): { other: Actor; pair: ChemPair; lv: number }[] {
  const out: { other: Actor; pair: ChemPair; lv: number }[] = [];
  for (const [k, b] of Object.entries(P.bonds)) {
    const [x, y] = k.split('-').map(Number);
    if (x !== a.id && y !== a.id) continue;
    const other = homeActors().find((o) => o.id === (x === a.id ? y : x));
    const pair = pairById(b.pair);
    if (other && pair && P.dex.chem.includes(pair.id)) out.push({ other, pair, lv: b.lv });
  }
  return out;
}

/** 떠난 손님과의 친밀도는 지운다 (단골·영웅끼리만 남는다) */
export function pruneBonds() {
  const ids = new Set(homeActors().map((a) => a.id));
  for (const k of Object.keys(P.bonds)) {
    const [x, y] = k.split('-').map(Number);
    if (!ids.has(x) || !ids.has(y)) delete P.bonds[k];
  }
}
