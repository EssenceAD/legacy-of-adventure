// RIFTART 하늘 균열 그림 복사 (여러 번 돌려도 같음 · 아무 그림이 없어도 그대로 돈다)
//  보스 (look = sky | ember | frost) — 둘 중 아무 모양이나:
//    asset_raw/rift/rift_<look>.png + asset_raw/rift/rift_<look>.meta.json (또는 rift_<look>.json)
//    asset_raw/rift/rift_<look>/sheet.png + asset_raw/rift/rift_<look>/meta.json
//    meta = public/assets/mon/nb_deep/meta.json 과 같은 모양 (frameW · frameH · anchor · anims — 0줄 대기 · 1줄 공격)
//    anims 가 없거나 모자라면 0줄 = idle·move·hurt·die · 1줄 = attack·charge 로 채운다 (프레임 수 = 시트 너비 / frameW)
//  → public/assets/mon/rift_<look>/sheet.png + meta.json (다른 몬스터 폴더와 같은 모양) — 그림이 있으면 전투가 이 시트를 쓴다
//  소품: asset_raw/rift/props/*.png (하늘 섬 · 금 · 구름 기둥 · 구름 …) → public/assets/rift/props/ 같은 이름
//  목록: src/data/riftArt.ts (public 에 실제로 있는 것 기준 · 코드가 이 목록으로 고른다)
//  새 그림이 오면: node scripts/copy-rift-art.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RIFT_LOOKS = ['sky', 'ember', 'frost'];
const PROP = /^[a-z0-9_-]+\.png$/i;

/** PNG 너비 (IHDR) — 아니면 0 */
function pngWidth(buf) {
  return buf.length > 24 && buf.readUInt32BE(12) === 0x49484452 ? buf.readUInt32BE(16) : 0;
}
/** 원본 meta → 게임 meta (모자란 동작 채우기) · 틀리면 null */
export function normMeta(meta, sheetW) {
  if (!meta || typeof meta !== 'object') return null;
  const { frameW, frameH, anchor } = meta;
  if (!(frameW > 0 && frameH > 0 && Array.isArray(anchor) && anchor.length === 2)) return null;
  const n = Math.max(1, Math.floor((sheetW || frameW) / frameW));
  const fps = n > 1 ? 6 : 1;
  const row = (r, loop) => ({ row: r, frames: n, fps, loop });
  const def = { idle: row(0, true), move: row(0, true), attack: row(1, false), charge: row(1, true), hurt: row(0, false), die: row(0, false) };
  const anims = { ...def, ...(meta.anims && typeof meta.anims === 'object' ? meta.anims : {}) };
  // 한 장짜리(움직임 없음)는 「별을 삼킨 것」처럼 코드로 숨쉬기·흩어지기
  const code = meta.code ?? n === 1;
  return { ...meta, code, anims };
}

const write = (out, buf) => {
  if (!fs.existsSync(out) || !buf.equals(fs.readFileSync(out))) fs.writeFileSync(out, buf);
};

/** 복사 (rawDir = asset_raw/rift · pub = public/assets · listFile = 목록 TS) → { bosses: look[], props: 이름[], skipped: 이유[] } */
export function copyRiftArt(rawDir = path.join(ROOT, 'asset_raw/rift'), pub = path.join(ROOT, 'public/assets'), listFile = path.join(ROOT, 'src/data/riftArt.ts')) {
  const skipped = [];
  const monDir = path.join(pub, 'mon');
  const propDir = path.join(pub, 'rift/props');
  for (const look of RIFT_LOOKS) {
    const cands = [
      [path.join(rawDir, `rift_${look}.png`), path.join(rawDir, `rift_${look}.meta.json`)],
      [path.join(rawDir, `rift_${look}.png`), path.join(rawDir, `rift_${look}.json`)],
      [path.join(rawDir, `rift_${look}/sheet.png`), path.join(rawDir, `rift_${look}/meta.json`)],
    ];
    const hit = cands.find(([a, b]) => fs.existsSync(a) && fs.existsSync(b));
    if (!hit) continue;
    const png = fs.readFileSync(hit[0]);
    let meta = null;
    try {
      meta = normMeta(JSON.parse(fs.readFileSync(hit[1], 'utf8')), pngWidth(png));
    } catch {
      meta = null;
    }
    if (!meta) {
      skipped.push(`rift_${look}: meta.json 이 틀림 (frameW · frameH · anchor 필요)`);
      continue;
    }
    const dst = path.join(monDir, `rift_${look}`);
    fs.mkdirSync(dst, { recursive: true });
    write(path.join(dst, 'sheet.png'), png);
    write(path.join(dst, 'meta.json'), Buffer.from(JSON.stringify(meta, null, 1) + '\n'));
  }
  const propSrc = path.join(rawDir, 'props');
  const props = fs.existsSync(propSrc) ? fs.readdirSync(propSrc).filter((f) => PROP.test(f)).sort() : [];
  if (props.length) fs.mkdirSync(propDir, { recursive: true });
  for (const f of props) write(path.join(propDir, f.toLowerCase()), fs.readFileSync(path.join(propSrc, f)));

  // 목록은 public 에 실제로 있는 것 기준 (원본 폴더가 없는 곳에서도 그대로)
  const bosses = RIFT_LOOKS.filter((l) => fs.existsSync(path.join(monDir, `rift_${l}/sheet.png`)) && fs.existsSync(path.join(monDir, `rift_${l}/meta.json`)));
  const have = fs.existsSync(propDir) ? fs.readdirSync(propDir).filter((f) => PROP.test(f)).map((f) => f.replace(/\.png$/i, '')).sort() : [];
  if (listFile) {
    const ts =
      `// 자동 생성 (scripts/copy-rift-art.mjs) — 손대지 마세요\n` +
      `//  bosses: public/assets/mon/rift_<look>/ (sheet.png + meta.json) 가 있는 보스 모습 · props: public/assets/rift/props/<이름>.png\n` +
      `export const RIFT_ART: { readonly bosses: readonly string[]; readonly props: readonly string[] } = ${JSON.stringify({ bosses, props: have })};\n`;
    if (!fs.existsSync(listFile) || fs.readFileSync(listFile, 'utf8') !== ts) fs.writeFileSync(listFile, ts);
  }
  return { bosses, props: have, skipped };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = copyRiftArt();
  for (const s of r.skipped) console.warn('건너뜀 ' + s);
  console.log(`보스 그림 ${r.bosses.length}/3: ${r.bosses.join(' ') || '없음 (지금 보스 그림 그대로)'} · 소품 ${r.props.length}: ${r.props.join(' ') || '없음'}`);
}
