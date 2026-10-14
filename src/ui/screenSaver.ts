// CHECKIN §L1 (screenSaver): 화면 보호 모드 — 「폰에 켜 두고 짬날 때 보는 게임」
//  · 켜기: 메뉴·설정의 [화면 보호] · 아무것도 안 누르면 n분 뒤 저절로(끔·3·5·10분, 기본 5) — 전투·창·대화·사진·꾸미기·이웃 방문 중엔 안 켜짐
//  · 화면: 마을을 아주 어둡게(밤보다 더) + 초당 2번만 그림(dpr 1 — main.ts drawStep·resize) · 가운데 작은 판(1분마다 조금씩 자리 이동 = 번인 방지)
//  · 게임은 그대로 돌아간다 (손님·원정·자동 사냥·시간 — 그리기만 줄인다) · 대기 이벤트(단골 제안 등)는 안 띄운다
//  · 아무 데나 누르면(또는 아무 키) 해제 → 그동안 요약 카드 (받을 게 있으면 [모두 받기], 없으면 [확인])
//  · 설정 「화면 보호 중 화면 켜 두기」(기본 끔): Wake Lock (지원하는 브라우저만 · 실패하면 조용히 무시)
import { idleFor } from '../engine/fps';
import { getPref, setPref } from '../save/save';
import { claimAllMail, mailWaiting } from '../world/meta';
import { P, S, world } from '../world/state';
import { activeAutos } from '../world/hunt';
import { vis, fsay } from '../world/visual';
import { track as trackEv } from '../net/telemetry';
import { $, esc, fmt } from './common';
import { closeWin, openWin, toast } from './windows';

/** 자동으로 켜기까지 (분 · 0 = 끔) */
export const SS_AUTO_OPTS = [0, 3, 5, 10] as const;
export const ssAutoMin = (): number => {
  const v = getPref<number>('ssAuto', 5);
  return (SS_AUTO_OPTS as readonly number[]).includes(v) ? v : 5;
};
export const setSsAutoMin = (v: number) => setPref('ssAuto', v);
export const ssWakeOn = () => getPref<boolean>('ssWake', false);
export const setSsWake = (v: boolean) => setPref('ssWake', v);

interface Base {
  at: number;
  gold: number;
  ids: Set<number>;
  runs: Set<number>;
  hunt: number;
}
let on = false;
let base: Base | null = null;
/** 판에 보이는 숫자 (천천히 따라 올라간다) */
const shown = { gold: 0, guests: 0, runs: 0, hunt: 0 };
let tickT = 0;
let driftT = 0;
let wake: { release: () => Promise<void> } | null = null;
/** 자동으로 켜도 되는가 (main이 넘긴다: 전투·창·대화·사진·꾸미기·이웃·배치·티저 중이면 false) */
let canAuto: () => boolean = () => false;

export const ssOn = () => on;

const finishedRuns = () => new Set(P.runs.filter((r) => r.result).map((r) => r.id));
// PACE §2: 맡겨 둔 칸 전부의 판 수 (끔이면 0번 칸 = 예전 그대로)
const huntN = () => activeAutos().reduce((t, { a }) => t + (a.n ?? 0), 0);

/** 지금까지 (켠 뒤로) */
export function ssStats() {
  if (!base) return { sec: 0, gold: 0, guests: 0, runs: 0, hunt: 0 };
  const ids = new Set(world.actors.filter((a) => a.id && !a.role).map((a) => a.id));
  for (const id of ids) if (!base.ids.has(id)) seen.add(id);
  return {
    sec: Math.round((Date.now() - base.at) / 1000),
    gold: Math.max(0, Math.round(P.counters.goldTotal - base.gold)),
    guests: seen.size,
    runs: [...finishedRuns()].filter((id) => !base!.runs.has(id)).length,
    hunt: Math.max(0, huntN() - base.hunt),
  };
}
/** 켠 뒤 새로 본 손님 번호 */
const seen = new Set<number>();

const dur = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}시간 ${m}분` : m ? `${m}분` : `${sec}초`;
};

function panelHtml(): string {
  const s = ssStats();
  return `<b class="ssinn">${esc(S.innName || '내 여관')}</b>
    <dl><dt>켜 둔 시간</dt><dd>${dur(s.sec)}</dd><dt>번 금화</dt><dd>${fmt(shown.gold)}</dd><dt>다녀간 손님</dt><dd>${shown.guests}명</dd><dt>끝난 원정</dt><dd>${shown.runs}</dd><dt>자동 사냥</dt><dd>${shown.hunt}판</dd></dl>
    <small>아무 데나 누르면 돌아와요</small>`;
}
/** 1초마다: 숫자를 실제 값 쪽으로 조금씩 (한 번에 남은 차이의 1/4 · 최소 1) */
function tick() {
  if (!on) return;
  const s = ssStats();
  const step = (k: keyof typeof shown) => {
    const d = s[k] - shown[k];
    if (d > 0) shown[k] += Math.max(1, Math.ceil(d / 4));
    else shown[k] = s[k];
  };
  step('gold');
  step('guests');
  step('runs');
  step('hunt');
  const p = document.querySelector<HTMLElement>('#ssOv .sspanel');
  if (p) p.innerHTML = panelHtml();
}
/** 번인 방지: 판을 가운데 근처 다른 자리로 (애니메이션 없이 — 2fps 화면이라 순간 이동이 덜 거슬린다) */
function drift() {
  const p = document.querySelector<HTMLElement>('#ssOv .sspanel');
  if (!p) return;
  const v = document.getElementById('view')!.getBoundingClientRect();
  const r = p.getBoundingClientRect();
  const mx = Math.max(0, (v.width - r.width) / 2 - 16);
  const my = Math.max(0, (v.height - r.height) / 2 - 24);
  const dx = Math.round((Math.random() * 2 - 1) * Math.min(mx, 80));
  const dy = Math.round((Math.random() * 2 - 1) * Math.min(my, 140));
  p.style.transform = `translate(${dx}px,${dy}px)`;
}

async function lockScreen() {
  if (!on || !ssWakeOn() || wake || document.visibilityState !== 'visible') return;
  try {
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void>; addEventListener?: (e: string, f: () => void) => void }> } }).wakeLock;
    if (!wl) return;
    const s = await wl.request('screen');
    if (!on) return void s.release().catch(() => {});
    wake = s;
    s.addEventListener?.('release', () => wake === s && (wake = null));
  } catch {
    /* 지원 안 함 · 거절 — 조용히 */
  }
}
function unlockScreen() {
  const w = wake;
  wake = null;
  void w?.release().catch(() => {});
}

/** 화면 보호 켜기 (auto = n분 손 안 대서 저절로) */
export function enterSaver(auto = false) {
  if (on || !vis('screenSaver') || !S.started) return;
  closeWin();
  on = true;
  base = { at: Date.now(), gold: P.counters.goldTotal, ids: new Set(world.actors.filter((a) => a.id && !a.role).map((a) => a.id)), runs: finishedRuns(), hunt: huntN() };
  seen.clear();
  Object.assign(shown, { gold: 0, guests: 0, runs: 0, hunt: 0 });
  document.body.classList.add('ssaver');
  const ov = document.createElement('div');
  ov.id = 'ssOv';
  ov.innerHTML = `<div class="sspanel px">${panelHtml()}</div>`;
  ov.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    exitSaver();
  });
  document.getElementById('view')!.appendChild(ov);
  addEventListener('keydown', onKey, true);
  tickT = window.setInterval(tick, 1000);
  driftT = window.setInterval(drift, 60000);
  // 그리기 배율 상한(dpr 1)은 main.ts resize가 ssOn()을 보고 정한다
  dispatchEvent(new Event('resize'));
  void lockScreen();
  trackEv('screensaver', { on: true, auto });
}
function onKey(e: KeyboardEvent) {
  e.preventDefault();
  e.stopImmediatePropagation();
  exitSaver();
}

/** 화면 보호 끄기 → 그동안 요약 카드 */
export function exitSaver(card = true) {
  if (!on) return;
  const s = ssStats();
  on = false;
  clearInterval(tickT);
  clearInterval(driftT);
  removeEventListener('keydown', onKey, true);
  document.getElementById('ssOv')?.remove();
  document.body.classList.remove('ssaver');
  unlockScreen();
  dispatchEvent(new Event('resize'));
  base = null;
  trackEv('screensaver', { on: false, sec: s.sec, gold: s.gold, guests: s.guests, runs: s.runs, hunt: s.hunt });
  if (card && s.sec >= 3) showSummary(s);
}

/** 「다녀오셨어요」 모양의 요약 (C3 카드가 생기면 그쪽으로) — 받을 게 있으면 [모두 받기] 하나 */
function showSummary(s: ReturnType<typeof ssStats>) {
  const mail = mailWaiting();
  const row = (k: string, v: string) => `<div class="ssrow"><span>${k}</span><b>${v}</b></div>`;
  openWin(
    '다녀오셨어요',
    `<p class="sub">화면 보호 ${dur(s.sec)} 동안 여관은 이렇게 지냈어요</p><div class="sssum">${row('번 금화', `${fmt(s.gold)}G`)}${row('다녀간 손님', `${s.guests}명`)}${row('끝난 원정', `${s.runs}`)}${row('자동 사냥', `${s.hunt}판`)}${mail ? row('우편함', `받을 편지 ${mail}통`) : ''}</div>
    <button class="bigbtn" id="ssOk">${mail ? '모두 받기' : '확인'}</button>`,
  );
  $('#ssOk').onclick = () => {
    if (mail) {
      const n = claimAllMail();
      toast(fsay(`${n}통을 받았어요`, `편지 ${n}통 다 챙겨 드렸어요`));
    }
    closeWin();
  };
}

/** 부팅 때: n분 손 안 대면 저절로 (1초마다 확인) · 앱이 돌아오면 Wake Lock 다시 */
export function initScreenSaver(okToAuto: () => boolean) {
  canAuto = okToAuto;
  setInterval(() => {
    if (on || !vis('screenSaver') || document.hidden) return;
    const m = ssAutoMin();
    if (m > 0 && idleFor() >= m * 60 && canAuto()) enterSaver(true);
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void lockScreen();
  });
}
