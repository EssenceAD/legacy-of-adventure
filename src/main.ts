// 부팅, 루프(규칙 갱신 30fps / 그리기 rAF), 화면 입력(드래그·탭)
import { openNotices } from './ui/notice';
import { kstDay } from './world/goldsink';
import { flag } from './world/flags';
import { loadFlags } from './world/flags';
import { vis } from './world/visual';
import { confirmSheet } from './ui/confirmSheet';
import { initHud2, initVisualClasses } from './ui/hud2';
import { nextRegionCut, openNewRegions } from './world/regions2';
import { initCommunity } from './ui/community';
import './style.css';
import { debugMythic, mythicProgress } from './world/mythic';
import { trueStarLine } from './ui/story';
import { flushGoldLog } from './world/economy';
import * as raidW from './world/raid';
import { putAway } from './world/store';
import { openStore } from './ui/decor';
import { makeCameo } from './world/easter';
import { addMail, claimMail, mailHooks } from './world/meta';
import { initEaster, openPioneerLetter, tapCameo } from './ui/easter';
import { overlayHold } from './ui/overlays';
import * as decodrop from './world/decodrop';
import { initLuxury } from './ui/luxury';
import { initOnboard, promiseTomorrow, tapFirstGuest } from './ui/onboard';
import { funnel } from './net/funnel';
import { dialogueHooks } from './ui/dialogue';
import { decorInput, enterDecor, initDecor } from './ui/decor';
import { highlightGo } from './ui/notice';
import { setNight as setNightHL } from './world/daynight';
import { openPlace as openPlaceHL } from './ui/nav';
import { decorView, UNDO_MAX } from './world/decor';
import { initPropCard } from './ui/propCard';
import { initStoryInbox } from './world/storyInbox';
import { chemTalk } from './world/chemNews';
import { proposeTalk } from './world/actors';
import { initGoalPill } from './ui/goalPill';
import { initStoryUI, playStory, tapYuan } from './ui/story';
import { cycleLines } from './world/story';
import { ripeCount } from './world/craft';
import { initFacilitiesUI } from './ui/facilities';
import { initGoldsinkUI } from './ui/goldsink';
import { initWayfindUI, wayfindHooks } from './ui/wayfind';
import { CONFIG } from './data/config';
import { alphaAt, assetMem, AssetError, breakSpriteForTest, drawFails, IMG, isFlipKey, loadAssets, spriteOk, META, pumpTintWarmup, recolored, tintWarmPending, warmTintLevel } from './engine/assets';
import { idleFor, noteInput, saverOn, takeKick } from './engine/fps';
import { shakeLv } from './engine/shake';
import { actionOf, VILLAGE_ACTIONS } from './engine/keys';
import { tapCon, tickCons } from './world/construct';
import { tour } from './world/evalTour';
import { anim as gradeAnim } from './world/grade';
import { lookMem } from './engine/sprites';
import { clampCam, N, resizeCanvas, scr, sx, sy, toLogical, toTile, updateOrigin, view } from './engine/iso';
import * as game from './game';
import { settleOfflineCons } from './game';
import { getPref, readSave, savesHalted, setPref, writeSave } from './save/save';
import { arrive, enter, fastHooks, queueChemTalk, queueProposal, updActors } from './world/actors';
import { hourNow } from './world/clock';
import { blendNight, NL, onNightChange, tickDayNight } from './world/daynight';
import { pendingEvents, pendingSide, pendingWith, pumpEvents, runFirstSide } from './world/events';
import { burstOn, posBubbles } from './world/fx';
import { buildingAt, renderFrame, renderMem, starInfo } from './world/render';
import { markDirty, P, runJobs, S, takeDirty, uiHooks, world } from './world/state';
import { def, type Kind } from './data/catalog';
import { addObj, autoEntranceX, canMoveKind, dungeonHome, capacity, doorOf, entrance, grid, landBounds, pathT, placing, rebuildPaths } from './world/town';
import { ground } from './world/ground';
import { initChat, openChat } from './ui/chat';
import { openBoard } from './ui/expedition';
import { initDialogue, isTalking, isTyping, setOnNamed } from './ui/dialogue';
import { cancelPlace, initHud, movePlacement, setOnZoom, setZoom, startMove, startMoveEntrance, startPlace, syncZoomLabel, tempZoom, tickHud } from './ui/hud';
import { hasZoomPref, initScreen, landZoom, screen, setOnScreenChange, zoomIdx, zoomsNow } from './ui/screen';
import { buildThumbs, initWindows, isWinOpen, openBuild, openLand, openReport, showObj, toast, toastHtml } from './ui/windows';
import { initMenu, openAttend, openGridMenu, openManual } from './ui/menu';
import { _abyss } from './ui/abyss';
import { _dice } from './ui/dice';
import { initHarmonyUI, openPropInfo } from './ui/harmony';
import { beginTour, initEvalUI, openEval, tickEval } from './ui/evaluation';
import { showSettlement, tickSettle } from './ui/daily';
import { betaMigrate, syncGuideIdx } from './world/beta';
import { initPowerUI, tickPowerUI } from './ui/power';
import { playTeaser, teaserCut, teaserOn, teaserTouchGate } from './teaser/director';
import { battleMusic, initSound, tickSound } from './ui/sound';
import { _fakeNewer, APP_VERSION, giftNote, initUpdate, loadPatchNotes, openPatchNotes } from './ui/update';
import { directionStarted, initDirection } from './ui/opsbox';
import { flush as flushTelemetry, initTelemetry, track as trackEv } from './net/telemetry';
import { setBusy } from './audio/scene';
import { hasSave, migrateFailed } from './save/save';
import { combatOn, foldedTick } from './combat/ui';
import { devAdvance as combatAdvance, devField as combatField, zoomInfo as combatZoom, combatFps } from './combat/ui';
import * as audioEngine from './audio/engine';
import * as audioMusic from './audio/music';
import * as audioSfx from './audio/sfx';
const sfx = audioSfx.sfx;
import { forceSpectacle, resolve as resolveSpectacle, spectacles, tapSpectacle, tickSpectacles } from './ui/spectacle';
import * as evalW from './world/evaluation';
import { checkDiscover, computeSets, harmonySets, tickHarmony } from './world/harmony';
import { propsNow } from './world/gradeDraw';
import { queueEvent } from './world/events';
import { checkParty4, checkSlot5, dailyAttend, updateGift, welcomeMail } from './world/meta';
import { showActor } from './ui/guests';
import { openPersonMenu } from './ui/personMenu';
import { initFishingUI } from './ui/fishing';
import { dailyFishing } from './world/fishing';
import { showOffline, showReport } from './ui/expedition';
import { computeOffline } from './world/offline';
import { _raidAdvance } from './ui/raid';
import { announce, rumorNow } from './ui/chat';
import { ensureGuest, initAuth, online } from './net/server';
import * as SRV from './net/server';
import * as SYNC from './net/sync';
import { checkLastWeek, dailyStats, haltCloud as _haltCloud, ownedByAccount, startCloud } from './net/sync';
import { dailyOwner, nightOwner } from './world/owner';
import * as OWN from './world/owner';
import { makeAdventurer, powerOf } from './world/adventurers';
import { initOwnerUi, openOwner } from './ui/owner';
import { initKit } from './ui/kit';
import { initGuide } from './ui/guide';
import { gradeDev, gradeProps, propKey, startGradeAnim, stepGradeAnim } from './world/grade';
import { navHooks } from './ui/nav';
import { _huntAdvance, deepDefeat, openHunt, settleFolded } from './ui/hunt';
import { openDex, openGoals } from './ui/book';
import { skipDone } from './world/guide';
import { afterLogin, openAccount } from './ui/account';
import { _delTest, openDelete } from './ui/accountDelete';
import { loadServerNotices } from './ui/notice';
import { catchStar, checkRumors, dawnCheck, judgeNight, showerLetter, starAvailable, tickLegends } from './world/legends';
import { showStarCard, syncStarMark } from './ui/starfall';
import { capture as photoCapture, enterPhoto, exitPhoto, frameRect, photoFrozen, photoOn, photoScale, saveBlob } from './ui/photo';
import { maybeAlarm } from './world/raid';
import { landHint, signHit, starHit } from './world/render';
import { floatW, puffAt } from './world/fx';
import { talk } from './ui/dialogue';
import { NEIGHBORS } from './data/neighbors';
import { say } from './world/fx';
import type { TalkLine } from './world/state';

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
  // 렌더 메모리: 마을 캔버스는 CSS 1px당 기기 픽셀 2배까지 (배터리 절약 1.5배) — 도트라 눈에 차이가 없다
  resizeCanvas(cv, host, S.zoom, screen.devicePx, saverOn() ? CONFIG.render.dprCapSaver : CONFIG.render.dprCap);
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
  if (!photoFrozen()) updActors(dt);
  t = mark('actors', t);
  // HOTFIX20 §2: 마을 화면에서 창·전투·대화·사진·이웃 방문·꾸미기가 없을 때만 대기 이벤트(단골 제안 등)를 꺼낸다
  const busy = isWinOpen() || !!placing.pl || isTalking() || !!document.getElementById('raid') || combatOn() || teaserOn() || photoOn() || !!S.visiting || decorView.on || overlayHold();
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
      dailyFishing();
      if (S.night) nightOwner(true);
      // 베타: v6 마이그레이션 (어울림 발견 보상 우편 · 장부 번호) → 장부 — 이미 해 둔 일은 바로 완료
      betaMigrate();
      syncGuideIdx();
      skipDone();
      // 5단계 2차: 운영자 선물(처음 한 번) · 출석 도장
      welcomeMail();
      checkSlot5(true);
      // PARTY §3: 사냥·토벌 4번째 자리 (훈련장 Lv5 + 장부)
      checkParty4();
      // DIRECTION §2-1: 운영자 답장 → 우편함 · 운영자 확인
      directionStarted();
      // HOTFIX14 §5: 업데이트 선물 (원래 하던 플레이어만 — 장부를 하나라도 받았거나 2일차 이상)
      //  지금 버전 이하에서 가장 새 선물 (그 버전을 건너뛰고 올라와도 받게 · 선물 버전으로 한 번만)
      void loadPatchNotes().then((n) => {
        // DIRECTION §3-1: 선물은 정기 업데이트에만 (kind: '핫픽스'면 건너뛴다)
        const g = giftNote(n, APP_VERSION);
        if (g) updateGift(g.version, g.gift, P.guide.claimed.length > 0 || S.day > 1);
      });
      settleOfflineCons();
      // STARFALL §2: 금요일이면 「내일 밤 유성우래요~」
      showerLetter();
      // ONBOARDING §1: 첫날(누적 1일)은 도장만 찍고 창은 띄우지 않는다 (첫 조작을 막지 않게)
      if ((dailyAttend() ?? 0) > 1) queueEvent(() => openAttend(), 'attend');
    }
    // 단골 제안·케미 대화·원정 보고서: 다른 창이 없을 때 하나씩
    pumpEvents(busy);
    if (hourNow() !== shownHour) {
      shownHour = hourNow();
      if (!S.visiting) {
        tickLegends();
        maybeAlarm();
        dailyOwner();
        dailyFishing();
        // ONBOARDING §1: 첫날(누적 1일)은 도장만 찍고 창은 띄우지 않는다 (첫 조작을 막지 않게)
      if ((dailyAttend() ?? 0) > 1) queueEvent(() => openAttend(), 'attend');
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

// ───────── 핫픽스 11: 마을 그리기 간격 ─────────
let hudAcc = 0;
/** 화면에 움직이는 연출이 있는가 (있으면 손 안 대도 idle로 내리지 않는다) */
const visualBusy = () => isTyping() || tour.on || spectacles.length > 0 || burstOn() || !!placing.pl || gradeAnim.on;
function drawStep(winOpen: boolean): number {
  const L = CONFIG.loop;
  let fps: number;
  if (teaserOn()) fps = saverOn() ? L.drawFpsBattleSaver : L.drawFpsBattle;
  else {
    const idle = idleFor() >= L.idleAfterSec && !visualBusy();
    fps = saverOn() ? (idle ? L.drawFpsSaverIdle : L.drawFpsSaver) : idle ? L.drawFpsIdle : L.drawFpsVillage;
    if (winOpen) fps = Math.min(fps, 30);
  }
  // 0.002 = rAF 흔들림 여유
  return 1 / fps - 0.002;
}
/** 마을이 안 보이는가: 전투·토벌 화면이 덮고 있거나, 창이 화면 거의 전부를 덮을 때 (0.5초마다 잰다) */
let coverAt = 0;
let covered = false;
function villageCovered(): boolean {
  const now = performance.now();
  if (now - coverAt < 500) return covered;
  coverAt = now;
  if (combatOn() || document.getElementById('raid') || document.getElementById('hunt')) covered = true;
  else if (isWinOpen()) {
    const w = document.getElementById('win')!.getBoundingClientRect();
    const v = cv.getBoundingClientRect();
    covered = w.width * w.height >= v.width * v.height * CONFIG.loop.coverRatio;
  } else covered = false;
  return covered;
}
/** 모드가 바뀌었을 때 (전투를 닫았다 등) 바로 다시 재게 */
export const recheckCover = () => (coverAt = 0);

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  tick(dt);
  requestAnimationFrame(frame);
}

let conAcc = 0;
function tick(dt: number) {
  // 핫픽스 10 §13: 접어 둔 사냥은 마을 시간대로 마저 진행
  foldedTick(dt);
  stepGradeAnim(dt);
  tickHarmony(dt);
  tickEval(dt);
  tickSettle(dt);
  tickSpectacles(dt);
  tickPowerUI(dt);
  // CONSTRUCTION_SPEC: 끝난 공사 마무리 (0.5초마다)
  conAcc += dt;
  if (conAcc > 0.5 && S.started) {
    conAcc = 0;
    tickCons();
    // BUILDINGS_SPEC §3: 하단 「마을」에 수확할 수 있는 수
    const rc = S.visiting ? 0 : ripeCount();
    const vb = document.getElementById('bVillage');
    if (vb) {
      let bd = vb.querySelector<HTMLElement>('.rbadge');
      if (!bd) {
        bd = document.createElement('i');
        bd.className = 'rbadge';
        vb.appendChild(bd);
      }
      bd.hidden = !rc;
      bd.textContent = String(rc);
    }
    // STARFALL §1: 밤 버튼 옆 ★ · 별똥별이 처음 뜬 밤에 모모가 한 번 알려 준다
    syncStarMark();
    if (!P.meta.starHint && starAvailable() && !S.visiting) {
      P.meta.starHint = true;
      markDirty();
      queueEvent(() => talk([['post', '사장님, 밤하늘 보세요! 별똥별을 누르면 전설 영웅과의 인연이 깊어진대요!']]), 'starHint');
    }
  }
  tickSound(dt);
  const t0 = performance.now();
  let t = t0;
  // 땅 개편: 넓힌 뒤 카메라가 새 땅 가운데로 부드럽게
  if (view.goal) {
    const k = Math.min(1, dt * 3);
    view.cam.x += (view.goal.x - view.cam.x) * k;
    view.cam.y += (view.goal.y - view.cam.y) * k;
    if (Math.abs(view.goal.x - view.cam.x) + Math.abs(view.goal.y - view.cam.y) < 0.5) view.goal = null;
    clampCam();
  }
  // 규칙은 고정 간격(30fps)으로
  acc = Math.min(acc + dt, 0.25);
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  t = mark('update', t);
  // 핫픽스 11: 그리기 상한 — 마을 30 · 손 안 댄 지 1분 15 · 배터리 절약 20/10 · 창 열림 30 이하
  //  입력이 들어온 프레임은 바로 그린다 · 마을이 전부 가려져 있으면(전투·토벌·큰 창) 그리지 않는다
  drawAcc += dt;
  const winOpen = isWinOpen();
  const kicked = takeKick();
  if (villageCovered()) {
    // 그리기는 쉬지만 HUD 일(자동 사냥 · 원정 띠 · 타이머)은 0.5초마다 그대로
    hudAcc += dt;
    if (hudAcc >= 0.5) {
      hudAcc = 0;
      tickHud();
    }
    drawAcc = Math.min(drawAcc, 0.25);
    return;
  }
  if (!kicked && drawAcc < drawStep(winOpen)) return;
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
  // 밤 색조: 낮↔밤이 넘어가는 중이면 다음 단계를 미리 (창이 열려 있는 동안엔 쉰다 · 다 만들었으면 부르지도 않는다)
  const goalNL = S.night ? CONFIG.dayNight.tintSteps : 0;
  warmTintLevel(NL === goalNL ? -1 : NL + Math.sign(goalNL - NL));
  if (!winOpen && tintWarmPending()) pumpTintWarmup(3);
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
/** 핫픽스 v0.23.4: 누른 시각 · 핀치 있었나 · 마지막 탭(이동 px, 누른 ms) */
let downAt = 0;
let pinchUsed = false;
let lastTapInfo: [number, number] = [0, 0];
/** 놓친 탭 기록 (기기당 하루 30개까지) */
function tapMiss(dist: number, ms: number, why: 'moved' | 'pinch' | 'nohit') {
  try {
    const k = 'tapMiss:' + kstDay();
    const n = +(localStorage.getItem(k) ?? 0);
    if (n >= CONFIG.touchTap.missLogPerDay) return;
    localStorage.setItem(k, String(n + 1));
  } catch {
    return;
  }
  trackEv('tap_miss', { px: Math.round(dist), ms: Math.round(ms), why });
}
/** 핀치 기준 거리 — 이 비율을 넘을 때마다 배율을 한 단계 바꾼다 */
let pinchBase = 0;
/** TOWN T2: 꾸미기 붓질·범위 고르기 중 */
let decorDrag = false;

function pinchDist() {
  const [a, b] = [...touches.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** BUILDUX §2-1: 꾸미기 모드에서 꾹 누르기(0.4초) = 들기 */
let lpTimer = 0;
/** 마지막으로 누른 손가락 종류 (mouse · touch · pen) */
let lastPtrType = '';
/** BUILDUX §1-5: 들고 끄는 중 마지막 손가락 자리 (가장자리 자동 스크롤) */
let lastPtr: [number, number] | null = null;
let edgeRaf = 0;
function edgeLoop() {
  cancelAnimationFrame(edgeRaf);
  const step = () => {
    if (!ghostDrag || !lastPtr || !placing.pl) return;
    const r = cv.getBoundingClientRect();
    const E = 44;
    const [x, y] = lastPtr;
    const vx = x < r.left + E ? -1 : x > r.right - E ? 1 : 0;
    const vy = y < r.top + E + 40 ? -1 : y > r.bottom - E - 160 ? 1 : 0;
    if (vx || vy) {
      view.cam.x += (vx * 5) / view.SC;
      view.cam.y += (vy * 5) / view.SC;
      clampCam();
      if (drag) {
        // 끌기 기준도 같이 밀어 카메라가 손가락을 따라 되돌아가지 않게
        drag.cx = view.cam.x;
        drag.cy = view.cam.y;
      }
      const [fx, fy] = toTile(cv, x, y - CONFIG.placement.dragLiftPx);
      movePlacement(fx, fy);
    }
    edgeRaf = requestAnimationFrame(step);
  };
  edgeRaf = requestAnimationFrame(step);
}
/**
 * 꾹 누른 곳의 건물·장식을 든다.
 *  FEEDBACK23 §2: 예전엔 손가락 아래 「바닥 칸」만 봤다 → 키 큰 건물은 지붕·벽을 누르면 그 아래 칸이 뒤쪽 빈 칸이라 안 들렸다
 *  (태블릿 가로에서 건물이 작게 보여 더 자주). 이제 탭과 같은 그림 판정(투명 픽셀 빼고 앞 건물부터)을 먼저, 없으면 바닥 칸
 *  · 던전 입구도 옮길 수 있다 (§4) · 울타리 앞 입구 칸을 꾹 = 마을 입구 옮기기 (§5)
 */
function liftAt(clientX: number, clientY: number): boolean {
  if (S.visiting) return false;
  const [fx, fy] = toTile(cv, clientX, clientY);
  const [mx, my] = toLogical(cv, clientX, clientY);
  const o = buildingAt(mx, my, alphaAt) ?? grid[Math.floor(fy)]?.[Math.floor(fx)];
  if (!o) {
    const [ex, ey] = entrance();
    if (Math.floor(fx) !== ex || Math.floor(fy) !== ey) return false;
    startMoveEntrance();
  } else if (!canMoveKind(o.kind)) return false;
  else startMove(o);
  ghostDrag = true;
  moved = true;
  lastPtr = [clientX, clientY];
  navigator.vibrate?.(15);
  edgeLoop();
  return true;
}

/** 핫픽스: 안드로이드 크롬·PWA·삼성 인터넷 — 길게 누르면 뜨는 이미지/링크 메뉴와 끌기 막기 (글 입력·복사할 곳은 제외) */
const SELECTABLE = 'input, textarea, [contenteditable], .mails, .rcode, .selectable';
const editable = (t: EventTarget | null) => t instanceof Element && !!t.closest(SELECTABLE);
document.addEventListener('contextmenu', (e) => {
  if (!editable(e.target)) e.preventDefault();
});
document.addEventListener('dragstart', (e) => {
  if (!editable(e.target)) e.preventDefault();
});

function bindInput() {
  // BUILDUX §5: 오른쪽 클릭 = 취소 (배치 · 꾸미기 끌기)
  cv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // FEEDBACK23 §2: 안드로이드(태블릿)는 손가락을 꾹 누르면 contextmenu가 온다 → 방금 꾹 눌러 든 건물을 바로 내려놓지 않게 (마우스 오른쪽 클릭만 취소)
    if (lastPtrType === 'touch' || lastPtrType === 'pen' || (e as PointerEvent).pointerType === 'touch') return;
    if (placing.pl) cancelPlace(true);
    else if (decorView.on) decorInput.cancel();
  });
  // BUILDUX §5: 마우스 휠 줌 (마을)
  let wheelAcc = 0;
  cv.addEventListener(
    'wheel',
    (e) => {
      if (!S.started || combatOn()) return;
      e.preventDefault();
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) < 80) return;
      const zs = zoomsNow();
      const i = zoomIdx(S.zoom, zs);
      const n = zs[Math.max(0, Math.min(zs.length - 1, i + (wheelAcc < 0 ? 1 : -1)))];
      wheelAcc = 0;
      if (n != null && n !== S.zoom) setZoom(n);
    },
    { passive: false },
  );
  cv.addEventListener('pointerdown', (e) => {
    lastPtrType = e.pointerType;
    if (e.button === 2) return;
    // HOTFIX14 §4: 운명의 별은 누르는 순간에 판정 (떼는 사이 별이 지나가거나 드래그로 바뀌지 않게)
    if (!placing.pl && touches.size === 0) {
      const [mx, my] = toLogical(cv, e.clientX, e.clientY);
      if (starHit(mx, my)) {
        catchStarAt(e);
        drag = null;
        moved = true;
        return;
      }
    }
    // 핫픽스: 새 첫 손가락이면 남아 있던 포인터를 비운다 (핀치로 오인 방지)
    if (flag('tapV2') && e.isPrimary) touches.clear();
    downAt = performance.now();
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      // TOWN T2: 꾸미기 붓질 중 두 번째 손가락이 닿으면 붓질을 끝내고 핀치
      if (decorDrag) {
        decorDrag = false;
        decorInput.up();
      }
      // 두 손가락: 드래그·탭 대신 핀치
      pinchBase = pinchDist();
      pinchUsed = true;
      drag = null;
      moved = true;
      return;
    }
    // TOWN T2: 꾸미기 모드(손 도구가 아닐 때)는 끌기 = 칠하기·범위 고르기·무리 옮기기
    if (!placing.pl && decorInput.wants(e.shiftKey)) {
      const [fx, fy] = toTile(cv, e.clientX, e.clientY);
      decorDrag = true;
      drag = null;
      moved = true;
      decorInput.down(fx, fy, e.clientX, e.clientY, e.shiftKey);
      cv.setPointerCapture?.(e.pointerId);
      return;
    }
    drag = { x: e.clientX, y: e.clientY, cx: view.cam.x, cy: view.cam.y };
    moved = false;
    pinchUsed = false;
    ghostDrag = onGhost(e.clientX, e.clientY);
    if (ghostDrag) {
      lastPtr = [e.clientX, e.clientY];
      edgeLoop();
    }
    cv.setPointerCapture?.(e.pointerId);
    // BUILDUX §2-1: 꾸미기 모드(손 도구)에서 0.4초 꾹 = 들기 (밖에서는 손님 누르기와 겹치므로 안 함)
    clearTimeout(lpTimer);
    if (decorView.on && !placing.pl && touches.size === 1) {
      const [x0, y0] = [e.clientX, e.clientY];
      lpTimer = window.setTimeout(() => {
        if (drag && (!moved || Math.abs(drag.cx - view.cam.x) + Math.abs(drag.cy - view.cam.y) <= CONFIG.feedback23.longPressSlopPx / view.SC) && decorView.on && !placing.pl) {
          // 흔들려 조금 밀린 화면은 제자리로
          view.cam.x = drag.cx;
          view.cam.y = drag.cy;
          liftAt(x0, y0);
        }
      }, CONFIG.placement.longPressMs);
    }
  });
  cv.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && pinchBase > 0) {
      const r = pinchDist() / pinchBase;
      const P = CONFIG.view.pinchStep;
      if (r > P || r < 1 / P) {
        // 핀치: 배율 목록에서 한 칸씩 (×0.5 포함)
        const zs = zoomsNow();
        const i = zoomIdx(S.zoom, zs);
        setZoom(zs[Math.max(0, Math.min(zs.length - 1, (i < 0 ? 0 : i) + (r > 1 ? 1 : -1)))]);
        pinchBase = pinchDist();
      }
      return;
    }
    if (decorDrag || (decorInput.wants() && e.pointerType === 'mouse')) {
      const [fx, fy] = toTile(cv, e.clientX, e.clientY);
      decorInput.move(fx, fy, e.clientX, e.clientY);
      if (decorDrag) return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    // 핫픽스: 터치는 엄지 흔들림을 끌기로 보지 않게 (마우스는 그대로)
    const touchTap = flag('tapV2') && e.pointerType === 'touch';
    if (touchTap ? Math.hypot(dx, dy) >= CONFIG.touchTap.slopPx : Math.abs(dx) + Math.abs(dy) > CONFIG.view.dragThreshold) moved = true;
    // FEEDBACK23 §2: 꾹 누르는 동안 손가락이 조금 흔들려도(태블릿) 들기는 그대로 — 그 이상 끌면 둘러보기
    if (moved && !ghostDrag && Math.abs(dx) + Math.abs(dy) > CONFIG.feedback23.longPressSlopPx) clearTimeout(lpTimer);
    if (ghostDrag) lastPtr = [e.clientX, e.clientY];
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
    if (decorDrag) {
      decorDrag = false;
      decorInput.up();
      return;
    }
    clearTimeout(lpTimer);
    const was = drag;
    drag = null;
    ghostDrag = false;
    lastPtr = null;
    if (flag('tapV2') && e.pointerType === 'touch' && was) {
      const dist = Math.hypot(e.clientX - was.x, e.clientY - was.y);
      const ms = performance.now() - downAt;
      if (e.type === 'pointercancel' || pinchUsed) return tapMiss(dist, ms, 'pinch');
      if (dist >= CONFIG.touchTap.slopPx || ms >= CONFIG.touchTap.maxMs) return moved ? tapMiss(dist, ms, 'moved') : undefined;
      // 조금 밀린 화면은 제자리로 돌리고 탭
      view.cam.x = was.cx;
      view.cam.y = was.cy;
      lastTapInfo = [dist, ms];
      tap(e);
      return;
    }
    if (moved || !was || e.type === 'pointercancel') return;
    tap(e);
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  // 핫픽스: 포인터를 놓쳐도 지워 둔다 (남은 포인터 때문에 핀치로 오인 방지)
  const drop = (e: PointerEvent) => {
    if (!flag('tapV2')) return;
    touches.delete(e.pointerId);
    if (touches.size < 2) pinchBase = 0;
  };
  cv.addEventListener('lostpointercapture', drop);
  cv.addEventListener('pointerleave', drop);
}

/** 별 잡기: 글씨는 누른 자리(타일)에 — 예전엔 고정 타일 (7,5)라 넓어진 맵에선 숲 속에 떴다 */
function catchStarAt(e: PointerEvent) {
  const c = catchStar();
  if (!c) return;
  const [fx, fy] = toTile(cv, e.clientX, e.clientY);
  floatW(fx, fy, 30, '★ 운명의 별!', 'big');
  sfx('rare');
  showStarCard(c);
  trackEv('star_catch', { key: c.key, add: c.add, shower: c.shower });
  // STORY_V1: 2회차부터 첫 별에 모모의 기억 대사
  const cy = cycleLines('firstStar');
  if (cy) playStory(cy);
  // STORY v3: 진 엔딩 뒤 — 모모 혼잣말 (하루 한 번)
  else {
    const tl = trueStarLine();
    if (tl) playStory(tl);
  }
}

function tap(e: PointerEvent) {
  if (!S.started || isTalking()) return;
  if (placing.pl) {
    const [fx, fy] = toTile(cv, e.clientX, e.clientY);
    movePlacement(fx, fy);
    return;
  }
  // FEEDBACK: 꾸미기 「옮기기」(손 도구)에서는 건물을 짧게 눌러도 바로 집는다 (꾹 누르기와 같음 · 정보 창 대신)
  if (decorView.on && !S.visiting) {
    const [tmx, tmy] = toLogical(cv, e.clientX, e.clientY);
    const ob = buildingAt(tmx, tmy, alphaAt);
    if (ob && canMoveKind(ob.kind)) return startMove(ob);
  }
  const [mx, my] = toLogical(cv, e.clientX, e.clientY);
  // 땅 개편: 땅 넓히기 팻말
  if (!S.visiting && signHit(mx, my)) return openLand();
  // 운명의 별 (밤하늘 별똥별) — 보통은 pointerdown 에서 이미 잡는다
  if (starHit(mx, my)) return catchStarAt(e);
  // 베타: 구경거리 사건 (이모트 · 사건 사람)
  if (!S.visiting && tapSpectacle(mx, my)) return;
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
  // 핫픽스: 건물과 겹친 자리면 손님은 아주 가까울 때(8px)만 먼저
  if (best && flag('tapV2') && bd >= CONFIG.touchTap.actorFirstPx && lastPtrType === 'touch' && buildingAt(mx, my, alphaAt)) best = null;
  if (best) {
    // GROWTH §2: 사람을 누르면 작은 메뉴 [말 걸기] [선물하기] (모모는 + 편지 · 손님은 + 정보)
    if (best.role === 'npc') {
      if (S.visiting) return;
      openPersonMenu(best, e.clientX, e.clientY);
    } else if (best.role === 'owner') openOwner();
    // ONBOARDING §2: 첫 손님은 누르면 체크인
    else if (tapFirstGuest(best)) return;
    // STORY_V1: 후계자 유안 — 말을 걸면 엔딩
    else if (best.role === 'yuan') tapYuan();
    // EASTER §2: 놀러 온 개척자 — 누르면 대사 하나씩
    else if (tapCameo(best)) return;
    else if (!S.visiting && best.id) openPersonMenu(best, e.clientX, e.clientY);
    else showActor(best);
    return;
  }
  let o = buildingAt(mx, my, alphaAt);
  // 핫픽스: 그림 판정에 안 걸리면 바닥 칸의 건물로 한 번 더 (꾹 눌러 들기와 같은 방식)
  if (!o && flag('tapV2')) {
    const [gx, gy] = toTile(cv, e.clientX, e.clientY);
    o = grid[Math.floor(gy)]?.[Math.floor(gx)] ?? null;
  }
  // CONSTRUCTION_SPEC §4: 공사 중인 건물을 톡톡 → 1초씩 빨리 (한도까지 줄이면 그다음 탭은 창)
  if (o && o.con && !S.visiting && tapCon(o)) {
    audioSfx.sfx('tap', { vol: 0.5 });
    floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 50 + Math.random() * 20, '뚝딱! −1초');
    puffAt(o, '#efe2c6', 3);
    return;
  }
  if (o) return showObj(o);
  // 베타: 울타리 밖 마을 등급 장식 → 마을 안으로 옮기기
  const [fx, fy] = toTile(cv, e.clientX, e.clientY);
  const pr = propsNow().find((p) => fx >= p.x && fx < p.x + p.fw && fy >= p.y && fy < p.y + p.fh);
  if (pr) return openPropInfo(pr);
  // 핫픽스: 아무것도 안 걸린 터치 탭 기록 (원인 확인용)
  if (flag('tapV2') && e.pointerType === 'touch') tapMiss(lastTapInfo[0], lastTapInfo[1], 'nohit');
}

// ───────── 부팅 ─────────

// ───────── 핫픽스 13: 그림 불러오기 실패 ─────────
const RELOAD_FLAG = 'legacy-asset-reload';
/** 실패한 파일을 기록(부팅 전이라도 바로 보냄) → 처음이면 한 번 자동 새로고침 → 또 실패면 오류 화면 + 「다시 시도」(SW 캐시 비우고 새로고침) */
function bootFailed(loading: HTMLElement, err: unknown) {
  const url = err instanceof AssetError ? err.url.replace(/^.*?assets\//, 'assets/').slice(0, 120) : String(err).slice(0, 120);
  let again = false;
  try {
    again = sessionStorage.getItem(RELOAD_FLAG) === '1';
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    again = true;
  }
  trackEv('error', { msg: 'asset_load', url, again });
  flushTelemetry();
  if (!again) {
    loading.textContent = '새 버전을 준비하는 중…';
    setTimeout(() => location.reload(), 600);
    return;
  }
  loading.innerHTML = '<p>그림을 불러오지 못했어요.</p><button id="bootRetry" class="bigbtn">다시 시도</button>';
  document.getElementById('bootRetry')!.onclick = async () => {
    loading.textContent = '다시 불러오는 중…';
    try {
      for (const k of await caches.keys()) await caches.delete(k);
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      /* 무시 */
    }
    location.reload();
  };
}

async function boot() {
  const loading = document.getElementById('loading')!;
  const t0 = performance.now();
  await loadFonts();
  // ONBOARDING §3: 진행 막대 + 팁 한 줄
  const TIPS = ['손님을 누르면 체크인!', '모닥불 곁에 손님들이 모여요', '장부의 할 일을 따라가면 마을이 커져요', '밤하늘 별똥별을 눌러 보세요'];
  const tip = TIPS[(Math.random() * TIPS.length) | 0];
  try {
    await loadFlags();
    await loadAssets((p) => (loading.innerHTML = `<div class="lbar"><i style="width:${Math.round(p * 100)}%"></i></div><small>불러오는 중… ${Math.round(p * 100)}%</small><small class="tip">${tip}</small>`));
  } catch (err) {
    console.error(err);
    return bootFailed(loading, err);
  }
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* 무시 */
  }
  loading.remove();
  // ONBOARDING §0: 그림 로딩 끝
  funnel('boot_ok', { loadMs: Math.round(performance.now() - t0) });
  // 렌더 메모리: 밤 색조는 모든 그림 × 10단계를 미리 만들지 않는다 — 그릴 때 만들고, 낮↔밤이 넘어갈 땐 다음 단계만 조금씩 (frame())
  buildThumbs();

  // 배율은 기기마다 기억 (1·2·3 중 하나)
  // 화면 크기 구간(폰·태블릿·넓은 화면) · 글자 크기 · 배율
  setOnScreenChange(() => {
    resize();
    syncZoomLabel();
  });
  initKit();
  // VISUAL 실험실 §4·§5: 켠 기기만 body.hud2 / body.ui2 (글자 크기 변수보다 먼저)
  initVisualClasses();
  initScreen();
  uiHooks.toast = toast;
  uiHooks.toastHtml = (html) => toastHtml(html, 2800);
  uiHooks.talk = talk;
  uiHooks.rumor = rumorNow;
  uiHooks.announce = announce;
  uiHooks.shake = () => {
    // 핫픽스 11: 배터리 절약이면 화면 흔들림 끔 · HOTFIX15: 설정(끔 기본 / 약하게 / 보통)
    const lv = shakeLv();
    if (lv === 'off') return;
    host.classList.remove('shake', 'low');
    void host.offsetWidth;
    host.classList.add('shake');
    if (lv === 'low') host.classList.add('low');
  };
  uiHooks.report = (run) => {
    if (!run.claimed) showReport(run);
  };
  game.setOfflineHook(showOffline);
  initWindows();
  initDialogue();
  initHud();
  initOwnerUi();
  // STORY_V1: 막 · 갈림길 · 엔딩
  initStoryUI();
  initCommunity();
  // TOWN T2: 꾸미기 모드
  initDecor();
  // ONBOARDING: 첫 손님·장부 1장 뒤 출신 고르기·내일 선물 (장부 hook 다음에)
  initOnboard();
  dialogueHooks.skip = (tag, i) => tag === 'opening' && funnel('opening_skip', { line: i });
  // HOTFIX18 §4: 「새로 생긴 것」 카드의 [해 보기]
  Object.assign(highlightGo, { decor: enterDecor, photo: enterPhoto, night: () => setNightHL(true), build: openBuild, village: () => openPlaceHL('village'), hunt: () => openHunt() });
  // HOTFIX16: 단골 제안 손님 카드 · 오늘의 목표 알약
  initPropCard();
  // CHECKIN §A2: 이벤트 줄에 「모아 보기」 정책 (플래그·설정은 그때그때 읽는다)
  initStoryInbox();
  if (import.meta.env.DEV) Object.assign(window, { __inbox: { propose: queueProposal, chem: chemTalk, pending: pendingSide, run: runFirstSide, events: pendingEvents } });
  initGoalPill();
  initGuide();
  // 「가기」가 여는 창들 (순환 import를 피해 여기서 잇는다)
  Object.assign(navHooks, { hunt: () => openHunt(), goals: () => openGoals(), owner: () => openOwner(), dex: () => openDex(), menu: () => openGridMenu(), eval: () => openEval() });
  initMenu();
  initHarmonyUI();
  // BUILDINGS_SPEC: 새 기능 건물 효과 줄 · 연금술 공방 (어울림 줄 다음에 덧붙인다)
  initFacilitiesUI();
  // GOLDSINK: 연금술 「변환」 탭 · 예배당 「축복 받기」 (시설 줄 다음)
  initGoldsinkUI();
  initWayfindUI();
  wayfindHooks.hunt = (r) => openHunt(r);
  wayfindHooks.manual = () => openManual();
  initFishingUI();
  // DECO_DROP §2: 뽐내기 장식 (영웅 동상 · 불꽃놀이 · 시계탑 종) — 건물 창 덧붙이기는 어울림·시설 뒤에
  initLuxury();
  // EASTER: 베타 개척자 (금빛 편지 · 카메오 · 전용 장식)
  initEaster();
  mailHooks.pioneer = openPioneerLetter;
  initEvalUI();
  initPowerUI();
  // VISUAL §4 새 HUD (실험실 · 끄면 아무것도 안 함)
  initHud2();
  initSound();
  void initChat();
  // DIRECTION §2: 함께 만든 사람들 · 승인된 소문 · 로그인하면 답장 배달 (서버 함수가 없으면 조용히 없음)
  initDirection();
  // 서버: 남아 있는 로그인 이어서 → 저장 맞추기·쌓인 기록 올리기, 클라우드 저장 시작, 서버 공지
  // GUEST_SPEC §1: 로그인이 없으면 게임을 시작한 뒤 조용히 게스트 계정 → 이 기기 저장·마을을 올린다 (서버 저장이 없는 새 계정이라 덮어쓸 일 없음)
  //  다른 계정 저장인 기기(로그인 만료)·직접 로그아웃한 기기는 건너뛴다
  void initAuth().then(() => {
    if (online()) return void afterLogin();
    const tryGuest = window.setInterval(() => {
      if (!S.started || S.visiting) return;
      clearInterval(tryGuest);
      if (online() || ownedByAccount() || getPref<boolean>('guestOff', false)) return;
      void ensureGuest(S.innName).then((ok) => {
        if (ok) void afterLogin(true);
      });
    }, 3000);
  });
  startCloud();
  void loadServerNotices();
  setOnZoom(resize);
  setOnNamed(() => game.syncHud());
  onNightChange(() => game.syncHud());

  document.getElementById('tLetter')!.onclick = () => openReport();
  // 핫픽스 7 (8-2·8-3): 새 버전 확인 · 타이틀 아래 「v… · 패치노트」
  game.resumeHooks.folded = () => void settleFolded();
  // 땅 개편 §5: 땅에 맞춘 배율 — 넓히면 한 단계 멀어진다 · 처음(고른 배율 없음)엔 땅 크기에 맞춰
  game.camHooks.fit = (expand) => {
    const z = landZoom();
    if (expand) {
      if (z < S.zoom) setZoom(z);
    } else if (!hasZoomPref() && z !== S.zoom) tempZoom(z);
  };
  // 핫픽스 11 §5: 1분마다 성능 기록 한 줄 · §4: 폰에서 20분 넘게 하면 배터리 절약 안내 (계정당 1번)
  let perfPrev = { f: stats.frames, w: stats.work };
  let playMin = 0;
  setInterval(() => {
    if (document.hidden) {
      perfPrev = { f: stats.frames, w: stats.work };
      return;
    }
    const f = stats.frames - perfPrev.f;
    const w = stats.work - perfPrev.w;
    perfPrev = { f: stats.frames, w: stats.work };
    if (!S.started) return;
    // ECONOMY §1: 어제 금화 출처 집계 보내기
    flushGoldLog();
    // PARTY §3: 훈련장·장부가 조건을 채웠으면 (1분마다 · 이웃 방문 중엔 기다림)
    if (!S.visiting) checkParty4();
    playMin++;
    // ONBOARDING §0·§4: 5분 버팀 · 첫 세션이면 「내일 또 오시면 선물!」
    if (playMin === 5) {
      funnel('min5');
      if ((P.meta.attend?.total ?? 0) <= 1) promiseTomorrow();
    }
    const ua = navigator.userAgent;
    const kind = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop';
    trackEv('perf', { fps: Math.round((f / 60) * 10) / 10, workMs: Math.round((w / Math.max(1, f)) * 100) / 100, saver: saverOn(), dpr: Math.round(devicePixelRatio * 10) / 10, kind });
    if (kind !== 'desktop' && playMin >= 20 && !P.saverHint && !saverOn()) {
      P.saverHint = true;
      markDirty();
      toast('모모: 폰이 따끈하면 설정에서 배터리 절약을 켜 보세요~');
    }
  }, 60000);
  // 핫픽스 11: 입력이 들어오면 idle에서 바로 깨어나 그 프레임에 그린다
  for (const ev of ['pointerdown', 'wheel', 'keydown'] as const) addEventListener(ev, noteInput, { capture: true, passive: true });
  // 핫픽스 10 §15-3: 방이 늘었을 때 모모 한 줄 (계정당 처음 2번)
  fastHooks.roomUp = () => setTimeout(() => toast('모모: 방이 늘었어요! 기분 좋게 묵은 손님이 곧 단골을 청할 거예요~'), 2600);
  initUpdate(() => combatOn() || isTalking());
  // 핫픽스 8 (2-9): 전투·티저 중엔 마을 소리·알림을 미룬다
  setBusy(() => combatOn() || teaserOn());
  // 밤샘 ④-3: 플레이 기록 (설정에서 끌 수 있음)
  initTelemetry(!hasSave());
  // 땅 개편: 옛 저장을 새 땅으로 옮기지 못했으면 알린다 (원본은 .bak 에 남아 있다)
  if (migrateFailed) setTimeout(() => toast('예전 저장을 새 땅으로 옮기지 못했어요 · 원본은 백업해 두었어요 · 모모에게 편지로 알려 주세요'), 1500);
  const ver = document.getElementById('tVer');
  if (ver) {
    ver.textContent = `v${APP_VERSION} · 패치노트`;
    ver.onclick = () => void openPatchNotes();
  }
  document.getElementById('tStart')!.onclick = async () => {
    funnel('title_tap');
    // J4 confirmSheet: 마을을 지우는 확인은 아래 확인 시트 (끄면 예전 confirm 그대로)
    const ask = () => (vis('confirmSheet') ? confirmSheet({ title: '새 여관을 열까요?', body: '지금까지의 마을이 지워져요 (되돌릴 수 없어요)', ok: '새로 시작', danger: true }) : confirm('새 여관을 열면 지금까지의 마을이 지워져요. 계속할까요?'));
    if (!(document.getElementById('tCont') as HTMLButtonElement).disabled && !(await ask())) return;
    game.newGame();
  };
  document.getElementById('tCont')!.onclick = () => game.continueGame();
  // 핫픽스 12 §5: 마을 단축키 (PC) — B 건설 · G 원정 · H 사냥 · C/Enter 채팅 · M 메뉴. 글 쓰는 중·대화·창·전투·배치 중엔 끔
  addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
    // PHOTO_SPEC: 사진 모드에선 P·Esc 로 나가기 (이웃 마을에서도)
    if (photoOn() && (e.key === 'Escape' || actionOf(e.key, VILLAGE_ACTIONS) === 'photo')) return void exitPhoto();
    if (!S.started || isTalking() || isWinOpen() || combatOn() || teaserOn() || placing.pl || document.getElementById('raid')) return;
    if (S.visiting && actionOf(e.key, VILLAGE_ACTIONS) !== 'photo') return;
    const t = document.getElementById('title');
    if (t && !t.hidden && !t.classList.contains('out')) return;
    const a = actionOf(e.key, VILLAGE_ACTIONS);
    if (!a) return;
    e.preventDefault();
    if (a === 'build') return openBuild();
    if (a === 'board') return openBoard();
    if (a === 'hunt') return openHunt();
    if (a === 'menu') return openGridMenu();
    if (a === 'photo') return photoOn() ? exitPhoto() : enterPhoto();
    if (a === 'chat') {
      openChat();
      (document.getElementById('chatv') as HTMLInputElement | null)?.focus();
    }
  });
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
  // 티저: 처음 실행(저장 없음)이면 한 번 자동 · 타이틀 「미리보기」로 언제든
  document.getElementById('tTeaser')!.onclick = () => playTeaser(false, () => game.titleBackdrop());
  if (!readSave() && !getPref('teaserSeen', false)) {
    setPref('teaserSeen', true);
    teaserTouchGate(() => game.newGame());
  }
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(frame);
  });

  // 개발 중 콘솔에서 살펴보기용
  // FEEDBACK23 e2e: 마을 입구 칸 · 던전 숲속 원래 자리
  if (import.meta.env.DEV) Object.assign(window, { __ent: () => entrance(), __autoEntX: () => autoEntranceX(), __dgHome: () => dungeonHome(), __hitAt: (cx: number, cy: number) => { const [mx, my] = toLogical(cv, cx, cy); const [fx, fy] = toTile(cv, cx, cy); return { sprite: buildingAt(mx, my, alphaAt)?.kind ?? null, floor: grid[Math.floor(fy)]?.[Math.floor(fx)]?.kind ?? null }; } });
  // GROWTH e2e: 손님(번호)·모모의 화면 좌표
  if (import.meta.env.DEV) Object.assign(window, { __acctDel: { test: _delTest, open: openDelete, account: openAccount, me: SRV.me, halted: savesHalted, haltCloud: _haltCloud } });
  if (import.meta.env.DEV) Object.assign(window, { __actorXY: (id: number | string) => { const a = world.actors.find((x) => (id === 'momo' ? x.role === 'npc' : x.id === id)); if (!a) return null; const r = cv.getBoundingClientRect(); const [X, Y] = scr(a.x, a.y); return [r.left + X * view.SC, r.top + (Y - 14) * view.SC]; } });
  if (import.meta.env.DEV) Object.assign(window, { __guestXY: () => { const a = world.actors.find((x) => x.firstGuest); if (!a) return null; const r = cv.getBoundingClientRect(); const [X, Y] = scr(a.x, a.y); return [r.left + X * view.SC, r.top + (Y - 14) * view.SC]; }, __decor: { view: decorView, pathN: () => pathT.size, xy: (x: number, y: number) => { const r = cv.getBoundingClientRect(); return [r.left + (view.OX + sx(x + 0.5, y + 0.5)) * view.SC, r.top + (view.OY + sy(x + 0.5, y + 0.5)) * view.SC]; } }, __propose: proposeTalk, __cap: () => capacity(), __town: { ground, renderFrame, landBounds, addObj, rebuildPaths }, __S: S, __world: world, __game: game, __view: view, __stats: stats, __recolored: recolored, __pending: pendingEvents, __P: P, __showObj: showObj, __placing: () => placing.pl, __movePlacement: movePlacement, __def: def, __undoMax: UNDO_MAX, __dd: decodrop, __cameoXY: (id: string) => { const a = world.actors.find((x) => x.cameo === id); if (!a) return null; const r = cv.getBoundingClientRect(); const [X, Y] = scr(a.x, a.y); return [r.left + X * view.SC, r.top + (Y - 14) * view.SC]; }, __raidW: raidW, __claim: claimMail, __store: { putAway, open: openStore }, __easter: { open: openPioneerLetter, cameo: (id: string) => { const [ex, ey] = entrance(); const a = makeCameo(id as never, ex, ey); arrive(a); return a; }, mail: (id: string) => addMail({ from: 'system', title: '💌 모모의 금빛 편지', body: 'test', reward: { pioneer: id } }) }, __enterPhoto: enterPhoto, __exitPhoto: exitPhoto, __pendingProp: () => pendingWith('prop'), __openDex: openDex, __autoTiles: () => [...pathT].map((k) => [k % N, Math.floor(k / N)]).filter(([x, y]) => !P.decor.paint[`${x},${y}`]), __saveNow: writeSave, __gradeProps: () => gradeProps().map((p) => ({ key: propKey(p), k: p.k, x: p.x, y: p.y })), __openManual: (k?: string) => openManual(k), __openMenu: () => openGridMenu(), __mythic: { seed: debugMythic, prog: mythicProgress }, __showActor: showActor, __renderMem: () => ({ lru: { ...assetMem(), look: lookMem(), ...renderMem() }, dpr: devicePixelRatio, sc: view.SC }), __drawFails: drawFails, __spriteOk: spriteOk, __breakSprite: () => { const o = world.objs.find((b) => b.sprite && !isFlipKey(b.sprite) && b.hue == null && b.kind !== 'inn' && IMG[b.sprite] instanceof HTMLImageElement); if (!o?.sprite) return null; breakSpriteForTest(o.sprite); return o.sprite; }, __tintPending: tintWarmPending, __dailyAttend: dailyAttend, __openNotices: openNotices, __abyss: _abyss, __dice: _dice, __pmenu: openPersonMenu,
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
      __eval: { ...evalW, beginTour, openEval },
      __settle: showSettlement,
      __combat: { advance: combatAdvance, field: combatField, zoom: combatZoom, fps: combatFps },
      __teaserCut: teaserCut,
      __audio: { engine: audioEngine, music: audioMusic, sfx: audioSfx, battle: battleMusic },
      __event: forceSpectacle,
      // 핫픽스 9 확인용: 대화 · 이웃 목록 · 손님 모두 한마디
      __uiTalk: (lines: TalkLine[]) => talk(lines),
      __say: say,
      __fakeUpdate: _fakeNewer,
      __landHint: landHint,
      __chemTalk: queueChemTalk,
      __visual: () => ({ talk: isTalking(), tour: tour.on, spect: spectacles.length, burst: burstOn(), placing: !!placing.pl, grade: gradeAnim.on, idle: idleFor(), step: drawStep(isWinOpen()), saver: saverOn(), title: document.getElementById('winT')?.textContent }),
      __arrive: (status?: 'visitor' | 'passer') => arrive(makeAdventurer(0, 0, { day: S.day, status: status ?? 'visitor' })),
      __neighbors: NEIGHBORS,
      __sayAll: () => world.actors.filter((a) => !a.role && !a.hidden).forEach((a, i) => say(a, ['방 좋네~', '제가 지켜드릴게요', '오늘 던전 갈까?', '배고프다…', '이 마을 맘에 들어', '주인장 최고!'][i % 6])),
      __events: spectacles,
      __resolve: resolveSpectacle,
      __harm: { sets: harmonySets, computeSets, checkDiscover, props: propsNow, openPropInfo },
      /** 개발용: 그 칸에 짓기 미리보기 (확정은 #placeOk) */
      __place: (k: Kind, x: number, y: number) => {
        startPlace(k);
        movePlacement(x + def(k).size[0] / 2 - 0.5, y + def(k).size[1] / 2 - 0.5);
        return placing.pl?.why ?? 'ok';
      },
      __step: (sec: number) => { for (let i = 0; i < sec * 60; i++) stepGradeAnim(1 / 60); },
      // 방치 시험: sec초 꺼져 있었던 것처럼 정산
      __offline: (sec: number) => {
        P.lastSeen = Date.now() - sec * 1000;
        const s = computeOffline();
        if (s) showOffline(s);
        return s;
      },
      __openHunt: openHunt,
      // REGIONS2 시험용: 다음 컷 · 새 지역 열림 · 지역 10 보스 처치 컷
      __reg2: { next: nextRegionCut, open: openNewRegions, defeat: deepDefeat },
      // 전투 2차 시험: 사람처럼 조작하는 봇으로 n판 (평가 비율·시간)
      __sim: async (region: string, stage: number, n = 20, powerK = 1, skillLv = 0.7, auto = false) => {
        const { simulate } = await import('./combat/sim');
        const ms = (world.home?.actors ?? world.actors).filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).slice(0, 3);
        return Array.from({ length: n }, () => simulate(region as never, stage, ms, powerK, skillLv, auto));
      },
      __openRaid: async () => {
        const w = await import('./world/raid');
        const r = await import('./ui/raid');
        w.ensureWeek();
        r.openRaidPrep(w.weeklyTarget());
      },
      __power: powerOf,
      __photo: { capture: photoCapture, frameRect, photoScale, saveBlob, enter: enterPhoto, exit: exitPhoto },
      __star: () => { const s = starInfo(); const r = cv.getBoundingClientRect(); return { ...s, cx: r.left + s.x * view.SC, cy: r.top + s.y * view.SC }; },
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
