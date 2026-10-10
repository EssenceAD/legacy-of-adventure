// 원정: 의뢰 목록(매일 아침 갱신) → 파티 출발 → (현실 시간으로) 진행 → 결과·보고서·전리품
import { CONFIG } from '../data/config';
import { fillNames, josa } from '../data/josa';
import { pairById } from '../data/chem';
import { REGIONS, GRADE_INFO, SLOT_NAME, regionById, type RegionId } from '../data/items';
import { CHEM_EVENT, CLASS_EVENT, FAIL_LINES, LOOT_LINES, REGION_OPEN, WIN_LINES } from '../data/reports';
import type { GuestKind } from '../data/classes';
import { gainXp, powerOf, xpToNext } from './adventurers';
import { addBond, bondOf, pairOf, partyChemMult, type BondGain } from './chem';
import { addToBag, equippedItems, itemPower, makeItem, optSum, rollGrade, TEST } from './items';
import { addRep, dexBonus, ITEM_DEX_TOTAL, stars, today, track } from './progress';
import { P, S, pick, world, type Actor, type Quest, type Run, type RunResult } from './state';

const E = CONFIG.expedition;
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const ri = (r: RegionId) => REGIONS.findIndex((x) => x.id === r);
const homeActors = () => world.home?.actors ?? world.actors;
const homeObjs = () => world.home?.objs ?? world.objs;

// ───────── 의뢰 ─────────

/** 지역 i가 열렸나: 앞 지역 3번 성공 또는 평판 ★(i+1) */
export function regionUnlocked(i: number): boolean {
  if (i === 0) return true;
  return (P.counters.regionWins[REGIONS[i - 1].id] ?? 0) >= 3 || stars() >= i + 1;
}

export function makeQuest(region: RegionId, tier: number): Quest {
  const r = ri(region);
  return {
    id: P.quests.nextId++,
    region,
    tier,
    power: Math.round(E.basePower * Math.pow(E.regionPower, r) * E.tierPower[tier]),
    // 지역이 오를수록 시간 ×2 (단, 한 의뢰는 8시간을 넘지 않는다)
    minutes: Math.min(E.tierMinutes[E.tierMinutes.length - 1], E.tierMinutes[tier] * Math.pow(E.regionTime, r)),
    gold: [
      Math.round(E.baseGold[0] * E.tierReward[tier] * Math.pow(E.regionReward, r)),
      Math.round(E.baseGold[1] * E.tierReward[tier] * Math.pow(E.regionReward, r)),
    ],
  };
}

function rollQuests(): Quest[] {
  const open = REGIONS.filter((_, i) => regionUnlocked(i));
  const n = rnd(E.questsMin, E.questsMax);
  const list: Quest[] = [];
  // 처음 원정은 늘 「숲 동굴 5분」부터
  if (P.counters.expeditions === 0) list.push(makeQuest('forest', 0));
  while (list.length < n) {
    const reg = open[Math.min(open.length - 1, Math.floor(Math.pow(Math.random(), 0.7) * open.length))];
    const t = Math.random();
    const tier = t < 0.35 ? 0 : t < 0.7 ? 1 : t < 0.9 ? 2 : 3;
    list.push(makeQuest(reg.id, tier));
  }
  return list;
}

/** 매일(현실 날짜) 아침 갱신 */
export function ensureQuests() {
  if (P.quests.day === today()) return;
  P.quests.day = today();
  P.quests.refreshUsed = 0;
  P.quests.list = rollQuests();
}

/** 무료 새로고침 (하루 1번) */
export function refreshQuests(): boolean {
  ensureQuests();
  if (P.quests.refreshUsed >= E.freeRefreshPerDay) return false;
  P.quests.refreshUsed++;
  P.quests.list = rollQuests();
  return true;
}

// ───────── 파티 ─────────

export const boardLevel = () => homeObjs().find((o) => o.kind === 'board' && o.build === undefined)?.lvl ?? 0;
export const maxParties = () => Math.min(E.maxParties, 1 + boardLevel());
export const activeRuns = () => P.runs.filter((r) => !r.result);

/** 원정에 보낼 수 있나 (단골·영웅, 체력 30 이상, 쉬는 중) */
export function canSend(a: Actor): string | null {
  if (a.role || (a.status !== 'regular' && a.status !== 'hero')) return '방문 손님은 원정에 못 가요';
  if (a.runId != null) return '원정 중';
  if (a.leaving) return '떠나는 중';
  if (a.hp < E.minHp) return `체력 ${E.minHp} 미만`;
  return null;
}

export interface PartyInfo {
  power: number;
  chem: number;
  success: number;
  minutes: number;
}

export function partyInfo(members: Actor[], q: Quest): PartyInfo {
  const chemPct = Math.max(0, ...members.map((m) => optSum(m, 'chemPct')));
  const chem = partyChemMult(members, chemPct);
  let power = 0;
  for (const m of members) power += powerOf(m) * (1 + optSum(m, 'regionDmg', q.region) / 100);
  power = Math.round(power * chem);
  const cut = Math.min(0.5, members.reduce((s, m) => s + optSum(m, 'timeCut'), 0) / Math.max(1, members.length) / 100);
  return {
    power,
    chem,
    success: Math.max(E.successMin, Math.min(E.successMax, (power / q.power) * E.successScale)),
    minutes: q.minutes * (1 - cut),
  };
}

/** 출발: 의뢰는 목록에서 빠지고, 실제 걸어가는 연출은 actors.ts가 한다 */
export function sendParty(q: Quest, members: Actor[]): Run | string {
  if (activeRuns().length >= maxParties()) return `동시에 ${maxParties()}파티까지 보낼 수 있어요 (게시판 레벨업)`;
  if (members.length < E.partyMin || members.length > E.partyMax) return `파티는 ${E.partyMin}~${E.partyMax}명이에요`;
  for (const m of members) {
    const why = canSend(m);
    if (why) return `${m.name}: ${why}`;
  }
  const info = partyInfo(members, q);
  const scale = TEST ? CONFIG.test.timeScale : 1;
  const now = Date.now();
  const run: Run = { id: P.nextRunId++, quest: q, members: members.map((m) => m.id), start: now, end: now + info.minutes * 60000 * scale };
  P.runs.push(run);
  P.quests.list = P.quests.list.filter((x) => x.id !== q.id);
  for (const m of members) m.runId = run.id;
  P.counters.expeditions++;
  track('expeditionSent');
  return run;
}

// ───────── 결과 ─────────

const fill = (s: string, a: string, b: string, r: string, item = '') => fillNames(s, { a, b, r, item });

/** 끝난 원정의 결과를 정한다 (켜 있을 때·꺼져 있던 동안 모두) */
export function resolveRun(run: Run, bondGains: BondGain[]): RunResult {
  const q = run.quest;
  const members = run.members.map((id) => homeActors().find((a) => a.id === id)).filter(Boolean) as Actor[];
  const info = partyInfo(members, q);
  const win = Math.random() < info.success;
  const r = ri(q.region);
  const tierR = E.tierReward[q.tier];
  const goldPct = members.reduce((s, m) => s + optSum(m, 'goldPct'), 0) / Math.max(1, members.length);
  // 케미 짝이 같이 가면 보상도 + (전투력 배율과 같은 비율)
  const gold = Math.round(rnd(q.gold[0], q.gold[1]) * (win ? 1 : E.failReward) * (1 + goldPct / 100) * info.chem);
  const xp = Math.round(E.baseXp * tierR * Math.pow(1.6, r) * (win ? 1 : 0.5));
  const levelUps: string[] = [];
  for (const m of members) {
    if (gainXp(m, xp)) levelUps.push(`${m.name} Lv.${m.lvl}`);
    const loss = (win ? E.winHp : E.failHp) * (1 - Math.min(0.8, optSum(m, 'hpSave') / 100));
    m.hp = Math.max(1, Math.round(m.hp - loss));
    m.mood = Math.max(0, Math.min(100, m.mood + (win ? 10 : -10)));
  }
  const mats = Math.round(rnd(E.mats[0], E.mats[1]) * (1 + q.tier) * (win ? 1 : 0.5));
  P.mats[q.region] += mats;
  const nItems = win ? 1 + (q.tier >= 2 ? 1 : 0) : Math.random() < 0.5 ? 1 : 0;
  const items = [];
  for (let i = 0; i < nItems; i++) {
    const it = makeItem(q.region, rollGrade(q.region, q.tier));
    addToBag(it);
    items.push(it);
  }
  S.gold += gold;
  S.ledger.dungeon += gold;
  if (win) {
    P.counters.regionWins[q.region] = (P.counters.regionWins[q.region] ?? 0) + 1;
    addRep(CONFIG.reputation.expeditionWin);
    track('expeditionWin');
  }
  // 같은 파티 짝: 친밀도 + 발견
  const newChem: string[] = [];
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++) {
      const g = addBond(members[i], members[j], CONFIG.chem.expeditionXp);
      if (!g) continue;
      bondGains.push(g);
      if (g.discovered) newChem.push(g.pair.name);
    }
  const result: RunResult = { win, gold, xp, mats, items, report: buildReport(members, q.region, win, items), levelUps, newChem };
  run.result = result;
  return result;
}

/** 보고서 3~5줄: [말하는 사람(직업 키 또는 narr), 문장, 이름표] */
function buildReport(members: Actor[], region: RegionId, win: boolean, items: { name: string; grade: string }[]): [string, string, string?][] {
  const reg = regionById(region).name;
  const a = pick(members);
  const b = pick(members.filter((m) => m !== a)) ?? a;
  const lines: [string, string, string?][] = [];
  lines.push(['narr', fill(pick(REGION_OPEN[region]), a.name, b.name, reg)]);
  const c = pick(members);
  lines.push([c.heroId ? 'hero_' + c.heroId : c.kind, fill(pick(CLASS_EVENT[c.kind as GuestKind] ?? CLASS_EVENT.knight), c.name, b.name, reg), c.name]);
  // 짝이 같이 갔으면 케미 문장
  outer: for (const x of members)
    for (const y of members)
      if (x !== y && pairOf(x, y)) {
        lines.push(['narr', fill(pick(CHEM_EVENT), x.name, y.name, reg)]);
        break outer;
      }
  lines.push(['narr', pick(win ? WIN_LINES : FAIL_LINES)]);
  const best = [...items].sort((p, q) => 'naerl'.indexOf(q.grade) - 'naerl'.indexOf(p.grade))[0];
  if (best) lines.push(['narr', fill(pick(LOOT_LINES), a.name, b.name, reg, `${GRADE_INFO[best.grade as keyof typeof GRADE_INFO].name} ${best.name}`)]);
  return lines.slice(0, 5);
}

/** 끝났는데 아직 결과가 안 정해진 원정들 */
export const dueRuns = (now = Date.now()) => P.runs.filter((r) => !r.result && r.end <= now);

// ───────── 전투력 올리기 안내 ─────────

export interface Tip {
  text: string;
  gain: number;
}

/** 지금 바로 올릴 수 있는 방법 3개 (효과 큰 순서) */
export function powerTips(members: Actor[]): Tip[] {
  const tips: Tip[] = [];
  // 1) 가방의 더 좋은 장비 끼우기
  for (const m of members) {
    const before = powerOf(m);
    for (const slot of ['weapon', 'armor', 'acc'] as const) {
      const cur = equippedItems(m).find((it) => it.slot === slot);
      const best = P.bag.filter((it) => it.slot === slot && it.owner == null).sort((p, q) => itemPower(q) - itemPower(p))[0];
      if (!best || (cur && itemPower(best) <= itemPower(cur))) continue;
      const old = m.equip[slot];
      m.equip[slot] = best.id;
      const gain = powerOf(m) - before;
      m.equip[slot] = old;
      if (gain > 0) tips.push({ text: `${m.name}에게 가방의 ${GRADE_INFO[best.grade].name} ${SLOT_NAME[slot]} 「${best.name}」 끼우기 +${gain}`, gain });
    }
  }
  // 2) 레벨업: 가장 낮은 파티원이 숲 동굴 원정 몇 번이면 오르는지
  const low = [...members].sort((p, q) => p.lvl - q.lvl)[0];
  if (low && low.lvl < CONFIG.guests.maxLevel) {
    const need = xpToNext(low.lvl) - low.xp;
    const n = Math.max(1, Math.ceil(need / E.baseXp));
    const before = powerOf(low);
    low.lvl++;
    const gain = powerOf(low) - before;
    low.lvl--;
    tips.push({ text: `숲 동굴 원정 ${n}번 더 → ${low.name} 레벨업 +${gain}`, gain });
  }
  // 3) 도감: 아이템 2칸 더
  if (P.dex.items.length < ITEM_DEX_TOTAL) {
    const sum = members.reduce((s, m) => s + powerOf(m), 0);
    const pct = 2 * CONFIG.dex.itemCellPct;
    tips.push({ text: `아이템 도감 2칸 더 → 보너스 +${(pct * 100).toFixed(1)}%`, gain: Math.round((sum * pct) / (1 + dexBonus())) });
  }
  // 4) 한 명 더 데려가기
  const extra = homeActors()
    .filter((o) => !members.includes(o) && !canSend(o))
    .sort((p, q) => powerOf(q) - powerOf(p))[0];
  if (extra && members.length < E.partyMax) tips.push({ text: `${extra.name}도 파티에 넣기 +${powerOf(extra)}`, gain: powerOf(extra) });
  // 5) 케미 짝 데려가기
  for (const m of members) {
    const mate = homeActors().find((o) => o !== m && !members.includes(o) && !canSend(o) && bondOf(m, o));
    if (mate) {
      const b = bondOf(m, mate)!;
      const sum = members.reduce((s, x) => s + powerOf(x), 0);
      tips.push({ text: `${m.name}의 케미 짝 ${mate.name}${josa(mate.name, "와")} 같이 보내기 (${pairById(b.pair)?.name} ${b.lv}단계)`, gain: Math.round(sum * b.lv * CONFIG.chem.partyBonusPerLevel) });
      break;
    }
  }
  return tips.sort((p, q) => q.gain - p.gain).slice(0, 3);
}
