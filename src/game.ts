// 게임 진행 동작: 새 게임·이어하기·땅 넓히기·건설·레벨업·지붕 색·이웃 방문·타이틀
import { def } from './data/catalog';
import { CONFIG } from './data/config';
import { NEIGHBORS, type Neighbor } from './data/neighbors';
import { lookAt, N, sx, sy, view } from './engine/iso';
import { readSave, writeSave, getPref, setPref, type SaveData } from './save/save';
import { addPostman, fillGuests, leave, mkA, spawnActors } from './world/actors';
import { resetDayNightClock, setNight } from './world/daynight';
import { clearBubbles, clearParts, floatW, puff, puffAt } from './world/fx';
import { clearJobs, later, markDirty, S, world, type Building } from './world/state';
import { addObj, astar, doorOf, findKind, landBounds, neighborTown, rebuildPaths, startTown, upgradeObj, type Placement } from './world/town';
import { OPENING, talk } from './ui/dialogue';
import { refreshNoticeDot } from './ui/notice';
import { closeWin, toast } from './ui/windows';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const fmt = (n: number) => n.toLocaleString('ko-KR');

function resetCamera() {
  view.cam.x = 0;
  view.cam.y = 0;
}

function showHud(v: boolean) {
  $('#hud').hidden = !v;
}

function hideTitle() {
  const t = $('#title');
  t.classList.add('out');
  setTimeout(() => (t.hidden = true), 600);
}

/** 화면 정리 (마을을 통째로 바꿀 때) */
function resetScene() {
  clearJobs();
  clearBubbles();
  clearParts();
  closeWin();
  world.home = null;
  S.visiting = null;
  $('#visitbar').hidden = true;
  $('#bVillage .lbl').textContent = '마을';
}

// ───────── 타이틀 뒤 배경 마을 ─────────

/** 타이틀 뒤에 보여 줄 마을: 저장이 있으면 내 마을, 없으면 이웃 마을 하나 (밤) */
export function titleBackdrop() {
  resetScene();
  const save = readSave();
  if (save) applySave(save);
  else {
    S.land = 5;
    neighborTown(NEIGHBORS[1]);
    rebuildPaths();
    spawnActors();
  }
  S.started = false;
  S.night = true;
  S.nightT = 1;
  resetCamera();
  view.cam.y = 20;
}

// ───────── 새 게임 / 이어하기 ─────────

export function newGame() {
  hideTitle();
  resetScene();
  S.land = 1;
  S.gold = CONFIG.economy.startGold;
  S.day = 1;
  S.innName = '';
  for (const k of Object.keys(S.ledger) as (keyof typeof S.ledger)[]) S.ledger[k] = 0;
  startTown();
  rebuildPaths();
  spawnActors();
  // 노주인 버나드가 여관 문 앞에 서 있다
  const inn = findKind('inn')!;
  const d = doorOf(inn);
  const keeper = mkA('keeper', '버나드', d[0] - 0.6, d[1] + 0.4, 'keeper');
  world.actors.push(keeper);
  resetCamera();
  S.started = false;
  S.night = true;
  S.nightT = 1;
  showHud(false);
  talk(OPENING, () => {
    S.started = true;
    showHud(true);
    setNight(false);
    S.day = 1;
    resetDayNightClock();
    for (const a of world.actors) if (a.st === 'in') leave(a);
    keeperExit(keeper);
    syncHud();
    writeSave();
    setTimeout(refreshNoticeDot, 1500);
  });
}

/** 노주인 퇴장: 마을 앞쪽 끝까지 걸어가 사라진다 */
function keeperExit(k: (typeof world.actors)[number]) {
  const [a, b] = landBounds();
  const p = astar(k.x, k.y, a, b - 1);
  const vanish = () => {
    puff(sx(k.x, k.y), sy(k.x, k.y), '#efe2c6', 0, -10, 0.8, 3);
    k.fading = 1;
  };
  if (!p) return vanish();
  k.path = p;
  k.st = 'walk';
  k.then = vanish;
}

export function continueGame() {
  const save = readSave();
  if (!save) return;
  hideTitle();
  resetScene();
  applySave(save);
  S.started = true;
  S.nightT = S.night ? 1 : 0;
  resetDayNightClock();
  resetCamera();
  showHud(true);
  syncHud();
  refreshNoticeDot();
}

/** 저장 → 마을 */
function applySave(d: SaveData) {
  S.land = d.land;
  S.gold = d.gold;
  S.day = d.day;
  S.night = d.night;
  S.innName = d.innName;
  Object.assign(S.ledger, d.ledger);
  world.objs = [];
  for (const b of d.buildings) {
    const o = addObj(b.kind, b.tx, b.ty, { hue: b.hue });
    const up = def(b.kind).up;
    if (b.lvl > 1 && up) Object.assign(o, { fw: up.size[0], fh: up.size[1], sprite: up.sprite, lvl: b.lvl });
  }
  rebuildPaths();
  world.actors = d.adventurers.map((a) => {
    const x = mkA(a.kind as 'knight', a.name, a.x, a.y);
    Object.assign(x, { lvl: a.lvl, hp: a.hp, food: a.food, mood: a.mood });
    return x;
  });
  fillGuests();
  addPostman();
}

export function toTitle() {
  writeSave();
  resetScene();
  showHud(false);
  const t = $('#title');
  t.hidden = false;
  t.classList.remove('out');
  refreshTitle();
  titleBackdrop();
}

export function refreshTitle() {
  const save = readSave();
  const b = $<HTMLButtonElement>('#tCont');
  b.disabled = !save;
  $('#tContSub').textContent = save ? `${save.innName || '내 여관'} · ${save.day}일차` : '저장된 마을이 없어요';
}

/** 메뉴의 "오프닝 다시 보기": 마을은 그대로, 대사만 다시 (이름은 바꿀 수 있다) */
export function replayOpening() {
  talk(OPENING, () => {
    syncHud();
    markDirty();
  });
}

// ───────── 땅 ─────────

export function expandLand(l: number) {
  const cost = CONFIG.land[l - 1].cost;
  if (S.gold < cost) return toast('금화가 모자라요');
  S.gold -= cost;
  S.land = l;
  rebuildPaths();
  // 울타리를 따라 먼지
  const [a, b] = landBounds();
  for (let i = 0; i < 40; i++) {
    const t = Math.random();
    const side = (Math.random() * 4) | 0;
    const [x, y] = side === 0 ? [a + t * (b - a), a] : side === 1 ? [a, a + t * (b - a)] : side === 2 ? [a + t * (b - a), b] : [b, a + t * (b - a)];
    puff(sx(x, y), sy(x, y), '#efe2c6', (Math.random() - 0.5) * 30, -10 - Math.random() * 15, 1, 3);
  }
  floatW(N / 2, N / 2, 40, '땅이 넓어졌어요!', 'big');
  toast(`${l}단계 · ${CONFIG.land[l - 1].size} — ${CONFIG.land[l - 1].opens}`);
  markDirty();
}

// ───────── 건설 ─────────

export function placeBuilding(pl: Placement): boolean {
  const d = def(pl.kind);
  if (S.gold < d.cost) {
    toast('금화가 모자라요');
    return false;
  }
  S.gold -= d.cost;
  const o = addObj(pl.kind, pl.tx!, pl.ty!, { build: CONFIG.build.constructSeconds });
  rebuildPaths();
  floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 40, '뚝딱뚝딱!', 'big');
  markDirty();
  later(CONFIG.build.constructSeconds, () => {
    if (!world.objs.includes(o)) return;
    o.build = undefined;
    o.pop = 1;
    puffAt(o, '#fff3b0', 14);
    floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 50, d.name + ' 완성!', 'big');
    rebuildPaths();
    if (d.act === 'sleep') fillGuests();
    markDirty();
  });
  return true;
}

export function upgrade(o: Building) {
  const up = def(o.kind).up;
  if (!up) return;
  if (S.gold < up.cost) return toast('금화가 모자라요');
  if (!upgradeObj(o)) return toast('뒤쪽에 자리가 없어요 · 1칸 비워주세요');
  S.gold -= up.cost;
  closeWin();
  rebuildPaths();
  o.pop = 1;
  puffAt(o, '#fff3b0', 20);
  floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 70, `${def(o.kind).name} Lv.${o.lvl}!`, 'big');
  if (o.kind === 'inn') fillGuests();
  markDirty();
}

export function setRoof(o: Building, hue: number | null) {
  o.hue = hue;
  o.pop = 0.6;
  puffAt(o, '#fff3b0', 8);
  markDirty();
}

// ───────── 이웃 마을 ─────────

export function likedSet(): Set<string> {
  return new Set(getPref<string[]>('liked', []));
}

function fade(fn: () => void) {
  const f = $('#fade');
  f.classList.add('on');
  setTimeout(() => {
    fn();
    f.classList.remove('on');
  }, 350);
}

export function visit(v: Neighbor) {
  closeWin();
  fade(() => {
    if (!S.visiting) world.home = { objs: world.objs, actors: world.actors, land: S.land };
    clearBubbles();
    S.visiting = v;
    neighborTown(v);
    rebuildPaths();
    spawnActors();
    resetCamera();
    $('#visitbar').hidden = false;
    $('#vName').textContent = `${v.name} · ${v.owner}`;
    updateLike();
    $('#bVillage .lbl').textContent = '돌아가기';
  });
}

export function updateLike() {
  const v = S.visiting;
  if (!v) return;
  const liked = likedSet().has(v.id);
  $('#vLike').textContent = `♥ ${fmt(v.like + (liked ? 1 : 0))}`;
}

export function likeNeighbor() {
  const v = S.visiting;
  if (!v) return;
  const set = likedSet();
  if (set.has(v.id)) return toast('이미 좋아요를 남겼어요');
  set.add(v.id);
  setPref('liked', [...set]);
  updateLike();
  floatW(N / 2, N / 2 - 1, 60, '♥ 좋아요!', 'heart');
}

export function goHome() {
  if (!S.visiting || !world.home) return;
  fade(() => {
    clearBubbles();
    S.visiting = null;
    world.objs = world.home!.objs;
    world.actors = world.home!.actors;
    S.land = world.home!.land;
    world.home = null;
    rebuildPaths();
    resetCamera();
    $('#visitbar').hidden = true;
    $('#bVillage .lbl').textContent = '마을';
  });
}

// ───────── HUD ─────────

export function syncHud() {
  $('#innv').textContent = S.innName || '여관';
  $('#dayv').textContent = `${S.day}일차 · ${S.night ? '밤' : '낮'}`;
  $('#bDN').textContent = S.night ? '☀' : '☾';
}

/** 배치 모드 시작 시 카메라를 그 자리로 */
export function focusTile(x: number, y: number) {
  lookAt(x, y);
}
