// 부팅, 루프(규칙 갱신 30fps / 그리기 rAF), 화면 입력(드래그·탭)
import './style.css';
import { CONFIG } from './data/config';
import { alphaAt, IMG, loadAssets, pumpTintWarmup, queueTintWarmup, recolored } from './engine/assets';
import { CLASSES, type ClassKey } from './data/classes';
import { charFrames } from './engine/sprites';
import { clampCam, resizeCanvas, scr, toLogical, toTile, updateOrigin, view } from './engine/iso';
import * as game from './game';
import { getPref, writeSave } from './save/save';
import { enter, launchParty, updActors, warmItemIcons } from './world/actors';
import { blendNight, onNightChange, tickDayNight } from './world/daynight';
import { posBubbles } from './world/fx';
import { buildingAt, renderFrame } from './world/render';
import { runJobs, S, takeDirty, uiHooks, world } from './world/state';
import { doorOf, placing } from './world/town';
import { initChat } from './ui/chat';
import { initDialogue, isTalking, setOnNamed } from './ui/dialogue';
import { initHud, movePlacement, setOnZoom, setZoom, tickHud } from './ui/hud';
import { buildThumbs, initWindows, isWinOpen, openReport, showActor, showObj, toast, toastHtml } from './ui/windows';

const host = document.getElementById('view')!;
const cv = document.getElementById('scene') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;

// ───────── 글꼴 (Galmuri, SIL OFL) ─────────
function loadFonts() {
  const base = import.meta.env.BASE_URL + 'assets/fonts/';
  const faces = [
    new FontFace('Galmuri11', `url(${base}Galmuri11.woff2)`),
    new FontFace('Galmuri11', `url(${base}Galmuri11-Bold.woff2)`, { weight: '700' }),
    new FontFace('Galmuri9', `url(${base}Galmuri9.woff2)`),
  ];
  return Promise.all(
    faces.map((f) =>
      f.load().then(
        (ff) => document.fonts.add(ff),
        () => undefined,
      ),
    ),
  );
}

function resize() {
  resizeCanvas(cv, host, S.zoom);
}

// ───────── 루프 ─────────

const STEP = CONFIG.loop.updateStep;
let acc = 0;
/** 지난 그리기 이후 흐른 시간 (창이 열리면 30fps로 묶어 그린다) */
let drawAcc = 0;
let partyClock = 0;
let saveClock = 0;
let last = 0;

function update(dt: number) {
  let t = performance.now();
  S.time += dt;
  runJobs();
  t = mark('jobs', t);
  updActors(dt);
  t = mark('actors', t);
  const busy = isWinOpen() || !!placing.pl || isTalking();
  tickDayNight(dt, busy);
  t = mark('daynight', t);
  if (S.started && !S.visiting) {
    partyClock += dt;
    if (partyClock >= CONFIG.dungeon.intervalSeconds) {
      partyClock = 0;
      launchParty(!!placing.pl);
    }
    t = mark('party', t);
    saveClock += dt;
    if (saveClock >= CONFIG.save.autosaveSeconds || takeDirty()) {
      saveClock = 0;
      writeSave();
    }
    mark('save', t);
  }
}

/** 개발용: 프레임마다 규칙+그리기에 쓴 시간 */
const stats = { frames: 0, work: 0, worst: 0, part: { update: 0, render: 0, dom: 0, warm: 0 } as Record<string, number> };
const mark = (k: string, t: number) => {
  const now = performance.now();
  stats.part[k] = Math.max(stats.part[k], now - t);
  return now;
};

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  tick(dt);
  requestAnimationFrame(frame);
}

function tick(dt: number) {
  const t0 = performance.now();
  let t = t0;
  // 규칙은 고정 간격(30fps)으로
  acc = Math.min(acc + dt, 0.25);
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  t = mark('update', t);
  // 그리기는 화면 주사율대로 — 단, 창이 열려 있으면 30fps로 낮춰 창 애니메이션에 여유를 준다
  drawAcc += dt;
  const winOpen = isWinOpen();
  if (winOpen && drawAcc < CONFIG.loop.drawStepWhileWindow) return;
  const ddt = drawAcc;
  drawAcc = 0;
  S.T += ddt;
  blendNight(ddt);
  updateOrigin();
  renderFrame(ctx, ddt);
  t = mark('render', t);
  posBubbles();
  tickHud();
  t = mark('dom', t);
  // 밤 색조 미리 만들기도 창이 열려 있는 동안엔 쉰다
  if (!winOpen) pumpTintWarmup(3);
  mark('warm', t);
  const w = performance.now() - t0;
  stats.frames++;
  stats.work += w;
  stats.worst = Math.max(stats.worst, w);
}

// ───────── 입력: 드래그 = 카메라, 탭 = 고르기 ─────────

let drag: { x: number; y: number; cx: number; cy: number } | null = null;
let moved = false;
/** 화면에 닿아 있는 손가락들 (핀치용) */
const touches = new Map<number, { x: number; y: number }>();
/** 핀치 기준 거리 — 이 비율을 넘을 때마다 배율을 한 단계 바꾼다 */
let pinchBase = 0;

function pinchDist() {
  const [a, b] = [...touches.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function bindInput() {
  cv.addEventListener('pointerdown', (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      // 두 손가락: 드래그·탭 대신 핀치
      pinchBase = pinchDist();
      drag = null;
      moved = true;
      return;
    }
    drag = { x: e.clientX, y: e.clientY, cx: view.cam.x, cy: view.cam.y };
    moved = false;
    cv.setPointerCapture?.(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && pinchBase > 0) {
      const r = pinchDist() / pinchBase;
      const P = CONFIG.view.pinchStep;
      if (r > P || r < 1 / P) {
        setZoom(S.zoom + (r > 1 ? 1 : -1));
        pinchBase = pinchDist();
      }
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > CONFIG.view.dragThreshold) moved = true;
    if (moved) {
      view.cam.x = drag.cx - dx / view.SC;
      view.cam.y = drag.cy - dy / view.SC;
      clampCam();
    }
  });
  const end = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinchBase = 0;
    const was = drag;
    drag = null;
    if (moved || !was || e.type === 'pointercancel') return;
    tap(e);
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
}

function tap(e: PointerEvent) {
  if (!S.started || isTalking()) return;
  if (placing.pl) {
    const [fx, fy] = toTile(cv, e.clientX, e.clientY);
    movePlacement(fx, fy);
    return;
  }
  const [mx, my] = toLogical(cv, e.clientX, e.clientY);
  // 캐릭터 먼저 (화면 거리)
  let best: (typeof world.actors)[number] | null = null;
  let bd = 1e9;
  for (const a of world.actors) {
    if (a.hidden || a.role === 'keeper') continue;
    const [X, Y] = scr(a.x, a.y);
    const d = Math.hypot(X - mx, Y - 14 - my);
    if (d < 12 && d < bd) {
      bd = d;
      best = a;
    }
  }
  if (best) {
    if (best.role === 'npc') {
      if (S.visiting) return;
      openReport();
    } else showActor(best);
    return;
  }
  const o = buildingAt(mx, my, alphaAt);
  if (o) showObj(o);
}

// ───────── 부팅 ─────────

async function boot() {
  const loading = document.getElementById('loading')!;
  await loadFonts();
  try {
    await loadAssets((p) => (loading.textContent = `불러오는 중… ${Math.round(p * 100)}%`));
  } catch (err) {
    loading.textContent = '그림을 불러오지 못했어요. 새로고침해 주세요.';
    console.error(err);
    return;
  }
  loading.remove();
  // 밤 색조 캐시를 조금씩 미리 만든다 (건물·나무 그림 + 캐릭터 프레임)
  const frames = (Object.keys(CLASSES) as ClassKey[]).flatMap((k) => {
    const f = charFrames(k);
    return [...f.idle, ...f.walk, ...f.walkB, ...f.idleB, ...f.sit, ...f.atk, ...f.pray];
  });
  queueTintWarmup([...Object.values(IMG), ...frames]);
  warmItemIcons();
  buildThumbs();

  // 배율은 기기마다 기억 (1·2·3 중 하나)
  const z = getPref<number>('zoom', CONFIG.view.defaultZoom);
  if (CONFIG.view.zooms.includes(z)) S.zoom = z;
  uiHooks.toast = toast;
  uiHooks.toastHtml = (html) => toastHtml(html, 2800);
  initWindows();
  initDialogue();
  initHud();
  initChat();
  setOnZoom(resize);
  setOnNamed(() => game.syncHud());
  onNightChange(() => game.syncHud());

  document.getElementById('tStart')!.onclick = () => {
    if (!(document.getElementById('tCont') as HTMLButtonElement).disabled && !confirm('새 여관을 열면 지금까지의 마을이 지워져요. 계속할까요?')) return;
    game.newGame();
  };
  document.getElementById('tCont')!.onclick = () => game.continueGame();
  addEventListener('keydown', (e) => {
    const title = document.getElementById('title')!;
    if (!title.hidden && !title.classList.contains('out') && (e.key === 'Enter' || e.key === 'z' || e.key === 'Z')) {
      const cont = document.getElementById('tCont') as HTMLButtonElement;
      if (!cont.disabled) game.continueGame();
      else game.newGame();
    }
  });

  addEventListener('resize', () => {
    clearTimeout((window as unknown as { __r: number }).__r);
    (window as unknown as { __r: number }).__r = window.setTimeout(resize, 150);
  });
  const saveNow = () => S.started && writeSave();
  addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveNow());

  bindInput();
  resize();
  game.refreshTitle();
  game.titleBackdrop();
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(frame);
  });

  // 개발 중 콘솔에서 살펴보기용
  if (import.meta.env.DEV) Object.assign(window, { __S: S, __world: world, __game: game, __view: view, __stats: stats, __recolored: recolored,
      // 화면이 숨어 rAF가 멈췄을 때 시험용: sec초를 60fps로 돌린다
      // 문 연출 시험용: 손님 a를 건물 o의 문 앞 칸에 세우고 들어가게 한다
      __enter: (a: (typeof world.actors)[number], o: (typeof world.objs)[number]) => {
        const [dx, dy] = doorOf(o);
        Object.assign(a, { x: dx, y: dy, hidden: false, path: null, door: null, party: false });
        enter(a, o);
      },
      __run: (sec: number) => {
        for (let i = 0; i < sec * 60; i++) tick(1 / 60);
      },
    });
}

boot();

// 홈 화면에 추가(PWA): 배포본에서만 서비스워커를 쓴다 (개발 서버에선 캐시가 방해된다)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
