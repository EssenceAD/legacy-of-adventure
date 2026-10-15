// RAIDWEAPON §2 전용 무기 (플래그 exWeapons · 실험실 vis) — 화면 없는 규칙 (화면은 ui/exWeapons.ts · 끼우는 조건은 exGate.ts)
//  · 19자루 (data/exweapons) · 등급은 유물(a) 그대로(강화·초월·재련 같은 규칙) + item.ex = 주인 키 → 이름표 「전용」
//  · 바탕 능력치 = 그 사람이 열 수 있는 가장 높은 지역(사냥 지역이 열린 곳 중 고유 장비가 있는 지역)의 고유 무기 × exMult (무작위 없음 · 가운데 값)
//  · 옵션 = 고정 1 (그 영웅 스킬 k · 스킬 값 × fixedPct · 재련 불가 u) + 일반 rolled개 (고유 장비와 같은 굴림)
//  · 무기 조각 perBox개 = 선택 상자 1 → 영입한 영웅 중 아직 전용 무기가 없는 사람 (다 있으면 아무나 = 같은 무기 하나 더 · 재료/전수용)
//  · 조각 나오는 곳: 주간 토벌(raid.ts settle) · 심연 25층마다(abyss.ts clearFloor · 주마다 새 층만) · 회관 「토벌 전리품」(bundles.ts · 옛 저장도 1번)
import { CLASS_WEAPON, GUEST_KINDS, type GuestKind } from '../data/classes';
import { CONFIG } from '../data/config';
import { EX_WEAPONS, exDef, type ExWeaponDef } from '../data/exweapons';
import { isStarId, STARS } from '../data/fivestars';
import { OPT_INFO, REGIONS, ROLL_KEYS, BASE_REGIONS, type OptKey, type RegionId } from '../data/items';
import { legendByKey } from '../data/legends';
import { UNIQUES } from '../data/story/uniques';
import { exOwnerKey, exOwnerName } from './exGate';
import { addFrags, exOn, rwState } from './frags';
import { kstWeek } from './goldsink';
import { huntRegionOpen } from './hunt';
import { addToBag } from './items';
import { markDirty, P, world, type Actor, type Item, type ItemOpt } from './state';

const X = () => CONFIG.raidWeapon.ex;
const F = () => CONFIG.raidWeapon.frag;
const homeActors = (): Actor[] => world.home?.actors ?? world.actors;

export { EX_WEAPONS, exDef };

// ───────── 무기 만들기 ─────────

/** 그 영웅 스킬 (전설 · 다섯 별) */
export function exSkill(d: ExWeaponDef): { k: OptKey; v: number; region?: RegionId } | null {
  if (d.owner === 'star') return isStarId(d.id) ? { k: STARS[d.id].skill.k, v: STARS[d.id].skill.v } : null;
  const s = legendByKey(d.id)?.skill;
  return s ? { k: s.k, v: s.v, region: s.region } : null;
}
/** 그 영웅 직업 (무기 종류 = 직업 무기 · 「딱 맞아요」) */
export function exKind(d: ExWeaponDef): GuestKind {
  const k = d.owner === 'star' && isStarId(d.id) ? STARS[d.id].kind : legendByKey(d.id)?.kind;
  return k && (GUEST_KINDS as readonly string[]).includes(k) ? (k as GuestKind) : 'knight';
}
/** 바탕 지역: 사냥 지역이 열린 곳 중 고유 무기가 있는 가장 높은 지역 (없으면 첫 지역) */
export function exBaseRegion(): RegionId {
  let best = 0;
  for (let i = 0; i < REGIONS.length; i++) if (UNIQUES.some((u) => u.slot === 'weapon' && u.region === REGIONS[i].id) && (i === 0 || huntRegionOpen(i))) best = i;
  return REGIONS[best].id;
}
/** 바탕 능력치 (공격 · 마력) — 고유 무기(유물) 가운데 값 × exMult */
export function exBaseStats(region: RegionId): { atk: number; mag: number } {
  const ri = REGIONS.findIndex((r) => r.id === region);
  const scale = 6 * Math.pow(CONFIG.items.regionStat, ri) * CONFIG.items.gradeMult.a * X().exMult;
  return { atk: Math.round(scale), mag: Math.round(scale * 0.5 * 0.95) };
}
/** 고정 옵션 (그 영웅 스킬 k를 스킬 값 × fixedPct 만큼) */
export function exFixedOpt(d: ExWeaponDef): ItemOpt | null {
  const s = exSkill(d);
  if (!s) return null;
  const v = Math.max(1, Math.round(s.v * X().fixedPct));
  return s.k === 'regionDmg' ? { k: s.k, v, region: s.region ?? 'abyss', u: true } : { k: s.k, v, u: true };
}

/** 전용 무기 한 자루 (가방에 넣지 않음) */
export function makeEx(id: string, rng: () => number = Math.random, region: RegionId = exBaseRegion()): Item | null {
  const d = exDef(id);
  if (!d) return null;
  const ri = REGIONS.findIndex((r) => r.id === region);
  const opts: ItemOpt[] = [];
  const fx = exFixedOpt(d);
  if (fx) opts.push(fx);
  for (let i = 0; i < X().rolled; i++) {
    const pool = ROLL_KEYS.filter((x) => !opts.some((o) => o.k === x));
    const k = pool[Math.floor(rng() * pool.length)];
    const inf = OPT_INFO[k];
    const v = Math.round((inf.min + rng() * (inf.max - inf.min)) * (1 + 0.25 * ri));
    const regs = REGIONS.slice(0, Math.max(BASE_REGIONS, ri + 1));
    opts.push(k === 'regionDmg' ? { k, v, region: regs[Math.floor(rng() * regs.length)].id } : { k, v });
  }
  return {
    id: P.nextItemId++, region, slot: 'weapon', grade: 'a', wkind: CLASS_WEAPON[exKind(d)], name: d.name,
    stats: exBaseStats(region), opts, enh: 0, set: false, ex: d.id,
  };
}

/** 받음: 가방 · 받은 수 (도감 ✦) */
export function grantEx(id: string, rng: () => number = Math.random): Item | null {
  const it = makeEx(id, rng);
  if (!it) return null;
  addToBag(it);
  const st = rwState();
  st.got[id] = (st.got[id] ?? 0) + 1;
  markDirty();
  return it;
}
/** 가진 적 있나 (받은 수 또는 가방에 있음) */
export const exOwned = (id: string): boolean => (rwState().got[id] ?? 0) > 0 || P.bag.some((x) => x.ex === id);
export const exOwnedN = (): number => EX_WEAPONS.filter((d) => exOwned(d.id)).length;

// ───────── 선택 상자 ─────────

/** 열 수 있는 상자 수 (따로 받은 상자 + 조각 perBox개마다 1) */
export const boxCount = (): number => rwState().boxes + Math.floor(rwState().frags / F().perBox);
/** 다음 상자까지 조각 (0 ~ perBox−1 · 진행 막대) */
export const fragsToBox = (): number => rwState().frags % F().perBox;

/** 영입한 영웅 키 (전설 · 다섯 별 — 집에 있는 영웅) */
export function recruitedKeys(): string[] {
  const out: string[] = [];
  for (const a of homeActors()) {
    if (a.status !== 'hero') continue;
    const k = exOwnerKey(a);
    if (k && exDef(k) && !out.includes(k)) out.push(k);
  }
  return EX_WEAPONS.map((d) => d.id).filter((k) => out.includes(k));
}
/** 상자에서 고를 수 있는 무기: 영입한 영웅 중 아직 없는 사람 · 다 있으면 영입한 모두 (dup = 같은 무기 하나 더) */
export function boxChoices(): { defs: ExWeaponDef[]; dup: boolean } {
  const keys = recruitedKeys();
  const missing = keys.filter((k) => !exOwned(k));
  if (missing.length) return { defs: missing.map((k) => exDef(k)!), dup: false };
  return { defs: keys.map((k) => exDef(k)!), dup: keys.length > 0 };
}
/** 상자 열기 (id = 고른 무기) — 막히면 이유(글자), 되면 받은 무기 */
export function openBox(id: string, rng: () => number = Math.random): Item | string {
  if (!exOn()) return '아직 열 수 없어요';
  if (boxCount() < 1) return `무기 조각 ${F().perBox}개를 모으면 상자 하나예요`;
  const ch = boxChoices();
  if (!ch.defs.length) return '전설이나 다섯 별 영웅을 먼저 영입해요';
  if (!ch.defs.some((d) => d.id === id)) return '고를 수 없는 무기예요';
  const st = rwState();
  if (st.boxes > 0) st.boxes--;
  else st.frags -= F().perBox;
  return grantEx(id, rng)!;
}
/** 상자 하나 더하기 (월드 레이드 상위 등 · §3) */
export function addBox(n: number, _src: string): void {
  if (!exOn() || !(n > 0)) return;
  rwState().boxes += Math.floor(n);
  markDirty();
}

// ───────── 조각 나오는 곳 ─────────

/** 주간 토벌 처치 (settle): 첫 보스 raidFirst · 연속 2·3번째는 raidChainP 확률로 raidChainN — 준 수 */
export function raidFrags(chain: number, rng: () => number = Math.random): number {
  if (!exOn()) return 0;
  const n = chain <= 1 ? F().raidFirst : rng() < F().raidChainP ? F().raidChainN : 0;
  if (n > 0) addFrags(n, chain <= 1 ? 'raid' : 'raidChain');
  return n;
}
/** 심연 층을 깸 (한 층씩 · 보스 연전 모두): abyssEvery층마다 abyssN — 이번 주(한국 시간)에 아직 조각을 안 준 층만 · 준 수 */
export function abyssFrags(floor: number, now = Date.now(), src = 'abyss'): number {
  if (!exOn() || floor <= 0 || floor % F().abyssEvery) return 0;
  const st = rwState();
  const wk = kstWeek(now);
  if (st.abyssWk !== wk) {
    st.abyssWk = wk;
    st.abyssHi = 0;
  }
  if (floor <= st.abyssHi) return 0;
  st.abyssHi = floor;
  addFrags(F().abyssN, src);
  return F().abyssN;
}
/** 마을 회관 「토벌 전리품」 방 완성: 조각 bundle (1번만 · 이미 고친 옛 저장도 켜지면 한 번) — 준 수 */
export function bundleFrags(): number {
  if (!exOn()) return 0;
  const st = rwState();
  const rooms = P.bundles?.rooms;
  if (st.bundle || !Array.isArray(rooms) || !rooms.includes(F().bundleRoom)) return 0;
  st.bundle = true;
  addFrags(F().bundle, 'bundle');
  return F().bundle;
}
/** 불러온 뒤 · 창 열 때: 놓친 것 한 번 (회관 방) */
export function exRetro(): void {
  bundleFrags();
}

// ───────── 전수 (전용 → 전용 · 고유·유물 → 전용 한 방향) ─────────

/** 전수 규칙 ('' = 괜찮음): 전용 → 전용 · 고유·유물(유물 등급) → 전용 (한 방향) · 전용 → 일반/고유/유물은 막힘 */
export function exTransferWhy(giver: Pick<Item, 'ex' | 'grade'>, recv: Pick<Item, 'ex' | 'grade'>): string {
  if (!!giver.ex === !!recv.ex) return '';
  if (giver.ex) return '전용 무기의 강화는 다른 전용 무기에게만 물려줄 수 있어요';
  return giver.grade === 'a' ? '' : '전용 무기는 고유·유물 장비나 다른 전용 무기에게서만 강화를 받아요';
}

// ───────── 첫 깨어남 「강화 이어받기」 (영웅마다 1번 · 무료) ─────────

/** 이어받기 미리 보기: 그 영웅이 처음 전용 무기를 낄 때 · 지금 낀 무기가 전용 무기보다 강화가 높으면 → { old, enh } · 아니면 null */
export function exInheritPlan(a: Actor, it: Item): { old: Item; enh: number } | null {
  if (!exOn() || !it.ex || it.slot !== 'weapon') return null;
  if (exOwnerKey(a) !== it.ex) return null;
  const st = rwState();
  if (st.inh.includes(it.ex) || st.awoke.includes(it.ex)) return null;
  const old = P.bag.find((x) => x.id === a.equip.weapon);
  if (!old || old === it || old.ex || !(old.enh > it.enh)) return null;
  return { old, enh: old.enh };
}
/** 이름 앞 「초월한」·「극의」를 단계에 맞게 */
export function exEnhName(name: string, enh: number): string {
  const TR = CONFIG.smith.transcend;
  const nm = name.replace(/^(초월한|극의) /, '');
  return enh >= TR.max ? `극의 ${nm}` : enh >= TR.nameAt ? `초월한 ${nm}` : nm;
}
/** 이어받기 한 번 쓴 것으로 (그냥 끼우기 · 이어받기 모두 — 다음부터는 보통 확인만) */
export function exInheritUsed(id: string): void {
  const st = rwState();
  if (!st.inh.includes(id)) st.inh.push(id);
  markDirty();
}
/** 이어받기 실행: 지금 낀 무기의 강화·초월 단계(이름표 포함)를 전용 무기로 · 원래 무기는 +0 (이름표 지움) — 끼우기는 부른 쪽이 */
export function exInherit(a: Actor, it: Item): boolean {
  const p = exInheritPlan(a, it);
  if (!p) return false;
  const { old, enh } = p;
  it.enh = enh;
  it.name = exEnhName(it.name, enh);
  delete it.ePity;
  if (it.tPity) it.tPity = 0;
  old.enh = 0;
  old.name = exEnhName(old.name, 0);
  delete old.ePity;
  if (old.tPity) old.tPity = 0;
  P.counters.enhanceMax = Math.max(P.counters.enhanceMax, enh);
  exInheritUsed(it.ex!);
  return true;
}

/** 화면용: 무기 주인 이름 */
export { exOwnerName };
