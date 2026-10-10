// 한 프레임 그리기. 밤 처리 순서(꼭 지킬 것):
// 1) 바닥 → 화면 전체에 밤 색(multiply) 한 번
// 2) 깊이 순서대로 건물·나무·캐릭터를 "밤 색으로 미리 물든 그림"으로
// 3) 건물 하나를 그린 직후 그 건물의 창문 불빛 → 앞 건물이 나중에 그려지며 가린다
// 4) 모닥불 둥근 빛만 맨 위에 더하기(lighter)로
import { SMOKE } from '../data/catalog';
import { CONFIG } from '../data/config';
import { IMG, META, recolored, tinted, tintColor } from '../engine/assets';
import { depthActor, depthBuilding, depthWild, sx, sy, TH, view } from '../engine/iso';
import { P } from '../engine/pixel';
import { framesFor, type CharFrames } from '../engine/sprites';
import { appearance } from './adventurers';
import { drawAmbient, drawLight, glow, NL } from './daynight';
import { puff, updDrawParts } from './fx';
import { ground, ensureGround, type Wild } from './ground';
import { S, world, type Actor, type Building } from './state';
import { doorPose, doorRect, hasDoor, isOpenFront } from './doors';
import { placing, spriteOrigin, type Placement } from './town';

/** 깊이 정렬에서 "건물처럼" 다루는 것: 건물·야생 나무(1×1)·배치 미리보기 */
type Thing = { d: number; tx: number; ty: number; fw: number; fh: number } & ({ o: Building } | { w: Wild } | { ghost: Placement });

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

export function renderFrame(ctx: CanvasRenderingContext2D, dt: number) {
  const { LW, LH, OX, OY } = view;
  const T = S.T;
  const nt = S.nightT;
  ensureGround(S.visiting ? S.visiting.id : '');

  // 1) 바닥 + 밤 색 한 번
  ctx.fillStyle = '#3e6a34';
  ctx.fillRect(0, 0, LW, LH);
  ctx.drawImage(ground.c!, OX - ground.ox, OY - ground.oy);
  if (NL) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tintColor(NL / CONFIG.dayNight.tintSteps);
    ctx.fillRect(0, 0, LW, LH);
    ctx.globalCompositeOperation = 'source-over';
  }
  const pl = placing.pl;
  if (pl && pl.tx != null) drawGhostTiles(ctx, pl);

  // 2) 깊이 정렬: 건물·나무를 먼저 기존 키로 정렬하고,
  //    캐릭터는 하나씩 "자기가 앞에 있어야 하는 마지막 건물" 바로 뒤에 끼워 넣는다
  const things: Thing[] = [];
  for (const o of world.objs) things.push({ d: depthBuilding(o.tx, o.ty, o.fw, o.fh), tx: o.tx, ty: o.ty, fw: o.fw, fh: o.fh, o });
  for (const w of ground.wild) things.push({ d: depthWild(w.x, w.y), tx: w.x, ty: w.y, fw: 1, fh: 1, w });
  if (pl && pl.tx != null && pl.ty != null) things.push({ d: depthBuilding(pl.tx, pl.ty, pl.fw, pl.fh) + 0.1, tx: pl.tx, ty: pl.ty, fw: pl.fw, fh: pl.fh, ghost: pl });
  things.sort((p, q) => p.d - q.d);
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
  for (let k = 0; k <= things.length; k++) {
    for (const a of slots[k]) drawActor(ctx, a);
    const it = things[k];
    if (!it) break;
    if ('o' in it) {
      drawObj(ctx, it.o);
      const ds = atDoor.get(it.o);
      if (ds) drawDoorActors(ctx, it.o, ds);
      if (DEBUG_DOORS) drawDoorDebug(ctx, it.o);
    } else if ('w' in it) drawWild(ctx, it.w);
    else drawGhost(ctx, it.ghost);
  }

  // 연기·불티
  if (Math.random() < dt * 3)
    for (const o of world.objs) {
      const s = o.sprite ? SMOKE[o.sprite] : null;
      if (!s || o.build) continue;
      const [bx, by] = objTL(o);
      for (const [x, y] of s) puff(bx + x - OX, by + y - OY, nt > 0.5 ? '#8a90b0' : '#ece6dc', 2 + Math.random() * 3, -7 - Math.random() * 4, 2.8, 1 + ((Math.random() * 2) | 0));
    }
  for (const o of world.objs)
    if (o.kind === 'fire' && Math.random() < dt * 6) {
      const X = sx(o.tx + 0.5, o.ty + 0.5);
      const Y = sy(o.tx + 0.5, o.ty + 0.5) - 4;
      puff(X + (Math.random() - 0.5) * 4, Y, '#ffb04a', (Math.random() - 0.5) * 4, -14, 0.6, 1);
    }
  updDrawParts(ctx, dt);

  // 4) 모닥불 빛 (더하기)
  if (nt > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    for (const o of world.objs)
      if (o.kind === 'fire') {
        const X = OX + sx(o.tx + 0.5, o.ty + 0.5);
        const Y = OY + sy(o.tx + 0.5, o.ty + 0.5);
        glow(ctx, X, Y - 4, 34, nt * (0.45 + Math.sin(T * 9) * 0.05));
      }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  drawAmbient(ctx, T, LW, LH);
  drawNamePlate(ctx, nt);
}

function drawWild(ctx: CanvasRenderingContext2D, w: Wild) {
  const im0 = IMG[w.k];
  if (!im0) return;
  const im = tinted(im0, NL);
  const X = Math.round(view.OX + sx(w.x + 0.5, w.y + 0.5) - im.width / 2);
  const Y = Math.round(view.OY + sy(w.x + 0.5, w.y + 0.5) + TH / 2 - im.height + 3);
  if (Y + im.height > -10 && Y < view.LH + 10 && X + im.width > -10 && X < view.LW + 10) ctx.drawImage(im, X, Y);
}

function drawFire(ctx: CanvasRenderingContext2D, o: { tx: number; ty: number }) {
  const X = view.OX + sx(o.tx + 0.5, o.ty + 0.5);
  const Y = view.OY + sy(o.tx + 0.5, o.ty + 0.5) + 2;
  const p = P(ctx);
  p.rect(X - 6, Y - 2, 12, 3, '#7a7480');
  p.rect(X - 5, Y - 3, 10, 1, '#9a96a6');
  p.rect(X - 4, Y - 4, 8, 2, '#6a4428');
  p.rect(X - 3, Y - 5, 6, 1, '#8a5a34');
  for (let i = -3; i <= 3; i++) {
    const h = 3 + Math.round((Math.sin(S.T * 11 + i * 1.9) + 1) * 2.2 + Math.random() * 1.5) - Math.abs(i);
    for (let j = 0; j < h; j++) p.px(X + i, Y - 6 - j, j < 2 ? '#ffe08a' : j < 4 ? '#ff9a3c' : '#e0482e');
  }
  p.rect(X - 12, Y - 1, 5, 2, '#8a5a34');
  p.rect(X + 8, Y + 1, 5, 2, '#8a5a34');
}

function baseImage(o: { sprite: string | null; hue: number | null }) {
  const key = o.sprite!;
  return o.hue != null ? recolored(key, o.hue) : IMG[key];
}

function drawObj(ctx: CanvasRenderingContext2D, o: Building) {
  if (o.kind === 'fire') return drawFire(ctx, o);
  if (!o.sprite || !IMG[o.sprite]) return;
  const im = tinted(baseImage(o), NL);
  const [x, y] = objTL(o);
  if (o.build !== undefined) {
    // 공사 중: 반투명 + 비계 + 먼지
    ctx.globalAlpha = 0.35;
    ctx.drawImage(im, x, y);
    ctx.globalAlpha = 1;
    const p = P(ctx);
    for (let i = 0; i < 4; i++) {
      const px = (x + 8 + (i * (im.width - 16)) / 3) | 0;
      p.rect(px, (y + im.height * 0.3) | 0, 2, (im.height * 0.7) | 0, '#a06a3c');
    }
    for (let j = 0; j < 3; j++) p.rect(x + 6, (y + im.height * 0.4 + j * im.height * 0.2) | 0, im.width - 12, 2, '#c08050');
    if (Math.random() < 0.15) puff(x + Math.random() * im.width - view.OX, y + im.height * 0.8 - view.OY, '#efe2c6', (Math.random() - 0.5) * 20, -10, 0.7, 2);
    return;
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
  } else ctx.drawImage(im, x, y);
  // 3) 이 건물을 그린 직후 창문 불빛
  drawLight(ctx, o.sprite, x, y);
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

function drawGhost(ctx: CanvasRenderingContext2D, pl: Placement) {
  if (pl.kind === 'fire') {
    ctx.globalAlpha = 0.6;
    drawFire(ctx, { tx: pl.tx!, ty: pl.ty! });
    ctx.globalAlpha = 1;
    return;
  }
  if (!pl.sprite || !IMG[pl.sprite]) return;
  const [x, y] = objTL({ sprite: pl.sprite, tx: pl.tx!, ty: pl.ty!, fw: pl.fw, fh: pl.fh });
  ctx.globalAlpha = 0.6;
  ctx.drawImage(IMG[pl.sprite], x, y);
  ctx.globalAlpha = 1;
}

/** 발판 칸 표시 (초록 = 가능, 빨강 = 불가) */
function drawGhostTiles(ctx: CanvasRenderingContext2D, pl: Placement) {
  const p = P(ctx);
  const c = pl.ok ? '#7fe07f' : '#ff6a6a';
  for (let j = 0; j < pl.fh; j++)
    for (let i = 0; i < pl.fw; i++) {
      const x = pl.tx! + i;
      const y = pl.ty! + j;
      const X = view.OX + sx(x, y);
      const Y = view.OY + sy(x, y);
      for (let k = 0; k < TH; k++) {
        const hw = (k < TH / 2 ? k + 1 : TH - k) * 2;
        for (let q = -hw; q < hw; q++) if (((k + q) & 3) === 0) p.px(X + q, Y + k, c);
      }
    }
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

function drawActor(ctx: CanvasRenderingContext2D, a: Actor, pose?: { pos: [number, number]; back: boolean; dir: 1 | -1 }) {
  const s = looksOf(a);
  const T = S.T;
  let fr: HTMLCanvasElement;
  const dir = pose ? pose.dir : a.dir;
  if (pose) fr = (pose.back ? s.walkB : s.walk)[Math.floor(T * 8 + a.ph) % 4];
  else if (a.st === 'walk') fr = (a.back ? s.walkB : s.walk)[Math.floor(T * 8 + a.ph) % 4];
  else if (a.st === 'idle' && a.back && !a.role) fr = s.idleB[Math.floor(T * 1.6 + a.ph) % 2];
  else if (a.st === 'atk') fr = s.atk[Math.floor(T * 3 + a.ph) % 2];
  else if (a.st === 'pray') fr = s.pray[Math.floor(T * 1.5 + a.ph) % 2];
  else if (a.st === 'sit') fr = s.sit[Math.floor(T * 2 + a.ph) % 2];
  else fr = s.idle[Math.floor(T * 1.6 + a.ph) % 2];
  const X = Math.round(view.OX + (pose ? pose.pos[0] : sx(a.x, a.y)));
  const Y = Math.round(view.OY + (pose ? pose.pos[1] : sy(a.x, a.y) + TH / 2));
  const fade = a.fading !== undefined ? Math.max(0, a.fading) : 1;
  ctx.globalAlpha = 0.25 * fade;
  ctx.fillStyle = '#1c1018';
  ctx.fillRect(X - 5, Y - 1, 10, 2);
  ctx.globalAlpha = (a.pop ? 1 - a.pop / 0.4 : 1) * fade;
  const img = tinted(fr, NL);
  const x = X - 12;
  const y = Y - 32 + (a.st === 'sit' ? 3 : 0);
  if (dir < 0) {
    ctx.save();
    ctx.translate(x + 24, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  } else ctx.drawImage(img, x, y);
  ctx.globalAlpha = 1;
  // 수련: 흰 바람 / 밭일: 물방울
  if (a.st === 'atk' && Math.random() < 0.06) puff(X + a.dir * 12 - view.OX, Y - 16 - view.OY, '#ffffff', a.dir * 10, -4, 0.25, 1);
  if (a.st === 'pray' && Math.random() < 0.05) puff(X + a.dir * 8 - view.OX, Y - 12 - view.OY, '#8fd0ff', 0, 10, 0.5, 1);
  // 영웅: 머리 위 금빛 별 / 전설 손님: 가끔 반짝
  if (a.heroId && fade === 1) {
    const p = P(ctx);
    const b = Math.round(Math.sin(T * 3 + a.ph) * 1);
    const c = a.status === 'hero' ? '#ffd36b' : '#cfd8ff';
    p.rect(X - 1, Y - 37 + b, 3, 1, c);
    p.rect(X, Y - 38 + b, 1, 3, c);
  } else if (a.rarity === 'legend' && Math.random() < 0.03) puff(X - view.OX + (Math.random() * 12 - 6), Y - 20 - view.OY - Math.random() * 10, '#ffd36b', 0, -8, 0.5, 1);
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
  const [x, y] = objTL(inn);
  ctx.font = '10px "Galmuri9"';
  const w = Math.ceil(ctx.measureText(name).width) + 10;
  const X = Math.round(x + m.w / 2 - w / 2);
  const Y = y - 16;
  const p = P(ctx);
  p.rect(X, Y, w, 13, '#5a3a24');
  p.rect(X + 1, Y + 1, w - 2, 11, '#a06a3c');
  p.hline(X + 1, Y + 1, w - 2, '#c08050');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#5a3420';
  ctx.fillText(name, X + 5, Y + 3);
  ctx.fillStyle = nt > 0.5 ? '#ffe7a8' : '#fff3d6';
  ctx.fillText(name, X + 5, Y + 2);
}

/** 탭한 화면 좌표의 건물 (투명 픽셀 무시, 앞 건물부터) */
export function buildingAt(mx: number, my: number, alphaAt: (k: string, x: number, y: number) => number): Building | null {
  const hits = world.objs
    .filter((o) => o.sprite && IMG[o.sprite])
    .sort((p, q) => q.tx + q.ty + q.fw + q.fh - (p.tx + p.ty + p.fw + p.fh));
  for (const o of hits) {
    const [x, y] = objTL(o);
    const im = IMG[o.sprite!];
    if (mx >= x && my >= y && mx < x + im.width && my < y + im.height && alphaAt(o.sprite!, mx - x, my - y)) return o;
  }
  // 모닥불 (그림이 없어 칸으로)
  for (const o of world.objs) {
    if (o.kind !== 'fire') continue;
    const X = view.OX + sx(o.tx + 0.5, o.ty + 0.5);
    const Y = view.OY + sy(o.tx + 0.5, o.ty + 0.5);
    if (Math.abs(mx - X) < 10 && my > Y - 16 && my < Y + 6) return o;
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
    if (S.nightT > 0.01) {
      ctx.globalAlpha = CONFIG.actors.doorNightAlpha * S.nightT;
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
