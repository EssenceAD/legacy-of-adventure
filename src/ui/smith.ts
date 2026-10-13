// 대장간 창(분해·강화·제작 탭 + 레벨) · 텃밭 창(심기·수확)
import { BASE_REGIONS } from '../data/items';
import { huntRegionOpen } from '../world/hunt';
import { CONFIG } from '../data/config';
import { craftMany, craftMax, missingSetSlots } from '../world/bulk';
import { craftSummary, nextGoal, openBulkEnhance, runToGoal } from './bulkSmith';
import { openBulkSalvage } from './bulkSalvage';
import { DUST_NAME, GRADE_INFO, GRADES, REGIONS, SLOT_NAME, SLOTS, type Grade, type RegionId, type Slot } from '../data/items';
import { craftWhet, gardenLevelState, gardenPlots, whetCost } from '../world/craft';
import { vis } from '../world/visual';
import { def } from '../data/catalog';
import { maxLevel } from '../world/town';
import { favActors, favRank } from '../world/growth';
import { openReforge, reforgeTab } from './reforge';
import type { Item } from '../world/state';
import { bossHint, craft, craftCost, enhance, enhanceBossCost, enhanceCost, harvest, plant, plotLeft, plotsOf, salvage, smithLvl, transcend, transcendCost, transcendOpen, fillAsh, salvageText, swapDust, swappableAsh } from '../world/craft';
import { nextLevelCost } from '../world/town';
import { bagSize, itemPower } from '../world/items';
import { P, S, world, type Building } from '../world/state';
import * as game from '../game';
import { $, $$, bindTabs, esc, fmt, itemCell, leftText, liveWin, tabs } from './common';
import { showItem } from './guests';
import { appendMoveButton, openWin, toast } from './windows';
import { confirmSheet } from './confirmSheet';
import { enhMsg, enhUse, openEnhance, pityText } from './enhance';

let craftRegion: RegionId = 'forest';
let smTab = 0;

/** 등급별 가루 한 줄 */
export const dustLine = () =>
  GRADES.filter((g) => g === 'n' || P.dust[g])
    .map((g) => `<span style="color:${GRADE_INFO[g].color}">${DUST_NAME[g]} ${fmt(P.dust[g])}</span>`)
    .join(' · ');

const ownerName = (id: number | null | undefined) => (id == null ? '' : ((world.home?.actors ?? world.actors).find((a) => a.id === id)?.name ?? ''));
const ownerOf = (id: number | null | undefined) => (id == null ? null : (world.home?.actors ?? world.actors).find((a) => a.id === id) ?? null);
/** GROWTH §3-1: ★ 아끼는 영웅이 낀 장비가 맨 위 → 등급 → 전투력 */
const favOf = (it: { owner?: number | null }) => {
  const o = ownerOf(it.owner);
  return o ? favRank(o) : 99;
};
export const sorted = () => P.bag.slice().sort((p, q) => favOf(p) - favOf(q) || 'naerl'.indexOf(q.grade) - 'naerl'.indexOf(p.grade) || itemPower(q) - itemPower(p));

/** GROWTH §3-6: ★ 영웅 장비 중 가장 가까운 목표 (남은 단계가 적은 것 → 가루가 적게 드는 것) */
export function favGoal(): { it: Item; who: string; goal: number; text: string } | null {
  let best: { it: Item; who: string; goal: number; steps: number; cost: number } | null = null;
  const cap = transcendOpen() ? CONFIG.smith.transcend.max : CONFIG.smith.maxEnhance;
  for (const a of favActors())
    for (const sl of SLOTS) {
      const it = P.bag.find((x) => x.id === a.equip?.[sl]);
      if (!it || it.enh >= cap) continue;
      const goal = CONFIG.growth.goals.find((g) => g > it.enh && g <= cap) ?? cap;
      let cost = 0;
      for (let e = it.enh; e < goal; e++) cost += e < CONFIG.smith.maxEnhance ? enhanceCost({ ...it, enh: e } as Item) : transcendCost({ ...it, enh: e } as Item).dust;
      const steps = goal - it.enh;
      if (!best || steps < best.steps || (steps === best.steps && cost < best.cost)) best = { it, who: a.name, goal, steps, cost };
    }
  if (!best) return null;
  const it = best.it;
  return { it, who: best.who, goal: best.goal, text: `${best.who} ${SLOT_NAME[it.slot]} +${best.goal}까지 — ${DUST_NAME[it.grade]} ${fmt(best.cost)} · ${pityText(it).replace('다음 ', '')}` };
}
function goalLine(): string {
  const g = favGoal();
  if (!g) return '<p class="note goalln">🎯 다음 목표: 손님 창에서 ☆를 눌러 「아끼는 영웅」을 정하면 여기서 바로 강화해요</p>';
  return `<div class="goalln"><span>🎯 다음 목표 · ${esc(g.text)}</span><button id="sGoal">바로 강화</button></div>`;
}
/** 강화·초월 탭 체크칸: 🧿 부적 · 🪨 숫돌 */
function useHtml(): string {
  const G = P.growth;
  return `<div class="enhuse"><label class="tog"><input type="checkbox" id="sCharm" ${enhUse.charm ? 'checked' : ''} ${G.charm > 0 ? '' : 'disabled'}> 🧿 부적 쓰기 <small>(${G.charm}개)</small></label><label class="tog"><input type="checkbox" id="sWhet" ${enhUse.whet ? 'checked' : ''} ${G.whet > 0 ? '' : 'disabled'}> 🪨 숫돌 쓰기 <small>(${G.whet}개)</small></label></div>`;
}

export function openSmith(o: Building, tab = smTab) {
  smTab = tab;
  const lv = smithLvl();
  let body = '';
  if (tab === 0) {
    const rows = sorted()
      .filter((it) => it.owner == null && !it.locked)
      .map((it) => `<div class="irow">${itemCell(it, `data-id="${it.id}"`)}<span><b style="color:${GRADE_INFO[it.grade].color}">${esc(it.name)}${it.enh ? ` +${it.enh}` : ''}</b><small>${salvageText(it.grade)}</small></span><button data-sal="${it.id}">분해</button></div>`)
      .join('');
    body = `<p class="note">장비를 부수면 그 등급의 가루가 나와요 · 끼운 장비는 목록에 없어요</p><button class="bigbtn sm" id="salAll">일괄 분해…</button><button class="bigbtn sm ghost" id="dSwap">가루 바꾸기…</button><div class="ilist">${rows || '<p class="note">분해할 장비가 없어요</p>'}</div>`;
  } else if (tab === 1) {
    const rows = sorted()
      .map((it) => {
        const max = it.enh >= CONFIG.smith.maxEnhance;
        const cost = enhanceCost(it);
        const own = ownerName(it.owner);
        const bc = enhanceBossCost(it);
        const bossShort = !!bc && (P.bossMats[bc.boss.id] ?? 0) < bc.n;
        const bossTxt = bc ? ` · ${bc.boss.mat} ${bc.n}/${P.bossMats[bc.boss.id] ?? 0}` : '';
        return `<div class="irow">${itemCell(it, `data-id="${it.id}"`)}<span><b style="color:${GRADE_INFO[it.grade].color}">${favOf(it) < 99 ? '★ ' : ''}${esc(it.name)}${it.enh ? ` +${it.enh}` : ''}</b><small>${max ? '최대 강화 · 「초월」 탭에서 +11부터' : `${DUST_NAME[it.grade]} ${cost}${bossTxt} · ${pityText(it)}`}${own ? ` · ${esc(own)} 착용` : ''}</small>${bossShort ? `<small class="bad">${bossHint(bc!.boss.id)}</small>` : ''}</span>${max ? '' : `<button class="ghost to" data-to="${it.id}" data-g="${nextGoal(it.enh, false)}" ${P.dust[it.grade] < cost || bossShort ? 'disabled' : ''}>+${nextGoal(it.enh, false)}까지</button>`}<button data-enh="${it.id}" ${max || P.dust[it.grade] < cost || bossShort ? 'disabled' : ''}>+${it.enh + 1}</button></div>`;
      })
      .join('');
    body = `<p class="note">비용 (현재 강화+1)² × 10 · +1만 확정 · +${CONFIG.growth.enhance.dropFrom}~+10 실패는 ${Math.round(CONFIG.growth.enhance.dropChance * 100)}% 확률로 1단계 하락(🧿 부적이 막음) · 실패마다 그 장비 +${Math.round(CONFIG.growth.enhance.pity * 100)}%p · 대성공 ${Math.round(CONFIG.growth.enhance.great * 100)}%(+2) · +${CONFIG.smith.bossEnhanceFrom}으로 올릴 땐 그 지역 보스 재료 ${CONFIG.smith.bossEnhanceMats}개</p>${useHtml()}<button class="bigbtn sm" id="bulkEnh">일괄 강화…</button><div class="ilist">${rows || '<p class="note">강화할 장비가 없어요</p>'}</div>`;
  } else if (tab === 3) {
    // ECONOMY §2: 초월 +11 ~ +20 (+10 장비만)
    const T = CONFIG.smith.transcend;
    if (!transcendOpen()) body = `<p class="note">대장간 Lv.${T.smithLv}에 「초월」이 열려요 · +10 장비를 +${T.max}까지</p>`;
    else {
      const rows = sorted()
        .filter((it) => it.enh >= CONFIG.smith.maxEnhance)
        .map((it) => {
          const max = it.enh >= T.max;
          const c = transcendCost(it);
          const own = ownerName(it.owner);
          const short = S.gold < c.gold || (P.mats[it.region] ?? 0) < c.mats || (P.bossMats[c.boss.id] ?? 0) < c.bossMats || (P.dust[it.grade] ?? 0) < c.dust;
          const reg = REGIONS.find((r) => r.id === it.region)!;
          const need = max ? '극의에 닿았어요' : `금화 ${fmt(c.gold)} · ${reg.mat} ${c.mats}/${P.mats[it.region] ?? 0} · ${c.boss.mat} ${c.bossMats}/${P.bossMats[c.boss.id] ?? 0} · ${DUST_NAME[it.grade]} ${c.dust}/${fmt(P.dust[it.grade] ?? 0)}`;
          return `<div class="irow ${it.enh >= T.max ? 'tr20' : ''}">${itemCell(it, `data-id="${it.id}"`)}<span><b style="color:${GRADE_INFO[it.grade].color}">${esc(it.name)} +${it.enh}</b><small>${need}</small>${max ? '' : `<small>${pityText(it)}${own ? ` · ${esc(own)} 착용` : ''}</small>`}</span>${max ? '' : `<button class="ghost to" data-to="${it.id}" data-g="${nextGoal(it.enh, true)}" ${short ? 'disabled' : ''}>+${nextGoal(it.enh, true)}까지</button>`}<button data-tr="${it.id}" ${max || short ? 'disabled' : ''}>${max ? '최고' : `+${it.enh + 1}`}</button></div>`;
        })
        .join('');
      body = `<p class="note">+10 장비를 +${T.max}까지 · 단계마다 능력치 +6% · +${T.nameAt} 「초월한」 · +${T.max} 「극의」 · 실패해도 단계는 그대로, 다음 시도 성공률 +${Math.round(CONFIG.growth.transcend.pity * 100)}%p (+11 ${Math.round(CONFIG.growth.transcend.rates[0] * 100)}% → +20 ${Math.round(CONFIG.growth.transcend.rates[9] * 100)}%)</p>${useHtml()}<button class="bigbtn sm" id="bulkTr">일괄 초월…</button><div class="ilist">${rows || '<p class="note">+10 장비가 없어요 · 강화 탭에서 +10까지 올려요</p>'}</div>`;
    }
  } else if (tab === 4) {
    body = reforgeTab(sorted());
  } else {
    const c = craftCost(craftRegion);
    const regs = REGIONS.filter((_, i) => i < BASE_REGIONS || huntRegionOpen(i)).map((r) => `<button class="${r.id === craftRegion ? 'on' : ''}" data-r="${r.id}" style="--rc:${r.color}">${r.name}<small>${r.mat} ${P.mats[r.id]}</small></button>`).join('');
    const reg = REGIONS.find((r) => r.id === craftRegion)!;
    const next = nextLevelCost(o);
    const have = P.bossMats[c.boss.id] ?? 0;
    body = `<p class="sub"><b class="g">세트 제작</b> — 「${reg.set.name}」 부위를 골라 만들어요</p>
    <div class="regs">${regs}</div>
    <p class="note">${reg.mat} ${c.mats}/${P.mats[reg.id]} · ${c.boss.mat} ${c.bossMats}/${have} · ${DUST_NAME.n} ${c.dust} · 금화 ${fmt(c.gold)} · 등급은 랜덤(대장간 레벨이 높을수록 ↑)</p>
    ${have < c.bossMats ? `<p class="sub bad">${bossHint(c.boss.id)}</p>` : ''}
    ${ashShort(craftRegion) > 0 && swappableAsh() > 0 ? `<button class="bigbtn sm" id="cFill">가루 바꾸기로 채우기 (${DUST_NAME.n} ${fmt(ashShort(craftRegion))} 모자람)</button>` : ''}
    <div class="crows">${SLOTS.map((s) => `<div class="crow2"><b>${SLOT_NAME[s]}</b><button data-cs="${s}" data-n="1">1</button><button data-cs="${s}" data-n="5">5</button><button data-cs="${s}" data-n="max">최대 ${craftMax(craftRegion)}</button></div>`).join('')}</div>
    <div class="crow2 whetrow"><span>🪨 <b>행운의 숫돌</b> <small>(가진 것 ${P.growth.whet}) · 다음 1회 강화·초월 성공률 +${Math.round(CONFIG.growth.whet.add * 100)}%p<br>${DUST_NAME.n} ${whetCost(craftRegion).ash}/${fmt(P.dust.n)} · ${reg.mat} ${whetCost(craftRegion).mats}/${P.mats[reg.id]} · 금화 ${fmt(whetCost(craftRegion).gold)}</small></span><button id="cWhet">만들기</button></div>
    <button class="bigbtn sm ghost" id="cSet" ${missingSetSlots(craftRegion).length ? '' : 'disabled'}>세트 맞추기 (없는 부위 ${missingSetSlots(craftRegion).length}개)</button>
    ${next != null ? `<button class="bigbtn" id="smUp">대장간 Lv.${o.lvl + 1} (${fmt(next)} G) · 가방 +${CONFIG.items.bagPerSmithLevel}칸 · 제작 등급 ↑</button>` : '<p class="note">최고 레벨 대장간이에요</p>'}`;
  }
  openWin(`대장간 Lv.${lv}`, `${tabs(['분해', '강화', '제작', '초월', '재련'], tab, 'smT')}${goalLine()}<p class="sub">${dustLine()} · 가방 ${P.bag.filter((x) => x.owner == null).length}/${bagSize()}</p>${body}`);
  bindTabs('smT', (i) => openSmith(o, i));
  $$('#winB .ic[data-id]').forEach((b) => (b.onclick = () => showItem(P.bag.find((x) => x.id === +b.dataset.id!)!, () => openSmith(o))));
  $$('[data-sal]').forEach(
    (b) =>
      (b.onclick = async () => {
        const it = P.bag.find((x) => x.id === +b.dataset.sal!)!;
        // J4 confirmSheet: 희귀 이상 분해는 아래 확인 시트 (끄면 예전 confirm 그대로)
        if (it.grade !== 'n' && !(vis('confirmSheet') ? await confirmSheet({ title: `${GRADE_INFO[it.grade].name} 장비를 분해할까요?`, body: `${it.name} → ${salvageText(it.grade)}`, ok: '분해하기', danger: true }) : confirm(`${GRADE_INFO[it.grade].name} 장비를 분해할까요?`))) return;
        if (!P.bag.includes(it)) return;
        salvage(it);
        toast(`분해 · ${salvageText(it.grade)}`);
        openSmith(o);
      }),
  );
  $$('[data-enh]').forEach(
    (b) =>
      (b.onclick = () => {
        const it = P.bag.find((x) => x.id === +b.dataset.enh!)!;
        const before = it.enh;
        const r = enhance(it, { ...enhUse });
        toast(enhMsg(it, r, before));
        openSmith(o);
      }),
  );
  $$('[data-tr]').forEach(
    (b) =>
      (b.onclick = () => {
        const it = P.bag.find((x) => x.id === +b.dataset.tr!)!;
        const r = transcend(it, { ...enhUse });
        const msg: Record<string, string> = { ok: `초월 성공! ${it.name} +${it.enh}`, fail: '초월 실패… 단계는 그대로 · 다음 시도 성공률 ↑', gold: '금화가 모자라요', mats: '지역 재료가 모자라요 · 사냥터에서 모아요', boss: '보스 재료가 모자라요', dust: '가루가 모자라요', max: '최고 단계예요', locked: '대장간 Lv.5에 열려요', notten: '+10 장비만 초월할 수 있어요' };
        toast(msg[r]);
        openSmith(o);
      }),
  );
  const sa = document.getElementById('salAll');
  if (sa)
    sa.onclick = () => openBulkSalvage(() => openSmith(o));
  $$('.regs button').forEach(
    (b) =>
      (b.onclick = () => {
        craftRegion = b.dataset.r as RegionId;
        openSmith(o);
      }),
  );
  // SMITH §3: 부위마다 1 · 5 · 최대 → 요약 카드
  $$('[data-cs]').forEach(
    (b) =>
      (b.onclick = () => {
        const slot = b.dataset.cs as Slot;
        const n = b.dataset.n === 'max' ? craftMax(craftRegion) : +b.dataset.n!;
        if (n <= 0) return toast(P.bag.filter((x) => x.owner == null).length >= bagSize() ? '가방이 꽉 찼어요 · 분해 탭에서 비워요' : '재료가 모자라요');
        if (n === 1) {
          const r = craft(craftRegion, slot);
          if (typeof r === 'string') return toast(r);
          toast(`${GRADE_INFO[r.grade].name} ${r.name} 완성!`);
          openWin('제작 완료!', `<div class="idet">${itemCell(r)}<div><b style="color:${GRADE_INFO[r.grade].color}">${esc(r.name)}</b><small>세트 부위</small></div></div><button class="bigbtn sm" id="cOk">자세히</button>`);
          $('#cOk').onclick = () => showItem(r, () => openSmith(o));
          return;
        }
        const slots = Array.from({ length: n }, () => slot);
        craftSummary(craftRegion, craftMany(craftRegion, slots), () => openSmith(o), slots);
      }),
  );
  const cf = document.getElementById('cFill');
  if (cf)
    cf.onclick = () => {
      const got = fillAsh(ashShort(craftRegion));
      toast(got ? `가루를 바꿔 ${DUST_NAME.n} +${fmt(got)}` : '바꿀 가루가 없어요');
      openSmith(o);
    };
  const ds = document.getElementById('dSwap');
  if (ds) ds.onclick = () => openDustSwap(() => openSmith(o));
  const cs = document.getElementById('cSet');
  if (cs)
    cs.onclick = () => {
      const slots = missingSetSlots(craftRegion);
      craftSummary(craftRegion, craftMany(craftRegion, slots), () => openSmith(o), slots);
    };
  // SMITH §2: 일괄 강화 · 일괄 초월 · 줄마다 「목표까지」
  const be = document.getElementById('bulkEnh');
  if (be) be.onclick = () => openBulkEnhance(() => openSmith(o), false);
  const bt = document.getElementById('bulkTr');
  if (bt) bt.onclick = () => openBulkEnhance(() => openSmith(o), true);
  $$('[data-to]').forEach(
    (b) =>
      (b.onclick = () => {
        const it = P.bag.find((x) => x.id === +b.dataset.to!)!;
        toast(runToGoal(it, +b.dataset.g!));
        openSmith(o);
      }),
  );
  // GROWTH: 다음 목표 · 부적·숫돌 체크칸 · 숫돌 만들기 · 재련
  const sg = document.getElementById('sGoal');
  if (sg)
    sg.onclick = () => {
      const g = favGoal();
      if (g) openEnhance(g.it, () => openSmith(o));
    };
  const sc = document.getElementById('sCharm') as HTMLInputElement | null;
  if (sc) sc.onchange = () => (enhUse.charm = sc.checked);
  const sw = document.getElementById('sWhet') as HTMLInputElement | null;
  if (sw) sw.onchange = () => (enhUse.whet = sw.checked);
  const cw = document.getElementById('cWhet');
  if (cw)
    cw.onclick = () => {
      const err = craftWhet(craftRegion);
      toast(err ?? `🪨 행운의 숫돌 완성! (가진 것 ${P.growth.whet})`);
      openSmith(o);
    };
  $$('[data-rf]').forEach((b) => (b.onclick = () => openReforge(P.bag.find((x) => x.id === +b.dataset.rf!)!, () => openSmith(o, 4))));
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
          .map(([k, c]) => (c.land && S.land < c.land ? `<button class="bigbtn sm" disabled>${c.name} (땅 ${c.land}단계)</button>` : `<button class="bigbtn sm" data-p="${i}" data-c="${k}">${c.name} (${c.seed}G · ${c.minutes}분)</button>`))
          .join('')}</div></div>`;
      const c = CONFIG.garden.crops[p.crop!];
      if (left === 0) return `<div class="plot ripe"><b>${c.name} 다 자랐어요!</b><button class="bigbtn sm" data-h="${i}">수확 (+${c.yield})</button></div>`;
      return `<div class="plot"><b>${c.name} 자라는 중</b><div class="pbar" data-start="${p.at}" data-end="${now + left}"><i><b></b></i><em>${leftText(left)}</em></div></div>`;
    })
    .join('');
  // v0.25.4: 맨 위 정보 한 줄(actionsTidy) · 텃밭 레벨 줄(gardenLevelUp)
  const head = (vis('actionsTidy') ? `<p class="sub objinfo">${esc(def('garden').desc)} · ${esc(def('garden').levelText ?? '')}</p>` : '') + (vis('gardenLevelUp') ? gardenLine(o) : '');
  openWin(
    '텃밭',
    `${head}<p class="sub">창고: ${Object.entries(P.crops).filter(([, n]) => n > 0).map(([k, n]) => `${CONFIG.garden.crops[k]?.name ?? k} <b class="g">${n}</b>`).join(' · ') || '비어 있어요'}${P.pantry ? ` · 채소 <b class="g">${P.pantry}</b>` : ''}</p><p class="note">먹을 수 있는 작물은 주점 식사에 자동으로 · 약초·별꽃은 연금술 공방 재료</p>${rows}<p class="note">꺼 둬도 작물은 자라요</p>`,
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
        toast(`수확! +${n}`);
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
  const gu = document.getElementById('gdUp');
  if (gu) gu.onclick = () => game.upgrade(o);
  appendMoveButton(o);
  void S;
}

// ───────── v0.25.4 텃밭 레벨업 (gardenLevelUp): 「텃밭 Lv.x · 밭 n칸」 줄 오른쪽에 버튼 (게시판 레벨업과 같은 모양 · 공사 규칙은 game.upgrade) ─────────
function gardenLine(o: Building): string {
  const g = gardenLevelState(o);
  const btn = S.visiting
    ? ''
    : g.state === 'up'
    ? `<button id="gdUp" ${S.gold >= g.cost! ? '' : 'disabled'}>텃밭 Lv.${g.lv + 1} · ${fmt(g.cost!)} G</button>`
    : g.state === 'land'
    ? `<button disabled>Lv.${g.lv + 1} · 땅 ${g.needLand}단계 필요</button>`
    : g.state === 'con'
    ? '<span class="note">🔨 공사 중</span>'
    : '';
  let note = '';
  if (g.state === 'up' || g.state === 'land') {
    if (g.next! > g.plots) note = `Lv.${g.lv + 1}이 되면 밭 ${g.next}칸`;
    else {
      let L = g.lv + 1;
      while (L < maxLevel('garden') && gardenPlots(L) <= g.plots) L++;
      if (gardenPlots(L) > g.plots) note = `Lv.${L}에 밭 +1칸 (2레벨마다)`;
    }
  }
  return `<div class="qhd brdln"><span class="sub">텃밭 <b>Lv.${g.lv}</b>${g.state === 'max' ? ' · 최대' : ''} · 밭 ${g.plots}칸</span>${btn}</div>${note ? `<p class="note">${note}</p>` : ''}`;
}

/** HOTFIX21: 다른 재료·금화·가방으로는 더 만들 수 있는데 잿빛 가루만 모자란 양 (최대 제작 기준) */
function ashShort(r: RegionId): number {
  const c = craftCost(r);
  const free = bagSize() - P.bag.filter((x) => x.owner == null).length;
  const n = Math.max(0, Math.min(free, Math.floor(P.mats[r] / Math.max(1, c.mats)), Math.floor(S.gold / Math.max(1, c.gold)), c.bossMats ? Math.floor((P.bossMats[c.boss.id] ?? 0) / c.bossMats) : 99));
  return Math.max(0, n * c.dust - P.dust.n);
}
/** HOTFIX21: 가루 바꾸기 창 — 높은 가루 → 잿빛 (반대 방향 없음) */
export function openDustSwap(back: () => void) {
  const rows = (['r', 'e', 'l'] as Grade[])
    .map((g) => {
      const rate = CONFIG.smith.dustSwap[g];
      const have = P.dust[g];
      const b = (n: number, t: string) => `<button data-sw="${g}" data-n="${n}" ${have >= Math.max(1, n) ? '' : 'disabled'}>${t}</button>`;
      return `<div class="crow2"><span><b style="color:${GRADE_INFO[g].color}">${DUST_NAME[g]}</b> 1 → ${DUST_NAME.n} ${rate} <small>(가진 것 ${fmt(have)})</small></span>${b(1, '1개')}${b(10, '10개')}${b(have, '전부')}</div>`;
    })
    .join('');
  openWin('가루 바꾸기', `<p class="sub">${dustLine()}</p><p class="note">높은 등급 가루를 잿빛 가루로 바꿔요 · 반대로는 바꿀 수 없어요</p><div class="crows">${rows}</div><button class="bigbtn ghost" id="swBack">돌아가기</button>`);
  $$('[data-sw]').forEach(
    (b) =>
      (b.onclick = () => {
        const got = swapDust(b.dataset.sw as Grade, +b.dataset.n!);
        if (got) toast(`${DUST_NAME.n} +${fmt(got)}`);
        openDustSwap(back);
      }),
  );
  $('#swBack').onclick = back;
}
