// 낮밤: 게임 시계(world/clock.ts)를 따라 22:00~06:00이 밤. 1.1초에 걸쳐 부드럽게. 건물별 밤 색조와 창문 불빛.
import { CONFIG } from '../data/config';
import { LIGHTS } from '../engine/assets';
import { P } from '../engine/pixel';
import { jumpTo, onNightFlip, tickClock } from './clock';
import { S } from './state';

const D = CONFIG.dayNight;

/** 밤 단계 0~10 (색조 캐시 단위) */
export let NL = 0;

export function blendNight(dt: number) {
  S.nightT += ((S.night ? 1 : 0) - S.nightT) * Math.min(1, dt * D.blendRate);
  NL = Math.round(S.nightT * D.tintSteps);
}

export const onNightChange = onNightFlip;

/** ☾/☀ 버튼·오프닝: 밤(22:00) 또는 다음 날 아침(06:00)으로 건너뛴다 */
export const setNight = jumpTo;

/** 시계는 마을이 돌아가는 동안 늘 흐른다 (창이 열려 있어도) */
export function tickDayNight(dt: number) {
  if (S.started && !S.visiting) tickClock(dt);
}

/** 건물 하나를 그린 직후: 그 건물의 창문 불빛 (앞 건물이 나중에 그려지며 자연히 가린다) */
export function drawLight(ctx: CanvasRenderingContext2D, sprite: string | null, x: number, y: number) {
  if (!NL || !sprite) return;
  const L = LIGHTS[sprite];
  if (!L) return;
  ctx.globalAlpha = NL / D.tintSteps;
  ctx.drawImage(L, x, y);
  ctx.globalAlpha = 1;
}

/** 모닥불 둥근 빛 (맨 위에 더하기로) */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,190,90,${a})`);
  g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** 밤: 반딧불 / 낮: 구름 그림자 */
export function drawAmbient(ctx: CanvasRenderingContext2D, T: number, LW: number, LH: number) {
  if (S.nightT > 0.01) {
    const p = P(ctx);
    ctx.globalAlpha = Math.min(1, S.nightT * 1.2);
    for (let i = 0; i < 16; i++) {
      const x = ((i * 53 + Math.sin(T * 0.6 + i) * 20 + LW * 4) % LW) | 0;
      const y = ((i * 97 + Math.cos(T * 0.5 + i * 1.3) * 16 + LH * 4) % LH) | 0;
      if (Math.sin(T * 2.5 + i) > 0) p.px(x, y, '#fff38a');
    }
    ctx.globalAlpha = 1;
  }
  if (S.nightT < 0.99) {
    ctx.globalAlpha = 0.08 * (1 - S.nightT);
    ctx.fillStyle = '#1c2a40';
    for (let i = 0; i < 3; i++) {
      const x = ((T * 6 + i * 160) % (LW + 200)) - 100;
      const y = 60 + i * 110;
      ctx.beginPath();
      ctx.ellipse(x, y, 60, 22, 0, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
