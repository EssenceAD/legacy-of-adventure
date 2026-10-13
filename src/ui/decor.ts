// TOWN T2 → BUILDUX: 꾸미기 모드 — 손님·위 HUD를 숨기고 위 도구 탭 + 아래 버튼 줄
//  탭: ✋ 옮기기(꾹 눌러 들기 · 누르면 정보) · ＋ 놓기 · 길(붓·직선 · 지우개) · 바닥(붓·채우기 · 지우개) · 범위(끌어서 네모 → 옮기기·반전·넣어 두기·같은 것 놓기)
//  아래: ↶ 되돌리기 · ↷ 다시 하기 (20단계) · 건물 흐리게 · 격자 · 자동 길 · 📦 보관함 · ✓ 다 했어요
import { vis } from '../world/visual';
import {
  autoPathOn, beginStroke, isAutoPath, canRedo, canUndo, decorView, decosIn, elbowTiles, endStroke, fillTiles, FILL_MAX, GROUND_KINDS, groupWhy, moveGroup, PAINT_NAME, paintMany, paintTile, paintWhy, PATH_MATS,
  redo, redoLabel, setAutoPath, tapCycle, undo, undoLabel, flipGroup, type PaintCode,
} from '../world/decor';
import { putAway, refundOfStored, refundStored, storeList } from '../world/store';
import { def } from '../data/catalog';
import { markDirty, P, S } from '../world/state';
import { placing } from '../world/town';
import { track as trackEv } from '../net/telemetry';
import { buildHooks, closeWin, isWinOpen, openBuild, openWin, thumbOf, toast } from './windows';
import { cancelPlace, rotatePlacement, startMoveEntrance, startPlace, startTakeOut } from './hud';
import { esc } from './common';
import { syncHud } from '../game';

type Tool = 'hand' | 'path' | 'ground' | 'erase' | 'select';
type Tab = 'hand' | 'place' | 'path' | 'ground' | 'select';
const ui = {
  tool: 'hand' as Tool,
  path: 'stone' as PaintCode,
  ground: 'flower' as PaintCode,
  /** 길: 붓 / 직선 · 바닥: 붓 / 채우기 */
  pathMode: 'brush' as 'brush' | 'line',
  groundMode: 'brush' as 'brush' | 'fill',
  /** 지우개를 어느 탭에서 들었나 */
  eraseFrom: 'path' as 'path' | 'ground',
};
// BUILDUX §4: 쓰던 도구를 기억한다
const TOOL_KEY = 'legacy-of-adventure-decorTool';
try {
  const s = JSON.parse(localStorage.getItem(TOOL_KEY) ?? 'null');
  if (s && typeof s === 'object') Object.assign(ui, s);
} catch {
  /* 없으면 기본 */
}
const remember = () => {
  try {
    localStorage.setItem(TOOL_KEY, JSON.stringify(ui));
  } catch {
    /* 저장 못 해도 괜찮다 */
  }
};
let bar: HTMLDivElement | null = null;
export const decorOn = () => decorView.on;

export function enterDecor() {
  if (S.visiting) return;
  closeWin();
  decorView.on = true;
  decorView.picked = [];
  decorView.sel = null;
  document.body.classList.add('decor');
  bar = document.createElement('div');
  bar.id = 'decorBar';
  bar.className = 'px';
  document.getElementById('view')!.appendChild(bar);
  draw();
  trackEv('decor_mode', { on: true });
  // BUILDUX §4: 첫 진입 안내 (꾹 → 끌기 → ✓) 한 번
  if (!P.decor.hintSeen) firstHint();
}
export function exitDecor() {
  if (placing.pl) cancelPlace();
  decorView.on = false;
  decorView.fade = false;
  loupeOff();
  decorView.picked = [];
  decorView.sel = null;
  decorView.hover = null;
  decorView.ghost = null;
  decorView.preview = [];
  document.body.classList.remove('decor');
  document.getElementById('decorHint')?.remove();
  bar?.remove();
  bar = null;
  markDirty();
}

const TABS: [Tab, string][] = [['hand', '✋ 옮기기'], ['place', '＋ 놓기'], ['path', '길'], ['ground', '바닥'], ['select', '범위']];
const tabNow = (): Tab => (ui.tool === 'erase' ? ui.eraseFrom : ui.tool);
const sw = (on: boolean, attr: string, inner: string) => `<button class="sw ${on ? 'on' : ''}" ${attr}>${inner}</button>`;
function draw() {
  if (!bar) return;
  const tab = tabNow();
  const erase = ui.tool === 'erase';
  let sub: string;
  if (tab === 'path')
    sub =
      sw(!erase && ui.pathMode === 'brush', 'data-mode="brush"', '🖌 붓') +
      sw(!erase && ui.pathMode === 'line', 'data-mode="line"', '📏 직선') +
      PATH_MATS.map((c) => sw(!erase && ui.path === c, `data-mat="${c}"`, `<span class="pm pm-${c}"></span>${PAINT_NAME[c]}`)).join('') +
      sw(erase, 'data-tool="erase"', '지우개') +
      // BUILDUX §7: 자동 길 켬/끔은 길 도구 안에
      `<button data-act="auto" class="${autoPathOn() ? 'on' : ''}" title="건물마다 여관까지 길이 저절로 깔려요 · 지우개로 지운 칸은 다시 안 깔려요">자동 길 ${autoPathOn() ? '켬' : '끔'}</button>`;
  else if (tab === 'ground')
    sub =
      sw(!erase && ui.groundMode === 'brush', 'data-mode="brush"', '🖌 붓') +
      sw(!erase && ui.groundMode === 'fill', 'data-mode="fill"', '🪣 채우기') +
      GROUND_KINDS.map((c) => sw(!erase && ui.ground === c, `data-gk="${c}"`, `<span class="pm pm-${c}"></span>${PAINT_NAME[c]}`)).join('') +
      sw(erase, 'data-tool="erase"', '지우개');
  else if (tab === 'select') {
    const pk = decorView.picked;
    const same = pk.length && pk.every((o) => o.kind === pk[0].kind) ? pk[0].kind : null;
    sub = pk.length
      ? `<span class="hint">장식 ${pk.length}개 · 끌어서 옮겨요</span><button data-act="flip">${vis('actionsTidy') ? '↔ 좌우 뒤집기' : '↔ 반전'}</button><button data-act="stash">📦 넣어 두기</button>${same ? `<button data-act="dup">＋ 같은 것 놓기</button>` : ''}<button data-act="unpick">해제</button>`
      : '<span class="hint">손가락으로 네모를 그려 장식을 골라요 (PC: Shift+끌기)</span>';
  } else
    // v0.25.4 actionsTidy: 실제 동작(짧게 눌러도 건물·장식을 바로 든다)에 맞춘 안내 — 정보는 꾸미기 밖에서 누르면
    sub = `<span class="hint">${vis('actionsTidy') ? '누르면 들어서 옮겨요 · 끌면 둘러보기 · 정보는 꾸미기 밖에서' : '꾹 눌러 들어서 옮겨요 · 그냥 누르면 정보 · 끌면 둘러보기'}</span><button data-act="ent" title="손님이 드나드는 울타리 앞 입구를 좌우로 옮겨요">🚪 입구 옮기기</button>`;
  const n = storeList().length;
  bar.innerHTML = `<div class="dt">${TABS.map(([t, nm]) => `<button class="tl ${tab === t ? 'on' : ''}" data-tab="${t}">${nm}</button>`).join('')}</div>
    <div class="ds">${sub}</div>
    <div class="dd"><button data-act="undo" ${canUndo() ? '' : 'disabled'} title="${esc(undoLabel())}" aria-label="되돌리기">↶</button><button data-act="redo" ${canRedo() ? '' : 'disabled'} title="${esc(redoLabel())}" aria-label="다시 하기">↷</button><button data-act="fade" class="${decorView.fadeOn ? 'on' : ''}">건물 흐리게 ${decorView.fadeOn ? '켬' : '끔'}</button><button data-act="grid" class="${decorView.grid ? 'on' : ''}">격자 ${decorView.grid ? '켬' : '끔'}</button><button data-act="store">📦 보관함${n ? ` ${n}` : ''}</button><button data-act="exit" class="ex">✓ 다 했어요</button></div>`;
  bar.querySelectorAll<HTMLElement>('[data-tab]').forEach(
    (b) =>
      (b.onclick = () => {
        const t = b.dataset.tab as Tab;
        decorView.sel = null;
        decorView.preview = [];
        if (t === 'place') {
          // 꾸미기 모드는 그대로 두고 건설 목록만
          openBuild();
          return;
        }
        setTool(t);
      }),
  );
  bar.querySelectorAll<HTMLElement>('[data-tool]').forEach(
    (b) =>
      (b.onclick = () => {
        if (ui.tool !== 'erase') ui.eraseFrom = tab === 'ground' ? 'ground' : 'path';
        setTool(ui.tool === 'erase' ? ui.eraseFrom : 'erase');
      }),
  );
  // HOTFIX19 §2: 붓·바닥·지우개를 들면 건물 흐리게
  decorView.fade = ui.tool === 'path' || ui.tool === 'ground' || ui.tool === 'erase';
  bar.querySelectorAll<HTMLElement>('[data-mode]').forEach(
    (b) =>
      (b.onclick = () => {
        if (tab === 'path') ui.pathMode = b.dataset.mode as 'brush' | 'line';
        else ui.groundMode = b.dataset.mode as 'brush' | 'fill';
        setTool(tab as Tool);
      }),
  );
  bar.querySelectorAll<HTMLElement>('[data-mat]').forEach((b) => (b.onclick = () => ((ui.path = b.dataset.mat as PaintCode), setTool('path'))));
  bar.querySelectorAll<HTMLElement>('[data-gk]').forEach((b) => (b.onclick = () => ((ui.ground = b.dataset.gk as PaintCode), setTool('ground'))));
  bar.querySelectorAll<HTMLElement>('[data-act]').forEach((b) => (b.onclick = () => act(b.dataset.act!)));
}
function setTool(t: Tool) {
  ui.tool = t;
  remember();
  draw();
}

function act(a: string) {
  if (a === 'grid') decorView.grid = !decorView.grid;
  if (a === 'fade') decorView.fadeOn = !decorView.fadeOn;
  if (a === 'auto') {
    setAutoPath(!autoPathOn());
    toast(autoPathOn() ? '자동 길: 건물마다 여관까지 길이 저절로 깔려요' : '자동 길 끔: 길 붓으로 직접 그려요');
  }
  if (a === 'undo') doUndo();
  if (a === 'redo') doRedo();
  if (a === 'flip') {
    const why = flipGroup(decorView.picked);
    if (why) toast(why);
  }
  if (a === 'stash') stashPicked();
  if (a === 'dup') {
    const k = decorView.picked[0]?.kind;
    decorView.picked = [];
    if (k) startPlace(k);
  }
  if (a === 'unpick') decorView.picked = [];
  // FEEDBACK23 §5: 마을 입구 옮기기
  if (a === 'ent') return startMoveEntrance();
  if (a === 'store') return openStore();
  if (a === 'exit') return exitDecor();
  draw();
}
function doUndo() {
  const l = undo();
  toast(l ? `되돌렸어요 · ${l}` : '되돌릴 게 없어요');
  decorView.picked = decorView.picked.filter((o) => o.tx != null);
  syncHud();
  draw();
}
function doRedo() {
  const l = redo();
  toast(l ? `다시 했어요 · ${l}` : '다시 할 게 없어요');
  syncHud();
  draw();
}
function stashPicked() {
  const n = putAway(decorView.picked);
  decorView.picked = [];
  toast(n ? `📦 ${n}개를 보관함에 넣었어요 · ↶로 되돌릴 수 있어요` : '넣어 둘 수 없어요');
  draw();
}

// ───────── 📦 보관함 (꺼내 놓기 · 팔기는 여기서만) ─────────

export function openStore() {
  const list = storeList();
  const rows = list
    .map(
      (s, i) =>
        `<div class="irow"><img class="sthumb" src="${thumbOf(s.kind)}" alt=""><span><b>${esc(def(s.kind).name)}${s.lvl > 1 ? ` Lv.${s.lvl}` : ''}</b><small>${def(s.kind).pioneerDeco ? '개척자 전용 · 팔 수 없어요' : def(s.kind).levelDeco ? '레벨 기념 장식 · 팔 수 없어요' : s.fromProp ? '마을 등급 장식' : `팔면 💰${refundOfStored(s).toLocaleString('ko-KR')}`}</small></span><button data-out="${i}">꺼내 놓기</button>${def(s.kind).pioneerDeco || def(s.kind).levelDeco ? '' : `<button class="ghost" data-sell="${i}">팔기</button>`}</div>`,
    )
    .join('');
  openWin(
    '보관함',
    `<p class="note">넣어 둔 건물·장식은 레벨·색 그대로예요 · 언제든 꺼내 놓을 수 있어요. 금화로 돌려받는 철거는 여기서만 할 수 있어요.</p><div class="ilist">${rows || '<p class="note">보관함이 비었어요 · 꾸미기 모드에서 「범위」로 고르거나, 건물을 눌러 「넣어 두기」</p>'}</div>`,
  );
  document.querySelectorAll<HTMLElement>('#winB [data-out]').forEach(
    (b) =>
      (b.onclick = () => {
        const s = list[+b.dataset.out!];
        closeWin();
        startTakeOut(s);
      }),
  );
  document.querySelectorAll<HTMLElement>('#winB [data-sell]').forEach(
    (b) =>
      (b.onclick = () => {
        const s = list[+b.dataset.sell!];
        if (b.dataset.sure !== '1') {
          // 실수 방지: 한 번 더 눌러야 판다
          b.dataset.sure = '1';
          b.textContent = `정말 팔기 💰${refundOfStored(s).toLocaleString('ko-KR')}`;
          b.classList.add('red');
          return;
        }
        const g = refundStored(s);
        toast(`${def(s.kind).name}을(를) 팔았어요 +💰${g.toLocaleString('ko-KR')}`);
        syncHud();
        openStore();
      }),
  );
}

// ───────── BUILDUX §4: 첫 진입 안내 (손가락: 꾹 → 끌기 → ✓) ─────────

function firstHint() {
  P.decor.hintSeen = true;
  markDirty();
  const el = document.createElement('div');
  el.id = 'decorHint';
  el.className = 'px';
  el.innerHTML = `<div class="dh-stage"><i class="dh-b"></i><i class="dh-f">👆</i><i class="dh-ok">✓</i></div><p><b>꾹 눌러 들고</b> → <b>끌어서</b> → <b>✓</b></p><small>길·바닥은 위 탭에서 · 실수하면 ↶</small>`;
  el.onclick = () => el.remove();
  document.getElementById('view')!.appendChild(el);
  setTimeout(() => el.remove(), 8000);
}

// ───────── 손가락 (main이 꾸미기 모드일 때 넘겨준다) ─────────

let drag: null | { kind: 'paint'; x: number; y: number; moved: boolean; had: boolean } | { kind: 'line'; x: number; y: number } | { kind: 'sel' } | { kind: 'group'; x: number; y: number } = null;
const tile = (fx: number, fy: number): [number, number] => [Math.floor(fx), Math.floor(fy)];
let lastTile: [number, number] | null = null;
/** 두 칸 사이를 잇는 칸들 (브레젠험) */
export function lineTiles(a: [number, number], b: [number, number]): [number, number][] {
  const out: [number, number][] = [];
  let [x0, y0] = a;
  const [x1, y1] = b;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 200; n++) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}
// HOTFIX19 §2: 손가락 위쪽 돋보기 (손가락에 가려진 칸을 크게)
let loupeCv: HTMLCanvasElement | null = null;
function loupe(cx: number, cy: number) {
  const scene = document.getElementById('scene') as HTMLCanvasElement | null;
  if (!scene) return;
  if (!loupeCv) {
    loupeCv = document.createElement('canvas');
    loupeCv.id = 'loupe';
    loupeCv.width = loupeCv.height = 96;
    document.body.appendChild(loupeCv);
  }
  const r = scene.getBoundingClientRect();
  const kx = scene.width / r.width;
  const ky = scene.height / r.height;
  const src = 24;
  const g = loupeCv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, 96, 96);
  g.drawImage(scene, (cx - r.left) * kx - src * kx, (cy - r.top) * ky - src * ky, src * 2 * kx, src * 2 * ky, 0, 0, 96, 96);
  g.strokeStyle = '#ffd36b';
  g.strokeRect(44, 44, 8, 8);
  loupeCv.style.left = `${cx - 48}px`;
  loupeCv.style.top = `${cy - 150}px`;
  loupeCv.hidden = false;
}
function loupeOff() {
  if (loupeCv) loupeCv.hidden = true;
}
const codeNow = (): PaintCode | null => (ui.tool === 'path' ? ui.path : ui.tool === 'ground' ? ui.ground : null);
// BUILDUX §7: 자동 길 칸 툴팁
let tipEl: HTMLDivElement | null = null;
let tipT = 0;
function autoTip(x: number, y: number, cx?: number, cy?: number) {
  const show = cx != null && cy != null && (ui.tool === 'path' || ui.tool === 'erase') && isAutoPath(x, y);
  if (!show) {
    if (tipEl) tipEl.hidden = true;
    return;
  }
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'pathTip';
    tipEl.className = 'px';
    document.body.appendChild(tipEl);
  }
  tipEl.textContent = ui.tool === 'erase' ? '자동 길 · 지우면 다시 안 깔려요 (↶로 되돌리기)' : '자동 길 · 지우개로 지우거나 「자동 길 끔」';
  tipEl.style.left = `${Math.max(8, Math.min(innerWidth - 240, cx! - 110))}px`;
  tipEl.style.top = `${Math.max(8, cy! - 64)}px`;
  tipEl.hidden = false;
  clearTimeout(tipT);
  tipT = window.setTimeout(() => tipEl && (tipEl.hidden = true), 2200);
}
export const decorInput = {
  /** 이 손가락을 꾸미기가 가져가나 (옮기기 탭이면 화면 이동·누르기·꾹 누르기는 평소대로 · Shift+끌기는 범위) */
  wants: (shift = false) => decorView.on && (ui.tool !== 'hand' || shift),
  down(fx: number, fy: number, cx?: number, cy?: number, shift = false) {
    const [x, y] = tile(fx, fy);
    if (ui.tool === 'select' || shift) {
      const onPicked = !shift && decorView.picked.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);
      if (onPicked) {
        drag = { kind: 'group', x, y };
        decorView.ghost = { dx: 0, dy: 0, ok: true };
      } else {
        drag = { kind: 'sel' };
        decorView.picked = [];
        decorView.sel = { x0: x, y0: y, x1: x, y1: y };
      }
      draw();
      return;
    }
    // BUILDUX §3-4: 채우기 = 한 번 누르기
    if (ui.tool === 'ground' && ui.groundMode === 'fill') {
      const tiles = fillTiles(x, y);
      if (!tiles) toast(`영역이 너무 넓어요 (최대 ${FILL_MAX}칸) · 울타리·길로 닫힌 곳을 눌러요`);
      else if (!tiles.length) toast('여기는 채울 수 없어요');
      else {
        const n = paintMany(tiles, ui.ground, `${PAINT_NAME[ui.ground]} 채우기`);
        if (n) toast(`${PAINT_NAME[ui.ground]} ${n}칸을 채웠어요`);
      }
      draw();
      return;
    }
    // BUILDUX §3-2: 직선 길 = 시작 칸에서 끝 칸까지 끌기
    if (ui.tool === 'path' && ui.pathMode === 'line') {
      drag = { kind: 'line', x, y };
      this.move(fx, fy, cx, cy);
      return;
    }
    const code = codeNow();
    drag = { kind: 'paint', x, y, moved: false, had: !!code && P.decor.paint[`${x},${y}`] === code };
    beginStroke(code);
    // HOTFIX19 §1: 누르는 순간 그 칸을 바로 칠한다
    lastTile = null;
    this.move(fx, fy, cx, cy);
  },
  move(fx: number, fy: number, cx?: number, cy?: number) {
    const [x, y] = tile(fx, fy);
    decorView.hover = [x, y];
    if (!drag || drag.kind === 'paint') autoTip(x, y, cx, cy);
    if (!drag) return;
    if (drag.kind === 'paint') {
      if (x !== drag.x || y !== drag.y) drag.moved = true;
      // HOTFIX19 §1: 빠르게 그어도 칸이 비지 않게 — 지난 칸에서 지금 칸까지 이어서
      for (const [tx, ty] of lineTiles(lastTile ?? [x, y], [x, y])) if (!paintWhy(tx, ty, codeNow())) paintTile(tx, ty, codeNow());
      lastTile = [x, y];
      if (cx != null && cy != null) loupe(cx, cy);
    } else if (drag.kind === 'line') {
      decorView.preview = elbowTiles([drag.x, drag.y], [x, y]);
      decorView.previewOk = decorView.preview.some(([tx, ty]) => !paintWhy(tx, ty, ui.path));
      if (cx != null && cy != null) loupe(cx, cy);
    } else if (drag.kind === 'sel' && decorView.sel) {
      decorView.sel.x1 = x;
      decorView.sel.y1 = y;
    } else if (drag.kind === 'group') {
      const dx = x - drag.x;
      const dy = y - drag.y;
      if (dx !== decorView.ghost?.dx || dy !== decorView.ghost?.dy) decorView.ghost = { dx, dy, ok: !groupWhy(decorView.picked, dx, dy) };
    }
  },
  up() {
    const d = drag;
    drag = null;
    if (!d) return;
    if (d.kind === 'paint') {
      endStroke();
      loupeOff();
      // BUILDUX §3-3: 같은 길 칸을 그냥 한 번 더 누르면 → 모서리 둥글게 → 한 번 더 = 지우기
      if (!d.moved && d.had && ui.tool === 'path') {
        const r = tapCycle(d.x, d.y);
        if (r) toast(r === 'round' ? '모서리를 둥글게 · 한 번 더 누르면 지워요' : '길을 지웠어요');
      }
    }
    if (d.kind === 'line') {
      loupeOff();
      const tiles = decorView.preview;
      decorView.preview = [];
      const n = tiles.length ? paintMany(tiles, ui.path, `${PAINT_NAME[ui.path]} 직선 ${tiles.length}칸`) : 0;
      if (tiles.length > 1) toast(n ? `${PAINT_NAME[ui.path]} ${n}칸을 깔았어요` : '여기엔 길을 깔 수 없어요');
    }
    if (d.kind === 'sel' && decorView.sel) {
      const s = decorView.sel;
      decorView.picked = decosIn(s.x0, s.y0, s.x1, s.y1);
      decorView.sel = null;
      if (!decorView.picked.length) toast('그 범위엔 장식이 없어요 (건물은 꾹 눌러서 옮겨요)');
      else if (ui.tool !== 'select') setTool('select');
    }
    if (d.kind === 'group' && decorView.ghost) {
      const { dx, dy } = decorView.ghost;
      decorView.ghost = null;
      if (dx || dy) {
        const why = moveGroup(decorView.picked, dx, dy);
        toast(why ?? `장식 ${decorView.picked.length}개를 옮겼어요`);
      }
    }
    draw();
  },
  /** BUILDUX §5: 오른쪽 클릭 = 지금 끌던 것 취소 */
  cancel() {
    const d = drag;
    drag = null;
    if (d?.kind === 'paint') endStroke();
    decorView.sel = null;
    decorView.ghost = null;
    decorView.preview = [];
    loupeOff();
    if (d) trackEv('edit_cancel', { tool: d.kind });
    draw();
  },
};

export function initDecor() {
  buildHooks.decor = enterDecor;
  buildHooks.redraw = () => draw();
  buildHooks.pathTool = () => {
    ui.pathMode = 'brush';
    setTool('path');
    toast('🖌 마을의 붓 — 길 붓을 들었어요');
  };
  // BUILDUX §5 (PC): Esc · R 반전 · Ctrl+Z / Ctrl+Y · Delete 넣어 두기 · Enter 확정
  addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (placing.pl) {
      if (k === 'escape') return void cancelPlace(true);
      if (k === 'r' && !e.ctrlKey && !e.metaKey) return void rotatePlacement();
      if (k === 'enter') return void (document.getElementById('placeOk') as HTMLButtonElement | null)?.click();
    }
    if (!decorView.on || isWinOpen()) return;
    if (k === 'escape') return exitDecor();
    if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) {
      e.preventDefault();
      return doUndo();
    }
    if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) {
      e.preventDefault();
      return doRedo();
    }
    if ((k === 'delete' || k === 'backspace') && decorView.picked.length) return stashPicked();
    if (k === 'r' && decorView.picked.length) {
      flipGroup(decorView.picked);
      return draw();
    }
  });
}
