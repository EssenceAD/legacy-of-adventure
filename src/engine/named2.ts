// HERODOT 3단계 — 전설 14 · 이름 있는 영웅 10 · 신화 (heroDotV2 켰을 때만 · sprites2.ts가 부른다)
//  기준 = 각자의 초상화(public/assets/portraits/legend_* · hero_*) + legends.ts charm.
//  전설: 고유 실루엣 + 고정 색 · 금빛 외곽선 한 겹 · 26×35(세로 +2) · 시그니처 동작(≤4장) · 걸을 때 움직임 · 공격 궤적
//  이름 있는 영웅: 고정 외형 + 소품 1개 + 시그니처 동작 1개 (외곽선·크기·궤적은 일반과 같음)
//  신화: 전설 그대로 + 별빛 남색 망토(금 별) + 은빛 외곽선
import type { ClassDef } from '../data/classes';
import { dk, lt, mix, type GridT } from './pixel';
import { arcC, FEATHER, hair2, headgear, quiver, type Dot2, type Pose2 } from './sprites2';
import type { StarId } from '../data/fivestars';
import { STAR_LOOKS, starArm, starBehind, starFront, starHead, starSigPose, starTrail } from './stars2';

export interface NamedLook {
  tier: 'legend' | 'hero';
  /** 고정 색·모양 (무기 등급 색 weaponColor는 그대로 둔다) */
  patch: Partial<ClassDef>;
  /** class = 직업 머리 장비 그대로 · hair = 장비 없이 머리카락 + 소품 */
  head: 'class' | 'hair';
  /** 소품 (그리는 순서대로) */
  extras: string[];
  /** 시그니처 동작 이름 · 프레임 수(≤4) */
  sig: string;
  sigN: number;
  /** 전설: 걸을 때 움직임 · 공격 궤적 */
  walk?: string;
  trail?: string;
  /** 도적 망토(두건 없는 망토) 끄기 · 전사 수염 땋기 끄기 */
  noCape?: boolean;
  noBraids?: boolean;
  /** 마법사 지팡이 구슬 색 (무기 등급 색이 없을 때) */
  orb?: string;
  /** FIVESTARS ④: 다섯 별 (신화 단계 · 고유 색 망토 그대로 · 무지갯빛 이름표) */
  star?: StarId;
}

export const LEGEND_RIM = dk('#ffb04a', 0.45);
export const MYTHIC_RIM = '#aab8d4';
export const STAR_NAVY = '#262f6a';
export const STAR_GOLD = '#ffd36b';

export const NAMED: Record<string, NamedLook> = {
  // ── 전설 14 ──
  elysia: { tier: 'legend', head: 'hair', patch: { style: 'long', cloth: '#c9d1de', arm: '#aeb8c8', pants: '#8a94a8', boots: '#6a7488', accent: '#3a9a7a', shield: false, cape: '#f4f2ec' }, extras: ['cape', 'ponytail', 'pauldrons'], sig: 'salute', sigN: 3, walk: 'cape', trail: 'silverArc' },
  ceres: { tier: 'legend', head: 'hair', patch: { style: 'braid', cloth: '#2f5fc0', arm: '#c9d1de', pants: '#2a3a6a', boots: '#5a4a6a', accent: '#e8c45a', shield: false }, extras: ['braidCrown', 'smallShield', 'pauldrons'], sig: 'shy', sigN: 3, walk: 'hair', trail: 'royalArc' },
  vael: { tier: 'legend', head: 'hair', patch: { style: 'long', cloth: '#2c2834', arm: '#3e3a48', pants: '#24202c', boots: '#1e1a24', accent: '#a8243a', shield: false, cape: '#1e1a26', weapon: 'sword' }, extras: ['cape', 'pauldrons'], sig: 'shoulder', sigN: 3, walk: 'cape', trail: 'bloodArc' },
  scarlet: { tier: 'legend', head: 'class', patch: { style: 'long', cloth: '#3a1a24', arm: '#3a1a24', pants: '#2a1018', accent: '#e04a2a', hatc: '#5a1a24', weapon: 'staff' }, extras: ['witchBrim'], orb: '#ff7a2a', sig: 'flame', sigN: 3, walk: 'brim', trail: 'fireRing' },
  luna: { tier: 'legend', head: 'hair', patch: { style: 'short', cloth: '#5a4a3a', hood: '#4f7a3a', accent: '#c9a04a', dual: true }, extras: ['wolfEars', 'wolfTail', 'fur'], sig: 'wolf', sigN: 4, walk: 'tail', trail: 'claw' },
  grom: { tier: 'legend', head: 'hair', patch: { style: 'bald', beard: '#1c1418', cloth: '#5a3424', arm: '#e8a878', pants: '#3a2a20', boots: '#2a1e16', accent: '#c9a04a', weapon: 'axe', helm: undefined }, extras: ['bald', 'bigBeard', 'pelt'], noBraids: true, sig: 'thud', sigN: 3, walk: 'shoulders', trail: 'quake' },
  aria: { tier: 'legend', head: 'hair', patch: { style: 'long', cloth: '#fbf8f0', arm: '#fbf8f0', accent: '#e8b84a' }, extras: ['flowerCrown'], sig: 'pray', sigN: 3, walk: 'hem', trail: 'beams' },
  nyx: { tier: 'legend', head: 'hair', patch: { style: 'short', cloth: '#3a2846', arm: '#3a2846', pants: '#24182e', boots: '#1e1426', accent: '#8a5ac8', dual: false, weapon: 'dagger' }, extras: ['bob', 'scarf'], noCape: true, sig: 'spin', sigN: 4, walk: 'scarf', trail: 'xx' },
  leon: { tier: 'legend', head: 'hair', patch: { style: 'short', cloth: '#e0a83a', arm: '#f0c060', pants: '#8a6a3a', boots: '#6a4a2a', accent: '#fff0b0', shield: false }, extras: ['mane', 'lionEmblem', 'pauldrons'], sig: 'roar', sigN: 3, walk: 'glint', trail: 'lionClaw' },
  sylas: { tier: 'legend', head: 'hair', patch: { style: 'long', cloth: '#3f6a3a', arm: '#5a8a4a', pants: '#3a4a2a', boots: '#4a3424', accent: '#c9a04a', weapon: 'bow', dual: false }, extras: ['quiver'], noCape: true, sig: 'pluck', sigN: 3, walk: 'hair', trail: 'wind' },
  ryuka: { tier: 'legend', head: 'hair', patch: { style: 'short', cloth: '#c0342a', arm: '#d8a040', pants: '#5a1a1a', boots: '#3a1a1a', accent: '#e8c45a', helm: undefined }, extras: ['bob', 'dragonHorns', 'dragonTail'], sig: 'puff', sigN: 3, walk: 'tail', trail: 'dragonFire' },
  momo2: { tier: 'legend', head: 'class', patch: { style: 'short', cloth: '#6a3aa6', arm: '#6a3aa6', hatc: '#5a2e96', accent: '#ffd36b', face: { eyes: 'round', mouth: 'tiny', blush: true, glasses: true }, glassesColor: '#3a2a4a' }, extras: ['starHat'], sig: 'hat', sigN: 3, walk: 'hatBounce', trail: 'stars' },
  vivian: { tier: 'legend', head: 'hair', patch: { style: 'long', cloth: '#2a3350', arm: '#2a3350', pants: '#3a2a20', boots: '#2a1a14', accent: '#e8c45a', dual: false }, extras: ['tricorn', 'eyepatch'], noCape: true, sig: 'tip', sigN: 3, walk: 'hair', trail: 'wave' },
  jin: { tier: 'legend', head: 'hair', patch: { style: 'short', cloth: '#2a3350', arm: '#2a3350', pants: '#1e2438', boots: '#2a2a2a', accent: '#f0f0f0', shield: false, weapon: 'sword' }, extras: ['topknot', 'collar'], sig: 'iai', sigN: 3, walk: 'hair', trail: 'iai' },
  // ── 이름 있는 영웅 10 ──
  kael: { tier: 'hero', head: 'hair', patch: { style: 'short', hair: '#d8402a', cloth: '#7a3a2a', arm: '#c9d1de', accent: '#e8c45a', shield: false, cape: '#c8352e' }, extras: ['spiky', 'cape'], sig: 'stretch', sigN: 2 },
  brok: { tier: 'hero', head: 'hair', patch: { style: 'short', cloth: '#8a5a34', accent: '#c9a04a', helm: undefined }, extras: ['goggles'], sig: 'wipe', sigN: 2 },
  lira: { tier: 'hero', head: 'hair', patch: { style: 'short', hair: '#d8783a', cloth: '#4f8a4a', arm: '#4f8a4a', accent: '#e8c45a', bandana: '#4f8a3a' }, extras: ['featherCap', 'lute'], sig: 'strum', sigN: 2 },
  morga: { tier: 'hero', head: 'hair', patch: { cloth: '#4a7a3a', arm: '#4a7a3a', hatc: '#4a7a3a', accent: '#c9a04a', hood: '#4f7a3a' }, extras: ['mushroomHood'], sig: 'hop', sigN: 2 },
  oswin: { tier: 'hero', head: 'hair', patch: { style: 'short', hair: '#d8d8d8', beard: '#f0f0f0', cloth: '#c9d1de', arm: '#aeb8c8', accent: '#e8b84a' }, extras: ['sunEmblem'], noBraids: true, sig: 'beard', sigN: 2 },
  pip: { tier: 'hero', head: 'hair', patch: { style: 'short', hair: '#2a2228', cloth: '#7a5a3a', accent: '#c9a04a' }, extras: ['messy', 'mask'], noCape: true, sig: 'coin', sigN: 3 },
  seril: { tier: 'hero', head: 'hair', patch: { style: 'long', hair: '#c8e070', cloth: '#6a9a4a', arm: '#f2ead8', accent: '#e8e0a0', hat: undefined }, extras: ['leafCrown'], sig: 'hairflip', sigN: 2 },
  harald: { tier: 'hero', head: 'class', patch: { helm: '#4a4a56', beard: '#c83a2a', cloth: '#4a3a3a', accent: '#c9a04a' }, extras: ['mug'], sig: 'drink', sigN: 2 },
  nova: { tier: 'hero', head: 'hair', patch: { style: 'short', hair: '#c8c8d8', cloth: '#2a3360', arm: '#2a3360', accent: '#e8c45a', weapon: null, face: { eyes: 'dot', mouth: 'tiny', glasses: true }, glassesColor: '#3a3a4a' }, extras: ['bun', 'starRobe', 'telescope'], sig: 'peek', sigN: 2 },
  // ── FIVESTARS ④ 다섯 별 (stars2.ts) ──
  ...STAR_LOOKS,
  twins: { tier: 'hero', head: 'hair', patch: { style: 'short', hair: '#2a2228', cloth: '#3a3640', arm: '#3a3640', accent: '#3f6fd1' }, extras: ['blueScarf'], noCape: true, sig: 'nod', sigN: 2 },
};

export const namedOf = (d: ClassDef): NamedLook | undefined => (d.named ? NAMED[d.named] : undefined);

/** 고정 색·모양 입히기 (무기 등급 색은 그대로 · 마법사 구슬 색은 등급 색이 없을 때만) */
export function applyNamed(d: ClassDef, L: NamedLook): ClassDef {
  const o: ClassDef = { ...d, ...L.patch, face: { ...d.face, ...(L.patch.face ?? {}) } };
  if (L.orb && !d.weaponColor) o.weaponColor = L.orb;
  if (d.mythic && L.tier === 'legend' && !L.star) o.cape = STAR_NAVY;
  if (L.star) o.mythic = true;
  return o;
}

/** 시그니처 동작 프레임의 몸 자세 (팔·무기·소품은 namedArm/namedExtras가 sig 번호로 그린다) */
export function sigPoses(L: NamedLook): Pose2[] {
  const out: Pose2[] = [];
  for (let i = 1; i <= Math.min(4, L.sigN); i++) {
    const p: Pose2 = { sig: i };
    if (L.sig === 'hop') p.bob = i === 1 ? -2 : -1;
    if (L.sig === 'nod' || (L.sig === 'shoulder' && i === 3)) p.bob = 1;
    if (L.sig === 'salute' || L.sig === 'hairflip') p.trail = i - 1;
    if (L.sig === 'roar' || L.sig === 'wolf') p.face = i === 4 || L.sig === 'roar' ? 'shout' : undefined;
    if (L.sig === 'pray') p.pray = 1;
    if (L.sig === 'nod' && i === 2) p.blink = 1;
    if (L.sig === 'puff' && i === 1) p.blink = 1;
    if (L.star) Object.assign(p, starSigPose(L, i));
    out.push(p);
  }
  return out;
}

export interface NCtx {
  G: GridT;
  def: ClassDef;
  L: NamedLook;
  kind: Dot2;
  pose: Pose2;
  hx: number;
  hy: number;
  by: number;
  back: boolean;
  SKN: string;
}

const has = (c: NCtx, k: string) => c.L.extras.includes(k);
const isSig = (c: NCtx, name: string, i?: number) => c.L.sig === name && !!c.pose.sig && (i === undefined || c.pose.sig === i);

/** 몸 뒤 (앞모습): 망토 · 꼬리 · 목도리 자락 · 화살통 */
export function namedBehind(c: NCtx) {
  const { G, def, by, back } = c;
  if (back) return;
  if ((has(c, 'cape') || def.mythic) && def.cape) {
    longCape(c, def.cape, false);
    if (def.mythic && !c.L.star) mythicStars(G, def.cape, by, false);
  }
  if (c.L.star) starBehind(c);
  if (has(c, 'wolfTail')) tail(c, def.hair, lt(def.hair, 0.5), false);
  if (has(c, 'dragonTail')) tail(c, '#2a8a80', '#e8c45a', false);
  if (has(c, 'scarf')) scarfTail(c);
  if (has(c, 'quiver')) quiver(G, by, false);
  if (has(c, 'lute')) lute(c);
}

/** 머리: 장비 없이 머리카락 + 머리 소품 (head = 'hair') · 또는 직업 장비 (+ 소품) */
export function namedHead(c: NCtx) {
  const { G, def, back } = c;
  const X = Math.round(c.hx);
  const Y = Math.round(c.hy);
  if (c.L.head === 'hair') hair2(G, def, c.hx, c.hy, back);
  if (has(c, 'mushroomHood')) {
    headgear(G, def, 'rogue', c.hx, c.hy, c.by, back, def.hood ?? '#4f7a3a');
    G.rect(X - 4, Y - 7, 3, 1, '#d8b080');
    G.rect(X - 5, Y - 6, 5, 1, '#c89a68');
    G.set(X - 3, Y - 5, '#f0e8d8');
  }
  if (has(c, 'bald')) {
    G.rect(X - 3, Y - 5, 3, 1, lt(c.SKN, 0.55), 'flat');
    G.set(X - 4, Y - 4, lt(c.SKN, 0.4), 'flat');
  }
  if (has(c, 'bob')) {
    G.rect(X - 6, Y - 2, 2, 6, def.hair);
    G.rect(X + 5, Y - 2, 2, 5, def.hair);
  }
  if (has(c, 'messy') || has(c, 'spiky')) {
    const sp: [number, number][] = has(c, 'spiky') ? [[-5, -6], [-3, -7], [-1, -7], [1, -7], [3, -6], [5, -5], [-6, -4]] : [[-5, -6], [-2, -7], [2, -6], [5, -4], [-6, -3]];
    for (const [dx, dy] of sp) G.set(X + dx, Y + dy, def.hair);
  }
  if (has(c, 'mane')) {
    // 사자 갈기: 머리 둘레로 뻗친 금발 (흔들릴 때 끝이 1px 바뀐다)
    const f = (c.pose.wf ?? 0) % 2 || (isSig(c, 'roar') && (c.pose.sig ?? 0) % 2) ? 1 : 0;
    const sp: [number, number][] = [[-7, -2], [-7, 0], [-8, 1 + f], [-7, -4], [-6, -6], [-4, -7], [-1, -8], [2, -7], [5, -6], [6, -4], [7, -2], [7, 0 + f], [-7, 2], [-7, 3 + f], [6, 2]];
    for (const [dx, dy] of sp) G.set(X + dx, Y + dy, def.hair);
    for (const [dx, dy] of [[-6, -5], [-1, -7], [4, -6]]) G.set(X + dx, Y + dy, lt(def.hair, 0.4), 'flat');
  }
  if (has(c, 'ponytail') && !back) {
    G.rect(X - 7, Y - 4, 2, 3, def.hair);
    G.set(X - 8, Y - 3, def.hair);
  }
  if (has(c, 'topknot')) {
    G.rect(X - 1, Y - 8, 3, 2, def.hair);
    G.set(X, Y - 6, '#e8e0d0', 'flat');
  }
  if (has(c, 'bun')) G.ell(X + 0.5, Y - 6.5, 2.4, 1.8, def.hair);
  if (has(c, 'wolfEars')) wolfEars(c);
  if (has(c, 'dragonHorns'))
    for (const [dx, dy] of [[-4, -6], [-5, -7], [3, -6], [4, -7]] as [number, number][]) G.set(X + dx, Y + dy, dy === -7 ? '#5a4a6a' : '#2a2430');
  if (has(c, 'braidCrown')) {
    for (let x = X - 5; x <= X + 5; x++) G.set(x, Y - 4, (x & 1) === 0 ? lt(def.hair, 0.25) : dk(def.hair, 0.15));
    G.set(X, Y - 6, STAR_GOLD, 'flat');
    G.set(X - 1, Y - 5, STAR_GOLD, 'flat');
    G.set(X + 1, Y - 5, STAR_GOLD, 'flat');
    G.set(X, Y - 5, '#6ab0ff', 'flat');
  }
  if (has(c, 'flowerCrown')) {
    for (let x = X - 5; x <= X + 5; x++) G.set(x, Y - 5, '#6aa84f', 'flat');
    for (const [dx, col] of [[-5, '#ffffff'], [-2, '#ffe08a'], [1, '#ffffff'], [4, '#ffe08a']] as [number, string][]) {
      G.set(X + dx, Y - 6, col, 'flat');
      G.set(X + dx, Y - 5, col, 'flat');
    }
  }
  if (has(c, 'leafCrown')) for (let x = X - 6; x <= X + 6; x++) G.set(x, Y - 4, (x & 1) === 0 ? '#5a9a3a' : '#9ad06a', 'flat');
  if (has(c, 'goggles')) {
    for (const gx of [X - 3, X + 1]) {
      G.rect(gx, Y - 5, 2, 2, '#8ad0e0', 'flat');
      G.set(gx, Y - 5, '#ffffff', 'flat');
    }
    G.rect(X - 6, Y - 4, 13, 1, '#6b4128');
    G.rect(X - 1, Y - 5, 2, 1, '#c9a04a', 'flat');
  }
  if (has(c, 'featherCap')) {
    headgearCap(c, '#4f8a3a');
  }
  if (has(c, 'tricorn')) {
    const H = '#1e2238';
    const lift = isSig(c, 'tip', 2) ? 2 : isSig(c, 'tip') ? 1 : 0;
    G.rect(X - 7, Y - 4 - lift, 15, 1, H);
    G.set(X - 8, Y - 5 - lift, H);
    G.set(X + 8, Y - 5 - lift, H);
    G.rect(X - 4, Y - 7 - lift, 9, 3, H);
    G.rect(X - 7, Y - 4 - lift, 15, 1, '#e8c45a', 'flat');
    for (const [dx, dy] of [[-3, -8], [-4, -9], [-5, -9], [-5, -10]] as [number, number][]) G.set(X + dx, Y + dy - lift, '#efe2c6');
  }
  if (has(c, 'witchBrim')) {
    const C = def.hatc ?? '#5a1a24';
    const bo = c.L.walk === 'brim' && (c.pose.wf ?? -1) >= 0 ? (c.pose.wf! % 2) : 0;
    G.rect(X - 9, Y - 3, 19, 1, C);
    G.set(X - 10, Y - 2 + bo, C);
    G.set(X + 10, Y - 2 + bo, C);
  }
  if (c.L.star) starHead(c);
  if (has(c, 'starHat')) {
    for (const [dx, dy] of [[-1, -6], [1, -5], [-3, -4], [2, -7]] as [number, number][]) G.set(X + dx, Y + dy, STAR_GOLD, 'flat');
  }
}

function headgearCap(c: NCtx, C: string) {
  const { G } = c;
  const X = Math.round(c.hx);
  const Y = Math.round(c.hy);
  G.ell(c.hx + 0.2, c.hy - 2.4, 6.8, 4.2, C, null, (_x, y) => y < c.hy - 1.5);
  G.rect(X - 6, Y - 2, 14, 1, dk(C, 0.12));
  if (!c.back) G.rect(X + 5, Y - 2, 4, 1, C);
  for (const [dx, dy] of [[-3, -6], [-4, -7], [-4, -8], [-5, -8], [-5, -9]] as [number, number][]) G.set(X + dx, Y + dy, '#f4f0e6');
  void FEATHER;
}

/** 얼굴 다음: 수염 · 가면 · 안대 · 문장 · 목도리 · 뒷모습 망토 */
export function namedFront(c: NCtx) {
  const { G, def, by, back } = c;
  const X = Math.round(c.hx);
  const Y = Math.round(c.hy);
  const ey = Math.round(c.hy - 0.5);
  if (has(c, 'bigBeard') && def.beard && !back) {
    G.ell(c.hx + 0.6, c.hy + 5, 5.4, 4.4, def.beard, null, (_x, y) => y >= c.hy + 2.4);
    G.rect(X - 1, ey + 3, 4, 1, dk(def.beard, 0.2));
  }
  if (has(c, 'mask') && !back) G.rect(X - 5, ey + 3, 11, 3, '#2a2a34');
  if (has(c, 'eyepatch') && !back) {
    G.rect(X - 6, ey - 1, 12, 1, '#1e1a1a', 'eye');
    G.rect(X + 2, ey, 2, 3, '#1e1a1a', 'eye');
  }
  if (!back && def.named && (has(c, 'sunEmblem') || has(c, 'lionEmblem'))) {
    const col = has(c, 'sunEmblem') ? STAR_GOLD : '#fff0b0';
    G.rect(X - 1, by + 1, 3, 3, col, 'flat');
    G.set(X, by + 2, has(c, 'sunEmblem') ? '#ffffff' : '#c08a2a', 'flat');
    for (const [dx, dy] of [[0, -1], [-2, 1], [2, 1]] as [number, number][]) G.set(X + dx, by + 1 + dy + 1, col, 'flat');
  }
  if (has(c, 'mug') && !back) mug(c);
  if (has(c, 'pauldrons')) {
    const pc = lt(def.arm, 0.15);
    G.rect(4, by, 3, 2, pc);
    G.rect(15, by, 3, 2, pc);
    G.set(4, by, lt(def.arm, 0.5), 'flat');
    G.set(15, by, lt(def.arm, 0.5), 'flat');
  }
  if (has(c, 'collar') && !back) {
    G.rect(X - 2, by, 2, 3, '#f0f0f0');
    G.set(X + 1, by, '#f0f0f0');
  }
  if (has(c, 'pelt')) {
    const sh = c.L.walk === 'shoulders' && (c.pose.wf ?? 0) % 2 ? -1 : 0;
    G.ell(back ? 15.5 : 5.5, by + 0.5 + sh, 3.4, 2.4, '#8a5a34');
    G.set(back ? 15 : 4, by + sh, '#b07a4a', 'flat');
  }
  if (has(c, 'fur') && !back) G.rect(X - 4, by, 9, 2, '#e8e0d0');
  if (has(c, 'scarf')) G.rect(X - 4, by - 1, 9, 2, '#2a2232');
  if (has(c, 'blueScarf')) {
    G.rect(X - 4, by - 1, 9, 2, '#3f6fd1');
    if (!back) G.rect(X - 5, by + 1, 1, 2, '#3f6fd1');
  }
  if (has(c, 'starRobe') && !back)
    for (const [x, y] of [[7, 4], [13, 6], [9, 9], [15, 10], [11, 12]] as [number, number][]) G.set(x, by + y, STAR_GOLD, 'flat');
  if (has(c, 'smallShield') && !c.pose.sig && !c.pose.sit) {
    G.ell(4.5, by + 6, 2.8, 3.1, STAR_GOLD);
    G.ell(4.5, by + 6, 1.8, 2.1, def.cloth);
    G.set(4, by + 6, '#ffffff', 'flat');
  }
  if (back) {
    if ((has(c, 'cape') || def.mythic) && def.cape) {
      longCape(c, def.cape, true);
      if (def.mythic && !c.L.star) mythicStars(G, def.cape, by, true);
    }
    if (has(c, 'wolfTail')) tail(c, def.hair, lt(def.hair, 0.5), true);
    if (has(c, 'dragonTail')) tail(c, '#2a8a80', '#e8c45a', true);
    if (has(c, 'scarf')) scarfTail(c);
    if (has(c, 'quiver')) quiver(G, by, true);
  }
  if (c.L.star) starFront(c);
  // 신화 표시: 가슴 별 장식 (망토 없는 앞모습에서도 보이게)
  if (def.mythic && !back) {
    G.set(X + 3, by + 1, STAR_GOLD, 'flat');
    G.set(X + 3, by + 2, STAR_NAVY, 'flat');
  }
  void Y;
}

/** 시그니처 동작의 팔·무기 (그렸으면 true) */
export function namedArm(c: NCtx, arm: string): boolean {
  const { G, def, by, pose } = c;
  if (!pose.sig) return false;
  if (c.L.star) return starArm(c, arm);
  const i = pose.sig;
  const X = Math.round(c.hx);
  const Y = Math.round(c.hy);
  const S = c.SKN;
  const fx = (x: number, y: number, col: string) => G.set(x, y, col, 'fx');
  switch (c.L.sig) {
    case 'salute': {
      // 검을 얼굴 앞에 세워 경례
      G.rect(14, by + 1, 2, 2, arm);
      G.rect(12, by + 1, 2, 2, S);
      const bl = def.weaponColor ?? '#e3e9f4';
      G.rect(12, by - 9 + (i === 1 ? 2 : 0), 1, 9 - (i === 1 ? 2 : 0), bl);
      G.rect(11, by, 3, 1, def.accent);
      if (i === 3) fx(12, by - 10, '#ffffff');
      return true;
    }
    case 'shy': {
      G.rect(15, by + 1, 2, 4, arm);
      G.rect(15, by + 5, 2, 2, S);
      const sy = i === 1 ? by + 3 : by - 1;
      G.ell(9.5, sy + 1, 2.8, 3.1, STAR_GOLD);
      G.ell(9.5, sy + 1, 1.8, 2.1, def.cloth);
      return true;
    }
    case 'shoulder': {
      G.rect(15, by, 2, 2, arm);
      G.rect(15, by - 1, 2, 2, S);
      G.line(16, by - 1, 9 + (i === 1 ? 3 : 0), by - 7 + (i === 1 ? 2 : 0), def.weaponColor ?? '#e3e9f4');
      G.rect(15, by, 3, 1, def.accent);
      return true;
    }
    case 'flame': {
      G.rect(15, by + 1, 2, 2, arm);
      G.rect(17, by + 1, 2, 2, S);
      const x = 16 + i;
      fx(x, by - 1, '#ffd36b');
      fx(x, by - 2, '#ff7a2a');
      fx(x - 1, by, '#ff7a2a');
      fx(x + 1, by, '#ffb04a');
      if (i === 2) fx(x, by - 3, '#ffe8a0');
      return true;
    }
    case 'wolf': {
      if (i !== 4) return false;
      // 하품: 손으로 입을 가림
      G.rect(15, by, 2, 2, arm);
      G.rect(X + 2, Y + 3, 2, 2, S);
      return true;
    }
    case 'thud': {
      if (i === 3) {
        // 근육 자세: 두 팔을 굽혀 올림
        G.rect(16, by - 2, 2, 3, arm);
        G.rect(16, by - 4, 2, 2, S);
        G.rect(3, by - 2, 2, 3, arm);
        G.rect(3, by - 4, 2, 2, S);
        return true;
      }
      G.rect(15, by + 1, 2, 3, arm);
      G.rect(16, by + 3, 2, 2, S);
      const b = def.weaponColor ?? '#c9d1dc';
      if (i === 1) {
        G.rect(18, by - 7, 1, 11, '#7a5030');
        G.rect(19, by - 8, 3, 5, b);
      } else {
        G.rect(18, by + 3, 1, 4, '#7a5030');
        G.rect(18, 24, 4, 3, b);
        for (const [dx, dy] of [[-1, 0], [5, -1], [6, 0], [-2, -1]] as [number, number][]) fx(18 + dx, 26 + dy, '#c8a878');
      }
      return true;
    }
    case 'pray': {
      // 두 손 모으고 · 화관 꽃잎 하나가 떨어진다
      G.rect(13, by + 1, 3, 2, arm);
      G.rect(11, by + 2, 2, 2, S);
      fx(X + 3 + (i === 2 ? 1 : 0), Y - 5 + i * 4, '#ffd0e0');
      return true;
    }
    case 'roar': {
      G.rect(15, by, 3, 2, arm);
      G.rect(18, by - 1, 2, 2, S);
      G.rect(3, by - 1, 2, 2, S);
      return true;
    }
    case 'pluck': {
      G.rect(15, by + 1, 3, 2, arm);
      G.rect(18, by + 1, 2, 2, S);
      const x = 19;
      const top = by - 7;
      for (let k = 0; k <= 18; k++) G.set(x + Math.round(Math.sin((k / 18) * Math.PI) * 2.2), top + k, def.weaponColor ?? '#9a6a3c');
      const pull = i === 2 ? 3 : i === 3 ? (k1(1)) : 0;
      if (pull) {
        G.line(x, top + 1, x - pull, top + 9, '#efe2c6', 'flat');
        G.line(x - pull, top + 9, x, top + 17, '#efe2c6', 'flat');
        G.rect(13, by + 2, 2, 2, S);
      } else G.rect(x, top + 1, 1, 17, '#efe2c6', 'flat');
      if (i === 3) {
        fx(x + 1, top + 6, '#ffffff');
        fx(x + 1, top + 12, '#ffffff');
      }
      return true;
    }
    case 'iai': {
      // 허리 칼집에 손 → 반쯤 뽑음(번쩍) → 칼집에 넣음
      G.rect(15, by + 2, 2, 3, arm);
      G.rect(14, by + 5, 2, 2, S);
      G.rect(6, by + 6, 10, 1, '#2a2430');
      if (i === 2) {
        G.rect(16, by + 5, 5, 1, def.weaponColor ?? '#e3e9f4');
        fx(21, by + 4, '#ffffff');
        fx(21, by + 6, '#bfe6ff');
      }
      if (i === 3) fx(15, by + 4, '#ffffff');
      return true;
    }
    case 'puff': {
      if (i === 1) return false;
      const x = X + 5;
      if (i === 2) {
        fx(x, Y + 3, '#ff8a3a');
        fx(x + 1, Y + 3, '#ffd36b');
        fx(x + 2, Y + 2, '#ff8a3a');
      } else {
        fx(x + 1, Y + 1, '#c8c8d0');
        fx(x + 2, Y, '#a8a8b8');
        fx(x + 2, Y + 2, '#c8c8d0');
      }
      return false;
    }
    case 'hat': {
      if (i !== 2) return false;
      G.rect(15, by - 1, 2, 2, arm);
      G.rect(15, Y - 3, 2, 2, S);
      return true;
    }
    case 'tip': {
      if (i === 3) return false;
      G.rect(15, by - 1, 2, 2, arm);
      G.rect(14, Y - 5 - (i === 2 ? 2 : 0), 2, 2, S);
      return true;
    }
    case 'spin': {
      if (i === 4) return false;
      G.rect(15, by + 2, 2, 3, arm);
      G.rect(16, by + 4, 2, 2, S);
      const bl = def.weaponColor ?? '#e3e9f4';
      if (i === 1) G.rect(17, by + 0, 1, 4, bl);
      if (i === 2) G.rect(18, by + 4, 4, 1, bl);
      if (i === 3) G.rect(17, by + 6, 1, 4, bl);
      fx(i === 2 ? 22 : 17, i === 1 ? by - 1 : i === 2 ? by + 4 : by + 10, '#c8a0ff');
      return true;
    }
    case 'stretch': {
      G.rect(15, by - 2, 2, 3, arm);
      G.rect(15, by - 4 - (i - 1), 2, 2, S);
      G.rect(5, by - 2, 2, 3, arm);
      G.rect(5, by - 4 - (i - 1), 2, 2, S);
      return true;
    }
    case 'wipe': {
      G.rect(15, by, 2, 2, arm);
      G.rect(X + 1 + (i - 1), Y - 3, 2, 2, S);
      return true;
    }
    case 'strum': {
      G.rect(9, by + 4, 3, 2, arm);
      G.rect(7, by + 5 + (i - 1), 2, 2, S);
      fx(3 + i, by + 2, '#ffe08a');
      return true;
    }
    case 'beard': {
      G.rect(15, by + 1, 2, 2, arm);
      G.rect(X + 1, Y + 4 + (i - 1), 2, 2, S);
      return true;
    }
    case 'coin': {
      G.rect(15, by, 2, 3, arm);
      G.rect(15, by - 1, 2, 2, S);
      const cy = [by - 3, by - 6, by - 3][i - 1];
      G.set(16, cy, STAR_GOLD, 'flat');
      fx(17, cy - 1, '#ffffff');
      return true;
    }
    case 'hairflip': {
      G.rect(15, by, 2, 2, arm);
      G.rect(X + 4, Y + 1 - i, 2, 2, S);
      return true;
    }
    case 'drink':
      return false;
    case 'peek': {
      // 망원경을 눈에 대고 먼 곳을 본다
      G.rect(15, by, 2, 2, arm);
      G.rect(15, Y + 2, 2, 2, S);
      G.line(X + 3, Y, X + 8, Y - 3 + (i === 2 ? 1 : 0), '#c9a04a');
      G.line(X + 3, Y + 1, X + 8, Y - 2 + (i === 2 ? 1 : 0), dk('#c9a04a', 0.25));
      return true;
    }
    default:
      return false;
  }
}
const k1 = (n: number) => n;

/** 망원경 (노바 · 서 있을 때 앞손) */
export function telescopeRest(G: GridT, by: number) {
  G.line(17, by + 6, 21, by + 2, '#c9a04a');
  G.line(17, by + 7, 21, by + 3, dk('#c9a04a', 0.25));
  G.set(21, by + 2, '#8ad0e0', 'flat');
}

/** 전설 공격 궤적 (휘두름 프레임) — 그렸으면 true */
export function namedTrail(c: NCtx): boolean {
  const { G, by } = c;
  const fx = (x: number, y: number, col: string) => G.set(x, y, col, 'fx');
  const cx = 13.5;
  const cy = by + 1.5;
  switch (c.L.trail) {
    case 'star':
      return starTrail(c);
    case 'silverArc':
      arcC(G, cx, cy, 9.5, -1.1, 2.3, '#ffffff', '#cfd8ea', '#8a96b0', 2);
      for (const [x, y] of [[21, by + 6], [22, by + 5], [21, by + 4], [20, by + 5]]) fx(x, y, '#fffbe0');
      return true;
    case 'royalArc':
      arcC(G, cx, cy, 8.5, -0.9, 2.1, STAR_GOLD, '#4a7ae0', '#2a4a90', 2);
      return true;
    case 'bloodArc':
      arcC(G, cx, cy, 10, -1.4, 2.4, '#e05060', '#8a1a2a', '#3a0a14', 2);
      return true;
    case 'fireRing':
      for (let a = 0; a < 16; a++) {
        const t = (a / 16) * Math.PI * 2;
        fx(Math.round(19 + Math.cos(t) * 3.4), Math.round(by - 2 + Math.sin(t) * 3.4), a % 2 ? '#ff8a2a' : '#ffd36b');
      }
      fx(19, by - 2, '#ffffff');
      return true;
    case 'claw':
      for (const o of [0, 2, 4]) G.line(14 + o, by - 4, 18 + o, by + 4, o === 2 ? '#ffffff' : '#d8dcec', 'fx');
      return true;
    case 'quake':
      for (let a = 0; a < 24; a++) {
        const t = (a / 24) * Math.PI * 2;
        fx(Math.round(18 + Math.cos(t) * 5), Math.round(25 + Math.sin(t) * 1.4), a % 3 ? '#8a5a34' : '#c8a878');
      }
      for (const [x, y] of [[13, 23], [22, 22], [16, 22], [20, 23]]) fx(x, y, '#c8a878');
      return true;
    case 'beams':
      for (const x of [17, 19, 21]) for (let y = by - 6 + (x - 17); y <= by + 6; y++) fx(x, y, y < by - 3 ? '#ffffff' : '#ffe08a');
      return true;
    case 'xx':
      for (const [x0, y0] of [[17, by - 4], [19, by + 2]]) {
        G.line(x0, y0, x0 + 3, y0 + 3, '#b070f0', 'fx');
        G.line(x0 + 3, y0, x0, y0 + 3, '#3a1848', 'fx');
      }
      return true;
    case 'lionClaw':
      for (const r of [7, 8.5, 10]) arcC(G, cx, cy, r, -0.6, 1.9, '#ffe08a', '#ffe08a', '#c08a2a', 0.9);
      return true;
    case 'wind':
      for (let x = 12; x <= 22; x++) fx(x, by + 1, x > 19 ? '#ffffff' : '#7ad06a');
      for (const [x, y] of [[14, by - 1], [15, by - 2], [17, by + 3], [18, by + 4], [20, by - 1]]) fx(x, y, '#b8f0a0');
      return true;
    case 'iai':
      for (let x = 6; x <= 22; x++) fx(x, by + 1, x > 10 && x < 20 ? '#ffffff' : '#bfe6ff');
      return true;
    case 'dragonFire':
      for (let x = 17; x <= 22; x++) {
        const w = Math.floor((x - 17) / 2);
        for (let y = by - w; y <= by + w + 1; y++) fx(x, y, y === by || y === by + 1 ? '#ffd36b' : x % 2 ? '#ff6a3a' : '#40c0b0');
      }
      return true;
    case 'stars':
      for (const [x, y, col] of [[18, by - 4, STAR_GOLD], [21, by - 1, '#c08aff'], [17, by + 2, '#c08aff'], [21, by + 4, STAR_GOLD]] as [number, number, string][]) {
        fx(x, y, '#ffffff');
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) fx(x + dx, y + dy, col);
      }
      return true;
    case 'wave':
      arcC(G, cx, cy, 8.5, -0.8, 2.2, '#ffffff', '#4ab0d8', '#2a6a9a', 2);
      for (const [x, y] of [[19, by - 6], [22, by + 1], [21, by - 3]]) fx(x, y, '#ffffff');
      return true;
    default:
      return false;
  }
}

/** 걸을 때 전설 황금 갑옷 반짝 1px (레온) */
export function walkGlint(c: NCtx) {
  if (c.L.walk !== 'glint' || c.pose.wf === undefined || c.back) return;
  const spots: [number, number][] = [[8, 2], [13, 1], [10, 4], [14, 3], [7, 3], [12, 5]];
  const [x, y] = spots[c.pose.wf % spots.length];
  c.G.set(x, c.by + y, '#ffffff', 'fx');
}

/** 닉스 시그니처 4: 그림자 걸음 — 반투명(체크무늬로 반만 남긴다) */
export function shadowStep(c: NCtx) {
  if (!isSig(c, 'spin', 4)) return;
  const g = c.G.g;
  for (let y = 0; y < c.G.h; y++) for (let x = 0; x < c.G.w; x++) if ((x + y) % 2 === 0) g[y][x] = null;
}

// ───────── 소품 그리기 ─────────

/** 긴 망토: 어깨에서 발목까지 아래로 퍼짐 · 걸으면 자락이 1프레임 늦게 뒤로 */
function longCape(c: NCtx, col: string, front: boolean) {
  const { G, by, pose } = c;
  const tr = pose.wf !== undefined ? (pose.trail ?? 0) : 0;
  const lagDy = pose.wf !== undefined ? (pose.lag ?? 0) - (pose.bob ?? 0) : 0;
  const bot = 25 + lagDy;
  const C = front ? col : dk(col, 0.1);
  for (let y = by; y <= bot; y++) {
    const j = y - by;
    const w = (front ? 11 : 12) + Math.floor(j / 2.5);
    const sh = y >= bot - 3 ? -tr : 0;
    G.rect(Math.round(c.hx - w / 2) + sh, y, w, 1, C);
  }
  if (front) G.rect(Math.round(c.hx), by + 1, 1, bot - by - 1, dk(col, 0.12));
}

function wolfEars(c: NCtx) {
  const { G, def } = c;
  const X = Math.round(c.hx);
  const Y = Math.round(c.hy);
  const tw = c.L.sig === 'wolf' && c.pose.sig === 1 ? 1 : 0;
  const H = def.hair;
  const ear = (s: number, bend: number) => {
    const b = s < 0 ? X - 5 : X + 5;
    G.set(b + bend * s, Y - 8, H);
    G.rect(Math.min(b, b - s), Y - 7, 2, 1, H);
    G.rect(Math.min(b, b - 2 * s), Y - 6, 3, 1, H);
    G.rect(Math.min(b, b - 3 * s), Y - 5, 4, 1, H);
    G.set(b - s, Y - 6, '#e8a0a8', 'flat');
  };
  ear(-1, 0);
  ear(1, tw);
}

function tail(c: NCtx, col: string, tip: string, back: boolean) {
  const { G, by, pose } = c;
  // 걸을 때 좌우로 · 꼬리 흔들기(시그니처 2·3)
  let s = 0;
  if (c.L.walk === 'tail' && pose.wf !== undefined) s = [0, -1, 0, 1, -1, 1][pose.wf % 6];
  if (c.L.sig === 'wolf' && pose.sig === 2) s = -2;
  if (c.L.sig === 'wolf' && pose.sig === 3) s = 2;
  const pts: [number, number][] = back
    ? [[10, 8], [10, 9], [11, 9], [11, 10], [9, 10], [10, 11], [9, 11]]
    : [[5, 8], [4, 8], [4, 7], [3, 7], [3, 6], [2, 6], [2, 5], [2, 4], [1, 4], [1, 3], [2, 3]];
  pts.forEach(([x, y], k) => G.set(x + (k > 3 || back ? s : 0) - (back ? 0 : 1), by + y + (back ? 1 : 0), k >= pts.length - 2 ? tip : col));
}

function scarfTail(c: NCtx) {
  const { G, by, pose, back } = c;
  const S1 = '#2a2232';
  const S2 = '#5a3a7a';
  const walking = pose.wf !== undefined;
  if (!walking) {
    // 서 있을 때: 뒤로 늘어진 자락
    for (const [x, y] of [[5, 0], [4, 1], [4, 2], [3, 3], [3, 4]] as [number, number][]) G.set(x, by + y, S1);
    G.set(3, by + 5, S2);
    return;
  }
  // 걸을 때: 2프레임 늦게 길게 휘날림
  const n = pose.wf! % 4;
  const fl = [0, 1, 0, -1][(n + 2) % 4];
  const pts: [number, number][] = [[5, 0], [4, 0], [3, 1], [2, 1], [1, 1 + fl], [0, 2 + fl], [-1, 2 + fl]];
  pts.forEach(([x, y], k) => G.set(back ? x + 1 : x, by + y, k >= pts.length - 2 ? S2 : S1));
}

function lute(c: NCtx) {
  const { G, by } = c;
  const W = '#b07a3a';
  G.ell(5.5, by + 6.5, 2.6, 2.4, W);
  G.set(5, by + 6, '#3a2418', 'flat');
  G.line(4, by + 4, 2, by, dk(W, 0.2));
  G.set(2, by - 1, '#e8c45a', 'flat');
}

function mug(c: NCtx) {
  const { G, by, pose } = c;
  const up = c.L.sig === 'drink' && pose.sig ? 1 : 0;
  const y = up ? Math.round(c.hy) + 2 : by + 4;
  const x = up ? Math.round(c.hx) - 2 : 3;
  G.rect(x, y, 3, 4, '#a0703a');
  G.rect(x, y, 3, 1, '#fffbf0');
  G.rect(x - 1, y + 1, 1, 2, '#7a5030');
  if (up && pose.sig === 2) G.set(x + 1, y - 1, '#fffbf0', 'fx');
}

function mythicStars(G: GridT, capeCol: string, by: number, back: boolean) {
  const spots: [number, number][] = back ? [[8, 3], [13, 5], [10, 8], [15, 9], [6, 7]] : [[4, 5], [17, 7], [5, 9], [16, 10]];
  for (const [x, y] of spots) {
    const p = G.g[by + y + G.oy]?.[x + G.ox];
    if (p && (p.c === capeCol || p.c === dk(capeCol, 0.12))) G.set(x, by + y, STAR_GOLD, 'flat');
  }
  void mix;
}
