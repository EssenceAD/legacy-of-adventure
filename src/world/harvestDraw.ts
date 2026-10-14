// HARVEST §1-3 마을이 가을로 (기간 중에만 · 그리기 전용) — 등급 장식(gradeProps)처럼 건물 격자를 차지하지 않고 옮기거나 지울 수 없다
//  자리: 울타리 밖 입구 길 양옆 · 길 끝 · 앞쪽 공터 줄 · 뒤쪽 공터 줄 — 등급 장식·길·나무·건물과 겹치지 않는 빈 칸에만
//  + 단풍잎 떨어지기 (화면당 8~12장 · 배터리 절약이면 끔) · 밤/노을 등불 빛 · §1-7 마지막 밤 등불 날리기
import { IMG, META, tinted } from '../engine/assets';
import { saverOn } from '../engine/fps';
import { N, sx, sy, view } from '../engine/iso';
import { P as PX } from '../engine/pixel';
import { HV } from '../data/harvest_cfg';
import { glow, NL } from './daynight';
import { gradeFolk, gradeNow, gradeProps, outerRoad } from './grade';
import { ground } from './ground';
import { harvestOn } from './harvest';
import { S, world } from './state';
import { entrance, groundVersion, inLand, landBounds, pathT, spriteOrigin } from './town';

export interface FestProp {
  /** 그림 키 (sprites/) */
  k: string;
  x: number;
  y: number;
  fw: number;
  fh: number;
  id: string;
}
/** 밤·노을에 등불 빛 */
const LIT: Record<string, { gy: number; r: number }> = { jack_lantern: { gy: 0.55, r: 14 }, lantern_post: { gy: 0.3, r: 18 }, pumpkin_carriage: { gy: 0.35, r: 20 } };

let key = '';
let cache: FestProp[] = [];
/** 지금 보이는 마을(이웃 방문 포함)의 수확제 자동 장식 — 기간 밖이면 [] */
export function festivalProps(): FestProp[] {
  if (!harvestOn()) return [];
  const g = gradeNow();
  const [a, b] = landBounds();
  const [ex] = entrance();
  const k = `${g}|${a}|${b}|${ex}|${S.visiting?.id ?? ''}|${groundVersion}|${world.objs.length}|${ground.wild.length}`;
  if (k === key) return cache;
  key = k;
  cache = layout(g, a, b, ex);
  return cache;
}
/** 자리 정하기 (그리기와 따로 · 시험용으로 꺼냄) */
export function layout(g: number, a: number, b: number, ex: number): FestProp[] {
  const used = new Set<string>();
  const mark = (x: number, y: number, w = 1, h = 1) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used.add(`${x + i},${y + j}`);
  };
  for (const p of gradeProps(g)) mark(p.x, p.y, p.fw, p.fh);
  for (const f of gradeFolk(g)) mark(Math.floor(f.x), Math.floor(f.y));
  const road = new Set(outerRoad(g).map(([x, y]) => `${x},${y}`));
  for (const r of road) used.add(r);
  for (const o of world.objs) mark(o.tx - 1, o.ty - 1, o.fw + 2, o.fh + 2);
  for (const w of ground.wild) used.add(`${w.x},${w.y}`);
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && !inLand(x, y) && !used.has(`${x},${y}`) && !pathT.has(y * N + x);
  const out: FestProp[] = [];
  const put = (id: string, k: string, cands: [number, number][]) => {
    const c = cands.find(([x, y]) => free(x, y));
    if (!c) return;
    out.push({ id, k, x: c[0], y: c[1], fw: 1, fh: 1 });
    used.add(`${c[0]},${c[1]}`);
  };
  // 입구 양옆 호박등 2
  put('hv_jack_L', 'jack_lantern', [[ex - 1, b], [ex - 2, b], [ex - 1, b + 1], [ex - 2, b + 1], [ex - 3, b], [ex - 3, b + 1]]);
  put('hv_jack_R', 'jack_lantern', [[ex + 1, b], [ex + 2, b], [ex + 1, b + 1], [ex + 2, b + 1], [ex + 3, b], [ex + 3, b + 1]]);
  // 입구 길 끝 아치 1 (도시 정문 아치가 있으면 그 바로 바깥) — 길 위라도 괜찮다
  //  (땅이 넓어 길이 맵 끝에 닿으면 맵 안 마지막 길 칸 · 그 칸에 등급 장식이 있으면 한 칸씩 안쪽으로)
  const gate = gradeProps(g).find((p) => p.k === 'gate');
  const want = Math.min(N - 1, gate ? gate.y + 1 : g >= 1 ? b + 1 + g : b + 1);
  const gp = gradeProps(g);
  for (let ay = want; ay >= b; ay--) {
    if (gp.some((p) => p.x <= ex && ex < p.x + p.fw && p.y <= ay && ay < p.y + p.fh) || inLand(ex, ay)) continue;
    out.push({ id: 'hv_arch', k: 'harvest_arch', x: ex, y: ay, fw: 1, fh: 1 });
    used.add(`${ex},${ay}`);
    break;
  }
  // 앞쪽 공터 (울타리 바로 바깥 두 줄 · 입구에서 가까운 순)
  const front: [number, number][] = [];
  for (let d = 1; d <= b - a + 2; d++)
    for (const y of [b + 1, b]) {
      front.push([ex - d, y], [ex + d, y]);
    }
  for (let y = b - 1; y >= a; y--) front.push([b, y], [b + 1, y]);
  const frontFree = () => front.filter(([x, y]) => free(x, y));
  const nth = (i: number): [number, number][] => {
    const f = frontFree();
    return f.length ? [f[Math.min(f.length - 1, i)]] : [];
  };
  put('hv_post_L', 'lantern_post', front.filter(([x]) => x < ex));
  put('hv_post_R', 'lantern_post', front.filter(([x]) => x > ex));
  put('hv_pump_1', 'pumpkins', nth(1));
  put('hv_scare', 'hay_scarecrow', nth(3));
  put('hv_wheat_1', 'wheat_sheaf', nth(0));
  put('hv_pump_2', 'pumpkins', nth(4));
  put('hv_wheat_2', 'wheat_sheaf', nth(2));
  // 뒤쪽 공터 (울타리 뒤 한 줄)
  const span = b - a;
  const row = (f: number): [number, number][] => {
    const x0 = a + Math.floor(span * f);
    const r: [number, number][] = [];
    for (let d = 0; d < span; d++) r.push([x0 + d, a - 1], [x0 - d, a - 1]);
    return r.filter(([x]) => x >= a && x < b);
  };
  const col = (f: number): [number, number][] => {
    const y0 = a + Math.floor(span * f);
    const r: [number, number][] = [];
    for (let d = 0; d < span; d++) r.push([a - 1, y0 + d], [a - 1, y0 - d]);
    return r.filter(([, y]) => y >= a && y < b);
  };
  put('hv_leaf_T', 'leaf_pile', row(0.45));
  put('hv_leaf_L', 'leaf_pile', col(0.45));
  put('hv_maple', 'maple', row(0.8));
  return out;
}

/** 장식 하나 (건물 그림과 같은 자리 맞춤) */
export function drawFestProp(ctx: CanvasRenderingContext2D, fp: FestProp) {
  const im0 = IMG[fp.k];
  if (!im0 || !META[fp.k]) return;
  const [x, y] = spriteOrigin({ sprite: fp.k, tx: fp.x, ty: fp.y, fw: fp.fw, fh: fp.fh });
  ctx.drawImage(tinted(im0, NL), Math.round(view.OX + x), Math.round(view.OY + y));
}
/** 밤·노을 등불 빛 (더하기 · 가로등과 같은 glow) — lt = 밤 정도(노을 등불 포함) */
//  v0.25.23: 맨 위 한 번이 아니라 장식 하나를 그린 직후에 (앞 건물·나무가 나중에 그려지며 가린다)
export function drawFestLight(ctx: CanvasRenderingContext2D, fp: FestProp, lt: number) {
  if (lt <= 0.01) return;
  const L = LIT[fp.k];
  const m = META[fp.k];
  if (!L || !m) return;
  const [x, y] = spriteOrigin({ sprite: fp.k, tx: fp.x, ty: fp.y, fw: fp.fw, fh: fp.fh });
  glow(ctx, view.OX + x + m.w / 2, view.OY + y + m.h * L.gy, L.r, lt * (0.5 + Math.sin(S.T * 5 + fp.x) * 0.04));
}

// ───────── 단풍잎 ─────────

const LEAF = ['#d8572a', '#e8a23a', '#b8402a', '#f0c05a'];
/** 화면 위에서 천천히 떨어지는 단풍잎 (화면 좌표 · 배터리 절약이면 안 그림) */
export function drawLeaves(ctx: CanvasRenderingContext2D, T: number, LW: number, LH: number) {
  if (!harvestOn() || saverOn()) return;
  const p = PX(ctx);
  for (let i = 0; i < HV.leaves; i++) {
    const sp = 9 + (i % 4) * 3;
    const y = ((T * sp + i * 71) % (LH + 24)) - 12;
    const x = (((i * 131 + T * (4 + (i % 3) * 2) + Math.sin(T * 0.9 + i * 1.7) * 16) % (LW + 20)) + LW + 20) % (LW + 20) - 10;
    const c = LEAF[i % LEAF.length];
    const X = Math.round(x);
    const Y = Math.round(y);
    // 두 모양을 번갈아 (빙글 도는 느낌)
    if (Math.sin(T * 3 + i) > 0) {
      p.rect(X, Y, 2, 2, c);
      p.px(X + 2, Y + 1, c);
    } else {
      p.rect(X, Y, 3, 1, c);
      p.px(X + 1, Y + 1, c);
    }
  }
}

// ───────── §1-7 마지막 밤 등불 날리기 (fx: 'lanterns') ─────────

/** 연출 시작 시각(S.T) · 0 = 없음 */
export const lanternFx = { t0: 0, dur: 7 };
export function startLanterns() {
  lanternFx.t0 = S.T || 0.001;
}
export const stopLanterns = () => void (lanternFx.t0 = 0);
/** 화면 아래(여관·모닥불 쪽)에서 종이 등불 24개가 흔들리며 올라가 별 사이로 작아진다 · 배터리 절약이면 움직이지 않고 하늘에 떠 있는 모습만 */
export function drawLanterns(ctx: CanvasRenderingContext2D, LW: number, LH: number) {
  if (!lanternFx.t0) return;
  const still = saverOn();
  const t = still ? lanternFx.dur * 0.8 : S.T - lanternFx.t0;
  if (t > lanternFx.dur + 1.5 && !still) return;
  const fire = world.objs.find((o) => o.kind === 'fire') ?? world.objs.find((o) => o.kind === 'inn');
  const bx = fire ? view.OX + sx(fire.tx + fire.fw / 2, fire.ty + fire.fh / 2) : LW / 2;
  const by = fire ? Math.min(LH - 20, view.OY + sy(fire.tx + fire.fw / 2, fire.ty + fire.fh / 2)) : LH - 30;
  const p = PX(ctx);
  ctx.save();
  for (let i = 0; i < 24; i++) {
    const st = (i % 8) * 0.35 + Math.floor(i / 8) * 0.12;
    const k = Math.max(0, Math.min(1, (t - st) / (lanternFx.dur - 1.2)));
    if (k <= 0) continue;
    const ease = 1 - (1 - k) * (1 - k);
    const x0 = bx + ((i * 37) % 120) - 60;
    const x = x0 + Math.sin(t * 1.3 + i) * (6 + 6 * ease) + (i % 2 ? 1 : -1) * ease * 30;
    const y = by - ease * (by - 18 - (i % 5) * 10);
    const s = ease > 0.75 ? 2 : 3;
    const a = still ? 0.9 : Math.min(1, k * 4) * (t > lanternFx.dur ? Math.max(0, 1 - (t - lanternFx.dur) / 1.5) : 1);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, 11 - ease * 5, 0.5 * a);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    p.rect(Math.round(x - s / 2), Math.round(y - s), s + 1, s + 1, '#ffcf6a');
    if (s > 1) p.px(Math.round(x), Math.round(y - s - 1), '#fff3b0');
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

