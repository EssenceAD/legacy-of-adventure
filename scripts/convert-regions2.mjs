// REGIONS2 그림 변환: Ninja Adventure(CC0)에서 아직 안 쓴 몬스터·보스 → public/assets/mon/{na_*,nb_*} (1배 크기)
//  + 「별을 삼킨 것」(asset_raw/boss_deep, 2프레임) · 사냥터 소품 25개 · 토벌 트로피 4개
//  실행: node scripts/convert-regions2.mjs <Ninja Adventure 압축 푼 폴더/Actor>
//   (asset_raw/ninja_adventure.zip을 아무 곳에나 풀고 그 안의 Actor 폴더를 넘긴다)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ACTOR = process.argv[2];
if (!ACTOR || !fs.existsSync(path.join(ACTOR, 'Monster'))) {
  console.error('사용법: node scripts/convert-regions2.mjs <.../Ninja Adventure - Asset Pack/Actor>');
  process.exit(1);
}
const OUT_MON = 'public/assets/mon';
const read = (p) => PNG.sync.read(fs.readFileSync(p));
const blank = (w, h) => new PNG({ width: w, height: h });
const px = (im, x, y) => {
  if (x < 0 || y < 0 || x >= im.width || y >= im.height) return null;
  const i = (y * im.width + x) * 4;
  return im.data[i + 3] ? [im.data[i], im.data[i + 1], im.data[i + 2]] : null;
};
const put = (im, x, y, c) => {
  if (!c || x < 0 || y < 0 || x >= im.width || y >= im.height) return;
  const i = (y * im.width + x) * 4;
  im.data[i] = c[0];
  im.data[i + 1] = c[1];
  im.data[i + 2] = c[2];
  im.data[i + 3] = 255;
};
/** src의 (sx,sy,sw,sh)를 dst의 (dx,dy)에 dw×dh로 (최근접) · flip = 좌우 반전 */
function blit(src, sx, sy, sw, sh, dst, dx, dy, dw = sw, dh = sh, flip = false) {
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      const ux = Math.min(sw - 1, Math.floor((x * sw) / dw));
      const uy = Math.min(sh - 1, Math.floor((y * sh) / dh));
      put(dst, dx + x, dy + y, px(src, sx + (flip ? sw - 1 - ux : ux), sy + uy));
    }
}
/** 밝기를 유지한 채 한 색 계열로 (용암 슬라임 · 그림자 슬라임) */
const RAMP = {
  lava: [[60, 14, 10], [150, 40, 20], [226, 96, 40], [255, 180, 80], [255, 238, 170]],
  shadow: [[14, 10, 30], [44, 32, 80], [86, 64, 150], [140, 120, 210], [214, 204, 255]],
};
function tint(im, k) {
  const r = RAMP[k];
  for (let i = 0; i < im.data.length; i += 4) {
    if (!im.data[i + 3]) continue;
    const y = (im.data[i] * 0.3 + im.data[i + 1] * 0.59 + im.data[i + 2] * 0.11) / 255;
    const c = r[Math.min(r.length - 1, Math.floor(y * r.length))];
    im.data[i] = c[0];
    im.data[i + 1] = c[1];
    im.data[i + 2] = c[2];
  }
}

// ───────── 일반 몬스터 (16×16 네 방향 → 오른쪽 줄만 · 22×20 칸 · 대기2 걷기4 공격3 피격1 쓰러짐3) ─────────
// [id, 폴더, 지역, 색 바꾸기]
const MONS = [
  ['na_fish', 'Fish', 'coast'], ['na_fishred', 'FishRed', 'coast'], ['na_kappa', 'KappaGreen', 'coast'], ['na_mollusc', 'Mollusc', 'coast'], ['na_octopusg', 'GreenOctopus', 'coast'],
  ['na_lizard', 'Lizard', 'dune'], ['na_snake3', 'Snake3', 'dune'], ['na_mouse', 'Mouse', 'dune'], ['na_spiderred', 'SpiderRed', 'dune'], ['na_reptile', 'Reptile', 'dune'],
  ['na_flam2', 'Flam2', 'ember'], ['na_reptile2', 'Reptile2', 'ember'], ['na_mole2', 'Mole2', 'ember'], ['na_trex', 'TRex', 'ember'], ['na_slime3', 'Slime3', 'ember', 'lava'],
  ['na_butterfly', 'Butterfly', 'sky'], ['na_butterflyb', 'ButterflyBlue', 'sky'], ['na_owl', 'Owl', 'sky'], ['na_lantern', 'LanternGreen', 'sky'], ['na_heart', 'HeartRed', 'sky'],
  ['na_slime4', 'Slime4', 'deep', 'shadow'], ['na_snake4', 'Snake4', 'deep'], ['na_larva2', 'Larva2', 'deep'], ['na_mouseblack', 'MouseBlack', 'deep'], ['na_beast2', 'Beast2', 'deep'], ['na_cyclope2', 'Cyclope2', 'deep'],
];
// 칸 안 [x, 너비, 높이] (바닥 y=17 맞춤) — 옛 변환(mon_ready)과 같은 움직임
const FR = {
  idle: [[3, 16, 16], [3, 17, 15]],
  attack: [[2, 15, 17], [5, 17, 14], [4, 16, 16]],
  hurt: [[1, 16, 16]],
  die: [[2, 18, 11], [1, 21, 6], [0, 22, 2]],
};
for (const [id, dir, region, tn] of MONS) {
  const d = path.join(ACTOR, 'Monster', dir);
  const f = fs.readdirSync(d).find((x) => x.endsWith('.png') && x !== 'Faceset.png');
  const im = read(path.join(d, f));
  if (tn) tint(im, tn);
  const W = 22;
  const H = 20;
  const out = blank(W * 4, H * 5);
  const cell = (row, col, srcRow, [x, w, h]) => blit(im, 48, srcRow * 16, 16, 16, out, col * W + x, row * H + 18 - h, w, h);
  FR.idle.forEach((g, i) => cell(0, i, 0, g));
  for (let i = 0; i < 4; i++) cell(1, i, i, [3, 16, 16]);
  FR.attack.forEach((g, i) => cell(2, i, 0, g));
  FR.hurt.forEach((g, i) => cell(3, i, 0, g));
  FR.die.forEach((g, i) => cell(4, i, 0, g));
  const to = path.join(OUT_MON, id);
  fs.mkdirSync(to, { recursive: true });
  fs.writeFileSync(path.join(to, 'sheet.png'), PNG.sync.write(out));
  const anims = { idle: { row: 0, frames: 2, fps: 3, loop: true }, move: { row: 1, frames: 4, fps: 8, loop: true }, attack: { row: 2, frames: 3, fps: 10, loop: false }, hurt: { row: 3, frames: 1, fps: 1, loop: false }, die: { row: 4, frames: 3, fps: 10, loop: false } };
  fs.writeFileSync(path.join(to, 'meta.json'), JSON.stringify({ frameW: W, frameH: H, anchor: [11, 18], region, source: `Ninja Adventure (CC0) ${dir}${tn ? ' · ' + tn + ' tint' : ''}`, anims }, null, 1));
}
console.log('몬스터', MONS.length);

// ───────── 보스 (가로 줄 → 줄 쌓기 · convert-na.mjs와 같은 방식) ─────────
function stripBoss(id, dir, rows) {
  const strips = rows.map(([anim, file, fw, fps, loop]) => {
    const im = read(path.join(ACTOR, 'Boss', dir, file + '.png'));
    return { anim, im, fw, fh: im.height, n: Math.floor(im.width / fw), fps, loop: !!loop };
  });
  for (const s of strips) {
    s.bottom = 0;
    for (let y = 0; y < s.fh; y++) for (let x = 0; x < s.im.width; x++) if (s.im.data[(y * s.im.width + x) * 4 + 3]) s.bottom = y;
  }
  const W = Math.max(...strips.map((s) => s.fw));
  const H = Math.max(...strips.map((s) => s.fh)) + 2;
  const footY = H - 2;
  const cols = Math.max(...strips.map((s) => s.n));
  const out = blank(W * cols, H * strips.length);
  const anims = {};
  strips.forEach((s, row) => {
    const ox = Math.floor((W - s.fw) / 2);
    const oy = footY - s.bottom;
    for (let f = 0; f < s.n; f++) blit(s.im, f * s.fw, 0, s.fw, s.fh, out, f * W + ox, row * H + oy);
    anims[s.anim] = { row, frames: s.n, fps: s.fps, loop: s.loop };
  });
  let foot = H - 1;
  outer: for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) if (out.data[(y * out.width + x) * 4 + 3]) {
    foot = y;
    break outer;
  }
  save(id, out, { frameW: W, frameH: H, anchor: [Math.floor(W / 2), foot], boss: true, source: `Ninja Adventure (CC0) ${dir}`, anims }, path.join(ACTOR, 'Boss', dir, 'Faceset.png'));
}
function save(id, sheet, meta, face) {
  const to = path.join(OUT_MON, id);
  fs.mkdirSync(to, { recursive: true });
  fs.writeFileSync(path.join(to, 'sheet.png'), PNG.sync.write(sheet));
  if (face && fs.existsSync(face)) fs.copyFileSync(face, path.join(to, 'face.png'));
  fs.writeFileSync(path.join(to, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log(id, `${meta.frameW}×${meta.frameH}`, Object.entries(meta.anims).map(([k, a]) => `${k}${a.frames}`).join(' '));
}
// 사냥 보스 (지역 6~9)
stripBoss('nb_squidg', 'SquidGreen', [['idle', 'Idle', 76, 6, 1], ['move', 'Walk', 76, 8, 1], ['attack', 'Attack', 76, 12, 0], ['charge', 'Shoot', 76, 10, 1], ['hurt', 'Hit', 76, 12, 0], ['die', 'Hit', 76, 8, 0]]);
stripBoss('nb_racoongold', 'GiantRacoonGold', [['idle', 'Idle', 60, 6, 1], ['move', 'Jump', 60, 10, 1], ['attack', 'Attack', 60, 10, 0], ['charge', 'Charge', 60, 10, 1], ['hurt', 'Idle', 60, 12, 0], ['die', 'Idle', 60, 8, 0]]);
stripBoss('nb_flam', 'GiantFlam', [['idle', 'Idle', 50, 6, 1], ['move', 'Idle', 50, 10, 1], ['attack', 'Hit', 50, 10, 0], ['charge', 'Idle', 50, 16, 1], ['hurt', 'Hit', 50, 12, 0], ['die', 'Hit', 50, 8, 0]]);
stripBoss('nb_tengub', 'TenguBlue', [['idle', 'Idle', 68, 6, 1], ['move', 'Walk', 82, 12, 1], ['attack', 'Attack', 82, 18, 0], ['charge', 'Trans', 68, 14, 1], ['hurt', 'Hit', 68, 14, 0], ['die', 'Hit', 68, 8, 0]]);
// 토벌 보스 (지역 6~9)
stripBoss('nb_samuraib', 'GiantBlueSamurai', [['idle', 'Idle', 96, 6, 1], ['move', 'Walk', 96, 10, 1], ['attack', 'AttackRight', 96, 10, 0], ['charge', 'ChargeRight', 96, 10, 1], ['hurt', 'Hit', 96, 12, 0], ['die', 'Hit', 96, 8, 0]]);
stripBoss('nb_cyclop2', 'DemonCyclop2', [['idle', 'Idle', 50, 6, 1], ['move', 'Walk', 50, 10, 1], ['attack', 'Walk', 50, 14, 0], ['charge', 'Walk', 50, 16, 1], ['hurt', 'Hit', 50, 12, 0], ['die', 'Hit', 50, 8, 0]]);

// ───────── 용 (머리·몸통·꼬리·날개 조각 → 프레임을 코드로 짠다) ─────────
//  머리가 오른쪽 위, 몸통이 왼쪽 아래로 늘어진다 (오른쪽을 봄). 날개는 퍼덕 (세로로 눌렀다 폈다)
function dragon(id, dir) {
  const P = (n) => read(path.join(ACTOR, 'Boss', dir, n + '.png'));
  const head = P('Head');
  const b1 = P('Body1');
  const b2 = P('Body2');
  const tail = P('BodyEnd');
  const wing = P('Wing');
  // 꼬리를 시계 방향 90° (아래를 보던 끝이 왼쪽으로)
  const tailR = blank(tail.height, tail.width);
  for (let y = 0; y < tail.height; y++) for (let x = 0; x < tail.width; x++) put(tailR, tail.height - 1 - y, x, px(tail, x, y));
  const W = 152;
  const H = 140;
  const Y0 = 34;
  const frame = (dst, ox, oy, o) => {
    const hx = 62 + (o.hx ?? 0);
    const hy = Y0 + 14 + (o.hy ?? 0) + (o.bob ?? 0);
    const sway = o.sway ?? 0;
    // 몸통 (뒤에서부터): 꼬리 → 몸통 셋
    const segs = [
      [tailR, 2 - sway, Y0 + 66 + (o.bob ?? 0) * 0.5],
      [b2, 26 + sway, Y0 + 60 + (o.bob ?? 0) * 0.6],
      [b1, 38 - sway, Y0 + 48 + (o.bob ?? 0) * 0.7],
      [b2, 50 + sway, Y0 + 36 + (o.bob ?? 0) * 0.8],
    ];
    // 날개: 머리 양옆 위 (wy = 펼친 정도 0.55~1)
    const wh = Math.round(wing.height * (o.wy ?? 1));
    const wyTop = hy + 14 - wh;
    blit(wing, 0, 0, wing.width, wing.height, dst, ox + hx - wing.width + 14, oy + wyTop, wing.width, wh, true);
    blit(wing, 0, 0, wing.width, wing.height, dst, ox + hx + head.width - 14, oy + wyTop, wing.width, wh, false);
    for (const [im, x, y] of segs) blit(im, 0, 0, im.width, im.height, dst, ox + Math.round(x), oy + Math.round(y));
    blit(head, 0, 0, head.width, head.height, dst, ox + hx, oy + hy);
  };
  const rows = [
    ['idle', [{ wy: 1 }, { wy: 0.85, bob: 1 }, { wy: 0.7, bob: 2, sway: 1 }, { wy: 0.85, bob: 1 }], 6, true],
    ['move', [{ wy: 1, sway: -1 }, { wy: 0.75, bob: 1 }, { wy: 0.6, bob: 2, sway: 1 }, { wy: 0.8, bob: 1 }], 10, true],
    ['attack', [{ wy: 1, hx: -3, hy: -2 }, { wy: 0.6, hx: 5, hy: 3 }, { wy: 0.8, hx: 2, hy: 1 }], 10, false],
    ['charge', [{ wy: 1.05, hy: -3 }, { wy: 0.95, hy: -2, bob: -1 }], 10, true],
    ['hurt', [{ wy: 0.7, hx: -2, sway: 2 }], 12, false],
    ['die', [{ wy: 0.6, bob: 3 }, { wy: 0.5, bob: 6 }], 8, false],
  ];
  const cols = Math.max(...rows.map((r) => r[1].length));
  const out = blank(W * cols, H * rows.length);
  const anims = {};
  rows.forEach(([anim, frs, fps, loop], row) => {
    frs.forEach((o, i) => frame(out, i * W, row * H, o));
    anims[anim] = { row, frames: frs.length, fps, loop };
  });
  let foot = H - 1;
  outer: for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) if (out.data[(y * out.width + x) * 4 + 3]) {
    foot = y;
    break outer;
  }
  save(id, out, { frameW: W, frameH: H, anchor: [Math.floor(W / 2), foot], boss: true, source: `Ninja Adventure (CC0) ${dir} (조각 맞춤)`, anims }, path.join(ACTOR, 'Boss', dir, 'Faceset.png'));
}
dragon('nb_dragong', 'DragonGreen');
dragon('nb_dragonb', 'DragonBlue');

// ───────── 「별을 삼킨 것」: 대기 · 공격 2장 (왼쪽을 봄 → 뒤집어 오른쪽) · 눈은 금빛 · 걷기/피격/죽음은 코드 연출 ─────────
{
  const idle = read('asset_raw/boss_deep/deep_boss_idle.png');
  const atk = read('asset_raw/boss_deep/deep_boss_attack.png');
  // 눈: 위쪽 절반에서 밝은 베이지 점 → 금빛 + 2px 하이라이트
  const eyesOf = (im) => {
    const pts = [];
    // 뿔 끝(맨 위)은 빼고 · 눈은 따뜻한 베이지 (R이 B보다 높다)
    for (let y = 16; y < im.height * 0.45; y++)
      for (let x = 0; x < im.width; x++) {
        const c = px(im, x, y);
        if (c && c[0] > 175 && c[1] > 150 && c[0] - c[2] > 20) pts.push([x, y]);
      }
    return pts;
  };
  const gild = (im) => {
    const pts = eyesOf(im);
    for (const [x, y] of pts) put(im, x, y, [255, 211, 107]);
    // 눈마다 맨 위 왼쪽 2px 하이라이트
    const groups = [];
    for (const p of pts) {
      const g = groups.find((q) => q.some((r) => Math.abs(r[0] - p[0]) <= 2 && Math.abs(r[1] - p[1]) <= 2));
      if (g) g.push(p);
      else groups.push([p]);
    }
    const eyes = groups.filter((g) => g.length >= 3).map((g) => {
      const top = g.reduce((a, b) => (b[1] < a[1] || (b[1] === a[1] && b[0] < a[0]) ? b : a));
      put(im, top[0], top[1], [255, 248, 220]);
      put(im, top[0] + 1, top[1], [255, 248, 220]);
      const cx = g.reduce((s, p) => s + p[0], 0) / g.length;
      const cy = g.reduce((s, p) => s + p[1], 0) / g.length;
      return [Math.round(cx), Math.round(cy)];
    });
    return eyes;
  };
  const eyesIdle = gild(idle);
  gild(atk);
  const W = Math.max(idle.width, atk.width);
  const H = Math.max(idle.height, atk.height) + 2;
  const out = blank(W * 1, H * 2);
  // 뒤집기: 오른쪽을 보게 · 발 = 아래 끝 맞춤
  const place = (im, row) => blit(im, 0, 0, im.width, im.height, out, Math.floor((W - im.width) / 2), row * H + (H - 2 - im.height), im.width, im.height, true);
  place(idle, 0);
  place(atk, 1);
  const ox = Math.floor((W - idle.width) / 2);
  const eyes = eyesIdle.map(([x, y]) => [ox + idle.width - 1 - x, y + (H - 2 - idle.height)]);
  const one = (row, fps, loop) => ({ row, frames: 1, fps, loop });
  const meta = {
    frameW: W, frameH: H, anchor: [Math.floor(W / 2), H - 2], boss: true, code: true, eyes, source: 'REGIONS2 별을 삼킨 것 (asset_raw/boss_deep)',
    anims: { idle: one(0, 1, true), move: one(0, 1, true), attack: one(1, 1, false), charge: one(1, 1, true), hurt: one(0, 1, false), die: one(0, 1, false) },
  };
  // 얼굴 38×38: 대기 그림 머리 (두 눈 가운데 기준 · 뒤집힌 쪽)
  const face = blank(38, 38);
  const flipped = blank(idle.width, idle.height);
  blit(idle, 0, 0, idle.width, idle.height, flipped, 0, 0, idle.width, idle.height, true);
  const ex = eyesIdle.length ? eyesIdle.reduce((s, e) => s + (idle.width - 1 - e[0]), 0) / eyesIdle.length : idle.width / 2;
  const ey = eyesIdle.length ? eyesIdle.reduce((s, e) => s + e[1], 0) / eyesIdle.length : 24;
  const fx0 = Math.max(0, Math.min(idle.width - 38, Math.round(ex - 19)));
  const fy0 = Math.max(0, Math.round(ey - 20));
  for (let y = 0; y < 38; y++) for (let x = 0; x < 38; x++) put(face, x, y, px(flipped, fx0 + x, fy0 + y) ?? [12, 10, 30]);
  const to = path.join(OUT_MON, 'nb_deep');
  fs.mkdirSync(to, { recursive: true });
  fs.writeFileSync(path.join(to, 'face.png'), PNG.sync.write(face));
  save('nb_deep', out, meta);
  console.log('  눈', JSON.stringify(eyes));
}

// ───────── 사냥터 소품 25개 · 토벌 트로피 4개 ─────────
{
  const src = 'asset_raw/hunt_props_ready';
  const to = 'public/assets/combat/props';
  const meta = JSON.parse(fs.readFileSync(path.join(to, 'meta.json'), 'utf8'));
  const add = JSON.parse(fs.readFileSync(path.join(src, 'props_meta_new.json'), 'utf8'));
  for (const k of Object.keys(add)) {
    fs.copyFileSync(path.join(src, k + '.png'), path.join(to, k + '.png'));
    meta[k] = add[k];
  }
  fs.writeFileSync(path.join(to, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log('소품', Object.keys(add).length);
  const tsrc = 'asset_raw/ready_trophies';
  const tm = JSON.parse(fs.readFileSync(path.join(tsrc, 'meta.json'), 'utf8'));
  const sm = JSON.parse(fs.readFileSync('public/assets/sprites/meta.json', 'utf8'));
  for (const [k, v] of Object.entries(tm)) {
    fs.copyFileSync(path.join(tsrc, k + '.png'), path.join('public/assets/sprites', k + '.png'));
    sm[k] = { w: v.w, h: v.h, fw: 1, fh: 1 };
  }
  fs.writeFileSync('public/assets/sprites/meta.json', JSON.stringify(sm));
  console.log('트로피', Object.keys(tm).length);
}
