// LUXE §3 마을 회관 꾸러미 (플래그 bundles · 실험실 vis) — 화면 없는 규칙 (화면은 ui/bundles.ts · 숫자는 data/luxe_cfg.ts)
//  게시판 「마을 회관」 탭 → 방 6개 × 꾸러미(N/칸) → 칸마다 [바치기] (한 칸에 조금씩 바쳐도 됨 · 바친 건 사라짐)
//  꾸러미 완성 = 작은 보상(금화·가루) · 방 완성 = 영구 보상(bundlePerks.ts) · 6방 다 = 칭호 · 쿠폰 · 「마을 회관」 건물(보관함)
//  연금술 예약(alchReserve)분 작물은 바치지 않는다 (「예약분은 빼고 바쳐요」) · 기록 칸(rec)은 바치지 않고 카운터만 확인
//  플래그를 끄면: 바치기·보상 효과 모두 멈춤 (바친 것·받은 것은 지우지 않는다)
import { CONFIG } from '../data/config';
import { bossById } from '../data/bosses';
import { BASE_REGIONS, DUST_NAME, REGIONS, regionById, type Grade, type RegionId } from '../data/items';
import { FISH } from '../data/story/fish';
import { BUNDLE_DONE, HALL_FIRST, HALL_RESTORED, ROOM_DONE, type HallRoom } from '../data/story/bundles';
import type { SLine } from '../data/story/v1';
import { LUXE, type BundleDef, type BundleRec, type BundleSlot, type RoomDef } from '../data/luxe_cfg';
import { track } from '../net/telemetry';
import { bdOn } from './bundlePerks';
import { bundleFrags } from './exWeapons';
import { alchReserve, cropSpare, fLv } from './facilities';
import { chaptersDone } from './guide';
import { huntRegionOpen } from './hunt';
import { freshBundles, gotGold, markDirty, P, S, world, type BundleState } from './state';

export { bdOn };
const B = () => LUXE.bundles;
export const ROOMS = (): RoomDef[] => B().rooms;
export const roomById = (id: string) => ROOMS().find((r) => r.id === id);
export const bundleById = (id: string): { room: RoomDef; b: BundleDef } | null => {
  for (const room of ROOMS()) for (const b of room.bundles) if (b.id === id) return { room, b };
  return null;
};

/** 빈 칸 바로잡기 (옛 저장 · 모양이 이상한 값) — 몇 번 불러도 같다 */
export function bdState(): BundleState {
  const d = freshBundles();
  const cur = P.bundles as unknown;
  const f = (cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : (P.bundles = d)) as BundleState;
  for (const k of Object.keys(d) as (keyof BundleState)[]) {
    const v = f[k] as unknown;
    const b = d[k] as unknown;
    const bad = Array.isArray(b) ? !Array.isArray(v) : k === 'put' ? !(v && typeof v === 'object' && !Array.isArray(v)) : typeof v !== typeof b || (typeof b === 'number' && !Number.isFinite(v as number));
    if (bad) (f as Record<string, unknown>)[k] = b;
  }
  for (const [k, v] of Object.entries(f.put)) if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) delete f.put[k];
  f.done = f.done.filter((x, i, a) => typeof x === 'string' && a.indexOf(x) === i);
  f.rooms = f.rooms.filter((x, i, a) => typeof x === 'string' && a.indexOf(x) === i);
  P.bundles = f;
  return f;
}

// ───────── 열림 · 칸 ─────────

/** 지금 장부 장 (5단계 전 저장은 모두 열림) */
const chapterNow = () => (P.guide?.legacy ? 99 : chaptersDone());
export const roomOpen = (r: RoomDef) => chapterNow() >= r.chapter;
const key = (b: BundleDef, i: number) => `${b.id}:${i}`;
/** 그 칸에 바친 수 */
export const putOf = (b: BundleDef, i: number) => Math.min(b.slots[i].n, bdState().put[key(b, i)] ?? 0);
export const slotFull = (b: BundleDef, i: number) => putOf(b, i) >= b.slots[i].n;
export const filledN = (b: BundleDef) => b.slots.filter((_, i) => slotFull(b, i)).length;
export const bundleDone = (b: BundleDef) => bdState().done.includes(b.id);
export const roomDoneN = (r: RoomDef) => r.bundles.filter(bundleDone).length;
export const roomDone = (r: RoomDef) => bdState().rooms.includes(r.id);
export const roomsDoneN = () => ROOMS().filter(roomDone).length;

/** 기록 칸 값 (바치지 않음 · 카운터만) */
export function recValue(id: BundleRec | string): number {
  const ties = Object.values(P.ties ?? {});
  switch (id) {
    case 'wins': return Object.values(P.counters.regionWins ?? {}).reduce((s, v) => s + (v ?? 0), 0);
    case 'huntClears': return P.counters.huntClears ?? 0;
    case 'abyssBest': return P.gs?.abyss?.best ?? 0;
    case 'regionsX10': return REGIONS.filter((r) => (P.hunt.best[r.id] ?? 0) >= CONFIG.hunt.stages).length;
    case 'friends': return ties.filter((t) => (t?.stage ?? 0) >= 3).length;
    case 'trusted': return ties.filter((t) => (t?.stage ?? 0) >= 4).length;
    case 'gifts': return P.counters.giftsGiven ?? 0;
  }
  return 0;
}
/** 휴식의 물약은 마시면 바로 효과라 칸에 안 쌓인다 → 그 자리에서 만들어 바친다 (공방 필요 · 재료 그대로) */
const REST = 'rest';
const restCan = () => (fLv('alchemy') ? Math.min(...Object.entries(CONFIG.potions.list[REST].need).map(([c, n]) => Math.floor((P.crops[c] ?? 0) / n))) : 0);

/** 지금 바칠 수 있는 수 (작물은 연금 예약분을 뺀 수 · 기록 칸은 지금 기록) */
export function haveOf(s: BundleSlot): number {
  switch (s.k) {
    case 'crop': return cropSpare(s.id);
    case 'fish': return P.growth?.fish?.bag?.[s.id] ?? 0;
    case 'mat': return P.mats[s.id as RegionId] ?? 0;
    case 'dust': return P.dust[s.id as Grade] ?? 0;
    case 'boss': return P.bossMats[s.id] ?? 0;
    case 'potion': return s.id === REST ? restCan() : (P.potions[s.id] ?? 0);
    case 'rec': return recValue(s.id);
  }
  return 0;
}
/** 예약분 때문에 못 바치는 수 (작물만 · 화면 한 줄 「예약 n」) */
export const reservedOf = (s: BundleSlot) => (s.k === 'crop' ? Math.min(P.crops[s.id] ?? 0, alchReserve(s.id)) : 0);

/** 칸 이름 「당근」 「황금 붕어」 「이끼 덩굴」 「너구리 송곳니」 「원정 성공 50번」 */
export function slotName(s: BundleSlot): string {
  switch (s.k) {
    case 'crop': return CONFIG.garden.crops[s.id]?.name ?? s.id;
    case 'fish': return FISH.find((f) => f.id === s.id)?.name ?? s.id;
    case 'mat': return regionById(s.id as RegionId)?.mat ?? s.id;
    case 'dust': return DUST_NAME[s.id as Grade] ?? s.id;
    case 'boss': return bossById(s.id)?.mat ?? s.id;
    case 'potion': return CONFIG.potions.list[s.id]?.name ?? s.id;
    case 'rec': return REC_NAME[s.id as BundleRec] ?? s.id;
  }
  return s.id;
}
export const REC_NAME: Record<BundleRec, string> = {
  wins: '원정 성공 기록',
  huntClears: '사냥 클리어 기록',
  abyssBest: '끝없는 심연 최고 층',
  regionsX10: '사냥 x-10 돌파 지역',
  friends: '인연 「친구」 이상',
  trusted: '인연 「신뢰」 이상',
  gifts: '선물한 횟수',
};
// FISH_QOL_1019 A: 물고기 칸 = 장소 · 시간대 · 등급 (해안이 잠겼으면 언제 열리는지)
const FISH_TIME: Record<string, string> = { night: '🌙 밤', dawn: '🌅 새벽', day: '☀️ 낮' };
const FISH_GRADE: Record<string, string> = { n: '흔함', r: '희귀', e: '영웅', l: '전설' };
export const seaLocked = () => !huntRegionOpen(BASE_REGIONS);
export function fishWhere(id: string): string {
  const f = FISH.find((x) => x.id === id);
  if (!f) return '낚시';
  if (f.where === 'sea' && seaLocked()) return '🔒 등대 해안 — 별의 심연 10단계 돌파 후';
  return `${f.where === 'sea' ? '등대 해안' : '마을 연못'} · ${f.time ? FISH_TIME[f.time] : '언제나'} · ${FISH_GRADE[f.grade]}`;
}
/** 회관이 지금 바라는 물고기 (열린 방 · 아직 안 끝난 꾸러미 · 안 채운 칸) */
export function wantedFish(): Set<string> {
  const out = new Set<string>();
  for (const r of ROOMS()) {
    if (!roomOpen(r)) continue;
    for (const b of r.bundles) {
      if (bundleDone(b)) continue;
      b.slots.forEach((sl, i) => sl.k === 'fish' && !slotFull(b, i) && out.add(sl.id));
    }
  }
  return out;
}
/** 얻는 곳 한 줄 */
export function slotWhere(s: BundleSlot): string {
  switch (s.k) {
    case 'crop': return '텃밭';
    case 'fish': return fishWhere(s.id);
    case 'mat': return `${regionById(s.id as RegionId)?.name ?? ''} 사냥·원정`;
    case 'dust': return '대장간 분해';
    case 'boss': return `${bossById(s.id)?.name ?? ''} 토벌`;
    case 'potion': return s.id === REST ? '연금술 공방 (그 자리에서 만들어 바쳐요)' : '연금술 공방';
    case 'rec': return '평소 플레이 (바치지 않고 확인만)';
  }
  return '';
}

// ───────── 바치기 ─────────

export interface DonateResult {
  gave: number;
  /** 이번에 꾸러미가 완성됐으면 그 보상 글 */
  bundle?: string;
  /** 이번에 방이 완성됐으면 그 방 */
  room?: RoomDef;
  /** 이번에 6방이 다 됐으면 */
  final?: boolean;
}
/** 바치기 (칸 하나 · 가진 만큼 남은 칸까지) — 실패면 이유 글 */
export function donate(bundleId: string, i: number, max = Infinity): DonateResult | string {
  if (!bdOn()) return '마을 회관은 아직 준비 중이에요';
  if (S.visiting) return '이웃 마을에선 바칠 수 없어요';
  const hit = bundleById(bundleId);
  if (!hit) return '없는 꾸러미예요';
  const { room, b } = hit;
  if (!roomOpen(room)) return `장부 ${room.chapter}장을 마치면 열려요`;
  if (bundleDone(b)) return '이미 완성한 꾸러미예요';
  const s = b.slots[i];
  if (!s) return '없는 칸이에요';
  const st = bdState();
  const left = s.n - putOf(b, i);
  if (left <= 0) return '이미 채운 칸이에요';
  let gave: number;
  if (s.k === 'rec') {
    // 기록 칸: 기록이 닿았는지만 본다 (아무것도 사라지지 않음)
    if (recValue(s.id) < s.n) return `${slotName(s)} ${recValue(s.id)}/${s.n} · 조금 더 모아 와요`;
    gave = left;
  } else {
    gave = Math.min(left, haveOf(s), Math.max(1, Math.floor(max)));
    if (gave <= 0) return s.k === 'crop' && (P.crops[s.id] ?? 0) > 0 ? '연금 예약분만 남았어요 · 예약분은 빼고 바쳐요' : `${slotName(s)}이(가) 없어요 · 얻는 곳: ${slotWhere(s)}`;
    take(s, gave);
  }
  st.put[key(b, i)] = putOf(b, i) + gave;
  track('bundle_give', { b: b.id, i, n: gave });
  markDirty();
  const out: DonateResult = { gave };
  if (filledN(b) >= b.need) {
    out.bundle = finishBundle(room, b);
    if (room.bundles.every(bundleDone)) {
      finishRoom(room);
      out.room = room;
      if (ROOMS().every(roomDone)) out.final = finishAll();
    }
  }
  return out;
}
function take(s: BundleSlot, n: number) {
  switch (s.k) {
    case 'crop': P.crops[s.id] = Math.max(0, (P.crops[s.id] ?? 0) - n); break;
    case 'fish': {
      const bag = P.growth.fish.bag;
      bag[s.id] = Math.max(0, (bag[s.id] ?? 0) - n);
      if (bag[s.id] <= 0) delete bag[s.id];
      break;
    }
    case 'mat': P.mats[s.id as RegionId] = Math.max(0, (P.mats[s.id as RegionId] ?? 0) - n); break;
    case 'dust': P.dust[s.id as Grade] = Math.max(0, (P.dust[s.id as Grade] ?? 0) - n); break;
    case 'boss': P.bossMats[s.id] = Math.max(0, (P.bossMats[s.id] ?? 0) - n); break;
    case 'potion':
      if (s.id === REST) for (const [c, k] of Object.entries(CONFIG.potions.list[REST].need)) P.crops[c] = Math.max(0, (P.crops[c] ?? 0) - k * n);
      else P.potions[s.id] = Math.max(0, (P.potions[s.id] ?? 0) - n);
      break;
  }
}
/** 꾸러미 보상 (1번만) → 보상 글 */
function finishBundle(room: RoomDef, b: BundleDef): string {
  const st = bdState();
  const r = B().bundleReward[room.id];
  if (st.done.includes(b.id)) return '';
  st.done.push(b.id);
  if (!r) return '';
  S.gold += r.gold;
  gotGold(r.gold, 'bundle');
  const [g, n] = r.dust;
  P.dust[g as Grade] = (P.dust[g as Grade] ?? 0) + n;
  track('bundle_done', { b: b.id });
  markDirty();
  return bundleRewardText(room);
}
export const bundleRewardText = (room: RoomDef) => {
  const r = B().bundleReward[room.id];
  return r ? `금화 ${r.gold.toLocaleString('ko-KR')} · ${DUST_NAME[r.dust[0] as Grade]} ${r.dust[1]}` : '';
};
/** 방 완성 (1번만): 영구 보상은 rooms 목록으로 켜진다 (bundlePerks) · 주방 = 첫 펫 약속 */
function finishRoom(room: RoomDef) {
  const st = bdState();
  if (st.rooms.includes(room.id)) return;
  st.rooms.push(room.id);
  if (room.id === 'kitchen' && !st.petGrant) st.petGrant = B().petGrant;
  // RAIDWEAPON §2: 「토벌 전리품」 방 = 무기 조각 5 (1번만 · 꺼져 있으면 켜질 때 exRetro가 한 번)
  bundleFrags();
  track('bundle_room', { room: room.id, n: st.rooms.length });
  markDirty();
}
/** 6방 전부 (1번만): 칭호 · 명품 쿠폰 · 「마을 회관」 건물(보관함 · 놓을 자리는 직접) */
function finishAll(): boolean {
  const st = bdState();
  if (st.final) return false;
  st.final = true;
  const t = B().finalTitle;
  if (!P.titles.includes(t)) P.titles.push(t);
  st.coupon += B().finalCoupon;
  giveHall();
  track('bundle_final', {});
  markDirty();
  return true;
}
/** 회관 건물 (마을에도 보관함에도 없으면 보관함에) */
export function giveHall() {
  const st = bdState();
  const k = B().hallKind;
  const objs = world.home?.objs ?? world.objs;
  const owned = objs.some((o) => o.kind === k) || (P.decor.store ?? []).some((s) => s.kind === k);
  if (!owned) (P.decor.store ??= []).push({ kind: k as never, lvl: 1, hue: null, flip: false, fromProp: true });
  st.hall = true;
}

/** 회관 그림 복원 단계 (완성한 방 수 0~6) */
export const hallStage = () => roomsDoneN();
/** 바칠 수 있는 칸이 있는 꾸러미 수 (빨간 점 · 시뮬) */
export function readySlots(room: RoomDef): number {
  if (!roomOpen(room)) return 0;
  let n = 0;
  for (const b of room.bundles) {
    if (bundleDone(b)) continue;
    b.slots.forEach((s, i) => {
      if (slotFull(b, i)) return;
      if (s.k === 'rec' ? recValue(s.id) >= s.n : haveOf(s) > 0) n++;
    });
  }
  return n;
}
/** 시뮬: 지금 가진 것만으로 「다 채울 수 있는」 칸 수 · 그걸로 끝나는 꾸러미 · 방 (아무것도 바꾸지 않음 · 칸끼리 같은 재료를 나눠 쓰는 건 앞 칸부터) */
export function fillableNow(room: RoomDef): { slots: number; total: number; bundles: number; done: boolean } {
  const pool = new Map<string, number>();
  const avail = (s: BundleSlot) => {
    const k = `${s.k}:${s.id}`;
    if (!pool.has(k)) pool.set(k, s.k === 'rec' ? Infinity : haveOf(s));
    return k;
  };
  let slots = 0;
  let total = 0;
  let bundles = 0;
  for (const b of room.bundles) {
    let f = 0;
    b.slots.forEach((s, i) => {
      total++;
      const left = s.n - putOf(b, i);
      if (left <= 0) return void (f++, slots++);
      if (s.k === 'rec') {
        if (recValue(s.id) >= s.n) (f++, slots++);
        return;
      }
      const k = avail(s);
      if (pool.get(k)! >= left) {
        pool.set(k, pool.get(k)! - left);
        f++;
        slots++;
      }
    });
    if (bundleDone(b) || f >= b.need) bundles++;
  }
  return { slots, total, bundles, done: bundles >= room.bundles.length };
}

// ───────── 대사 고르기 (data/story/bundles.ts · 화면은 ui/bundles가 playStory로 튼다) ─────────

/** 대사 파일의 방 이름 → 게임 방 id (luxe_cfg) */
export const HALL_ROOM_OF: Record<RoomDef['id'], HallRoom> = {
  kitchen: 'kitchen',
  pharmacy: 'apothecary',
  smithy: 'forge',
  water: 'water',
  raid: 'trophy',
  shelter: 'lodge',
};
/** 그 화자가 이 마을에 있나: 영웅 = 영입(recruited) · 전설 = 합류(joined) · 그 밖(버나드·모모·나)은 늘 */
export function speakerHere(who: string): boolean {
  if (who.startsWith('hero_')) return !!P.dex.heroes[who.slice(5)]?.recruited;
  if (who.startsWith('legend_')) return P.legends[who.slice(7)]?.st === 'joined';
  return true;
}
/** 처음 열기 대사 (1번만 · 본 걸로 적는다) — 이미 봤으면 null */
export function hallFirstLines(): SLine[] | null {
  const st = bdState();
  if (st.seen) return null;
  st.seen = true;
  markDirty();
  return HALL_FIRST;
}
/** 방 완성 대사: 담당(who)이 영입돼 있으면 그 사람 · 아니면 버나드(fallback) */
export function roomDoneLines(roomId: string): SLine[] {
  const d = ROOM_DONE[HALL_ROOM_OF[roomId as RoomDef['id']]];
  if (!d) return [];
  return speakerHere(d.who) ? d.lines : d.fallback;
}
/** 꾸러미 완성 한 줄 (무작위 · 바로 앞 줄과 겹치지 않게) */
let lastDone = -1;
export function bundleDoneLine(rnd = Math.random): string {
  const n = BUNDLE_DONE.length;
  let i = Math.floor(rnd() * n) % n;
  if (n > 1 && i === lastDone) i = (i + 1) % n;
  lastDone = i;
  return BUNDLE_DONE[i];
}
/** 6방 다: 회관 복원 컷 */
export const hallRestoredLines = (): SLine[] => HALL_RESTORED;
