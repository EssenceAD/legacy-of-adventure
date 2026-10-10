// 부팅, 루프(규칙 갱신 30fps / 그리기 rAF), 화면 입력(드래그·탭)
import './style.css';
import { CONFIG } from './data/config';
import { alphaAt, IMG, loadAssets, META, pumpTintWarmup, queueTintWarmup, recolored } from './engine/assets';
import { CLASSES, type ClassKey } from './data/classes';
import { charFrames, onNewFrames } from './engine/sprites';
import { clampCam, resizeCanvas, scr, toLogical, toTile, updateOrigin, view } from './engine/iso';
import * as game from './game';
import { writeSave } from './save/save';
import { enter, updActors } from './world/actors';
import { hourNow } from './world/clock';
import { blendNight, onNightChange, tickDayNight } from './world/daynight';
import { pendingEvents, pumpEvents } from './world/events';
import { posBubbles } from './world/fx';
import { buildingAt, renderFrame } from './world/render';
import { P, runJobs, S, takeDirty, uiHooks, world } from './world/state';
import { doorOf, placing } from './world/town';
import { initChat } from './ui/chat';
import { initDialogue, isTalking, setOnNamed } from './ui/dialogue';
import { initHud, movePlacement, setOnZoom, setZoom, syncZoomLabel, tickHud } from './ui/hud';
import { initScreen, screen, setOnScreenChange } from './ui/screen';
import { buildThumbs, initWindows, isWinOpen, openMenu, openReport, showObj, toast, toastHtml } from './ui/windows';
import { showActor } from './ui/guests';
import { showOffline, showReport } from './ui/expedition';
import { computeOffline } from './world/offline';
import { _raidAdvance } from './ui/raid';
import { announce, rumorNow } from './ui/chat';
import { initAuth, online } from './net/server';
import * as SRV from './net/server';
import * as SYNC from './net/sync';
import { checkLastWeek, dailyStats, startCloud } from './net/sync';
import { dailyOwner, nightOwner } from './world/owner';
import * as OWN from './world/owner';
import { powerOf } from './world/adventurers';
import { initOwnerUi, openOwner } from './ui/owner';
import { initKit } from './ui/kit';
import { initGuide } from './ui/guide';
import { gradeDev, startGradeAnim, stepGradeAnim } from './world/grade';
import { navHooks } from './ui/nav';
import { _huntAdvance, openHunt } from './ui/hunt';
import { openDex, openGoals } from './ui/book';
import { skipDone } from './world/guide';
import { afterLogin } from './ui/account';
import { loadServerNotices } from './ui/notice';
import { catchStar, checkRumors, dawnCheck, judgeNight, tickLegends } from './world/legends';
import { maybeAlarm } from './world/raid';
import { starHit } from './world/render';
import { floatW } from './world/fx';
import { talk } from './ui/dialogue';

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
  resizeCanvas(cv, host, S.zoom, screen.devicePx);
}

// ───────── 루프 ─────────

const STEP = CONFIG.loop.updateStep;
let acc = 0;
/** 지난 그리기 이후 흐른 시간 (창이 열리면 30fps로 묶어 그린다) */
let drawAcc = 0;
let saveClock = 0;
let shownHour = -1;
let wasStarted = false;
let last = 0;

function update(dt: number) {
  let t = performance.now();
  S.time += dt;
  runJobs();
  t = mark('jobs', t);
  updActors(dt);
  t = mark('actors', t);
  const busy = isWinOpen() || !!placing.pl || isTalking() || !!document.getElementById('raid');
  tickDayNight(dt);
  t = mark('daynight', t);
  if (!S.started) wasStarted = false;
  if (S.started) {
    // 마을이 처음 돌아가기 시작할 때 (새 게임·이어하기): 새벽 접속 · 이번 주 보스 경보 · 전설 소문 · 밤이면 방문 판정
    if (!wasStarted) {
      wasStarted = true;
      dawnCheck();
      maybeAlarm();
      checkRumors();
      if (S.night) judgeNight();
      // 4단계: 매일 첫 접속 능력치 · 계절 · 놓친 인연 이벤트 · 밤이면 불씨 독백/선택
      dailyOwner();
      if (S.night) nightOwner(true);
      // 5단계: 장부 — 이미 해 둔 일은 바로 완료
      skipDone();
    }
    // 단골 제안·케미 대화·원정 보고서: 다른 창이 없을 때 하나씩
    pumpEvents(busy);
    if (hourNow() !== shownHour) {
      shownHour = hourNow();
      if (!S.visiting) {
        tickLegends();
        maybeAlarm();
        dailyOwner();
        void dailyStats();
        void checkLastWeek();
      }
      game.syncHud();
    }
  }
  if (S.started && !S.visiting) {
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
  stepGradeAnim(dt);
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
/** 배치 중 유령 건물을 손가락으로 끄는 중 (카메라 대신 건물이 따라온다) */
let ghostDrag = false;

/** 화면 점이 배치 중인 유령 건물 위(근처)인가 */
function onGhost(clientX: number, clientY: number): boolean {
  const pl = placing.pl;
  if (!pl || pl.tx == null || pl.ty == null) return false;
  const [mx, my] = toLogical(cv, clientX, clientY);
  const [X, Y] = scr(pl.tx + pl.fw / 2, pl.ty + pl.fh / 2);
  const h = pl.sprite && META[pl.sprite] ? META[pl.sprite].h : 34;
  return Math.abs(mx - X) < pl.fw * 16 + 10 && my > Y - h && my < Y + pl.fh * 8 + 10;
}
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
    ghostDrag = onGhost(e.clientX, e.clientY);
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
    if (moved && ghostDrag) {
      // 건물이 손가락보다 살짝 위에 따라와서 손에 가리지 않게
      const [fx, fy] = toTile(cv, e.clientX, e.clientY - CONFIG.placement.dragLiftPx);
      movePlacement(fx, fy);
      return;
    }
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
    ghostDrag = false;
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
  // 운명의 별 (밤하늘 별똥별)
  if (starHit(mx, my)) {
    const msg = catchStar();
    if (msg) {
      toast(msg);
      floatW(7, 5, 60, '★ 운명의 별!', 'big');
    }
    return;
  }
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
    } else if (best.role === 'owner') openOwner();
    else showActor(best);
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
  buildThumbs();

  // 배율은 기기마다 기억 (1·2·3 중 하나)
  // 화면 크기 구간(폰·태블릿·넓은 화면) · 글자 크기 · 배율
  setOnScreenChange(() => {
    resize();
    syncZoomLabel();
  });
  initKit();
  initScreen();
  uiHooks.toast = toast;
  uiHooks.toastHtml = (html) => toastHtml(html, 2800);
  uiHooks.talk = talk;
  uiHooks.rumor = rumorNow;
  uiHooks.announce = announce;
  uiHooks.shake = () => {
    host.classList.remove('shake');
    void host.offsetWidth;
    host.classList.add('shake');
  };
  uiHooks.report = (run) => {
    if (!run.claimed) showReport(run);
  };
  game.setOfflineHook(showOffline);
  // 손님마다 새 겉모습이 생기면 밤 색조도 미리
  onNewFrames((f) => queueTintWarmup([...f.idle, ...f.walk, ...f.walkB, ...f.idleB, ...f.sit, ...f.atk, ...f.pray]));
  initWindows();
  initDialogue();
  initHud();
  initOwnerUi();
  initGuide();
  // 「가기」가 여는 창들 (순환 import를 피해 여기서 잇는다)
  Object.assign(navHooks, { hunt: () => openHunt(), goals: () => openGoals(), owner: () => openOwner(), dex: () => openDex(), menu: () => openMenu() });
  void initChat();
  // 서버: 남아 있는 로그인 이어서 → 저장 맞추기·쌓인 기록 올리기, 클라우드 저장 시작, 서버 공지
  void initAuth().then(() => (online() ? afterLogin() : undefined));
  startCloud();
  void loadServerNotices();
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
  if (import.meta.env.DEV) Object.assign(window, { __S: S, __world: world, __game: game, __view: view, __stats: stats, __recolored: recolored, __pending: pendingEvents, __P: P, __showObj: showObj,
      // 화면이 숨어 rAF가 멈췄을 때 시험용: sec초를 60fps로 돌린다
      // 문 연출 시험용: 손님 a를 건물 o의 문 앞 칸에 세우고 들어가게 한다
      __enter: (a: (typeof world.actors)[number], o: (typeof world.objs)[number]) => {
        const [dx, dy] = doorOf(o);
        Object.assign(a, { x: dx, y: dy, hidden: false, path: null, door: null, party: false });
        enter(a, o);
      },
      __raid: _raidAdvance,
      __srv: SRV,
      __sync: SYNC,
      __own: OWN,
      __hunt: _huntAdvance,
      __grade: (g: number) => (gradeDev.g = g),
      __gradeAnim: (a: number, b: number) => startGradeAnim(a, b),
      __step: (sec: number) => { for (let i = 0; i < sec * 60; i++) stepGradeAnim(1 / 60); },
      // 방치 시험: sec초 꺼져 있었던 것처럼 정산
      __offline: (sec: number) => {
        P.lastSeen = Date.now() - sec * 1000;
        const s = computeOffline();
        if (s) showOffline(s);
        return s;
      },
      __openHunt: openHunt,
      __power: powerOf,
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
