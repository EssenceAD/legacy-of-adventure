// 손님 상태기계: 욕구(체력·배고픔·기분)를 채우러 다닌다 · 입구로 도착/떠남 · 단골 제안 · 영웅 · 케미 · 원정 파티 걷기
import { def, INSIDE_TEXT, type Act } from '../data/catalog';
import { cycleLines, storyLines } from './story';
import { chapelHeal, passerExtraHours, takeMeal } from './facilities';
import { GUEST_KINDS, RARE_LINES, RARITY_INFO, type GuestKind } from '../data/classes';
import { CONFIG } from '../data/config';
import { josa } from '../data/josa';
import { heroById } from '../data/heroes';
import { sx, sy } from '../engine/iso';
import { blankActor, gainXp, makeAdventurer, makeHero, powerOf } from './adventurers';
import { addBond, pairOf, pruneBonds, type BondGain } from './chem';
import { orderPair } from '../data/chem';
import { chemTalk, notifyChem } from './chemNews';
import { absHours, hourNow, onNewDay } from './clock';
import { queueEvent } from './events';
import { dueRuns, resolveRun } from './expeditions';
import { bldSay, floatW, puff, puffAt, say } from './fx';
import { unequip } from './items';
import { addRep, dexAddGuest, heroCtx, heroReady, track } from './progress';
import { earn, later, legendHooks, markDirty, P, pick, S, uiHooks, world, type Actor, type Building, type Run, type TalkChoice, type TalkLine } from './state';
import { doorPose, doorWalkSeconds, hasDoor } from './doors';
import { incomeMult, moodMult, ownerGain, regularCut, tieRequestDone, trainMult } from './owner';
import { astar, blockedAt, capacity, doorOf, entrance, findKind, landBounds, layoutHooks, nearestWalkable, walkable, bestOf } from './town';
import { bfx, hfx, incMult } from './harmony';
import { dailyAdd } from './daily';

const A = CONFIG.actors;
const G = CONFIG.guests;
const NE = CONFIG.needs;
const LINES = CONFIG.lines;
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** 손님(npc 제외) — 원정 나간 사람도 포함 */
export const guestsOf = (list = world.actors) => list.filter((a) => !a.role && !a.leaving);
const homeList = () => world.home?.actors ?? world.actors;

// ───────── 처음 배치 ─────────

/** 새 게임: 노주인이 남겨 둔 단골 몇 명 + 우체부 */
export function spawnStart() {
  world.actors = [];
  const inn = findKind('inn');
  if (!inn) return;
  const d = doorOf(inn);
  const kinds: GuestKind[] = ['knight', 'cleric', 'dwarf', 'rogue', 'mage'];
  for (let i = 0; i < G.startRegulars; i++) {
    const a = makeAdventurer(d[0] + (Math.random() * 2 - 1), d[1] + Math.random(), { kind: kinds[i], rarity: 'common', lvl: 3, status: 'regular' });
    a.hp = a.food = a.mood = 80;
    dexAddGuest(a);
    world.actors.push(a);
  }
  addPostman();
}

/** 이웃 마을·타이틀 배경: 저장하지 않는 구경꾼들 */
export function spawnExtras(n = capacity()) {
  world.actors = [];
  const inn = findKind('inn');
  if (!inn) return;
  const d = doorOf(inn);
  for (let i = 0; i < n; i++) {
    const k = GUEST_KINDS[i % GUEST_KINDS.length];
    const a = blankActor(k, '손님', d[0] + (Math.random() * 2 - 1), d[1] + Math.random());
    a.race = pick(['human', 'elf', 'dwarf', 'halfling'] as const);
    world.actors.push(a);
  }
}

export function addPostman() {
  const b = findKind('well') || findKind('inn')!;
  world.actors.push(blankActor('post', '모모', b.tx + 1.2, b.ty + 1.4, 'npc'));
}

// ───────── 여관 주인 = 나 (4단계): 낮엔 손님 응대, 저녁엔 모닥불, 밤엔 다락에서 옛 장비를 바라본다 ─────────

const OWNER_DAY = ['어서 오세요!', '오늘도 잘 부탁해요.', '스튜 끓여 둘게요.', '방은 넉넉해요!', '좋은 아침이에요!', '불편한 건 없어요?'];
const OWNER_NIGHT = ['오늘도 수고했어.', '불 좀 쬐다 갈까.', '…별이 많네.', '내일은 뭘 끓이지.'];

/** 마을에 주인을 세운다 (한 명만) */
export function addOwner() {
  if (!P.owner || S.visiting || world.actors.some((a) => a.role === 'owner')) return;
  const inn = findKind('inn');
  if (!inn) return;
  const d = doorOf(inn);
  world.actors.push(blankActor('hero', P.owner.name, d[0] + 0.5, d[1] + 0.3, 'owner'));
}
/** 주인이 바뀌었을 때 (유산을 이음) */
export function refreshOwner() {
  world.actors = world.actors.filter((a) => a.role !== 'owner');
  addOwner();
}

function ownerChoose(a: Actor) {
  const inn = findKind('inn');
  const fire = ready().find((o) => o.kind === 'fire');
  const r = Math.random();
  if (S.night) {
    if (fire && r < 0.45) {
      const side = r < 0.22 ? -1 : 1;
      return goTo(a, clampN(fire.tx + side), clampN(fire.ty + 1), () => {
        a.st = 'sit';
        a.dir = a.x < fire.tx + 0.5 ? 1 : -1;
        a.t = 8 + Math.random() * 6;
        if (Math.random() < 0.4) say(a, pick(OWNER_NIGHT), 0.5);
      });
    }
    if (inn) {
      const [dx, dy] = doorOf(inn);
      return goTo(a, dx, dy, () => {
        // 다락: 건물 안에 숨지만 손님 칸은 차지하지 않는다
        a.at = inn;
        a.st = 'in';
        a.hidden = true;
        a.t = 10 + Math.random() * 10;
        if ((P.owner?.ember ?? 0) >= 30 && Math.random() < 0.5) bldSay(inn, '…(다락에서 옛 장비를 바라본다)');
      });
    }
  } else {
    const gs = guestsOf().filter((g) => !g.hidden && g.runId == null && g.st !== 'door');
    if (gs.length && r < 0.5) {
      const g = pick(gs);
      return goTo(a, clampN(Math.round(g.x) + 1), clampN(Math.round(g.y)), () => {
        a.st = 'idle';
        a.t = 2 + Math.random() * 2;
        a.dir = g.x < a.x ? -1 : 1;
        if (Math.random() < 0.6) say(a, pick(OWNER_DAY), 0.5);
      });
    }
    if (inn && r < 0.8) {
      const [dx, dy] = doorOf(inn);
      return goTo(a, dx, dy, () => {
        a.st = 'idle';
        a.t = 3 + Math.random() * 3;
      });
    }
  }
  const [lo, hi] = landBounds();
  let tx = 0;
  let ty = 0;
  let k = 0;
  do {
    tx = lo + ((Math.random() * (hi - lo)) | 0);
    ty = lo + ((Math.random() * (hi - lo)) | 0);
  } while (!walkable(tx, ty) && k++ < 20);
  goTo(a, tx, ty, () => {
    a.st = 'idle';
    a.t = 2 + Math.random() * 2;
  });
}

function goTo(a: Actor, tx: number, ty: number, then: () => void) {
  // 핫픽스 11 §9-2: 목적지가 건물 발판 칸이면(「손님 옆」「모닥불 옆」이 가로등 칸인 경우 등) 가장 가까운 빈 칸으로
  if (blockedAt(tx, ty)) {
    const n = nearestWalkable(tx, ty);
    if (n) [tx, ty] = n;
  }
  const p = astar(a.x, a.y, tx, ty);
  if (!p) {
    a.st = 'idle';
    a.t = 1;
    return;
  }
  a.path = p;
  a.st = 'walk';
  a.then = then;
}

const clampN = (v: number) => Math.max(0, Math.min(CONFIG.map.size - 1, v));

// ───────── 다음에 할 일: 가장 낮은 욕구부터 ─────────

const ready = () => world.objs.filter((o) => def(o.kind).act && o.kind !== 'dungeon' && o.build === undefined);
const byAct = (acts: Act[]) => ready().filter((o) => acts.includes(def(o.kind).act!));

/** HOTFIX14 §1: 같은 종류가 여러 채면 가까운 채로 (큰 마을에서 손님 동선이 퍼진다) */
function nearestSame(a: Actor, b: Building, opts: Building[]): Building {
  const same = opts.filter((o) => o.kind === b.kind);
  if (same.length < 2) return b;
  const d = (o: Building) => Math.hypot(o.tx + o.fw / 2 - a.x, o.ty + o.fh / 2 - a.y);
  return same.reduce((m, o) => (d(o) < d(m) ? o : m));
}

/** 채울 욕구를 고른다 (seekBelow 아래 중 가장 낮은 것) */
function needTarget(a: Actor): { b: Building; why: string } | null {
  const needs: ['hp' | 'food' | 'mood', number][] = [['hp', a.hp], ['food', a.food], ['mood', a.mood]];
  needs.sort((p, q) => p[1] - q[1]);
  for (const [k, v] of needs) {
    if (v >= NE.seekBelow) break;
    let opts: Building[] = [];
    const passer = a.status === 'passer';
    if (k === 'hp') opts = passer ? byAct(['bath']) : S.night ? byAct(['sleep']) : byAct(['bath']).concat(byAct(['sleep']));
    if (k === 'food') opts = byAct(['drink']).length || passer ? byAct(['drink']) : byAct(['sleep']);
    if (k === 'mood') opts = S.night && !passer ? byAct(['fire', 'bath', 'drink', 'pray', 'stargaze', 'read']) : byAct(['bath', 'drink', 'farm', 'pet', 'read', 'brew', 'mail', 'brag', 'pray']);
    if (opts.length) return { b: nearestSame(a, pick(opts), opts), why: { hp: '쉬러 가는 중', food: '밥 먹으러 가는 중', mood: '기분 전환하러 가는 중' }[k] };
  }
  return null;
}

function choose(a: Actor) {
  a.intent = undefined;
  if (a.role === 'owner') return ownerChoose(a);
  if (a.role || a.leaving) {
    a.st = 'idle';
    a.t = 3;
    return;
  }
  let want: Building | null = null;
  const need = needTarget(a);
  if (need) {
    want = need.b;
    a.intent = need.why;
  } else {
    const r = Math.random();
    const blds = ready();
    if (a.status === 'passer') {
      // 지나가는 손님은 묵지 않는다: 주점·온천·텃밭만
      const day = byAct(['drink', 'bath', 'farm']);
      if (day.length && r < A.dayBuildingChance) want = pick(day);
    } else if (S.night) {
      const fire = blds.find((o) => o.kind === 'fire');
      const beds = blds.filter((o) => def(o.kind).act === 'sleep');
      if (fire && r < A.nightFireChance) want = fire;
      else if (beds.length) want = pick(beds);
    } else if (r < A.dayBuildingChance) {
      const day = blds.filter((o) => def(o.kind).act !== 'fire');
      const nb = day.filter((o) => def(o.kind).act !== 'sleep');
      want = nb.length && Math.random() < A.nonSleepChance ? pick(nb) : day.length ? pick(day) : null;
    }
  }
  if (want) {
    const act = def(want.kind).act;
    let dx: number;
    let dy: number;
    if (want.kind === 'fire') {
      dx = want.tx + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.5 ? 1 : 0);
      dy = want.ty + 1;
    } else if (act === 'train' || act === 'farm') {
      dx = want.tx + 1 + ((Math.random() * 2) | 0);
      dy = want.ty + 1 + ((Math.random() * 2) | 0);
    } else [dx, dy] = doorOf(want);
    const w = want;
    goTo(a, clampN(dx), clampN(dy), () => enter(a, w));
    return;
  }
  // 산책 (우물·나무 곁이면 기분 조금 +)
  const [lo, hi] = landBounds();
  let tx: number;
  let ty: number;
  let k = 0;
  do {
    tx = lo + ((Math.random() * (hi - lo)) | 0);
    ty = lo + ((Math.random() * (hi - lo)) | 0);
  } while (!walkable(tx, ty) && k++ < 20);
  goTo(a, tx, ty, () => {
    a.st = 'idle';
    a.t = 1 + Math.random() * 2;
    const deco = world.objs.some((o) => (o.kind === 'well' || o.kind === 'tree' || o.kind === 'pine') && Math.abs(o.tx - a.x) + Math.abs(o.ty - a.y) <= 2);
    if (deco) a.mood = clamp(a.mood + NE.decoMood / 3);
    if (Math.random() < A.idleTalkChance) say(a, pick(a.rarity !== 'common' && Math.random() < 0.5 ? RARE_LINES[a.rarity] : LINES.idle));
    chem(a);
  });
}

/** 목적지 도착: 들어가거나 바깥 행동 */
export function enter(a: Actor, o: Building) {
  if (!world.objs.includes(o)) return choose(a);
  const act = def(o.kind).act;
  a.at = o;
  if (act === 'train') {
    a.st = 'atk';
    a.dir = 1;
    a.t = A.trainMin + Math.random() * (A.trainMax - A.trainMin);
    say(a, pick(LINES.train), 0.5);
    later(2, () => {
      if (S.visiting || !a.id) return;
      a.hp = clamp(a.hp + NE.trainHp);
      P.counters.trains++;
      legendHooks.bond('train');
      track('train');
      // 훈련장 레벨마다 수련 경험치 +20%
      if (gainXp(a, NE.trainXp * (1 + 0.2 * (o.lvl - 1)) * trainMult() * (1 + bfx(o, 'trainXp')))) floatW(a.x, a.y, 34, `Lv.${a.lvl}!`, 'big');
    });
    return;
  }
  if (act === 'farm') {
    a.st = 'pray';
    a.t = A.farmTime;
    a.mood = clamp(a.mood + NE.farmMood * moodMult());
    say(a, pick(LINES.farm), 0.5);
    return;
  }
  if (act === 'fire') {
    a.st = 'sit';
    a.dir = a.x < o.tx + 0.5 ? 1 : -1;
    a.t = A.fireMin + Math.random() * (A.fireMax - A.fireMin);
    a.mood = clamp(a.mood + NE.fireMood * moodMult());
    // 모닥불에 둘러앉은 수 (영웅 조건)
    if (!S.visiting) {
      const n = world.actors.filter((b) => b.st === 'sit' && b.at === o).length;
      P.counters.campfireMax = Math.max(P.counters.campfireMax, n);
    }
    if (!chem(a)) say(a, pick(LINES.fire), 0.5);
    return;
  }
  if (hasDoor(o)) {
    startDoor(a, o, 'in', () => goInside(a, o));
    return;
  }
  goInside(a, o);
}

/** 건물 안에서 욕구가 채워진다 */
function fillNeeds(a: Actor, act: Act | undefined) {
  const tired = a.hp < 30;
  const bathO = a.at?.kind === 'bath' ? a.at : bestOf('bath');
  const bathLv = bathO?.lvl ?? 1;
  // BUILDINGS_SPEC: 예배당 — 체력 회복 +%
  const heal = 1 + chapelHeal();
  if (act === 'sleep') {
    a.hp = clamp(a.hp + (S.night ? NE.sleepNightHp : NE.sleepHp) * heal);
    // 주점이 없으면 여관에서 간단한 끼니가 나온다
    if (!byAct(['drink']).length) a.food = clamp(a.food + NE.meal * 0.6);
  } else if (act === 'drink') {
    if (!S.visiting && a.id && takeMeal()) {
      // 텃밭 채소가 있으면 더 든든한 식사 (BUILDINGS_SPEC §3: 옛 채소 → 창고의 먹을 수 있는 작물)
      a.food = clamp(a.food + NE.mealWithProduce);
      a.mood = clamp(a.mood + NE.mealProduceMood * moodMult());
    } else a.food = clamp(a.food + NE.meal);
    if (!S.visiting && a.id) {
      P.counters.tavernMeals++;
      track('meal');
      ownerGain('meal');
    }
  } else if (act === 'bath') {
    // 온천 레벨마다 회복·기분 +15%
    // 꽃향기 온천: 기분·회복 +20%
    const k = (1 + 0.15 * (bathLv - 1)) * (1 + (bathO ? bfx(bathO, 'bath') : 0));
    a.hp = clamp(a.hp + NE.bathHp * k * heal);
    a.mood = clamp(a.mood + NE.bathMood * k * moodMult());
    if (!S.visiting && a.id) legendHooks.bond('bathUse');
  } else if (act === 'forge') a.mood = clamp(a.mood + 4);
  // BUILDINGS_SPEC §2: 새 기능 건물 — 말 쓰다듬기·기도(밤엔 더)·책·공방 구경·편지·별 보기·의뢰 자랑
  else if (act === 'pray') a.mood = clamp(a.mood + CONFIG.newBuildings.chapel.prayMood * (S.night ? 1.5 : 1) * moodMult());
  else if (act && ['pet', 'read', 'brew', 'mail', 'stargaze', 'brag'].includes(act)) a.mood = clamp(a.mood + 5 * moodMult());
  // 지친 손님이 쉬고 일어났다 (성녀 아리아의 부탁)
  if (!S.visiting && tired && a.hp >= 30 && (act === 'sleep' || act === 'bath')) {
    legendHooks.req('tiredRecovered');
    ownerGain('tired');
  }
}

function goInside(a: Actor, o: Building) {
  if (!world.objs.includes(o)) return choose(a);
  const act = def(o.kind).act;
  a.st = 'in';
  a.hidden = true;
  o.inside.push(a);
  a.t = act === 'sleep' ? (S.night ? A.stay.sleepNight : A.stay.sleepDay) : A.stay.otherMin + Math.random() * (A.stay.otherMax - A.stay.otherMin);
  puffAt(o, '#efe2c6', 3, false);
  if (act && act !== 'sleep' && LINES[act]) bldSay(o, pick(LINES[act]));
  fillNeeds(a, act);
  // 손님 접대 (전설 인연 활동): 기사·도적 손님이 건물을 쓸 때
  if (!S.visiting && a.id && act) {
    if (a.kind === 'knight') legendHooks.bond('serveKnight');
    if (a.kind === 'rogue') legendHooks.bond('serveRogue');
  }
  // 4단계: 요리(주점) · 계절 행사 · 유산 보너스
  // 땅 개편: 주점 레벨당 수입 +15% (Lv.2 = +15% … Lv.6 = +75%)
  const lvMult = o.kind === 'tavern' ? 1 + CONFIG.upgrade.tavernIncomePerLevel * (o.lvl - 1) : 1;
  const income = act && CONFIG.economy.income[act] ? Math.round(CONFIG.economy.income[act] * lvMult * incomeMult(act) * incMult(o) * (1 + hfx('gold')) * (act === 'sleep' ? 1 + hfx('stayH') * CONFIG.harmony.stayIncome : 1)) : 0;
  if (income && !S.visiting) {
    earn(income, act as 'sleep' | 'drink' | 'forge' | 'bath');
    floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 40, '+' + income);
  }
}

export function leave(a: Actor) {
  const o = a.at;
  if (o && a.hidden && hasDoor(o) && world.objs.includes(o)) {
    o.inside = o.inside.filter((x) => x !== a);
    const d = doorOf(o);
    a.x = d[0];
    a.y = d[1];
    a.hidden = false;
    a.at = null;
    startDoor(a, o, 'out', () => choose(a));
    return;
  }
  if (o) {
    o.inside = o.inside.filter((x) => x !== a);
    if (a.hidden) {
      const d = doorOf(o);
      a.x = d[0];
      a.y = d[1];
      a.pop = 0.4;
    }
  }
  a.hidden = false;
  a.at = null;
  choose(a);
}

function startDoor(a: Actor, o: Building, dir: 'in' | 'out', then: () => void) {
  a.st = 'door';
  a.path = null;
  a.door = dir === 'in'
    ? { o, dir, phase: 'walk', t: 0, dur: doorWalkSeconds(o), then }
    : { o, dir, phase: 'step', t: 0, dur: A.doorSeconds, then };
}

function stepDoor(a: Actor, dt: number) {
  const d = a.door!;
  d.t += dt;
  if (d.t < d.dur) return;
  const pose = doorPose(a);
  a.dir = pose.dir;
  if (d.dir === 'in' && d.phase === 'walk') Object.assign(d, { phase: 'step', t: 0, dur: A.doorSeconds });
  else if (d.dir === 'out' && d.phase === 'step') Object.assign(d, { phase: 'walk', t: 0, dur: doorWalkSeconds(d.o) });
  else {
    a.door = null;
    a.st = 'idle';
    a.back = false;
    d.then();
  }
}

/** 건물 안·문 연출 중이면 꺼낸다 (원정 출발·떠나기 전에) */
function pullOut(a: Actor) {
  if (a.at) {
    a.at.inside = a.at.inside.filter((x) => x !== a);
    if (a.hidden) {
      const d = doorOf(a.at);
      a.x = d[0];
      a.y = d[1];
      a.pop = 0.4;
    }
    a.at = null;
  }
  a.door = null;
  a.hidden = false;
}

// ───────── 케미 ─────────

/** 짝 조합이 가까이서 쉬면 마주 보고 대사 + ♥. 처음 보는 짝이면 「새 케미 발견!」 */
function chem(a: Actor): boolean {
  a.back = false;
  // 땅 개편: 주점 Lv.4부터 「단골 테이블」 — 케미 확률 ↑
  const tav = findKind('tavern');
  const chemP = A.chemChance * (tav && tav.lvl >= CONFIG.upgrade.tavernChemFrom ? CONFIG.upgrade.tavernChemMult : 1);
  if (Math.random() > chemP) return false;
  const resting = (b: Actor) => b.st === 'idle' || b.st === 'sit';
  const o = world.actors.find(
    (b) => b !== a && !b.hidden && !b.party && !b.leaving && resting(b) && !b.role && Math.hypot(b.x - a.x, b.y - a.y) < A.chemDistance && pairOf(a, b),
  );
  if (!o) return false;
  const pair = pairOf(a, o)!;
  // 핫픽스 11 §10: 대사 첫 줄은 그 역할 쪽이 (엘프가 「엘프는 맥주 맛을 몰라」 하지 않게)
  const [f, s] = orderPair(pair, a, o);
  f.dir = sx(s.x, s.y) > sx(f.x, f.y) ? 1 : -1;
  s.dir = f.dir === 1 ? -1 : 1;
  f.back = s.back = false;
  for (const b of [f, s]) {
    if (b.st !== 'sit') b.st = 'idle';
    b.t = Math.max(b.t, 3.6);
  }
  say(f, pair.meet[0], 1, 'chem');
  later(1.1, () => say(s, pair.meet[1], 1, 'chem'));
  chemWait = A.chemCooldown;
  if (S.visiting) {
    later(1.9, () => floatW((f.x + s.x) / 2, (f.y + s.y) / 2, 34, '♥', 'heart'));
    return true;
  }
  const g = addBond(f, s, CONFIG.chem.townXp);
  f.mood = clamp(f.mood + NE.chemMood);
  s.mood = clamp(s.mood + NE.chemMood);
  track('chem');
  markDirty();
  later(1.9, () => floatW((f.x + s.x) / 2, (f.y + s.y) / 2, 34, g?.discovered ? '새 케미 발견!' : '♥ 케미 +1', g?.discovered ? 'heart big' : 'heart'));
  // 핫픽스 12 §6: 마을 만남은 조용히 — ♥ 말풍선만, 대화창 대신 「케미 소식」
  if (g) notifyChem(g, 'town');
  return true;
}

/** 친밀도 단계가 오르면 짧은 대화 이벤트 */
export function queueChemTalk(a: Actor, b: Actor, lv: number) {
  // 핫픽스 11 §10: 대사 역할 순서는 chemTalk가 맞춘다 (핫픽스 12 §6: 알림 규칙은 notifyChem)
  if (pairOf(a, b)) chemTalk(a, b, lv);
}

let chemWait = 0;
let chemScan = 0;
function scanChem(dt: number) {
  chemWait -= dt;
  chemScan -= dt;
  if (chemScan > 0 || chemWait > 0) return;
  chemScan = A.chemScanSeconds;
  for (const a of world.actors) {
    if (a.role || a.hidden || a.party || a.leaving || a.bub || (a.st !== 'idle' && a.st !== 'sit')) continue;
    if (chem(a)) return;
  }
}

// ───────── 손님 오고 가기 ─────────

/** 묵는 손님(지나가는 손님 제외) — 정원은 이 수로 센다 */
const stayers = () => guestsOf().filter((a) => a.status !== 'passer');

/** 입구에서 새 손님이 걸어 들어온다. 방이 없으면 낮에만 「지나가는 손님」이 들른다 */
export function arrive(a?: Actor): Actor | null {
  const [ex, ey] = entrance();
  let back = false;
  if (!a) {
    if (stayers().length < capacity()) a = makeAdventurer(ex, ey, { day: S.day });
    else {
      const h = hourNow();
      const passers = guestsOf().filter((x) => x.status === 'passer').length;
      if (h < G.passerFromHour || h >= G.passerUntilHour || passers >= G.passerMax || Math.random() > G.passerChance) return null;
      a = makeAdventurer(ex, ey, { day: S.day, status: 'passer' });
    }
  } else {
    back = !!a.id && !a.heroId;
    a.x = ex;
    a.y = ey;
  }
  a.pop = 0.4;
  world.actors.push(a);
  const fresh = dexAddGuest(a);
  track('guestArrive');
  dailyAdd('arrivals');
  if (fresh) dailyAdd('newDex');
  markDirty();
  const tag = a.rarity !== 'common' ? `<b style="color:${RARITY_INFO[a.rarity].color}">${RARITY_INFO[a.rarity].name}</b> ` : '';
  const what = back ? '다시 찾아온 손님' : a.status === 'passer' ? '지나가는 손님' : '새 손님';
  uiHooks.toastHtml(`<span>${tag}${what} ${a.name} 도착${fresh ? ' · <b>도감 NEW!</b>' : ''}</span>`);
  // 입구에서 여관 문까지 걸어 들어온다 (지나가는 손님은 바로 할 일을 찾는다)
  const inn = findKind('inn');
  const who = a;
  if (a.status === 'passer') choose(a);
  else if (inn) {
    const d = doorOf(inn);
    goTo(a, d[0], d[1], () => enter(who, inn));
  }
  return a;
}

/** 입구로 걸어 나가 사라진다 */
export function sendAway(a: Actor, happy: boolean) {
  pullOut(a);
  a.leaving = true;
  a.party = false;
  for (const s of ['weapon', 'armor', 'acc'] as const) unequip(a, s);
  addRep(happy ? CONFIG.reputation.happyLeave : CONFIG.reputation.angryLeave);
  say(a, happy ? '잘 쉬다 가요!' : '다신 안 올래…', 1);
  const [ex, ey] = entrance();
  const vanish = () => {
    a.fading = 0.6;
  };
  const p = astar(a.x, a.y, ex, ey);
  if (!p) vanish();
  else {
    a.path = p;
    a.st = 'walk';
    a.then = vanish;
  }
  markDirty();
}

export const regularsCount = () => guestsOf().filter((x) => x.status === 'regular' || x.status === 'hero').length;

/** 단골 자리가 없을 때: 대기 목록에 올리고 보낸다 (최대 3명, 꽉 차면 못 올림) */
function toWaitlist(a: Actor) {
  if (P.waitlist.length < G.waitlistMax && !P.waitlist.some((w) => w.id === a.id)) {
    P.waitlist.push({ id: a.id, kind: a.kind, name: a.name, lvl: a.lvl, xp: a.xp, race: a.race, rarity: a.rarity, face: a.face, hair: a.hair });
    uiHooks.toast(`${a.name}: 자리 나면 꼭 다시 올게요! (단골 대기 ${P.waitlist.length}/${G.waitlistMax})`);
  }
  sendAway(a, true);
}

let calledId = 0;
/** 단골 자리가 나면 대기 손님이 다시 찾아와 제안한다 */
function callWaitlist() {
  if (!P.waitlist.length || regularsCount() >= capacity()) return;
  // 앞서 부른 대기 손님의 제안이 끝날 때까지 기다린다
  if (guestsOf().some((x) => x.id === calledId && x.status === 'visitor')) return;
  const w = P.waitlist.shift()!;
  calledId = w.id;
  const a = Object.assign(blankActor(w.kind, w.name, 0, 0), w, { status: 'visitor' as const, hp: 80, food: 70, mood: 85, leaveDay: S.day + 1 });
  arrive(a);
  propose(a);
}

/** 단골 제안: 기분 좋게 묵은 손님이 「여기 눌러앉아도 될까요?」 · fast = 새로 생긴 자리의 빠른 제안(받으면 fastSlots -1) */
function propose(a: Actor, fast = false) {
  queueEvent(() => {
    if (!world.actors.includes(a) || a.leaving) return;
    proposeTalk(a, fast);
  }, 'prop' + a.id);
}

/** HOTFIX16 §1: 제안 대화 그리기 (ui가 손님 카드 · [자세히] · 대신 받기 확인을 붙인다) */
export const proposeUi = {
  show: (_a: Actor, lines: TalkLine[], choices: TalkChoice[], _again: () => void, _swap?: { weak: Actor; ok: () => void }) => uiHooks.talk(lines, undefined, choices),
};
/** 바꿔도 되는 가장 약한 단골 (영웅·원정 중·사냥 파티는 빼고) */
export function weakestRegular(): Actor | null {
  const regs = guestsOf().filter((x) => x.status === 'regular' && x.runId == null && !x.party && !x.leaving);
  if (!regs.length) return null;
  return regs.reduce((m, x) => (powerOf(x) < powerOf(m) ? x : m));
}
function accept(a: Actor, fast: boolean) {
  a.status = 'regular';
  if (fast) P.fastSlots = Math.max(0, P.fastSlots - 1);
  addRep(CONFIG.reputation.newRegular);
  ownerGain('regular');
  floatW(a.x, a.y, 40, '단골 등록!', 'big');
  markDirty();
}
/** HOTFIX16 §1: 가장 약한 단골 대신 받기 — 바뀐 단골은 대기 명단 맨 앞으로 (꽉 찼으면 가장 오래 기다린 사람이 빠진다) */
export function swapRegular(a: Actor, weak: Actor, fast = false) {
  P.waitlist = P.waitlist.filter((w) => w.id !== weak.id);
  P.waitlist.unshift({ id: weak.id, kind: weak.kind, name: weak.name, lvl: weak.lvl, xp: weak.xp, race: weak.race, rarity: weak.rarity, face: weak.face, hair: weak.hair });
  while (P.waitlist.length > G.waitlistMax) P.waitlist.pop();
  weak.status = 'visitor';
  sendAway(weak, true);
  accept(a, fast);
  uiHooks.toast(`${weak.name}: 자리 나면 다시 올게요! (단골 대기 ${P.waitlist.length}/${G.waitlistMax})`);
}
export function proposeTalk(a: Actor, fast = false) {
  if (!world.actors.includes(a) || a.leaving) return;
  const regs = regularsCount();
  const full = regs >= capacity();
  const weak = full ? weakestRegular() : null;
  const lines: TalkLine[] = [
    ['@' + a.id, `${S.innName || '여관'}… 정말 마음에 들어요. 여기 눌러앉아도 될까요?`],
    ['narr', `단골이 되면 원정에 보낼 수 있어요. (단골 ${regs}/${capacity()})`],
  ];
  const choices: TalkChoice[] = weak
    ? [{ label: `${weak.name} 대신 받기`, fn: () => swapRegular(a, weak, fast) }]
    : [
        {
          label: '단골로 받기',
          fn: () => {
            if (regularsCount() >= capacity()) {
              uiHooks.toast('단골 자리가 없어요 · 여관 레벨업이나 별채로 늘려요');
              return toWaitlist(a);
            }
            accept(a, fast);
          },
        },
      ];
  choices.push({ label: '보내 주기', fn: () => sendAway(a, true) });
  proposeUi.show(a, lines, choices, () => proposeTalk(a, fast), weak ? { weak, ok: () => swapRegular(a, weak, fast) } : undefined);
}

/** 단골이 되고 싶어 하는 기분 기준 (주인 말솜씨가 높을수록 낮다) */
export const regularNeed = () => G.regularMood * (1 - hfx('regular')) - regularCut();

/** 날이 바뀔 때(06:00): 방문 손님은 떠날지·단골이 될지 정한다 */
export function dailyGuests() {
  if (S.visiting) return;
  // 평판: 손님 기분 평균
  const all = stayers();
  if (all.length) {
    const avg = all.reduce((s, a) => s + a.mood, 0) / all.length;
    const R = CONFIG.reputation;
    if (avg >= R.dailyMoodHigh) addRep(R.dailyMoodGain);
    else if (avg < R.dailyMoodLow) addRep(R.dailyMoodLoss);
    // 손님 기분 '최고' 날 (전설 아리아의 소문 조건)
    if (avg >= 90) P.counters.moodTopDays++;
  }
  for (const a of guestsOf()) {
    if (a.status !== 'visitor' || a.heroId || a.legendId || a.runId != null) continue;
    const avg = a.moodN ? a.moodSum / a.moodN : a.mood;
    if (avg < G.leaveMood) sendAway(a, false);
    else if (S.day >= a.leaveDay) {
      if (avg < regularNeed()) sendAway(a, true);
      else if (regularsCount() < capacity()) propose(a);
      else toWaitlist(a);
    }
  }
}

/** 지나가는 손님: 저녁이 되면 떠난다. 기분이 좋았으면 단골 대기 목록에 */
function passersLeave() {
  if (hourNow() < G.passerLeaveHour + passerExtraHours() && !S.night) return;
  for (const a of guestsOf()) {
    if (a.status !== 'passer') continue;
    const avg = a.moodN ? (a.moodSum + a.mood) / (a.moodN + 1) : a.mood;
    // 단골 자리가 있으면 그 자리에서 제안, 없으면 대기 목록
    if (avg >= regularNeed() && regularsCount() < capacity()) propose(a);
    else if (avg >= regularNeed() && P.waitlist.length < G.waitlistMax) toWaitlist(a);
    else sendAway(a, avg >= G.leaveMood);
  }
}
onNewDay(dailyGuests);

/** 영웅이 나타난다: 입구로 걸어 들어와 부탁을 남긴다 */
function heroArrive(id: string) {
  const h = heroById(id)!;
  P.dex.heroes[id] = { appeared: true, recruited: false, stars: 1 };
  const [ex, ey] = entrance();
  arrive(makeHero(id, ex, ey));
  queueEvent(() =>
    uiHooks.talk([
      ['narr', `방랑자의 서 — 「${h.title}」 ${h.name}${josa(h.name, "가")} 나타났다!`],
      ...h.intro.map((t) => ['hero_' + h.id, t, undefined, h.name] as [string, string, undefined, string]),
      ['hero_' + h.id, `부탁: ${h.request.text}`, undefined, h.name],
      // STORY_V1: 2회차부터 오스윈의 기억 대사
      ...(id === 'oswin' ? storyLines(cycleLines('oswinArrive') ?? []).map((x) => x.line) : []),
    ]),
  );
}

/** 부탁을 들어주면 동료가 된다 */
function heroCheck() {
  const c = heroCtx();
  for (const a of guestsOf()) {
    if (!a.heroId || a.status === 'hero') continue;
    const h = heroById(a.heroId);
    if (!h || !h.request.done(c)) continue;
    a.status = 'hero';
    P.dex.heroes[h.id] = { appeared: true, recruited: true, stars: P.dex.heroes[h.id]?.stars ?? 1 };
    addRep(10);
    markDirty();
    tieRequestDone(h.id);
    queueEvent(() =>
      uiHooks.talk([
        ['hero_' + h.id, '약속을 지켜 줬군. 이제부터 이 여관의 동료가 되겠다.', undefined, h.name],
        ['narr', `${h.name} 영입! 고유 기술 「${h.skill.name}」 · 계정 전투력 +${Math.round(h.bonus * 100)}%`],
      ]),
    );
  }
}

// ───────── 게임 시간 흐름: 욕구 · 도착 · 영웅 ─────────

let hourAcc = 0;
/**
 * 5단계: 단골이 3명이 될 때까지는, 몇 시간 묵으며 기분이 좋았던 손님이 하루를 기다리지 않고 바로 제안한다
 * (새 게임 첫 10분 안에 「단골 3명」 임무가 이어지게)
 */
const EARLY_REGULARS = 3;
const EARLY_HOURS = 1;
function earlyRegular() {
  if (S.visiting || regularsCount() >= Math.min(EARLY_REGULARS, capacity())) return;
  const stay = guestsOf().filter((g) => (g.status === 'visitor' || g.status === 'passer') && !g.heroId && !g.legendId);
  const a = stay.find((g) => g.moodN >= EARLY_HOURS && g.moodSum / g.moodN >= regularNeed());
  if (a) return propose(a);
  // 머무는 손님이 없으면: 소문을 듣고 온 모험가가 바로 찾아온다 (기분 좋게)
  if (!stay.length) {
    const g = arrive();
    if (g) {
      g.mood = Math.max(g.mood, 85);
      say(g, '여기가 소문난 그 여관인가요?', 0.3);
    }
  }
}

// ───────── 핫픽스 11 §9-2: 건물 배치가 바뀐 뒤 — 발판 위 손님 밀어내기 · 걷는 길 다시 ─────────
export function afterLayoutChange() {
  for (const a of world.actors) {
    if (a.hidden || a.door || a.runId != null || a.party) continue;
    const tx = Math.round(a.x);
    const ty = Math.round(a.y);
    // 1) 새 발판 안에 서 있으면 가장 가까운 빈 길 칸으로 살짝
    if (blockedAt(tx, ty)) {
      const s = nearestWalkable(tx, ty);
      if (s) {
        [a.x, a.y] = s;
        a.pop = 0.3;
        puff(sx(s[0], s[1]), sy(s[0], s[1]) - 4, '#efe2c6', 0, -6, 0.4, 2);
      }
    }
    // 2) 걷는 중이면 남은 길이 막힌 칸을 지나는지 → 목적지 그대로 다시 찾기 (없으면 멈추고 다시 고르기)
    if (a.st === 'walk' && a.path?.length) {
      const goal = a.path[a.path.length - 1];
      if (a.path.slice(0, -1).some(([x, y]) => blockedAt(x, y)) || blockedAt(tx, ty)) {
        const p = astar(a.x, a.y, goal[0], goal[1]);
        if (p) a.path = p;
        else Object.assign(a, { path: null, st: 'idle', then: null, t: 0.3 });
      }
    }
  }
}
layoutHooks.after = afterLayoutChange;

// ───────── 핫픽스 10 §15: 자리가 새로 생기면 빠른 제안 (규칙은 earlyRegular와 같은 방식) ─────────
let lastCap = -1;
let lastFastArrive = -99;
export const fastHooks = { roomUp: () => {} };
/** 단골 자리(capacity)가 늘어난 순간 · 옛 저장 구제 1번 */
export function watchCapacity() {
  if (S.visiting || !S.started) {
    lastCap = -1;
    return;
  }
  const c = capacity();
  if (lastCap >= 0 && c > lastCap) {
    P.fastSlots += c - lastCap;
    markDirty();
    if (P.fastHintN < 2) {
      P.fastHintN++;
      fastHooks.roomUp();
    }
  }
  lastCap = c;
  if (!P.fastRescued) {
    P.fastRescued = true;
    const regs = regularsCount();
    if (regs < c && !P.fastSlots) P.fastSlots = Math.min(2, c - regs);
    markDirty();
  }
}
export function fastRegular() {
  if (S.visiting || P.fastSlots <= 0 || regularsCount() >= capacity()) return;
  // 대기 목록 손님이 먼저 (callWaitlist)
  if (P.waitlist.length) return;
  const stay = guestsOf().filter((g) => (g.status === 'visitor' || g.status === 'passer') && !g.heroId && !g.legendId && !g.leaving && g.runId == null);
  const a = stay.find((g) => g.moodN >= EARLY_HOURS && g.moodSum / g.moodN >= regularNeed());
  if (a) return propose(a, true);
  // 머무는 손님이 없으면: 소문 듣고 온 손님 (게임 2시간에 한 번까지)
  const h = absHours();
  if (!stay.length && h - lastFastArrive >= 2) {
    lastFastArrive = h;
    const g = arrive();
    if (g) {
      g.mood = Math.max(g.mood, 85);
      say(g, '방이 새로 났다는 소문 듣고 왔어요!', 0.3);
    }
  }
}

function tickGuests(dt: number) {
  watchCapacity();
  const gh = dt / CONFIG.clock.realSecondsPerGameHour;
  const list = guestsOf();
  const crowded = stayers().length > capacity();
  for (const a of list) {
    if (a.runId != null) continue;
    a.food = clamp(a.food + NE.foodPerHour * gh);
    const low = (a.hp < NE.lowBelow ? 1 : 0) + (a.food < NE.lowBelow ? 1 : 0);
    a.mood = clamp(a.mood + (low * NE.moodLowNeedPerHour + (crowded ? NE.moodCrowdedPerHour : 0)) * gh);
  }
  hourAcc += gh;
  if (hourAcc < 1) return;
  hourAcc -= 1;
  // 한 시간마다: 기분 기록 · 손님 도착 · 영웅
  for (const a of list) {
    if (a.status !== 'visitor' && a.status !== 'passer') continue;
    a.moodSum += a.mood;
    a.moodN++;
  }
  passersLeave();
  callWaitlist();
  earlyRegular();
  fastRegular();
  const h = absHours();
  if (h - P.lastArriveHour >= G.arriveEveryGameHours || h < P.lastArriveHour) {
    P.lastArriveHour = h;
    if (Math.random() < G.arriveChance * (1 + hfx('arrive'))) arrive();
  }
  const hero = heroReady();
  if (hero) heroArrive(hero);
  heroCheck();
}

// ───────── 원정 파티: 던전 입구까지 걸어가 사라지고, 끝나면 돌아온다 ─────────

export function departParty(run: Run) {
  const dg = (world.home?.objs ?? world.objs).find((o) => o.kind === 'dungeon');
  const members = homeList().filter((a) => run.members.includes(a.id));
  for (const a of members) {
    pullOut(a);
    a.party = true;
    a.intent = undefined;
    a.then = null;
    if (!dg || S.visiting) {
      a.hidden = true;
      a.st = 'in';
      continue;
    }
    const d = doorOf(dg);
    const p = astar(a.x, a.y, d[0], d[1]);
    const hide = () => {
      a.hidden = true;
      a.st = 'in';
      puffAt(dg, '#b07aff', 6);
    };
    if (!p) hide();
    else {
      a.path = p;
      a.st = 'walk';
      a.then = hide;
    }
  }
  if (members[0] && !S.visiting) say(members[0], pick(LINES.party), 1, 'chem');
}

/** 저장에서 불러올 때: 원정 중인 손님은 던전 안에 숨겨 둔다 */
export function hideRunners() {
  const dg = findKind('dungeon');
  for (const a of world.actors) {
    if (a.runId == null) continue;
    a.party = true;
    a.hidden = true;
    a.st = 'in';
    if (dg) [a.x, a.y] = doorOf(dg);
  }
}

/** 원정이 끝난 파티를 마을로 (보고서는 이벤트 줄로) */
export function returnParty(run: Run, report = true) {
  const list = homeList();
  const dg = (world.home?.objs ?? world.objs).find((o) => o.kind === 'dungeon');
  for (const a of list) {
    if (a.runId !== run.id) continue;
    a.runId = null;
    a.party = false;
    a.hidden = false;
    a.path = null;
    a.then = null;
    a.st = 'idle';
    a.t = 0.5;
    a.pop = 0.4;
    if (dg) [a.x, a.y] = doorOf(dg);
  }
  if (dg && !S.visiting && run.result) {
    puffAt(dg, '#ffd36b', 16);
    floatW(dg.tx + 1, dg.ty + 3, 30, '+' + run.result.gold);
  }
  if (report) queueEvent(() => uiHooks.report(run), 'run' + run.id);
}

let runScan = 0;
function updRuns(dt: number) {
  runScan -= dt;
  if (runScan > 0) return;
  runScan = 0.5;
  for (const r of dueRuns()) {
    const bonds: BondGain[] = [];
    resolveRun(r, bonds);
    // 핫픽스 12 §6: 같이 다녀온 짝 — 3·5단계·처음 발견만 대화창 (하루 3번), 나머지는 소식 + 결과 창 한 줄
    for (const g of bonds) notifyChem(g, 'party');
    returnParty(r);
    markDirty();
  }
}

// ───────── 30fps 규칙 갱신 ─────────

export function updActors(dt: number) {
  if (S.started) updRuns(dt);
  if (S.started && !S.visiting) {
    scanChem(dt);
    tickGuests(dt);
  }
  for (const a of world.actors) {
    a.t -= dt;
    if (a.pop) a.pop = Math.max(0, a.pop - dt);
    if (a.goldSteps) a.goldSteps = Math.max(0, a.goldSteps - dt);
    if (a.fading !== undefined) {
      a.fading -= dt;
      continue;
    }
    if (a.door) {
      stepDoor(a, dt);
      continue;
    }
    if (a.st === 'walk') {
      const sp = (a.party ? A.partySpeed : A.walkSpeed) * dt;
      const nx = a.path?.[0];
      if (!nx) {
        a.st = 'idle';
        const f = a.then;
        a.then = null;
        if (f) f();
        else a.t = 1;
        continue;
      }
      const dx = nx[0] - a.x;
      const dy = nx[1] - a.y;
      const d = Math.hypot(dx, dy);
      const ds = sx(dx, dy);
      if (Math.abs(ds) > 0.01) a.dir = ds > 0 ? 1 : -1;
      if (Math.abs(dx) + Math.abs(dy) > 0.01) a.back = dx + dy < 0;
      if (d <= sp) {
        a.x = nx[0];
        a.y = nx[1];
        a.path!.shift();
      } else {
        a.x += (dx / d) * sp;
        a.y += (dy / d) * sp;
      }
    } else if (a.party || a.leaving) {
      // 던전 안 / 떠나는 중
    } else if (a.st === 'in') {
      if (a.t <= 0) {
        if (S.night && a.at && def(a.at.kind).act === 'sleep' && Math.random() < A.nightStayMore) {
          a.t = 5;
          continue;
        }
        leave(a);
      }
    } else if (a.t <= 0) {
      if (a.at) a.at = null;
      choose(a);
    }
  }
  const before = world.actors.length;
  world.actors = world.actors.filter((a) => a.fading === undefined || a.fading > 0);
  if (world.actors.length !== before && !S.visiting) {
    pruneBonds();
    markDirty();
  }
}

export const ACT_TEXT: Record<string, string> = { walk: '걷는 중', idle: '쉬는 중', atk: '수련 중', pray: '밭일 중', sit: '불멍 중', in: '건물 안' };

/** 지금 하는 일 (창에 표시) */
export function doingText(a: Actor): string {
  if (a.runId != null) return a.hidden ? '원정 중' : '던전으로 가는 중';
  if (a.leaving) return '떠나는 중';
  if (a.door) return a.door.dir === 'in' ? '들어가는 중' : '나오는 중';
  if (a.st === 'in' && a.at) return INSIDE_TEXT[def(a.at.kind).act!] ?? '머무는 중';
  if (a.st === 'walk' && a.intent) return a.intent;
  return ACT_TEXT[a.st] ?? '';
}
