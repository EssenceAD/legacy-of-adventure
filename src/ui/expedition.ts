// 원정 창: 의뢰 게시판(목록·진행 중 파티·천장) → 파티 고르기(전투력·성공률·전투력 올리기 안내) → 보고서 · 방치 요약
import { vis, fsay } from '../world/visual';
import { dropFanfare } from './fanfare';
import { BASE_REGIONS } from '../data/items';
import { huntRegionOpen } from '../world/hunt';
import { CONFIG } from '../data/config';
import { josa } from '../data/josa';
import { GRADE_INFO, GRADES, REGIONS, regionById, type Grade } from '../data/items';
import { talk } from './dialogue';
import { bossPic, openRaidPrep } from './raid';
import { triesLeft, wanderTarget, weeklyTarget, type RaidTarget } from '../world/raid';
import { powerOf } from '../world/adventurers';
import { addEmber } from '../world/owner';
import { feature, featureChapter } from '../world/guide';
import { openHunt } from './hunt';
import { iconSrc } from './kit';
import { departParty, returnParty } from '../world/actors';
import {
  activeRuns, boardLevel, boardState, fullPartyHint, canSend, ensureQuests, maxParties, partyInfo, partyMinFor, powerTips, refreshQuests, regionUnlocked, runLog, sendParty,
  partyMax,
  isCompanion, companionText, partyEligible, resendPlan,
} from '../world/expeditions';
import { equip, itemPower } from '../world/items';
import { floatW } from '../world/fx';
import { uiHooks } from '../world/state';
import { dropChances, pityLimit } from '../world/items';
import type { OfflineSummary } from '../world/offline';
import { markDirty, P, S, world, type Actor, type Quest, type Run, type TalkLine } from '../world/state';
import { upgradeBtn } from './guests';
import { checkSlot5 } from '../world/meta';
import { track as trackEv } from '../net/telemetry';
import { recommendParty } from '../world/party';
import { mentorBadge, recButton, roleIcon, roleRow, synRow, tagLine } from './partyUi';
import { bindDeck, deckGlow, deckGridHtml, deckTopHtml, type DeckCfg } from './heroCard';
import { partyBlock, rulesV2 } from '../world/partyRules';
import { bondOf } from '../world/chem';
import { pairById } from '../data/chem';
import { $, $$, claimOrder, esc, keepScroll, fmt, itemCell, leftText, liveWin, minText, nameTag, pct, pic, portrait } from './common';
import { closeWin, openBuild, openWin, toast } from './windows';
import * as game from '../game';
import { showWelcome } from './welcome';
import { bannerFx, boxFor, cardsOn, fxOn, itemLine, keyFx, lineCard, playReceipt, shortG, receiptHtml, type RcLine } from './checkin';
import { def } from '../data/catalog';
import { afterPaidRefresh, bindFavors, favorIntro, favorsHtml, refreshBtn, refreshHint } from './goldsink';

const TIER = CONFIG.expedition.tierNames;
const homeActors = () => world.home?.actors ?? world.actors;

/** 원정 갈 수 있는 손님 (단골·영웅) */
const crew = () => homeActors().filter((a) => partyEligible(a) && !a.leaving);

function runRow(r: Run) {
  const reg = regionById(r.quest.region);
  const names = r.members.map((id) => homeActors().find((a) => a.id === id)?.name ?? '?').join(' · ');
  // CHECKIN §J3 (uiCards): 한 줄 카드 — 아이콘 + 진행 막대 + 보상 칸 + [받기] (끝난 원정 = 보고서 보기)
  if (cardsOn()) {
    const box = boxFor(r.quest.tier <= 1 ? 0 : r.quest.tier <= 3 ? 1 : 2);
    const gold = `${shortG(r.quest.gold[0])}~${shortG(r.quest.gold[1])} G`;
    if (r.result)
      return lineCard({ tag: 'button', cls: `run done ${r.result.win ? 'ready' : ''}`, attrs: `data-run="${r.id}"`, ic: iconSrc('m_expedition'), title: `${esc(reg.name)} ${r.result.win ? '성공!' : '실패…'}`, sub: esc(names), box, reward: r.result.win ? `+${shortG(r.result.gold)} G` : '—', btn: '<em class="lc-go">받기</em>' });
    return lineCard({ tag: 'button', cls: 'run go', attrs: `data-log="${r.id}"`, ic: iconSrc('m_expedition'), title: esc(questName(r.quest)), sub: `${esc(names)}`, box, reward: gold, btn: '<em>›</em>' }).replace('</span><span class="lc-rw">', `<div class="pbar" data-start="${r.start}" data-end="${r.end}"><i><b></b></i><em>${leftText(r.end - Date.now())}</em></div></span><span class="lc-rw">`);
  }
  if (r.result)
    return `<button class="run done" data-run="${r.id}"><b>${reg.name} ${r.result.win ? '성공!' : '실패…'}</b><small>${esc(names)}</small><em>보고서 보기</em></button>`;
  return `<button class="run go" data-log="${r.id}"><b>${esc(questName(r.quest))}</b><small>${esc(names)} · 눌러서 진행 일지</small><div class="pbar" data-start="${r.start}" data-end="${r.end}"><i><b></b></i><em>${leftText(r.end - Date.now())}</em></div></button>`;
}

/** 의뢰 이름: 이름이 있으면 그대로, 아니면 「지역 · 짧은 의뢰」 */
export const questName = (q: Quest) => q.name ?? `${regionById(q.region).name} · ${TIER[q.tier]} 의뢰`;
const durText = (m: number) => (m < 1 ? `${Math.round(m * 60)}초` : minText(m));

function questRow(q: Quest) {
  const reg = regionById(q.region);
  const dc = dropChances(q.region, CONFIG.expedition.tierGrade[q.tier] ?? q.tier);
  // CHECKIN §J3 (uiCards): 한 줄 카드 — 지역 아이콘 · 이름·시간·추천 전투력 · 보상 칸(상자 + 금화) · ›
  if (cardsOn())
    return lineCard({
      tag: 'button',
      cls: `quest ${q.tutorial ? 'tut' : ''}`,
      attrs: `data-q="${q.id}" style="--rc:${reg.color}"`,
      ic: iconSrc('m_quest'),
      title: `<span class="qreg">${reg.name}</span> ${q.tutorial ? `★ ${esc(q.name!)}` : `${TIER[q.tier]} 의뢰`}${partyMinFor(q) === 1 ? ' <small class="g">1명도 OK</small>' : ''}`,
      sub: `${q.tutorial ? '첫 원정 · 희귀 장비 확정! · ' : ''}추천 전투력 ${fmt(q.power)} · ${durText(q.minutes)}${q.tag ? ` · 📜 ${esc(q.tag.text)}` : ''}</small><small class="drop">희귀 ${pct(Math.min(1, dc.r), 0)} · 영웅 ${pct(Math.min(1, dc.e), 1)} · 전설 ${pct(Math.min(1, dc.l), 1)}`,
      box: boxFor(q.tutorial ? 1 : q.tier <= 1 ? 0 : q.tier <= 3 ? 1 : 2),
      reward: `${shortG(q.gold[0])}~${shortG(q.gold[1])} G`,
      btn: '<em>›</em>',
    });
  return `<button class="quest ${q.tutorial ? 'tut' : ''}" data-q="${q.id}" style="--rc:${reg.color}"><span class="qreg">${reg.name}</span><span class="qmain"><b>${q.tutorial ? `★ ${esc(q.name!)} · ${durText(q.minutes)}` : `${TIER[q.tier]} 의뢰 · ${durText(q.minutes)}`}${partyMinFor(q) === 1 ? ' <small class="g">1명도 OK</small>' : ''}</b>${q.tutorial ? '<small class="g">첫 원정 · 희귀 장비 확정!</small>' : ''}<small>추천 전투력 ${fmt(q.power)} · 금화 ${fmt(q.gold[0])}~${fmt(q.gold[1])}</small>${q.tag ? `<small class="qtag">📜 ${esc(q.tag.text)}</small>` : ''}<small class="drop">희귀 ${pct(Math.min(1, dc.r), 0)} · 영웅 ${pct(Math.min(1, dc.e), 1)} · 전설 ${pct(Math.min(1, dc.l), 1)}</small></span><em>›</em></button>`;
}

// HOTFIX14 §6: 조건 카드의 [의뢰 게시판 가기] (도감·손님 창 어디서든)
addEventListener('click', (e) => {
  if ((e.target as HTMLElement)?.closest?.('[data-goboard]')) openBoard();
});

/** GOLDSINK §5: 게시판 탭 (0 의뢰 · 1 마을 부탁) */
let boardTab = 0;
const boardTabs = () =>
  `<div class="tabs" id="bdT"><button class="tab ${boardTab ? '' : 'on'}" data-bt="0">오늘의 의뢰</button><button class="tab ${boardTab ? 'on' : ''}" data-bt="1">📜 마을 부탁</button></div>`;
function bindBoardTabs() {
  $$('[data-bt]').forEach(
    (b) =>
      (b.onclick = () => {
        const t = +b.dataset.bt!;
        if (t === boardTab) return;
        if (t === 1) favorIntro(() => openBoard(1));
        else openBoard(0);
      }),
  );
}

/** 의뢰 게시판 */
export function openBoard(tab?: number) {
  checkSlot5();
  if (S.visiting) return toast(fsay('이웃 마을에선 원정을 못 보내요', '이웃 마을에선 원정을 보내드릴 수 없어요'));
  if (tab != null) boardTab = tab;
  if (boardTab === 1) {
    openWin('원정 · 의뢰 게시판', `${boardTabs()}${favorsHtml()}`);
    bindBoardTabs();
    bindFavors(() => openBoard(1));
    return;
  }
  ensureQuests();
  // 핫픽스 11 §9-1: 돌아온 파티(보고서) 먼저 → 진행 중은 많이 간 순
  const runs = claimOrder(
    P.runs.filter((r) => !r.claimed),
    (r) => ({ ready: !!r.result, got: false, ratio: (Date.now() - r.start) / Math.max(1, r.end - r.start) }),
  );
  const pity = REGIONS.filter((_, i) => regionUnlocked(i))
    .map((r) => `<span style="color:${r.color}">${r.name}</span> 전설까지 <b>${pityLimit() - P.pity[r.id]}</b>`)
    .join(' · ');
  const locked = REGIONS.map((r, i) => (regionUnlocked(i) || i >= BASE_REGIONS ? '' : `<div class="qlock">🔒 ${r.name} — ${REGIONS[i - 1].name} 의뢰 3번 성공 · ${REGIONS[i - 1].name} 사냥 10 돌파 · 평판 ★${i + 1} 중 하나</div>`)).join('');
  const wk = weeklyTarget();
  const wd = wanderTarget();
  const raidCard = (t: RaidTarget, id: string) =>
    `<button class="raidcard" id="${id}"><img src="${bossPic(t.boss)}" alt=""><span><b>${t.kind === 'weekly' ? '주간 보스' : '떠돌이 보스'} · ${t.boss.name}</b><small>권장 ${fmt(t.boss.power)} · ${t.hpLeft <= 0 ? '이번 주 처치 완료!' : `남은 체력 ${pct(t.hpLeft / t.max)}`}${t.kind === 'wander' ? ` · ${Math.max(0, Math.ceil((P.raid.wander!.until - Date.now()) / 36e5))}시간 남음` : ''}</small><i class="bhp"><i style="width:${(t.hpLeft / t.max) * 100}%"></i></i></span><em>토벌 ›</em></button>`;
  // 5단계: 사냥터 카드 (장부 1장) · 토벌은 장부 4장에 열린다 (5단계 전 저장은 그대로)
  const huntBest = REGIONS.map((r) => `${r.name} ${P.hunt.best[r.id] ?? 0}/10`).filter((_, i) => i === 0 || huntRegionOpen(i));
  const huntHtml = feature('hunt')
    ? `<div class="qhd"><b class="g">사냥</b><span class="note">${P.hunt.auto ? '자동 사냥 중' : '스테이지 돌파 · 자동 반복'}</span></div><button class="raidcard hunt" id="rHunt"><img src="${iconSrc('m_hunt')}" alt=""><span><b>사냥터</b><small>${huntBest.join(' · ')}</small></span><em>사냥 ›</em></button>`
    : `<div class="qlock">🔒 사냥터 — 장부 ${featureChapter('hunt')}장을 마치면 열려요</div>`;
  const raidHtml = feature('raid')
    ? `<div class="qhd"><b class="g">토벌</b><span class="note">오늘 남은 도전 ${triesLeft()}/${CONFIG.raid.triesPerDay} · 증표 ${P.tokens}</span></div>
    <div class="raids">${wk.hpLeft > 0 || !P.raid.killed ? raidCard(wk, 'rWeek') : `<div class="raidcard done"><img src="${bossPic(wk.boss)}" alt=""><span><b>주간 보스 · ${wk.boss.name}</b><small>이번 주 처치 완료! 월요일에 새 보스가 와요</small></span></div>`}${wd ? raidCard(wd, 'rWander') : ''}</div>`
    : `<div class="qlock">🔒 토벌전 — 장부 ${featureChapter('raid')}장을 마치면 열려요</div>`;
  openWin(
    '원정 · 의뢰 게시판',
    `${boardTabs()}${vis('actionsTidy') ? `<p class="sub objinfo">${esc(def('board').desc)} · 게시판 레벨마다 ${esc(def('board').levelText ?? '')}</p>` : ''}${huntHtml}${raidHtml}
    ${vis('boardLevelUp') ? boardLine() : `<p class="sub">파티 ${activeRuns().length}/${maxParties()} ${boardLevel() ? `(게시판 Lv.${boardLevel()})` : '· 게시판을 지으면 더 보낼 수 있어요'}</p>`}
    ${runs.length ? `<div class="runs">${runs.map(runRow).join('')}</div>` : ''}
    <div class="qhd"><b class="g">오늘의 의뢰</b>${refreshBtn()}</div>
    <div class="quests">${P.quests.list.map(questRow).join('') || '<p class="note">오늘 의뢰를 다 받았어요 · 내일 아침 새로 붙어요</p>'}</div>${refreshHint()}
    ${locked}<p class="note pity">${pity}</p>`,
  );
  $$('.quest').forEach((b) => (b.onclick = () => openParty(P.quests.list.find((q) => q.id === +b.dataset.q!)!, [], true)));
  $$('[data-log]').forEach((b) => (b.onclick = () => openRunLog(P.runs.find((r) => r.id === +b.dataset.log!)!)));
  const rh = document.getElementById('rHunt');
  if (rh) rh.onclick = () => openHunt();
  const rw = document.getElementById('rWeek');
  if (rw) rw.onclick = () => openRaidPrep(weeklyTarget());
  const rd = document.getElementById('rWander');
  if (rd) rd.onclick = () => wanderTarget() && openRaidPrep(wanderTarget()!);
  $$('.run.done').forEach(
    (b) =>
      (b.onclick = () => {
        closeWin();
        openReportCard(P.runs.find((r) => r.id === +b.dataset.run!)!);
      }),
  );
  bindBoardTabs();
  bindBoardLine();
  $('#qRef').onclick = () => {
    const k = refreshQuests();
    if (!k) return toast('금화가 모자라요');
    markDirty();
    trackEv('quest_refresh', { kind: k, n: P.gs.refreshPaid });
    // GOLDSINK §9: 그날 첫 유료 새로고침에 버나드
    if (k === 'paid') afterPaidRefresh(() => openBoard());
    else openBoard();
  };
  // 핫픽스 10 §10: 열어 둔 사이 돌아온 파티 → 「보고서 보기」로 바로 바뀌게
  const shown = new Set(runs.filter((r) => r.result).map((r) => r.id));
  liveWin('원정 · 의뢰 게시판', () => P.runs.some((r) => !r.claimed && r.result && !shown.has(r.id)), () => {
    openBoard();
    for (const id of P.runs.filter((r) => !r.claimed && r.result && !shown.has(r.id)).map((r) => r.id)) document.querySelector(`.run.done[data-run="${id}"]`)?.classList.add('fresh');
  });
}

// ───────── v0.25.2 §I 게시판 레벨업: 「파티 n/m · 게시판 Lv.x」 줄 오른쪽에 버튼 (공사 규칙은 다른 건물과 같게 game.upgrade) ─────────
function boardLine(): string {
  const b = boardState();
  const full = activeRuns().length >= maxParties();
  const lvText = b.state === 'none' ? '게시판 없음' : `게시판 Lv.${b.lv}${b.state === 'max' ? ' · 최대' : ''}`;
  const btn = S.visiting
    ? ''
    : b.state === 'none'
    ? '<button id="brdBuild">게시판 짓기</button>'
    : b.state === 'up'
    ? `<button id="brdUp" class="${full ? 'glow' : ''}" ${S.gold >= b.cost! ? '' : 'disabled'}>게시판 Lv.${b.lv + 1} · ${fmt(b.cost!)} G</button>`
    : b.state === 'con'
    ? '<span class="note">🔨 공사 중</span>'
    : '';
  return `<div class="qhd brdln"><span class="sub">파티 <b>${activeRuns().length}/${maxParties()}</b> · ${lvText}</span>${btn}</div>${full && !S.visiting ? `<p class="note brdfull">파티가 꽉 찼어요 · ${fullPartyHint()}</p>` : ''}`;
}
function bindBoardLine() {
  const bb = document.getElementById('brdBuild');
  if (bb) bb.onclick = () => openBuild();
  const up = document.getElementById('brdUp');
  if (up)
    up.onclick = () => {
      const o = boardState().o;
      if (o) game.upgrade(o);
    };
}

// ───────── 파티 고르기 ─────────

function openParty(q: Quest, picked: number[] = [], fresh = false) {
  const list = crew().sort((a, b) => powerOf(b) - powerOf(a));
  // CHECKIN §B-2: 첫 원정(튜토리얼 의뢰)은 추천 편성을 미리 골라 둔다 — 바로 [출발!]
  const ff = vis('firstFlowFix');
  if (ff && fresh && q.tutorial && !picked.length) {
    const best = recommendParty(list.filter((a) => !canSend(a)), { power: q.power, region: q.region, min: partyMinFor(q), max: partyMax(), tag: q.tag });
    if (best) picked = best.members.map((m) => m.id);
  }
  const sel = list.filter((a) => picked.includes(a.id));
  const info = sel.length ? partyInfo(sel, q) : null;
  const short = info && info.power < q.power;
  const tips = short ? powerTips(sel) : [];
  // J6 partyRulesV2: 못 가는 이유는 네 화면 같은 글 (원정 중 n분 · 쉬는 중)
  const block = (a: Actor) => (rulesV2() ? partyBlock(a, 'exp') : canSend(a));
  const pmin = partyMinFor(q);
  if (vis('heroCards')) return openPartyCards(q, picked, list, sel, info, tips, pmin, block);
  const rows = list
    .map((a) => {
      const why = block(a);
      const on = picked.includes(a.id);
      return `<button class="pm ${on ? 'on' : ''}" data-id="${a.id}" ${why && !on ? 'disabled' : ''}><img src="${pic(a)}" alt=""><span>${roleIcon(a)}${nameTag(a)} Lv.${a.lvl}${mentorBadge(a, sel)}<small>${isCompanion(a) && !why ? `${companionText(a)} · ` : ''}${why ?? `체력 ${Math.round(a.hp)}`}</small></span><em>${fmt(powerOf(a))}</em></button>`;
    })
    .join('');
  if (ff) return openPartyFF(q, picked, list, sel, info, tips, rows, pmin);
  openWin(
    questName(q),
    `${slot5Banner()}<p class="sub">파티 ${pmin}~${partyMax()}명 · 추천 전투력 <b class="g">${fmt(q.power)}</b> · ${durText(q.minutes)}</p>
    ${tagLine(q.tag, sel)}${list.length ? recButton('pRec', recWhy.q === q.id ? recWhy.text : '') : ''}${roleRow(sel)}${synRow(sel, list.filter((a) => !canSend(a)), partyMax(), 'exp')}
    <div class="plist">${rows || '<p class="note">단골이 없어요 · 손님이 단골이 되면 보낼 수 있어요</p>'}</div>
    <div class="psum">${
      info
        ? `파티 전투력 <b class="${short ? 'bad' : 'good'}">${fmt(info.power)}</b> / ${fmt(q.power)}${info.chem > 1 ? ` · 케미 ×${info.chem.toFixed(2)}` : ''}<br>성공률 <b>${q.tutorial ? '100%' : pct(info.success)}</b> · 걸리는 시간 ${durText(info.minutes)}`
        : '함께 갈 손님을 골라요'
    }</div>
    ${chemLine(sel)}
    ${tips.length ? `<div class="tips"><b>▲ 전투력 올리기</b>${tips.map((t) => `<div>· ${esc(t.text)}</div>`).join('')}</div>` : ''}
    <button class="bigbtn" id="pGo" ${sel.length >= pmin ? '' : 'disabled'}>${fsay('출발!', '원정 보내드릴게요')}</button>`,
  );
  bindParty(q, picked, list, sel);
}

/**
 * CHECKIN §B-2 (플래그 firstFlowFix): 맨 위 = [추천 편성] · 성공률 · [출발!]
 *  5번째 자리 조건은 맨 위 안내 대신 자리 줄의 잠긴 칸(🔒)을 눌렀을 때만
 */
function openPartyFF(q: Quest, picked: number[], list: Actor[], sel: Actor[], info: ReturnType<typeof partyInfo> | null, tips: ReturnType<typeof powerTips>, rows: string, pmin: number) {
  const short = info && info.power < q.power;
  const rate = info ? (q.tutorial ? '100%' : pct(info.success)) : '—';
  const reason = recWhy.q === q.id ? recWhy.text : '';
  const max = partyMax();
  const cells: string[] = [];
  for (let i = 0; i < max; i++) cells.push(sel[i] ? `<span class="pty-slot on"><img src="${pic(sel[i])}" alt=""></span>` : '<span class="pty-slot"></span>');
  if (!P.meta.slot5) cells.push('<span class="pty-slot lock" id="pSlot5" role="button" tabindex="0" title="5번째 자리">🔒</span>');
  const opened = P.meta.slot5 && !P.meta.slot5Seen ? slot5Banner() : '';
  openWin(
    questName(q),
    `<div class="recb ffTop">${list.length ? '<button class="bigbtn sm" id="pRec">추천 편성</button>' : ''}<small>성공률 <b class="${info ? (short ? 'bad' : 'good') : ''}">${rate}</b> · ${sel.length}/${max}명</small><button class="bigbtn" id="pGo" ${sel.length >= pmin ? '' : 'disabled'}>${fsay('출발!', '보내기')}</button></div>
    ${reason ? `<p class="note">${esc(reason)}</p>` : ''}${opened}<div class="pty-slots">${cells.join('')}</div>
    <p class="sub">파티 ${pmin}~${max}명 · 추천 전투력 <b class="g">${fmt(q.power)}</b> · ${durText(q.minutes)}</p>
    ${tagLine(q.tag, sel)}${roleRow(sel)}${synRow(sel, list.filter((a) => !canSend(a)), max, 'exp')}
    <div class="plist">${rows || '<p class="note">단골이 없어요 · 손님이 단골이 되면 보낼 수 있어요</p>'}</div>
    <div class="psum">${
      info
        ? `파티 전투력 <b class="${short ? 'bad' : 'good'}">${fmt(info.power)}</b> / ${fmt(q.power)}${info.chem > 1 ? ` · 케미 ×${info.chem.toFixed(2)}` : ''} · 걸리는 시간 ${durText(info.minutes)}`
        : '함께 갈 손님을 골라요'
    }</div>
    ${chemLine(sel)}
    ${tips.length ? `<div class="tips"><b>▲ 전투력 올리기</b>${tips.map((t) => `<div>· ${esc(t.text)}</div>`).join('')}</div>` : ''}`,
  );
  const s5 = document.getElementById('pSlot5');
  if (s5) s5.onclick = () => toast(slot5Text());
  bindParty(q, picked, list, sel);
}

/**
 * CHECKIN §J6 (플래그 heroCards · 실험실): 영웅 카드 덱 — 맨 위 고정(자리 · 역할 · 조합 · 추천 전투력 막대 · [추천 편성][출발!]) + 카드 격자
 *  5번째 자리 조건은 자리 줄 끝의 잠긴 칸(🔒)을 눌렀을 때 (firstFlowFix와 같게)
 */
function openPartyCards(q: Quest, picked: number[], list: Actor[], sel: Actor[], info: ReturnType<typeof partyInfo> | null, tips: ReturnType<typeof powerTips>, pmin: number, block: (a: Actor) => string | null) {
  const max = partyMax();
  const rate = info ? (q.tutorial ? '100%' : pct(info.success)) : '—';
  const cfg: DeckCfg = {
    where: 'exp',
    pool: list,
    sel,
    max,
    block,
    extra: (a) => mentorBadge(a, sel),
    lockCell: P.meta.slot5 ? '' : '<span class="pty-slot lock" id="pSlot5" role="button" tabindex="0" title="5번째 자리">🔒</span>',
    power: info?.power ?? 0,
    rec: q.power,
    info: `성공률 <b class="${info ? (info.power < q.power ? 'bad' : 'good') : ''}">${rate}</b> · ${sel.length}/${max}명 · ${durText(info ? info.minutes : q.minutes)}${info && info.chem > 1 ? ` · 케미 ×${info.chem.toFixed(2)}` : ''}`,
    synWhere: 'exp',
    recId: list.length ? 'pRec' : undefined,
    recWhy: recWhy.q === q.id ? recWhy.text : '',
    go: `<button class="bigbtn" id="pGo" ${sel.length >= pmin ? '' : 'disabled'}>${fsay('출발!', '보내드릴게요')}</button>`,
    empty: '단골이 없어요 · 손님이 단골이 되면 보낼 수 있어요',
  };
  const opened = P.meta.slot5 && !P.meta.slot5Seen ? slot5Banner() : '';
  openWin(
    questName(q),
    `${deckTopHtml(cfg)}${opened}${tagLine(q.tag, sel)}
    ${deckGridHtml(cfg)}<p class="sub">파티 ${pmin}~${max}명 · 추천 전투력 <b class="g">${fmt(q.power)}</b> · ${durText(q.minutes)}</p>
    ${tips.length ? `<div class="tips"><b>▲ 전투력 올리기</b>${tips.map((t) => `<div>· ${esc(t.text)}</div>`).join('')}</div>` : ''}`,
  );
  const s5 = document.getElementById('pSlot5');
  if (s5) s5.onclick = () => toast(slot5Text());
  bindDeck(
    cfg,
    (id) => keepScroll(() => openParty(q, picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])),
    () => openParty(q, picked),
  );
  bindParty(q, picked, list, sel);
}

function bindParty(q: Quest, picked: number[], list: Actor[], sel: Actor[]) {
  const reg = regionById(q.region);
  $$('.pm').forEach(
    (b) =>
      (b.onclick = () => {
        const id = +b.dataset.id!;
        const next = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < partyMax() ? [...picked, id] : picked;
        keepScroll(() => openParty(q, next));
      }),
  );
  const rb = document.getElementById('pRec');
  if (rb)
    rb.onclick = () => {
      const best = recommendParty(list.filter((a) => !canSend(a)), { power: q.power, region: q.region, min: partyMinFor(q), max: partyMax(), tag: q.tag });
      if (!best) return toast(fsay('보낼 수 있는 단골이 없어요', '지금 보내드릴 단골이 없어요'));
      recWhy = { q: q.id, text: best.reasons.join(' · ') || `전투력 ${fmt(best.power)} / 추천 ${fmt(q.power)}`, ids: best.members.map((m) => m.id).sort().join(',') };
      trackEv('party_recommend', { where: 'expedition', action: 'use', n: best.members.length });
      if (vis('heroCards')) deckGlow(best.members.map((m) => m.id));
      keepScroll(() => openParty(q, best.members.map((m) => m.id)));
    };
  $('#pGo').onclick = () => {
    const first = P.counters.expeditions === 0;
    const r = sendParty(q, sel);
    if (typeof r === 'string') return toast(r);
    if (recWhy.q === q.id) trackEv('party_recommend', { where: 'expedition', action: 'go', modified: recWhy.ids !== sel.map((m) => m.id).sort().join(',') });
    departParty(r);
    markDirty();
    closeWin();
    // CHECKIN §E: 원정 처음 보낼 때 「열쇠 한 개 건네기」 (checkinFx)
    if (first) keyFx();
    toast(fsay(`${reg.name}${josa(reg.name, "로")} 출발! (${durText(partyInfo(sel, q).minutes)})`, `${reg.name}${josa(reg.name, "로")} 원정 보내드렸어요 (${durText(partyInfo(sel, q).minutes)})`));
    if (q.tutorial)
      talk([
        ['narr', `${durText(q.minutes)}면 돌아온다. 아래 원정 막대를 누르면 진행 일지를 볼 수 있다.`],
        ['me', '기다리는 동안 오늘의 목표를 해 볼까. 모닥불 짓기, 손님에게 말 걸기, 지붕 색 바꾸기!'],
        ['narr', '오늘의 목표: 메뉴 → 오늘의 목표 · 다 하면 금화를 받아요'],
      ]);
  };
}

// ───────── 원정 진행 일지 ─────────

let logTimer = 0;
/** 원정 중인 파티의 일지: 10~20초마다 한 줄씩 쌓인다 (창을 열어 두면 실시간) */
export function openRunLog(run: Run) {
  if (!run) return;
  if (run.result) {
    closeWin();
    return openReportCard(run);
  }
  const names = run.members.map((id) => homeActors().find((a) => a.id === id)?.name ?? '?').join(' · ');
  const draw = () =>
    runLog(run)
      .map((l) => `<div><small>${Math.floor(l.at / 60)}:${String(Math.floor(l.at % 60)).padStart(2, '0')}</small> ${esc(l.text)}</div>`)
      .join('');
  openWin(
    questName(run.quest),
    `<p class="sub">${esc(names)}</p><div class="pbar" data-start="${run.start}" data-end="${run.end}"><i><b></b></i><em>${leftText(run.end - Date.now())}</em></div>
    <div class="runlog" id="runlog">${draw()}</div>
    <button class="bigbtn ghost" id="rlBack">게시판으로</button>`,
  );
  const box = $('#runlog');
  box.scrollTop = box.scrollHeight;
  $('#rlBack').onclick = () => openBoard();
  let n = box.children.length;
  clearInterval(logTimer);
  logTimer = window.setInterval(() => {
    const el = document.getElementById('runlog');
    if (!el || !document.getElementById('win')!.classList.contains('on')) return clearInterval(logTimer);
    if (run.result) {
      clearInterval(logTimer);
      return openRunLog(run);
    }
    el.innerHTML = draw();
    if (el.children.length !== n) {
      n = el.children.length;
      el.lastElementChild?.classList.add('new');
    }
    el.scrollTop = el.scrollHeight;
  }, 1000);
}

// ───────── 보고서 ─────────

/** 귀환 보고서: 초상화 + 말풍선 대화창으로 사건 3~5줄 → 전리품 창 */
export function showReport(run: Run) {
  const res = run.result;
  if (!res) return;
  // 4단계: 원정 보고서를 읽으면 모험 냄새 — 방랑의 불씨 +
  addEmber(CONFIG.ember.report);
  const reg = regionById(run.quest.region);
  const lines: TalkLine[] = [
    ['narr', `${reg.name} 원정 — ${res.win ? '성공!' : '실패…'}`],
    ...res.report.map(([who, t, name]) => [who, t, undefined, who === 'narr' ? undefined : name] as TalkLine),
  ];
  talk(lines, () => showLoot(run));
}

/**
 * v0.25.4 K6 (resendRun): 게시판·진행 줄에서 「보고서 보기」 = 대화 없이 바로 보고서 카드 (카드에 사건 줄이 그대로 있다)
 *  저절로 뜨는 귀환 보고서(uiHooks.report)는 지금처럼 대화부터 · 끄면 늘 대화부터
 */
export function openReportCard(run: Run) {
  if (!vis('resendRun') || !run.result) return showReport(run);
  addEmber(CONFIG.ember.report);
  showLoot(run);
}

/** 전리품 창 (게시판의 「보고서 보기」에서도) */
/** 초상화 작업: 보고서 맨 위에 다녀온 파티 얼굴 (일러스트 초상화) */
function partyRow(run: Run): string {
  const ms = run.members.map((id) => homeActors().find((a) => a.id === id)).filter(Boolean) as Actor[];
  if (!ms.length) return '';
  return `<div class="repparty">${ms.map((a) => `<span><img src="${portrait(a)}" alt=""><small>${esc(a.name)}</small></span>`).join('')}</div>`;
}

/** 핫픽스 12 §2: 마지막 「추천 편성」 이유 (그 의뢰 창에서만 보여 준다) */
let recWhy = { q: -1, text: '', ids: '' };

/** 핫픽스 12 §6: 파티에 같이 들어간 케미 짝 — ♥ 줄과 배율을 바로 보여 준다 (사냥 준비 창도 씀) */
export function chemLine(sel: Actor[]): string {
  const rows: string[] = [];
  for (let i = 0; i < sel.length; i++)
    for (let j = i + 1; j < sel.length; j++) {
      const bd = bondOf(sel[i], sel[j]);
      const p = bd && pairById(bd.pair);
      if (!bd || !p || !P.dex.chem.includes(p.id)) continue;
      rows.push(`<div class="cpair"><span>${esc(sel[i].name)}</span><i>${'♥'.repeat(bd.lv)}</i><span>${esc(sel[j].name)}</span><small>「${esc(p.name)}」 케미 ×${(1 + bd.lv * CONFIG.chem.partyBonusPerLevel).toFixed(2)}</small></div>`);
    }
  return rows.length ? `<div class="cpairs">${rows.join('')}</div>` : '';
}

/** 핫픽스 12 §3: 5번째 자리 — 처음 열렸을 땐 「열림!」, 아직이면 조건 안내 */
function slot5Banner(): string {
  if (P.meta.slot5) {
    if (P.meta.slot5Seen) return '';
    P.meta.slot5Seen = true;
    markDirty();
    return `<p class="cen good slot5">${fsay('✨ 5번째 자리 열림!', '✨ 원정 5번째 자리가 열렸어요!')}</p>`;
  }
  return `<p class="note">${slot5Text()}</p>`;
}
const slot5Text = () => `폐광 의뢰 3번 성공 또는 폐광 사냥터 1-10 돌파 → 원정 5번째 자리 (지금 폐광 성공 ${Math.min(3, P.counters.regionWins.mine ?? 0)}/3)`;

function showLoot(run: Run) {
  const res = run.result;
  if (!res || run.claimed) return;
  const reg = regionById(run.quest.region);
  const items = res.items.map((it) => `<div class="loot">${itemCell(it)}<span style="color:${GRADE_INFO[it.grade].color}">${GRADE_INFO[it.grade].name} ${esc(it.name)}</span></div>`).join('');
  // CHECKIN §E 체크아웃 영수증 (checkinFx): 금화·경험치·재료·장비를 영수증 한 장에 한 줄씩 (보상은 지금처럼 이미 들어와 있음)
  const rc: RcLine[] = [{ k: '금화', v: `+${fmt(res.gold)}` }, { k: '경험치', v: `+${fmt(res.xp)}` }, { k: reg.mat, v: `+${res.mats}` }, ...res.items.map(itemLine)];
  const rew = fxOn() ? receiptHtml(rc) : `<div class="rew">금화 <b class="g">+${fmt(res.gold)}</b> · 경험치 +${res.xp} · ${reg.mat} +${res.mats}</div>
    ${items}`;
  openWin(
    fsay(`원정 보고서 · ${reg.name}`, `다녀오셨어요 · ${reg.name}`),
    `${partyRow(run)}<div class="rep ${res.win ? 'ok' : 'ng'}"><b>${res.win ? '성공!' : '실패…'}</b>${res.report.map(([, t]) => `<p>${esc(t)}</p>`).join('')}</div>
    ${rew}
    ${run.quest.tutorial ? '' : upgradeBtn(res.items, run.members.map((id) => homeActors().find((a) => a.id === id)).filter(Boolean) as Actor[])}
    ${res.levelUps.length ? `<p class="sub">레벨업! ${res.levelUps.map(esc).join(', ')}</p>` : ''}
    ${res.newChem.length ? `<p class="sub heart">새 케미 발견! ${res.newChem.map(esc).join(', ')}</p>` : ''}
    ${res.chemUps?.length ? `<p class="sub heart">${res.chemUps.map(esc).join(' · ')}</p>` : ''}
    ${resendHtml(run, vis('firstFlowFix') ? '확인' : '받기')}`,
  );
  bindResend(run);
  dropFanfare(res.items);
  playReceipt(document.getElementById('winB') ?? document);
  // §J3 레벨업 배너 (uiCards)
  if (res.levelUps.length) bannerFx(res.levelUps.length > 1 ? `${res.levelUps[0]} 외 ${res.levelUps.length - 1}명` : res.levelUps[0]);
  $('#repOk').onclick = () => {
    claimRun(run);
    closeWin();
    checkSlot5();
    if (run.quest.tutorial) guideEquip(run);
  };
}

// ───────── v0.25.4 K6 [다시 보내기] (resendRun) ─────────
/** 보고서 아래 버튼 줄: 끄면 [받기] 하나 그대로 · 켜면 [받기] [다시 보내기] (못 보내면 회색 + 이유 한 줄) */
function resendHtml(run: Run, ok: string): string {
  if (!vis('resendRun') || run.quest.tutorial) return `<button class="bigbtn" id="repOk">${ok}</button>`;
  const p = resendPlan(run);
  const label = 'why' in p ? '다시 보내기' : p.same ? '다시 보내기' : `다시 보내기 · ${regionById(p.q.region).name} ${TIER[p.q.tier]}`;
  return `<div class="btnrow resend"><button class="bigbtn ghost" id="repOk">${ok}</button><button class="bigbtn" id="repAgain" ${'why' in p ? 'disabled' : ''}>${esc(label)}</button></div>${
    'why' in p ? `<p class="note">다시 보내기: ${esc(p.why)}</p>` : `<p class="note">같은 파티로 · ${esc(questName(p.q))} · 추천 전투력 ${fmt(p.q.power)}</p>`
  }`;
}
function bindResend(run: Run) {
  const b = document.getElementById('repAgain');
  if (!b) return;
  b.onclick = () => {
    const p = resendPlan(run);
    if ('why' in p) return toast(p.why);
    claimRun(run);
    checkSlot5();
    const r = sendParty(p.q, p.members);
    if (typeof r === 'string') return toast(r);
    trackEv('run_resend', { same: p.same, tier: p.q.tier });
    departParty(r);
    markDirty();
    closeWin();
    const reg = regionById(p.q.region);
    toast(fsay(`${reg.name}${josa(reg.name, '로')} 다시 출발! (${durText(partyInfo(p.members, p.q).minutes)})`, `${reg.name}${josa(reg.name, '로')} 다시 보내드렸어요 (${durText(partyInfo(p.members, p.q).minutes)})`));
  };
}

/** 첫 원정 뒤: 받은 희귀 장비를 바로 끼워 전투력이 오르는 걸 보여 준다 */
function guideEquip(run: Run) {
  const it = run.result?.items.find((x) => x.owner == null && P.bag.includes(x));
  const a = run.members.map((id) => homeActors().find((x) => x.id === id)).find(Boolean);
  if (!it || !a) return;
  talk(
    [
      ['narr', `희귀 장비 「${it.name}」${josa(it.name, '를')} 얻었다!`],
      ['me', `${a.name}에게 끼워 주면 더 강해지겠지?`],
    ],
    undefined,
    [
      {
        label: `${a.name}에게 장착하기`,
        fn: () => {
          const before = powerOf(a);
          const cur = P.bag.find((x) => x.id === a.equip[it.slot]);
          if (!cur || itemPower(it) > itemPower(cur)) equip(a, it);
          const after = powerOf(a);
          markDirty();
          floatW(a.x, a.y, 40, `전투력 +${fmt(after - before)}!`, 'big');
          uiHooks.talk([
            ['narr', `${a.name}의 전투력 ${fmt(before)} → ${fmt(after)} (+${fmt(after - before)})`],
            ['narr', '장비는 원정에서 계속 얻어요. 손님 창의 장비 칸을 눌러 바꿀 수 있어요.'],
          ]);
        },
      },
      { label: '나중에', fn: () => toast(fsay('손님 창의 장비 칸에서 언제든 끼울 수 있어요', '손님 창 장비 칸에서 언제든 끼워 드릴게요')) },
    ],
  );
}

/** 받은 원정은 목록에서 정리 */
function claimRun(run: Run) {
  run.claimed = true;
  P.runs = P.runs.filter((r) => !r.claimed);
  markDirty();
}

// ───────── 방치 요약 ─────────

export function showOffline(s: OfflineSummary) {
  // 끝난 원정의 파티는 이미 마을에 돌아와 있다
  for (const r of s.runs) returnParty(r, false);
  // v0.25.4 CHECKIN §C3: 「다녀오셨어요」 카드 (끄면 아래 예전 창)
  if (vis('welcomeBack')) return showWelcome(s);
  const h = Math.floor(s.seconds / 3600);
  const m = Math.floor((s.seconds % 3600) / 60);
  // ECONOMY §1: 8시간 상한에 닿으면 「창고가 가득」 (들어오고 싶게)
  const over = s.away > s.seconds + 1 ? ` <small>(최대 ${CONFIG.offline.maxRealHours}시간까지만 쌓여요)</small><br><b class="warn">창고가 가득 찼어요 · 사냥 보상 일부를 놓쳤어요</b>` : '';
  const wins = s.runs.filter((r) => r.result!.win).length;
  const runGold = s.runs.reduce((t, r) => t + r.result!.gold, 0);
  const items = (Object.entries(s.items) as [Grade, number][])
    .sort((p, q) => GRADES.indexOf(q[0]) - GRADES.indexOf(p[0]))
    .map(([g, n]) => `<b style="color:${GRADE_INFO[g].color}">${GRADE_INFO[g].name} ${n}</b>`)
    .join(' · ');
  openWin(
    fsay('그동안 마을에서는…', '다녀오셨어요'),
    `<p class="sub">${h ? `${h}시간 ` : ''}${m}분 동안${over}</p>
    <div class="offl">
      <div>· ${fsay(`손님 ${s.guests}명이 묵고 갔어요`, `손님 ${s.guests}분이 묵고 가셨어요`)} — 금화 <b class="g">+${fmt(s.gold)}</b>${s.capped ? ' <small>(다음 목표 비용의 80%까지)</small>' : ''}</div>
      ${s.runs.length ? `<div>· 원정 ${s.runs.length}개 끝남 (성공 ${wins}) — 금화 +${fmt(runGold)} <small>(이미 금고에)</small></div>` : ''}
      ${items ? `<div>· 얻은 장비: ${items}</div>` : ''}
      ${s.levelUps.length ? `<div>· 레벨업: ${s.levelUps.map(esc).join(', ')}</div>` : ''}
      ${s.newChem.length ? `<div class="heart">· 새 케미: ${s.newChem.map(esc).join(', ')}</div>` : ''}
      ${s.harvested ? `<div>· 텃밭에서 채소 ${s.harvested}개를 거둬 뒀어요</div>` : ''}
      ${s.hunt ? `<div>· 방치 사냥 ${esc(s.hunt.label)} ${s.hunt.clears}판 — 금화 +${fmt(s.hunt.gold)} · 경험치 +${fmt(s.hunt.xp)} · 재료 +${s.hunt.mats}${Object.keys(s.hunt.items).length ? ` · 장비 ${Object.values(s.hunt.items).reduce((a, b) => a + (b ?? 0), 0)}개` : ''} <small>(이미 금고에)</small></div>` : ''}
    </div>
    <button class="bigbtn" id="offOk">모두 받기</button>`,
  );
  $('#offOk').onclick = () => {
    S.gold += s.gold;
    for (const r of s.runs) r.claimed = true;
    P.runs = P.runs.filter((r) => !r.claimed);
    markDirty();
    closeWin();
    toast(fsay(`금화 +${fmt(s.gold)}`, `금화 +${fmt(s.gold)} 금고에 넣어 드렸어요`));
  };
}

/** 원정 버튼 알림점: 결과가 기다리는 원정이 있으면 */
export const runsWaiting = () => P.runs.some((r) => r.result && !r.claimed);
