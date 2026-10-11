// 바닥 타일, 흙길, 울타리, 숲(야생 나무). 땅이나 길이 바뀔 때만 다시 그려 캐시한다.
import { CONFIG } from '../data/config';
import { BAYER, canvas, P, rng } from '../engine/pixel';
import { IMG } from '../engine/assets';
import { def } from '../data/catalog';
import { world } from './state';
import { N, sx, sy, TH, TW } from '../engine/iso';
import { curLand, entrance, groundVersion, inLand, landBounds, pathT } from './town';
import { gradeFolk, gradeNow, gradeProps, outerRoad } from './grade';

/** 맵 밖으로 숲을 몇 칸 더 그릴지 (배율 1에서도 화면이 비지 않게) */
const M = CONFIG.UI_SCALE.groundRing;

export interface Wild {
  x: number;
  y: number;
  k: 'pine' | 'tree' | 'sapling' | 'stump' | 'expand_sign';
}

export interface Ground {
  c: HTMLCanvasElement | null;
  ox: number;
  oy: number;
  key: string;
  wild: Wild[];
  /** 땅 개편 §8: 땅보다 앞에 있는 굽힌 나무 (건물·손님 다음에 그린다) */
  front?: HTMLCanvasElement | null;
}
export const ground: Ground = { c: null, ox: 0, oy: 0, key: '', wild: [] };
/** 마을 등급이 바뀌는 연출 동안 앞뒤 두 장을 같이 쓴다 */
const cache = new Map<string, Ground>();

export const groundKey = (visitKey: string, g: number) => `${curLand()}|${groundVersion}|${visitKey ? 'v:' + visitKey : ''}|g${g}`;
/** 땅 개편: 땅 넓히기 팻말 칸 (최대 크기면 없음) */
export function signSpot(): [number, number] | null {
  if (curLand() >= CONFIG.land.length) return null;
  const [a, b] = landBounds();
  return [a - 1, Math.floor((a + b) / 2)];
}
/** 필요할 때만 다시 그린다 (등급마다 바닥이 다르다) */
export function ensureGround(visitKey: string, g = gradeNow()) {
  const key = groundKey(visitKey, g);
  if (ground.c && ground.key === key) return;
  Object.assign(ground, groundFor(key, g));
}
/** 이 등급의 바닥 (캐시 두 장까지) */
export function groundFor(key: string, g: number): Ground {
  let hit = cache.get(key);
  if (!hit) {
    hit = drawGround(g, key);
    cache.set(key, hit);
    while (cache.size > 2) cache.delete(cache.keys().next().value!);
  }
  return hit;
}

function drawGround(g: number, key: string): Ground {
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
  // 5단계 마을 등급: 입구 길(울타리 밖)도 길로 · 0 오두막 흙길 · 1 쉼터 다져진 길 · 2 마을부터 돌길
  const road = new Set(outerRoad(g).map(([x, y]) => `${x},${y}`));
  const isPath = (x: number, y: number) => (x >= 0 && y >= 0 && x < N && y < N && pathT.has(y * N + x)) || road.has(`${x},${y}`);
  const stone = g >= 2;
  // 땅 개편: 등급 개간(cleared) 삭제 — 풀밭 = 울타리 안 = 지을 수 있는 땅. 울타리 밖은 바로 숲
  //  다음 단계 땅은 미리 보여 준다 (조금 밝은 숲 바닥 · 어린 나무 · 점선 테두리)
  const st = curLand();
  const nextIn = (x: number, y: number) => st < CONFIG.land.length && inLand(x, y, st + 1) && !inLand(x, y);
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
      if (path && stone) {
        // 돌길: 회색 돌 + 어두운 줄눈
        a = (x + y) % 2 ? '#a9a49a' : '#b6b0a4';
        b = '#8c867c';
      } else if (path) {
        a = g >= 1 ? '#b88a52' : '#c99a5e';
        b = g >= 1 ? '#a87a44' : '#b8864e';
      } else if (land) {
        a = v < 2 ? '#78b84a' : '#6fae45';
        b = '#5f9a3c';
      } else if (nextIn(x, y)) {
        // 다음 단계 땅: 숲 바닥이지만 조금 밝게 (어린 나무가 자라는 곳)
        a = v < 2 ? '#5e9448' : '#5a8e45';
        b = '#4f8040';
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
      // 오두막: 풀이 무성하다 (길 위까지 풀포기)
      if (g === 0 && (land || path) && r() < 0.45) {
        const gx = X + ((r() * 18 - 9) | 0);
        const gy = Y + 5 + ((r() * 6) | 0);
        p.px(gx, gy, '#3f7a2c');
        p.px(gx, gy - 1, '#5aa03a');
        p.px(gx + 1, gy - 2, '#5aa03a');
      }
      if (path && stone && r() < 0.5) p.px(X + ((r() * 14 - 7) | 0), Y + 3 + ((r() * 8) | 0), '#7c766c');
      if (land && !path && r() < 0.08) p.px(X + ((r() * 16 - 8) | 0), Y + 4 + ((r() * 8) | 0), ['#ffd36b', '#ff9fbf', '#ffffff'][(r() * 3) | 0]);
      if (path && r() < 0.3) p.px(X + ((r() * 12 - 6) | 0), Y + 5 + ((r() * 6) | 0), '#e0bb83');
    }

  // 다음 단계 땅 테두리: 연한 점선 (바닥에 굽는다)
  if (st < CONFIG.land.length) {
    const [na, nb] = landBounds(st + 1);
    const dot = (x: number, y: number) => {
      const X = (ox + sx(x, y)) | 0;
      const Y = (oy + sy(x, y)) | 0;
      p.rect(X, Y, 2, 1, '#cfe8a8');
    };
    const n = (nb - na) * 6;
    for (let k = 0; k <= n; k++) {
      if (k % 2) continue;
      const t = na + ((nb - na) * k) / n;
      dot(t, na);
      dot(na, t);
    }
  }

  // 야생 나무: 울타리 밖. 바로 바깥 1칸(뒤쪽)·2칸(앞쪽)은 공터로 비운다
  //  땅 개편: 숲은 빽빽하게 · 다음 단계 땅 안은 어린 나무 위주 · 등급 장식·마을 사람 자리는 비운다
  const [la, lb] = landBounds();
  const wr = rng(23);
  const wild: Wild[] = [];
  const keep = new Set<string>();
  for (const pr of gradeProps(g)) for (let j = -1; j <= pr.fh; j++) for (let i = -1; i <= pr.fw; i++) keep.add(`${pr.x + i},${pr.y + j}`);
  for (const fk of gradeFolk(g)) keep.add(`${Math.floor(fk.x)},${Math.floor(fk.y)}`);
  for (let y = -M; y < N + M; y++)
    for (let x = -M; x < N + M; x++) {
      const v = wr();
      const k0: Wild['k'] = wr() < 0.6 ? 'pine' : 'tree';
      const k: Wild['k'] = nextIn(x, y) ? (wr() < 0.7 ? 'sapling' : k0) : k0;
      if (inLand(x, y)) continue;
      const back = x < la - 1 || y < la - 1;
      const frontGap = (x >= lb && x < lb + 2) || (y >= lb && y < lb + 2);
      const sideGap = x === la - 1 || y === la - 1;
      if (sideGap || (!back && frontGap && !(x >= lb + 2 || y >= lb + 2))) continue;
      if (isPath(x, y)) continue; // 던전 가는 길 위엔 나무 없음
      if (keep.has(`${x},${y}`)) continue; // 등급 장식·마을 사람 자리
      const inMap = x >= 0 && y >= 0 && x < N && y < N;
      if (v < (nextIn(x, y) ? 0.45 : inMap ? 0.55 : 0.6)) wild.push({ x, y, k });
    }

  // 울타리 (땅 경계). 길이 울타리를 지나가는 자리는 비워 둔다(문)
  // 오두막 = 부서진 나무 울타리 · 쉼터 = 고친 울타리 · 마을부터 돌담 · 도시 = 성벽 느낌(높고 톱니)
  const [A, B] = landBounds();
  const fr = rng(31);
  const [gex] = entrance();
  const roadGate = (x: number, y: number) => g >= 1 && y === B && Math.abs(x - (gex + 0.5)) < 0.75;
  const post = (x: number, y: number) => {
    const X = ox + sx(x, y);
    const Y = oy + sy(x, y);
    if (roadGate(x, y)) return;
    if (stone) {
      const h = g >= 4 ? 12 : 8;
      p.rect(X - 2, Y - h, 4, h, '#8c867c');
      p.rect(X - 2, Y - h, 4, 1, '#b6b0a4');
      if (g >= 4) p.rect(X - 1, Y - h - 2, 2, 2, '#9c968c');
      return;
    }
    if (g === 0 && fr() < 0.3) return; // 부서져 빠진 기둥
    const tilt = g === 0 && fr() < 0.3 ? 1 : 0;
    p.rect(X - 1 + tilt, Y - 7, 2, 7, '#7a4a2a');
    p.px(X - 1 + tilt, Y - 8, '#a06a3c');
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
      if (gate(x, y, horizontal, outsideBefore) || roadGate(x, y)) continue;
      const X = (ox + sx(x, y)) | 0;
      const Y = (oy + sy(x, y)) | 0;
      if (stone) {
        // 돌담: 낮은 회색 벽
        const h = g >= 4 ? 10 : 6;
        p.rect(X, Y - h, 1, h, (k & 3) === 0 ? '#7c766c' : '#9c968c');
        p.px(X, Y - h, '#c4beb2');
        continue;
      }
      // 오두막: 난간이 군데군데 끊겼다
      if (g === 0 && ((k / 4) | 0) % 3 === 1) continue;
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
  // 땅 개편 §8: 숲 굽기 — 울타리·길·장식에서 먼 나무는 바닥 그림에 미리 그린다 (매 프레임 정렬·그리기에서 뺀다)
  //  남기는 것(움직이는 것과 겹칠 수 있는 나무): 울타리 2칸 안 · 다음 단계 땅(넓힐 때 쓰러짐) · 길·장식 옆
  const near = (x: number, y: number) => {
    const dx = Math.max(la - x, x - (lb - 1), 0);
    const dy = Math.max(la - y, y - (lb - 1), 0);
    if (Math.max(dx, dy) <= 2 || nextIn(x, y)) return true;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (isPath(x + i, y + j) || keep.has(`${x + i},${y + j}`)) return true;
    return false;
  };
  //  고정 건물(던전) 둘레 2칸도 남긴다 (던전 앞뒤로 정렬돼야 해서)
  for (const o of world.objs) if (def(o.kind).fixed) for (let j = -2; j < o.fh + 2; j++) for (let i = -2; i < o.fw + 2; i++) keep.add(`${o.tx + i},${o.ty + j}`);
  const baked = wild.filter((w) => !near(w.x, w.y) && !keep.has(`${w.x},${w.y}`)).sort((p, q) => p.x + p.y - (q.x + q.y) || p.x - q.x);
  const live = wild.filter((w) => !baked.includes(w));
  // 뒤 층(바닥 그림에) = 땅보다 뒤·옆 · 앞 층(따로, 건물·손님 다음에 그림) = 땅보다 앞
  const front = canvas(W, H);
  const gx = c.getContext('2d')!;
  const fx = front.getContext('2d')!;
  let nFront = 0;
  for (const w of baked) {
    const im = IMG[w.k];
    if (!im) continue;
    const inFront = w.x >= lb || w.y >= lb;
    if (inFront) nFront++;
    (inFront ? fx : gx).drawImage(im, Math.round(ox + sx(w.x + 0.5, w.y + 0.5) - im.width / 2), Math.round(oy + sy(w.x + 0.5, w.y + 0.5) + TH / 2 - im.height + 3));
  }
  wild.length = 0;
  wild.push(...live);

  // 땅 넓히기 팻말 (울타리 왼쪽 뒤 가운데 바로 바깥) — 누르면 땅 넓히기 창
  const sg = signSpot();
  if (sg && !key.includes('|v:')) wild.push({ x: sg[0], y: sg[1], k: 'expand_sign' });
  return { c, ox, oy, key, wild, front: nFront ? front : null };
}
