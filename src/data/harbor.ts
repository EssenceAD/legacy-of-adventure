// 10/17 예시 마을 「별무리 항구」 — RPG 마을처럼 이야기가 보이게 (맵 44 좌표 · 땅 10 = 0~41 · 앞 가장자리 y=41)
//  1) 길의 위계: 정문(20,40) → 큰 돌길 2칸(x=20~21) → 벽돌 광장(가운데 비움 · 분수 ↔ 은행 마주 봄) → 여관
//     구역은 큰길·광장에서 갈라지는 좁은 흙길·돌길 · 구역 안 길은 한 바퀴 (막다른 길 없음)
//  2) 구역마다 테두리 + 입구: 시장(흰 울타리 · 상점 간판) · 농촌(산울타리 · 밭 → 방앗간 → 빵집) · 항구(큰 연못 물가 · 갈매기 기둥·등대 모형)
//     축제(무대 앞 비움 · 관객 의자 반원 · 꽃등 기둥 둘레) · 마법(돌담 정원 · 학원 정문 앞 마법진 · 수정·별 화분 둘레)
//  3) 랜드마크: 여관(가운데) · 풍차 방앗간(뒤 오른쪽 끝) · 마법 학원 탑(앞 왼쪽 끝)
//  4) 비워 둘 곳: 광장 가운데 · 무대 앞 · 정문 앞 — 남는 잔디는 숲 가장자리 작은 정원·나무 군락
//  5) 전시용 사람(npcs): 노점 손님 · 부두 낚시꾼 · 마법진 마법사 · 무대 음유시인 · 분수 옆 전설
import type { Kind } from './catalog';
import type { Neighbor } from './neighbors';

type Entry = Neighbor['layout'][number];
const L: Entry[] = [];
const P: Record<string, string> = {};
const put = (k: Kind, x: number, y: number, lvl = 1, hue: number | null = null, flip = false) => void L.push([k, x, y, lvl, hue, flip]);
/** 바닥 칠 (네모 · 끝 포함) */
const paint = (c: string, x0: number, y0: number, x1 = x0, y1 = y0) => {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) P[`${x},${y}`] = c;
};
/** 한 줄로 늘어놓기 (빼는 칸 skip) */
const rowX = (k: Kind, y: number, x0: number, x1: number, skip: number[] = [], flip = true) => {
  for (let x = x0; x <= x1; x++) if (!skip.includes(x)) put(k, x, y, 1, null, flip);
};
const rowY = (k: Kind, x: number, y0: number, y1: number, skip: number[] = []) => {
  for (let y = y0; y <= y1; y++) if (!skip.includes(y)) put(k, x, y);
};
const H = 200; // 지붕 하늘색

// ───────── 중심축: 정문 → 큰길 → 광장 → 여관 ─────────
put('inn', 18, 15, 10, H);
put('dungeon', 41, 30);
paint('stone', 20, 20, 21, 20); // 여관 문 앞
paint('brick', 15, 21, 26, 27); // 광장
paint('brick', 14, 22, 14, 24); // 은행 문 앞
paint('stone', 20, 28, 21, 39); // 큰길 2칸
put('gate', 20, 40);
// 정문 앞 비움 · 양옆 등불·간판
put('double_lamp', 19, 39); put('double_lamp', 22, 39); put('signpost', 18, 40); put('banner', 23, 40);
// 큰길 가로등 (양쪽 엇갈려) — 길가 화단은 가장자리에만
for (const y of [29, 31]) put('lamppost', 19, y);
for (const y of [30, 35, 37]) put('lamppost', 22, y);
// 광장: 가운데(19~23, 22~26) 비움 · 서쪽 분수 ↔ 은행 · 동쪽 광장 시계 · 네 귀퉁이 쌍가로등
put('coin_fountain', 16, 23);
put('bank', 11, 22, 3, H, true); // 문이 동쪽(광장·분수 쪽)
put('vault_cart', 11, 25);
put('plaza_clock', 25, 23);
put('double_lamp', 15, 21); put('double_lamp', 26, 21); put('double_lamp', 15, 27); put('double_lamp', 26, 27);
put('rose_bench', 25, 25); put('rose_bench', 25, 21); put('flowerbed', 17, 21); put('flowerbed', 23, 21);

// ───────── 앞 왼쪽 끝: 마법 정원 (돌담 · 학원 탑 = 랜드마크) ─────────
put('mage_academy', 3, 31, 4, 265);
paint('stone', 3, 35, 8, 35); paint('stone', 3, 38, 6, 38); paint('stone', 3, 35, 3, 38); paint('stone', 6, 35, 6, 38); // 마법진 둘레 한 바퀴
paint('stone', 8, 33, 8, 35); paint('stone', 9, 33, 10, 33); // 학원 → 돌담 입구(9,33) → 시장 길
put('magic_circle', 4, 36); // 학원 정문(5,35) 앞 가운데
put('float_crystal', 2, 36); put('float_crystal', 7, 36); put('star_pot', 2, 38); put('star_pot', 7, 38); put('star_pot', 2, 35); put('star_pot', 7, 35 - 1);
put('owl_perch', 2, 32); put('spell_shelf', 7, 31); put('float_books', 7, 32); put('mushroom_lamp', 1, 34); put('aurora_pillar', 8, 37);
put('birch', 1, 30); put('birch', 8, 30); put('birch', 1, 40); put('cherry', 4, 40); put('birch', 7, 40);
rowX('stonewall2', 29, 1, 9); rowY('stonewall2', 9, 30, 40, [33]);

// ───────── 앞 왼쪽: 시장 거리 (흰 울타리 · 마주 보는 노점 줄 · 입구 상점 간판) ─────────
put('general_store', 10, 30, 3, H); // 문(11,33) — 시장 길 서쪽 끝
paint('dirt', 11, 33, 19, 33); paint('dirt', 11, 36, 19, 36); paint('dirt', 11, 33, 11, 36); paint('dirt', 19, 33, 19, 36); // 한 바퀴
// 북쪽 줄 (길을 바라봄)
put('market_tent', 13, 32); put('crate_pile', 15, 32); put('market_tent', 16, 32); put('shop_board', 18, 32);
// 남쪽 줄 (안쪽 · 길을 바라봄)
put('market_tent', 12, 34); put('basket_pile', 14, 34); put('scale_stand', 15, 34); put('market_tent', 16, 34); put('fruit_stall', 18, 34);
put('flower_cart', 13, 35); put('barrel_stack', 17, 35);
put('lamppost', 12, 37); put('lamppost', 17, 37); put('string_lights', 13, 31); put('string_lights', 18, 31);
rowX('picket_gate', 38, 10, 19); rowX('picket_gate', 29, 13, 18);

// ───────── 앞 오른쪽: 축제 (무대 앞 비움 · 관객 의자 반원 · 꽃등 기둥 둘레) ─────────
put('bard_stage', 31, 29, 3, H); // 문(32,32)
paint('stone', 22, 33, 37, 33); // 큰길에서 축제 마당으로 · 무대 앞을 지나는 길
paint('sand', 30, 32, 35, 32); paint('stone', 32, 32); // 무대 앞 모래 마당 (비움)
paint('stone', 28, 33, 28, 37); paint('stone', 37, 33, 37, 37); paint('stone', 28, 37, 37, 37); // 관객석 뒤로 한 바퀴
put('audience_bench', 29, 34); put('audience_bench', 34, 34); put('audience_bench', 31, 35); // 반원
put('garland_post', 28, 32); put('garland_post', 37, 32); put('garland_post', 29, 36); put('garland_post', 36, 36);
put('stage_light', 30, 29); put('stage_light', 34, 29); put('music_stand', 30, 31); put('festival_drum', 34, 31);
put('firework_stand', 38, 30); put('string_lights', 29, 30); put('string_lights', 35, 30);
put('lamppost', 25, 32); put('lamppost', 25, 34);
rowX('hedge', 38, 24, 36); rowY('hedge', 24, 29, 32); rowY('hedge', 24, 34, 37);
put('cherry', 39, 31); put('maple', 39, 34); put('flowerbed', 38, 35); put('tulip_box', 26, 36);

// ───────── 뒤 오른쪽 끝: 농촌 (산울타리 · 밭 → 방앗간 → 빵집 · 풍차 = 랜드마크) ─────────
put('garden', 28, 3, 6); put('garden', 32, 3, 6);
put('grain_mill', 37, 2, 3); // 문(38,5)
put('bakery', 33, 8, 3, H); // 문(34,11)
paint('dirt', 27, 6, 39, 6); paint('dirt', 38, 5); paint('dirt', 39, 6, 39, 11); paint('dirt', 27, 11, 39, 11); paint('dirt', 27, 6, 27, 11); // 한 바퀴
// 밭 → 방앗간 → 빵집 사이 길가: 짐수레 · 밀가루 포대 (흙바닥 위)
paint('gravel', 36, 7, 37, 8);
put('harvest_cart', 36, 7); put('flour_sacks', 37, 7); put('flour_sacks', 37, 8);
put('stone_oven', 36, 9); put('bread_rack', 32, 9); put('milk_cans', 32, 10); put('straw_bale', 30, 8); put('straw_bale', 30, 9);
put('hay_scarecrow', 31, 2); put('pumpkins', 35, 3); put('wheat_sheaf', 35, 4); put('water_wheel', 28, 8); put('chicken_coop', 31, 10);
put('lamppost', 31, 5); put('lamppost', 36, 10);
rowX('hedge', 13, 26, 40, [27]); rowY('hedge', 26, 1, 12);
put('birch', 40, 2); put('maple', 40, 8);

// ───────── 뒤 왼쪽: 항구 (큰 연못 물가 · 선착장·부두·보트가 물에 닿게 · 입구 갈매기 기둥·등대) ─────────
paint('pond', 1, 1, 8, 7);
put('fishing_dock', 9, 3, 3, H); // 문(10,6) · 서쪽이 물
put('wood_pier', 5, 8); put('row_boat', 7, 8);
paint('deck', 10, 6, 10, 8);
paint('dirt', 3, 9, 13, 9); paint('dirt', 3, 12, 13, 12); paint('dirt', 3, 9, 3, 12); paint('dirt', 13, 9, 13, 12); // 물가 한 바퀴
paint('dirt', 14, 12, 15, 12); // 항구 입구 → 공방 길
put('gull_post', 14, 11); put('mini_lighthouse', 14, 13);
put('net_rack', 12, 7); put('barrel_stack', 12, 4); put('barrel_stack', 12, 5); put('gull_post', 9, 1);
put('cottage', 5, 10, 1, H); put('lantern_post', 9, 10); put('bench', 11, 10); put('lantern_post', 4, 13 - 2);
put('pine', 1, 10); put('pine', 1, 13); put('birch', 6, 13); put('pine', 10, 13);

// ───────── 뒤 가운데: 공방 거리 (대장간 · 공방 · 서재 · 예배당 · 우체국) ─────────
put('smith', 15, 2, 7, H); put('alchemy', 19, 2, 5, H); put('library', 23, 2, 5, H);
put('chapel', 22, 8, 5); put('postoffice', 18, 8, 5, H);
paint('stone', 15, 6, 25, 6); paint('stone', 15, 13, 25, 13); paint('stone', 15, 6, 15, 13); paint('stone', 25, 6, 25, 13); // 한 바퀴
paint('stone', 16, 5); paint('stone', 20, 5); paint('stone', 24, 5); paint('stone', 19, 10, 19, 12); paint('stone', 23, 11, 23, 12);
paint('stone', 16, 14, 16, 20); // 공방 → 광장
paint('stone', 25, 14, 27, 14); paint('stone', 27, 12, 27, 14); // 공방 → 농촌 입구
put('brazier', 17, 7); put('weapon_rack', 17, 9); put('lamppost', 21, 7); put('lamppost', 17, 12); put('flowerbed', 21, 12); put('tulip_box', 17, 11);

// ───────── 왼쪽 가운데: 주택가 (주점 · 온천 · 별채) ─────────
put('tavern', 2, 17, 6, H); // 문(4,21)
put('bath', 7, 16, 5); // 문(8,19)
put('cottage', 1, 23, 1, H); put('cottage', 5, 23, 1, H); put('cottage', 8, 23, 1, H);
paint('dirt', 4, 21, 4, 26); paint('dirt', 8, 19, 8, 22); paint('dirt', 4, 22, 8, 22); paint('dirt', 7, 22, 7, 26); paint('dirt', 2, 26, 14, 26); // 한 바퀴 + 광장으로
paint('dirt', 2, 25); paint('dirt', 6, 25); paint('dirt', 9, 25);
put('fire', 11, 18); put('bench', 12, 18); put('bench', 11, 19); put('barrel_stack', 6, 17 + 4); put('lamppost', 10, 21); put('lamppost', 3, 27);
put('dog_house', 12, 27); put('flowerbed', 9, 27); put('tulip_box', 6, 27);
rowX('hedge', 15, 1, 12);

// ───────── 오른쪽 가운데: 모험가 거리 (길드 · 마법사의 탑 · 훈련장 · 마구간 · 별채) ─────────
put('guild', 35, 16, 5, H); // 문(37,20)
put('tower', 31, 17, 5); // 문(32,19)
put('training', 28, 22, 6); put('stable', 33, 22, 5); put('cottage', 37, 22, 1, H);
paint('stone', 27, 20, 39, 20); paint('stone', 27, 25, 39, 25); paint('stone', 27, 20, 27, 25); paint('stone', 39, 20, 39, 25); paint('stone', 32, 19); paint('stone', 38, 24); // 한 바퀴
paint('stone', 27, 15, 27, 19); // 농촌 입구 ↔ 모험가 거리
put('target', 30, 21 - 2); put('target', 29, 19); put('banner', 34, 19); put('lamppost', 33, 21 - 2 + 2); put('lamppost', 38, 21); put('knight_statue', 30, 26);
put('flowerbed', 35, 26); put('cherry', 39, 27); put('maple', 37, 27);

// ───────── 숲 가장자리: 나무 액자 + 작은 정원·나무 군락 ─────────
const TREES: Kind[] = ['pine', 'birch', 'pine', 'cherry'];
for (let x = 0; x <= 41; x++) put(TREES[x % 4], x, 0);
for (let y = 1; y <= 41; y++) put(TREES[y % 4], 0, y);
for (const [x, y] of [[41, 4], [41, 9], [41, 14], [41, 19], [41, 24], [41, 33], [41, 37]] as [number, number][]) put(y % 2 ? 'pine' : 'maple', x, y);
for (const [x, y] of [[3, 41], [8, 41], [13, 41], [27, 41], [32, 41], [37, 41]] as [number, number][]) put(x % 2 ? 'pine' : 'birch', x, y);
// 작은 정원 (앞 오른쪽 끝) · 나무 군락 (뒤 왼쪽 물가 너머 · 오른쪽 가장자리)
put('gazebo', 38, 39); put('flowerbed', 37, 40); put('tulip_box', 40, 37); put('rose_bench', 36, 39);
put('maple', 40, 15); put('birch', 40, 18); put('pine', 40, 28);
// 앞 가장자리 (축제 산울타리 밖 · 정자 정원 둘레) · 오른쪽 가장자리 (던전 옆) · 시장 울타리 밖 — 나무 군락과 작은 꽃밭
for (const [k, x, y] of [['pine', 25, 40], ['birch', 27, 39], ['flowerbed', 28, 40], ['pine', 30, 39], ['maple', 32, 40], ['flowerbed', 33, 39], ['pine', 35, 40], ['tulip_box', 36, 40]] as [Kind, number, number][]) put(k, x, y);
for (const [k, x, y] of [['pine', 40, 27], ['birch', 39, 29], ['pine', 40, 32], ['flowerbed', 39, 36], ['pine', 40, 35]] as [Kind, number, number][]) put(k, x, y);
for (const [k, x, y] of [['birch', 11, 40], ['flowerbed', 12, 39], ['pine', 14, 40], ['tulip_box', 16, 39], ['birch', 17, 40]] as [Kind, number, number][]) put(k, x, y);

// ───────── 전시용 사람 ─────────
export const HARBOR_NPCS: NonNullable<Neighbor['npcs']> = [
  // 시장 노점 앞 손님
  { kind: 'rogue', name: '손님', x: 14, y: 33, dir: -1 },
  { kind: 'cleric', name: '손님', x: 17, y: 33 },
  { kind: 'dwarf', name: '손님', x: 15, y: 36, dir: -1 },
  // 부두 끝 낚시꾼 (물을 바라봄)
  { kind: 'hunter', name: '낚시꾼', x: 5, y: 8, dir: -1 },
  // 마법진 위 마법사
  { kind: 'mage', name: '견습 마법사', x: 4, y: 36 },
  // 무대 위 음유시인
  { kind: 'cleric', name: '음유시인', x: 32, y: 31 },
  // 광장 분수 옆 전설
  { legend: 'elysia', name: '엘리시아', x: 18, y: 23 },
  { legend: 'leon', name: '레온', x: 18, y: 25, dir: -1 },
  { legend: 'luna', name: '루나', x: 16, y: 25 },
];
export const HARBOR_LAYOUT = L;
export const HARBOR_PAINT = P;
