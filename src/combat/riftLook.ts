// RAIDWEAPON §3' 하늘 균열 보스 그림 — 새 그림 없이 기존 보스 시트를 키우고(scale) · 색을 돌리고(hue · sat) · 보라 오라(바깥 2줄)를 둘러서 새 시트로
//  만든 시트는 sheets['rift_' + look] 에 넣고, startCombat 은 rift_ 로 시작하는 id 가 이미 있으면 다시 부르지 않는다
import { CONFIG } from '../data/config';
import type { BossLook } from './mons';
import { loadMon, type MonSheet } from './mon';
import { sheets } from './draw';

const PAD = 3;
const AURA = [162, 75, 255];

/** RGB(0~255) → 색상 hue 를 deg 만큼 돌리고 채도 × sat */
export function shiftColor(r: number, g: number, b: number, deg: number, sat: number): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
  const l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h /= 6;
  }
  h = (((h + deg / 360) % 1) + 1) % 1;
  s = Math.max(0, Math.min(1, s * sat));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    t = ((t % 1) + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return s === 0 ? [Math.round(l * 255), Math.round(l * 255), Math.round(l * 255)] : [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** 프레임 하나: 키우기(가장 가까운 점) → 색 돌리기 → 보라 오라 */
function riftFrame(src: HTMLCanvasElement, scale: number, deg: number, sat: number): HTMLCanvasElement {
  const w = Math.round(src.width * scale), h = Math.round(src.height * scale);
  const sx = src.getContext('2d')!.getImageData(0, 0, src.width, src.height).data;
  const out = mk(w + PAD * 2, h + PAD * 2);
  const x = out.getContext('2d')!;
  const img = x.createImageData(out.width, out.height);
  const d = img.data;
  const solid = new Uint8Array(out.width * out.height);
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const si = (Math.min(src.height - 1, Math.floor(yy / scale)) * src.width + Math.min(src.width - 1, Math.floor(xx / scale))) * 4;
      const a = sx[si + 3];
      if (a < 8) continue;
      const [r, g, b] = shiftColor(sx[si], sx[si + 1], sx[si + 2], deg, sat);
      const k = (yy + PAD) * out.width + xx + PAD;
      d[k * 4] = r;
      d[k * 4 + 1] = g;
      d[k * 4 + 2] = b;
      d[k * 4 + 3] = a;
      solid[k] = 1;
    }
  // 오라: 그림 바깥 1줄 진하게 · 2줄 옅게 (보라)
  for (const [ring, alpha] of [[1, 170], [2, 80]] as const)
    for (let yy = 0; yy < out.height; yy++)
      for (let xx = 0; xx < out.width; xx++) {
        const k = yy * out.width + xx;
        if (solid[k] || d[k * 4 + 3]) continue;
        let near = false;
        for (let dy = -ring; dy <= ring && !near; dy++)
          for (let dx = -ring; dx <= ring && !near; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > ring) continue;
            const nx = xx + dx, ny = yy + dy;
            if (nx >= 0 && ny >= 0 && nx < out.width && ny < out.height && solid[ny * out.width + nx]) near = true;
          }
        if (!near) continue;
        d[k * 4] = AURA[0];
        d[k * 4 + 1] = AURA[1];
        d[k * 4 + 2] = AURA[2];
        d[k * 4 + 3] = alpha;
      }
  x.putImageData(img, 0, 0);
  return out;
}
const flip = (c: HTMLCanvasElement) => {
  const o = mk(c.width, c.height);
  const x = o.getContext('2d')!;
  x.translate(c.width, 0);
  x.scale(-1, 1);
  x.drawImage(c, 0, 0);
  return o;
};
const white = (c: HTMLCanvasElement) => {
  const o = mk(c.width, c.height);
  const x = o.getContext('2d')!;
  x.drawImage(c, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, c.width, c.height);
  return o;
};

/** 바탕 시트 → 균열 시트 */
export function makeRiftSheet(base: MonSheet, scale: number, deg: number, sat: number): MonSheet {
  const frames: MonSheet['frames'] = {};
  for (const [name, list] of Object.entries(base.frames))
    frames[name] = list.map((f) => {
      const r = riftFrame(f.r, scale, deg, sat);
      return { r, l: flip(r), w: white(r) };
    });
  const m = base.meta;
  const meta = {
    ...m,
    frameW: Math.round(m.frameW * scale) + PAD * 2,
    frameH: Math.round(m.frameH * scale) + PAD * 2,
    anchor: [Math.round(m.anchor[0] * scale) + PAD, Math.round(m.anchor[1] * scale) + PAD] as [number, number],
    ...(m.eyes ? { eyes: m.eyes.map(([ex, ey]) => [Math.round(ex * scale) + PAD, Math.round(ey * scale) + PAD] as [number, number]) } : {}),
  };
  return { meta, frames };
}

/** 균열 보스 모습 (서버 look 키 → config) — 그림은 rift_{look} */
export function riftLook(look: string): BossLook {
  const B = CONFIG.raidWeapon.world.bosses;
  const c = B[look] ?? B.sky;
  const key = B[look] ? look : 'sky';
  return { id: `rift_${key}`, name: `균열 너머의 ${c.name}`, pats: ['균열 돌진', '별빛 내려찍기', '그림자 부르기'], r: c.r, minion: c.minion };
}

/** 균열 보스 시트를 미리 만들어 sheets 에 넣는다 (이미 있으면 그대로) — 실패하면 false (그땐 startCombat 이 예비 그림) */
export async function prepRiftSheet(look: string): Promise<boolean> {
  const B = CONFIG.raidWeapon.world.bosses;
  const key = B[look] ? look : 'sky';
  const id = `rift_${key}`;
  if (sheets[id]) return true;
  const c = B[key];
  const base = await loadMon(c.base);
  if (!base) return false;
  try {
    sheets[id] = makeRiftSheet(base, c.scale, c.hue, c.sat);
    return true;
  } catch {
    return false;
  }
}
