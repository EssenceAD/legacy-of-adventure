// 전투 그리기: 논리 해상도(도트 1개 = 1px) 캔버스에 전부 같은 크기로 → 화면 캔버스에 정수배로 키운다
//  바닥 타일 · 예고 범위 · 캐릭터/몬스터 · 슬래시 · 탄 · 연기 · 금화 · 도트 숫자 · 흔들림(정수 px)
import { CONFIG } from '../data/config';
import { IMG } from '../engine/assets';
import { sx, sy, TH, TW } from '../engine/iso';
import { frameAt, flipOf, whiteOf, type MonSheet } from './mon';
import { screenDx, type Field, type Unit } from './field';

const C = CONFIG.combat;
export const sheets: Partial<Record<string, MonSheet>> = {};

// ───────── 지역 바닥 (마을 타일과 같은 32×16 쿼터뷰 · 숲: 풀과 흙) ─────────

const PAL: Record<string, { a: string; b: string; c: string; dirt: string; dirtD: string; edge: string; void: string }> = {
  forest: { a: '#5f9a3c', b: '#6fae45', c: '#4f8a34', dirt: '#a07a4a', dirtD: '#7a5a34', edge: '#3e6a2c', void: '#1e3420' },
};
let ground: HTMLCanvasElement | null = null;
let groundKey = '';
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
};
function tile(ctx: CanvasRenderingContext2D, X: number, Y: number, fill: (px: number, py: number) => string) {
  for (let k = 0; k < TH; k++) {
    const hw = (k < TH / 2 ? k + 1 : TH - k) * 2;
    for (let i = -hw; i < hw; i++) {
      ctx.fillStyle = fill(X + i, Y + k);
      ctx.fillRect(X + i, Y + k, 1, 1);
    }
  }
}
function buildGround(region: string): HTMLCanvasElement {
  const N = C.field;
  const P = PAL[region] ?? PAL.forest;
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
      // 흙: 굽은 오솔길 한 줄 + 드문드문 맨땅 (바둑판처럼 보이지 않게)
      const path = Math.abs(ty - (N / 2 + Math.sin(tx * 0.7) * 1.6)) < 0.7;
      const dirt = inside && (path || hash(tx, ty) < 0.06);
      tile(x, X, Y, (px, py) => {
        const h = hash(px, py);
        if (!inside) return h < 0.5 ? P.edge : P.void;
        if (dirt) return h < 0.12 ? P.dirtD : h < 0.25 ? P.c : P.dirt;
        return h < 0.1 ? P.c : h < 0.22 ? P.b : P.a;
      });
    }
  return c;
}

// ───────── 도트 숫자 (3×5) ─────────

const GLYPH: Record<string, string> = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', '+': '000010111010000',
};
function digits(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, col: string, k: number) {
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
          ctx.fillStyle = '#140c18';
          ctx.fillRect(px - 1, py - 1, k + 2, k + 2);
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
  if (groundKey !== f.region) {
    ground = buildGround(f.region);
    groundKey = f.region;
  }
  const N = C.field;
  // 카메라: 주인공을 따라 (정수 px) + 흔들림
  const tx = sx(f.me.x, f.me.y);
  const ty = sy(f.me.x, f.me.y);
  camX += (tx - LW / 2 - camX) * 0.18;
  camY += (ty - LH * 0.52 - camY) * 0.18;
  let ox = -Math.round(camX);
  let oy = -Math.round(camY);
  if (f.shake > 0) {
    const a = Math.round(f.shakeAmp);
    ox += Math.round((Math.random() * 2 - 1) * a);
    oy += Math.round((Math.random() * 2 - 1) * a);
  }
  const W = (x: number, y: number): [number, number] => [ox + Math.round(sx(x, y)), oy + Math.round(sy(x, y))];
  ctx.fillStyle = (PAL[f.region] ?? PAL.forest).void;
  ctx.fillRect(0, 0, LW, LH);
  if (ground) ctx.drawImage(ground, ox - ground.width / 2, oy - 20 - 3 * TH - TH / 2 + TH / 2);

  // 예고 범위 (발밑 빨간 타원 · 정수 줄로 그려 도트 유지)
  for (const m of f.units) {
    if (m.st !== 'tele' || !m.tele) continue;
    const prog = 1 - (m.stT ?? 0) / C.tele;
    const [X, Y] = W(m.tele.x, m.tele.y);
    ellipse(ctx, X, Y, m.tele.r * (TW / 2), m.tele.r * (TH / 2), 'rgba(255,60,50,0.28)', '#ff5a4a');
    ellipse(ctx, X, Y, m.tele.r * (TW / 2) * prog, m.tele.r * (TH / 2) * prog, 'rgba(255,90,70,0.35)', null);
  }
  for (const fx of f.fx) {
    const [X, Y] = W(fx.x, fx.y);
    const p = fx.t / fx.dur;
    if (fx.kind === 'trap') ellipse(ctx, X, Y, 8, 4, 'rgba(160,120,60,.6)', '#c9a24a');
    if (fx.kind === 'ring') ellipse(ctx, X, Y, (fx.r ?? 1) * (TW / 2) * p, (fx.r ?? 1) * (TH / 2) * p, null, p < 0.5 ? '#ffffff' : '#ffd36b');
    if (fx.kind === 'heal') ellipse(ctx, X, Y, (fx.r ?? 1) * (TW / 2) * Math.min(1, p * 2), (fx.r ?? 1) * (TH / 2) * Math.min(1, p * 2), 'rgba(120,255,140,.18)', '#8fe08f');
    if (fx.kind === 'boom') ellipse(ctx, X, Y, (fx.r ?? 1) * (TW / 2) * (0.4 + p * 0.6), (fx.r ?? 1) * (TH / 2) * (0.4 + p * 0.6), `rgba(255,160,60,${0.5 * (1 - p)})`, p < 0.6 ? '#ffd36b' : '#ff8a3a');
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
          ctx.fillStyle = '#8a8f9a';
          ctx.fillRect(X - 6, Y - 6, 12, 7);
          ctx.fillStyle = '#b8bec8';
          ctx.fillRect(X - 5, Y - 7, 7, 3);
          ctx.fillStyle = '#5a5e6a';
          ctx.fillRect(X - 6, Y, 12, 1);
        } else {
          const im = IMG[pr.kind];
          if (im) ctx.drawImage(im, X - Math.round(im.width / 2), Y - im.height + 4);
        }
      },
    });
  }
  // 필드 가장자리 숲 (뒤쪽)
  for (let i = -1; i <= N; i += 2) {
    for (const [px, py] of [[i, -1.2], [-1.2, i]] as [number, number][])
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
    if (fx.kind === 'slash') slash(ctx, X, Y - 12, fx.ax ?? 1, fx.ay ?? 0, Math.min(2, Math.floor(p * 3)), !!fx.big);
    if (fx.kind === 'puff') puff(ctx, X, Y - 8, p, !!fx.big);
  }
  for (const pj of f.proj) {
    const [X, Y] = W(pj.x, pj.y);
    const [TX, TY] = W(pj.x - pj.vx * 0.05, pj.y - pj.vy * 0.05);
    const col = pj.kind === 'fire' ? '#ff8a3a' : pj.kind === 'bolt' ? '#9ad0ff' : pj.kind === 'dagger' ? '#c8ff8a' : '#efe2c6';
    line(ctx, TX, TY - 12, X, Y - 12, pj.kind === 'fire' ? '#ffd36b' : 'rgba(255,255,255,.5)');
    ctx.fillStyle = col;
    ctx.fillRect(X - (pj.kind === 'fire' ? 2 : 1), Y - 13, pj.kind === 'fire' ? 4 : 2, pj.kind === 'fire' ? 4 : 2);
  }

  // 피해 숫자: 위로 튀어 오르며 0.6초 (치명타는 노랗게 크게)
  for (const n of f.nums) {
    const [X, Y] = W(n.x, n.y);
    const p = n.t / 0.6;
    const rise = Math.round(14 * (1 - Math.pow(1 - Math.min(1, p * 1.6), 2)));
    digits(ctx, n.text, X + n.dx, Y - 36 - rise, n.heal ? '#8fe08f' : n.crit ? '#ffd33a' : '#ffffff', n.crit ? 2 : 1);
  }
}

function drawAlly(ctx: CanvasRenderingContext2D, f: Field, u: Unit, W: (x: number, y: number) => [number, number]) {
  const cb = u.frames!.cb();
  const [X, Y] = W(u.x, u.y);
  // 발밑 그림자: 2톤 도트 타원 (알파 0/255)
  dotShadow(ctx, X, Y, 7, 3);
  if (u === f.me) ellipse(ctx, X, Y, 9, 4, null, '#ffd36b');
  const up = u.ax + u.ay < -0.2;
  // 리마스터 프레임: 대기 3 · 걷기 6 · 공격 4(휘두르는 시간에 맞춰) · 구르기 4 · 시전 3 · 피격 · 쓰러짐 3
  let img: HTMLCanvasElement;
  if (u.dead) img = cb.die[Math.min(2, Math.floor(u.deadT * 5))];
  else if ((u.dodge ?? 0) > 0) img = cb.roll[Math.min(3, Math.floor((1 - (u.dodge ?? 0) / C.dodge.dur) * 4))];
  else if ((u.hurtT ?? 0) > 0) img = cb.hurt[0];
  else if ((u.castAnim ?? 0) > 0) img = cb.cast[Math.min(2, Math.floor((1 - (u.castAnim ?? 0) / 0.3) * 3))];
  else if ((u.swing ?? 0) > 0) img = cb.atk[Math.min(3, Math.floor((1 - (u.swing ?? 0) / C.combo.swing) * 4))];
  else if (u.moving) img = (up ? cb.walkB : cb.walk)[Math.floor(u.t * 12) % 6];
  else img = (up ? cb.idleB : cb.idle)[Math.floor(u.t * 3) % 3];
  const left = screenDx(u.ax, u.ay) < 0;
  if (left) img = flipOf(img);
  const y0 = Y - img.height + 2;
  ctx.globalAlpha = u.dead ? 0.6 : (u.inv ?? 0) > 0 && Math.floor(u.t * 30) % 2 ? 0.55 : 1;
  ctx.drawImage(u.flash > 0 ? whiteOf(img) : img, X - Math.round(img.width / 2), y0);
  ctx.globalAlpha = 1;
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
  dotShadow(ctx, X, Y, m.mon === 'slime' ? 8 : 7, 3);
  if (!sh) return;
  let anim = 'idle';
  let t = m.t;
  if (m.dead) {
    anim = 'die';
    t = m.deadT;
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
  ctx.globalAlpha = m.dead ? Math.max(0, 1 - m.deadT * 1.8) : 1;
  ctx.drawImage(img, X - px, Y - ay);
  ctx.globalAlpha = 1;
  if (!m.dead && m.hp < m.max) bar(ctx, X, Y - ay - 3, m.hp / m.max, '#ff6a5a');
  if (m.stun > 0) {
    ctx.fillStyle = '#ffd36b';
    const k = Math.floor(m.t * 8) % 3;
    ctx.fillRect(X - 4 + k * 3, Y - ay - 6, 1, 1);
  }
}

/** 2톤 도트 그림자: 가운데는 촘촘한 바둑 점, 가장자리는 성긴 점 (반투명 없이) */
export function dotShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    for (let x = -w; x <= w; x++) {
      const core = (x * x) / (rx * rx * 0.45) + (y * y) / (ry * ry * 0.45) <= 1;
      const on = core ? (x + y) % 2 === 0 : (x + y) % 2 === 0 && (y % 2 === 0 || Math.abs(x) % 4 === 0);
      if (!on) continue;
      ctx.fillStyle = core ? '#1c1424' : '#2a2230';
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
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
