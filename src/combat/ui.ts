// 전투 화면: 정수 배율 캔버스 · 왼쪽 절반 가상 조이스틱 · 오른쪽 아래 공격(꾹=연속)·회피·스킬 2·필살기 · AUTO · 초상화로 조종 바꾸기
//  PC: WASD 이동 · J 공격 · K 회피 · U·I 스킬 · O 필살기. 위쪽 HUD는 웨이브·시간만 (큰 글자 없음)
import { CONFIG } from '../data/config';
import type { RegionId } from '../data/items';
import { PORTRAITS } from '../engine/assets';
import { pic } from '../ui/common';
import { iconSrc, dpr } from '../ui/kit';
import { battleMusic } from '../ui/sound';
import type { Actor, Item } from '../world/state';
import { attack, dodge, GRADE_COLOR, grade, hitBonus, makeField, SKILL_NAMES, skill, step, ultimate, type Field, type FieldOpts, type Unit } from './field';
import { digits, draw, labelsOut, loadFx, numsOut, sheets } from './draw';
import { monDef, REGION_BOSS, stageMons } from './mons';
import { JOB_COLOR, skillIcon } from './icons';
import { afterBusy } from '../ui/update';
import { loadMon } from './mon';

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


export async function startCombat(region: RegionId, stage: number, members: Actor[], auto: boolean, done: (r: CombatResult) => void, opts: FieldOpts = {}) {
  // 전투 2차: 이 판에 나올 몬스터·정예·보스·부하 그림 + 이펙트를 미리
  const ids = new Set<string>(stageMons(region, stage).map((m) => m.id));
  if (stage >= 10) {
    ids.add(REGION_BOSS[region].id);
    ids.add(REGION_BOSS[region].minion);
  }
  if (opts.raid) {
    ids.add(opts.raid.look.id);
    ids.add(opts.raid.look.minion);
  }
  await Promise.all([...[...ids].map(async (id) => (sheets[id] = (await loadMon(id)) ?? undefined)), loadFx()]);
  // 그림이 없으면 1차 코드 그림으로 (예비)
  if ([...ids].some((id) => !sheets[id])) await Promise.all(['slime', 'goblin'].map(async (id) => (sheets[id] = (await loadMon(id)) ?? undefined)));
  for (const id of ids) if (!sheets[id]) sheets[id] = monDef(id).hop ? sheets.slime : sheets.goblin;
  battleMusic.huntRegion = region;
  F = makeField(region, stage, members, auto, opts);
  onEnd = done;
  root = document.createElement('div');
  // 토벌은 id 'raid' (배경음악이 토벌곡 · 체력 30%부터 「마지막 일격」)
  root.id = opts.mode === 'raid' ? 'raid' : 'hunt';
  root.className = 'cbt';
  root.innerHTML = `
    <canvas id="cbCv"></canvas>
    <div class="cbtop"><span id="cbWave"></span><b id="cbTime"></b><button id="cbAuto" class="cbauto">AUTO</button><button id="cbQuit" aria-label="포기">✕</button></div>
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
      <button class="cbb ult" id="cbUlt"><img alt=""><i class="ring"></i></button>
      <button class="cbb s2" id="cbS2"><img alt=""><i class="cd"></i><em></em></button>
      <button class="cbb s1" id="cbS1"><img alt=""><i class="cd"></i><em></em></button>
      <button class="cbb dodge" id="cbDodge"><b>⤼</b><i class="cd"></i></button>
      <button class="cbb atk" id="cbAtk"><img src="${iconSrc('skill_attack')}" alt=""></button>
    </div>
    <div class="cbcast" id="cbCast" hidden></div>
    <div class="cbcut" id="cbCut" hidden></div>
    <div class="cbres" id="cbRes" hidden></div>`;
  document.getElementById('view')!.appendChild(root);
  fit();
  addEventListener('resize', fit);
  bindInput();
  buildParty();
  syncSkillButtons(false);
  last = performance.now();
  raf = requestAnimationFrame(frame);
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
    const kx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    const ky = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    const l = Math.hypot(kx, ky) || 1;
    F.stick.x = kx / l;
    F.stick.y = ky / l;
  }
  F.holdAtk = holding ? F.holdAtk + dt : 0;
  step(F, dt);
}
function frame(now: number) {
  if (!F || !root) return;
  // rAF 시각은 performance.now()보다 조금 앞설 수 있다 (음수 dt 금지)
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0));
  last = now;
  tick(dt);
  render();
  raf = requestAnimationFrame(frame);
}
function render() {
  if (!F) return;
  draw(lctx, F, LW, LH);
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
  cdBtn('#cbS1', me.cd![0], C.skillCd[0]);
  cdBtn('#cbS2', me.cd![1], C.skillCd[1]);
  cdBtn('#cbDodge', me.dodgeCd ?? 0, C.dodge.cd);
  ($('#cbUlt').querySelector('.ring') as HTMLElement).style.background = `conic-gradient(#ff7aa8 ${f.chem * 3.6}deg, rgba(255,255,255,.12) 0)`;
  $('#cbUlt').classList.toggle('ready', f.chem >= 100);
  // 스킬 이름 (아래 가운데 0.6초)
  const cs = $('#cbCast');
  if (f.castT > 0) {
    if (cs.textContent !== f.castTxt) cs.textContent = f.castTxt;
    cs.hidden = false;
  } else if (!cs.hidden) cs.hidden = true;
  // 필살기 컷인 띠 (0.5초)
  const cut = $('#cbCut');
  if (f.ult > 0 && cut.hidden) {
    cut.innerHTML = `<div class="band"></div>${f.allies.filter((a) => !a.dead).map((a) => `<img src="${pic(a.actor!)}" alt="">`).join('')}<b>${f.ultName}</b>`;
    cut.hidden = false;
  } else if (f.ult <= 0 && !cut.hidden) cut.hidden = true;
  if (f.done && f.doneT > 1 && $('#cbRes').hidden) finish();
}

function buildParty() {
  const f = F!;
  $('#cbParty').innerHTML = f.allies
    .map((u, i) => `<button data-ally="${i}" aria-label="${u.actor!.name} 조종"><img src="${pic(u.actor!)}" alt=""><i><u></u></i></button>`)
    .join('');
  document.querySelectorAll<HTMLElement>('[data-ally]').forEach(
    (b) =>
      (b.onpointerdown = (e) => {
        e.stopPropagation();
        const u = f.allies[+b.dataset.ally!];
        if (!u.dead && u !== f.me) {
          f.me = u;
          syncSkillButtons(true);
        }
      }),
  );
  void PORTRAITS;
}
let namesT = 0;
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
    const b = $(id);
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
  press('#cbAuto', () => {
    F!.auto = !F!.auto;
    if (F!.auto) F!.autoUsed = true;
  });
  $('#cbQuit').onclick = () => {
    if (!F || F.done) return;
    if (confirm('사냥을 포기할까요? (패배로 기록돼요)')) {
      F.done = 'lose';
      F.doneT = 2;
    }
  };
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKeyUp);
}
function onKey(e: KeyboardEvent) {
  if (!F || F.done) return;
  const k = e.key.toLowerCase();
  if ('wasd'.includes(k) && k.length === 1) keys.add(k);
  if (k === 'j') {
    if (!holding) attack(F, F.me);
    holding = true;
  }
  if (k === 'k') dodge(F, F.me);
  if (k === 'u') skill(F, F.me, 0);
  if (k === 'i') skill(F, F.me, 1);
  if (k === 'o') ultimate(F);
}
function onKeyUp(e: KeyboardEvent) {
  const k = e.key.toLowerCase();
  keys.delete(k);
  if (k === 'j') holding = false;
}

// ───────── 끝 ─────────

function finish() {
  const f = F!;
  const res: CombatResult = {
    win: f.done === 'win', grade: grade(f), autoUsed: f.autoUsed, time: Math.round(C.timeLimit - f.time), hits: f.hitsTaken, kills: f.kills,
    maxStreak: f.maxStreak, items: [...f.picked], raidDmg: f.raidDmg, bossDown: !!f.elite?.dead,
  };
  onEnd?.(res);
}

/** 결과 카드를 전투 화면 위에 (hunt UI가 내용을 채운다) */
export function showCombatResult(html: string, bind: () => void) {
  const r = $('#cbRes');
  r.innerHTML = `<div class="card px res">${html}</div>`;
  r.hidden = false;
  bind();
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
  root = null;
  F = null;
  // 전투 중 미뤄 둔 새 버전 띠
  afterBusy();
}
export const combatOn = () => !!F;
export type { Unit };
