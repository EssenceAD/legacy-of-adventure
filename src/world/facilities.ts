// BUILDINGS_SPEC §2·§3: 새 기능 건물 7종의 효과 · 수확물 창고 · 연금술 물약
//  효과는 「가장 높은 레벨 한 채」(다 지은 것) 기준 — TOWN T3 전까지의 규칙 · 레벨 1→5 사이를 고르게
import { CONFIG } from '../data/config';
import { markDirty, P, world, type Building } from './state';
import { bestOf } from './town';

const NB = CONFIG.newBuildings;
const PO = CONFIG.potions;
const homeObjs = (): Building[] => world.home?.objs ?? world.objs;
/** 그 건물의 (가장 높은) 레벨 — 없으면 0 */
export const fLv = (k: string) => bestOf(k as never, homeObjs(), true)?.lvl ?? 0;
/** Lv1 → Lv5 사이 고르게 (없으면 0) */
export const lerpLv = ([a, b]: [number, number], lv: number) => (lv <= 0 ? 0 : a + ((b - a) * (Math.min(5, lv) - 1)) / 4);

/** 마구간: 의뢰 시간 −5% → −20% */
export const stableTimeCut = () => lerpLv(NB.stable.timeCut, fLv('stable'));
/** 마구간 Lv3+: 지나가는 손님이 이만큼(시간) 더 머문다 */
export const passerExtraHours = () => (fLv('stable') >= NB.stable.passerStayLv ? NB.stable.passerStayHours : 0);
/** 예배당: 체력 회복 +20% → +60% */
export const chapelHeal = () => lerpLv(NB.chapel.heal, fLv('chapel'));
/** 서재: 경험치 +10% → +30% */
export const libraryXp = () => lerpLv(NB.library.xp, fLv('library'));
/** 우체국: 편지 보상 +20% → +100% */
export const postMailMult = () => 1 + lerpLv(NB.postoffice.mail, fLv('postoffice'));
/** 마법사의 탑: 강화 성공 +3%p → +10%p */
export const towerEnhance = () => lerpLv(NB.tower.enhance, fLv('tower'));
/** 마법사의 탑 Lv5: 운명의 별 하루 +1 */
export const towerStars = () => (fLv('tower') >= NB.tower.starLv ? 1 : 0);
/** 길드: 의뢰 보상 +10% → +40% */
export const guildGold = () => lerpLv(NB.guild.gold, fLv('guild'));
/** 길드 Lv3: 의뢰 자리 +1 */
export const guildSlot = () => (fLv('guild') >= NB.guild.slotLv ? 1 : 0);
/** 길드 Lv5: 하루 1번 「길드 특별 의뢰」 */
export const guildSpecial = () => fLv('guild') >= NB.guild.specialLv;

// ───────── §3 수확물 창고 · 물약 ─────────
/** 작물 개수 (텃밭에서 거둔 것) */
export const crops = () => P.crops;
export function addCrop(id: string, n: number) {
  P.crops[id] = (P.crops[id] ?? 0) + n;
  markDirty();
}
/**
 * 물약 재료 남겨 두기 (P.keepAlch · 기본 켬): 작물마다 「물약 하나에 드는 가장 많은 개수 × 물약 칸(공방 레벨)」은 남긴다
 *  · 공방이 없으면(칸 0) 0 — 예전처럼 다 먹는다 · 끄면 0
 */
export function alchReserve(id: string): number {
  if (P.keepAlch === false) return 0;
  const slots = potionSlots();
  if (!slots) return 0;
  let need = 0;
  for (const r of Object.values(PO.list)) need = Math.max(need, r.need[id] ?? 0);
  return need * slots;
}
/** 남겨 둔 몫 위로 남는 수 (주점·미끼가 가져갈 수 있는 것) */
export const cropSpare = (id: string) => Math.max(0, (P.crops[id] ?? 0) - alchReserve(id));
/** 오늘(현실 날짜) 주점 손님이 먹은 작물 수 — 날이 바뀌면 0부터 */
export function tavernAteToday(id?: string): number {
  const t = P.tavernAte;
  if (!t || t.day !== todayKey()) return 0;
  return id ? (t.n[id] ?? 0) : Object.values(t.n).reduce((a, b) => a + b, 0);
}
function noteTavernAte(id: string) {
  const day = todayKey();
  if (!P.tavernAte || P.tavernAte.day !== day) P.tavernAte = { day, n: {} };
  P.tavernAte.n[id] = (P.tavernAte.n[id] ?? 0) + 1;
}
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
/** 주점 식사: 옛 채소(pantry) 먼저, 없으면 먹을 수 있는 작물 중 (물약 재료로 남겨 둔 몫 위로) 가장 많이 남는 것 하나 */
export function takeMeal(): boolean {
  if (P.pantry > 0) {
    P.pantry--;
    return true;
  }
  const edible = Object.keys(P.crops)
    .filter((id) => CONFIG.garden.crops[id]?.eat !== false)
    .map((id) => [id, cropSpare(id)] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0];
  if (!edible) return false;
  P.crops[edible[0]]--;
  noteTavernAte(edible[0]);
  return true;
}
/** 물약 칸 = 공방 레벨 · 효과는 Lv마다 +5% */
export const potionSlots = () => fLv('alchemy');
export const potionBoost = () => 1 + NB.alchemy.boostPerLv * Math.max(0, fLv('alchemy') - 1);
export const potionCount = () => Object.values(P.potions).reduce((s, n) => s + n, 0);
export function canBrew(id: string): string | null {
  const r = PO.list[id];
  if (!r) return '없는 물약이에요';
  if (!fLv('alchemy')) return '연금술 공방이 필요해요';
  if (id !== 'rest' && potionCount() >= potionSlots()) return `물약 칸이 가득 찼어요 (${potionSlots()}칸)`;
  // 「회색 버튼엔 이유」: 가장 많이 모자란 작물 「호박 2개 부족 · 얻는 곳: 텃밭」 (오늘 주점이 먹었으면 그것도)
  let worst: [string, number] | null = null;
  for (const [c, n] of Object.entries(r.need)) {
    const s = n - (P.crops[c] ?? 0);
    if (s > 0 && (!worst || s > worst[1])) worst = [c, s];
  }
  if (worst) return `${cropShortLabel(worst[0], worst[1])} · ${tavernAteToday(worst[0]) > 0 ? '주점 손님이 먹었어요 · ' : ''}얻는 곳: 텃밭`;
  return null;
}
/** 「호박 2개 부족」 (연금술 버튼 글) */
export const cropShortLabel = (c: string, n: number) => `${CONFIG.garden.crops[c]?.name ?? c} ${n}개 부족`;
/** 만들기 — 휴식의 물약은 바로 효과(손님 기분), 나머지는 칸에 넣는다 */
export function brew(id: string): string | null {
  const why = canBrew(id);
  if (why) return why;
  for (const [c, n] of Object.entries(PO.list[id].need)) P.crops[c] -= n;
  if (id === 'rest') {
    const v = Math.round(PO.list.rest.v * potionBoost());
    for (const a of world.home?.actors ?? world.actors) if (a.id && !a.role) a.mood = Math.min(100, a.mood + v);
  } else P.potions[id] = (P.potions[id] ?? 0) + 1;
  markDirty();
  return null;
}
/** 마시기 — 30분, 한 번에 하나 (새로 마시면 바뀐다) */
export function drink(id: string, now = Date.now()): string | null {
  if (!(P.potions[id] > 0)) return '물약이 없어요';
  P.potions[id]--;
  P.buff = { id, until: now + PO.minutes * 60000 };
  markDirty();
  return null;
}
/** 지금 켜진 물약 효과 (없으면 0) */
export function buffOf(id: 'power' | 'stone' | 'luck', now = Date.now()): number {
  const b = P.buff;
  if (!b || b.id !== id || b.until <= now) return 0;
  return PO.list[id].v * potionBoost();
}
