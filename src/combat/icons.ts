// 직업별 스킬 아이콘 (핫픽스 7): UI 키트 미니멀 글리프 — 24×24, 직업 색 한 가지 + 밝은 점 + 어두운 1px 테두리 (금테 없음)
import type { Job } from './field';

export const JOB_COLOR: Record<Job, string> = {
  knight: '#7ab4ff',
  warrior: '#ff9a5a',
  rogue: '#8fe08f',
  mage: '#c99aff',
  priest: '#ffe08a',
  hunter: '#d8c070',
};

type Px = (x: number, y: number, hi?: boolean) => void;
const GLYPH: Record<string, (p: Px) => void> = {
  // 기사: 방패 강타 (방패 + 앞으로) · 도발 함성 (입 + 소리 물결)
  knight0: (p) => {
    for (let y = 5; y <= 18; y++) {
      const w = y < 14 ? 5 : Math.max(0, 5 - (y - 13));
      for (let x = 9 - w; x <= 9 + w; x++) p(x, y, x === 9 || y === 9);
    }
    for (let i = 0; i < 4; i++) {
      p(17 + i, 11, true);
      p(19, 9 + i);
    }
    p(20, 10);
    p(20, 12);
  },
  knight1: (p) => {
    for (let y = 8; y <= 15; y++) for (let x = 4; x <= 8; x++) p(x, y, y < 10);
    for (const r of [4, 7, 10]) for (let a = -0.8; a <= 0.8; a += 0.12) p(Math.round(8 + Math.cos(a) * r + 2), Math.round(12 + Math.sin(a) * r), r === 4);
  },
  // 전사: 회전 베기 (둥근 화살표) · 도약 내려찍기 (아래 화살표 + 땅)
  warrior0: (p) => {
    for (let a = 0.6; a < Math.PI * 2 - 0.2; a += 0.08) p(Math.round(12 + Math.cos(a) * 7), Math.round(12 + Math.sin(a) * 7), a < 2);
    for (let i = 0; i < 4; i++) {
      p(17 + i - 1, 6 + i);
      p(17 - i, 6 + i);
    }
  },
  warrior1: (p) => {
    for (let y = 3; y <= 14; y++) p(12, y, y < 6), p(11, y);
    for (let i = 0; i < 5; i++) p(12 - i, 14 - i), p(12 + i, 14 - i);
    for (let x = 4; x <= 20; x++) p(x, 19, x % 3 === 0);
    p(6, 17), p(18, 17), p(8, 16), p(16, 16);
  },
  // 도적: 그림자 찌르기 (단검 + 그림자) · 독 단검 (부채꼴 3개 + 방울)
  rogue0: (p) => {
    for (let i = 0; i < 11; i++) p(6 + i, 17 - i, true), p(7 + i, 17 - i);
    p(5, 18), p(4, 19), p(6, 19), p(4, 17);
    for (let i = 0; i < 5; i++) p(3 + i * 2, 8, false);
  },
  rogue1: (p) => {
    for (const dx of [-5, 0, 5]) for (let i = 0; i < 8; i++) p(12 + dx + Math.round((dx / 5) * i * 0.6), 13 - i, i > 5);
    for (let y = 16; y <= 19; y++) for (let x = 11; x <= 13; x++) p(x, y, y === 16);
    p(12, 15);
  },
  // 마법사: 화염구 · 점멸 (점선 화살 + 반짝)
  mage0: (p) => {
    for (let y = 7; y <= 19; y++)
      for (let x = 5; x <= 19; x++) {
        const d = Math.hypot(x - 12, y - 14);
        if (d < 5.5 || (y < 13 && Math.abs(x - 12) < (13 - y) * 0.6 + 1 && y > 3)) p(x, y, d < 2.6);
      }
  },
  mage1: (p) => {
    for (let x = 3; x <= 15; x += 3) p(x, 12), p(x + 1, 12);
    for (let i = 0; i < 4; i++) p(17 - i, 9 + i), p(17 - i, 15 - i);
    for (const [x, y] of [[19, 6], [19, 18], [21, 12]]) p(x, y, true), p(x - 1, y), p(x + 1, y), p(x, y - 1), p(x, y + 1);
  },
  // 사제: 치유의 빛 (십자 + 빛) · 신성 일격 (해)
  priest0: (p) => {
    for (let i = -6; i <= 6; i++) for (const k of [-1, 0, 1]) p(12 + i, 12 + k, Math.abs(i) < 2), p(12 + k, 12 + i, Math.abs(i) < 2);
    for (const [x, y] of [[4, 4], [20, 4], [4, 20], [20, 20]]) p(x, y, true);
  },
  priest1: (p) => {
    for (let y = 8; y <= 16; y++) for (let x = 8; x <= 16; x++) if (Math.hypot(x - 12, y - 12) < 4.5) p(x, y, Math.hypot(x - 11, y - 11) < 2);
    for (let a = 0; a < 8; a++) {
      const c = Math.cos((a * Math.PI) / 4);
      const s = Math.sin((a * Math.PI) / 4);
      for (let r = 6; r <= 9; r++) p(Math.round(12 + c * r), Math.round(12 + s * r));
    }
  },
  // 사냥꾼: 연속 사격 (화살 셋) · 덫 (이빨 덫)
  hunter0: (p) => {
    for (const dy of [-5, 0, 5]) {
      for (let x = 4; x <= 18; x++) p(x, 12 + dy, x > 15);
      p(17, 11 + dy), p(17, 13 + dy), p(5, 11 + dy), p(5, 13 + dy);
    }
  },
  hunter1: (p) => {
    for (let x = 4; x <= 20; x++) p(x, 16, false), p(x, 17);
    for (let i = 0; i < 5; i++) for (let k = 0; k < 3; k++) p(5 + i * 3 + 1, 15 - k, k === 2), p(5 + i * 3 + 1, 18 + k);
    p(12, 8), p(12, 9), p(11, 10), p(13, 10);
  },
  // 필살기: 네 갈래 빛
  ult: (p) => {
    for (let i = -9; i <= 9; i++) {
      const w = Math.max(0, 2 - Math.floor(Math.abs(i) / 4));
      for (let k = -w; k <= w; k++) p(12 + i, 12 + k, Math.abs(i) < 3), p(12 + k, 12 + i, Math.abs(i) < 3);
    }
    for (const [x, y] of [[7, 7], [17, 7], [7, 17], [17, 17]]) p(x, y, true);
  },
};

const cache: Record<string, string> = {};
/** 아이콘 data URL (직업 색 · 밝은 점 · 어두운 테두리) */
export function skillIcon(job: Job, which: 0 | 1 | 'ult'): string {
  const key = `${job}${which}`;
  if (cache[key]) return cache[key];
  const S = 24;
  const g: (0 | 1 | 2)[][] = Array.from({ length: S }, () => Array(S).fill(0));
  const p: Px = (x, y, hi) => {
    if (x >= 0 && y >= 0 && x < S && y < S) g[y][x] = hi ? 2 : Math.max(g[y][x], 1) as 1 | 2;
  };
  (GLYPH[which === 'ult' ? 'ult' : `${job}${which}`] ?? GLYPH.ult)(p);
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const x = c.getContext('2d')!;
  const col = JOB_COLOR[job];
  for (let yy = 0; yy < S; yy++)
    for (let xx = 0; xx < S; xx++) {
      if (g[yy][xx]) {
        x.fillStyle = g[yy][xx] === 2 ? '#ffffff' : col;
        x.fillRect(xx, yy, 1, 1);
      } else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[yy + dy]?.[xx + dx])) {
        x.fillStyle = '#140c18';
        x.fillRect(xx, yy, 1, 1);
      }
    }
  return (cache[key] = c.toDataURL());
}
