// 전투 화면: 정수 배율 캔버스 · 왼쪽 절반 가상 조이스틱 · 오른쪽 아래 공격(꾹=연속)·회피·스킬 2·필살기 · AUTO · 초상화로 조종 바꾸기
//  PC: WASD 이동 · J 공격 · K 회피 · U·I 스킬 · O 필살기. 위쪽 HUD는 웨이브·시간만 (큰 글자 없음)
import { josa } from '../data/josa';
import { CONFIG } from '../data/config';
import { clearOverlays } from '../ui/overlays';
import type { RegionId } from '../data/items';
import { PORTRAITS } from '../engine/assets';
import { pic } from '../ui/common';
import { iconSrc, dpr } from '../ui/kit';
import { battleMusic } from '../ui/sound';
import { uiHooks, type Actor, type Item } from '../world/state';
import { skipFrame } from '../engine/fps';
import { ACTION_NAME, actionOf, capKey, COMBAT_ACTIONS, isPointerFine, keyLabel, keysFor, keysShown, type Action } from '../engine/keys';
import { getPref, setPref } from '../save/save';
import { attack, dodge, GRADE_COLOR, grade, hitBonus, makeField, SKILL_NAMES, skill, step, ultimate, type Field, type FieldOpts, type Unit } from './field';
import { digits, draw, drawVignette, fxLite, labelsOut, loadFx, numsOut, setFxLite, sheets } from './draw';
import { loadHuntProps } from './theme';
import { monDef, REGION_BOSS, stageMons } from './mons';
import { JOB_COLOR, skillIcon } from './icons';
import { afterBusy } from '../ui/update';
import { flushScene } from '../audio/scene';
import { flipOf, loadMon, whiteOf } from './mon';
import { BOSS_IMG } from '../engine/assets';
import { SYN_INFO, takeSynergyLine } from '../world/synergy';
import { vis } from '../world/visual';

const C = CONFIG.combat;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

export interface CombatResult {
  win: boolean;
  grade: 'S' | 'A' | 'B';
  autoUsed: boolean;
  time: number;
  hits: number;
  kills: number;
  maxStreak: number;
  /** 전투 중 주운 장비 */
  items: Item[];
  /** 토벌: 보스에게 준 피해(필드 단위) · 보스를 쓰러뜨렸나 */
  raidDmg: number;
  bossDown: boolean;
  /** 남은 시간(초) — 토벌 처치 등급 보정 */
  timeLeft?: number;
  /** v0.24.5 ✕ → 포기로 끝났나 (끝없는 심연: 진 게 아니라 나간 것) */
  quit?: boolean;
}

let F: Field | null = null;
let raf = 0;
let last = 0;
let root: HTMLElement | null = null;
let onEnd: ((r: CombatResult) => void) | null = null;

/** 개발용: 화면이 숨어 rAF가 멈췄을 때 sec초 진행 */
export const devAdvance = (sec: number) => {
  for (let i = 0; i < sec * 60 && F; i++) tick(1 / 60);
  if (F) render();
};
export const devField = () => F;

// ───────── PARTY §3: 그리기 fps 재기 (2초마다) — 4인 + 보스 + 부하에서 30 아래면 이펙트 줄이기 ─────────
const fpsWin = { n: 0, t0: 0, work: 0, fps: 0, ms: 0, low: 0 };
/** 마지막 2초 동안 실제로 그린 횟수(초당) · 한 장 그리는 데 든 ms · 이펙트 줄이기 켜졌나 */
export const combatFps = () => ({ fps: fpsWin.fps, ms: fpsWin.ms, lite: fxLite(), allies: F?.allies.length ?? 0 });
function noteFrame(now: number, work: number) {
  if (!fpsWin.t0) fpsWin.t0 = now;
  fpsWin.n++;
  fpsWin.work += work;
  const el = now - fpsWin.t0;
  if (el < 2000) return;
  fpsWin.fps = Math.round((fpsWin.n * 1000 * 10) / el) / 10;
  fpsWin.ms = Math.round((fpsWin.work / fpsWin.n) * 100) / 100;
  fpsWin.n = 0;
  fpsWin.work = 0;
  fpsWin.t0 = now;
  // 4명일 때만 (3인 화면은 그대로) · 두 번 연속 30 아래면 이 판 끝까지 줄인다
  if (F && F.allies.length >= 4 && !fxLite()) {
    fpsWin.low = fpsWin.fps < CONFIG.party4Fps.min ? fpsWin.low + 1 : 0;
    if (fpsWin.low >= 2) setFxLite(true);
  }
}

// ───────── 핫픽스 10 §13: 사냥 「접기」 — 화면은 닫고 그 판은 AUTO로 마저 (같은 step · 새 규칙 없음) ─────────
let folded = false;
let foldEnded = false;
export const foldHooks = { fold: () => {}, done: (_win: boolean) => {} };
/** 접어 둔 판: 지역·스테이지 · 남은 시간 · 끝났나 */
export function foldInfo(): { region: RegionId; stage: number; time: number; done: boolean; win: boolean } | null {
  if (!folded || !F) return null;
  return { region: F.region as RegionId, stage: F.stage, time: Math.max(0, F.time), done: foldEnded, win: F.done === 'win' };
}
export function foldCombat() {
  if (!F || !root || folded || F.done || F.mode === 'raid' || F.noFold) return;
  // 그 순간부터 AUTO 취급 → 평가 보너스 없음
  F.auto = true;
  F.autoUsed = true;
  F.stick.x = F.stick.y = 0;
  keys.clear();
  holding = false;
  stickOn = false;
  folded = true;
  foldEnded = false;
  F.half = undefined;
  cancelAnimationFrame(raf);
  removeEventListener('resize', fit);
  removeEventListener('keydown', onKey);
  removeEventListener('keyup', onKeyUp);
  root.remove();
  document.body.classList.remove('in-combat');
  foldHooks.fold();
  afterBusy();
  flushScene();
}
/** 마을 루프가 부른다: 접어 둔 판을 실제 시간대로 진행 */
export function foldedTick(dt: number) {
  if (!folded || !F || foldEnded) return;
  const n = Math.ceil(Math.min(0.25, dt) / (1 / 30));
  for (let i = 0; i < n && F; i++) step(F, Math.min(0.25, dt) / n);
  if (F.done && F.doneT > 1) {
    foldEnded = true;
    finish();
    foldHooks.done(F.done === 'win');
  }
}
/** 접은 판의 파티 (손님 번호) — 저장용 */
export const foldMembers = (): number[] => (F ? F.allies.map((u) => u.actor?.id ?? 0).filter(Boolean) : []);
/** 접어 둔 채 앱을 껐을 때: 화면 없이 AUTO로 처음부터 끝까지 (같은 makeField·step) */
export function runHeadless(region: RegionId, stage: number, members: Actor[]): CombatResult {
  const f = makeField(region, stage, members, true);
  f.autoUsed = true;
  const dt = 1 / 30;
  for (let t = 0; t < C.timeLimit + 5 && !f.done; t += dt) step(f, dt);
  for (let i = 0; i < 60; i++) step(f, dt);
  if (!f.done) f.done = 'lose';
  return { win: f.done === 'win', grade: grade(f), autoUsed: true, time: Math.round(C.timeLimit - f.time), hits: f.hitsTaken, kills: f.kills, maxStreak: f.maxStreak, items: [...f.picked], raidDmg: 0, bossDown: !!f.elite?.dead };
}
/** 다시 펼치기 (끝났으면 결과 카드가 그대로 보인다) */
export function unfoldCombat() {
  if (!folded || !F || !root) return;
  folded = false;
  document.getElementById('view')!.appendChild(root);
  document.body.classList.add('in-combat');
  fit();
  addEventListener('resize', fit);
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKeyUp);
  last = performance.now();
  raf = requestAnimationFrame(frame);
}


export async function startCombat(region: RegionId, stage: number, members: Actor[], auto: boolean, done: (r: CombatResult) => void, opts: FieldOpts = {}) {
  // HOTFIX20 §1: 사냥·토벌 화면으로 — 남은 오버레이(단골 제안 카드 등) 정리
  clearOverlays('combat');
  // 핫픽스 10 §13: 접어 둔 판이 있으면 새 전투는 그게 끝난 뒤에
  if (folded) {
    if (!foldEnded) return uiHooks.toast('접어 둔 사냥이 끝나면 시작할 수 있어요 · 아래 줄을 눌러 펼쳐요');
    closeCombat();
  }
  // 전투 2차: 이 판에 나올 몬스터·정예·보스·부하 그림 + 이펙트를 미리
  const ids = new Set<string>(stageMons(region, stage).map((m) => m.id));
  if (stage >= 10) {
    ids.add(REGION_BOSS[region].id);
    ids.add(REGION_BOSS[region].minion);
  }
  if (opts.look) {
    ids.add(opts.look.id);
    ids.add(opts.look.minion);
  }
  if (opts.raid) {
    ids.add(opts.raid.look.id);
    ids.add(opts.raid.look.minion);
  }
  await Promise.all([...[...ids].filter((id) => !id.startsWith('old_')).map(async (id) => (sheets[id] = (await loadMon(id)) ?? undefined)), loadFx(), loadHuntProps()]);
  // 심연의 눈: 옛 그림 한 장으로 (모든 동작이 같은 그림 · 오른쪽을 보게 뒤집음)
  if (ids.has('old_eye') && !sheets.old_eye && BOSS_IMG.eye) {
    const im = BOSS_IMG.eye;
    const r = flipOf(im);
    const one = { row: 0, frames: 1, fps: 1, loop: true };
    const fr = [{ r, l: im, w: whiteOf(r) }];
    sheets.old_eye = { meta: { frameW: im.width, frameH: im.height, anchor: [Math.floor(im.width / 2), im.height - 1], anims: { idle: one, move: one, attack: one, charge: one, hurt: one, die: one } }, frames: { idle: fr, move: fr, attack: fr, charge: fr, hurt: fr, die: fr } };
  }
  // 그림이 없으면 1차 코드 그림으로 (예비)
  if ([...ids].some((id) => !sheets[id])) await Promise.all(['slime', 'goblin'].map(async (id) => (sheets[id] = (await loadMon(id)) ?? undefined)));
  for (const id of ids) if (!sheets[id]) sheets[id] = monDef(id).hop ? sheets.slime : sheets.goblin;
  battleMusic.huntRegion = region;
  // REGIONS2: 50% 컷 — 전투를 멈추고 (일시정지 창 없이) 대화창을 전투 위에 · 끝나면 이어서
  const userHalf = opts.talkHalf;
  F = makeField(region, stage, members, auto, userHalf ? { ...opts, half: () => {
    paused = true;
    holding = false;
    keys.clear();
    document.body.classList.add('cbtalk');
    combatTalk(() => {
      document.body.classList.remove('cbtalk');
      paused = false;
    });
  } } : opts);
  combatTalk = userHalf ?? ((d) => d());
  onEnd = done;
  // PARTY §3: 판마다 처음엔 이펙트 그대로 (재다가 느리면 줄인다)
  setFxLite(false);
  Object.assign(fpsWin, { n: 0, t0: 0, work: 0, fps: 0, ms: 0, low: 0 });
  root = document.createElement('div');
  // 토벌은 id 'raid' (배경음악이 토벌곡 · 체력 30%부터 「마지막 일격」)
  root.id = opts.mode === 'raid' ? 'raid' : 'hunt';
  root.className = 'cbt';
  root.innerHTML = `
    <canvas id="cbCv"></canvas>
    <div class="cbtop"><span id="cbWave"></span><b id="cbTime"></b><button id="cbAuto" class="cbauto">AUTO<kbd class="kc" data-k="auto"></kbd></button>${opts.mode === 'raid' || opts.noFold ? '' : '<button id="cbFold" class="cbfold">접기 ▾<small>접으면 평가 보너스 없음</small><kbd class="kc" data-k="fold"></kbd></button>'}<button id="cbKeysBtn" class="cbkeys" aria-label="단축키">⌨</button><button id="cbQuit" aria-label="포기">✕</button></div>
    <div class="cbparty" id="cbParty"></div>
    <div class="cbchain" id="cbChain"></div>
    <div class="cbhit" id="cbHit"><b id="cbHitN"></b><small id="cbHitB"></small><strong id="cbKills"></strong></div>
    <div class="cbboss" id="cbBoss" hidden><span id="cbBossN"></span><i><u id="cbBossHp"></u></i></div>
    <div class="cbbanner" id="cbBanner" hidden></div>
    <div class="cbgoal" id="cbGoal"></div>
    <div class="cbloot" id="cbLoot"></div>
    <div class="cbstick" id="cbStick" hidden><i></i></div>
    <div class="cbpad">
      <div class="cbnames" id="cbNames" hidden><span id="cbN1"></span><span id="cbN2"></span></div>
      <button class="cbb ult" id="cbUlt"><img draggable="false" alt=""><i class="ring"></i><kbd class="kc" data-k="ult"></kbd></button>
      <button class="cbb s2" id="cbS2"><img draggable="false" alt=""><i class="cd"></i><em></em><kbd class="kc" data-k="s2"></kbd></button>
      <button class="cbb s1" id="cbS1"><img draggable="false" alt=""><i class="cd"></i><em></em><kbd class="kc" data-k="s1"></kbd></button>
      <button class="cbb dodge" id="cbDodge"><b>⤼</b><i class="cd"></i><kbd class="kc" data-k="dodge"></kbd></button>
      <button class="cbb atk" id="cbAtk"><img draggable="false" src="${iconSrc('skill_attack')}" alt=""><kbd class="kc" data-k="attack"></kbd></button>
    </div>
    <div class="cbcast" id="cbCast" hidden></div>
    <div class="cbcut" id="cbCut" hidden></div>
    <div class="cbres" id="cbRes" hidden></div>
    <div class="cbpause" id="cbPause" hidden><div class="card px res"><b>일시정지</b><p>${opts.mode === 'raid' ? '토벌' : '사냥'}을 포기하면 패배로 기록돼요</p><div class="go"><button class="a" id="cbResume">계속하기</button><button class="b" id="cbGiveUp">포기하기</button></div></div></div>
    <div class="cbkeycard" id="cbKeyCard" hidden></div>
    <div class="cbsyn" id="cbSyn" hidden></div>`;
  document.getElementById('view')!.appendChild(root);
  document.body.classList.add('in-combat');
  // 길게 누르기 메뉴(이미지 저장·링크)는 전투 화면 어디서도 안 뜨게
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  fit();
  addEventListener('resize', fit);
  bindInput();
  buildParty();
  syncSkillButtons(false);
  shownMe = F!.me;
  synBand(F!);
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

/** PARTY §2: 조합이 처음 켜진 판 — 시작 화면 하단 띠에 한 줄 (조합마다 한 번) · 켜진 조합은 도감 「파티」에 적힌다 */
function synBand(f: Field) {
  const ms = f.allies.map((u) => u.actor!).filter(Boolean);
  const got = takeSynergyLine(ms);
  const el = document.getElementById('cbSyn');
  if (!got || !el) return;
  const i = SYN_INFO[got.id];
  el.innerHTML = `<b>${i.icon} ${i.name}</b><span>${got.line[1].replace(/[<>&]/g, '')}</span>`;
  el.hidden = false;
  window.setTimeout(() => {
    if (el.isConnected) el.hidden = true;
  }, 5200);
}

// ───────── 캔버스 (정수 배율) ─────────

let lcv: HTMLCanvasElement;
let lctx: CanvasRenderingContext2D;
let LW = 130;
let LH = 280;
let K = 3;
// ───────── 전투 줌 (핫픽스 7): 지금 배율의 약 50 · 75 · 100%를 정수로 · 기본은 한 단계 멀리 · 기기마다 기억 ─────────
const ZKEY = 'legacy-of-adventure-combatZoom';
function zoomSteps(): number[] {
  const k0 = Math.max(1, Math.round(C.scale * dpr()));
  const s = [...new Set(C.zoomSteps.map((m) => Math.max(1, Math.round(k0 * m))))].sort((a, b) => a - b);
  return s;
}
let zIdx = -1;
function zoomIndex(): number {
  const s = zoomSteps();
  if (zIdx < 0) {
    let v = NaN;
    try {
      v = Number(localStorage.getItem(ZKEY));
    } catch {
      /* 저장소 없음 */
    }
    // 저장값은 단계 번호 (0=가장 멀리). 없으면 기본: 가장 가까운 것보다 한 단계 멀리
    zIdx = Number.isInteger(v) && localStorage.getItem(ZKEY) !== null ? v : Math.max(0, s.length - 1 - C.zoomDefault);
  }
  return Math.max(0, Math.min(s.length - 1, zIdx));
}
/** dir +1 가까이 · -1 멀리 */
export function zoomStep(dir: number) {
  const s = zoomSteps();
  const n = Math.max(0, Math.min(s.length - 1, zoomIndex() + dir));
  if (n === zoomIndex()) return;
  zIdx = n;
  try {
    localStorage.setItem(ZKEY, String(n));
  } catch {
    /* 무시 */
  }
  fit();
}
export const zoomInfo = () => ({ steps: zoomSteps(), idx: zoomIndex(), K });
function fit() {
  if (!root) return;
  const cv = $<HTMLCanvasElement>('#cbCv');
  const r = root.getBoundingClientRect();
  // 기기 픽셀 정수배: 도트 1개 = K×K 기기 픽셀 (줌 단계 중 하나 · 정수라 번지지 않는다)
  K = zoomSteps()[zoomIndex()];
  const dw = Math.round(r.width * dpr());
  const dh = Math.round(r.height * dpr());
  LW = Math.ceil(dw / K);
  LH = Math.ceil(dh / K);
  cv.width = LW * K;
  cv.height = LH * K;
  cv.style.width = (LW * K) / dpr() + 'px';
  cv.style.height = (LH * K) / dpr() + 'px';
  lcv = document.createElement('canvas');
  lcv.width = LW;
  lcv.height = LH;
  lctx = lcv.getContext('2d')!;
  lctx.imageSmoothingEnabled = false;
}

// ───────── 루프 ─────────

const keys = new Set<string>();
let holding = false;
function tick(dt: number) {
  if (!F) return;
  // 키보드 이동 (조이스틱이 없을 때)
  if (!stickOn) {
    const kx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const ky = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
    const l = Math.hypot(kx, ky) || 1;
    F.stick.x = kx / l;
    F.stick.y = ky / l;
  }
  F.holdAtk = holding ? F.holdAtk + dt : 0;
  step(F, dt);
}
function frame(now: number) {
  if (!F || !root) return;
  // 핫픽스 12 §5: 일시정지 중엔 시간이 흐르지 않는다
  if (paused) {
    last = now;
    raf = requestAnimationFrame(frame);
    return;
  }
  // 핫픽스 11: 최대 60fps (배터리 절약 30) — 120Hz 화면에서 120번 그리지 않게
  if (skipFrame(last, now)) {
    raf = requestAnimationFrame(frame);
    return;
  }
  // rAF 시각은 performance.now()보다 조금 앞설 수 있다 (음수 dt 금지)
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0));
  last = now;
  const w0 = performance.now();
  tick(dt);
  render();
  noteFrame(now, performance.now() - w0);
  raf = requestAnimationFrame(frame);
}
function render() {
  if (!F) return;
  draw(lctx, F, LW, LH);
  drawVignette(lctx, F, LW, LH);
  const cv = $<HTMLCanvasElement>('#cbCv');
  const x = cv.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.drawImage(lcv, 0, 0, LW * K, LH * K);
  // 피해 숫자: 기기 픽셀로 (도트 크기의 절반 · 치명타는 조금 크게)
  const pn = Math.max(2, Math.round(K / 2));
  const pc = Math.max(3, Math.round(K * 0.75));
  for (const n of numsOut) digits(x, n.text, n.x * K, n.y * K, n.col, n.crit ? pc : pn);
  // 장비 이름표 (등급 색 · 어두운 테두리)
  if (labelsOut.length) {
    const fs = Math.round(11 * dpr());
    x.font = `700 ${fs}px Galmuri11, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'bottom';
    x.lineWidth = Math.max(2, Math.round(dpr() * 2));
    x.strokeStyle = '#140c18';
    for (const l of labelsOut) {
      x.strokeText(l.text, l.x * K, l.y * K);
      x.fillStyle = l.col;
      x.fillText(l.text, l.x * K, l.y * K);
    }
  }
  hud();
}

function hud() {
  const f = F!;
  $('#cbWave').textContent = f.mode === 'raid' ? '토벌' : '';
  $('#cbTime').textContent = `${Math.max(0, Math.ceil(f.time))}`;
  $('#cbTime').classList.toggle('low', f.time < 15);
  $('#cbAuto').classList.toggle('on', f.auto);
  $('#cbChain').textContent = '';
  // 전투 2차: 연타 HIT (+피해) · KILLS 연속
  $('#cbHitN').textContent = f.hit >= 2 ? `${f.hit} HIT` : '';
  const hb = hitBonus(f.hit);
  $('#cbHitB').textContent = f.hit >= 2 && hb > 0 ? `+${Math.round(hb * 100)}% DMG` : '';
  $('#cbKills').textContent = f.streak >= 2 ? `${f.streak} KILLS` : '';
  // 목표: 처치 n/목표 → 정예 등장
  $('#cbGoal').textContent = f.mode === 'raid' ? '' : f.elite ? (f.elite.boss ? `보스 · ${f.elite.boss.name}` : '정예를 쓰러뜨려요!') : `처치 ${f.kills}/${f.killGoal}`;
  // 보스 체력 막대
  const bb = $('#cbBoss');
  const boss = f.elite?.boss ? f.elite : null;
  bb.hidden = !boss || boss.dead || boss.st === 'spawn';
  if (boss) {
    $('#cbBossN').textContent = boss.boss!.name + (boss.enraged ? ' · 분노' : '');
    $('#cbBossHp').style.width = Math.max(0, Math.round((boss.hp / boss.max) * 100)) + '%';
    // 토벌: 체력 30% 아래 → 「마지막 일격」 음악
    if (f.mode === 'raid' && boss.hp / boss.max < 0.3) battleMusic.raidLow = true;
  }
  // 조종 캐릭터가 바뀌면 (대장이 쓰러짐 · 교대) 스킬 바·아이콘·이름 다시 · 쓰러져서 넘어가면 0.8초 안내
  if (f.me !== shownMe) {
    const prev = shownMe;
    shownMe = f.me;
    syncSkillButtons(true);
    if (prev && prev.dead && prev.actor && f.me.actor) {
      const n = f.me.actor.name;
      f.banner = `${prev.actor.name}${josa(prev.actor.name, '이')} 쓰러졌어요 — 이제 ${n}${josa(n, '이')} 싸워요`;
      f.bannerT = 0.8;
    }
  }
  const bn = $('#cbBanner');
  if (f.bannerT > 0) {
    if (bn.textContent !== f.banner) bn.textContent = f.banner;
    bn.hidden = false;
  } else if (!bn.hidden) bn.hidden = true;
  // 획득 알림 (왼쪽 아래 최대 4줄 · 4초)
  const lg = f.lootLog.filter((g) => g.t < 4);
  const lh = lg.map((g) => `<p style="color:${GRADE_COLOR[g.grade]}">${g.text.replace(/[<>&]/g, '')}</p>`).join('');
  const lb = $('#cbLoot');
  if (lb.innerHTML !== lh) lb.innerHTML = lh;
  // 초상화 체력 · 조종 중
  f.allies.forEach((u, i) => {
    const b = document.querySelector<HTMLElement>(`[data-ally="${i}"]`);
    if (!b) return;
    b.classList.toggle('me', u === f.me);
    b.classList.toggle('dead', u.dead);
    (b.querySelector('u') as HTMLElement).style.width = Math.round((u.hp / u.max) * 100) + '%';
  });
  const me = f.me;
  const cdBtn = (id: string, left: number, max: number) => {
    const b = $(id);
    (b.querySelector('.cd') as HTMLElement).style.background = left > 0 ? `conic-gradient(transparent ${(1 - left / max) * 360}deg, rgba(10,8,20,.7) 0)` : 'none';
    const em = b.querySelector('em');
    if (em) em.textContent = left > 0 ? String(Math.ceil(left)) : '';
  };
  cdBtn('#cbS1', me.cd![0], me.cdMax?.[0] ?? C.skillCd[0]);
  cdBtn('#cbS2', me.cd![1], me.cdMax?.[1] ?? C.skillCd[1]);
  cdBtn('#cbDodge', me.dodgeCd ?? 0, C.dodge.cd);
  ($('#cbUlt').querySelector('.ring') as HTMLElement).style.background = `conic-gradient(#ff7aa8 ${f.chem * 3.6}deg, rgba(255,255,255,.12) 0)`;
  $('#cbUlt').classList.toggle('ready', f.chem >= 100);
  // 스킬 이름 (아래 가운데 0.6초)
  const cs = $('#cbCast');
  if (f.castT > 0) {
    if (cs.textContent !== f.castTxt) cs.textContent = f.castTxt;
    cs.style.color = f.castColor ?? '#fff';
    cs.hidden = false;
  } else if (!cs.hidden) cs.hidden = true;
  // 필살기 컷인 띠 (0.5초)
  const cut = $('#cbCut');
  if (f.ult > 0 && cut.hidden) {
    cut.innerHTML = `<div class="band"></div>${f.allies.filter((a) => !a.dead).map((a) => `<img draggable="false" src="${pic(a.actor!)}" alt="">`).join('')}<b>${f.ultName}</b>`;
    cut.hidden = false;
  } else if (f.ult <= 0 && !cut.hidden) cut.hidden = true;
  if (f.done && f.doneT > 1 && $('#cbRes').hidden) finish();
}

function buildParty() {
  const f = F!;
  $('#cbParty').innerHTML = f.allies
    .map((u, i) => `<button data-ally="${i}" aria-label="${u.actor!.name}${i >= 3 ? ' (자동)' : ' 조종'}" class="${i >= 3 ? 'ai4' : ''}"><img draggable="false" src="${pic(u.actor!)}" alt=""><i><u></u></i></button>`)
    .join('');
  document.querySelectorAll<HTMLElement>('[data-ally]').forEach(
    (b) =>
      (b.onpointerdown = (e) => {
        e.stopPropagation();
        const u = f.allies[+b.dataset.ally!];
        // PARTY §3: 4번째 동료는 AI만 (조작은 지금처럼 대장과 셋 중에서)
        if (+b.dataset.ally! >= 3) return uiHooks.toast('4번째 동료는 알아서 싸워요 (AI)');
        if (!u.dead && u !== f.me) {
          f.me = u;
          syncSkillButtons(true);
        }
      }),
  );
  void PORTRAITS;
}
let namesT = 0;
/** 스킬 바가 지금 보여 주는 조종 캐릭터 */
let shownMe: Unit | null = null;
/** 조종 캐릭터의 직업 아이콘·테두리 색 · 바꿀 때 0.3초 효과 + 스킬 이름 1초 */
function syncSkillButtons(swap: boolean) {
  const me = F!.me;
  const job = me.job ?? 'warrior';
  ($('#cbS1 img') as HTMLImageElement).src = skillIcon(job, 0);
  ($('#cbS2 img') as HTMLImageElement).src = skillIcon(job, 1);
  ($('#cbUlt img') as HTMLImageElement).src = skillIcon(job, 'ult');
  const [n1, n2] = SKILL_NAMES[job];
  $('#cbS1').setAttribute('aria-label', n1);
  $('#cbS2').setAttribute('aria-label', n2);
  const pad = root!.querySelector<HTMLElement>('.cbpad')!;
  pad.style.setProperty('--jc', JOB_COLOR[job]);
  pad.dataset.job = job;
  if (!swap) return;
  pad.classList.remove('swap');
  void pad.offsetWidth;
  pad.classList.add('swap');
  $('#cbN1').textContent = n1;
  $('#cbN2').textContent = n2;
  const nm = $('#cbNames');
  nm.hidden = false;
  clearTimeout(namesT);
  namesT = window.setTimeout(() => {
    nm.hidden = true;
    pad.classList.remove('swap');
  }, 1000);
}

// ───────── 조작 ─────────

let stickOn = false;
let stickId = -1;
let sx0 = 0;
let sy0 = 0;
function bindInput() {
  const r = root!;
  const st = $('#cbStick');
  const R = 46;
  // 핀치 줌: 버튼이 아닌 곳에 손가락 두 개일 때만 (조이스틱은 취소)
  const touches = new Map<number, { x: number; y: number }>();
  let pinch0 = 0;
  const pinchDist = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  r.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      pinch0 = pinchDist();
      if (stickOn) {
        stickOn = false;
        stickId = -1;
        st.hidden = true;
        if (F) F.stick.x = F.stick.y = 0;
      }
    }
  });
  r.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size !== 2 || pinch0 <= 0) return;
    const d = pinchDist();
    // 정수 단계라 손가락을 1.3배 벌리거나 오므릴 때마다 한 단계
    if (d > pinch0 * 1.3) {
      zoomStep(1);
      pinch0 = d;
    } else if (d < pinch0 / 1.3) {
      zoomStep(-1);
      pinch0 = d;
    }
  });
  const lift = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch0 = 0;
  };
  r.addEventListener('pointerup', lift);
  r.addEventListener('pointercancel', lift);
  // PC: 마우스 휠 한 칸 = 한 단계
  let wheelT = 0;
  r.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const now = performance.now();
      if (now - wheelT < 180 || Math.abs(e.deltaY) < 2) return;
      wheelT = now;
      zoomStep(e.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );
  r.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('button') || !F || F.done || touches.size > 1) return;
    // 왼쪽 절반 아무 데나: 그 자리에 조이스틱
    if (e.clientX < r.clientWidth / 2 && !stickOn) {
      stickOn = true;
      stickId = e.pointerId;
      sx0 = e.clientX;
      sy0 = e.clientY;
      st.hidden = false;
      st.style.left = sx0 - R + 'px';
      st.style.top = sy0 - R + 'px';
      (st.firstElementChild as HTMLElement).style.transform = 'translate(0,0)';
    }
  });
  r.addEventListener('pointermove', (e) => {
    if (!stickOn || e.pointerId !== stickId || !F) return;
    let dx = e.clientX - sx0;
    let dy = e.clientY - sy0;
    const l = Math.hypot(dx, dy);
    if (l > R) {
      dx = (dx / l) * R;
      dy = (dy / l) * R;
    }
    (st.firstElementChild as HTMLElement).style.transform = `translate(${Math.round(dx)}px,${Math.round(dy)}px)`;
    F.stick.x = dx / R;
    F.stick.y = dy / R;
  });
  const up = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    stickOn = false;
    stickId = -1;
    st.hidden = true;
    if (F) F.stick.x = F.stick.y = 0;
  };
  r.addEventListener('pointerup', up);
  r.addEventListener('pointercancel', up);
  const press = (id: string, fn: () => void) => {
    // v0.10.1: 모드에 따라 없는 버튼(토벌엔 접기 없음)이면 건너뛴다 — 예전엔 여기서 끊겨 AUTO·포기·키보드가 안 붙었다
    const b = document.querySelector<HTMLElement>(id);
    if (!b) return;
    b.onpointerdown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!F || F.done) return;
      fn();
    };
  };
  press('#cbAtk', () => {
    holding = true;
    attack(F!, F!.me);
  });
  const release = () => (holding = false);
  $('#cbAtk').onpointerup = release;
  $('#cbAtk').onpointerleave = release;
  $('#cbAtk').onpointercancel = release;
  press('#cbDodge', () => dodge(F!, F!.me));
  press('#cbS1', () => skill(F!, F!.me, 0));
  press('#cbS2', () => skill(F!, F!.me, 1));
  press('#cbUlt', () => ultimate(F!));
  press('#cbFold', foldCombat);
  press('#cbAuto', () => {
    F!.auto = !F!.auto;
    if (F!.auto) F!.autoUsed = true;
  });
  // 핫픽스 12 §5: ✕ = 일시정지 창 (confirm() 대신)
  $('#cbQuit').onclick = () => {
    if (!F || F.done) return;
    openPause();
  };
  $('#cbResume').onclick = resume;
  $('#cbGiveUp').onclick = askGiveUp;
  $('#cbKeysBtn').onclick = () => (keyCardOpen() ? hideKeyCard() : showKeyCard(false));
  $('#cbKeyCard').onclick = hideKeyCard;
  syncKeycaps();
  // 처음 PC로 전투할 때 한 번: 키 배치 카드 3초
  if (isPointerFine() && !getPref<boolean>('keysIntro', false)) {
    setPref('keysIntro', true);
    showKeyCard(true);
  }
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKeyUp);
}
function onKey(e: KeyboardEvent) {
  if (!F || F.done) return;
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  // 단축키 안내 카드가 떠 있으면 아무 키로 닫기
  if (keyCardOpen()) {
    hideKeyCard();
    e.preventDefault();
    return;
  }
  const a = actionOf(e.key, COMBAT_ACTIONS);
  if (!a) return;
  // Space·Tab·방향키·Shift가 페이지를 움직이거나 포커스를 옮기지 않게
  e.preventDefault();
  if (a === 'pause') return paused ? resume() : openPause();
  if (paused) return;
  if (a === 'up' || a === 'down' || a === 'left' || a === 'right') return void keys.add(a);
  if (e.repeat && a !== 'attack') return;
  switch (a) {
    case 'attack':
      if (!holding) attack(F, F.me);
      holding = true;
      break;
    case 'dodge':
      dodge(F, F.me);
      break;
    case 's1':
      skill(F, F.me, 0);
      break;
    case 's2':
      skill(F, F.me, 1);
      break;
    case 'ult':
      ultimate(F);
      break;
    case 'swap':
      swapAlly();
      break;
    case 'auto':
      F.auto = !F.auto;
      if (F.auto) F.autoUsed = true;
      break;
    case 'fold':
      foldCombat();
      break;
  }
}
function onKeyUp(e: KeyboardEvent) {
  const a = actionOf(e.key, COMBAT_ACTIONS);
  if (!a) return;
  keys.delete(a);
  if (a === 'attack') holding = false;
}
/** Tab: 살아 있는 다음 동료로 */
function swapAlly() {
  const f = F!;
  const alive = f.allies.filter((u) => !u.dead);
  if (alive.length < 2) return;
  const i = alive.indexOf(f.me);
  f.me = alive[(i + 1) % alive.length];
  syncSkillButtons(true);
}
// ───────── 핫픽스 12 §5: 일시정지(Esc·✕ — confirm() 대신 게임 안 창) · 키캡 · 단축키 안내 ─────────
let paused = false;
function openPause() {
  if (!F || F.done || !root) return;
  paused = true;
  holding = false;
  keys.clear();
  (root.querySelector('#cbPause') as HTMLElement).hidden = false;
}
function resume() {
  paused = false;
  if (root) (root.querySelector('#cbPause') as HTMLElement).hidden = true;
}
/** J4 confirmSheet: 포기는 아래 확인 시트로 한 번 더 (끄면 예전처럼 바로) — 시트가 떠 있는 동안 일시정지 그대로 */
function askGiveUp() {
  if (!vis('confirmSheet')) return giveUp();
  const what = F?.mode === 'raid' ? '토벌' : '사냥';
  void import('../ui/confirmSheet').then(({ confirmSheet }) => confirmSheet({ title: `${what}을 포기할까요?`, body: '패배로 기록돼요', ok: '포기하기', danger: true }).then((ok) => ok && giveUp()));
}
function giveUp() {
  resume();
  if (!F || F.done) return;
  F.done = 'lose';
  F.doneT = 2;
  F.quit = true;
}
/** 버튼 모서리 키캡 글자 (PC에서만 보인다 — CSS) */
function syncKeycaps() {
  root?.querySelectorAll<HTMLElement>('kbd.kc').forEach((k) => (k.textContent = keyLabel(capKey(k.dataset.k as Action))));
}
const keyCardOpen = () => !!root && !(root.querySelector('#cbKeyCard') as HTMLElement).hidden;
function hideKeyCard() {
  if (root) (root.querySelector('#cbKeyCard') as HTMLElement).hidden = true;
}
let keyCardT = 0;
function showKeyCard(auto: boolean) {
  if (!root) return;
  const c = root.querySelector('#cbKeyCard') as HTMLElement;
  const rows = COMBAT_ACTIONS.filter((a) => a !== 'up' && a !== 'down' && a !== 'left' && a !== 'right' && (a !== 'fold' || !!root!.querySelector('#cbFold')));
  const move = (['up', 'left', 'down', 'right'] as Action[]).map((a) => keyLabel(keysFor(a)[0])).join('');
  c.innerHTML = `<div class="card px"><b>⌨ 단축키</b><dl><dt>${move} / 방향키</dt><dd>이동</dd>${rows.map((a) => `<dt>${keysShown(a).map(keyLabel).join(' / ')}</dt><dd>${ACTION_NAME[a]}</dd>`).join('')}</dl><p>설정 → 단축키 바꾸기에서 바꿀 수 있어요 · 아무 키나 눌러 닫기</p></div>`;
  c.hidden = false;
  clearTimeout(keyCardT);
  if (auto) keyCardT = window.setTimeout(hideKeyCard, 3000);
}

// ───────── 끝 ─────────

/** HOTFIX17 §2: 결과 화면이 창(토벌)이라 #cbRes가 계속 숨어 있으면 매 프레임 finish가 불렸다 → 판(필드)당 한 번만 */
let finishedField: object | null = null;
function finish() {
  const f = F!;
  if (finishedField === f) return;
  finishedField = f;
  const res: CombatResult = {
    win: f.done === 'win', grade: grade(f), autoUsed: f.autoUsed, time: Math.round(C.timeLimit - f.time), hits: f.hitsTaken, kills: f.kills,
    maxStreak: f.maxStreak, items: [...f.picked], raidDmg: f.raidDmg, bossDown: !!f.elite?.dead, timeLeft: Math.max(0, f.time), quit: !!f.quit,
  };
  onEnd?.(res);
}

/** 결과 카드를 전투 화면 위에 (hunt UI가 내용을 채운다) */
export function showCombatResult(html: string, bind: (card: HTMLElement) => void) {
  // 접어 둔 판은 화면(root)이 문서에 없다 → root 안에서 찾는다 (버튼 연결도 root 기준)
  const r = (root?.querySelector('#cbRes') ?? $('#cbRes')) as HTMLElement;
  // ROLES §5: 탱·힐·딜 조합이면 「역할 조합 보너스 ✓」
  const combo = F?.roles && F.mode === 'hunt' && (F.comboTele ?? 0) > 0 ? '<p class="rolecombo">역할 조합 보너스 ✓</p>' : '';
  r.innerHTML = `<div class="card px res">${html}${combo}</div>`;
  r.hidden = false;
  bind(r);
}

export function closeCombat() {
  cancelAnimationFrame(raf);
  removeEventListener('resize', fit);
  removeEventListener('keydown', onKey);
  removeEventListener('keyup', onKeyUp);
  keys.clear();
  holding = false;
  stickOn = false;
  root?.remove();
  document.body.classList.remove('in-combat');
  root = null;
  F = null;
  paused = false;
  folded = false;
  foldEnded = false;
  // 전투 중 미뤄 둔 새 버전 띠 · 마을 소리·알림
  afterBusy();
  flushScene();
}
export const combatOn = () => !!F && !folded;
/** REGIONS2: 50% 컷을 트는 쪽 (ui/hunt가 넘긴 half(done)) */
let combatTalk: (done: () => void) => void = (d) => d();
export type { Unit };
