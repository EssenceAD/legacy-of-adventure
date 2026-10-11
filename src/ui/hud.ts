// HUD: 위 상태판(이름·금화·날짜), 아래 독(건설·땅·손님·마을·장부), 배치 막대, 배율 버튼
import { sfx } from '../audio/sfx';
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
import { blocksDoor, canPlace, gateOk, grid, inLand, landBounds, placing, suggestSpot, type Placement } from '../world/town';
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
import { saveZoom, zoomsNow } from './screen';
import { tickTimers } from './common';
import { openBuild, openLand, toast, toastHtml } from './windows';
import { talk } from './dialogue';
import { applyTidy, planTidy } from '../world/tidy';
import { openGridMenu } from './menu';
import { achReady, mailWaiting } from '../world/meta';

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
  $('#placeTxt').textContent = `${def(pl.kind).name}${pl.move || pl.prop ? ' 옮기기' : ''} · ${pl.ok ? '여기 괜찮아요' : '여기엔 못 놓아요'}`;
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

export function startPlace(kind: Kind, prop?: string) {
  // 땅 개편 §4: 처음 지을 때만 울타리 안 전체를 연한 초록으로
  landHint.firstBuild = !PG.buildTipSeen;
  const d = def(kind);
  const pl: Placement = { kind, sprite: d.sprite, fw: d.size[0], fh: d.size[1], tx: null, ty: null, ok: false, prop };
  suggestSpot(pl);
  // 베타: 장식은 어울림이 생기는 자리를 먼저 권한다 (아직 못 찾은 어울림이면 더)
  if (d.deco && kind !== 'gate') {
    const best = harmonySpot(pl);
    if (best) [pl.tx, pl.ty] = best;
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
  if (!pl.ok) sfx('place_bad');
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

/** 잠깐만 배율 바꾸기 (마을 등급 연출의 줌아웃 — 저장하지 않는다) */
export function tempZoom(z: number) {
  const zs = zoomsNow();
  z = Math.max(zs[0], Math.min(zs[zs.length - 1], Math.round(z)));
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
    setZoom(zs[(zs.indexOf(S.zoom) + 1) % zs.length]);
  };
  $('#placeNo').onclick = cancelPlace;
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
    // 5단계: 자동 사냥 — 켜 있으면 30초마다 한 판
    // 핫픽스 10 (11-3): 판마다 토스트는 끄고 마을 줄 숫자만 · 장비를 얻었거나 레벨업일 때만 토스트
    const hr = autoTick();
    if (hr && (hr.items.length || hr.levelUps.length)) toastHtml(`<img src="${iconSrc('skill_auto')}" alt=""><span>맡겨 둔 사냥 · 금화 +${fmt(hr.gold)}${hr.items.length ? ` · 장비 ${hr.items.length}` : ''}${hr.levelUps.length ? ` · ${esc(hr.levelUps.join(', '))}` : ''}</span>`);
    const st = '★' + stars();
    if ($('#starv').textContent !== st) $('#starv').textContent = st;
    fitDay();
  }
  if (S.gold !== shownGold) {
    const up = S.gold > shownGold && shownGold >= 0;
    shownGold = S.gold;
    // 핫픽스 9: 100만이 넘으면 「1.2M」로 줄여 상태 카드 줄이 안 갈리게
    $('#goldv').textContent = S.gold >= 1e6 ? (S.gold / 1e6).toFixed(S.gold >= 1e7 ? 0 : 1) + 'M' : fmt(S.gold);
    if (up) {
      const g = $('#gold');
      g.classList.remove('bump');
      void g.offsetWidth;
      g.classList.add('bump');
    }
  }
}
