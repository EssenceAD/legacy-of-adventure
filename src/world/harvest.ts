// HARVEST_SPEC §1 첫 번째 가을 수확제 — 날짜 판정 · 리본 · 호박 도깨비/황금 호박 대왕 · 교환소 · 손님 대사 · 소문 · 마지막 밤 · 연대기
//  날짜는 한국 시간 실제 시각 (서버 시각 = flags.json 응답 Date · 오프라인이면 기기 시계 · 개발/봇 빌드는 localStorage로 강제)
//  기간이 끝나면 자동 장식·호박 도깨비·수프·소문·대사가 사라진다 — 리본·바꾼 장식·칭호는 영구
import { HV, HV_SHOP, type HvShopItem } from '../data/harvest_cfg';
import { REGIONS } from '../data/items';
import { EXCHANGE_LINES, HARVEST_BOND_LINES, HARVEST_CHRONICLE, HARVEST_CLASS_LINES, HARVEST_RUMORS } from '../data/story/harvest';
import { flag } from './flags';
import { brag } from './growth';
import { addRibbons, addStamps, harvestFinaleDay, harvestOn, harvestShopOn, hvHooks, hvNow, hvState } from './hvLite';
import { markDirty, P, S, type Actor } from './state';

// 가벼운 핵심(날짜·리본·도장)은 hvLite — 여기서 다시 내보낸다
export { addRibbons, checkTitle, expRibbons, harvestFinaleDay, harvestOn, harvestShopOn, hvHooks, hvNow, hvPhase, hvState, hvTitles, launched, setHvNow } from './hvLite';
// 칭호 자랑은 growth(무거움)라 여기서 이어 준다
hvHooks.brag = (name) => void brag('harvest', null, name);

/** 11/5 0시(한국 시간) */
const FINALE_FROM = Date.parse('2026-11-05T00:00:00+09:00');

// ───────── 1-4 호박 도깨비 · 황금 호박 대왕 ─────────

const regionIdx = (r: string) => REGIONS.findIndex((x) => x.id === r);
/** 호박 도깨비 한 마리 리본 (지역 6~10은 2) */
export const pumpkinRibbon = (region: string) => (regionIdx(region) >= HV.hiRegion ? HV.ribbonPumpkinHi : HV.ribbonPumpkin);
/** 잡은 호박 도깨비 n마리 → 리본 */
export function notePumpkins(n: number, region: string): number {
  if (n <= 0) return 0;
  const h = hvState();
  h.pumpkins += n;
  markDirty();
  return addRibbons(n * pumpkinRibbon(region));
}
/** 대왕이 나올 차례인가 (누적 15마리마다 한 번 · 쓰러뜨리면 하나 씀) */
export const kingDue = () => Math.floor(hvState().pumpkins / HV.kingEvery) > hvState().kingUsed;
/** 대왕을 쓰러뜨림 → 리본 10 */
export function noteKing(): number {
  const h = hvState();
  h.king++;
  h.kingUsed++;
  markDirty();
  return addRibbons(HV.ribbonKing);
}
/** 이 사냥 판에 수확제를 얹나 (사냥만 · 심연·토벌 빼고) · 대왕을 낼 판인가 (지역 보스 판 x-10은 다음 판으로 미룬다) */
export function fieldHarvest(stage: number): { on: boolean; king: boolean } {
  if (!harvestOn()) return { on: false, king: false };
  return { on: true, king: stage < 10 && kingDue() };
}
/** 사냥 한 판 결과 (전투 화면 · 접은 판) → 리본 · 결과 카드 한 줄 */
export function settleField(region: string, pumpkins: number, kingDown: boolean): { ribbons: number; pumpkins: number; king: boolean } {
  let r = notePumpkins(pumpkins, region);
  if (kingDown) r += noteKing();
  return { ribbons: r, pumpkins, king: kingDown };
}
/** 맡겨 두기(전투 없이 한 판) — 판마다 한 마리 확률 · 대왕 차례면 같이 쓰러뜨린 셈 */
export function settleAuto(region: string, stage: number, rng: () => number = Math.random): { ribbons: number; pumpkins: number; king: boolean } {
  if (!harvestOn()) return { ribbons: 0, pumpkins: 0, king: false };
  const p = rng() < HV.autoPumpkinChance ? 1 : 0;
  const king = stage < 10 && kingDue();
  return settleField(region, p, king);
}

// ───────── 1-5 교환소 ─────────

export const shopItem = (kind: string) => HV_SHOP.find((x) => x.kind === kind);
export const shopLeft = (it: HvShopItem) => Math.max(0, it.max - (hvState().buy[it.kind] ?? 0));
/** 교환소에서 받은 장식인가 (값과 상관없이 무료로 놓는다) */
export const isHvDeco = (kind: string) => !!shopItem(kind);
/** 바꾸기: 실패하면 까닭 · 되면 대사 */
export function buyHv(kind: string, now = hvNow()): { err: string } | { line: string; carriage: boolean } {
  if (!harvestShopOn(now)) return { err: EXCHANGE_LINES.closed };
  const it = shopItem(kind);
  if (!it) return { err: '없는 물건이에요' };
  const h = hvState();
  if (shopLeft(it) <= 0) return { err: `${it.name}은(는) 다 바꿨어요 (최대 ${it.max})` };
  if (h.ribbons < it.cost) return { err: EXCHANGE_LINES.poor };
  h.ribbons -= it.cost;
  h.buy[kind] = (h.buy[kind] ?? 0) + 1;
  h.deco++;
  P.meta.giftDeco[kind] = (P.meta.giftDeco[kind] ?? 0) + 1;
  // CHECKIN §D2: 리본 교환 = 연감 도장 1
  addStamps(1, now);
  markDirty();
  const carriage = kind === 'pumpkin_carriage';
  if (carriage) brag('harvest', null, it.name);
  const L = EXCHANGE_LINES.buy;
  return { line: carriage ? EXCHANGE_LINES.carriage : L[Math.floor(Math.random() * L.length)], carriage };
}
/** 교환소 빨간 점: 리본이 늘었고 지금 바꿀 수 있는 게 있다 (창을 열면 꺼짐) */
export function shopDot(): boolean {
  if (!harvestShopOn()) return false;
  const h = hvState();
  if (h.ribbons <= h.seen) return false;
  return HV_SHOP.some((it) => shopLeft(it) > 0 && h.ribbons >= it.cost);
}
export function markShopSeen() {
  const h = hvState();
  if (h.seen !== h.ribbons) {
    h.seen = h.ribbons;
    markDirty();
  }
}

// ───────── 1-6 주점 · 손님 · 소문 ─────────

/** 손님 말 걸기·말풍선에 30% 섞는 수확제 대사 (기간 밖·안 섞이면 null) */
export function hvLine(a: Actor, rng: () => number = Math.random): string | null {
  if (!harvestOn() || rng() >= HV.lineMix) return null;
  const bond = a.legendId ?? a.heroId ?? (a.role === 'npc' ? 'momo' : a.role === 'keeper' ? 'bernard' : null);
  const bl = bond ? HARVEST_BOND_LINES[bond] : null;
  if (bl && bond && (P.ties?.[bond] || a.role)) return bl[Math.floor(rng() * bl.length)];
  const cl = (HARVEST_CLASS_LINES as Record<string, string[]>)[a.kind];
  return cl ? cl[Math.floor(rng() * cl.length)] : null;
}
/** [소문] 채널: 4개 중 1개 꼴 */
export function hvRumor(rng: () => number = Math.random): string | null {
  if (!harvestOn() || rng() >= HV.rumorMix) return null;
  return HARVEST_RUMORS[Math.floor(rng() * HARVEST_RUMORS.length)];
}
/** 주점 식사 때 호박 수프 (기간 중) — 더 오르는 포만·기분 (0이면 없음) */
export const soupBonus = () => (harvestOn() ? { food: HV.soupFood, mood: HV.soupMood } : null);

// ───────── 1-2 여는 컷 · 1-7 마지막 밤 ─────────

/** 여는 컷을 띄울 때인가 (기간 중 · 내 마을 · 첫 원정 뒤 — 온보딩을 막지 않게) */
export function wantOpening(now = hvNow()): boolean {
  return harvestOn(now) && !hvState().opened && S.started && !S.visiting && P.counters.expeditions > 0;
}
/** 마지막 밤: 'play' = 지금 컷 · 'missed' = 컷 없이 연대기만 · null = 아직/이미 */
export function finaleState(now = hvNow(), night = S.night): 'play' | 'missed' | null {
  if (!flag('harvestFest')) return null;
  const h = hvState();
  if (h.finale) return null;
  if (now < FINALE_FROM) return null;
  // 수확제에 한 번도 들르지 않은 여관(기간 뒤에 시작한 새 여관 등)은 아무것도 없다
  if (!h.opened && !h.earned) return null;
  if (now > HV.shopUntil) return 'missed';
  if (harvestFinaleDay(now)) return night ? 'play' : null;
  return 'play';
}
export function markFinale(kind: 'play' | 'missed') {
  hvState().finale = kind === 'play' ? 1 : 2;
  markDirty();
}

/** 연대기 「첫 번째 수확제」 쪽 (마지막 밤을 봤거나 놓쳤을 때) */
export function hvChronicle(): { title: string; body: string } | null {
  const h = hvState();
  if (!h.finale) return null;
  const t = h.finale === 1 ? HARVEST_CHRONICLE.body : HARVEST_CHRONICLE.missed;
  const body = t
    .replace('{inn}', S.innName || '여관')
    .replace('{ribbons}', String(h.earned))
    .replace('{pumpkins}', String(h.pumpkins))
    .replace('{king}', String(h.king))
    .replace('{deco}', String(h.deco));
  return { title: HARVEST_CHRONICLE.title, body };
}
