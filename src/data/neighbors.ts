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
      ['inn', 9, 3, 8, 265], ['dungeon', 21, 10], ['gate', 11, 19], ['double_lamp', 10, 10], ['lamppost', 10, 13], ['double_lamp', 10, 16], ['double_lamp', 12, 16], ['fountain', 15, 13],
      ['bench', 14, 13], ['bench', 14, 14], ['bench', 17, 13], ['bench', 17, 14], ['tulip_box', 15, 12], ['tulip_box', 16, 12], ['tulip_box', 15, 15], ['tulip_box', 16, 15],
      ['lamppost', 14, 12], ['lamppost', 17, 12], ['lamppost', 14, 15], ['lamppost', 17, 15], ['stall', 13, 18], ['stall', 15, 18], ['stall', 17, 18], ['barrels', 19, 18],
      ['barrels', 19, 19], ['banner', 13, 17], ['board', 12, 17], ['bath', 17, 1], ['flowerbed', 16, 1], ['flowerbed', 16, 2], ['flowerbed', 16, 3], ['flowerbed', 20, 1],
      ['flowerbed', 20, 2], ['flowerbed', 20, 3], ['lamppost', 16, 4], ['lamppost', 20, 4], ['statue', 18, 0], ['tavern', 15, 7, 6, 265], ['barrels', 19, 7], ['barrels', 19, 8],
      ['banner', 19, 9], ['smith', 1, 12, 1, 265], ['training', 5, 16], ['target', 8, 16], ['target', 8, 18], ['barrels', 4, 12], ['barrels', 4, 13], ['alchemy', 1, 16, 1, 265],
      ['fire', 4, 15], ['cottage', 1, 1, 1, 265], ['cottage', 4, 1, 1, 265], ['cottage', 7, 1, 1, 265], ['cottage', 1, 4, 1, 265], ['cottage', 4, 4, 1, 265], ['cottage', 7, 4, 1, 265], ['flowerbed', 3, 1],
      ['flowerbed', 6, 1], ['flowerbed', 3, 5], ['flowerbed', 6, 5], ['lamppost', 3, 3], ['lamppost', 6, 3], ['garden', 1, 7], ['garden', 5, 7], ['well', 4, 8],
      ['guild', 5, 11, 1, 265], ['postoffice', 8, 9, 1, 265], ['tower', 20, 5], ['stable', 19, 14, 1, 265], ['monument', 13, 20], ['pine', 0, 0], ['tree', 21, 0], ['pine', 0, 21],
      ['tree', 21, 21], ['birch', 0, 10], ['tree', 21, 17], ['arbor', 17, 4], ['arbor', 19, 4], ['library', 12, 8, 1, 265], ['lamppost', 12, 13], ['hedge', 1, 0],
      ['hedge', 2, 0], ['hedge', 3, 0], ['hedge', 4, 0], ['hedge', 5, 0], ['hedge', 6, 0], ['hedge', 7, 0], ['hedge', 8, 0], ['dog_house', 0, 3],
      ['chicken_coop', 8, 7], ['beehives', 4, 7], ['windmill', 19, 10], ['hay_scarecrow', 0, 7], ['koi_pond', 14, 1], ['rock_fall', 14, 4], ['cherry', 15, 0], ['maple', 21, 2],
      ['maple', 21, 3], ['clock_tower', 18, 13], ['cherry', 10, 12], ['cherry', 12, 12], ['string_lights', 14, 17], ['string_lights', 17, 17], ['flower_cart', 16, 17], ['fruit_stall', 19, 17],
      ['shop_sign', 20, 18], ['brazier', 4, 14], ['knight_statue', 9, 12], ['water_pump', 9, 15], ['signpost', 10, 19],
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
      ['flower_cart', 9, 16], ['beehives', 8, 12],
    ],
  },
  {
    // 땅 5단계: 시장 도시 — 큰길 양쪽 노점 거리(깃발·가로등) · 앞쪽 가로 시장 · 길드 회관과 큰 주점
    id: 'market', name: '금화 거리', owner: '상인조합장', land: 5, like: 688, grade: 4,
    layout: [
      ['inn', 8, 2, 5, 20], ['dungeon', 21, 10], ['gate', 10, 20], ['stall', 7, 9], ['stall', 7, 12], ['stall', 7, 15], ['stall', 11, 9], ['stall', 11, 12],
      ['stall', 11, 15], ['shop_sign', 9, 11], ['shop_sign', 9, 14], ['shop_sign', 9, 17], ['banner', 13, 11], ['banner', 13, 14], ['banner', 6, 11], ['banner', 6, 14],
      ['stall', 13, 18], ['stall', 15, 18], ['stall', 17, 18], ['barrel_stack', 19, 18], ['barrel_stack', 12, 17], ['board', 11, 18], ['guild', 14, 2, 1, 20], ['tavern', 14, 8, 6, 20],
      ['barrel_stack', 18, 9], ['barrel_stack', 18, 10], ['postoffice', 18, 6, 1, 20], ['banner', 18, 8], ['smith', 1, 2, 1, 20], ['alchemy', 4, 2, 1, 20], ['cottage', 1, 6, 1, 20], ['cottage', 4, 6, 1, 20],
      ['fountain', 3, 10], ['bench', 2, 10], ['bench', 5, 11], ['flowerbed', 3, 9], ['flowerbed', 4, 12], ['library', 1, 14, 1, 20], ['stable', 16, 13, 1, 20], ['monument', 2, 19],
      ['water_pump', 5, 17], ['double_lamp', 13, 20], ['double_lamp', 8, 20], ['tree', 0, 0], ['pine', 21, 0], ['tree', 0, 21], ['pine', 21, 21], ['fruit_stall', 19, 13],
      ['flower_cart', 6, 9], ['string_lights', 13, 9], ['string_lights', 13, 12], ['clock_tower', 5, 13], ['signpost', 12, 20], ['knight_statue', 19, 4], ['topiary', 13, 5], ['topiary', 13, 7],
    ],
  },
  {
    // 땅 3단계: 숲속 은신처 — 울타리 안까지 들어온 숲 · 모닥불을 둘러싼 벤치 · 훈련장과 과녁
    id: 'moss', name: '이끼 은신처', owner: '숲지기', land: 3, like: 214, grade: 2,
    layout: [
      ['inn', 13, 10, 3, 100], ['dungeon', 21, 10], ['fire', 12, 17], ['bench', 11, 16], ['bench', 13, 16], ['bench', 11, 18], ['bench', 13, 18], ['training', 17, 15],
      ['target', 20, 16], ['target', 20, 18], ['cottage', 9, 9, 1, 100], ['well', 10, 13], ['lamppost', 15, 19], ['banner', 17, 13], ['pine', 8, 8], ['pine', 9, 8],
      ['tree', 10, 8], ['pine', 11, 8], ['pine', 12, 8], ['tree', 15, 8], ['pine', 17, 8], ['pine', 19, 8], ['pine', 20, 8], ['tree', 18, 9],
      ['pine', 21, 9], ['birch', 8, 11], ['tree', 8, 12], ['birch', 8, 14], ['pine', 8, 16], ['tree', 9, 16], ['pine', 21, 13], ['pine', 20, 20],
      ['tree', 21, 21], ['pine', 17, 21], ['pine', 19, 19], ['tree', 12, 21], ['pine', 8, 18], ['cottage', 8, 19, 1, 100], ['mushroom_lamp', 10, 15], ['mushroom_lamp', 14, 17],
      ['mushroom_lamp', 16, 19], ['mushroom_dark', 9, 13], ['mushroom_dark', 20, 14], ['brazier', 16, 16], ['rock_fall', 19, 11], ['cat_crate', 12, 9], ['maple', 16, 8],
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
      ['koi_pond', 5, 11], ['foot_bridge', 7, 12], ['rock_fall', 13, 10], ['gazebo', 9, 13], ['lily_pond', 19, 19], ['cherry', 21, 13],
    ],
  },
];
