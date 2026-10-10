// 베타 5장: 강해지는 순간 보여 주기 — 마을 전투력(단골·영웅 합)이 1% 이상 오르면 숫자 롤링 + 이유 한 줄,
//  도감 10/25/50/75/100% · 케미 단계 · 영웅 ★ 때 큰 카드
import { CONFIG } from '../data/config';
import { HEROES } from '../data/heroes';
import { CHEM_PAIRS } from '../data/chem';
import { powerOf } from './adventurers';
import { dexBonus, heroStarBonus } from './progress';
import { codexPct } from '../net/sync';
import { P, S, world } from './state';

const team = () => (world.home?.actors ?? world.actors).filter((a) => !a.role && a.id && (a.status === 'regular' || a.status === 'hero'));
/** 마을 전투력 = 단골·영웅 전투력 합 */
export const townPower = () => team().reduce((s, a) => s + powerOf(a), 0);

function comps(): Record<string, number> {
  const t = team();
  return {
    dex: Math.round((dexBonus() + heroStarBonus()) * 1000),
    lv: t.reduce((s, a) => s + a.lvl, 0),
    gear: t.reduce((s, a) => s + (a.equip.weapon ?? 0) + (a.equip.armor ?? 0) * 7 + (a.equip.acc ?? 0) * 13, 0),
    chem: Object.values(P.bonds).reduce((s, b) => s + b.lv, 0),
    stars: Object.values(P.dex.heroes).reduce((s, h) => s + (h.recruited ? h.stars : 0), 0),
    team: t.length,
  };
}
const REASON: Record<string, string> = { dex: '도감 보너스', lv: '레벨업', gear: '장비', chem: '케미', stars: '영웅 ★', team: '새 동료' };

/** ui가 채운다 */
export const powerHooks = {
  up: (_from: number, _to: number, _why: string) => {},
  card: (_title: string, _text: string) => {},
};

const MS = [10, 25, 50, 75, 100];
let acc = 1;
export function tickPower(dt: number) {
  if (S.visiting || !S.started) return;
  acc += dt;
  if (acc < 1) return;
  acc = 0;
  const pw = P.power;
  const now = townPower();
  const c = comps();
  if (!pw.shown) {
    Object.assign(pw, { shown: now, comps: c, dexMs: MS.filter((m) => codexPct() >= m).pop() ?? 0 });
    return;
  }
  if (now >= pw.shown * 1.01 && now > pw.shown) {
    // 가장 많이 바뀐 구성 하나가 이유
    const why = (Object.keys(c) as (keyof typeof c)[]).filter((k) => c[k] > (pw.comps[k] ?? 0)).map((k) => REASON[k]);
    powerHooks.up(pw.shown, now, why.slice(0, 2).join(' · ') || '성장');
  }
  // 큰 카드: 케미 단계 · 영웅 ★
  if (c.chem > (pw.comps.chem ?? c.chem)) {
    const top = Object.values(P.bonds).sort((a, b) => b.lv - a.lv)[0];
    const pair = CHEM_PAIRS.find((p) => p.id === top?.pair);
    powerHooks.card(`케미 「${pair?.name ?? '???'}」 ${top?.lv ?? 1}단계`, `같이 원정 가면 전투력 +${Math.round((top?.lv ?? 1) * CONFIG.chem.partyBonusPerLevel * 100)}%`);
  }
  if (c.stars > (pw.comps.stars ?? c.stars)) {
    const h = HEROES.find((x) => P.dex.heroes[x.id]?.recruited && P.dex.heroes[x.id].stars > 1);
    powerHooks.card(`${h?.name ?? '영웅'} ★ 상승`, `전 영웅 전투력 +${Math.round(CONFIG.dex.heroStarPct * 100)}%`);
  }
  // 도감 단계
  const ms = MS.filter((m) => codexPct() >= m).pop() ?? 0;
  if (ms > pw.dexMs) {
    pw.dexMs = ms;
    powerHooks.card(`도감 ${ms}% 달성!`, `도감 보너스 · 전 영웅 전투력 +${Math.round(dexBonus() * 1000) / 10}%`);
  }
  pw.shown = now;
  pw.comps = c;
}

/** 사냥·토벌 준비: 지난번보다 몇 % (처음이면 null) — start에서 기록 */
export function prepDiff(key: string, power: number): number | null {
  const last = P.power.prep[key];
  if (!last) return null;
  return Math.round(((power - last) / last) * 100);
}
export const notePrep = (key: string, power: number) => (P.power.prep[key] = power);
