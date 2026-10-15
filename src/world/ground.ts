// 바닥 타일, 흙길, 울타리, 숲(야생 나무). 땅이나 길이 바뀔 때만 다시 그려 캐시한다.
import { CONFIG } from '../data/config';
import { BAYER, canvas, P, rng } from '../engine/pixel';
import { IMG } from '../engine/assets';
import { def } from '../data/catalog';
import { world } from './state';
import { N, sx, sy, TH, TW } from '../engine/iso';
import { curLand, entrance, groundVersion, inLand, landBounds, paintOf, pathT, roundOf } from './town';
import { gradeFolk, gradeNow, gradeProps, outerRoad } from './grade';
import { calmTree } from '../engine/palette';
import { vis } from './visual';
import { canvasAlive } from '../engine/lru';
import { litKey, nightLook, VEIL_RGB, type NightLook } from './nightLook';

// ───────── VISUAL §2 calmWorld: 조용한 바닥 · 또렷한 사람 ─────────
const hx = (h: string) => [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16));
const toHex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => { const p = hx(a), q = hx(b); return toHex(p.map((v, i) => v + (q[i] - v) * t)); };
/** 밝기 k배 · 채도 s배 */
const dim = (h: string, k: number, s: number) => { const c = hx(h); const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; return toHex(c.map((v) => (l + (v - l) * s) * k)); };
const CALM_MEMO = new Map<string, string>();
/** 숲 바닥(울타리 밖): 밝기 −20% · 채도 −25% */
export const calmForest = (h: string) => (vis('calmWorld') ? (CALM_MEMO.get('f' + h) ?? (CALM_MEMO.set('f' + h, dim(h, 0.8, 0.75)), CALM_MEMO.get('f' + h)!)) : h);
/** 마을 풀밭: 무늬 대비 −40% · 한 톤 따뜻하게 → [밝은 칸, 어두운 칸] */
export function grassPair(a: string, b: string): [string, string] {
  if (!vis('calmWorld')) return [a, b];
  const w = (h: string) => mix(h, '#c8b060', 0.1);
  return [w(a), w(mix(b, a, 0.4))];
}
/** 숲 나무 그림: 먼 나무(굽기) = 외곽선 없이 어둡게 · 울타리 가까운 2겹 = 외곽선 두고 조금 어둡게 */
const TREE_MEMO = new Map<string, { src: unknown; c: HTMLCanvasElement }>();
export function treeImg(k: string, edge: boolean) {
  const im = IMG[k];
  if (!im || !vis('calmWorld') || k === 'expand_sign') return im;
  const key = k + (edge ? '|e' : '|f');
  const hit = TREE_MEMO.get(key);
  if (hit && hit.src === im && hit.c.width) return hit.c;
  const c = edge ? calmTree(im, 0.9, 0.85, true) : calmTree(im, 0.8, 0.75);
  TREE_MEMO.set(key, { src: im, c });
  return c;
}

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
  /** 앞 층 캔버스는 나무가 있는 곳만 잘라 둔다 (바닥 그림 기준 왼쪽 위) */
  frontX?: number;
  frontY?: number;
  /** 밤 바닥 (바닥 + 밤 색 + 숲 덧칠을 한 번 구운 것) — litKey가 같으면 그대로 */
  lit?: { key: string; c: HTMLCanvasElement } | null;
}
export const ground: Ground = { c: null, ox: 0, oy: 0, key: '', wild: [] };
/** 마을 등급이 바뀌는 연출 동안 앞뒤 두 장을 같이 쓴다 */
const cache = new Map<string, Ground>();

export const groundKey = (visitKey: string, g: number) => `${curLand()}|${groundVersion}|${visitKey ? 'v:' + visitKey : ''}|g${g}`;
/** 땅 개편: 땅 넓히기 팻말 칸 (최대 크기면 없음) */
/** TOWN T0: 앞 경계 띠 폭 (큰 나무 56px · 앞으로 n칸이면 경계선보다 16n px 아래 → 3칸까지는 꼭대기가 경계를 넘는다) */
export const FRONT_BAND = 3;

export function signSpot(): [number, number] | null {
  if (curLand() >= CONFIG.land.length) return null;
  const [a, b] = landBounds();
  return [a - 1, Math.floor((a + b) / 2)];
}
/** 렌더 메모리: 마을 등급 연출이 끝나면 지금 바닥 한 장만 남긴다 */
export function trimGround() {
  if (cache.size < 2) return;
  for (const k of [...cache.keys()]) if (k !== ground.key) cache.delete(k);
}
export function groundMem() {
  let px = 0;
  for (const g of cache.values()) px += (g.c?.width ?? 0) * (g.c?.height ?? 0) + (g.front?.width ?? 0) * (g.front?.height ?? 0) + (g.lit?.c.width ?? 0) * (g.lit?.c.height ?? 0);
  return { n: cache.size, px };
}
/** 필요할 때만 다시 그린다 (등급마다 바닥이 다르다) */
export function ensureGround(visitKey: string, g = gradeNow()) {
  const key = groundKey(visitKey, g);
  if (ground.c && ground.key === key && canvasAlive(ground.c)) return;
  // 삼성 인터넷이 메모리 부족 때 캔버스를 잃으면(폭 0 · 컨텍스트 잃음) 같은 프레임에 다시 그린다 (빈 바닥 프레임 없이)
  if (ground.c && !canvasAlive(ground.c)) cache.delete(ground.key);
  Object.assign(ground, groundFor(key, g));
}
/** 이 등급의 바닥 (캐시 두 장까지) */
export function groundFor(key: string, g: number): Ground {
  let hit = cache.get(key);
  if (hit && (!hit.c || !canvasAlive(hit.c))) {
    cache.delete(key);
    hit = undefined;
  }
  if (!hit) {
    hit = drawGround(g, key);
    cache.set(key, hit);
    while (cache.size > 2) cache.delete(cache.keys().next().value!);
  }
  return hit;
}

/**
 * 밤 바닥 한 장: 바닥 그림 + 밤 색조(multiply) + 울타리 밖 숲 덧칠(calmWorld) — (바닥 키 · 실제 쓴 색)마다 한 번만 굽는다.
 *  웅스 신고(새벽 04시 숲·바닥이 1~3초마다 잠깐 어두워짐): 예전엔 이 두 겹을 매 프레임 화면 전체에 다시 칠했다
 *  (multiply + 짝홀 자르기 + 반투명 · 폰 GPU에서 프레임마다 결과가 흔들릴 수 있는 길). 이제 그리기는 구운 한 장을 놓기만 한다.
 *  낮(NL 0)이면 바닥 그림 그대로. 구운 캔버스를 잃었으면(폭 0 · 컨텍스트 잃음) 그 자리에서 다시 굽는다.
 */
export function litGround(gr: Ground, L: NightLook, bounds: [number, number] = landBounds()): HTMLCanvasElement | null {
  const src = gr.c;
  if (!src || !L.tint) return src;
  const k = litKey(gr.key, L) + '|' + bounds.join(',');
  if (gr.lit && gr.lit.key === k && canvasAlive(gr.lit.c) && gr.lit.c.width === src.width && gr.lit.c.height === src.height) return gr.lit.c;
  const c = gr.lit && canvasAlive(gr.lit.c) && gr.lit.c.width === src.width && gr.lit.c.height === src.height ? gr.lit.c : canvas(src.width, src.height);
  const x = c.getContext('2d');
  if (!x) return src;
  x.save();
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 1;
  x.clearRect(0, 0, c.width, c.height);
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = `rgb(${L.tint.join(',')})`;
  x.fillRect(0, 0, c.width, c.height);
  if (L.veil > 0) {
    // VISUAL §2: 밤엔 숲을 더 어둡게 → 마을이 「불 켜진 섬」 (울타리 안은 그대로)
    const [a, b] = bounds;
    const X = (tx: number, ty: number) => gr.ox + sx(tx, ty);
    const Y = (tx: number, ty: number) => gr.oy + sy(tx, ty);
    x.beginPath();
    x.rect(0, 0, c.width, c.height);
    x.moveTo(X(a, a), Y(a, a));
    x.lineTo(X(a, b), Y(a, b));
    x.lineTo(X(b, b), Y(b, b));
    x.lineTo(X(b, a), Y(b, a));
    x.closePath();
    x.clip('evenodd');
    x.globalAlpha = L.veil;
    x.fillStyle = `rgb(${VEIL_RGB.join(',')})`;
    x.fillRect(0, 0, c.width, c.height);
  }
  x.restore();
  gr.lit = { key: k, c };
  return c;
}
/** 지금 밤 단계의 바닥 색 규칙 (render가 쓴다) */
export const lookFor = (nl: number) => nightLook(nl, CONFIG.dayNight.tintSteps, vis('calmWorld'));

/**
 * LAND10: 바닥 그림이 덮는 칸 범위 [R0, R1) (x·y 같이). 앞쪽은 늘 맵 끝 + 숲 M겹.
 *  뒤쪽은 맵 0 − M 대신 「땅 뒤 가장자리 − M」과 0 중 작은 쪽 → 땅 1~7단계는 LAND2 때와 같은 크기(56칸 · 1792×896)·같은 숲 무늬,
 *  8·9·10단계만 4칸씩 커진다 (60·64·68칸 → 10단계 2176×1088). 맵(44)만큼 늘 크게 굽지 않게 (폰 메모리)
 */
export function groundSpan(stage = curLand()): [number, number] {
  return [Math.min(0, landBounds(stage)[0] - M), N + M];
}
function drawGround(g: number, key: string): Ground {
  const [R0, R1] = groundSpan();
  const W = (R1 - R0) * TW;
  const H = (R1 - R0) * TH;
  const c = canvas(W, H);
  const p = P(c.getContext('2d')!);
  const ox = W / 2;
  const oy = -R0 * TH;
  const r = rng(11);
  // 맵 밖 숲 바닥
  p.rect(0, 0, W, H, calmForest('#3e6a34'));
  for (let i = 0; i < 500; i++) p.px((r() * W) | 0, (r() * H) | 0, calmForest('#4a7a3c'));
  // 5단계 마을 등급: 입구 길(울타리 밖)도 길로 · 0 오두막 흙길 · 1 쉼터 다져진 길 · 2 마을부터 돌길
  const road = new Set(outerRoad(g).map(([x, y]) => `${x},${y}`));
  const isPath = (x: number, y: number) => (x >= 0 && y >= 0 && x < N && y < N && pathT.has(y * N + x)) || road.has(`${x},${y}`);
  const stone = g >= 2;
  const grassDot = vis('calmWorld') ? mix('#9ad860', '#78b84a', 0.5) : '#9ad860';
  // 땅 개편: 등급 개간(cleared) 삭제 — 풀밭 = 울타리 안 = 지을 수 있는 땅. 울타리 밖은 바로 숲
  //  다음 단계 땅은 미리 보여 준다 (조금 밝은 숲 바닥 · 어린 나무 · 점선 테두리)
  const st = curLand();
  const nextIn = (x: number, y: number) => st < CONFIG.land.length && inLand(x, y, st + 1) && !inLand(x, y);
  for (let y = R0; y < R1; y++)
    for (let x = R0; x < R1; x++) {
      const X = ox + sx(x, y);
      const Y = oy + sy(x, y);
      const land = inLand(x, y);
      const inMap = x >= 0 && y >= 0 && x < N && y < N;
      const path = isPath(x, y);
      const v = (x * 7 + y * 13) % 5;
      let a: string;
      let b: string;
      // TOWN T2: 칠한 칸 (길 재질 · 바닥 종류)
      const pc = land ? paintOf(x, y) : undefined;
      const PAL: Record<string, [string, string]> = {
        stone: [(x + y) % 2 ? '#a9a49a' : '#b6b0a4', '#8c867c'], dirt: ['#c99a5e', '#b8864e'], brick: ['#b8644c', '#94483a'], deck: ['#b98a56', '#946a3e'],
        step: [v < 2 ? '#78b84a' : '#6fae45', '#5f9a3c'], flower: [v < 2 ? '#7cbc4c' : '#72b247', '#5f9a3c'], sand: ['#e6d29a', '#d2ba80'], gravel: ['#a39e94', '#86817a'],
        pond: ['#4a8ac4', '#3a76b0'],
      };
      if (pc && PAL[pc]) [a, b] = PAL[pc];
      else if (path && stone) {
        // 돌길: 회색 돌 + 어두운 줄눈
        a = (x + y) % 2 ? '#a9a49a' : '#b6b0a4';
        b = '#8c867c';
      } else if (path) {
        a = g >= 1 ? '#b88a52' : '#c99a5e';
        b = g >= 1 ? '#a87a44' : '#b8864e';
      } else if (land) {
        [a, b] = grassPair(v < 2 ? '#78b84a' : '#6fae45', '#5f9a3c');
      } else if (nextIn(x, y)) {
        // 다음 단계 땅: 숲 바닥이지만 조금 밝게 (어린 나무가 자라는 곳)
        a = calmForest(v < 2 ? '#5e9448' : '#5a8e45');
        b = calmForest('#4f8040');
      } else if (inMap) {
        a = calmForest('#58894a');
        b = calmForest('#4c7a42');
      } else {
        a = calmForest('#476f3c');
        b = calmForest('#3e6a34');
      }
      for (let j = 0; j < TH; j++) {
        const hw = (j < TH / 2 ? j + 1 : TH - j) * 2;
        for (let i = -hw; i < hw; i++) {
          const px = X + i;
          const py = Y + j;
          p.px(px, py, BAYER[py & 3][(px + 64) & 3] < 3 ? b : a);
        }
      }
      if (pc) {
        decoTile(p, pc, X, Y, x, y, r);
        continue;
      }
      if (land && !path && r() < 0.35) p.px(X + ((r() * 16 - 8) | 0), Y + 4 + ((r() * 8) | 0), grassDot);
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
  for (let y = R0; y < R1; y++)
    for (let x = R0; x < R1; x++) {
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
      // TOWN T0: 땅 앞쪽 경계 띠(앞 가장자리에서 FRONT_BAND칸 안)는 키 작은 어린 나무만 — 큰 나무 꼭대기가 경계 안쪽 소품(우물·꽃밭·가로등)을 가리지 않게
      const fd = Math.max(x - lb, y - lb);
      const kk: Wild['k'] = !back && fd >= 0 && fd <= FRONT_BAND && k !== 'sapling' ? 'sapling' : k;
      if (v < (nextIn(x, y) ? 0.45 : inMap ? 0.55 : 0.6)) wild.push({ x, y, k: kk });
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
  let fl = W;
  let ft = H;
  let fR = 0;
  let fb = 0;
  for (const w of baked) {
    const im = treeImg(w.k, false);
    if (!im) continue;
    const inFront = w.x >= lb || w.y >= lb;
    const X = Math.round(ox + sx(w.x + 0.5, w.y + 0.5) - im.width / 2);
    const Y = Math.round(oy + sy(w.x + 0.5, w.y + 0.5) + TH / 2 - im.height + 3);
    if (inFront) {
      nFront++;
      fl = Math.min(fl, X);
      ft = Math.min(ft, Y);
      fR = Math.max(fR, X + im.width);
      fb = Math.max(fb, Y + im.height);
    }
    (inFront ? fx : gx).drawImage(im, X, Y);
  }
  // 렌더 메모리: 앞 층(바닥 그림과 같은 크기 1792×896)은 대부분 비어 있다 → 나무가 있는 곳만 잘라 둔다 (그리는 자리는 같다)
  let frontCut: HTMLCanvasElement | null = null;
  fl = Math.max(0, fl);
  ft = Math.max(0, ft);
  fR = Math.min(W, fR);
  fb = Math.min(H, fb);
  if (nFront && fR > fl && fb > ft) {
    frontCut = canvas(fR - fl, fb - ft);
    frontCut.getContext('2d')!.drawImage(front, -fl, -ft);
  }
  wild.length = 0;
  wild.push(...live);

  // 땅 넓히기 팻말 (울타리 왼쪽 뒤 가운데 바로 바깥) — 누르면 땅 넓히기 창
  const sg = signSpot();
  if (sg && !key.includes('|v:')) wild.push({ x: sg[0], y: sg[1], k: 'expand_sign' });
  return { c, ox, oy, key, wild, front: frontCut, frontX: fl, frontY: ft };
}

/** TOWN T2: 칠한 칸 무늬 (칸 마름모 안 · X,Y = 마름모 위 꼭짓점) */
const ROUNDABLE = new Set(['stone', 'dirt', 'brick', 'deck']);
/** BUILDUX §3-3: 둥근 모서리 — 길이 아닌 두 변이 만나는 꼭짓점을 풀밭으로 오목하게 깎는다 */
function decoTile(p: ReturnType<typeof P>, pc: string, X: number, Y: number, x: number, y: number, r: () => number) {
  decoTile0(p, pc, X, Y, x, y, r);
  if (!ROUNDABLE.has(pc) || !roundOf(x, y)) return;
  const path = (nx: number, ny: number) => ROUNDABLE.has(paintOf(nx, ny) ?? '') || pathT.has(ny * N + nx);
  // 변: 위왼 (x−1,y) · 위오른 (x,y−1) · 아래왼 (x,y+1) · 아래오른 (x+1,y)
  const ul = !path(x - 1, y);
  const ur = !path(x, y - 1);
  const dl = !path(x, y + 1);
  const dr = !path(x + 1, y);
  const H = TH / 2;
  for (let j = 0; j < TH; j++) {
    const hw = (j < H ? j + 1 : TH - j) * 2;
    for (let i = -hw; i < hw; i++) {
      const u = (i + 0.5) / (TW / 2);
      const v = (j + 0.5 - H) / H;
      // 꼭짓점에서의 거리 t (0 = 꼭짓점), 가로로 벗어난 정도 w
      const cut = (t: number, w: number) => t + w * 0.7 < 0.5;
      let c = false;
      if (ul && ur) c ||= cut(1 + v, Math.abs(u));
      if (dl && dr) c ||= cut(1 - v, Math.abs(u));
      if (ur && dr) c ||= cut(1 - u, Math.abs(v));
      if (ul && dl) c ||= cut(1 + u, Math.abs(v));
      if (c) { const [ga, gb] = grassPair((x * 7 + y * 13) % 5 < 2 ? '#78b84a' : '#6fae45', '#5f9a3c'); p.px(X + i, Y + j, BAYER[(Y + j) & 3][(X + i + 64) & 3] < 3 ? gb : ga); }
    }
  }
}
function decoTile0(p: ReturnType<typeof P>, pc: string, X: number, Y: number, x: number, y: number, r: () => number) {
  // 마름모 안의 점인가 (위 꼭짓점 기준 dx,dy)
  const inside = (dx: number, dy: number) => dy >= 0 && dy < TH && Math.abs(dx) < (dy < TH / 2 ? dy + 1 : TH - dy) * 2;
  if (pc === 'pond') {
    // 이웃 칸이 연못이 아니면 그 변에 물가(밝은 테두리) — 이어 붙이면 저절로 한 연못
    const edge = (nx: number, ny: number) => paintOf(nx, ny) !== 'pond';
    const shore = '#d8eef6';
    const sand = '#cdb582';
    for (let j = 0; j < TH; j++) {
      const hw = (j < TH / 2 ? j + 1 : TH - j) * 2;
      for (const i of [-hw, -hw + 1, hw - 2, hw - 1]) {
        const left = i < 0;
        const top = j < TH / 2;
        // 쿼터뷰(sx = (x−y)·TW/2): 위왼 변 = (x−1,y) · 위오른 변 = (x,y−1) · 아래왼 = (x,y+1) · 아래오른 = (x+1,y)
        const nb = top ? (left ? edge(x - 1, y) : edge(x, y - 1)) : left ? edge(x, y + 1) : edge(x + 1, y);
        if (nb) p.px(X + i, Y + j, top ? shore : sand);
      }
    }
    if (r() < 0.6) p.rect(X - 4 + ((r() * 6) | 0), Y + 6 + ((r() * 3) | 0), 3, 1, '#9ccbea');
    return;
  }
  if (pc === 'brick') {
    // 가로 줄눈 4px마다 · 세로 줄눈은 줄마다 엇갈려
    for (let j = 0; j < TH; j++)
      for (let i = -16; i < 16; i++) {
        if (!inside(i, j)) continue;
        const band = (j / 4) | 0;
        if (j % 4 === 3 || (i + band * 4 + 64) % 8 === 0) p.px(X + i, Y + j, '#7a3a2e');
      }
    return;
  }
  if (pc === 'deck') {
    for (let j = 0; j < TH; j++) for (let i = -16; i < 16; i++) if (inside(i, j) && ((i + j * 2) & 7) === 0) p.px(X + i, Y + j, '#7a5432');
    return;
  }
  if (pc === 'step') {
    // 풀밭 위 둥근 징검돌 2개
    for (const [cx, cy] of [[-5, 5], [5, 9]] as [number, number][]) {
      p.rect(X + cx - 3, Y + cy, 6, 2, '#b6b0a4');
      p.rect(X + cx - 2, Y + cy - 1, 4, 1, '#ccc6ba');
      p.rect(X + cx - 3, Y + cy + 2, 6, 1, '#7c766c');
    }
    return;
  }
  if (pc === 'flower') {
    const cols = ['#ff9fbf', '#ffd36b', '#ffffff', '#c890ff', '#ff7a6a'];
    for (let n = 0; n < 9; n++) {
      const i = (r() * 22 - 11) | 0;
      const j = 2 + ((r() * 12) | 0);
      if (!inside(i, j)) continue;
      p.px(X + i, Y + j, cols[(r() * cols.length) | 0]);
      p.px(X + i, Y + j + 1, '#4f8a34');
    }
    return;
  }
  if (pc === 'gravel' || pc === 'sand' || pc === 'stone' || pc === 'dirt') {
    const dot = pc === 'gravel' ? '#6c6860' : pc === 'sand' ? '#f2e2b4' : pc === 'stone' ? '#7c766c' : '#e0bb83';
    for (let n = 0; n < (pc === 'gravel' ? 8 : 4); n++) {
      const i = (r() * 22 - 11) | 0;
      const j = 2 + ((r() * 12) | 0);
      if (inside(i, j)) p.px(X + i, Y + j, dot);
    }
  }
}

/**
 * HOTFIX19 §1: 붓질 중엔 바닥 전체를 다시 굽지 않고 바뀐 칸(과 이음이 바뀌는 둘레 8칸)만 덧그린다.
 *  손을 떼면 rebuildPaths → 한 번 다시 굽는다 (울타리·잔무늬까지 원래대로)
 */
export function patchTiles(tiles: [number, number][]) {
  if (!ground.c) return;
  // 바닥 그림이 바뀌었으니 구운 밤 바닥도 다음 프레임에 다시 (캔버스는 다시 쓴다)
  if (ground.lit) ground.lit.key = '';
  const p = P(ground.c.getContext('2d')!);
  const g = Number(/\|g(\d+)$/.exec(ground.key)?.[1] ?? 0);
  const stone = g >= 2;
  const seen = new Set<string>();
  for (const [cx, cy] of tiles)
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const x = cx + i;
        const y = cy + j;
        const k = `${x},${y}`;
        if (seen.has(k) || !inLand(x, y)) continue;
        seen.add(k);
        const X = ground.ox + sx(x, y);
        const Y = ground.oy + sy(x, y);
        const v = (x * 7 + y * 13) % 5;
        const pc = paintOf(x, y);
        const path = pathT.has(y * N + x);
        const PAL: Record<string, [string, string]> = {
          stone: [(x + y) % 2 ? '#a9a49a' : '#b6b0a4', '#8c867c'], dirt: ['#c99a5e', '#b8864e'], brick: ['#b8644c', '#94483a'], deck: ['#b98a56', '#946a3e'],
          step: [v < 2 ? '#78b84a' : '#6fae45', '#5f9a3c'], flower: [v < 2 ? '#7cbc4c' : '#72b247', '#5f9a3c'], sand: ['#e6d29a', '#d2ba80'], gravel: ['#a39e94', '#86817a'],
          pond: ['#4a8ac4', '#3a76b0'],
        };
        const [a, b] = pc && PAL[pc] ? PAL[pc] : path && stone ? PAL.stone : path ? [g >= 1 ? '#b88a52' : '#c99a5e', g >= 1 ? '#a87a44' : '#b8864e'] : grassPair(v < 2 ? '#78b84a' : '#6fae45', '#5f9a3c');
        for (let jj = 0; jj < TH; jj++) {
          const hw = (jj < TH / 2 ? jj + 1 : TH - jj) * 2;
          for (let ii = -hw; ii < hw; ii++) {
            const px = X + ii;
            const py = Y + jj;
            p.px(px, py, BAYER[py & 3][(px + 64) & 3] < 3 ? b : a);
          }
        }
        const r = rng((x * 73856093) ^ (y * 19349663));
        if (pc) decoTile(p, pc, X, Y, x, y, r);
      }
}
