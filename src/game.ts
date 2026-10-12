// 게임 진행 동작: 새 게임·이어하기·땅 넓히기·건설·레벨업·지붕 색·이웃 방문·타이틀
import { sfx } from './audio/sfx';
import { landWhy, payLand } from './world/landreq';
import { decoCoupon, useDecoCoupon } from './world/easter';
import { clearOverlays } from './ui/overlays';
import { isDropKind, newAtLand, noteBought, ownedDrops } from './world/decodrop';
import { funnel } from './net/funnel';
import { createPendingOwner } from './world/owner';
import { talkTagged } from './ui/dialogue';
import { migrateOnboarding } from './world/guide';
import { migrateChemNotice } from './world/chemNews';
import { initStory } from './world/story';
import { repairRaidTries } from './world/raid';
import { def, type Kind } from './data/catalog';
import { CONFIG } from './data/config';
import { NEIGHBORS, type Neighbor } from './data/neighbors';
import { camFor, lookAt, sx, sy, view } from './engine/iso';
import { readSave, writeSave, getPref, setPref, type SaveData } from './save/save';
import { addOwner, addPostman, afterLayoutChange, hideRunners, leave, spawnExtras, spawnStart } from './world/actors';
import { blankActor } from './world/adventurers';
import { settleNight } from './world/clock';
import { clearEvents, queueEvent } from './world/events';
import { ensureQuests } from './world/expeditions';
import { clearBubbles, clearParts, floatW, puff, puffAt } from './world/fx';
import { ground } from './world/ground';
import { startFelling } from './world/felling';
import { landHint } from './world/render';
import { itemById } from './world/items';
import { computeOffline } from './world/offline';
import { fitDay } from './ui/dayfit';
import { ensureGoals, stars, track } from './world/progress';
import { clearJobs, later, markDirty, P, resetProgress, S, uiHooks, world, type Building } from './world/state';
import { addObj, astar, blocksDoor, buildCost, canPlace, countKind, maxCopies, MULTI, SINGLE, doorOf, findKind, inLand, landBounds, landNeedFor, sizeFor, neighborTown, nextLevelCost, placeLayout, rebuildPaths, startTown, type Placement } from './world/town';
import { conHooks, conSlots, slotFree, startNew, startUp, tickCons, type Con } from './world/construct';
import { talk } from './ui/dialogue';
import { openCreate, openingFor, openingShort, syncOwnerButton } from './ui/owner';
import { sanitizeAlbum, sanitizeOwner } from './world/owner';
import { sanitizeRegions2 } from './world/regions2';
import { gradeName } from './world/grade';
import { likeReal } from './ui/neighbors';
import { refreshNoticeDot } from './ui/notice';
import { closeWin, isWinOpen, toast } from './ui/windows';
import { maybeShowPatchCard } from './ui/update';
import { track as trackEv } from './net/telemetry';
import { refundOf, removeBuilding, spentOn } from './world/demolish';
import { addMail } from './world/meta';
declare const __APP_VERSION__: string;
const APP_VER = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const fmt = (n: number) => n.toLocaleString('ko-KR');

function resetCamera() {
  landCamera(false);
}

/** 땅 개편 §5: 카메라 = 지금 땅 가운데 · 배율은 땅이 화면 짧은 변의 70~80% (넓히면 한 단계 멀어짐, 부드럽게 이동) */
export const camHooks = { fit: (_expand: boolean) => {} };
export function landCamera(expand = false) {
  const [a, b] = landBounds();
  const m = (a + b) / 2;
  view.focus = { m, size: b - a };
  const g = camFor(m);
  if (expand) view.goal = g;
  else {
    view.cam.x = g.x;
    view.cam.y = g.y;
    view.goal = null;
  }
  camHooks.fit(expand);
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
  // 핫픽스 10 §15: 새 여관은 옛 저장 구제 대상이 아니다
  P.fastRescued = true;
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
  // ONBOARDING §1: 기본 주인으로 바로 — 오프닝 3줄 → 여관 이름 → 마을 (「당신은 누구였나요?」는 장부 1장 뒤)
  createPendingOwner();
  funnel('opening_start');
  talkTagged('opening', openingShort(), () => {
    funnel('opening_end');
    funnel('inn_named', { custom: !['별빛', '달빛', '솔바람', '들꽃', '은하수', '모닥불', '바람결', '이슬', '햇살', '오솔길', '구름', '꽃마루'].includes(S.innName.replace(/\s*여관$/, '')) });
    S.started = true;
    showHud(true);
    // 1일차 06:00부터
    S.day = 1;
    S.clock = 0;
    // STORY_V1: 1막부터
    initStory(true);
    settleNight();
    S.nightT = 1;
    P.lastSeen = Date.now();
    ensureQuests();
    ensureGoals();
    for (const a of world.actors) if (a.st === 'in') leave(a);
    keeperExit(keeper);
    addOwner();
    // 땅 개편 §4: 울타리를 따라 반짝이는 점이 한 바퀴
    landHint.fenceUntil = performance.now() + 2600;
    // ONBOARDING §2: 장부 1장 컷은 건너뛰고 바로 첫 손님 → 체크인 · 모닥불 · 30초 의뢰 (손가락 가이드)
    P.guide.cut = 1;
    funnel('village_first');
    onboardHooks.start();
    syncOwnerButton();
    syncHud();
    writeSave();
    setTimeout(refreshNoticeDot, 1500);
  });
}

/** ONBOARDING §2: 첫 손님·손가락 가이드 (ui/onboard가 채운다) */
export const onboardHooks = { start: () => {}, resume: () => {} };

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
  // STORY_V1: 옛 저장은 진행도로 막 추정 · 유산 포인트·기억 채우기
  initStory(false);
  // ONBOARDING: 장부 1장 개편 — 예전 저장의 임무 번호 맞추기
  migrateOnboarding();
  // ONBOARDING §4·§5: 이틀째 선물 · 두 번째 세션부터 홈 화면에 추가 편지
  onboardHooks.resume();
  // HOTFIX17 §2: 토벌 도전 횟수 오류 복구 (오늘 횟수 한 번 돌려주기)
  repairRaidTries();
  // HOTFIX18 §3: 케미 알림 「전부」 → 「중요만」 (한 번)
  if (migrateChemNotice()) setTimeout(() => toast('케미 알림을 「중요만」으로 바꿨어요 · 설정에서 다시 켤 수 있어요'), 4000);
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
    // 핫픽스 10 §13: 접어 둔 사냥이 있으면 결과를 계산해 바로 보여 준다
    setTimeout(() => resumeHooks.folded(), 400);
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

/** 이어하기 뒤 할 일 (ui가 채운다) */
export const resumeHooks = { folded: () => {} };

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
  // REGIONS2: 새 지역 칸 · 길잡이 별 기록 (있는 값은 그대로)
  sanitizeRegions2();
  // 저장이 어긋나 있어도(겹침·땅 밖) 같은 배치 검사로 바로잡아 그린다
  const fix = placeLayout(
    d.buildings.map((b) => ({ kind: b.kind, tx: b.tx, ty: b.ty, lvl: b.lvl, hue: b.hue, flip: !!b.flip, extra: { ...(b.plots ? { plots: b.plots } : {}), ...(b.builtAt ? { builtAt: b.builtAt } : {}), ...(b.fromProp ? { fromProp: true } : {}), ...(b.paid ? { paid: b.paid } : {}), ...conExtra(b) } })),
    d.land,
  );
  // 핫픽스 10: 예전 저장은 「마을 등급 장식을 옮겨 놓은 것」 표시가 없다 → 옮긴 기록(종류별 개수)으로 추정
  const movedKinds = P.harmony.moved.map((k) => k.split('@')[0]);
  for (const k of new Set(movedKinds)) {
    let n = movedKinds.filter((x) => x === k).length - world.objs.filter((o) => o.kind === k && o.fromProp).length;
    for (const o of world.objs) if (n > 0 && o.kind === k && !o.fromProp && !o.builtAt) (o.fromProp = true), n--;
  }
  if (import.meta.env.DEV && (fix.moved || fix.dropped)) console.warn('저장 배치 바로잡음', fix);
  // HOTFIX14 §1: 정리된 건물은 전액 환불 (건설비 + 낸 레벨업 비용 + 진행 중 업그레이드 공사비) + 사과 금화 · 운영에서도 기록
  if (fix.moved || fix.dropped) trackEv('layout_fix', { moved: fix.moved, dropped: fix.dropped, kinds: fix.removed.map((r) => `${r.e.kind}:${r.e.lvl}:${r.why}`).slice(0, 12), ver: APP_VER });
  if (fix.removed.length) refundRemoved(fix.removed.map((r) => r.e));
  sorryForDupes();
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
  // ONBOARDING §1: 처음이면 [시작하기] 한 번에
  const st = document.getElementById('tStart');
  if (st) st.innerHTML = save ? '새 여관 열기<small>처음부터 다시</small>' : '시작하기<small>바로 내 여관으로</small>';
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
  // LAND2: 금화 · 재료 · 보스 재료 · 평판 · 장부 장
  const why = landWhy(l);
  if (why) return toast(why);
  payLand(l);
  // 땅 개편 §3: 새 범위 안의 나무를 기억해 두었다가 쓰러뜨린다 (바닥을 다시 그리면 사라지니까)
  const [oldA] = landBounds();
  const fallen = ground.wild.filter((w) => inLand(w.x, w.y, l) && !inLand(w.x, w.y));
  S.land = l;
  trackEv('land_up', { lv: l });
  rebuildPaths();
  startFelling(fallen, oldA);
  sfx('build');
  // 처음 2단계로 넓혔을 때 모모 한마디
  // DECO_DROP §1: 새 장식이 들어왔다고 모모가 (건설 버튼엔 NEW)
  const nd = newAtLand(l);
  const ndLine: [string, string][] = nd ? [['post', `새 장식 ${nd}개가 들어왔어요! 건설 → 장식에서 봐요 🌷`]] : [];
  if (l === 2) later(2.3, () => uiHooks.talk([['post', '봐요, 숲이 땅이 됐어요! 다음은 ★2 모으면!'], ...ndLine]));
  else if (nd) later(2.3, () => uiHooks.talk(ndLine));
  landCamera(true);
  // 울타리를 따라 먼지
  const [a, b] = landBounds();
  for (let i = 0; i < 40; i++) {
    const t = Math.random();
    const side = (Math.random() * 4) | 0;
    const [x, y] = side === 0 ? [a + t * (b - a), a] : side === 1 ? [a, a + t * (b - a)] : side === 2 ? [a + t * (b - a), b] : [b, a + t * (b - a)];
    puff(sx(x, y), sy(x, y), '#efe2c6', (Math.random() - 0.5) * 30, -10 - Math.random() * 15, 1, 3);
  }
  { const [a, b] = landBounds(); floatW((a + b) / 2, (a + b) / 2, 40, '땅이 넓어졌어요!', 'big'); }
  toast(`${l}단계 · ${CONFIG.land[l - 1].size} — ${CONFIG.land[l - 1].opens}`);
  markDirty();
}

// ───────── 건설 ─────────

/** HOTFIX14 §5: 같은 건물 2채 이상이 저장에 있는 유저 — 예전 버전에서 하나를 잃었을 수 있다 → 사과 금화 (한 번) */
function sorryForDupes() {
  if (P.meta.sorryDupe) return;
  // HOTFIX18 §1: 업데이트 전부터 있던 중복만 (지은 시각이 없으면 예전 건물) — 그 뒤 새로 지은 두 번째 채엔 사과하지 않는다
  const old = (o: Building) => !o.builtAt || o.builtAt < CONFIG.gifts.sorryBefore;
  const kinds = [...new Set(world.objs.map((o) => o.kind))].filter((k) => !MULTI(k) && !SINGLE(k) && world.objs.filter((o) => o.kind === k && old(o)).length >= 2);
  const named = CONFIG.gifts.sorryInns.includes(S.innName);
  // 한 번 확인하면 끝 (나중에 두 번째 채를 지어도 다시 묻지 않는다)
  P.meta.sorryDupe = true;
  if (!kinds.length && !named) return;
  addMail({
    from: 'system',
    title: '모모의 편지 · 사라진 건물 미안해요',
    body: `같은 건물${kinds.length ? `(${kinds.map((k) => def(k).name).join('·')})` : ''}을 두 채 지으셨죠? 예전 버전에서는 다시 열 때 하나가 사라지는 일이 있었어요. 이제는 여러 채 그대로 남아요! 불편을 드려서 미안해요 — 작은 사과를 담았어요.`,
    reward: { gold: CONFIG.gifts.sorryGold },
  });
  trackEv('sorry_dupe', { kinds: kinds.join(',') });
}

/** HOTFIX14 §1: 불러올 때 정말 정리된 건물(놓을 자리 없음 · 여관 본관/던전 중복) — 전액 환불 편지 (+ 사과 금화 1,000) */
function refundRemoved(list: { kind: Kind; lvl: number; extra?: Partial<Building> }[]) {
  let gold = 0;
  for (const e of list) {
    if (e.extra?.fromProp) continue;
    gold += spentOn({ kind: e.kind, lvl: e.lvl, paid: e.extra?.paid } as Building) + (e.extra?.con?.kind === 'up' ? e.extra.con.cost : 0);
  }
  const names = [...new Set(list.map((e) => def(e.kind).name))].join('·');
  addMail({
    from: 'system',
    title: '모모의 편지 · 건물 정리 환불',
    body: `놓을 자리가 없던 건물(${names})을 정리하고 ${fmt(gold)}골드 돌려드렸어요. 불편을 드려서 미안해요 — 사과의 뜻으로 1,000골드를 더 넣었어요!`,
    reward: { gold: gold + CONFIG.gifts.sorryGold },
  });
  queueEvent(() => toast('우편함에 모모 편지가 왔어요 · 건물 정리 환불'), 'layoutRefund');
}

/** CONSTRUCTION_SPEC §6: 저장된 공사 → 건물 칸 (새 짓기는 아직 못 쓰는 상태, 커지는 업그레이드는 새 발판) */
function conExtra(b: { kind: Kind; con?: Con }): Partial<Building> {
  const c = b.con;
  if (!c) return {};
  if (c.kind === 'new') return { con: { ...c }, build: 1 };
  const [fw, fh] = sizeFor(b.kind, c.to);
  return { con: { ...c }, ...(c.from ? { fw, fh } : {}) };
}

export function placeBuilding(pl: Placement): boolean {
  const d = def(pl.kind);
  // 베타: 마을 등급 장식을 마을 안으로 옮기면 무료 (그 자리 장식은 사라진다)
  // HOTFIX14 §1: 같은 건물 두 번째 채부터 비용 ↑ (CONFIG.town.copyCost)
  // EASTER: 고느끼 선물 — 장식 하나 10% 할인 (다음 장식 한 번)
  const coupon = !pl.prop && d.deco && d.cost > 0 ? decoCoupon() : 0;
  const cost = pl.prop ? 0 : Math.round(buildCost(pl.kind) * (1 - coupon));
  if (S.gold < cost) {
    toast('금화가 모자라요');
    return false;
  }
  // TOWN T3: 땅 단계별 최대 채수 (예전에 더 지어 둔 건 그대로)
  if (!pl.prop && !SINGLE(pl.kind) && countKind(pl.kind) >= maxCopies(pl.kind)) {
    toast(`${d.name}은(는) 지금 땅에서 ${maxCopies(pl.kind)}채까지 지을 수 있어요 · 땅을 넓히면 더`);
    return false;
  }
  // HOTFIX14 §1: 여관 본관·던전만 한 채
  if (!pl.prop && SINGLE(pl.kind) && world.objs.some((o) => o.kind === pl.kind)) {
    toast(`${d.name}은(는) 마을에 한 채만 지을 수 있어요`);
    return false;
  }
  // CONSTRUCTION_SPEC §3: 동시 공사 수 (1칸 장식은 세지 않음)
  const [pw, ph] = sizeFor(pl.kind, 1);
  if (!(pw === 1 && ph === 1) && !slotFree()) {
    toast(`일꾼이 모두 바빠요 · 동시 공사 ${conSlots()}곳 (여관 레벨업으로 일꾼 +1)`);
    return false;
  }
  S.gold -= cost;
  if (coupon) {
    useDecoCoupon();
    toast(`할인 쿠폰을 썼어요 (−${Math.round(coupon * 100)}%)`);
  }
  if (pl.prop) P.harmony.moved.push(pl.prop);
  // 땅 개편 §4: 첫 건설 초록 안내는 한 번
  P.buildTipSeen = true;
  landHint.firstBuild = false;
  // HOTFIX14 §5: 선물 장식은 하나 쓴다 (환불 없음)
  const giftDeco = !pl.prop && (P.meta.giftDeco?.[pl.kind] ?? 0) > 0 && d.cost === 0;
  if (giftDeco) P.meta.giftDeco[pl.kind]--;
  // DECO_DROP §3: 처음 사는 장식 종류인가 (놓기 전에 본다)
  const newDeco = isDropKind(pl.kind) && !ownedDrops().includes(pl.kind);
  const o = addObj(pl.kind, pl.tx!, pl.ty!, { flip: !!pl.flip, builtAt: Date.now(), ...(cost !== d.cost ? { paid: cost } : {}), ...(pl.prop || giftDeco ? { fromProp: true } : {}) });
  startNew(o);
  trackEv('build', { kind: pl.kind });
  if (pl.kind === 'fire') track('buildFire');
  // DECO_DROP §3: 오늘의 목표 — 장식 놓기 · 새 장식 1종
  if (d.deco) track('decoPlace');
  if (newDeco) track('decoNew');
  noteBought(pl.kind);
  sfx('build');
  rebuildPaths();
  // BUILDUX §1-3: 놓는 순간 쿵 + 먼지
  o.pop = 1;
  puffAt(o, '#c9bfa8', 12);
  floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 40, '뚝딱뚝딱!', 'big');
  markDirty();
  funnel('first_build', { kind: pl.kind });
  return true;
}
/** BUILDUX: 보관함에서 꺼내 놓은 순간 (쿵 + 먼지) */
export function thud(o: Building) {
  o.pop = 1;
  puffAt(o, '#fff3b0', 12);
  sfx('build');
  floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 40, '쿵!', 'big');
  afterLayoutChange();
}

// ───────── CONSTRUCTION_SPEC: 공사 완성 연출 ─────────
const offlineDone: string[] = [];
conHooks.done = (o, offline) => {
  const d = def(o.kind);
  const name = o.lvl > 1 ? `${d.name} Lv.${o.lvl}` : d.name;
  rebuildPaths();
  if (offline) {
    offlineDone.push(name);
    return;
  }
  o.pop = 1;
  puffAt(o, '#fff3b0', 20);
  floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 60, name + ' 완성!', 'big');
  sfx('grade_up');
  if (isWinOpen()) toast(`${name} 완성!`);
  afterLayoutChange();
};
/** 접속했을 때: 꺼져 있던 동안 끝난 공사 요약 */
export function settleOfflineCons() {
  tickCons(Date.now(), true);
  if (!offlineDone.length) return;
  const names = offlineDone.splice(0);
  queueEvent(() => toast(`자는 동안 ${names.slice(0, 3).join(' · ')}${names.length > 3 ? ` 외 ${names.length - 3}곳` : ''} 공사가 끝났어요!`), 'conDone');
}

export function upgrade(o: Building) {
  const cost = nextLevelCost(o);
  if (cost == null) return;
  // 땅 개편: 레벨마다 필요한 땅 단계
  const needL = landNeedFor(o);
  if (needL > S.land) return toast(`땅 ${needL}단계가 필요해요`);
  if (S.gold < cost) return toast('금화가 모자라요');
  if (o.con) return toast('공사 중이에요');
  if (!slotFree()) return toast(`일꾼이 모두 바빠요 · 동시 공사 ${conSlots()}곳 (여관 레벨업으로 일꾼 +1)`);
  if (!canGrow(o)) {
    // 땅 개편: 커지면 문 자리가 바뀐다 — 문 앞이 막혔으면 그렇게 알려 준다
    const [nw, nh] = sizeFor(o.kind, o.lvl + 1);
    const [dx, dy] = doorOf({ tx: o.tx - (nw - o.fw), ty: o.ty - (nh - o.fh), fw: nw, fh: nh, flip: o.flip });
    const atDoor = world.objs.find((x) => x !== o && dx >= x.tx && dx < x.tx + x.fw && dy >= x.ty && dy < x.ty + x.fh);
    return toast(atDoor ? `커지면 문이 바뀌어요 · 새 문 앞의 ${def(atDoor.kind).name}을(를) 옮겨 주세요` : '뒤쪽에 자리가 없어요 · 1칸 비워주세요');
  }
  S.gold -= cost;
  closeWin();
  // CONSTRUCTION_SPEC §2·§3: 레벨업은 공사 시간 뒤 — 커지면 지금 새 발판으로 공사 터 (손님 밀어내기 · 길 다시)
  startUp(o, cost);
  rebuildPaths();
  afterLayoutChange();
  trackEv('upgrade_start', { kind: o.kind, to: o.con!.to, sec: Math.round(o.con!.total) });
  puffAt(o, '#c9bfa8', 12);
  sfx('build');
  floatW(o.tx + o.fw / 2, o.ty + o.fh / 2, 50, '뚝딱뚝딱!', 'big');
  markDirty();
}
/** 커지는 레벨: 뒤쪽 자리·문 앞이 비었나 (upgradeObj와 같은 검사, 적용은 안 함) */
function canGrow(o: Building): boolean {
  const [nw, nh] = sizeFor(o.kind, o.lvl + 1);
  if (nw === o.fw && nh === o.fh) return true;
  const nt = { kind: o.kind, tx: o.tx - (nw - o.fw), ty: o.ty - (nh - o.fh), fw: nw, fh: nh, flip: o.flip };
  return canPlace(nt, o) && !blocksDoor(nt, o);
}

/** 핫픽스 10: 철거 — 손님 꺼내기 · 길 다시 · 환불 · 먼지 · 「털썩」 · 기록 */
export function demolish(o: Building): boolean {
  // CONSTRUCTION_SPEC §3: 공사 중 철거 = 공사 취소 + 그 업그레이드 비용 전액 환불
  const conBack = o.con?.kind === 'up' ? o.con.cost : 0;
  const gold = refundOf(o).gold + conBack;
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
  // HOTFIX20 §1: 이웃 방문 — 남은 오버레이 정리
  clearOverlays('visit');
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
    $('#vSub').textContent = `${v.title ? `「${v.title}」 ` : ''}${v.owner ? `주인 ${v.owner}` : `${v.name} 주인`} · 마을 등급 ${gradeName(v.grade ?? Math.max(0, v.land - 1))}`;
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
    if (await likeReal(v)) { const [a, b] = landBounds(); floatW((a + b) / 2, (a + b) / 2 - 1, 60, '♥ 좋아요!', 'heart'); }
    updateLike();
    return;
  }
  const set = likedSet();
  if (set.has(v.id)) return toast('이미 좋아요를 남겼어요');
  set.add(v.id);
  setPref('liked', [...set]);
  updateLike();
  { const [a, b] = landBounds(); floatW((a + b) / 2, (a + b) / 2 - 1, 60, '♥ 좋아요!', 'heart'); }
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
  fitDay(true);
  $('#starv').textContent = '★' + stars();
  // 핫픽스 7: 아이콘 + 짧은 글자 (누르면 바뀌는 쪽을 보여 준다)
  $('#bDNi').textContent = S.night ? '☀' : '☾';
  $('#bDNl').textContent = S.night ? '낮' : '밤';
}

/** 배치 모드 시작 시 카메라를 그 자리로 */
export function focusTile(x: number, y: number) {
  lookAt(x, y);
}
