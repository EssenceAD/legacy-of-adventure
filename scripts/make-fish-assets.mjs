// GROWTH §4: 물고기 아이콘(asset_raw/fish → public/assets/fish) · 박제 장식 그림(public/assets/sprites/fish_<id>.png + meta.json)
//  실행: node scripts/make-fish-assets.mjs   (asset_raw는 로컬 전용 — 결과물만 커밋)
import fs from 'node:fs';
import { PNG } from 'pngjs';

const SRC = 'asset_raw/fish';
const OUT = 'public/assets/fish';
const SPR = 'public/assets/sprites';
const TROPHY = ['firefly', 'kingkoi', 'lanternfish', 'starwhale'];
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith('.png'))) fs.copyFileSync(`${SRC}/${f}`, `${OUT}/${f}`);

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const meta = JSON.parse(fs.readFileSync(`${SPR}/meta.json`, 'utf8'));
for (const id of TROPHY) {
  const fish = PNG.sync.read(fs.readFileSync(`${SRC}/${id}.png`));
  const W = 40;
  const ph = Math.max(18, fish.height + 6);
  const post = 8;
  const H = ph + post + 10;
  const img = new PNG({ width: W, height: H });
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    img.data[i] = c[0];
    img.data[i + 1] = c[1];
    img.data[i + 2] = c[2];
    img.data[i + 3] = c[3];
  };
  // 받침돌 (등각 마름모)
  const cx = W / 2 - 0.5;
  const by = H - 6;
  for (let y = by - 6; y <= by + 5; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.abs(x - cx) / 13 + Math.abs(y - by) / 5.5;
      if (d <= 1) set(x, y, d > 0.82 ? hex('#5a4e44') : y < by ? hex('#a89884') : hex('#8a7a6a'));
    }
  // 기둥
  for (let y = ph - 1; y < by; y++) for (let x = 18; x <= 21; x++) set(x, y, x === 18 ? hex('#4a2e18') : x === 21 ? hex('#5a3a20') : hex('#7a5030'));
  // 판 (나무 · 테두리 · 놋쇠 테)
  for (let y = 0; y < ph; y++)
    for (let x = 1; x < W - 1; x++) {
      const edge = y === 0 || y === ph - 1 || x === 1 || x === W - 2;
      const rim = y === 1 || y === ph - 2 || x === 2 || x === W - 3;
      set(x, y, edge ? hex('#3e2410') : rim ? hex('#d8b25a') : (x + y) % 7 === 0 ? hex('#7e5230') : hex('#8a5a34'));
    }
  // 물고기
  const ox = Math.floor((W - fish.width) / 2);
  const oy = Math.floor((ph - fish.height) / 2);
  for (let y = 0; y < fish.height; y++)
    for (let x = 0; x < fish.width; x++) {
      const i = (y * fish.width + x) * 4;
      if (fish.data[i + 3] > 40) set(ox + x, oy + y, [fish.data[i], fish.data[i + 1], fish.data[i + 2], 255]);
    }
  fs.writeFileSync(`${SPR}/fish_${id}.png`, PNG.sync.write(img));
  meta[`fish_${id}`] = { w: W, h: H, fw: 1, fh: 1 };
}
fs.writeFileSync(`${SPR}/meta.json`, JSON.stringify(meta));
console.log('ok', fs.readdirSync(OUT).length, 'icons ·', TROPHY.length, 'trophies');
