// 형철 판정 (T1): 설정 기본 탭 「손님 이름 항상 보기」 — 기본 끔
//  켜면 마을의 모든 손님 머리 위에 이름 (전설·신화 금/은 이름표는 그대로 먼저 · 영웅은 확대 안 해도 · 평범한 손님은 작고 흐리게)
//  안 그리는 때: UI 끄기(구경 모드) · 화면 보호 · 사진 모드 — 그리기는 world/render.ts drawNamedTags
//  플래그 없음: 보이는 변화는 사용자가 직접 켤 때만 (기본 끔) · 설정 줄 하나는 늘 보임 (진동·피해 숫자 줄처럼)
import { getPref, setPref } from '../save/save';

export const GUEST_NAMES_KEY = 'guestNames';
let on: boolean | null = null;
/** 매 프레임 읽으니 메모리에 들고 있다 (설정 동기화로 바뀌면 reloadGuestNames) */
export const guestNamesOn = (): boolean => (on ??= getPref<boolean>(GUEST_NAMES_KEY, false) === true);
export function setGuestNames(v: boolean) {
  on = v;
  setPref(GUEST_NAMES_KEY, v);
}
/** 세이브의 설정을 이 기기에 쓴 뒤 다시 읽기 (prefsSync) */
export function reloadGuestNames() {
  on = null;
}
