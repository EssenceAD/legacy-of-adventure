// RAIDWEAPON §3' 「하늘 균열」 화면 (플래그 worldRaid · 실험실 vis) — 마을 하늘 보라 금 · 오른쪽 위 「🌌 하늘 균열」 알약 · 균열 창 · 60초 전투 · 결과 · 랭킹 탭 · 보상 편지
//  서버 SQL(supabase/world_raid.sql)이 없으면: 함수 없음 → 알약·금이 안 보이고 랭킹 탭은 「준비 중」 (오류 토스트 없음)
//  토벌 게시판에는 넣지 않는다 (§3' 「토벌과 다르게」)
import './rift.css';
import { CONFIG } from '../data/config';
import { PORTRAITS } from '../engine/assets';
import { closeCombat, devAdvance, devField, showCombatResult, startCombat, type CombatResult } from '../combat/ui';
import { prepRiftSheet, riftLook } from '../combat/riftLook';
import { sheets } from '../combat/draw';
import { me, onAuthChange, online } from '../net/server';
import { amAdmin } from '../net/direction';
import { riftServer, worldClaim, worldCurrent, worldHit, worldRank, worldRoll, type RiftBoss, type RiftMe, type RiftRankRow } from '../net/worldRaid';
import { powerOf } from '../world/adventurers';
import { addMail } from '../world/meta';
import { huntPartyMax } from '../world/party4';
import { raidCrew } from '../world/raid';
import {
  bossTitle, clampDmg, endReason, localHp, runCap, mailRewards, noticeLines, pillVisible, resultLine, riftActive, riftLock, riftOn, startLock, timeLeftText, triesLeft, villageFrac, villagePct, W,
} from '../world/rift';
import { S, type Actor } from '../world/state';
import { esc, fmt, portrait } from './common';
import { lockAttr, lockNote } from './lockBtn';
import { closeWin, isWinOpen, openWin, toast } from './windows';
import { isTalking } from './dialogue';

// ───────── 상태 ─────────

/** 지금 보스 (서버에서 받은 것 · 없으면 null) · 서버 시각 − 기기 시각 */
export const rift = { boss: null as RiftBoss | null, skew: 0, rolled: false, claimedFor: '', lastPoll: 0, busy: false };
const nowS = () => Date.now() + rift.skew;

const TEST_KEY = 'legacy-of-adventure-riftTest';
const PEND_KEY = 'legacy-of-adventure-riftPending';
const SEEN_KEY = 'legacy-of-adventure-riftSeen';
const NOTE_KEY = 'legacy-of-adventure-riftNotes';
const ls = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* 저장소 없음 */
    }
  },
};

/** 시험 보스 모드: 운영자 계정(또는 개발·봇 빌드) + 이 기기 localStorage riftTest = 'true' */
export const riftTestMode = () => ls.get(TEST_KEY) === 'true' && (amAdmin() || !!import.meta.env.DEV);

/** 시작했지만 아직 서버에 못 올린 판 (앱이 꺼지거나 네트워크가 끊겨도 도전 한 번은 센다 · 다음에 켜면 올림) */
interface Pending { boss: number; dmg: number; power: number; at: number }
export function pending(): Pending | null {
  try {
    const p = JSON.parse(ls.get(PEND_KEY) ?? 'null') as Pending | null;
    return p && typeof p.boss === 'number' ? p : null;
  } catch {
    return null;
  }
}
const setPending = (p: Pending | null) => ls.set(PEND_KEY, p ? JSON.stringify(p) : null);
const pendSame = (b: RiftBoss | null) => (b && pending()?.boss === b.id ? 1 : 0);

// ───────── 서버와 맞추기 ─────────

/** 보스 받아 오기 + 체력 단계 알림(토스트) */
export async function refreshRift(): Promise<RiftBoss | null> {
  rift.lastPoll = Date.now();
  const b = await worldCurrent(riftTestMode());
  setBoss(b);
  return b;
}
export function setBoss(b: RiftBoss | null) {
  const prev = rift.boss;
  if (b) rift.skew = b.now - Date.now();
  rift.boss = b;
  if (b && prev && prev.id === b.id) noteChange(b, prev.hpLeft);
  else if (b) noteChange(b, null);
  syncRift();
}
/** 50% · 25% · 처치 — 이 기기에서 단계마다 한 번 토스트 ([알림] 줄은 서버가 모두에게) · 처음 본 보스는 이미 지난 단계를 조용히 넘김 */
function noteChange(b: RiftBoss, before: number | null) {
  if (b.test) return;
  let seen: string[] = [];
  try {
    seen = JSON.parse(ls.get(NOTE_KEY) ?? '[]') as string[];
  } catch {
    /* 망가짐 */
  }
  const lines = noticeLines(b.name, before ?? b.hpMax, b.hpLeft, b.hpMax, b.killerInn).filter((l) => !seen.includes(`${b.id}:${l.t}`));
  if (!lines.length) return;
  if (before != null) for (const l of lines) toast(l.text);
  ls.set(NOTE_KEY, JSON.stringify([...seen, ...lines.map((l) => `${b.id}:${l.t}`)].slice(-30)));
}

/** 못 올린 판 올리기 (세션 첫 확인 때) */
async function flushPending() {
  const p = pending();
  if (!p) return;
  const r = await worldHit(p.boss, p.dmg, p.power);
  if (r.ok || (!r.ok && r.why !== 'net' && r.why !== 'missing')) setPending(null);
  if (r.ok && rift.boss?.id === r.boss.id) setBoss(r.boss);
}

/** 보상 받기 (로그인마다 한 번) → 우편함 편지 */
export async function claimRift(): Promise<number> {
  const uid = me.profile?.id ?? '';
  if (!uid || rift.claimedFor === uid || !riftOn()) return 0;
  rift.claimedFor = uid;
  const list = await worldClaim();
  const n = mailRewards(list, addMail);
  if (n) toast(`🌌 하늘 균열 보상 ${n}통이 우편함에 도착했어요`);
  return n;
}

/** 세션 첫 접속: 정산 + 다음 보스(pg_cron 이 없을 때) → 지금 보스 → 못 올린 판 → 보상 */
export async function riftSession() {
  if (rift.rolled || !online() || !riftOn()) return;
  rift.rolled = true;
  await worldRoll();
  await refreshRift();
  if (riftServer.missing) return;
  await flushPending();
  await claimRift();
}

// ───────── 마을: 하늘 금 · 알약 ─────────

let pill: HTMLButtonElement | null = null;
let crack: HTMLDivElement | null = null;

const CRACK_SVG = `<svg viewBox="0 0 120 40" shape-rendering="crispEdges" aria-hidden="true"><polyline points="2,22 18,18 26,24 40,12 52,20 61,8 70,19 82,14 90,26 103,17 118,21" fill="none" stroke="#d9b8ff" stroke-width="2"/><polyline points="40,12 44,4 M70,19 74,30 M90,26 88,36" fill="none" stroke="#a46bff" stroke-width="1"/><polyline points="61,8 63,2" fill="none" stroke="#a46bff" stroke-width="1"/></svg>`;

export function syncRift() {
  if (!pill || !crack) return;
  const b = rift.boss;
  const on = pillVisible(b, nowS(), !!S.visiting) && !!S.started && online() && !isTalking();
  pill.hidden = !on;
  crack.hidden = !on;
  if (!on || !b) return;
  const left = triesLeft(b, pendSame(b));
  pill.innerHTML = `<b>🌌 하늘 균열${b.test ? ' · 시험' : ''}</b><small>${b.killed ? '처치!' : `${villagePct(b)} · ${left}/${b.triesMax}`}</small>`;
  pill.classList.toggle('done', b.killed || left <= 0);
  // 새 균열을 처음 본 순간: 1프레임 번쩍 (보스마다 한 번 · 동작 줄이기면 없음)
  if (ls.get(SEEN_KEY) !== String(b.id)) {
    ls.set(SEEN_KEY, String(b.id));
    if (!reduceMotion()) {
      crack.classList.add('flash');
      requestAnimationFrame(() => requestAnimationFrame(() => crack?.classList.remove('flash')));
    }
  }
}
const reduceMotion = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export function initRift() {
  pill = document.createElement('button');
  pill.id = 'riftPill';
  pill.className = 'px';
  pill.hidden = true;
  pill.setAttribute('aria-label', '하늘 균열');
  pill.onclick = (e) => {
    e.stopPropagation();
    void openRift();
  };
  document.getElementById('hud')?.appendChild(pill);
  crack = document.createElement('div');
  crack.id = 'riftCrack';
  crack.hidden = true;
  crack.innerHTML = CRACK_SVG;
  const over = document.getElementById('over');
  if (over?.parentElement) over.parentElement.insertBefore(crack, over);
  else document.getElementById('view')?.appendChild(crack);
  onAuthChange(() => {
    if (!online()) {
      rift.boss = null;
      syncRift();
      return;
    }
    rift.rolled = false;
    void riftSession();
  });
  setInterval(() => {
    if (document.hidden) return;
    if (!riftOn() || !online() || riftServer.missing) {
      if (rift.boss) setBoss(null);
      else syncRift();
      return;
    }
    if (!rift.rolled) return void riftSession();
    if (!rift.busy && Date.now() - rift.lastPoll > W().pollMs) void refreshRift();
    syncRift();
  }, 1000);
  if (import.meta.env.DEV) Object.assign(window, { __rift: { state: rift, open: openRift, refresh: refreshRift, set: setBoss, sync: syncRift, advance: devAdvance, field: devField, rankHtml: riftRankHtml, session: riftSession } });
}

// ───────── 균열 창 ─────────

/** 갈 파티: 토벌에 갈 수 있는 사람 중 전투력 높은 순 (토벌 파티 칸 수만큼) */
export function riftCrew(): Actor[] {
  return raidCrew()
    .sort((a, b) => powerOf(b) - powerOf(a))
    .slice(0, huntPartyMax());
}
const powerSum = (ms: Actor[]) => Math.round(ms.reduce((s, m) => s + powerOf(m), 0));

async function bossFace(look: string): Promise<string> {
  if (!(await prepRiftSheet(look))) return '';
  const sh = sheets[riftLook(look).id];
  return sh?.frames.idle?.[0]?.r.toDataURL() ?? '';
}

export async function openRift() {
  const lock = riftLock();
  if (lock) return toast(lock);
  if (!online()) return toast('하늘 균열은 로그인하면 들어갈 수 있어요 (메뉴 → 계정)');
  const b = rift.boss;
  if (!riftActive(b, nowS())) return toast(riftServer.missing ? '하늘 균열은 준비 중이에요' : '지금은 열린 균열이 없어요 · 매일 05:00에 새 균열이 열려요');
  const crew = riftCrew();
  const why = startLock(b, nowS(), pendSame(b), crew.length);
  const left = triesLeft(b, pendSame(b));
  const frac = villageFrac(b);
  openWin(
    '하늘 균열',
    `<div class="rfwin">
      <div class="rfhead"><img id="rfFace" alt=""><span><b>${esc(bossTitle(b))}</b><small>남은 시간 ${timeLeftText(b, nowS())} · 참여 ${fmt(b.players)}명</small></span></div>
      <div class="rfbar"><i><u style="width:${Math.round((1 - frac) * 100)}%"></u></i><small>마을 전체 ${villagePct(b)} 깎음 · 남은 체력 ${fmt(b.hpLeft)}</small></div>
      ${b.killed ? `<p class="cen good">🌌 ${b.killerInn ? `${esc(b.killerInn)}의 마지막 일격!` : '쓰러뜨렸어요!'} · 05:00에 새 균열이 열려요</p>` : ''}
      <p class="cen">오늘 내 피해 <b class="g">${fmt(b.myTotal)}</b> · 오늘 순위 <b>${b.myRank ? `${b.myRank}위` : '—'}</b></p>
      <div class="rfparty">${crew.map((a) => `<span><img src="${portrait(a)}" alt=""><small>${esc(a.name)}</small></span>`).join('') || '<p class="note">갈 수 있는 단골이 없어요</p>'}</div>
      <p class="note">파티 전투력 ${fmt(powerSum(crew))} · 토벌에 갈 수 있는 사람 중 센 순서로 ${huntPartyMax()}명</p>
      <p class="note">한 판 ${W().seconds}초 · 이기고 지는 것 없이 넣은 피해만 · 파티가 쓰러지면 그때까지 · 하루 ${b.triesMax}번 (토벌 도전과 따로) · 보상은 05:00 정산 뒤 우편함</p>
      <div class="go"><button class="a" id="rfGo" ${lockAttr(why)}>도전 (${left}/${b.triesMax})</button><button class="b" id="rfRank">순위 보기</button></div>${lockNote(why)}
    </div>`,
  );
  void bossFace(b.look).then((src) => {
    const im = document.getElementById('rfFace') as HTMLImageElement | null;
    if (im && src) im.src = src;
  });
  document.getElementById('rfGo')!.onclick = () => void startRift(crew);
  document.getElementById('rfRank')!.onclick = () => void openRiftRank();
}

async function openRiftRank() {
  // 창을 먼저 연다 (모듈을 기다리는 사이 서재 쪽지 같은 이야기 대사가 끼어들지 않게 · 같은 제목이라 openRank 가 그대로 다시 그림)
  openWin('랭킹', '<p class="note">불러오는 중…</p>');
  const m = await import('./rank');
  void m.openRank(m.riftTabIndex());
}

// ───────── 전투 ─────────

let overlay: { el: HTMLElement; raf: number } | null = null;

export async function startRift(members: Actor[]) {
  const b = rift.boss;
  const why = startLock(b, nowS(), pendSame(b), members.length);
  if (why || !b) return toast(why ?? '지금은 열린 균열이 없어요');
  if (rift.busy) return;
  rift.busy = true;
  const power = powerSum(members);
  // 도전 한 번은 시작할 때 센다 (중간에 앱이 꺼지면 다음에 0으로 올림)
  setPending({ boss: b.id, dmg: 0, power, at: Date.now() });
  closeWin();
  await prepRiftSheet(b.look);
  const look = riftLook(b.look);
  try {
    await startCombat(
      'deep',
      10,
      members,
      false,
      (res) => void endRift(b, power, res),
      { mode: 'raid', raid: { look, hp: localHp(b, power), seconds: W().seconds, power: Math.max(1, power * W().bossRec) }, music: 'world_raid', noFold: true, world: true },
    );
    mountOverlay(b, runCap(b, power));
  } catch {
    setPending(null);
    rift.busy = false;
    toast('하늘 균열을 열지 못했어요 · 도전 횟수는 그대로예요');
  }
}

/** 전투 위 HUD: 위쪽 큰 공용 체력 막대(마을 전체 %) · 가운데 60초 · 「내 피해」 큰 숫자 (한 판 상한에 닿으면 「상한」) */
function mountOverlay(b: RiftBoss, cap: number) {
  const root = document.getElementById('raid');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'rfhud';
  el.innerHTML = `<div class="rftop"><b>${esc(bossTitle(b))}</b><i><u id="rfHp"></u></i><small id="rfPct"></small></div><div class="rftime" id="rfTime"></div><div class="rfmine"><small>내 피해</small><b id="rfMine">0</b><em>한 판 상한!</em></div>`;
  root.appendChild(el);
  const draw = () => {
    const f = devField();
    if (!f || !el.isConnected) return stopOverlay();
    const raw = Math.round(f.raidDmg);
    const mine = Math.min(raw, cap);
    const left = Math.max(0, b.hpLeft - mine);
    const est = { hpMax: b.hpMax, hpLeft: left };
    (el.querySelector('#rfHp') as HTMLElement).style.width = `${Math.round((left / Math.max(1, b.hpMax)) * 1000) / 10}%`;
    el.querySelector('#rfPct')!.textContent = `마을 전체 ${villagePct(est)}`;
    el.querySelector('#rfTime')!.textContent = String(Math.max(0, Math.ceil(f.time)));
    el.querySelector('#rfTime')!.classList.toggle('low', f.time < 10);
    el.querySelector('#rfMine')!.textContent = fmt(mine);
    el.querySelector('.rfmine')!.classList.toggle('cap', raw >= cap);
    overlay!.raf = requestAnimationFrame(draw);
  };
  overlay = { el, raf: requestAnimationFrame(draw) };
}
function stopOverlay() {
  if (overlay) cancelAnimationFrame(overlay.raf);
  overlay = null;
}

const END_TEXT = { time: `${CONFIG.raidWeapon.world.seconds}초 끝!`, wipe: '파티가 쓰러졌어요', quit: '그만두었어요', kill: '마지막 일격!' } as const;

async function endRift(b: RiftBoss, power: number, res: CombatResult) {
  stopOverlay();
  const why = endReason(res);
  const dmg = clampDmg(res.raidDmg, power, b.hpMax, b.test);
  setPending({ boss: b.id, dmg, power, at: Date.now() });
  showCombatResult(`<h2>🌌 ${esc(END_TEXT[why])}</h2><div class="big">${fmt(dmg)}</div><p class="cen">올리는 중…</p>`, () => {});
  const r = await worldHit(b.id, dmg, power);
  rift.busy = false;
  let line: string;
  let extra = '';
  if (r.ok) {
    setPending(null);
    setBoss(r.boss);
    line = resultLine(r.dmg, r.boss.myRank, r.boss);
    if (r.killedNow) extra = `<p class="cen good">🌌 우리 여관의 마지막 일격!</p>`;
  } else if (r.why === 'net' || r.why === 'missing') {
    line = resultLine(dmg, b.myRank, { hpMax: b.hpMax, hpLeft: Math.max(0, b.hpLeft - dmg) });
    extra = '<p class="cen"><small>기록을 아직 못 올렸어요 · 다음에 접속하면 다시 올려요</small></p>';
  } else {
    setPending(null);
    if (r.boss) setBoss(r.boss);
    line = resultLine(0, r.boss?.myRank ?? b.myRank, r.boss ?? b);
    extra = `<p class="cen"><small>${r.why === 'tries' ? '오늘 도전을 다 썼어요' : r.why === 'ended' ? '이 균열은 이미 닫혔어요' : '기록을 올리지 못했어요'}</small></p>`;
  }
  const nb = rift.boss ?? b;
  const left = triesLeft(nb, pendSame(nb));
  const again = startLock(nb, nowS(), pendSame(nb), riftCrew().length);
  const used = res.raidDmg > dmg ? `<p class="cen"><small>한 판 상한에 맞춰 ${fmt(dmg)}만 올라가요</small></p>` : '';
  showCombatResult(
    `<h2>🌌 ${esc(END_TEXT[why])}</h2><div class="big">${fmt(r.ok ? r.dmg : dmg)}</div><p class="cen rfres" id="rfResLine">${esc(line)}</p>${extra}${used}
     <p class="note">보상은 05:00 정산 뒤 우편함으로 (참여 · 처치 · 순위)</p>
     <div class="go"><button class="a" id="rfAgain" ${lockAttr(again)}>다시 도전 (${left}/${nb.triesMax})</button><button class="b" id="rfRk">순위</button><button class="b" id="rfHome">마을로</button></div>${lockNote(again)}`,
    (card) => {
      card.querySelector<HTMLButtonElement>('#rfHome')!.onclick = () => closeCombat();
      card.querySelector<HTMLButtonElement>('#rfRk')!.onclick = () => {
        closeCombat();
        void openRiftRank();
      };
      card.querySelector<HTMLButtonElement>('#rfAgain')!.onclick = () => {
        closeCombat();
        void startRift(riftCrew());
      };
    },
  );
}

// ───────── 랭킹 탭 ─────────

// 서버가 user_id·닉네임을 주지 않는다 → 줄을 눌러 마을 구경 없음 (data-u 없음 → rank.ts bindRows 가 건너뜀) · 내 줄 = 서버 mine
const rkRow = (r: Pick<RiftRankRow, 'rank' | 'inn_name' | 'rep_hero' | 'dmg'>, mine = false) =>
  `<button class="rkrow ${mine ? 'me' : ''} ${r.rank <= 3 ? 'top' + r.rank : ''}"><em>${r.rank}</em><img src="${(r.rep_hero && PORTRAITS[r.rep_hero]) || PORTRAITS.hero || ''}" alt=""><span><b>${esc(r.inn_name)}</b></span><i>${fmt(r.dmg)}</i></button>`;

/** 랭킹 창 「하늘 균열」 탭 내용 (오늘 상위 30 + 내 순위 · 이번 주 합산) */
export async function riftRankHtml(): Promise<string> {
  const lock = riftLock();
  const top = W().rankTop;
  const d = await worldRank(top);
  if (d === 'missing') return '<p class="note">🌌 하늘 균열은 준비 중이에요</p>';
  if (!d) return '<p class="note">아직 열린 균열이 없어요 · 매일 05:00에 새 균열이 열려요</p>';
  // 내 순위·내 피해 합은 서버(my_rank · my_total)가 auth.uid() 로 계산 — 순위에 없는 계정(운영·테스트)은 rank null
  const meLine = (m: RiftMe | null, rows: RiftRankRow[], what: string) =>
    !online()
      ? '<p class="note">로그인하면 내 순위가 보여요</p>'
      : m?.rank
        ? rows.some((r) => r.mine)
          ? ''
          : `<p class="sub">내 순위</p>${rkRow({ rank: m.rank, inn_name: me.profile?.inn_name ?? '내 여관', rep_hero: me.profile?.rep_hero ?? null, dmg: m.dmg }, true)}`
        : m
          ? `<p class="note">${what} 내 피해 ${fmt(m.dmg)} · 운영·테스트 계정은 순위에서 빠져요</p>`
          : `<p class="note">${what} 기록이 아직 없어요${lock ? ` · ${esc(lock)}` : ''}</p>`;
  const list = (rows: RiftRankRow[]) => rows.map((r) => rkRow(r, r.mine)).join('') || '<p class="note">아직 아무도 없어요 · 첫 번째가 되어 보세요!</p>';
  return `<p class="note">🌌 균열 너머의 ${esc(d.name)} (${esc(d.day.slice(5).replace('-', '/'))} 05:00 ~) · 피해 합 순위 · 그날 1~${W().daily.topN}위는 조각 +${W().daily.top} · 칭호 「${esc(W().daily.title)}」</p>
    ${meLine(d.meDay, d.dayRows, '오늘')}<p class="sub">오늘 상위 ${top}</p><div class="rklist">${list(d.dayRows)}</div>
    <p class="sub">이번 주 합산 (${esc(d.weekStart.slice(5).replace('-', '/'))} 월요일 05:00부터) · 1~${W().weekly.boxTop}위 선택 상자 · ~${W().weekly.fragTop}위 조각 ${W().weekly.fragN}</p>
    ${meLine(d.meWeek, d.weekRows, '이번 주')}<div class="rklist">${list(d.weekRows)}</div>`;
}

/** 창이 열려 있으면 다시 그리기용 (시트) */
export const riftWinOpen = () => isWinOpen() && document.getElementById('winT')?.textContent === '하늘 균열';
