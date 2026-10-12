// TOWN T2: 꾸미기 모드 — 손님·위 HUD를 숨기고 아래 도구 줄 하나
//  손(끌어 화면 이동·건물 누르기) · 길 붓(재질 5) · 바닥(4) · 지우개 · 고르기(범위 → 끌어 옮기기 · 좌우 반전) · 격자 · 자동 길 · 되돌리기 10단계
import {
  autoPathOn, beginStroke, canUndo, decorView, decosIn, endStroke, GROUND_KINDS, groupWhy, moveGroup, PAINT_NAME, paintTile, paintWhy, PATH_MATS, setAutoPath, undo, undoLabel, flipGroup, type PaintCode,
} from '../world/decor';
import { markDirty, S } from '../world/state';
import { track as trackEv } from '../net/telemetry';
import { buildHooks, closeWin, openBuild, toast } from './windows';

type Tool = 'hand' | 'path' | 'ground' | 'erase' | 'select';
const ui = { tool: 'hand' as Tool, path: 'stone' as PaintCode, ground: 'flower' as PaintCode };
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
}
export function exitDecor() {
  decorView.on = false;
  decorView.fade = false;
  loupeOff();
  decorView.picked = [];
  decorView.sel = null;
  decorView.hover = null;
  decorView.ghost = null;
  document.body.classList.remove('decor');
  bar?.remove();
  bar = null;
  markDirty();
}

const TOOLS: [Tool, string][] = [['hand', '✋ 손'], ['path', '길 붓'], ['ground', '바닥'], ['erase', '지우개'], ['select', '고르기']];
function draw() {
  if (!bar) return;
  const sub =
    ui.tool === 'path'
      ? PATH_MATS.map((c) => `<button class="sw ${ui.path === c ? 'on' : ''}" data-mat="${c}"><span class="pm pm-${c}"></span>${PAINT_NAME[c]}</button>`).join('')
      : ui.tool === 'ground'
        ? GROUND_KINDS.map((c) => `<button class="sw ${ui.ground === c ? 'on' : ''}" data-gk="${c}"><span class="pm pm-${c}"></span>${PAINT_NAME[c]}</button>`).join('')
        : ui.tool === 'select'
          ? decorView.picked.length
            ? `<span class="hint">장식 ${decorView.picked.length}개 · 고른 칸을 끌어서 옮겨요</span><button data-act="flip">↔ 좌우 반전</button><button data-act="unpick">고르기 해제</button>`
            : '<span class="hint">손가락으로 범위를 그려 장식을 골라요</span>'
          : ui.tool === 'hand'
            ? '<span class="hint">끌어서 둘러보고, 건물·장식을 누르면 옮기기·방향 바꾸기</span>'
            : '<span class="hint">칠한 칸을 문지르면 지워져요</span>';
  bar.innerHTML = `<div class="dt">${TOOLS.map(([t, n]) => `<button class="tl ${ui.tool === t ? 'on' : ''}" data-tool="${t}">${n}</button>`).join('')}</div>
    <div class="ds">${sub}</div>
    <div class="dd"><button data-act="fade" class="${decorView.fadeOn ? 'on' : ''}">건물 흐리게 ${decorView.fadeOn ? '켬' : '끔'}</button><button data-act="grid" class="${decorView.grid ? 'on' : ''}">격자 ${decorView.grid ? '켬' : '끔'}</button><button data-act="auto" class="${autoPathOn() ? 'on' : ''}">자동 길 ${autoPathOn() ? '켬' : '끔'}</button><button data-act="undo" ${canUndo() ? '' : 'disabled'} title="${undoLabel()}">↶ 되돌리기</button><button data-act="build">＋ 놓기</button><button data-act="exit" class="ex">✓ 다 했어요</button></div>`;
  bar.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => (b.onclick = () => ((ui.tool = b.dataset.tool as Tool), (decorView.sel = null), draw())));
  // HOTFIX19 §2: 붓·바닥·지우개를 들면 건물 흐리게
  decorView.fade = ui.tool === 'path' || ui.tool === 'ground' || ui.tool === 'erase';
  bar.querySelectorAll<HTMLElement>('[data-mat]').forEach((b) => (b.onclick = () => ((ui.path = b.dataset.mat as PaintCode), draw())));
  bar.querySelectorAll<HTMLElement>('[data-gk]').forEach((b) => (b.onclick = () => ((ui.ground = b.dataset.gk as PaintCode), draw())));
  bar.querySelectorAll<HTMLElement>('[data-act]').forEach(
    (b) =>
      (b.onclick = () => {
        const a = b.dataset.act;
        if (a === 'grid') decorView.grid = !decorView.grid;
        if (a === 'fade') decorView.fadeOn = !decorView.fadeOn;
        if (a === 'auto') {
          setAutoPath(!autoPathOn());
          toast(autoPathOn() ? '자동 길: 건물마다 여관까지 길이 저절로 깔려요' : '자동 길 끔: 길 붓으로 직접 그려요');
        }
        if (a === 'undo') {
          const l = undo();
          if (l) toast(`되돌렸어요 · ${l}`);
        }
        if (a === 'flip') {
          const why = flipGroup(decorView.picked);
          if (why) toast(why);
        }
        if (a === 'unpick') decorView.picked = [];
        if (a === 'build') {
          exitDecor();
          openBuild();
          return;
        }
        if (a === 'exit') return exitDecor();
        draw();
      }),
  );
}

// ───────── 손가락 (main이 꾸미기 모드일 때 넘겨준다) ─────────

let drag: null | { kind: 'paint' } | { kind: 'sel' } | { kind: 'group'; x: number; y: number } = null;
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
export const decorInput = {
  /** 이 손가락을 꾸미기가 가져가나 (손 도구면 화면 이동·누르기는 평소대로) */
  wants: () => decorView.on && ui.tool !== 'hand',
  down(fx: number, fy: number, cx?: number, cy?: number) {
    const [x, y] = tile(fx, fy);
    if (ui.tool === 'select') {
      const onPicked = decorView.picked.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);
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
    drag = { kind: 'paint' };
    beginStroke(codeNow());
    // HOTFIX19 §1: 누르는 순간 그 칸을 바로 칠한다
    lastTile = null;
    this.move(fx, fy, cx, cy);
  },
  move(fx: number, fy: number, cx?: number, cy?: number) {
    const [x, y] = tile(fx, fy);
    decorView.hover = [x, y];
    if (!drag) return;
    if (drag.kind === 'paint') {
      // HOTFIX19 §1: 빠르게 그어도 칸이 비지 않게 — 지난 칸에서 지금 칸까지 이어서
      for (const [tx, ty] of lineTiles(lastTile ?? [x, y], [x, y])) if (!paintWhy(tx, ty, codeNow())) paintTile(tx, ty, codeNow());
      lastTile = [x, y];
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
    }
    if (d.kind === 'sel' && decorView.sel) {
      const s = decorView.sel;
      decorView.picked = decosIn(s.x0, s.y0, s.x1, s.y1);
      decorView.sel = null;
      if (!decorView.picked.length) toast('그 범위엔 장식이 없어요 (건물은 하나씩 눌러서 옮겨요)');
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
};

export function initDecor() {
  buildHooks.decor = enterDecor;
  // 창이 열리면(건물 누르기 등) 손 도구에서도 그대로 · Esc는 꾸미기 끝내기
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && decorView.on && !document.querySelector('#win.on')) exitDecor();
  });
}
