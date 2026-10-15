// 밤 창문·대장간 불빛 마스크(public/assets/sprites/windows.json)를 「실제 창 · 화덕 입구」 안에서만 다시 만든다.
//  이전 마스크는 사각형 상자(tools/winbox.py) 안의 주황 픽셀을 다 집어서 창틀·들보·벽·간판·바닥까지 밝혔다
//  (대장간: 입구 위 기울어진 들보까지 상자 윗변 y=48 에서 곧게 잘린 판자처럼 빛났다).
//  입구 모양 = scripts/light-openings.json (그림 왼쪽 위 기준 픽셀 · 사각형 [x0,y0,x1,y1] 끝 포함 · {poly:[[x,y]..]} 는 픽셀 중심이 안에 있으면)
//  마스크 = 입구 안 · 불투명 · (픽셀 단위 지붕 다각형 밖) · 따뜻하고 밝은 픽셀 (LIT 규칙) — 창틀(어두운 갈색)·벽(크림, 채도 낮음)은 빠진다.
// 실행: node scripts/fix-light-masks.mjs            → windows.json 덮어쓰기 + 전/후 픽셀 수 표
//       node scripts/fix-light-masks.mjs --check    → 쓰지 않고 지금 windows.json 이 만든 결과와 같은지만 (다르면 exit 1)
//       node scripts/fix-light-masks.mjs --sheet DIR [--before windows.before.json] → 전/후 마스크 겹침 모음 그림 DIR/masks_contact.png
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const SP = 'public/assets/sprites/';
const OPEN = 'scripts/light-openings.json';
const args = process.argv.slice(2);
const arg = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);

export const hsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn + 1e-6;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, (mx - mn) / Math.max(mx, 1e-6), mx];
};
/** 불빛 픽셀: 따뜻한 색 · 채도 0.30↑ · 밝기 0.68↑ */
export const LIT = (h, s, v) => h > 12 && h < 58 && s > 0.3 && v > 0.68;
const inPoly = (poly, x, y) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
export const inShape = (s, x, y) => (s.poly ? inPoly(s.poly, x + 0.5, y + 0.5) : x >= s[0] && x <= s[2] && y >= s[1] && y <= s[3]);

const openings = JSON.parse(fs.readFileSync(OPEN, 'utf8'));
const cur = JSON.parse(fs.readFileSync(SP + 'windows.json', 'utf8'));
const before = arg('--before') ? JSON.parse(fs.readFileSync(arg('--before'), 'utf8')) : cur;
const read = (k) => PNG.sync.read(fs.readFileSync(SP + k + '.png'));
const roofs = JSON.parse(fs.readFileSync(SP + 'roofs.json', 'utf8'));
/** 지붕 다각형이 픽셀 단위(줄마다 작은 사각형 · tools/newmasks.mjs)인 그림은 지붕 위 픽셀도 뺀다 (옛 그림의 큰 다각형은 탑·지붕창까지 덮어 쓰지 않는다) */
export const exactRoof = (k) => (roofs[k]?.length ?? 0) > 10;
const onRoof = (k, x, y) => exactRoof(k) && roofs[k].some((p) => inPoly(p, x + 0.5, y + 0.5));

const next = { ...cur };
const rows = [];
for (const [k, shapes] of Object.entries(openings)) {
  const p = read(k);
  const { width: W, height: H, data: D } = p;
  const pts = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!shapes.some((s) => inShape(s, x, y))) continue;
      const j = (y * W + x) * 4;
      if (D[j + 3] < 128 || onRoof(k, x, y)) continue;
      if (LIT(...hsv(D[j], D[j + 1], D[j + 2]))) pts.push([y, x]);
    }
  next[k] = pts;
  const old = before[k] ?? [];
  const bleed = old.filter(([y, x]) => !shapes.some((s) => inShape(s, x, y))).length;
  rows.push({ k, before: old.length, bleed, after: pts.length, openings: shapes.length });
}

console.log('sprite    before  outside-opening  after  openings');
for (const r of rows) console.log(r.k.padEnd(9), String(r.before).padStart(6), String(r.bleed).padStart(16), String(r.after).padStart(6), String(r.openings).padStart(9));

const json = JSON.stringify(next);
if (args.includes('--check')) {
  const same = json === JSON.stringify(cur);
  console.log(same ? 'windows.json OK' : 'windows.json differs from light-openings.json — run node scripts/fix-light-masks.mjs');
  process.exit(same ? 0 : 1);
} else if (!arg('--sheet')) {
  fs.writeFileSync(SP + 'windows.json', json);
  console.log('wrote', SP + 'windows.json');
}

// 전/후 모음 그림: 줄마다 [낮 그림 | 전 마스크(자홍) | 후 마스크(자홍) + 입구 테두리(노랑)]
if (arg('--sheet')) {
  const S = 3, GAP = 6;
  const tiles = Object.keys(openings).map((k) => {
    const p = read(k);
    const { width: W, height: H, data: D } = p;
    const o = new PNG({ width: (W * 3 + GAP * 2) * S, height: H * S });
    const sets = [new Set((before[k] ?? []).map(([y, x]) => y * W + x)), new Set(next[k].map(([y, x]) => y * W + x))];
    const shapes = openings[k];
    const edge = (x, y) => shapes.some((s) => inShape(s, x, y)) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !shapes.some((s) => inShape(s, x + dx, y + dy)));
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 4, a = D[j + 3] / 255;
        const base = [0, 1, 2].map((c) => D[j + c] * a + 26 * (1 - a));
        const cols = [base, sets[0].has(y * W + x) ? [255, 0, 255] : base.map((v) => v * 0.45), sets[1].has(y * W + x) ? [255, 0, 255] : edge(x, y) ? [255, 230, 0] : base.map((v) => v * 0.45)];
        cols.forEach((c, t) => {
          for (let dy = 0; dy < S; dy++)
            for (let dx = 0; dx < S; dx++) {
              const q = ((y * S + dy) * o.width + (t * (W + GAP) + x) * S + dx) * 4;
              o.data[q] = c[0]; o.data[q + 1] = c[1]; o.data[q + 2] = c[2]; o.data[q + 3] = 255;
            }
        });
      }
    return o;
  });
  const W = Math.max(...tiles.map((t) => t.width)), H = tiles.reduce((s, t) => s + t.height + GAP * S, 0);
  const out = new PNG({ width: W, height: H });
  out.data.fill(16);
  let y0 = 0;
  for (const t of tiles) {
    for (let y = 0; y < t.height; y++) t.data.copy(out.data, ((y0 + y) * W) * 4, y * t.width * 4, (y + 1) * t.width * 4);
    y0 += t.height + GAP * S;
  }
  const dir = arg('--sheet');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'masks_contact.png'), PNG.sync.write(out));
  console.log('wrote', path.join(dir, 'masks_contact.png'));
}
