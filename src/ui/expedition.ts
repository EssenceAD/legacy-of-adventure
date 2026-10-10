// 원정 창: 의뢰 게시판(목록·진행 중 파티·천장) → 파티 고르기(전투력·성공률·전투력 올리기 안내) → 보고서 · 방치 요약
import { CONFIG } from '../data/config';
import { josa } from '../data/josa';
import { GRADE_INFO, GRADES, REGIONS, regionById, type Grade } from '../data/items';
import { talk } from './dialogue';
import { powerOf } from '../world/adventurers';
import { departParty, returnParty } from '../world/actors';
import {
  activeRuns, boardLevel, canSend, ensureQuests, maxParties, partyInfo, powerTips, refreshQuests, regionUnlocked, sendParty,
} from '../world/expeditions';
import { dropChances, pityLimit } from '../world/items';
import type { OfflineSummary } from '../world/offline';
import { markDirty, P, S, world, type Quest, type Run, type TalkLine } from '../world/state';
import { $, $$, esc, fmt, itemCell, leftText, minText, nameTag, pct, pic } from './common';
import { closeWin, openWin, toast } from './windows';

const E = CONFIG.expedition;
const TIER = ['짧은', '보통', '긴', '아주 긴'];
const homeActors = () => world.home?.actors ?? world.actors;

/** 원정 갈 수 있는 손님 (단골·영웅) */
const crew = () => homeActors().filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero') && !a.leaving);

function runRow(r: Run) {
  const reg = regionById(r.quest.region);
  const names = r.members.map((id) => homeActors().find((a) => a.id === id)?.name ?? '?').join(' · ');
  if (r.result)
    return `<button class="run done" data-run="${r.id}"><b>${reg.name} ${r.result.win ? '성공!' : '실패…'}</b><small>${esc(names)}</small><em>보고서 보기</em></button>`;
  return `<div class="run"><b>${reg.name} · ${TIER[r.quest.tier]} 의뢰</b><small>${esc(names)}</small><div class="pbar" data-start="${r.start}" data-end="${r.end}"><i><b></b></i><em>${leftText(r.end - Date.now())}</em></div></div>`;
}

function questRow(q: Quest) {
  const reg = regionById(q.region);
  const dc = dropChances(q.region, q.tier);
  return `<button class="quest" data-q="${q.id}" style="--rc:${reg.color}"><span class="qreg">${reg.name}</span><span class="qmain"><b>${TIER[q.tier]} 의뢰 · ${minText(q.minutes)}</b><small>추천 전투력 ${fmt(q.power)} · 금화 ${fmt(q.gold[0])}~${fmt(q.gold[1])}</small><small class="drop">희귀 ${pct(Math.min(1, dc.r), 0)} · 영웅 ${pct(Math.min(1, dc.e), 1)} · 전설 ${pct(Math.min(1, dc.l), 1)}</small></span><em>›</em></button>`;
}

/** 의뢰 게시판 */
export function openBoard() {
  if (S.visiting) return toast('이웃 마을에선 원정을 못 보내요');
  ensureQuests();
  const runs = P.runs.filter((r) => !r.claimed);
  const free = E.freeRefreshPerDay - P.quests.refreshUsed;
  const pity = REGIONS.filter((_, i) => regionUnlocked(i))
    .map((r) => `<span style="color:${r.color}">${r.name}</span> 전설까지 <b>${pityLimit() - P.pity[r.id]}</b>`)
    .join(' · ');
  const locked = REGIONS.map((r, i) => (regionUnlocked(i) ? '' : `<div class="qlock">🔒 ${r.name} — ${REGIONS[i - 1].name} 3번 성공 또는 평판 ★${i + 1}</div>`)).join('');
  openWin(
    '원정 · 의뢰 게시판',
    `<p class="sub">파티 ${activeRuns().length}/${maxParties()} ${boardLevel() ? `(게시판 Lv.${boardLevel()})` : '· 게시판을 지으면 더 보낼 수 있어요'}</p>
    ${runs.length ? `<div class="runs">${runs.map(runRow).join('')}</div>` : ''}
    <div class="qhd"><b class="g">오늘의 의뢰</b><button id="qRef" ${free > 0 ? '' : 'disabled'}>새로고침 ${free > 0 ? '(무료)' : '(내일)'}</button></div>
    <div class="quests">${P.quests.list.map(questRow).join('') || '<p class="note">오늘 의뢰를 다 받았어요 · 내일 아침 새로 붙어요</p>'}</div>
    ${locked}<p class="note pity">${pity}</p>`,
  );
  $$('.quest').forEach((b) => (b.onclick = () => openParty(P.quests.list.find((q) => q.id === +b.dataset.q!)!)));
  $$('.run.done').forEach(
    (b) =>
      (b.onclick = () => {
        closeWin();
        showReport(P.runs.find((r) => r.id === +b.dataset.run!)!);
      }),
  );
  $('#qRef').onclick = () => {
    if (refreshQuests()) {
      markDirty();
      openBoard();
    }
  };
}

// ───────── 파티 고르기 ─────────

function openParty(q: Quest, picked: number[] = []) {
  const reg = regionById(q.region);
  const list = crew().sort((a, b) => powerOf(b) - powerOf(a));
  const sel = list.filter((a) => picked.includes(a.id));
  const info = sel.length ? partyInfo(sel, q) : null;
  const short = info && info.power < q.power;
  const tips = short ? powerTips(sel) : [];
  const rows = list
    .map((a) => {
      const why = canSend(a);
      const on = picked.includes(a.id);
      return `<button class="pm ${on ? 'on' : ''}" data-id="${a.id}" ${why && !on ? 'disabled' : ''}><img src="${pic(a)}" alt=""><span>${nameTag(a)} Lv.${a.lvl}<small>${why ?? `체력 ${Math.round(a.hp)}`}</small></span><em>${fmt(powerOf(a))}</em></button>`;
    })
    .join('');
  openWin(
    `${reg.name} · ${TIER[q.tier]} 의뢰`,
    `<p class="sub">파티 ${E.partyMin}~${E.partyMax}명 · 추천 전투력 <b class="g">${fmt(q.power)}</b> · ${minText(q.minutes)}</p>
    <div class="plist">${rows || '<p class="note">단골이 없어요 · 손님이 단골이 되면 보낼 수 있어요</p>'}</div>
    <div class="psum">${
      info
        ? `파티 전투력 <b class="${short ? 'bad' : 'good'}">${fmt(info.power)}</b> / ${fmt(q.power)}${info.chem > 1 ? ` · 케미 ×${info.chem.toFixed(2)}` : ''}<br>성공률 <b>${pct(info.success)}</b> · 걸리는 시간 ${minText(info.minutes)}`
        : '함께 갈 손님을 골라요'
    }</div>
    ${tips.length ? `<div class="tips"><b>▲ 전투력 올리기</b>${tips.map((t) => `<div>· ${esc(t.text)}</div>`).join('')}</div>` : ''}
    <button class="bigbtn" id="pGo" ${sel.length >= E.partyMin ? '' : 'disabled'}>출발!</button>`,
  );
  $$('.pm').forEach(
    (b) =>
      (b.onclick = () => {
        const id = +b.dataset.id!;
        const next = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < E.partyMax ? [...picked, id] : picked;
        openParty(q, next);
      }),
  );
  $('#pGo').onclick = () => {
    const r = sendParty(q, sel);
    if (typeof r === 'string') return toast(r);
    departParty(r);
    markDirty();
    closeWin();
    toast(`${reg.name}${josa(reg.name, "로")} 출발! (${minText(partyInfo(sel, q).minutes)})`);
  };
}

// ───────── 보고서 ─────────

/** 귀환 보고서: 초상화 + 말풍선 대화창으로 사건 3~5줄 → 전리품 창 */
export function showReport(run: Run) {
  const res = run.result;
  if (!res) return;
  const reg = regionById(run.quest.region);
  const lines: TalkLine[] = [
    ['narr', `${reg.name} 원정 — ${res.win ? '성공!' : '실패…'}`],
    ...res.report.map(([who, t, name]) => [who, t, undefined, who === 'narr' ? undefined : name] as TalkLine),
  ];
  talk(lines, () => showLoot(run));
}

/** 전리품 창 (게시판의 「보고서 보기」에서도) */
function showLoot(run: Run) {
  const res = run.result;
  if (!res || run.claimed) return;
  const reg = regionById(run.quest.region);
  const items = res.items.map((it) => `<div class="loot">${itemCell(it)}<span style="color:${GRADE_INFO[it.grade].color}">${GRADE_INFO[it.grade].name} ${esc(it.name)}</span></div>`).join('');
  openWin(
    `원정 보고서 · ${reg.name}`,
    `<div class="rep ${res.win ? 'ok' : 'ng'}"><b>${res.win ? '성공!' : '실패…'}</b>${res.report.map(([, t]) => `<p>${esc(t)}</p>`).join('')}</div>
    <div class="rew">금화 <b class="g">+${fmt(res.gold)}</b> · 경험치 +${res.xp} · ${reg.mat} +${res.mats}</div>
    ${items}
    ${res.levelUps.length ? `<p class="sub">레벨업! ${res.levelUps.map(esc).join(', ')}</p>` : ''}
    ${res.newChem.length ? `<p class="sub heart">새 케미 발견! ${res.newChem.map(esc).join(', ')}</p>` : ''}
    <button class="bigbtn" id="repOk">받기</button>`,
  );
  $('#repOk').onclick = () => {
    claimRun(run);
    closeWin();
  };
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
  const h = Math.floor(s.seconds / 3600);
  const m = Math.floor((s.seconds % 3600) / 60);
  const over = s.away > s.seconds + 1 ? ` <small>(최대 ${CONFIG.offline.maxRealHours}시간까지만 쌓여요)</small>` : '';
  const wins = s.runs.filter((r) => r.result!.win).length;
  const runGold = s.runs.reduce((t, r) => t + r.result!.gold, 0);
  const items = (Object.entries(s.items) as [Grade, number][])
    .sort((p, q) => GRADES.indexOf(q[0]) - GRADES.indexOf(p[0]))
    .map(([g, n]) => `<b style="color:${GRADE_INFO[g].color}">${GRADE_INFO[g].name} ${n}</b>`)
    .join(' · ');
  openWin(
    '그동안 마을에서는…',
    `<p class="sub">${h ? `${h}시간 ` : ''}${m}분 동안${over}</p>
    <div class="offl">
      <div>· 손님 ${s.guests}명이 묵고 갔어요 — 금화 <b class="g">+${fmt(s.gold)}</b>${s.capped ? ' <small>(다음 목표 비용의 80%까지)</small>' : ''}</div>
      ${s.runs.length ? `<div>· 원정 ${s.runs.length}개 끝남 (성공 ${wins}) — 금화 +${fmt(runGold)} <small>(이미 금고에)</small></div>` : ''}
      ${items ? `<div>· 얻은 장비: ${items}</div>` : ''}
      ${s.levelUps.length ? `<div>· 레벨업: ${s.levelUps.map(esc).join(', ')}</div>` : ''}
      ${s.newChem.length ? `<div class="heart">· 새 케미: ${s.newChem.map(esc).join(', ')}</div>` : ''}
      ${s.harvested ? `<div>· 텃밭에서 채소 ${s.harvested}개를 거둬 뒀어요</div>` : ''}
    </div>
    <button class="bigbtn" id="offOk">모두 받기</button>`,
  );
  $('#offOk').onclick = () => {
    S.gold += s.gold;
    for (const r of s.runs) r.claimed = true;
    P.runs = P.runs.filter((r) => !r.claimed);
    markDirty();
    closeWin();
    toast(`금화 +${fmt(s.gold)}`);
  };
}

/** 원정 버튼 알림점: 결과가 기다리는 원정이 있으면 */
export const runsWaiting = () => P.runs.some((r) => r.result && !r.claimed);
