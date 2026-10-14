// FIVESTARS ④ R21 v3 — 마지막 컷 별자리 하늘 (story.ts fx 'constellation' · 카메라가 하늘로 올라간 그 판)
//  별 다섯: 3×3 + 1px 십자 빛줄기 · 각자 공격 궤적 색 · 약 1초마다 번갈아 반짝
//  잇는 선: 35% · 한 획씩 0.8초 동안 오각형 완성 · 작은 배경 별 24개 (1px · 은은한 반짝)
//  움직임 줄이기: 기기 「동작 줄이기」(prefers-reduced-motion) · 배터리 절약 · 화면 보호 중이면 선을 한 번에 · 반짝 없음
//  (calmWorld 플래그는 모두에게 켜진 숲 색 규칙이라 여기선 쓰지 않는다)
//  탭하면 끝 모습: story.ts skyPan이 상자에 'now'를 붙이면 선이 바로 다 그려진다
import { STAR_IDS, STARS } from '../data/fivestars';
import { saverOn } from '../engine/fps';
import { ssOn } from './screenSaver';

/** 별 다섯 색 (= 공격 궤적 색 · 장부 순서) */
export const SKY_STAR_COLORS = STAR_IDS.map((id) => STARS[id].trail);
export const SKY_LINE_ALPHA = 0.35;
export const SKY_LINE_MS = 800;
/** 선을 긋기 시작하는 때 (하늘이 거의 올라온 뒤) */
export const SKY_LINE_START_MS = 700;
export const SKY_BG_STARS = 24;

export function skyCalm(): boolean {
  let rm = false;
  try {
    rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* 없음 */
  }
  return rm || saverOn() || ssOn();
}

/** 오각형 꼭짓점 (위에서 시계 방향) · 중심 cx,cy · 반지름 r */
export function pentagon(cx: number, cy: number, r: number): [number, number][] {
  return [0, 1, 2, 3, 4].map((k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    return [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)];
  });
}

/** 선이 몇 획(0~5, 소수 = 긋는 중) 그려졌나 */
export function linesDone(t: number, calm: boolean, skip: boolean): number {
  if (calm || skip) return 5;
  return Math.max(0, Math.min(5, ((t - SKY_LINE_START_MS) / SKY_LINE_MS) * 5));
}

/** 별 k의 밝기 (0.55~1) — 짝수·홀수가 약 1초마다 번갈아 */
export function twinkle(k: number, t: number, calm: boolean): number {
  if (calm) return 1;
  const ph = Math.floor(t / 500) % 2;
  return (k % 2) === ph ? 1 : 0.55;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** .skyp 안에 캔버스를 넣고 애니메이션 시작 (상자가 사라지면 저절로 멈춘다) */
export function mountSky(box: HTMLElement, fxBox: HTMLElement) {
  const cv = document.createElement('canvas');
  cv.className = 'skyc';
  box.appendChild(cv);
  const t0 = performance.now();
  cv.dataset.t0 = String(Math.round(t0));
  const W = Math.max(1, box.clientWidth);
  const H = Math.max(1, box.clientHeight);
  const S = W > 700 ? 3 : 2;
  const w = Math.ceil(W / S);
  const h = Math.ceil(H / S);
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  // 별자리는 하늘(아래 40px 그라데이션 위쪽)의 가운데쯤
  const skyH = h - Math.ceil(40 / S);
  const r = Math.max(10, Math.min(24, Math.round(Math.min(w, skyH) * 0.2)));
  const P = pentagon(Math.round(w / 2), Math.round(skyH * 0.5), r);
  const R = rng(5);
  const bg = Array.from({ length: SKY_BG_STARS }, () => ({ x: Math.floor(R() * w), y: Math.floor(R() * skyH * 0.95), ph: R() * 6.28, sp: 0.6 + R() * 0.8 }));
  const draw = () => {
    if (!cv.isConnected) return;
    const t = performance.now() - t0;
    const calm = skyCalm();
    ctx.clearRect(0, 0, w, h);
    // 배경 별 (1px · 은은하게)
    for (const s of bg) {
      ctx.globalAlpha = calm ? 0.6 : 0.35 + 0.35 * (0.5 + 0.5 * Math.sin((t / 1000) * s.sp * 2 * Math.PI + s.ph));
      ctx.fillStyle = '#dfe6ff';
      ctx.fillRect(s.x, s.y, 1, 1);
    }
    // 잇는 선 (35% · 한 획씩)
    const n = linesDone(t, calm, fxBox.classList.contains('now'));
    ctx.globalAlpha = SKY_LINE_ALPHA;
    ctx.strokeStyle = '#fff3d0';
    ctx.lineWidth = 1;
    for (let k = 0; k < 5 && k < n; k++) {
      const [x0, y0] = P[k];
      const [x1, y1] = P[(k + 1) % 5];
      const f = Math.min(1, n - k);
      ctx.beginPath();
      ctx.moveTo(x0 + 0.5, y0 + 0.5);
      ctx.lineTo(x0 + 0.5 + (x1 - x0) * f, y0 + 0.5 + (y1 - y0) * f);
      ctx.stroke();
    }
    // 별 다섯: 3×3 + 십자 빛줄기 1px
    P.forEach(([x, y], k) => {
      const c = SKY_STAR_COLORS[k];
      const b = twinkle(k, t, calm);
      ctx.globalAlpha = b;
      ctx.fillStyle = c;
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1, 1);
      ctx.globalAlpha = b * 0.8;
      ctx.fillStyle = c;
      ctx.fillRect(x, y - 3, 1, 2);
      ctx.fillRect(x, y + 2, 1, 2);
      ctx.fillRect(x - 3, y, 2, 1);
      ctx.fillRect(x + 2, y, 2, 1);
    });
    ctx.globalAlpha = 1;
    // 움직임 줄이기면 한 번 그리고 끝 (설정이 바뀌면 다음 대사에서 다시)
    if (!calm) requestAnimationFrame(draw);
  };
  draw();
}
