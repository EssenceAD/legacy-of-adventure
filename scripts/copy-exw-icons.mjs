// RAIDWEAPON §2 전용 무기 아이콘 복사 (여러 번 돌려도 같음)
//  형철 그림: asset_raw/weapons/exw_<영웅 키>.png (32×32) · exw_<영웅 키>_24.png (24×24)
//  → public/assets/weapons/ 같은 이름 그대로 + src/data/exwIcons.ts (그림이 있는 키 목록 · 코드가 이 목록으로 고른다)
//  그림이 없는 키는 직업 무기 아이콘 + 금빛 테두리 그대로. 새 그림이 오면: node scripts/copy-exw-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = /^exw_([a-z0-9]+?)(_24)?\.png$/;

/** 복사 (src·dst 폴더 · listFile = 키 목록 TS) → { copied: 파일 이름[], keys: 32·24 둘 다 있는 키[] } */
export function copyExwIcons(src = path.join(ROOT, 'asset_raw/weapons'), dst = path.join(ROOT, 'public/assets/weapons'), listFile = path.join(ROOT, 'src/data/exwIcons.ts')) {
  const files = fs.existsSync(src) ? fs.readdirSync(src).filter((f) => KEY.test(f)).sort() : [];
  fs.mkdirSync(dst, { recursive: true });
  const copied = [];
  for (const f of files) {
    const a = fs.readFileSync(path.join(src, f));
    const out = path.join(dst, f);
    if (!fs.existsSync(out) || !a.equals(fs.readFileSync(out))) fs.writeFileSync(out, a);
    copied.push(f);
  }
  // 목록은 public에 실제로 있는 것 기준 (원본 폴더가 없는 곳에서도 그대로)
  const have = new Set(fs.readdirSync(dst).filter((f) => KEY.test(f)));
  const keys = [...new Set([...have].map((f) => KEY.exec(f)[1]))].filter((k) => have.has(`exw_${k}.png`) && have.has(`exw_${k}_24.png`)).sort();
  if (listFile) {
    const ts = `// 자동 생성 (scripts/copy-exw-icons.mjs) — 손대지 마세요\n//  public/assets/weapons/exw_<키>.png (32) · exw_<키>_24.png (24) 가 둘 다 있는 전용 무기 키\nexport const EXW_ICONS: readonly string[] = ${JSON.stringify(keys)};\n`;
    if (!fs.existsSync(listFile) || fs.readFileSync(listFile, 'utf8') !== ts) fs.writeFileSync(listFile, ts);
  }
  return { copied, keys };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = copyExwIcons();
  console.log(`복사 ${r.copied.length}개 · 그림 있는 키 ${r.keys.length}/19: ${r.keys.join(' ')}`);
}
