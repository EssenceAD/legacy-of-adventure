// 저장: 지금은 localStorage. 모양은 처음부터 서버에 그대로 올릴 수 있게
// v2 = {version, land, buildings[{kind,tx,ty,lvl,hue,plots}], gold, day, clock, adventurers[...], innName, ledger, progress}
// v1(1단계) 저장은 migrate()가 v2로 옮긴다: 손님은 모두 단골로, 밤 여부는 시계로.
import { CATALOG, START_TOWN, type Kind } from '../data/catalog';
import { CLASS_RACES, GUEST_KINDS, RACES, RARITIES, type GuestKind } from '../data/classes';
import { CONFIG } from '../data/config';
import { freshProgress, P, S, world, type Actor, type Building, type IncomeKind, type Progress } from '../world/state';

export interface SavedBuilding {
  kind: Kind;
  tx: number;
  ty: number;
  lvl: number;
  hue: number | null;
  plots?: { crop: string | null; at: number }[];
  /** 좌우 반전 (핫픽스 4, 예전 저장은 false) */
  flip?: boolean;
  /** 핫픽스 10: 지은 시각 · 마을 등급 장식 출신 */
  builtAt?: number;
  fromProp?: boolean;
  /** CONSTRUCTION_SPEC: 공사 중 (끝 시각은 현실 시간 — 앱을 꺼도 흐른다) */
  con?: import('../world/construct').Con;
  paid?: number;
}

/** 저장되는 손님 필드 (그림·이동 상태는 빼고) */
export type SavedAdventurer = Pick<
  Actor,
  'id' | 'kind' | 'name' | 'x' | 'y' | 'lvl' | 'xp' | 'hp' | 'food' | 'mood' | 'race' | 'rarity' | 'face' | 'hair' | 'status' | 'leaveDay' | 'moodSum' | 'moodN' | 'equip' | 'runId' | 'heroId' | 'legendId' | 'stars'
>;

export interface SaveData {
  version: number;
  savedAt: number;
  land: number;
  buildings: SavedBuilding[];
  gold: number;
  day: number;
  /** 06:00부터 흐른 게임 분 */
  clock: number;
  night: boolean;
  adventurers: SavedAdventurer[];
  innName: string;
  ledger: Record<IncomeKind, number>;
  progress: Progress;
}

const KEEP: (keyof SavedAdventurer)[] = ['id', 'kind', 'name', 'lvl', 'xp', 'race', 'rarity', 'face', 'hair', 'status', 'leaveDay', 'moodSum', 'moodN', 'equip', 'runId', 'heroId', 'legendId', 'stars'];
const r1 = (v: number) => Math.round(v * 10) / 10;

/** 지금 상태 → 저장 모양 (이웃 방문 중이면 보관해 둔 내 마을로) */
export function snapshot(): SaveData {
  const objs: Building[] = S.visiting && world.home ? world.home.objs : world.objs;
  const actors: Actor[] = S.visiting && world.home ? world.home.actors : world.actors;
  P.lastSeen = Date.now();
  return {
    version: CONFIG.save.version,
    savedAt: Date.now(),
    land: S.visiting && world.home ? world.home.land : S.land,
    buildings: objs.map((o) => ({ kind: o.kind, tx: o.tx, ty: o.ty, lvl: o.lvl, hue: o.hue, flip: !!o.flip, ...(o.plots ? { plots: o.plots } : {}), ...(o.builtAt ? { builtAt: o.builtAt } : {}), ...(o.fromProp ? { fromProp: true } : {}), ...(o.paid ? { paid: o.paid } : {}), ...(o.con ? { con: { ...o.con } } : {}) })),
    gold: S.gold,
    day: S.day,
    clock: S.clock,
    night: S.night,
    adventurers: actors
      .filter((a) => !a.role && !a.leaving && a.id)
      .map((a) => {
        const o = { x: r1(a.x), y: r1(a.y), hp: r1(a.hp), food: r1(a.food), mood: r1(a.mood) } as SavedAdventurer;
        for (const k of KEEP) if (a[k] !== undefined) (o as any)[k] = a[k];
        return o;
      }),
    innName: S.innName,
    ledger: { ...S.ledger },
    progress: P,
  };
}

export function writeSave(): void {
  if (!S.started && !S.innName) return; // 오프닝 도중엔 저장하지 않는다
  try {
    localStorage.setItem(CONFIG.save.key, JSON.stringify(snapshot()));
  } catch {
    /* 저장소가 막혀 있어도 게임은 계속 */
  }
}

export function hasSave(): boolean {
  return readSave() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(CONFIG.save.key);
  } catch {
    /* 무시 */
  }
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** 옛 저장을 옮기지 못했는가 (백업은 .bak 에 남아 있다) */
export let migrateFailed = false;
export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(CONFIG.save.key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    // 땅 개편(v7) 전 저장: 좌표를 옮기기 전에 원본을 한 번 남겨 둔다 (옮기다 실패해도 되살릴 수 있게)
    if (d && typeof d.version === 'number' && d.version < 7 && !localStorage.getItem(CONFIG.save.key + '.bak')) localStorage.setItem(CONFIG.save.key + '.bak', raw);
    const out = validate(migrate(d));
    if (!out && d && typeof d.version === 'number') migrateFailed = true;
    return out;
  } catch {
    return null;
  }
}

/** 땅 개편: 옛 저장(맵 14) 좌표 → 새 맵(24). dx = dy = 22 − 옛 땅 앞쪽 가장자리 */
export function bigMapShift(land: number): number {
  const st = Math.min(CONFIG.land.length, Math.max(1, Math.floor(land) || 1));
  return CONFIG.land[st - 1].to - CONFIG.oldLandTo[st - 1];
}
function moveToBigMap(d: any): any {
  const k = bigMapShift(num(d.land, 1));
  const N = CONFIG.map.size;
  const buildings = (Array.isArray(d.buildings) ? d.buildings : []).map((b: any) => {
    if (!b || !Number.isFinite(b.tx) || !Number.isFinite(b.ty)) return b;
    const sz = b.kind in CATALOG ? CATALOG[b.kind as keyof typeof CATALOG].size : [1, 1];
    // 고정 건물(던전)이 맵 밖으로 나가면(1단계 저장) 새 게임 던전 자리로
    if (b.tx + k + sz[0] > N || b.ty + k + sz[1] > N) {
      const home = START_TOWN.find(([kk]) => kk === b.kind);
      if (home) return { ...b, tx: home[1], ty: home[2] };
      return { ...b, tx: Math.min(N - sz[0], b.tx + k), ty: Math.min(N - sz[1], b.ty + k) };
    }
    return { ...b, tx: b.tx + k, ty: b.ty + k };
  });
  const adventurers = (Array.isArray(d.adventurers) ? d.adventurers : []).map((a: any) => (a && Number.isFinite(a.x) ? { ...a, x: a.x + k, y: a.y + k } : a));
  const moved = d.progress?.harmony?.moved;
  const harmony = Array.isArray(moved)
    ? { ...d.progress.harmony, moved: moved.map((key: string) => String(key).replace(/@(-?\d+),(-?\d+)$/, (_m: string, x: string, y: string) => `@${+x + k},${+y + k}`)) }
    : d.progress?.harmony;
  return { ...d, buildings, adventurers, progress: d.progress ? { ...d.progress, ...(harmony ? { harmony } : {}) } : d.progress };
}

/**
 * 옛 버전 저장을 현재 모양으로 옮긴다. 한 단계씩.
 *  v1 → v2: 손님은 모두 단골(번호·종족 부여), 밤이면 22:00 / 낮이면 06:00, 진행 데이터는 새로.
 */
export function migrate(d: any): any {
  if (!d || typeof d !== 'object' || typeof d.version !== 'number') return null;
  if (d.version === 1) {
    const p = freshProgress();
    const advs = (Array.isArray(d.adventurers) ? d.adventurers : []).map((a: any) => ({
      ...a,
      id: p.nextAdvId++,
      xp: 0,
      race: CLASS_RACES[a.kind as GuestKind]?.[0] ?? 'human',
      rarity: 'common',
      status: 'regular',
      leaveDay: 0,
      moodSum: 0,
      moodN: 0,
      equip: { weapon: null, armor: null, acc: null },
      runId: null,
    }));
    for (const a of advs) p.dex.guests.push(`${a.race}|${a.kind}|common`);
    p.dex.guests = [...new Set(p.dex.guests)];
    p.lastSeen = num(d.savedAt, Date.now());
    d = { ...d, version: 2, clock: d.night ? (CONFIG.clock.nightStartHour - CONFIG.clock.dayStartHour) * 60 : 0, adventurers: advs, progress: p };
  }
  // v2 → v3 (3단계): 진행 데이터에 토벌·전설 칸이 늘었을 뿐 — 빠진 칸은 mergeProgress가 기본값으로 채운다
  if (d.version === 2) d = { ...d, version: 3 };
  // v3 → v4 (4단계): 주인·인연·유산 칸이 늘었다. 주인이 없으면(null) 다음 접속 때 「당신은 누구였나요?」 창으로 만든다
  if (d.version === 3) d = { ...d, version: 4 };
  // v4 → v5 (5단계): 임무·사냥 칸이 늘었다. 예전 저장은 기능을 잠그지 않는다(legacy) — 임무는 이미 한 일부터 바로 완료
  if (d.version === 4) d = { ...d, version: 5, progress: { ...(d.progress ?? {}), guide: { ...(d.progress?.guide ?? {}), legacy: true } } };
  // 베타(v6): 어울림·평가단·정산·사건 — 이미 성립한 어울림은 처음 돌아갈 때 우편 보상으로 (world/beta.ts)
  if (d.version === 5) d = { ...d, version: 6, progress: { ...(d.progress ?? {}), harmony: { ...(d.progress?.harmony ?? {}), migrate: true } } };
  // v6 → v7 땅 개편: 맵 14 → 24. 옛 마을을 새 땅의 앞쪽(입구) 가장자리에 맞춰 옮긴다 — 같은 단계여도 뒤·옆이 넓어진 모양
  if (d.version === 6) d = { ...moveToBigMap(d), version: 7 };
  if (d.version !== CONFIG.save.version) return null;
  return d;
}

/** 빠진 칸은 기본값으로 (한 단계 깊이까지 합친다) */
function mergeProgress(src: any): Progress {
  const base = freshProgress() as any;
  if (!src || typeof src !== 'object') return base;
  for (const k of Object.keys(base)) {
    const v = src[k];
    if (v === undefined || v === null) continue;
    const b = base[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && typeof v === 'object' && !Array.isArray(v)) base[k] = { ...b, ...v };
    else if (Array.isArray(b) === Array.isArray(v) && typeof b === typeof v) base[k] = v;
  }
  return base as Progress;
}

/** CONSTRUCTION_SPEC §6: 공사 기록이 멀쩡한가 (옛 저장엔 없음 → 공사 중이던 건 바로 완성) */
function validCon(c: any): boolean {
  return !!c && (c.kind === 'new' || c.kind === 'up') && Number.isFinite(c.end) && Number.isFinite(c.total) && c.total > 0 && Number.isFinite(c.to) && Number.isFinite(c.cut) && Number.isFinite(c.cost);
}

function validate(d: any): SaveData | null {
  if (!d || !Array.isArray(d.buildings)) return null;
  const buildings: SavedBuilding[] = d.buildings
    .filter((b: any) => b && b.kind in CATALOG && Number.isFinite(b.tx) && Number.isFinite(b.ty))
    .map((b: any) => ({
      kind: b.kind, tx: b.tx, ty: b.ty, lvl: Math.max(1, num(b.lvl, 1)), hue: typeof b.hue === 'number' ? b.hue : null, flip: b.flip === true,
      ...(typeof b.builtAt === 'number' ? { builtAt: b.builtAt } : {}), ...(b.fromProp === true ? { fromProp: true } : {}),
      ...(validCon(b.con) ? { con: b.con } : {}), ...(typeof b.paid === 'number' ? { paid: b.paid } : {}),
      ...(Array.isArray(b.plots) ? { plots: b.plots.map((p: any) => ({ crop: typeof p?.crop === 'string' ? p.crop : null, at: num(p?.at, 0) })) } : {}),
    }));
  if (!buildings.some((b) => b.kind === 'inn')) return null;
  const progress = mergeProgress(d.progress);
  const ids = new Set<number>();
  const adventurers: SavedAdventurer[] = (Array.isArray(d.adventurers) ? d.adventurers : [])
    .filter((a: any) => a && (GUEST_KINDS as readonly string[]).includes(a.kind))
    .map((a: any) => {
      let id = Math.floor(num(a.id, 0));
      if (!id || ids.has(id)) id = progress.nextAdvId++;
      ids.add(id);
      progress.nextAdvId = Math.max(progress.nextAdvId, id + 1);
      const eq = a.equip ?? {};
      return {
        id, kind: a.kind, name: String(a.name ?? ''), x: num(a.x, 7), y: num(a.y, 7),
        lvl: Math.max(1, num(a.lvl, 3)), xp: num(a.xp, 0), hp: num(a.hp, 80), food: num(a.food, 60), mood: num(a.mood, 70),
        race: (RACES as string[]).includes(a.race) ? a.race : 'human',
        rarity: (RARITIES as string[]).includes(a.rarity) ? a.rarity : 'common',
        face: a.face && typeof a.face === 'object' ? a.face : undefined,
        hair: typeof a.hair === 'string' ? a.hair : undefined,
        status: ['visitor', 'regular', 'hero', 'passer'].includes(a.status) ? a.status : 'regular',
        leaveDay: num(a.leaveDay, 0), moodSum: num(a.moodSum, 0), moodN: num(a.moodN, 0),
        equip: { weapon: eq.weapon ?? null, armor: eq.armor ?? null, acc: eq.acc ?? null },
        runId: typeof a.runId === 'number' ? a.runId : null,
        heroId: typeof a.heroId === 'string' ? a.heroId : undefined,
        legendId: typeof a.legendId === 'string' ? a.legendId : undefined,
        stars: typeof a.stars === 'number' ? a.stars : undefined,
      } as SavedAdventurer;
    });
  const L = d.ledger ?? {};
  return {
    version: CONFIG.save.version,
    savedAt: num(d.savedAt, 0),
    land: Math.min(CONFIG.land.length, Math.max(1, Math.floor(num(d.land, 1)))),
    buildings,
    gold: num(d.gold, CONFIG.economy.startGold),
    day: Math.max(1, Math.floor(num(d.day, 1))),
    clock: Math.max(0, Math.min(24 * 60 - 1, num(d.clock, 0))),
    night: !!d.night,
    adventurers,
    innName: typeof d.innName === 'string' ? d.innName : '',
    ledger: { sleep: num(L.sleep, 0), drink: num(L.drink, 0), forge: num(L.forge, 0), bath: num(L.bath, 0), dungeon: num(L.dungeon, 0), stall: num(L.stall, 0) },
    progress,
  };
}

// ───────── 제보 편지 (지금은 쌓아 두기만) ─────────

export interface Report {
  kind: string;
  text: string;
  at: number;
}

export function addReport(r: Report) {
  try {
    const list: Report[] = JSON.parse(localStorage.getItem(CONFIG.save.reportKey) || '[]');
    list.push(r);
    localStorage.setItem(CONFIG.save.reportKey, JSON.stringify(list));
  } catch {
    /* 무시 */
  }
}

// ───────── 작은 설정들 (좋아요한 이웃, 읽은 공지) ─────────

export function getPref<T>(key: string, d: T): T {
  try {
    const v = localStorage.getItem('legacy-of-adventure-' + key);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
}
export function setPref(key: string, v: unknown) {
  try {
    localStorage.setItem('legacy-of-adventure-' + key, JSON.stringify(v));
  } catch {
    /* 무시 */
  }
}
