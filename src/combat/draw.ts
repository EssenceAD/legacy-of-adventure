// 전투 그리기: 논리 해상도(도트 1개 = 1px) 캔버스에 전부 같은 크기로 → 화면 캔버스에 정수배로 키운다
//  바닥 타일 · 예고 범위 · 캐릭터/몬스터 · 슬래시 · 탄 · 연기 · 금화 · 도트 숫자 · 흔들림(정수 px)
import { av } from '../engine/ver';
import { shakeLv } from '../engine/shake';
import { CONFIG } from '../data/config';
import { IMG } from '../engine/assets';
import { sx, sy, TH, TW } from '../engine/iso';
import { frameAt, flipOf, whiteOf, type MonSheet } from './mon';
import { GRADE_COLOR, quarterOf, screenDx, type Field, type Unit } from './field';
import { deepen, placeProps, PROP_IMG, themeOf, type GroundPal, type Theme } from './theme';
import { saverOn } from '../engine/fps';
import { bgMode, drawRiftCrack, drawRiftSky, RIFT_THEME, riftCalm, riftIsland } from './riftBg';

/** PARTY §3: 4인 + 보스 + 부하에서 그리기가 30fps 아래로 떨어지면 이펙트 줄이기 (배터리 절약과 같은 가벼운 그림) — ui.ts가 잰다 */
let autoLite = false;
export const setFxLite = (v: boolean) => (autoLite = v);
export const fxLite = () => saverOn() || autoLite;

const C = CONFIG.combat;
export const sheets: Partial<Record<string, MonSheet>> = {};

// ───────── 전투 2차: Ninja Adventure 이펙트 (1배) ─────────

interface FxSheet {
  w: number;
  h: number;
  n: number;
  /** [회전 0·90·180·270][프레임] */
  rot: HTMLCanvasElement[][];
}
const fxs: Partial<Record<string, FxSheet>> = {};
let fxLoading: Promise<void> | null = null;
export function loadFx(): Promise<void> {
  return (fxLoading ??= (async () => {
    try {
      const meta = (await (await fetch(av(new URL('assets/fx/fx.json', document.baseURI).href))).json()) as Record<string, { w: number; h: number; n: number }>;
      await Promise.all(
        Object.entries(meta).map(
          ([id, m]) =>
            new Promise<void>((ok) => {
              const im = new Image();
              im.onload = () => {
                const rot: HTMLCanvasElement[][] = [0, 1, 2, 3].map((q) =>
                  Array.from({ length: m.n }, (_, i) => {
                    const c = document.createElement('canvas');
                    c.width = q % 2 ? m.h : m.w;
                    c.height = q % 2 ? m.w : m.h;
                    const x = c.getContext('2d')!;
                    x.translate(c.width / 2, c.height / 2);
                    x.rotate((q * Math.PI) / 2);
                    x.drawImage(im, i * m.w, 0, m.w, m.h, -m.w / 2, -m.h / 2, m.w, m.h);
                    return c;
                  }),
                );
                fxs[id] = { ...m, rot };
                ok();
              };
              im.onerror = () => ok();
              im.src = av(new URL(`assets/fx/${id}.png`, document.baseURI).href);
            }),
        ),
      );
    } catch {
      /* 이펙트가 없으면 코드 이펙트 그대로 */
    }
  })());
}
/** 이펙트 한 프레임 (가운데 기준) · q = 90° 회전 수 */
function fxDraw(ctx: CanvasRenderingContext2D, id: string, X: number, Y: number, p: number, q = 0): boolean {
  const s = fxs[id];
  if (!s) return false;
  const im = s.rot[q & 3][Math.min(s.n - 1, Math.floor(p * s.n))];
  ctx.drawImage(im, Math.round(X - im.width / 2), Math.round(Y - im.height / 2));
  return true;
}
/** 이번 장의 장비 이름표 (논리 좌표 · 화면 캔버스에 글자로) */
export const labelsOut: { x: number; y: number; text: string; col: string }[] = [];

// ───────── 지역 바닥 (마을 타일과 같은 32×16 쿼터뷰 · 숲: 풀과 흙) ─────────

// HUNT_WORLD_SPEC §1: 팔레트·무늬·소품·입자·빛은 지역 테마(theme.ts)에서
let ground: HTMLCanvasElement | null = null;
let groundKey = '';
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
};
/** 부드러운 값 노이즈 (0~1): 바닥 얼룩용 — 칸 경계와 상관없이 번진다 */
function vnoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy);
}
const fbm = (x: number, y: number) => vnoise(x, y) * 0.65 + vnoise(x * 2.3 + 17, y * 2.3 + 5) * 0.35;

function tile(ctx: CanvasRenderingContext2D, X: number, Y: number, fill: (px: number, py: number) => string) {
  for (let k = 0; k < TH; k++) {
    const hw = (k < TH / 2 ? k + 1 : TH - k) * 2;
    for (let i = -hw; i < hw; i++) {
      ctx.fillStyle = fill(X + i, Y + k);
      ctx.fillRect(X + i, Y + k, 1, 1);
    }
  }
}
function buildGround(T: Theme, deep: boolean): HTMLCanvasElement {
  const N = C.field;
  // 보스 「깊은 곳」: 같은 무늬를 어둡게
  const P = deep ? (Object.fromEntries(Object.entries(T.pal).map(([k, v]) => [k, k === 'rune' ? v : deepen(v, 0.32)])) as unknown as GroundPal) : T.pal;
  const pad = 3;
  const W = (N + pad * 2) * TW;
  const H = (N + pad * 2) * TH + 40;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = P.void;
  x.fillRect(0, 0, W, H);
  const ox = W / 2;
  const oy = 20;
  for (let ty = -pad; ty < N + pad; ty++)
    for (let tx = -pad; tx < N + pad; tx++) {
      const inside = tx >= 0 && ty >= 0 && tx < N && ty < N;
      const X = ox + sx(tx, ty);
      const Y = oy + sy(tx, ty) + pad * TH;
      // 핫픽스 7: 칸마다 색을 정하지 않고 도트마다 월드 좌표의 노이즈로 → 경계가 섞이고 얼룩이 불규칙 (바둑판 없음)
      void inside;
      tile(x, X, Y, (px, py) => {
        const rx = (px - ox) / (TW / 2);
        const ry = (py - oy - pad * TH) / (TH / 2);
        const wx = (rx + ry) / 2;
        const wy = (ry - rx) / 2;
        const h = hash(px, py);
        const n = fbm(wx * 0.55, wy * 0.55);
        // 가장자리: 노이즈로 들쭉날쭉하게 풀숲 → 어둠
        const edge = Math.min(wx, wy, N - wx, N - wy) + (n - 0.5) * 1.2;
        if (edge < 0) return T.outside(edge, wx, wy, h, P);
        // 보스 무대: 가운데 원형 문양 (두 겹 고리 + 여덟 점)
        if (deep) {
          const d = Math.hypot(wx - N / 2, wy - N / 2);
          const a = Math.atan2(wy - N / 2, wx - N / 2);
          if (Math.abs(d - 2.6) < 0.09 || (Math.abs(d - 2.2) < 0.06 && h < 0.7)) return P.rune;
          if (Math.abs(d - 2.4) < 0.16 && Math.abs(fr8(a)) < 0.06) return P.rune;
        }
        return T.floor(wx, wy, h, n, N, P, fbm);
      });
    }
  return c;
}
/** 문양 점: 각도를 여덟으로 나눈 나머지 (-0.5~0.5) */
const fr8 = (a: number) => {
  const v = (a / (Math.PI * 2)) * 8;
  return v - Math.round(v);
};

// ───────── 도트 숫자 (3×5) ─────────

const GLYPH: Record<string, string> = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', '+': '000010111010000',
};
export function digits(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, col: string, k: number) {
  const w = text.length * 4 * k - k;
  let cx = Math.round(x - w / 2);
  const cy = Math.round(y);
  // 어두운 테두리 1px
  for (const pass of [0, 1])
    for (let n = 0, ox = cx; n < text.length; n++, ox += 4 * k) {
      const g = GLYPH[text[n]];
      if (!g) continue;
      for (let i = 0; i < 15; i++) {
        if (g[i] !== '1') continue;
        const px = ox + (i % 3) * k;
        const py = cy + Math.floor(i / 3) * k;
        if (pass === 0) {
          const o = Math.max(1, Math.round(k / 3));
          ctx.fillStyle = '#140c18';
          ctx.fillRect(px - o, py - o, k + o * 2, k + o * 2);
        } else {
          ctx.fillStyle = col;
          ctx.fillRect(px, py, k, k);
        }
      }
    }
  void cx;
  cx = 0;
}

// ───────── 한 장 ─────────

let camX = 0;
let camY = 0;
export function draw(ctx: CanvasRenderingContext2D, f: Field, LW: number, LH: number) {
  // RIFTART: 하늘 균열 판은 심연 바닥이 아니라 밤하늘 + 구름 섬 (riftBg.ts)
  const rift = bgMode(f) === 'rift';
  const deep = !rift && f.stage >= 10;
  const T = rift ? RIFT_THEME : themeOf(f.region);
  const gk = rift ? `rift|0|${f.riftKey ?? 'sky'}` : `${f.region}|${deep ? 1 : 0}|${f.stage}`;
  if (groundKey !== gk) {
    if (groundKey.split('|').slice(0, 2).join('|') !== gk.split('|').slice(0, 2).join('|')) ground = rift ? riftIsland(buildGround(T, false)) : buildGround(T, deep);
    groundKey = gk;
    edgeProps = rift ? [] : placeProps(f.region, f.stage, C.field);
  }
  const calm = rift && (fxLite() || riftCalm());
  const N = C.field;
  // 카메라: 주인공을 따라 (정수 px) + 흔들림
  const tx = sx(f.me.x, f.me.y);
  const ty = sy(f.me.x, f.me.y);
  // HOTFIX15 §2: 흔들림 끔이면 카메라도 덜 출렁이게 — 화면 가운데 ±24px 안이면 안 움직이고, 따라가는 속도 0.18 → 0.08
  if (shakeLv() === 'off') {
    const dx = tx - LW / 2 - camX;
    const dy = ty - LH * 0.52 - camY;
    const DZ = 24;
    if (Math.abs(dx) > DZ) camX += (dx - Math.sign(dx) * DZ) * 0.08;
    if (Math.abs(dy) > DZ) camY += (dy - Math.sign(dy) * DZ) * 0.08;
  } else {
    camX += (tx - LW / 2 - camX) * 0.18;
    camY += (ty - LH * 0.52 - camY) * 0.18;
  }
  let ox = -Math.round(camX);
  let oy = -Math.round(camY);
  if (f.shake > 0) {
    const a = Math.round(f.shakeAmp);
    ox += Math.round((Math.random() * 2 - 1) * a);
    oy += Math.round((Math.random() * 2 - 1) * a);
  }
  const W = (x: number, y: number): [number, number] => [ox + Math.round(sx(x, y)), oy + Math.round(sy(x, y))];
  // RIFTART 하늘 균열: 밤하늘(그라데이션 · 별 · 소품) → 구름 섬 → 빛나는 금 (싸우는 이들은 그 위)
  if (rift) drawRiftSky(ctx, LW, LH, f.riftKey ?? 'sky', calm);
  else {
    ctx.fillStyle = deep ? deepen(T.pal.void, 0.32) : T.pal.void;
    ctx.fillRect(0, 0, LW, LH);
  }
  if (ground) ctx.drawImage(ground, ox - ground.width / 2, oy - 20 - 3 * TH - TH / 2 + TH / 2);
  if (rift) drawRiftCrack(ctx, calm);
  // REGIONS2 §4: 심연의 바닥 — 바닥 별 자국 넷 (보스 체력 25%마다 하나씩 켜짐)
  if (T.light === 'dark') starMarks(ctx, f, W, false);

  // 예고 범위 (발밑 빨간 타원 · 정수 줄로 그려 도트 유지)
  for (const m of f.units) {
    if (m.st !== 'tele' || !m.tele) continue;
    const prog = 1 - (m.stT ?? 0) / (m.teleMax ?? C.tele);
    const tl = m.tele;
    if (tl.x2 != null) {
      // 직선 돌진 예고: 띠 + 끝까지 차오르는 안쪽
      const band = (to: number, fill: string) => {
        const ex = tl.x + (tl.x2! - tl.x) * to;
        const ey = tl.y + (tl.y2! - tl.y) * to;
        const [nx, ny] = [-(tl.y2! - tl.y), tl.x2! - tl.x];
        const l = Math.hypot(nx, ny) || 1;
        const ox2 = (nx / l) * tl.w!;
        const oy2 = (ny / l) * tl.w!;
        const pts = [W(tl.x + ox2, tl.y + oy2), W(ex + ox2, ey + oy2), W(ex - ox2, ey - oy2), W(tl.x - ox2, tl.y - oy2)];
        ctx.fillStyle = fill;
        ctx.beginPath();
        pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.closePath();
        ctx.fill();
      };
      band(1, 'rgba(255,60,50,0.28)');
      band(prog, 'rgba(255,90,70,0.35)');
      continue;
    }
    const [X, Y] = W(tl.x, tl.y);
    ellipse(ctx, X, Y, tl.r * (TW / 2), tl.r * (TH / 2), 'rgba(255,60,50,0.28)', '#ff5a4a');
    ellipse(ctx, X, Y, tl.r * (TW / 2) * prog, tl.r * (TH / 2) * prog, 'rgba(255,90,70,0.35)', null);
  }
  // 정예: 발밑 금빛 고리 (깜빡)
  for (const m of f.units)
    if (m.elite && !m.boss && !m.dead && m.st !== 'spawn') {
      const [X, Y] = W(m.x, m.y);
      ellipse(ctx, X, Y, 11, 5, null, Math.floor(m.t * 4) % 2 ? '#ffd36b' : '#ff9a3a');
    }
  for (const fx of f.fx) {
    const [X, Y] = W(fx.x, fx.y);
    const p = fx.t / fx.dur;
    if (fx.kind === 'trap') ellipse(ctx, X, Y, 8, 4, 'rgba(160,120,60,.6)', '#c9a24a');
    // PARTY §1 화살비: 바닥 원 (깜빡이지 않게 테두리만 밝게)
    if (fx.kind === 'rain') ellipse(ctx, X, Y, (fx.r ?? 1) * (TW / 2), (fx.r ?? 1) * (TH / 2), 'rgba(122,208,106,.14)', p < 0.85 ? '#7ad06a' : '#3a6a3a');
    if (fx.kind === 'ring') ellipse(ctx, X, Y, (fx.r ?? 1) * (TW / 2) * p, (fx.r ?? 1) * (TH / 2) * p, null, p < 0.5 ? '#ffffff' : '#ffd36b');
    if (fx.kind === 'heal') ellipse(ctx, X, Y, (fx.r ?? 1) * (TW / 2) * Math.min(1, p * 2), (fx.r ?? 1) * (TH / 2) * Math.min(1, p * 2), 'rgba(120,255,140,.18)', '#8fe08f');
    if (fx.kind === 'boom') ellipse(ctx, X, Y, (fx.r ?? 1) * (TW / 2) * (0.4 + p * 0.6), (fx.r ?? 1) * (TH / 2) * (0.4 + p * 0.6), `rgba(255,160,60,${0.5 * (1 - p)})`, p < 0.6 ? '#ffd36b' : '#ff8a3a');
    // 핫픽스 8 (2-7): 바닥에 깔리는 그림 이펙트(원 파동 등)는 캐릭터 아래
    if (fx.kind === 'spr' && (fx.oy ?? 12) <= 2) fxDraw(ctx, fx.spr!, X, Y - (fx.oy ?? 0), p, fx.q ?? 0);
  }

  // 깊이 순서: 소품 · 유닛 · 금화
  type Thing = { d: number; draw: () => void };
  const things: Thing[] = [];
  for (const pr of f.props) {
    things.push({
      d: pr.x + pr.y,
      draw: () => {
        const [X, Y] = W(pr.x, pr.y);
        if (pr.kind === 'rock') {
          dotShadow(ctx, X, Y + 1, 7, 3);
          ctx.fillStyle = T.rock[0];
          ctx.fillRect(X - 6, Y - 6, 12, 7);
          ctx.fillStyle = T.rock[1];
          ctx.fillRect(X - 5, Y - 7, 7, 3);
          ctx.fillStyle = T.rock[2];
          ctx.fillRect(X - 6, Y, 12, 1);
        } else {
          const im = IMG[pr.kind];
          if (im) ctx.drawImage(im, X - Math.round(im.width / 2), Y - im.height + 4);
        }
      },
    });
  }
  // HUNT_WORLD §1: 둘레 소품 (필드 밖 · 판정 없음) + 빛나는 소품은 은은한 빛
  for (const pr of edgeProps) {
    const im = PROP_IMG[pr.k];
    if (!im) continue;
    things.push({
      d: pr.x + pr.y,
      draw: () => {
        const [X, Y] = W(pr.x, pr.y);
        const gl = T.glow[pr.k];
        if (gl && !fxLite()) glowAt(ctx, X, Y - im.height / 2, Math.max(im.width, im.height) * 0.9, gl, 0.22 + Math.sin(performance.now() / 600 + pr.x) * 0.05);
        dotShadow(ctx, X, Y + 1, Math.round(im.width / 3), 2);
        ctx.drawImage(im, X - Math.round(im.width / 2), Y - im.height + 3);
      },
    });
  }
  // 필드 가장자리 숲 (뒤쪽 · 숲 동굴만)
  for (let i = -1; i <= N && T.trees; i += 2) {
    // 핫픽스 7: 한 칸 더 바깥 (위쪽 나무가 반쯤 화면 밖으로)
    for (const [px, py] of [[i, -2.5], [-2.5, i]] as [number, number][])
      things.push({
        d: px + py - 5,
        draw: () => {
          const im = IMG[(i & 2) ? 'pine' : 'tree'];
          const [X, Y] = W(px, py);
          if (im) ctx.drawImage(im, X - Math.round(im.width / 2), Y - im.height + 4);
        },
      });
  }
  for (const u of f.units) things.push({ d: u.x + u.y, draw: () => (u.team === 'ally' ? drawAlly(ctx, f, u, W) : drawMob(ctx, u, W)) });
  // 장비: 등급 색 보석 + 영웅 이상은 빛기둥
  labelsOut.length = 0;
  for (const l of f.loot)
    things.push({
      d: l.x + l.y,
      draw: () => {
        const [X, Y] = W(l.x, l.y);
        const col = GRADE_COLOR[l.item.grade];
        const hi = l.item.grade === 'e' || l.item.grade === 'l' || l.item.grade === 'a';
        if (hi) {
          // 빛기둥: 반투명 없이 바둑 점 (위로 갈수록 성기게)
          for (let y = 0; y < 44; y++)
            for (let x = -2; x <= 2; x++) {
              if ((x + y + Math.floor(l.t * 12)) % 2 || (y > 22 && (x + y) % 4)) continue;
              ctx.fillStyle = Math.abs(x) <= 0 ? '#ffffff' : col;
              ctx.fillRect(X + x, Y - 4 - y, 1, 1);
            }
        }
        const z = Math.round(l.z);
        const by = Y - 3 - z + (l.t > 0.8 ? Math.round(Math.sin(l.t * 4)) : 0);
        ctx.fillStyle = '#140c18';
        ctx.fillRect(X - 3, by - 2, 7, 5);
        ctx.fillRect(X - 2, by - 3, 5, 7);
        ctx.fillStyle = col;
        ctx.fillRect(X - 2, by - 1, 5, 3);
        ctx.fillRect(X - 1, by - 2, 3, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(X - 1, by - 1, 1, 1);
        labelsOut.push({ x: X, y: by - 6, text: l.item.name, col });
      },
    });
  for (const d of f.drops)
    things.push({
      d: d.x + d.y,
      draw: () => {
        const [X, Y] = W(d.x, d.y);
        const y = Y - Math.round(d.z) - 2;
        ctx.fillStyle = d.kind === 'coin' ? '#ffd33a' : '#7ad06a';
        ctx.fillRect(X - 1, y - 1, 3, 3);
        ctx.fillStyle = d.kind === 'coin' ? '#fff3b0' : '#c8ffb0';
        ctx.fillRect(X - 1, y - 1, 1, 1);
        ctx.fillStyle = '#140c18';
        ctx.fillRect(X - 1, y + 2, 3, 1);
      },
    });
  things.sort((a, b) => a.d - b.d);
  for (const t of things) t.draw();

  // 슬래시 · 연기 · 탄
  for (const fx of f.fx) {
    const [X, Y] = W(fx.x, fx.y);
    const p = fx.t / fx.dur;
    if (fx.kind === 'slash') {
      // Ninja Adventure 베기 (바라보는 쪽으로 90° 단위 회전 · 3단째는 회오리)
      const sdx = screenDx(fx.ax ?? 1, fx.ay ?? 0);
      const sdy = (((fx.ax ?? 1) + (fx.ay ?? 0)) * TH) / 2;
      const q = Math.abs(sdx) > Math.abs(sdy) ? (sdx > 0 ? 3 : 1) : sdy > 0 ? 0 : 2;
      const ok = fx.big ? fxDraw(ctx, 'circular', X, Y - 12, p) : fxDraw(ctx, 'arc', X + Math.sign(sdx) * 4, Y - 12, p, q);
      if (!ok) slash(ctx, X, Y - 12, fx.ax ?? 1, fx.ay ?? 0, Math.min(2, Math.floor(p * 3)), !!fx.big);
    }
    if (fx.kind === 'puff' && !fxDraw(ctx, 'smoke', X, Y - 10, p)) puff(ctx, X, Y - 8, p, !!fx.big);
    // 신성 일격: 위에서 금빛 기둥이 내려꽂힌다 (바둑 점 · 반투명 없이)
    if (fx.kind === 'spr' && fx.spr === 'holy' && p < 0.7) {
      const top = Y - 60;
      const bot = Y - 4 - Math.round((1 - Math.min(1, p * 3)) * 50);
      for (let y = top; y < bot; y++)
        for (let x = -2; x <= 2; x++) {
          if (Math.abs(x) === 2 && (x + y) % 2) continue;
          ctx.fillStyle = Math.abs(x) <= 0 ? '#ffffff' : Math.abs(x) === 1 ? '#fff3b0' : '#ffd36b';
          ctx.fillRect(X + x, y, 1, 1);
        }
    }
    if (fx.kind === 'spr' && (fx.oy ?? 12) > 2) fxDraw(ctx, fx.spr!, X, Y - (fx.oy ?? 12), p, fx.q ?? 0);
    if (fx.kind === 'ring' && (fx.r ?? 0) >= 1.5) fxDraw(ctx, 'smokering', X, Y, p);
    // PARTY §1 화살비: 원 안에 화살이 비처럼 (가벼운 선 몇 개 · 이펙트 줄이기 단계면 더 적게)
    if (fx.kind === 'rain') {
      const n = fxLite() ? 4 : 9;
      const rr = fx.r ?? 1;
      for (let i = 0; i < n; i++) {
        const ph = (fx.t * 2.2 + i * 0.37) % 1;
        const a = i * 2.39996;
        const k = Math.sqrt(((i * 0.618) % 1)) * rr * 0.9;
        const [GX, GY] = W(fx.x + Math.cos(a) * k, fx.y + Math.sin(a) * k);
        const top = GY - 46 + Math.round(ph * 44);
        line(ctx, GX, top - 7, GX, top, '#efe2c6');
        ctx.fillStyle = '#7ad06a';
        ctx.fillRect(GX - 1, top, 2, 2);
      }
    }
  }
  // 핫픽스 8 (2-7): 탄 그림 — 마법탄 · 화염구 · 화살 · 쿠나이 (날아가는 쪽으로 90° 단위 회전)
  const PROJ_SPR: Record<string, string> = { bolt: 'p_energy', fire: 'p_fire', arrow: 'p_arrow', dagger: 'p_kunai' };
  for (const pj of f.proj) {
    const [X, Y] = W(pj.x, pj.y);
    const ps = PROJ_SPR[pj.kind];
    if (ps && fxDraw(ctx, ps, X, Y - 12, (pj.life * 6) % 1, quarterOf(pj.vx, pj.vy))) continue;
    const [TX, TY] = W(pj.x - pj.vx * 0.05, pj.y - pj.vy * 0.05);
    const col = pj.kind === 'fire' ? '#ff8a3a' : pj.kind === 'bolt' ? '#9ad0ff' : pj.kind === 'dagger' ? '#c8ff8a' : '#efe2c6';
    line(ctx, TX, TY - 12, X, Y - 12, pj.kind === 'fire' ? '#ffd36b' : 'rgba(255,255,255,.5)');
    ctx.fillStyle = col;
    ctx.fillRect(X - (pj.kind === 'fire' ? 2 : 1), Y - 13, pj.kind === 'fire' ? 4 : 2, pj.kind === 'fire' ? 4 : 2);
  }

  // HUNT_WORLD §1: 공기 입자 · 빛 (지역 테마)
  atmos(ctx, f, T, deep, LW, LH, W);

  // 피해 숫자: 위로 튀어 오르며 0.6초 — 핫픽스 7: 큰 화면(기기 픽셀)에 절반 크기로 그린다 (ui.ts)
  numsOut.length = 0;
  for (const n of f.nums) {
    const [X, Y] = W(n.x, n.y);
    const p = n.t / 0.6;
    const rise = Math.round(10 * (1 - Math.pow(1 - Math.min(1, p * 1.6), 2)));
    numsOut.push({ x: X + n.dx * 0.6, y: Y - 30 - rise, text: n.text, col: n.heal ? '#8fe08f' : n.crit ? '#ffd33a' : '#ffffff', crit: n.crit });
  }
}
/** 이번 장의 피해 숫자 (논리 좌표) */
export const numsOut: { x: number; y: number; text: string; col: string; crit: boolean }[] = [];

function drawAlly(ctx: CanvasRenderingContext2D, f: Field, u: Unit, W: (x: number, y: number) => [number, number]) {
  const cb = u.frames!.cb();
  const [X, Y0] = W(u.x, u.y);
  // 핫픽스 8 (2-7): 도약 — 포물선으로 떠오르고 그림자가 작아진다
  const jk = u.jump ? Math.min(1, u.jump.t / u.jump.dur) : 0;
  const lift = u.jump ? Math.round(Math.sin(jk * Math.PI) * 16) : 0;
  const Y = Y0;
  // 잔상 3장 (그림자 찌르기)
  if (u.trail?.length) {
    const im = cb.atk[1];
    for (const tr of u.trail) {
      const [tx, ty] = W(tr.x, tr.y);
      ctx.globalAlpha = Math.max(0, Math.min(0.45, tr.t));
      ctx.drawImage(screenDx(u.ax, u.ay) < 0 ? flipOf(im) : im, tx - Math.round(im.width / 2), ty - im.height + 2);
    }
    ctx.globalAlpha = 1;
  }
  // 발밑 그림자: 2톤 도트 타원 (알파 0/255)
  dotShadow(ctx, X, Y, u.jump ? 4 : 7, u.jump ? 2 : 3);
  if (u === f.me) ellipse(ctx, X, Y, 9, 4, null, '#ffd36b');
  const up = u.ax + u.ay < -0.2;
  // 리마스터 프레임: 대기 3 · 걷기 6 · 공격 4(휘두르는 시간에 맞춰) · 구르기 4 · 시전 3 · 피격 · 쓰러짐 3
  let img: HTMLCanvasElement;
  if (u.dead) img = cb.die[Math.min(2, Math.floor(u.deadT * 5))];
  else if ((u.dodge ?? 0) > 0) img = cb.roll[Math.min(3, Math.floor((1 - (u.dodge ?? 0) / C.dodge.dur) * 4))];
  else if ((u.hurtT ?? 0) > 0) img = cb.hurt[0];
  else if ((u.castAnim ?? 0) > 0) img = cb.cast[Math.max(0, Math.min(2, Math.floor((1 - (u.castAnim ?? 0) / 0.3) * 3)))];
  else if ((u.swing ?? 0) > 0) img = cb.atk[Math.min(3, Math.floor((1 - (u.swing ?? 0) / (u.swingMax ?? C.combo.swing)) * 4))];
  else if (u.moving) img = (up ? cb.walkB : cb.walk)[Math.floor(u.t * 12) % 6];
  // HERODOT: 새 도트는 2.5초에 한 번 눈 깜빡임 (blink 프레임이 있을 때만)
  else if (!up && cb.blink && u.t % 2.5 < 0.12) img = cb.blink;
  else img = (up ? cb.idleB : cb.idle)[Math.floor(u.t * 3) % 3];
  let left = screenDx(u.ax, u.ay) < 0;
  // 회전 베기: 실제로 한 바퀴 (오른쪽 → 뒤 → 왼쪽 → 앞)
  if ((u.spinT ?? 0) > 0) {
    const ph = Math.floor((1 - (u.spinT ?? 0) / 0.4) * 8) % 4;
    img = ph === 1 ? cb.idleB[0] : ph === 3 ? cb.idle[0] : cb.atk[2];
    left = ph === 2;
  }
  if (left) img = flipOf(img);
  const y0 = Y - img.height + 2 - lift;
  ctx.globalAlpha = u.dead ? 0.6 : (u.inv ?? 0) > 0 && Math.floor(u.t * 30) % 2 ? 0.55 : 1;
  ctx.drawImage(u.flash > 0 ? whiteOf(img) : img, X - Math.round(img.width / 2), y0);
  ctx.globalAlpha = 1;
  // 시전: 마법사·사제는 손(지팡이 끝)에 빛 · 사냥꾼은 활 당기기
  if ((u.castAnim ?? 0) > 0 && (u.job === 'mage' || u.job === 'priest')) {
    const hx = X + (left ? -7 : 7);
    const hy = y0 + 8;
    const on = Math.floor(u.t * 20) % 2;
    ctx.fillStyle = u.job === 'mage' ? (on ? '#ffd36b' : '#ff8a3a') : on ? '#fff3b0' : '#ffd36b';
    ctx.fillRect(hx - 1, hy - 1, 3, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx, hy, 1, 1);
  }
  if ((u.taunt ?? 0) > 0) {
    ctx.fillStyle = '#ff7a5a';
    ctx.fillRect(X - 1, y0 - 6, 2, 4);
    ctx.fillRect(X - 1, y0 - 1, 2, 1);
  }
  // 체력 (동료만 작게)
  if (!u.dead && u !== f.me) bar(ctx, X, y0 - 3, u.hp / u.max, '#7ad06a');
}

function drawMob(ctx: CanvasRenderingContext2D, m: Unit, W: (x: number, y: number) => [number, number]) {
  const sh = sheets[m.mon!];
  const [X, Y] = W(m.x, m.y);
  if (m.st === 'spawn') return;
  dotShadow(ctx, X, Y, m.boss ? Math.round(m.r * 20) : 7, m.boss ? 5 : 3);
  if (!sh) return;
  let anim = 'idle';
  let t = m.t;
  if (m.dead) {
    anim = 'die';
    t = m.deadT;
  } else if (m.boss && m.st === 'tele') {
    anim = sh.meta.anims.charge ? 'charge' : 'attack';
  } else if (m.boss && m.st === 'strike') {
    anim = 'attack';
    t = 0.35 - (m.stT ?? 0);
  } else if (m.st === 'tele') {
    anim = 'attack';
    t = 0;
  } else if (m.st === 'strike') {
    anim = 'attack';
    t = 1 / sh.meta.anims.attack.fps;
  } else if (m.st === 'recover' && (m.stT ?? 0) > C.recover - 0.15) {
    anim = 'attack';
    t = 2 / sh.meta.anims.attack.fps;
  } else if (Math.hypot(m.vx, m.vy) > 2.5) anim = 'hurt';
  else if (m.moving) anim = 'move';
  const a = sh.meta.anims[anim] ?? sh.meta.anims.idle;
  const fr = sh.frames[anim][frameAt(a, t)];
  const left = screenDx(m.ax, m.ay) < 0;
  const img = m.flash > 0 ? fr.w : left ? fr.l : fr.r;
  const [ax, ay] = sh.meta.anchor;
  const px = left ? sh.meta.frameW - ax : ax;
  if (sh.meta.code) {
    codeBoss(ctx, m, sh, img, X - px, Y - ay, left);
    return;
  }
  ctx.globalAlpha = m.dead ? Math.max(0, 1 - m.deadT * 1.8) : 1;
  ctx.drawImage(img, X - px, Y - ay);
  ctx.globalAlpha = 1;
  // 보스 체력은 위쪽 HUD 막대 · 정예는 금빛 막대 + 왕관 점
  if (!m.dead && !m.boss && m.hp < m.max) bar(ctx, X, Y - ay - 3, m.hp / m.max, m.elite ? '#ffd36b' : '#ff6a5a');
  if (m.elite && !m.boss && !m.dead) {
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(X - 2, Y - ay - 8, 5, 1);
    ctx.fillRect(X - 2, Y - ay - 9, 1, 1);
    ctx.fillRect(X, Y - ay - 9, 1, 1);
    ctx.fillRect(X + 2, Y - ay - 9, 1, 1);
  }
  if (m.stun > 0) {
    // 기절 별 셋이 돈다
    ctx.fillStyle = '#ffd36b';
    for (let i = 0; i < 3; i++) {
      const a = m.t * 6 + (i * Math.PI * 2) / 3;
      ctx.fillRect(X + Math.round(Math.cos(a) * 5), Y - ay - 6 + Math.round(Math.sin(a) * 2), 1, 1);
    }
  }
  // 핫픽스 8 (2-7): 도발 함성에 걸린 몹 머리 위 「!」
  if ((m.alertT ?? 0) > 0 && !m.dead) {
    ctx.fillStyle = '#140c18';
    ctx.fillRect(X - 2, Y - ay - 14, 4, 8);
    ctx.fillStyle = '#ff5a4a';
    ctx.fillRect(X - 1, Y - ay - 13, 2, 4);
    ctx.fillRect(X - 1, Y - ay - 8, 2, 1);
  }
  // 독 단검: 초록 거품
  if (m.dot && !m.dead) {
    const k = Math.floor(m.t * 6);
    ctx.fillStyle = '#7ad06a';
    for (let i = 0; i < 3; i++) ctx.fillRect(X - 3 + i * 3, Y - ay - 2 - ((k + i * 2) % 5), 2, 2);
    ctx.fillStyle = '#c8ff8a';
    ctx.fillRect(X - 3 + (k % 3) * 3, Y - ay - 3 - (k % 4), 1, 1);
  }
}

/** 2톤 도트 그림자: 가운데는 촘촘한 바둑 점, 가장자리는 성긴 점 (반투명 없이) */
/** gap: FIRSTLOOK §6 flCharPop — 디더 빈칸도 같은 색을 이 알파로 채운다 (0 = 예전 그대로) */
export function dotShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, gap = 0) {
  const a0 = ctx.globalAlpha;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    for (let x = -w; x <= w; x++) {
      const core = (x * x) / (rx * rx * 0.45) + (y * y) / (ry * ry * 0.45) <= 1;
      const on = core ? (x + y) % 2 === 0 : (x + y) % 2 === 0 && (y % 2 === 0 || Math.abs(x) % 4 === 0);
      if (!on && !gap) continue;
      ctx.fillStyle = core ? '#1c1424' : '#2a2230';
      if (gap) ctx.globalAlpha = on ? a0 : a0 * gap;
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  if (gap) ctx.globalAlpha = a0;
}

function bar(ctx: CanvasRenderingContext2D, X: number, Y: number, p: number, col: string) {
  ctx.fillStyle = '#140c18';
  ctx.fillRect(X - 7, Y, 14, 3);
  ctx.fillStyle = col;
  ctx.fillRect(X - 6, Y + 1, Math.max(0, Math.round(12 * p)), 1);
}

/** 쿼터뷰 타원 (정수 줄로 채우기 · 테두리 1px) */
function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, fill: string | null, edge: string | null) {
  rx = Math.max(1, Math.round(rx));
  ry = Math.max(1, Math.round(ry));
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
    if (edge) {
      ctx.fillStyle = edge;
      ctx.fillRect(cx - w, cy + y, 1, 1);
      ctx.fillRect(cx + w, cy + y, 1, 1);
      if (Math.abs(y) === ry) ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
  }
}
function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  ctx.fillStyle = col;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / (n || 1)), Math.round(y0 + ((y1 - y0) * i) / (n || 1)), 1, 1);
}
/** 반원 슬래시 (3프레임): 바라보는 쪽으로 호를 그리며 */
function slash(ctx: CanvasRenderingContext2D, X: number, Y: number, ax: number, ay: number, frame: number, big: boolean) {
  const dx = ((ax - ay) * TW) / 2;
  const dy = ((ax + ay) * TH) / 2;
  const base = Math.atan2(dy, dx);
  const R = big ? 16 : 11;
  const span = big ? 2.4 : 1.8;
  const from = base - span / 2 + (frame * span) / 3;
  const to = from + span / 2;
  for (let a = from; a <= to; a += 0.06)
    for (let r = R - (big ? 3 : 2); r <= R; r++) {
      const x = Math.round(X + Math.cos(a) * r);
      const y = Math.round(Y + Math.sin(a) * r * 0.75);
      ctx.fillStyle = r === R ? '#ffffff' : frame === 2 ? '#c8d8ff' : '#fff3b0';
      ctx.fillRect(x, y, 1, 1);
    }
}
/** "펑" 연기 도트 */
function puff(ctx: CanvasRenderingContext2D, X: number, Y: number, p: number, big: boolean) {
  const n = big ? 6 : 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = Math.round((big ? 10 : 6) * p);
    const s = Math.max(1, Math.round((big ? 4 : 3) * (1 - p)));
    ctx.fillStyle = p < 0.4 ? '#ffffff' : '#c8c0d0';
    ctx.fillRect(Math.round(X + Math.cos(a) * r) - s, Math.round(Y + Math.sin(a) * r * 0.6) - s, s * 2, s * 2);
  }
}

/** HOTFIX15: 흔들림 끔일 때 보스 충격 — 화면 가장자리 붉은 비네트 (화면 전체는 움직이지 않음) */
export function drawVignette(ctx: CanvasRenderingContext2D, f: Field, LW: number, LH: number) {
  if (!f.vign) return;
  const a = Math.min(1, f.vign / 0.3) * 0.55;
  const g = ctx.createRadialGradient(LW / 2, LH / 2, Math.min(LW, LH) * 0.35, LW / 2, LH / 2, Math.max(LW, LH) * 0.75);
  g.addColorStop(0, 'rgba(200,20,20,0)');
  g.addColorStop(1, `rgba(200,20,20,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LW, LH);
}

// ───────── HUNT_WORLD §1: 둘레 소품 · 공기 입자 · 빛 ─────────

let edgeProps: { x: number; y: number; k: string }[] = [];
/** 은은한 빛 (가운데 밝고 바깥으로 사라짐) */
function glowAt(ctx: CanvasRenderingContext2D, X: number, Y: number, r: number, rgb: string, a: number) {
  const g = ctx.createRadialGradient(X, Y, 0, X, Y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(Math.round(X - r), Math.round(Y - r), Math.ceil(r * 2), Math.ceil(r * 2));
}
interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  c: string;
  s: number;
}
const motes: Mote[] = [];
let moteRegion = '';
let lastT = 0;
/** 화면당 입자 수 (명세: 30개 안쪽) */
const MOTES = 24;
function spawnMote(p: Theme['particle'], LW: number, LH: number, anywhere: boolean): Mote {
  const R = Math.random;
  const x = R() * LW;
  const y = anywhere ? R() * LH : p === 'spore' || p === 'star' || p === 'spray' || p === 'ember' || p === 'upfall' ? LH + 4 : p === 'dust' || p === 'sand' ? R() * LH : -4;
  switch (p) {
    case 'leaf':
      // 나뭇잎 팔랑 · 가끔 반딧불
      return R() < 0.35
        ? { x, y: anywhere ? y : R() * LH, vx: (R() - 0.5) * 6, vy: (R() - 0.5) * 6, t: 0, life: 3 + R() * 3, c: '#e8ff8a', s: 1 }
        : { x, y, vx: 6 + R() * 6, vy: 10 + R() * 8, t: 0, life: 8 + R() * 6, c: R() < 0.5 ? '#7cc04e' : '#c8a040', s: 2 };
    case 'spore':
      return { x, y, vx: (R() - 0.5) * 4, vy: -(4 + R() * 6), t: 0, life: 8 + R() * 6, c: R() < 0.5 ? '#c890ff' : '#6ae0d0', s: 1 };
    case 'dust':
      return { x, y, vx: 2 + R() * 3, vy: (R() - 0.5) * 2, t: 0, life: 6 + R() * 6, c: '#a8a096', s: 1 };
    case 'snow':
      return { x, y, vx: -3 + R() * 4, vy: 10 + R() * 10, t: 0, life: 10 + R() * 6, c: R() < 0.7 ? '#ffffff' : '#cfe8ff', s: R() < 0.3 ? 2 : 1 };
    case 'star':
      return { x, y, vx: (R() - 0.5) * 3, vy: -(6 + R() * 8), t: 0, life: 8 + R() * 6, c: R() < 0.6 ? '#ffd36b' : '#fff3c0', s: 1 };
    // REGIONS2 §4
    case 'spray':
      // 물보라: 아래에서 튀어 오르다 사라짐 · 가끔 갈매기 그림자 (큰 점, 가로로)
      return R() < 0.15
        ? { x: anywhere ? x : -6, y: R() * LH, vx: 22 + R() * 10, vy: (R() - 0.5) * 3, t: 0, life: 12, c: 'rgba(20,40,60,.35)', s: 3 }
        : { x, y, vx: (R() - 0.5) * 6, vy: -(10 + R() * 10), t: 0, life: 2 + R() * 3, c: R() < 0.6 ? '#e8f6ff' : '#9ad8ee', s: 1 };
    case 'sand':
      // 모래 바람 줄기: 옆으로 빠르게
      return { x: anywhere ? x : -4, y, vx: 30 + R() * 25, vy: (R() - 0.5) * 4, t: 0, life: 6 + R() * 4, c: R() < 0.6 ? '#f6e2a8' : '#cfa95e', s: R() < 0.3 ? 2 : 1 };
    case 'ember':
      return { x, y, vx: (R() - 0.5) * 8, vy: -(12 + R() * 14), t: 0, life: 5 + R() * 5, c: R() < 0.5 ? '#ffb040' : R() < 0.6 ? '#ff6a2a' : '#ffe08a', s: 1 };
    case 'petal':
      return { x, y, vx: 6 + R() * 8, vy: 6 + R() * 6, t: 0, life: 10 + R() * 6, c: R() < 0.45 ? '#ffd0e0' : R() < 0.6 ? '#ffffff' : '#c8e8ff', s: R() < 0.4 ? 2 : 1 };
    case 'upfall':
      // 거꾸로 떨어지는 빛 가루: 아주 느리게 위로
      return { x, y, vx: (R() - 0.5) * 2, vy: -(3 + R() * 4), t: 0, life: 14 + R() * 8, c: R() < 0.6 ? '#b8a8ff' : '#fff3c0', s: 1 };
  }
}
function atmos(ctx: CanvasRenderingContext2D, f: Field, T: Theme, deep: boolean, LW: number, LH: number, W: (x: number, y: number) => [number, number]) {
  const now = performance.now();
  const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  const low = fxLite();
  // ── 빛 (입자 아래) ──
  const [MX, MY] = W(f.me.x, f.me.y);
  if (T.light === 'sun' && !deep) {
    // 초록빛 햇살 줄기: 비스듬한 띠 3개가 천천히 흔들림
    ctx.fillStyle = 'rgba(220,255,160,0.07)';
    for (let i = 0; i < 3; i++) {
      const x0 = ((i * 0.37 + 0.12) * LW + Math.sin(now / 4000 + i) * 8) | 0;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + 18, 0);
      ctx.lineTo(x0 + 18 + LH * 0.45, LH);
      ctx.lineTo(x0 + LH * 0.45, LH);
      ctx.closePath();
      ctx.fill();
    }
  } else if (T.light === 'fog') {
    // 탁한 보라 안개: 화면 전체 + 낮게 흐르는 띠
    ctx.fillStyle = 'rgba(90,50,120,0.12)';
    ctx.fillRect(0, 0, LW, LH);
    if (!low)
      for (let i = 0; i < 3; i++) {
        const y = ((i * 0.33 + 0.2) * LH) | 0;
        const x = (((now / 90 + i * 70) % (LW + 120)) - 60) | 0;
        glowAt(ctx, x, y, 60, '150,100,180', 0.12);
      }
  } else if (T.light === 'lamp') {
    // 등불 주변만 밝은 어둠: 어둠 판에 주인공·등불 자리만 뚫는다
    const cv = (darkCv ??= document.createElement('canvas'));
    if (cv.width !== LW || cv.height !== LH) (cv.width = LW), (cv.height = LH);
    const x = cv.getContext('2d')!;
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, LW, LH);
    x.fillStyle = `rgba(4,2,8,${deep ? 0.66 : 0.52})`;
    x.fillRect(0, 0, LW, LH);
    x.globalCompositeOperation = 'destination-out';
    const hole = (X: number, Y: number, r: number) => {
      const g = x.createRadialGradient(X, Y, 0, X, Y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(X - r, Y - r, r * 2, r * 2);
    };
    hole(MX, MY - 12, 78 + Math.sin(now / 300) * 2);
    for (const pr of edgeProps) if (pr.k === 'mine_beam') {
      const [X, Y] = W(pr.x, pr.y);
      hole(X, Y - 30, 44);
    }
    ctx.drawImage(cv, 0, 0);
    for (const pr of edgeProps) if (pr.k === 'mine_beam') {
      const [X, Y] = W(pr.x, pr.y);
      glowAt(ctx, X, Y - 30, 30, '255,190,90', 0.18);
    }
  } else if (T.light === 'cold') {
    ctx.fillStyle = 'rgba(110,170,240,0.09)';
    ctx.fillRect(0, 0, LW, LH);
  } else if (T.light === 'rise') {
    // 바닥 균열에서 올라오는 금빛
    const g = ctx.createLinearGradient(0, LH, 0, LH * 0.4);
    g.addColorStop(0, `rgba(255,200,90,${deep ? 0.16 : 0.11})`);
    g.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, (LH * 0.4) | 0, LW, Math.ceil(LH * 0.6));
  }
  else if (T.light === 'dusk') {
    // 해 질 녘 주황 (위에서 아래로) + 등대 회전 빛
    const g = ctx.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, `rgba(255,140,60,${deep ? 0.08 : 0.16})`);
    g.addColorStop(1, 'rgba(120,60,90,0.06)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LW, LH);
    if (!low)
      for (const pr of edgeProps) if (pr.k === 'coast_lighthouse') {
        const [X, Y] = W(pr.x, pr.y);
        const a = now / 1400 + pr.x;
        const L = Math.max(LW, LH) * 0.6;
        const ly = Y - 40;
        ctx.fillStyle = 'rgba(255,236,170,0.10)';
        ctx.beginPath();
        ctx.moveTo(X, ly);
        ctx.lineTo(X + Math.cos(a - 0.12) * L, ly + Math.sin(a - 0.12) * L * 0.5);
        ctx.lineTo(X + Math.cos(a + 0.12) * L, ly + Math.sin(a + 0.12) * L * 0.5);
        ctx.closePath();
        ctx.fill();
        glowAt(ctx, X, ly, 14, '255,236,170', 0.5);
      }
  } else if (T.light === 'noon') {
    // 강한 정오 햇빛 · 가장자리 그림자 짙게
    ctx.fillStyle = 'rgba(255,244,210,0.10)';
    ctx.fillRect(0, 0, LW, LH);
    const g = ctx.createRadialGradient(LW / 2, LH / 2, Math.min(LW, LH) * 0.35, LW / 2, LH / 2, Math.max(LW, LH) * 0.75);
    g.addColorStop(0, 'rgba(60,30,0,0)');
    g.addColorStop(1, 'rgba(60,30,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LW, LH);
  } else if (T.light === 'lava') {
    // 아래에서 올라오는 붉은 빛 + 붉은 비네트
    const g = ctx.createLinearGradient(0, LH, 0, LH * 0.3);
    g.addColorStop(0, `rgba(255,80,30,${deep ? 0.24 : 0.18})`);
    g.addColorStop(1, 'rgba(255,80,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, (LH * 0.3) | 0, LW, Math.ceil(LH * 0.7));
    const v = ctx.createRadialGradient(LW / 2, LH / 2, Math.min(LW, LH) * 0.35, LW / 2, LH / 2, Math.max(LW, LH) * 0.75);
    v.addColorStop(0, 'rgba(90,10,0,0)');
    v.addColorStop(1, 'rgba(90,10,0,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, LW, LH);
  } else if (T.light === 'skylight') {
    // 밝은 하늘빛 + 흐르는 구름 그림자
    ctx.fillStyle = 'rgba(190,225,255,0.08)';
    ctx.fillRect(0, 0, LW, LH);
    if (!low)
      for (let i = 0; i < 3; i++) {
        const x = (((now / 70 + i * 160) % (LW + 200)) - 100) | 0;
        const y = ((i * 0.31 + 0.15) * LH) | 0;
        ctx.fillStyle = 'rgba(40,70,120,0.08)';
        ctx.beginPath();
        ctx.ellipse(x, y, 60, 22, 0, 0, Math.PI * 2);
        ctx.fill();
      }
  } else if (T.light === 'rift') {
    // RIFTART: 위쪽 금에서 내려오는 옅은 보라 빛
    const g = ctx.createLinearGradient(0, 0, 0, LH * 0.55);
    g.addColorStop(0, 'rgba(176,112,255,0.14)');
    g.addColorStop(1, 'rgba(176,112,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LW, Math.ceil(LH * 0.55));
  } else if (T.light === 'dark') {
    // 아주 어둡게 · 위로 아득한 입구에 작은 빛 하나 · 켜진 별 자국만 빛난다
    ctx.fillStyle = `rgba(2,2,10,${deep ? 0.42 : 0.32})`;
    ctx.fillRect(0, 0, LW, LH);
    glowAt(ctx, LW / 2, 4, 26, '220,210,255', 0.35);
    ctx.fillStyle = '#fff3c0';
    ctx.fillRect((LW / 2) | 0, 3, 1, 1);
    starMarks(ctx, f, W, true);
  }
  // 깊은 곳: 가장자리를 더 어둡게
  if (deep) {
    const g = ctx.createRadialGradient(LW / 2, LH / 2, Math.min(LW, LH) * 0.3, LW / 2, LH / 2, Math.max(LW, LH) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LW, LH);
  }
  // ── 공기 입자 (저사양이면 끔) ──
  if (low) return;
  const mk = f.world ? 'rift' : f.region;
  if (moteRegion !== mk) {
    moteRegion = mk;
    motes.length = 0;
    for (let i = 0; i < MOTES; i++) motes.push(spawnMote(T.particle, LW, LH, true));
  }
  for (let i = 0; i < motes.length; i++) {
    const m = motes[i];
    m.t += dt;
    const sway = (T.particle === 'leaf' && m.s === 2) || T.particle === 'petal' ? Math.sin(m.t * 3 + i) * 8 : T.particle === 'snow' || T.particle === 'upfall' ? Math.sin(m.t * 2 + i) * 4 : 0;
    m.x += (m.vx + sway) * dt;
    m.y += m.vy * dt;
    if (m.t > m.life || m.x < -8 || m.x > LW + 8 || m.y < -8 || m.y > LH + 8) {
      motes[i] = spawnMote(T.particle, LW, LH, false);
      continue;
    }
    // 반딧불·별 가루는 깜빡
    const blink = (T.particle === 'leaf' && m.s === 1) || T.particle === 'star' || T.particle === 'upfall' || T.particle === 'ember' ? Math.sin(m.t * 5 + i) > -0.3 : true;
    if (!blink) continue;
    ctx.fillStyle = m.c;
    ctx.fillRect(Math.round(m.x), Math.round(m.y), m.s, m.s);
  }
  // 얼음 협곡: 숨결 김 (주인공 머리 옆 하얀 점 몇 개)
  if (T.light === 'cold') {
    const ph = (now / 1600) % 1;
    if (ph < 0.5) {
      ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - ph * 2)})`;
      const k = Math.round(ph * 10);
      ctx.fillRect(MX + 4 + k, MY - 22 - (k >> 1), 2, 1);
      ctx.fillRect(MX + 6 + k, MY - 23 - (k >> 1), 1, 1);
    }
  }
}
let darkCv: HTMLCanvasElement | null = null;

// ───────── REGIONS2: 심연의 바닥 별 자국 · 「별을 삼킨 것」 코드 연출 ─────────

/** 별 자국 네 자리 (필드 칸) */
const MARKS: [number, number][] = [[0.5, -3.4], [3.4, 0.4], [-0.4, 3.4], [-3.4, -0.5]];
/** 켜진 별 자국 수: 지역 10 보스전이면 체력 25%마다 하나 (보스가 쓰러지면 넷) */
export function marksLit(f: Field): number {
  const b = f.elite?.boss ? f.elite : null;
  if (!b || f.stage < 10) return 0;
  if (b.dead) return 4;
  return Math.max(0, Math.min(4, Math.floor((1 - b.hp / b.max) * 4 + 1e-6)));
}
function starMarks(ctx: CanvasRenderingContext2D, f: Field, W: (x: number, y: number) => [number, number], glow: boolean) {
  const N = C.field;
  const lit = marksLit(f);
  MARKS.forEach(([dx, dy], i) => {
    const [X, Y] = W(N / 2 + dx, N / 2 + dy);
    const on = i < lit;
    if (glow) {
      if (on && !fxLite()) glowAt(ctx, X, Y, 22, '255,226,140', 0.32 + Math.sin(performance.now() / 300 + i) * 0.06);
      if (!on) return;
    }
    // 다섯 갈래 별 모양 (점)
    const c1 = on ? '#fff3c0' : '#2e2850';
    const c2 = on ? '#ffd36b' : '#211c3a';
    ctx.fillStyle = c2;
    for (const [x, y] of [[-3, 0], [3, 0], [0, -2], [-2, 2], [2, 2]] as [number, number][]) ctx.fillRect(X + x, Y + y, 1, 1);
    ctx.fillStyle = c1;
    ctx.fillRect(X - 1, Y, 3, 1);
    ctx.fillRect(X, Y - 1, 1, 3);
  });
}
const dieAt = new WeakMap<Unit, number>();
/** 「별을 삼킨 것」: 대기·공격 두 장뿐 — 숨쉬기(위아래 1px) · 피격 흰 번쩍(공통) · 금빛 눈 · 죽으면 아래부터 별빛으로 흩어진다 */
function codeBoss(ctx: CanvasRenderingContext2D, m: Unit, sh: MonSheet, img: HTMLCanvasElement, x0: number, y0: number, left: boolean) {
  const now = performance.now();
  const breath = m.dead ? 0 : Math.round(Math.sin(m.t * 2.4));
  const W0 = sh.meta.frameW;
  const H0 = sh.meta.frameH;
  if (!m.dead) {
    ctx.drawImage(img, x0, y0 + breath);
  } else {
    if (!dieAt.has(m)) dieAt.set(m, now);
    const p = Math.min(1, (now - dieAt.get(m)!) / 1400);
    const keep = Math.round(H0 * (1 - p));
    if (keep > 0) ctx.drawImage(img, 0, 0, W0, keep, x0, y0, W0, keep);
    // 흩어지는 줄: 금빛·흰 점이 위로
    if (p < 1)
      for (let i = 0; i < 14; i++) {
        const sx = x0 + ((i * 37 + Math.floor(now / 60) * 13) % W0);
        const rise = ((now / 18 + i * 11) % 20) | 0;
        ctx.fillStyle = i % 3 ? '#ffd36b' : '#ffffff';
        ctx.fillRect(sx, y0 + keep - rise, 1, 1);
      }
    return;
  }
  // 눈: 금빛으로 살짝 (깜빡이듯 숨쉼)
  const eyes = (sh.meta as unknown as { eyes?: [number, number][] }).eyes ?? [];
  if (!fxLite())
    for (const [ex, ey] of eyes) {
      const ix = left ? W0 - 1 - ex : ex;
      glowAt(ctx, x0 + ix, y0 + ey + breath, 5, '255,211,107', 0.45 + Math.sin(now / 400) * 0.15);
    }
}
