// HERODOT 리마스터 2 — 기사·사제·도적 도트 (플래그 heroDotV2 · 꺼지면 sprites.ts 예전 그림 그대로)
//  같은 24×33 격자 · 같은 동작 · 같은 render() 명암 3단 + 부위색 외곽선. 머리를 키우고(약 12px · 2.5등신) 직업 실루엣을 가른다.
//  좌표는 예전 drawChar와 같은 그리기 좌표 (Grid(24,33,1,3) · 발바닥 = 27줄)
import type { ClassDef } from '../data/classes';
import { dk, Grid, lt, mix, ramp, type GridT } from './pixel';

export type Dot2 = 'knight' | 'cleric' | 'rogue';

export interface Pose2 {
  /** 다리: 뒤(왼쪽) · 앞(오른쪽) 다리 가로 이동 · 들린 발 */
  lx?: number;
  rx?: number;
  liftL?: number;
  liftR?: number;
  bob?: number;
  armF?: number;
  armB?: number;
  sit?: number;
  eat?: number;
  pray?: number;
  back?: number;
  atk?: number;
  cast?: number;
  hurt?: number;
  face?: 'hurt' | 'shout';
  blink?: number;
  /** 망토 끝: 걸을 때 뒤로 끌림(px) · 1프레임 늦은 몸 높이 */
  trail?: number;
  lag?: number;
}

const SKIN = '#f2c49b';
const EYE = '#2a1a2e';
const IRIS = '#5a3a6a';
const BLUSH = '#ec8f86';
const STEEL = '#aab3c4';
const PLUME = '#d8392e';
const WOOD = '#a0602e';
const RIM = '#8d97aa';
const WHITE = '#ffffff';
const VEIL = '#eef0f8';
const SHAFT = '#9a6436';

/** 무기 그리기 (예전 weapon() — 도끼·활 같은 다른 무기는 예전 모양을 빌린다) */
export type WeaponFn = (G: GridT, def: ClassDef, hx: number, hy: number, mode: 'rest' | 'up' | 'fwd' | 'mid' | 'low', frame?: number) => void;

export function drawChar2(def: ClassDef, kind: Dot2, pose: Pose2, oldWeapon: WeaponFn): GridT {
  const G = Grid(24, 33, 1, 3);
  const SKN = def.skin ?? SKIN;
  const SKN2 = def.skin ? dk(def.skin, 0.18) : '#d99a78';
  const dw = def.dwarf ? 2 : 0;
  const sit = pose.sit ? 3 : 0;
  const b = (pose.bob ?? 0) + sit + dw;
  const lean = pose.hurt ? -1 : 0;
  const hx = 11 + lean;
  const hy = 6.5 + b;
  const by = 12 + b;
  const legTop = 21 + (pose.bob ?? 0) + sit;
  const back = !!pose.back;
  const robe = !!def.robe;
  const hood = kind === 'rogue' ? def.hood ?? '#4f8a3a' : null;
  const wc = def.weaponColor;

  // ── 몸 뒤: 도적 망토 자락 · 사제 베일 뒷자락 ──
  if (kind === 'rogue' && !back) cape(G, hx, by, hood!, pose, false);
  if (kind === 'cleric' && !back) veilBack(G, hx, hy, by, def.accent, false);

  // ── 다리 ──
  if (!sit) legs(G, def, legTop, pose, robe);
  else if (!robe) {
    // 앉기: 허벅지가 앞으로 (의자·바닥에 걸터앉음)
    G.rect(8, by + 7, 7, 2, def.pants);
    G.rect(14, by + 7, 3, 2, def.boots);
    G.set(16, by + 9, def.boots);
  }

  // ── 뒤쪽 팔 + 손 ──
  const aB = pose.armB ?? 0;
  const backArm = back ? def.arm : dk(def.arm, robe ? 0.1 : 0.22);
  // 로브는 소매가 몸 앞으로 (몸통 다음에 그린다)
  const drawBackArm = () => {
  if (pose.cast) {
    G.rect(5, by + 1, 2, 3, backArm);
    G.rect(4, by + 3, 2, 2, SKN2);
  } else if (pose.atk === 1 && kind === 'rogue') {
    G.rect(5, by + 1, 2, 2, backArm);
    G.rect(4, by - 1, 2, 2, SKN2);
    dagger(G, 4, by - 1, 'up', wc, true);
  } else if (pose.pray) {
    G.rect(6, by + 1, 2, 3, backArm);
  } else {
    G.rect(5, by + 1, 2, 4 + aB, backArm);
    G.rect(5, by + 5 + aB, 2, 2, SKN2);
    if (kind === 'rogue' && !sit && !pose.eat) dagger(G, 5, by + 5 + aB, pose.atk ? 'low' : 'rest', wc, true);
  }
  };
  if (!robe) drawBackArm();

  // ── 몸통 ──
  if (robe) robeBody(G, def, hx, by, sit, back);
  else tunic(G, def, kind, hx, by, sit ? by + 5 : legTop, back);
  if (robe) drawBackArm();
  if (kind === 'cleric' && back) veilBack(G, hx, hy, by, def.accent, true);
  if (def.towel) {
    G.rect(7, by, 8, 1, def.towel, 'flat');
    G.rect(13, by + 1, 2, 2, def.towel, 'flat');
  }

  // ── 기사 방패 (왼쪽 · 몸 앞) ──
  if (kind === 'knight' && def.shield !== false && !sit) shield(G, 4.5 + (pose.hurt ? -1 : 0), by + 6 + (pose.atk === 1 ? -1 : 0), back);

  // ── 머리 ──
  G.ell(hx + 0.2, hy, 6.1, 5.6, SKN);
  if (def.beard) G.ell(hx + 0.6, hy + 4.4, 4.6, 3.4, def.beard, null, (_x, y) => y >= hy + 2.4);
  headgear(G, def, kind, hx, hy, by, back, hood);
  // 엘프 귀: 투구·두건 밖으로 뾰족
  if (def.elf) {
    // 엘프 귀: 머리 장비 밖으로 뾰족 (피부 밝게 · 안쪽 1px 어둡게)
    const ey = Math.round(hy);
    const ear = (pts: [number, number][], inner: [number, number]) => {
      for (const [x, y] of pts) G.set(x, ey + y, SKN, 'flat');
      G.set(inner[0], ey + inner[1], SKN2, 'flat');
    };
    const l = Math.round(hx) - 7;
    const r = Math.round(hx) + 8;
    ear([[l, 0], [l - 1, 0], [l - 2, -1], [l - 1, -1], [l - 3, -2], [l, 1], [l - 1, 1]], [l, 0]);
    if (!back) ear([[r, 0], [r + 1, -1], [r, -1], [r + 2, -2], [r, 1]], [r, 0]);
    else ear([[r, 0], [r + 1, 0], [r + 2, -1], [r + 1, -1], [r + 3, -2], [r, 1], [r + 1, 1]], [r, 0]);
  }
  if (!back) {
    // 얼굴은 판판하게 (오른쪽 가장자리 붉은 줄 없이) · 머리카락·투구 바로 밑 한 줄만 그림자
    const fl: [number, number, string][] = [];
    for (let y = Math.floor(hy - 4); y <= hy + 6; y++)
      for (let x = Math.floor(hx - 6); x <= hx + 6; x++) {
        const p = G.g[y + 3]?.[x + 1];
        if (!p || p.c !== SKN || p.tag) continue;
        const up = G.g[y + 2]?.[x + 1];
        fl.push([x, y, up && up.c !== SKN ? ramp(SKN, -1) : SKN]);
      }
    for (const [x, y, c] of fl) G.set(x, y, c, 'flat');
    face(G, def, pose, hx, hy, SKN2);
  }
  // 도적 짧은 망토: 앞에서 어깨를 덮는다 (뒤에서는 등 전체)
  if (kind === 'rogue') {
    if (back) cape(G, hx, by, hood!, pose, true);
    else mantle(G, hx, by, hood!, def.accent);
  }

  // ── 앞쪽 팔 + 손 + 무기 ──
  frontArm(G, def, kind, pose, by, SKN, oldWeapon);
  return G;
}

function legs(G: GridT, def: ClassDef, legTop: number, pose: Pose2, robe: boolean) {
  const lx = pose.lx ?? 0;
  const rx = pose.rx ?? 0;
  const L = pose.liftL ?? 0;
  const R = pose.liftR ?? 0;
  const bootsL = dk(def.boots, 0.12);
  if (robe) {
    // 로브: 발끝만 (걸을 때 번갈아 나온다)
    G.rect(8 + lx, 26 - L, 3, 2, bootsL);
    G.rect(12 + rx, 26 - R, 3, 2, def.boots);
    return;
  }
  // 뒤 다리 (왼쪽 · 조금 어둡게)
  G.rect(8 + lx, legTop, 2, 24 - legTop - L, dk(def.pants, 0.15));
  G.rect(8 + lx, 24 - L, 2, 3, bootsL);
  G.rect(7 + lx, 26 - L, 3, 1, bootsL);
  // 앞 다리
  G.rect(12 + rx, legTop, 2, 24 - legTop - R, def.pants);
  G.rect(12 + rx, 24 - R, 2, 3, def.boots);
  G.rect(12 + rx, 26 - R, 3, 1, def.boots);
}

/** 짧은 상의 + 벨트 + 치마 자락 (기사 겉옷 · 도적 튜닉) */
function tunic(G: GridT, def: ClassDef, kind: Dot2, hx: number, by: number, legTop: number, back: boolean) {
  const c = def.cloth;
  const bot = legTop - by > 12 ? by + 6 : Math.min(by + 9, Math.max(by + 6, legTop + 1));
  // 가슴: 둥근 어깨
  G.rect(7, by, 8, 1, c);
  G.rect(6, by + 1, 10, bot - by - 1, c);
  // 아래로 살짝 퍼지는 자락
  G.rect(6, bot, 10, 1, c);
  if (kind === 'knight') {
    G.set(5, bot, c);
    G.set(16, bot, c);
  }
  // 벨트
  const belt = by + 5;
  G.rect(6, belt, 10, 1, kind === 'knight' ? '#6b4128' : dk(def.accent, 0.35));
  if (!back) G.set(Math.round(hx), belt, def.accent, 'flat');
  if (kind === 'knight' && !back) {
    // 금 십자 (가슴 가운데)
    const cx = Math.round(hx);
    G.rect(cx, by + 1, 1, 3, def.accent, 'flat');
    G.rect(cx - 1, by + 2, 3, 1, def.accent, 'flat');
    // 옷깃
    G.rect(cx - 1, by, 3, 1, lt(c, 0.25));
  }
}

/** 사제 로브: 아래로 넓게 · 금 장식 줄 (가운데 · 아랫단 · 소매) */
function robeBody(G: GridT, def: ClassDef, hx: number, by: number, sit: number, back: boolean) {
  const c = def.cloth;
  const end = sit ? by + 9 : 26;
  for (let y = by; y < end; y++) {
    const j = y - by;
    const ww = j === 0 ? 8 : 10 + Math.floor(j / 4);
    G.rect(Math.round(hx - ww / 2), y, ww, 1, c);
  }
  const g = def.accent;
  if (!back) {
    G.rect(Math.round(hx), by + 2, 1, end - by - 2, g, 'flat');
    G.set(Math.round(hx), by + 1, lt(g, 0.4), 'flat');
  }
  // 아랫단 금 테
  const ww = 10 + Math.floor((end - 1 - by) / 4);
  G.rect(Math.round(hx - ww / 2), end - 1, ww, 1, g);
}

/** 기사 둥근 나무 방패 (쇠 테 · 가운데 쇠 돌기) */
function shield(G: GridT, cx: number, cy: number, back: boolean) {
  G.ell(cx, cy, 4.2, 4.6, RIM);
  G.ell(cx, cy, 3.1, 3.5, back ? dk(WOOD, 0.2) : WOOD);
  if (back) {
    G.rect(Math.round(cx) - 2, Math.round(cy) - 1, 5, 1, '#5a3420');
    return;
  }
  // 나무 판자 줄 · 쇠 돌기
  G.rect(Math.round(cx) - 2, Math.round(cy) + 2, 1, 1, dk(WOOD, 0.2), 'flat');
  G.rect(Math.round(cx) + 2, Math.round(cy) - 2, 1, 1, dk(WOOD, 0.2), 'flat');
  G.rect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2, STEEL);
  G.set(Math.round(cx) - 1, Math.round(cy) - 1, lt(STEEL, 0.5), 'flat');
}

/** 머리 위 장비: 기사 투구 · 사제 베일 · 도적 두건 (+ 보이는 머리카락) */
function headgear(G: GridT, def: ClassDef, kind: Dot2, hx: number, hy: number, by: number, back: boolean, hood: string | null) {
  const hair = def.hair;
  const hl = ramp(hair, 1);
  if (kind === 'knight') {
    // 얼굴 창 (앞) · 뒤에서는 통째로 쇠
    const op = (x: number, y: number) => !back && x >= hx - 3 && x <= hx + 4 && y >= hy - 1.5 && !(y >= hy + 4 && (x <= hx - 3 || x >= hx + 4));
    // 앞머리 (얼굴 창 위쪽)
    if (!back) {
      G.rect(Math.round(hx - 3), Math.round(hy - 1.5), 8, 1, hair);
      G.set(Math.round(hx - 3), Math.round(hy - 0.5), hair);
      G.set(Math.round(hx + 4), Math.round(hy - 0.5), hair);
      G.rect(Math.round(hx - 1), Math.round(hy - 1.5), 3, 1, hl, 'flat');
    } else G.rect(Math.round(hx - 3), Math.round(hy + 4.5), 7, 1, hair);
    G.ell(hx + 0.2, hy - 0.6, 6.9, 6.2, STEEL, null, (x, y) => !op(x, y) && y <= hy + 4.5);
    // 이마 띠 · 가운데 줄 · 징
    G.rect(Math.round(hx - 6), Math.round(hy - 2.5), 13, 1, dk(STEEL, 0.18));
    G.rect(Math.round(hx), Math.round(hy - 6.5), 1, 4, lt(STEEL, 0.35), 'flat');
    // 투구 밑으로 보이는 뒷머리 (머리색이 보이게)
    G.rect(Math.round(hx - 6), Math.round(hy + 4.5), 3, 2, hair);
    G.set(Math.round(hx - 6), Math.round(hy + 3.5), hair);
    if (back) G.rect(Math.round(hx - 4), Math.round(hy + 4.5), 9, 2, hair);
    G.set(Math.round(hx - 5), Math.round(hy - 2.5), lt(STEEL, 0.5), 'flat');
    G.set(Math.round(hx + 5), Math.round(hy - 2.5), lt(STEEL, 0.5), 'flat');
    // 빨간 깃털: 꼭대기에서 뒤(왼쪽)로 휘어 늘어진다
    const t = Math.round(hy - 6.5);
    const plume: [number, number][] = [
      [0, -1], [1, -1], [-1, -1], [-2, -1],
      [0, -2], [1, -2], [-1, -2], [-2, -2], [-3, -2],
      [-3, -1], [-4, -1], [-4, 0], [-5, 0], [-5, 1], [-6, 1],
      [1, -3], [2, -3], [0, -3],
    ];
    for (const [dx, dy] of plume) G.set(Math.round(hx) + dx, t + dy, PLUME);
    G.set(Math.round(hx) + 1, t - 3, lt(PLUME, 0.4), 'flat');
    G.set(Math.round(hx) - 1, t - 2, lt(PLUME, 0.3), 'flat');
    return;
  }
  if (kind === 'cleric') {
    // 베일 안쪽: 금발 앞머리 + 양옆으로 내려오는 머리
    const op = (x: number, y: number) => !back && x >= hx - 4 && x <= hx + 4 && y >= hy - 3.5 && !(y < hy - 2.5 && (x <= hx - 4 || x >= hx + 4));
    if (!back) {
      G.ell(hx + 0.2, hy - 1.6, 5, 3, hair, null, (_x, y) => y <= hy - 1.5);
      G.rect(Math.round(hx - 4), Math.round(hy - 2.5), 2, 9, hair);
      G.rect(Math.round(hx + 3), Math.round(hy - 2.5), 2, 9, hair);
      G.set(Math.round(hx - 2), Math.round(hy - 1.5), hair);
      G.rect(Math.round(hx - 2), Math.round(hy - 4.5), 4, 1, hl, 'flat');
      G.set(Math.round(hx - 4), Math.round(hy), hl, 'flat');
    }
    G.ell(hx + 0.2, hy - 0.8, 7.0, 6.4, VEIL, null, (x, y) => !op(x, y) && y <= hy + 5.5);
    // 금 테두리: 얼굴 창 가장자리
    if (!back)
      for (let y = Math.floor(hy - 8); y <= hy + 6; y++)
        for (let x = Math.floor(hx - 8); x <= hx + 8; x++) {
          const p = G.g[y + 3]?.[x + 1];
          if (!p || p.c !== VEIL) continue;
          if (op(x + 1, y) || op(x - 1, y) || op(x, y + 1) || op(x, y - 1)) if (y <= hy + 5) G.set(x, y, def.accent);
        }
    else G.rect(Math.round(hx - 6), Math.round(hy - 2.5), 13, 1, def.accent);
    return;
  }
  // 도적 두건: 둥근 머리 + 뒤로 뾰족한 끝 · 얼굴 창
  const H = hood!;
  const op = (x: number, y: number) => !back && x >= hx - 3 && x <= hx + 4 && y >= hy - 2.5 && !(y < hy - 1.5 && (x <= hx - 3 || x >= hx + 4));
  if (!back) {
    G.rect(Math.round(hx - 3), Math.round(hy - 2.5), 8, 2, hair);
    G.set(Math.round(hx - 3), Math.round(hy - 0.5), hair);
    G.set(Math.round(hx + 1), Math.round(hy - 0.5), hair);
    G.rect(Math.round(hx - 1), Math.round(hy - 2.5), 3, 1, hl, 'flat');
  }
  G.ell(hx + 0.2, hy - 0.5, 7.0, 6.5, H, null, (x, y) => !op(x, y) && y <= hy + 5.5);
  G.tri(hx - 6, hy - 3, hx - 2, hy - 6.5, hx - 7.5, hy - 7.5, H);
  // 두건 접힌 선
  if (!back) G.rect(Math.round(hx - 4), Math.round(hy - 3.5), 1, 7, dk(H, 0.2));
  else G.rect(Math.round(hx), Math.round(hy - 5.5), 1, 9, dk(H, 0.15));
  void by;
}

/** 얼굴: 2×3 눈 + 흰 빛 1px · 눈썹 1px · 볼 홍조(설정된 얼굴만) · 표정 */
function face(G: GridT, def: ClassDef, pose: Pose2, hx: number, hy: number, SKN2: string) {
  const F = def.face ?? {};
  const ey = Math.round(hy - 0.5);
  const L = Math.round(hx - 3);
  const Rr = Math.round(hx + 2);
  const BR = dk(def.brow || def.hair || '#5a3424', 0.35);
  const MO = '#a8404a';
  const eyesAt = (fn: (ex: number) => void) => {
    fn(L);
    fn(Rr);
  };
  const eyes = pose.face === 'hurt' ? 'hurt' : pose.blink ? 'blink' : (F.eyes as string | undefined) ?? 'big';
  switch (eyes) {
    case 'hurt':
      // 눈 질끈 > <
      G.set(L, ey, EYE, 'eye');
      G.set(L + 1, ey + 1, EYE, 'eye');
      G.set(L, ey + 2, EYE, 'eye');
      G.set(Rr + 1, ey, EYE, 'eye');
      G.set(Rr, ey + 1, EYE, 'eye');
      G.set(Rr + 1, ey + 2, EYE, 'eye');
      break;
    case 'blink':
    case 'squint':
      eyesAt((ex) => G.rect(ex, ey + 2, 2, 1, EYE, 'eye'));
      break;
    case 'happy':
      eyesAt((ex) => {
        G.set(ex, ey + 2, EYE, 'eye');
        G.rect(ex, ey + 1, 2, 1, EYE, 'eye');
        G.set(ex + 1, ey + 2, EYE, 'eye');
        G.set(ex, ey + 2, EYE, 'eye');
      });
      break;
    case 'calm':
      // 졸린 듯 반쯤 감은 눈 (위 눈꺼풀 + 2×2)
      eyesAt((ex) => {
        G.rect(ex, ey, 2, 1, BR, 'eye');
        G.rect(ex, ey + 1, 2, 2, EYE, 'eye');
        G.set(ex, ey + 1, WHITE, 'eye');
      });
      break;
    case 'sly':
      eyesAt((ex) => {
        G.rect(ex, ey + 1, 2, 2, EYE, 'eye');
        G.set(ex, ey + 1, WHITE, 'eye');
        G.set(ex === L ? ex + 1 : ex, ey, EYE, 'eye');
      });
      break;
    default:
      // 기본 · 둥근 · 반짝: 2×3 진한 눈동자 + 왼쪽 위 흰 빛 + 아래 보랏빛
      eyesAt((ex) => {
        G.rect(ex, ey, 2, 3, EYE, 'eye');
        G.set(ex, ey, WHITE, 'eye');
        G.set(ex + 1, ey + 2, IRIS, 'eye');
        if (eyes === 'sparkle') G.set(ex + 1, ey + 2, '#c8b0ff', 'eye');
      });
  }
  // 눈썹 1px (기합 = 화난 눈썹 · 아픔 = 올라간 눈썹)
  const brow = pose.face === 'shout' ? 'angry' : pose.face === 'hurt' ? 'up' : F.brow;
  if (brow === 'angry') {
    G.set(L, ey - 2, BR, 'flat');
    G.set(L + 1, ey - 1, BR, 'flat');
    G.set(Rr + 1, ey - 2, BR, 'flat');
    G.set(Rr, ey - 1, BR, 'flat');
  } else if (brow === 'up') {
    G.set(L, ey - 1, BR, 'flat');
    G.set(L + 1, ey - 2, BR, 'flat');
    G.set(Rr, ey - 2, BR, 'flat');
    G.set(Rr + 1, ey - 1, BR, 'flat');
  } else if (brow === 'bushy') {
    G.rect(L - 1, ey - 1, 3, 1, BR, 'flat');
    G.rect(Rr, ey - 1, 3, 1, BR, 'flat');
  } else {
    G.rect(L, ey - 1, 2, 1, BR, 'flat');
    G.rect(Rr, ey - 1, 2, 1, BR, 'flat');
  }
  if (F.nose === 'big') G.rect(Math.round(hx), ey + 2, 2, 1, SKN2, 'flat');
  // 입
  const mx = Math.round(hx);
  const my = ey + 4;
  const mouth = pose.face ? 'o' : F.mouth;
  switch (mouth) {
    case 'grin':
      G.rect(mx - 1, my, 3, 1, MO, 'eye');
      G.set(mx, my, WHITE, 'eye');
      break;
    case 'smirk':
      G.rect(mx, my, 2, 1, MO, 'eye');
      G.set(mx + 2, my - 1, dk(SKN2, 0.15), 'eye');
      break;
    case 'o':
      G.rect(mx, my - 1, 1, 2, '#7a2a3a', 'eye');
      break;
    case 'flat':
      G.rect(mx, my, 2, 1, dk(SKN2, 0.2), 'eye');
      break;
    case 'none':
      break;
    default:
      G.set(mx, my, MO, 'eye');
  }
  if (F.blush === true) {
    G.set(L - 1, ey + 3, BLUSH, 'flat');
    G.set(Rr + 2, ey + 3, BLUSH, 'flat');
  }
  if (F.freckle) {
    const fc = mix(SKN2, '#b06a4a', 0.35);
    G.set(L, ey + 3, fc, 'flat');
    G.set(Rr + 1, ey + 3, fc, 'flat');
  }
  if (F.scar) {
    G.set(Rr + 2, ey + 2, SKN2, 'flat');
    G.set(Rr + 1, ey + 3, SKN2, 'flat');
  }
  if (F.paint) G.set(Rr + 2, ey + 3, F.paint, 'flat');
  if (F.glasses) {
    const gc = def.glassesColor ?? '#b08850';
    eyesAt((ex) => {
      G.rect(ex, ey - 1, 2, 1, gc, 'eye');
      G.rect(ex, ey + 3, 2, 1, gc, 'eye');
      G.rect(ex - 1, ey, 1, 3, gc, 'eye');
      G.rect(ex + 2, ey, 1, 3, gc, 'eye');
    });
  }
  if (def.stache) G.rect(mx - 2, my - 1, 5, 1, def.stache);
}

/** 사제 베일 뒷자락 (어깨 뒤로 길게) */
function veilBack(G: GridT, hx: number, hy: number, by: number, gold: string, back: boolean) {
  const bot = by + (back ? 10 : 9);
  for (let y = Math.round(hy); y < bot; y++) {
    const j = y - hy;
    const w = 14 + Math.floor(j / 5);
    G.rect(Math.round(hx - w / 2), y, w, 1, VEIL);
  }
  if (back) {
    G.rect(Math.round(hx - 8), bot - 1, 16, 1, gold);
    G.rect(Math.round(hx), Math.round(hy) + 1, 1, bot - Math.round(hy) - 2, dk(VEIL, 0.12));
  }
}

/** 도적 짧은 망토 자락 (뒤 · 걸으면 끝이 1프레임 늦게 따라온다) */
function cape(G: GridT, hx: number, by: number, H: string, pose: Pose2, front: boolean) {
  const tr = pose.trail ?? 0;
  const lag = pose.lag ?? 0;
  const bot = by + 10 + (lag - (pose.bob ?? 0));
  const c = front ? H : dk(H, 0.12);
  for (let y = by; y <= bot; y++) {
    const j = y - by;
    const w = (front ? 12 : 13) + Math.floor(j / 3);
    const sh = y >= bot - 2 ? -tr : 0;
    G.rect(Math.round(hx - w / 2) + sh, y, w, 1, c);
  }
  // 자락 끝 들쭉날쭉
  G.clear(Math.round(hx - 1) + 1, bot + 3);
  if (front) G.rect(Math.round(hx - 5) - tr, bot, 1, 1, dk(H, 0.25));
}

/** 도적 어깨 망토(앞): 어깨를 둥글게 덮고 금 걸쇠 */
function mantle(G: GridT, hx: number, by: number, H: string, gold: string) {
  G.ell(hx + 0.2, by + 1.6, 6.2, 3.2, H, null, (_x, y) => y >= by);
  G.rect(Math.round(hx), by + 1, 1, 1, gold, 'flat');
  G.set(Math.round(hx) - 1, by + 1, dk(gold, 0.3), 'flat');
}

function dagger(G: GridT, hx: number, hy: number, mode: 'rest' | 'up' | 'low' | 'fwd' | 'mid', wc: string | undefined, left = false) {
  const bl = wc ?? '#e3e9f4';
  const sh = ramp(bl, -1);
  const s = left ? -1 : 1;
  const ox = left ? hx : hx + 1;
  if (mode === 'rest') {
    // 손에서 바깥 위로 비스듬히
    G.set(ox - s * 0, hy - 1, '#6b4128');
    G.set(ox + s, hy - 1, '#c9a04a', 'flat');
    G.set(ox + s * 1, hy - 2, bl);
    G.set(ox + s * 2, hy - 3, bl);
    G.set(ox + s * 2, hy - 2, sh);
    G.set(ox + s * 3, hy - 4, bl);
    G.set(ox + s * 3, hy - 3, sh);
    return;
  }
  if (mode === 'up') {
    G.rect(ox, hy - 4, 1, 4, bl);
    G.rect(ox + s, hy - 3, 1, 3, sh);
    G.rect(ox - 1, hy, 3, 1, '#c9a04a', 'flat');
    return;
  }
  if (mode === 'low') {
    G.rect(ox + s, hy + 1, 1, 1, '#c9a04a', 'flat');
    G.line(ox + s * 2, hy + 2, ox + s * 4, hy + 4, bl);
    return;
  }
  // fwd · mid: 앞으로 찌르기
  if (mode === 'fwd') {
    G.rect(hx + 2, hy, 4, 1, bl);
    G.rect(hx + 2, hy + 1, 3, 1, sh);
    G.set(hx + 2, hy - 1, '#c9a04a', 'flat');
    return;
  }
  G.line(hx + 2, hy - 1, hx + 5, hy - 4, bl);
  G.line(hx + 3, hy - 1, hx + 5, hy - 3, sh);
}

function sword(G: GridT, def: ClassDef, hx: number, hy: number, mode: 'rest' | 'up' | 'fwd' | 'mid' | 'low') {
  const bl = def.weaponColor ?? '#e3e9f4';
  const sh = ramp(bl, -1);
  const gd = def.accent;
  if (mode === 'rest' || mode === 'up') {
    // 곧은 검: 손 위로 세움 (2px 날 · 금 손잡이)
    const x = hx + 1;
    const top = mode === 'up' ? hy - 11 : hy - 9;
    G.rect(x, top + 1, 1, hy - top - 2, bl);
    G.rect(x + 1, top + 1, 1, hy - top - 2, sh);
    G.set(x, top, lt(bl, 0.5));
    G.rect(x - 1, hy - 1, 4, 1, gd);
    G.set(x, hy + 2, gd);
    return;
  }
  if (mode === 'mid') {
    // 휘두르는 중: 앞 위로 비스듬히
    G.line(hx + 2, hy - 1, hx + 6, hy - 5, bl);
    G.line(hx + 3, hy - 1, hx + 6, hy - 4, sh);
    G.rect(hx + 1, hy - 1, 2, 1, gd);
    return;
  }
  if (mode === 'fwd') {
    // 내려침: 앞 아래로
    G.line(hx + 2, hy + 1, hx + 6, hy + 5, bl);
    G.line(hx + 2, hy + 2, hx + 5, hy + 5, sh);
    G.set(hx + 2, hy, gd);
    G.set(hx + 1, hy + 2, gd);
    return;
  }
  // low: 거두기 (아래로 늘어뜨림)
  G.rect(hx + 1, hy + 2, 1, 6, bl);
  G.rect(hx + 2, hy + 2, 1, 5, sh);
  G.rect(hx, hy + 1, 4, 1, gd);
}

/** 성스러운 지팡이: 나무 자루 + 끝에 금 별 (빛 = 'fx') */
function holyStaff(G: GridT, def: ClassDef, x: number, top: number, bottom: number, glow: number) {
  const star = def.weaponColor ?? '#ffd34a';
  G.rect(x, top + 2, 1, bottom - top - 2, SHAFT);
  G.set(x, top + 4, def.accent, 'flat');
  // 별: 십자 5칸 + 흰 가운데
  G.rect(x - 1, top, 3, 1, star);
  G.rect(x, top - 1, 1, 3, star);
  G.set(x, top, WHITE, 'flat');
  G.set(x, top - 2, star, 'flat');
  G.set(x - 2, top, star, 'flat');
  G.set(x + 2, top, star, 'flat');
  G.set(x, top + 1, star);
  const gl = mix(star, WHITE, 0.55);
  if (glow >= 1) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) G.set(x + dx, top + dy, gl, 'fx');
  if (glow >= 2) for (const [dx, dy] of [[0, -3], [-3, 0], [3, 0], [-2, -2], [2, -2], [-2, 2], [2, 2]]) G.set(x + dx, top + dy, glow >= 3 ? gl : mix(star, WHITE, 0.3), 'fx');
  if (glow >= 3) for (const [dx, dy] of [[0, -4], [-4, 0], [4, 0], [-3, -3], [3, -3]]) G.set(x + dx, top + dy, WHITE, 'fx');
}

function book(G: GridT, def: ClassDef, hx: number, hy: number) {
  const bc = def.weaponColor ?? '#b0412f';
  G.rect(hx - 1, hy - 3, 4, 4, bc);
  G.rect(hx - 1, hy - 3, 1, 4, dk(bc, 0.25));
  G.set(hx + 1, hy - 2, '#f2c447', 'flat');
  G.rect(hx, hy - 1, 3, 1, '#f2c447', 'flat');
  G.set(hx + 1, hy - 1, '#f2c447', 'flat');
}

/** 휘두름 궤적: 어깨를 중심으로 한 깔끔한 호 (바깥 흰색 · 안 연한 무기색 · 꼬리 옅게) — 흩어진 점 없이 */
function swingArc(G: GridT, cx: number, cy: number, r: number, a0: number, a1: number, base: string) {
  const outer = '#fffbea';
  const inner = mix(base, WHITE, 0.45);
  const tail = mix(base, '#c8d0e0', 0.5);
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++)
    for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dx, -dy); // 0 = 위 · +π/2 = 오른쪽
      if (a < a0 || a > a1) continue;
      const t = (a - a0) / (a1 - a0);
      // 꼬리 쪽은 가늘게 (1칸) · 머리 쪽은 2칸
      const th = t < 0.35 ? 0.9 : 1.9;
      if (d > r + 0.5 || d < r + 0.5 - th) continue;
      G.set(x, y, t < 0.35 ? tail : d > r - 0.5 ? outer : inner, 'fx');
    }
}

function frontArm(G: GridT, def: ClassDef, kind: Dot2, pose: Pose2, by: number, SKN: string, oldWeapon: WeaponFn) {
  const arm = def.arm;
  const w = def.weapon;
  const sit = !!pose.sit;
  const W = (hx: number, hy: number, mode: 'rest' | 'up' | 'fwd' | 'mid' | 'low') => {
    if (!w) return;
    if (w === 'sword') return sword(G, def, hx, hy, mode);
    if (w === 'dagger') return dagger(G, hx, hy, mode, def.weaponColor);
    if (w === 'book') return book(G, def, hx, hy + (mode === 'rest' ? 1 : 0));
    if (w === 'holy' || w === 'staff') {
      // 사제: 별 지팡이 (마법사 지팡이를 든 사제도 별) · 다른 직업의 지팡이는 예전 모양
      if (kind !== 'cleric' && w === 'staff') return oldWeapon(G, def, hx, hy, mode);
      if (mode === 'rest') return holyStaff(G, def, hx + 1, by - 8, 27, 1);
      if (mode === 'up') return holyStaff(G, def, hx + 1, hy - 10, hy + 6, 1);
      if (mode === 'fwd' || mode === 'mid') {
        G.line(hx + 1, hy + 2, hx + 4, hy - 7, SHAFT);
        return holyStaff(G, def, hx + 5, hy - 10, hy - 10 + 2, 2);
      }
      return holyStaff(G, def, hx + 1, hy - 6, hy + 8, 0);
    }
    oldWeapon(G, def, hx, hy, mode);
  };
  if (pose.cast) {
    // 시전: 앞손을 앞으로 · 지팡이·무기 빛이 커진다
    const r = pose.cast;
    G.rect(15, by + 1, 2, 2, arm);
    G.rect(17, by + 1, 2, 2, SKN);
    if (w === 'holy' || (w === 'staff' && kind === 'cleric')) holyStaff(G, def, 19, by - 8, 27, r + 1);
    else {
      if (w === 'sword') sword(G, def, 17, by + 2, 'up');
      else if (w) W(17, by + 1, 'rest');
      const gl = mix(def.accent, WHITE, 0.5);
      const cx = 19;
      const cy = by + 1;
      G.set(cx, cy, WHITE, 'fx');
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]].slice(0, 2 + r)) G.set(cx + dx + 1, cy + dy, gl, 'fx');
      if (r >= 2) for (const [dx, dy] of [[2, -2], [3, 1], [1, 3]]) G.set(cx + dx, cy + dy, gl, 'fx');
      if (r >= 3) for (const [dx, dy] of [[3, -3], [4, 0], [2, 3], [0, -3]]) G.set(cx + dx, cy + dy, WHITE, 'fx');
    }
    return;
  }
  if (pose.atk === 1) {
    // 들어 올림: 앞손이 어깨 위로
    G.rect(15, by - 1, 2, 3, arm);
    G.rect(16, by - 3, 2, 2, SKN);
    if (kind === 'cleric' && (w === 'holy' || w === 'staff')) holyStaff(G, def, 17, by - 13, by + 3, 1);
    else W(16, by - 2, 'up');
    return;
  }
  if (pose.atk === 3) {
    // 휘두름: 팔을 앞으로 뻗고 · 위에서 앞 아래로 깔끔한 호
    G.rect(15, by + 1, 3, 2, arm);
    G.rect(18, by, 2, 2, SKN);
    const base = def.weaponColor ?? (w === 'holy' || w === 'staff' ? '#ffd34a' : '#d8e2f2');
    const r = kind === 'rogue' ? 7 : 8.5;
    swingArc(G, 13.5, by + 1.5, r, -0.9, 2.1, base);
    W(18, by, 'mid');
    return;
  }
  if (pose.atk === 2) {
    // 내려침: 앞 아래로
    G.rect(15, by + 2, 3, 2, arm);
    G.rect(18, by + 3, 2, 2, SKN);
    W(18, by + 3, 'fwd');
    return;
  }
  if (pose.atk === 4) {
    // 거두기
    G.rect(15, by + 1, 2, 4, arm);
    G.rect(15, by + 5, 2, 2, SKN);
    W(15, by + 5, 'low');
    return;
  }
  if (pose.eat) {
    G.rect(15, by + 1, 2, 2, arm);
    G.rect(14, by - 1 - (pose.eat > 1 ? 1 : 0), 2, 2, SKN);
    return;
  }
  if (pose.pray) {
    G.rect(13, by + 1, 3, 2, arm);
    G.rect(11, by + 2, 2, 2, SKN);
    return;
  }
  const aF = pose.armF ?? 0;
  if (!sit && kind === 'cleric' && (w === 'holy' || w === 'staff' || w === 'book')) {
    // 사제: 소매 끝 금 테 · 손을 몸 밖으로 — 지팡이를 쥐거나 책을 든다
    G.rect(15, by + 1, 2, 3, dk(arm, 0.08));
    G.rect(16, by + 2 + aF, 1, 2, dk(arm, 0.08));
    G.rect(16, by + 3 + aF, 1, 1, def.accent);
    G.rect(17, by + 2 + aF, 2, 2, SKN);
    if (w === 'book') return book(G, def, 18, by + 6 + aF);
    return holyStaff(G, def, 19, by - 8, 27, 1);
  }
  G.rect(15, by + 1, 2, 4 + aF, arm);
  G.rect(15, by + 5 + aF, 2, 2, SKN);
  if (kind === 'cleric' && def.robe) G.rect(15, by + 4 + aF, 2, 1, def.accent);
  if (sit) return;
  if (kind === 'knight' && w === 'sword') return sword(G, def, 15, by + 5 + aF, 'rest');
  if (w === 'dagger') return dagger(G, 15, by + 5 + aF, 'rest', def.weaponColor);
  if (w === 'holy' || (w === 'staff' && kind === 'cleric')) return holyStaff(G, def, 17, by - 8, 27, 1);
  W(15, by + 5 + aF, 'rest');
}

/** 구르기 (예전 구조 · 머리는 투구·베일·두건 색) */
export function drawRoll2(def: ClassDef, kind: Dot2, i: number): GridT {
  const G = Grid(24, 33, 1, 3);
  const cx = 10.5;
  const cy = 22;
  if (kind === 'rogue') G.ell(cx - 1, cy + 0.5, 6.6, 5, def.hood ?? '#4f8a3a');
  G.ell(cx, cy, 6, 5.2, def.cloth);
  G.rect(Math.round(cx - 5), cy, 10, 1, def.accent);
  const a = (i * Math.PI) / 2 - Math.PI / 2;
  const hx = cx + Math.cos(a) * 3.4;
  const hy = cy + Math.sin(a) * 3;
  const head = kind === 'knight' ? STEEL : kind === 'cleric' ? VEIL : def.hood ?? '#4f8a3a';
  G.ell(hx, hy, 3.3, 3.1, head);
  if (kind === 'knight') G.set(hx - Math.cos(a) * 3, hy - Math.sin(a) * 3, PLUME);
  if (kind === 'cleric') G.set(hx, hy, def.accent, 'flat');
  G.ell(cx - Math.cos(a) * 3.6, cy - Math.sin(a) * 3.2, 2, 1.6, def.boots);
  G.ell(cx + Math.cos(a + Math.PI / 2) * 3.8, cy + Math.sin(a + Math.PI / 2) * 3.2, 1.4, 1.4, def.skin ?? SKIN);
  return G;
}

/** 쓰러짐 마지막: 누운 모습 (예전 구조 · 머리 크게 · 투구·베일·두건) */
export function drawLying2(def: ClassDef, kind: Dot2): GridT {
  const G = Grid(33, 14);
  if (kind === 'rogue') G.rect(8, 5, 13, 7, def.hood ?? '#4f8a3a');
  G.rect(9, 6, 13, 5, def.cloth);
  G.rect(9, 9, 13, 1, def.accent);
  G.rect(21, 7, 6, 2, def.pants);
  G.rect(26, 6, 3, 4, def.boots);
  G.ell(5.5, 7.5, 4.3, 4.1, def.skin ?? SKIN);
  const head = kind === 'knight' ? STEEL : kind === 'cleric' ? VEIL : def.hood ?? '#4f8a3a';
  G.ell(4.6, 7, 4.6, 4.4, head, null, (x) => x < 5);
  if (kind === 'knight') G.rect(0, 5, 2, 3, PLUME);
  if (kind === 'cleric') G.rect(5, 3, 1, 9, def.accent);
  G.rect(7, 6, 1, 2, EYE, 'eye');
  G.rect(7, 9, 1, 2, EYE, 'eye');
  return G;
}
