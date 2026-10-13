// VISUAL §4 hudV2: 숨긴 HUD 버튼 → 옮겨 간 자리 (import 없는 작은 파일 — guide.ts가 순환 없이 쓰게)
const on = () => document.body.classList.contains('hud2');

/** 손가락(장부 안내)이 가리킬 버튼: 새 HUD에서 숨긴 버튼 → 그 기능이 옮겨 간 자리 */
const MOVED: Record<string, string> = {
  '#bExp': '#bAdv',
  '#bOwner': '#bMenu2',
  '#bVillage': '#bMenu2',
  '#bNotice': '#bNews',
  '#bMenu': '#bMenu2',
  '#mission': '#newsBand',
  '#evalbar': '#newsBand',
  '#goalPill': '#newsBand',
};
export const hudSel = (sel: string): string => (on() && MOVED[sel]) || sel;
