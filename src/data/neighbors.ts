// 이웃 마을 (지금은 가짜 데이터 — 나중에 서버에서 받아온다)
// 좌표는 그 마을 땅 크기 기준(땅 3단계 = 2~11, 4단계 = 1~12, 5단계 = 0~13). 던전은 (10,1) 고정.
// 그릴 때 world/town.ts의 placeLayout()이 내 마을과 같은 배치 검사를 한 번 더 한다.
import type { Kind } from './catalog';

export interface Neighbor {
  id: string;
  /** 실제 유저 마을이면 그 사람 id (3단계 2차) */
  uid?: string;
  /** 대표 영웅 초상화 키 */
  repHero?: string | null;
  /** 5단계 마을 등급 (0 오두막 ~ 4 도시) · 주인 칭호 */
  grade?: number;
  title?: string;
  name: string;
  owner: string;
  land: number;
  like: number;
  /** [종류, x, y, 레벨, 지붕 hue, 좌우 반전] */
  layout: [Kind, number, number, number?, (number | null)?, boolean?][];
}

// 땅 개편 (맵 24): 땅 s단계 = [from, 22) — 1단계 14~21 · 2단계 11~21 · 3단계 8~21 · 4단계 4~21 · 5단계 0~21. 던전은 (21,10) 고정.
// TOWN T1: 「보고 따라 하고 싶은 마을」 — 달빛 쉼터(구역이 나뉜 쇼케이스) + 이웃 4곳은 꽃마을·시장 도시·숲속 은신처·온천 휴양지로 각기 다른 테마
export const NEIGHBORS: Neighbor[] = [
  {
    // 땅 5단계: 쇼케이스 — 큰길(x=11, 가로등 줄) → 중앙 광장(분수 + 벤치·꽃밭·가로등 원형) → 시장 거리(노점 줄) · 온천 정원(꽃밭·장미 아치·석등) · 공방 골목(대장간·훈련장·공방) · 별채 주택가(같은 별채 여섯 채 + 텃밭)
    id: 'moon', name: '달빛 쉼터', owner: '엘린느', land: 5, like: 902, grade: 4,
    layout: [
      ['inn', 17, 11, 8, 265], ['dungeon', 29, 18], ['cottage', 9, 9, 1, 265], ['cottage', 12, 9, 1, 265], ['cottage', 9, 13, 1, 265], ['cottage', 12, 13, 1, 265], ['chicken_coop', 15, 9], ['dog_house', 15, 13],
      ['beehives', 8, 11], ['birdhouse', 11, 11], ['bath', 25, 9], ['koi_pond', 22, 9], ['rock_fall', 23, 12], ['tower', 28, 9], ['maple', 29, 13], ['double_lamp', 25, 13],
      ['stonewall2', 23, 15], ['stonewall2', 24, 15], ['stonewall2', 25, 15], ['stonewall2', 26, 15], ['stonewall2', 27, 15], ['stonewall2', 28, 15], ['stonewall2', 29, 15], ['tavern', 23, 17, 6, 265],
      ['barrel_stack', 27, 17], ['barrel_stack', 27, 18], ['windmill', 27, 19], ['fountain', 22, 23], ['rose_bench', 21, 24], ['rose_bench', 24, 23], ['tulip_box', 24, 25], ['tulip_box', 21, 25],
      ['tulip_box', 22, 22], ['guild', 13, 19, 1, 265], ['smith', 9, 19, 1, 265], ['knight_statue', 17, 20], ['tulip_box', 8, 24], ['tulip_box', 9, 24], ['tulip_box', 10, 24], ['tulip_box', 11, 24],
      ['tulip_box', 12, 24], ['training', 13, 25], ['alchemy', 9, 25, 1, 265], ['target', 16, 25], ['target', 16, 27], ['clock_tower', 21, 27], ['tulip_box', 20, 27], ['tulip_box', 22, 27],
      ['double_lamp', 18, 29], ['double_lamp', 20, 29], ['signpost', 18, 27], ['stall', 24, 27], ['stall', 26, 27], ['fruit_stall', 28, 27], ['flower_cart', 23, 29], ['string_lights', 24, 26],
      ['string_lights', 27, 26], ['double_lamp', 18, 18], ['double_lamp', 20, 22], ['double_lamp', 18, 25], ['cherry', 18, 21], ['cherry', 20, 19], ['maple', 29, 29], ['cherry', 29, 23],
      ['pine', 8, 22], ['hedge', 8, 29], ['hedge', 9, 29], ['hedge', 10, 29], ['hedge', 11, 29], ['hedge', 12, 29], ['hedge', 13, 29], ['hedge', 14, 29],
      ['hedge', 15, 29], ['hedge', 16, 29], ['brazier', 12, 23], ['picket_gate', 11, 16], ['hedge', 8, 16], ['hedge', 9, 16], ['hedge', 10, 16], ['hedge', 12, 16],
      ['hedge', 13, 16], ['hedge', 14, 16],
    ],
  },
  {
    // 땅 4단계: 꽃마을 — 꽃밭과 가로등이 번갈아 늘어선 꽃길 · 장미 아치 대문 · 예배당 꽃 정원 · 분수 광장
    id: 'petal', name: '꽃잎 언덕', owner: '로즈마리', land: 4, like: 512, grade: 3,
    layout: [
      ['inn', 19, 14, 4, 330], ['dungeon', 29, 18], ['tulip_box', 19, 19], ['flowerbed', 19, 21], ['tulip_box', 19, 23], ['flowerbed', 19, 25], ['flowerbed', 22, 19], ['tulip_box', 22, 21],
      ['flowerbed', 22, 23], ['tulip_box', 22, 25], ['rose_arch', 19, 27], ['rose_arch', 22, 27], ['lamppost', 19, 20], ['lamppost', 22, 20], ['lamppost', 19, 24], ['lamppost', 22, 24],
      ['fountain', 24, 21], ['flowerbed', 24, 20], ['flowerbed', 25, 20], ['flowerbed', 24, 23], ['flowerbed', 25, 23], ['rose_bench', 23, 21], ['rose_bench', 26, 22], ['chapel', 24, 14, 1, 330],
      ['tulip_box', 23, 14], ['tulip_box', 27, 14], ['tulip_box', 23, 16], ['tulip_box', 27, 16], ['garden', 13, 13], ['cottage', 16, 13, 1, 330], ['cottage', 16, 16, 1, 330], ['flowerbed', 15, 16],
      ['flowerbed', 18, 18], ['garden', 13, 17], ['tavern', 13, 23, 1, 330], ['bench', 16, 24], ['bench', 16, 25], ['well', 17, 21], ['statue', 27, 26], ['arbor', 13, 27],
      ['flowerbed', 14, 27], ['flowerbed', 15, 27], ['cherry', 12, 12], ['cherry', 12, 21], ['cherry', 12, 29], ['cherry', 28, 12], ['tree', 29, 28], ['tree', 27, 29],
      ['cherry', 18, 12], ['cherry', 23, 12], ['arbor', 24, 17], ['arbor', 26, 17], ['gazebo', 26, 24], ['lily_pond', 24, 26], ['swing', 28, 21], ['bird_bath', 27, 20],
      ['flower_cart', 17, 24], ['beehives', 16, 20], ['rose_arch', 20, 29], ['rose_arch', 22, 29], ['tulip_box', 19, 29], ['tulip_box', 23, 29], ['cherry', 25, 29], ['cherry', 17, 29],
      ['picnic', 16, 27], ['topiary', 20, 26], ['topiary', 23, 26], ['rose_bench', 26, 28], ['bird_bath', 28, 27], ['tulip_box', 26, 29], ['cherry', 29, 25],
    ],
  },
  {
    // 땅 5단계: 시장 도시 — 큰길 양쪽 노점 거리(깃발·가로등) · 앞쪽 가로 시장 · 길드 회관과 큰 주점
    id: 'market', name: '금화 거리', owner: '상인조합장', land: 5, like: 688, grade: 4,
    layout: [
      ['inn', 16, 10, 5, 20], ['dungeon', 29, 18], ['stall', 15, 17], ['stall', 15, 20], ['stall', 15, 23], ['stall', 19, 17], ['stall', 19, 20], ['stall', 19, 23],
      ['shop_sign', 17, 19], ['shop_sign', 17, 22], ['shop_sign', 17, 25], ['banner', 21, 19], ['banner', 21, 22], ['banner', 14, 19], ['banner', 14, 22], ['stall', 21, 26],
      ['stall', 25, 26], ['barrel_stack', 27, 26], ['barrel_stack', 20, 25], ['board', 19, 26], ['guild', 22, 10, 1, 20], ['tavern', 22, 16, 6, 20], ['barrel_stack', 26, 17], ['barrel_stack', 26, 18],
      ['postoffice', 26, 14, 1, 20], ['banner', 26, 16], ['smith', 9, 10, 1, 20], ['alchemy', 12, 10, 1, 20], ['cottage', 9, 14, 1, 20], ['cottage', 12, 14, 1, 20], ['fountain', 11, 18], ['bench', 10, 18],
      ['bench', 13, 19], ['flowerbed', 11, 17], ['flowerbed', 12, 20], ['library', 9, 22, 1, 20], ['stable', 24, 21, 1, 20], ['monument', 10, 27], ['water_pump', 13, 25], ['double_lamp', 21, 28],
      ['double_lamp', 16, 28], ['tree', 8, 8], ['pine', 29, 8], ['tree', 8, 29], ['pine', 29, 29], ['fruit_stall', 27, 21], ['flower_cart', 14, 17], ['string_lights', 21, 17],
      ['string_lights', 21, 20], ['clock_tower', 13, 21], ['signpost', 20, 28], ['knight_statue', 27, 12], ['topiary', 21, 13], ['topiary', 21, 15], ['shop_sign', 17, 29], ['shop_sign', 19, 29],
      ['fruit_stall', 15, 19], ['barrel_stack', 16, 19], ['flower_cart', 15, 22], ['barrel_stack', 16, 22], ['flower_cart', 20, 19], ['fruit_stall', 20, 22], ['barrel_stack', 19, 25], ['fruit_stall', 23, 26],
      ['flower_cart', 24, 27], ['barrel_stack', 23, 27],
    ],
  },
  {
    // 땅 3단계: 숲속 은신처 — 울타리 안까지 들어온 숲 · 모닥불을 둘러싼 벤치 · 훈련장과 과녁
    id: 'moss', name: '이끼 은신처', owner: '숲지기', land: 3, like: 214, grade: 2,
    layout: [
      ['inn', 21, 18, 3, 100], ['dungeon', 29, 18], ['fire', 20, 25], ['bench', 19, 24], ['bench', 21, 24], ['bench', 19, 26], ['bench', 21, 26], ['training', 25, 23],
      ['target', 28, 24], ['target', 28, 26], ['cottage', 17, 17, 1, 100], ['well', 18, 21], ['banner', 25, 21], ['pine', 16, 16], ['pine', 17, 16], ['tree', 18, 16],
      ['pine', 19, 16], ['pine', 20, 16], ['tree', 23, 16], ['pine', 25, 16], ['pine', 27, 16], ['pine', 28, 16], ['tree', 26, 17], ['pine', 29, 17],
      ['birch', 16, 19], ['tree', 16, 20], ['birch', 16, 22], ['pine', 16, 24], ['tree', 17, 24], ['pine', 29, 21], ['pine', 28, 28], ['tree', 29, 29],
      ['pine', 25, 29], ['pine', 27, 27], ['tree', 20, 29], ['pine', 16, 26], ['cottage', 16, 27, 1, 100], ['mushroom_lamp', 18, 23], ['mushroom_lamp', 22, 25], ['mushroom_lamp', 24, 27],
      ['mushroom_dark', 17, 21], ['mushroom_dark', 28, 22], ['brazier', 24, 24], ['rock_fall', 27, 19], ['cat_crate', 20, 17], ['maple', 24, 16], ['mushroom_lamp', 22, 28], ['mushroom_lamp', 24, 29],
      ['mushroom_dark', 22, 29], ['mushroom_lamp', 19, 20], ['mushroom_dark', 20, 21], ['mushroom_lamp', 26, 19],
    ],
  },
  {
    // 땅 4단계: 온천 휴양지 — 좌우 대칭 온천 두 곳(장미 아치·석등·꽃밭) · 분수와 여신상 · 예배당
    id: 'spa', name: '달무리 온천', owner: '온천냥', land: 4, like: 433, grade: 3,
    layout: [
      ['inn', 19, 12, 4, 200], ['dungeon', 29, 18], ['bath', 13, 15], ['arbor', 13, 14], ['arbor', 15, 14], ['double_lamp', 12, 16], ['double_lamp', 16, 16], ['flowerbed', 12, 18],
      ['flowerbed', 16, 18], ['bath', 24, 15], ['arbor', 24, 14], ['arbor', 26, 14], ['double_lamp', 23, 16], ['double_lamp', 27, 16], ['flowerbed', 23, 18], ['flowerbed', 27, 18],
      ['fountain', 17, 19], ['statue', 20, 19], ['chapel', 25, 20, 1, 200], ['tavern', 21, 23, 2, 200], ['cottage', 13, 21, 1, 200], ['cottage', 13, 24, 1, 200], ['cottage', 16, 25, 1, 200], ['flowerbed', 15, 21],
      ['flowerbed', 15, 23], ['lamppost', 19, 21], ['lamppost', 19, 24], ['lamppost', 19, 27], ['bench', 26, 24], ['flowerbed', 26, 25], ['maple', 12, 12], ['maple', 29, 12],
      ['tree', 12, 29], ['tree', 29, 29], ['maple', 17, 12], ['maple', 27, 12], ['rose_bench', 13, 18], ['rose_bench', 15, 18], ['rose_bench', 24, 18], ['rose_bench', 26, 18],
      ['koi_pond', 13, 19], ['foot_bridge', 15, 20], ['rock_fall', 21, 18], ['gazebo', 17, 21], ['lily_pond', 27, 27], ['cherry', 29, 21], ['double_lamp', 20, 29], ['double_lamp', 22, 29],
      ['foot_bridge', 21, 28], ['tulip_box', 27, 24], ['tulip_box', 28, 24], ['bird_bath', 27, 25], ['rose_bench', 28, 23], ['maple', 29, 25], ['birch', 29, 27], ['tulip_box', 28, 20],
    ],
  },
];
