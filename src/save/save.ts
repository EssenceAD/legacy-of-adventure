// 저장: 지금은 localStorage. 모양은 처음부터 서버에 그대로 올릴 수 있게
// v2 = {version, land, buildings[{kind,tx,ty,lvl,hue,plots}], gold, day, clock, adventurers[...], innName, ledger, progress}
// v1(1단계) 저장은 migrate()가 v2로 옮긴다: 손님은 모두 단골로, 밤 여부는 시계로.
import { CATALOG, type Kind } from '../data/catalog';
import { CLASS_RACES, GUEST_KINDS, RACES, RARITIES, type GuestKind } from '../data/classes';
import { CONFIG } from '../data/config';
import { teaserView } from '../world/grade';
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
  'id' | 'kind' | 'name' | 'x' | 'y' | 'lvl' | 'xp' | 'hp' | 'food' | 'mood' | 'race' | 'rarity' | 'face' | 'hair' | 'status' | 'leaveDay' | 'moodSum' | 'moodN' | 'equip' | 'runId' | 'heroId' | 'legendId' | 'stars' | 'starId'
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

const KEEP: (keyof SavedAdventurer)[] = ['id', 'kind', 'name', 'lvl', 'xp', 'race', 'rarity', 'face', 'hair', 'status', 'leaveDay', 'moodSum', 'moodN', 'equip', 'runId', 'heroId', 'legendId', 'stars', 'starId'];
const r1 = (v: number) => Math.round(v * 10) / 10;

/** 지금 상태 → 저장 모양 (이웃 방문 중이면 보관해 둔 내 마을로) */
/** CHECKIN §C2: 저장 모양을 만들기 직전 (ui/prefsSync가 설정값을 P.prefs에 넣는다 · save가 ui를 부르지 않게 고리로) */
export const saveHooks = { beforeSnapshot: () => {} };
/** CHECKIN §C2: 세이브에 실어 나르는 설정 키 (이것 말고는 세이브가 localStorage를 건드리지 못한다) */
export const SYNC_PREF_KEYS = [
  'sound', 'saver', 'shake', 'fontStep', 'rumorOff', 'settleOff', 'goalPillOff', 'wfBubOff', 'propCard', 'chemNotice', 'propFilter', 'storyInbox',
  'telemetry', 'keys', 'guestFavPin', 'haptics', 'dmgNums', 'ssAuto', 'ssWake', 'guestNames', 'quietOff',
] as const;
/** 세이브에 든 설정값 검사 (모양이 이상하면 없는 것으로 · 아는 키 · 문자열만) */
export function validPrefs(p: any): import('../world/state').PrefsBlob | undefined {
  if (!p || typeof p !== 'object' || !Number.isFinite(p.at) || !p.v || typeof p.v !== 'object' || Array.isArray(p.v)) return undefined;
  const v: Record<string, string> = {};
  for (const k of SYNC_PREF_KEYS) if (typeof p.v[k] === 'string' && p.v[k].length < 4000) v[k] = p.v[k];
  return { at: p.at, v };
}

export function snapshot(): SaveData {
  saveHooks.beforeSnapshot();
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

/** HARVEST §3: 계정 삭제 중엔 저장을 멈춘다 (지운 뒤 다시 써 넣지 않게) */
let saveHalted = false;
export const haltSaves = (on = true) => void (saveHalted = on);
export const savesHalted = () => saveHalted;

// ───────── 새 버전 저장 지키기 (플래그 없음 · 늘 켜짐) ─────────
//  이 클라이언트가 아는 것보다 높은 버전(CONFIG.save.version 초과)의 저장 = 새 버전 앱이 만든 것.
//  옮기거나 검사하지 않고 원본 그대로 두고, 이 탭에서는 덮어쓰기·지우기·클라우드 올리기를 모두 막는다 (새로고침하면 새 버전이 읽는다).
let futureSave = false;
export const FUTURE_SAVE_TEXT = '새 버전이 있어요 · 새로고침해 주세요';
/** 새 버전 저장을 만났나 (이 세션 동안 계속) */
export const isFutureSave = () => futureSave;
/** 처음 만났을 때 한 번 (ui/update가 「새 버전이 있어요」 띠를 건다 · save가 ui를 부르지 않게 고리로) */
export const futureHooks = { found: () => {} };
/** 저장 버전이 이 클라이언트보다 높은가 */
export const isFutureVersion = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > CONFIG.save.version;
export function markFutureSave() {
  if (futureSave) return;
  futureSave = true;
  try {
    futureHooks.found();
  } catch {
    /* 띠를 못 걸어도 막기는 그대로 */
  }
}
/** 시험용: 새 버전 저장 표시 지우기 */
export const _resetFutureSave = () => void (futureSave = false);
/** 저장소에 있는 원본이 새 버전 저장인가 (있으면 표시) */
function checkStoredFuture(raw?: string | null): boolean {
  try {
    const r = raw === undefined ? localStorage.getItem(CONFIG.save.key) : raw;
    if (r && isFutureVersion(JSON.parse(r)?.version)) markFutureSave();
  } catch {
    /* 읽지 못하면 그냥 둔다 */
  }
  return futureSave;
}
let storedChecked = false;
// 다른 탭(새 버전)이 저장을 바꾸면 바로 알아챈다 — 이 탭의 자동 저장이 덮지 않게
try {
  addEventListener('storage', (e) => {
    if (e.key === CONFIG.save.key && e.newValue) checkStoredFuture(e.newValue);
  });
} catch {
  /* window가 없는 환경 */
}

export function writeSave(): void {
  if (saveHalted || futureSave) return;
  // 처음 한 번은 저장소 원본을 직접 본다 (readSave를 아직 안 불렀어도 새 버전 저장을 덮지 않게)
  if (!storedChecked) {
    storedChecked = true;
    if (checkStoredFuture()) return;
  }
  if (!S.started && !S.innName) return; // 오프닝 도중엔 저장하지 않는다
  // 버그 고침(플래그 없음): 시작 전 연출 마을(티저·타이틀 배경 · 가짜)은 저장하지 않는다 (원정 기록 보내기 등이 그때 불러도)
  if (!S.started && teaserView.g >= 0) return;
  try {
    localStorage.setItem(CONFIG.save.key, JSON.stringify(snapshot()));
  } catch {
    /* 저장소가 막혀 있어도 게임은 계속 */
  }
}

export function hasSave(): boolean {
  // 새 버전 저장도 「있음」 (타이틀이 덮어쓰는 새 시작을 권하지 않게)
  return readSave() !== null || futureSave;
}

export function clearSave() {
  // 새 버전 저장은 지우지 않는다 (새로고침해서 새 버전으로)
  if (futureSave || checkStoredFuture()) return;
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
    storedChecked = true;
    // 새 버전 저장: 옮기지도 검사하지도 않고 원본 그대로 · 이 탭은 쓰기를 멈춘다
    if (d && isFutureVersion(d.version)) {
      markFutureSave();
      return null;
    }
    // 땅 개편(v7) 전 저장: 좌표를 옮기기 전에 원본을 한 번 남겨 둔다 (옮기다 실패해도 되살릴 수 있게)
    if (d && typeof d.version === 'number' && d.version < 7 && !localStorage.getItem(CONFIG.save.key + '.bak')) localStorage.setItem(CONFIG.save.key + '.bak', raw);
    // LAND2(v8): 맵 32로 좌표를 옮기기 전 원본을 따로 한 번 (.bak7)
    if (d && typeof d.version === 'number' && d.version < 8 && !localStorage.getItem(CONFIG.save.key + '.bak7')) localStorage.setItem(CONFIG.save.key + '.bak7', raw);
    // LAND10(v9): 맵 44로 좌표를 옮기기 전 원본을 따로 한 번 (.bak8)
    if (d && typeof d.version === 'number' && d.version < 9 && !localStorage.getItem(CONFIG.save.key + '.bak8')) localStorage.setItem(CONFIG.save.key + '.bak8', raw);
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
  // v7(맵 24) 기준 그대로 (LAND2 뒤에도 이 단계는 바뀌지 않게)
  return CONFIG.v7.landTo - CONFIG.oldLandTo[st - 1];
}
function moveToBigMap(d: any): any {
  const k = bigMapShift(num(d.land, 1));
  const N = CONFIG.v7.mapSize;
  const buildings = (Array.isArray(d.buildings) ? d.buildings : []).map((b: any) => {
    if (!b || !Number.isFinite(b.tx) || !Number.isFinite(b.ty)) return b;
    const sz = b.kind in CATALOG ? CATALOG[b.kind as keyof typeof CATALOG].size : [1, 1];
    // 고정 건물(던전)이 맵 밖으로 나가면(1단계 저장) 새 게임 던전 자리로
    if (b.tx + k + sz[0] > N || b.ty + k + sz[1] > N) {
      // v7 때의 새 게임 던전 자리 (LAND2 뒤 START_TOWN은 +8이라 쓰지 않는다)
      if (b.kind === 'dungeon') return { ...b, tx: CONFIG.v7.dungeon[0], ty: CONFIG.v7.dungeon[1] };
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

/** LAND2(v7→v8): 맵 24 → 32 · 모든 칸 좌표 +8 (건물·공사 원래 자리·손님·옮긴 등급 장식·칠한 칸·둥근 모서리·지운 자동 길) */
const shiftKey = (k: string, n: number) => k.replace(/^(-?\d+),(-?\d+)$/, (_m, x: string, y: string) => `${+x + n},${+y + n}`);
const shiftMap = (o: unknown, n: number) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.entries(o as Record<string, unknown>).map(([k, v]) => [shiftKey(k, n), v])) : o);
export function moveToV8(d: any): any {
  return shiftSave(d, CONFIG.v7.shift);
}
/** LAND10(v8→v9): 맵 32 → 44 · 모든 칸 좌표 +12 (v8 것 + 옮긴 입구 x · 던전 숲속 원래 자리) — 땅 8~10단계가 뒤·옆으로 커질 자리 */
export function moveToV9(d: any): any {
  return shiftSave(d, CONFIG.v8.shift);
}
/** 등급 장식 옛 이름표 「종류@x,y」(· 자리 id 없는 「종류@slot:x,y」) 좌표 옮기기 — 「@slot:id」는 그대로 */
const shiftGradeKey = (key: string, k: number) => String(key).replace(/@(slot:)?(-?\d+),(-?\d+)$/, (_m: string, sl: string | undefined, x: string, y: string) => `@${sl ?? ''}${+x + k},${+y + k}`);
function shiftSave(d: any, k: number): any {
  const buildings = (Array.isArray(d.buildings) ? d.buildings : []).map((b: any) => {
    if (!b || !Number.isFinite(b.tx) || !Number.isFinite(b.ty)) return b;
    const con = b.con && Array.isArray(b.con.from) ? { ...b.con, from: [b.con.from[0] + k, b.con.from[1] + k] } : b.con;
    return { ...b, tx: b.tx + k, ty: b.ty + k, ...(con ? { con } : {}) };
  });
  const adventurers = (Array.isArray(d.adventurers) ? d.adventurers : []).map((a: any) => (a && Number.isFinite(a.x) && Number.isFinite(a.y) ? { ...a, x: a.x + k, y: a.y + k } : a));
  const pr = d.progress;
  if (!pr || typeof pr !== 'object') return { ...d, buildings, adventurers };
  const moved = pr.harmony?.moved;
  const harmony = Array.isArray(moved) ? { ...pr.harmony, moved: moved.map((key: string) => shiftGradeKey(key, k)) } : pr.harmony;
  const dc = pr.decor;
  // LAND10: 옮긴 입구 x(entX) · 던전 숲속 원래 자리(dgHome)도 같이 (FEEDBACK23 뒤에 생긴 칸 · 없으면 그대로)
  const decor =
    dc && typeof dc === 'object'
      ? {
          ...dc,
          paint: shiftMap(dc.paint, k),
          round: shiftMap(dc.round, k),
          noPath: shiftMap(dc.noPath, k),
          ...(typeof dc.entX === 'number' && Number.isFinite(dc.entX) ? { entX: dc.entX + k } : {}),
          ...(Array.isArray(dc.dgHome) && dc.dgHome.length === 2 && dc.dgHome.every(Number.isFinite) ? { dgHome: [dc.dgHome[0] + k, dc.dgHome[1] + k] } : {}),
        }
      : dc;
  return { ...d, buildings, adventurers, progress: { ...pr, ...(harmony ? { harmony } : {}), ...(decor ? { decor } : {}) } };
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
  // v7 → v8 LAND2: 맵 24 → 32 · 모든 좌표 +8 (땅 6·7단계가 뒤·옆으로 커질 자리)
  if (d.version === 7) d = { ...moveToV8(d), version: 8 };
  // v8 → v9 LAND10: 맵 32 → 44 · 모든 좌표 +12 (땅 8·9·10단계가 뒤·옆으로 커질 자리)
  if (d.version === 8) d = { ...moveToV9(d), version: 9 };
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
  // CHECKIN §C2: 설정값 (옵션 칸 · 없으면 그대로 없음)
  const pf = validPrefs(d.progress?.prefs);
  if (pf) progress.prefs = pf;
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
        // FIVESTARS: 신화 영웅 「다섯 별」 (옛 저장엔 없음)
        ...(typeof a.starId === 'string' ? { starId: a.starId } : {}),
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
