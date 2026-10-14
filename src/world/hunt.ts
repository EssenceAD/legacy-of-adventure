// 5단계 2장: 사냥 — 지역별 10스테이지(x-10 = 지역 보스). 파밍 → 강해짐 → 다음 스테이지
// 깬 스테이지는 자동 사냥으로 반복, 꺼져 있어도 가장 높은 스테이지 기준 방치 보상(방치 상한 안에서, 원정과 합산)
import { partyEligible } from './expeditions';
import { mythicHuntWin } from './mythic';
import { BOSSES } from '../data/bosses';
import { buffOf } from './facilities';
import { CONFIG } from '../data/config';
import { REGIONS, type Grade, type RegionId } from '../data/items';
import { gainXp, powerOf } from './adventurers';
import { roleMult, xpMultIn } from './party';
import { partyChemMult } from './chem';
import { feature } from './guide';
import { addRep } from './progress';
import { addToBag, makeItem, rollGrade } from './items';
import { gotGold, legendHooks, markDirty, P, S, uiHooks, world, type Actor, type Item } from './state';
import { huntUniqueChance, huntUniqueGot } from './paceGates';
import { track } from '../net/telemetry';
import { newRegionOpen } from './regions2';
import { BASE_REGIONS } from '../data/items';
import { partySpecial, rollUnique } from './uniques';
import { partySynMult, synergyFx } from './synergy';
import { autoGoldMult, blessFx, gsState } from './goldsink';
import { takeUniqueBoost } from './favors';
import { fsay } from './visual';

const H = CONFIG.hunt;
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export const regionIdx = (r: string) => REGIONS.findIndex((x) => x.id === r);
const homeActors = () => world.home?.actors ?? world.actors;

/** 지역마다 몬스터 그림 (assets/monsters/mob_*.png, 왼쪽을 봄) */
export const MOBS: Record<RegionId, string[]> = {
  forest: ['slime', 'wolf', 'goblin'],
  swamp: ['mushimp', 'frog'],
  mine: ['bat', 'kobold'],
  ice: ['iceimp', 'snowwolf'],
  abyss: ['shadow'],
  coast: ['frog', 'slime'],
  dune: ['kobold', 'bat'],
  ember: ['iceimp', 'shadow'],
  sky: ['bat', 'iceimp'],
  deep: ['shadow'],
};
export const MOB_NAME: Record<string, string> = {
  slime: '슬라임', wolf: '늑대', goblin: '고블린', mushimp: '버섯 도깨비', frog: '늪 개구리', bat: '박쥐', kobold: '코볼트', iceimp: '얼음 도깨비', snowwolf: '눈늑대', shadow: '그림자',
};
export const regionBossOf = (r: string) => BOSSES.find((b) => b.region === r)!;
export const isBoss = (stage: number) => stage === H.stages;

/** 추천 전투력 */
export const recPower = (r: string, s: number) => Math.round(H.basePower * Math.pow(H.regionPower, regionIdx(r)) * (1 + H.stagePower * (s - 1)));
export const best = (r: string) => P.hunt.best[r] ?? 0;

/** 지역이 열렸나: 숲은 장부 1장 보상, 다음 지역은 앞 지역 x-10 돌파 */
export function huntRegionOpen(i: number): boolean {
  if (!feature('hunt')) return false;
  if (i === 0) return true;
  // REGIONS2: 6~10 (별의 심연 x-10 → 해안 … → 길잡이 별 4개 → 심연의 바닥)
  if (i >= BASE_REGIONS) return newRegionOpen(i);
  return best(REGIONS[i - 1].id) >= H.stages;
}
export const stageOpen = (r: string, s: number) => huntRegionOpen(regionIdx(r)) && s <= best(r) + 1;

/** 파티 전투력 (케미 배율 포함) */
export const partyPower = (ms: Actor[]) => {
  const pw = ms.map((m) => powerOf(m));
  // PARTY §2: 조합 보너스 (공격 + · 한 우물)
  return Math.round(pw.reduce((s, v) => s + v, 0) * partySynMult(ms, pw) * partyChemMult(ms) * roleMult(ms) * (1 + buffOf('power')));
};

/** 사냥에 갈 수 있는 손님 (단골·영웅, 원정 중 아님) */
export const huntCrew = () => homeActors().filter((a) => partyEligible(a) && !a.leaving && a.runId == null);

export interface HuntReward {
  gold: number;
  xp: number;
  mats: number;
  items: Item[];
  firstDust: number;
  shards: number;
  token: boolean;
  levelUps: string[];
  first: boolean;
  bossMats: number;
}

/** GOLDSINK §4: 자동 반복(맡겨 두기 · 방치 · 접은 판)이면 오늘 판 수를 세고 금화 비율 (첫 돌파 · 수동 판은 1) */
function taperFor(s: number, first: boolean, auto: boolean): number {
  if (!auto || first) return 1;
  if (isBoss(s) && CONFIG.goldsink.taper.exemptBossStage) return 1;
  return autoGoldMult();
}
/** 한 판 보상 (mult = 방치처럼 비율을 낮출 때 · goldMult = 자동 사냥 금화 비율) */
function reward(r: RegionId, s: number, members: Actor[], first: boolean, mult = 1, dropItem = true, goldMult = 1): HuntReward {
  const ri = regionIdx(r);
  // ECONOMY §1: 사냥 금화 ×0.65 · 지역 배수 2.0 · 재료 ×1.5
  const EC = CONFIG.economy;
  const g = Math.round(rnd(H.gold[0], H.gold[1]) * Math.pow(EC.regionReward, ri) * (1 + H.goldPerStage * (s - 1)) * (isBoss(s) ? 2 : 1) * mult * EC.huntGold * (1 + synergyFx(members).gold) * goldMult);
  // GOLDSINK §3: 축복 — 사냥 경험치 +
  const xp = Math.round(H.xp * Math.pow(1.6, ri) * (1 + 0.1 * (s - 1)) * mult * (1 + blessFx('xp')));
  // GROWTH §3-4 고유 효과 「지역 재료 +1」 (낀 사람마다)
  const mats = Math.round(rnd(H.mats[0], H.mats[1]) * (isBoss(s) ? 3 : 1) * mult * EC.matMult) + (mult >= 1 ? partySpecial(members, 'matPlus') : 0);
  S.gold += g;
  S.ledger.dungeon += g;
  gotGold(g, 'hunt');
  P.mats[r] += mats;
  // 지역 보스(x-10): 토벌 보스 재료도 (세트 제작에 필요 — 토벌이 열리기 전에도 만들 수 있게)
  let bossMats = 0;
  if (isBoss(s) && mult >= 1) {
    bossMats = first ? 3 : 1 + EC.bossRepeat;
    const bid = regionBossOf(r).id;
    P.bossMats[bid] = (P.bossMats[bid] ?? 0) + bossMats;
  }
  const levelUps: string[] = [];
  // 핫픽스 12 §2-3: 멘토 경험치 (레벨이 오르기 전에 잡아 둔다)
  const xpMult = new Map(members.map((m) => [m, xpMultIn(m, members)]));
  for (const m of members) if (gainXp(m, xp * xpMult.get(m)!)) levelUps.push(`${m.name} Lv.${m.lvl}`);
  const items: Item[] = [];
  if (dropItem && (isBoss(s) || Math.random() < H.dropChance * (1 + buffOf('luck') + blessFx('drop')))) {
    // 원정과 같은 등급표 · 같은 천장(지역별)
    const it = makeItem(r, rollGrade(r, isBoss(s) ? 1 : 0));
    if (addToBag(it) === 'ok') items.push(it);
  }
  let firstDust = 0;
  let shards = 0;
  let token = false;
  if (first) {
    // 첫 돌파는 평판도 조금 (사냥이 별·땅 넓히기로 이어지게)
    addRep(isBoss(s) ? H.firstRepBoss : H.firstRep);
    firstDust = H.firstDust * (ri + 1) * (isBoss(s) ? 3 : 1);
    P.dust.n += firstDust;
    shards = isBoss(s) ? H.bossShards : H.firstShards;
    P.hunt.shards += shards;
    while (P.hunt.shards >= H.shardsPerToken) {
      P.hunt.shards -= H.shardsPerToken;
      P.tokens++;
      token = true;
    }
  }
  return { gold: g, xp, mats, items, firstDust, shards, token, levelUps, first, bossMats };
}

/** 스테이지 돌파 (직접·자동 전투 한 판) · auto = 자동 반복(맡겨 두기·접은 판) — GOLDSINK §4 금화 비율 */
export function clearStage(r: RegionId, s: number, members: Actor[], mult = 1, dropItem = true, auto = false): HuntReward {
  // MYTHIC 바엘 부탁: 별의 심연 x-10을 바엘과 함께
  mythicHuntWin(r, s, members);
  const key = `${r}-${s}`;
  const first = !P.hunt.firstClear.includes(key);
  if (first) P.hunt.firstClear.push(key);
  P.hunt.best[r] = Math.max(best(r), s);
  // 숲 사냥도 숲 원정처럼 셈 (전설 루나 소문)
  if (r === 'forest') P.counters.forestSends++;
  P.counters.huntClears++;
  legendHooks.bond(r === 'forest' ? 'forestRun' : 'raidTry');
  if (isBoss(s)) gsState().cnt.hboss++;
  const out = reward(r, s, members, first, mult, dropItem, taperFor(s, first, auto));
  bossUnique(r, s, out);
  markDirty();
  return out;
}
/** GROWTH §3-4: 지역 사냥 보스(x-10) 0.5% 고유 장비 */
function bossUnique(r: RegionId, s: number, out: HuntReward) {
  if (!isBoss(s)) return;
  // GOLDSINK §5: 마을 부탁 보너스 상자 — 다음 지역 보스 한 번 고유 장비 확률 ×2
  // PACE R17: 같은 지역 x-10 n번째 처치는 확정 (paceGates)
  const u = rollUnique(r, huntUniqueChance(r, CONFIG.growth.unique.hunt * takeUniqueBoost()));
  if (u) {
    out.items.push(u);
    huntUniqueGot(r);
  }
}
/** 소탕: 깬 스테이지만 · 전투 없이 기본 70% · 첫 돌파 보상 없음 */
export function sweepStage(r: RegionId, s: number, members: Actor[]): HuntReward | null {
  if (s > best(r)) return null;
  P.counters.huntClears++;
  const out = reward(r, s, members, false, CONFIG.combat.sweep);
  bossUnique(r, s, out);
  markDirty();
  return out;
}
/** 진 판: 보상의 20% (경험치는 그대로 조금) */
export function failStage(r: RegionId, s: number, members: Actor[]): HuntReward {
  const out = reward(r, s, members, false, 0.2, false);
  markDirty();
  return out;
}

// ───────── 자동 사냥 ─────────

/** 핫픽스 10 (11-2): 장부 「사냥 맡겨 두기」 — 맡겨 두기(setAuto)가 성공했을 때만 센다 (전투 안 AUTO는 그냥 기능) */
export function noteAutoUsed() {
  P.counters.huntAutoUsed++;
  markDirty();
}

export function setAuto(r: RegionId, s: number, members: Actor[]): string | null {
  if (s > best(r)) return '깬 스테이지만 자동 사냥할 수 있어요';
  if (!members.length) return '파티를 골라요';
  if (partyPower(members) < recPower(r, s) * H.autoRatio) return `전투력이 부족해요 (추천 ${recPower(r, s)})`;
  P.hunt.auto = { region: r, stage: s, members: members.map((m) => m.id), n: 0, gold: 0 };
  P.hunt.idleAt = Date.now();
  noteAutoUsed();
  track('hunt_auto_on', { region: r, stage: s, power: Math.round(partyPower(members)) });
  return null;
}
export function stopAuto(reason = 'user') {
  const a = P.hunt.auto;
  if (a) track('hunt_auto_off', { reason, region: a.region, stage: a.stage, n: a.n ?? 0, gold: a.gold ?? 0 });
  P.hunt.auto = null;
  markDirty();
}
const autoMembers = () => (P.hunt.auto ? (P.hunt.auto.members.map((id) => homeActors().find((a) => a.id === id)).filter(Boolean) as Actor[]) : []);

/** 켜 있는 동안: autoSeconds마다 한 판 (원정 나간 손님은 빠진다) */
export function autoTick(now = Date.now()): HuntReward | null {
  const a = P.hunt.auto;
  if (!a || S.visiting || !S.started) return null;
  if (now - P.hunt.idleAt < H.autoSeconds * 1000) return null;
  P.hunt.idleAt = now;
  const ms = autoMembers().filter((m) => m.runId == null);
  if (!ms.length || partyPower(ms) < recPower(a.region, a.stage) * H.autoRatio) {
    stopAuto(ms.length ? 'power' : 'party');
    uiHooks.toast(fsay('맡겨 둔 사냥이 멈췄어요 (파티가 없거나 전투력이 부족해요)', '맡아 둔 사냥을 멈췄어요 (파티가 없거나 전투력이 부족해요)'));
    return null;
  }
  const out = clearStage(a.region as RegionId, a.stage, ms, 1, true, true);
  a.n = (a.n ?? 0) + 1;
  a.gold = (a.gold ?? 0) + out.gold;
  return out;
}

export interface IdleHunt {
  clears: number;
  gold: number;
  xp: number;
  mats: number;
  items: Partial<Record<Grade, number>>;
  label: string;
}
/** 꺼져 있던 동안: 자동 사냥 중이었으면 그 스테이지, 아니면 가장 높은 스테이지 기준으로 · idleRate만큼 */
export function idleHunt(seconds: number, goldCap: number): IdleHunt | null {
  const a = P.hunt.auto;
  let r: string | null = a?.region ?? null;
  let s = a?.stage ?? 0;
  if (!r) {
    for (const reg of REGIONS) if (best(reg.id) > 0) [r, s] = [reg.id, best(reg.id)];
  }
  if (!r || !s) return null;
  const ms = a ? autoMembers() : huntCrew().sort((x, y) => powerOf(y) - powerOf(x)).slice(0, 3);
  if (!ms.length) return null;
  const clears = Math.floor((seconds / H.autoSeconds) * H.idleRate);
  if (clears < 1) return null;
  const items: Partial<Record<Grade, number>> = {};
  let gold = 0;
  let xp = 0;
  let mats = 0;
  let nItems = 0;
  for (let i = 0; i < clears; i++) {
    const out = reward(r as RegionId, s, ms, false, H.idleReward, nItems < H.idleItemsMax, taperFor(s, false, true));
    gold += out.gold;
    xp += out.xp;
    mats += out.mats;
    for (const it of out.items) {
      items[it.grade] = (items[it.grade] ?? 0) + 1;
      nItems++;
    }
  }
  // 방치 상한은 금화에만 (손님·원정 금화와 합산해서 넘지 않게): 넘친 금화는 돌려놓는다. 경험치·재료·장비는 그대로
  if (gold > goldCap) {
    const over = gold - goldCap;
    S.gold -= over;
    S.ledger.dungeon -= over;
    gold = goldCap;
  }
  P.hunt.idleAt = Date.now();
  markDirty();
  return { clears, gold, xp, mats, items, label: `${REGIONS[regionIdx(r)].name} ${regionIdx(r) + 1}-${s}` };
}
