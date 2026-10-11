// Ninja Adventure (CC0) → 게임 형식 (전투 2차)
//  - 일반 몬스터 22종: asset_raw/mon_ready/na_* → public/assets/mon/ (이미 변환됨, 복사만)
//  - 보스 9종: asset_raw/na_raw/Boss/* 가로 줄 → sheet.png(줄 쌓기, 1배 크기) + meta.json
//  - 이펙트: 베기·연기·마법 → public/assets/fx/*.png + fx.json (프레임 크기·수)
//  실행: node scripts/convert-na.mjs   (pngjs 필요: devDependencies)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const RAW = 'asset_raw/na_raw';
const OUT_MON = 'public/assets/mon';
const OUT_FX = 'public/assets/fx';
const read = (p) => PNG.sync.read(fs.readFileSync(p));

// ───────── 일반 몬스터 ─────────
for (const d of fs.readdirSync('asset_raw/mon_ready')) {
  const to = path.join(OUT_MON, d);
  fs.mkdirSync(to, { recursive: true });
  for (const f of ['sheet.png', 'meta.json']) fs.copyFileSync(path.join('asset_raw/mon_ready', d, f), path.join(to, f));
}

// ───────── 보스 ─────────
// [id, 폴더, 줄 목록: [애니메이션, 파일, 프레임 너비, fps, 반복]]
const BOSSES = [
  ['nb_bamboo', 'GiantBamboo', [['idle', 'Idle', 62, 6, 1], ['move', 'Walk', 62, 12, 1], ['attack', 'Attack', 62, 12, 0], ['charge', 'Charge', 62, 10, 1], ['hurt', 'Hit', 62, 12, 0], ['die', 'Hit', 62, 8, 0]]],
  ['nb_frog', 'GiantFrog', [['idle', 'Idle40x40', 40, 6, 1], ['move', 'Jump', 40, 10, 1], ['attack', 'Attack', 40, 10, 0], ['charge', 'Charge', 40, 12, 1], ['hurt', 'Hit', 40, 12, 0], ['die', 'Hit', 40, 8, 0]]],
  ['nb_cyclop', 'DemonCyclop', [['idle', 'Idle', 50, 6, 1], ['move', 'Walk', 50, 10, 1], ['attack', 'Walk', 50, 14, 0], ['charge', 'Walk', 50, 16, 1], ['hurt', 'Hit', 50, 12, 0], ['die', 'Hit', 50, 8, 0]]],
  ['nb_spirit', 'GiantSpirit', [['idle', 'Idle', 50, 6, 1], ['move', 'Idle', 50, 8, 1], ['attack', 'Hit', 50, 10, 0], ['charge', 'Idle', 50, 14, 1], ['hurt', 'Hit', 50, 12, 0], ['die', 'Hit', 50, 8, 0]]],
  ['nb_squid', 'SquidRed', [['idle', 'Idle', 76, 6, 1], ['move', 'Walk', 76, 8, 1], ['attack', 'Attack', 76, 12, 0], ['charge', 'Shoot', 76, 10, 1], ['hurt', 'Hit', 76, 12, 0], ['die', 'Hit', 76, 8, 0]]],
  ['nb_samurai', 'GiantRedSamurai', [['idle', 'Idle', 96, 6, 1], ['move', 'Walk', 96, 10, 1], ['attack', 'AttackRight', 96, 10, 0], ['charge', 'ChargeRight', 96, 10, 1], ['hurt', 'Hit', 96, 12, 0], ['die', 'Hit', 96, 8, 0]]],
  ['nb_tengu', 'TenguRed', [['idle', 'Idle', 82, 6, 1], ['move', 'Walk', 82, 12, 1], ['attack', 'Attack', 82, 18, 0], ['charge', 'Trans', 82, 14, 1], ['hurt', 'Hit', 82, 14, 0], ['die', 'Hit', 82, 8, 0]]],
  ['nb_racoon', 'GiantRacoon', [['idle', 'Idle', 60, 6, 1], ['move', 'Jump', 60, 10, 1], ['attack', 'Attack', 60, 10, 0], ['charge', 'Charge', 60, 10, 1], ['hurt', 'Idle', 60, 12, 0], ['die', 'Idle', 60, 8, 0]]],
  ['nb_slime', 'GiantSlime', [['idle', 'Idle', 62, 6, 1], ['move', 'Jump', 62, 12, 1], ['attack', 'Jump', 62, 16, 0], ['charge', 'Jump', 62, 16, 1], ['hurt', 'Hit', 62, 12, 0], ['die', 'Hit', 62, 8, 0]]],
];
for (const [id, dir, rows] of BOSSES) {
  const strips = rows.map(([anim, file, fw, fps, loop]) => {
    const im = read(path.join(RAW, 'Boss', dir, file + '.png'));
    return { anim, im, fw, fh: im.height, n: Math.floor(im.width / fw), fps, loop: !!loop };
  });
  // 줄마다 그림의 가장 아래 칠해진 줄(발) → 모든 줄의 발을 같은 높이에 (공격 그림이 큰 칸 가운데에 있어도 뜨지 않게)
  for (const s of strips) {
    s.bottom = 0;
    for (let y = 0; y < s.fh; y++) for (let x = 0; x < s.im.width; x++) if (s.im.data[(y * s.im.width + x) * 4 + 3]) s.bottom = y;
  }
  const W = Math.max(...strips.map((s) => s.fw));
  const H = Math.max(...strips.map((s) => s.fh)) + 2;
  const footY = H - 2;
  const cols = Math.max(...strips.map((s) => s.n));
  const out = new PNG({ width: W * cols, height: H * strips.length });
  const anims = {};
  strips.forEach((s, row) => {
    // 바닥 가운데 맞춤 (프레임 크기가 줄마다 달라도 발이 같은 자리에)
    const ox = Math.floor((W - s.fw) / 2);
    const oy = footY - s.bottom;
    for (let f = 0; f < s.n; f++)
      for (let y = 0; y < s.fh; y++)
        for (let x = 0; x < s.fw; x++) {
          const si = (y * s.im.width + f * s.fw + x) * 4;
          const a = s.im.data[si + 3];
          if (!a) continue;
          if (oy + y < 0 || oy + y >= H) continue;
          const di = ((row * H + oy + y) * out.width + f * W + ox + x) * 4;
          out.data[di] = s.im.data[si];
          out.data[di + 1] = s.im.data[si + 1];
          out.data[di + 2] = s.im.data[si + 2];
          out.data[di + 3] = 255; // 알파 0/255
        }
    anims[s.anim] = { row, frames: s.n, fps: s.fps, loop: s.loop };
  });
  // 기준점: 대기 첫 프레임의 가장 아래 칠해진 줄
  let foot = H - 1;
  outer: for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) if (out.data[(y * out.width + x) * 4 + 3]) {
    foot = y;
    break outer;
  }
  const to = path.join(OUT_MON, id);
  fs.mkdirSync(to, { recursive: true });
  fs.writeFileSync(path.join(to, 'sheet.png'), PNG.sync.write(out));
  // 핫픽스 8: 얼굴(초상) — 토벌 준비·결과·원정 게시판 카드
  const face = path.join(RAW, 'Boss', dir, 'Faceset.png');
  if (fs.existsSync(face)) fs.copyFileSync(face, path.join(to, 'face.png'));
  fs.writeFileSync(path.join(to, 'meta.json'), JSON.stringify({ frameW: W, frameH: H, anchor: [Math.floor(W / 2), foot], boss: true, source: `Ninja Adventure (CC0) ${dir}`, anims }, null, 1));
  console.log(id, `${W}×${H}`, Object.entries(anims).map(([k, a]) => `${k}${a.frames}`).join(' '));
}

// ───────── 이펙트 ─────────
const FX = [
  ['arc', 'Slash/SpriteSheetArc.png', 38, 34],
  ['circular', 'Slash/SpriteSheetCircular.png', 54, 55],
  ['smoke', 'Smoke/Smoke/SpriteSheet.png', 32, 32],
  ['smokering', 'Smoke/SmokeCircular/SpriteSheet.png', 40, 14],
  ['spark', 'Magic/Spark/SpriteSheet.png', 27, 35],
  ['circle', 'Magic/Circle/SpriteSheetWhite.png', 32, 32],
];
fs.mkdirSync(OUT_FX, { recursive: true });
const fxMeta = {};
for (const [id, file, fw, fh] of FX) {
  const im = read(path.join(RAW, 'FX', file));
  // 알파 0/255로 정리
  for (let i = 3; i < im.data.length; i += 4) im.data[i] = im.data[i] >= 96 ? 255 : 0;
  fs.writeFileSync(path.join(OUT_FX, id + '.png'), PNG.sync.write(im));
  fxMeta[id] = { w: fw, h: fh, n: Math.floor(im.width / fw) };
}
fs.writeFileSync(path.join(OUT_FX, 'fx.json'), JSON.stringify(fxMeta));
console.log('fx', JSON.stringify(fxMeta));
