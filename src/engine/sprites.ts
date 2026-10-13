// 캐릭터 도트 생성 (24×33) — reference/core.js의 drawChar / buildChar 이식
import { CLASSES, type ClassDef, type ClassKey } from '../data/classes';
import { dk, Grid, lt, ramp, type GridT } from './pixel';
import { CONFIG } from '../data/config';
import { canvasAlive, Lru } from './lru';
import { drawChar2, drawLying2, drawRoll2, type Dot2, type Pose2 } from './sprites2';
import { vis } from '../world/visual';

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
  /** 리마스터: 표정 (아픔 · 기합) · 공격 3=휘두르는 잔상 4=거두기 · 시전 1~3 · 피격(뒤로 젖힘) · 긴 머리 끝 늦게 따라오기 */
  face?: 'hurt' | 'shout';
  cast?: number;
  hurt?: number;
  hairLag?: number;
}

function drawChar(def: ClassDef, pose: Pose = {}): GridT {
  const SKN = def.skin ?? SK.skin;
  const SKN2 = def.skin ? dk(def.skin, 0.18) : SK.skin2;
  const G = Grid(24, 33, 1, 3);
  const bob = pose.bob || 0;
  const dw = def.dwarf;
  const sit = pose.sit;
  const headCY = (dw ? 12.5 : 10) + bob + (sit ? 3 : 0);
  const bodyY = (dw ? 17 : 15) + bob + (sit ? 3 : 0);
  const legY = dw ? 24 : 22;
  // 피격: 머리·몸이 뒤로 젖힌다
  const cx = 10.5 - (pose.hurt ? 1 : 0);
  // 사제 망토 · 화살통 (몸 뒤)
  if (def.cape && !sit) {
    G.rect(Math.round(cx - 5), bodyY, 3, 29 - bodyY, def.cape);
    G.rect(Math.round(cx - 5), bodyY - 1, 10, 2, def.cape);
  }
  if (def.quiver && !sit) {
    G.rect(4, bodyY - 4, 3, 9, '#7a4a2a');
    G.rect(4, bodyY + 4, 3, 1, '#5a3420');
    G.set(4, bodyY - 5, '#efe2c6', 'flat');
    G.set(6, bodyY - 6, '#e85a4a', 'flat');
    G.set(5, bodyY - 5, '#efe2c6', 'flat');
  }
  // 방패 (뒤)
  if (def.shield && !sit) {
    // 리마스터: 큰 방패 (테두리 금속 · 가운데 문장)
    G.ell(5.2, bodyY + 4, 4, 5, '#9aa6be', 'base');
    G.ell(5.2, bodyY + 4, 2.6, 3.6, def.cloth, 'base');
    G.rect(5, bodyY + 2, 1, 5, def.accent, 'flat');
    G.rect(3, bodyY + 4, 5, 1, def.accent, 'flat');
  }
  // 긴 머리 (뒤)
  // 긴 머리 끝이 걸을 때 1px 늦게 따라온다
  if (def.style === 'long') {
    G.rect(5, headCY, 5, 8, def.hair);
    G.rect(5 - (pose.hairLag ?? 0), headCY + 8, 5, 2, def.hair);
  }
  if (def.style === 'braid') {
    G.rect(5, headCY + 2, 3, 6, def.hair);
    G.ell(6, headCY + 9, 1.6, 1.6, def.hair);
  }
  // EASTER §5: 양갈래 — 양옆으로 묶은 머리
  if (def.style === 'twin') {
    G.ell(4, headCY + 2, 1.8, 2.6, def.hair);
    G.ell(17.5, headCY + 2, 1.8, 2.6, def.hair);
    G.set(4, headCY + 5, def.hair);
    G.set(18, headCY + 5, def.hair);
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
  G.rect(6, bodyY + 6 + aB, 2, 1, SKN2);
  // 도적: 뒤쪽 손에도 단검 (쌍단검)
  if (def.dual && !sit && !pose.cast) {
    G.rect(6, bodyY + 7 + aB, 1, 4, '#e9eef7');
    G.rect(5, bodyY + 7 + aB, 3, 1, '#8a6040');
  }
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
    // EASTER §5: 어깨에 걸친 흰 수건 (2px)
    if (def.towel) {
      G.rect(Math.round(cx - bw / 2), bodyY, bw, 1, def.towel, 'flat');
      G.rect(Math.round(cx + bw / 2) - 2, bodyY + 1, 2, 2, def.towel, 'flat');
    }
    if (!def.robe) G.rect(Math.round(cx - bw / 2), bodyY + (dw ? 6 : 5), bw, 1, def.accent);
    if (def.weapon === 'sword') {
      G.rect(10, bodyY, 3, 6, '#2f57b0');
      G.set(11, bodyY + 2, def.accent, 'flat');
    }
  }
  // 머리
  G.ell(cx + 0.6, headCY - 0.2, 6.2, 5.6, SKN);
  if (def.elf) G.tri(5, headCY - 1, 6.5, headCY + 1.5, 2.5, headCY - 3, SKN);
  if (def.style === 'short' || def.style === 'long' || def.style === 'braid' || def.style === 'twin') {
    G.ell(cx + 0.3, headCY - 1.9, 6.7, 4.9, def.hair, null, (x, y) => y < headCY - 1.6 || (x < cx - 2.4 && y < headCY + 3.5));
    G.rect(12, headCY - 3.6, 5, 1, def.hair);
    G.set(16, headCY - 2.6, def.hair);
    G.set(12, headCY - 2.6, def.hair);
    // 머리카락 하이라이트 띠 1줄
    if (!def.hood && !def.helm && !def.hat) {
      G.rect(Math.round(cx - 3), Math.round(headCY - 5.6), 5, 1, ramp(def.hair, 1), 'flat');
      G.set(Math.round(cx + 2), Math.round(headCY - 4.6), ramp(def.hair, 1), 'flat');
    }
  }
  if (def.style === 'bald') {
    G.rect(5, headCY - 1, 2, 4, def.hair);
    G.ell(cx, headCY - 4, 3, 1.2, lt(SKN, 0.15));
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
  // EASTER §5: 베레모 (납작 · 한쪽으로 기울게)
  if (def.hat === 'beret') {
    G.ell(cx + 1.2, headCY - 4.6, 6.6, 2.2, def.hatc!);
    G.set(Math.round(cx + 1), Math.round(headCY - 7.4), def.hatc!);
    G.rect(Math.round(cx - 4), Math.round(headCY - 3), 10, 1, dk(def.hatc!, 0.2));
  }
  // 베타: 평가단 — 챙 넓은 모자 + 깃털
  if (def.hat === 'feather') {
    G.rect(3, headCY - 5, 16, 2, def.hatc!);
    G.rect(6, headCY - 9, 10, 4, def.hatc!);
    G.rect(6, headCY - 6, 10, 1, def.accent, 'flat');
    for (const [x, y] of [[15, -10], [16, -11], [17, -12], [18, -13], [16, -10], [17, -11], [18, -12]]) G.set(x, headCY + y, '#f3ead3');
    G.set(19, headCY - 14, '#e8a23a');
  }
  if (pose.back) {
    // 뒷모습: 얼굴 자리를 머리카락(또는 두건)으로 덮는다
    if (def.style !== 'bald') {
      const hc = def.hood || def.hair;
      for (let y = 0; y < G.h; y++)
        for (let x = 0; x < G.w; x++) {
          const p = G.g[y][x];
          if (p && (p.c === SKN || (def.hood && p.c === def.hair)) && y - 3 < headCY + 4) G.g[y][x] = { c: hc };
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
  if (pose.cast) {
    // 시전: 두 손을 들고 손에 빛
    G.rect(13, bodyY - 2, 2, 4, def.arm);
    G.rect(13, bodyY - 4, 2, 2, SKN);
    const gl = ramp(def.accent, 2);
    const r = pose.cast;
    for (const [dx, dy] of [[0, -2], [1, -2], [-1, -1], [2, -1], [-1, 0], [2, 0], [0, 1], [1, 1]].slice(0, 4 + r * 2)) G.set(13 + dx, bodyY - 4 + dy - (r > 1 ? 1 : 0), dx === 0 || dx === 1 ? '#ffffff' : gl, 'flat');
    if (r === 3) for (const [dx, dy] of [[-2, -4], [3, -4], [-3, -1], [4, -1]]) G.set(13 + dx, bodyY - 4 + dy, gl, 'flat');
  } else if (pose.atk === 1) {
    G.rect(13, bodyY - 1, 2, 4, def.arm);
    G.rect(13, bodyY - 2, 2, 2, SKN);
    weapon(G, def, 13, bodyY - 2, 'up');
  } else if (pose.atk === 3) {
    // 휘두르는 순간: 무기는 가운데 · 지나간 자리에 잔상(스미어) 1프레임
    G.rect(13, bodyY, 3, 3, def.arm);
    G.rect(16, bodyY, 2, 2, SKN);
    const sm = '#fff3d6';
    for (let a = 0; a <= 8; a++) {
      const t = (a / 8) * (Math.PI / 2);
      G.set(Math.round(14 + Math.sin(t) * 8), Math.round(bodyY - Math.cos(t) * 8), a % 3 === 2 ? ramp(sm, -1) : sm, 'flat');
      G.set(Math.round(14 + Math.sin(t) * 7), Math.round(bodyY - Math.cos(t) * 7), sm, 'flat');
    }
    weapon(G, def, 17, bodyY, 'mid');
  } else if (pose.atk === 4) {
    G.rect(13, bodyY + 3, 3, 2, def.arm);
    G.rect(16, bodyY + 4, 2, 2, SKN);
    weapon(G, def, 17, bodyY + 4, 'low');
  } else if (pose.atk === 2) {
    G.rect(13, bodyY + 2, 4, 2, def.arm);
    G.rect(17, bodyY + 2, 2, 2, SKN);
    weapon(G, def, 18, bodyY + 2, 'fwd');
  } else if (pose.eat) {
    G.rect(13, bodyY + 1, 2, 3, def.arm);
    G.rect(14, bodyY - 1 - (pose.eat > 1 ? 1 : 0), 2, 2, SKN);
  } else if (pose.pray) {
    G.rect(12, bodyY + 1, 3, 3, def.arm);
    G.rect(14, bodyY + 1, 2, 2, SKN);
  } else {
    G.rect(13, bodyY + 1 + aF, 2, 5, def.arm);
    G.rect(13, bodyY + 6 + aF, 2, 1, SKN);
    if (!sit) weapon(G, def, 14, bodyY + 6 + aF, 'rest', ((pose.lx ?? 0) + (pose.rx ?? 0) + 8) % 2);
  }
  return G;
}

/** 얼굴: 직업마다 눈·눈썹·코·입·주근깨·흉터·안경이 다르다 */
function drawFace(G: GridT, def: ClassDef, pose: Pose, headCY: number) {
  const SKN2 = def.skin ? dk(def.skin, 0.18) : SK.skin2;
  const ey = Math.round(headCY - 0.6) - (pose.hurt ? 0 : 0);
  // 리마스터 표정: 공격 = 기합 · 피격 = 아픔 (눈·눈썹·입을 바꾼다)
  const F = pose.face === 'hurt' ? { ...def.face, eyes: 'hurt' as const, mouth: 'o' as const, brow: 'up' as const } : pose.face === 'shout' ? { ...def.face, brow: 'angry' as const, mouth: 'o' as const } : def.face || {};
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
    switch (F.eyes as string) {
      case 'hurt':
        // > <
        G.set(10, ey, E, 'eye');
        G.set(11, ey + 1, E, 'eye');
        G.set(10, ey + 2, E, 'eye');
        G.set(15, ey, E, 'eye');
        G.set(14, ey + 1, E, 'eye');
        G.set(15, ey + 2, E, 'eye');
        break;
      case 'dot':
        // 리마스터: 2×2 + 흰 하이라이트 1px
        eyes((ex) => {
          G.rect(ex, ey + 1, 2, 2, E, 'eye');
          G.set(ex + 1, ey + 1, '#ffffff', 'eye');
        });
        break;
      case 'calm':
        eyes((ex) => {
          G.rect(ex, ey, 2, 1, BR, 'eye');
          G.rect(ex, ey + 1, 2, 1, E, 'eye');
          G.set(ex + 1, ey + 1, '#ffffff', 'eye');
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
  if (F.nose === 'big') G.rect(12, ey + 1, 2, 2, SKN2, 'flat');
  else G.set(13, ey + 2, SKN2, 'flat');
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
      G.rect(12, ey + 4, 2, 1, dk(SKN2, 0.2), 'eye');
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
    G.set(15, ey + 3, SKN2, 'flat');
    G.set(16, ey + 2, SKN2, 'flat');
  }
  if (F.paint) G.set(16, ey + 2, F.paint, 'flat');
  if (F.glasses) {
    const gc = def.glassesColor ?? '#b08850';
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

function weapon(G: GridT, def: ClassDef, hx: number, hy: number, mode: 'rest' | 'up' | 'fwd' | 'mid' | 'low', frame = 0) {
  const w = def.weapon;
  if (!w) return;
  const wc = def.weaponColor;
  // EASTER §5: 개척자 소품 — 등불 · 바람개비(두 장 번갈아) · 붓
  if (w === 'lantern') {
    G.rect(hx, hy, 1, 2, '#5a3a2a');
    G.rect(hx - 1, hy + 2, 3, 4, '#3a2a20');
    G.rect(hx, hy + 3, 1, 2, wc ?? '#ffd36b', 'flat');
    G.set(hx, hy + 6, '#3a2a20');
    return;
  }
  if (w === 'pinwheel') {
    G.rect(hx, hy - 6, 1, 8, '#8a6040');
    const c1 = wc ?? '#e8503c';
    const c2 = '#ffd36b';
    const cy = hy - 7;
    if (frame) {
      G.rect(hx - 2, cy - 1, 2, 2, c1, 'flat');
      G.rect(hx + 1, cy + 1, 2, 2, c1, 'flat');
      G.rect(hx + 1, cy - 2, 2, 2, c2, 'flat');
      G.rect(hx - 2, cy + 1, 2, 2, c2, 'flat');
    } else {
      G.rect(hx - 1, cy - 3, 2, 2, c1, 'flat');
      G.rect(hx, cy + 2, 2, 2, c1, 'flat');
      G.rect(hx + 2, cy - 1, 2, 2, c2, 'flat');
      G.rect(hx - 3, cy, 2, 2, c2, 'flat');
    }
    G.set(hx, cy, '#ffffff', 'flat');
    return;
  }
  if (w === 'brush') {
    G.rect(hx, hy - 5, 1, 7, '#8a6040');
    G.rect(hx, hy - 7, 1, 2, '#e8e2d4');
    G.set(hx, hy - 8, wc ?? '#ef6f9a', 'flat');
    return;
  }
  if (w === 'sword') {
    const bl = wc ?? '#e9eef7';
    const hd = def.accent;
    if (mode === 'rest') {
      G.rect(hx, hy + 1, 1, 7, bl);
      G.rect(hx + 1, hy + 1, 1, 6, ramp(bl, -1));
      G.rect(hx - 1, hy, 4, 1, hd);
    }
    if (mode === 'mid') {
      G.line(hx, hy, hx + 5, hy - 5, bl);
      G.line(hx + 1, hy, hx + 6, hy - 5, ramp(bl, -1));
      G.rect(hx - 1, hy - 1, 2, 2, hd);
    }
    if (mode === 'low') {
      G.line(hx, hy, hx + 6, hy + 3, bl);
      G.rect(hx - 1, hy - 1, 2, 2, hd);
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
    const b = wc ?? '#c9d1dc';
    if (mode === 'rest') {
      // 리마스터: 큰 양날 도끼
      G.rect(hx, hy - 7, 1, 13, h);
      G.rect(hx + 1, hy - 8, 3, 6, b);
      G.rect(hx + 4, hy - 7, 1, 4, ramp(b, -1));
      G.rect(hx - 2, hy - 7, 2, 4, b);
    }
    if (mode === 'mid') {
      G.line(hx, hy, hx + 5, hy - 5, h);
      G.rect(hx + 4, hy - 9, 4, 5, b);
    }
    if (mode === 'low') {
      G.line(hx, hy, hx + 5, hy + 2, h);
      G.rect(hx + 5, hy + 1, 4, 4, b);
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
  if (w === 'staff' || w === 'holy') {
    const h = w === 'holy' ? '#e8d4a0' : '#8a5a34';
    const o = wc ?? (w === 'holy' ? '#fff3b0' : '#7fe6ff');
    // 마법사 보석은 빛난다 (밝은 점 + 둘레 빛) · 사제는 해 모양 머리
    const glow = (x: number, y: number) => {
      G.set(x + 1, y + 1, '#ffffff', 'flat');
      for (const [dx, dy] of [[1, -1], [-1, 1], [3, 1], [1, 3]]) G.set(x + dx, y + dy, ramp(o, 1), 'flat');
    };
    if (mode === 'rest') {
      G.rect(hx, hy - 14, 1, 19, h);
      G.rect(hx - 1, hy - 16, 3, 3, o, 'flat');
      glow(hx - 1, hy - 16);
      if (w === 'holy') G.rect(hx - 2, hy - 15, 5, 1, '#e0a93a', 'flat');
    }
    if (mode === 'mid') {
      G.line(hx, hy + 2, hx + 4, hy - 9, h);
      G.rect(hx + 3, hy - 12, 3, 3, o, 'flat');
      glow(hx + 3, hy - 12);
    }
    if (mode === 'low') {
      G.rect(hx, hy, 7, 1, h);
      G.rect(hx + 7, hy - 1, 3, 3, o, 'flat');
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
  if (w === 'bow') {
    // 사냥꾼: 큰 활 (활대 + 시위)
    const wd = wc ?? '#9a6a3c';
    const sx = mode === 'rest' ? hx + 1 : hx + 2;
    const top = mode === 'rest' ? hy - 9 : hy - 8;
    for (let i = 0; i <= 14; i++) {
      const bend = Math.round(Math.sin((i / 14) * Math.PI) * 2);
      G.set(sx + bend, top + i, wd);
    }
    G.rect(sx, top, 1, 15, '#efe2c6', 'flat');
    if (mode === 'mid' || mode === 'fwd') G.rect(sx - 4, top + 7, 6, 1, '#d8c8a8', 'flat');
    return;
  }
  if (w === 'dagger') {
    const bl = wc ?? '#e9eef7';
    if (mode === 'mid') G.line(hx, hy, hx + 3, hy - 3, bl);
    if (mode === 'low') G.rect(hx + 1, hy, 4, 1, bl);
    if (mode === 'rest') G.rect(hx, hy + 1, 1, 4, bl);
    if (mode === 'up') G.rect(hx - 1, hy - 3, 1, 3, bl);
    if (mode === 'fwd') G.rect(hx + 1, hy, 4, 1, bl);
  }
  if (w === 'book') {
    const bc = wc ?? '#b0412f';
    if (mode === 'rest') {
      G.rect(hx - 1, hy - 2, 3, 4, bc);
      G.set(hx, hy - 1, '#f2c447', 'flat');
    } else G.rect(hx - 1, hy - 3, 4, 4, bc);
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

/** 전투용 동작 프레임 (리마스터): 대기 3 · 걷기 6(앞·뒤) · 공격 4(잔상 1) · 구르기 4 · 시전 3 · 피격 1 · 쓰러짐 3 */
export interface CombatFrames {
  idle: HTMLCanvasElement[];
  idleB: HTMLCanvasElement[];
  walk: HTMLCanvasElement[];
  walkB: HTMLCanvasElement[];
  atk: HTMLCanvasElement[];
  roll: HTMLCanvasElement[];
  cast: HTMLCanvasElement[];
  hurt: HTMLCanvasElement[];
  die: HTMLCanvasElement[];
  /** HERODOT: 대기 중 눈 깜빡임 1프레임 (새 도트만 · 없으면 깜빡이지 않음) */
  blink?: HTMLCanvasElement;
}

export interface CharFrames {
  def: ClassDef;
  /** 전투용 (처음 쓸 때 만든다) */
  cb: () => CombatFrames;
  idle: HTMLCanvasElement[];
  walk: HTMLCanvasElement[];
  walkB: HTMLCanvasElement[];
  idleB: HTMLCanvasElement[];
  sit: HTMLCanvasElement[];
  atk: HTMLCanvasElement[];
  pray: HTMLCanvasElement[];
  sleep: HTMLCanvasElement[];
  /** HERODOT: 대기 중 눈 깜빡임 1프레임 (새 도트만) */
  blink?: HTMLCanvasElement;
}

/** 직업 하나의 모든 프레임: 앞 걷기4·뒤 걷기4·대기2·뒤 대기2·앉기2·공격2·기도/밭일2 */
export function buildChar(key: ClassKey): CharFrames {
  return buildFrom(CLASSES[key]);
}

/** 정의 하나로 모든 프레임 */
export function buildFrom(d: ClassDef): CharFrames {
  const k2 = dot2Of(d);
  if (k2) return buildFrom2(d, k2);
  const R = (g: GridT) => g.render();
  let cbf: CombatFrames | null = null;
  return {
    def: d,
    cb: () => (cbf ??= buildCombat(d)),
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
    atk: [R(drawChar(d, { atk: 1, face: 'shout' })), R(drawChar(d, { atk: 2, face: 'shout' }))],
    pray: [R(drawChar(d, { pray: 1 })), R(drawChar(d, { pray: 1, bob: 1 }))],
    sleep: [R(drawSleep(d, 0)), R(drawSleep(d, 1))],
  };
}

/** 전투 프레임: 걷기 6단계 (다리·팔·몸 흔들림·머리 끝 늦게) */
const WALK6: Pose[] = [
  { lx: -1, rx: 1, armF: 1, armB: -1, hairLag: 0 },
  { lx: -1, rx: 1, bob: -1, armF: 1, armB: -1, hairLag: 1 },
  { bob: -1, hairLag: 1 },
  { lx: 1, rx: -1, armF: -1, armB: 1, hairLag: 0 },
  { lx: 1, rx: -1, bob: -1, armF: -1, armB: 1, hairLag: 1 },
  { bob: -1, hairLag: 1 },
];
function buildCombat(d: ClassDef): CombatFrames {
  const R = (g: GridT) => g.render();
  return {
    // 숨쉬기 3프레임
    idle: [R(drawChar(d, {})), R(drawChar(d, { bob: 1 })), R(drawChar(d, { bob: 1, armF: 1, armB: 1 }))],
    idleB: [R(drawChar(d, { back: 1 })), R(drawChar(d, { back: 1, bob: 1 })), R(drawChar(d, { back: 1, bob: 1, armF: 1 }))],
    walk: WALK6.map((p) => R(drawChar(d, p))),
    walkB: WALK6.map((p) => R(drawChar(d, { ...p, back: 1 }))),
    // 공격 4: 들어 올림 → 휘두름(잔상) → 내려침 → 거두기 · 기합 표정
    atk: [R(drawChar(d, { atk: 1, face: 'shout' })), R(drawChar(d, { atk: 3, face: 'shout' })), R(drawChar(d, { atk: 2, face: 'shout' })), R(drawChar(d, { atk: 4 }))],
    roll: [0, 1, 2, 3].map((i) => R(drawRoll(d, i))),
    cast: [1, 2, 3].map((c) => R(drawChar(d, { cast: c, face: 'shout' }))),
    hurt: [R(drawChar(d, { hurt: 1, face: 'hurt', armF: -1, armB: -1 }))],
    die: [R(drawChar(d, { sit: 1, face: 'hurt' })), R(drawChar(d, { sit: 1, bob: 2, face: 'hurt' })), R(drawLying(d))],
  };
}

/** 구르기: 몸을 웅크린 공 · 머리와 발이 돌아간다 (4프레임) */
function drawRoll(def: ClassDef, i: number): GridT {
  const G = Grid(24, 33, 1, 3);
  const cx = 10.5;
  const cy = 22;
  G.ell(cx, cy, 6, 5.2, def.cloth);
  G.rect(Math.round(cx - 5), cy, 10, 1, def.accent);
  const a = (i * Math.PI) / 2 - Math.PI / 2;
  const hx = cx + Math.cos(a) * 3.4;
  const hy = cy + Math.sin(a) * 3;
  G.ell(hx, hy, 2.8, 2.6, def.hood || def.helm || (def.style === 'bald' ? SK.skin : def.hair));
  G.ell(cx - Math.cos(a) * 3.6, cy - Math.sin(a) * 3.2, 2, 1.6, def.boots);
  G.ell(cx + Math.cos(a + Math.PI / 2) * 3.8, cy + Math.sin(a + Math.PI / 2) * 3.2, 1.4, 1.4, SK.skin);
  return G;
}

/** 쓰러짐 마지막: 땅에 누운 모습 (가로 33×14) */
function drawLying(def: ClassDef): GridT {
  const G = Grid(33, 14);
  G.rect(8, 6, 14, 5, def.cloth);
  G.rect(8, 9, 14, 1, def.accent);
  G.rect(21, 7, 6, 2, def.pants);
  G.rect(26, 6, 3, 4, def.boots);
  G.ell(5, 7.5, 3.6, 3.4, SK.skin);
  if (def.style !== 'bald') G.ell(4.2, 6.2, 3.6, 2.8, def.hood || def.helm || def.hair, null, (_x, y) => y < 7);
  G.set(6, 7, SK.eye, 'eye');
  G.set(6, 9, SK.eye, 'eye');
  return G;
}

// ───────── HERODOT 리마스터 2 (heroDotV2 · 1단계 기사·사제·도적) ─────────

/** 새 도트로 그릴 직업인가: 플래그(모두) 또는 「새 화면 미리 보기」(이 기기) · 개발 빌드에선 비교용으로 끌 수 있다 */
function dot2Of(d: ClassDef): Dot2 | null {
  if (!d.dot2 || !vis('heroDotV2')) return null;
  if (import.meta.env.DEV)
    try {
      if (localStorage.getItem('legacy-of-adventure-heroDotOff') === 'true') return null;
    } catch {
      /* 저장소 없음 */
    }
  return d.dot2;
}

/** 마을 걷기 4: 벌림 → 지나감(들썩·발 들림) → 반대로 벌림 → 지나감 · 망토 끝은 앞 프레임 높이(1프레임 늦게) */
const WALK4_2: Pose2[] = [
  { lx: -1, rx: 1, armF: 1, armB: -1, trail: 1, lag: -1 },
  { bob: -1, liftR: 1, trail: 1, lag: 0, tw: 1 },
  { lx: 1, rx: -1, armF: -1, armB: 1, trail: 1, lag: -1 },
  { bob: -1, liftL: 1, trail: 1, lag: 0 },
];
/** 전투 걷기 6 */
const WALK6_2: Pose2[] = [
  { lx: -1, rx: 1, armF: 1, armB: -1, trail: 1, lag: -1 },
  { lx: -1, rx: 1, bob: -1, armF: 1, armB: -1, trail: 1, lag: 0 },
  { bob: -1, liftR: 1, trail: 1, lag: -1, tw: 1 },
  { lx: 1, rx: -1, armF: -1, armB: 1, trail: 1, lag: -1 },
  { lx: 1, rx: -1, bob: -1, armF: -1, armB: 1, trail: 1, lag: 0 },
  { bob: -1, liftL: 1, trail: 1, lag: -1 },
];

function buildFrom2(d: ClassDef, k: Dot2): CharFrames {
  const R = (p: Pose2) => drawChar2(d, k, p, weapon).render();
  let cbf: CombatFrames | null = null;
  return {
    def: d,
    cb: () => (cbf ??= buildCombat2(d, k)),
    idle: [R({}), R({ bob: 1, tw: 1 })],
    walk: WALK4_2.map(R),
    walkB: WALK4_2.map((p) => R({ ...p, back: 1 })),
    idleB: [R({ back: 1 }), R({ back: 1, bob: 1 })],
    sit: [R({ sit: 1, eat: 1 }), R({ sit: 1, eat: 2 })],
    atk: [R({ atk: 1, face: 'shout' }), R({ atk: 2, face: 'shout' })],
    pray: [R({ pray: 1 }), R({ pray: 1, bob: 1 })],
    sleep: [drawSleep(d, 0).render(), drawSleep(d, 1).render()],
    blink: R({ blink: 1 }),
  };
}

function buildCombat2(d: ClassDef, k: Dot2): CombatFrames {
  const R = (p: Pose2) => drawChar2(d, k, p, weapon).render();
  return {
    idle: [R({}), R({ bob: 1, tw: 1 }), R({ bob: 1, armF: 1, armB: 1 })],
    idleB: [R({ back: 1 }), R({ back: 1, bob: 1 }), R({ back: 1, bob: 1, armF: 1 })],
    walk: WALK6_2.map(R),
    walkB: WALK6_2.map((p) => R({ ...p, back: 1 })),
    // 공격 4: 들어 올림 → 휘두름(깔끔한 호) → 내려침 → 거두기
    atk: [R({ atk: 1, face: 'shout' }), R({ atk: 3, face: 'shout' }), R({ atk: 2, face: 'shout' }), R({ atk: 4 })],
    roll: [0, 1, 2, 3].map((i) => drawRoll2(d, k, i).render()),
    cast: [1, 2, 3].map((c) => R({ cast: c, face: 'shout' })),
    hurt: [R({ hurt: 1, face: 'hurt', armF: -1, armB: -1 })],
    die: [R({ sit: 1, face: 'hurt' }), R({ sit: 1, bob: 2, face: 'hurt' }), drawLying2(d, k).render()],
    blink: R({ blink: 1, bob: 1 }),
  };
}

const CACHE: Record<string, CharFrames> = {};
export function charFrames(key: ClassKey): CharFrames {
  return (CACHE[key] ??= buildChar(key));
}
/** 렌더 메모리: 손님마다 생기는 겉모습은 상한까지만 (오래 안 본 손님 것부터 버린다 · 다시 오면 다시 만든다) */
const LOOKS = new Lru<string, CharFrames>(CONFIG.render.lookCacheMax);
export const lookMem = () => ({ n: LOOKS.size, cap: LOOKS.cap, evicted: LOOKS.evicted });

/** 손님마다 다른 겉모습(종족·얼굴·머리색·무기) — key가 같으면 다시 만들지 않는다 */
let onNew: ((f: CharFrames) => void) | null = null;
export function onNewFrames(fn: (f: CharFrames) => void) {
  onNew = fn;
}
export function framesFor(key: string, def: ClassDef): CharFrames {
  let f: CharFrames | undefined = CACHE[key] ?? LOOKS.get(key);
  // 삼성 인터넷이 메모리 부족 때 캔버스를 잃으면(폭 0) 다시 만든다
  if (f && !canvasAlive(f.idle[0])) {
    LOOKS.delete(key);
    delete CACHE[key];
    f = undefined;
  }
  if (!f) {
    f = LOOKS.set(key, buildFrom(def));
    onNew?.(f);
  }
  return f;
}
