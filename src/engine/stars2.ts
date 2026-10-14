// FIVESTARS ④ — 「다섯 별의 원정대」 마을·전투 도트 (HERODOT §6 신화 단계: 세로 +2 · 은빛 외곽선 · 전용 대기 동작 · 공격 궤적 · 무지갯빛 이름표)
//  기준 = 신화 초상 asset_raw/fivestars/s_<id>.png (색은 초상에서 뽑음) + FIVESTARS_SPEC §4.
//  그림은 HERODOT 전설과 같은 길(named2.ts NAMED · sprites2.ts drawChar2)로 코드가 찍는다 — 이 파일은 다섯 명의 소품·동작·궤적만.
//  어디에 쓰나: adventurers.ts appearance()가 starId 손님에게 def.named = 'star_<id>' 를 넣는다 (fiveStars 켰을 때만 · 끄면 예전 그대로)
import type { ClassDef } from '../data/classes';
import { STARS, type StarId } from '../data/fivestars';
import { dk, lt, mix, ramp, type GridT } from './pixel';
import type { NamedLook, NCtx } from './named2';
import { arcC } from './sprites2';

/** NAMED 키 */
export const starKey = (id: StarId) => 'star_' + id;
/** 공격 궤적 색 (FIVESTARS §4: 웅스 금빛 · 고느끼 분홍 · 이카몰리 하늘색 · 왈왈콩선생 흰빛 · 따뜻한밤 주황 등불색) = data/fivestars STARS[id].trail */
export const starTrailColor = (id: StarId) => STARS[id].trail;

// 초상에서 뽑은 색
const GOLD = '#d8a040';
const PINK = '#ef5f9f';
const SKY = '#7cc4e4';
const RED_CAPE = '#c8303a';

export const STAR_LOOKS: Record<string, NamedLook> = {
  // 웅스: 짧은 흑발 · 구릿빛 피부 · 어두운 강철 갑옷(금 테 어깨받이) · 목에 흰 수건(온천) · 양손 대검을 어깨에
  star_woongs: {
    tier: 'legend', star: 'woongs', head: 'hair',
    patch: { style: 'short', hair: '#1e1a1a', skin: '#c8875a', cloth: '#4a4a56', arm: '#8a909c', pants: '#3a3238', boots: '#3a2a22', accent: GOLD, towel: '#f4f0e6', weapon: 'greatsword', dwarf: false, beard: undefined, helm: undefined },
    extras: ['messy', 'goldTrim'], noBraids: true, sig: 'plant', sigN: 4, trail: 'star',
  },
  // 고느끼: 검남색 두건(분홍 테) 밖으로 분홍 머리 끝 · 분홍 눈 · 쌍단검
  star_gonu: {
    tier: 'legend', star: 'gonu', head: 'class',
    patch: { hair: '#ef6f9a', hood: '#2c2640', cloth: '#2a2236', arm: '#3a2e4a', pants: '#24202e', boots: '#2a2030', accent: PINK, dual: true, weapon: 'dagger', dwarf: false },
    extras: ['pinkTips', 'hoodTrim', 'pinkEyes'], sig: 'twirl', sigN: 4, trail: 'star',
  },
  // 이카몰리: 바람에 날리는 긴 갈색 머리 · 둥근 안경 · 크림색 로브 + 하늘색 목도리 · 바람개비 지팡이
  star_ikamolly: {
    tier: 'legend', star: 'ikamolly', head: 'hair',
    patch: { style: 'long', hair: '#8a4a36', cloth: '#f0e6c8', arm: '#f0e6c8', pants: '#c8b890', boots: '#6a4a3a', accent: SKY, hat: undefined, hatc: undefined, weapon: 'staff', elf: false, glassesColor: '#6a4a3a' },
    extras: ['windHair', 'skyScarf'], sig: 'pinwheel', sigN: 4, walk: 'hair', trail: 'star',
  },
  // 왈왈콩선생(여): 흰 사제 두건 + 강아지 귀 · 꿀빛 머리 · 흰 로브(금 테) · 강아지 발자국 성표
  star_walwal: {
    tier: 'legend', star: 'walwal', head: 'class',
    patch: { hair: '#e0a060', cloth: '#f6f3ea', arm: '#f6f3ea', pants: '#e0d8c4', boots: '#a07850', accent: '#e0b050', weapon: 'holy', dwarf: false, cape: undefined },
    extras: ['puppyEars'], sig: 'wag', sigN: 4, walk: 'ears', trail: 'star',
  },
  // 따뜻한밤: 덥수룩한 적갈색 머리 · 내린 붉은 두건 + 붉은 망토 · 가죽 갑옷 · 장궁 · 허리 등불
  star_warmnight: {
    tier: 'legend', star: 'warmnight', head: 'hair',
    patch: { style: 'short', hair: '#8a3a28', cloth: '#6a3a2e', arm: '#7a4436', pants: '#4a2c26', boots: '#3a2420', accent: GOLD, cape: RED_CAPE, bandana: undefined, weapon: 'bow', dwarf: false },
    extras: ['spiky', 'hoodDown', 'lanternBelt'], sig: 'lantern', sigN: 4, walk: 'cape', trail: 'star',
  },
};

/** 시그니처 동작 몸 자세 (sigPoses에서) */
export function starSigPose(L: NamedLook, i: number): { bob?: number; blink?: number; face?: 'shout' } {
  if (L.sig === 'plant') return i === 3 ? { bob: 1 } : i === 4 ? { bob: 1, blink: 1 } : {};
  if (L.sig === 'lantern') return i === 3 ? { bob: -1 } : {};
  if (L.sig === 'wag') return i % 2 === 0 ? { bob: 1 } : {};
  return {};
}

const isS = (c: NCtx, name: string) => c.L.sig === name && !!c.pose.sig;

// ───────── 몸 뒤 · 머리 · 앞 ─────────

/** 몸 뒤(앞모습): 이카몰리 바람 머리 */
export function starBehind(c: NCtx) {
  const { G, def, by } = c;
  if (c.L.extras.includes('windHair')) {
    // 바람에 날리는 머리: 몸 뒤 왼쪽으로 물결 (걸을 때 · 바람개비 동작 때 끝이 흔들림)
    const X = Math.round(c.hx);
    const Y = Math.round(c.hy);
    const w = c.pose.wf !== undefined ? c.pose.wf % 2 : c.pose.sig ? c.pose.sig % 2 : 0;
    const H = def.hair;
    G.rect(X - 8, Y, 3, by + 2 - Y, H);
    G.rect(X - 9, Y + 2, 1, by - Y - 1, H);
    for (const [dx, dy] of [[-10, 3], [-10, 4], [-11, 5 + w], [-10, 7], [-11, 8 + w], [-12, 9 + w]] as [number, number][]) G.set(X + dx, Y + dy, H);
    G.set(X - 7, Y + 2, ramp(H, 1), 'flat');
    G.set(X - 9, Y + 5, ramp(H, 1), 'flat');
  }
}

/** 머리 소품 (직업 머리 장비 · 머리카락 다음) */
export function starHead(c: NCtx) {
  const { G, def, back } = c;
  const X = Math.round(c.hx);
  const Y = Math.round(c.hy);
  const has = (k: string) => c.L.extras.includes(k);
  if (has('pinkTips')) {
    // 두건 위 양쪽으로 삐친 분홍 머리 끝(초상의 양갈래) · 두건 밑 옆머리 끝도 분홍
    const P1 = def.hair;
    const P2 = lt(def.hair, 0.35);
    for (const [dx, dy] of [[-7, -5], [-8, -6], [-9, -6], [-9, -7], [-8, -7]] as [number, number][]) G.set(X + dx, Y + dy, P1);
    for (const [dx, dy] of [[7, -5], [8, -6], [9, -6], [9, -7], [8, -7]] as [number, number][]) G.set(X + dx, Y + dy, P1);
    G.set(X - 9, Y - 7, P2, 'flat');
    G.set(X + 9, Y - 7, P2, 'flat');
    if (!back) {
      G.rect(X - 7, Y + 3, 1, 3, P1);
      G.rect(X + 7, Y + 3, 1, 3, P1);
      G.set(X - 7, Y + 5, P2, 'flat');
      G.set(X + 7, Y + 5, P2, 'flat');
    }
  }
  if (has('hoodTrim') && !back) {
    // 두건 얼굴 창 가장자리 분홍 테 (초상의 분홍 안감)
    const H = def.hood!;
    const pts: [number, number][] = [];
    for (let y = Y - 4; y <= Y + 6; y++)
      for (let x = X - 6; x <= X + 7; x++) {
        const p = G.g[y + G.oy]?.[x + G.ox];
        if (!p || p.c !== H) continue;
        const n = [[1, 0], [-1, 0], [0, 1]].some(([dx, dy]) => {
          const q = G.g[y + dy + G.oy]?.[x + dx + G.ox];
          return !!q && q.c !== H && q.c !== dk(H, 0.2) && q.c !== def.hair && q.c !== lt(def.hair, 0.35);
        });
        if (n && y >= Y - 3) pts.push([x, y]);
      }
    for (const [x, y] of pts) G.set(x, y, def.accent);
  }
  if (has('puppyEars')) {
    // 두건 위 양옆으로 늘어진 크림색 강아지 귀 (걸을 때 · 흔들 때 귀 끝이 1px 들썩)
    const E = '#e8c48e';
    const E2 = '#c89a62';
    const f = (c.pose.wf !== undefined && c.pose.wf % 2) || (isS(c, 'wag') && c.pose.sig! % 2 === 0) ? 1 : 0;
    for (const s of [-1, 1]) {
      const bx = s < 0 ? X - 6 : X + 6;
      G.rect(Math.min(bx, bx + s * 2), Y - 6, 3, 2, E);
      G.rect(bx + (s < 0 ? -3 : 1), Y - 4, 3, 4 - f, E);
      G.rect(bx + (s < 0 ? -3 : 3), Y - 1 - f, 1, 2, E2);
      if (!back) G.set(bx + (s < 0 ? -2 : 2), Y - 3, '#f0c8b8', 'flat');
    }
  }
}

/** 얼굴 다음 (목·가슴·허리 소품) */
export function starFront(c: NCtx) {
  const { G, def, by, back } = c;
  const X = Math.round(c.hx);
  const has = (k: string) => c.L.extras.includes(k);
  if (has('pinkEyes') && !back) {
    // 반짝 눈의 보랏빛을 분홍으로 (초상 분홍 눈)
    for (const row of G.g) for (const p of row) if (p && p.tag === 'eye' && p.c === '#c8b0ff') p.c = '#ff6fae';
  }
  if (has('goldTrim')) {
    // 강철 어깨받이 금 테 (초상)
    for (const x of [3, 4, 5, 6]) G.set(x, by + 2, GOLD, 'flat');
    for (const x of [15, 16, 17, 18]) G.set(x, by + 2, GOLD, 'flat');
    G.set(back ? 16 : 4, by, lt(def.arm, 0.55), 'flat');
  }
  if (has('skyScarf')) {
    // 하늘색 목도리 (앞: 목 + 늘어진 끝 · 뒤: 목만)
    G.rect(X - 4, by - 1, 9, 2, SKY);
    G.rect(X - 2, by - 1, 4, 1, lt(SKY, 0.4), 'flat');
    if (!back) {
      G.rect(X + 2, by + 1, 2, 3, SKY);
      G.set(X + 3, by + 4, dk(SKY, 0.15));
    }
  }
  if (has('hoodDown')) {
    // 내린 붉은 두건: 목 둘레 붉은 깃
    const C = def.cape ?? RED_CAPE;
    G.rect(X - 5, by - 1, 11, 2, C);
    G.rect(X - 4, by - 1, 9, 1, lt(C, 0.2));
    if (back) G.rect(X - 4, by + 1, 9, 2, dk(C, 0.08));
  }
  if (has('lanternBelt') && !isS(c, 'lantern') && !c.pose.sit) {
    // 허리(왼쪽) 등불: 밤엔 마을이 이 자리에 2칸 빛을 더한다 (render.ts)
    lanternDot(G, back ? 15 : 5, by + 5, false);
  }
}

/** 작은 등불 (x,y = 고리 위치 · lit = 둘레 빛) */
export function lanternDot(G: GridT, x: number, y: number, lit: boolean) {
  const F = '#3a2a20';
  G.set(x + 1, y, F);
  G.rect(x, y + 1, 3, 1, F);
  G.rect(x, y + 2, 3, 3, F);
  G.rect(x + 1, y + 2, 1, 2, '#ffd36b', 'flat');
  G.set(x + 1, y + 2, '#fff3c0', 'flat');
  G.rect(x, y + 5, 3, 1, dk(F, 0.2));
  if (lit) for (const [dx, dy] of [[-1, 2], [3, 2], [1, 0], [-1, 4], [3, 4], [1, -1]] as [number, number][]) G.set(x + dx, y + dy, '#ffe08a', 'fx');
}

// ───────── 무기 모양 ─────────

/** 양손 대검 (새 무기 모양 `greatsword` · 방패 없음) — hx,hy = 손 왼쪽 위 · 날 2px + 금 날밑 + 긴 손잡이 */
export function greatsword(G: GridT, def: ClassDef, hx: number, hy: number, mode: 'rest' | 'up' | 'fwd' | 'mid' | 'low') {
  const bl = def.weaponColor ?? '#dfe6f0';
  const sh = ramp(bl, -1);
  const gd = '#e0b050';
  const grip = '#5a3a2a';
  const blade = (x0: number, y0: number, x1: number, y1: number) => {
    G.line(x0, y0, x1, y1, bl);
    G.line(x0 + 1, y0, x1 + 1, y1, sh);
    G.set(x1, y1, lt(bl, 0.6));
  };
  if (mode === 'rest') {
    // 어깨에 걸침: 손(어깨 앞)에서 위 뒤로 비스듬히 크게
    G.line(hx, hy + 2, hx + 1, hy, grip);
    G.set(hx - 1, hy + 3, gd);
    blade(hx + 2, hy - 2, hx + 6, hy - 13);
    G.line(hx, hy - 2, hx + 4, hy - 1, gd);
    return;
  }
  if (mode === 'up') {
    // 들어 올림: 머리 위 뒤로 (두 손)
    G.line(hx + 1, hy + 1, hx + 1, hy - 1, grip);
    G.set(hx + 1, hy + 2, gd);
    G.line(hx - 1, hy - 2, hx + 3, hy - 2, gd);
    blade(hx, hy - 3, hx - 5, hy - 14);
    return;
  }
  if (mode === 'mid') {
    // 휘두르는 중: 앞 위로 길게
    G.line(hx, hy + 1, hx + 1, hy, grip);
    G.line(hx, hy - 2, hx + 3, hy + 1, gd);
    blade(hx + 2, hy - 1, hx + 5, hy - 11);
    return;
  }
  if (mode === 'fwd') {
    // 내려침: 앞 아래로 길게
    G.line(hx, hy, hx + 1, hy + 1, grip);
    G.line(hx + 3, hy, hx, hy + 3, gd);
    blade(hx + 2, hy + 2, hx + 5, hy + 10);
    return;
  }
  // low: 거두기 — 칼끝을 땅으로
  G.rect(hx + 1, hy, 1, 2, grip);
  G.rect(hx, hy + 2, 3, 1, gd);
  blade(hx + 1, hy + 3, hx + 2, 26);
}

/** 이카몰리 지팡이 끝 바람개비 (phase 0~3 · 네 날개가 돌아간다) */
export function pinwheelTop(G: GridT, x: number, y: number, phase: number) {
  const A = SKY;
  const B = '#ffffff';
  const C = '#e8603c';
  const cols = [A, C, A, B];
  // 네 날개: 십자(0·2) ↔ 대각(1·3)
  const cross: [number, number][][] = [
    [[0, -1], [0, -2], [1, -2]],
    [[1, 0], [2, 0], [2, 1]],
    [[0, 1], [0, 2], [-1, 2]],
    [[-1, 0], [-2, 0], [-2, -1]],
  ];
  const diag: [number, number][][] = [
    [[1, -1], [2, -2], [2, -1]],
    [[1, 1], [2, 2], [1, 2]],
    [[-1, 1], [-2, 2], [-2, 1]],
    [[-1, -1], [-2, -2], [-1, -2]],
  ];
  const set = phase % 2 ? diag : cross;
  set.forEach((wing, k) => {
    const col = cols[(k + (phase >> 1)) % 4];
    for (const [dx, dy] of wing) G.set(x + dx, y + dy, col, 'flat');
  });
  G.set(x, y, '#ffd36b', 'flat');
}

/** 왈왈콩선생 성표: 금 원판 + 강아지 발자국 (x,y = 가운데) */
export function pawTop(G: GridT, x: number, y: number, glow: number) {
  const g = '#ffd34a';
  G.rect(x - 1, y - 2, 3, 5, g, 'flat');
  G.rect(x - 2, y - 1, 5, 3, g, 'flat');
  G.set(x, y + 1, '#a06030', 'flat');
  G.set(x - 1, y - 1, '#a06030', 'flat');
  G.set(x + 1, y - 1, '#a06030', 'flat');
  G.set(x, y - 2, lt(g, 0.5), 'flat');
  const gl = mix(g, '#ffffff', 0.6);
  if (glow >= 1) for (const [dx, dy] of [[0, -4], [-3, 0], [3, 0]]) G.set(x + dx, y + dy, gl, 'fx');
  if (glow >= 2) for (const [dx, dy] of [[-3, -3], [3, -3], [-4, 1], [4, 1], [0, 4]]) G.set(x + dx, y + dy, '#ffffff', 'fx');
}

// ───────── 시그니처 동작 (대기 · 8~12초마다 1초) ─────────

/** 팔·무기 (그렸으면 true) */
export function starArm(c: NCtx, arm: string): boolean {
  const { G, def, by, pose } = c;
  const i = pose.sig!;
  const S = c.SKN;
  const fx = (x: number, y: number, col: string) => G.set(x, y, col, 'fx');
  switch (c.L.sig) {
    case 'plant': {
      // 웅스: 대검을 내려(1) → 바닥에 꽂고(2 · 흙먼지) → 기대기(3·4)
      if (i === 1) {
        G.rect(15, by + 1, 2, 3, arm);
        G.rect(16, by + 3, 2, 2, S);
        greatsword(G, def, 16, by + 3, 'low');
        return true;
      }
      const x = 18;
      const bl = def.weaponColor ?? '#dfe6f0';
      G.rect(x, by + 4, 1, 27 - by - 4, bl);
      G.rect(x + 1, by + 4, 1, 26 - by - 4, ramp(bl, -1));
      G.rect(x - 2, by + 3, 6, 1, '#e0b050');
      G.rect(x, by, 1, 3, '#5a3a2a');
      G.set(x, by - 1, '#e0b050');
      G.rect(15, by, 3, 2, arm);
      G.rect(x - 1, by - 1 + (i >= 3 ? 0 : -1), 2, 2, S);
      if (i === 2) for (const [dx, dy] of [[-3, 0], [3, 0], [-2, -1], [4, -1], [-4, 0]] as [number, number][]) fx(x + dx, 27 + dy, '#c8a878');
      return true;
    }
    case 'twirl': {
      // 고느끼: 단검을 손가락 끝에서 한 바퀴 (위 → 오른쪽 → 아래 → 대각) · 분홍 반짝
      G.rect(15, by + 1, 2, 2, arm);
      G.rect(16, by - 1, 2, 2, S);
      const bl = def.weaponColor ?? '#e3e9f4';
      const cx = 17;
      const cy = by - 2;
      const tips: [number, number, number, number][] = [
        [0, -1, 0, -4],
        [1, 0, 4, 0],
        [0, 1, 0, 4],
        [1, -1, 3, -3],
      ];
      const [ax, ay, bx2, by2] = tips[i - 1];
      G.line(cx + ax, cy + ay, cx + bx2, cy + by2, bl);
      G.set(cx + bx2, cy + by2, PINK, 'flat');
      fx(cx + bx2 + Math.sign(bx2), cy + by2 + Math.sign(by2), '#ffc0dc');
      if (i === 4) fx(cx + 4, cy - 4, '#ffffff');
      return true;
    }
    case 'pinwheel': {
      // 이카몰리: 지팡이를 들고 · 끝 바람개비가 돈다 · 하늘색 바람 줄
      const sl = dk(arm, 0.08);
      G.rect(15, by + 1, 2, 3, sl);
      G.rect(15, by + 3, 3, 2, sl);
      G.rect(18, by + 2, 2, 2, S);
      const x = 19;
      const top = by - 9;
      G.rect(x, top + 2, 1, 27 - top - 2, '#9a6436');
      pinwheelTop(G, x, top, i - 1);
      const wy = top + 1 + (i % 2);
      for (let k = 0; k < 3; k++) fx(x - 4 - k - i, wy + (k === 1 ? 1 : 0), k === 0 ? '#ffffff' : SKY);
      return true;
    }
    case 'wag': {
      // 왈왈콩선생: 성표 지팡이를 꼬리 흔들듯 좌우로
      const sl = dk(arm, 0.08);
      G.rect(15, by + 1, 2, 3, sl);
      G.rect(16, by + 3, 1, 1, def.accent);
      G.rect(17, by + 2, 2, 2, S);
      const tilt = [-2, 2, -2, 2][i - 1];
      const tx = 19 + tilt;
      const ty = by - 8;
      G.line(18, 27, tx, ty + 3, '#9a6436');
      pawTop(G, tx, ty, 1);
      if (i === 2 || i === 4) fx(tx + (tilt > 0 ? 3 : -3), ty - 3, '#ffffff');
      return true;
    }
    case 'lantern': {
      // 따뜻한밤: 허리 등불을 들어(1) 높이(2·3 · 발돋움) 먼 곳을 보고 · 내린다(4) — 활은 반대 손
      const up = i === 2 || i === 3;
      if (up) {
        G.rect(15, by - 2, 2, 3, arm);
        G.rect(16, by - 4, 2, 2, S);
        lanternDot(G, 16, by - 11, true);
        G.line(17, by - 5, 17, by - 6, '#3a2a20');
        if (i === 3) for (const [dx, dy] of [[-3, -1], [5, -1], [1, -4]] as [number, number][]) fx(16 + dx, by - 9 + dy, '#fff3c0');
      } else {
        G.rect(15, by + 1, 2, 3, arm);
        G.rect(16, by + 3, 2, 2, S);
        lanternDot(G, 16, by + 5, false);
      }
      // 장궁은 등 뒤 왼쪽에 세로로
      const wd = def.weaponColor ?? '#9a6a3c';
      for (let k = 0; k <= 16; k++) G.set(2 - Math.round(Math.sin((k / 16) * Math.PI) * 1.6), by - 6 + k, wd);
      G.rect(2, by - 5, 1, 15, '#efe2c6', 'flat');
      return true;
    }
    default:
      return false;
  }
}

// ───────── 공격 궤적 (휘두름 · 활은 놓는 순간) ─────────

export function starTrail(c: NCtx): boolean {
  const id = c.L.star;
  if (!id) return false;
  const { G, by } = c;
  const col = starTrailColor(id);
  const fx = (x: number, y: number, k: string) => G.set(x, y, k, 'fx');
  const cx = 13.5;
  const cy = by + 1.5;
  switch (id) {
    case 'woongs':
      // 금빛 넓고 두꺼운 호 (대검) + 끝 반짝
      arcC(G, cx, cy, 10.5, -1.3, 2.4, '#fff6d0', col, dk(col, 0.25), 3);
      for (const [x, y] of [[22, by + 7], [23, by + 6], [22, by + 5], [21, by + 6]]) fx(x, y, '#ffffff');
      return true;
    case 'gonu':
      // 분홍 붓질 두 획 (가운데 굵고 끝이 가는 X)
      for (const [x0, y0, x1, y1] of [[15, by - 5, 22, by + 3], [22, by - 4, 16, by + 4]] as [number, number, number, number][]) {
        G.line(x0, y0, x1, y1, col, 'fx');
        G.line(x0 + 1, y0 + 1, x1 - (x1 > x0 ? 1 : -1), y1 - 1, mix(col, '#ffffff', 0.5), 'fx');
      }
      fx(15, by - 5, mix(col, '#2a2236', 0.3));
      fx(16, by + 4, mix(col, '#2a2236', 0.3));
      return true;
    case 'ikamolly':
      // 하늘색 바람 소용돌이: 호 + 안쪽 작은 고리
      arcC(G, cx, cy, 8.5, -0.9, 2.2, '#ffffff', col, dk(col, 0.2), 2);
      for (let a = 0; a < 10; a++) {
        const t = (a / 10) * Math.PI * 1.6;
        fx(Math.round(20 + Math.cos(t) * (2.6 - a * 0.15)), Math.round(by + 1 + Math.sin(t) * (2.6 - a * 0.15)), a < 5 ? col : '#ffffff');
      }
      return true;
    case 'walwal':
      // 흰빛: 흰 호 + 연한 후광 + 십자 반짝
      arcC(G, cx, cy, 9, -1, 2.2, '#ffffff', '#f2f6ff', '#c8d4ec', 2);
      for (const [x, y] of [[21, by - 3], [22, by + 4]] as [number, number][]) {
        fx(x, y, '#ffffff');
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) fx(x + dx, y + dy, '#fff3c8');
      }
      return true;
    case 'warmnight': {
      // 주황 등불 화살 줄 (놓는 순간) + 불티
      const y = by + 2;
      for (let x = 12; x <= 23; x++) fx(x, y, x > 19 ? '#fff0c0' : col);
      for (let x = 13; x <= 18; x++) fx(x, y - 1, x % 2 ? dk(col, 0.15) : mix(col, '#ffffff', 0.35));
      for (const [x, yy] of [[14, y + 2], [17, y - 3], [20, y + 2], [22, y - 2]] as [number, number][]) fx(x, yy, '#ffd36b');
      return true;
    }
  }
  return false;
}
