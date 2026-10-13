// 원정: 의뢰 목록(매일 아침 갱신) → 파티 출발 → (현실 시간으로) 진행 → 결과·보고서·전리품
import { flag } from './flags';
import { vis } from './visual';
import { bestOf, nextLevelCost } from './town';
import { markAdventured } from './actors';
import { mythicAtk, mythicQuestGold, mythicTimeCut } from './mythic';
import { pioneerExpCut, useExpCoupon } from './easter';
import { funnel } from '../net/funnel';
import { BOSSES } from '../data/bosses';
import { buffOf, guildGold, guildSlot, guildSpecial, stableTimeCut } from './facilities';
import { CONFIG } from '../data/config';
import { hfx } from './harmony';
import { fillNames, josa } from '../data/josa';
import { hourNow } from './clock';
import { maybeWander } from './raid';
import { pairById } from '../data/chem';
import { REGIONS, BASE_REGIONS, GRADE_INFO, SLOT_NAME, regionById, type RegionId } from '../data/items';
import { newRegionOpen } from './regions2';
import { CHEM_EVENT, CLASS_EVENT, FAIL_LINES, LOOT_LINES, REGION_OPEN, RUN_BEATS, RUN_COMMON, WIN_LINES } from '../data/reports';
import type { GuestKind } from '../data/classes';
import { gainXp, powerOf, xpToNext } from './adventurers';
import { roleHpMult, roleMult, rollTag, tagGoldMult, xpMultIn } from './party';
import { expHpCut, hunterRegionPct, hunterTimeCut, partySynMult, recordSynergies, synergyFx } from './synergy';
import { addBond, bondOf, pairOf, partyChemMult, type BondGain } from './chem';
import { addToBag, equippedItems, itemPower, makeItem, optSum, rollGrade, TEST } from './items';
import { addRep, dexBonus, ITEM_DEX_TOTAL, stars, today, track } from './progress';
import { gotGold, legendHooks, P, S, pick, world, type Actor, type Quest, type Run, type RunResult } from './state';
import { expTimeCut, ownerGain, questGoldMult, tieRun } from './owner';
import { addCharm, mealGold } from './growth';
import { partySpecial, rollUniqueAny } from './uniques';
import { windQuestGold } from './wind';
import { blessFx, payRefresh } from './goldsink';

const E = CONFIG.expedition;
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const ri = (r: RegionId) => REGIONS.findIndex((x) => x.id === r);
const homeActors = () => world.home?.actors ?? world.actors;
const homeObjs = () => world.home?.objs ?? world.objs;

// ───────── 의뢰 ─────────

/** 지역 i가 열렸나: 앞 지역 3번 성공 또는 평판 ★(i+1) */
export function regionUnlocked(i: number): boolean {
  if (i === 0) return true;
  // REGIONS2: 6~10은 사냥과 같은 조건 (평판 ★·의뢰 성공으로는 안 열린다)
  if (i >= BASE_REGIONS) return newRegionOpen(i);
  // 5단계: 앞 지역 사냥 보스(x-10)를 깨도 열린다
  return (P.counters.regionWins[REGIONS[i - 1].id] ?? 0) >= 3 || stars() >= i + 1 || (P.hunt.best[REGIONS[i - 1].id] ?? 0) >= CONFIG.hunt.stages;
}

export function makeQuest(region: RegionId, tier: number): Quest {
  const r = ri(region);
  return {
    id: P.quests.nextId++,
    region,
    tier,
    power: Math.round(E.basePower * Math.pow(E.regionPower, r) * E.tierPower[tier]),
    // GROWTH §1: 시간은 단계마다 고정 (지역 배수 없음)
    minutes: E.tierMinutes[tier],
    gold: [
      Math.round(E.baseGold[0] * E.tierReward[tier] * Math.pow(CONFIG.economy.regionReward, r)),
      Math.round(E.baseGold[1] * E.tierReward[tier] * Math.pow(CONFIG.economy.regionReward, r)),
    ],
  };
}

/** 새 게임 첫 원정: 30초 「숲 입구 정찰」 (늘 성공, 희귀 장비 확정) */
export function tutorialQuest(): Quest {
  const T = E.tutorial;
  return { id: P.quests.nextId++, region: 'forest', tier: 0, power: T.power, minutes: T.minutes, gold: [...T.gold], tutorial: true, name: T.name };
}

/** 게시판엔 늘 1분짜리 의뢰가 하나는 있다 (짧게 자주 보내는 재미) */
function ensureQuick(list: Quest[]) {
  if (!list.some((q) => q.minutes <= E.quickMinutes)) list.unshift(makeQuest('forest', 0));
}

/** 짧은 의뢰는 1명만 보내도 된다 */
export const partyMinFor = (q: Quest) => (q.tier === 0 ? E.partyMinShort : E.partyMin);

/** GROWTH §1: 단계에 맞는 지역 — 가장 높은 열린 지역이 모든 단계에 나온다 (1분·10분은 최고 지역 −1까지) */
function regionFor(open: (typeof REGIONS)[number][], tier: number, top: boolean) {
  const max = tier <= 1 && open.length > 1 ? open.length - 2 : open.length - 1;
  const i = top ? max : Math.min(max, Math.floor(Math.pow(Math.random(), 0.7) * (max + 1)));
  return open[i];
}
function rollTier(): number {
  let t = Math.random();
  for (let i = 0; i < E.tierWeights.length; i++) if ((t -= E.tierWeights[i]) < 0) return i;
  return 0;
}
function rollQuests(): Quest[] {
  const open = REGIONS.filter((_, i) => regionUnlocked(i));
  const n = rnd(E.questsMin, E.questsMax);
  const list: Quest[] = [];
  // 새 게임 첫 원정은 「숲 입구 정찰」 30초
  if (P.counters.expeditions === 0) list.push(tutorialQuest());
  // 짧은 · 중간 · 긴 하나씩 (긴 것은 늘 가장 높은 지역)
  E.tierGroups.forEach((g, gi) => {
    // 보장 칸은 짧은 쪽에 무게 (긴 칸: 2시간 > 4시간 > 8시간)
    const w = E.groupWeights[gi];
    let t = Math.random() * w.reduce((a, b) => a + b, 0);
    let k = 0;
    while (k < g.length - 1 && (t -= w[k]) >= 0) k++;
    const tier = g[k];
    list.push(makeQuest(regionFor(open, tier, false).id, tier));
    void gi;
  });
  while (list.length < n) {
    const tier = rollTier();
    list.push(makeQuest(regionFor(open, tier, false).id, tier));
  }
  ensureQuick(list);
  // 핫픽스 12 §2-4: 하루 1~2개 의뢰에 조건 태그 (튜토리얼·1분 의뢰 제외)
  const [t0, t1] = CONFIG.party.tagsPerDay;
  const nTags = t0 + Math.floor(Math.random() * (t1 - t0 + 1));
  const can = list.filter((q) => !q.tutorial && q.minutes > E.quickMinutes);
  for (let i = 0; i < nTags && can.length; i++) can.splice(Math.floor(Math.random() * can.length), 1)[0].tag = rollTag();
  return list;
}

/** 매일(현실 날짜) 아침 갱신 */
export function ensureQuests() {
  migrateTiers();
  if (P.quests.day === today()) return ensureQuick(P.quests.list);
  P.quests.day = today();
  P.quests.refreshUsed = 0;
  P.quests.list = rollQuests();
  // BUILDINGS_SPEC: 길드 Lv5 — 하루 1번 「길드 특별 의뢰」 (보스 재료)
  if (guildSpecial()) {
    const open = REGIONS.filter((_, i) => regionUnlocked(i));
    const q = makeQuest(open[open.length - 1].id, 3);
    q.guild = true;
    q.name = '길드 특별 의뢰';
    P.quests.list.unshift(q);
  }
}

/** 새로고침: 하루 무료 1번 → GOLDSINK §1 그 뒤는 금화로 (진행 중인 원정은 그대로, 안 받은 의뢰만 바뀐다) */
export function refreshQuests(): false | 'free' | 'paid' {
  ensureQuests();
  let kind: 'free' | 'paid' = 'free';
  if (P.quests.refreshUsed >= E.freeRefreshPerDay) {
    if (!payRefresh()) return false;
    kind = 'paid';
  } else P.quests.refreshUsed++;
  P.quests.list = rollQuests();
  return kind;
}

// ───────── 파티 ─────────

export const boardLevel = () => bestOf('board', homeObjs(), true)?.lvl ?? 0;
export const maxParties = () => Math.min(E.maxParties, E.partiesBase + boardLevel());
export const activeRuns = () => P.runs.filter((r) => !r.result);
/**
 * v0.25.2 §I 게시판 레벨업: 의뢰 창 맨 위 줄 · 꽉 찼을 때 안내.
 *  none = 게시판 없음 · con = 짓는 중/공사 중 · up = 올릴 수 있음 · max = 최대 (Lv.2 · 또는 옛 저장의 Lv.3 이상)
 */
export function boardState(): { o: ReturnType<typeof bestOf>; lv: number; state: 'none' | 'con' | 'up' | 'max'; cost: number | null } {
  const o = bestOf('board', homeObjs());
  const lv = boardLevel();
  if (!o) return { o, lv, state: 'none', cost: null };
  if (o.build !== undefined || o.con) return { o, lv, state: 'con', cost: null };
  const cost = nextLevelCost(o);
  if (cost == null || maxParties() >= E.maxParties) return { o, lv, state: 'max', cost: null };
  return { o, lv, state: 'up', cost };
}
/** 파티가 꽉 찼을 때 한 줄 */
export function fullPartyHint(): string {
  const b = boardState();
  if (b.state === 'none') return '게시판을 지으면 1파티 더';
  if (b.state === 'con') return '게시판 공사가 끝나면 1파티 더';
  if (b.state === 'up') return `게시판을 Lv.${b.lv + 1}로 올리면 1파티 더`;
  return `지금은 ${E.maxParties}파티가 최대예요`;
}

/** 원정에 보낼 수 있나 (단골·영웅, 체력 30 이상, 쉬는 중) */
/** v0.25.2: 방문 중인 전설 = 파티에 「동행」으로 갈 수 있다 (status 'visitor' 그대로 · 단골 수엔 안 셈) */
export const isCompanion = (a: Actor): boolean => flag('legendCompanion') && !!a.legendId && a.status === 'visitor' && P.legends?.[a.legendId]?.st === 'visit';
/** 「동행 · 방문 중 n일」 (남은 방문 시간) */
export function companionText(a: Actor): string {
  const left = Math.max(0, (P.legends[a.legendId!]?.until ?? 0) - Date.now());
  const h = Math.ceil(left / 36e5);
  return `동행 · 방문 중 ${h >= 24 ? `${Math.ceil(h / 24)}일` : `${h}시간`}`;
}
/** 파티에 낄 수 있는 사람인가 (단골 · 영웅 · 방문 중인 전설) */
export const partyEligible = (a: Actor): boolean => !a.role && (a.status === 'regular' || a.status === 'hero' || isCompanion(a));
export function canSend(a: Actor): string | null {
  if (!partyEligible(a)) return '방문 손님은 원정에 못 가요';
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
  // PARTY §1: 사냥꾼은 숲·정원 지역 피해 +10% · §2: 조합 보너스 (공격 + · 한 우물)
  const pws = members.map((m) => powerOf(m) * (1 + (optSum(m, 'regionDmg', q.region) + optSum(m, 'anyDmg')) / 100 + hunterRegionPct(m, q.region)));
  let power = pws.reduce((s, v) => s + v, 0) * partySynMult(members, pws);
  // BUILDINGS_SPEC §3: 힘의 물약
  power = Math.round(power * chem * roleMult(members) * (1 + buffOf('power')) * mythicAtk(members, q.region));
  // 4단계: 사냥꾼 출신 원정 시간 -5%
  // BUILDINGS_SPEC: 마구간 의뢰 시간 −%
  const cut = Math.min(0.5, members.reduce((s, m) => s + optSum(m, 'timeCut'), 0) / Math.max(1, members.length) / 100 + expTimeCut() - hfx('expTime') + stableTimeCut() + blessFx('expTime') + pioneerExpCut() + mythicTimeCut(members) + hunterTimeCut(members));
  return {
    power,
    chem,
    success: Math.max(E.successMin, Math.min(E.successMax, (power / q.power) * E.successScale + hfx('expSuccess'))),
    minutes: q.minutes * (1 - cut),
  };
}

/** 핫픽스 12 §3: 원정 파티 최대 인원 (폐광까지 가면 5명) */
export const partyMax = () => E.partyMax + (P.meta.slot5 ? 1 : 0) + guildSlot();
/** 5번째 자리 조건: 폐광 의뢰 3번 성공 또는 폐광 사냥터 1-10 돌파 */
export const slot5Ready = () => (P.counters.regionWins.mine ?? 0) >= 3 || (P.hunt.best.mine ?? 0) >= CONFIG.hunt.stages;

/** 출발: 의뢰는 목록에서 빠지고, 실제 걸어가는 연출은 actors.ts가 한다 */
export function sendParty(q: Quest, members: Actor[]): Run | string {
  if (activeRuns().length >= maxParties()) return vis('boardLevelUp') ? `동시에 ${maxParties()}파티까지 · ${fullPartyHint()}` : `동시에 ${maxParties()}파티까지 보낼 수 있어요 (게시판 레벨업)`;
  if (members.length < partyMinFor(q) || members.length > partyMax()) return `파티는 ${partyMinFor(q)}~${partyMax()}명이에요`;
  for (const m of members) {
    const why = canSend(m);
    if (why) return `${m.name}: ${why}`;
  }
  const info = partyInfo(members, q);
  const scale = TEST ? CONFIG.test.timeScale : 1;
  const now = Date.now();
  const run: Run = { id: P.nextRunId++, quest: q, members: members.map((m) => m.id), start: now, end: now + info.minutes * 60000 * scale };
  P.runs.push(run);
  // EASTER: 이카몰리 선물(다음 의뢰 −10%)은 한 번 쓰면 끝
  useExpCoupon();
  P.quests.list = P.quests.list.filter((x) => x.id !== q.id);
  ensureQuick(P.quests.list);
  for (const m of members) m.runId = run.id;
  // PARTY §2: 켜 본 조합 → 도감 「파티」
  recordSynergies(members);
  P.counters.expeditions++;
  funnel('first_run');
  if (q.tier === 0 && !q.tutorial) P.counters.quickRuns++;
  track('expeditionSent');
  ownerGain('expedition');
  if (ri(q.region) >= 3) ownerGain('dangerRun');
  // 전설 인연 활동: 숲 원정 · 밤(20~04시) 출발 · 오스윈과 함께
  if (q.region === 'forest') {
    P.counters.forestSends++;
    legendHooks.bond('forestRun');
  }
  const h = hourNow();
  if (h >= 20 || h < 4) legendHooks.bond('nightRun');
  if (members.some((m) => m.heroId === 'oswin')) legendHooks.bond('runWithOswin');
  return run;
}

// ───────── 결과 ─────────

const fill = (s: string, a: string, b: string, r: string, item = '') => fillNames(s, { a, b, r, item });

/** 끝난 원정의 결과를 정한다 (켜 있을 때·꺼져 있던 동안 모두) */
export function resolveRun(run: Run, bondGains: BondGain[]): RunResult {
  migrateTiers();
  const q = run.quest;
  const members = run.members.map((id) => homeActors().find((a) => a.id === id)).filter(Boolean) as Actor[];
  const info = partyInfo(members, q);
  // 첫 원정(튜토리얼)은 늘 성공
  const win = q.tutorial || Math.random() < info.success;
  const r = ri(q.region);
  const tierR = E.tierReward[q.tier];
  const tg = E.tierGrade[q.tier] ?? q.tier;
  const goldPct = members.reduce((s, m) => s + optSum(m, 'goldPct'), 0) / Math.max(1, members.length);
  // 케미 짝이 같이 가면 보상도 + (전투력 배율과 같은 비율)
  // 4단계: 주인 말솜씨 · 도적 출신 → 의뢰 금화 +
  // GROWTH: 고유 효과 「밤에 끝난 원정 금화 +15%」 · 물고기 요리 (원정 금화 +)
  const nightG = S.night ? partySpecial(members, 'nightGold') / 100 : 0;
  // PARTY §2: 조합 보너스 — 뒷골목 싸움 금화 + · 수호의 맹세 체력 소모 −
  const syn = synergyFx(members);
  const gold = Math.round(rnd(q.gold[0], q.gold[1]) * (win ? 1 : E.failReward) * (1 + goldPct / 100) * info.chem * questGoldMult() * tagGoldMult(q, members) * (1 + guildGold()) * mythicQuestGold(members, nightStart(run.start)) * (1 + nightG + mealGold()) * (1 + syn.gold) * windQuestGold());
  // MYTHIC 루나 부탁: 밤에 출발한 의뢰 성공
  if (win && nightStart(run.start)) P.counters.nightWins = (P.counters.nightWins ?? 0) + 1;
  tieRun(members);
  const xp = Math.round(E.baseXp * tierR * Math.pow(1.6, r) * (win ? 1 : 0.5));
  const levelUps: string[] = [];
  const xpMult = new Map(members.map((m) => [m, xpMultIn(m, members)]));
  for (const m of members) {
    // 핫픽스 12 §2-3: 파티 최고 레벨 −5 이하는 경험치 ×1.5 · §2-2: 탱·힐·딜이면 체력 소모 −20%
    if (gainXp(m, xp * xpMult.get(m)!)) levelUps.push(`${m.name} Lv.${m.lvl}`);
    const loss = (win ? E.winHp : E.failHp) * (1 - Math.min(0.8, optSum(m, 'hpSave') / 100)) * roleHpMult(members) * (1 - expHpCut(syn));
    m.hp = Math.max(1, Math.round(m.hp - loss));
    m.mood = Math.max(0, Math.min(100, m.mood + (win ? 10 : -10)));
  }
  markAdventured(members);
  const mats = Math.round(rnd(E.mats[0], E.mats[1]) * (1 + tg) * (win ? 1 : 0.5)) + (win ? partySpecial(members, 'matPlus') : 0);
  P.mats[q.region] += mats;
  const nItems = win ? 1 + (tg >= 2 ? 1 : 0) : Math.random() < 0.5 ? 1 : 0;
  const items = [];
  for (let i = 0; i < nItems; i++) {
    // 첫 원정은 희귀 장비 확정 (바로 끼워서 전투력이 오르는 걸 보여 준다)
    const it = makeItem(q.region, q.tutorial ? 'r' : rollGrade(q.region, tg));
    addToBag(it);
    items.push(it);
  }
  S.gold += gold;
  S.ledger.dungeon += gold;
  gotGold(gold, 'quest');
  // 3단계: 보물·유물 · 인연의 증표 · 은밀 · 루나의 보물 상자 · 8시간 원정 · 떠돌이 보스
  const extra: [string, string, string?][] = [];
  if (items.some((it) => 'ela'.includes(it.grade))) legendHooks.bond('treasure');
  if (items.some((it) => it.grade === 'a')) P.counters.relicEver = 1;
  if (Math.random() < CONFIG.legends.tokenRunChance) {
    P.tokens++;
    extra.push(['narr', '보물 더미 속에서 「인연의 증표」가 반짝였다!']);
  }
  const rogue = members.find((m) => m.kind === 'rogue');
  // 은밀: 도적이 있으면 30% · 닉스 본인이 함께면 60%
  const stealth = members.some((m) => m.legendId === 'nyx') ? CONFIG.legends.stealthNyx : CONFIG.legends.stealth;
  if (rogue && Math.random() < stealth) {
    extra.push(['narr', win ? `${rogue.name}${josa(rogue.name, '가')} 그림자처럼 숨어들어 경비를 따돌렸다! (은밀 성공)` : `${rogue.name}${josa(rogue.name, '가')} 몰래 지나가다 깡통을 찼다… (은밀 실패)`]);
    if (win) legendHooks.req('stealthSuccess');
  }
  if (win && q.region === 'forest' && members.some((m) => m.legendId === 'luna') && Math.random() < 0.4) {
    extra.push(['legend_luna', '킁킁! 여기다! 루나가 덤불 밑에서 보물 상자를 찾아냈다!', '루나']);
    legendHooks.req('lunaTreasure');
  }
  if (win && tg >= 3) legendHooks.req('longRunWin');
  // GROWTH §3-3·§3-4: 고지역 2시간 이상 원정 → 강화 보호 부적 10% · 고지역 8시간 원정 → 고유 장비 0.3%
  const GG = CONFIG.growth;
  if (win && !q.tutorial && r >= GG.charm.highRegion && q.tier >= GG.charm.expTier && Math.random() < GG.charm.expChance) {
    addCharm(1);
    extra.push(['narr', '보물 상자 바닥에서 「강화 보호 부적」을 찾았다!']);
  }
  if (win && !q.tutorial && r >= GG.unique.expRegion && q.tier >= GG.unique.expTier) {
    const u = rollUniqueAny(q.region, GG.unique.exp);
    if (u) {
      items.push(u);
      extra.push(['narr', `전설로만 듣던 「${u.name}」${josa(u.name, '이')} 모습을 드러냈다!`]);
    }
  }
  if (win) {
    const wb = maybeWander(q.region);
    if (wb) extra.push(['narr', `돌아오는 길에 떠돌이 보스 「${wb.name}」과 마주쳤다! (24시간 동안 토벌 가능)`]);
  }
  if (win) {
    P.counters.regionWins[q.region] = (P.counters.regionWins[q.region] ?? 0) + 1;
    if (q.guild) {
      const bid = BOSSES.find((b) => b.region === q.region)!.id;
      P.bossMats[bid] = (P.bossMats[bid] ?? 0) + CONFIG.newBuildings.guild.specialBossMats;
      extra.push(['narr', `길드 특별 의뢰 성공! 「${BOSSES.find((b) => b.region === q.region)!.mat}」 ×${CONFIG.newBuildings.guild.specialBossMats}`]);
    }
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
  const chemUps = bondGains.filter((g) => g.levelUp).map((g) => `♥ ${g.pair.name} ${g.levelUp}단계`);
  const result: RunResult = { win, gold, xp, mats, items, report: [...buildReport(members, q.region, win, items), ...extra], levelUps, newChem, chemUps };
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
  // 핫픽스 9: 「○○가 …했다」는 그 사람의 대사가 아니라 서술 — narr
  // PARTY §1: 사냥꾼은 아직 직업 사건 문장이 없다 → 건너뜀
  if (CLASS_EVENT[c.kind as GuestKind]) lines.push(['narr', fill(pick(CLASS_EVENT[c.kind as GuestKind]!), c.name, b.name, reg)]);
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

// ───────── 원정 진행 일지 (실시간으로 한 줄씩) ─────────

/** 원정마다 같은 일지가 나오게: 원정 번호로 정해지는 난수 */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LogLine {
  /** 출발 뒤 몇 초 */
  at: number;
  text: string;
}

/** 지금까지 쌓인 일지 (최근 max줄). 10~20초마다 한 줄, 보고서 조각을 다시 쓴다 */
export function runLog(run: Run, now = Date.now(), max = 40): LogLine[] {
  const rand = seeded(run.id * 7919 + (run.start % 100000));
  const pk = <T>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
  const ms = run.members.map((id) => homeActors().find((a) => a.id === id)).filter(Boolean) as Actor[];
  const names = ms.length ? ms.map((m) => m.name) : ['파티'];
  const reg = regionById(run.quest.region).name;
  const total = (run.end - run.start) / 1000;
  const el = Math.min(total, (now - run.start) / 1000);
  const out: LogLine[] = [{ at: 0, text: fill('{a}가 앞장서 출발했다!', names[0], names[1] ?? names[0], reg) }];
  let t = 0;
  const [g0, g1] = E.logGap;
  // 짧은 원정은 간격을 줄여 끝나기 전에 몇 줄은 보이게
  const scale = Math.min(1, total / 60);
  for (;;) {
    t += (g0 + rand() * (g1 - g0)) * Math.max(0.4, scale);
    if (t >= total - 1 || t > el) break;
    const a = pk(names);
    const b = pk(names.filter((n) => n !== a)) ?? a;
    const r = rand();
    const m = pk(ms);
    // 첫 줄은 늘 도착 (RUN_BEATS[지역][0]), 그다음은 지역·공통·직업 사건 섞어서
    const beats = RUN_BEATS[run.quest.region];
    const s = out.length === 1 ? beats[0] : r < 0.55 ? pk(beats.slice(1)) : r < 0.8 || !m || !CLASS_EVENT[m.kind as GuestKind] ? pk(RUN_COMMON) : pk(CLASS_EVENT[m.kind as GuestKind]!).replace('{a}', '{m}');
    out.push({ at: t, text: fillNames(s, { a, b, r: reg, m: m?.name ?? a }) });
  }
  if (el >= total) out.push({ at: total, text: '임무 끝! 마을로 돌아가는 중…' });
  return out.slice(-max);
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
  if (extra && members.length < partyMax()) tips.push({ text: `${extra.name}도 파티에 넣기 +${powerOf(extra)}`, gain: powerOf(extra) });
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

/** 밤(20~04시)에 출발했나 */
function nightStart(t: number): boolean {
  const h = new Date(t).getHours();
  return h >= 20 || h < 4;
}

/** GROWTH §1: 옛 4단계 저장의 게시판·진행 중 의뢰를 7단계 번호로 (한 번만 · 시간·금화는 그대로) */
export function migrateTiers() {
  if (P.quests.t7) return;
  const map = E.oldTierMap;
  for (const q of P.quests.list) if (!q.tutorial) q.tier = map[q.tier] ?? q.tier;
  for (const r of P.runs) if (!r.quest.tutorial) r.quest.tier = map[r.quest.tier] ?? r.quest.tier;
  P.quests.t7 = true;
}

// ───────── v0.25.4 K6 [다시 보내기] (resendRun) ─────────
/**
 * 끝난 원정을 같은 파티로 한 번 더: 의뢰는 게시판에서 고른다 (보낸 의뢰는 목록에서 빠졌으니)
 *  1) 같은 지역 · 같은 길이 → 2) 같은 길이 · 가까운 지역 → 3) 같은 지역 · 가까운 길이 — 튜토리얼·길드 특별 의뢰는 안 고름
 *  못 보내면 이유 한 줄 (의뢰 없음 · 파티 꽉 참 · 파티원 체력/떠남 …)
 */
export function pickResendQuest(prev: Pick<Quest, 'region' | 'tier'>, list: Quest[]): Quest | null {
  const ok = list.filter((q) => !q.tutorial && !q.guild);
  const rd = (q: Quest) => Math.abs(ri(q.region) - ri(prev.region));
  const score = (q: Quest) => (q.region === prev.region && q.tier === prev.tier ? 0 : q.tier === prev.tier ? 1 + rd(q) / 100 : q.region === prev.region ? 2 + Math.abs(q.tier - prev.tier) / 100 : Infinity);
  let best: Quest | null = null;
  for (const q of ok) if (Number.isFinite(score(q)) && (!best || score(q) < score(best))) best = q;
  return best;
}
export type ResendPlan = { q: Quest; members: Actor[]; same: boolean } | { why: string };
export function resendPlan(run: Run): ResendPlan {
  if (run.quest.tutorial) return { why: '첫 원정은 한 번뿐이에요' };
  const members = run.members.map((id) => homeActors().find((a) => a.id === id));
  if (members.some((m) => !m)) return { why: '함께 갔던 사람 중 마을에 없는 사람이 있어요' };
  const ms = members as Actor[];
  // 지금 이 원정은 아직 「끝남」(result) — 자리 수에는 안 들어간다
  if (activeRuns().length >= maxParties()) return { why: `파티가 꽉 찼어요 · ${fullPartyHint()}` };
  for (const m of ms) {
    const why = canSend(m);
    if (why) return { why: `${m.name}: ${why}` };
  }
  ensureQuests();
  const q = pickResendQuest(run.quest, P.quests.list);
  if (!q) return { why: '게시판에 같은 지역·같은 길이 의뢰가 없어요 · 새로고침하거나 내일 새 의뢰를 기다려요' };
  if (ms.length < partyMinFor(q) || ms.length > partyMax()) return { why: `이 의뢰는 파티 ${partyMinFor(q)}~${partyMax()}명이에요` };
  return { q, members: ms, same: q.region === run.quest.region && q.tier === run.quest.tier };
}
