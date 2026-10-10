// HUD: 위 상태판(이름·금화·날짜), 아래 독(건설·땅·손님·마을·장부), 배치 막대, 배율 버튼
import { def, type Kind } from '../data/catalog';
import { CONFIG } from '../data/config';
import { NEIGHBORS } from '../data/neighbors';
import { P } from '../engine/pixel';
import * as game from '../game';
import { setPref } from '../save/save';
import { setNight } from '../world/daynight';
import { S } from '../world/state';
import { blocksDoor, canPlace, placing, suggestSpot, type Placement } from '../world/town';
import { openNotices } from './notice';
import { openBuild, openGuests, openLand, openLedger, openMenu, openWin, toast } from './windows';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const fmt = (n: number) => n.toLocaleString('ko-KR');

// ───────── 배치 모드 ─────────

function placeText(pl: Placement) {
  $('#placeOk').toggleAttribute('disabled', !pl.ok);
  $('#placeTxt').textContent = pl.tx == null ? '지을 곳을 눌러요' : pl.ok ? `${def(pl.kind).name} · 여기 괜찮아요` : '여기엔 못 지어요';
}

function check(pl: Placement) {
  pl.ok = canPlace(pl) && !blocksDoor(pl);
}

export function startPlace(kind: Kind) {
  const d = def(kind);
  const pl: Placement = { kind, sprite: d.sprite, fw: d.size[0], fh: d.size[1], tx: null, ty: null, ok: false };
  suggestSpot(pl);
  check(pl);
  placing.pl = pl;
  $('#placebar').hidden = false;
  placeText(pl);
  if (pl.tx != null) game.focusTile(pl.tx + pl.fw / 2, pl.ty! + pl.fh / 2);
}

/** 배치 중 탭: 그 자리로 미리보기를 옮긴다 */
export function movePlacement(fx: number, fy: number) {
  const pl = placing.pl;
  if (!pl) return;
  pl.tx = Math.floor(fx - pl.fw / 2 + 0.5);
  pl.ty = Math.floor(fy - pl.fh / 2 + 0.5);
  check(pl);
  placeText(pl);
}

export function cancelPlace() {
  placing.pl = null;
  $('#placebar').hidden = true;
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

function openVillage() {
  if (S.visiting) {
    game.goHome();
    return;
  }
  const liked = game.likedSet();
  openWin(
    '마을 · 이웃 여관',
    `<p class="sub">다른 여관주인의 마을을 구경하고 좋아요를 남겨요</p><div class="steps">${NEIGHBORS.map(
      (v, i) =>
        `<button class="stp" data-v="${i}"><span style="grid-column:1/3"><b>${v.name}</b><small>주인 ${v.owner} · 땅 ${v.land}단계</small></span><em>♥ ${fmt(v.like + (liked.has(v.id) ? 1 : 0))}</em></button>`,
    ).join('')}</div>`,
  );
  document.querySelectorAll<HTMLElement>('.stp').forEach((b) => (b.onclick = () => game.visit(NEIGHBORS[+b.dataset.v!])));
}

// ───────── 배율 ─────────

let onZoom: () => void = () => {};
export function setOnZoom(fn: () => void) {
  onZoom = fn;
}
function zoomLabel() {
  $('#bZoom').textContent = '×' + S.zoom;
}

/** 배율 바꾸기 (버튼·핀치 공용). 정수 배율만 */
export function setZoom(z: number) {
  const zs = CONFIG.view.zooms;
  z = Math.max(zs[0], Math.min(zs[zs.length - 1], Math.round(z)));
  if (z === S.zoom) return;
  S.zoom = z;
  setPref('zoom', z);
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
  $('#bLand').onclick = () => {
    if (S.visiting) return toast('이웃 마을에선 넓힐 수 없어요');
    openLand();
  };
  $('#bGuest').onclick = openGuests;
  $('#bVillage').onclick = openVillage;
  $('#bBook').onclick = openLedger;
  $('#bNotice').onclick = openNotices;
  $('#bMenu').onclick = openMenu;
  $('#bDN').onclick = () => {
    setNight(!S.night);
    game.syncHud();
  };
  $('#bZoom').onclick = () => {
    // 1 → 2 → 3 → 1 …
    const zs = CONFIG.view.zooms;
    setZoom(zs[(zs.indexOf(S.zoom) + 1) % zs.length]);
  };
  $('#placeNo').onclick = cancelPlace;
  $('#placeOk').onclick = () => {
    const pl = placing.pl;
    if (!pl || !pl.ok) return;
    if (game.placeBuilding(pl)) cancelPlace();
  };
  $('#vLike').onclick = game.likeNeighbor;
  $('#vHome').onclick = game.goHome;
}

/** 매 프레임: 금화가 바뀌면 숫자 갱신 + 반짝 */
let shownGold = -1;
export function tickHud() {
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
