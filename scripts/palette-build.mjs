// VISUAL §1: 마스터 팔레트 56색 — 건물·장식·몬스터 그림 전체 색을 모아 Lab k-means → 손질(초록 채도 −15% · 가장 어두운 색 = 남보라 #2b2440)
//  결과: public/assets/palette.png (1줄 56칸) · src/data/palette.ts (실행 때 쓰는 값) · reports/visual/palette.png (크게 본 견본)
//  실행: node scripts/palette-build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const K = 56;
const DIRS = ['public/assets/sprites', 'public/assets/props', 'public/assets/monsters'];
const SKIP = /^(raid_bg|boss_|campfire)/;
// sRGB ↔ Lab (D65)
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
function lab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const finv = (t) => (t > 6 / 29 ? t ** 3 : (108 / 841) * (t - 4 / 29));
const gam = (c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
function rgb([L, a, b]) {
  const fy = (L + 16) / 116;
  const x = 0.95047 * finv(fy + a / 500), y = finv(fy), z = 1.08883 * finv(fy - b / 200);
  return [gam(3.2406 * x - 1.5372 * y - 0.4986 * z), gam(-0.9689 * x + 1.8758 * y + 0.0415 * z), gam(0.0557 * x - 0.204 * y + 1.057 * z)];
}
// 색 모으기 (같은 색은 개수로 · 검은 외곽선 근처는 빼고 — 남보라로 따로 넣는다)
const count = new Map();
let files = 0;
for (const d of DIRS)
  for (const fn of fs.readdirSync(d).filter((x) => x.endsWith('.png') && !SKIP.test(x))) {
    const png = PNG.sync.read(fs.readFileSync(path.join(d, fn)));
    files++;
    const px = png.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
const cols = [...count].map(([k, n]) => ({ c: [k >> 16, (k >> 8) & 255, k & 255], n })).map((o) => ({ ...o, l: lab(...o.c) }));
// 가중 k-means++ (결정적: 시드 고정)
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
const C = [cols.reduce((a, b) => (b.n > a.n ? b : a)).l.slice()];
const best = cols.map((o) => d2(o.l, C[0]));
while (C.length < K - 1) {
  let tot = 0;
  for (let i = 0; i < cols.length; i++) tot += best[i] * Math.sqrt(cols[i].n);
  let t = rnd() * tot, pick = 0;
  for (let i = 0; i < cols.length; i++) if ((t -= best[i] * Math.sqrt(cols[i].n)) <= 0) { pick = i; break; }
  C.push(cols[pick].l.slice());
  for (let i = 0; i < cols.length; i++) best[i] = Math.min(best[i], d2(cols[i].l, C[C.length - 1]));
}
for (let it = 0; it < 30; it++) {
  const s = C.map(() => [0, 0, 0, 0]);
  for (const o of cols) {
    let bi = 0, bd = Infinity;
    for (let j = 0; j < C.length; j++) { const d = d2(o.l, C[j]); if (d < bd) (bd = d), (bi = j); }
    const w = o.n;
    s[bi][0] += o.l[0] * w; s[bi][1] += o.l[1] * w; s[bi][2] += o.l[2] * w; s[bi][3] += w;
  }
  for (let j = 0; j < C.length; j++) if (s[j][3]) C[j] = [s[j][0] / s[j][3], s[j][1] / s[j][3], s[j][2] / s[j][3]];
}
// 손질: 초록(색상각 90~170°) 채도 −15% · 가장 어두운 색 자리에 남보라
let pal = C.map((l) => {
  const h = ((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360;
  return h > 90 && h < 170 ? [l[0], l[1] * 0.85, l[2] * 0.85] : l;
});
pal.sort((p, q) => p[0] - q[0]);
pal[0] = lab(0x2b, 0x24, 0x40);
pal.push(lab(0x1c, 0x10, 0x18)); // 사람·몬스터 검은 외곽선은 그대로 (56번째)
// 정렬: 밝기 묶음(4단) 안에서 색상각 — 견본 보기 좋게
const hue = (l) => ((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360;
const outline = pal.pop();
pal.sort((p, q) => Math.floor(p[0] / 25) - Math.floor(q[0] / 25) || hue(p) - hue(q));
pal.push(outline);
const hex = pal.map((l) => '#' + rgb(l).map((v) => v.toString(16).padStart(2, '0')).join(''));
// 저장
const strip = new PNG({ width: K, height: 1 });
hex.forEach((h, i) => { const [r, g, b] = [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16)); strip.data.set([r, g, b, 255], i * 4); });
fs.writeFileSync('public/assets/palette.png', PNG.sync.write(strip));
fs.writeFileSync('src/data/palette.ts', `// VISUAL §1: 마스터 팔레트 (scripts/palette-build.mjs가 만든다 — 손으로 고치지 말 것)\n//  0 = 가장 어두운 색(남보라 외곽선) · 마지막 = 사람·몬스터 검은 외곽선(28,16,24)\nexport const MASTER_PALETTE: readonly string[] = ${JSON.stringify(hex)};\n`);
const S = 32, cols8 = 14, rows = Math.ceil(K / cols8);
const big = new PNG({ width: cols8 * S, height: rows * S });
hex.forEach((h, i) => {
  const [r, g, b] = [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16));
  const X = (i % cols8) * S, Y = Math.floor(i / cols8) * S;
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) big.data.set([r, g, b, 255], ((Y + y) * big.width + X + x) * 4);
});
fs.mkdirSync('reports/visual', { recursive: true });
fs.writeFileSync('reports/visual/palette.png', PNG.sync.write(big));
console.log(`그림 ${files}장 · 색 ${count.size}개 → ${K}색`, hex.join(' '));
