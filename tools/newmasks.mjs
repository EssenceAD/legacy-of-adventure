// 땅 개편 새 건물(inn5·inn8·tavern4): 지붕 영역(roofs.json) · 밤 창문 불빛(windows.json)을 색으로 찾아 만든다
//  지붕 = 지붕 대표 색상 근처 · 그림 위쪽 · 가장 큰 덩어리 → 줄마다 [x0,x1] 구간을 작은 사각형 다각형으로
//  창문 = 밝은 주황·노랑 (winbox.py 와 같은 기준) · 지붕 밖
// 실행: node tools/newmasks.mjs   → public/assets/sprites/roofs.json · windows.json 에 키 추가 + asset_raw/work/mask_*.png 확인용
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PNG } = require(process.env.PNGJS ?? 'pngjs');
const SP = 'public/assets/sprites/';
const JOBS = { inn5: { roofHue: [195, 240], s: 0.28, top: 0.72 }, inn8: { roofHue: [195, 240], s: 0.28, top: 0.72 }, tavern4: { roofHue: [-10, 12], s: 0.5, top: 0.5 } };
const hsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn + 1e-6;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return [h, (mx - mn) / Math.max(mx, 1e-6), mx];
};
const roofs = JSON.parse(fs.readFileSync(SP + 'roofs.json', 'utf8'));
const wins = JSON.parse(fs.readFileSync(SP + 'windows.json', 'utf8'));
for (const [k, job] of Object.entries(JOBS)) {
  const png = PNG.sync.read(fs.readFileSync(SP + k + '.png'));
  const { width: W, height: H, data: D } = png;
  const at = (x, y) => (y * W + x) * 4;
  const inHue = (h) => { const [a, b] = job.roofHue; return a < 0 ? h >= 360 + a || h <= b : h >= a && h <= b; };
  // 1) 지붕 후보
  const cand = new Uint8Array(W * H);
  for (let y = 0; y < H * job.top; y++)
    for (let x = 0; x < W; x++) {
      const j = at(x, y);
      if (D[j + 3] < 128) continue;
      const [h, s, v] = hsv(D[j], D[j + 1], D[j + 2]);
      if (inHue(h) && s > job.s && v > 0.12) cand[y * W + x] = 1;
    }
  // 2) 큰 덩어리만 (작은 점·문장 무늬 제외)
  const lab = new Int32Array(W * H).fill(-1);
  const sizes = [];
  for (let i = 0; i < W * H; i++) {
    if (!cand[i] || lab[i] >= 0) continue;
    const id = sizes.length; let n = 0; const st = [i]; lab[i] = id;
    while (st.length) {
      const p = st.pop(); n++;
      const x = p % W, y = (p / W) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx; if (cand[q] && lab[q] < 0) { lab[q] = id; st.push(q); }
      }
    }
    sizes.push(n);
  }
  const big = new Set(sizes.map((n, i) => [n, i]).filter(([n]) => n >= 60).map(([, i]) => i));
  const roof = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (lab[i] >= 0 && big.has(lab[i])) roof[i] = 1;
  // 구멍 메우기(같은 줄에서 지붕 사이 2px 이하 틈)
  for (let y = 0; y < H; y++) for (let x = 1; x < W - 2; x++) if (!roof[y * W + x] && roof[y * W + x - 1] && (roof[y * W + x + 1] || roof[y * W + x + 2])) roof[y * W + x] = 1;
  // 3) 줄마다 구간 → 사각형 다각형
  const polys = [];
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!roof[y * W + x]) { x++; continue; }
      const x0 = x; while (x < W && roof[y * W + x]) x++;
      polys.push([[x0, y], [x, y], [x, y + 1], [x0, y + 1]]);
    }
  }
  roofs[k] = polys;
  // 4) 창문 불빛
  const lit = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const j = at(x, y);
      if (D[j + 3] < 128 || roof[y * W + x]) continue;
      const [h, s, v] = hsv(D[j], D[j + 1], D[j + 2]);
      if (h > 18 && h < 55 && s > 0.58 && v > 0.78) lit.push([y, x]);
    }
  // 창문은 작은 덩어리 — 길쭉하거나 큰 덩어리(밝은 벽·깃발)는 뺀다
  const litSet = new Set(lit.map(([y, x]) => y * W + x));
  const seen = new Set();
  const keepLit = [];
  for (const [y0, x0] of lit) {
    const id0 = y0 * W + x0;
    if (seen.has(id0)) continue;
    const comp = [];
    const st = [id0];
    seen.add(id0);
    while (st.length) {
      const q = st.pop();
      comp.push(q);
      const x = q % W, y = (q / W) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const n = (y + dy) * W + (x + dx);
        if (litSet.has(n) && !seen.has(n)) { seen.add(n); st.push(n); }
      }
    }
    const ys = comp.map((q) => (q / W) | 0);
    const h = Math.max(...ys) - Math.min(...ys) + 1;
    if (h <= 14 && comp.length <= 120) for (const q of comp) keepLit.push([(q / W) | 0, q % W]);
  }
  lit.length = 0;
  lit.push(...keepLit);
  wins[k] = lit;
  // 확인용 그림: 지붕 = 파랑, 불빛 = 노랑, 나머지는 어둡게
  const out = new PNG({ width: W * 2 + 6, height: H });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = at(x, y), o1 = (y * out.width + x) * 4, o2 = (y * out.width + x + W + 6) * 4;
    for (let c = 0; c < 4; c++) out.data[o1 + c] = D[j + c];
    out.data[o2 + 3] = 255;
    const dim = [D[j] * 0.3, D[j + 1] * 0.3, D[j + 2] * 0.3];
    const col = roof[y * W + x] ? [60, 120, 255] : dim;
    out.data[o2] = col[0]; out.data[o2 + 1] = col[1]; out.data[o2 + 2] = col[2];
  }
  for (const [y, x] of lit) { const o = (y * out.width + x + W + 6) * 4; out.data[o] = 255; out.data[o + 1] = 230; out.data[o + 2] = 120; }
  fs.writeFileSync(`asset_raw/work/mask_${k}.png`, PNG.sync.write(out));
  console.log(k, 'roof px', roof.reduce((a, b) => a + b, 0), 'polys', polys.length, 'lit', lit.length);
}
fs.writeFileSync(SP + 'roofs.json', JSON.stringify(roofs));
fs.writeFileSync(SP + 'windows.json', JSON.stringify(wins));
