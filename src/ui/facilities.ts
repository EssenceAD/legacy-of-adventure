// BUILDINGS_SPEC: 새 기능 건물 창의 한 줄 효과 숫자 + 연금술 공방(물약 만들기·마시기) — 건물 창(objExtra)에 덧붙인다
import { CONFIG } from '../data/config';
import { bestOf } from '../world/town';
import { alchReserve, brew, canBrew, chapelHeal, drink, fLv, tavernAteToday, guildGold, guildSlot, guildSpecial, libraryXp, passerExtraHours, postMailMult, potionBoost, potionCount, potionSlots, stableTimeCut, towerEnhance } from '../world/facilities';
import { markDirty, P, S } from '../world/state';
import { esc } from './common';
import { objExtra, showObj, toast } from './windows';
import { track as trackEv } from '../net/telemetry';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const PO = CONFIG.potions;
/** 건물마다 지금 효과 한 줄 (레벨에 따라 숫자가 바뀌는 게 보이게) */
function effectLine(kind: string): string {
  const lv = fLv(kind);
  switch (kind) {
    case 'stable': return `의뢰 시간 −${pct(stableTimeCut())}${passerExtraHours() ? ` · 지나가는 손님 +${passerExtraHours()}시간` : ` · Lv${CONFIG.newBuildings.stable.passerStayLv}에 지나가는 손님 +1시간`}`;
    case 'chapel': return `체력 회복 +${pct(chapelHeal())} · 밤 기도 기분 ↑`;
    case 'library': return `단골 경험치 +${pct(libraryXp())}${lv >= CONFIG.newBuildings.library.diaryLv ? ' · 손님 일기 (곧 열려요)' : ` · Lv${CONFIG.newBuildings.library.diaryLv}에 손님 일기`}`;
    case 'alchemy': return `물약 칸 ${potionSlots()} · 물약 효과 ×${potionBoost().toFixed(2)}`;
    case 'postoffice': return `편지 보상 ×${postMailMult().toFixed(2)}${lv >= CONFIG.newBuildings.postoffice.giftLv ? ' · 이웃 선물 (준비 중)' : ''}`;
    case 'tower': return `강화 성공 +${pct(towerEnhance())}p${lv >= CONFIG.newBuildings.tower.starLv ? ' · 운명의 별 하루 2번' : ` · Lv${CONFIG.newBuildings.tower.starLv}에 운명의 별 하루 2번`}`;
    case 'guild': return `의뢰 보상 +${pct(guildGold())}${guildSlot() ? ' · 의뢰 자리 +1' : ` · Lv${CONFIG.newBuildings.guild.slotLv}에 의뢰 자리 +1`}${guildSpecial() ? ' · 길드 특별 의뢰' : ''}`;
  }
  return '';
}
function alchemyHtml(): string {
  const b = P.buff && P.buff.until > Date.now() ? P.buff : null;
  const rows = Object.entries(PO.list)
    .map(([id, r]) => {
      const why = canBrew(id);
      // 모자란 재료가 오늘 주점 손님 식사로 줄었으면 그 재료는 아래 줄에 이유와 함께 (「당근 0/2 · 주점 손님이 먹었어요」)
      const eaten = (c: string, n: number) => (P.crops[c] ?? 0) < n && tavernAteToday(c) > 0;
      const cnt = (c: string, n: number) => `${CONFIG.garden.crops[c]?.name ?? c} ${P.crops[c] ?? 0}/${n}`;
      const need = Object.entries(r.need).filter(([c, n]) => !eaten(c, n)).map(([c, n]) => cnt(c, n)).join(' · ');
      const ate = Object.entries(r.need).filter(([c, n]) => eaten(c, n)).map(([c, n]) => `${cnt(c, n)} · 주점 손님이 먹었어요`);
      const have = P.potions[id] ?? 0;
      return `<div class="irow potion"><span><b>${esc(r.name)}</b><small>${esc(r.desc)}${need ? ` · ${need}` : ''}</small>${ate.length ? `<small class="bad alate">${ate.map(esc).join('<br>')}</small>` : ''}</span><button data-brew="${id}" ${why ? 'disabled' : ''}>만들기</button>${have ? `<button data-drink="${id}">마시기 (${have})</button>` : ''}</div>`;
    })
    .join('');
  return `<div class="alch">${keepRow()}<b class="g">물약</b> <small>칸 ${potionCount()}/${potionSlots()} · 30분 · 한 번에 하나</small>${b ? `<p class="sub good">지금: ${esc(PO.list[b.id]?.name ?? '')} · ${Math.ceil((b.until - Date.now()) / 60000)}분 남음</p>` : ''}${rows}</div>`;
}
/** 물약 재료 남겨 두기 줄 (켜면 남겨 두는 수도 한 줄로) */
function keepRow(): string {
  if (S.visiting) return '';
  const on = P.keepAlch !== false;
  const by = new Map<number, string[]>();
  for (const c of Object.keys(CONFIG.garden.crops)) {
    if (CONFIG.garden.crops[c].eat === false) continue;
    const n = alchReserve(c);
    if (n > 0) by.set(n, [...(by.get(n) ?? []), CONFIG.garden.crops[c].name]);
  }
  const what = [...by].map(([n, names]) => `${names.join('·')} ${n}개`).join(' · ');
  return `<label class="tog alkeep"><input type="checkbox" id="alKeep" ${on ? 'checked' : ''}> 물약 재료 남겨 두기 <small>(주점 손님이 먹지 않게)</small></label>${on && what ? `<p class="note">${esc(what)}는 남겨요 · 넘는 것만 주점에서 먹어요</p>` : ''}`;
}
let prev: ((o: never) => string) | null = null;
export function initFacilitiesUI() {
  prev = objExtra.html as never;
  objExtra.html = (o) => {
    const base = prev!(o as never);
    const e = effectLine(o.kind);
    return `${base}${e ? `<p class="sub fx">✨ ${esc(e)}</p>` : ''}${o.kind === 'alchemy' && o.build === undefined ? alchemyHtml() : ''}`;
  };
  // 물약 재료 남겨 두기 켜고 끄기
  addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id !== 'alKeep') return;
    P.keepAlch = t.checked;
    markDirty();
    trackEv('potion', { id: 'keep', act: t.checked ? 'on' : 'off' });
    toast(t.checked ? '물약 재료는 남겨 둘게요' : '주점 손님이 작물을 다 먹을 수 있어요');
    const al = bestOf('alchemy' as never);
    if (al && document.getElementById('win')?.classList.contains('on')) showObj(al);
  });
  // 공방 버튼 (건물 창이 어떻게 다시 그려지든)
  addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const br = t.closest?.('[data-brew]') as HTMLElement | null;
    const dr = t.closest?.('[data-drink]') as HTMLElement | null;
    if (!br && !dr) return;
    const id = (br ?? dr)!.dataset[br ? 'brew' : 'drink']!;
    const err = br ? brew(id) : drink(id);
    if (err) return toast(err);
    trackEv('potion', { id, act: br ? 'brew' : 'drink' });
    toast(br ? (id === 'rest' ? '휴식의 물약! 손님 모두 기분 ↑' : `${PO.list[id].name} 완성!`) : `${PO.list[id].name} · 30분 동안`);
    const al = bestOf('alchemy' as never);
    if (al && document.getElementById('win')?.classList.contains('on')) showObj(al);
  });
}
