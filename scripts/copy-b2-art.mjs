// BUILDINGS2 그림 복사 (여러 번 돌려도 같음) — 새 건물 7 · 새 장식 35 (목록: src/data/buildings2.json)
//  asset_raw/gpt/READY 에 키가 있고 asset_raw/gpt/<key>.png 가 있으면 → 그 그림 (이미 투명·팔레트·크기 변환 끝)
//  없으면 → 임시 그림: 있는 스프라이트(fb)를 <key>.png 로 복사 (fbScale 이 있으면 크롬에서 칸 그대로 줄여서)
//  → public/assets/sprites/<key>.png + meta.json { w, h, fw, fh } · src/data/b2Art.ts (진짜 그림이 들어간 키)
//  READY가 늘면: node scripts/copy-b2-art.mjs → 빌드·배포
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPR = path.join(ROOT, 'public/assets/sprites');
const GPT = path.join(ROOT, 'asset_raw/gpt');
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/buildings2.json'), 'utf8'));
const items = [...LIST.buildings, ...LIST.decos];

const pngSize = (buf) => (buf.length > 24 && buf.readUInt32BE(12) === 0x49484452 ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null);
const ready = new Set(
  fs.existsSync(path.join(GPT, 'READY'))
    ? fs.readFileSync(path.join(GPT, 'READY'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    : [],
);
const artFile = path.join(ROOT, 'src/data/b2Art.ts');
const wasReal = new Set(fs.existsSync(artFile) ? [...fs.readFileSync(artFile, 'utf8').matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]) : []);

/** 크롬으로 칸 그대로(최근접) 줄이기 — 임시 그림 한 번만 */
async function scaled(src, k) {
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage();
  const data = 'data:image/png;base64,' + fs.readFileSync(src).toString('base64');
  const out = await p.evaluate(async ([data, k]) => {
    const im = new Image();
    im.src = data;
    await im.decode();
    const w = Math.max(1, Math.round(im.width * k));
    const h = Math.max(1, Math.round(im.height * k));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(im, 0, 0, w, h);
    return c.toDataURL('image/png').split(',')[1];
  }, [data, k]);
  await b.close();
  return Buffer.from(out, 'base64');
}

const meta = JSON.parse(fs.readFileSync(path.join(SPR, 'meta.json'), 'utf8'));
const real = [];
let changed = 0;
for (const it of items) {
  const out = path.join(SPR, `${it.key}.png`);
  const gpt = path.join(GPT, `${it.key}.png`);
  let buf = null;
  if (ready.has(it.key) && fs.existsSync(gpt)) {
    buf = fs.readFileSync(gpt);
    real.push(it.key);
  } else if (fs.existsSync(out) && !wasReal.has(it.key)) {
    buf = fs.readFileSync(out); // 이미 만든 임시 그림 그대로
  } else {
    const src = path.join(SPR, `${it.fb}.png`);
    if (!fs.existsSync(src)) throw new Error(`임시 그림 없음: ${it.key} ← ${it.fb}`);
    buf = it.fbScale ? await scaled(src, it.fbScale) : fs.readFileSync(src);
  }
  const sz = pngSize(buf);
  if (!sz) throw new Error(`PNG가 아님: ${it.key}`);
  if (!fs.existsSync(out) || !buf.equals(fs.readFileSync(out))) {
    fs.writeFileSync(out, buf);
    changed++;
  }
  meta[it.key] = { w: sz[0], h: sz[1], fw: it.size[0], fh: it.size[1] };
}
fs.writeFileSync(path.join(SPR, 'meta.json'), JSON.stringify(meta));
real.sort();
fs.writeFileSync(
  artFile,
  `// scripts/copy-b2-art.mjs 가 만든다 — BUILDINGS2 진짜 그림이 들어간 키 (나머지는 임시 그림)\nexport const B2_REAL: readonly string[] = [${real.map((k) => `'${k}'`).join(', ')}];\n`,
);
console.log(`BUILDINGS2 그림 ${items.length}개 · 진짜 ${real.length} (${real.join(', ') || '-'}) · 바뀐 파일 ${changed}`);
