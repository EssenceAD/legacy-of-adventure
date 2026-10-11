// 핫픽스 12 §2: 파티 창 공통 조각 — 역할 3칸 · 「치우친 파티」 · 멘토 배지 · 「추천 편성」 버튼과 이유 한 줄 · 의뢰 조건 태그
import { CONFIG } from '../data/config';
import { balanced, isMentee, ROLE_ICON, ROLE_NAME, roleOf, skewed, tagMet, type Role } from '../world/party';
import type { Actor, QuestTag } from '../world/state';
import { esc } from './common';

const P2 = CONFIG.party;
/** 역할 3칸 (채워지면 색, 빈 칸은 회색) + 조합 보너스 / 치우친 파티 */
export function roleRow(sel: Actor[]): string {
  const cells = (['tank', 'heal', 'dps'] as Role[]).map((r) => `<span class="rl ${sel.some((m) => roleOf(m) === r) ? 'on' : ''}" title="${ROLE_NAME[r]}">${ROLE_ICON[r]}<small>${ROLE_NAME[r]}</small></span>`).join('');
  const note = balanced(sel)
    ? `<b class="good">탱·힐·딜 +${Math.round(P2.rolePowerPct * 100)}% · 체력 소모 −${Math.round(P2.roleHpSave * 100)}%</b>`
    : `<small class="note">탱(기사)·힐(사제)·딜을 고루 넣으면 보너스</small>`;
  return `<div class="roles">${cells}${note}${skewed(sel) ? '<small class="skew">치우친 파티</small>' : ''}</div>`;
}
/** 목록 줄의 역할 아이콘 + 멘토 배지 */
export const roleIcon = (a: Actor) => `<i class="ri r-${roleOf(a)}">${ROLE_ICON[roleOf(a)]}</i>`;
export const mentorBadge = (a: Actor, sel: Actor[]) => (sel.includes(a) && isMentee(a, sel) ? `<i class="mentor">경험치 ×${P2.mentorXp}</i>` : '');
/** 「추천 편성」 버튼 + 이유 한 줄 */
export const recButton = (id: string, reason: string) =>
  `<div class="recb"><button class="bigbtn sm" id="${id}">추천 편성</button><small>${reason ? esc(reason) : '추천 전투력 · 역할 · 케미 · 멘토를 보고 골라요 (출발은 직접)'}</small></div>`;
/** 의뢰 조건 태그 줄 */
export const tagLine = (tag: QuestTag | undefined, sel: Actor[]) =>
  tag ? `<p class="qtag ${tagMet(tag, sel) ? 'ok' : ''}">📜 ${esc(tag.text)}${tagMet(tag, sel) ? ' ✓' : ''}</p>` : '';
