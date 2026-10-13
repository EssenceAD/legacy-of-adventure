// 손님 목록(단골·방문 탭, 정렬) · 손님 상세(능력치·장비 3칸·케미) · 가방 · 아이템 상세(끼우기·강화·분해)
import { bindPersonActions, personActionsHtml } from './personActions';
import { vis as visOn } from '../world/visual';
import { CONFIG } from '../data/config';
import { checkout, dismissWhy, farewell, formerList, recall } from '../world/dismiss';
import { tapCameo } from './easter';
import { josa } from '../data/josa';
import { heroById } from '../data/heroes';
import { legendByKey } from '../data/legends';
import { offerItem, showRelic, starUpLegend, tokenNeed } from '../world/legends';
import { DUST_NAME, GRADE_INFO, OPT_INFO, regionById, SLOT_NAME, SLOTS, STAT_NAME, STATS, type Slot } from '../data/items';
import { CLASS_WEAPON, CLASSES, KIND_LINES, RACE_NAME, RARE_LINES, RARITY_INFO } from '../data/classes';
import { RARITIES } from '../data/classes';
import { powerOf, totalStats, xpToNext } from '../world/adventurers';
import { flag } from '../world/flags';
import { doingText, regularNeed } from '../world/actors';
import { capacity } from '../world/town';
import { bondsOf } from '../world/chem';
import { bossHint, enhance, enhanceBossCost, enhanceCost, enhanceRate, salvage, salvageText, smithObj } from '../world/craft';
import { autoSalvageHtml, bindAutoSalvage, openBulkSalvage, openTidyConfirm, tidyBtnHtml } from './bulkSalvage';
import { bagSize, equip, fitsClass, itemPower, itemStat, unequip } from '../world/items';
import { autoEquipAll, recommendEquip, upgradeFor } from '../world/autoEquip';
import { track as trackEv } from '../net/telemetry';
import { markDirty, P, S, world, type Actor, type Item, type TalkLine } from '../world/state';
import { heroCtx, track } from '../world/progress';
import { speakerOf, talk } from './dialogue';
import { $, $$, bar, bindTabs, esc, fmt, itemCell, keepScroll, kindText, nameTag, pct, pic, portrait, tabs } from './common';
import { dustLine } from './smith';
import { applyBest, bestPlan, whoWears } from '../world/autoEquip';
import { favRank, guestHint, isFav, sortGuests, toggleFav } from '../world/growth';
import { getPref, setPref } from '../save/save';
import { uniqueById } from '../world/uniques';
import { enhMsg, enhUse, openEnhance } from './enhance';
import { closeWin, glowOnce, openWin, toast } from './windows';
import { confirmSheet } from './confirmSheet';
import { equipCandidates } from '../world/firstFlow';
import { heroCardHtml } from './heroCard';

const homeActors = () => world.home?.actors ?? world.actors;

/** 핫픽스 10 §15: 묵는 손님마다 단골까지 얼마나 왔나 (규칙은 dailyGuests · passersLeave 그대로, 보여 주기만) */
function regLine(a: Actor): string {
  if (a.status !== 'visitor' && a.status !== 'passer') return '';
  if (a.heroId || a.legendId) return '';
  const avg = Math.round(a.moodN ? a.moodSum / a.moodN : a.mood);
  const need = Math.round(regularNeed());
  const good = avg >= need;
  const m = `기분 평균 ${avg}/${need}`;
  if (a.status === 'passer') return `<small class="regp ${good ? 'good' : ''}">저녁에 떠나요 · ${m}${good ? ' → 단골 제안 예정' : ''}</small>`;
  const d = Math.max(1, (a.leaveDay ?? S.day) - S.day);
  return good ? `<small class="regp good">💛 단골 후보 · ${m} · D-${d} 아침 결정</small>` : `<small class="regp">${m} · 조금만 더 챙겨 주세요</small>`;
}
let gTab = 0;
let gSort = 0;
/** CHECKIN §B-3: 이번 한 번 그릴 때 반짝일 사람 (장비 임무 바로가기) */
let sparkIds: number[] = [];
/** CHECKIN §B-3 장비 임무 바로가기: 늘 「단골」 탭 · 가방의 희귀 이상 장비를 낄 수 있는 사람에 반짝 3초 */
export function openGuestsEquip() {
  gTab = 0;
  const can = equipCandidates(homeActors(), P.bag, fitsClass);
  // 전투력이 오르는 사람(장비마다 상위 3명)이 있으면 그 사람만 · 없으면 낄 수 있는 사람 모두
  const best = new Set(P.bag.filter((it) => it.owner == null && it.grade !== 'n').flatMap((it) => whoWears(it, 3).map((w) => w.a.id)));
  sparkIds = can.some((id) => best.has(id)) ? can.filter((id) => best.has(id)) : can;
  try {
    openGuests();
  } finally {
    sparkIds = [];
  }
}
const SORTS = ['레벨', '전투력', '희귀도'];

export function openGuests() {
  const all = homeActors().filter((a) => !a.role && !a.leaving);
  const regs = all.filter((a) => a.status === 'regular' || a.status === 'hero');
  const vis = all.filter((a) => a.status === 'visitor' || a.status === 'passer');
  const list = (gTab === 0 ? regs : gTab === 1 ? vis : []).slice();
  const key = [(a: Actor) => a.lvl, (a: Actor) => powerOf(a), (a: Actor) => RARITIES.indexOf(a.rarity) * 1000 + a.lvl][gSort];
  // v0.25.2 §I #19: ★ 맨 위 고정 켜기/끄기 · ★ 묶음과 나머지 사이 구분 줄 · 지금 정렬 기준 한 줄
  const pinUi = visOn('guestSortPin');
  const pin = pinUi ? getPref<boolean>('guestFavPin', true) : true;
  // GROWTH §3-1: ★ 아끼는 영웅이 늘 맨 위 (플래그 끄면 예전: ★끼리는 ★한 순서)
  if (pinUi) list.splice(0, list.length, ...sortGuests(list, key, P.growth.favs, pin));
  else list.sort((a, b) => favRank(a) - favRank(b) || key(b) - key(a));
  const divAt = pinUi && pin ? list.findIndex((a) => !isFav(a)) : -1;
  const sortLine = pinUi
    ? `<div class="sortb gsortln"><span>지금: <b>${SORTS[gSort]}</b> 높은 순${gSort === 2 ? '(같으면 레벨)' : ''}${pin ? ' · ★ 먼저' : ' · ★도 섞어서'}</span><button id="gPin" class="${pin ? 'on' : ''}" aria-pressed="${pin}">★ 맨 위 고정</button></div>`
    : '';
  // CHECKIN §J6 (heroCards · 실험실): 단골 탭 = 영웅 카드 격자 (누르면 상세 · 정렬·★ 고정 그대로)
  const cards = visOn('heroCards') && gTab === 0;
  const rows = list
    .map((a, i) => (i === divAt && i > 0 ? '<div class="gdiv" role="separator"></div>' : '') + (cards ? heroCardHtml(a) : `<div class="grow">${gTab === 1 && !dismissWhy(a) ? `<label class="gpick"><input type="checkbox" data-pick="${a.id}" ${picked.has(a.id) ? 'checked' : ''}></label>` : ''}<button data-id="${a.id}"><img src="${pic(a)}" alt=""><span>${isFav(a) ? '<b class="favstar">★</b> ' : ''}${nameTag(a)} · Lv.${a.lvl} ${kindText(a)}<small>${doingText(a)}</small>${regLine(a)}</span><em>전투력 ${fmt(powerOf(a))}</em></button></div>`))
    .join('');
  openWin(
    `손님 ${all.length}명`,
    `<p class="sub regsum">단골 <b>${regs.length}/${capacity()}</b> · 대기 ${P.waitlist.length}/${CONFIG.guests.waitlistMax}</p>${tabs([`단골 ${regs.length}`, `방문 ${vis.length}`, `대기 ${P.waitlist.length}/${CONFIG.guests.waitlistMax}`, `옛 단골 ${formerList().length}`], gTab, 'gT')}
    ${
      gTab === 3
        ? formerHtml()
        : gTab === 2
        ? `<p class="note">단골 자리가 꽉 찼을 때 단골이 되고 싶어 한 손님이에요 · 자리가 나면 다시 찾아와 제안해요</p><div class="glist">${
            P.waitlist.map((w) => `<div class="wrow"><b style="color:${RARITY_INFO[w.rarity].color}">${esc(w.name)}</b> · Lv.${w.lvl} ${RACE_NAME[w.race]} ${CLASSES[w.kind].name}</div>`).join('') || '<p class="note">대기 중인 손님이 없어요</p>'
          }</div>`
        : `<div class="sortb">정렬 ${SORTS.map((s, i) => `<button class="${i === gSort ? 'on' : ''}" data-s="${i}">${s}</button>`).join('')}${gTab === 1 ? `<button id="gOut" class="bagb ${outArmed ? 'red' : ''}" ${picked.size ? '' : 'disabled'}>${outArmed ? '한 번 더 누르면 내보내기' : `한꺼번에 내보내기 (${picked.size})`}</button>` : ''}<button id="gAuto" class="bagb">모두 자동 장착</button><button id="gBag" class="bagb">가방</button></div>${sortLine}
    <div class="glist${cards ? ' hcgrid' : ''}">${rows || `<p class="note">${gTab === 0 ? '아직 단골이 없어요 · 기분 좋게 묵은 손님이 단골이 되고 싶어 해요' : '지금은 방문 손님이 없어요'}</p>`}</div>`
    }`,
  );
  bindTabs('gT', (i) => {
    gTab = i;
    openGuests();
  });
  $$('.sortb button[data-s]').forEach(
    (b) =>
      (b.onclick = () => {
        gSort = +b.dataset.s!;
        openGuests();
      }),
  );
  const pinB = document.getElementById('gPin');
  if (pinB)
    pinB.onclick = () => {
      setPref('guestFavPin', !pin);
      keepScroll(openGuests);
    };
  $$('.glist button').forEach((b) => (b.onclick = () => showActor(all.find((a) => a.id === +b.dataset.id!)!)));
  for (const id of sparkIds) glowOnce(document.querySelector<HTMLElement>(`.glist button[data-id="${id}"]`), CONFIG.firstFlow.equipGlowMs);
  $$('[data-pick]').forEach(
    (b) =>
      ((b as HTMLInputElement).onchange = () => {
        const id = +b.dataset.pick!;
        if ((b as HTMLInputElement).checked) picked.add(id);
        else picked.delete(id);
        outArmed = false;
        keepScroll(openGuests);
      }),
  );
  const go = document.getElementById('gOut');
  if (go)
    go.onclick = () => {
      if (!outArmed) {
        outArmed = true;
        return keepScroll(openGuests);
      }
      outArmed = false;
      let n = 0;
      for (const a of vis) if (picked.has(a.id) && checkout(a)) n++;
      picked.clear();
      toast(n ? `${n}명 체크아웃` : '내보낼 손님이 없어요');
      openGuests();
    };
  $$('[data-recall]').forEach(
    (b) =>
      (b.onclick = () => {
        const err = recall(+b.dataset.recall!);
        toast(err ?? '다시 돌아왔어요!');
        openGuests();
      }),
  );
  const gb = document.getElementById('gBag');
  if (gb) gb.onclick = () => openBag();
  const ga = document.getElementById('gAuto');
  if (ga)
    ga.onclick = () => {
      autoAll();
      keepScroll(openGuests);
    };
}

/** 손님에게 말 걸기: 한마디 듣고 기분 + (손님마다 하루 한 번만 기분이 오른다) */
const talkedDay = new Map<number, number>();
export function talkGuest(a: Actor) {
  closeWin();
  const fresh = talkedDay.get(a.id) !== S.day;
  talkedDay.set(a.id, S.day);
  if (fresh) a.mood = Math.min(100, a.mood + 5);
  track('guestTalk');
  P.counters.guestTalks++;
  markDirty();
  const kl = KIND_LINES[a.kind];
  const pool = kl && Math.random() < 0.5 ? kl : a.rarity !== 'common' && Math.random() < 0.5 ? RARE_LINES[a.rarity] : CONFIG.lines.idle;
  // GROWTH §2: 단골 말 걸기에 가끔 선물 힌트 (직업별 좋아하는 것)
  const hint = a.status === 'regular' && !a.heroId && !a.legendId ? guestHint(a) : null;
  const line = hint ?? (a.mood >= 80 ? '이 여관 정말 좋아요! 오래 묵고 싶어요.' : a.hp < 40 ? '조금 피곤하네요… 푹 쉬고 싶어요.' : a.food < 40 ? '배가 고파요. 맛있는 거 없나요?' : pool[(Math.random() * pool.length) | 0]);
  talk([[speakerOf(a), line], ...(fresh ? [['narr', `${a.name}의 기분이 조금 좋아졌다.`] as TalkLine] : [])]);
}

/** 손님 상세 */
export function showActor(a: Actor) {
  if (a.cameo) {
    openWin(
      `★ ${a.name}`,
      `<div class="who"><img class="port pixel" src="${portrait(a)}" alt=""><div><p class="sub">${nameTag(a)}<br>베타 개척자 · 지나가는 손님</p><p class="note">${doingText(a)}</p></div></div>
      <div class="btnrow">${S.visiting ? '' : '<button class="bigbtn sm" id="aTalk">말 걸기</button>'}</div>`,
    );
    const t = document.getElementById('aTalk');
    if (t)
      t.onclick = () => {
        closeWin();
        tapCameo(a);
      };
    return;
  }
  if (!a.id) {
    // 이웃 마을 구경꾼·npc
    openWin(a.name, `<div class="who"><img class="port" src="${portrait(a)}" alt=""><div><p class="sub">${kindText(a)} · ${doingText(a)}</p></div></div>`);
    return;
  }
  const st = totalStats(a);
  const status =
    a.legendId && a.status === 'hero' ? `전설 동료 ${'★'.repeat(a.stars ?? 1)}` : a.legendId ? '전설 영웅 방문 중' : a.status === 'hero' ? `영웅 동료 ${'★'.repeat(a.stars ?? 1)}` : a.status === 'regular' ? '단골' : a.status === 'passer' ? '지나가는 손님 · 저녁 전에 떠나요' : `방문 손님 · ${a.leaveDay}일차까지 묵어요`;
  const slots = SLOTS.map((s) => {
    const it = P.bag.find((x) => x.id === a.equip[s]);
    return `<button class="slot" data-s="${s}">${it ? itemCell(it) : '<span class="ic empty"></span>'}<small>${SLOT_NAME[s]}</small>${it ? fitTag(a, it) : ''}</button>`;
  }).join('');
  const bonds = bondsOf(a);
  const chem = bonds.map((b) => `<span class="chip"><img src="${pic(b.other)}" alt="">${esc(b.other.name)} · ${esc(b.pair.name)} ${'♥'.repeat(b.lv)}</span>`).join('');
  const hero = a.heroId ? heroById(a.heroId) : null;
  const avg = a.moodN ? a.moodSum / a.moodN : a.mood;
  openWin(
    a.name,
    `<div class="who"><img class="port" src="${portrait(a)}" alt=""><div>
      <p class="sub">${a.status === 'regular' || a.status === 'hero' ? `<button class="favbtn ${isFav(a) ? 'on' : ''}" id="aFav" title="아끼는 영웅">${isFav(a) ? '★' : '☆'}</button> ` : ''}${nameTag(a)} Lv.${a.lvl} ${kindText(a)}<br>${status} · ${doingText(a)}</p>
      ${bar('체력', a.hp, '#e0544a')}${bar('포만', a.food, '#e8a23a')}${bar('기분', a.mood, '#6fb04b')}
      ${bar('경험', a.xp, '#6f8fff', xpToNext(a.lvl))}
    </div></div>
    <div class="stats">${STATS.map((k) => `<span>${STAT_NAME[k]} <b>${st[k]}</b>${k === 'def' && flag('rolesV2') ? `<small class="defcut"> 받는 피해 −${Math.round(Math.min(CONFIG.combat.roles.defMax, Math.max(0, st.def) / (Math.max(0, st.def) + CONFIG.combat.roles.defK)) * 100)}%</small>` : ''}</span>`).join('')}<span class="pw">전투력 <b>${fmt(powerOf(a))}</b></span></div>
    ${a.status === 'regular' || a.status === 'hero' ? `${a.runId == null ? '<button class="bigbtn sm best" id="aBest">✨ 가장 좋은 걸로 입히기</button>' : ''}${a.runId == null ? `<div class="eqbar"><button class="bigbtn sm" id="aRec">추천 장착</button><label class="tog"><input type="checkbox" id="aTake" ${takeOthers ? 'checked' : ''}> 다른 단골 것도 가져오기</label></div>` : ''}<div class="slots">${slots}</div>` : `<p class="note">기분 평균 ${Math.round(avg)} · ${CONFIG.guests.regularMood} 이상이면 떠날 때 단골 제안을 해요</p>`}
    ${hero ? `<p class="sub hero">「${hero.title}」 기술: ${hero.skill.name} (${OPT_INFO[hero.skill.k].label(hero.skill.v)})${a.status !== 'hero' ? `<br>부탁: ${hero.request.text}${hero.request.prog ? ` (${Math.min(...hero.request.prog(heroCtx()))}/${hero.request.prog(heroCtx())[1]})` : ''}` : ''}</p>${a.status !== 'hero' && hero.request.prog ? '<button class="bigbtn sm ghost" data-goboard>의뢰 게시판 가기</button>' : ''}` : ''}
    ${a.legendId ? legendPanel(a) : ''}
    <div class="chips">${chem}<span class="chip q">??? 미발견</span></div>
    ${a.status === 'hero' && (a.stars ?? 1) < CONFIG.heroes.maxStars ? '<p class="note">영웅은 케미 친밀도가 오를 때마다 별이 올라요 (★5까지)</p>' : ''}
    <div class="btnrow">${personActionsHtml(a, { talk: true })}${byeBtn(a)}</div>`,
  );
  bindPersonActions(a, talkGuest);
  // GROWTH §3-1: 장비 칸 → 그 장비 강화 창 바로 (빈 칸이면 고르기)
  $$('.slot').forEach(
    (b) =>
      (b.onclick = () => {
        const s = b.dataset.s as Slot;
        const it = P.bag.find((x) => x.id === a.equip[s]);
        if (it) openEnhance(it, () => showActor(a), a.runId == null ? () => pickGear(a, s) : undefined);
        else pickGear(a, s);
      }),
  );
  const fv = document.getElementById('aFav');
  if (fv)
    fv.onclick = () => {
      const err = toggleFav(a);
      if (err) return toast(err);
      toast(isFav(a) ? `★ ${a.name} — 아끼는 영웅 (목록·자동 장착 우선)` : `${a.name} ★ 해제`);
      showActor(a);
    };
  const bst = document.getElementById('aBest');
  if (bst) bst.onclick = () => openBestPreview(a);
  const tk2 = document.getElementById('aTake') as HTMLInputElement | null;
  if (tk2) tk2.onchange = () => (takeOthers = tk2.checked);
  const rec = document.getElementById('aRec');
  if (rec)
    rec.onclick = () => {
      const r = recommendEquip(a, takeOthers);
      trackEv('auto_equip', { mode: 'one', take: takeOthers, gain: r.gain });
      markDirty();
      toast(r.changed ? `${a.name} 장비 ${r.changed}칸 교체 · 전투력 +${fmt(r.gain)}` : '이미 최선이에요');
      showActor(a);
    };
  bindLegend(a);
  const bye = document.getElementById('aBye');
  if (bye)
    bye.onclick = () => {
      const doBye = () => {
        byeArmed = 0;
        if (a.status === 'regular') {
          const line = farewell(a);
          if (line) talk([[speakerOf(a), line], ['narr', `${a.name}${josa(a.name, '이')} 떠났다. 끼고 있던 장비는 가방으로 돌아왔다. (3일 안에는 「옛 단골」에서 다시 부를 수 있어요)`]]);
        } else if (checkout(a)) toast(`${a.name} 체크아웃`);
        closeWin();
      };
      // J4 confirmSheet: 두 번 누르기 대신 아래 확인 시트 하나 (작별 = 빨강)
      if (visOn('confirmSheet')) {
        const reg = a.status === 'regular';
        void confirmSheet({
          title: reg ? `${a.name}${josa(a.name, '와')} 작별할까요?` : `${a.name}${josa(a.name, '을')} 내보낼까요?`,
          body: reg ? `끼고 있던 장비는 가방으로 돌아와요 · ${CONFIG.dismiss.recallDays}일 안에는 「옛 단골」에서 다시 부를 수 있어요` : '오늘 밤 체크아웃해요',
          ok: reg ? '작별하기' : '내보내기',
          danger: reg,
        }).then((ok) => ok && doBye());
        return;
      }
      // 실수 방지: 창 안에서 한 번 더 누르기
      if (byeArmed !== a.id) {
        byeArmed = a.id;
        bye.textContent = a.status === 'regular' ? '한 번 더 누르면 작별' : '오늘 밤 체크아웃할까요? (한 번 더 누르면 확인)';
        bye.classList.add('red');
        return;
      }
      doBye();
    };
}

// ───────── GROWTH §3-1: 「가장 좋은 걸로 입히기」 미리보기 → 확인 ─────────
export function openBestPreview(a: Actor) {
  const plan = bestPlan(a);
  if (!plan.slots.length) return toast('이미 가장 좋은 걸 입고 있어요');
  const rows = plan.slots
    .map((x) => `<div class="irow">${itemCell(x.to)}<span><b>${SLOT_NAME[x.slot]} <em class="good">+${fmt(x.gain)}</em></b><small>${x.from ? esc(x.from.name) + (x.from.enh ? ' +' + x.from.enh : '') : '빈 칸'} → <b style="color:${GRADE_INFO[x.to.grade].color}">${esc(x.to.name)}${x.to.enh ? ' +' + x.to.enh : ''}</b>${x.taker ? ` · ${esc(x.taker.name)}에게서` : ''}</small></span></div>`)
    .join('');
  openWin(
    `${a.name} · 가장 좋은 걸로`,
    `<p class="sub bestsum">${plan.slots.map((x) => `${SLOT_NAME[x.slot]} +${fmt(x.gain)}`).join(' · ')}</p>
    <p class="note">전투력 ${fmt(plan.before)} → <b class="good">${fmt(plan.after)}</b> · 가방 + ★ 아닌 단골이 낀 것까지 비교 (★끼리는 안 뺏어요)</p>
    <div class="ilist">${rows}</div>
    <div class="btnrow"><button class="bigbtn" id="bOk">이대로 입히기</button><button class="bigbtn ghost" id="bNo">취소</button></div>`,
  );
  $('#bOk').onclick = () => {
    const r = applyBest(a, bestPlan(a));
    trackEv('auto_equip', { mode: 'best', gain: r.gain, fav: isFav(a) });
    markDirty();
    toast(r.changed ? `${a.name} 장비 ${r.changed}칸 교체 · 전투력 +${fmt(r.gain)}` : '이미 최선이에요');
    showActor(a);
  };
  $('#bNo').onclick = () => showActor(a);
}

// ───────── 전설 영웅: 부탁 진행 · 바치기/보여 주기 · 인연의 증표로 ★ ─────────

function legendPanel(a: Actor): string {
  const d = legendByKey(a.legendId!)!;
  const st = P.legends[d.key];
  const sk = `기술 「${d.skill.name}」 ${OPT_INFO[d.skill.k].label(d.skill.v * ((a.stars ?? 1) >= 3 ? 1.5 : 1), d.skill.region ? regionById(d.skill.region).name : undefined)}`;
  if (st?.st === 'visit') {
    const left = Math.max(0, (st.until ?? 0) - Date.now());
    const prog = d.request.event === 'check' ? '' : ` (${Math.min(st.prog ?? 0, d.request.need).toLocaleString('ko-KR')}/${d.request.need.toLocaleString('ko-KR')})`;
    const btn = d.key === 'scarlet' ? '<button class="bigbtn sm" id="lgOffer">장비 바치기</button>' : d.key === 'ryuka' ? '<button class="bigbtn sm" id="lgShow">유물 보여 주기</button>' : '';
    return `<div class="legend-box"><b class="g">전설 「${d.title}」 · ${d.charm}</b><p>부탁: ${esc(d.request.text)}${prog}</p><p class="note">남은 시간 ${Math.floor(left / 864e5)}일 ${Math.floor((left % 864e5) / 36e5)}시간 · 못 들어주면 떠나고 인연 게이지 ${CONFIG.legends.failGauge}%</p>${btn}</div>`;
  }
  const need = tokenNeed(a.stars ?? 1);
  return `<div class="legend-box"><b class="g">전설 「${d.title}」 ${'★'.repeat(a.stars ?? 1)}${'☆'.repeat(5 - (a.stars ?? 1))}</b><p>${sk} · ★마다 전투력 +${Math.round(CONFIG.legends.starPowerPct * 100)}%${(a.stars ?? 1) >= 5 ? ' · 유산 무기' : ''}</p>${need != null ? `<button class="bigbtn sm" id="lgStar" ${P.tokens >= need ? '' : 'disabled'}>★${(a.stars ?? 1) + 1} 올리기 (인연의 증표 ${P.tokens}/${need})</button>` : '<p class="note">★5 — 유산 무기가 깨어났어요</p>'}<p class="note">증표: 주간 토벌 참여(주 1개) · 원정에서 아주 드물게 · 랭킹 상위 10%(2차)</p></div>`;
}

function bindLegend(a: Actor) {
  const st = document.getElementById('lgStar');
  if (st)
    st.onclick = () => {
      const err = starUpLegend(a);
      if (err) return toast(err);
      toast(`${a.name} ★${a.stars}!`);
      showActor(a);
    };
  const sh = document.getElementById('lgShow');
  if (sh)
    sh.onclick = () => {
      const err = showRelic();
      if (err) return toast(err);
      showActor(a);
    };
  const of = document.getElementById('lgOffer');
  if (of)
    of.onclick = () => {
      const list = P.bag.filter((it) => it.owner == null && 'ela'.includes(it.grade) && it.opts.length);
      openWin(
        '스칼렛에게 바치기',
        `<p class="sub">옵션 붙은 영웅 등급 이상 장비 (사라져요)</p><div class="ilist">${
          list.map((it) => `<button class="irow" data-id="${it.id}">${itemCell(it)}<span><b style="color:${GRADE_INFO[it.grade].color}">${esc(it.name)}</b><small>${it.opts.map((o) => OPT_INFO[o.k].label(o.v)).join(' · ')}</small></span></button>`).join('') || '<p class="note">바칠 장비가 없어요</p>'
        }</div>`,
      );
      $$('.ilist .irow').forEach(
        (b) =>
          (b.onclick = () => {
            if (!confirm('정말 바칠까요? 장비가 사라져요')) return;
            const err = offerItem(+b.dataset.id!);
            if (err) return toast(err);
            showActor(a);
          }),
      );
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
      return `<button class="irow" data-id="${it.id}">${itemCell(it)}<span><b style="color:${GRADE_INFO[it.grade].color}">${esc(it.name)}</b><small>${owner ? `${esc(owner)} 착용 중` : regionById(it.region).name}${fitTag(a, it)}</small></span><em class="${diff >= 0 ? 'good' : 'bad'}">${diff >= 0 ? '+' : ''}${diff}</em></button>`;
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
    `<p class="sub">${dustLine()}${P.growth.charm || P.growth.whet ? ` · 🧿 부적 ${P.growth.charm} · 🪨 숫돌 ${P.growth.whet}` : ''}<br>재료 ${Object.entries(P.mats)
      .filter(([, v]) => v)
      .map(([r, v]) => `${regionById(r as never).mat} ${v}`)
      .join(' · ') || '없음'}</p>
    ${full ? '<p class="sub bad">가방이 가득 찼어요 · 분해하거나 대장간 레벨을 올려요</p>' : ''}
    ${visOn('bulkTidy') ? `<div class="btnrow"><button class="bigbtn sm" id="bagAuto">모두 자동 장착</button>${tidyBtnHtml()}</div>` : '<button class="bigbtn sm" id="bagAuto">모두 자동 장착</button>'}
    <div class="bag">${items.map((it) => itemCell(it, `data-id="${it.id}"`)).join('') || '<p class="note">아직 장비가 없어요 · 원정을 보내 봐요</p>'}</div>
    ${autoSalvageHtml('autoS')}
    <button class="bigbtn sm ${visOn('bulkTidy') ? 'ghost' : ''}" id="salAll">일괄 분해…</button>`,
  );
  const td = document.getElementById('bagTidy');
  if (td) td.onclick = () => openTidyConfirm(openBag);
  $$('.bag .ic').forEach((b) => (b.onclick = () => showItem(P.bag.find((x) => x.id === +b.dataset.id!)!)));
  bindAutoSalvage('autoS');
  $('#salAll').onclick = () => openBulkSalvage(openBag);
  $('#bagAuto').onclick = () => {
    autoAll();
    keepScroll(openBag);
  };
}

// ───────── 핫픽스 12 §1: 자동 장착 ─────────
let takeOthers = false;
/** 무기 칸: 직업에 맞으면 「딱 맞아요」, 아니면 흐리게 「다른 직업용」 */
export function fitTag(a: Actor, it: Item): string {
  const f = fitsClass(a, it);
  return f == null ? '' : f ? '<i class="fit ok">딱 맞아요</i>' : '<i class="fit no">다른 직업용</i>';
}
/** 「모두 자동 장착」 */
export function autoAll() {
  const r = autoEquipAll();
  trackEv('auto_equip', { mode: 'all', people: r.people, gain: r.gain });
  markDirty();
  toast(r.people ? `단골 ${r.people}명 장비 정리 · 전투력 +${fmt(r.gain)}` : '이미 최선이에요');
}
/** §1-4: 결과 창 「○○에게 더 좋아요 → 바로 끼우기」 (없으면 빈 글) */
export function upgradeBtn(items: Item[], also: Actor[] = []): string {
  const u = upgradeFor(items, also);
  if (!u) return '';
  return `<button class="bigbtn sm equp" data-equp="${u.a.id}:${u.it.id}">${esc(u.a.name)}에게 더 좋아요 → 바로 끼우기 <b class="good">+${fmt(u.gain)}</b></button>`;
}
// 결과 창이 어디서 그려지든 한 곳에서 받는다
addEventListener('click', (e) => {
  const b = (e.target as HTMLElement)?.closest?.('[data-equp]') as HTMLElement | null;
  if (!b) return;
  const [aid, iid] = b.dataset.equp!.split(':').map(Number);
  const a = homeActors().find((x) => x.id === aid);
  const it = P.bag.find((x) => x.id === iid);
  b.remove();
  if (!a || !it || it.owner != null) return toast('이미 다른 곳에 쓰였어요');
  const before = powerOf(a);
  equip(a, it);
  markDirty();
  trackEv('auto_equip', { mode: 'new', gain: powerOf(a) - before });
  toast(`${a.name} 「${it.name}」 장착 · 전투력 +${fmt(powerOf(a) - before)}`);
});

/** 아이템 상세 */
export function showItem(it: Item, back: () => void = openBag) {
  it.isNew = false;
  const g = GRADE_INFO[it.grade];
  const reg = regionById(it.region);
  const owner = it.owner != null ? homeActors().find((x) => x.id === it.owner) : null;
  const stats = Object.keys(it.stats).map((k) => `<span>${STAT_NAME[k as never]} <b>${itemStat(it, k as never)}</b></span>`).join('');
  const opts = it.opts.map((o) => `<div class="${o.u ? 'uopt' : ''}">${o.u ? '★' : '·'} ${OPT_INFO[o.k].label(o.v, o.region ? regionById(o.region).name : undefined)}${o.u ? ' <small>(고유)</small>' : ''}</div>`).join('');
  const set = it.set ? `<div class="setb">세트 「${reg.set.name}」 2부위: ${OPT_INFO[reg.set.two.k].label(reg.set.two.v, reg.name)} · 3부위: ${OPT_INFO[reg.set.three.k].label(reg.set.three.v, reg.name)}</div>` : '';
  const smith = !!smithObj();
  const maxed = it.enh >= CONFIG.smith.maxEnhance;
  openWin(
    it.name + (it.enh ? ` +${it.enh}` : ''),
    `<div class="idet">${itemCell(it)}<div><b style="color:${g.color}">${g.name} ${SLOT_NAME[it.slot]}</b><small>${reg.name}${owner ? ` · ${esc(owner.name)} 착용` : ''}</small></div></div>
    <div class="stats">${stats}<span class="pw">합 <b>${itemPower(it)}</b></span></div>
    ${it.slot === 'weapon' && it.wkind ? `<p class="note">딱 맞는 직업: <b>${fitClassName(it)}</b> (끼면 공격·마력 +${Math.round(CONFIG.items.classWeaponBonus * 100)}%)</p>` : ''}
    ${opts ? `<div class="opts">${opts}</div>` : ''}${it.uniq ? `<div class="opts g">유물: ${esc(it.uniq)}</div>` : ''}${uniqHtml(it)}${set}
    ${whoHtml(it)}
    <div class="btnrow">
      <button class="bigbtn sm" id="iEnh" ${smith && !maxed ? '' : 'disabled'}>${maxed ? '최대 강화' : smith ? `강화 +${it.enh + 1} (${DUST_NAME[it.grade]} ${enhanceCost(it)}/${P.dust[it.grade]} · ${pct(enhanceRate(it))})` : '강화 (대장간 필요)'}</button><button class="bigbtn sm ghost" id="iEnhW" ${smith ? '' : 'disabled'}>강화 창…</button>
      <button class="bigbtn sm ghost" id="iLock">${it.locked ? '🔒 잠금 풀기' : '🔓 잠그기'}</button>
      <button class="bigbtn sm red" id="iSal" ${it.owner != null || it.locked ? 'disabled' : ''}>분해 (${salvageText(it.grade)})</button>
    </div>
    <button class="bigbtn sm ghost" id="iBack">← 돌아가기</button>`,
  );
  const ew = document.getElementById('iEnhW');
  if (ew) ew.onclick = () => openEnhance(it, () => showItem(it, back));
  $$('[data-wear]').forEach(
    (b) =>
      (b.onclick = () => {
        const a = homeActors().find((x) => x.id === +b.dataset.wear!);
        if (!a || !P.bag.includes(it)) return;
        const before = powerOf(a);
        equip(a, it);
        markDirty();
        toast(`${a.name} 「${it.name}」 장착 · 전투력 +${fmt(powerOf(a) - before)}`);
        showItem(it, back);
      }),
  );
  $('#iEnh').onclick = () => {
    const before = it.enh;
    const r = enhance(it, { ...enhUse });
    if (r === 'poor') return toast('가루가 모자라요');
    if (r === 'boss') return toast(bossHint(enhanceBossCost(it)!.boss.id));
    toast(enhMsg(it, r, before));
    showItem(it, back);
  };
  $('#iSal').onclick = async () => {
    // J4 confirmSheet: 희귀 이상은 아래 확인 시트 (끄면 예전 confirm 그대로)
    if (it.grade !== 'n' && !(visOn('confirmSheet') ? await confirmSheet({ title: `${g.name} 장비를 분해할까요?`, body: `${it.name} → ${salvageText(it.grade)}`, ok: '분해하기', danger: true }) : confirm(`${g.name} 장비를 분해할까요?`))) return;
    if (!P.bag.includes(it)) return;
    salvage(it);
    toast(`분해 · ${salvageText(it.grade)}`);
    back();
  };
  $('#iBack').onclick = back;
  $('#iLock').onclick = () => {
    it.locked = !it.locked;
    markDirty();
    toast(it.locked ? '잠갔어요 · 자동 장착·분해에서 빠져요' : '잠금을 풀었어요');
    showItem(it, back);
  };
}
/** GROWTH §3-4: 고유 장비 로어 · 고유 효과 */
function uniqHtml(it: Item): string {
  const d = uniqueById(it.uid);
  if (!d) return '';
  return `<div class="uniqbox"><b class="g">고유 장비</b><p class="lore">「${esc(d.lore)}」</p>${d.special ? `<p>✦ ${esc(d.special.text)}</p>` : ''}</div>`;
}
/** GROWTH §3-1: 「누가 끼면 좋을까」 상위 3명 (▲ 전투력) + [끼우기] */
function whoHtml(it: Item): string {
  const list = whoWears(it);
  if (!list.length) return '';
  return `<div class="whow"><b class="g">누가 끼면 좋을까</b>${list.map((x) => `<div class="irow"><img src="${pic(x.a)}" alt=""><span>${isFav(x.a) ? '★ ' : ''}${esc(x.a.name)} <em class="good">▲ ${fmt(x.gain)}</em></span><button data-wear="${x.a.id}">끼우기</button></div>`).join('')}</div>`;
}
const fitClassName = (it: Item) => (Object.entries(CLASS_WEAPON).filter(([, w]) => w === it.wkind).map(([k]) => (CLASSES as Record<string, { name: string }>)[k]?.name ?? k).join('·') || '없음');

let byeArmed = 0;
/** 내보내기 버튼: 방문·지나가는 손님 = 체크아웃 · 단골 = 작별 · 못 하면 회색 + 까닭 (영웅·전설은 숨김) */
function byeBtn(a: Actor): string {
  if (a.heroId || a.legendId || a.status === 'hero' || a.cameo) return '';
  const why = dismissWhy(a);
  const label = a.status === 'regular' ? '단골 작별하기' : '내보내기';
  return why ? `<button class="bigbtn sm ghost" disabled title="${esc(why)}">${label} · ${esc(why)}</button>` : `<button class="bigbtn sm ghost" id="aBye">${label}</button>`;
}
/** 옛 단골 (실제 3일 안 다시 부르기) · 추억 (작별한 단골 이름) */
function formerHtml(): string {
  const fl = formerList();
  const rows = fl.map((r) => `<div class="wrow"><b style="color:${RARITY_INFO[r.rarity].color}">${esc(r.name)}</b> · Lv.${r.lvl} ${RACE_NAME[r.race]} ${CLASSES[r.kind].name} <small>${Math.max(1, Math.ceil((r.at + CONFIG.dismiss.recallDays * 864e5 - Date.now()) / 864e5))}일 남음</small> <button class="bagb" data-recall="${r.id}">다시 부르기</button></div>`).join('');
  const names = P.farewells ?? [];
  return `<p class="note">작별한 단골은 실제 ${CONFIG.dismiss.recallDays}일 동안 레벨·장비 그대로 다시 부를 수 있어요 (단골 자리가 있을 때)</p><div class="glist">${rows || '<p class="note">옛 단골이 없어요</p>'}</div>${names.length ? `<p class="sub">추억 · ${names.map(esc).join(' · ')}</p>` : ''}`;
}

/** 방문 손님 여러 명 고르기 (단골은 하나씩) */
const picked = new Set<number>();
let outArmed = false;

if (import.meta.env.DEV) Object.assign(window, { __openGuests: openGuests });
