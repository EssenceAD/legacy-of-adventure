// HUD: 위 상태판(이름·금화·날짜), 아래 독(건설·땅·손님·마을·장부), 배치 막대, 배율 버튼
import { sfx } from '../audio/sfx';
import { pendingWith, runFirstWith } from '../world/events';
import { bigNum, vis } from '../world/visual';
import { unseenDrops } from '../world/decodrop';
import { canUndo, decorView, entranceWhy, moveEntrance, noteMove, rememberDungeonHome, undo } from '../world/decor';
import { notePlace, takeOut } from '../world/store';
import { N, sx, sy, toTile, view } from '../engine/iso';
import { track as trackEv } from '../net/telemetry';
import { HARMONIES } from '../data/harmony';
import { enterPhoto } from './photo';
import { def, type Kind } from '../data/catalog';
import { P } from '../engine/pixel';
import * as game from '../game';

import { setNight } from '../world/daynight';
import { stars } from '../world/progress';
import { P as PG, S, world } from '../world/state';
import { CONFIG } from '../data/config';
import { regionById, REGIONS } from '../data/items';
import { esc } from './common';
import { baseKey, FLIP } from '../engine/assets';
import { blocksDoor, buildCost, canPlace, entrance, gateOk, grid, inLand, landBounds, outsideOk, placing, pondAt, suggestSpot, type Placement } from '../world/town';
import type { StoredObj } from '../world/state';
import { computeSets } from '../world/harmony';
import type { Building } from '../world/state';
import { openNotices } from './notice';
import { openBoard, openRunLog, runsWaiting } from './expedition';
import { syncGuide } from './guide';
import { autoTick } from '../world/hunt';
import { iconSrc } from './kit';
import { openHunt, unfoldHunt } from './hunt';
import { landHint } from '../world/render';
import { fitDay } from './dayfit';
import { foldInfo } from '../combat/ui';
import { openGuests } from './guests';
import { openVillage } from './neighbors';
import { saveZoom, zoomIdx, zoomsNow } from './screen';
import { tickTimers } from './common';
import { buildHooks, isWinOpen, openBuild, openLand, toast, toastHtml } from './windows';
import { isTalking, talk } from './dialogue';
import { applyTidy, planTidy } from '../world/tidy';
import { openGridMenu } from './menu';
import { achReady, mailWaiting } from '../world/meta';
import { tickGoldsinkHud } from './goldsink';
import { tickWayfind } from './wayfind';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
// VISUAL §5 uiKitV2(실험실)면 큰 수 줄임(bigNum) · 끄면 예전 그대로
const fmt = (n: number) => (vis('uiKitV2') ? bigNum(n) : n.toLocaleString('ko-KR'));

// ───────── 배치 모드 (짓기 · 옮기기) ─────────

/** 놓을 수 없는 까닭 (놓을 수 있으면 null) */
function whyNot(pl: Placement): string | null {
  if (pl.tx == null || pl.ty == null) return '놓을 곳을 눌러요';
  // FEEDBACK23 §5: 마을 입구
  if (pl.ent) return entranceWhy(pl.tx);
  const ign = pl.move;
  // FEEDBACK23 §4: 던전은 숲속 원래 자리로 되돌릴 수 있다 (땅 밖)
  if (outsideOk(pl)) return canPlace(pl, ign) ? null : '다른 건물과 겹쳐요';
  for (let j = 0; j < pl.fh; j++)
    for (let i = 0; i < pl.fw; i++) if (!inLand(pl.tx + i, pl.ty + j)) return '땅 밖이에요';
  for (let j = 0; j < pl.fh; j++)
    for (let i = 0; i < pl.fw; i++) {
      const g = grid[pl.ty + j]?.[pl.tx + i];
      if (g && g !== ign) return '다른 건물과 겹쳐요';
      if (pondAt(pl.tx + i, pl.ty + j)) return '연못 위엔 못 놓아요';
    }
  if (pl.kind === 'gate' && !gateOk(pl)) return '정문은 마을 입구 길 위에만 놓아요';
  if (!canPlace(pl, ign)) return '문 앞 칸이 막혀 있어요';
  if (blocksDoor(pl, ign)) return '다른 건물의 문 앞을 막아요';
  return null;
}

function check(pl: Placement) {
  pl.why = whyNot(pl) ?? undefined;
  pl.ok = !pl.why;
}

function placeText(pl: Placement) {
  $('#placeOk').toggleAttribute('disabled', !pl.ok);
  $('#placeRot').toggleAttribute('disabled', !pl.sprite);
  const verb = pl.move || pl.prop || pl.ent ? ' 옮기기' : pl.store ? ' 꺼내 놓기' : pl.chain ? ' 이어 놓기' : '';
  $('#placeTxt').textContent = `${pl.ent ? '마을 입구' : def(pl.kind).name}${verb} · ${pl.ok ? '여기 괜찮아요' : '여기엔 못 놓아요'}${pl.chain && pl.ok ? ' · ✕로 끝내요' : ''}`;
  const w = $('#placeWhy');
  // TOWN T2: 놓으면 생기는 어울림을 미리 (이름)
  const hm = pl.ok ? harmonyHere(pl) : [];
  w.textContent = pl.ok ? (hm.length ? `✨ 여기 놓으면 어울림: ${hm.join(' · ')}` : '') : pl.why ?? '';
  w.hidden = !w.textContent;
  w.classList.toggle('good', pl.ok);
  // BUILDUX §1-1·§4: 고스트 옆 말풍선 — 빨강이면 이유, 초록이면 어울림
  const tag = $('#ghostTag');
  if (tag) {
    tag.textContent = pl.ok ? (hm.length ? `✨ ${hm.join(' · ')}` : '') : pl.why ?? '';
    tag.hidden = !tag.textContent;
    tag.classList.toggle('good', pl.ok);
  }
}
/** 이 자리에 놓으면 이 장식이 들어가는 어울림 이름 */
function harmonyHere(pl: Placement): string[] {
  if (pl.tx == null || pl.ty == null || !def(pl.kind).deco || pl.ent) return [];
  const ghost = { kind: pl.kind, tx: pl.tx, ty: pl.ty, fw: pl.fw, fh: pl.fh, lvl: 1, hue: null, inside: [], sprite: pl.sprite } as unknown as Building;
  const objs = world.objs.filter((o) => o !== pl.move).concat(ghost);
  return [...new Set(computeSets(objs).filter((x) => x.members.includes(ghost)).map((x) => HARMONIES.find((h) => h.id === x.id)?.name ?? ''))].filter(Boolean);
}

function openPlace(pl: Placement, focus = true) {
  placing.pl = pl;
  check(pl);
  $('#placebar').hidden = false;
  $('#view').classList.add('placing');
  placeText(pl);
  // BUILDUX §1-7: 화면 가운데 근처에 찾은 자리면 카메라는 그대로 (화면 밖일 때만 비춘다)
  if (pl.tx != null && focus && !onScreen(pl)) game.focusTile(pl.tx + pl.fw / 2, pl.ty! + pl.fh / 2);
  ghostLoop();
}

// ───────── BUILDUX §1: 화면 가운데 근처 자리 · 따라다니는 ✓/✕/↻ · 이어 놓기 ─────────

const scene = () => document.getElementById('scene') as HTMLCanvasElement | null;
/** 타일 → 화면(client) 좌표 */
function tileXY(x: number, y: number): [number, number] {
  const r = scene()!.getBoundingClientRect();
  return [r.left + (view.OX + sx(x, y)) * view.SC, r.top + (view.OY + sy(x, y)) * view.SC];
}
function onScreen(pl: Placement): boolean {
  if (!scene() || pl.tx == null) return false;
  const [X, Y] = tileXY(pl.tx + pl.fw / 2, pl.ty! + pl.fh / 2);
  return X > 40 && X < innerWidth - 40 && Y > 90 && Y < innerHeight - 260;
}
/** 화면 가운데(조금 위) 타일 */
function viewCenterTile(): [number, number] | null {
  const cv = scene();
  if (!cv) return null;
  const r = cv.getBoundingClientRect();
  const [fx, fy] = toTile(cv, r.left + r.width / 2, r.top + r.height * 0.42);
  return [Math.floor(fx), Math.floor(fy)];
}
/** 화면 가운데에서 가장 가까운 놓을 수 있는 자리 (큰 건물은 가장자리·이웃에 붙는 자리를 조금 더 좋게) */
function nearViewSpot(pl: Placement, from = viewCenterTile(), maxR = 9): [number, number] | null {
  if (!from) return null;
  const big = !def(pl.kind).deco && pl.fw * pl.fh >= 4;
  const deco = def(pl.kind).deco && pl.kind !== 'gate';
  let best: [number, number] | null = null;
  let bs = 1e9;
  for (let y = from[1] - maxR; y <= from[1] + maxR; y++)
    for (let x = from[0] - maxR; x <= from[0] + maxR; x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const t = { ...pl, tx: x - Math.floor((pl.fw - 1) / 2), ty: y - Math.floor((pl.fh - 1) / 2) };
      if (!canPlace(t, pl.move) || blocksDoor(t, pl.move)) continue;
      let sc = Math.hypot(x - from[0], y - from[1]);
      if (big) {
        let touch = 0;
        for (let i = -1; i <= t.fw; i++) for (const j of [-1, t.fh]) touch += !inLand(t.tx + i, t.ty + j) || grid[t.ty + j]?.[t.tx + i] ? 1 : 0;
        sc -= touch * 0.35;
      }
      if (deco) {
        const ghost = { kind: pl.kind, tx: t.tx, ty: t.ty, fw: pl.fw, fh: pl.fh, lvl: 1, hue: null, inside: [], sprite: pl.sprite } as unknown as Building;
        if (sc < 5 && computeSets(world.objs.concat(ghost)).some((s) => s.members.includes(ghost))) sc -= 2;
      }
      if (sc < bs) {
        bs = sc;
        best = [t.tx, t.ty];
      }
    }
  return best;
}

/** 이어 놓기 대상: 1칸짜리 순수 장식 (모닥불·게시판처럼 기능이 있는 것·정문은 하나씩) */
const chainable = (k: Kind) => {
  const d = def(k);
  return !!d.deco && d.size[0] === 1 && d.size[1] === 1 && !d.act && !d.levels && !d.unique && k !== 'board';
};

/** 고스트 옆에 붙어 다니는 ✓/✕/↻ (배치 막대의 버튼을 옮겨 온다 · id 그대로) */
let ghostRaf = 0;
function ghostLoop() {
  cancelAnimationFrame(ghostRaf);
  const box = $('#ghostBtns');
  const step = () => {
    const pl = placing.pl;
    if (!pl || !box) {
      if (box) box.hidden = true;
      return;
    }
    if (pl.tx != null && scene()) {
      // 발판 앞 꼭짓점(아래) 밑에 · 화면 아래 막대와 겹치면 고스트 위로
      const [fx, fy] = tileXY(pl.tx + pl.fw, pl.ty! + pl.fh);
      const [, topY] = tileXY(pl.tx, pl.ty!);
      const w = box.offsetWidth || 180;
      const h = box.offsetHeight || 56;
      const bottomLimit = innerHeight - 250;
      let y = fy + 10;
      if (y + h > bottomLimit) y = topY - h - 70 * view.SC;
      const x = Math.max(8, Math.min(innerWidth - w - 8, fx - w / 2));
      box.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(64, y))}px)`;
      box.hidden = false;
    }
    ghostRaf = requestAnimationFrame(step);
  };
  step();
}

/** 놓은 뒤 몇 초 동안 「↶ 되돌리기」 (꾸미기 모드 밖에서도 실수 바로잡기 1번) */
let snackT = 0;
function undoSnack(text: string) {
  let el = document.getElementById('undoSnack');
  if (!el) {
    el = document.createElement('div');
    el.id = 'undoSnack';
    el.className = 'px';
    document.getElementById('view')!.appendChild(el);
  }
  el.innerHTML = `<span>${esc(text)}</span><button id="snackUndo">↶ 되돌리기</button>`;
  el.hidden = false;
  (el.querySelector('#snackUndo') as HTMLElement).onclick = () => {
    const l = canUndo() ? undo() : null;
    if (l) toast(`되돌렸어요 · ${l}`);
    el!.hidden = true;
    game.syncHud();
  };
  clearTimeout(snackT);
  snackT = window.setTimeout(() => (el!.hidden = true), 5000);
}

/** 보관함에서 꺼내 놓기 */
export function startTakeOut(s: StoredObj) {
  const d = def(s.kind);
  const pl: Placement = { kind: s.kind, sprite: d.sprite, fw: d.size[0], fh: d.size[1], tx: null, ty: null, ok: false, flip: s.flip, store: s };
  const near = nearViewSpot(pl, viewCenterTile(), 14);
  if (near) [pl.tx, pl.ty] = near;
  else suggestSpot(pl);
  if (pl.tx == null) return toast('놓을 자리가 없어요 · 땅을 넓히거나 다른 걸 넣어 두세요');
  openPlace(pl);
}

export function startPlace(kind: Kind, prop?: string) {
  // 땅 개편 §4: 처음 지을 때만 울타리 안 전체를 연한 초록으로
  landHint.firstBuild = !PG.buildTipSeen;
  const d = def(kind);
  const pl: Placement = { kind, sprite: d.sprite, fw: d.size[0], fh: d.size[1], tx: null, ty: null, ok: false, prop };
  // BUILDUX §1-7: 화면 가운데에서 가장 가까운 놓을 수 있는 자리 (정문은 입구 자리)
  const near = kind === 'gate' ? null : nearViewSpot(pl);
  if (near) [pl.tx, pl.ty] = near;
  else {
    suggestSpot(pl);
    // 베타: 장식은 어울림이 생기는 자리를 먼저 권한다 (아직 못 찾은 어울림이면 더)
    if (d.deco && kind !== 'gate') {
      const best = harmonySpot(pl);
      if (best) [pl.tx, pl.ty] = best;
    }
  }
  // 핫픽스 8: 땅에 이 크기 빈자리가 하나도 없으면 모모의 자리 정리 도우미
  if (pl.tx == null && !prop) return offerTidy(kind, pl);
  openPlace(pl);
}

/** 자리 정리 도우미: 1칸 장식을 가장자리로 모아 자리를 만들지 묻는다 · 그래도 안 되면 땅 넓히기 */
function offerTidy(kind: Kind, pl: Placement) {
  const plan = planTidy(kind);
  if (!plan.spot) {
    talk([['post', `${def(kind).name}을(를) 놓을 자리가 없어요. 장식을 다 옮겨도 모자라요 — 땅을 넓혀야 해요!`]], undefined, [
      { label: '땅 넓히기', fn: () => openLand() },
      { label: '직접 할게요', fn: () => openPlace(pl) },
    ]);
    return;
  }
  const warn = plan.broken ? ` (어울림 ${plan.broken}개가 풀려요)` : '';
  talk([['post', `자리가 부족해요. 장식을 한쪽으로 정리해 드릴까요?${warn}`]], undefined, [
    {
      label: '정리하기',
      fn: () => {
        applyTidy(plan);
        toast(`장식 ${plan.moves.length}개를 가장자리로 옮겼어요`);
        startPlace(kind);
      },
    },
    { label: '직접 할게요', fn: () => openPlace(pl) },
  ]);
}

/** 어울림이 생기는 빈자리 (가장 좋은 곳) */
function harmonySpot(pl: Placement): [number, number] | null {
  const [a, b] = landBounds();
  let best: [number, number] | null = null;
  let bs = 0;
  for (let y = a; y < b; y++)
    for (let x = a; x < b; x++) {
      const t = { ...pl, tx: x, ty: y };
      if (!canPlace(t) || blocksDoor(t)) continue;
      const ghost = { kind: pl.kind, tx: x, ty: y, fw: pl.fw, fh: pl.fh, lvl: 1, hue: null, inside: [], sprite: pl.sprite } as unknown as Building;
      const sets = computeSets(world.objs.concat(ghost)).filter((s) => s.members.includes(ghost));
      const sc = sets.reduce((s, h) => s + (PG.harmony.found.includes(h.id) ? 1 : 3), 0);
      if (sc > bs) {
        bs = sc;
        best = [x, y];
      }
    }
  return best;
}

/** 이미 지은 건물 옮기기 (방향도 바꿀 수 있다) */
export function startMove(o: Building) {
  openPlace({ kind: o.kind, sprite: o.sprite, fw: o.fw, fh: o.fh, tx: o.tx, ty: o.ty, ok: false, flip: !!o.flip, move: o });
}

/** FEEDBACK23 §5: 마을 입구 옮기기 — 울타리 앞 가장자리 칸 하나를 좌우로 (정문이 있으면 같이) */
export function startMoveEntrance() {
  if (S.visiting) return;
  const [ex, ey] = entrance();
  openPlace({ kind: 'gate', sprite: null, fw: 1, fh: 1, tx: ex, ty: ey, ok: false, ent: true });
}

/** 배치 중 탭·끌기: 그 자리로 미리보기를 옮긴다 (칸이 바뀌면 톡) */
export function movePlacement(fx: number, fy: number) {
  const pl = placing.pl;
  if (!pl) return;
  let tx = Math.floor(fx - pl.fw / 2 + 0.5);
  let ty = Math.floor(fy - pl.fh / 2 + 0.5);
  // FEEDBACK23 §5: 입구는 앞 가장자리 줄을 벗어나지 않는다 (손가락이 어디 있든 가장 가까운 칸)
  if (pl.ent) {
    const [a, b] = landBounds();
    tx = Math.max(a, Math.min(b - 1, Math.floor(fx)));
    ty = b - 1;
  }
  if (tx === pl.tx && ty === pl.ty) return;
  pl.tx = tx;
  pl.ty = ty;
  pl.snapT = S.T;
  check(pl);
  // BUILDUX §1-3: 칸이 바뀔 때마다 「톡」 (못 놓는 칸은 낮은 소리)
  sfx(pl.ok ? 'tap' : 'place_bad');
  placeText(pl);
}

/** ↻ 회전: 원래 방향 ↔ 좌우 반전 */
export function rotatePlacement() {
  const pl = placing.pl;
  if (!pl || !pl.sprite) return;
  pl.flip = !pl.flip;
  pl.sprite = baseKey(pl.sprite) + (pl.flip ? FLIP : '');
  pl.snapT = S.T;
  check(pl);
  placeText(pl);
}

/** 배치 끝내기 · byUser = ✕·오른쪽 클릭·Esc (BUILDUX §6: edit_cancel) */
export function cancelPlace(byUser = false) {
  const pl = placing.pl;
  if (byUser && pl && !pl.chain) trackEv('edit_cancel', { kind: pl.kind, move: !!pl.move });
  placing.pl = null;
  $('#placebar').hidden = true;
  const gb = document.getElementById('ghostBtns');
  if (gb) gb.hidden = true;
  $('#view').classList.remove('placing');
  buildHooks.redraw();
}

function confirmPlace() {
  const pl = placing.pl;
  if (!pl || !pl.ok) return;
  // 보관함에서 꺼내 놓기 (무료)
  if (pl.store) {
    const o = takeOut(pl.store, pl.tx!, pl.ty!, !!pl.flip);
    if (o) {
      game.thud(o);
      cancelPlace();
      undoSnack(`${def(o.kind).name}을(를) 꺼내 놓았어요`);
    }
    return;
  }
  // FEEDBACK23 §5: 마을 입구
  if (pl.ent) {
    const why = moveEntrance(pl.tx!);
    if (why) return toast(why);
    sfx('build');
    cancelPlace();
    toast('마을 입구를 옮겼어요 · 손님이 여기로 드나들어요');
    return;
  }
  // FEEDBACK23 §4: 던전을 처음 옮기면 숲속 원래 자리를 기억 (그 자리로 되돌릴 수 있게)
  if (pl.move) rememberDungeonHome(pl.move);
  // TOWN T2: 꾸미기 모드에서 옮긴 것도 되돌리기에 (BUILDUX: 밖에서 옮긴 것도)
  const mv = pl.move ? { o: pl.move, tx: pl.move.tx, ty: pl.move.ty, flip: pl.move.flip } : null;
  const gold0 = S.gold;
  if (pl.move ? game.moveBuilding(pl) : game.placeBuilding(pl)) {
    if (mv) noteMove(mv.o, mv.tx, mv.ty, mv.flip);
    if (!pl.move && !pl.prop) {
      const o = world.objs[world.objs.length - 1];
      notePlace(o, gold0 - S.gold);
      // BUILDUX §1-8: 최근 놓은 장식
      if (def(pl.kind).deco) PG.decor.recent = [pl.kind, ...(PG.decor.recent ?? []).filter((k) => k !== pl.kind)].slice(0, 5);
      // BUILDUX §1-6: 장식은 ✕를 누를 때까지 다음 칸에 이어서
      if (chainable(pl.kind)) return chainNext(pl);
    }
    cancelPlace();
    if (!decorView.on) undoSnack(pl.move ? `${def(pl.kind).name}을(를) 옮겼어요` : `${def(pl.kind).name}을(를) 놓았어요`);
  }
}

/** 이어 놓기: 방금 놓은 칸 옆 빈칸으로 같은 장식 고스트 (금화가 모자라면 멈춤) */
function chainNext(prev: Placement) {
  const cost = buildCost(prev.kind);
  if (S.gold < cost) {
    cancelPlace();
    toast('금화가 모자라 이어 놓기를 멈췄어요');
    return;
  }
  const pl: Placement = { kind: prev.kind, sprite: prev.sprite, fw: prev.fw, fh: prev.fh, tx: null, ty: null, ok: false, flip: prev.flip, chain: true };
  // 오른쪽 → 아래 → 왼쪽 → 위 → 가까운 곳
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const t = { ...pl, tx: prev.tx! + dx, ty: prev.ty! + dy };
    if (canPlace(t) && !blocksDoor(t)) {
      [pl.tx, pl.ty] = [t.tx, t.ty];
      break;
    }
  }
  if (pl.tx == null) {
    const near = nearViewSpot(pl, [prev.tx!, prev.ty!], 6);
    if (near) [pl.tx, pl.ty] = near;
  }
  if (pl.tx == null) {
    cancelPlace();
    toast('근처에 빈칸이 없어 이어 놓기를 멈췄어요');
    return;
  }
  openPlace(pl, false);
}

// ───────── 독 아이콘 (도트) ─────────

type Icon = (p: ReturnType<typeof P>) => void;
const ICONS: Record<string, Icon> = {
  hammer: (p) => {
    p.rect(3, 3, 8, 4, '#c9d1dc');
    p.rect(3, 3, 8, 1, '#ffffff');
    p.rect(7, 7, 2, 7, '#a06a3c');
    p.rect(7, 7, 1, 7, '#c08050');
  },
  guest: (p) => {
    p.ell(8, 5, 3, 3, '#f2c49b');
    p.rect(5, 2, 6, 2, '#7a4a2c');
    p.rect(4, 9, 8, 5, '#3f6fd1');
    p.rect(4, 13, 8, 1, '#2f57b0');
  },
  land: (p) => {
    p.tri(0, 9, 16, 9, 8, 5, '#6fae45');
    p.tri(0, 9, 16, 9, 8, 13, '#5f9a3c');
    p.rect(2, 4, 1, 6, '#a06a3c');
    p.rect(13, 4, 1, 6, '#a06a3c');
    p.rect(2, 5, 12, 1, '#c08050');
    p.rect(7, 1, 2, 4, '#f2c447');
  },
  sword: (p) => {
    for (let i = 0; i < 8; i++) p.px(4 + i, 11 - i, '#e9eef7');
    for (let i = 0; i < 7; i++) p.px(5 + i, 11 - i, '#9aa6c8');
    p.rect(2, 10, 5, 2, '#e8b94a');
    p.rect(3, 12, 2, 3, '#8a5a34');
  },
  menu: (p) => {
    p.rect(3, 3, 10, 2, '#e9dcc0');
    p.rect(3, 7, 10, 2, '#e9dcc0');
    p.rect(3, 11, 10, 2, '#e9dcc0');
  },
  village: (p) => {
    p.vline(4, 2, 12, '#8a8a96');
    p.rect(5, 2, 7, 5, '#6fb04b');
    p.rect(5, 6, 7, 1, '#4f8a3a');
    p.rect(2, 13, 12, 1, '#6a4428');
  },
  book: (p) => {
    p.rect(3, 2, 10, 12, '#b0412f');
    p.rect(4, 3, 8, 10, '#e9dcc0');
    p.rect(5, 5, 6, 1, '#7a6a58');
    p.rect(5, 7, 6, 1, '#7a6a58');
    p.rect(5, 9, 4, 1, '#7a6a58');
  },
};

function drawIcons() {
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-ic]').forEach((c) => {
    const x = c.getContext('2d')!;
    ICONS[c.dataset.ic!](P(x));
    // 1px 테두리
    const d = x.getImageData(0, 0, 16, 16);
    const o = x.createImageData(16, 16);
    for (let y = 0; y < 16; y++)
      for (let X = 0; X < 16; X++) {
        const i = (y * 16 + X) * 4;
        if (d.data[i + 3]) continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
          const xx = X + a;
          const yy = y + b;
          return xx >= 0 && yy >= 0 && xx < 16 && yy < 16 && d.data[(yy * 16 + xx) * 4 + 3];
        });
        if (n) {
          o.data[i] = 28;
          o.data[i + 1] = 16;
          o.data[i + 2] = 24;
          o.data[i + 3] = 255;
        }
      }
    const t = document.createElement('canvas');
    t.width = t.height = 16;
    t.getContext('2d')!.putImageData(o, 0, 0);
    x.drawImage(t, 0, 0);
  });
}

// ───────── 이웃 마을 목록 ─────────


// ───────── 배율 ─────────

let onZoom: () => void = () => {};
export function setOnZoom(fn: () => void) {
  onZoom = fn;
}
export const syncZoomLabel = () => zoomLabel();
function zoomLabel() {
  $('#bZoom').textContent = '×' + S.zoom;
}

/** 배율 바꾸기 (버튼·핀치 공용). 정수 배율만 */
export function setZoom(z: number) {
  const zs = zoomsNow();
  // LAND2: 폰 ×0.5 — 가장 가까운 배율로
  z = zs.reduce((b, v) => (Math.abs(v - z) < Math.abs(b - z) ? v : b), zs[0]);
  if (z === S.zoom) return;
  S.zoom = z;
  saveZoom();
  zoomLabel();
  onZoom();
}

/** 잠깐만 배율 바꾸기 (마을 등급 연출의 줌아웃 — 저장하지 않는다) */
export function tempZoom(z: number) {
  const zs = zoomsNow();
  // LAND2: 폰 ×0.5 — 가장 가까운 배율로
  z = zs.reduce((b, v) => (Math.abs(v - z) < Math.abs(b - z) ? v : b), zs[0]);
  if (z === S.zoom) return;
  S.zoom = z;
  zoomLabel();
  onZoom();
}

// ───────── 시작 ─────────

export function initHud() {
  drawIcons();
  zoomLabel();
  $('#bBuild').onclick = () => {
    if (S.visiting) return toast('이웃 마을에선 지을 수 없어요');
    cancelPlace();
    openBuild();
  };
  $('#bExp').onclick = () => openBoard();
  $('#bGuest').onclick = () => openGuests();
  $('#bVillage').onclick = () => void openVillage();
  $('#bMenu2').onclick = openGridMenu;
  $('#bNotice').onclick = openNotices;
  $('#bMenu').onclick = openGridMenu;
  $('#bDN').onclick = () => {
    setNight(!S.night);
    game.syncHud();
  };
  $('#bZoom').onclick = () => {
    // 1 → 2 → 3 → 1 …
    const zs = zoomsNow();
    setZoom(zs[(zoomIdx(S.zoom, zs) + 1) % zs.length]);
  };
  // BUILDUX §1-4: ✓/✕/↻ 를 고스트 옆으로 (id 그대로) · 이유·어울림 말풍선
  const gb = document.createElement('div');
  gb.id = 'ghostBtns';
  gb.hidden = true;
  gb.innerHTML = '<p id="ghostTag" hidden></p>';
  gb.appendChild($('#placebar .pbtns'));
  $('#placebar').parentElement!.appendChild(gb);
  $('#placeNo').textContent = '✕';
  $('#placeRot').textContent = '↻';
  $('#placeOk').textContent = '✓';
  $('#placeNo').setAttribute('aria-label', '취소');
  $('#placeRot').setAttribute('aria-label', '좌우 반전');
  $('#placeOk').setAttribute('aria-label', '확정');
  $('#placeNo').onclick = () => cancelPlace(true);
  $('#placeRot').onclick = rotatePlacement;
  $('#placeOk').onclick = confirmPlace;
  $('#vLike').onclick = game.likeNeighbor;
  // PHOTO_SPEC: 이웃 마을 찍기
  $('#vPhoto').onclick = () => enterPhoto();
  $('#vHome').onclick = game.goHome;
  $('#vNext').onclick = game.nextNeighbor;
}

/** 마을 아래 원정 진행 바: 나가 있는 파티마다 남은 시간 (누르면 진행 일지 · 끝났으면 보고서) */
let runbarKey = '';
function updateRunbar() {
  const bar = $('#runbar');
  const runs = S.visiting ? [] : PG.runs.filter((r) => !r.claimed).slice(0, CONFIG.expedition.maxParties);
  const au = S.visiting ? null : PG.hunt.auto;
  const fo = S.visiting ? null : foldInfo();
  bar.hidden = !runs.length && !au && !fo;
  if (bar.hidden) {
    // 숨길 땐 예전 버튼도 치운다 (끝난 원정이 남아 보이지 않게)
    if (runbarKey) {
      runbarKey = '';
      bar.innerHTML = '';
    }
    return;
  }
  const now = Date.now();
  // 핫픽스 6: 접힌 「진행 중」 띠 한 줄(아이콘 + 남은 시간) · 누르면 위로 펼쳐 원정·자동 사냥 줄이 나온다
  const key = runs.map((r) => r.id + (r.result ? 'd' : '')).join(',') + (au ? `|h${au.region}${au.stage}` : '') + (fo ? `|f${fo.region}${fo.stage}${fo.done ? 'd' : ''}` : '');
  if (key !== runbarKey) {
    runbarKey = key;
    const chips = runs.map((r) => `<span class="rc" data-rc="${r.id}"><img src="${iconSrc('m_expedition', true)}" alt=""><em></em></span>`).join('');
    // 핫픽스 10 (11-3): 맡겨 둔 사냥은 접히지 않는 한 줄 「⚔ 숲 1-7 사냥 중 · 12판 · 💰+3,240」 — 누르면 사냥터(멈추기)
    const hline =
      (fo ? `<button class="px hline fold ${fo.done ? 'done' : ''}" id="rbFold"><b></b></button>` : '') + (au ? `<button class="px hline" id="rbHunt"><b></b><i><u></u></i></button>` : '');
    bar.innerHTML = `<div class="rblist" id="rbList"${rbOpen ? '' : ' hidden'}>${runs
      .map((r) => `<button class="px" data-rb="${r.id}"><b>${esc(r.quest.name ?? regionById(r.quest.region).name)}</b><i><u></u></i><em></em></button>`)
      .join('')}</div>${hline}${runs.length ? `<button class="px rbstrip" id="rbStrip" aria-label="진행 중 펼치기">${chips}<s>${rbOpen ? '▾' : '▴'}</s></button>` : ''}`;
    bar.querySelectorAll<HTMLElement>('[data-rb]').forEach((b) => (b.onclick = () => openRunLog(PG.runs.find((r) => r.id === +b.dataset.rb!)!)));
    const hb = document.getElementById('rbHunt');
    if (hb && au) hb.onclick = () => openHunt(au.region as never);
    // 핫픽스 10 §13: 접어 둔 전투 — 누르면 다시 펼치기 (끝났으면 결과 카드)
    const fb = document.getElementById('rbFold');
    if (fb) fb.onclick = () => unfoldHunt();
    const sb = document.getElementById('rbStrip');
    if (sb)
      sb.onclick = () => {
        rbOpen = !rbOpen;
        $('#rbList').hidden = !rbOpen;
        $('#rbStrip s').textContent = rbOpen ? '▾' : '▴';
      };
  }
  const fb = document.getElementById('rbFold');
  if (fb && fo) {
    const nm = `${regionById(fo.region).name.slice(0, 2).trim()} ${REGIONS.findIndex((x) => x.id === fo.region) + 1}-${fo.stage}`;
    const t = fo.done ? `⚔ ${nm} 끝! · 결과 보기` : `⚔ ${nm} 전투 중 · ${Math.floor(fo.time / 60)}:${String(Math.floor(fo.time % 60)).padStart(2, '0')}`;
    const tb = fb.querySelector('b')!;
    if (tb.textContent !== t) tb.textContent = t;
  }
  const hb = document.getElementById('rbHunt');
  if (hb && au) {
    const f = Math.min(1, (now - PG.hunt.idleAt) / (CONFIG.hunt.autoSeconds * 1000));
    (hb.querySelector('u') as HTMLElement).style.width = f * 100 + '%';
    const t = `⚔ ${regionById(au.region as never).name.slice(0, 2).trim()} ${REGIONS.findIndex((x) => x.id === au.region) + 1}-${au.stage} 사냥 중 · ${fmt(au.n ?? 0)}판 · 💰+${fmt(au.gold ?? 0)}`;
    const tb = hb.querySelector('b')!;
    if (tb.textContent !== t) tb.textContent = t;
  }
  let anyDone = false;
  bar.querySelectorAll<HTMLElement>('[data-rb]').forEach((b) => {
    const r = PG.runs.find((x) => x.id === +b.dataset.rb!);
    if (!r) return;
    const done = !!r.result || now >= r.end;
    anyDone ||= !!r.result;
    b.classList.toggle('done', done);
    (b.querySelector('u') as HTMLElement).style.width = `${Math.min(100, ((now - r.start) / Math.max(1, r.end - r.start)) * 100)}%`;
    b.querySelector('em')!.textContent = r.result ? '도착! 보고서' : done ? '돌아오는 중' : clockText(r.end - now);
    const c = bar.querySelector<HTMLElement>(`[data-rc="${r.id}"]`);
    if (c) {
      c.classList.toggle('done', !!r.result);
      c.querySelector('em')!.textContent = r.result ? '도착!' : done ? '귀환' : clockText(r.end - now);
    }
  });
  document.getElementById('rbStrip')?.classList.toggle('done', anyDone);
}
let rbOpen = false;
const clockText = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** 매 프레임: 금화가 바뀌면 숫자 갱신 + 반짝 */
let shownGold = -1;
let timerAcc = 0;
export function tickHud() {
  const now = performance.now();
  if (now - timerAcc > 500) {
    timerAcc = now;
    tickTimers();
    // 원정 결과가 기다리면 원정 버튼이 반짝 (새 게임: 첫 원정을 보내기 전에도)
    $('#bExp').classList.toggle('ready', runsWaiting() || (S.started && !S.visiting && PG.counters.expeditions === 0));
    updateRunbar();
    syncGuide();
    // 메뉴 빨간 점: 받을 업적 · 우편
    $('#bMenu2 .ndot').hidden = !(achReady() + mailWaiting());
    // HOTFIX20 §2: 미뤄 둔 단골 제안 — 누르면 바로 제안 대화
    const np = S.visiting ? 0 : pendingWith('prop');
    let pb = document.getElementById('propBadge');
    if (!pb && np) {
      pb = document.createElement('button');
      pb.id = 'propBadge';
      pb.className = 'px';
      pb.onclick = () => {
        if (isTalking() || isWinOpen()) return;
        runFirstWith('prop');
      };
      $('#hud').appendChild(pb);
    }
    if (pb) {
      pb.hidden = !np;
      const t = `💌 단골 제안 ${np}`;
      if (pb.textContent !== t) pb.textContent = t;
    }
    // DECO_DROP §3: 건설 버튼에 안 본 장식 수
    const nn = S.visiting ? 0 : unseenDrops().length;
    let nb = document.querySelector<HTMLElement>('#bBuild .nbadge');
    if (!nb && nn) {
      nb = document.createElement('i');
      nb.className = 'nbadge';
      $('#bBuild').appendChild(nb);
    }
    if (nb) {
      nb.hidden = !nn;
      const t = nn > 99 ? '99+' : `${nn}`;
      if (nb.textContent !== t) nb.textContent = t;
    }
    // 5단계: 자동 사냥 — 켜 있으면 30초마다 한 판
    // 핫픽스 10 (11-3): 판마다 토스트는 끄고 마을 줄 숫자만 · 장비를 얻었거나 레벨업일 때만 토스트
    const hr = autoTick();
    if (hr && (hr.items.length || hr.levelUps.length)) toastHtml(`<img src="${iconSrc('skill_auto')}" alt=""><span>맡겨 둔 사냥 · 금화 +${fmt(hr.gold)}${hr.items.length ? ` · 장비 ${hr.items.length}` : ''}${hr.levelUps.length ? ` · ${esc(hr.levelUps.join(', '))}` : ''}</span>`);
    // GOLDSINK: 축복 아이콘 · §6 다음 이야기 기다림 한 줄
    tickGoldsinkHud();
    // WAYFIND §1: 「!」 · 처음 써 본 반응
    tickWayfind();
    const st = '★' + stars();
    if ($('#starv').textContent !== st) $('#starv').textContent = st;
    fitDay();
  }
  if (S.gold !== shownGold) {
    const up = S.gold > shownGold && shownGold >= 0;
    shownGold = S.gold;
    // 핫픽스 9: 100만이 넘으면 「1.2M」로 줄여 상태 카드 줄이 안 갈리게
    $('#goldv').textContent = vis('uiKitV2') ? bigNum(S.gold) : S.gold >= 1e6 ? (S.gold / 1e6).toFixed(S.gold >= 1e7 ? 0 : 1) + 'M' : fmt(S.gold);
    if (up) {
      const g = $('#gold');
      g.classList.remove('bump');
      void g.offsetWidth;
      g.classList.add('bump');
    }
  }
}
