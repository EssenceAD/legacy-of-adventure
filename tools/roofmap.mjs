// 지붕 다각형 찍기 도우미: 그림을 2px 단위 글자 지도로 찍는다.
//   R = 지붕 대표 색상에 아주 가까움, r = 비슷함, w = 밝은 벽, # = 아주 어두움, . = 그 밖, (공백) = 투명
//   좌표 눈금은 10px마다.  다각형을 roofs.json에 적은 뒤 --poly 로 겹쳐 확인한다(@ = 다각형 안의 지붕색, x = 다각형 안의 다른 픽셀).
// 실행: node tools/roofmap.mjs inn [--poly]
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const key = process.argv[2];
const showPoly = process.argv.includes('--poly');

function readPng(file) {
  const b = readFileSync(file);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  const idat = [];
  for (let p = 8; p < b.length; ) {
    const len = b.readUInt32BE(p);
    if (b.toString('ascii', p + 4, p + 8) === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), st = w * 4, out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)];
    for (let x = 0; x < st; x++) {
      const v = raw[y * (st + 1) + 1 + x], a = x >= 4 ? out[y * st + x - 4] : 0, u = y ? out[(y - 1) * st + x] : 0, ul = x >= 4 && y ? out[(y - 1) * st + x - 4] : 0;
      let r = f === 0 ? v : f === 1 ? v + a : f === 2 ? v + u : f === 3 ? v + ((a + u) >> 1) : (() => { const p = a + u - ul, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - ul); return v + (pa <= pb && pa <= pc ? a : pb <= pc ? u : ul); })();
      out[y * st + x] = r & 255;
    }
  }
  return { w, h, px: out };
}
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
}
const inPoly = (x, y, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

const im = readPng(`public/assets/sprites/${key}.png`);
const roofs = JSON.parse(readFileSync('public/assets/sprites/roofs.json', 'utf8'));
const polys = roofs[key] || [];
// 대표 지붕 색상 = 다각형 안(없으면 위쪽 55%)의 채도 높은 픽셀 색상 중앙값 (recolored와 같은 방식)
const hs = [];
for (let y = 0; y < Math.round(im.h * (polys.length ? 1 : 0.55)); y++)
  for (let x = 0; x < im.w; x++) {
    const i = (y * im.w + x) * 4;
    if (!im.px[i + 3]) continue;
    if (polys.length && !polys.some((p) => inPoly(x + 0.5, y + 0.5, p))) continue;
    const [h, s, l] = hsl(im.px[i], im.px[i + 1], im.px[i + 2]);
    if (s > 0.35 && l > 0.2 && l < 0.75) hs.push(h);
  }
hs.sort((a, b) => a - b);
const base = hs[hs.length >> 1] || 0;
const lines = [`${key} ${im.w}x${im.h} 대표 hue ${base.toFixed(0)}`];
let head = '    ';
for (let x = 0; x < im.w; x += 2) head += x % 10 === 0 ? String((x / 10) % 10) : ' ';
lines.push(head);
for (let y = 0; y < im.h; y += 2) {
  let row = String(y).padStart(3) + ' ';
  for (let x = 0; x < im.w; x += 2) {
    const i = (y * im.w + x) * 4;
    if (!im.px[i + 3]) { row += ' '; continue; }
    const [h, s] = hsl(im.px[i], im.px[i + 1], im.px[i + 2]);
    const dh = Math.min(Math.abs(h - base), 360 - Math.abs(h - base));
    const roof = dh < 28 && s > 0.2;
    const inside = polys.some((p) => inPoly(x + 0.5, y + 0.5, p));
    const [, , l] = hsl(im.px[i], im.px[i + 1], im.px[i + 2]);
    const ch = roof && dh < 14 && s > 0.35 ? 'R' : l > 0.68 ? 'w' : l < 0.3 ? '#' : roof ? 'r' : '.';
    row += showPoly ? (inside ? (ch === 'R' || ch === 'r' ? '@' : 'x') : ch) : ch;
  }
  lines.push(row);
}
console.log(lines.join('\n'));
