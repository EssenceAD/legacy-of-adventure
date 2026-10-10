// 손님 목록(단골·방문 탭, 정렬) · 손님 상세(능력치·장비 3칸·케미) · 가방 · 아이템 상세(끼우기·강화·분해)
import { CONFIG } from '../data/config';
import { josa } from '../data/josa';
import { heroById } from '../data/heroes';
import { GRADE_INFO, OPT_INFO, regionById, SLOT_NAME, SLOTS, STAT_NAME, STATS, type Slot } from '../data/items';
import { RARITIES } from '../data/classes';
import { powerOf, totalStats, xpToNext } from '../world/adventurers';
import { doingText, sendAway } from '../world/actors';
import { bondsOf } from '../world/chem';
import { enhance, enhanceCost, enhanceRate, salvage, salvageAllCommon, smithObj } from '../world/craft';
import { bagSize, equip, itemPower, itemStat, unequip } from '../world/items';
import { markDirty, P, S, world, type Actor, type Item } from '../world/state';
import { $, $$, bar, bindTabs, esc, fmt, itemCell, kindText, nameTag, pct, pic, tabs } from './common';
import { openWin, toast } from './windows';

const homeActors = () => world.home?.actors ?? world.actors;
let gTab = 0;
let gSort = 0;
const SORTS = ['레벨', '전투력', '희귀도'];

export function openGuests() {
  const all = homeActors().filter((a) => !a.role && !a.leaving);
  const regs = all.filter((a) => a.status !== 'visitor');
  const vis = all.filter((a) => a.status === 'visitor');
  const list = (gTab === 0 ? regs : vis).slice();
  const key = [(a: Actor) => a.lvl, (a: Actor) => powerOf(a), (a: Actor) => RARITIES.indexOf(a.rarity) * 1000 + a.lvl][gSort];
  list.sort((a, b) => key(b) - key(a));
  const rows = list
    .map((a) => `<button data-id="${a.id}"><img src="${pic(a)}" alt=""><span>${nameTag(a)} · Lv.${a.lvl} ${kindText(a)}<small>${doingText(a)}</small></span><em>⚔${fmt(powerOf(a))}</em></button>`)
    .join('');
  openWin(
    `손님 ${all.length}명`,
    `${tabs([`단골 ${regs.length}`, `방문 ${vis.length}`], gTab, 'gT')}
    <div class="sortb">정렬 ${SORTS.map((s, i) => `<button class="${i === gSort ? 'on' : ''}" data-s="${i}">${s}</button>`).join('')}</div>
    <div class="glist">${rows || `<p class="note">${gTab === 0 ? '아직 단골이 없어요 · 기분 좋게 묵은 손님이 단골이 되고 싶어 해요' : '지금은 방문 손님이 없어요'}</p>`}</div>`,
  );
  bindTabs('gT', (i) => {
    gTab = i;
    openGuests();
  });
  $$('.sortb button').forEach(
    (b) =>
      (b.onclick = () => {
        gSort = +b.dataset.s!;
        openGuests();
      }),
  );
  $$('.glist button').forEach((b) => (b.onclick = () => showActor(all.find((a) => a.id === +b.dataset.id!)!)));
}

/** 손님 상세 */
export function showActor(a: Actor) {
  if (!a.id) {
    // 이웃 마을 구경꾼·npc
    openWin(a.name, `<div class="who"><img class="port" src="${pic(a)}" alt=""><div><p class="sub">${kindText(a)} · ${doingText(a)}</p></div></div>`);
    return;
  }
  const st = totalStats(a);
  const status = a.status === 'hero' ? '영웅 동료' : a.status === 'regular' ? '단골' : `방문 손님 · ${a.leaveDay}일차까지 묵어요`;
  const slots = SLOTS.map((s) => {
    const it = P.bag.find((x) => x.id === a.equip[s]);
    return `<button class="slot" data-s="${s}">${it ? itemCell(it) : '<span class="ic empty"></span>'}<small>${SLOT_NAME[s]}</small></button>`;
  }).join('');
  const bonds = bondsOf(a);
  const chem = bonds.map((b) => `<span class="chip"><img src="${pic(b.other)}" alt="">${esc(b.other.name)} · ${esc(b.pair.name)} ${'♥'.repeat(b.lv)}</span>`).join('');
  const hero = a.heroId ? heroById(a.heroId) : null;
  const avg = a.moodN ? a.moodSum / a.moodN : a.mood;
  openWin(
    a.name,
    `<div class="who"><img class="port" src="${pic(a)}" alt=""><div>
      <p class="sub">${nameTag(a)} Lv.${a.lvl} ${kindText(a)}<br>${status} · ${doingText(a)}</p>
      ${bar('체력', a.hp, '#e0544a')}${bar('포만', a.food, '#e8a23a')}${bar('기분', a.mood, '#6fb04b')}
      ${bar('경험', a.xp, '#6f8fff', xpToNext(a.lvl))}
    </div></div>
    <div class="stats">${STATS.map((k) => `<span>${STAT_NAME[k]} <b>${st[k]}</b></span>`).join('')}<span class="pw">전투력 <b>${fmt(powerOf(a))}</b></span></div>
    ${a.status !== 'visitor' ? `<div class="slots">${slots}</div>` : `<p class="note">기분 평균 ${Math.round(avg)} · ${CONFIG.guests.regularMood} 이상이면 떠날 때 단골 제안을 해요</p>`}
    ${hero ? `<p class="sub hero">「${hero.title}」 기술: ${hero.skill.name} (${OPT_INFO[hero.skill.k].label(hero.skill.v)})${a.status !== 'hero' ? `<br>부탁: ${hero.request.text}` : ''}</p>` : ''}
    <div class="chips">${chem}<span class="chip q">??? 미발견</span></div>
    ${a.status === 'hero' && (a.stars ?? 1) < CONFIG.heroes.maxStars ? `<button class="bigbtn sm" id="aStar">★${(a.stars ?? 1) + 1} 승급 (가루 ${(a.stars ?? 1) * CONFIG.heroes.starDust} · ${fmt((a.stars ?? 1) * CONFIG.heroes.starGold)} G)</button>` : ''}
    ${a.status === 'regular' && a.runId == null ? '<button class="bigbtn sm" id="aBye">단골 보내 주기</button>' : ''}`,
  );
  const star = document.getElementById('aStar');
  if (star)
    star.onclick = () => {
      const s = a.stars ?? 1;
      const dust = s * CONFIG.heroes.starDust;
      const gold = s * CONFIG.heroes.starGold;
      if (P.dust.n < dust) return toast('가루가 모자라요');
      if (S.gold < gold) return toast('금화가 모자라요');
      P.dust.n -= dust;
      S.gold -= gold;
      a.stars = s + 1;
      if (a.heroId && P.dex.heroes[a.heroId]) P.dex.heroes[a.heroId].stars = a.stars;
      markDirty();
      toast(`${a.name} ★${a.stars}! 기술이 강해지고 계정 전투력 +1%`);
      showActor(a);
    };
  $$('.slot').forEach((b) => (b.onclick = () => pickGear(a, b.dataset.s as Slot)));
  const bye = document.getElementById('aBye');
  if (bye)
    bye.onclick = () => {
      if (!confirm(`${a.name}${josa(a.name, "를")} 보내 줄까요? 끼고 있던 장비는 가방으로 돌아와요.`)) return;
      sendAway(a, true);
      openGuests();
    };
}

/** 장비 칸을 누르면: 가방에서 그 부위를 고른다 (전투력 차이 초록/빨강) */
function pickGear(a: Actor, slot: Slot) {
  const cur = P.bag.find((x) => x.id === a.equip[slot]);
  const before = powerOf(a);
  const cands = P.bag.filter((it) => it.slot === slot && it.id !== cur?.id).sort((p, q) => itemPower(q) - itemPower(p));
  const rows = cands
    .map((it) => {
      const old = a.equip[slot];
      a.equip[slot] = it.id;
      const diff = powerOf(a) - before;
      a.equip[slot] = old;
      const owner = it.owner != null ? homeActors().find((x) => x.id === it.owner)?.name : null;
      return `<button class="irow" data-id="${it.id}">${itemCell(it)}<span><b style="color:${GRADE_INFO[it.grade].color}">${esc(it.name)}</b><small>${owner ? `${esc(owner)} 착용 중` : regionById(it.region).name}</small></span><em class="${diff >= 0 ? 'good' : 'bad'}">${diff >= 0 ? '+' : ''}${diff}</em></button>`;
    })
    .join('');
  openWin(
    `${a.name} · ${SLOT_NAME[slot]}`,
    `${cur ? `<div class="irow cur">${itemCell(cur)}<span><b>${esc(cur.name)}</b><small>지금 착용</small></span><button id="unEq">빼기</button></div>` : ''}
    <div class="ilist">${rows || '<p class="note">가방에 이 부위 장비가 없어요 · 원정에서 얻어요</p>'}</div>`,
  );
  $$('.ilist .irow').forEach(
    (b) =>
      (b.onclick = () => {
        equip(a, P.bag.find((x) => x.id === +b.dataset.id!)!);
        markDirty();
        showActor(a);
      }),
  );
  const un = document.getElementById('unEq');
  if (un)
    un.onclick = () => {
      unequip(a, slot);
      markDirty();
      showActor(a);
    };
}

// ───────── 가방 ─────────

export function openBag() {
  const items = P.bag.slice().sort((p, q) => 'naerl'.indexOf(q.grade) - 'naerl'.indexOf(p.grade) || itemPower(q) - itemPower(p));
  const n = P.bag.filter((x) => x.owner == null).length;
  const full = n >= bagSize();
  openWin(
    `가방 ${n}/${bagSize()}`,
    `<p class="sub">가루 <b class="g">${fmt(P.dust.n)}</b> · 재료 ${Object.entries(P.mats)
      .filter(([, v]) => v)
      .map(([r, v]) => `${regionById(r as never).mat} ${v}`)
      .join(' · ') || '없음'}</p>
    ${full ? '<p class="sub bad">가방이 가득 찼어요 · 분해하거나 대장간 레벨을 올려요</p>' : ''}
    <div class="bag">${items.map((it) => itemCell(it, `data-id="${it.id}"`)).join('') || '<p class="note">아직 장비가 없어요 · 원정을 보내 봐요</p>'}</div>
    <label class="tog"><input type="checkbox" id="autoS" ${P.autoSalvage ? 'checked' : ''}> 가방이 차면 일반 장비 자동 분해</label>
    <button class="bigbtn sm" id="salAll">안 끼운 일반 장비 모두 분해</button>`,
  );
  $$('.bag .ic').forEach((b) => (b.onclick = () => showItem(P.bag.find((x) => x.id === +b.dataset.id!)!)));
  ($('#autoS') as HTMLInputElement).onchange = (e) => {
    P.autoSalvage = (e.target as HTMLInputElement).checked;
    markDirty();
  };
  $('#salAll').onclick = () => {
    const r = salvageAllCommon();
    toast(r.count ? `${r.count}개 분해 · 가루 +${r.dust}` : '분해할 일반 장비가 없어요');
    openBag();
  };
}

/** 아이템 상세 */
export function showItem(it: Item, back: () => void = openBag) {
  it.isNew = false;
  const g = GRADE_INFO[it.grade];
  const reg = regionById(it.region);
  const owner = it.owner != null ? homeActors().find((x) => x.id === it.owner) : null;
  const stats = Object.keys(it.stats).map((k) => `<span>${STAT_NAME[k as never]} <b>${itemStat(it, k as never)}</b></span>`).join('');
  const opts = it.opts.map((o) => `<div>· ${OPT_INFO[o.k].label(o.v, o.region ? regionById(o.region).name : undefined)}</div>`).join('');
  const set = it.set ? `<div class="setb">세트 「${reg.set.name}」 2부위: ${OPT_INFO[reg.set.two.k].label(reg.set.two.v, reg.name)} · 3부위: ${OPT_INFO[reg.set.three.k].label(reg.set.three.v, reg.name)}</div>` : '';
  const smith = !!smithObj();
  const maxed = it.enh >= CONFIG.smith.maxEnhance;
  openWin(
    it.name + (it.enh ? ` +${it.enh}` : ''),
    `<div class="idet">${itemCell(it)}<div><b style="color:${g.color}">${g.name} ${SLOT_NAME[it.slot]}</b><small>${reg.name}${owner ? ` · ${esc(owner.name)} 착용` : ''}</small></div></div>
    <div class="stats">${stats}<span class="pw">합 <b>${itemPower(it)}</b></span></div>
    ${opts ? `<div class="opts">${opts}</div>` : ''}${it.uniq ? `<div class="opts g">유물: ${esc(it.uniq)}</div>` : ''}${set}
    <div class="btnrow">
      <button class="bigbtn sm" id="iEnh" ${smith && !maxed ? '' : 'disabled'}>${maxed ? '최대 강화' : smith ? `강화 +${it.enh + 1} (가루 ${enhanceCost(it)} · ${pct(enhanceRate(it))})` : '강화 (대장간 필요)'}</button>
      <button class="bigbtn sm red" id="iSal" ${it.owner != null ? 'disabled' : ''}>분해 (가루 +${CONFIG.smith.salvage[it.grade]})</button>
    </div>
    <button class="bigbtn sm ghost" id="iBack">← 돌아가기</button>`,
  );
  $('#iEnh').onclick = () => {
    const r = enhance(it);
    if (r === 'poor') return toast('가루가 모자라요');
    toast(r === 'ok' ? `강화 성공! +${it.enh}` : r === 'fail' ? '강화 실패… (단계는 그대로)' : '강화할 수 없어요');
    showItem(it, back);
  };
  $('#iSal').onclick = () => {
    if (it.grade !== 'n' && !confirm(`${g.name} 장비를 분해할까요?`)) return;
    const d = salvage(it);
    toast(`분해 · 가루 +${d}`);
    back();
  };
  $('#iBack').onclick = back;
}
