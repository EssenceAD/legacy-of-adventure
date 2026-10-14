// GOLDSINK §5: 마을 부탁 — 하루 3개(한국 시간 0시) · 3개 다 하면 보너스 상자 · 주 15개면 모모의 감사 편지
//  진행은 있는 기록(카운터)의 「받았을 때 값 → 지금 값」 차이로 센다
import { BOSSES } from '../data/bosses';
import { CONFIG } from '../data/config';
import { REGIONS, type RegionId } from '../data/items';
import { openDrops, ownedDrops } from './decodrop';
import { fLv } from './facilities';
import { caughtTotal } from './fishing';
import { addBlessMin, bossKilled, gsState, kstDay, mR, topRegion } from './goldsink';
import { addCharm, addWhet, brag } from './growth';
import { feature } from './guide';
import { huntRegionOpen } from './hunt';
import { addMail } from './meta';
import { addTie, tieAvailable } from './owner';
import { markDirty, P, S, world, type Favor } from './state';
import { bestOf } from './town';
import { dbCount } from './hvLite';

const F = () => CONFIG.goldsink.favor;
const homeObjs = () => world.home?.objs ?? world.objs;
const has = (k: string) => !!bestOf(k as never, homeObjs(), true);
const regulars = () => (world.home?.actors ?? world.actors).filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).length;
const sumWins = () => Object.values(P.counters.regionWins).reduce((s, v) => s + (v ?? 0), 0);
const cnt = (k: string) => gsState().cnt[k] ?? 0;
/** 가장 먼 지역의 보스 (재료 보상) — 처치한 보스 중 */
const topBoss = () => [...BOSSES].reverse().find((b) => bossKilled(b.id)) ?? null;
const topMatRegion = () => REGIONS[topRegion()];

export interface FavorDef {
  id: string;
  text: string;
  target: number;
  cur: () => number;
  can: () => boolean;
  /** 아직 한 번도 안 해 본 시스템 (먼저 나온다) */
  fresh?: () => boolean;
  reward: () => string;
  give: () => void;
}
const shardsGive = (n: number) => {
  P.hunt.shards += n;
  while (P.hunt.shards >= CONFIG.hunt.shardsPerToken) {
    P.hunt.shards -= CONFIG.hunt.shardsPerToken;
    P.tokens++;
  }
};
/** 가장 가까운 인연 (수치가 가장 높은, 아직 100이 아닌) */
const closestTie = () =>
  Object.entries(P.ties)
    .filter(([id, t]) => t.pts < 100 && tieAvailable(id))
    .sort((a, b) => b[1].pts - a[1].pts)[0]?.[0] ?? null;
const newDeco = () => openDrops().find((k) => !ownedDrops().includes(k)) ?? null;

export const FAVORS: FavorDef[] = [
  {
    id: 'fish', text: '연못이나 바다에서 물고기 3마리 낚기', target: 3, cur: caughtTotal,
    can: () => has('koi_pond') || has('lily_pond') || huntRegionOpen(5), fresh: () => caughtTotal() === 0,
    reward: () => `잿빛 가루 ×${(topRegion() + 1) * 10}`, give: () => void (P.dust.n += (topRegion() + 1) * 10),
  },
  {
    id: 'gift', text: '단골 한 명에게 선물하기', target: 1, cur: () => P.counters.giftsGiven,
    can: () => !!P.owner && regulars() > 0, fresh: () => P.counters.giftsGiven === 0,
    reward: () => '인연의 증표 조각 3', give: () => shardsGive(3),
  },
  {
    id: 'smith', text: '장비 강화·초월·재련 3번', target: 3, cur: () => cnt('smith'),
    can: () => has('smith') && P.bag.length > 0, reward: () => '행운의 숫돌 1', give: () => addWhet(1),
  },
  {
    id: 'conv', text: '연금술 공방에서 변환 한 번', target: 1, cur: () => cnt('conv'),
    can: () => fLv('alchemy') > 0, reward: () => `${topMatRegion().mat} 10`, give: () => void (P.mats[topMatRegion().id as RegionId] += 10),
  },
  {
    id: 'bless', text: '예배당에서 축복 받기', target: 1, cur: () => cnt('bless'),
    can: () => fLv('chapel') > 0, reward: () => `축복 ${F().blessMin}분 연장`, give: () => addBlessMin(F().blessMin),
  },
  {
    id: 'exp', text: '원정 3번 성공', target: 3, cur: sumWins,
    can: () => regulars() > 0, reward: () => '희귀 가루 ×10', give: () => void (P.dust.r += 10),
  },
  {
    id: 'boss', text: '지역 보스(x-10) 한 번 잡기', target: 1, cur: () => cnt('hboss'),
    can: () => REGIONS.some((r) => (P.hunt.best[r.id] ?? 0) >= CONFIG.hunt.stages), reward: () => `${topBoss()?.mat ?? '보스 재료'} 1`,
    give: () => {
      const b = topBoss();
      if (b) P.bossMats[b.id] = (P.bossMats[b.id] ?? 0) + 1;
    },
  },
  {
    id: 'raid', text: '주간 토벌 한 번 도전', target: 1, cur: () => P.counters.raidTries,
    can: () => feature('raid'), reward: () => '인연의 증표 조각 3', give: () => shardsGive(3),
  },
  {
    id: 'like', text: '이웃 마을 2곳에 좋아요', target: 2, cur: () => cnt('likes'),
    can: () => true, reward: () => (newDeco() ? '꾸미기 장식 하나 (우편함)' : '잿빛 가루 ×30'),
    give: () => {
      const k = newDeco();
      if (k) addMail({ from: 'system', title: '마을 부탁 보답', body: '이웃 마을에 인사해 주셔서 고마워요! 마을 사람들이 장식을 하나 보냈어요.', reward: { deco: k } });
      else P.dust.n += 30;
    },
  },
  {
    id: 'meal', text: '주점에서 손님 10번 식사', target: 10, cur: () => P.counters.tavernMeals,
    can: () => has('tavern'), reward: () => '오늘 주점 수입 +10%', give: () => void (gsState().tavernDay = kstDay()),
  },
  {
    id: 'harvest', text: '텃밭 수확 2번', target: 2, cur: () => P.counters.harvests,
    can: () => has('garden'), reward: () => '미끼 3', give: () => void (P.growth.fish.extra += 3),
  },
  {
    id: 'talk', text: '손님에게 말 걸기 5번', target: 5, cur: () => P.counters.guestTalks,
    can: () => true, reward: () => (closestTie() ? '가장 가까운 인연 게이지 조금' : '인연의 증표 조각 2'),
    give: () => {
      const id = closestTie();
      if (id) addTie(id, 3);
      else shardsGive(2);
    },
  },
];
export const favorDef = (id: string) => FAVORS.find((f) => f.id === id);

const shuffle = <T>(a: T[], rng: () => number) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
/** 오늘 부탁 뽑기: 할 수 있는 것만 · 안 해 본 시스템(낚시·선물)이 먼저 */
export function rollFavors(rng: () => number = Math.random, avoid: string[] = []): FavorDef[] {
  const can = FAVORS.filter((f) => f.can() && !avoid.includes(f.id));
  const fresh = shuffle(can.filter((f) => f.fresh?.()), rng);
  const rest = shuffle(can.filter((f) => !f.fresh?.()), rng);
  return [...fresh, ...rest].slice(0, F().perDay);
}
const mk = (d: FavorDef): Favor => ({ id: d.id, base: d.cur(), target: d.target, claimed: false });
/** 오늘 부탁 (없으면 뽑는다) */
export function ensureFavors(now = Date.now()): Favor[] {
  const g = gsState(now);
  if (!g.favors.length && !S.visiting) {
    g.favors = rollFavors().map(mk);
    markDirty();
  }
  return g.favors;
}
export const favorProg = (f: Favor) => Math.max(0, Math.min(f.target, (favorDef(f.id)?.cur() ?? 0) - f.base));
export const favorDone = (f: Favor) => favorProg(f) >= f.target;

/** 바꾸기 값: 하루 무료 1번 → 그 뒤 base × m × 2^(n−1) */
export const swapCost = (n = gsState().swaps) => (n < F().swapFree ? 0 : Math.round(F().swapBase * mR() * 2 ** (n - F().swapFree)));
export function swapFavor(i: number, rng: () => number = Math.random): string | null {
  const g = gsState();
  const f = g.favors[i];
  if (!f || f.claimed) return '바꿀 수 없어요';
  const nx = rollFavors(rng, g.favors.map((x) => x.id))[0];
  if (!nx) return '바꿀 부탁이 없어요';
  const c = swapCost(g.swaps);
  if (S.gold < c) return '금화가 모자라요';
  S.gold -= c;
  g.swaps++;
  g.favors[i] = mk(nx);
  markDirty();
  return null;
}
export interface FavorClaim {
  reward: string;
  letter: boolean;
}
export function claimFavor(i: number): FavorClaim | null {
  const g = gsState();
  const f = g.favors[i];
  const d = f && favorDef(f.id);
  if (!f || !d || f.claimed || !favorDone(f)) return null;
  f.claimed = true;
  d.give();
  g.weekN++;
  // CHECKIN §D1: 오늘의 장부 「마을 부탁 1개」
  dbCount('favor');
  let letter = false;
  if (g.weekN >= F().weekGoal && !g.letter) {
    g.letter = true;
    letter = true;
    weeklyLetter();
  }
  markDirty();
  return { reward: d.reward(), letter };
}
/** 주간 감사 편지: 보스 재료 3 · 인연의 증표 1 (우편함) · [알림] 자랑 */
function weeklyLetter() {
  const b = [...BOSSES].reverse().find((x) => bossKilled(x.id));
  if (b) P.bossMats[b.id] = (P.bossMats[b.id] ?? 0) + F().weekBossMats;
  addMail({
    from: 'system',
    title: '마을 감사 편지',
    body: `이번 주 마을 부탁 ${F().weekGoal}개를 다 들어주셨다고 마을 사람들이 감사 편지를 보냈어요.${b ? ` ${b.mat} ${F().weekBossMats}개도 같이 넣었어요 (가방에 바로 넣었어요).` : ''} …모모도 같이 썼어요!`,
    reward: { tokens: F().weekTokens },
  });
  brag('weekly');
}
export const boxReady = () => {
  const g = gsState();
  return !g.box && g.favors.length >= F().perDay && g.favors.every((f) => f.claimed);
};
/** 보너스 상자: 보호 부적 1 또는 「다음 지역 보스 고유 장비 확률 ×2」 1번 */
export function claimBox(rng: () => number = Math.random): string | null {
  if (!boxReady()) return null;
  const g = gsState();
  g.box = true;
  markDirty();
  if (rng() < 0.5) {
    addCharm(1);
    return '보호 부적 1';
  }
  g.uniqueBoost++;
  return `고유 장비 조각 — 다음 지역 보스(x-10) 고유 장비 확률 ×${F().uniqueMult}`;
}
/** 지역 보스 고유 장비 굴림 때: 상자 효과가 있으면 한 번 쓰고 배수 */
export function takeUniqueBoost(): number {
  const g = gsState();
  if (g.uniqueBoost <= 0) return 1;
  g.uniqueBoost--;
  markDirty();
  return F().uniqueMult;
}
