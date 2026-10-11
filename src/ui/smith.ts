// 대장간 창(분해·강화·제작 탭 + 레벨) · 텃밭 창(심기·수확)
import { CONFIG } from '../data/config';
import { DUST_NAME, GRADE_INFO, GRADES, REGIONS, SLOT_NAME, SLOTS, type RegionId, type Slot } from '../data/items';
import { bossHint, craft, craftCost, enhance, enhanceBossCost, enhanceCost, enhanceRate, harvest, plant, plotLeft, plotsOf, salvage, salvageAllCommon, smithLvl } from '../world/craft';
import { nextLevelCost } from '../world/town';
import { bagSize, itemPower } from '../world/items';
import { P, S, world, type Building } from '../world/state';
import * as game from '../game';
import { $, $$, bindTabs, esc, fmt, itemCell, leftText, liveWin, pct, tabs } from './common';
import { showItem } from './guests';
import { appendMoveButton, openWin, toast } from './windows';

let craftRegion: RegionId = 'forest';
let smTab = 0;

/** 등급별 가루 한 줄 */
export const dustLine = () =>
  GRADES.filter((g) => g === 'n' || P.dust[g])
    .map((g) => `<span style="color:${GRADE_INFO[g].color}">${DUST_NAME[g]} ${fmt(P.dust[g])}</span>`)
    .join(' · ');

const ownerName = (id: number | null | undefined) => (id == null ? '' : ((world.home?.actors ?? world.actors).find((a) => a.id === id)?.name ?? ''));
const sorted = () => P.bag.slice().sort((p, q) => 'naerl'.indexOf(q.grade) - 'naerl'.indexOf(p.grade) || itemPower(q) - itemPower(p));

export function openSmith(o: Building, tab = smTab) {
  smTab = tab;
  const lv = smithLvl();
  let body = '';
  if (tab === 0) {
    const rows = sorted()
      .filter((it) => it.owner == null && !it.locked)
      .map((it) => `<div class="irow">${itemCell(it, `data-id="${it.id}"`)}<span><b style="color:${GRADE_INFO[it.grade].color}">${esc(it.name)}${it.enh ? ` +${it.enh}` : ''}</b><small>${DUST_NAME[it.grade]} +${CONFIG.smith.salvage[it.grade]}</small></span><button data-sal="${it.id}">분해</button></div>`)
      .join('');
    body = `<p class="note">장비를 부수면 그 등급의 가루가 나와요 · 끼운 장비는 목록에 없어요</p><button class="bigbtn sm" id="salAll">안 끼운 일반 장비 모두 분해</button><div class="ilist">${rows || '<p class="note">분해할 장비가 없어요</p>'}</div>`;
  } else if (tab === 1) {
    const rows = sorted()
      .map((it) => {
        const max = it.enh >= CONFIG.smith.maxEnhance;
        const cost = enhanceCost(it);
        const own = ownerName(it.owner);
        const bc = enhanceBossCost(it);
        const bossShort = !!bc && (P.bossMats[bc.boss.id] ?? 0) < bc.n;
        const bossTxt = bc ? ` · ${bc.boss.mat} ${bc.n}/${P.bossMats[bc.boss.id] ?? 0}` : '';
        return `<div class="irow">${itemCell(it, `data-id="${it.id}"`)}<span><b style="color:${GRADE_INFO[it.grade].color}">${esc(it.name)}${it.enh ? ` +${it.enh}` : ''}</b><small>${max ? '최대 강화' : `${DUST_NAME[it.grade]} ${cost}${bossTxt} · 성공 ${pct(enhanceRate(it))}`}${own ? ` · ${esc(own)} 착용` : ''}</small>${bossShort ? `<small class="bad">${bossHint(bc!.boss.id)}</small>` : ''}</span><button data-enh="${it.id}" ${max || P.dust[it.grade] < cost || bossShort ? 'disabled' : ''}>+${it.enh + 1}</button></div>`;
      })
      .join('');
    body = `<p class="note">비용 (현재 강화+1)² × 10 · +5까지 실패 없음 · 실패해도 장비는 안 깨져요 · +${CONFIG.smith.bossEnhanceFrom}으로 올릴 땐 그 지역 보스 재료 ${CONFIG.smith.bossEnhanceMats}개</p><div class="ilist">${rows || '<p class="note">강화할 장비가 없어요</p>'}</div>`;
  } else {
    const c = craftCost(craftRegion);
    const regs = REGIONS.map((r) => `<button class="${r.id === craftRegion ? 'on' : ''}" data-r="${r.id}" style="--rc:${r.color}">${r.name}<small>${r.mat} ${P.mats[r.id]}</small></button>`).join('');
    const reg = REGIONS.find((r) => r.id === craftRegion)!;
    const next = nextLevelCost(o);
    const have = P.bossMats[c.boss.id] ?? 0;
    body = `<p class="sub"><b class="g">세트 제작</b> — 「${reg.set.name}」 부위를 골라 만들어요</p>
    <div class="regs">${regs}</div>
    <p class="note">${reg.mat} ${c.mats}/${P.mats[reg.id]} · ${c.boss.mat} ${c.bossMats}/${have} · ${DUST_NAME.n} ${c.dust} · 금화 ${fmt(c.gold)} · 등급은 랜덤(대장간 레벨이 높을수록 ↑)</p>
    ${have < c.bossMats ? `<p class="sub bad">${bossHint(c.boss.id)}</p>` : ''}
    <div class="btnrow">${SLOTS.map((s) => `<button class="bigbtn sm" data-s="${s}">${SLOT_NAME[s]} 만들기</button>`).join('')}</div>
    ${next != null ? `<button class="bigbtn" id="smUp">대장간 Lv.${o.lvl + 1} (${fmt(next)} G) · 가방 +${CONFIG.items.bagPerSmithLevel}칸 · 제작 등급 ↑</button>` : '<p class="note">최고 레벨 대장간이에요</p>'}`;
  }
  openWin(`대장간 Lv.${lv}`, `${tabs(['분해', '강화', '제작'], tab, 'smT')}<p class="sub">${dustLine()} · 가방 ${P.bag.filter((x) => x.owner == null).length}/${bagSize()}</p>${body}`);
  bindTabs('smT', (i) => openSmith(o, i));
  $$('#winB .ic[data-id]').forEach((b) => (b.onclick = () => showItem(P.bag.find((x) => x.id === +b.dataset.id!)!, () => openSmith(o))));
  $$('[data-sal]').forEach(
    (b) =>
      (b.onclick = () => {
        const it = P.bag.find((x) => x.id === +b.dataset.sal!)!;
        if (it.grade !== 'n' && !confirm(`${GRADE_INFO[it.grade].name} 장비를 분해할까요?`)) return;
        toast(`분해 · ${DUST_NAME[it.grade]} +${salvage(it)}`);
        openSmith(o);
      }),
  );
  $$('[data-enh]').forEach(
    (b) =>
      (b.onclick = () => {
        const it = P.bag.find((x) => x.id === +b.dataset.enh!)!;
        const r = enhance(it);
        toast(r === 'ok' ? `강화 성공! ${it.name} +${it.enh}` : r === 'fail' ? '강화 실패… (장비는 그대로)' : r === 'poor' ? '가루가 모자라요' : r === 'boss' ? bossHint(enhanceBossCost(it)!.boss.id) : '강화할 수 없어요');
        openSmith(o);
      }),
  );
  const sa = document.getElementById('salAll');
  if (sa)
    sa.onclick = () => {
      const r = salvageAllCommon();
      toast(r.count ? `${r.count}개 분해 · ${DUST_NAME.n} +${r.dust}` : '분해할 일반 장비가 없어요');
      openSmith(o);
    };
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
  appendMoveButton(o);
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
  // 핫픽스 10 §10: 열어 둔 사이 다 자라면 「수확」 버튼으로 바로
  const ripe = new Set(plots.map((p, i) => (plotLeft(p, now) === 0 ? i : -1)));
  liveWin('텃밭', () => plotsOf(o).some((p, i) => plotLeft(p, Date.now()) === 0 && !ripe.has(i)), () => {
    const fresh = plotsOf(o).map((p, i) => (plotLeft(p, Date.now()) === 0 && !ripe.has(i) ? i : -1)).filter((i) => i >= 0);
    openGarden(o);
    for (const i of fresh) document.querySelector(`[data-h="${i}"]`)?.closest('.plot')?.classList.add('fresh');
  });
  appendMoveButton(o);
  void S;
}
