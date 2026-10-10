// 저장: 지금은 localStorage. 모양은 처음부터 서버에 그대로 올릴 수 있게
// {version, land, buildings[{kind,tx,ty,lvl,hue}], gold, day, adventurers[...], innName}
import { CATALOG, type Kind } from '../data/catalog';
import { GUEST_KINDS } from '../data/classes';
import { CONFIG } from '../data/config';
import { S, world, type Actor, type Building, type IncomeKind } from '../world/state';

export interface SavedBuilding {
  kind: Kind;
  tx: number;
  ty: number;
  lvl: number;
  hue: number | null;
}

export interface SavedAdventurer {
  kind: string;
  name: string;
  x: number;
  y: number;
  lvl: number;
  hp: number;
  food: number;
  mood: number;
}

export interface SaveData {
  version: number;
  savedAt: number;
  land: number;
  buildings: SavedBuilding[];
  gold: number;
  day: number;
  night: boolean;
  adventurers: SavedAdventurer[];
  innName: string;
  ledger: Record<IncomeKind, number>;
}

/** 지금 상태 → 저장 모양 (이웃 방문 중이면 보관해 둔 내 마을로) */
export function snapshot(): SaveData {
  const objs: Building[] = S.visiting && world.home ? world.home.objs : world.objs;
  const actors: Actor[] = S.visiting && world.home ? world.home.actors : world.actors;
  return {
    version: CONFIG.save.version,
    savedAt: Date.now(),
    land: S.visiting && world.home ? world.home.land : S.land,
    // 지금 자리 그대로 (레벨업한 건물은 커진 발판의 왼쪽 위)
    buildings: objs.map((o) => ({ kind: o.kind, tx: o.tx, ty: o.ty, lvl: o.lvl, hue: o.hue })),
    gold: S.gold,
    day: S.day,
    night: S.night,
    adventurers: actors
      .filter((a) => !a.role)
      .map((a) => ({ kind: a.kind, name: a.name, x: Math.round(a.x * 10) / 10, y: Math.round(a.y * 10) / 10, lvl: a.lvl, hp: a.hp, food: a.food, mood: a.mood })),
    innName: S.innName,
    ledger: { ...S.ledger },
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

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(CONFIG.save.key);
    if (!raw) return null;
    return validate(migrate(JSON.parse(raw)));
  } catch {
    return null;
  }
}

/**
 * 옛 버전 저장을 현재 모양으로 옮긴다.
 * 구조를 바꿀 때: CONFIG.save.version을 올리고 여기에 한 단계씩 추가한다.
 *   if (d.version === 1) d = { ...d, version: 2, 새필드: 기본값 };
 */
function migrate(d: any): any {
  if (!d || typeof d !== 'object' || typeof d.version !== 'number') return null;
  if (d.version !== CONFIG.save.version) return null;
  return d;
}

function validate(d: any): SaveData | null {
  if (!d || !Array.isArray(d.buildings)) return null;
  const buildings: SavedBuilding[] = d.buildings
    .filter((b: any) => b && b.kind in CATALOG && Number.isFinite(b.tx) && Number.isFinite(b.ty))
    .map((b: any) => ({ kind: b.kind, tx: b.tx, ty: b.ty, lvl: Math.max(1, num(b.lvl, 1)), hue: typeof b.hue === 'number' ? b.hue : null }));
  if (!buildings.some((b) => b.kind === 'inn')) return null;
  const adventurers: SavedAdventurer[] = (Array.isArray(d.adventurers) ? d.adventurers : [])
    .filter((a: any) => a && (GUEST_KINDS as readonly string[]).includes(a.kind))
    .map((a: any) => ({
      kind: a.kind, name: String(a.name ?? ''), x: num(a.x, 7), y: num(a.y, 7),
      lvl: num(a.lvl, 3), hp: num(a.hp, 80), food: num(a.food, 60), mood: num(a.mood, 70),
    }));
  const L = d.ledger ?? {};
  return {
    version: CONFIG.save.version,
    savedAt: num(d.savedAt, 0),
    land: Math.min(CONFIG.land.length, Math.max(1, Math.floor(num(d.land, 1)))),
    buildings,
    gold: num(d.gold, CONFIG.economy.startGold),
    day: Math.max(1, Math.floor(num(d.day, 1))),
    night: !!d.night,
    adventurers,
    innName: typeof d.innName === 'string' ? d.innName : '',
    ledger: { sleep: num(L.sleep, 0), drink: num(L.drink, 0), forge: num(L.forge, 0), bath: num(L.bath, 0), dungeon: num(L.dungeon, 0) },
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
