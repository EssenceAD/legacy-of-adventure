// 캐릭터 도트 생성 (24×33) — reference/core.js의 drawChar / buildChar 이식
import { CLASSES, type ClassDef, type ClassKey } from '../data/classes';
import { dk, Grid, lt, type GridT } from './pixel';

const SK = { skin: '#f2c49b', skin2: '#d99a78', eye: '#2a1a2e', blush: '#ec8f86' };

interface Pose {
  lx?: number;
  rx?: number;
  bob?: number;
  armF?: number;
  armB?: number;
  sit?: number;
  atk?: number;
  eat?: number;
  pray?: number;
  back?: number;
  sleep?: number;
}

function drawChar(def: ClassDef, pose: Pose = {}): GridT {
  const G = Grid(24, 33, 1, 3);
  const bob = pose.bob || 0;
  const dw = def.dwarf;
  const sit = pose.sit;
  const headCY = (dw ? 12.5 : 10) + bob + (sit ? 3 : 0);
  const bodyY = (dw ? 17 : 15) + bob + (sit ? 3 : 0);
  const legY = dw ? 24 : 22;
  const cx = 10.5;
  // 방패 (뒤)
  if (def.shield && !sit) {
    G.ell(5.5, bodyY + 4, 3.2, 4, '#9aa6be', 'base');
    G.ell(5.5, bodyY + 4, 1.6, 2.2, def.cloth, 'base');
    G.set(5, bodyY + 4, def.accent);
  }
  // 긴 머리 (뒤)
  if (def.style === 'long') G.rect(5, headCY, 5, 10, def.hair);
  if (def.style === 'braid') {
    G.rect(5, headCY + 2, 3, 6, def.hair);
    G.ell(6, headCY + 9, 1.6, 1.6, def.hair);
  }
  // 다리
  if (!sit) {
    const lx = pose.lx || 0;
    const rx = pose.rx || 0;
    if (!def.robe) {
      G.rect(8 + lx, legY, 2, dw ? 3 : 5, dk(def.pants, 0.15));
      G.rect(8 + lx, dw ? 26 : 25, 3, dw ? 2 : 3, dk(def.boots, 0.1));
      G.rect(11 + rx, legY, 2, dw ? 3 : 5, def.pants);
      G.rect(11 + rx, dw ? 26 : 25, 3, dw ? 2 : 3, def.boots);
    } else {
      G.rect(8 + lx, 27, 3, 2, dk(def.boots, 0.1));
      G.rect(11 + rx, 27, 3, 2, def.boots);
    }
  }
  // 뒤쪽 팔
  const aB = pose.armB || 0;
  G.rect(6, bodyY + 1 + aB, 2, 5, dk(def.arm, 0.25));
  G.rect(6, bodyY + 6 + aB, 2, 1, SK.skin2);
  // 몸통
  if (def.robe && !sit) {
    for (let j = 0; j < 29 - bodyY; j++) {
      const ww = 8 + Math.floor(j / 3);
      G.rect(Math.round(cx - ww / 2), bodyY + j, ww, 1, def.cloth);
    }
    G.rect(10, bodyY, 2, 29 - bodyY - 2, def.accent, 'flat');
    G.rect(Math.round(cx - 4), bodyY + 5, 8, 1, def.accent);
  } else {
    const bw = dw ? 10 : 8;
    G.rect(Math.round(cx - bw / 2), bodyY, bw, (dw ? 8 : 7) - (sit ? 1 : 0), def.cloth);
    if (def.apron) G.rect(Math.round(cx - 2), bodyY + 2, 5, 6, def.apron);
    if (!def.robe) G.rect(Math.round(cx - bw / 2), bodyY + (dw ? 6 : 5), bw, 1, def.accent);
    if (def.weapon === 'sword') {
      G.rect(10, bodyY, 3, 6, '#2f57b0');
      G.set(11, bodyY + 2, def.accent, 'flat');
    }
  }
  // 머리
  G.ell(cx + 0.6, headCY - 0.2, 6.2, 5.6, SK.skin);
  if (def.elf) G.tri(5, headCY - 1, 6.5, headCY + 1.5, 2.5, headCY - 3, SK.skin);
  if (def.style === 'short' || def.style === 'long' || def.style === 'braid') {
    G.ell(cx + 0.3, headCY - 1.9, 6.7, 4.9, def.hair, null, (x, y) => y < headCY - 1.6 || (x < cx - 2.4 && y < headCY + 3.5));
    G.rect(12, headCY - 3.6, 5, 1, def.hair);
    G.set(16, headCY - 2.6, def.hair);
    G.set(12, headCY - 2.6, def.hair);
  }
  if (def.style === 'bald') {
    G.rect(5, headCY - 1, 2, 4, def.hair);
    G.ell(cx, headCY - 4, 3, 1.2, lt(SK.skin, 0.15));
  }
  if (def.bandana) {
    G.ell(cx + 0.3, headCY - 2.8, 6.7, 3.6, def.bandana, null, (_x, y) => y < headCY - 2);
    G.rect(4, headCY - 1, 2, 2, def.bandana);
    G.set(3, headCY, def.bandana);
  }
  if (def.hood) {
    G.ell(cx - 0.2, headCY - 0.6, 7.1, 6.6, def.hood, null, (x, y) => !(x >= cx - 0.6 && y >= headCY - 3 && y <= headCY + 4));
    G.rect(5, bodyY, 5, 4, def.hood);
  }
  if (def.helm) {
    G.ell(cx + 0.5, headCY - 2.6, 6.8, 4.2, def.helm, null, (_x, y) => y < headCY - 2);
    G.rect(4, headCY - 2.5, 14, 1, dk(def.helm, 0.2));
    for (const [x, y] of [[4, -4], [3, -5], [3, -6], [17, -4], [18, -5], [18, -6]]) G.set(x, headCY + y, '#f3ead3');
  }
  if (def.hat === 'wizard') {
    G.rect(2, headCY - 5, 18, 2, def.hatc!);
    G.tri(6, headCY - 4.5, 16, headCY - 4.5, 7, headCY - 13, def.hatc!);
    G.rect(7, headCY - 6, 9, 1, def.accent, 'flat');
  }
  if (pose.back) {
    // 뒷모습: 얼굴 자리를 머리카락(또는 두건)으로 덮는다
    if (def.style !== 'bald') {
      const hc = def.hood || def.hair;
      for (let y = 0; y < G.h; y++)
        for (let x = 0; x < G.w; x++) {
          const p = G.g[y][x];
          if (p && (p.c === SK.skin || (def.hood && p.c === def.hair)) && y - 3 < headCY + 4) G.g[y][x] = { c: hc };
        }
    }
    if (def.dwarf && def.beard) {
      G.set(16, headCY + 3, def.beard);
      G.set(16, headCY + 4, def.beard);
    }
  } else {
    drawFace(G, def, pose, headCY);
  }
  // 앞쪽 팔 + 손 + 무기
  const aF = pose.armF || 0;
  if (pose.atk === 1) {
    G.rect(13, bodyY - 1, 2, 4, def.arm);
    G.rect(13, bodyY - 2, 2, 2, SK.skin);
    weapon(G, def, 13, bodyY - 2, 'up');
  } else if (pose.atk === 2) {
    G.rect(13, bodyY + 2, 4, 2, def.arm);
    G.rect(17, bodyY + 2, 2, 2, SK.skin);
    weapon(G, def, 18, bodyY + 2, 'fwd');
  } else if (pose.eat) {
    G.rect(13, bodyY + 1, 2, 3, def.arm);
    G.rect(14, bodyY - 1 - (pose.eat > 1 ? 1 : 0), 2, 2, SK.skin);
  } else if (pose.pray) {
    G.rect(12, bodyY + 1, 3, 3, def.arm);
    G.rect(14, bodyY + 1, 2, 2, SK.skin);
  } else {
    G.rect(13, bodyY + 1 + aF, 2, 5, def.arm);
    G.rect(13, bodyY + 6 + aF, 2, 1, SK.skin);
    if (!sit) weapon(G, def, 14, bodyY + 6 + aF, 'rest');
  }
  return G;
}

/** 얼굴: 직업마다 눈·눈썹·코·입·주근깨·흉터·안경이 다르다 */
function drawFace(G: GridT, def: ClassDef, pose: Pose, headCY: number) {
  const ey = Math.round(headCY - 0.6);
  const F = def.face || {};
  const E = SK.eye;
  const BR = dk(def.brow || def.hair || '#5a3424', 0.3);
  const MO = '#a8404a';
  const eyes = (fn: (ex: number) => void) => {
    for (const ex of [10, 14]) fn(ex);
  };
  if (pose.sleep) {
    G.rect(10, ey + 1, 2, 1, E, 'eye');
    G.rect(14, ey + 1, 2, 1, E, 'eye');
  } else
    switch (F.eyes) {
      case 'dot':
        eyes((ex) => G.rect(ex + (ex === 10 ? 1 : 0), ey + 1, 1, 2, E, 'eye'));
        break;
      case 'calm':
        eyes((ex) => {
          G.rect(ex, ey, 2, 1, BR, 'eye');
          G.rect(ex + (ex === 10 ? 1 : 0), ey + 1, 1, 1, E, 'eye');
        });
        break;
      case 'squint':
        eyes((ex) => G.rect(ex, ey + 1, 2, 1, E, 'eye'));
        break;
      case 'sly':
        G.rect(11, ey + 1, 1, 2, E, 'eye');
        G.rect(14, ey + 2, 2, 1, E, 'eye');
        break;
      case 'happy':
        eyes((ex) => {
          G.set(ex, ey + 1, E, 'eye');
          G.set(ex + 1, ey, E, 'eye');
        });
        break;
      case 'round':
        eyes((ex) => {
          G.rect(ex, ey, 2, 2, E, 'eye');
          G.set(ex + 1, ey, '#ffffff', 'eye');
        });
        break;
      default:
        eyes((ex) => {
          G.rect(ex, ey, 2, 3, E, 'eye');
          G.set(ex + 1, ey, '#ffffff', 'eye');
          G.set(ex, ey + 2, '#5a3a6a', 'eye');
        });
    }
  if (!pose.sleep && F.brow === 'angry') {
    G.set(10, ey - 2, BR, 'flat');
    G.set(11, ey - 1, BR, 'flat');
    G.set(15, ey - 2, BR, 'flat');
    G.set(14, ey - 1, BR, 'flat');
  } else if (!pose.sleep && F.brow === 'bushy') {
    G.rect(9, ey - 1, 3, 1, BR, 'flat');
    G.rect(13, ey - 1, 4, 1, BR, 'flat');
  } else if (!pose.sleep && F.brow === 'up') {
    G.set(10, ey - 1, BR, 'flat');
    G.set(11, ey - 2, BR, 'flat');
    G.set(14, ey - 2, BR, 'flat');
    G.set(15, ey - 1, BR, 'flat');
  }
  if (F.nose === 'big') G.rect(12, ey + 1, 2, 2, SK.skin2, 'flat');
  else G.set(13, ey + 2, SK.skin2, 'flat');
  switch (F.mouth) {
    case 'grin':
      G.rect(11, ey + 4, 4, 1, MO, 'eye');
      G.rect(12, ey + 4, 2, 1, '#ffffff', 'eye');
      G.set(11, ey + 3, MO, 'eye');
      G.set(14, ey + 3, MO, 'eye');
      break;
    case 'smirk':
      G.rect(12, ey + 4, 2, 1, MO, 'eye');
      G.set(14, ey + 3, MO, 'eye');
      break;
    case 'o':
      G.rect(12, ey + 3, 2, 2, '#7a2a3a', 'eye');
      break;
    case 'flat':
      G.rect(12, ey + 4, 2, 1, dk(SK.skin2, 0.2), 'eye');
      break;
    case 'tiny':
      G.set(12, ey + 4, MO, 'eye');
      break;
    case 'none':
      break;
    default:
      G.rect(12, ey + 4, 2, 1, MO, 'eye');
  }
  if (F.blush !== false) {
    G.set(9, ey + 3, SK.blush, 'flat');
    G.set(16, ey + 3, SK.blush, 'flat');
  }
  if (F.freckle) {
    G.set(9, ey + 2, '#c27a5a', 'flat');
    G.set(10, ey + 3, '#c27a5a', 'flat');
    G.set(16, ey + 2, '#c27a5a', 'flat');
  }
  if (F.scar) {
    G.set(15, ey + 3, SK.skin2, 'flat');
    G.set(16, ey + 2, SK.skin2, 'flat');
  }
  if (F.glasses) {
    const gc = '#b08850';
    for (const ex of [9, 13]) {
      G.rect(ex + 1, ey - 1, 2, 1, gc, 'eye');
      G.rect(ex + 1, ey + 2, 2, 1, gc, 'eye');
      G.set(ex, ey, gc, 'eye');
      G.set(ex, ey + 1, gc, 'eye');
      G.set(ex + 3, ey, gc, 'eye');
      G.set(ex + 3, ey + 1, gc, 'eye');
    }
  }
  if (def.stache) {
    G.rect(12, headCY + 2.5, 6, 2, def.stache);
    G.set(11, headCY + 3.5, def.stache);
  }
  if (def.beard) {
    G.ell(13.5, headCY + 4.4, 4.8, 4, def.beard, null, (_x, y) => y >= headCY + 2.6);
    G.set(12, headCY + 2, dk(def.beard, 0.2), 'flat');
    G.set(15, headCY + 2, dk(def.beard, 0.2), 'flat');
  }
}

function weapon(G: GridT, def: ClassDef, hx: number, hy: number, mode: 'rest' | 'up' | 'fwd') {
  const w = def.weapon;
  if (!w) return;
  if (w === 'sword') {
    const bl = '#e9eef7';
    const hd = def.accent;
    if (mode === 'rest') {
      G.rect(hx, hy + 1, 1, 5, bl);
      G.rect(hx - 1, hy, 3, 1, hd);
    }
    if (mode === 'up') {
      G.line(hx - 1, hy, hx - 5, hy - 6, bl);
      G.rect(hx - 1, hy - 1, 2, 2, hd);
    }
    if (mode === 'fwd') {
      G.rect(hx + 1, hy, 6, 1, bl);
      G.rect(hx + 1, hy + 1, 6, 1, dk(bl, 0.15));
      G.rect(hx, hy - 1, 1, 3, hd);
    }
  }
  if (w === 'axe') {
    const h = '#7a5030';
    const b = '#c9d1dc';
    if (mode === 'rest') {
      G.rect(hx, hy - 2, 1, 7, h);
      G.rect(hx + 1, hy - 3, 2, 4, b);
    }
    if (mode === 'up') {
      G.line(hx, hy, hx - 4, hy - 6, h);
      G.rect(hx - 6, hy - 8, 3, 4, b);
    }
    if (mode === 'fwd') {
      G.rect(hx + 1, hy, 6, 1, h);
      G.rect(hx + 6, hy - 2, 3, 5, b);
    }
  }
  if (w === 'staff') {
    const h = '#8a5a34';
    const o = '#7fe6ff';
    if (mode === 'rest') {
      G.rect(hx, hy - 14, 1, 19, h);
      G.rect(hx - 1, hy - 16, 3, 3, o, 'flat');
    }
    if (mode === 'up') {
      G.line(hx, hy + 4, hx - 2, hy - 10, h);
      G.rect(hx - 3, hy - 12, 3, 3, o, 'flat');
    }
    if (mode === 'fwd') {
      G.rect(hx, hy, 7, 1, h);
      G.rect(hx + 7, hy - 1, 3, 3, o, 'flat');
    }
  }
  if (w === 'dagger') {
    const bl = '#e9eef7';
    if (mode === 'rest') G.rect(hx, hy + 1, 1, 3, bl);
    if (mode === 'up') G.rect(hx - 1, hy - 3, 1, 3, bl);
    if (mode === 'fwd') G.rect(hx + 1, hy, 4, 1, bl);
  }
  if (w === 'book') {
    if (mode === 'rest') {
      G.rect(hx - 1, hy - 2, 3, 4, '#b0412f');
      G.set(hx, hy - 1, '#f2c447', 'flat');
    } else G.rect(hx - 1, hy - 3, 4, 4, '#b0412f');
  }
}

/** 잠든 모습: 베개 위 머리 + 이불 */
function drawSleep(def: ClassDef, breath: number): GridT {
  const G = Grid(26, 12);
  G.ell(5.5, 6, 4.6, 4.4, SK.skin);
  if (def.hair && def.style !== 'bald' && !def.helm && !def.hood) G.ell(4.4, 5, 4.4, 3.8, def.hair, null, (x, y) => x < 6 || y < 3);
  if (def.hood) G.ell(4.4, 5.5, 4.8, 4.4, def.hood, null, (x, y) => x < 5 || y < 3);
  if (def.helm || def.dwarf) G.ell(4.4, 5, 4.4, 3.8, def.helm || def.hair, null, (x, y) => x < 5 || y < 3);
  if (def.beard) G.ell(8, 8, 3, 2.8, def.beard, null, (_x, y) => y >= 7);
  G.rect(6, 6, 2, 1, SK.eye, 'eye');
  const b = breath ? 0 : 1;
  G.rect(9, 3 + b, 16, 9 - b, def.cloth);
  G.rect(9, 3 + b, 16, 1, lt(def.cloth, 0.35));
  G.rect(9, 6 + b, 16, 1, def.accent);
  return G;
}

export interface CharFrames {
  def: ClassDef;
  idle: HTMLCanvasElement[];
  walk: HTMLCanvasElement[];
  walkB: HTMLCanvasElement[];
  idleB: HTMLCanvasElement[];
  sit: HTMLCanvasElement[];
  atk: HTMLCanvasElement[];
  pray: HTMLCanvasElement[];
  sleep: HTMLCanvasElement[];
}

/** 직업 하나의 모든 프레임: 앞 걷기4·뒤 걷기4·대기2·뒤 대기2·앉기2·공격2·기도/밭일2 */
export function buildChar(key: ClassKey): CharFrames {
  const d = CLASSES[key];
  const R = (g: GridT) => g.render();
  return {
    def: d,
    idle: [R(drawChar(d, {})), R(drawChar(d, { bob: 1 }))],
    walk: [
      R(drawChar(d, { lx: -1, rx: 1, armF: 1, armB: -1 })),
      R(drawChar(d, { bob: -1 })),
      R(drawChar(d, { lx: 1, rx: -1, armF: -1, armB: 1 })),
      R(drawChar(d, { bob: -1 })),
    ],
    walkB: [
      R(drawChar(d, { back: 1, lx: -1, rx: 1, armF: 1, armB: -1 })),
      R(drawChar(d, { back: 1, bob: -1 })),
      R(drawChar(d, { back: 1, lx: 1, rx: -1, armF: -1, armB: 1 })),
      R(drawChar(d, { back: 1, bob: -1 })),
    ],
    idleB: [R(drawChar(d, { back: 1 })), R(drawChar(d, { back: 1, bob: 1 }))],
    sit: [R(drawChar(d, { sit: 1, eat: 1 })), R(drawChar(d, { sit: 1, eat: 2 }))],
    atk: [R(drawChar(d, { atk: 1 })), R(drawChar(d, { atk: 2 }))],
    pray: [R(drawChar(d, { pray: 1 })), R(drawChar(d, { pray: 1, bob: 1 }))],
    sleep: [R(drawSleep(d, 0)), R(drawSleep(d, 1))],
  };
}

const CACHE: Partial<Record<ClassKey, CharFrames>> = {};
export function charFrames(key: ClassKey): CharFrames {
  return (CACHE[key] ??= buildChar(key));
}
