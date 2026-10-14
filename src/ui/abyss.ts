// GOLDSINK §7 끝없는 심연 창 · 층 오르기 (전투는 사냥 전투 그대로 · 접기 없음 · 맡겨 두기 없음)
//  RAIDWEAPON §1 (abyssRush): 창 맨 위 모드 [한 층씩][보스 연전] · 보스 연전 = 매 층 보스 한 마리(쫄 없음 · 곡 19) · 기록·이어가기 칸 따로
import { CONFIG } from '../data/config';
import { REGIONS } from '../data/items';
import { closeCombat, showCombatResult, startCombat, type CombatResult } from '../combat/ui';
import { abyssOpen, abyssRec, checkpoints, clearFloor, contCost, dropContinue, enterFloor, floorRec, floorStage, isBossFloor, isRestFloor, loseFloor, payContinue, pickBoss, pickRushBoss, resumeFloor, resumeOn, rushLockWhy, rushOn, rushOpen, rushRec, startAt, type AbyssMode, type FloorReward } from '../world/abyss';
import { lockAttr } from './lockBtn';
import { markAdventured } from '../world/actors';
import { powerOf } from '../world/adventurers';
import { fmtKo, onceDay, onceEver } from '../world/goldsink';
import { huntCrew, partyPower } from '../world/hunt';
import { huntPartyMax } from '../world/party4';
import { markDirty, P, S, type Actor } from '../world/state';
import { track as trackEv } from '../net/telemetry';
import { $$, esc, fmt, itemCell, keepScroll, nameTag, portrait } from './common';
import { cardsOn, dropsHtml, mvpHtml, starsHtml } from './checkin';
import { recButton } from './partyUi';
import { bindDeck, deckGlow, deckGridHtml, deckTopHtml, lock4Cell, type DeckCfg } from './heroCard';
import { partyBlock, partyNote, partyPool, recommendFor, rulesV2 } from '../world/partyRules';
import { vis, fsay } from '../world/visual';
import { talk } from './dialogue';
import { dropFanfare } from './fanfare';
import { closeWin, openWin, toast } from './windows';

let picked: number[] = [];
let manual = false;
/** J6: 마지막 「추천 편성」 이유 */
let abWhy = '';
/** 「계속 오르기」 자동 (AUTO로 시작하면 켬) */
let autoClimb = true;
let timer = 0;
/** RAIDWEAPON §1: 지금 모드 (창에서 고름 · 오르는 동안 그대로) */
let mode: AbyssMode = 'floor';
const C = () => CONFIG.abyss;
const now = () => Date.now();
/** 모드 고르기 줄 (보스 연전이 꺼져 있으면 '') · 막혔으면 🔒 + 「10층부터」 · 누르면 이유 토스트 (lockBtn) */
function modeHtml(): string {
  if (!rushOn()) return '';
  const why = rushLockWhy();
  return `<div class="tabs abmode" id="abM"><button class="tab ${mode === 'floor' ? 'on' : ''}" data-abm="floor">한 층씩</button><button class="tab ${mode === 'rush' ? 'on' : ''}" data-abm="rush" ${lockAttr(why)}>${why ? '🔒 ' : ''}보스 연전${why ? ` <small>${CONFIG.raidWeapon.rush.unlockBest}층부터</small>` : ''}</button></div>`;
}
function ruleHtml(): string {
  if (mode === 'rush')
    return `<p class="note abrule"><b>보스 연전</b> — 매 층 보스 한 마리 (쓰러뜨린 지역 보스 중 무작위 · 직전 층과 다른 보스) · 쫄 없음 · 층마다 강해져요 (×${C().grow}) · 보상은 한 층씩과 같아요 (보스 재료·고유 장비는 ${C().bossEvery}층마다) · ${CONFIG.raidWeapon.rush.fragEvery}층마다 무기 조각 · ${C().restEvery}층마다 쉼터</p>`;
  return `<p class="note abrule">층마다 몬스터가 강해져요 (×${C().grow}) · ${C().bossEvery}층마다 보스 · ${C().restEvery}층마다 쉼터(축복 ${C().restMin}분) · 금화 대신 가루·재료 · 질 때까지 계속 올라요</p>`;
}
const recLabel = () => (mode === 'rush' ? '보스 연전 최고' : '최고');
/** RAIDWEAPON §1-4: 랭킹 창 한 줄 (서버 랭킹 없음 · 내 기록만) — 꺼져 있거나 아직 안 열렸으면 '' */
export function rushRankLine(): string {
  if (!rushOn()) return '';
  const r = rushRec();
  return `<p class="note rkrush">심연 보스 연전 · 내 최고 <b class="g">${r.best}층</b> · 이번 주 <b>${r.weekBest}층</b> (월요일 초기화 · 내 기록만)</p>`;
}
const deepMat = () => REGIONS.find((r) => r.id === 'deep')!.mat;

function party(): Actor[] {
  const crew = huntCrew().sort((a, b) => powerOf(b) - powerOf(a));
  picked = picked.filter((id) => crew.some((a) => a.id === id));
  if (!manual) for (const a of crew) if (picked.length < huntPartyMax() && !picked.includes(a.id)) picked.push(a.id);
  return picked.map((id) => crew.find((a) => a.id === id)!).filter(Boolean);
}

export function openAbyss() {
  if (!abyssOpen()) return toast(`심연의 바닥 ${CONFIG.hunt.stages}을 깨면 열려요`);
  // 첫 입장 한 줄
  if (onceEver('abyss1')) return talk([['narr', '바닥이라 믿었던 곳 아래에, 또 계단이 있었다.']], openAbyss);
  if (mode === 'rush' && !rushOpen()) mode = 'floor';
  const rec = abyssRec(now(), mode);
  const ms = party();
  const crew = huntCrew().sort((a, b) => powerOf(b) - powerOf(a));
  const cur = resumeFloor(now(), mode);
  const start = cur || rec.lost || 1;
  const pw = ms.length ? partyPower(ms) : 0;
  // J6 partyRulesV2: 원정 중인 사람도 흐리게 + 이유 · 지친 사람은 「체력 n · 지쳤어요」 · [추천 편성]
  const v2 = rulesV2();
  const blocked = v2 ? partyPool().filter((a) => partyBlock(a, 'abyss')).sort((x, y) => powerOf(y) - powerOf(x)) : [];
  const rows =
    crew
      .map((a) => `<button class="pm ${picked.includes(a.id) ? 'on' : ''}" data-ab="${a.id}"><img src="${portrait(a)}" alt=""><span>${picked[0] === a.id ? '<b class="g">대장</b> ' : ''}${nameTag(a)} Lv.${a.lvl}<small>${(v2 && partyNote(a, 'abyss')) || `체력 ${Math.round(a.hp)}`}</small></span><em>${fmt(powerOf(a))}</em></button>`)
      .join('') +
    blocked.map((a) => `<button class="pm" disabled><img src="${portrait(a)}" alt=""><span>${nameTag(a)} Lv.${a.lvl}<small>${esc(partyBlock(a, 'abyss')!)}</small></span><em>${fmt(powerOf(a))}</em></button>`).join('');
  const dis = ms.length ? '' : 'disabled';
  const rec1 = floorRec(start);
  const recOn = v2 && crew.length > 0;
  const cps = checkpoints(rec.best);
  const cont = cur
    ? `<div class="hopt"><button class="bigbtn keep" id="abResume" ${dis}>${cur}층부터 이어가기 · 무료</button><small>나갔던 층을 기억해 둬요</small></div>`
    : rec.lost
    ? `<div class="hopt"><button class="bigbtn keep" id="abCont" ${dis}>${rec.lost}층부터 이어하기 · ${fmtKo(contCost(rec.lost))} G</button><small>버나드가 길을 기억해 둬요 · 안 내면 1층부터</small></div>`
    : '';
  if (vis('heroCards')) {
    // CHECKIN §J6 카드 덱: 맨 위 [추천 편성][이어가기 / 1층부터] · 나머지(체크포인트 · 1층부터)는 격자 아래
    const primary = cur ? 'abResume' : rec.lost ? 'abCont' : 'abNew';
    const goLabel = cur ? `${cur}층부터 이어가기` : rec.lost ? `${rec.lost}층부터 · ${fmtKo(contCost(rec.lost))} G` : '1층부터 오르기';
    const cfg: DeckCfg = {
      where: 'abyss',
      pool: v2 ? partyPool() : crew,
      sel: ms,
      max: huntPartyMax(),
      block: (a) => (v2 ? partyBlock(a, 'abyss') : crew.includes(a) ? null : '원정 중'),
      note: (a) => (v2 ? partyNote(a, 'abyss') : null),
      lead: true,
      lockCell: lock4Cell(ms, huntPartyMax()),
      power: pw,
      rec: rec1,
      recLabel: `${start}층 추천`,
      synWhere: 'hunt',
      recId: recOn ? 'abRec' : undefined,
      recWhy: abWhy,
      go: `<button class="bigbtn ${primary === 'abNew' ? 'red' : 'keep'}" id="${primary}" ${dis}>${goLabel}</button>`,
      empty: '데려갈 단골이 없어요',
    };
    openWin(
      '끝없는 심연',
      `${modeHtml()}${deckTopHtml(cfg)}${deckGridHtml(cfg)}<p class="sub">${recLabel()} <b class="g">${rec.best}층</b> · 이번 주 최고 <b>${rec.weekBest}층</b> (월요일 초기화)</p>
      <label class="abauto"><input type="checkbox" id="abAuto" ${autoClimb ? 'checked' : ''}> AUTO 전투 · 이기면 「계속 오르기」 자동</label>
      ${ruleHtml()}
      <div class="hopts">${primary === 'abNew' ? '' : `<div class="hopt"><button class="bigbtn ghost" id="abNew" ${dis}>1층부터 오르기</button></div>`}${
        cps.length > 1
          ? `<div class="hopt"><div class="abcps">${cps.slice(1).map((c) => `<button class="abcp" data-cp="${c.floor}" ${dis}><b>${c.floor}층부터</b><small>${fmtKo(c.fee)} G</small></button>`).join('')}</div><small>체크포인트: 최고 층까지 10층마다 · 입장료를 내고 그 층부터 새로</small></div>`
          : ''
      }<small>맡겨 두기 · 소탕은 없어요</small></div>`,
      'huntw',
    );
    bindDeck(
      cfg,
      (id) => {
        picked = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < huntPartyMax() ? [...picked, id] : picked;
        manual = true;
        keepScroll(openAbyss);
      },
      openAbyss,
    );
  } else
  openWin(
    '끝없는 심연',
    `${modeHtml()}<p class="sub">${recLabel()} <b class="g">${rec.best}층</b> · 이번 주 최고 <b>${rec.weekBest}층</b> (월요일 초기화)</p>
    ${ruleHtml()}
    <div class="pw"><span>${start}층 추천 전투력</span><em>${fmt(floorRec(start))}</em><span>우리 파티</span><em class="${pw < floorRec(start) ? 'bad' : 'good'}">${fmt(pw)}</em></div>
    <p class="sub">파티 ${ms.length}/${huntPartyMax()} · 첫 번째가 대장</p>${recOn ? recButton('abRec', abWhy) : ''}
    <div class="plist">${rows || '<p class="note">데려갈 단골이 없어요</p>'}</div>
    <label class="abauto"><input type="checkbox" id="abAuto" ${autoClimb ? 'checked' : ''}> AUTO 전투 · 이기면 「계속 오르기」 자동</label>
    <div class="hopts">${cont}<div class="hopt"><button class="bigbtn ${rec.lost || cur ? 'ghost' : 'red'}" id="abNew" ${dis}>1층부터 오르기</button>${
      cps.length > 1
        ? `<div class="abcps">${cps.slice(1).map((c) => `<button class="abcp" data-cp="${c.floor}" ${dis}><b>${c.floor}층부터</b><small>${fmtKo(c.fee)} G</small></button>`).join('')}</div><small>체크포인트: 최고 층까지 10층마다 · 입장료를 내고 그 층부터 새로</small>`
        : ''
    }<small>맡겨 두기 · 소탕은 없어요</small></div></div>`,
    'huntw',
  );
  $$('[data-abm]').forEach(
    (el) =>
      (el.onclick = () => {
        const m = el.dataset.abm as AbyssMode;
        if (m === mode) return;
        mode = m;
        keepScroll(openAbyss);
      }),
  );
  $$('[data-ab]').forEach(
    (el) =>
      (el.onclick = () => {
        const id = +el.dataset.ab!;
        picked = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < huntPartyMax() ? [...picked, id] : picked;
        manual = true;
        openAbyss();
      }),
  );
  // J6 partyRulesV2: 심연도 추천 편성 (시작 층 추천 전투력 기준 · 대장은 가장 센 사람)
  const ar = document.getElementById('abRec');
  if (ar)
    ar.onclick = () => {
      const best = recommendFor('abyss', { power: rec1, region: 'deep', min: 1, max: huntPartyMax() }, crew);
      if (!best) return toast(fsay('데려갈 단골이 없어요', '함께 보내드릴 단골이 없어요'));
      picked = best.members.sort((x, y) => powerOf(y) - powerOf(x)).map((m) => m.id);
      manual = true;
      abWhy = best.reasons.join(' · ') || `전투력 ${fmt(best.power)} / 추천 ${fmt(rec1)}`;
      trackEv('party_recommend', { where: 'abyss', action: 'use', n: picked.length });
      if (vis('heroCards')) deckGlow(picked);
      keepScroll(openAbyss);
    };
  const au = document.getElementById('abAuto') as HTMLInputElement | null;
  if (au) au.onchange = () => (autoClimb = au.checked);
  document.getElementById('abNew')!.onclick = () => {
    dropContinue(now(), mode);
    closeWin();
    climb(1, ms);
  };
  const cb = document.getElementById('abCont');
  if (cb) cb.onclick = () => doContinue(ms);
  const rb = document.getElementById('abResume');
  if (rb)
    rb.onclick = () => {
      closeWin();
      trackEv('abyss_resume', { floor: cur, ...(mode === 'rush' ? { mode } : {}) });
      climb(cur, ms);
    };
  $$('[data-cp]').forEach(
    (el) =>
      (el.onclick = () => {
        const r = startAt(+el.dataset.cp!, now(), mode);
        if ('err' in r) return toast(r.err);
        closeWin();
        trackEv('abyss_start', { power: Math.round(partyPower(ms)), from: r.floor, fee: r.fee });
        climb(r.floor, ms);
      }),
  );
}

/** 이어하기: 값을 내고 (버나드 한마디) 진 층부터 */
function doContinue(ms: Actor[]) {
  const r = payContinue(now(), mode);
  if ('err' in r) return toast(r.err);
  closeWin();
  closeCombat();
  trackEv('abyss_continue', { floor: r.floor });
  const go = () => climb(r.floor, ms);
  if (onceDay('abyssCont')) talk([['keeper', '다시 내려가겠다고? …좋네. 길은 내가 기억해 두지. 값은 받겠네만.']], go);
  else go();
}

/** 한 층 싸우기 */
export function climb(f: number, ms: Actor[], md: AbyssMode = mode) {
  clearTimeout(timer);
  const live = ms.filter((m) => huntCrew().includes(m));
  if (!live.length) return toast(fsay('데려갈 단골이 없어요', '함께 보내드릴 단골이 없어요'));
  // 보스 연전이 꺼졌거나 막혔으면 한 층씩으로
  if (md === 'rush' && !rushOpen()) md = 'floor';
  mode = md;
  const rush = md === 'rush';
  enterFloor(f, now(), md);
  // 보스 연전: 매 층 보스 (직전 층과 다른 보스) · 한 층씩: 5층마다
  const boss = rush ? pickRushBoss(rushRec().prev) : isBossFloor(f) ? pickBoss() : null;
  if (f === 1) trackEv('abyss_start', { power: Math.round(partyPower(live)), ...(rush ? { mode: md } : {}) });
  void startCombat(
    'deep',
    rush ? CONFIG.hunt.stages : floorStage(f),
    live,
    autoClimb,
    (res) => {
      for (const m of live) m.hp = Math.max(1, m.hp - (res.win ? 3 : 10));
      markAdventured(live);
      if (res.win) {
        const out = clearFloor(f, boss?.region ?? null, Math.random, now(), md);
        out.items.push(...res.items);
        showCombatResult(winHtml(out, res.autoUsed, res, live), (card) => bindWin(card, f, live, res.autoUsed));
        dropFanfare(out.items);
      } else if (res.quit && resumeOn()) {
        // v0.24.5: ✕로 나왔다 = 진 게 아님 → 그 층부터 무료로 이어가기 (cur 그대로)
        enterFloor(f, now(), md);
        trackEv('abyss_leave', { floor: f, ...(rush ? { mode: md } : {}) });
        showCombatResult(leaveHtml(f), (card) => bindLeave(card, f, live));
      } else {
        loseFloor(f, now(), md);
        trackEv('abyss_end', { floor: f, best: abyssRec(now(), md).best, ...(rush ? { mode: md } : {}) });
        showCombatResult(loseHtml(f), (card) => bindLose(card, live));
      }
      markDirty();
    },
    { rec: floorRec(f), noFold: true, fanfare: !!boss, ...(boss ? { look: boss.look } : {}), ...(rush ? { bossOnly: true, music: 'abyss_rush' as const } : {}) },
  );
}

function winHtml(o: FloorReward, auto: boolean, res?: CombatResult, ms: Actor[] = []): string {
  // CHECKIN §J3 (uiCards): 별 1~3 · MVP 초상 + 한 마디 · 드랍 칸 (버튼 [계속 오르기 · 다음 층]은 그대로)
  const cards = cardsOn() && !!res;
  const loot = [
    `잿빛 가루 +${o.dustN}`,
    `희귀 가루 +${o.dustR}`,
    o.dustE ? `영웅 가루 +${o.dustE}` : '',
    `${esc(deepMat())} ×${o.mats}`,
    o.bossMats ? `<span class="g">${esc(o.bossMat)} ×${o.bossMats}</span>` : '',
  ].filter(Boolean);
  const items = cards ? '' : o.items.map((it) => itemCell(it)).join('');
  const next = o.floor + 1;
  const rush = mode === 'rush';
  return `<h2>${rush ? '보스 연전' : '끝없는 심연'} ${o.floor}층 돌파!</h2>
    ${o.record ? '<p class="cen good">새 기록!</p>' : ''}${o.bragged ? `<p class="cen g">[알림] ${o.bragged}층 자랑을 했어요</p>` : ''}
    ${cards ? `${starsHtml(res!, CONFIG.combat.timeLimit)}${mvpHtml(ms.find((a) => a.id === res!.mvp))}` : ''}
    ${o.frags ? `<p class="cen g">무기 조각 +${o.frags}</p>` : ''}${o.rest ? `<p class="cen good">쉼터 — 예배당 축복 +${C().restMin}분</p>` : ''}
    <div class="loot">${loot.map((x) => (x.startsWith('<') ? x : `<span>${x}</span>`)).join('')}</div>${items ? `<div class="loot">${items}</div>` : ''}${cards ? dropsHtml(o.items) : ''}
    <p class="note cen">다음 ${next}층${rush || isBossFloor(next) ? ' · 보스' : ''}${(rush || !isBossFloor(next)) && isRestFloor(next) ? ' · 쉼터' : ''} · 추천 ${fmt(floorRec(next))}</p>
    ${auto && autoClimb ? `<p class="cen abcount" id="abCount">${C().autoNextSec}초 뒤 계속 올라요</p>` : ''}
    <div class="go"><button class="a" id="abNext">계속 오르기 · ${next}층</button><button class="b" id="abHome">그만 · 마을로</button></div>
    <p class="note cen">${resumeOn() ? `그만 내려가도 다음엔 ${next}층부터 무료로 이어가요` : `그만 내려가면 다음엔 ${next}층부터 이어하기(금화) 또는 1층부터`}</p>`;
}
function bindWin(card: HTMLElement, f: number, ms: Actor[], auto: boolean) {
  const next = () => {
    clearTimeout(timer);
    closeCombat();
    climb(f + 1, ms);
  };
  card.querySelector<HTMLElement>('#abNext')!.onclick = next;
  card.querySelector<HTMLElement>('#abHome')!.onclick = () => {
    clearTimeout(timer);
    if (!resumeOn()) loseFloor(f + 1, now(), mode);
    closeCombat();
  };
  if (auto && autoClimb) {
    let n = C().autoNextSec;
    const tick = () => {
      const el = card.querySelector('#abCount');
      if (!el || !document.body.contains(el)) return;
      if (n <= 0) return next();
      el.textContent = `${n}초 뒤 계속 올라요`;
      n--;
      timer = window.setTimeout(tick, 1000);
    };
    tick();
  }
}
function leaveHtml(f: number): string {
  return `<h2>${f}층에서 나왔어요</h2>
    <p class="cen">다음엔 ${f}층부터 무료로 이어가요</p>
    <div class="go"><button class="a" id="abAgain">${f}층 다시 오르기</button><button class="b" id="abHome3">마을로</button></div>`;
}
function bindLeave(card: HTMLElement, f: number, ms: Actor[]) {
  card.querySelector<HTMLElement>('#abAgain')!.onclick = () => {
    closeCombat();
    climb(f, ms);
  };
  card.querySelector<HTMLElement>('#abHome3')!.onclick = () => closeCombat();
}
function loseHtml(f: number): string {
  const rec = abyssRec(now(), mode);
  return `<h2>${f}층에서 쓰러졌어요…</h2>
    <p class="cen">최고 ${rec.best}층 · 이번 주 ${rec.weekBest}층</p>
    <div class="go"><button class="a" id="abCont2">${f}층부터 이어하기 · ${fmtKo(contCost(f))} G</button></div>
    <div class="go"><button class="b" id="abNew2">1층부터</button><button class="b" id="abHome2">마을로</button></div>
    <p class="note cen">금화 ${fmtKo(S.gold)} G</p>`;
}
function bindLose(card: HTMLElement, ms: Actor[]) {
  card.querySelector<HTMLElement>('#abCont2')!.onclick = () => doContinue(ms);
  card.querySelector<HTMLElement>('#abNew2')!.onclick = () => {
    dropContinue(now(), mode);
    closeCombat();
    climb(1, ms);
  };
  card.querySelector<HTMLElement>('#abHome2')!.onclick = () => closeCombat();
}

/** 개발 · e2e */
export const _abyss = { climb, open: openAbyss, state: () => ({ picked, autoClimb, mode, rec: abyssRec(now(), mode), hunt: P.hunt.best.deep }), setMode: (m: AbyssMode) => (mode = m) };
