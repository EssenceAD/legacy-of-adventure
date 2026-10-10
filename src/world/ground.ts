// 바닥 타일, 흙길, 울타리, 숲(야생 나무). 땅이나 길이 바뀔 때만 다시 그려 캐시한다.
import { BAYER, canvas, P, rng } from '../engine/pixel';
import { N, sx, sy, TH, TW } from '../engine/iso';
import { curLand, groundVersion, inLand, landBounds, pathT } from './town';

/** 맵 밖으로 숲을 몇 칸 더 그릴지 (배율 1에서도 화면이 비지 않게) */
const M = 8;

export interface Wild {
  x: number;
  y: number;
  k: 'pine' | 'tree';
}

export const ground = {
  c: null as HTMLCanvasElement | null,
  ox: 0,
  oy: 0,
  key: '',
  wild: [] as Wild[],
};

/** 필요할 때만 다시 그린다 */
export function ensureGround(visitKey: string) {
  const key = `${curLand()}|${groundVersion}|${visitKey}`;
  if (ground.c && ground.key === key) return;
  ground.key = key;
  drawGround();
}

function drawGround() {
  const W = N * TW + TW * 2 * M;
  const H = N * TH + TH * 2 * M;
  const c = canvas(W, H);
  const p = P(c.getContext('2d')!);
  const ox = W / 2;
  const oy = TH * M;
  const r = rng(11);
  // 맵 밖 숲 바닥
  p.rect(0, 0, W, H, '#3e6a34');
  for (let i = 0; i < 500; i++) p.px((r() * W) | 0, (r() * H) | 0, '#4a7a3c');
  const isPath = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && pathT.has(y * N + x);
  for (let y = -M; y < N + M; y++)
    for (let x = -M; x < N + M; x++) {
      const X = ox + sx(x, y);
      const Y = oy + sy(x, y);
      const land = inLand(x, y);
      const inMap = x >= 0 && y >= 0 && x < N && y < N;
      const path = isPath(x, y);
      const v = (x * 7 + y * 13) % 5;
      let a: string;
      let b: string;
      if (path) {
        a = '#c99a5e';
        b = '#b8864e';
      } else if (land) {
        a = v < 2 ? '#78b84a' : '#6fae45';
        b = '#5f9a3c';
      } else if (inMap) {
        a = '#58894a';
        b = '#4c7a42';
      } else {
        a = '#476f3c';
        b = '#3e6a34';
      }
      for (let j = 0; j < TH; j++) {
        const hw = (j < TH / 2 ? j + 1 : TH - j) * 2;
        for (let i = -hw; i < hw; i++) {
          const px = X + i;
          const py = Y + j;
          p.px(px, py, BAYER[py & 3][(px + 64) & 3] < 3 ? b : a);
        }
      }
      if (land && !path && r() < 0.35) p.px(X + ((r() * 16 - 8) | 0), Y + 4 + ((r() * 8) | 0), '#9ad860');
      if (land && !path && r() < 0.08) p.px(X + ((r() * 16 - 8) | 0), Y + 4 + ((r() * 8) | 0), ['#ffd36b', '#ff9fbf', '#ffffff'][(r() * 3) | 0]);
      if (path && r() < 0.3) p.px(X + ((r() * 12 - 6) | 0), Y + 5 + ((r() * 6) | 0), '#e0bb83');
    }

  // 야생 나무: 울타리 밖. 바로 바깥 1칸(뒤쪽)·2칸(앞쪽)은 공터로 비운다
  const [la, lb] = landBounds();
  const wr = rng(23);
  const wild: Wild[] = [];
  for (let y = -M; y < N + M; y++)
    for (let x = -M; x < N + M; x++) {
      const v = wr();
      const k = wr() < 0.6 ? 'pine' : 'tree';
      if (inLand(x, y)) continue;
      const back = x < la - 1 || y < la - 1;
      const frontGap = (x >= lb && x < lb + 2) || (y >= lb && y < lb + 2);
      const sideGap = x === la - 1 || y === la - 1;
      if (sideGap || (!back && frontGap && !(x >= lb + 2 || y >= lb + 2))) continue;
      if (isPath(x, y)) continue; // 던전 가는 길 위엔 나무 없음
      const inMap = x >= 0 && y >= 0 && x < N && y < N;
      if (v < (inMap ? 0.3 : 0.36)) wild.push({ x, y, k });
    }
  ground.wild = wild;

  // 울타리 (땅 경계). 길이 울타리를 지나가는 자리는 비워 둔다(문)
  const [A, B] = landBounds();
  const post = (x: number, y: number) => {
    const X = ox + sx(x, y);
    const Y = oy + sy(x, y);
    p.rect(X - 1, Y - 7, 2, 7, '#7a4a2a');
    p.px(X - 1, Y - 8, '#a06a3c');
  };
  /** 경계선의 한 점에서 안쪽·바깥쪽 칸이 둘 다 길이면 문 */
  const gate = (x: number, y: number, horizontal: boolean, outsideBefore: boolean) => {
    if (horizontal) {
      const tx = Math.floor(x);
      return isPath(tx, outsideBefore ? y - 1 : y) && isPath(tx, outsideBefore ? y : y - 1);
    }
    const ty = Math.floor(y);
    return isPath(outsideBefore ? x - 1 : x, ty) && isPath(outsideBefore ? x : x - 1, ty);
  };
  const rail = (x0: number, y0: number, x1: number, y1: number, horizontal: boolean, outsideBefore: boolean) => {
    const n = 24;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if (gate(x, y, horizontal, outsideBefore)) continue;
      const X = (ox + sx(x, y)) | 0;
      const Y = (oy + sy(x, y)) | 0;
      p.px(X, Y - 5, '#a06a3c');
      p.px(X, Y - 3, '#8a5a34');
    }
  };
  for (let i = A; i <= B; i++) {
    post(i, A);
    post(A, i);
    post(i, B);
    post(B, i);
  }
  rail(A, A, B, A, true, true); // 뒤쪽 (y=A): 바깥은 y-1
  rail(A, A, A, B, false, true); // 왼쪽 뒤 (x=A)
  rail(A, B, B, B, true, false); // 앞쪽 (y=B): 바깥은 y
  rail(B, A, B, B, false, false); // 오른쪽 앞 (x=B)
  ground.c = c;
  ground.ox = ox;
  ground.oy = oy;
}
