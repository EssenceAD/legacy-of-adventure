// 몬스터 그림: public/assets/mon/{id}/sheet.png + meta.json (프레임 크기 · 애니메이션별 줄과 프레임 수 · 바닥 기준점)
//  1차는 코드로 그린 임시 도트(tools/mon_gen.html), 2차에 유료 도트로 그림만 갈아 끼운다. 그림은 오른쪽을 본다.
import { av } from '../engine/ver';
export interface MonAnim {
  row: number;
  frames: number;
  fps: number;
  loop: boolean;
}
export interface MonMeta {
  frameW: number;
  frameH: number;
  /** 바닥 기준점 (프레임 왼쪽 위 기준) */
  anchor: [number, number];
  anims: Record<string, MonAnim>;
}
export interface MonSheet {
  meta: MonMeta;
  /** [애니메이션][프레임] → 오른쪽 · 왼쪽(반전) · 하얀 실루엣 */
  frames: Record<string, { r: HTMLCanvasElement; l: HTMLCanvasElement; w: HTMLCanvasElement }[]>;
}

const cache: Record<string, Promise<MonSheet | null>> = {};
const cut = (src: CanvasImageSource, sx: number, sy: number, w: number, h: number, flip = false, white = false) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  if (flip) {
    x.translate(w, 0);
    x.scale(-1, 1);
  }
  x.drawImage(src, sx, sy, w, h, 0, 0, w, h);
  if (white) {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, w, h);
  }
  return c;
};

export function loadMon(id: string): Promise<MonSheet | null> {
  return (cache[id] ??= (async () => {
    try {
      const meta = (await (await fetch(av(`assets/mon/${id}/meta.json`))).json()) as MonMeta;
      // decode()는 화면이 숨어 있으면 끝나지 않는다 → onload로
      const im = await new Promise<HTMLImageElement>((ok, fail) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = fail;
        i.src = av(`assets/mon/${id}/sheet.png`);
      });
      const frames: MonSheet['frames'] = {};
      for (const [name, a] of Object.entries(meta.anims)) {
        frames[name] = [];
        for (let i = 0; i < a.frames; i++) {
          const sx = i * meta.frameW;
          const sy = a.row * meta.frameH;
          frames[name].push({ r: cut(im, sx, sy, meta.frameW, meta.frameH), l: cut(im, sx, sy, meta.frameW, meta.frameH, true), w: cut(im, sx, sy, meta.frameW, meta.frameH, false, true) });
        }
      }
      return { meta, frames };
    } catch {
      return null;
    }
  })());
}

/** t초째 프레임 번호 (반복 안 하는 애니메이션은 마지막에서 멈춤) */
export function frameAt(a: MonAnim, t: number): number {
  const i = Math.floor(t * a.fps);
  return a.loop ? i % a.frames : Math.min(a.frames - 1, i);
}

/** 캐릭터 그림의 하얀 실루엣 (피격 번쩍임) */
const WHITE = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
export function whiteOf(c: HTMLCanvasElement): HTMLCanvasElement {
  let w = WHITE.get(c);
  if (!w) {
    w = cut(c, 0, 0, c.width, c.height, false, true);
    WHITE.set(c, w);
  }
  return w;
}
/** 좌우 반전 (캐릭터) */
const FLIPPED = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
export function flipOf(c: HTMLCanvasElement): HTMLCanvasElement {
  let f = FLIPPED.get(c);
  if (!f) {
    f = cut(c, 0, 0, c.width, c.height, true);
    FLIPPED.set(c, f);
  }
  return f;
}


