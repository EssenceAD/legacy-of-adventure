// HUNT_WORLD_SPEC §1: 지역마다 다른 사냥터 — 바닥 무늬 · 가장자리 · 둘레 소품 · 공기 입자 · 빛 (지역 데이터는 여기 한 곳)
//  보스 스테이지(x-10)는 같은 테마의 「깊은 곳」: 더 어둡게 + 가운데 보스 무대 문양
import { av } from '../engine/ver';

export interface GroundPal {
  a: string;
  b: string;
  c: string;
  dirt: string;
  dirtD: string;
  edge: string;
  void: string;
  /** 지역마다 쓰는 색 더 (물·레일·얼음·균열 등) */
  x1: string;
  x2: string;
  /** 보스 무대 문양 색 */
  rune: string;
}
export type Particle = 'leaf' | 'spore' | 'dust' | 'snow' | 'star' | 'spray' | 'sand' | 'ember' | 'petal' | 'upfall';
export type Light = 'sun' | 'fog' | 'lamp' | 'cold' | 'rise' | 'dusk' | 'noon' | 'lava' | 'skylight' | 'dark' | 'rift';
export interface Theme {
  pal: GroundPal;
  /** 필드 안 바닥 한 점 (wx, wy = 필드 칸 좌표 · h = 점마다 난수 · n = 큰 얼룩 노이즈) */
  floor: (wx: number, wy: number, h: number, n: number, N: number, P: GroundPal, fbm: (x: number, y: number) => number) => string;
  /** 필드 밖 (가장자리 → 어둠) */
  outside: (edge: number, wx: number, wy: number, h: number, P: GroundPal) => string;
  /** 숲 가장자리 나무 줄 (마을 나무 그림) */
  trees?: boolean;
  /** 둘레 소품 4~5종 (assets/combat/props/{key}.png · 아래 가운데 기준) */
  props: string[];
  /** 은은하게 빛나는 소품 → 빛 색 */
  glow: Record<string, string>;
  particle: Particle;
  light: Light;
  /** 필드 안 바위(걸리는 돌) 색: 몸 · 밝은 면 · 바닥 */
  rock: [string, string, string];
  /** 사냥 창 지역 띠 색 */
  band: string;
}

const fr = (v: number) => v - Math.floor(v);
const darkEdge = (edge: number, h: number, P: GroundPal) => (edge < -0.6 ? (h < 0.35 ? P.edge : P.void) : h < 0.7 ? P.edge : P.c);

export const THEMES: Record<string, Theme> = {
  // 숲 동굴: 이끼 낀 풀 + 굽은 흙길 · 나무 밑동 가장자리 · 나뭇잎·반딧불 · 초록 햇살 줄기
  forest: {
    pal: { a: '#5f9a3c', b: '#6fae45', c: '#4f8a34', dirt: '#a07a4a', dirtD: '#7a5a34', edge: '#3e6a2c', void: '#1e3420', x1: '#7cc04e', x2: '#3a6a2a', rune: '#c8ff8a' },
    floor: (wx, wy, h, n, N, P, fbm) => {
      const pathD = Math.abs(wy - (N / 2 + Math.sin(wx * 0.7) * 1.6)) + (fbm(wx * 1.3 + 40, wy * 1.3) - 0.5) * 0.9;
      if (pathD < 0.6 || n > 0.74) return h < 0.12 ? P.dirtD : (pathD > 0.45 && pathD < 0.6) || h < 0.2 ? P.c : P.dirt;
      const g = fbm(wx * 0.9 + 9, wy * 0.9 + 3);
      // 이끼: 아주 밝은 잔점
      if (g < 0.36) return h < 0.3 ? P.a : h < 0.33 ? P.x1 : P.c;
      if (g > 0.62) return h < 0.25 ? P.a : P.b;
      return h < 0.08 ? P.c : h < 0.16 ? P.b : P.a;
    },
    outside: (e, _x, _y, h, P) => darkEdge(e, h, P),
    trees: true,
    props: ['forest_mush', 'forest_log', 'forest_stump', 'forest_cave'],
    glow: {},
    particle: 'leaf',
    light: 'sun',
    rock: ['#8a8f9a', '#b8bec8', '#5a5e6a'],
    band: '#6fae45',
  },
  // 버섯 늪: 진흙 + 반짝이는 웅덩이 · 검은 물 가장자리 · 포자 · 탁한 보라 안개
  swamp: {
    pal: { a: '#55603a', b: '#626e42', c: '#454f30', dirt: '#5e4c34', dirtD: '#3e3224', edge: '#1c2a26', void: '#0c1614', x1: '#1f3c3c', x2: '#4c8a80', rune: '#d090ff' },
    floor: (wx, wy, h, n, _N, P, fbm) => {
      const w = fbm(wx * 0.6 + 3, wy * 0.6 + 7);
      // 물: 반짝이는 잔점만 (줄무늬 없음)
      if (w < 0.28) return h < 0.03 ? P.x2 : h < 0.06 && fbm(wx * 3, wy * 3) > 0.55 ? P.x2 : P.x1;
      if (w < 0.32) return h < 0.5 ? P.dirtD : P.dirt;
      if (n > 0.6) return h < 0.15 ? P.dirtD : P.dirt;
      return h < 0.1 ? P.c : h < 0.22 ? P.b : P.a;
    },
    outside: (e, _x, _y, h, P) => (e < -0.6 ? (h < 0.04 ? P.x2 : P.void) : e < -0.2 ? (h < 0.5 ? P.x1 : P.edge) : h < 0.6 ? P.edge : P.c),
    props: ['swamp_bigmush', 'swamp_reeds', 'swamp_bridge', 'swamp_toad'],
    glow: { swamp_bigmush: '120,220,200', swamp_toad: '200,120,255' },
    particle: 'spore',
    light: 'fog',
    rock: ['#5a5a4a', '#7a7a62', '#3a3a2e'],
    band: '#b06ad0',
  },
  // 폐광: 돌바닥 + 자갈 + 광차 레일 한 줄 · 나무 버팀목 갱도 벽 · 먼지 · 등불 주변만 밝은 어둠
  mine: {
    pal: { a: '#66626c', b: '#75717c', c: '#55525c', dirt: '#8a8690', dirtD: '#3c3842', edge: '#3a2c24', void: '#0a080c', x1: '#a8aeb8', x2: '#6a4a2e', rune: '#ffb060' },
    floor: (wx, wy, h, n, N, P, fbm) => {
      const r = N * 0.74;
      const d = Math.abs(wy - r);
      // 레일 두 줄 + 침목
      if ((d > 0.2 && d < 0.27) || (d > 0.5 && d < 0.57)) return h < 0.3 ? P.c : P.x1;
      if (d < 0.75 && fr(wx / 0.6) < 0.22) return h < 0.2 ? P.dirtD : P.x2;
      const s = fbm(wx * 1.1 + 5, wy * 1.1 + 11);
      if (h < 0.06) return P.dirt;
      if (h < 0.1) return P.dirtD;
      // 판석 이음매
      if (fr(wx * 0.8 + s * 0.6) < 0.05) return P.dirtD;
      return n > 0.62 ? P.b : s < 0.4 ? P.c : P.a;
    },
    outside: (e, wx, wy, h, P) => {
      if (e >= 0) return h < 0.6 ? P.c : P.dirtD;
      // 갱도 벽: 나무 버팀목 줄무늬 → 어둠
      if (e > -0.9 && fr((wx + wy) * 0.35) < 0.14) return h < 0.25 ? P.edge : P.x2;
      return e < -0.6 ? P.void : h < 0.5 ? P.edge : P.void;
    },
    props: ['mine_cart', 'mine_tools', 'mine_beam', 'mine_ore'],
    glow: { mine_beam: '255,190,90', mine_ore: '110,180,255' },
    particle: 'dust',
    light: 'lamp',
    rock: ['#6a6670', '#9a96a0', '#3c3842'],
    band: '#c08a5a',
  },
  // 얼음 협곡: 눈 + 반짝이는 얼음판 · 얼음 절벽 · 눈송이 · 차가운 푸른 빛
  ice: {
    pal: { a: '#dce8f2', b: '#eaf3fa', c: '#c2d4e4', dirt: '#a6d2ec', dirtD: '#7ab0d4', edge: '#5a86ac', void: '#16243a', x1: '#ffffff', x2: '#8ec4e4', rune: '#9ae8ff' },
    floor: (wx, wy, h, n, _N, P, fbm) => {
      const i = fbm(wx * 0.5 + 21, wy * 0.5 + 2);
      if (i < 0.38) {
        // 얼음판: 하이라이트 잔점 + 큰 반짝 얼룩
        if (h < 0.04 || (fbm(wx * 2.2 + 50, wy * 2.2) > 0.68 && h < 0.5)) return P.x1;
        return h < 0.2 ? P.x2 : P.dirt;
      }
      if (i < 0.41) return P.dirtD;
      return n > 0.66 ? (h < 0.3 ? P.b : P.a) : h < 0.08 ? P.c : h < 0.18 ? P.b : P.a;
    },
    outside: (e, _x, _y, h, P) => (e < -0.6 ? (h < 0.3 ? P.edge : P.void) : e < -0.15 ? (h < 0.3 ? P.x2 : P.edge) : h < 0.6 ? P.c : P.dirtD),
    props: ['ice_crystal', 'ice_rock', 'ice_banner', 'ice_cliff'],
    glow: { ice_crystal: '160,230,255' },
    particle: 'snow',
    light: 'cold',
    rock: ['#a8b8c8', '#e8f2fa', '#6a7e94'],
    band: '#6ab8e8',
  },
  // 별의 심연: 검푸른 돌판 + 빛나는 별무늬 균열 · 끝없는 밤하늘 · 별 가루 상승 · 균열의 금빛
  abyss: {
    pal: { a: '#202a4c', b: '#273358', c: '#18203c', dirt: '#ffd36b', dirtD: '#b07a30', edge: '#0c1028', void: '#04050e', x1: '#0e1428', x2: '#3a4a80', rune: '#ffd36b' },
    floor: (wx, wy, h, n, _N, P, fbm) => {
      const k = Math.abs(fbm(wx * 0.7 + 3, wy * 0.7 + 9) - 0.5);
      if (k < 0.018) return h < 0.2 ? '#fff3c0' : P.dirt;
      if (k < 0.04) return h < 0.5 ? P.dirtD : P.c;
      if (fr(wx * 0.8) < 0.05 || fr(wy * 0.8) < 0.05) return P.x1;
      if (h < 0.015) return P.x2;
      return n > 0.6 ? P.b : h < 0.1 ? P.c : P.a;
    },
    outside: (e, _x, _y, h, P) => {
      if (e >= -0.15) return h < 0.6 ? P.edge : P.c;
      // 밤하늘: 별 점
      if (h < 0.012) return '#e8eeff';
      if (h < 0.03) return '#6a78b0';
      return P.void;
    },
    props: ['abyss_float', 'abyss_stairs', 'abyss_pillar', 'abyss_crack'],
    glow: { abyss_pillar: '255,210,110', abyss_crack: '255,210,110', abyss_float: '140,160,255' },
    particle: 'star',
    light: 'rise',
    rock: ['#2e3a64', '#4a5a90', '#141a34'],
    band: '#ffd36b',
  },
  // ───────── REGIONS2 §4 ─────────
  // 가라앉은 등대 해안: 젖은 모래 + 얕은 물(반사 잔점) + 조개 · 파도 치는 바다 · 물보라 · 해 질 녘 주황 + 등대 회전 빛
  coast: {
    pal: { a: '#c9b48a', b: '#d6c296', c: '#b39e74', dirt: '#5fb0c4', dirtD: '#3d8aa2', edge: '#2a6a8a', void: '#0e2c44', x1: '#e8f6ff', x2: '#f2e2d0', rune: '#9ae8ff' },
    floor: (wx, wy, h, n, _N, P, fbm) => {
      const w = fbm(wx * 0.55 + 31, wy * 0.55 + 4);
      // 얕은 물 칸: 반사 잔점 + 가장자리 물거품
      if (w < 0.24) return h < 0.03 ? P.x1 : h < 0.3 ? P.dirtD : P.dirt;
      if (w < 0.26) return h < 0.3 ? P.x1 : P.c;
      // 조개 (드문 밝은 점) · 젖은 모래 얼룩
      if (h < 0.006) return P.x2;
      if (h < 0.01) return '#e89a8a';
      return n > 0.62 ? (h < 0.2 ? P.c : P.a) : h < 0.08 ? P.c : h < 0.18 ? P.b : P.a;
    },
    outside: (e, wx, wy, h, P) => {
      if (e >= -0.15) return h < 0.5 ? P.x1 : P.dirt;
      // 파도: 줄무늬 물결 + 흰 거품
      const wave = fr((wx + wy) * 0.45 + Math.sin(wx * 0.7) * 0.3);
      if (wave < 0.05 && h < 0.4) return P.x1;
      return e < -1.2 ? (h < 0.1 ? P.edge : P.void) : h < 0.3 ? P.dirtD : P.edge;
    },
    props: ['coast_wreck', 'coast_lighthouse', 'coast_net', 'coast_coral', 'coast_rock'],
    glow: { coast_lighthouse: '255,230,150' },
    particle: 'spray',
    light: 'dusk',
    rock: ['#8a8070', '#b8ad98', '#5a5248'],
    band: '#4fb3c8',
  },
  // 모래시계 유적: 금빛 모래 + 깨진 석판 · 무너진 기둥 · 모래 바람 · 강한 정오 햇빛
  dune: {
    pal: { a: '#e2bf72', b: '#ecca7e', c: '#cfa95e', dirt: '#b8a07e', dirtD: '#8a7658', edge: '#a8844a', void: '#3a2a14', x1: '#f6e2a8', x2: '#d4c4a0', rune: '#ffe08a' },
    floor: (wx, wy, h, n, _N, P, fbm) => {
      // 석판: 큰 사각 칸 (깨진 금 · 이음매)
      const s = fbm(wx * 0.4 + 7, wy * 0.4 + 19);
      if (s > 0.57) {
        if (fr(wx * 0.9) < 0.07 || fr(wy * 0.9) < 0.07) return P.dirtD;
        if (h < 0.03) return P.dirtD;
        return h < 0.25 ? P.x2 : P.dirt;
      }
      // 모래 물결
      const rip = fr(wx * 0.6 + wy * 0.25 + fbm(wx, wy) * 0.8);
      if (rip < 0.045 && h < 0.8) return P.c;
      if (rip > 0.92 && h < 0.5) return P.x1;
      return n > 0.6 ? P.b : h < 0.06 ? P.c : P.a;
    },
    outside: (e, _x, _y, h, P) => (e < -0.7 ? (h < 0.2 ? P.edge : P.void) : e < -0.15 ? (h < 0.5 ? P.c : P.edge) : h < 0.6 ? P.a : P.c),
    props: ['dune_statue', 'dune_hourglass', 'dune_pots', 'dune_pillar', 'dune_cactus'],
    glow: {},
    particle: 'sand',
    light: 'noon',
    rock: ['#b89a6a', '#e0c890', '#7a6040'],
    band: '#e0b45a',
  },
  // 잿불 화산: 검은 현무암 + 빛나는 용암 균열 · 용암 강 · 불티 · 아래에서 올라오는 붉은 빛
  ember: {
    pal: { a: '#2c2628', b: '#352e30', c: '#221d20', dirt: '#ff7a2a', dirtD: '#c43a14', edge: '#401812', void: '#120808', x1: '#ffd36b', x2: '#4a3e3e', rune: '#ff9a4a' },
    floor: (wx, wy, h, n, _N, P, fbm) => {
      const k = Math.abs(fbm(wx * 0.75 + 13, wy * 0.75 + 2) - 0.5);
      if (k < 0.014) return h < 0.3 ? P.x1 : P.dirt;
      if (k < 0.03) return h < 0.5 ? P.dirtD : P.c;
      if (h < 0.02) return P.x2;
      return n > 0.62 ? P.b : h < 0.1 ? P.c : P.a;
    },
    outside: (e, wx, wy, h, P) => {
      if (e >= -0.2) return h < 0.6 ? P.edge : P.c;
      // 용암 강: 밝은 줄이 흐른다
      const flow = fr((wx - wy) * 0.35);
      if (e < -0.5 && e > -1.6) return flow < 0.12 ? P.x1 : h < 0.4 ? P.dirt : P.dirtD;
      return h < 0.05 ? P.dirtD : P.void;
    },
    props: ['ember_boulder', 'ember_crystal', 'ember_anvil', 'ember_vent', 'ember_tree'],
    glow: { ember_crystal: '255,150,70', ember_vent: '255,110,50', ember_tree: '255,120,60' },
    particle: 'ember',
    light: 'lava',
    rock: ['#3a3236', '#5a4e50', '#1a1416'],
    band: '#e0603a',
  },
  // 구름 정원: 구름 바닥 + 떠 있는 풀섬 + 돌다리 · 끝없는 하늘 · 꽃잎·깃털 · 밝은 하늘빛 + 구름 그림자
  sky: {
    pal: { a: '#f2f6ff', b: '#ffffff', c: '#dce6f6', dirt: '#7cc05a', dirtD: '#5a9a44', edge: '#a8cdf0', void: '#6aa8e8', x1: '#c8c0b0', x2: '#a89e8c', rune: '#ffe08a' },
    floor: (wx, wy, h, n, N, P, fbm) => {
      // 돌다리: 가운데 한 줄
      const br = Math.abs(wy - N * 0.5 - Math.sin(wx * 0.4) * 0.6);
      if (br < 0.55) return fr(wx * 1.4) < 0.1 ? P.x2 : h < 0.2 ? P.x2 : P.x1;
      // 풀섬
      const g = fbm(wx * 0.5 + 3, wy * 0.5 + 27);
      if (g > 0.66) return h < 0.04 ? '#ffd0e0' : h < 0.25 ? P.dirtD : P.dirt;
      if (g > 0.63) return P.dirtD;
      // 구름 (몽글몽글 밝은 얼룩)
      return n > 0.58 ? P.b : h < 0.1 ? P.c : P.a;
    },
    outside: (e, wx, wy, h, P) => {
      if (e >= -0.2) return h < 0.6 ? P.c : P.edge;
      // 끝없는 하늘: 구름 띠 · 멀리 다른 섬 (드문 초록 점)
      const cl = fr((wx + wy * 0.3) * 0.18);
      if (cl < 0.12) return h < 0.6 ? '#eaf4ff' : P.edge;
      if (h < 0.004) return '#7cc05a';
      return e > -0.9 ? P.edge : P.void;
    },
    props: ['sky_windmill', 'sky_island', 'sky_flowers', 'sky_lantern', 'sky_cloud'],
    glow: { sky_lantern: '255,220,140' },
    particle: 'petal',
    light: 'skylight',
    rock: ['#c8c0b0', '#eae4d8', '#8a8274'],
    band: '#bfe3ff',
  },
  // 심연의 바닥: 별이 꺼진 검은 돌 + 희미한 별 자국 · 위로 아득한 입구 · 거꾸로 떨어지는 빛 가루 · 아주 어둡게
  deep: {
    pal: { a: '#141220', b: '#191626', c: '#0e0c18', dirt: '#3a3466', dirtD: '#24203e', edge: '#08070e', void: '#020205', x1: '#6a5ab0', x2: '#c8c0ff', rune: '#8a7ae0' },
    floor: (wx, wy, h, n, _N, P, fbm) => {
      // 희미한 별 자국 (꺼진 별 모양 얼룩)
      const k = Math.abs(fbm(wx * 0.6 + 41, wy * 0.6 + 8) - 0.5);
      if (k < 0.012) return h < 0.15 ? P.x1 : P.dirt;
      if (k < 0.025) return P.dirtD;
      if (h < 0.004) return P.x2;
      return n > 0.62 ? P.b : h < 0.1 ? P.c : P.a;
    },
    outside: (e, _x, _y, h, P) => (e >= -0.2 ? (h < 0.5 ? P.edge : P.c) : h < 0.003 ? '#4a4280' : P.void),
    props: ['deep_star', 'deep_gear', 'deep_lantern', 'deep_slab', 'deep_chain'],
    glow: { deep_slab: '170,150,255' },
    particle: 'upfall',
    light: 'dark',
    rock: ['#24203a', '#3a3460', '#0c0a16'],
    band: '#6a4fd0',
  },
};
export const themeOf = (region: string): Theme => THEMES[region] ?? THEMES.forest;

/** 보스 「깊은 곳」: 색을 어둡게 (0~1 섞기) */
export function deepen(hex: string, k = 0.3): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * (1 - k));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ───────── 소품 그림 (처음 사냥터에 들어갈 때 불러 둔다) ─────────
export const PROP_IMG: Record<string, HTMLImageElement> = {};
let loading: Promise<void> | null = null;
export function loadHuntProps(): Promise<void> {
  return (loading ??= Promise.all(
    Object.values(THEMES)
      .flatMap((t) => t.props)
      .map(
        (k) =>
          new Promise<void>((ok) => {
            const im = new Image();
            im.onload = () => ((PROP_IMG[k] = im), ok());
            im.onerror = () => ok();
            im.src = av(new URL(`assets/combat/props/${k}.png`, document.baseURI).href);
          }),
      ),
  ).then(() => {}));
}

/** 둘레 소품 배치 (필드 밖 1~2칸 · 스테이지 시드) — 뒤쪽 두 변은 촘촘히, 앞쪽 두 변은 낮은 것 몇 개만 */
export function placeProps(region: string, stage: number, N: number): { x: number; y: number; k: string }[] {
  const t = themeOf(region);
  let s = (region.length * 977 + stage * 7919 + region.charCodeAt(0) * 131) >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out: { x: number; y: number; k: string }[] = [];
  const pick = (low: boolean) => {
    const pool = low ? t.props.filter((k) => !/cave|pillar|stairs|cliff|banner|bigmush|beam|lighthouse|wreck|hourglass|cactus|windmill|island|lantern|vent|tree|chain/.test(k)) : t.props;
    return (pool.length ? pool : t.props)[Math.floor(rnd() * (pool.length || t.props.length))];
  };
  // 뒤쪽 (화면 위): y = -1.2~-2.2 줄 · x = -1.2~-2.2 줄
  for (let i = -1; i < N + 1; i += 2.2 + rnd() * 1.2) {
    if (rnd() < 0.82) out.push({ x: i + rnd() * 0.6, y: -1.3 - rnd() * 0.9, k: pick(false) });
    if (rnd() < 0.82) out.push({ x: -1.3 - rnd() * 0.9, y: i + rnd() * 0.6, k: pick(false) });
  }
  // 앞쪽 (화면 아래): 낮은 소품만 드문드문
  for (let i = 1; i < N - 1; i += 4 + rnd() * 2) {
    if (rnd() < 0.5) out.push({ x: i, y: N + 1.2 + rnd() * 0.6, k: pick(true) });
    if (rnd() < 0.5) out.push({ x: N + 1.2 + rnd() * 0.6, y: i, k: pick(true) });
  }
  return out;
}
