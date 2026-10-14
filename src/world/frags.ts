// RAIDWEAPON 무기 조각 (공통 재화) — 작은 공유 모듈: 나오는 곳(토벌 · 심연 · 보스 연전 · 회관 꾸러미 · 월드 레이드)이 addFrags로 더한다
//  저장 P.raidWeapon.frags (옛 저장은 0) · 10개 = 선택 상자 1 (상자 열기 · 전용 무기는 world/exWeapons.ts)
//  플래그 exWeapons(또는 실험실)가 꺼져 있으면 아무것도 안 한다 (조각이 생기지 않음)
import { freshRaidWeapon, markDirty, P, uiHooks, type RaidWeaponState } from './state';
import { vis } from './visual';

/** 켜졌나: 플래그(모두) 또는 실험실(이 기기) */
export const exOn = (): boolean => vis('exWeapons');

const okN = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
/** 저장 칸 바로잡기 (옛 저장 · 망가진 값) */
export function rwState(): RaidWeaponState {
  const d = freshRaidWeapon();
  const cur = P.raidWeapon as unknown;
  const f = (cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : (P.raidWeapon = d)) as RaidWeaponState;
  if (!okN(f.frags)) f.frags = 0;
  if (!okN(f.boxes)) f.boxes = 0;
  f.frags = Math.floor(f.frags);
  f.boxes = Math.floor(f.boxes);
  if (!f.got || typeof f.got !== 'object' || Array.isArray(f.got)) f.got = {};
  for (const [k, v] of Object.entries(f.got)) if (!okN(v)) delete f.got[k];
  if (!Array.isArray(f.awoke)) f.awoke = [];
  f.awoke = f.awoke.filter((x, i, a) => typeof x === 'string' && a.indexOf(x) === i);
  if (typeof f.bundle !== 'boolean') f.bundle = false;
  if (typeof f.abyssWk !== 'string') f.abyssWk = '';
  if (!okN(f.abyssHi)) f.abyssHi = 0;
  return f;
}

/** 조각 로그 (어디서 몇 개 · 시뮬·시트용 · 저장 안 함) */
export const fragLog: { n: number; src: string; at: number }[] = [];

/** 조각 더하기 (src = 'raid' · 'raidChain' · 'abyss' · 'rush' · 'bundle' · 'world' …) — 꺼져 있거나 0 이하면 아무것도 안 함 */
export function addFrags(n: number, src: string): void {
  if (!exOn() || !(n > 0)) return;
  const st = rwState();
  st.frags += Math.floor(n);
  fragLog.push({ n: Math.floor(n), src, at: Date.now() });
  if (fragLog.length > 50) fragLog.shift();
  markDirty();
  uiHooks.toast(`🗡 무기 조각 +${Math.floor(n)} (${st.frags}개)`);
}

/** 가진 조각 수 */
export function fragCount(): number {
  return rwState().frags;
}
