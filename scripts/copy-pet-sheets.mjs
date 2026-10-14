// LUXE §2 펫 걷기 시트: asset_raw/pets/pet_<id>_sheet.png + sheets.json → public/assets/pets/ + src/data/petSheets.ts
//  한 줄 6칸 [앞 서기, 앞 걷기1, 앞 걷기2, 뒤 서기, 뒤 걷기1, 뒤 걷기2] · 칸 크기 cw×ch · 발은 칸 아래 가운데
//  새 시트·뒷모습을 넣고 node scripts/copy-pet-sheets.mjs 한 번 — 같은 내용이면 건드리지 않는다 (몇 번 돌려도 같음)
//  (_sheets_preview.png 같은 _로 시작하는 파일은 무시)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC = 'asset_raw/pets';
const DST = 'public/assets/pets';
const META = 'src/data/petSheets.ts';

const raw = JSON.parse(fs.readFileSync(path.join(SRC, 'sheets.json'), 'utf8'));
const out = {};
let copied = 0;
const errs = [];
for (const id of Object.keys(raw).sort()) {
  const m = raw[id];
  const f = path.join(SRC, `pet_${id}_sheet.png`);
  if (!fs.existsSync(f)) {
    errs.push(`${id}: 시트 파일 없음 (${f})`);
    continue;
  }
  const buf = fs.readFileSync(f);
  const png = PNG.sync.read(buf);
  const frames = m.frames ?? 6;
  if (png.width !== m.cw * frames || png.height !== m.ch) {
    errs.push(`${id}: 크기 ${png.width}×${png.height} ≠ ${m.cw}×${frames} × ${m.ch}`);
    continue;
  }
  const to = path.join(DST, `pet_${id}_sheet.png`);
  if (!fs.existsSync(to) || !fs.readFileSync(to).equals(buf)) {
    fs.copyFileSync(f, to);
    copied++;
  }
  // 뒷모습은 6칸이 다 있어야 쓴다
  out[id] = { cw: m.cw, ch: m.ch, frames, back: !!m.back && frames >= 6 };
}

const body = `// 만든 파일 — node scripts/copy-pet-sheets.mjs 가 asset_raw/pets/sheets.json에서 만든다 (손으로 고치지 않기)
//  펫 걷기 시트 public/assets/pets/pet_<id>_sheet.png: 한 줄 [앞 서기, 앞 걷기1, 앞 걷기2, 뒤 서기, 뒤 걷기1, 뒤 걷기2] · 칸 cw×ch · 발은 칸 아래 가운데
export interface PetSheet {
  cw: number;
  ch: number;
  frames: number;
  /** 뒷모습(3~5칸)이 있나 — 없으면 위로 갈 때도 앞모습 */
  back: boolean;
}
export const PET_SHEETS: Record<string, PetSheet> = {
${Object.entries(out)
  .map(([id, m]) => `  ${id}: { cw: ${m.cw}, ch: ${m.ch}, frames: ${m.frames}, back: ${m.back} },`)
  .join('\n')}
};
`;
const prev = fs.existsSync(META) ? fs.readFileSync(META, 'utf8').replace(/\r\n/g, '\n') : '';
if (prev !== body) fs.writeFileSync(META, body);
console.log(`펫 시트 ${Object.keys(out).length}개 (새로 복사 ${copied}) · ${META} ${prev === body ? '그대로' : '갱신'}`);
if (errs.length) {
  console.error(errs.join('\n'));
  process.exit(1);
}
