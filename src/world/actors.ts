// 모험가 상태기계: 걷기 / 들어가기 / 수련 / 밭일 / 모닥불 / 잠 / 던전 파티 / 케미
import { def, INSIDE_TEXT } from '../data/catalog';
import { CHEM, GUEST_KINDS, NAMES, type GuestKind } from '../data/classes';
import { CONFIG } from '../data/config';
import { sx } from '../engine/iso';
import { canvas, dk, P } from '../engine/pixel';
import { bldSay, floatW, puffAt, say } from './fx';
import { earn, later, pick, S, uiHooks, world, type Actor, type ActorState, type Building } from './state';
import { doorPose, doorWalkSeconds, hasDoor } from './doors';
import { astar, capacity, doorOf, findKind, landBounds, walkable } from './town';

const A = CONFIG.actors;
const LINES = CONFIG.lines;

export function mkA(kind: Actor['kind'], name: string, x: number, y: number, role?: Actor['role']): Actor {
  return {
    kind, name, x, y, dir: 1, back: false, st: 'idle', t: Math.random() * 2, ph: Math.random() * 9, role, path: null,
    lvl: 3 + ((Math.random() * 12) | 0), hp: 60 + ((Math.random() * 40) | 0), food: 40 + ((Math.random() * 60) | 0),
    mood: 50 + ((Math.random() * 50) | 0), hidden: false, at: null,
  };
}

/** 새 손님 한 명 (문 앞에서 나타남) */
export function newGuest(x: number, y: number): Actor {
  const used = new Set(world.actors.map((a) => a.name));
  const k: GuestKind = pick(GUEST_KINDS);
  const free = NAMES[k].filter((n) => !used.has(n));
  const a = mkA(k, free.length ? pick(free) : pick(NAMES[k]), x, y);
  a.pop = 0.4;
  return a;
}

/** 손님 수를 정원에 맞춘다 (모자라면 여관 문 앞에서 나타남) */
export function fillGuests() {
  const inn = findKind('inn');
  if (!inn) return;
  const d = doorOf(inn);
  const guests = world.actors.filter((a) => !a.role);
  for (let i = guests.length; i < capacity(); i++) {
    world.actors.push(newGuest(d[0] + (Math.random() * 2 - 1), d[1] + Math.random()));
  }
}

/** 처음부터 손님을 채운다 + 우체부 모모 */
export function spawnActors() {
  world.actors = [];
  const inn = findKind('inn');
  if (!inn) return;
  const d = doorOf(inn);
  for (let i = 0; i < capacity(); i++) {
    const k = GUEST_KINDS[i % GUEST_KINDS.length];
    world.actors.push(mkA(k, NAMES[k][Math.floor(i / GUEST_KINDS.length) % 3], d[0] + (Math.random() * 2 - 1), d[1] + Math.random()));
  }
  if (!S.visiting) addPostman();
}

export function addPostman() {
  const b = findKind('well') || findKind('inn')!;
  world.actors.push(mkA('post', '모모', b.tx + 1.2, b.ty + 1.4, 'npc'));
}

function goTo(a: Actor, tx: number, ty: number, then: () => void) {
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

/** 다음에 할 일 고르기 */
function choose(a: Actor) {
  if (a.role) {
    a.st = 'idle';
    a.t = 3;
    return;
  }
  const r = Math.random();
  const blds = world.objs.filter((o) => def(o.kind).act && o.kind !== 'dungeon' && !o.build);
  let want: Building | null = null;
  if (S.night) {
    const fire = blds.find((o) => o.kind === 'fire');
    const beds = blds.filter((o) => def(o.kind).act === 'sleep');
    if (fire && r < A.nightFireChance) want = fire;
    else if (beds.length) want = pick(beds);
  } else if (r < A.dayBuildingChance) {
    // 낮: 모닥불은 밤에만
    const day = blds.filter((o) => def(o.kind).act !== 'fire');
    const nb = day.filter((o) => def(o.kind).act !== 'sleep');
    want = nb.length && Math.random() < A.nonSleepChance ? pick(nb) : day.length ? pick(day) : null;
  }
  if (want) {
    const act = def(want.kind).act;
    let dx: number;
    let dy: number;
    if (want.kind === 'fire') {
      // 모닥불 옆자리
      dx = want.tx + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.5 ? 1 : 0);
      dy = want.ty + 1;
    } else if (act === 'train' || act === 'farm') {
      // 훈련장·텃밭은 안으로 걸어 들어간다
      dx = want.tx + 1 + ((Math.random() * 2) | 0) - 1 + 1;
      dy = want.ty + 1 + ((Math.random() * 2) | 0);
    } else [dx, dy] = doorOf(want);
    const w = want;
    goTo(a, clampN(dx), clampN(dy), () => enter(a, w));
    return;
  }
  // 산책
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
    if (Math.random() < A.idleTalkChance) say(a, pick(LINES.idle));
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
      if (!S.visiting && Math.random() < A.trainLevelUpChance) a.lvl += 1;
    });
    return;
  }
  if (act === 'farm') {
    a.st = 'pray';
    a.t = A.farmTime;
    say(a, pick(LINES.farm), 0.5);
    return;
  }
  if (act === 'fire') {
    a.st = 'sit';
    a.dir = a.x < o.tx + 0.5 ? 1 : -1;
    a.t = A.fireMin + Math.random() * (A.fireMax - A.fireMin);
    // 모닥불 가에 궁합 짝이 있으면 케미, 아니면 혼잣말
    if (!chem(a)) say(a, pick(LINES.fire), 0.5);
    return;
  }
  // 문이 있는 건물은 문을 열고 걸어 들어간다
  if (hasDoor(o)) {
    startDoor(a, o, 'in', () => goInside(a, o));
    return;
  }
  goInside(a, o);
}

/** 안으로 들어간다 (사라지고 지붕 위 숫자가 오른다) */
function goInside(a: Actor, o: Building) {
  if (!world.objs.includes(o)) return choose(a);
  const act = def(o.kind).act;
  a.st = 'in';
  a.hidden = true;
  o.inside.push(a);
  a.t = act === 'sleep' ? (S.night ? A.stay.sleepNight : A.stay.sleepDay) : A.stay.otherMin + Math.random() * (A.stay.otherMax - A.stay.otherMin);
  puffAt(o, '#efe2c6', 3);
  if (act && act !== 'sleep' && LINES[act]) bldSay(o, pick(LINES[act]));
  const income = act ? CONFIG.economy.income[act] : 0;
  if (income && !S.visiting) {
    earn(income, act as 'sleep' | 'drink' | 'forge' | 'bath');
    floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 40, '+' + income);
  }
}

/** 건물에서 나온다: 문 앞에 다시 나타남 */
export function leave(a: Actor) {
  const o = a.at;
  if (o && a.hidden && hasDoor(o) && world.objs.includes(o)) {
    // 문을 열고 걸어 나온다
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

/** 문 연출 시작 */
function startDoor(a: Actor, o: Building, dir: 'in' | 'out', then: () => void) {
  a.st = 'door';
  a.path = null;
  a.door = dir === 'in'
    ? { o, dir, phase: 'walk', t: 0, dur: doorWalkSeconds(o), then }
    : { o, dir, phase: 'step', t: 0, dur: A.doorSeconds, then };
}

/** 문 연출 진행: 들어가기 walk→step→안으로, 나오기 step→walk→다음 할 일 */
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

/** 케미: 궁합 쌍이 가까이서 쉬면(서 있거나 모닥불에 앉아 있거나) 마주 보고 대사 + ♥ */
function chem(a: Actor): boolean {
  a.back = false;
  if (Math.random() > A.chemChance) return false;
  const pairOf = (p: string, q: string) => CHEM.find((c) => (c[0] === p && c[1] === q) || (c[1] === p && c[0] === q));
  const resting = (b: Actor) => b.st === 'idle' || b.st === 'sit';
  const o = world.actors.find(
    (b) => b !== a && !b.hidden && !b.party && resting(b) && !b.role && Math.hypot(b.x - a.x, b.y - a.y) < A.chemDistance && pairOf(a.kind, b.kind),
  );
  if (!o) return false;
  const c = pairOf(a.kind, o.kind)!;
  const [f, s] = c[0] === a.kind ? [a, o] : [o, a];
  f.dir = sx(s.x, s.y) > sx(f.x, f.y) ? 1 : -1;
  s.dir = f.dir === 1 ? -1 : 1;
  f.back = s.back = false;
  // 앉아 있던 손님은 그대로 앉아서 이야기한다
  for (const b of [f, s]) {
    if (b.st !== 'sit') b.st = 'idle';
    b.t = Math.max(b.t, 3.6);
  }
  say(f, c[2], 1, 'chem');
  later(1.1, () => say(s, c[3], 1, 'chem'));
  later(1.9, () => floatW((f.x + s.x) / 2, (f.y + s.y) / 2, 34, '♥ 케미 +1', 'heart'));
  chemWait = A.chemCooldown;
  return true;
}

let chemWait = 0;
let chemScan = 0;
/** 1초마다: 쉬고 있는 손님 중 궁합 짝이 가까이 있으면 케미 (뜬 뒤엔 잠시 쉼) */
function scanChem(dt: number) {
  chemWait -= dt;
  chemScan -= dt;
  if (chemScan > 0 || chemWait > 0) return;
  chemScan = A.chemScanSeconds;
  for (const a of world.actors) {
    if (a.role || a.hidden || a.party || a.bub || (a.st !== 'idle' && a.st !== 'sit')) continue;
    if (chem(a)) return;
  }
}

/** 30fps 규칙 갱신 */
export function updActors(dt: number) {
  if (S.started && !S.visiting) scanChem(dt);
  for (const a of world.actors) {
    a.t -= dt;
    if (a.pop) a.pop = Math.max(0, a.pop - dt);
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
      // 화면 안쪽(위)으로 가면 뒷모습
      if (Math.abs(dx) + Math.abs(dy) > 0.01) a.back = dx + dy < 0;
      if (d <= sp) {
        a.x = nx[0];
        a.y = nx[1];
        a.path!.shift();
      } else {
        a.x += (dx / d) * sp;
        a.y += (dy / d) * sp;
      }
    } else if (a.party) {
      // 던전 안
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
  world.actors = world.actors.filter((a) => a.fading === undefined || a.fading > 0);
}

// ───────── 던전 파티: 파밍 루프 ─────────

const LOOT: ['n' | 'r' | 'e' | 'l', string, string][] = [
  ['r', '바람의 단검', 'sword'],
  ['e', '심연의 반지', 'ring'],
  ['r', '은빛 흉갑', 'armor'],
  ['n', '낡은 지도 조각', 'map'],
  ['l', '별조각 투구', 'helm'],
];

/** 아이템 아이콘 (한 번 그린 건 재사용 — PNG로 바꾸는 게 느리다) */
const ICON_CACHE: Record<string, string> = {};
function itemIcon(kind: string, rar: 'n' | 'r' | 'e' | 'l') {
  return (ICON_CACHE[kind + rar] ??= drawItemIcon(kind, rar));
}
function drawItemIcon(kind: string, rar: 'n' | 'r' | 'e' | 'l') {
  const c = canvas(16, 16);
  const p = P(c.getContext('2d')!);
  const col = { n: '#9a8a70', r: '#4f8fe0', e: '#a35bd6', l: '#f2a13a' }[rar];
  p.rect(0, 0, 16, 16, '#1c1018');
  p.rect(1, 1, 14, 14, dk(col, 0.45));
  p.rect(1, 1, 14, 1, col);
  p.rect(1, 14, 14, 1, col);
  p.rect(1, 1, 1, 14, col);
  p.rect(14, 1, 1, 14, col);
  if (kind === 'sword') {
    for (let i = 0; i < 7; i++) p.px(4 + i, 11 - i, '#e9eef7');
    p.rect(3, 10, 3, 3, '#e8b94a');
  }
  if (kind === 'ring') {
    p.ell(8, 9, 3.5, 3.5, '#e8b94a');
    p.ell(8, 9, 2, 2, dk(col, 0.45));
    p.rect(7, 3, 3, 3, '#c98ae0');
  }
  if (kind === 'armor') {
    p.rect(4, 4, 8, 8, '#c9d1dc');
    p.rect(6, 4, 4, 2, dk(col, 0.45));
  }
  if (kind === 'map') {
    p.rect(3, 4, 10, 8, '#e9dcc0');
    p.px(6, 7, '#b0412f');
    p.px(9, 9, '#b0412f');
  }
  if (kind === 'helm') {
    p.ell(8, 8, 4, 4, '#c9d1dc');
    p.rect(4, 8, 8, 3, '#c9d1dc');
    p.rect(6, 9, 4, 1, '#1c1018');
    p.px(8, 3, '#6fd0ff');
  }
  return c.toDataURL();
}

/** 부팅 때 아이템 아이콘을 미리 그려 둔다 (던전 귀환 순간에 끊기지 않게) */
export function warmItemIcons() {
  for (const [rar, , kind] of LOOT) itemIcon(kind, rar);
}

/** 15초마다: 2~3명이 파티로 던전 문까지 걸어가 사라짐 → 6초 뒤 귀환 + 아이템 + 금화 */
export function launchParty(blocked: boolean) {
  if (S.visiting || !S.started || blocked) return;
  const dg = findKind('dungeon');
  if (!dg) return;
  const D = CONFIG.dungeon;
  const pool = world.actors.filter((a) => !a.role && !a.hidden && !a.party && a.st !== 'in' && a.st !== 'door');
  if (pool.length < D.partyMin) return;
  const size = Math.min(D.partyMin + ((Math.random() * (D.partyMax - D.partyMin + 1)) | 0), pool.length);
  const team = pool.sort(() => Math.random() - 0.5).slice(0, size);
  const d = doorOf(dg);
  let arrived = 0;
  const members: Actor[] = [];
  for (const a of team) {
    const p = astar(a.x, a.y, d[0], d[1]);
    if (!p) continue;
    if (a.at) {
      a.at.inside = a.at.inside.filter((x) => x !== a);
      a.at = null;
    }
    a.party = true;
    a.path = p;
    a.st = 'walk';
    members.push(a);
  }
  if (members.length < D.partyMin) {
    for (const a of members) {
      a.party = false;
      a.path = null;
      a.st = 'idle';
      a.t = 0.5;
    }
    return;
  }
  say(members[0], pick(LINES.party), 1, 'chem');
  for (const a of members) {
    a.then = () => {
      a.hidden = true;
      a.st = 'in' as ActorState;
      puffAt(dg, '#b07aff', 6);
      if (++arrived === members.length) later(D.insideSeconds, back);
    };
  }
  function back() {
    const l = pick(LOOT);
    uiHooks.toastHtml(`<img src="${itemIcon(l[2], l[0])}" alt=""><span>던전 귀환 · <b class="r-${l[0]}">${l[1]}</b> 획득</span>`);
    const g = D_GOLD();
    floatW(d[0], d[1], 30, '+' + g);
    earn(g, 'dungeon');
    puffAt(dg!, '#ffd36b', 16);
    for (const a of members) {
      a.party = false;
      a.hidden = false;
      a.x = d[0];
      a.y = d[1];
      a.pop = 0.4;
      a.st = 'idle';
      a.t = 0.5;
    }
  }
}
const D_GOLD = () => CONFIG.economy.dungeonMin + ((Math.random() * (CONFIG.economy.dungeonMax - CONFIG.economy.dungeonMin + 1)) | 0);

export const ACT_TEXT: Record<string, string> = { walk: '걷는 중', idle: '쉬는 중', atk: '수련 중', pray: '밭일 중', sit: '불멍 중', in: '건물 안' };

/** 지금 하는 일 (창에 표시) */
export function doingText(a: Actor): string {
  if (a.party) return a.hidden ? '던전 원정 중' : '던전으로 가는 중';
  if (a.door) return a.door.dir === 'in' ? '들어가는 중' : '나오는 중';
  if (a.st === 'in' && a.at) return INSIDE_TEXT[def(a.at.kind).act!] ?? '머무는 중';
  return ACT_TEXT[a.st] ?? '';
}
