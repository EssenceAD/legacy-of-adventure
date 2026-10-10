// 대장간 창(가루·제작·레벨) · 텃밭 창(심기·수확)
import { CONFIG } from '../data/config';
import { GRADE_INFO, REGIONS, SLOT_NAME, SLOTS, type RegionId, type Slot } from '../data/items';
import { craft, craftCost, harvest, plant, plotLeft, plotsOf, smithLvl } from '../world/craft';
import { bagSize } from '../world/items';
import { P, S, type Building } from '../world/state';
import * as game from '../game';
import { $, $$, esc, fmt, itemCell, leftText } from './common';
import { openBag, showItem } from './guests';
import { openWin, toast } from './windows';

let craftRegion: RegionId = 'forest';

export function openSmith(o: Building) {
  const lv = smithLvl();
  const c = craftCost(craftRegion);
  const regs = REGIONS.map((r) => `<button class="${r.id === craftRegion ? 'on' : ''}" data-r="${r.id}" style="--rc:${r.color}">${r.name}<small>${r.mat} ${P.mats[r.id]}</small></button>`).join('');
  const reg = REGIONS.find((r) => r.id === craftRegion)!;
  const next = o.lvl < 5 ? CONFIG.smith.levelCosts[o.lvl] : null;
  openWin(
    `대장간 Lv.${lv}`,
    `<p class="sub">가루 <b class="g">${fmt(P.dust.n)}</b> · 가방 ${bagSize()}칸</p>
    <button class="bigbtn sm" id="smBag">가방 열기 · 강화 / 분해</button>
    <p class="sub" style="margin-top:10px"><b class="g">세트 제작</b> — 「${reg.set.name}」 부위를 만들어요</p>
    <div class="regs">${regs}</div>
    <p class="note">재료 ${c.mats} · 가루 ${c.dust} · 금화 ${fmt(c.gold)} · 대장간 레벨이 높을수록 좋은 등급</p>
    <div class="btnrow">${SLOTS.map((s) => `<button class="bigbtn sm" data-s="${s}">${SLOT_NAME[s]} 만들기</button>`).join('')}</div>
    ${next != null ? `<button class="bigbtn" id="smUp">대장간 Lv.${o.lvl + 1} (${fmt(next)} G) · 가방 +${CONFIG.items.bagPerSmithLevel}칸 · 제작 등급 ↑</button>` : '<p class="note">최고 레벨 대장간이에요</p>'}`,
  );
  $('#smBag').onclick = openBag;
  $$('.regs button').forEach(
    (b) =>
      (b.onclick = () => {
        craftRegion = b.dataset.r as RegionId;
        openSmith(o);
      }),
  );
  $$('.btnrow [data-s]').forEach(
    (b) =>
      (b.onclick = () => {
        const r = craft(craftRegion, b.dataset.s as Slot);
        if (typeof r === 'string') return toast(r);
        toast(`${GRADE_INFO[r.grade].name} ${r.name} 완성!`);
        openWin('제작 완료!', `<div class="idet">${itemCell(r)}<div><b style="color:${GRADE_INFO[r.grade].color}">${esc(r.name)}</b><small>세트 부위</small></div></div><button class="bigbtn sm" id="cOk">자세히</button>`);
        $('#cOk').onclick = () => showItem(r, () => openSmith(o));
      }),
  );
  const up = document.getElementById('smUp');
  if (up) up.onclick = () => (game.upgrade(o), openSmith(o));
}

export function openGarden(o: Building) {
  const plots = plotsOf(o);
  const now = Date.now();
  const rows = plots
    .map((p, i) => {
      const left = plotLeft(p, now);
      if (left == null)
        return `<div class="plot"><b>빈 밭 ${i + 1}</b><div class="btnrow">${Object.entries(CONFIG.garden.crops)
          .map(([k, c]) => `<button class="bigbtn sm" data-p="${i}" data-c="${k}">${c.name} (${c.seed}G · ${c.minutes}분)</button>`)
          .join('')}</div></div>`;
      const c = CONFIG.garden.crops[p.crop!];
      if (left === 0) return `<div class="plot ripe"><b>${c.name} 다 자랐어요!</b><button class="bigbtn sm" data-h="${i}">수확 (+${c.yield})</button></div>`;
      return `<div class="plot"><b>${c.name} 자라는 중</b><div class="pbar" data-start="${p.at}" data-end="${now + left}"><i><b></b></i><em>${leftText(left)}</em></div></div>`;
    })
    .join('');
  openWin(
    '텃밭',
    `<p class="sub">수확한 채소 <b class="g">${P.pantry}</b>개 → 주점 식사가 더 든든해져요 (배고픔·기분 ↑)</p>${rows}<p class="note">꺼 둬도 작물은 자라요</p>`,
  );
  $$('[data-c]').forEach(
    (b) =>
      (b.onclick = () => {
        const err = plant(o, +b.dataset.p!, b.dataset.c!);
        if (err) return toast(err);
        openGarden(o);
      }),
  );
  $$('[data-h]').forEach(
    (b) =>
      (b.onclick = () => {
        const n = harvest(o, +b.dataset.h!);
        toast(`수확! 채소 +${n}`);
        openGarden(o);
      }),
  );
  void S;
}
