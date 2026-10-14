// LUXE §1 명품관 장식 연출 (그림 1장 + 코드 움직임 · asset_raw/luxe/README.md 표)
//  render.ts drawObj가 건물을 그리는 자리(깊이 순서)에서 부른다 → 앞 건물이 나중에 그려지며 빛·반짝이를 가린다 (v0.25.24 밤 불빛 가림과 같은 길)
//  몸통 움직임(깃발·그네·책·회전목마·열기구·알·오로라)은 drawLuxeBody가 원래 drawImage 대신 그린다
import { canvas, hsl, hslToRgb } from '../engine/pixel';
import { view } from '../engine/iso';
import { saverOn } from '../engine/fps';
import { floatW, puff } from './fx';
import { luxeSetOf } from './luxeShop';
import { S, world, type Building } from './state';

type Im = CanvasImageSource & { width: number; height: number };

/** 움직임 줄이기: 기기 「동작 줄이기」(한 번만 봄) · 배터리 절약 → 몸통 움직임·입자 멈춤 (빛은 그대로) */
let rm: boolean | null = null;
function calmOn(): boolean {
  if (rm === null)
    try {
      rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      rm = false;
    }
  return rm || saverOn();
}

/** 원래 drawImage 대신 그리는 것 (몸통이 움직이는 장식) */
export const LX_BODY = new Set(['flag_pole', 'flower_swing', 'flower_carousel', 'float_books', 'sky_balloon', 'aurora_pillar', 'dragon_nest']);

/** 오로라 기둥: 색상 회전 그림 (그림마다 8단계 · 그때그때 만들어 둔다) */
const HUES = 8;
const hueCache = new WeakMap<object, (HTMLCanvasElement | undefined)[]>();
function hueStep(im: Im, i: number): Im {
  let arr = hueCache.get(im);
  if (!arr) hueCache.set(im, (arr = []));
  if (arr[i]) return arr[i]!;
  const c = canvas(im.width, im.height);
  const x = c.getContext('2d');
  if (!x) return im;
  try {
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    const D = d.data;
    for (let j = 0; j < D.length; j += 4) {
      if (!D[j + 3]) continue;
      const [h, s, l] = hsl(D[j], D[j + 1], D[j + 2]);
      if (s < 0.2) continue;
      const [r, g, b] = hslToRgb((h + (i * 360) / HUES) % 360, s, l);
      D[j] = r;
      D[j + 1] = g;
      D[j + 2] = b;
    }
    x.putImageData(d, 0, 0);
  } catch {
    return im;
  }
  arr[i] = c;
  return c;
}

/** 몸통 움직임 (x, y = 그림 왼쪽 위 화면 px) */
export function drawLuxeBody(ctx: CanvasRenderingContext2D, o: Building, im: Im, x: number, y: number) {
  const T = calmOn() ? 0 : S.T;
  const w = im.width;
  const h = im.height;
  const ph = o.tx * 1.7 + o.ty * 0.9;
  switch (o.kind) {
    case 'flag_pole': {
      // 깃발 천(기둥 오른쪽)만 세로로 1px 물결 — 기둥에서 멀수록 크게 · 아래 바닥판은 그대로
      const cut = Math.round(h * 0.85);
      const pole = Math.round(w * 0.3);
      const flip = o.flip;
      ctx.drawImage(im, 0, cut, w, h - cut, x, y + cut, w, h - cut);
      const px0 = flip ? w - pole : 0;
      ctx.drawImage(im, px0, 0, pole, cut, x + px0, y, pole, cut);
      for (let c = 0; c < w - pole; c++) {
        const sx0 = flip ? w - pole - 1 - c : pole + c;
        const k = Math.min(1, (c + 1) / 6);
        const dy = Math.round(Math.sin(T * 4 - c * 0.55 + ph) * k);
        ctx.drawImage(im, sx0, 0, 1, cut, x + sx0, y + dy, 1, cut);
      }
      return;
    }
    case 'flower_swing': {
      // 그네(가운데 ⅓ ~ ⅔ · 위 20%~75%)만 좌우 ±1px
      ctx.drawImage(im, x, y);
      const dx = Math.round(Math.sin(T * 2.4 + ph));
      if (!dx) return;
      const x0 = Math.round(w * 0.36);
      const x1 = Math.round(w * 0.8);
      const y0 = Math.round(h * 0.2);
      const y1 = Math.round(h * 0.72);
      ctx.drawImage(im, x0, y0, x1 - x0, y1 - y0, x + x0 + dx, y + y0, x1 - x0, y1 - y0);
      return;
    }
    case 'flower_carousel':
      // 위아래 1px 통통 (돌아가는 느낌)
      ctx.drawImage(im, x, y - (Math.sin(T * 5 + ph) > 0.3 ? 1 : 0));
      return;
    case 'float_books': {
      // 책 부분(위 60%)만 위아래 둥실 · 받침은 그대로
      const cut = Math.round(h * 0.6);
      const dy = Math.round(Math.sin(T * 2 + ph) * 1.4);
      ctx.drawImage(im, 0, cut, w, h - cut, x, y + cut, w, h - cut);
      ctx.drawImage(im, 0, 0, w, cut, x, y + dy - 1, w, cut);
      return;
    }
    case 'sky_balloon':
      // 전체 위아래 2px 둥실
      ctx.drawImage(im, x, y + Math.round(Math.sin(T * 1.3 + ph) * 2) - 1);
      return;
    case 'aurora_pillar':
      // 색상 회전 (천천히 · 8단계)
      ctx.drawImage(hueStep(im, Math.floor(T / 0.9 + ph) % HUES), x, y);
      return;
    case 'dragon_nest': {
      ctx.drawImage(im, x, y);
      // 5초마다 0.6초: 오른쪽 알이 들썩 (±1px)
      const t = (T + ph) % 5;
      if (t > 0.6) return;
      const dx = Math.sin(t * 30) > 0 ? 1 : -1;
      const ex = o.flip ? Math.round(w - 37) : 28;
      ctx.drawImage(im, ex, 19, 9, 11, x + ex + dx, y + 19, 9, 11);
      return;
    }
  }
  ctx.drawImage(im, x, y);
}

/** 밤 빛 한 점 (lighter) */
function lamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rgb: string, a: number) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}
/** 반짝 점 (십자 3px) */
function twinkle(ctx: CanvasRenderingContext2D, X: number, Y: number, c: string, big = false) {
  X = Math.round(X);
  Y = Math.round(Y);
  ctx.fillStyle = c;
  ctx.fillRect(X, Y, 1, 1);
  if (!big) return;
  ctx.fillRect(X - 1, Y, 3, 1);
  ctx.fillRect(X, Y - 1, 1, 3);
}
const RAINBOW = ['#ff8a8a', '#ffc46b', '#fff27a', '#8ff09a', '#8ad4ff', '#c8a2ff'];
const arch = new WeakMap<Building, number>();

/** 빛·반짝이·입자 (그림을 그린 직후) — night 0~1 */
export function drawLuxeFx(ctx: CanvasRenderingContext2D, o: Building, x: number, y: number, im: { width: number; height: number }, night: number) {
  const T = S.T;
  const calm = calmOn();
  const w = im.width;
  const h = im.height;
  const fx = (f: number) => x + w * (o.flip ? 1 - f : f);
  // 그림 위 자리 → 입자 좌표 (월드 원점 기준 논리 px)
  const wx = (X: number) => X - view.OX;
  const wy = (Y: number) => Y - view.OY;
  switch (o.kind) {
    case 'moon_lantern':
      if (night > 0.15) lamp(ctx, fx(0.5), y + h * 0.2, 22, '150,200,255', 0.45 * night);
      break;
    case 'moon_gazebo':
      if (night > 0.15) for (const f of [0.22, 0.5, 0.78]) lamp(ctx, fx(f), y + h * 0.61, 16, '160,205,255', 0.42 * night);
      break;
    case 'star_library':
      if (night > 0.15) lamp(ctx, fx(0.45), y + h * 0.55, 30, '255,205,120', 0.45 * night);
      break;
    case 'star_telescope':
      if (night > 0.2 && (T * 1.3 + o.tx) % 3 < 0.5) twinkle(ctx, fx(0.12), y + 4, '#fffbe0', true);
      break;
    case 'moon_pond':
      // 물 반짝이 (기존 연못 반짝이와 같은 점 · 은빛)
      if (!calm && Math.random() < 0.16) twinkle(ctx, x + w * (0.2 + Math.random() * 0.6), y + h * (0.25 + Math.random() * 0.35), Math.random() < 0.5 ? '#e8f6ff' : '#cfe0ff');
      break;
    case 'hero_trainer':
      // 4초마다 칼끝 번쩍
      if ((T + o.tx) % 4 < 0.35) twinkle(ctx, fx(0.3), y + 2, '#fff8d0', true);
      break;
    case 'victory_arch': {
      // 아치 밑·곁을 지나가는 손님 머리 위 ♪ (가끔)
      if (S.visiting || calm) break;
      const next = arch.get(o) ?? 0;
      if (T < next) break;
      const a = world.actors.find((p) => !p.hidden && !p.role && p.id && Math.abs(p.x - (o.tx + o.fw / 2)) <= o.fw / 2 + 0.6 && Math.abs(p.y - (o.ty + o.fh / 2)) <= o.fh / 2 + 0.6);
      if (a && Math.random() < 0.5) floatW(a.x, a.y, 34, '♪');
      arch.set(o, T + (a ? 3 : 0.5));
      break;
    }
    case 'flower_tower':
      // 꽃잎 입자
      if (!calm && Math.random() < 0.05) puff(wx(x + w * (0.2 + Math.random() * 0.6)), wy(y + h * 0.15), ['#ffb3c7', '#ffe08a', '#fff'][(Math.random() * 3) | 0], (Math.random() - 0.5) * 8, 6, 1.4, 1);
      break;
    case 'flower_carousel':
      // 음악 입자
      if (!calm && Math.random() < 0.025) puff(wx(x + w * (0.25 + Math.random() * 0.5)), wy(y + h * 0.2), '#ffd6e4', (Math.random() - 0.5) * 6, -10, 1.2, 2);
      break;
    case 'armillary':
      if (!calm && Math.random() < 0.18) twinkle(ctx, x + w * (0.15 + Math.random() * 0.7), y + h * (0.05 + Math.random() * 0.55), Math.random() < 0.5 ? '#fff3c0' : '#ffffff', Math.random() < 0.2);
      break;
    case 'gold_carriage':
      if (!calm && Math.random() < 0.14) twinkle(ctx, x + w * (0.1 + Math.random() * 0.8), y + h * (0.05 + Math.random() * 0.6), '#ffe9a0', Math.random() < 0.25);
      if (night > 0.2) lamp(ctx, x + w / 2, y + h * 0.45, w * 0.55, '255,211,107', 0.25 * night);
      break;
    case 'rainbow_fountain':
      // 물 입자 (무지개색) — 분수 꼭대기에서 위로 튀었다 떨어진다
      if (!calm && Math.random() < 0.25) puff(wx(fx(0.5) + (Math.random() - 0.5) * 10), wy(y + h * 0.12), RAINBOW[(Math.random() * RAINBOW.length) | 0], (Math.random() - 0.5) * 14, -14 - Math.random() * 6, 0.9, 1);
      break;
    case 'turtle_statue': {
      // 가끔 눈 깜빡 (6초마다 0.15초 · 눈꺼풀 색으로 가리기)
      if ((T + o.ty) % 6 > 0.15) break;
      const ex = o.flip ? w - 18 : 13;
      ctx.fillStyle = '#77754a';
      ctx.fillRect(Math.round(x + ex), Math.round(y + 43), 5, 3);
      ctx.fillStyle = '#3e3b33';
      ctx.fillRect(Math.round(x + ex), Math.round(y + 46), 5, 1);
      break;
    }
    case 'aurora_pillar':
      if (night > 0.15) lamp(ctx, x + w / 2, y + h * 0.35, 18, '140,255,210', 0.3 * night);
      break;
  }
  // 세트 완성: 은은한 반짝이 (세트 장식마다 · 시각으로 정해진 자리라 깜빡이지 않고 반짝)
  if (luxeSetOf(o)) {
    const step = Math.floor(T * 2.2);
    for (let i = 0; i < 2; i++) {
      const s = (o.tx * 73 + o.ty * 151 + i * 97 + step * 31) % 997;
      if (calm && i) break;
      twinkle(ctx, x + w * (0.1 + ((s % 100) / 100) * 0.8), y + h * (0.05 + (((s / 100) | 0) % 10) / 14), i ? '#fff6c8' : '#ffe08a', (step + i) % 3 === 0);
    }
  }
}
