// LUXE §1-3 영웅 의상실 — 옷 색 바꾸기 「한 함수」 (FACE 통일 때처럼 여기 하나로)
//  도트: dressGrid(def, draw) — 마을 · 전투 · 파티 칸 얼굴(pic) · 대기·걷기·앉기·잠·구르기·쓰러짐 모든 프레임이 이걸 지난다 (engine/sprites.ts)
//    ① 이름 있는 겉모습(applyNamed) 위에 의상 색을 덮어(def.dress) 다시 그린다 → 옷 색에서 나온 명암(dk·lt)은 저절로 따라온다
//    ② 그림에 박힌 색(소품 고정 색 등)은 원래 옷 색과 「가까운 색(밝기 단계 포함)」만 같은 밝기 순서로 새 색 단계에 옮긴다
//       — 덮어 그려 이미 바뀐 칸은 건드리지 않는다 · 머리 · 피부 · 수염 · 신발 · 투구 · 무기 등급 색 · 신화 망토에 더 가까우면 그대로
//  초상화: dressPortrait(img, look, outfit) — 같은 의상 색(outfitPalette)으로 옷 영역만 (피부·머리 색에 더 가까운 칸 · 테두리에서 번지는 배경은 제외)
//  의상 색은 outfitPalette(id) 하나 — 같은 id면 어느 길로 그려도 같은 색
import type { ClassDef } from '../data/classes';
import { OUTFITS } from '../data/outfits';
import { LUXE_OUTFITS } from '../data/luxe_cfg';
import { canvas, hex2rgb, hsl, hslToRgb, LIGHT, mix, OUTL, SHADOW, type GridT, type RGB } from './pixel';
import { applyNamed, namedOf, STAR_GOLD, STAR_NAVY } from './named2';

const SKIN = '#f2c49b';
const SKIN2 = '#d99a78';

export interface OutfitPalette {
  cloth: string;
  pants: string;
  accent: string;
  extra?: string;
}
/** 의상 색 (같은 id → 같은 색 · 없는 id면 null) */
export function outfitPalette(id: string | undefined | null): OutfitPalette | null {
  const o = id ? OUTFITS[id] : undefined;
  return o ? { cloth: o.cloth, pants: o.pants, accent: o.accent, ...(o.extra ? { extra: o.extra } : {}) } : null;
}

/** 그 사람의 지금 겉모습 (이름 있는 영웅이면 고정 색까지 입힌 것 · 의상 전) */
export function lookOf(def: ClassDef): ClassDef {
  const d = def.dress || def.outfit ? { ...def, dress: undefined, outfit: undefined } : def;
  const L = namedOf(d);
  return L ? applyNamed(d, L) : d;
}

const EXTRA_KEYS = ['cape', 'hood', 'hatc'] as const;
/** 의상 덮개: 바꿀 칸만 (윗옷 · 아래 · 장식 · 망토/두건/모자 중 있는 것 · 팔이 윗옷과 같은 색이면 팔도) — 신화 별빛 망토는 신화 표시라 그대로 */
export function dressPatch(look: ClassDef, pal: OutfitPalette): Partial<ClassDef> {
  const p: Partial<ClassDef> = { cloth: pal.cloth, pants: pal.pants, accent: pal.accent };
  if (look.arm === look.cloth) p.arm = pal.cloth;
  if (pal.extra) for (const k of EXTRA_KEYS) if (look[k] && !(k === 'cape' && look.cape === STAR_NAVY)) p[k] = pal.extra;
  return p;
}

/** [원래 색, 새 색] 줄 (②에서 쓰는 것과 초상화가 쓰는 것이 같다) */
export function swapPairs(look: ClassDef, pal: OutfitPalette): [string, string][] {
  const p = dressPatch(look, pal);
  const out: [string, string][] = [];
  for (const k of ['cloth', 'pants', 'accent', ...EXTRA_KEYS, 'arm'] as const) {
    const from = look[k] as string | undefined;
    const to = p[k] as string | undefined;
    if (from && to && from.toLowerCase() !== to.toLowerCase() && !out.some(([f]) => f === from)) out.push([from, to]);
  }
  return out;
}
/** 건드리면 안 되는 색: 머리 · 수염 · 피부 · 신발 · 투구 · 무기 등급 색 · 수건 · 안경 · 외곽선 · 신화 망토·별 */
export function protectedColors(look: ClassDef): string[] {
  const s = [look.hair, look.beard, look.skin ?? SKIN, SKIN2, look.boots, look.helm, look.weaponColor, look.towel, look.glassesColor, OUTL, '#2a1a2e'];
  if (look.mythic || look.cape === STAR_NAVY) s.push(STAR_NAVY, STAR_GOLD);
  return s.filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c));
}

// ───────── 가까운 색 (밝기 단계 포함) ─────────

const STEPS = 40;
const TMAX = 0.8;
type Line = RGB[];
/** 색 → 그 색의 어두운 쪽(−) · 밝은 쪽(+) 단계 (dk · lt 와 같은 섞기) */
function lineOf(c: string): Line {
  const out: Line = [];
  for (let i = -STEPS; i <= STEPS; i++) {
    const t = (i / STEPS) * TMAX;
    out.push(hex2rgb(t < 0 ? mix(c, SHADOW, -t) : mix(c, LIGHT, t)));
  }
  return out;
}
const d2 = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
function nearest(p: RGB, L: Line): { d: number; t: number } {
  let best = Infinity;
  let bi = 0;
  for (let i = 0; i < L.length; i++) {
    const d = d2(p, L[i]);
    if (d < best) (best = d), (bi = i);
  }
  return { d: Math.sqrt(best), t: ((bi - STEPS) / STEPS) * TMAX };
}
/** 「가까운 색」 문턱 (RGB 거리) */
export const NEAR = 14;

/** 색 바꾸기 표 만들기: 색 하나 → 새 색 (가깝지 않거나 지킬 색에 더 가까우면 null) */
export function makeRemap(pairs: [string, string][], protect: string[]): (c: string) => string | null {
  const lines = pairs.map(([f, t]) => ({ L: lineOf(f), to: t }));
  const prot = protect.map(lineOf);
  const memo = new Map<string, string | null>();
  return (c: string) => {
    const hit = memo.get(c);
    if (hit !== undefined) return hit;
    let out: string | null = null;
    if (/^#[0-9a-f]{6}$/i.test(c)) {
      const p = hex2rgb(c);
      let best = { d: Infinity, t: 0, to: '' };
      for (const { L, to } of lines) {
        const n = nearest(p, L);
        if (n.d < best.d) best = { ...n, to };
      }
      if (best.d <= NEAR) {
        const pd = Math.min(Infinity, ...prot.map((L) => nearest(p, L).d));
        if (pd > best.d) out = best.t < 0 ? mix(best.to, SHADOW, -best.t) : mix(best.to, LIGHT, best.t);
      }
    }
    memo.set(c, out);
    return out;
  };
}

/** 의상 입힌 그림에 쓸 정의 (이름 있는 영웅이면 dress로 · 아니면 바로 덮어씀) */
export function dressedDef(def: ClassDef, pal: OutfitPalette): ClassDef {
  const look = lookOf(def);
  const patch = dressPatch(look, pal);
  return namedOf(def) ? { ...def, dress: patch } : { ...def, ...patch };
}

/**
 * 한 함수: 의상을 입었으면(def.outfit) 덮어 그리고, 그림에 박힌 옷 색은 가까운 색만 옮긴다 · 안 입었으면 그대로 그린다
 *  draw = 정의 → 격자 (어느 그림이든 — 대기·걷기·전투·잠·구르기·쓰러짐)
 */
export function dressGrid(def: ClassDef, draw: (d: ClassDef) => GridT): GridT {
  const pal = outfitPalette(def.outfit);
  if (!pal) return draw(def);
  const look = lookOf(def);
  const base = { ...def, outfit: undefined, dress: undefined };
  const A = draw(base);
  const B = draw(dressedDef(base, pal));
  const remap = makeRemap(swapPairs(look, pal), protectedColors(look));
  if (A.w !== B.w || A.h !== B.h) return B;
  for (let y = 0; y < B.h; y++)
    for (let x = 0; x < B.w; x++) {
      const a = A.g[y][x];
      const b = B.g[y][x];
      // 덮어 그려 이미 바뀐 칸 · 눈 · 빛 궤적은 그대로
      if (!a || !b || a.c !== b.c || b.tag === 'eye' || b.tag === 'fx' || b.tag === 'ol') continue;
      const n = remap(b.c);
      if (n) B.g[y][x] = { c: n, tag: b.tag };
    }
  return B;
}

// ───────── 초상화 ─────────

type HSL = [number, number, number];
const toHsl = (c: string): HSL => {
  const [r, g, b] = hex2rgb(c);
  return hsl(r, g, b);
};
/** 초상화 색 거리 (색상은 채도가 있을 때만 · 밝기 크게) */
function hdist(a: HSL, b: HSL): number {
  const sat = Math.min(a[1], b[1]);
  let dh = Math.abs(a[0] - b[0]);
  if (dh > 180) dh = 360 - dh;
  const h = (dh / 180) * Math.min(1, sat * 2.2) * 2;
  return Math.sqrt(h * h + (a[1] - b[1]) ** 2 * 0.6 + ((a[2] - b[2]) * 1.6) ** 2);
}

export interface PortraitStat {
  /** 사람 칸(배경 제외) 중 바뀐 비율 */
  changed: number;
  /** 의상 줄마다 바뀐 칸 수 */
  perPair: number[];
}

/**
 * 초상화 옷 색 바꾸기: 원래 옷 색(이름 있는 겉모습) 중 가장 가까운 것 → 그 의상 색 (밝기 차이는 그대로 옮김) · 피부·머리에 더 가까우면 그대로
 *  배경 = 테두리에서 시작해 비슷한 색으로 번지는 칸 (건드리지 않음)
 */
export function dressPortrait(img: CanvasImageSource & { width: number; height: number }, look: ClassDef, pal: OutfitPalette, stat?: PortraitStat): HTMLCanvasElement {
  const W = img.width;
  const H = img.height;
  const cv = canvas(W, H);
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const im = ctx.getImageData(0, 0, W, H);
  const px = im.data;
  const C = LUXE_OUTFITS.portrait;
  // 배경 칸 (테두리에서 이웃끼리 bgStep 안쪽으로 번짐)
  const bg = new Uint8Array(W * H);
  const q: number[] = [];
  for (let x = 0; x < W; x++) q.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) q.push(y * W, y * W + W - 1);
  for (const i of q) bg[i] = 1;
  const rgbAt = (i: number): RGB => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
  while (q.length) {
    const i = q.pop()!;
    const x = i % W;
    const y = (i - x) / W;
    const c = rgbAt(i);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (bg[j]) continue;
      if (Math.sqrt(d2(c, rgbAt(j))) <= C.bgStep) {
        bg[j] = 1;
        q.push(j);
      }
    }
  }
  const pairs = swapPairs(look, pal).map(([f, t]) => ({ f: toHsl(f), t: toHsl(t) }));
  const prot = [look.hair, look.beard, look.skin ?? SKIN, SKIN2, '#ffe0c8', '#c88068'].filter((c): c is string => !!c).map(toHsl);
  let person = 0;
  let changed = 0;
  const perPair = pairs.map(() => 0);
  // 1) 칸마다 가장 가까운 원래 옷 색 (피부·머리에 더 가까우면 · 아주 어둡거나 밝은 칸(외곽선·빛)이면 -1)
  const cls = new Int8Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) {
    if (bg[i] || px[i * 4 + 3] < 8) continue;
    person++;
    const [r, g, b] = rgbAt(i);
    const p = hsl(r, g, b);
    if (p[2] < 0.1 || p[2] > 0.95) continue;
    let bi = -1;
    let bd = Infinity;
    pairs.forEach((pp, k) => {
      const d = hdist(p, pp.f);
      if (d < bd) (bd = d), (bi = k);
    });
    if (bi < 0 || bd > C.maxDist) continue;
    if (prot.some((h) => hdist(p, h) <= bd)) continue;
    cls[i] = bi;
  }
  // 2) 점처럼 흩어진 칸은 뺀다 (이웃 8칸 중 같은 옷 색이 3칸 미만) → 3) 작은 덩어리(minRegion 칸 미만)도 뺀다
  const keep = new Int8Array(cls);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (cls[i] < 0) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H && cls[i + dy * W + dx] === cls[i]) n++;
      if (n < 3) keep[i] = -1;
    }
  const seen = new Uint8Array(W * H);
  for (let i0 = 0; i0 < W * H; i0++) {
    if (keep[i0] < 0 || seen[i0]) continue;
    const comp = [i0];
    seen[i0] = 1;
    for (let k = 0; k < comp.length; k++) {
      const i = comp[k];
      const x = i % W;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= W * H || seen[j] || keep[j] !== keep[i0] || (j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        seen[j] = 1;
        comp.push(j);
      }
    }
    if (comp.length < C.minRegion) for (const i of comp) keep[i] = -1;
  }
  for (let i = 0; i < W * H; i++) {
    const bi = keep[i];
    if (bi < 0) continue;
    const [r, g, b] = rgbAt(i);
    const p = hsl(r, g, b);
    const { f, t } = pairs[bi];
    // 밝기 순서 그대로: 원래 옷 색보다 밝은 만큼 새 색에서도 밝게 · 채도는 비율로
    const l = Math.max(0.04, Math.min(0.96, t[2] + (p[2] - f[2]) * 0.8));
    const s = Math.max(0, Math.min(1, f[1] > 0.05 ? t[1] * Math.min(1.6, Math.max(0.4, p[1] / f[1])) : t[1]));
    const [nr, ng, nb] = hslToRgb(t[0], s, l);
    px[i * 4] = nr;
    px[i * 4 + 1] = ng;
    px[i * 4 + 2] = nb;
    changed++;
    perPair[bi]++;
  }
  ctx.putImageData(im, 0, 0);
  if (stat) {
    stat.changed = person ? changed / person : 0;
    stat.perPair = perPair;
  }
  return cv;
}

/** 초상화 대신 테두리만 (색이 깔끔하게 안 옮겨지는 초상화 · LUXE_OUTFITS.portrait.frameOnly) — 바깥 2px을 의상 장식 색으로 */
export function framePortrait(img: CanvasImageSource & { width: number; height: number }, pal: OutfitPalette): HTMLCanvasElement {
  const cv = canvas(img.width, img.height);
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = mix(pal.accent, SHADOW, 0.35);
  ctx.fillRect(0, 0, cv.width, 2), ctx.fillRect(0, cv.height - 2, cv.width, 2), ctx.fillRect(0, 0, 2, cv.height), ctx.fillRect(cv.width - 2, 0, 2, cv.height);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(1, 1, cv.width - 2, 1), ctx.fillRect(1, cv.height - 2, cv.width - 2, 1), ctx.fillRect(1, 1, 1, cv.height - 2), ctx.fillRect(cv.width - 2, 1, 1, cv.height - 2);
  return cv;
}
