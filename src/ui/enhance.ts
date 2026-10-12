// GROWTH §3-2·§3-3: 장비 하나 강화 창 — 다음 성공률(천장 표시) · 위험(하락 · 대성공) · [부적 쓰기] [숫돌 쓰기] · 초월까지 한 창에서
import { CONFIG } from '../data/config';
import { DUST_NAME, GRADE_INFO, regionById, SLOT_NAME } from '../data/items';
import { bossHint, enhance, enhanceBossCost, enhanceCost, enhanceRate, lastEnh, smithObj, transcend, transcendCost, transcendOpen, transcendRate } from '../world/craft';
import { itemPower } from '../world/items';
import { markDirty, P, S, world, type Item } from '../world/state';
import { $, esc, fmt, itemCell, pct } from './common';
import { openWin, toast } from './windows';

/** 강화 창·대장간 강화 탭이 같이 쓰는 체크칸 (이 기기에서 켜 둔 채로) */
export const enhUse = { charm: false, whet: false };
const SM = () => CONFIG.smith;
const GE = () => CONFIG.growth.enhance;

/** 「다음 성공률 32% (+9%)」 — 괄호 = 실패가 쌓인 천장 */
export function pityText(it: Item, whet = false): string {
  const tr = it.enh >= SM().maxEnhance;
  const rate = tr ? transcendRate(it, whet) : enhanceRate(it, whet);
  const pity = (tr ? it.tPity : it.ePity) ?? 0;
  return `다음 성공률 ${pct(rate)}${pity > 0 ? ` (+${Math.round(pity * 100)}%)` : ''}`;
}
/** 위험 한 줄: 실패 하락 · 대성공 */
export function riskText(it: Item): string {
  if (it.enh >= SM().maxEnhance) return '실패해도 단계는 그대로 · 실패할 때마다 다음 성공률 +' + Math.round(CONFIG.growth.transcend.pity * 100) + '%p';
  const t = it.enh + 1;
  const out: string[] = [];
  if (enhanceRate(it) >= 1) out.push('확정 성공');
  else if (t >= GE().dropFrom) out.push(`실패하면 ${Math.round(GE().dropChance * 100)}% 확률로 1단계 하락`);
  else out.push('실패해도 단계는 그대로');
  if (t <= GE().greatMax) out.push(`대성공 ${Math.round(GE().great * 100)}% (+2)`);
  if (enhanceRate(it) < 1) out.push(`실패마다 +${Math.round(GE().pity * 100)}%p`);
  return out.join(' · ');
}
/** 강화 한 번의 결과 한 줄 (대성공 · 하락 · 부적 · 숫돌) */
export function enhMsg(it: Item, r: string, before: number): string {
  const tail = lastEnh.usedWhet ? ' (숫돌 1개)' : '';
  if (r === 'ok') return (lastEnh.great ? `✨ 대성공! ${esc0(it.name)} +${before} → +${it.enh}` : `강화 성공! ${esc0(it.name)} +${it.enh}`) + tail;
  if (r === 'fail') {
    if (lastEnh.saved) return `실패… 🧿 부적이 하락을 막았어요 (+${it.enh})${tail}`;
    if (lastEnh.drop) return `실패… 단계가 떨어졌어요 +${before} → +${it.enh}${tail}`;
    return `강화 실패… (+${it.enh} 그대로) · ${pityText(it)}${tail}`;
  }
  if (r === 'poor') return '가루가 모자라요';
  if (r === 'boss') return bossHint(enhanceBossCost(it)!.boss.id);
  return '강화할 수 없어요';
}
const esc0 = (s: string) => s;
const ownerName = (it: Item) => (it.owner == null ? '' : ((world.home?.actors ?? world.actors).find((a) => a.id === it.owner)?.name ?? ''));

export function openEnhance(it: Item, back?: () => void, swap?: () => void) {
  if (!P.bag.includes(it)) return back?.();
  const tr = it.enh >= SM().maxEnhance;
  const maxed = tr ? it.enh >= SM().transcend.max || !transcendOpen() : false;
  const g = GRADE_INFO[it.grade];
  const own = ownerName(it);
  let costLine = '';
  let short = false;
  if (!smithObj()) {
    costLine = '<p class="sub bad">대장간이 있어야 강화할 수 있어요</p>';
    short = true;
  } else if (tr) {
    if (!transcendOpen()) costLine = `<p class="note">대장간 Lv.${SM().transcend.smithLv}에 「초월」이 열려요 (+${SM().transcend.max}까지)</p>`;
    else if (!maxed) {
      const c = transcendCost(it);
      const reg = regionById(it.region);
      short = S.gold < c.gold || (P.mats[it.region] ?? 0) < c.mats || (P.bossMats[c.boss.id] ?? 0) < c.bossMats || (P.dust[it.grade] ?? 0) < c.dust;
      costLine = `<p class="note">초월 비용: 금화 ${fmt(c.gold)}/${fmt(S.gold)} · ${reg.mat} ${c.mats}/${P.mats[it.region] ?? 0} · ${c.boss.mat} ${c.bossMats}/${P.bossMats[c.boss.id] ?? 0} · ${DUST_NAME[it.grade]} ${c.dust}/${fmt(P.dust[it.grade] ?? 0)}</p>`;
    }
  } else {
    const cost = enhanceCost(it);
    const bc = enhanceBossCost(it);
    const bossShort = !!bc && (P.bossMats[bc.boss.id] ?? 0) < bc.n;
    short = P.dust[it.grade] < cost || bossShort;
    costLine = `<p class="note">비용: ${DUST_NAME[it.grade]} ${fmt(cost)}/${fmt(P.dust[it.grade])}${bc ? ` · ${bc.boss.mat} ${bc.n}/${P.bossMats[bc.boss.id] ?? 0}` : ''}</p>${bossShort ? `<p class="sub bad">${bossHint(bc!.boss.id)}</p>` : ''}`;
  }
  const dropStep = !tr && it.enh + 1 >= GE().dropFrom;
  const G = P.growth;
  const label = tr ? (maxed ? (transcendOpen() ? '극의에 닿았어요' : '초월 잠김') : `초월 +${it.enh + 1}`) : `강화 +${it.enh + 1}`;
  openWin(
    `강화 · ${it.name}`,
    `<div class="idet">${itemCell(it)}<div><b style="color:${g.color}">${esc(it.name)} +${it.enh}</b><small>${g.name} ${SLOT_NAME[it.slot]} · 합 ${fmt(itemPower(it))}${own ? ` · ${esc(own)} 착용` : ''}</small></div></div>
    ${maxed ? '' : `<p class="sub enhrate" id="ePity"><b class="g">${pityText(it, enhUse.whet && G.whet > 0)}</b></p><p class="note" id="eRisk">${riskText(it)}</p>`}
    ${costLine}
    <div class="enhuse">
      <label class="tog ${dropStep ? '' : 'dim'}"><input type="checkbox" id="eCharm" ${enhUse.charm ? 'checked' : ''} ${G.charm > 0 ? '' : 'disabled'}> 🧿 부적 쓰기 <small>(${G.charm}개 · 하락을 막을 때만 1개)</small></label>
      <label class="tog"><input type="checkbox" id="eWhet" ${enhUse.whet ? 'checked' : ''} ${G.whet > 0 ? '' : 'disabled'}> 🪨 숫돌 쓰기 <small>(${G.whet}개 · 이번 시도 +${Math.round(CONFIG.growth.whet.add * 100)}%p)</small></label>
    </div>
    <div class="btnrow"><button class="bigbtn" id="eGo" ${maxed || short ? 'disabled' : ''}>${label}</button>${swap ? '<button class="bigbtn ghost sm" id="eSwap">다른 장비로 바꾸기</button>' : ''}</div>
    ${back ? '<button class="bigbtn sm ghost" id="eBack">← 돌아가기</button>' : ''}`,
    'enhw',
  );
  const ch = $('#eCharm') as HTMLInputElement;
  const wh = $('#eWhet') as HTMLInputElement;
  ch.onchange = () => (enhUse.charm = ch.checked);
  wh.onchange = () => {
    enhUse.whet = wh.checked;
    const p = document.getElementById('ePity');
    if (p) p.innerHTML = `<b class="g">${pityText(it, enhUse.whet && P.growth.whet > 0)}</b>`;
  };
  const go = document.getElementById('eGo');
  if (go)
    go.onclick = () => {
      const o = { charm: enhUse.charm, whet: enhUse.whet };
      const before = it.enh;
      if (it.enh >= SM().maxEnhance) {
        const r = transcend(it, o);
        const msg: Record<string, string> = { ok: `초월 성공! +${it.enh}`, fail: '초월 실패… 단계는 그대로 · 다음 성공률 ↑', gold: '금화가 모자라요', mats: '지역 재료가 모자라요', boss: '보스 재료가 모자라요', dust: '가루가 모자라요', max: '최고 단계예요', locked: '대장간 Lv.5에 열려요', notten: '+10 장비만 초월할 수 있어요' };
        toast(msg[r] + (lastEnh.usedWhet ? ' (숫돌 1개)' : ''));
      } else {
        const r = enhance(it, o);
        if (r === 'poor' || r === 'boss' || r === 'nosmith') return toast(enhMsg(it, r, before));
        toast(enhMsg(it, r, before));
      }
      markDirty();
      openEnhance(it, back, swap);
    };
  const sw = document.getElementById('eSwap');
  if (sw && swap) sw.onclick = swap;
  const bk = document.getElementById('eBack');
  if (bk && back) bk.onclick = back;
}
