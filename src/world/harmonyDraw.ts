// 베타 1장: 어울림 그리기 — 금빛 점선(발견·「어울림 보기」) · 배치 중 범위 타일·짝 건물 초록·미리보기 말풍선
import { flag } from './flags';
import { av } from '../engine/ver';
import { CONFIG } from '../data/config';
import { harmonyById } from '../data/harmony';
import { sx, sy, view } from '../engine/iso';
import { P as PX } from '../engine/pixel';
import { computeSets, harmonySets, type HSet } from './harmony';
import { P, S, world, type Building } from './state';
import type { Placement } from './town';

const img = (src: string) => {
  const im = new Image();
  im.src = src;
  return im;
};
const RANGE = img(av('assets/ui/harmony_range.png'));
const RANGE_ON = img(av('assets/ui/harmony_range_active.png'));
const DOT = img(av('assets/ui/harmony_dot.png'));
const N = CONFIG.map.size;

/** 발견 연출 중인 어울림 (점선이 이어지고 이름이 뜬다) */
export const harmonyAnim: { set: HSet; t0: number }[] = [];
export const DISCOVER_SECONDS = 4;

const center = (o: { tx: number; ty: number; fw: number; fh: number }): [number, number] => [
  Math.round(view.OX + sx(o.tx + o.fw / 2, o.ty + o.fh / 2)),
  Math.round(view.OY + sy(o.tx + o.fw / 2, o.ty + o.fh / 2)) - 6,
];

/** 금빛 점선: 4px마다 점 하나 (f = 0~1 이어지는 정도) */
function dotted(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], f = 1, phase = 0) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.floor(d / 4);
  for (let i = 0; i <= n * f; i++) {
    if ((i + phase) % 4 === 3) continue;
    const t = n ? i / n : 0;
    ctx.drawImage(DOT, Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t));
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, gold = true) {
  ctx.font = '10px "Galmuri9"';
  const w = Math.ceil(ctx.measureText(text).width) + 8;
  // 화면 밖으로 안 나가게
  const X = Math.max(2, Math.min(view.LW - w - 2, Math.round(x - w / 2)));
  const Y = Math.round(y);
  const p = PX(ctx);
  p.rect(X, Y, w, 13, '#161420');
  p.rect(X + 1, Y + 1, w - 2, 11, gold ? '#3a2a12' : '#1e2a1a');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = gold ? '#ffd36b' : '#b8ffb0';
  ctx.fillText(text, X + 4, Y + 2);
}

function drawSet(ctx: CanvasRenderingContext2D, s: HSet, f: number, withName: boolean) {
  const [anchor, ...rest] = s.members;
  const a = center(anchor);
  const phase = Math.floor(S.T * 6);
  for (const o of rest) dotted(ctx, a, center(o), f, phase);
  if (!withName) return;
  const mid = s.members.map(center).reduce((m, c) => [m[0] + c[0] / s.members.length, m[1] + c[1] / s.members.length], [0, 0]);
  label(ctx, harmonyById(s.id).name, mid[0], mid[1] - 18);
}

/** 마을 위: 「어울림 보기」를 켰으면 모든 어울림, 아니면 발견 연출 중인 것만 */
export function drawHarmonyLines(ctx: CanvasRenderingContext2D) {
  if (!S.visiting && P.harmony.show) for (const s of harmonySets()) drawSet(ctx, s, 1, true);
  // TOWN T4: 구역 어울림은 땅에 이름표 (늘 · 구역 가운데) — v0.25.2b harmonyLabels: 어울림 버튼을 눌렀을 때만
  else if (!flag('harmonyLabels'))
    for (const s of harmonySets()) {
      const h = harmonyById(s.id);
      if (!h.zone) continue;
      const cs = s.members.map(center);
      const x = cs.reduce((t, c) => t + c[0], 0) / cs.length;
      const y = cs.reduce((t, c) => t + c[1], 0) / cs.length;
      label(ctx, h.name, x, y + 10, false);
    }
  for (let i = harmonyAnim.length - 1; i >= 0; i--) {
    const h = harmonyAnim[i];
    const t = S.T - h.t0;
    if (t > DISCOVER_SECONDS) {
      harmonyAnim.splice(i, 1);
      continue;
    }
    if (!P.harmony.show) drawSet(ctx, h.set, Math.min(1, t / 0.8), t > 0.8);
  }
}

// ───────── 배치 중 ─────────

let pvKey = '';
let pv: { sets: HSet[]; ghost: Building } | null = null;
/** 유령 건물을 놓았다고 치고 새로 생기는 어울림 */
function preview(pl: Placement) {
  const k = `${pl.kind}${pl.tx},${pl.ty},${pl.fw},${pl.fh}|${world.objs.length}`;
  if (k === pvKey && pv) return pv;
  pvKey = k;
  const ghost = { kind: pl.kind, tx: pl.tx!, ty: pl.ty!, fw: pl.fw, fh: pl.fh, lvl: 1, hue: null, inside: [], sprite: pl.sprite } as unknown as Building;
  const objs = world.objs.filter((o) => o !== pl.move).concat(ghost);
  pv = { sets: computeSets(objs).filter((s) => s.members.includes(ghost)), ghost };
  return pv;
}

export function drawPlacementHarmony(ctx: CanvasRenderingContext2D, pl: Placement) {
  const R = CONFIG.harmony.range;
  const tx = pl.tx!;
  const ty = pl.ty!;
  const { sets, ghost } = preview(pl);
  const partners = new Set<Building>();
  for (const s of sets) for (const o of s.members) if (o !== ghost) partners.add(o);
  // 1) 범위 타일 (발자국 둘레 2칸)
  ctx.globalAlpha = 0.85;
  for (let y = ty - R; y < ty + pl.fh + R; y++)
    for (let x = tx - R; x < tx + pl.fw + R; x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      if (x >= tx && x < tx + pl.fw && y >= ty && y < ty + pl.fh) continue;
      ctx.drawImage(RANGE, Math.round(view.OX + sx(x, y) - 16), Math.round(view.OY + sy(x, y)));
    }
  // 2) 짝이 될 건물 바닥은 초록
  for (const o of partners)
    for (let j = 0; j < o.fh; j++)
      for (let i = 0; i < o.fw; i++) ctx.drawImage(RANGE_ON, Math.round(view.OX + sx(o.tx + i, o.ty + j) - 16), Math.round(view.OY + sy(o.tx + i, o.ty + j)));
  ctx.globalAlpha = 1;
  // 3) 점선 + 미리보기 말풍선 (숨은 조합이면 ???)
  const top = Math.round(view.OY + sy(tx, ty)) - 70;
  sets.forEach((s, i) => {
    drawSet(ctx, s, 1, false);
    const h = harmonyById(s.id);
    const known = h.open || P.harmony.found.includes(s.id);
    // 이름 줄 + 효과 줄 (폰 폭에서 잘리지 않게 두 줄)
    const cx = Math.round(view.OX + sx(tx + pl.fw / 2, ty + pl.fh / 2));
    const y = top - i * 30;
    if (known) {
      label(ctx, `+ ${h.name}`, cx, y, true);
      label(ctx, h.text, cx, y + 14, true);
    } else label(ctx, '+ ??? 무언가 어울릴 것 같다', cx, y + 14, false);
  });
}
