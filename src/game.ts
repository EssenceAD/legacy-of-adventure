// 게임 진행 동작: 새 게임·이어하기·땅 넓히기·건설·레벨업·지붕 색·이웃 방문·타이틀
import { sfx } from './audio/sfx';
import { def } from './data/catalog';
import { CONFIG } from './data/config';
import { NEIGHBORS, type Neighbor } from './data/neighbors';
import { lookAt, N, sx, sy, view } from './engine/iso';
import { readSave, writeSave, getPref, setPref, type SaveData } from './save/save';
import { addOwner, addPostman, hideRunners, leave, spawnExtras, spawnStart } from './world/actors';
import { blankActor } from './world/adventurers';
import { hourNow, settleNight } from './world/clock';
import { clearEvents, queueEvent } from './world/events';
import { ensureQuests } from './world/expeditions';
import { clearBubbles, clearParts, floatW, puff, puffAt } from './world/fx';
import { itemById } from './world/items';
import { computeOffline } from './world/offline';
import { ensureGoals, stars, track } from './world/progress';
import { clearJobs, later, markDirty, P, resetProgress, S, world, type Building } from './world/state';
import { addObj, astar, doorOf, findKind, landBounds, neighborTown, nextLevelCost, placeLayout, rebuildPaths, startTown, upgradeObj, type Placement } from './world/town';
import { talk } from './ui/dialogue';
import { openCreate, openingFor, syncOwnerButton } from './ui/owner';
import { sanitizeAlbum, sanitizeOwner } from './world/owner';
import { gradeName } from './world/grade';
import { likeReal } from './ui/neighbors';
import { refreshNoticeDot } from './ui/notice';
import { closeWin, toast } from './ui/windows';
import { maybeShowPatchCard } from './ui/update';
import { track as trackEv } from './net/telemetry';
import { refundOf, removeBuilding } from './world/demolish';

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
  clearEvents();
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
    spawnExtras();
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
  S.clock = 0;
  for (const k of Object.keys(S.ledger) as (keyof typeof S.ledger)[]) S.ledger[k] = 0;
  // 엔딩 앨범은 새 여관을 열어도 남긴다 (유산 보너스·세대·앞 주인은 처음부터)
  const album = { album: [...P.legacy.album], cards: { ...P.legacy.cards } };
  resetProgress();
  Object.assign(P.legacy, album);
  startTown();
  rebuildPaths();
  spawnStart();
  // 노주인 버나드가 여관 문 앞에 서 있다
  const inn = findKind('inn')!;
  const d = doorOf(inn);
  const keeper = blankActor('keeper', '버나드', d[0] - 0.6, d[1] + 0.4, 'keeper');
  world.actors.push(keeper);
  resetCamera();
  S.started = false;
  S.night = true;
  S.nightT = 1;
  showHud(false);
  // 4단계: 「당신은 누구였나요?」 → 출신 컷 → 오프닝(버나드가 출신을 알아본다) → 여관 이름
  openCreate('new', () => talk(openingFor(), () => {
    S.started = true;
    showHud(true);
    // 1일차 06:00부터
    S.day = 1;
    S.clock = 0;
    settleNight();
    S.nightT = 1;
    P.lastSeen = Date.now();
    ensureQuests();
    ensureGoals();
    for (const a of world.actors) if (a.st === 'in') leave(a);
    keeperExit(keeper);
    addOwner();
    // 첫 원정 안내: 원정 버튼이 반짝이고, 30초짜리 「숲 입구 정찰」이 기다린다
    queueEvent(() =>
      talk([
        ['me', '단골들이 몸이 근질근질한가 봐. 첫 원정을 보내 볼까?'],
        ['narr', '아래 「원정」 → ★ 숲 입구 정찰 (30초 · 희귀 장비 확정)'],
      ]),
    );
    syncOwnerButton();
    syncHud();
    writeSave();
    setTimeout(refreshNoticeDot, 1500);
  }));
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
  resetCamera();
  showHud(true);
  ensureQuests();
  ensureGoals();
  // 꺼져 있던 동안: 끝난 원정은 마을로 돌아와 있고, 요약 창을 띄운다
  const off = computeOffline();
  const after = () => {
    if (off) offlineHook(off);
    syncOwnerButton();
    syncHud();
    refreshNoticeDot();
    // 업데이트 후 첫 화면: 패치노트 카드 한 번
    setTimeout(() => void maybeShowPatchCard(), 1200);
  };
  // 4단계 전 저장: 한 번만 「당신은 누구였나요?」 (마을·진행은 그대로)
  if (!P.owner) openCreate('existing', after);
  else after();
}

/** 방치 요약 창 (ui가 채운다) */
let offlineHook: (s: NonNullable<ReturnType<typeof computeOffline>>) => void = () => {};
export function setOfflineHook(fn: typeof offlineHook) {
  offlineHook = fn;
}

/** 저장 → 마을 */
function applySave(d: SaveData) {
  S.land = d.land;
  S.gold = d.gold;
  S.day = d.day;
  S.clock = d.clock;
  settleNight();
  S.innName = d.innName;
  Object.assign(S.ledger, d.ledger);
  resetProgress(d.progress);
  sanitizeOwner();
  sanitizeAlbum();
  // 저장이 어긋나 있어도(겹침·땅 밖) 같은 배치 검사로 바로잡아 그린다
  const fix = placeLayout(
    d.buildings.map((b) => ({ kind: b.kind, tx: b.tx, ty: b.ty, lvl: b.lvl, hue: b.hue, flip: !!b.flip, extra: { ...(b.plots ? { plots: b.plots } : {}), ...(b.builtAt ? { builtAt: b.builtAt } : {}), ...(b.fromProp ? { fromProp: true } : {}) } })),
    d.land,
  );
  // 핫픽스 10: 예전 저장은 「마을 등급 장식을 옮겨 놓은 것」 표시가 없다 → 옮긴 기록(종류별 개수)으로 추정
  const movedKinds = P.harmony.moved.map((k) => k.split('@')[0]);
  for (const k of new Set(movedKinds)) {
    let n = movedKinds.filter((x) => x === k).length - world.objs.filter((o) => o.kind === k && o.fromProp).length;
    for (const o of world.objs) if (n > 0 && o.kind === k && !o.fromProp && !o.builtAt) (o.fromProp = true), n--;
  }
  if (import.meta.env.DEV && (fix.moved || fix.dropped)) console.warn('저장 배치 바로잡음', fix);
  rebuildPaths();
  world.actors = d.adventurers.map((a) => Object.assign(blankActor(a.kind, a.name, a.x, a.y), a));
  // 장비 주인 표시를 손님 쪽 기록에 맞춘다
  for (const it of P.bag) it.owner = null;
  for (const a of world.actors)
    for (const s of ['weapon', 'armor', 'acc'] as const) {
      const it = itemById(a.equip[s]);
      if (it) it.owner = a.id;
      else a.equip[s] = null;
    }
  // 원정 기록에 없는 runId는 지운다
  for (const a of world.actors) if (a.runId != null && !P.runs.some((r) => r.id === a.runId && !r.result)) a.runId = null;
  hideRunners();
  addPostman();
  addOwner();
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
  talk(openingFor(), () => {
    syncHud();
    markDirty();
  });
}

// ───────── 땅 ─────────

export function expandLand(l: number) {
  const cost = CONFIG.land[l - 1].cost;
  const need = CONFIG.landStars[l - 1] ?? 0;
  if (stars() < need) return toast(`평판 ★${need}이 필요해요`);
  if (S.gold < cost) return toast('금화가 모자라요');
  S.gold -= cost;
  S.land = l;
  trackEv('land_up', { lv: l });
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
  // 베타: 마을 등급 장식을 마을 안으로 옮기면 무료 (그 자리 장식은 사라진다)
  const cost = pl.prop ? 0 : d.cost;
  if (S.gold < cost) {
    toast('금화가 모자라요');
    return false;
  }
  S.gold -= cost;
  if (pl.prop) P.harmony.moved.push(pl.prop);
  const o = addObj(pl.kind, pl.tx!, pl.ty!, { build: CONFIG.build.constructSeconds, flip: !!pl.flip, builtAt: Date.now(), ...(pl.prop ? { fromProp: true } : {}) });
  trackEv('build', { kind: pl.kind });
  if (pl.kind === 'fire') track('buildFire');
  sfx('build');
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
    markDirty();
  });
  return true;
}

export function upgrade(o: Building) {
  const cost = nextLevelCost(o);
  if (cost == null) return;
  if (S.gold < cost) return toast('금화가 모자라요');
  if (!upgradeObj(o)) return toast('뒤쪽에 자리가 없어요 · 1칸 비워주세요');
  S.gold -= cost;
  closeWin();
  rebuildPaths();
  o.pop = 1;
  puffAt(o, '#fff3b0', 20);
  floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 70, `${def(o.kind).name} Lv.${o.lvl}!`, 'big');
  markDirty();
}

/** 핫픽스 10: 철거 — 손님 꺼내기 · 길 다시 · 환불 · 먼지 · 「털썩」 · 기록 */
export function demolish(o: Building): boolean {
  const { gold } = refundOf(o);
  const ageSec = o.builtAt ? Math.round((Date.now() - o.builtAt) / 1000) : -1;
  const { kind, lvl } = o;
  // 먼지·글자는 지우기 전에 자리 잡기
  puffAt(o, '#c9bfa8', 20);
  const cx = o.tx + o.fw / 2;
  const cy = o.ty + o.fh / 2;
  if (!removeBuilding(o, !!S.visiting)) return false;
  S.gold += gold;
  floatW(cx, cy, 40, `철거 완료 +💰${fmt(gold)}`, 'big');
  sfx('demolish');
  trackEv('demolish', { kind, lvl, refund: gold, ageSec });
  syncHud();
  return true;
}

/** 지은 건물 옮기기·방향 바꾸기 (무료). 안에 있던 손님은 새 문 앞으로 나온다 */
export function moveBuilding(pl: Placement): boolean {
  const o = pl.move;
  if (!o || pl.tx == null || pl.ty == null) return false;
  const inside = [...o.inside];
  o.inside = [];
  for (const a of world.actors) if (a.door?.o === o) a.door = null;
  Object.assign(o, { tx: pl.tx, ty: pl.ty, flip: !!pl.flip, sprite: pl.sprite, pop: 1 });
  rebuildPaths();
  const d = doorOf(o);
  for (const a of inside) Object.assign(a, { hidden: false, at: null, x: d[0], y: d[1], st: 'idle', t: 0.3, pop: 0.4 });
  for (const a of world.actors) if (a.door === null && a.st === 'door') Object.assign(a, { st: 'idle', t: 0.3 });
  puffAt(o, '#fff3b0', 12);
  sfx('build');
  floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 40, '쿵!', 'big');
  markDirty();
  return true;
}

export function setRoof(o: Building, hue: number | null) {
  if (o.hue !== hue) track('roof');
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
    spawnExtras();
    resetCamera();
    // 핫픽스 9: 방문 중엔 내 마을 HUD를 숨기고 방문 전용 HUD (위 카드 1장 · 아래 「← 내 마을로」 「다음 이웃 ›」)
    document.body.classList.add('visiting');
    $('#visitbar').hidden = false;
    $('#visitfoot').hidden = false;
    $('#vName').textContent = v.name;
    $('#vSub').textContent = `${v.title ? `「${v.title}」 ` : ''}주인 ${v.owner} · 마을 등급 ${gradeName(v.grade ?? Math.max(0, v.land - 1))}`;
    updateLike();
    $('#bVillage .lbl').textContent = '돌아가기';
  });
}

/** 핫픽스 9: 「다음 이웃 ›」 차례 (이웃 목록 창이 채운다) */
let visitList: Neighbor[] = [];
export const setVisitList = (l: Neighbor[]) => (visitList = l);
export function nextNeighbor() {
  const v = S.visiting;
  const list = visitList.length ? visitList : NEIGHBORS;
  const i = v ? list.findIndex((x) => x.id === v.id && x.uid === v.uid) : -1;
  visit(list[(i + 1) % list.length]);
}

export function updateLike() {
  const v = S.visiting;
  if (!v) return;
  const liked = !v.uid && likedSet().has(v.id);
  $('#vLike').textContent = `♥ ${fmt(v.like + (liked ? 1 : 0))}`;
}

export async function likeNeighbor() {
  const v = S.visiting;
  if (!v) return;
  // 실제 유저 마을: 서버 (마을당 하루 한 번)
  if (v.uid) {
    if (await likeReal(v)) floatW(N / 2, N / 2 - 1, 60, '♥ 좋아요!', 'heart');
    updateLike();
    return;
  }
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
    $('#visitfoot').hidden = true;
    document.body.classList.remove('visiting');
    $('#bVillage .lbl').textContent = '마을';
  });
}

// ───────── HUD ─────────

export function syncHud() {
  $('#innv').textContent = S.innName || '여관';
  $('#dayv').textContent = `${S.day}일차 ${String(hourNow()).padStart(2, '0')}시`;
  $('#starv').textContent = '★' + stars();
  // 핫픽스 7: 아이콘 + 짧은 글자 (누르면 바뀌는 쪽을 보여 준다)
  $('#bDNi').textContent = S.night ? '☀' : '☾';
  $('#bDNl').textContent = S.night ? '낮' : '밤';
}

/** 배치 모드 시작 시 카메라를 그 자리로 */
export function focusTile(x: number, y: number) {
  lookAt(x, y);
}
