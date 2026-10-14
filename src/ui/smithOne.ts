// CHECKIN §J7 대장간 「영웅 중심 한 화면」 (플래그 smithOne · 실험실 — 끄면 예전 탭 5개 그대로)
//  창 맨 위: 설명 한 줄 · 대장간 레벨업 줄 · 지붕 색 (건물 창을 건너뛰어 없던 것) → 「지금 할 만한 것」 최대 2개 → 탭 3개
//  · 장비 손질 = 강화·초월·재련: 영웅 카드 한 줄(★ 먼저 · 끝에 「가방 장비」) → 장비 칸 → 행동 판 하나 (+10 미만 강화 · +10 초월 · 작은 [재련])
//      결과 = 망치 0.6초 + 불꽃 + 숫자 튀어 오름 (누르면 바로 끝 · 흔들림 끔·절전이면 0.3초) · 판은 그대로 남아 연속으로
//      판 아래 작게 [모두 강화(이 영웅)] [★ 영웅 전부 +n까지] [일괄 초월…] (bulkSmith) · 영웅 [자동 장착] (= 가장 좋은 걸로 입히기)
//  · 제작 = 예전 제작 탭 그대로 (레벨업 버튼만 맨 위 줄로)
//  · 가방 정리 = [일반·희귀 한 번에 분해](C5) · 자동 분해 · 예전 분해 탭(한 개씩 · 일괄 분해… · 가루 바꾸기…)
import { CONFIG } from '../data/config';
import { def, ROOFS } from '../data/catalog';
import { DUST_NAME, GRADE_INFO, SLOT_NAME, SLOTS, type Slot } from '../data/items';
import { av } from '../engine/ver';
import { shakeLv } from '../engine/shake';
import * as game from '../game';
import { powerOf } from '../world/adventurers';
import { enhance, enhanceCost, gardenLevelState, lastEnh, smithLvl, transcend, transcendCost, transcendOpen } from '../world/craft';
import { favRank, isFav } from '../world/growth';
import { bagSize, equip, itemPower } from '../world/items';
import { bagGear, heroGear, slotAction, smithHeroes, smithPicks } from '../world/smithOne';
import { markDirty, P, S, type Actor, type Building, type Item } from '../world/state';
import { whoWears } from '../world/autoEquip';
import { $$, bindTabs, esc, fmt, itemCell, keepScroll, pct, portrait, tabs } from './common';
import { icon } from './kit';
import { heroCardHtml } from './heroCard';
import { openBestPreview, pickGear, showItem } from './guests';
import { enhMsg, enhUse, pityText, riskText } from './enhance';
import { openReforge } from './reforge';
import { nextGoal, openBulkEnhance, openBulkFor, runToGoal } from './bulkSmith';
import { autoSalvageHtml, bindAutoSalvage, openTidyConfirm, tidyBtnHtml } from './bulkSalvage';
import { bindCraft, bindSalvage, craftHtml, dustLine, salvageHtml, sorted } from './smith';
import { appendMoveButton, openWin, toast, winBack } from './windows';
import { fsay, vis } from '../world/visual';
import { openTransfer } from './enhTransfer';
import { stampFx } from './checkin';
import { lockAttr, lockNote } from './lockBtn';
import { costLine, shortTip, shortWhy } from './costLine';
import { enhanceParts, transcendParts, worstShort, type CostPart } from '../world/shortage';

const SM = () => CONFIG.smith;
/** 지금 탭 · 고른 영웅(-1 = 가방 장비) · 고른 칸 · 가방에서 고른 장비 */
const st = { tab: 0, hero: null as number | null, slot: null as Slot | null, bagItem: null as number | null, bld: false };
/** 다음 그리기에 한 번 보여 줄 연출 */
let fxNext: { kind: 'ok' | 'great' | 'fail' | 'drop'; text: string } | null = null;

const whetOn = () => enhUse.whet && P.growth.whet > 0;

/** 창 맨 위: 설명 한 줄 · 레벨업 줄 · [건물] (R9: 지붕 색은 [건물]을 눌렀을 때만 — 머리 줄을 낮게) */
function headHtml(o: Building): string {
  const d = def('smith');
  const g = gardenLevelState(o);
  const btn = S.visiting
    ? ''
    : g.state === 'up'
      ? `<button id="smUp" ${lockAttr(S.gold >= g.cost! ? null : `금화 ${fmt(g.cost! - S.gold)} 부족`)}>Lv.${g.lv + 1} · ${fmt(g.cost!)} G</button>`
      : g.state === 'land'
        ? `<button ${lockAttr(`땅 넓히기 ${g.needLand}단계가 되면 올릴 수 있어요`)}>Lv.${g.lv + 1} · 땅 ${g.needLand}단계 필요</button>`
        : g.state === 'con'
          ? '<span class="note">🔨 공사 중</span>'
          : '';
  const bld = d.roofable && !S.visiting ? `<button id="smBld" class="${st.bld ? 'on' : ''}" aria-expanded="${st.bld}">건물</button>` : '';
  const roofs = d.roofable && !S.visiting && st.bld ? `<div class="roofs smo-roofs"><span class="note">지붕 색</span>${ROOFS.map(([n, h]) => `<button data-roof="${h}" title="${n}" aria-label="${n}" class="${o.hue === h ? 'on' : ''}" style="background:${h == null ? '#8a8a96' : `hsl(${h} 55% 45%)`}"></button>`).join('')}</div>` : '';
  return `<div class="qhd brdln smo-top"><span class="sub objinfo">${esc(d.desc)} · <b>Lv.${g.lv}</b>${g.state === 'max' ? ' 최대' : ` <small>(다음: ${esc(d.levelText ?? '')})</small>`}</span>${btn}${bld}</div>${roofs}`;
}

/** 「지금 할 만한 것」 (최대 2개 · 누르면 바로 그 화면) */
function picksHtml(): string {
  const ps = smithPicks(2);
  if (!ps.length) return P.growth.favs.length ? '' : '<p class="note smo-pk0">🎯 손님 창에서 ☆를 눌러 「아끼는 영웅」을 정하면 여기에 할 만한 것이 떠요</p>';
  return `<div class="smo-picks">${ps.map((p, i) => `<button class="goalln smo-pick" data-pick="${i}"><span>🎯 ${esc(p.text)}</span></button>`).join('')}</div>`;
}

export function openSmithOne(o: Building, tab = st.tab) {
  st.tab = tab;
  const lv = smithLvl();
  let body = '';
  if (tab === 1) body = craftHtml(o, false);
  else if (tab === 2) body = `<div class="btnrow">${tidyBtnHtml()}</div>${autoSalvageHtml('smoAutoS')}${salvageHtml()}`;
  else body = gearTab();
  const heroScroll = document.querySelector<HTMLElement>('#winB .smo-heroes')?.scrollLeft ?? 0;
  openWin(`대장간 Lv.${lv}`, `${headHtml(o)}${picksHtml()}${tabs(['장비 손질', '제작', '가방 정리'], tab, 'smT')}${tab === 0 ? '' : `<p class="sub">${dustLine()} · 가방 ${P.bag.filter((x) => x.owner == null).length}/${bagSize()}</p>`}${body}`);
  const hr = document.querySelector<HTMLElement>('#winB .smo-heroes');
  if (hr) hr.scrollLeft = heroScroll;
  const redraw = () => keepScroll(() => openSmithOne(o));
  bindTabs('smT', (i) => openSmithOne(o, i));
  // 맨 위 줄
  const bb = document.getElementById('smBld');
  if (bb) bb.onclick = () => ((st.bld = !st.bld), redraw());
  const up = document.getElementById('smUp');
  if (up) up.onclick = () => game.upgrade(o);
  $$('[data-roof]').forEach(
    (b) =>
      (b.onclick = () => {
        game.setRoof(o, b.dataset.roof === 'null' ? null : +b.dataset.roof!);
        $$('[data-roof]').forEach((x) => x.classList.toggle('on', x === b));
      }),
  );
  const ps = smithPicks(2);
  $$('[data-pick]').forEach(
    (b) =>
      (b.onclick = () => {
        const p = ps[+b.dataset.pick!];
        if (!p) return;
        if (p.hero != null) {
          st.hero = p.hero;
          st.slot = p.slot ?? null;
        }
        openSmithOne(o, p.tab);
      }),
  );
  if (tab === 1) bindCraft(o, redraw);
  else if (tab === 2) {
    const td = document.getElementById('bagTidy');
    if (td) td.onclick = () => openTidyConfirm(() => openSmithOne(o));
    bindAutoSalvage('smoAutoS');
    bindSalvage(redraw);
    $$('#winB .ilist .ic[data-id]').forEach((b) => (b.onclick = () => showItem(P.bag.find((x) => x.id === +b.dataset.id!)!, () => openSmithOne(o))));
  } else bindGear(o, redraw);
  appendMoveButton(o);
  playFx();
}

// ───────── 장비 손질 ─────────

/** 지금 고른 영웅 (없으면 첫 영웅 · 영웅이 없으면 가방 장비) */
function pickHero(heroes: Actor[]): Actor | null {
  if (st.hero === -1) return null;
  const a = heroes.find((x) => x.id === st.hero) ?? heroes[0] ?? null;
  st.hero = a ? a.id : -1;
  return a;
}
/** 지금 고른 칸 (없으면 무기 → 장비가 있는 첫 칸) */
function pickSlot(a: Actor): Slot {
  const g = heroGear(a);
  if (st.slot && SLOTS.includes(st.slot)) return st.slot;
  st.slot = (g.find((x) => x.slot === 'weapon' && x.it) ?? g.find((x) => x.it) ?? g[0]).slot;
  return st.slot;
}
const bagList = (heroes: Actor[]) => {
  const set = new Set(bagGear(heroes));
  return sorted().filter((it) => set.has(it));
};

function gearTab(): string {
  const heroes = smithHeroes();
  const a = pickHero(heroes);
  const bag = bagList(heroes);
  const bagCard = `<button type="button" class="hcd sm smo-bagc ${a ? '' : 'on'}" data-hb="1" title="가방 장비 (아무도 안 낀 것)"><span class="hcd-pic smo-bagpic">${icon('m_bag', 24)}</span><span class="hcd-txt"><b class="hcd-nm">가방 ${bag.length}</b></span></button>`;
  const row = `<div class="smo-heroes">${heroes.map((h) => heroCardHtml(h, { size: 'sm', on: !!a && h.id === a.id })).join('')}${bagCard}</div>`;
  if (!a) {
    const it = bag.find((x) => x.id === st.bagItem) ?? bag[0];
    st.bagItem = it?.id ?? null;
    const grid = `<div class="bag smo-bag">${bag.map((x) => itemCell(x, `data-bi="${x.id}"`)).join('') || '<p class="note">가방에 장비가 없어요</p>'}</div>`;
    return `${row}<p class="sub smo-hhd">가방 장비 <small>(아무도 안 낀 것 · 강화·재련도 여기서)</small></p>${grid}${it ? panelHtml(it, null) : ''}<div class="smo-bulk"><div class="btnrow"><button class="bigbtn sm ghost" id="smoBulkE">일괄 강화…</button>${transcendOpen() ? '<button class="bigbtn sm ghost" id="smoBulkT">일괄 초월…</button>' : ''}</div></div>`;
  }
  const slot = pickSlot(a);
  const cells = heroGear(a)
    .map(({ slot: s, it }) => `<button type="button" class="smo-slot ${s === slot ? 'on' : ''}" data-sl="${s}">${it ? itemCell(it) : '<span class="ic empty"></span>'}<small>${SLOT_NAME[s]}${it ? ` <b style="color:${GRADE_INFO[it.grade].color}">+${it.enh}</b>` : ''}</small></button>`)
    .join('');
  const canEquip = a.runId == null && (a.status === 'regular' || a.status === 'hero');
  const hd = `<div class="qhd smo-hhd"><span class="sub">${isFav(a) ? '★ ' : ''}<b>${esc(a.name)}</b> Lv.${a.lvl} · <b class="g">${fmt(powerOf(a))}</b>${a.runId != null ? ' · 원정 중' : ''}</span>${canEquip ? '<button id="smoAuto">자동 장착</button>' : ''}</div>`;
  const it = heroGear(a).find((x) => x.slot === slot)?.it;
  const panel = it ? panelHtml(it, a) : `<div class="smo-panel"><p class="sub">${SLOT_NAME[slot]} 칸이 비어 있어요</p>${canEquip ? '<div class="btnrow"><button class="bigbtn" id="smoSwap">가방에서 고르기</button></div>' : ''}</div>`;
  return `${row}${hd}<div class="smo-slots">${cells}</div>${panel}${bulkHtml(a)}`;
}

/** 판 아래 작은 일괄 버튼들 */
function bulkHtml(a: Actor): string {
  const mine = heroGear(a).map((x) => x.it).filter((x): x is Item => !!x);
  const h = bulkGoal(mine);
  const favItems = smithHeroes()
    .filter((x) => favRank(x) < 99)
    .flatMap((x) => heroGear(x).map((g) => g.it))
    .filter((x): x is Item => !!x);
  const f = bulkGoal(favItems.filter((x) => x.enh < SM().maxEnhance));
  return `<div class="smo-bulk"><div class="btnrow"><button class="bigbtn sm ghost" id="smoAllH" ${lockAttr(h ? null : !mine.length ? '이 영웅은 낀 장비가 없어요' : transcendOpen() ? '모두 최고 단계예요' : `모두 +${SM().maxEnhance} · 초월은 대장간 Lv.${SM().transcend.smithLv}부터`)}>모두 강화 (이 영웅)${h ? ` → +${h.goal}` : ''}</button>${f ? `<button class="bigbtn sm ghost" id="smoAllF">★ 영웅 전부 +${f.goal}까지</button>` : ''}${transcendOpen() ? '<button class="bigbtn sm ghost" id="smoBulkT">일괄 초월…</button>' : ''}</div></div>`;
}
/** 묶음 목표: +10 미만이 있으면 그중 가장 낮은 것의 다음 목표(+5 → +10) · 다 +10이면 초월(열렸을 때) */
function bulkGoal(items: Item[]): { ids: number[]; goal: number; trans: boolean } | null {
  const low = items.filter((x) => x.enh < SM().maxEnhance);
  if (low.length) {
    const goal = nextGoal(Math.min(...low.map((x) => x.enh)), false);
    return { ids: low.map((x) => x.id), goal, trans: false };
  }
  if (!transcendOpen()) return null;
  const hi = items.filter((x) => x.enh < SM().transcend.max);
  if (!hi.length) return null;
  return { ids: hi.map((x) => x.id), goal: nextGoal(Math.min(...hi.map((x) => x.enh)), true), trans: true };
}

/** 초월 규칙 한 줄 (예전 「초월」 탭 머리글과 같은 내용) */
const trRule = () => {
  const T = SM().transcend;
  return `초월: +10 장비를 +${T.max}까지 · 단계마다 능력치 +6% · +${T.nameAt} 「초월한」 · +${T.max} 「극의」`;
};
/** 행동 판 하나: 지금 단계에 맞는 행동만 크게 */
function panelHtml(it: Item, a: Actor | null): string {
  const act = slotAction(it, whetOn());
  const g = GRADE_INFO[it.grade];
  let cost = '';
  let label = '';
  // 회색 버튼엔 이유: 재료마다 필요/가진 · 모자라면 빨강 −n (누르면 얻는 곳) · 큰 버튼 글 = 가장 많이 모자란 재료
  let parts: CostPart[] = [];
  if (act.main === 'enhance') {
    const c = enhanceCost(it);
    parts = enhanceParts(it);
    cost = costLine(parts, '비용: ');
    label = `강화 +${it.enh + 1} · 성공 ${pct(Math.min(1, act.rate))} · ${DUST_NAME[it.grade]} ${fmt(c)}`;
  } else if (act.main === 'transcend') {
    const c = transcendCost(it);
    parts = transcendParts(it);
    cost = costLine(parts, '초월 비용: ');
    label = `초월 +${it.enh + 1} · 성공 ${pct(Math.min(1, act.rate))} · 금화 ${fmt(c.gold)}`;
  } else if (act.main === 'locked') label = `초월은 대장간 Lv.${SM().transcend.smithLv}부터`;
  else if (act.main === 'max') label = '극의에 닿았어요';
  const tryable = act.main === 'enhance' || act.main === 'transcend';
  const short = tryable && act.short ? worstShort(parts) : null;
  if (short) label = shortWhy(parts)!;
  // 막힌 이유 (누르면 토스트): 모자람 = 「○○ n개 부족 · 얻는 곳: …」 · 초월 잠김·극의 = 버튼 글 그대로
  const why = short ? shortTip(parts) : tryable ? null : label || null;
  const G = P.growth;
  const dropStep = act.main === 'enhance' && it.enh + 1 >= CONFIG.growth.enhance.dropFrom;
  const to = tryable ? nextGoal(it.enh, act.main === 'transcend') : 0;
  // 가방 장비: 「누가 끼면 좋을까」 맨 위 한 명
  const who = !a && it.owner == null ? whoWears(it, 1)[0] : undefined;
  return `<div class="smo-panel" id="smoPanel">
    <div class="idet">${itemCell(it, 'id="smoIc"')}<div><b style="color:${g.color}">${esc(it.name)} +${it.enh}</b><small>${g.name} ${SLOT_NAME[it.slot]} · 합 ${fmt(itemPower(it))}${it.locked ? ' · 🔒' : ''}</small></div></div>
    ${tryable ? `<p class="sub" id="smoPity"><b class="g">${pityText(it, whetOn())}</b></p>` : ''}
    <div class="btnrow smo-go"><button class="bigbtn" id="smoGo" ${lockAttr(why)}>${label}</button>${act.reforge ? '<button class="bigbtn sm ghost" id="smoRf">재련</button>' : ''}</div>${short ? lockNote(`얻는 곳: ${short.where}`, 'smoWhy') : ''}
    ${tryable ? `<p class="note">${riskText(it)}</p>${cost}` : ''}${it.enh >= SM().maxEnhance ? `<p class="note">${trRule()}</p>` : ''}
    ${tryable ? `<div class="enhuse"><label class="tog ${dropStep ? '' : 'dim'}"><input type="checkbox" id="smoCharm" ${enhUse.charm ? 'checked' : ''} ${G.charm > 0 ? '' : 'disabled'}> 🧿 부적 <small>(${G.charm}개 · 하락을 막을 때만)</small></label><label class="tog"><input type="checkbox" id="smoWhet" ${enhUse.whet ? 'checked' : ''} ${G.whet > 0 ? '' : 'disabled'}> 🪨 숫돌 <small>(${G.whet}개 · +${Math.round(CONFIG.growth.whet.add * 100)}%p)</small></label></div>` : ''}
    <div class="btnrow smo-sub">${tryable && to > it.enh ? `<button class="bigbtn sm ghost" id="smoTo" ${lockAttr(short ? shortTip(parts) : null)}>+${to}까지</button>` : ''}<button class="bigbtn sm ghost" id="smoInfo">자세히</button>${vis('enhTransfer') ? '<button class="bigbtn sm ghost" id="smoTf">전수</button>' : ''}${a && a.runId == null ? '<button class="bigbtn sm ghost" id="smoSwap">바꾸기</button>' : ''}</div>
    ${who ? `<div class="irow smo-who"><img src="${portrait(who.a)}" alt=""><span>누가 끼면 좋을까 · ${isFav(who.a) ? '★ ' : ''}${esc(who.a.name)} <em class="good">▲ ${fmt(who.gain)}</em></span><button id="smoWear">끼우기</button></div>` : ''}
  </div>`;
}

function bindGear(o: Building, redraw: () => void) {
  const back = () => openSmithOne(o);
  const heroes = smithHeroes();
  const a = st.hero === -1 ? null : (heroes.find((x) => x.id === st.hero) ?? null);
  $$('.smo-heroes [data-hc]').forEach(
    (b) =>
      (b.onclick = () => {
        const id = +b.dataset.hc!;
        if (st.hero !== id) st.slot = null;
        st.hero = id;
        redraw();
      }),
  );
  const hb = document.querySelector<HTMLElement>('.smo-heroes [data-hb]');
  if (hb) hb.onclick = () => ((st.hero = -1), redraw());
  $$('[data-sl]').forEach((b) => (b.onclick = () => ((st.slot = b.dataset.sl as Slot), redraw())));
  $$('[data-bi]').forEach((b) => {
    if (+b.dataset.bi! === st.bagItem) b.classList.add('smo-on');
    b.onclick = () => ((st.bagItem = +b.dataset.bi!), redraw());
  });
  const it = a ? heroGear(a).find((x) => x.slot === st.slot)?.it : P.bag.find((x) => x.id === st.bagItem);
  const au = document.getElementById('smoAuto');
  if (au && a) au.onclick = () => openBestPreview(a, back);
  const sw = document.getElementById('smoSwap');
  if (sw && a && st.slot) sw.onclick = () => pickGear(a, st.slot!, back);
  // 일괄
  const allH = document.getElementById('smoAllH');
  if (allH && a)
    allH.onclick = () => {
      const g = bulkGoal(heroGear(a).map((x) => x.it).filter((x): x is Item => !!x));
      if (g) openBulkFor(g.ids, g.goal, back, g.trans);
    };
  const allF = document.getElementById('smoAllF');
  if (allF)
    allF.onclick = () => {
      const items = smithHeroes()
        .filter((x) => favRank(x) < 99)
        .flatMap((x) => heroGear(x).map((y) => y.it))
        .filter((x): x is Item => !!x && x.enh < SM().maxEnhance);
      const g = bulkGoal(items);
      if (g) openBulkFor(g.ids, g.goal, back, g.trans);
    };
  const be = document.getElementById('smoBulkE');
  if (be) be.onclick = () => openBulkEnhance(back, false);
  const bt = document.getElementById('smoBulkT');
  if (bt) bt.onclick = () => openBulkEnhance(back, true);
  if (!it) return;
  // 행동 판
  const ch = document.getElementById('smoCharm') as HTMLInputElement | null;
  if (ch) ch.onchange = () => (enhUse.charm = ch.checked);
  const wh = document.getElementById('smoWhet') as HTMLInputElement | null;
  if (wh) wh.onchange = () => ((enhUse.whet = wh.checked), redraw());
  const go = document.getElementById('smoGo');
  if (go)
    go.onclick = () => {
      const before = it.enh;
      const use = { charm: enhUse.charm, whet: enhUse.whet };
      if (it.enh >= SM().maxEnhance) {
        const r = transcend(it, use);
        const msg: Record<string, string> = { ok: `초월 성공! ${it.name} +${it.enh}`, fail: '초월 실패… 단계는 그대로 · 다음 시도 성공률 ↑', gold: '금화가 모자라요', mats: '지역 재료가 모자라요 · 사냥터에서 모아요', boss: '보스 재료가 모자라요', dust: '가루가 모자라요', max: '최고 단계예요', locked: '대장간 Lv.5에 열려요', notten: '+10 장비만 초월할 수 있어요' };
        toast(msg[r] + (lastEnh.usedWhet ? ' (숫돌 1개)' : ''));
        if (r === 'ok') fxNext = { kind: 'ok', text: `+${it.enh}` };
        else if (r === 'fail') fxNext = { kind: 'fail', text: '실패' };
      } else {
        const r = enhance(it, use);
        toast(enhMsg(it, r, before));
        if (r === 'ok') fxNext = { kind: lastEnh.great ? 'great' : 'ok', text: `+${it.enh}` };
        else if (r === 'fail') fxNext = lastEnh.drop ? { kind: 'drop', text: `+${it.enh}` } : { kind: 'fail', text: '실패' };
      }
      markDirty();
      redraw();
    };
  const rf = document.getElementById('smoRf');
  if (rf) rf.onclick = () => openReforge(it, back);
  const to = document.getElementById('smoTo');
  if (to)
    to.onclick = () => {
      const goal = nextGoal(it.enh, it.enh >= SM().maxEnhance);
      const before = it.enh;
      toast(runToGoal(it, goal));
      if (it.enh > before) fxNext = { kind: 'ok', text: `+${it.enh}` };
      redraw();
    };
  // 웅스 건의 강화 전수 (enhTransfer): 이 장비 기준 받기·주기 → 확인 시트 → 받은 장비 칸으로 돌아와 도장 「쿵」
  const tf = document.getElementById('smoTf');
  if (tf)
    tf.onclick = () =>
      // 돌아가기·완료 모두 한 칸 뒤로(대장간) 간 뒤 다시 그린다 — 전수 창이 쌓이지 않게 (← 가 지난 목록으로 가지 않게)
      openTransfer(it, () => (winBack(), openSmithOne(o)), (r, recv) => {
        if (r.wearer || recv.owner != null) {
          st.hero = r.wearer?.id ?? recv.owner!;
          st.slot = recv.slot;
        } else {
          st.hero = -1;
          st.bagItem = recv.id;
        }
        winBack();
        openSmithOne(o);
        stampFx('transfer', document.querySelector<HTMLElement>('.smo-slot.on .ic') ?? document.querySelector<HTMLElement>('.smo-bag .ic.smo-on') ?? document.getElementById('smoIc'));
      });
  const inf = document.getElementById('smoInfo');
  if (inf) inf.onclick = () => showItem(it, back);
  const wr = document.getElementById('smoWear');
  if (wr)
    wr.onclick = () => {
      const w = whoWears(it, 1)[0];
      if (!w || !P.bag.includes(it) || it.owner != null) return redraw();
      const before = powerOf(w.a);
      equip(w.a, it);
      markDirty();
      toast(fsay(`${w.a.name} 「${it.name}」 장착 · 전투력 +${fmt(powerOf(w.a) - before)}`, `${w.a.name}님께 「${it.name}」 입혀 드렸어요 · 전투력 +${fmt(powerOf(w.a) - before)}`));
      st.bagItem = null;
      redraw();
    };
}

// ───────── J3 강화 연출: 망치 0.6초 + 불꽃 + 숫자 튀어 오름 (있는 그림: 말풍선 망치 · 전투 불꽃) ─────────
const HAMMER = () => av(new URL('assets/ui/bubble/hammer.png', document.baseURI).href);
const SPARK = () => av(new URL('assets/fx/spark.png', document.baseURI).href);
/** 연출 길이 (초): 보통 0.6 · 흔들림 끔·절전 0.3 */
export const fxDur = (calm = shakeLv() === 'off') => (calm ? 0.3 : 0.6);
function playFx() {
  const f = fxNext;
  fxNext = null;
  // 큰 장비 칸(고른 칸 · 가방에서 고른 칸) 위에 — 없으면 판의 작은 칸
  const ic = document.querySelector<HTMLElement>('.smo-slot.on .ic') ?? document.querySelector<HTMLElement>('.smo-bag .ic.smo-on') ?? document.getElementById('smoIc');
  if (!f || !ic) return;
  const calm = shakeLv() === 'off';
  const el = document.createElement('span');
  el.className = `smo-fx ${f.kind}${calm ? ' calm' : ''}`;
  el.style.setProperty('--fxd', `${fxDur(calm)}s`);
  el.innerHTML = `<img class="smo-ham" src="${HAMMER()}" alt=""><i class="smo-spk" style="background-image:url('${SPARK()}')"></i><b class="smo-num">${esc(f.text)}</b>`;
  ic.appendChild(el);
  const end = () => el.remove();
  setTimeout(end, fxDur(calm) * 1000 + 50);
  document.getElementById('winB')?.addEventListener('pointerdown', end, { once: true, capture: true });
}

/** 시험용 */
export const _smithOne = { st, fx: () => fxNext };
