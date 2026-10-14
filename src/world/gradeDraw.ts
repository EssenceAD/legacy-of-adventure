// 마을 등급 장식·NPC·불빛 그리기 (render.ts가 깊이 순서에 끼워 부른다)
// 장식 그림: assets/props/*.png (쿼터뷰, 건물과 같은 픽셀 밀도) — 발자국 가운데 아래에 맞춘다
import { PROP_IMG, tinted } from '../engine/assets';
import { sx, sy, TH, view } from '../engine/iso';
import { P } from '../engine/pixel';
import { framesFor, type CharFrames } from '../engine/sprites';
import type { ClassDef } from '../data/classes';
import { glow, NL } from './daynight';
import { puff } from './fx';
import { anim, animF, gradeFolk, gradeNow, gradeProps, type Prop } from './grade';
import { S } from './state';

/** 등급 연출 중이면: 덮어쓰기 선(화면 y) 위쪽은 새 등급, 아래쪽은 옛 등급 */
export function propsNow(): Prop[] {
  if (!anim.on) return gradeProps(gradeNow());
  const cut = animF() * view.LH;
  const sy0 = (p: Prop) => view.OY + sy(p.x + p.fw / 2, p.y + p.fh / 2);
  return [...gradeProps(anim.from).filter((p) => sy0(p) >= cut), ...gradeProps(anim.to).filter((p) => sy0(p) < cut)];
}
export function folkNow() {
  if (!anim.on) return gradeFolk(gradeNow());
  return gradeFolk(animF() >= 1 ? anim.to : anim.from);
}

/** 장식 하나 */
export function drawProp(ctx: CanvasRenderingContext2D, pr: Prop) {
  const cx = view.OX + sx(pr.x + pr.fw / 2, pr.y + pr.fh / 2);
  const cy = view.OY + sy(pr.x + pr.fw / 2, pr.y + pr.fh / 2) + (TH * Math.max(pr.fw, pr.fh)) / 2;
  if (pr.k === 'sign') return drawSign(ctx, Math.round(cx), Math.round(cy));
  const im0 = PROP_IMG[pr.k];
  if (!im0) return;
  const im = tinted(im0, NL);
  ctx.drawImage(im, Math.round(cx - im.width / 2), Math.round(cy - im.height + 2));
  // 분수: 물줄기는 코드 입자로
  if (pr.k === 'fountain' && Math.random() < 0.5) puff(cx - view.OX + (Math.random() - 0.5) * 6, cy - view.OY - im.height + 14, '#bfe4ff', (Math.random() - 0.5) * 16, -20 - Math.random() * 10, 0.7, 1);
}

/** 마을 입구 표지판 (코드 도트) */
function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const p = P(ctx);
  p.rect(x - 1, y - 16, 2, 16, '#6b4128');
  p.rect(x - 9, y - 22, 18, 9, '#7a4a2a');
  p.rect(x - 8, y - 21, 16, 7, '#a06a3c');
  p.rect(x - 6, y - 19, 12, 1, '#efe2c6');
  p.rect(x - 6, y - 17, 9, 1, '#efe2c6');
}

// ── 등급 NPC (코드 도트) ──
const FOLK_LOOK: Record<'merchant' | 'guard' | 'bard', ClassDef> = {
  merchant: { name: '상인', face: { eyes: 'happy', mouth: 'grin', stache: undefined } as ClassDef['face'], hair: '#6a4028', style: 'short', cloth: '#c98a3a', arm: '#efe0bf', pants: '#5a3a2a', boots: '#4a2f20', accent: '#ffd36b', weapon: null, apron: '#efe6cf', bandana: '#b8402a' },
  guard: { name: '경비병', face: { eyes: 'dot', brow: 'angry', mouth: 'flat' }, hair: '#3a2a24', style: 'short', cloth: '#3f6fd1', arm: '#b9c3d6', pants: '#8e98ad', boots: '#4a3020', accent: '#e8b94a', weapon: 'sword', shield: true, helm: '#a7afbf' },
  bard: { name: '음유시인', face: { eyes: 'sparkle', mouth: 'tiny', blush: true }, hair: '#e8a0c8', style: 'long', cloth: '#5a8a4a', arm: '#5a8a4a', pants: '#3a5a3a', boots: '#5b3a26', accent: '#ffd36b', weapon: 'book', hat: 'wizard', hatc: '#4a7a3a' },
};
const FOLK_FRAMES: Partial<Record<string, CharFrames>> = {};
export function drawFolk(ctx: CanvasRenderingContext2D, f: { who: 'merchant' | 'guard' | 'bard'; x: number; y: number }) {
  const fr = (FOLK_FRAMES[f.who] ||= framesFor('folk-' + f.who, FOLK_LOOK[f.who]));
  const img = tinted(fr.idle[Math.floor(S.T * 1.6 + f.x) % 2], NL);
  const X = Math.round(view.OX + sx(f.x, f.y));
  const Y = Math.round(view.OY + sy(f.x, f.y) + TH / 2);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#1c1018';
  ctx.fillRect(X - 5, Y - 1, 10, 2);
  ctx.globalAlpha = 1;
  if (f.who === 'guard') ctx.drawImage(img, X - 12, Y - 32);
  else {
    ctx.save();
    ctx.translate(X + 12, Y - 32);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  // 음유시인: 음표가 가끔
  if (f.who === 'bard' && Math.random() < 0.02) puff(X - view.OX + 6, Y - 30 - view.OY, '#ffd36b', 6, -12, 1, 2);
}

/**
 * 밤: 가로등 하나의 불빛 (더하기) — v0.25.23: 맨 위 한 번이 아니라 가로등을 그린 직후에 (앞 건물·나무가 나중에 그려지며 가린다 ·
 *  예전엔 건물 뒤 가로등 빛이 지붕 위로 비쳤다)
 */
export function drawPropLight(ctx: CanvasRenderingContext2D, pr: Prop, nt: number) {
  if (nt <= 0.01 || pr.k !== 'lamppost') return;
  const X = view.OX + sx(pr.x + 0.5, pr.y + 0.5);
  const Y = view.OY + sy(pr.x + 0.5, pr.y + 0.5) + TH / 2 - 58;
  glow(ctx, X, Y, 26, nt * 0.55);
}

/** 밤: 도시는 축제 등불 줄 (더하기로, 맨 위에서 — 가로등 하나하나의 빛은 drawPropLight) */
export function drawGradeLights(ctx: CanvasRenderingContext2D, nt: number) {
  if (nt <= 0.01) return;
  const props = propsNow();
  if ((anim.on ? anim.to : gradeNow()) >= 4) {
    // 축제 등불: 정문에서 양쪽 가로등까지 늘어진 색등
    const gate = props.find((p) => p.k === 'gate');
    const lamps = props.filter((p) => p.k === 'lamppost');
    if (!gate) return;
    const gx = view.OX + sx(gate.x + 0.5, gate.y + 0.5);
    const gy = view.OY + sy(gate.x + 0.5, gate.y + 0.5) - 70;
    const cols = ['#ff7a7a', '#ffd36b', '#8fe08f', '#7ac0ff'];
    for (const l of lamps) {
      const lx = view.OX + sx(l.x + 0.5, l.y + 0.5);
      const ly = view.OY + sy(l.x + 0.5, l.y + 0.5) - 52;
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        const x = gx + (lx - gx) * t;
        const y = gy + (ly - gy) * t + Math.sin(t * Math.PI) * 6;
        glow(ctx, x, y, 5, nt * (0.6 + Math.sin(S.T * 4 + i) * 0.2));
        ctx.fillStyle = cols[i % 4];
        ctx.globalAlpha = nt;
        ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        ctx.globalAlpha = 1;
      }
    }
  }
}
