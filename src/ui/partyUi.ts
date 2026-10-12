// 핫픽스 12 §2: 파티 창 공통 조각 — 역할 3칸 · 「치우친 파티」 · 멘토 배지 · 「추천 편성」 버튼과 이유 한 줄 · 의뢰 조건 태그
import { CONFIG } from '../data/config';
import { balanced, isMentee, ROLE_ICON, ROLE_NAME, roleOf, skewed, tagMet, type Role } from '../world/party';
import type { Actor, QuestTag } from '../world/state';
import { esc, pic } from './common';
import { SYN_IDS, SYN_INFO, synergiesOf, synergyHint } from '../world/synergy';
import { ledgerNeed, party4Open } from '../world/party4';
import { markDirty, P as PR } from '../world/state';

const P2 = CONFIG.party;
/** 역할 3칸 (채워지면 색, 빈 칸은 회색) + 조합 보너스 / 치우친 파티 */
export function roleRow(sel: Actor[]): string {
  const cells = (['tank', 'heal', 'dps'] as Role[]).map((r) => `<span class="rl ${sel.some((m) => roleOf(m) === r) ? 'on' : ''}" title="${ROLE_NAME[r]}">${ROLE_ICON[r]}<small>${ROLE_NAME[r]}</small></span>`).join('');
  const note = balanced(sel)
    ? `<b class="good">방어·공격·회복 +${Math.round(P2.rolePowerPct * 100)}% · 체력 소모 −${Math.round(P2.roleHpSave * 100)}%</b>`
    : `<small class="note">방어(기사·전사)·회복(사제)·공격을 고루 넣으면 보너스</small>`;
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

/**
 * PARTY §2: 지금 조합으로 켜지는 보너스 (아이콘 + 이름 · 누르면 효과) + 「한 명만 바꾸면 ○○」 한 줄
 *  where='exp'면 전투에서만 쓰는 효과(치명타·스킬 대기·보스 피해)는 흐리게
 */
export function synRow(sel: Actor[], cands: Actor[], max: number, where: 'hunt' | 'raid' | 'exp'): string {
  const on = synergiesOf(sel);
  const chips = on
    .map((id) => {
      const i = SYN_INFO[id];
      const dim = where === 'exp' && i.battleOnly;
      return `<span class="pty-syn${dim ? ' dim' : ''}" data-syn="${id}" title="${esc(i.cond)} · ${esc(i.eff)}${dim ? ' (사냥·토벌에서)' : ''}"><i>${i.icon}</i>${esc(i.name)}<small>${esc(i.eff)}</small></span>`;
    })
    .join('');
  const hint = synergyHint(sel, cands, max);
  return `<div class="pty-syns" data-n="${on.length}">${chips || '<small class="note">조합 보너스 없음 — 직업을 섞어 보세요</small>'}</div>${hint ? `<p class="pty-hint" data-hint="${hint.id}">💡 ${esc(hint.text)}</p>` : ''}`;
}
/** 도감 「파티」 칸에 쓰는 표 순서 그대로 */
export const SYN_ORDER = SYN_IDS;

/**
 * PARTY §3: 파티 자리 칸 (사냥·토벌) — 4번째 자리가 열렸으면 빈 칸이 반짝 (처음 채울 때까지) · 안 열렸으면 잠긴 칸에 조건
 */
export function slotRow(sel: Actor[], max: number): string {
  const open4 = party4Open();
  const cells: string[] = [];
  for (let i = 0; i < Math.max(4, max); i++) {
    const a = sel[i];
    if (a) cells.push(`<span class="pty-slot on"><img src="${pic(a)}" alt="">${i === 0 ? '<b>대장</b>' : i === 3 ? '<b>AI</b>' : ''}</span>`);
    else if (i < max) cells.push(`<span class="pty-slot${i === 3 && !PR.meta.party4Seen ? ' spark' : ''}">${i === 3 ? '<b>NEW</b>' : ''}</span>`);
    else cells.push(`<span class="pty-slot lock" title="훈련장 Lv5 + 장부 ${ledgerNeed()}장">🔒<small>훈련장 Lv5 · 장부 ${ledgerNeed()}장</small></span>`);
  }
  if (open4 && sel.length >= 4 && !PR.meta.party4Seen) {
    PR.meta.party4Seen = true;
    markDirty();
  }
  return `<div class="pty-slots">${cells.join('')}</div>`;
}
