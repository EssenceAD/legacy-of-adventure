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
      ['inn', 9, 3, 8, 265], ['dungeon', 21, 10], ['cottage', 1, 1, 1, 265], ['cottage', 4, 1, 1, 265], ['cottage', 1, 5, 1, 265], ['cottage', 4, 5, 1, 265], ['chicken_coop', 7, 1], ['dog_house', 7, 5],
      ['beehives', 0, 3], ['birdhouse', 3, 3], ['bath', 17, 1], ['koi_pond', 14, 1], ['rock_fall', 15, 4], ['tower', 20, 1], ['maple', 21, 5], ['double_lamp', 17, 5],
      ['stonewall2', 15, 7], ['stonewall2', 16, 7], ['stonewall2', 17, 7], ['stonewall2', 18, 7], ['stonewall2', 19, 7], ['stonewall2', 20, 7], ['stonewall2', 21, 7], ['tavern', 15, 9, 6, 265],
      ['barrel_stack', 19, 9], ['barrel_stack', 19, 10], ['windmill', 19, 11], ['fountain', 14, 15], ['rose_bench', 13, 16], ['rose_bench', 16, 15], ['tulip_box', 16, 17], ['tulip_box', 13, 17],
      ['tulip_box', 14, 14], ['guild', 5, 11, 1, 265], ['smith', 1, 11, 1, 265], ['knight_statue', 9, 12], ['tulip_box', 0, 16], ['tulip_box', 1, 16], ['tulip_box', 2, 16], ['tulip_box', 3, 16],
      ['tulip_box', 4, 16], ['training', 5, 17], ['alchemy', 1, 17, 1, 265], ['target', 8, 17], ['target', 8, 19], ['clock_tower', 13, 19], ['tulip_box', 12, 19], ['tulip_box', 14, 19],
      ['double_lamp', 10, 21], ['double_lamp', 12, 21], ['signpost', 10, 19], ['stall', 16, 19], ['stall', 18, 19], ['fruit_stall', 20, 19], ['flower_cart', 15, 21], ['string_lights', 16, 18],
      ['string_lights', 19, 18], ['double_lamp', 10, 10], ['double_lamp', 12, 14], ['double_lamp', 10, 17], ['cherry', 10, 13], ['cherry', 12, 11], ['maple', 21, 21], ['cherry', 21, 15],
      ['pine', 0, 14], ['hedge', 0, 21], ['hedge', 1, 21], ['hedge', 2, 21], ['hedge', 3, 21], ['hedge', 4, 21], ['hedge', 5, 21], ['hedge', 6, 21],
      ['hedge', 7, 21], ['hedge', 8, 21], ['brazier', 4, 15], ['picket_gate', 3, 8], ['hedge', 0, 8], ['hedge', 1, 8], ['hedge', 2, 8], ['hedge', 4, 8],
      ['hedge', 5, 8], ['hedge', 6, 8],
    ],
  },
  {
    // 땅 4단계: 꽃마을 — 꽃밭과 가로등이 번갈아 늘어선 꽃길 · 장미 아치 대문 · 예배당 꽃 정원 · 분수 광장
    id: 'petal', name: '꽃잎 언덕', owner: '로즈마리', land: 4, like: 512, grade: 3,
    layout: [
      ['inn', 11, 6, 4, 330], ['dungeon', 21, 10], ['tulip_box', 11, 11], ['flowerbed', 11, 13], ['tulip_box', 11, 15], ['flowerbed', 11, 17], ['flowerbed', 14, 11], ['tulip_box', 14, 13],
      ['flowerbed', 14, 15], ['tulip_box', 14, 17], ['rose_arch', 11, 19], ['rose_arch', 14, 19], ['lamppost', 11, 12], ['lamppost', 14, 12], ['lamppost', 11, 16], ['lamppost', 14, 16],
      ['fountain', 16, 13], ['flowerbed', 16, 12], ['flowerbed', 17, 12], ['flowerbed', 16, 15], ['flowerbed', 17, 15], ['rose_bench', 15, 13], ['rose_bench', 18, 14], ['chapel', 16, 6, 1, 330],
      ['tulip_box', 15, 6], ['tulip_box', 19, 6], ['tulip_box', 15, 8], ['tulip_box', 19, 8], ['garden', 5, 5], ['cottage', 8, 5, 1, 330], ['cottage', 8, 8, 1, 330], ['flowerbed', 7, 8],
      ['flowerbed', 10, 10], ['garden', 5, 9], ['tavern', 5, 15, 1, 330], ['bench', 8, 16], ['bench', 8, 17], ['well', 9, 13], ['statue', 19, 18], ['arbor', 5, 19],
      ['flowerbed', 6, 19], ['flowerbed', 7, 19], ['cherry', 4, 4], ['cherry', 4, 13], ['cherry', 4, 21], ['cherry', 20, 4], ['tree', 21, 20], ['tree', 19, 21],
      ['cherry', 10, 4], ['cherry', 15, 4], ['arbor', 16, 9], ['arbor', 18, 9], ['gazebo', 18, 16], ['lily_pond', 16, 18], ['swing', 20, 13], ['bird_bath', 19, 12],
      ['flower_cart', 9, 16], ['beehives', 8, 12], ['rose_arch', 12, 21], ['rose_arch', 14, 21], ['tulip_box', 11, 21], ['tulip_box', 15, 21], ['cherry', 17, 21], ['cherry', 9, 21],
      ['picnic', 8, 19], ['topiary', 12, 18], ['topiary', 15, 18], ['rose_bench', 18, 20], ['bird_bath', 20, 19], ['tulip_box', 18, 21], ['cherry', 21, 17],
    ],
  },
  {
    // 땅 5단계: 시장 도시 — 큰길 양쪽 노점 거리(깃발·가로등) · 앞쪽 가로 시장 · 길드 회관과 큰 주점
    id: 'market', name: '금화 거리', owner: '상인조합장', land: 5, like: 688, grade: 4,
    layout: [
      ['inn', 8, 2, 5, 20], ['dungeon', 21, 10], ['stall', 7, 9], ['stall', 7, 12], ['stall', 7, 15], ['stall', 11, 9], ['stall', 11, 12], ['stall', 11, 15],
      ['shop_sign', 9, 11], ['shop_sign', 9, 14], ['shop_sign', 9, 17], ['banner', 13, 11], ['banner', 13, 14], ['banner', 6, 11], ['banner', 6, 14], ['stall', 13, 18],
      ['stall', 17, 18], ['barrel_stack', 19, 18], ['barrel_stack', 12, 17], ['board', 11, 18], ['guild', 14, 2, 1, 20], ['tavern', 14, 8, 6, 20], ['barrel_stack', 18, 9], ['barrel_stack', 18, 10],
      ['postoffice', 18, 6, 1, 20], ['banner', 18, 8], ['smith', 1, 2, 1, 20], ['alchemy', 4, 2, 1, 20], ['cottage', 1, 6, 1, 20], ['cottage', 4, 6, 1, 20], ['fountain', 3, 10], ['bench', 2, 10],
      ['bench', 5, 11], ['flowerbed', 3, 9], ['flowerbed', 4, 12], ['library', 1, 14, 1, 20], ['stable', 16, 13, 1, 20], ['monument', 2, 19], ['water_pump', 5, 17], ['double_lamp', 13, 20],
      ['double_lamp', 8, 20], ['tree', 0, 0], ['pine', 21, 0], ['tree', 0, 21], ['pine', 21, 21], ['fruit_stall', 19, 13], ['flower_cart', 6, 9], ['string_lights', 13, 9],
      ['string_lights', 13, 12], ['clock_tower', 5, 13], ['signpost', 12, 20], ['knight_statue', 19, 4], ['topiary', 13, 5], ['topiary', 13, 7], ['shop_sign', 9, 21], ['shop_sign', 11, 21],
      ['fruit_stall', 7, 11], ['barrel_stack', 8, 11], ['flower_cart', 7, 14], ['barrel_stack', 8, 14], ['flower_cart', 12, 11], ['fruit_stall', 12, 14], ['barrel_stack', 11, 17], ['fruit_stall', 15, 18],
      ['flower_cart', 16, 19], ['barrel_stack', 15, 19],
    ],
  },
  {
    // 땅 3단계: 숲속 은신처 — 울타리 안까지 들어온 숲 · 모닥불을 둘러싼 벤치 · 훈련장과 과녁
    id: 'moss', name: '이끼 은신처', owner: '숲지기', land: 3, like: 214, grade: 2,
    layout: [
      ['inn', 13, 10, 3, 100], ['dungeon', 21, 10], ['fire', 12, 17], ['bench', 11, 16], ['bench', 13, 16], ['bench', 11, 18], ['bench', 13, 18], ['training', 17, 15],
      ['target', 20, 16], ['target', 20, 18], ['cottage', 9, 9, 1, 100], ['well', 10, 13], ['banner', 17, 13], ['pine', 8, 8], ['pine', 9, 8], ['tree', 10, 8],
      ['pine', 11, 8], ['pine', 12, 8], ['tree', 15, 8], ['pine', 17, 8], ['pine', 19, 8], ['pine', 20, 8], ['tree', 18, 9], ['pine', 21, 9],
      ['birch', 8, 11], ['tree', 8, 12], ['birch', 8, 14], ['pine', 8, 16], ['tree', 9, 16], ['pine', 21, 13], ['pine', 20, 20], ['tree', 21, 21],
      ['pine', 17, 21], ['pine', 19, 19], ['tree', 12, 21], ['pine', 8, 18], ['cottage', 8, 19, 1, 100], ['mushroom_lamp', 10, 15], ['mushroom_lamp', 14, 17], ['mushroom_lamp', 16, 19],
      ['mushroom_dark', 9, 13], ['mushroom_dark', 20, 14], ['brazier', 16, 16], ['rock_fall', 19, 11], ['cat_crate', 12, 9], ['maple', 16, 8], ['mushroom_lamp', 14, 20], ['mushroom_lamp', 16, 21],
      ['mushroom_dark', 14, 21], ['mushroom_lamp', 11, 12], ['mushroom_dark', 12, 13], ['mushroom_lamp', 18, 11],
    ],
  },
  {
    // 땅 4단계: 온천 휴양지 — 좌우 대칭 온천 두 곳(장미 아치·석등·꽃밭) · 분수와 여신상 · 예배당
    id: 'spa', name: '달무리 온천', owner: '온천냥', land: 4, like: 433, grade: 3,
    layout: [
      ['inn', 11, 4, 4, 200], ['dungeon', 21, 10], ['bath', 5, 7], ['arbor', 5, 6], ['arbor', 7, 6], ['double_lamp', 4, 8], ['double_lamp', 8, 8], ['flowerbed', 4, 10],
      ['flowerbed', 8, 10], ['bath', 16, 7], ['arbor', 16, 6], ['arbor', 18, 6], ['double_lamp', 15, 8], ['double_lamp', 19, 8], ['flowerbed', 15, 10], ['flowerbed', 19, 10],
      ['fountain', 9, 11], ['statue', 12, 11], ['chapel', 17, 12, 1, 200], ['tavern', 13, 15, 2, 200], ['cottage', 5, 13, 1, 200], ['cottage', 5, 16, 1, 200], ['cottage', 8, 17, 1, 200], ['flowerbed', 7, 13],
      ['flowerbed', 7, 15], ['lamppost', 11, 13], ['lamppost', 11, 16], ['lamppost', 11, 19], ['bench', 18, 16], ['flowerbed', 18, 17], ['maple', 4, 4], ['maple', 21, 4],
      ['tree', 4, 21], ['tree', 21, 21], ['maple', 9, 4], ['maple', 19, 4], ['rose_bench', 5, 10], ['rose_bench', 7, 10], ['rose_bench', 16, 10], ['rose_bench', 18, 10],
      ['koi_pond', 5, 11], ['foot_bridge', 7, 12], ['rock_fall', 13, 10], ['gazebo', 9, 13], ['lily_pond', 19, 19], ['cherry', 21, 13], ['double_lamp', 12, 21], ['double_lamp', 14, 21],
      ['foot_bridge', 13, 20], ['tulip_box', 19, 16], ['tulip_box', 20, 16], ['bird_bath', 19, 17], ['rose_bench', 20, 15], ['maple', 21, 17], ['birch', 21, 19], ['tulip_box', 20, 12],
    ],
  },
];
