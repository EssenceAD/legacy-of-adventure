// 핫픽스 12 §5: PC 단축키 — 동작 ↔ 키 (기본값 · 사용자가 바꾼 키는 setPref('keys'))
//  전투: 이동·공격·구르기·스킬·합동기·동료 바꾸기·AUTO·접기·일시정지 · 마을: 건설·원정·사냥·채팅·메뉴
import { getPref, setPref } from '../save/save';

export type Action =
  | 'up' | 'down' | 'left' | 'right' | 'attack' | 'dodge' | 's1' | 's2' | 'ult' | 'swap' | 'auto' | 'fold' | 'pause'
  | 'build' | 'board' | 'hunt' | 'chat' | 'menu';

/** 기본 키 (e.key 소문자) — 사용자가 바꾸면 그 동작은 그 키 하나만 */
export const DEFAULT_KEYS: Record<Action, string[]> = {
  up: ['w', 'arrowup'], down: ['s', 'arrowdown'], left: ['a', 'arrowleft'], right: ['d', 'arrowright'],
  attack: ['j', ' '], dodge: ['k', 'shift'], s1: ['u', '1'], s2: ['i', '2'], ult: ['o', '3'],
  swap: ['tab'], auto: ['t'], fold: ['f'], pause: ['escape'],
  build: ['b'], board: ['g'], hunt: ['h'], chat: ['c', 'enter'], menu: ['m'],
};
export const ACTION_NAME: Record<Action, string> = {
  up: '위로', down: '아래로', left: '왼쪽', right: '오른쪽', attack: '공격 (꾹 = 연속)', dodge: '구르기', s1: '스킬 1', s2: '스킬 2', ult: '합동기',
  swap: '조종할 동료 바꾸기', auto: 'AUTO 켜기/끄기', fold: '접기', pause: '일시정지',
  build: '건설', board: '원정 게시판', hunt: '사냥터', chat: '채팅', menu: '메뉴',
};
export const COMBAT_ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'attack', 'dodge', 's1', 's2', 'ult', 'swap', 'auto', 'fold', 'pause'];
export const VILLAGE_ACTIONS: Action[] = ['build', 'board', 'hunt', 'chat', 'menu'];

let custom: Partial<Record<Action, string>> = getPref<Partial<Record<Action, string>>>('keys', {});
export const keysFor = (a: Action): string[] => (custom[a] ? [custom[a]!] : DEFAULT_KEYS[a]);
/** 이 키가 이 묶음(전투·마을)의 어떤 동작인가 */
export function actionOf(key: string, group: Action[]): Action | null {
  const k = key.toLowerCase();
  for (const a of group) if (keysFor(a).includes(k)) return a;
  return null;
}
/** 키를 바꾼다 — 같은 묶음의 다른 동작과 겹치면 그 동작 이름 (안 바꿈) */
export function setKey(a: Action, key: string): Action | null {
  const k = key.toLowerCase();
  const group = COMBAT_ACTIONS.includes(a) ? COMBAT_ACTIONS : VILLAGE_ACTIONS;
  const clash = group.find((x) => x !== a && keysFor(x).includes(k));
  if (clash) return clash;
  custom = { ...custom, [a]: k };
  setPref('keys', custom);
  return null;
}
export function resetKeys() {
  custom = {};
  setPref('keys', {});
}
/** 키캡 글자 */
export function keyLabel(k: string): string {
  const m: Record<string, string> = { ' ': 'Space', shift: 'Shift', tab: 'Tab', escape: 'Esc', enter: 'Enter', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→' };
  return m[k] ?? k.toUpperCase();
}
/** PC(마우스) 화면인가 — 키캡·단축키 안내는 이때만 */
export const isPointerFine = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
