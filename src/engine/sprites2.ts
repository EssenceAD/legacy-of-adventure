// HERODOT 리마스터 2 — 9직업 도트 (1단계 기사·사제·도적 · 2단계 마법사·전사·사냥꾼·노주인·우체부·나) (플래그 heroDotV2 · 꺼지면 sprites.ts 예전 그림 그대로)
//  같은 24×33 격자 · 같은 동작 · 같은 render() 명암 3단 + 부위색 외곽선. 머리를 키우고(약 12px · 2.5등신) 직업 실루엣을 가른다.
//  좌표는 예전 drawChar와 같은 그리기 좌표 (Grid(24,33,1,3) · 발바닥 = 27줄)
import type { ClassDef } from '../data/classes';
import { dk, Grid, lt, mix, ramp, type GridT } from './pixel';
import { applyNamed, NAMED, namedArm, namedBehind, namedFront, namedHead, namedOf, namedTrail, shadowStep, telescopeRest, walkGlint, type NCtx } from './named2';
import { greatsword, pawTop, pinwheelTop } from './stars2';

export type Dot2 = 'knight' | 'cleric' | 'rogue' | 'mage' | 'dwarf' | 'hunter' | 'keeper' | 'post' | 'hero';

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
  /** 마법사 지팡이 구슬 1px 반짝 */
  tw?: number;
  /** HERODOT 3: 시그니처 동작 번호(1~4) · 걷기 프레임 번호(전설 걸을 때 움직임) */
  sig?: number;
  wf?: number;
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
const HORN = '#efe2c6';
const HANDLE = '#7a5030';
export const FEATHER = '#3fa58a';
const STRING = '#efe2c6';

/** 무기 그리기 (예전 weapon() — 도끼·활 같은 다른 무기는 예전 모양을 빌린다) */
export type WeaponFn = (G: GridT, def: ClassDef, hx: number, hy: number, mode: 'rest' | 'up' | 'fwd' | 'mid' | 'low', frame?: number) => void;

export function drawChar2(def0: ClassDef, kind: Dot2, pose: Pose2, oldWeapon: WeaponFn): GridT {
  // HERODOT 3: 전설·이름 있는 영웅은 고정 겉모습 · 전설은 세로 +2 (26×35 · 발 위치는 같은 칸)
  const L = namedOf(def0);
  const def = L ? applyNamed(def0, L) : def0;
  const tall = L?.tier === 'legend' ? 2 : 0;
  const G = tall ? Grid(26, 35, 2, 5) : Grid(24, 33, 1, 3);
  const SKN = def.skin ?? SKIN;
  const SKN2 = def.skin ? dk(def.skin, 0.18) : '#d99a78';
  const dw = def.dwarf ? 2 : 0;
  const sit = pose.sit ? 3 : 0;
  const b = (pose.bob ?? 0) + sit + dw;
  const lean = pose.hurt ? -1 : 0;
  const hx = 11 + lean;
  const hy = 6.5 + b - tall;
  const by = 12 + b - tall;
  const legTop = 21 + (pose.bob ?? 0) + sit - (tall ? 1 : 0);
  const back = !!pose.back;
  const robe = !!def.robe;
  const classHead = !L || L.head === 'class';
  const hood = kind === 'rogue' && classHead ? def.hood ?? '#4f8a3a' : null;
  const capeC = def.hood ?? '#4f8a3a';
  const rcape = kind === 'rogue' && !L?.noCape;
  const veil = kind === 'cleric' && classHead;
  const wc = def.weaponColor;
  const nc: NCtx | null = L ? { G, def, L, kind, pose, hx, hy, by, back, SKN } : null;

  // ── 몸 뒤: 도적 망토 자락 · 사제 베일 뒷자락 · (전설·영웅) 망토 · 꼬리 · 목도리 ──
  if (rcape && !back) cape(G, hx, by, capeC, pose, false);
  if (veil && !back) veilBack(G, hx, hy, by, def.accent, false);
  if (nc) namedBehind(nc);
  const own = (kind === 'knight' || kind === 'cleric' || kind === 'rogue') && classHead;
  if (!own && !back) hairBack(G, def, hx, hy, by, pose, false);
  if (kind === 'hunter' && def.quiver !== false && !back && !sit) quiver(G, by, false);

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
  } else if (pose.atk === 1 && kind === 'rogue' && def.dual !== false) {
    G.rect(5, by + 1, 2, 2, backArm);
    G.rect(4, by - 1, 2, 2, SKN2);
    dagger(G, 4, by - 1, 'up', wc, true);
  } else if (pose.pray) {
    G.rect(6, by + 1, 2, 3, backArm);
  } else {
    G.rect(5, by + 1, 2, 4 + aB, backArm);
    G.rect(5, by + 5 + aB, 2, 2, SKN2);
    if (kind === 'rogue' && def.dual !== false && !sit && !pose.eat) dagger(G, 5, by + 5 + aB, pose.atk ? 'low' : 'rest', wc, true);
  }
  };
  if (!robe) drawBackArm();

  // ── 몸통 ──
  if (robe) robeBody(G, def, hx, by, sit, back, kind === 'mage');
  else if (kind === 'dwarf') dwarfBody(G, def, hx, by, sit ? by + 5 : legTop, back);
  else if (kind === 'keeper' || kind === 'hero') apronBody(G, def, kind, hx, by, sit ? by + 5 : legTop, back);
  else tunic(G, def, kind, hx, by, sit ? by + 5 : legTop, back);
  if (kind === 'hunter' && !back) G.line(14, by, 8, by + 5, '#6b4128');
  if (kind === 'post') mailBag(G, by, back, def.accent);
  if (!own && back) hairBack(G, def, hx, hy, by, pose, true);
  if (kind === 'hunter' && def.quiver !== false && back && !sit) quiver(G, by, true);
  if (robe) drawBackArm();
  if (veil && back) veilBack(G, hx, hy, by, def.accent, true);
  if (def.towel) {
    G.rect(7, by, 8, 1, def.towel, 'flat');
    G.rect(13, by + 1, 2, 2, def.towel, 'flat');
  }

  // ── 기사 방패 (왼쪽 · 몸 앞) ──
  if (kind === 'knight' && def.shield !== false && !sit) shield(G, 4.5 + (pose.hurt ? -1 : 0), by + 6 + (pose.atk === 1 ? -1 : 0), back);

  // ── 머리 ──
  G.ell(hx + 0.2, hy, 6.1, 5.6, SKN);
  if (def.beard) G.ell(hx + 0.6, hy + 4.4, 4.6, 3.4, def.beard, null, (_x, y) => y >= hy + 2.4);
  // 미미 시그니처 1: 모자가 눈까지 흘러내림
  const drop = L?.sig === 'hat' && pose.sig === 1 ? 2 : 0;
  if (classHead) {
    if (own) headgear(G, def, kind, hx, hy, by, back, hood);
    else headgear2(G, def, kind, hx, hy + drop, back);
  }
  if (nc) namedHead(drop ? { ...nc, hy: hy + drop } : nc);
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
    // R1 판정: 모든 직업·종족 — 머리(장비) 옆으로 귀 끝만 2px
    ear([[l - 1, 0], [l - 2, -1]], [l - 1, 0]);
    ear([[r, 0], [r + 1, -1]], [r, 0]);
  }
  if (!back) {
    // 얼굴은 판판하게 (오른쪽 가장자리 붉은 줄 없이) · 머리카락·투구 바로 밑 한 줄만 그림자
    const fl: [number, number, string][] = [];
    for (let y = Math.floor(hy - 4); y <= hy + 6; y++)
      for (let x = Math.floor(hx - 6); x <= hx + 6; x++) {
        const p = G.g[y + G.oy]?.[x + G.ox];
        if (!p || p.c !== SKN || p.tag) continue;
        const up = G.g[y - 1 + G.oy]?.[x + G.ox];
        fl.push([x, y, up && up.c !== SKN ? (L ? mix(SKN, ramp(SKN, -1), 0.45) : ramp(SKN, -1)) : SKN]);
      }
    for (const [x, y, c] of fl) G.set(x, y, c, 'flat');
    if (!drop) face(G, def, pose, hx, hy, SKN2);
  }
  // 전사 수염: 두 갈래로 땋아 가슴까지
  if (kind === 'dwarf' && def.beard && !back && !L?.noBraids) beardBraids(G, def.beard, def.accent, hx, hy, by);
  if (veil && back) veilRim(G, def.accent);
  // 도적 짧은 망토: 앞에서 어깨를 덮는다 (뒤에서는 등 전체)
  if (rcape) {
    if (back) cape(G, hx, by, capeC, pose, true);
    else mantle(G, hx, by, capeC, def.accent);
  }
  if (nc) namedFront(nc);

  // ── 앞쪽 팔 + 손 + 무기 (시그니처 동작이면 그 자세) ──
  if (!(nc && namedArm(nc, def.arm))) frontArm(G, def, kind, pose, by, SKN, oldWeapon, nc ? () => namedTrail(nc) : undefined);
  if (nc && L!.extras.includes('telescope') && !pose.sig && !pose.atk && !pose.cast && !pose.sit && !pose.eat && !pose.pray) telescopeRest(G, by);
  if (nc) {
    walkGlint(nc);
    shadowStep(nc);
  }
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
  if (kind === 'knight' && !back && !def.named) {
    // 금 십자 (가슴 가운데)
    const cx = Math.round(hx);
    G.rect(cx, by + 1, 1, 3, def.accent, 'flat');
    G.rect(cx - 1, by + 2, 3, 1, def.accent, 'flat');
    // 옷깃
    G.rect(cx - 1, by, 3, 1, lt(c, 0.25));
  }
}

/** 사제 로브: 아래로 넓게 · 금 장식 줄 (가운데 · 아랫단 · 소매) */
function robeBody(G: GridT, def: ClassDef, hx: number, by: number, sit: number, back: boolean, flare = false) {
  const c = def.cloth;
  const end = sit ? by + 9 : 26;
  const wOf = (j: number) => (j === 0 ? 8 : flare ? 10 + Math.floor(j / 2.2) : 10 + Math.floor(j / 4));
  for (let y = by; y < end; y++) G.rect(Math.round(hx - wOf(y - by) / 2), y, wOf(y - by), 1, c);
  const g = def.accent;
  if (flare) {
    // 마법사: 가운데 여밈 (어두운 줄) · 아랫단 금 테 · 깃
    if (!back) {
      G.rect(Math.round(hx), by + 2, 1, end - by - 2, dk(c, 0.25));
      G.rect(Math.round(hx) - 1, by, 3, 2, dk(c, 0.15));
    }
    const ww = wOf(end - 1 - by);
    G.rect(Math.round(hx - ww / 2), end - 1, ww, 1, g);
    return;
  }
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
export function headgear(G: GridT, def: ClassDef, kind: Dot2, hx: number, hy: number, by: number, back: boolean, hood: string | null) {
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
          const p = G.g[y + G.oy]?.[x + G.ox];
          if (!p || p.c !== VEIL) continue;
          if (op(x + 1, y) || op(x - 1, y) || op(x, y + 1) || op(x, y - 1)) if (y <= hy + 5) G.set(x, y, def.accent);
        }
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
  if (def.stache) {
    // 큰 흰 콧수염 (양끝 말려 올라감)
    G.rect(mx - 3, my - 1, 7, 2, def.stache);
    G.set(mx - 4, my - 2, def.stache);
    G.set(mx + 4, my - 2, def.stache);
    G.set(mx, my, dk(def.stache, 0.15), 'flat');
  }
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
export function cape(G: GridT, hx: number, by: number, H: string, pose: Pose2, front: boolean) {
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
    const top = (mode === 'up' ? hy - 11 : hy - 9) - (def.named === 'vael' ? 3 : 0);
    if (def.named === 'jin') {
      // 카타나: 가늘고 살짝 휜 날 · 둥근 날밑 · 감은 손잡이
      G.rect(x, top + 2, 1, hy - top - 3, bl);
      G.set(x + 1, top + 1, bl);
      G.set(x + 1, top, lt(bl, 0.5));
      G.rect(x - 1, hy - 1, 3, 1, '#2a2430');
      G.rect(x, hy + 1, 1, 2, '#3a2a4a');
      return;
    }
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
  if (def.named === 'star_walwal') {
    // FIVESTARS ④ 왈왈콩선생: 강아지 발자국 성표
    G.rect(x, top + 2, 1, bottom - top - 2, SHAFT);
    G.set(x, top + 4, def.accent, 'flat');
    return pawTop(G, x, top, glow);
  }
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
  arcC(G, cx, cy, r, a0, a1, '#fffbea', mix(base, WHITE, 0.45), mix(base, '#c8d0e0', 0.5));
}
/** 호 궤적 (바깥 · 안 · 꼬리 색 · 머리 쪽 두께) — HERODOT 3 전설 궤적도 이걸로 */
export function arcC(G: GridT, cx: number, cy: number, r: number, a0: number, a1: number, outer: string, inner: string, tail: string, thick = 1.9) {
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++)
    for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dx, -dy); // 0 = 위 · +π/2 = 오른쪽
      if (a < a0 || a > a1) continue;
      const t = (a - a0) / (a1 - a0);
      // 꼬리 쪽은 가늘게 (1칸) · 머리 쪽은 2칸
      const th = t < 0.35 ? Math.min(0.9, thick) : thick;
      if (d > r + 0.5 || d < r + 0.5 - th) continue;
      G.set(x, y, t < 0.35 ? tail : d > r - 0.5 ? outer : inner, 'fx');
    }
}

function frontArm(G: GridT, def: ClassDef, kind: Dot2, pose: Pose2, by: number, SKN: string, oldWeapon: WeaponFn, trail?: () => boolean) {
  const arm = def.arm;
  const w = def.weapon;
  const sit = !!pose.sit;
  const W = (hx: number, hy: number, mode: 'rest' | 'up' | 'fwd' | 'mid' | 'low') => {
    if (!w) return;
    if (w === 'sword') return sword(G, def, hx, hy, mode);
    if (w === 'greatsword') return greatsword(G, def, hx, hy, mode);
    if (w === 'dagger') return dagger(G, hx, hy, mode, def.weaponColor);
    if (w === 'book') return book(G, def, hx, hy + (mode === 'rest' ? 1 : 0));
    if (w === 'axe') return axe2(G, def, hx, hy, mode);
    if (w === 'bow') return bow2(G, def, hx + 2, hy - 8, 18, mode === 'up' ? 1 : mode === 'mid' ? 2 : 0);
    if (w === 'staff' && kind !== 'cleric') {
      // 마법사 지팡이: 빛 구슬
      if (mode === 'rest') return orbStaff(G, def, hx + 1, by - 9, 27, 1, pose.tw);
      if (mode === 'up') return orbStaff(G, def, hx + 1, hy - 10, hy + 6, 1);
      if (mode === 'fwd' || mode === 'mid') {
        G.line(hx + 1, hy + 2, hx + 3, hy - 6, SHAFT);
        return orbStaff(G, def, hx + 4, hy - 9, hy - 9 + 2, 2);
      }
      return orbStaff(G, def, hx + 1, hy - 6, hy + 8, 0);
    }
    if (w === 'holy' || w === 'staff') {
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
    else if (w === 'staff') orbStaff(G, def, 19, by - 9, 27, r, 1);
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
  if (w === 'bow' && pose.atk) {
    // 활: 겨눔(당김) → 놓음(화살 줄) → 앞으로 → 내림
    const a = pose.atk;
    if (a === 4) {
      G.rect(15, by + 1, 2, 3, arm);
      G.rect(17, by + 2, 2, 2, SKN);
      return bow2(G, def, 19, by - 6, 18, 0);
    }
    G.rect(15, by + 1, 3, 2, arm);
    G.rect(18, by + 1, 2, 2, SKN);
    if (a === 1) G.rect(13, by + 2, 2, 2, SKN);
    // FIVESTARS ④: 다섯 별 사냥꾼(따뜻한밤)은 놓는 순간 궤적 (다른 전설 활은 예전 그대로)
    if (a === 3 && def.named?.startsWith('star_')) trail?.();
    return bow2(G, def, 19, by - 7, 18, a === 1 ? 1 : a === 3 ? 2 : 0);
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
    if (!trail?.()) swingArc(G, 13.5, by + 1.5, r, -0.9, 2.1, base);
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
  if (!sit && w === 'greatsword') {
    // 양손 대검 (FIVESTARS ④ 웅스): 팔을 굽혀 손이 어깨 앞 · 날은 어깨 위 뒤로 크게
    G.rect(15, by + 1, 2, 2, arm);
    greatsword(G, def, 16, by + 1 + Math.min(0, aF), 'rest');
    G.rect(16, by + 1 + Math.min(0, aF), 2, 2, SKN);
    return;
  }
  if (!sit && kind === 'cleric' && (w === 'holy' || w === 'staff' || w === 'book')) {
    // 사제: 소매 끝 금 테 · 손을 몸 밖으로 — 지팡이를 쥐거나 책을 든다
    G.rect(15, by + 1, 2, 3, dk(arm, 0.08));
    G.rect(16, by + 2 + aF, 1, 2, dk(arm, 0.08));
    G.rect(16, by + 3 + aF, 1, 1, def.accent);
    G.rect(17, by + 2 + aF, 2, 2, SKN);
    if (w === 'book') return book(G, def, 18, by + 6 + aF);
    return holyStaff(G, def, 19, by - 8, 27, 1);
  }
  if (!sit && (w === 'staff' || w === 'axe' || w === 'bow')) {
    const sl = def.robe ? dk(arm, 0.08) : arm;
    G.rect(15, by + 1, 2, 3, sl);
    G.rect(16, by + 2 + aF, 1, 2, sl);
    // 마법사: 종 모양 넓은 소매
    if (kind === 'mage') G.rect(15, by + 3 + aF, 3, 2, sl);
    if (w === 'staff') {
      orbStaff(G, def, 19, by - 9, 27, 1, pose.tw);
      G.rect(18, by + 2 + aF, 2, 2, SKN);
    } else if (w === 'axe') {
      axe2(G, def, 16, by + 2, 'rest');
      G.rect(18, by + 2 + aF, 2, 2, SKN);
    } else {
      bow2(G, def, 19, by - 6, 18, 0);
      G.rect(18, by + 2 + aF, 2, 2, SKN);
    }
    return;
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


// ───────── 2단계: 마법사 · 전사 · 사냥꾼 · 노주인 · 우체부 · 나 ─────────

/** 긴 머리·땋은 머리·양갈래: 몸 뒤(앞모습) / 등 위(뒷모습) · 끝은 1프레임 늦게 */
function hairBack(G: GridT, def: ClassDef, hx: number, hy: number, by: number, pose: Pose2, back: boolean) {
  const H = def.hair;
  const tr = pose.trail ?? 0;
  const st = def.style;
  const X = Math.round(hx);
  const Y = Math.round(hy);
  if (st === 'long') {
    if (back) {
      G.rect(X - 5, Y, 11, by + 3 - Y, H);
      G.rect(X - 5 - tr, by + 3, 10, 2, H);
      G.rect(X - 1, Y + 1, 1, by + 2 - Y, dk(H, 0.12));
    } else {
      G.rect(X - 6, Y - 1, 3, by + 3 - Y, H);
      G.rect(X - 6 - tr, by + 2, 3, 2, H);
      G.rect(X + 5, Y - 1, 2, by - Y, H);
    }
  } else if (st === 'braid') {
    const bx = back ? X - 1 : X - 6;
    G.rect(bx, Y, 3, by + 4 - Y, H);
    for (let y = Y + 1; y < by + 4; y += 2) G.set(bx + 1, y, dk(H, 0.18));
    G.rect(bx - tr, by + 4, 3, 2, H);
  } else if (st === 'twin') {
    G.ell(X - 7, Y + 2, 1.8, 3, H);
    G.ell(X + 8, Y + 2, 1.8, 3, H);
  }
}

/** 보이는 머리카락 (모자·두건 밑) · 하이라이트 줄 1개 */
export function hair2(G: GridT, def: ClassDef, hx: number, hy: number, back: boolean) {
  const st = def.style;
  if (st === 'bald' || st === 'none') return;
  const H = def.hair;
  const X = Math.round(hx);
  if (back) {
    G.ell(hx + 0.2, hy - 0.4, 6.6, 6.0, H, null, (_x, y) => y <= hy + 4.5);
    return;
  }
  G.ell(hx + 0.2, hy - 1.3, 6.6, 5.0, H, null, (x, y) => y < hy - 1.5 || (x < hx - 3.5 && y < hy + 3) || (x > hx + 5 && y < hy + 1));
  // 앞머리 끝 들쭉날쭉
  for (const dx of [-2, 1, 3]) G.set(X + dx, Math.round(hy - 1.5), H);
  G.rect(X - 4, Math.round(hy - 5.5), 4, 1, ramp(H, 1), 'flat');
  G.set(X, Math.round(hy - 4.5), ramp(H, 1), 'flat');
}

/** 직업 머리: 마법사 모자 · 전사 뿔 투구 · 사냥꾼 깃털 모자 · 노주인 대머리 · 우체부·나 두건 */
function headgear2(G: GridT, def: ClassDef, kind: Dot2, hx: number, hy: number, back: boolean) {
  const X = Math.round(hx);
  const Y = Math.round(hy);
  if (kind === 'keeper' || def.style === 'bald') {
    // 대머리: 반짝 · 양옆 흰 머리
    const W = def.hair;
    G.rect(X - 6, Y - 1, 2, 4, W);
    G.rect(X + 5, Y - 1, 2, 3, W);
    G.set(X - 5, Y - 2, W);
    if (back) G.rect(X - 5, Y + 1, 11, 3, W);
    else {
      G.rect(X - 3, Y - 5, 3, 1, lt(def.skin ?? SKIN, 0.55), 'flat');
      G.set(X - 4, Y - 4, lt(def.skin ?? SKIN, 0.4), 'flat');
    }
    if (kind === 'keeper') return;
  } else hair2(G, def, hx, hy, back);
  if (kind === 'mage') {
    // 챙 넓은 모자 · 끝이 뒤로 살짝 꺾임 · 금 띠
    const C = def.hatc ?? '#6a3ea6';
    const b = Y - 3;
    G.rect(X - 8, b, 17, 1, C);
    G.rect(X - 6, b - 1, 13, 1, C);
    G.rect(X - 4, b - 2, 8, 1, def.accent, 'flat');
    G.rect(X - 3, b - 3, 6, 1, C);
    G.rect(X - 2, b - 4, 4, 1, C);
    G.rect(X - 2, b - 5, 3, 1, C);
    G.rect(X - 3, b - 6, 3, 1, C);
    G.rect(X - 5, b - 7, 3, 1, C);
    G.set(X - 6, b - 6, C);
    G.set(X - 7, b - 5, dk(C, 0.15));
    G.set(X - 1, b - 4, lt(C, 0.35), 'flat');
    G.set(X - 2, b - 6, lt(C, 0.3), 'flat');
    G.rect(X - 6, b + 1, 13, 1, dk(C, 0.35));
    return;
  }
  if (kind === 'dwarf') {
    const M = def.helm ?? '#a7afbf';
    // 옆머리(구레나룻) — 머리색이 보이게
    G.rect(X - 6, Y - 1, 2, 4, def.hair);
    G.rect(X + 5, Y - 1, 2, 3, def.hair);
    G.ell(hx + 0.2, hy - 1.4, 6.9, 5.4, M, null, (_x, y) => y < hy - 1.5 || (back && y < hy + 3));
    G.rect(X - 6, Y - 2, 13, 1, dk(M, 0.2));
    G.rect(X, Y - 7, 1, 5, lt(M, 0.35), 'flat');
    for (const dx of [-4, 4]) G.set(X + dx, Y - 2, '#e8c46a', 'flat');
    // 뿔: 양옆에서 위로 휘어
    for (const sgn of [-1, 1]) {
      const bx = sgn < 0 ? X - 7 : X + 7;
      const pts: [number, number][] = [[0, -2], [0, -3], [sgn, -2], [sgn, -3], [sgn, -4], [sgn * 2, -3], [sgn * 2, -4], [sgn * 2, -5], [sgn * 2, -6], [sgn, -7]];
      for (const [dx, dy] of pts) G.set(bx + dx, Y + dy, HORN);
      G.set(bx + sgn, Y - 7, lt(HORN, 0.5), 'flat');
      G.set(bx, Y - 2, dk(HORN, 0.25));
    }
    return;
  }
  if (kind === 'hunter') {
    // 초록 모자: 앞으로 챙 · 뒤로 뾰족 · 깃털
    const C = def.bandana ?? '#4f8a3a';
    G.ell(hx + 0.2, hy - 2.4, 6.8, 4.2, C, null, (_x, y) => y < hy - 1.5);
    G.rect(X - 6, Y - 2, 14, 1, dk(C, 0.12));
    if (!back) G.rect(X + 5, Y - 2, 4, 1, C);
    G.rect(X - 8, Y - 3, 2, 1, C);
    G.set(X - 9, Y - 2, C);
    const fe: [number, number][] = [[-3, -6], [-4, -7], [-4, -8], [-5, -8], [-5, -9], [-6, -9], [-6, -10], [-3, -7]];
    for (const [dx, dy] of fe) G.set(X + dx, Y + dy, FEATHER);
    G.set(X - 4, Y - 8, lt(FEATHER, 0.45), 'flat');
    G.set(X - 5, Y - 9, lt(FEATHER, 0.45), 'flat');
    return;
  }
  if (kind === 'post' || kind === 'hero') {
    if (!def.bandana) return;
    // 두건: 정수리를 덮고 · 우체부는 뒤로 매듭 꼬리 · 나는 위쪽에 리본 매듭
    const C = def.bandana;
    G.ell(hx + 0.2, hy - 2.2, 6.8, 4.3, C, null, (_x, y) => y < hy - 1.5);
    G.rect(X - 6, Y - 2, 13, 1, dk(C, 0.12));
    if (kind === 'post') {
      for (const [dx, dy] of [[-3, -4], [1, -5], [3, -3], [-1, -3], [5, -4]]) G.set(X + dx, Y + dy, lt(C, 0.55), 'flat');
      G.rect(X - 8, Y - 2, 2, 2, C);
      G.set(X - 9, Y, C);
    } else {
      const k: [number, number][] = [[5, -6], [6, -7], [7, -7], [7, -6], [6, -5], [4, -7], [8, -8], [8, -5]];
      for (const [dx, dy] of k) G.set(X + dx, Y + dy, C);
      G.set(X + 6, Y - 6, dk(C, 0.25));
    }
  }
}

/** 전사 수염 땋기: 턱에서 두 갈래로 가슴까지 · 끝에 금 고리 */
function beardBraids(G: GridT, B: string, gold: string, hx: number, hy: number, by: number) {
  const X = Math.round(hx);
  for (const bx of [X - 3, X + 2]) {
    for (let y = Math.round(hy + 5); y < by + 6; y++) {
      G.rect(bx, y, 2, 1, (y & 1) === 0 ? B : dk(B, 0.18));
    }
    G.rect(bx, by + 6, 2, 1, gold);
    G.set(bx, by + 7, B);
  }
}

/** 전사 몸: 어깨 넓게 (사슬 어깨받이) · 가죽 · 넓은 벨트 + 큰 버클 */
function dwarfBody(G: GridT, def: ClassDef, hx: number, by: number, legTop: number, back: boolean) {
  const c = def.cloth;
  const bot = legTop - by > 12 ? by + 6 : Math.min(by + 8, Math.max(by + 6, legTop + 1));
  G.rect(5, by, 12, bot - by + 1, c);
  // 사슬 어깨받이
  G.rect(3, by, 4, 3, def.arm);
  G.rect(15, by, 4, 3, def.arm);
  G.set(4, by + 1, lt(def.arm, 0.3), 'flat');
  G.set(16, by + 1, lt(def.arm, 0.3), 'flat');
  // 넓은 가죽 벨트 + 큰 금 버클
  G.rect(5, by + 5, 12, 2, '#5a3420');
  if (!back) {
    G.rect(Math.round(hx) - 1, by + 5, 3, 2, def.accent);
    G.set(Math.round(hx), by + 5, lt(def.accent, 0.5), 'flat');
  }
}

/** 노주인 · 나: 셔츠 + 앞치마 (앞치마 끈 · 주머니) — 뒤에서는 끈이 X로 */
function apronBody(G: GridT, def: ClassDef, kind: Dot2, hx: number, by: number, legTop: number, back: boolean) {
  const shirt = def.apron2 ? def.arm : def.cloth;
  const ap = def.apron2 ?? def.apron ?? def.accent;
  const short = legTop - by > 12 ? false : legTop - by < 8;
  const bot = short ? by + 6 : Math.min(by + 9, Math.max(by + 6, legTop + 1));
  const X = Math.round(hx);
  G.rect(7, by, 8, 1, shirt);
  G.rect(6, by + 1, 10, bot - by, shirt);
  if (back) {
    G.line(7, by, 10, by + 5, ap);
    G.line(14, by, 11, by + 5, ap);
    G.rect(X - 1, by + 5, 3, 1, ap);
    G.set(X - 2, by + 6, ap);
    G.set(X + 2, by + 6, ap);
    return;
  }
  // 가슴받이 + 끈
  G.rect(X - 2, by + 1, 5, 4, ap);
  G.set(X - 3, by, ap);
  G.set(X + 3, by, ap);
  // 치마 (무릎까지 · 노주인은 더 길게)
  const end = short ? bot : Math.min(26, bot + (kind === 'keeper' ? 3 : 2));
  G.rect(6, by + 5, 10, end - by - 4, ap);
  G.rect(6, by + 5, 10, 1, dk(ap, 0.12));
  // 주머니
  G.rect(X - 1, by + 7, 3, 2, dk(ap, 0.1));
  G.rect(X - 1, by + 7, 3, 1, dk(ap, 0.2));
  // 나: 목에 두건 색 스카프
  if (def.bandana && kind === 'hero') {
    G.rect(X - 1, by, 3, 1, def.bandana);
    G.set(X, by + 1, def.bandana);
  }
}

/** 우체부 어깨 가방: 오른쪽 어깨 → 왼쪽 엉덩이 끈 · 가죽 가방 (금 걸쇠) */
function mailBag(G: GridT, by: number, back: boolean, gold: string) {
  const strap = '#6b4128';
  if (!back) G.line(15, by, 7, by + 6, strap);
  else G.line(6, by, 14, by + 6, strap);
  const bx = back ? 14 : 3;
  G.rect(bx, by + 5, 5, 4, '#9a6436');
  G.rect(bx, by + 5, 5, 1, dk('#9a6436', 0.2));
  if (!back) G.set(bx + 2, by + 6, gold, 'flat');
}

/** 사냥꾼 화살통 (등 · 앞모습은 왼쪽 어깨 뒤로 화살 깃) */
export function quiver(G: GridT, by: number, back: boolean) {
  const q = '#7a4a2a';
  const x = back ? 7 : 3;
  G.rect(x, by - 1, 3, 9, q);
  G.rect(x, by + 6, 3, 1, dk(q, 0.25));
  G.rect(x, by + 1, 3, 1, '#c9a04a');
  // 화살 깃 (빨강·흰색)
  G.rect(x, by - 3, 1, 2, '#e85a4a');
  G.rect(x + 1, by - 4, 1, 3, '#efe2c6');
  G.rect(x + 2, by - 3, 1, 2, '#e85a4a');
  if (back) G.line(x + 2, by - 1, 15, by + 5, '#6b4128');
}

/** 큰 도끼 (한쪽 큰 날 + 뒤 가시) — hx,hy = 손 왼쪽 위 */
function axe2(G: GridT, def: ClassDef, hx: number, hy: number, mode: 'rest' | 'up' | 'fwd' | 'mid' | 'low') {
  const b = def.weaponColor ?? '#c9d1dc';
  const edge = lt(b, 0.45);
  const blade = (x0: number, y0: number, up: boolean) => {
    // 6줄 날: 가운데가 넓다 (x0 = 자루 옆 첫 칸)
    const rows = [2, 3, 4, 4, 4, 3, 2];
    rows.forEach((w, i) => G.rect(x0, y0 + i, w, 1, b));
    G.rect(x0 + 3, y0 + 2, 1, 3, edge, 'flat');
    G.set(x0 + 2, y0 + 1, edge, 'flat');
    G.set(x0 + 2, y0 + 5, edge, 'flat');
    void up;
  };
  if (mode === 'rest') {
    G.rect(hx + 2, hy - 8, 1, 14, HANDLE);
    blade(hx + 3, hy - 9, true);
    G.rect(hx + 1, hy - 7, 1, 2, dk(b, 0.1));
    return;
  }
  if (mode === 'up') {
    G.line(hx + 1, hy + 1, hx - 2, hy - 8, HANDLE);
    G.rect(hx - 5, hy - 11, 3, 1, b);
    G.rect(hx - 6, hy - 10, 4, 3, b);
    G.rect(hx - 5, hy - 7, 3, 1, b);
    G.rect(hx - 6, hy - 10, 1, 3, edge, 'flat');
    return;
  }
  if (mode === 'mid') {
    G.line(hx + 1, hy, hx + 3, hy - 4, HANDLE);
    blade(hx + 2, hy - 9, true);
    return;
  }
  if (mode === 'fwd') {
    G.line(hx + 1, hy + 1, hx + 3, hy + 4, HANDLE);
    G.rect(hx + 2, hy + 4, 3, 4, b);
    G.rect(hx + 3, hy + 8, 2, 1, b);
    G.rect(hx + 4, hy + 4, 1, 4, edge, 'flat');
    return;
  }
  G.rect(hx + 1, hy + 1, 1, 6, HANDLE);
  G.rect(hx + 2, hy + 4, 3, 4, b);
  G.rect(hx + 4, hy + 4, 1, 4, edge, 'flat');
}

/** 마법사 지팡이: 나무 자루 + 끝에 빛 구슬 (둘레 'fx' · tw = 1px 반짝) */
function orbStaff(G: GridT, def: ClassDef, x: number, top: number, bottom: number, glow: number, tw = 0) {
  if (def.named === 'star_ikamolly') {
    // FIVESTARS ④ 이카몰리: 끝에 바람개비 (tw = 한 칸 돈 모양)
    G.rect(x, top + 2, 1, bottom - top - 2, SHAFT);
    pinwheelTop(G, x, top, tw ? 1 : 0);
    if (glow >= 2) for (const [dx, dy] of [[-3, -2], [3, 2], [0, -4]]) G.set(x + dx, top + dy, '#bfe8ff', 'fx');
    return;
  }
  const o = def.weaponColor ?? '#7fe6ff';
  G.rect(x, top + 2, 1, bottom - top - 2, SHAFT);
  G.set(x - 1, top + 2, SHAFT);
  G.set(x + 1, top + 2, SHAFT);
  G.rect(x - 1, top - 1, 3, 3, o, 'flat');
  G.set(x - 1, top - 1, WHITE, 'flat');
  G.set(x, top, lt(o, 0.5), 'flat');
  const gl = mix(o, WHITE, 0.5);
  if (glow >= 1) for (const [dx, dy] of [[0, -2], [-2, 0], [2, 0]]) G.set(x + dx, top + dy, gl, 'fx');
  if (glow >= 2) for (const [dx, dy] of [[-2, -2], [2, -2], [0, -3], [-3, 0], [3, 0], [2, 2], [-2, 2]]) G.set(x + dx, top + dy, gl, 'fx');
  if (glow >= 3) for (const [dx, dy] of [[0, -4], [-4, 0], [4, 0], [-3, -3], [3, -3]]) G.set(x + dx, top + dy, WHITE, 'fx');
  if (tw) G.set(x + 2, top - 2, WHITE, 'fx');
  if (def.named === 'scarlet') {
    // 불꽃 지팡이: 구슬 위로 불꽃 혀
    G.set(x, top - 2, '#ffd36b', 'flat');
    G.set(x - 1, top - 3, '#ff7a2a', 'flat');
    G.set(x, top - 3, '#ff7a2a', 'flat');
    G.set(x, top - 4, '#ffb04a', 'flat');
  }
}

/** 큰 활 (몸 옆 세로) · 시위 · aim = 화살을 걸고 당김 */
function bow2(G: GridT, def: ClassDef, x: number, top: number, len: number, aim: 0 | 1 | 2) {
  const wd = def.weaponColor ?? '#9a6a3c';
  const mid = top + Math.round(len / 2);
  for (let i = 0; i <= len; i++) G.set(x + Math.round(Math.sin((i / len) * Math.PI) * 2.2), top + i, wd);
  G.set(x, top, dk(wd, 0.2));
  G.set(x, top + len, dk(wd, 0.2));
  if (aim === 1) {
    // 당긴 시위 + 화살
    G.line(x, top + 1, x - 3, mid, STRING, 'flat');
    G.line(x - 3, mid, x, top + len - 1, STRING, 'flat');
    G.rect(x - 5, mid, 9, 1, '#d8c8a8', 'flat');
    G.set(x + 4, mid, '#c9d1dc', 'flat');
    G.set(x - 5, mid - 1, '#e85a4a', 'flat');
    G.set(x - 5, mid + 1, '#e85a4a', 'flat');
    return;
  }
  G.rect(x, top + 1, 1, len - 1, STRING, 'flat');
  if (aim === 2) {
    // 놓은 순간: 화살이 날아간 자리 (깔끔한 줄 2색)
    G.rect(x + 3, mid, 3, 1, '#fffbea', 'fx');
    G.rect(x + 1, mid, 2, 1, mix('#d8c8a8', WHITE, 0.4), 'fx');
  }
}

/** 사제 뒷모습: 베일 가장자리 안쪽 1px 금 테 (앞의 얼굴 창 테처럼) */
function veilRim(G: GridT, gold: string) {
  // R1 판정: 뒤 베일 가장자리 왼쪽·오른쪽·아래 1px 금색 선 (앞모습 테와 같은 색)
  const g = G.g;
  const isV = (x: number, y: number) => g[y]?.[x]?.c === VEIL;
  const out: [number, number][] = [];
  for (let y = 0; y < G.h; y++)
    for (let x = 0; x < G.w; x++) if (isV(x, y) && [[1, 0], [-1, 0], [0, 1]].some(([dx, dy]) => !g[y + dy]?.[x + dx])) out.push([x, y]);
  for (const [x, y] of out) g[y][x] = { c: gold, tag: 'flat' };
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
  const head = headColor(def, kind);
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
  const head = headColor(def, kind);
  G.ell(4.6, 7, 4.6, 4.4, head, null, (x) => x < 5);
  if (kind === 'dwarf' && def.beard) G.ell(8, 10, 2.6, 2.4, def.beard);
  if (kind === 'mage') G.rect(0, 4, 2, 4, def.hatc ?? '#6a3ea6');
  if (kind === 'knight') G.rect(0, 5, 2, 3, PLUME);
  if (kind === 'cleric') G.rect(5, 3, 1, 9, def.accent);
  G.rect(7, 6, 1, 2, EYE, 'eye');
  G.rect(7, 9, 1, 2, EYE, 'eye');
  return G;
}

/** 구르기·누움 머리 색: 투구 · 베일 · 두건 · 모자 */
function headColor(def: ClassDef, kind: Dot2): string {
  if (def.named && NAMED[def.named]?.head === 'hair') return def.style === 'bald' ? def.skin ?? SKIN : def.hair;
  switch (kind) {
    case 'knight':
      return STEEL;
    case 'cleric':
      return VEIL;
    case 'rogue':
      return def.hood ?? '#4f8a3a';
    case 'mage':
      return def.hatc ?? '#6a3ea6';
    case 'dwarf':
      return def.helm ?? '#a7afbf';
    case 'keeper':
      return def.skin ?? SKIN;
    default:
      return def.bandana ?? (def.style === 'bald' ? def.skin ?? SKIN : def.hair);
  }
}
