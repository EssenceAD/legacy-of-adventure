// 한 프레임 그리기. 밤 처리 순서(꼭 지킬 것):
// 1) 바닥 → 화면 전체에 밤 색(multiply) 한 번
// 2) 깊이 순서대로 건물·나무·캐릭터를 "밤 색으로 미리 물든 그림"으로
// 3) 건물 하나를 그린 직후 그 건물의 창문 불빛 → 앞 건물이 나중에 그려지며 가린다
// 4) 모닥불·가로등·수확제 등불의 둥근 빛(lighter)은 그 불을 그린 직후에 (앞 건물이 가린다 · v0.25.23 전엔 맨 위라 지붕 위로 비쳤다)
//    맨 위에 더하는 건 하늘에 걸린 축제 등불 줄만
import { decoAsObjects } from './levelDeco';
import { def, SMOKE } from '../data/catalog';
import { drawFireworks, statueName } from './luxury';
import { drawLuxeBody, drawLuxeFx, LX_BODY } from './luxeDraw';
import { decorView } from './decor';
import { plotLeft } from './craft';
import { sfx } from '../audio/sfx';
import { CONFIG } from '../data/config';
import { alphaAt, baseKey, FIRE_FRAMES, FIRE_W, fireFrame, IMG, isFlipKey, META, missingMeta, okToDraw, recolored, spriteFailed, tinted, tintColor, type Drawable } from '../engine/assets';
import { canvasAlive, Lru } from '../engine/lru';
import { depthActor, depthBuilding, depthWild, N, sx, sy, TH, TW, view } from '../engine/iso';
import { canvas, P } from '../engine/pixel';
import { idleFor, saverOn } from '../engine/fps';
import { ssOn } from '../ui/screenSaver';
import { uiHidden as uiHiddenBody } from './bldStatus';
import { guestNamesOn } from './guestNames';
import { nameTagRule, quietOn, TIER_DOT } from './quiet';
import { signLabelOn } from './firstCam';
import { framesFor, type CharFrames } from '../engine/sprites';
import { appearance } from './adventurers';
import { showerOn, starAvailable } from './legends';
import { drawAmbient, drawLight, glow, NL, sceneNight, setDecorDay, setPhotoNL } from './daynight';
import { decorMixStep } from './decorLight';
import { flag } from './flags';
import { puff, updDrawParts } from './fx';
import { calmForest, ground, ensureGround, groundFor, groundKey, groundMem, litGround, lookFor, signSpot, treeImg, trimGround, type Wild } from './ground';
import { litHex } from './nightLook';
import { vis } from './visual';
import { shadowGap, walkBob } from './charPop';
import { stars } from './progress';
import { landReqs } from './landreq';
import { drawFelling } from './felling';
import { anim, animF, gradeNow, type Prop } from './grade';
import { drawFolk, drawGradeLights, drawProp, drawPropLight, folkNow, propsNow } from './gradeDraw';
import { P as P_, S, world, type Actor, type Building } from './state';
import { doorPose, doorRect, hasDoor, isOpenFront } from './doors';
import { doorOf, grid, groundVersion, inLand, landBounds, outsideOk, pathT, placing, spriteFor, spriteOrigin, type Placement } from './town';
import { drawConstruction, silMem } from './conDraw';
import { curWind, windIs } from './wind';
import { drawHarmonyLines, drawPlacementHarmony } from './harmonyDraw';
import { dotShadow } from '../combat/draw';
import { drawInspector, drawTourEmotes, tourThings } from './evalTour';
import { drawSpecNpc, drawSpectacleEmotes, spectacleThings, type SpecNpc } from './spectacle';
import { drawBldStatus, hasBubble, setBldHooks } from './bldStatusDraw';
import { drawFestLight, drawFestProp, drawLanterns, drawLeaves, festivalProps, type FestProp } from './harvestDraw';
import { DUSK_ALPHA, DUSK_RGB, duskOf, nightOverlay, sunsetOn } from './sunset';
import { drawPet, petThings, type PetRT } from './petsDraw';

/** 깊이 정렬에서 "건물처럼" 다루는 것: 건물·야생 나무(1×1)·배치 미리보기 */
type Thing = { d: number; tx: number; ty: number; fw: number; fh: number } & ({ o: Building } | { w: Wild } | { pr: Prop } | { fk: ReturnType<typeof folkNow>[number] } | { iv: ReturnType<typeof tourThings>[number]['iv'] } | { sn: SpecNpc } | { fp: FestProp } | { pt: PetRT });

/**
 * 캐릭터가 이 건물보다 앞(나중에 그림)인가 — x+y 합이 아니라 발판으로 판정
 *  · 캐릭터 칸이 발판의 오른쪽(ax ≥ tx+fw) 또는 앞쪽(ay ≥ ty+fh) → 앞
 *  · 발판의 왼쪽(ax < tx) 또는 뒤쪽(ay < ty) → 뒤
 *  · 발판 안(훈련장·텃밭) → 예전처럼 x+y 비교
 * 단, 한 축은 앞인데 다른 축은 뒤인 "대각선" 자리(오른쪽-뒤, 왼쪽-앞)는 화면에서 겹치지 않으므로
 * 판정에서 뺀다(null). 넣으면 멀리 있는 나무가 "앞에 있어야 할 건물"로 잡혀 캐릭터가 지붕 위로 올라온다.
 */
function inFrontOf(a: Actor, b: Thing): boolean | null {
  const ax = Math.round(a.x);
  const ay = Math.round(a.y);
  const frontX = ax >= b.tx + b.fw;
  const frontY = ay >= b.ty + b.fh;
  const behindX = ax < b.tx;
  const behindY = ay < b.ty;
  if ((frontX && behindY) || (frontY && behindX)) return null;
  if (frontX || frontY) return true;
  if (behindX || behindY) return false;
  return depthActor(a.x, a.y) > b.d;
}

/** ?debug=doors 로 열면 문 영역을 분홍 사각형으로 그린다 (doors.json 맞추기용) */
const DEBUG_DOORS = new URLSearchParams(location.search).get('debug') === 'doors';

/** 건물 그림의 왼쪽 위: 그림의 아래 가운데를 발판 마름모의 앞 꼭짓점에 맞춘다 */
export function objTL(o: { sprite: string | null; tx: number; ty: number; fw: number; fh: number }): [number, number] {
  if (!o.sprite || !META[o.sprite]) return [0, 0];
  const [x, y] = spriteOrigin(o);
  return [view.OX + Math.round(x), view.OY + Math.round(y)];
}

// ───────── 핫픽스 11 §11: 건물·나무·장식 그리기 순서 = 발판 겹침 기준 (숫자 하나 정렬 대신) ─────────
//  화면에서 그림이 실제로 겹치는 쌍만 「발판이 완전히 뒤인 쪽 먼저」로 묶고 위상 정렬. 관계 없는 것끼리는 예전 깊이값 순서.
//  배치가 바뀔 때만 다시 계산해서 캐시한다 (매 프레임 계산 안 함 — 발열).
type Box = { l: number; r: number; t: number; b: number };
function boxOf(it: Thing): Box {
  // HARVEST §1-3 수확제 자동 장식: 그림 크기 그대로
  const sp = 'o' in it ? it.o : 'fp' in it ? { sprite: it.fp.k, tx: it.fp.x, ty: it.fp.y, fw: it.fp.fw, fh: it.fp.fh } : null;
  if (sp && sp.sprite && META[sp.sprite]) {
    const [x, y] = spriteOrigin(sp);
    const m = META[sp.sprite];
    return { l: x, r: x + m.w, t: y, b: y + m.h };
  }
  const h = 'w' in it ? 80 : 64;
  const b = sy(it.tx + it.fw, it.ty + it.fh) + 2;
  return { l: sx(it.tx, it.ty + it.fh) - 4, r: sx(it.tx + it.fw, it.ty) + 4, t: b - h, b };
}
/** -1 = a를 먼저(뒤) · 1 = b를 먼저 · 0 = 정할 수 없음(대각선 · 발판 겹침) */
export function behindOf(a: { tx: number; ty: number; fw: number; fh: number }, b: { tx: number; ty: number; fw: number; fh: number }): -1 | 0 | 1 {
  const x = a.tx + a.fw <= b.tx ? -1 : b.tx + b.fw <= a.tx ? 1 : 0;
  const y = a.ty + a.fh <= b.ty ? -1 : b.ty + b.fh <= a.ty ? 1 : 0;
  if (x && y && x !== y) return 0; // 대각선: 화면에서 거의 안 겹친다 → 깊이값에 맡김
  return (x || y) as -1 | 0 | 1;
}
/** 겹치는 쌍만 발판으로 묶은 위상 정렬 (같은 조건이면 깊이값 순) */
export function orderThings<T extends { d: number; tx: number; ty: number; fw: number; fh: number }>(list: T[], box: (t: T) => Box): T[] {
  const base = list.slice().sort((p, q) => p.d - q.d);
  const n = base.length;
  const bx = base.map(box);
  const after: number[][] = Array.from({ length: n }, () => []);
  const indeg = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const A = bx[i];
      const B = bx[j];
      if (A.r <= B.l || B.r <= A.l || A.b <= B.t || B.b <= A.t) continue;
      const r = behindOf(base[i], base[j]);
      if (r === -1) (after[i].push(j), indeg[j]++);
      else if (r === 1) (after[j].push(i), indeg[i]++);
    }
  const out: T[] = [];
  const done = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0) {
      pick = i;
      break;
    }
    // 고리(드묾): 남은 것 중 깊이값이 가장 작은 것부터
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i]) {
      pick = i;
      break;
    }
    done[pick] = 1;
    out.push(base[pick]);
    for (const j of after[pick]) indeg[j]--;
  }
  return out;
}
let orderKey = '';
let orderCache: Thing[] = [];

/** HARVEST §2 노을: 등불 정도(드는 0~1) · 밤 앞당김을 부드럽게 (☾로 건너뛰어도 1초쯤에 걸쳐) */
let duskLight = 0;
let duskNight = 0;
function duskSmooth(dt: number) {
  const d = duskOf(S.clock);
  duskNight += (d.night - duskNight) * Math.min(1, dt * CONFIG.dayNight.blendRate * 1.5);
  if (Math.abs(d.night - duskNight) < 0.002) duskNight = d.night;
  return { sun: d.sun, night: duskNight, light: d.light };
}
/** 노을 색(multiply) + 밤 색조 덧칠 — 바닥·건물·손님을 다 그린 뒤, 불빛 전에 (불빛은 덮지 않는다) */
function drawDusk(ctx: CanvasRenderingContext2D, LW: number, LH: number, dk: { sun: number; night: number }) {
  const real = NL / CONFIG.dayNight.tintSteps;
  const ov = nightOverlay(dk.night, real);
  if (dk.sun <= 0.003 && !ov) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  if (dk.sun > 0.003) {
    ctx.fillStyle = `rgba(${DUSK_RGB},${(DUSK_ALPHA * dk.sun).toFixed(3)})`;
    ctx.fillRect(0, 0, LW, LH);
  }
  if (ov) {
    ctx.fillStyle = `rgb(${ov[0]},${ov[1]},${ov[2]})`;
    ctx.fillRect(0, 0, LW, LH);
  }
  ctx.restore();
}
/** PHOTO_SPEC: 사진 모드 — 시간(밤 색조·노을)과 손님 보이기, 겹침 UI(이름판·별·팻말 글씨·어울림 선·배치) 빼기 */
export const photoState = { on: false, time: 'now' as 'now' | 'morning' | 'sunset' | 'night', people: true };
const PHOTO_NT: Record<string, number | null> = { now: null, morning: 0, sunset: 0.35, night: 1 };

/**
 * 꾸미기 낮 조명 (이카몰리): 꾸미기 중엔 밤 단계 0으로 그린다 (밤 색조·창문 불빛·등불·노을·반딧불 모두 낮)
 *  · 바닥은 낮 그림 그대로(litGround가 굽지 않음) · 구워 둔 밤 바닥(gr.lit)·밤 색조 그림(TINT)은 안 건드려 두고 끝나면 그대로 다시 쓴다
 *  · 끝날 때: 마지막 꾸미기 화면(낮 · 겹침 UI 전)을 한 장 들고 있다가 지금 시간 빛 위에 0.4초 동안 흐리게 겹친다
 *    → 중간 밤 단계(1~9)를 새로 물들이거나 굽지 않는다. 그 사이 카메라·화면 크기가 바뀌면 바로 끝
 *  · 사진 모드(자기 시간)·이웃 방문은 그대로 · 움직임 줄이기 · 배터리 절약이면 바로
 */
let decorMix = 0;
let decorSnap: HTMLCanvasElement | null = null;
let snapAt = '';
const snapKey = () => `${view.LW}x${view.LH}@${view.OX},${view.OY}`;
let rmq: MediaQueryList | null | undefined;
function decorCalm(): boolean {
  if (rmq === undefined)
    try {
      rmq = matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      rmq = null;
    }
  return !!rmq?.matches || saverOn();
}
/** 시험·봇용: 지금 낮 섞임 정도 */
export const decorLightMix = () => decorMix;
export function renderFrame(ctx: CanvasRenderingContext2D, dt: number) {
  const { LW, LH, OX, OY } = view;
  const T = S.T;
  const pnt = photoState.on ? PHOTO_NT[photoState.time] : null;
  const decorDay = !photoState.on && decorView.on && !S.visiting && flag('decorDayLight');
  if (photoState.on || S.visiting) decorMix = 0;
  else {
    decorMix = decorMixStep(decorMix, decorDay, dt, decorCalm());
    if (!decorDay && decorMix > 0 && (!decorSnap || snapAt !== snapKey())) decorMix = 0;
  }
  if (!decorMix) decorSnap = null;
  setDecorDay(decorDay, decorDay ? 1 : decorMix);
  const nt = pnt ?? (decorDay ? 0 : S.nightT);
  setPhotoNL(pnt);
  // 불빛 정도 (그리기 순서 안에서 불마다 쓴다 · 노을 등불은 지난 프레임 값)
  frameLight = Math.max(nt, duskLight);
  ensureGround(S.visiting ? S.visiting.id : '');
  // 마을 등급 연출이 끝났으면 앞뒤 두 장 중 지금 것만 남긴다
  if (!anim.on) trimGround();

  // 1) 바닥 + 밤 색 — 바닥·밤 색조·숲 덧칠을 (바닥 · 밤 단계)마다 한 번 구운 한 장을 놓기만 한다
  //    (웅스 신고: 새벽 04시 숲·바닥이 1~3초마다 잠깐 어두워짐 — 예전엔 매 프레임 화면 전체에 multiply + 짝홀 자르기 + 반투명으로 덧칠)
  //    프레임 시작 상태도 늘 같게 (앞 프레임이 합성·투명도를 남겼어도 바닥 밝기는 같다)
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const look = lookFor(NL);
  ctx.fillStyle = litHex(calmForest('#3e6a34'), look);
  ctx.fillRect(0, 0, LW, LH);
  const lg = litGround(ground, look);
  if (okToDraw(lg)) ctx.drawImage(lg, OX - ground.ox, OY - ground.oy);
  // 5단계: 마을 등급이 오르는 중 — 새 바닥이 위에서 아래로 덮어쓴다 (같은 밤 색으로 구운 것)
  if (anim.on) {
    const ng = groundFor(groundKey(S.visiting ? S.visiting.id : '', anim.to), anim.to);
    const nlg = litGround(ng, look);
    const cut = Math.round(animF() * LH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, LW, cut);
    ctx.clip();
    if (okToDraw(nlg)) ctx.drawImage(nlg, OX - ng.ox, OY - ng.oy);
    ctx.restore();
    ctx.fillStyle = litHex('#fff3b0', look, false);
    ctx.fillRect(0, cut - 1, LW, 2);
  }
  // 땅 개편: 넓히는 중 쓰러지는 나무 (바닥 다음 · 건물보다 먼저)
  drawFelling(ctx, dt);
  const pl = placing.pl;

  // 2) 깊이 정렬: 건물·나무를 먼저 기존 키로 정렬하고,
  //    캐릭터는 하나씩 "자기가 앞에 있어야 하는 마지막 건물" 바로 뒤에 끼워 넣는다
  // 핫픽스 11 §11: 건물·나무·장식 순서는 배치가 바뀔 때만 다시 계산 (길 다시 깔기 번호 · 건물 수 · 옮기는 중 · 마을 등급 · 이웃)
  const key = `${groundVersion}|${world.objs.length}|${pl?.move ? world.objs.indexOf(pl.move) : -1}|${gradeNow()}|${anim.on ? Math.round(animF() * 20) : -1}|${S.visiting?.id ?? ''}|${ground.wild.length}|${festivalProps().length}`;
  if (key !== orderKey) {
    orderKey = key;
    const list: Thing[] = [];
    // 옮기는 중인 건물은 제자리에 그리지 않는다 (유령으로만)
    for (const o of world.objs) if (o !== pl?.move) list.push({ d: depthBuilding(o.tx, o.ty, o.fw, o.fh), tx: o.tx, ty: o.ty, fw: o.fw, fh: o.fh, o });
    for (const w of ground.wild) list.push({ d: depthWild(w.x, w.y), tx: w.x, ty: w.y, fw: 1, fh: 1, w });
    // 마을 등급 장식 · NPC (울타리 밖 개간지·입구 길)
    for (const pr of propsNow()) list.push({ d: depthBuilding(pr.x, pr.y, pr.fw, pr.fh), tx: pr.x, ty: pr.y, fw: pr.fw, fh: pr.fh, pr });
    // HARVEST §1-3: 수확제 자동 장식 (기간 중에만 · 그리기 전용)
    for (const fp of festivalProps()) list.push({ d: depthBuilding(fp.x, fp.y, fp.fw, fp.fh), tx: fp.x, ty: fp.y, fw: fp.fw, fh: fp.fh, fp });
    orderCache = orderThings(list, boxOf);
  }
  const things: Thing[] = orderCache.slice();
  // 움직이는 것(마을 사람·평가단·구경거리)은 캐릭터처럼 발판 기준으로 끼워 넣는다 (깊이값 순)
  const movers: Thing[] = [];
  for (const fk of folkNow()) movers.push({ d: depthActor(fk.x, fk.y), tx: Math.floor(fk.x), ty: Math.floor(fk.y), fw: 1, fh: 1, fk });
  // 베타: 평가단 순회
  if (!S.visiting) movers.push(...tourThings(), ...spectacleThings());
  // LUXE §2 펫: 꺼내 둔 3마리(이웃 방문 땐 그 마을 펫) — 꾸미기·사람 없는 사진에선 숨김 (움직임은 그래도 진행)
  const pets = petThings(dt);
  if ((!photoState.on || photoState.people) && !decorView.on) movers.push(...pets);
  for (const m of movers.sort((p, q) => p.d - q.d)) {
    let last = -1;
    for (let i = 0; i < things.length; i++) if (inFrontOf({ x: m.tx, y: m.ty } as Actor, things[i]) === true) last = i;
    things.splice(last + 1, 0, m);
  }
  /** slots[k] = things[k] 앞에 그릴 캐릭터들 (마지막 칸은 맨 끝) */
  const slots: Actor[][] = Array.from({ length: things.length + 1 }, () => []);
  /** 문으로 드나드는 중인 손님은 그 건물 바로 다음에 그린다 (문 영역으로 가려야 해서) */
  const atDoor = new Map<Building, Actor[]>();
  const walkers = world.actors.filter((a) => !a.hidden).sort((p, q) => depthActor(p.x, p.y) - depthActor(q.x, q.y));
  for (const a of walkers) {
    if (a.door) {
      const l = atDoor.get(a.door.o);
      if (l) l.push(a);
      else atDoor.set(a.door.o, [a]);
      continue;
    }
    let last = -1;
    for (let i = 0; i < things.length; i++) if (inFrontOf(a, things[i]) === true) last = i;
    slots[last + 1].push(a);
  }
  // HOTFIX19 §2: 꾸미기 붓을 들면 건물·장식·나무를 반투명으로 (바닥·길이 비쳐 보이게)
  const fadeAll = decorView.on && decorView.fade && decorView.fadeOn && !S.visiting;
  for (let k = 0; k <= things.length; k++) {
    // TOWN T2: 꾸미기 모드는 손님을 숨긴다
    if ((!photoState.on || photoState.people) && !decorView.on)
      for (const a of slots[k])
        try {
          drawActor(ctx, a);
        } catch {
          recoverCtx(ctx, 'actor');
        }
    const it = things[k];
    if (!it) break;
    ctx.globalAlpha = fadeAll ? 0.3 : 1;
    // 따밤 신고: 깨진 그림 하나(drawImage 'broken')에서 오류가 나면 그 뒤 건물이 모두 안 그려졌다 → 그것만 건너뛴다
    try {
      if ('o' in it) {
        drawObj(ctx, it.o);
        const ds = atDoor.get(it.o);
        if (ds) drawDoorActors(ctx, it.o, ds);
        if (DEBUG_DOORS) drawDoorDebug(ctx, it.o);
      } else if ('pr' in it) {
        drawProp(ctx, it.pr);
        lit(ctx, () => drawPropLight(ctx, it.pr, frameLight));
      } else if ('fp' in it) {
        drawFestProp(ctx, it.fp);
        lit(ctx, () => drawFestLight(ctx, it.fp, frameLight));
      }
      else if ('fk' in it) drawFolk(ctx, it.fk);
      else if ('iv' in it) drawInspector(ctx, it.iv);
      else if ('sn' in it) drawSpecNpc(ctx, it.sn);
      else if ('pt' in it) drawPet(ctx, it.pt);
      else drawWild(ctx, it.w);
    } catch {
      recoverCtx(ctx, 'o' in it ? (it.o.sprite ?? it.o.kind) : 'w' in it ? it.w.k : 'pr' in it ? 'prop:' + it.pr.k : 'fp' in it ? 'fest:' + it.fp.k : 'pt' in it ? 'pet:' + it.pt.id : 'thing');
    }
  }
  ctx.globalAlpha = 1;

  // 연기·불티
  if (Math.random() < dt * 3)
    for (const o of world.objs) {
      const s = smokeOf(o.sprite);
      if (!s || o.build) continue;
      const [bx, by] = objTL(o);
      for (const [x, y] of s) puff(bx + x - OX, by + y - OY, nt > 0.5 ? '#8a90b0' : '#ece6dc', 2 + Math.random() * 3, -7 - Math.random() * 4, 2.8, 1 + ((Math.random() * 2) | 0));
    }
  // 땅 개편 §8: 땅보다 앞의 굽힌 숲 (건물·손님 다음 · 밤 색은 미리 물든 사본)
  const fr = frontTinted();
  if (fr && okToDraw(fr)) {
    if (fadeAll) ctx.globalAlpha = 0.3;
    ctx.drawImage(fr, OX - ground.ox + (ground.frontX ?? 0), OY - ground.oy + (ground.frontY ?? 0));
    ctx.globalAlpha = 1;
  }
  for (const o of world.objs)
    if (o.kind === 'fire' && Math.random() < dt * 6 && !flameCovered(o, world.objs)) {
      const X = sx(o.tx + 0.5, o.ty + 0.5);
      const Y = sy(o.tx + 0.5, o.ty + 0.5) - FIRE_FLAME_Y;
      puff(X + (Math.random() - 0.5) * 4, Y, '#ffb04a', (Math.random() - 0.5) * 4, -14, 0.6, 1);
    }
  updDrawParts(ctx, dt);

  // HARVEST §2 노을: 17~19시 노을 색 · 19~22시 밤 색조로 (22시에 지금의 밤과 같게) — 사진 모드는 따로 · 밤 로직은 그대로
  const dk0 = !photoState.on && sunsetOn() ? duskSmooth(dt) : null;
  const dk = decorDay ? null : dk0;
  if (dk) drawDusk(ctx, LW, LH, dk);
  duskLight = dk && !saverOn() ? dk.light : 0;
  const lt = Math.max(nt, duskLight);
  // 4) 모닥불 빛 (더하기) — 노을: 19시부터 가로등·등불이 서서히 (배터리 절약이면 밤에만)
  if (lt > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    drawGradeLights(ctx, lt);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  drawAmbient(ctx, T, LW, LH);
  // HARVEST §1-3: 단풍잎 (기간 중 · 배터리 절약이면 끔)
  drawLeaves(ctx, T, LW, LH);
  // DIRECTION §1-2: 회차의 바람 분위기 (내 마을에서만)
  if (!S.visiting && curWind()) drawWindSky(ctx, T, LW, LH);
  // HARVEST §1-7: 마지막 밤 등불 날리기
  drawLanterns(ctx, LW, LH);
  // 꾸미기 낮 조명: 꾸미기 중엔 이 화면(낮 · 겹침 UI 전)을 한 장 들고 있고, 끝난 뒤 0.4초 동안 지금 빛 위에 흐리게 겹친다
  if (!photoState.on && !S.visiting) {
    if (decorDay) {
      if (!decorSnap || decorSnap.width !== LW || decorSnap.height !== LH || !canvasAlive(decorSnap)) decorSnap = canvas(LW, LH);
      const sx2 = decorSnap.getContext('2d');
      if (sx2) {
        sx2.globalCompositeOperation = 'source-over';
        sx2.globalAlpha = 1;
        sx2.drawImage(ctx.canvas, 0, 0);
        snapAt = snapKey();
      }
    } else if (decorMix > 0 && decorSnap) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = decorMix;
      ctx.drawImage(decorSnap, 0, 0);
      ctx.globalAlpha = 1;
    }
  }
  // 사진: 노을은 주황빛 · 아침은 살짝 밝게
  if (photoState.on && photoState.time === 'sunset') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(255,170,110,.45)';
    ctx.fillRect(0, 0, LW, LH);
    ctx.globalCompositeOperation = 'source-over';
  } else if (photoState.on && photoState.time === 'morning') {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,240,210,.14)';
    ctx.fillRect(0, 0, LW, LH);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (photoState.on) return void (TAGS.length = 0);
  drawStar(ctx, T);
  drawNamePlate(ctx, nt);
  // 땅 개편: 땅 넓히기 팻말 글씨 (팻말 그림 위)
  if (!S.visiting) drawSignLabel(ctx);
  // 땅 개편 §4: 오프닝 뒤 울타리 반짝 한 바퀴
  if (performance.now() < landHint.fenceUntil) drawFenceSparkle(ctx, 1 - (landHint.fenceUntil - performance.now()) / 2600);
  // HERODOT 이름표 (전설 금 · 신화 은+별 · 영웅 흰) — 사람을 다 그린 뒤 한 번에
  drawNamedTags(ctx);
  // 베타: 어울림 점선 (보기 토글 · 발견 연출)
  drawHarmonyLines(ctx);
  if (!S.visiting) {
    drawTourEmotes(ctx);
    drawSpectacleEmotes(ctx);
  }
  // CHECKIN §J8: 건물 머리 위 상태 말풍선 (최대 3 · 꾸미기·배치·이웃·UI 끄기·화면 보호에선 안 그림)
  if (vis('bldStatus')) drawBldStatus(ctx, nt);
  // TOWN T2: 꾸미기 모드 — 격자·발판 · 붓 칸 · 고른 범위 · 옮기는 무리
  // DECO_DROP §2: 불꽃놀이 (화면 위)
  drawFireworks(ctx, view.LW, view.LH, dt);
  if (decorView.on && !S.visiting) drawDecorOverlay(ctx);
  // 배치 중: 마을을 살짝 어둡게 하고 발판·문 방향·유령 건물만 밝게 맨 위에
  if (pl && pl.tx != null && pl.ty != null) drawPlacement(ctx, pl);
}

function drawDecorOverlay(ctx: CanvasRenderingContext2D) {
  const [a, b] = landBounds();
  if (decorView.grid) {
    // 칸 테두리 (울타리 안) · 건물·장식 발판은 옅은 노랑
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let y = a; y < b; y++)
      for (let x = a; x < b; x++) {
        const X = Math.round(view.OX + sx(x, y));
        const Y = Math.round(view.OY + sy(x, y));
        ctx.fillRect(X, Y, 1, 1);
        ctx.fillRect(X - 1, Y + TH / 2, 1, 1);
      }
    for (let x = a; x <= b; x++) isoLineA(ctx, x, a, x, b, 'rgba(255,255,255,0.12)');
    for (let y = a; y <= b; y++) isoLineA(ctx, a, y, b, y, 'rgba(255,255,255,0.12)');
    ctx.fillStyle = 'rgba(255,211,107,0.14)';
    for (const o of world.objs) for (let j = 0; j < o.fh; j++) for (let i = 0; i < o.fw; i++) fillTile(ctx, o.tx + i, o.ty + j);
  }
  const s = decorView.sel;
  if (s) {
    ctx.fillStyle = 'rgba(120,190,255,0.22)';
    for (let y = Math.min(s.y0, s.y1); y <= Math.max(s.y0, s.y1); y++) for (let x = Math.min(s.x0, s.x1); x <= Math.max(s.x0, s.x1); x++) fillTile(ctx, x, y);
  }
  const g = decorView.ghost;
  ctx.fillStyle = g ? (g.ok ? 'rgba(111,208,75,0.45)' : 'rgba(255,74,74,0.45)') : 'rgba(120,190,255,0.5)';
  for (const o of decorView.picked) for (let j = 0; j < o.fh; j++) for (let i = 0; i < o.fw; i++) fillTile(ctx, o.tx + i + (g?.dx ?? 0), o.ty + j + (g?.dy ?? 0));
  // HOTFIX19 §2: 붓을 든 동안 건물 발판은 빗금 (칠할 수 없음) — 커서 칸은 건물보다 위에
  if (decorView.fade) {
    ctx.fillStyle = 'rgba(255,90,90,0.35)';
    for (const o of world.objs)
      for (let j = 0; j < o.fh; j++)
        for (let i = 0; i < o.fw; i++) {
          const X = Math.round(view.OX + sx(o.tx + i, o.ty + j));
          const Y = Math.round(view.OY + sy(o.tx + i, o.ty + j));
          for (let k = 2; k < TH; k += 3) ctx.fillRect(X - 10 + k, Y + k, 6, 1);
        }
  }
  // BUILDUX §3-2: 직선 길 미리보기 (ㄱ자)
  if (decorView.preview.length) {
    ctx.fillStyle = decorView.previewOk ? 'rgba(255,211,107,0.55)' : 'rgba(255,74,74,0.45)';
    for (const [x, y] of decorView.preview) fillTile(ctx, x, y);
  }
  const h = decorView.hover;
  if (h) {
    ctx.fillStyle = 'rgba(255,243,214,0.55)';
    fillTile(ctx, h[0], h[1]);
  }
}
/** 타일 좌표 두 점을 잇는 반투명 선 */
function isoLineA(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string) {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(view.OX + sx(x0, y0)) + 0.5, Math.round(view.OY + sy(x0, y0)) + 0.5);
  ctx.lineTo(Math.round(view.OX + sx(x1, y1)) + 0.5, Math.round(view.OY + sy(x1, y1)) + 0.5);
  ctx.stroke();
}

/** 앞 층 숲: 밤 색 단계(NL)나 바닥이 바뀔 때만 다시 물들인다 */
let frontKey = '';
let frontCv: HTMLCanvasElement | null = null;
function frontTinted(): HTMLCanvasElement | null {
  const src = ground.front;
  if (!src) return null;
  if (!NL) return src;
  const key = ground.key + '|' + NL;
  if (key === frontKey && frontCv) return frontCv;
  frontKey = key;
  if (!frontCv || frontCv.width !== src.width || frontCv.height !== src.height || !canvasAlive(frontCv)) frontCv = canvas(src.width, src.height);
  const x = frontCv.getContext('2d')!;
  x.globalCompositeOperation = 'source-over';
  x.clearRect(0, 0, src.width, src.height);
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = tintColor(NL / CONFIG.dayNight.tintSteps);
  x.fillRect(0, 0, src.width, src.height);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-over';
  return frontCv;
}

/** 땅 개편 §4: 안내 상태 (game.ts가 켠다) — 울타리 반짝 · 첫 건설 초록 */
export const landHint = { fenceUntil: 0, firstBuild: false };
/** 울타리 둘레를 따라 반짝이는 점들이 한 바퀴 (f = 0~1) */
function drawFenceSparkle(ctx: CanvasRenderingContext2D, f: number) {
  const [a, b] = landBounds();
  const L = b - a;
  const at = (u: number): [number, number] => {
    // 둘레 위 한 점 (u = 0~4L): 뒤 → 오른쪽 → 앞 → 왼쪽
    if (u < L) return [a + u, a];
    if (u < 2 * L) return [b, a + u - L];
    if (u < 3 * L) return [b - (u - 2 * L), b];
    return [a, b - (u - 3 * L)];
  };
  const p = P(ctx);
  const head = f * 4 * L;
  for (let k = 0; k < 4 * L * 2; k++) {
    const u = k / 2;
    if (u > head) break;
    const [x, y] = at(u);
    const X = Math.round(view.OX + sx(x, y));
    const Y = Math.round(view.OY + sy(x, y)) - 3;
    const tw = (k + Math.floor(S.T * 10)) % 3 === 0;
    p.rect(X, Y, 2, 2, tw ? '#fff3b0' : '#ffd36b');
  }
  const [hx, hy] = at(Math.min(head, 4 * L - 0.01));
  glow(ctx, view.OX + sx(hx, hy), view.OY + sy(hx, hy) - 3, 9, 0.5);
}

/** 땅 개편: 팻말 위 글씨 — 「땅 넓히기 800G」 또는 「★3 필요」 (탭 판정은 signHit) */
const SIGN = { on: false, x: 0, y: 0 };
function drawSignLabel(ctx: CanvasRenderingContext2D) {
  SIGN.on = false;
  const sg = signSpot();
  if (!sg) return;
  const next = S.land + 1;
  const need = CONFIG.landStars[next - 1] ?? 0;
  // LAND10: ★6은 별(★5까지)로는 못 채우는 조건 — 7~10단계 대체 조건(★5 + 별의 심연 돌파)을 채웠으면 「★6 필요」 대신 비용
  const starOk = stars() >= need || (landReqs(next).find((r) => r.text.startsWith('평판'))?.ok ?? true);
  const txt = !starOk ? `★${need} 필요` : `땅 넓히기 ${CONFIG.land[next - 1].cost}G`;
  const X = Math.round(view.OX + sx(sg[0] + 0.5, sg[1] + 0.5));
  const Y = Math.round(view.OY + sy(sg[0] + 0.5, sg[1] + 0.5) - 44);
  // FIRSTLOOK §1 flFirstCam: 「땅 넓히기 ○G」 글씨는 장부 1장을 마친 뒤에만 (그 전엔 팻말 그림만 · 누르는 자리는 그대로)
  if (starOk && !signLabelOn()) return void Object.assign(SIGN, { on: true, x: X, y: Y + 20 });
  ctx.font = '8px "Galmuri9"';
  const w = Math.ceil(ctx.measureText(txt).width) + 6;
  const p = P(ctx);
  p.rect(X - (w >> 1), Y - 9, w, 11, '#3a2414');
  p.rect(X - (w >> 1) + 1, Y - 8, w - 2, 9, '#f3d9a4');
  ctx.fillStyle = '#3a2414';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(txt, X, Y);
  ctx.textAlign = 'start';
  Object.assign(SIGN, { on: true, x: X, y: Y + 20 });
}
/** 탭한 곳이 팻말 근처인가 */
export const signHit = (mx: number, my: number) => SIGN.on && Math.abs(mx - SIGN.x) < 22 && my > SIGN.y - 34 && my < SIGN.y + 26;

// ───────── 운명의 별: 오늘 아직 안 잡았으면 게임 속 밤하늘에 별똥별이 지나간다 (탭하면 인연 +1~10%) ─────────

/**
 * 별똥별 — HOTFIX14 §4: HUD 아래 띠(화면 높이 24~40%)를 일정한 속도로 · 누르는 순간 판정 · 반경 32
 * STARFALL §1: 그날 밤 첫 별은 크게(꼬리 두 배 · 큰 반짝임) + 「슈욱」 · §2 유성우(토 21~24시): 별 3개가 엇갈려 지나가고 하늘이 남보라로
 */
const STARS: { on: boolean; x: number; y: number; k: number; big: boolean }[] = [];
const STAR_SPEED = 70;
const STAR_GAP = 8;
let bigKey = '';
let curPass = -1;
let curBig = false;
function drawStar(ctx: CanvasRenderingContext2D, T: number) {
  STARS.length = 0;
  const shower = showerOn();
  if (shower) drawShowerSky(ctx, T);
  if (!starAvailable()) return;
  const dist = view.LW + 60;
  const travel = dist / STAR_SPEED;
  const period = travel + (shower ? 1 : STAR_GAP);
  const n = shower ? 3 : 1;
  // 그날 밤(실제 날짜 + 게임 날) 첫 지나감은 크게
  const pass = Math.floor(T / period);
  if (pass !== curPass) {
    curPass = pass;
    const key = `${S.day}|${new Date().toDateString()}`;
    // 밤이 지나가던 중간에 시작됐으면 그 판은 건너뛰고, 처음부터 보이는 판을 크게
    curBig = key !== bigKey && T % period < 1;
    if (curBig) {
      bigKey = key;
      sfx('skill', { vol: 0.5 });
    }
  }
  for (let i = 0; i < n; i++) {
    const t = (T + (i * period) / n) % period;
    if (t > travel) continue;
    const k = t / travel;
    const big = i === 0 && curBig;
    const s = { on: true, k, big, x: Math.round(view.LW + 30 - k * dist), y: Math.round(view.LH * ([0.28, 0.24, 0.34][i] + k * 0.08)) };
    STARS.push(s);
    paintStar(ctx, s.x, s.y, T, big ? 2 : 1);
  }
}
function paintStar(ctx: CanvasRenderingContext2D, x: number, y: number, T: number, z: number) {
  const p = P(ctx);
  const len = 22 * z;
  for (let i = 0; i < len; i++) {
    ctx.globalAlpha = 1 - i / len;
    p.px(x + i * 2, y - i, i < 4 * z ? '#ffffff' : '#ffe08a');
    if (z > 1 || i % 3 === 0) p.px(x + i * 2 + 1, y - i + 1, '#fff3c0');
  }
  ctx.globalAlpha = 1;
  const R = 14 * z;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, 'rgba(255,240,180,.55)');
  g.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - R, y - R, R * 2, R * 2);
  p.rect(x - z, y - z, 1 + z * 2, 1 + z * 2, '#fff8d0');
  const arm = (Math.sin(T * 12) > 0 ? 6 : 4) * z;
  for (let a = 2; a <= arm; a++) {
    p.px(x - a, y, '#ffffff');
    p.px(x + a, y, '#ffffff');
    p.px(x, y - a, '#ffffff');
    p.px(x, y + a, '#ffffff');
  }
}
/**
 * DIRECTION §1-2 회차의 바람 분위기 (화면 공간 · 한 번에 몇십 픽셀이라 가볍다)
 *  별이 많은 해 = 밤하늘 반짝이 · 풍년 = 낮에 가을빛 · 축제의 해 = 화면 위 깃발 줄 (낮)
 */
function drawWindSky(ctx: CanvasRenderingContext2D, T: number, LW: number, LH: number) {
  const nt = sceneNight();
  const p = P(ctx);
  if (windIs('stars') && nt > 0.2) {
    ctx.globalAlpha = Math.min(1, nt);
    const n = CONFIG.direction.wind.stars.skyTwinkles;
    for (let i = 0; i < n; i++) {
      const x = (i * 131.7 + 17) % LW;
      const y = (i * 71.3 + 9) % (LH * 0.45);
      if (Math.sin(T * 2.2 + i * 2.3) > -0.2) p.px(Math.round(x), Math.round(y), i % 5 ? '#e8ecff' : '#ffe08a');
    }
    ctx.globalAlpha = 1;
  }
  if (windIs('harvest') && nt < 0.99) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(255,190,110,${0.3 * (1 - nt)})`;
    ctx.fillRect(0, 0, LW, LH);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (windIs('festival') && nt < 0.95) {
    ctx.globalAlpha = 1 - nt;
    const cols = ['#e85a5a', '#ffd36b', '#6fd04b', '#5ab0e8', '#c07ae8'];
    for (let x = 4, i = 0; x < LW; x += 12, i++) {
      const y = 6 + Math.round(Math.sin((x / LW) * Math.PI * 3) * 3 + Math.sin(T * 2 + i) * 0.6);
      p.rect(x, y - 1, 12, 1, '#7a5a3a');
      const c = cols[i % cols.length];
      p.rect(x + 3, y, 5, 2, c);
      p.rect(x + 4, y + 2, 3, 2, c);
      p.px(x + 5, y + 4, c);
    }
    ctx.globalAlpha = 1;
  }
}
/** 유성우 밤: 남보라 하늘 + 반짝이 (화면 위쪽 절반) */
function drawShowerSky(ctx: CanvasRenderingContext2D, T: number) {
  const g = ctx.createLinearGradient(0, 0, 0, view.LH * 0.6);
  g.addColorStop(0, 'rgba(70,40,140,.5)');
  g.addColorStop(1, 'rgba(70,40,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.LW, view.LH * 0.6);
  const p = P(ctx);
  for (let i = 0; i < 40; i++) {
    const x = (i * 97.3) % view.LW;
    const y = (i * 53.7) % (view.LH * 0.5);
    if (Math.sin(T * 3 + i * 1.7) > 0.3) p.px(Math.round(x), Math.round(y), i % 4 ? '#e8e0ff' : '#ffe08a');
  }
}
/** 개발용: 첫 별 위치 (논리 좌표 · 지나간 정도 0~1) */
export const starInfo = () => {
  const s = STARS[0];
  return { on: !!s, x: s?.x ?? 0, y: s?.y ?? 0, vis: s?.k ?? 0, big: !!s?.big, n: STARS.length };
};
/** 누른 곳이 별똥별(아무거나) 근처인가 (넉넉히 — 반경 32, 큰 별은 40) */
export const starHit = (mx: number, my: number) => STARS.some((s) => Math.hypot(mx - s.x, my - s.y) < (s.big ? 40 : 32));

/** 모닥불 불꽃 높이 (칸 중심에서 위로 px) — 불티·빛의 중심 */
const FIRE_FLAME_Y = 12;

/**
 * 땅 개편: 레벨 장식 — 코드로 덧그린다 (건물 바로 다음에, 앞 건물·손님이 나중에 덮는다)
 *  여관: Lv.3 문 옆 등불 · Lv.4 처마 등불 줄 · Lv.6 화분 · Lv.7 굴뚝 연기 하나 더 · Lv.9 석등 · Lv.10 깃발·금빛 간판
 *  주점: Lv.3 테라스 등불 · Lv.5 술통 · Lv.6 깃발·금빛 간판
 */
function levelDeco(ctx: CanvasRenderingContext2D, o: Building, x: number, y: number, w: number) {
  const L = o.lvl;
  const inn = o.kind === 'inn';
  const at = (tx: number, ty: number): [number, number] => [view.OX + sx(tx, ty), view.OY + sy(tx, ty)];
  const left = at(o.tx, o.ty + o.fh);
  const front = at(o.tx + o.fw, o.ty + o.fh);
  const right = at(o.tx + o.fw, o.ty);
  const door = at(o.tx + o.fw / 2, o.ty + o.fh);
  const p = P(ctx);
  const night = NL > 3;
  // v0.24.2 innDecoObj: 화분·석등·술통은 진짜 장식(world/levelDeco.ts)이 된다
  const asObj = decoAsObjects();
  const sprite = (k: string, X: number, Y: number) => {
    const im0 = IMG[k];
    if (!im0) return;
    const im = tinted(im0, NL);
    ctx.drawImage(im, Math.round(X - im.width / 2), Math.round(Y - im.height + 2));
  };
  const lantern = (X: number, Y: number) => {
    p.rect(X, Y - 10, 1, 10, '#4a2f20');
    p.rect(X - 1, Y - 13, 3, 3, night ? '#ffd36b' : '#e8a23a');
    if (night) glow(ctx, X, Y - 12, 7, 0.35);
  };
  // 문 옆 등불 (여관·주점 Lv.3)
  if (L >= 3 && (inn ? !o.sprite?.startsWith('inn8') : true)) {
    // v0.24.2: 왼쪽 등불 밑동을 앞 테두리 안쪽으로 (예전 +4는 문 앞 칸에 걸쳐 유저 장식과 겹쳤다)
    lantern(Math.round(door[0] - 14), Math.round(door[1] + (asObj ? -9 : 4)));
    lantern(Math.round(door[0] + 10), Math.round(door[1] - 2));
  }
  // 처마 등불 줄 (여관 Lv.4): 왼쪽 모서리 → 앞 모서리, 살짝 처진 줄
  if (inn && L >= 4) {
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const X = left[0] + (front[0] - left[0]) * t;
      const Y = left[1] + (front[1] - left[1]) * t - 26 + Math.sin(t * Math.PI) * 3;
      if (i % 2) continue;
      const on = night || ((S.T * 2 + i) | 0) % 5 !== 0;
      p.rect(Math.round(X), Math.round(Y), 2, 2, on ? (i % 4 ? '#ffd36b' : '#ff9f6b') : '#8a6a3a');
      if (night) glow(ctx, X + 1, Y + 1, 4, 0.25);
    }
  }
  // 화분 (여관 Lv.6): 앞쪽 두 모서리
  if (inn && L >= 6 && !asObj) {
    sprite('flower_pot', left[0] + 10, left[1] - 2);
    sprite('flower_pot', front[0] - 4, front[1] - 6);
  }
  // 굴뚝 연기 하나 더 (여관 Lv.7)
  if (inn && L >= 7 && Math.random() < 0.06) puff(x + w * 0.7 - view.OX, y + 30 - view.OY, '#d8d2c8', (Math.random() - 0.5) * 4, -8, 2.2, 3);
  // 석등 (여관 Lv.9): 문 양옆
  if (inn && L >= 9 && !asObj) {
    sprite('stone_lantern', door[0] - 22, door[1] + 8);
    sprite('stone_lantern', door[0] + 18, door[1]);
    if (night) {
      glow(ctx, door[0] - 22, door[1] - 22, 8, 0.4);
      glow(ctx, door[0] + 18, door[1] - 30, 8, 0.4);
    }
  }
  // 술통 (주점 Lv.5): 오른쪽 앞 면
  if (!inn && L >= 5 && !asObj) sprite('barrels', (front[0] + right[0]) / 2 + 6, (front[1] + right[1]) / 2 + 4);
  // DIRECTION §1-2 축제의 해: 아직 깃발이 없는 여관·주점에도 깃발
  const festFlag = windIs('festival') && !S.visiting && !((inn && L >= 10) || (!inn && L >= 6));
  // v0.24.2: 깃대 밑동을 발판 안쪽으로 (오른쪽 꼭짓점에서 조금 안)
  const flagAt = (): [number, number] => (asObj ? [right[0] - 10, right[1] - 1] : [right[0] - 6, right[1] + 2]);
  if (festFlag) sprite('flagpole', ...flagAt());
  // 깃발 · 금빛 간판 (여관 Lv.10 · 주점 Lv.6)
  if ((inn && L >= 10) || (!inn && L >= 6)) {
    sprite('flagpole', ...flagAt());
    // 금빛 반짝임 (간판 자리 = 문 위)
    for (let i = 0; i < 4; i++) {
      const ph = (S.T * 1.5 + i * 0.37) % 1;
      if (ph > 0.25) continue;
      p.px(Math.round(door[0] - 8 + i * 5), Math.round(door[1] - 40 - i * 2), '#fff3b0');
    }
  }
}

/** 굴뚝 연기 자리 (반전 그림이면 x도 뒤집는다) */
const SMOKE_CACHE: Record<string, [number, number][] | undefined> = {};
function smokeOf(key: string | null): [number, number][] | undefined {
  if (!key) return undefined;
  if (key in SMOKE_CACHE) return SMOKE_CACHE[key];
  const b = baseKey(key);
  const s = SMOKE[b];
  const w = IMG[b]?.width ?? 0;
  return (SMOKE_CACHE[key] = s && isFlipKey(key) ? s.map(([x, y]) => [w - 1 - x, y] as [number, number]) : s);
}

function drawWild(ctx: CanvasRenderingContext2D, w: Wild) {
  const im0 = treeImg(w.k, true);
  if (!im0) return;
  const X = Math.round(view.OX + sx(w.x + 0.5, w.y + 0.5) - im0.width / 2);
  const Y = Math.round(view.OY + sy(w.x + 0.5, w.y + 0.5) + TH / 2 - im0.height + 3);
  if (Y + im0.height > -10 && Y < view.LH + 10 && X + im0.width > -10 && X < view.LW + 10) ctx.drawImage(tinted(im0, NL), X, Y);
}

/** 화면(논리) 밖으로 margin 넘게 벗어났나 */
const offscreen = (x: number, y: number, w: number, h: number, m = CONFIG.render.cullMargin) => x + w < -m || y + h < -m || x > view.LW + m || y > view.LH + m;

/** 그리다 실패한 것 하나: 캔버스 상태를 되돌리고 기록·다시 불러오기 (세션에 그림마다 한 번 기록) */
function recoverCtx(ctx: CanvasRenderingContext2D, name: string) {
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  } catch {
    /* 무시 */
  }
  spriteFailed(name);
}

/** 모닥불: campfire.png 32×34 프레임 4장, 0.15초마다. 프레임 아래에서 7px 위가 칸 중심. 밤에도 불꽃은 밝게 */
function drawFire(ctx: CanvasRenderingContext2D, o: { tx: number; ty: number }, night = NL, dy = 0) {
  if (!FIRE_FRAMES.length) return;
  const X = Math.round(view.OX + sx(o.tx + 0.5, o.ty + 0.5));
  const Y = Math.round(view.OY + sy(o.tx + 0.5, o.ty + 0.5));
  const im = fireFrame(Math.floor(S.T / CONFIG.fire.frameSeconds), night);
  ctx.drawImage(im, X - FIRE_W / 2, Y - (im.height - CONFIG.fire.baseFromBottom) + dy);
}

/** FIVESTARS ④ 따뜻한밤 등불 빛 (R21: 가운데 밝기 = 예전 0.32 × 1.4 · #ffb347 계열) */
export const LANTERN_A = 0.32 * 1.4;
function lanternGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,179,71,${Math.min(1, a)})`);
  g.addColorStop(0.45, `rgba(255,160,64,${Math.min(1, a) * 0.45})`);
  g.addColorStop(1, 'rgba(255,140,50,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** 이번 프레임 불빛 정도 (밤 · 노을 등불) */
let frameLight = 0;
/** 더하기(lighter)로 불빛 하나 — 합성·투명도는 원래대로 되돌린다 */
function lit(ctx: CanvasRenderingContext2D, fn: () => void) {
  const a = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  try {
    fn();
  } finally {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
  }
}
type Foot = { tx: number; ty: number; fw: number; fh: number };
/**
 * 모닥불 불꽃 자리가 앞 건물 그림(불투명 픽셀)에 가려졌나 — 가려졌으면 불티를 안 띄운다 (지붕 위로 불티가 솟지 않게)
 *  alpha·meta는 시험용으로 바꿔 끼울 수 있다
 */
export function flameCovered(f: Foot, objs: readonly (Foot & { sprite: string | null })[], alpha: (k: string, x: number, y: number) => number = alphaAt, meta: Record<string, { w: number; h: number }> = META): boolean {
  const X = sx(f.tx + 0.5, f.ty + 0.5);
  const Y = sy(f.tx + 0.5, f.ty + 0.5) - FIRE_FLAME_Y;
  for (const b of objs) {
    if (b === f || !b.sprite || !meta[b.sprite] || behindOf(f, b) !== -1) continue;
    const m = meta[b.sprite];
    const X0 = sx(b.tx, b.ty) + ((b.fw - b.fh) * TW) / 4 - m.w / 2; // = spriteOrigin (meta를 바꿔 끼울 수 있게 풀어 씀)
    const Y0 = sy(b.tx + b.fw, b.ty + b.fh) - m.h + 2;
    const px = Math.floor(X - Math.round(X0));
    const py = Math.floor(Y - Math.round(Y0));
    if (px >= 0 && py >= 0 && px < m.w && py < m.h && alpha(b.sprite, px, py) > 0) return true;
  }
  return false;
}

function baseImage(o: { sprite: string | null; hue: number | null }) {
  const key = o.sprite!;
  return o.hue != null ? recolored(key, o.hue) : IMG[key];
}

function drawObj(ctx: CanvasRenderingContext2D, o: Building) {
  if (o.kind === 'fire') {
    drawFire(ctx, o);
    // 모닥불 빛: 불을 그린 직후 (뒤 건물 벽은 비추고, 앞 건물은 나중에 그려지며 빛을 가린다)
    if (frameLight > 0.01) lit(ctx, () => glow(ctx, view.OX + sx(o.tx + 0.5, o.ty + 0.5), view.OY + sy(o.tx + 0.5, o.ty + 0.5) - FIRE_FLAME_Y, 34, frameLight * (0.45 + Math.sin(S.T * 9) * 0.05)));
    return;
  }
  if (!o.sprite || !IMG[o.sprite]) return;
  if (!META[o.sprite]) return missingMeta(o.sprite);
  const [x, y] = objTL(o);
  if (offscreen(x, y, IMG[o.sprite].width, IMG[o.sprite].height)) {
    if (o.pop) o.pop = Math.max(0, o.pop - 0.04);
    return;
  }
  const im = tinted(baseImage(o), NL);
  if (o.con || o.build !== undefined) {
    // CONSTRUCTION_SPEC §1: 공사 연출 (업그레이드는 목표 레벨 그림이 아래부터 올라간다)
    if (o.con?.kind === 'up') {
      const to = spriteFor(o.kind, o.con.to, o.flip);
      if (to && IMG[to]) {
        const tim = tinted(baseImage({ sprite: to, hue: o.hue }), NL);
        const [tx, ty] = spriteOrigin({ sprite: to, tx: o.tx, ty: o.ty, fw: o.fw, fh: o.fh });
        return drawConstruction(ctx, o, tim as HTMLCanvasElement, Math.round(view.OX + tx), Math.round(view.OY + ty));
      }
    }
    return drawConstruction(ctx, o, im as HTMLCanvasElement, x, y);
  }
  if (o.pop) {
    // 쾅! 살짝 튀는 연출
    const k = o.pop;
    ctx.save();
    ctx.translate(x + im.width / 2, y + im.height);
    ctx.scale(1 + k * 0.12, 1 - k * 0.18);
    ctx.drawImage(im, -im.width / 2, -im.height);
    ctx.restore();
    o.pop = Math.max(0, o.pop - 0.04);
  } else {
    // TOWN T2: 이어지는 장식 — 뒤쪽 이웃 칸의 같은 장식과 띠로 잇는다 (가로·세로·모서리)
    if (CONNECT[o.kind]) drawJoins(ctx, o, im, x, y);
    // LUXE §1: 몸통이 움직이는 명품 장식 (깃발·그네·책·회전목마·열기구·알·오로라)
    if (LX_BODY.has(o.kind)) drawLuxeBody(ctx, o, im, x, y);
    else ctx.drawImage(im, x, y);
  }
  // 3) 이 건물을 그린 직후 창문 불빛
  drawLight(ctx, o.sprite, x, y);
  // DECO_DROP §2: 뽐내기 장식 — 밤 빛 · 동상 이름판 · 금빛 간판 여관 이름
  if (def(o.kind).luxury) drawLuxury(ctx, o, x, y, im);
  // LUXE §1: 명품관 장식 — 밤 빛 · 반짝이 · 입자 · 세트 완성 반짝이 (그린 직후 = 앞 건물이 가린다)
  if (def(o.kind).luxe) drawLuxeFx(ctx, o, x, y, im, Math.max(NL / CONFIG.dayNight.tintSteps, duskLight));
  // EASTER: 개척자 전용 장식 — 김 · 길 반짝 · 밤 등불 · 바람개비
  if (def(o.kind).pioneerDeco) drawPioneer(ctx, o, x, y, im);
  // TOWN T5: 꾸미기 장식 — 밤 불빛 · 물 반짝 · 풍차
  if (DECO_FX[o.kind]) drawDecoFx(ctx, o, x, y, im);
  // 땅 개편: 여관·주점 레벨 장식 (그림이 안 바뀌는 레벨마다 눈에 보이는 변화 하나)
  if (o.kind === 'inn' || o.kind === 'tavern') levelDeco(ctx, o, x, y, im.width);
  // BUILDINGS_SPEC §3: 다 자란 텃밭 위 「수확!」
  //  CHECKIN §J8: 말풍선이 떠 있으면 바구니 말풍선이 대신한다
  if (o.kind === 'garden' && !S.visiting && o.plots?.some((p) => plotLeft(p) === 0) && !(vis('bldStatus') && hasBubble(o))) {
    const X = Math.round(x + im.width / 2);
    const Y = Math.round(y - 4 + Math.sin(S.T * 4) * 2);
    const pp = P(ctx);
    pp.rect(X - 15, Y - 9, 30, 11, '#1c1018');
    pp.rect(X - 14, Y - 8, 28, 9, '#6fd04b');
    ctx.font = '8px "Galmuri9"';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1c1018';
    ctx.fillText('수확!', X, Y);
  }
  // 지붕 위 인원 숫자
  if (o.inside.length) {
    const X = x + im.width / 2;
    const Y = y - 6 + Math.round(Math.sin(S.T * 3) * 1.5);
    const p = P(ctx);
    p.rect(X - 7, Y - 5, 14, 8, '#fff3d6');
    p.rect(X - 6, Y - 6, 12, 1, '#fff3d6');
    p.px(X, Y + 3, '#fff3d6');
    ctx.fillStyle = '#1c1018';
    ctx.font = '8px "Galmuri9"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(o.inside.length), X, Y + 2);
  }
}

// ───────── 배치 미리보기 ─────────

/** 마름모 한 칸 채우기 (타일 좌표) */
function fillTile(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const X = view.OX + sx(x, y);
  const Y = view.OY + sy(x, y);
  for (let k = 0; k < TH; k++) {
    const hw = (k < TH / 2 ? k + 1 : TH - k) * 2;
    ctx.fillRect(X - hw, Y + k, hw * 2, 1);
  }
}

/** 타일 좌표 두 점을 잇는 1px 도트 선 */
function isoLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const X0 = view.OX + sx(x0, y0);
  const Y0 = view.OY + sy(x0, y0);
  const X1 = view.OX + sx(x1, y1);
  const Y1 = view.OY + sy(x1, y1);
  const n = Math.max(Math.abs(X1 - X0), Math.abs(Y1 - Y0));
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(X0 + ((X1 - X0) * i) / n), Math.round(Y0 + ((Y1 - Y0) * i) / n), 1, 1);
}

/** 빨간 실루엣 (겹치는 건물 깜빡임) */
const RED = new Lru<Drawable, HTMLCanvasElement>(CONFIG.render.redCacheMax);
function redOf(im: Drawable): HTMLCanvasElement {
  let c = RED.get(im);
  if (c && canvasAlive(c)) return c;
  c = document.createElement('canvas');
  c.width = im.width;
  c.height = im.height;
  const x = c.getContext('2d')!;
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#ff4a4a';
  x.fillRect(0, 0, c.width, c.height);
  return RED.set(im, c);
}

function drawPlacement(ctx: CanvasRenderingContext2D, pl: Placement) {
  const T = S.T;
  const tx = pl.tx!;
  const ty = pl.ty!;
  const PL = CONFIG.placement;
  // 1) 주변 어둡게
  ctx.fillStyle = `rgba(8,10,24,${PL.dim})`;
  ctx.fillRect(0, 0, view.LW, view.LH);
  // 땅 개편 §4: 처음 지을 때 — 울타리 안 전체를 연한 초록으로 「여기 다 돼요」
  if (landHint.firstBuild && !S.visiting) {
    const [a, b] = landBounds();
    ctx.fillStyle = 'rgba(140,230,120,0.16)';
    ctx.beginPath();
    ctx.moveTo(view.OX + sx(a, a), view.OY + sy(a, a));
    ctx.lineTo(view.OX + sx(b, a), view.OY + sy(b, a));
    ctx.lineTo(view.OX + sx(b, b), view.OY + sy(b, b));
    ctx.lineTo(view.OX + sx(a, b), view.OY + sy(a, b));
    ctx.closePath();
    ctx.fill();
  }
  // 2) 겹치는 건물은 빨갛게 깜빡
  const hit = new Set<Building>();
  for (let j = 0; j < pl.fh; j++)
    for (let i = 0; i < pl.fw; i++) {
      const g = grid[ty + j]?.[tx + i];
      // FEEDBACK23 §5: 입구를 옮길 땐 따라오는 정문은 빨갛게 하지 않는다
      if (g && g !== pl.move && !(pl.ent && g.kind === 'gate')) hit.add(g);
    }
  const blink = Math.sin(T * 10) > 0 ? 0.7 : 0.3;
  for (const o of hit) {
    ctx.globalAlpha = blink;
    if (o.sprite && IMG[o.sprite]) {
      const [x, y] = objTL(o);
      const b = baseImage(o);
      if (okToDraw(b)) ctx.drawImage(redOf(b), x, y);
    } else {
      ctx.fillStyle = '#ff4a4a';
      fillTile(ctx, o.tx, o.ty);
    }
  }
  // 3) 발자국 칸: 반투명 채움 + 밝은 1px 테두리 (초록 = 가능, 빨강 = 불가)
  const ok = pl.ok;
  ctx.globalAlpha = 0.38;
  for (let j = 0; j < pl.fh; j++)
    for (let i = 0; i < pl.fw; i++) {
      const free = (inLand(tx + i, ty + j) || outsideOk(pl)) && (!grid[ty + j]?.[tx + i] || grid[ty + j][tx + i] === pl.move);
      ctx.fillStyle = ok ? '#5fd06a' : free ? '#e0a040' : '#ff4040';
      fillTile(ctx, tx + i, ty + j);
    }
  ctx.globalAlpha = 1;
  ctx.fillStyle = ok ? '#b8ffb0' : '#ffb0b0';
  isoLine(ctx, tx, ty, tx + pl.fw, ty);
  isoLine(ctx, tx + pl.fw, ty, tx + pl.fw, ty + pl.fh);
  isoLine(ctx, tx + pl.fw, ty + pl.fh, tx, ty + pl.fh);
  isoLine(ctx, tx, ty + pl.fh, tx, ty);
  // 4) 문 방향 화살표 (문 앞 칸이 막혀 있으면 빨강)
  if (pl.sprite && !['well', 'board', 'tree', 'pine', 'fire'].includes(pl.kind)) {
    const [dx, dy] = doorOf({ tx, ty, fw: pl.fw, fh: pl.fh, flip: pl.flip });
    const g = grid[dy]?.[dx];
    const blocked = (!inLand(dx, dy) && !outsideOk(pl)) || (!!g && g !== pl.move);
    const X = Math.round(view.OX + sx(dx + 0.5, dy + 0.5));
    const Y = Math.round(view.OY + sy(dx + 0.5, dy + 0.5));
    const p = P(ctx);
    const c = blocked ? '#ff5a5a' : '#ffffff';
    // 문이 바라보는 쪽(앞 왼쪽 / 반전이면 앞 오른쪽)으로 꺾쇠
    const s = pl.flip ? 1 : -1;
    const bob = Math.round(Math.sin(T * 6));
    for (let k = 0; k < 4; k++) {
      p.px(X + s * (k * 2) + s * bob, Y + k - 2, c);
      p.px(X + s * (k * 2) + s * bob, Y - k + 4, c);
      p.px(X + s * (k * 2 + 1) + s * bob, Y + k - 2, c);
      p.px(X + s * (k * 2 + 1) + s * bob, Y - k + 4, c);
    }
  }
  // 5) 유령 건물: 75% 불투명, 위아래 2px 둥실 · 칸에 붙는 순간 1px 톡
  const bob = Math.round(Math.sin(T * 3) * PL.bobPx) - (pl.snapT != null && T - pl.snapT < PL.snapSeconds ? 1 : 0);
  ctx.globalAlpha = PL.ghostAlpha;
  if (pl.kind === 'fire') drawFire(ctx, { tx, ty }, 0, bob);
  else if (pl.sprite && IMG[pl.sprite]) {
    const [x, y] = objTL({ sprite: pl.sprite, tx, ty, fw: pl.fw, fh: pl.fh });
    const hue = pl.move?.hue ?? null;
    const b = baseImage({ sprite: pl.sprite, hue });
    if (okToDraw(b)) ctx.drawImage(b, x, y + bob);
  }
  ctx.globalAlpha = 1;
  // FEEDBACK23 §5: 입구 = 바닥에서 바깥(앞)으로 향하는 꺾쇠 두 개
  if (pl.ent) {
    const p = P(ctx);
    const X = Math.round(view.OX + sx(tx + 0.5, ty + 1));
    const Y = Math.round(view.OY + sy(tx + 0.5, ty + 1));
    const c = pl.ok ? '#ffffff' : '#ff5a5a';
    const bob2 = Math.round(Math.sin(T * 6));
    for (const o of [0, 5]) for (let k = 0; k < 4; k++) {
      p.px(X - 3 + k, Y + o + bob2 + k, c);
      p.px(X + 3 - k, Y + o + bob2 + k, c);
    }
    return;
  }
  // 베타: 어울림 범위 · 짝 건물 초록 · 미리보기 말풍선 (유령 위에)
  drawPlacementHarmony(ctx, pl);
}

/** pose: 문 연출 중일 때 발 위치(월드 원점 기준)·뒷모습·방향 */
/** 손님 겉모습 프레임 (끼운 무기가 바뀔 수 있으니 1초마다 다시 본다) */
const LOOK = new WeakMap<Actor, { f: CharFrames; at: number }>();
function looksOf(a: Actor): CharFrames {
  const c = LOOK.get(a);
  if (c && S.T - c.at < 1) return c.f;
  const { key, def } = appearance(a);
  const f = framesFor(key, def);
  LOOK.set(a, { f, at: S.T });
  return f;
}

/** HERODOT 3: 조용히 할 때 (배터리 절약 · 오래 손 안 댐 = 화면 보호) — 시그니처 동작·별 입자를 쉰다 */
const calmNow = () => saverOn() || ssOn() || idleFor() >= CONFIG.loop.idleAfterSec;
/** 전설·영웅 시그니처 동작: 가만히 있을 때 8~12초마다 한 번 (화면에 보일 때만 · 처음 재생 때 프레임을 만든다) */
function sigAt(s: CharFrames, T: number, ph: number): HTMLCanvasElement | null {
  if (!s.tier || calmNow()) return null;
  const period = 8 + ((ph * 0.37) % 4);
  const t = (T + ph * 3) % period;
  // FIVESTARS ④: 다섯 별 대기 동작은 1초 (품질 규칙 ≤1초)
  const dur = s.star ? 1 : 1.1;
  if (t >= dur) return null;
  const fr = s.sig;
  return fr?.length ? fr[Math.min(fr.length - 1, Math.floor((t / dur) * fr.length))] : null;
}

/** HERODOT 이름표 (R8 판정): 이번 프레임에 그릴 이름표 · 눌러 본 영웅(몇 초 동안 이름표) */
const TAGS: { X: number; top: number; name: string; tier: 'legend' | 'hero' | 'mythic' | 'guest'; d: number; rainbow?: boolean; alpha?: number }[] = [];
/** FIVESTARS ④ 무지갯빛 이름표 색 (글자마다 · 천천히 흐름 · 조용할 땐 멈춤) */
export const RAINBOW = ['#ff8a8a', '#ffc46b', '#fff08a', '#9be89b', '#8ad0ff', '#b8a0ff', '#ff9ad8'];
/** 설정 「손님 이름 항상 보기」가 지금 그려지나 (UI 끄기·화면 보호 중엔 쉼 · 사진 모드는 그 전에 TAGS를 비운다) — 프레임마다 한 번 */
let namesT = -1;
let namesV = false;
function allNames(): boolean {
  if (S.T !== namesT) {
    namesT = S.T;
    namesV = guestNamesOn() && !uiHiddenBody() && !ssOn();
  }
  return namesV;
}
const TAG_TAP = new WeakMap<Actor, number>();
/** 손님 창을 열면(누르면) 그 영웅 이름표를 6초 동안 보인다 · FIRSTLOOK §2-3 화면 조용히: 누른 사람 누구나 3초 */
export function tagTap(a: Actor) {
  TAG_TAP.set(a, S.T + (quietOn() ? CONFIG.firstLook.quiet.tagTapSec : 6));
}
/** FIRSTLOOK §2-3: 이 사람 이름표 규칙 (null = 예전 그대로 — 조용히 끔 · 「손님 이름 항상 보기」 켬) */
const quietTag = (a: Actor, tier: 'legend' | 'mythic' | 'hero' | null, T: number) =>
  nameTagRule({ quiet: quietOn(), names: guestNamesOn(), tier, regular: a.status === 'regular' || a.status === 'hero', zoom: S.zoom, tapped: (TAG_TAP.get(a) ?? -1) > T });
/** 이름표 한 번에: 전설·신화는 화면 가운데에 가까운 3명까지 · 겹치면 위로 한 줄씩 비켜 쌓는다 · 영웅(흰)은 그 다음
 *  「손님 이름 항상 보기」: 그 뒤에 나머지 전설·신화 → 평범한 손님(흐린 베이지) — 둘 다 비킬 자리가 없으면 안 그린다 (앞 이름표를 가리지 않게) */
function drawNamedTags(ctx: CanvasRenderingContext2D) {
  if (!TAGS.length) return;
  const names = allNames();
  const p = P(ctx);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = '8px "Galmuri9"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const byD = (q: { d: number }, r: { d: number }) => q.d - r.d;
  const allLeg = TAGS.filter((t) => t.tier === 'legend' || t.tier === 'mythic').sort(byD);
  const legends = allLeg.slice(0, 3);
  const heroes = TAGS.filter((t) => t.tier === 'hero').sort(byD);
  // FIRSTLOOK §2-3: 조용히일 때 넣은 손님 이름표(누름 · 배율 3 단골)는 「항상 보기」가 꺼져 있어도 그린다
  const rest = names ? [...allLeg.slice(3), ...TAGS.filter((t) => t.tier === 'guest').sort(byD)] : TAGS.filter((t) => t.tier === 'guest').sort(byD);
  const placed: [number, number, number, number][] = [];
  const hit = (b: [number, number, number, number]) => placed.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
  for (const t of [...legends, ...heroes, ...rest]) {
    const guest = t.tier === 'guest';
    // 앞 3명 밖의 전설·평범한 손님 = 「손님 이름 항상 보기」로 더 그리는 것 — 덜 비켜 쌓고 자리가 없으면 쉰다
    const extra = guest || ((t.tier === 'legend' || t.tier === 'mythic') && !legends.includes(t));
    const w = Math.ceil(ctx.measureText(t.name).width) + (t.tier === 'mythic' ? 6 : 0);
    let ty = t.top - 1;
    const box = (): [number, number, number, number] => [t.X - w / 2 - 2, ty - 8, t.X + w / 2 + 2, ty + 2];
    let b = box();
    for (let n = 0; n < (extra ? 2 : 6) && hit(b); n++) {
      ty -= 9;
      b = box();
    }
    // 영웅 이름표는 비킬 자리가 없으면 그리지 않는다 (전설 이름표를 가리지 않게)
    if ((t.tier === 'hero' || extra) && hit(b)) continue;
    placed.push(b);
    const col = guest ? '#e6dccb' : t.tier === 'mythic' ? '#dfe6f5' : t.tier === 'legend' ? '#ffd36b' : '#ffffff';
    const tx = t.X - (t.tier === 'mythic' ? 3 : 0);
    // 평범한 손님은 흐리게 (테두리도 한 겹 덜)
    ctx.globalAlpha = t.alpha ?? (guest ? 0.78 : 1);
    ctx.fillStyle = '#1a1220';
    ctx.fillText(t.name, tx + 1, ty + 1);
    if (!guest) ctx.fillText(t.name, tx - 1, ty + 1);
    ctx.fillText(t.name, tx, ty + 2);
    if (t.rainbow) {
      // 무지갯빛: 글자마다 다른 색 (가운데 정렬 그대로 · 왼쪽부터 한 글자씩)
      const sh = calmNow() ? 0 : Math.floor(S.T * 2);
      const chars = [...t.name];
      const tw2 = ctx.measureText(t.name).width;
      let cx2 = tx - tw2 / 2;
      ctx.textAlign = 'left';
      chars.forEach((ch, k) => {
        ctx.fillStyle = RAINBOW[(k + sh) % RAINBOW.length];
        ctx.fillText(ch, cx2, ty);
        cx2 += ctx.measureText(ch).width;
      });
      ctx.textAlign = 'center';
    } else {
      ctx.fillStyle = col;
      ctx.fillText(t.name, tx, ty);
    }
    ctx.globalAlpha = 1;
    if (t.tier === 'mythic') {
      const sx3 = tx + Math.ceil((w - 6) / 2) + 4;
      const sy3 = ty - 4;
      p.px(sx3, sy3, '#ffffff');
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(sx3 + dx, sy3 + dy, '#dfe6f5');
    }
  }
  TAGS.length = 0;
}

/** HERODOT 3: 전설 2초마다 1px 반짝 · 신화 발밑 별 입자 2~3개 · 머리 위 이름표 */
function namedFx(ctx: CanvasRenderingContext2D, a: Actor, s: CharFrames, X: number, Y: number, top: number, dir: number, T: number) {
  const p = P(ctx);
  const legend = s.tier === 'legend' || s.tier === 'mythic';
  if (legend && a.st === 'idle' && (T + a.ph) % 2 < 0.14) {
    const sx2 = X + (dir < 0 ? -5 : 5);
    p.px(sx2, top + 5, '#ffffff');
    p.px(sx2 - 1, top + 5, '#fff3b0');
    p.px(sx2 + 1, top + 5, '#fff3b0');
    p.px(sx2, top + 4, '#fff3b0');
    p.px(sx2, top + 6, '#fff3b0');
  }
  if (s.tier === 'mythic' && !calmNow())
    for (let i = 0; i < 3; i++) {
      const k = (T * 0.3 + i / 3 + a.ph) % 1;
      const px2 = X - 5 + i * 5 + Math.round(Math.sin(T * 1.3 + i * 2));
      const py2 = Y - 1 - Math.round(k * 14);
      const c = k < 0.5 ? '#fff3b0' : '#ffd36b';
      p.px(px2, py2, c);
      if (k < 0.3) {
        p.px(px2 - 1, py2, '#ffd36b');
        p.px(px2 + 1, py2, '#ffd36b');
      }
    }
  // 이름표는 모아 두었다가 한 번에 (겹치면 위로 쌓기 · 전설·신화 최대 3 · 영웅은 확대 2배 이상이거나 눌렀을 때만)
  const tier = s.tier!;
  const tagTop = top + (s.idle[0].height - 33) + 2;
  // FIRSTLOOK §2-3 화면 조용히: 평소엔 이름표 대신 머리 위 2px 등급색 점 · 누르면 3초 · 배율 3이면 연하게
  const qt = quietTag(a, tier, T);
  if (qt) {
    if (qt.dot) p.rect(X - 1, tagTop - 5, 2, 2, TIER_DOT[tier]);
    if (qt.tag && TAGS.length < 64) TAGS.push({ X, top: tagTop, name: a.name, tier, d: Math.hypot(X - view.LW / 2, top - view.LH / 2), rainbow: !!s.star, alpha: qt.alpha });
    return;
  }
  if (TAGS.length < 64 && (tier !== 'hero' || S.zoom >= 2 || (TAG_TAP.get(a) ?? -1) > T || allNames())) TAGS.push({ X, top: tagTop, name: a.name, tier, d: Math.hypot(X - view.LW / 2, top - view.LH / 2), rainbow: !!s.star });
}

function drawActor(ctx: CanvasRenderingContext2D, a: Actor, pose?: { pos: [number, number]; back: boolean; dir: 1 | -1 }) {
  const s = looksOf(a);
  const T = S.T;
  let fr: HTMLCanvasElement;
  const dir = pose ? pose.dir : a.dir;
  const X = Math.round(view.OX + (pose ? pose.pos[0] : sx(a.x, a.y)));
  const Y = Math.round(view.OY + (pose ? pose.pos[1] : sy(a.x, a.y) + TH / 2));
  const fade = a.fading !== undefined ? Math.max(0, a.fading) : 1;
  if (offscreen(X - 12, Y - 48, 24, 48)) return;
  let sg: HTMLCanvasElement | null = null;
  // FIRSTLOOK §6 flCharPop: 걷는 동안 발이 지나가는 프레임에서 통째로 1px 위로 (통통)
  const wf = Math.floor(T * 8 + a.ph) % 4;
  const walking = !!pose || a.st === 'walk';
  if (pose) fr = (pose.back ? s.walkB : s.walk)[wf];
  else if (a.st === 'walk') fr = (a.back ? s.walkB : s.walk)[wf];
  else if (a.st === 'idle' && a.back && !a.role) fr = s.idleB[Math.floor(T * 1.6 + a.ph) % 2];
  else if (a.st === 'atk') fr = s.atk[Math.floor(T * 3 + a.ph) % 2];
  else if (a.st === 'pray') fr = s.pray[Math.floor(T * 1.5 + a.ph) % 2];
  else if (a.st === 'sit') fr = s.sit[Math.floor(T * 2 + a.ph) % 2];
  // HERODOT 3: 전설·영웅 시그니처 동작
  else if (a.st === 'idle' && s.tier && (sg = sigAt(s, T, a.ph))) fr = sg;
  // HERODOT: 새 도트는 2~3초에 한 번 눈 깜빡임 (blink 프레임이 있을 때만)
  else if (s.blink && (T + a.ph) % (2 + (a.ph % 1)) < 0.13) fr = s.blink;
  else fr = s.idle[Math.floor(T * 1.6 + a.ph) % 2];
  // 리마스터: 발밑 그림자 2톤 도트 타원 (반투명 없이)
  // FIRSTLOOK §6 flCharPop: 디더 빈칸을 채워 한 단계 진하게 (돌길 위에서도 보이게)
  if (fade > 0.5) dotShadow(ctx, X, Y, 6, 2, shadowGap());
  ctx.globalAlpha = (a.pop ? 1 - a.pop / 0.4 : 1) * fade;
  const img = tinted(fr, NL);
  // 발 위치는 그림 크기와 상관없이 같은 칸 (전설 26×35도 24×33과 발이 같은 줄)
  const x = X - (fr.width >> 1);
  const y = Y - 32 - (fr.height - 33) + (a.st === 'sit' ? 3 : 0);
  // 통통은 그림만 (이름표·등불 자리는 그대로)
  const yb = y + walkBob(walking, wf);
  if (dir < 0) {
    ctx.save();
    ctx.translate(x + fr.width, yb);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  } else ctx.drawImage(img, x, yb);
  ctx.globalAlpha = 1;
  // FIVESTARS ④ 따뜻한밤 허리 등불: 밤에 2칸 빛 — 그린 직후 깊이 순서 안에서 (앞 건물이 나중에 그려지며 가린다 · v0.25.24 불빛 규칙)
  if (s.star === 'warmnight' && fade === 1 && frameLight > 0.01 && a.st !== 'sit') {
    // R21: 3칸 · 가운데 +40% · 따뜻한 주황(#ffb347) · 대기 동작에서 등불을 들어 올린 프레임(2·3)이면 빛도 같이 위로
    const up = !!sg && !!s.sig && (s.sig.indexOf(sg) === 1 || s.sig.indexOf(sg) === 2);
    lit(ctx, () => lanternGlow(ctx, up ? X + (dir < 0 ? -6 : 6) : X + (dir < 0 ? 5 : -5), up ? Y - 27 : Y - 12, TH * 3, LANTERN_A * frameLight));
  }
  // 수련: 흰 바람 / 밭일: 물방울
  if (a.st === 'atk' && Math.random() < 0.06) puff(X + a.dir * 12 - view.OX, Y - 16 - view.OY, '#ffffff', a.dir * 10, -4, 0.25, 1);
  if (a.st === 'pray' && Math.random() < 0.05) puff(X + a.dir * 8 - view.OX, Y - 12 - view.OY, '#8fd0ff', 0, 10, 0.5, 1);
  // HERODOT 3: 전설 반짝 · 신화 별 입자 · 이름표 (전설 금색 · 신화 은색 + 별 · 영웅 흰색)
  if (s.tier && fade === 1) namedFx(ctx, a, s, X, Y, y, dir, T);
  // 설정 「손님 이름 항상 보기」: 등급 이름표가 없는 손님도 (직원·주인 · 금색 이름표를 단 개척자는 빼고)
  else if (!s.tier && fade === 1 && !a.role && !a.cameo && TAGS.length < 48 && allNames())
    TAGS.push({ X, top: y + (s.idle[0].height - 33) + 2, name: a.name, tier: 'guest', d: Math.hypot(X - view.LW / 2, y - view.LH / 2) });
  // FIRSTLOOK §2-3 화면 조용히: 등급 없는 손님도 누르면 3초 · 배율 3이면 단골 이상 연하게
  else if (!s.tier && fade === 1 && !a.role && !a.cameo && TAGS.length < 48) {
    const qt = quietTag(a, null, T);
    if (qt?.tag) TAGS.push({ X, top: y + (s.idle[0].height - 33) + 2, name: a.name, tier: 'guest', d: Math.hypot(X - view.LW / 2, y - view.LH / 2), alpha: qt.alpha });
  }
  // 전설 영웅: 머리 위 금빛 마름모 + 반짝 · 방문 때 금빛 발자국
  if (a.legendId && fade === 1 && !s.tier) {
    const p = P(ctx);
    const b = Math.round(Math.sin(T * 3 + a.ph) * 1);
    const c = a.status === 'hero' ? '#ffd36b' : '#fff3b0';
    p.rect(X - 1, Y - 38 + b, 3, 3, c);
    p.px(X, Y - 40 + b, c);
    p.px(X, Y - 34 + b, c);
    p.px(X - 2, Y - 37 + b, c);
    p.px(X + 2, Y - 37 + b, c);
    if (Math.random() < 0.04) puff(X - view.OX + (Math.random() * 12 - 6), Y - 20 - view.OY - Math.random() * 10, '#ffd36b', 0, -8, 0.5, 1);
    if (a.goldSteps && a.st === 'walk' && Math.random() < 0.35) puff(X - view.OX + (Math.random() * 6 - 3), Y - view.OY - 1, '#ffd36b', 0, 0, 1.6, 2);
  } else if (a.legendId && fade === 1) {
    if (Math.random() < 0.04) puff(X - view.OX + (Math.random() * 12 - 6), Y - 20 - view.OY - Math.random() * 10, '#ffd36b', 0, -8, 0.5, 1);
    if (a.goldSteps && a.st === 'walk' && Math.random() < 0.35) puff(X - view.OX + (Math.random() * 6 - 3), Y - view.OY - 1, '#ffd36b', 0, 0, 1.6, 2);
  } else if (a.heroId && fade === 1 && !s.tier) {
    const p = P(ctx);
    const b = Math.round(Math.sin(T * 3 + a.ph) * 1);
    const c = a.status === 'hero' ? '#ffd36b' : '#cfd8ff';
    p.rect(X - 1, Y - 37 + b, 3, 1, c);
    p.rect(X, Y - 38 + b, 1, 3, c);
  } else if (a.rarity === 'legend' && Math.random() < 0.03) puff(X - view.OX + (Math.random() * 12 - 6), Y - 20 - view.OY - Math.random() * 10, '#ffd36b', 0, -8, 0.5, 1);
  // EASTER §2: 놀러 온 개척자 — 금색 이름표
  if (a.cameo && fade === 1) {
    ctx.font = '8px "Galmuri9"';
    ctx.textAlign = 'center';
    const tw = Math.ceil(ctx.measureText(a.name).width) + 6;
    const ty = Y - 44 + Math.round(Math.sin(T * 2 + a.ph));
    ctx.fillStyle = '#5a3a10';
    ctx.fillRect(X - tw / 2 - 1, ty - 9, tw + 2, 12);
    ctx.fillStyle = '#e8b84a';
    ctx.fillRect(X - tw / 2, ty - 8, tw, 10);
    ctx.fillStyle = '#3a2408';
    ctx.textBaseline = 'middle';
    ctx.fillText(a.name, X, ty - 3);
    ctx.textBaseline = 'alphabetic';
    // 머리 위 ★ 하나
    const st = P(ctx);
    st.rect(X - 1, ty - 14, 3, 3, '#ffd36b');
    st.px(X, ty - 15, '#ffd36b');
    st.px(X, ty - 11, '#ffd36b');
    st.px(X - 2, ty - 13, '#ffd36b');
    st.px(X + 2, ty - 13, '#ffd36b');
    // 따뜻한밤의 등불: 밤에만 주변 2칸 은은한 빛
    if (a.cameo === 'warmnight' && NL > 0) {
      const night = NL / CONFIG.dayNight.tintSteps;
      const r = TH * 2.2;
      const g = ctx.createRadialGradient(X + 4, Y - 14, 0, X + 4, Y - 14, r);
      g.addColorStop(0, `rgba(255,200,110,${0.4 * night})`);
      g.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(X + 4 - r, Y - 14 - r, r * 2, r * 2);
      ctx.restore();
    }
    if (Math.random() < 0.03) puff(X - view.OX + (Math.random() * 12 - 6), Y - 20 - view.OY - Math.random() * 10, '#ffd36b', 0, -8, 0.5, 1);
  }
  // 우체부 머리 위 !
  if (a.role === 'npc') {
    const b = Math.round(Math.sin(T * 5) * 1.5);
    const p = P(ctx);
    p.rect(X - 1, Y - 38 + b, 2, 5, '#ffd36b');
    p.rect(X - 1, Y - 31 + b, 2, 2, '#ffd36b');
  }
}

/** 여관 위 이름표 */
function drawNamePlate(ctx: CanvasRenderingContext2D, nt: number) {
  const inn = world.objs.find((o) => o.kind === 'inn');
  if (!inn || !inn.sprite) return;
  const name = (S.visiting ? S.visiting.name : S.innName) || '';
  if (!name) return;
  const m = META[inn.sprite];
  // 핫픽스 13: 크기표에 없는 그림이면 (옛 meta.json + 새 코드) 이름판은 건너뛴다 — 예전엔 여기서 i.w 오류로 멈췄다
  if (!m) return missingMeta(inn.sprite);
  const [x, y] = objTL(inn);
  ctx.font = '10px "Galmuri9"';
  const w = Math.ceil(ctx.measureText(name).width) + 10;
  const X = Math.round(x + m.w / 2 - w / 2);
  const Y = y - 16;
  const p = P(ctx);
  // DIRECTION §1-1: 여정을 다 채운 주인 — 여관 간판(이름판) 금테 + 반짝
  const gold = !S.visiting && P_.legacy.journeyEnd;
  if (gold) {
    p.rect(X - 3, Y - 3, w + 6, 19, '#7a5a1a');
    p.rect(X - 2, Y - 2, w + 4, 17, '#ffd36b');
  }
  p.rect(X, Y, w, 13, '#5a3a24');
  p.rect(X + 1, Y + 1, w - 2, 11, '#a06a3c');
  p.hline(X + 1, Y + 1, w - 2, '#c08050');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#5a3420';
  ctx.fillText(name, X + 5, Y + 3);
  ctx.fillStyle = nt > 0.5 ? '#ffe7a8' : '#fff3d6';
  ctx.fillText(name, X + 5, Y + 2);
  if (gold) {
    const k = Math.floor((S.T * 18) % (2 * (w + 15)));
    const sx2 = k < w + 15 ? X - 1 + k : X - 1 + (2 * (w + 15) - k);
    p.px(Math.min(X + w, sx2), Y - 1, '#fffbe0');
    p.px(Math.max(X - 1, Math.min(X + w, 2 * X + w - sx2)), Y + 13, '#fffbe0');
  }
}

/** 탭한 화면 좌표의 건물 (투명 픽셀 무시, 앞 건물부터) */
export function buildingAt(mx: number, my: number, alphaAt: (k: string, x: number, y: number) => number): Building | null {
  const hits = world.objs
    .filter((o) => o.sprite && IMG[o.sprite])
    .sort((p, q) => q.tx + q.ty + q.fw + q.fh - (p.tx + p.ty + p.fw + p.fh));
  const hitAt = (o: Building) => {
    const [x, y] = objTL(o);
    const im = IMG[o.sprite!];
    return mx >= x && my >= y && mx < x + im.width && my < y + im.height && !!alphaAt(o.sprite!, mx - x, my - y);
  };
  if (decoAsObjects()) {
    // v0.24.2: 그리는 순서(발판 겹침 기준 · orderThings)와 같게 — 큰 건물 옆면에 붙은 장식이 그림으론 앞인데 탭은 건물로 가던 문제
    const all = hits.filter(hitAt);
    const front = all.find((c) => !all.some((d) => d !== c && behindOf(c, d) === -1));
    if (front ?? all[0]) return front ?? all[0];
  } else
    for (const o of hits) if (hitAt(o)) return o;
  // 모닥불 (건물 그림이 아니라 칸으로)
  for (const o of world.objs) {
    if (o.kind !== 'fire') continue;
    const X = view.OX + sx(o.tx + 0.5, o.ty + 0.5);
    const Y = view.OY + sy(o.tx + 0.5, o.ty + 0.5);
    if (Math.abs(mx - X) < 14 && my > Y - 26 && my < Y + 7) return o;
  }
  return null;
}


/**
 * 문으로 드나드는 손님 (그 건물을 그린 직후):
 * 문턱을 넘는 동안 문 열림(어두운 안쪽, 밤엔 따뜻한 불빛) + 문 영역으로 가려서 그린다
 */
function drawDoorActors(ctx: CanvasRenderingContext2D, o: Building, list: Actor[]) {
  if (!hasDoor(o)) return list.forEach((a) => drawActor(ctx, a));
  const r = doorRect(o);
  const x0 = view.OX + r.x0;
  const y0 = view.OY + r.y0;
  const w = r.x1 - r.x0 + 1;
  const h = r.y1 - r.y0 + 1;
  if (list.some((a) => a.door!.phase === 'step') && !isOpenFront(o)) {
    ctx.fillStyle = '#1c1018';
    ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(x0, y0, w, 1);
    const dnt = sceneNight();
    if (dnt > 0.01) {
      ctx.globalAlpha = CONFIG.actors.doorNightAlpha * dnt;
      ctx.fillStyle = CONFIG.actors.doorNightLight;
      ctx.fillRect(x0, y0 + 1, w, h - 1);
      ctx.globalAlpha = 1;
    }
  }
  for (const a of list) {
    const pose = doorPose(a);
    if (!pose.clipped) {
      drawActor(ctx, a, pose);
      continue;
    }
    // 문 안쪽 + 문턱 아래(바깥 땅)만 보이게: 문 옆 벽에 겹친 몸은 가려진다
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.rect(0, y0 + h, view.LW, view.LH);
    ctx.clip();
    drawActor(ctx, a, pose);
    ctx.restore();
  }
}

function drawDoorDebug(ctx: CanvasRenderingContext2D, o: Building) {
  if (!hasDoor(o)) return;
  const r = doorRect(o);
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 1;
  ctx.strokeRect(view.OX + r.x0 + 0.5, view.OY + r.y0 + 0.5, r.x1 - r.x0, r.y1 - r.y0);
}

// ───────── TOWN T2: 이어지는 장식 (산울타리·돌담·흰 울타리) ─────────

/** 이어 그릴 장식 → 띠 높이(그림 높이 비율) */
const CONNECT: Partial<Record<string, number>> = { hedge: 0.55, stonewall2: 0.5, picket_gate: 0.35 };
const joinCols = new Map<string, [string, string, string]>();
/** 그림에서 띠 색 (윗면 · 몸 · 아랫단) */
function colsOf(sp: string): [string, string, string] {
  let c = joinCols.get(sp);
  if (c) return c;
  const im = IMG[sp] as CanvasImageSource & { width: number; height: number };
  const cv = document.createElement('canvas');
  cv.width = im.width;
  cv.height = im.height;
  const g = cv.getContext('2d')!;
  g.drawImage(im, 0, 0);
  const at = (fy: number) => {
    // 가운데 줄에서 투명이 아닌 첫 점
    for (let dx = 0; dx < im.width / 2; dx++)
      for (const sx2 of [im.width / 2 + dx, im.width / 2 - dx]) {
        const d = g.getImageData(Math.floor(sx2), Math.floor(im.height * fy), 1, 1).data;
        if (d[3] > 200) return `rgb(${d[0]},${d[1]},${d[2]})`;
      }
    return '#4f8a34';
  };
  c = [at(0.3), at(0.6), at(0.85)];
  joinCols.set(sp, c);
  return c;
}
function drawJoins(ctx: CanvasRenderingContext2D, o: Building, im: CanvasImageSource & { width: number; height: number }, x: number, y: number) {
  const k = CONNECT[o.kind]!;
  const [top, body, foot] = colsOf(baseKey(o.sprite!));
  const H = Math.round(im.height * k);
  const bx = x + im.width / 2;
  const by = y + im.height - 4;
  for (const [nx, ny] of [[o.tx - 1, o.ty], [o.tx, o.ty - 1]] as [number, number][]) {
    const n = world.objs.find((q) => q.kind === o.kind && q.tx === nx && q.ty === ny);
    if (!n) continue;
    // 이웃은 화면에서 (−16,−8) 또는 (+16,−8)
    const dir = nx < o.tx ? -1 : 1;
    // 두 그림 사이 틈만 (양쪽 그림 몸통을 덮지 않게)
    for (let t = 4; t <= 12; t++) {
      const px = Math.round(bx + dir * t);
      const py = Math.round(by - t / 2);
      ctx.fillStyle = top;
      ctx.fillRect(px, py - H, 1, 2);
      ctx.fillStyle = body;
      ctx.fillRect(px, py - H + 2, 1, H - 4);
      ctx.fillStyle = foot;
      ctx.fillRect(px, py - 2, 1, 2);
    }
  }
}

function drawLuxury(ctx: CanvasRenderingContext2D, o: Building, x: number, y: number, im: { width: number; height: number }) {
  const night = NL / CONFIG.dayNight.tintSteps;
  const glow = ({ gold_fountain: '255,211,107', rainbow_bridge: '200,170,255', star_garden: '180,210,255', firework_stand: '255,160,90' } as Record<string, string>)[o.kind];
  if (glow && night > 0.2) {
    const cx = x + im.width / 2;
    const cy = y + im.height * 0.55;
    const r = Math.max(im.width, im.height) * 0.7;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${glow},${0.35 * night})`);
    g.addColorStop(1, `rgba(${glow},0)`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }
  // 별빛 정원: 반짝이 점
  if (o.kind === 'star_garden' && Math.random() < 0.3) {
    ctx.fillStyle = '#fff3c0';
    ctx.fillRect(Math.round(x + Math.random() * im.width), Math.round(y + im.height * (0.3 + Math.random() * 0.5)), 1, 1);
  }
  const text = o.kind === 'hero_statue' ? (S.visiting ? '' : statueName()) : o.kind === 'gold_sign' ? S.innName || '여관' : '';
  if (!text) return;
  ctx.font = '8px "Galmuri9"';
  ctx.textAlign = 'center';
  const tw = Math.ceil(ctx.measureText(text).width) + 6;
  const X = Math.round(x + im.width / 2);
  const Y = Math.round(y + im.height - (o.kind === 'gold_sign' ? im.height * 0.55 : 10));
  ctx.fillStyle = '#5a3a10';
  ctx.fillRect(X - tw / 2 - 1, Y - 9, tw + 2, 12);
  ctx.fillStyle = '#e8b84a';
  ctx.fillRect(X - tw / 2, Y - 8, tw, 10);
  ctx.fillStyle = '#3a2408';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, X, Y - 3);
  ctx.textBaseline = 'alphabetic';
}

function drawPioneer(ctx: CanvasRenderingContext2D, o: Building, x: number, y: number, im: { width: number; height: number }) {
  const T = S.T;
  if (o.kind === 'duck_spa') {
    // 김 모락모락
    if (Math.random() < 0.12) puff(x - view.OX + im.width * (0.3 + Math.random() * 0.4), y - view.OY + im.height * 0.35, '#f4f4f4', (Math.random() - 0.5) * 4, -10, 1.2, 2);
  } else if (o.kind === 'gold_brush') {
    // 근처(3칸) 길 칸이 은은하게 반짝
    if (Math.random() < 0.25) {
      const dx = Math.round(Math.random() * 6 - 3);
      const dy = Math.round(Math.random() * 6 - 3);
      const tx = o.tx + dx;
      const ty = o.ty + dy;
      if (tx >= 0 && ty >= 0 && tx < N && ty < N && pathT.has(ty * N + tx)) puff(sx(tx + 0.5, ty + 0.5) + (Math.random() * 10 - 5), sy(tx + 0.5, ty + 0.5) + 4, '#ffe9a0', 0, -3, 0.8, 1);
    }
  } else if (o.kind === 'red_helmet') {
    // 밤에 등불
    const night = NL / CONFIG.dayNight.tintSteps;
    if (night > 0.2) {
      const cx = x + im.width * 0.75;
      const cy = y + im.height * 0.45;
      const r = 26 + Math.sin(T * 3) * 2;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255,170,90,${0.45 * night})`);
      g.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    }
  } else if (o.kind === 'pinwheel_light') {
    // 바람개비: 날개 끝 네 점이 빙글빙글
    const cx = x + im.width * 0.38;
    const cy = y + im.height * 0.14;
    const cols = ['#ff7a6a', '#ffd36b', '#8fd0ff', '#9af08a'];
    for (let i = 0; i < 4; i++) {
      const a = T * 6 + (i * Math.PI) / 2;
      ctx.fillStyle = cols[i];
      ctx.fillRect(Math.round(cx + Math.cos(a) * 5), Math.round(cy + Math.sin(a) * 5), 2, 2);
    }
  }
}

/** TOWN T5: 장식 불빛(밤) · 움직임 — 색 · 반지름(그림 너비 배) · 빛 자리(그림 안 비율) · 깜빡임 · 물 반짝 · 바람개비 날개 */
const DECO_FX: Record<string, { glow?: string; r?: number; gx?: number; gy?: number; flicker?: boolean; water?: boolean; spin?: [number, number] }> = {
  lvl_stone_lantern: { glow: '255,214,140', r: 1.0, gx: 0.5, gy: 0.3 },
  lamppost: { glow: '255,214,140', r: 1.4, gx: 0.5, gy: 0.18 },
  double_lamp: { glow: '255,214,140', r: 1.4, gx: 0.5, gy: 0.18 },
  string_lights: { glow: '255,200,120', r: 1.2, gx: 0.5, gy: 0.3 },
  brazier: { glow: '255,150,70', r: 1.6, gx: 0.5, gy: 0.35, flicker: true },
  mushroom_lamp: { glow: '140,200,255', r: 1.4, gx: 0.5, gy: 0.4 },
  mushroom_dark: { glow: '90,230,200', r: 1.2, gx: 0.5, gy: 0.5 },
  shop_sign: { glow: '255,214,140', r: 0.9, gx: 0.5, gy: 0.3 },
  // HARVEST §1-5: 수확제 장식 밤 불빛
  jack_lantern: { glow: '255,190,90', r: 1.0, gx: 0.5, gy: 0.55, flicker: true },
  lantern_post: { glow: '255,200,120', r: 1.3, gx: 0.5, gy: 0.3 },
  pumpkin_carriage: { glow: '255,190,90', r: 0.7, gx: 0.25, gy: 0.3 },
  fountain: { water: true },
  lily_pond: { water: true },
  koi_pond: { water: true },
  bird_bath: { water: true },
  rock_fall: { water: true },
  windmill: { spin: [0.5, 0.28] },
};
function drawDecoFx(ctx: CanvasRenderingContext2D, o: Building, x: number, y: number, im: { width: number; height: number }) {
  const F = DECO_FX[o.kind];
  const T = S.T;
  // HARVEST §2: 노을 등불 (19시부터 서서히)
  const night = Math.max(NL / CONFIG.dayNight.tintSteps, duskLight);
  if (F.glow && night > 0.15) {
    const cx = x + im.width * (F.gx ?? 0.5);
    const cy = y + im.height * (F.gy ?? 0.3);
    const fl = F.flicker ? 0.85 + Math.sin(T * 11 + o.tx) * 0.1 + Math.random() * 0.05 : 1;
    const r = Math.max(14, im.width * (F.r ?? 1.2)) * fl;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${F.glow},${0.4 * night * fl})`);
    g.addColorStop(1, `rgba(${F.glow},0)`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }
  if (F.water && Math.random() < 0.12) {
    ctx.fillStyle = '#e8f6ff';
    ctx.fillRect(Math.round(x + im.width * (0.25 + Math.random() * 0.5)), Math.round(y + im.height * (0.55 + Math.random() * 0.3)), 1, 1);
  }
  if (F.spin) {
    // 풍차 날개 끝 네 점이 천천히 돈다
    const cx = x + im.width * F.spin[0];
    const cy = y + im.height * F.spin[1];
    const L = im.width * 0.32;
    ctx.fillStyle = '#f4ead6';
    for (let i = 0; i < 4; i++) {
      const a = T * 1.2 + (i * Math.PI) / 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * L), Math.round(cy + Math.sin(a) * L * 0.9), 2, 2);
    }
  }
}

/** 측정용 (개발 전역 __renderMem): 렌더 쪽 캐시 */
setBldHooks({ objTL, img: (k) => IMG[k] });

export function renderMem() {
  return { red: { n: RED.size, cap: RED.cap, evicted: RED.evicted }, sil: silMem(), ground: groundMem(), frontTint: frontCv ? { n: 1, px: frontCv.width * frontCv.height } : { n: 0, px: 0 } };
}
