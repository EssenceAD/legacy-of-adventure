// 10/16 에펨 「이름표 글자가 흐려요」 — 마을 캔버스(저해상도 → CSS로 view.SC배 확대) 위 글자를 도트처럼 또렷하게
//  원인: ① 캔버스 글자는 늘 안티앨리어싱(가장자리 반투명)이라 확대하면 뿌옇다 ② Galmuri9는 10px 격자 글꼴인데 8px로 줄여 그려 획이 칸 사이에 걸쳤다
//  지금: 10px로 오프스크린에 그려 알파 50% 문턱으로 딱 떨어지게(글자·테두리 따로) → 글자·색·테두리별로 캐시 → 정수 칸에 drawImage
//  플래그 pixText를 끄면 같은 크기·자리에 예전처럼 fillText (끄기 스위치)
import { flag } from './flags';

export const PIX_PX = 10;
const FONT = (px: number) => `${px}px "Galmuri9"`;

export interface PixOpt {
  color: string;
  /** 테두리 색 (없으면 테두리 없음) */
  shadow?: string;
  /** 테두리를 찍을 자리 (기본: 오른쪽 아래 · 왼쪽 아래 · 아래 2칸 — 예전 이름표 3번 찍기) */
  offs?: readonly (readonly [number, number])[];
  align?: 'left' | 'center';
  baseline?: 'alphabetic' | 'top' | 'middle';
  px?: number;
}
export const SHADOW3 = [[1, 1], [-1, 1], [0, 2]] as const;
export const OUTLINE4 = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

let mc: CanvasRenderingContext2D | null = null;
const measureCtx = () => (mc ??= document.createElement('canvas').getContext('2d')!);
const wCache = new Map<string, number>();
/** 글자 폭 (정수 · 10px 기준) */
export function pixW(text: string, px = PIX_PX): number {
  const k = px + '|' + text;
  let w = wCache.get(k);
  if (w == null) {
    const c = measureCtx();
    c.font = FONT(px);
    w = Math.ceil(c.measureText(text).width);
    if (fontReady(px)) {
      if (wCache.size > 2000) wCache.clear();
      wCache.set(k, w);
    }
  }
  return w;
}
const fontReady = (px: number) => {
  try {
    return document.fonts.check(FONT(px));
  } catch {
    return true;
  }
};

interface Sprite {
  c: HTMLCanvasElement;
  /** 기준점(정렬·글자 기준선)이 그림 안 어디인가 */
  ax: number;
  ay: number;
}
const cache = new Map<string, Sprite>();
const PAD = 3;

/** 알파 문턱 마스크를 color로 칠해 dst에 겹친다 */
function stamp(dst: CanvasRenderingContext2D, tmp: CanvasRenderingContext2D, W: number, H: number, color: string, draw: (t: CanvasRenderingContext2D) => void) {
  tmp.globalCompositeOperation = 'source-over';
  tmp.clearRect(0, 0, W, H);
  tmp.fillStyle = '#fff';
  draw(tmp);
  const img = tmp.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
  tmp.putImageData(img, 0, 0);
  tmp.globalCompositeOperation = 'source-in';
  tmp.fillStyle = color;
  tmp.fillRect(0, 0, W, H);
  tmp.globalCompositeOperation = 'source-over';
  dst.drawImage(tmp.canvas, 0, 0);
}

function build(text: string, o: PixOpt): Sprite {
  const px = o.px ?? PIX_PX;
  const w = pixW(text, px);
  const W = w + PAD * 2;
  const H = px + PAD * 2 + 3;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  const t = document.createElement('canvas');
  t.width = W;
  t.height = H;
  const tc = t.getContext('2d', { willReadFrequently: true })!;
  const base = o.baseline ?? 'alphabetic';
  const ax = PAD + (o.align === 'center' ? w / 2 : 0);
  const ay = base === 'top' ? PAD : base === 'middle' ? PAD + Math.round(px / 2) : PAD + px - 1;
  tc.font = FONT(px);
  // 그림 안에서는 늘 왼쪽 정렬 · 정수 칸에서 그린다 (가운데 정렬은 놓을 때만 — 반 칸에 걸쳐 획이 굵어졌다 가늘어졌다 하지 않게)
  tc.textAlign = 'left';
  tc.textBaseline = base;
  if (o.shadow) stamp(x, tc, W, H, o.shadow, (y) => { for (const [dx, dy] of o.offs ?? SHADOW3) y.fillText(text, PAD + dx, ay + dy); });
  stamp(x, tc, W, H, o.color, (y) => y.fillText(text, PAD, ay));
  return { c, ax, ay };
}

/**
 * 마을 캔버스에 글자 (예전 ctx.fillText + 테두리 여러 번 대신). (x, y) = 정렬·기준선 기준점 · 그린 폭을 돌려준다.
 *  ctx.globalAlpha는 그대로 따른다
 */
export function pixText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: PixOpt): number {
  if (!text) return 0;
  const px = o.px ?? PIX_PX;
  if (!flag('pixText')) {
    ctx.font = FONT(px);
    ctx.textAlign = o.align === 'center' ? 'center' : 'left';
    ctx.textBaseline = o.baseline ?? 'alphabetic';
    if (o.shadow) {
      ctx.fillStyle = o.shadow;
      for (const [dx, dy] of o.offs ?? SHADOW3) ctx.fillText(text, x + dx, y + dy);
    }
    ctx.fillStyle = o.color;
    ctx.fillText(text, x, y);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    return pixW(text, px);
  }
  const k = `${px}|${o.align ?? 'l'}|${o.baseline ?? 'a'}|${o.color}|${o.shadow ?? ''}|${o.shadow ? JSON.stringify(o.offs ?? SHADOW3) : ''}|${text}`;
  let s = cache.get(k);
  if (!s) {
    s = build(text, o);
    // 글꼴이 아직 안 왔으면(대체 글꼴로 그려짐) 캐시하지 않는다 — 다음 프레임에 다시
    if (fontReady(px)) {
      if (cache.size > 800) cache.clear();
      cache.set(k, s);
    }
  }
  ctx.drawImage(s.c, Math.round(x - s.ax), Math.round(y - s.ay));
  return pixW(text, px);
}

/** 시험용: 캐시 크기 */
export const _pixCacheSize = () => cache.size;
