// RAIDWEAPON 무기 조각 — 공통 재화 하나 (§1 심연 25층마다 · §2 선택 상자 · §3 월드 레이드)
//  칸: P.raidWeapon = { frags, got } (옛 저장엔 없음 → mergeProgress가 { frags: 0, got: {} })
//  §2·§3은 여기 addFrags / spendFrags / fragCount를 그대로 쓴다 (다른 곳에서 P.raidWeapon.frags를 직접 바꾸지 않기)
import { freshRaidWeapon, markDirty, P, type RaidWeaponState } from './state';

/** 칸 바로잡기 (모양이 이상하면 0) */
export function rwState(): RaidWeaponState {
  const cur = (P as { raidWeapon?: unknown }).raidWeapon;
  const r = (cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : (P.raidWeapon = freshRaidWeapon())) as RaidWeaponState;
  if (!Number.isFinite(r.frags) || r.frags < 0) r.frags = 0;
  r.frags = Math.floor(r.frags);
  if (!r.got || typeof r.got !== 'object' || Array.isArray(r.got)) r.got = {};
  return r;
}
/** 가진 조각 수 */
export const fragCount = (): number => rwState().frags;
/** 조각 +n (src = 출처: 'abyss' · 'raid' · 'world' · 'bundle'…) → 새 합계 · n ≤ 0이면 아무것도 안 함 */
export function addFrags(n: number, src: string): number {
  const r = rwState();
  n = Math.floor(n);
  if (!(n > 0)) return r.frags;
  r.frags += n;
  r.got[src] = (r.got[src] ?? 0) + n;
  markDirty();
  return r.frags;
}
/** 조각 −n (모자라면 false · 그대로) */
export function spendFrags(n: number): boolean {
  const r = rwState();
  n = Math.floor(n);
  if (!(n > 0) || r.frags < n) return false;
  r.frags -= n;
  markDirty();
  return true;
}
