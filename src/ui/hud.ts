// HUD: 위 상태판(이름·금화·날짜), 아래 독(건설·땅·손님·마을·장부), 배치 막대, 배율 버튼
import { def, type Kind } from '../data/catalog';
import { P } from '../engine/pixel';
import * as game from '../game';

import { setNight } from '../world/daynight';
import { stars } from '../world/progress';
import { P as PG, S } from '../world/state';
import { CONFIG } from '../data/config';
import { regionById } from '../data/items';
import { esc } from './common';
import { baseKey, FLIP } from '../engine/assets';
import { blocksDoor, canPlace, grid, inLand, placing, suggestSpot, type Placement } from '../world/town';
import type { Building } from '../world/state';
import { openNotices } from './notice';
import { openBoard, openRunLog, runsWaiting } from './expedition';
import { openGuests } from './guests';
import { openVillage } from './neighbors';
import { saveZoom, zoomsNow } from './screen';
import { tickTimers } from './common';
import { openBuild, openMenu, toast } from './windows';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const fmt = (n: number) => n.toLocaleString('ko-KR');

// ───────── 배치 모드 (짓기 · 옮기기) ─────────

/** 놓을 수 없는 까닭 (놓을 수 있으면 null) */
function whyNot(pl: Placement): string | null {
  if (pl.tx == null || pl.ty == null) return '놓을 곳을 눌러요';
  const ign = pl.move;
  for (let j = 0; j < pl.fh; j++)
    for (let i = 0; i < pl.fw; i++) if (!inLand(pl.tx + i, pl.ty + j)) return '땅 밖이에요';
  for (let j = 0; j < pl.fh; j++)
    for (let i = 0; i < pl.fw; i++) {
      const g = grid[pl.ty + j]?.[pl.tx + i];
      if (g && g !== ign) return '다른 건물과 겹쳐요';
    }
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
  $('#placeTxt').textContent = `${def(pl.kind).name}${pl.move ? ' 옮기기' : ''} · ${pl.ok ? '여기 괜찮아요' : '여기엔 못 놓아요'}`;
  const w = $('#placeWhy');
  w.textContent = pl.why ?? '';
  w.hidden = pl.ok;
}

function openPlace(pl: Placement) {
  placing.pl = pl;
  check(pl);
  $('#placebar').hidden = false;
  $('#view').classList.add('placing');
  placeText(pl);
  if (pl.tx != null) game.focusTile(pl.tx + pl.fw / 2, pl.ty! + pl.fh / 2);
}

export function startPlace(kind: Kind) {
  const d = def(kind);
  const pl: Placement = { kind, sprite: d.sprite, fw: d.size[0], fh: d.size[1], tx: null, ty: null, ok: false };
  suggestSpot(pl);
  openPlace(pl);
}

/** 이미 지은 건물 옮기기 (방향도 바꿀 수 있다) */
export function startMove(o: Building) {
  openPlace({ kind: o.kind, sprite: o.sprite, fw: o.fw, fh: o.fh, tx: o.tx, ty: o.ty, ok: false, flip: !!o.flip, move: o });
}

/** 배치 중 탭·끌기: 그 자리로 미리보기를 옮긴다 (칸이 바뀌면 톡) */
export function movePlacement(fx: number, fy: number) {
  const pl = placing.pl;
  if (!pl) return;
  const tx = Math.floor(fx - pl.fw / 2 + 0.5);
  const ty = Math.floor(fy - pl.fh / 2 + 0.5);
  if (tx === pl.tx && ty === pl.ty) return;
  pl.tx = tx;
  pl.ty = ty;
  pl.snapT = S.T;
  check(pl);
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

export function cancelPlace() {
  placing.pl = null;
  $('#placebar').hidden = true;
  $('#view').classList.remove('placing');
}

function confirmPlace() {
  const pl = placing.pl;
  if (!pl || !pl.ok) return;
  if (pl.move ? game.moveBuilding(pl) : game.placeBuilding(pl)) cancelPlace();
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
  z = Math.max(zs[0], Math.min(zs[zs.length - 1], Math.round(z)));
  if (z === S.zoom) return;
  S.zoom = z;
  saveZoom();
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
  $('#bMenu2').onclick = openMenu;
  $('#bNotice').onclick = openNotices;
  $('#bMenu').onclick = openMenu;
  $('#bDN').onclick = () => {
    setNight(!S.night);
    game.syncHud();
  };
  $('#bZoom').onclick = () => {
    // 1 → 2 → 3 → 1 …
    const zs = zoomsNow();
    setZoom(zs[(zs.indexOf(S.zoom) + 1) % zs.length]);
  };
  $('#placeNo').onclick = cancelPlace;
  $('#placeRot').onclick = rotatePlacement;
  $('#placeOk').onclick = confirmPlace;
  $('#vLike').onclick = game.likeNeighbor;
  $('#vHome').onclick = game.goHome;
}

/** 마을 아래 원정 진행 바: 나가 있는 파티마다 남은 시간 (누르면 진행 일지 · 끝났으면 보고서) */
let runbarKey = '';
function updateRunbar() {
  const bar = $('#runbar');
  const runs = S.visiting ? [] : PG.runs.filter((r) => !r.claimed).slice(0, CONFIG.expedition.maxParties);
  bar.hidden = !runs.length;
  if (!runs.length) return;
  const now = Date.now();
  const key = runs.map((r) => r.id + (r.result ? 'd' : '')).join(',');
  if (key !== runbarKey) {
    runbarKey = key;
    bar.innerHTML = runs
      .map((r) => `<button class="px" data-rb="${r.id}"><b>${esc(r.quest.name ?? regionById(r.quest.region).name)}</b><i><u></u></i><em></em></button>`)
      .join('');
    bar.querySelectorAll<HTMLElement>('[data-rb]').forEach((b) => (b.onclick = () => openRunLog(PG.runs.find((r) => r.id === +b.dataset.rb!)!)));
  }
  bar.querySelectorAll<HTMLElement>('[data-rb]').forEach((b) => {
    const r = PG.runs.find((x) => x.id === +b.dataset.rb!);
    if (!r) return;
    const done = !!r.result || now >= r.end;
    b.classList.toggle('done', done);
    (b.querySelector('u') as HTMLElement).style.width = `${Math.min(100, ((now - r.start) / Math.max(1, r.end - r.start)) * 100)}%`;
    b.querySelector('em')!.textContent = r.result ? '도착! 보고서' : done ? '돌아오는 중' : clockText(r.end - now);
  });
}
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
    const st = '★' + stars();
    if ($('#starv').textContent !== st) $('#starv').textContent = st;
  }
  if (S.gold !== shownGold) {
    const up = S.gold > shownGold && shownGold >= 0;
    shownGold = S.gold;
    $('#goldv').textContent = fmt(S.gold);
    if (up) {
      const g = $('#gold');
      g.classList.remove('bump');
      void g.offsetWidth;
      g.classList.add('bump');
    }
  }
}
