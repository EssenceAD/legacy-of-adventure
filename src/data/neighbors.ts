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
//  빈 땅이 남지 않게 장식(나무·꽃·가로등·벤치)으로 채운다. 「달빛 쉼터」(5단계)는 22×22 쇼케이스 — 큰길·광장·별채 줄·온천 정원·공방 구역
export const NEIGHBORS: Neighbor[] = [
  {
    // 땅 3단계 (8~21): 아담한 시골 여관 — 여관·주점이 마주 보고, 텃밭과 훈련장
    id: 'bear', name: '곰발바닥 여관', owner: '피핀아빠', land: 3, like: 128, grade: 2,
    layout: [
      ['inn', 12, 11, 2, 8], ['dungeon', 21, 10], ['tavern', 17, 13, 1, 8], ['garden', 9, 15], ['training', 16, 8],
      ['well', 13, 17], ['fire', 15, 18], ['board', 19, 19], ['bench', 12, 17], ['flowerbed', 11, 19], ['flowerbed', 16, 20],
      ['lamppost', 13, 19], ['lamppost', 15, 16], ['target', 20, 9],
      ['tree', 8, 8], ['pine', 9, 8], ['tree', 8, 11], ['pine', 10, 12], ['tree', 20, 21], ['pine', 8, 21], ['tree', 9, 20],
      ['pine', 20, 16], ['tree', 12, 8], ['tree', 19, 21], ['arbor', 10, 14],
    ],
  },
  {
    // 땅 5단계 (0~21): 보라 지붕의 큰 쉼터 — 쇼케이스
    id: 'moon', name: '달빛 쉼터', owner: '엘린느', land: 5, like: 902, grade: 4,
    layout: [
      // 가운데: 여관 Lv.8 · 큰길(x=11) · 광장(분수·우물·벤치)
      ['inn', 9, 5, 8, 265], ['dungeon', 21, 10], ['gate', 11, 20],
      ['fountain', 13, 13], ['well', 9, 14], ['bench', 9, 13], ['bench', 15, 15], ['flowerbed', 13, 12], ['flowerbed', 9, 12],
      ['lamppost', 10, 16], ['lamppost', 12, 16], ['lamppost', 10, 19], ['lamppost', 12, 19], ['fire', 13, 16], ['fire', 8, 16],
      // 주점 Lv.6 (오른쪽 앞)
      ['tavern', 15, 8, 6, 100], ['barrels', 19, 12], ['banner', 18, 7],
      // 별채 줄 (왼쪽 뒤)
      ['cottage', 1, 3, 1, 265], ['cottage', 4, 3, 1, 265], ['cottage', 1, 7, 1, 265], ['cottage', 4, 7, 1, 265],
      ['flowerbed', 3, 2], ['flowerbed', 6, 2], ['lamppost', 3, 11], ['bench', 6, 11],
      // 온천 정원 (오른쪽 뒤)
      ['bath', 16, 1], ['arbor', 15, 1], ['flowerbed', 15, 4], ['flowerbed', 19, 4], ['statue', 20, 2], ['tree', 20, 0], ['tree', 14, 0],
      // 공방 구역 (왼쪽 앞): 대장간 · 훈련장 · 과녁
      ['smith', 1, 13], ['training', 4, 17], ['target', 8, 18], ['target', 8, 20], ['barrels', 1, 17],
      // 시장 (오른쪽 앞): 노점 · 텃밭 · 게시판 · 기념비
      ['stall', 19, 18, 1, null], ['garden', 15, 18], ['board', 14, 19], ['monument', 18, 15], ['trophy_boar', 20, 14],
      ['pine', 0, 0], ['pine', 0, 21], ['tree', 3, 21], ['tree', 21, 21], ['pine', 0, 11], ['tree', 8, 0], ['pine', 11, 0],
    ],
  },
  {
    // 땅 4단계 (4~21): 드워프 장인 마을 — 대장간은 하나만
    id: 'hammer', name: '망치와 맥주', owner: '두린7', land: 4, like: 341, grade: 3,
    layout: [
      ['inn', 11, 8, 3, null], ['dungeon', 21, 10], ['smith', 5, 9, 1, 8], ['tavern', 15, 13, 3, 8], ['training', 5, 15],
      ['cottage', 9, 4], ['cottage', 13, 4], ['fire', 10, 15], ['fire', 13, 17], ['board', 11, 19], ['well', 12, 14],
      ['barrels', 9, 10], ['barrels', 16, 11], ['target', 9, 17], ['statue', 14, 19], ['lamppost', 12, 18], ['lamppost', 10, 13],
      ['bench', 13, 14], ['flowerbed', 17, 18], ['banner', 8, 9],
      ['pine', 4, 4], ['pine', 5, 4], ['pine', 4, 21], ['pine', 20, 21], ['pine', 18, 5], ['pine', 20, 8], ['tree', 4, 13], ['tree', 7, 21], ['pine', 19, 4],
    ],
  },
  {
    // 땅 2단계 (11~21): 숲속 작은 오두막 — 여관 하나와 모닥불
    id: 'dew', name: '이슬 오두막', owner: '하플링꼬마', land: 2, like: 37, grade: 1,
    layout: [
      ['inn', 14, 12, 1, 100], ['dungeon', 21, 10], ['well', 13, 17], ['fire', 16, 18], ['bench', 15, 18], ['flowerbed', 12, 15],
      ['flowerbed', 18, 15], ['lamppost', 17, 16], ['tree', 11, 11], ['pine', 12, 11], ['tree', 11, 20], ['pine', 20, 20], ['tree', 19, 12],
      ['tree', 20, 11], ['flowerbed', 13, 13], ['pine', 11, 15], ['arbor', 17, 13], ['bench', 12, 18], ['tree', 20, 17], ['pine', 18, 20],
    ],
  },
];
