// 티저 컷마다 쓸 가짜 상태 — 메모리에서만 만들고 버린다 (저장 데이터는 절대 건드리지 않는다)
//  마을 컷: 이웃 「달빛 쉼터」 배치를 등급(땅 단계)만큼 잘라 그린다 · 전투/다락 컷: 작은 캔버스에 정수 배율로
import { CLASSES } from '../data/classes';
import { NEIGHBORS } from '../data/neighbors';
import { BOSS_IMG, MOB_IMG, RAID_BG } from '../engine/assets';
import { view } from '../engine/iso';
import { framesFor, type CharFrames } from '../engine/sprites';
import { spawnExtras } from '../world/actors';
import { blankActor } from '../world/adventurers';
import { teaserView } from '../world/grade';
import { S, world } from '../world/state';
import { doorOf, findKind, landBounds, placeLayout, rebuildPaths, sizeFor, type LayoutEntry } from '../world/town';
import { drawChar, LH, LW, LANES } from '../ui/battle';
import { dpr } from '../ui/kit';

const CITY = NEIGHBORS.find((v) => v.id === 'moon') ?? NEIGHBORS[NEIGHBORS.length - 1];

/** 등급 g(0 오두막 ~ 4 도시) 마을: 땅 g+1단계 안에 들어가는 건물만 */
export function village(g: number, night: boolean, opts: { bench?: boolean; keeper?: boolean } = {}) {
  S.visiting = null;
  S.land = g + 1;
  teaserView.g = g;
  const [lo, hi] = landBounds(g + 1);
  const all: LayoutEntry[] = CITY.layout.map(([kind, tx, ty, lvl, hue, flip]) => ({ kind, tx, ty, lvl: lvl ?? 1, hue: hue ?? null, flip: !!flip }));
  const fits = (e: LayoutEntry) => {
    const [fw, fh] = sizeFor(e.kind, e.lvl);
    return e.tx >= lo && e.ty >= lo && e.tx + fw <= hi && e.ty + fh <= hi;
  };
  const list = all.filter((e) => e.kind === 'inn' || e.kind === 'dungeon' || fits(e)).map((e) => (e.kind === 'inn' && g < 2 ? { ...e, lvl: 1 } : e));
  if (!list.some((e) => e.kind === 'fire')) list.push({ kind: 'fire', tx: lo + 1, ty: hi - 2, lvl: 1, hue: null });
  if (!list.some((e) => e.kind === 'well')) list.push({ kind: 'well', tx: lo + 1, ty: hi - 3, lvl: 1, hue: null });
  placeLayout(list, g + 1);
  // 「우물가 수다」: 우물 바로 옆에 벤치
  if (opts.bench) {
    const w = world.objs.find((o) => o.kind === 'well');
    if (w) placeLayout([...world.objs.map((o) => ({ kind: o.kind, tx: o.tx, ty: o.ty, lvl: o.lvl, hue: o.hue, flip: o.flip })), { kind: 'bench', tx: w.tx + 1, ty: w.ty, lvl: 1, hue: null }], g + 1);
  }
  rebuildPaths();
  spawnExtras(Math.min(3 + g * 2, 10));
  if (opts.keeper) {
    const inn = findKind('inn');
    if (inn) {
      const d = doorOf(inn);
      world.actors.push(blankActor('keeper', '버나드', d[0] - 0.6, d[1] + 0.4, 'keeper'));
    }
  }
  S.night = night;
  S.nightT = night ? 1 : 0;
  view.cam.x = 0;
  view.cam.y = 0;
}

// ───────── 작은 캔버스 (전투 · 보스 · 다락) ─────────

/** 356×200 장면을 화면 폭에 맞춰 정수 배율로 */
export function sceneCanvas(host: HTMLElement, w = LW, h = LH, maxH = 0.5): { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; sc: number } {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  // 비어 있는 자리 상자 말고 무대 크기로 (상자는 아직 높이가 0)
  const r = (host.parentElement ?? host).getBoundingClientRect();
  const k = Math.max(1, Math.floor(Math.min((r.width * dpr()) / w, (r.height * maxH * dpr()) / h)));
  const sc = k / dpr();
  cv.style.width = w * sc + 'px';
  cv.style.height = h * sc + 'px';
  cv.className = 'tcv';
  host.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { cv, ctx, sc };
}

const FR: Record<string, CharFrames> = {};
const fr = (k: 'knight' | 'mage' | 'cleric') => (FR[k] ||= framesFor('teaser-' + k, CLASSES[k]));

/** 사냥: 파티 셋 · 몬스터 웨이브가 걸어온다 (t초) */
export function drawHunt(ctx: CanvasRenderingContext2D, t: number) {
  const bg = RAID_BG.forest;
  if (bg) ctx.drawImage(bg, 0, 0, LW, LH);
  else ctx.fillRect(0, 0, LW, LH);
  const party: ['knight' | 'mage' | 'cleric', number][] = [['cleric', 20], ['mage', 44], ['knight', 76]];
  party.forEach(([k, x], i) => {
    const f = fr(k);
    const list = t % 0.6 < 0.3 && k === 'knight' ? f.walk : f.idle;
    drawChar(ctx, list[Math.floor(t * 4) % list.length], x, LANES[i % 3]);
  });
  const mobs = ['slime', 'wolf', 'goblin', 'slime'];
  mobs.forEach((m, i) => {
    const im = MOB_IMG[m];
    if (!im) return;
    const x = Math.round(Math.max(118 + i * 26, LW - 10 - t * 70 + i * 30));
    ctx.drawImage(im, x, LANES[i % 3] - im.height + 2);
  });
}

/** 토벌: 큰 보스 + 파티 (막기 섬광은 DOM) */
export function drawBoss(ctx: CanvasRenderingContext2D, t: number) {
  const bg = RAID_BG.forest;
  if (bg) ctx.drawImage(bg, 0, 0, LW, LH);
  const b = BOSS_IMG.boar;
  if (b) {
    const shake = t > 1.2 && t < 1.5 ? Math.round(Math.sin(t * 80) * 2) : 0;
    ctx.drawImage(b, Math.round(LW - b.width - 20 + shake), Math.round(LH - 14 - b.height));
  }
  (['knight', 'mage', 'cleric'] as const).forEach((k, i) => drawChar(ctx, fr(k).idle[Math.floor(t * 2) % 2], 40 + i * 22, LANES[i]));
}

/** 다락: 달빛 · 옛 장비 · 낡은 지도 (코드 도트 160×120) */
const ATTIC = { sword: img('assets/icons/skill_attack.png'), map: img('assets/icons/m_expedition.png'), helm: img('assets/icons/m_heroes.png') };
function img(src: string) {
  const i = new Image();
  i.src = src;
  return i;
}
export const ATTIC_W = 160;
export const ATTIC_H = 120;
export function drawAttic(ctx: CanvasRenderingContext2D, t: number) {
  const W = ATTIC_W;
  const H = ATTIC_H;
  ctx.fillStyle = '#120e1c';
  ctx.fillRect(0, 0, W, H);
  // 경사 지붕 서까래
  ctx.fillStyle = '#21182c';
  for (let i = 0; i < 6; i++) ctx.fillRect(i * 28 - 4, 0, 6, H);
  ctx.fillStyle = '#2c2034';
  ctx.fillRect(0, 86, W, 34);
  ctx.fillStyle = '#3a2a3e';
  for (let i = 0; i < 8; i++) ctx.fillRect(0, 88 + i * 4, W, 1);
  // 창 + 달빛 기둥
  ctx.fillStyle = '#3c4a7a';
  ctx.fillRect(108, 18, 26, 22);
  ctx.fillStyle = '#c8d8ff';
  ctx.fillRect(110, 20, 10, 8);
  ctx.fillRect(122, 20, 10, 8);
  ctx.fillRect(110, 30, 10, 8);
  ctx.fillRect(122, 30, 10, 8);
  ctx.globalAlpha = 0.16 + Math.sin(t * 2) * 0.03;
  ctx.fillStyle = '#c8d8ff';
  ctx.beginPath();
  ctx.moveTo(110, 40);
  ctx.lineTo(132, 40);
  ctx.lineTo(96, 104);
  ctx.lineTo(48, 104);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // 상자 · 옛 장비 · 지도
  ctx.fillStyle = '#5a3a24';
  ctx.fillRect(52, 80, 40, 18);
  ctx.fillStyle = '#7a5030';
  ctx.fillRect(52, 80, 40, 3);
  ctx.fillStyle = '#c9a24a';
  ctx.fillRect(70, 86, 4, 4);
  if (ATTIC.helm.complete) ctx.drawImage(ATTIC.helm, 58, 58);
  if (ATTIC.sword.complete) ctx.drawImage(ATTIC.sword, 80, 54);
  if (ATTIC.map.complete) ctx.drawImage(ATTIC.map, 34, 88);
  // 반짝임
  const sp = [[66, 60], [92, 58], [44, 92]];
  sp.forEach(([x, y], i) => {
    if (Math.floor(t * 3 + i) % 3 !== 0) return;
    ctx.fillStyle = '#fff3d6';
    ctx.fillRect(x, y - 2, 1, 5);
    ctx.fillRect(x - 2, y, 5, 1);
  });
}
