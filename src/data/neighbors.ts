// 이웃 마을 (지금은 가짜 데이터 — 나중에 서버에서 받아온다)
// 좌표는 그 마을 땅 크기 기준(땅 3단계 = 2~11, 4단계 = 1~12, 5단계 = 0~13). 던전은 (10,1) 고정.
// 그릴 때 world/town.ts의 placeLayout()이 내 마을과 같은 배치 검사를 한 번 더 한다.
import type { Kind } from './catalog';

export interface Neighbor {
  id: string;
  name: string;
  owner: string;
  land: number;
  like: number;
  /** [종류, x, y, 레벨, 지붕 hue, 좌우 반전] */
  layout: [Kind, number, number, number?, (number | null)?, boolean?][];
}

export const NEIGHBORS: Neighbor[] = [
  {
    // 땅 3단계 (2~11): 아담한 시골 여관
    id: 'bear', name: '곰발바닥 여관', owner: '피핀아빠', land: 3, like: 128,
    layout: [
      ['inn', 4, 4, 1, 8], ['dungeon', 10, 1], ['tavern', 8, 6, 1, 8], ['garden', 2, 8],
      ['well', 6, 9], ['fire', 7, 11], ['board', 10, 10],
      ['tree', 2, 2], ['tree', 3, 3], ['pine', 2, 4], ['tree', 11, 11], ['pine', 2, 11], ['tree', 5, 11],
    ],
  },
  {
    // 땅 5단계 (0~13): 보라 지붕의 큰 쉼터
    id: 'moon', name: '달빛 쉼터', owner: '엘린느', land: 5, like: 902,
    layout: [
      ['inn', 5, 3, 2, 265], ['dungeon', 10, 1], ['bath', 0, 0], ['tavern', 9, 6, 1, 100, true], ['garden', 1, 7],
      ['training', 5, 10], ['smith', 10, 10], ['cottage', 1, 4, 1, 265], ['cottage', 3, 11, 1, 265, true],
      ['fire', 8, 9], ['fire', 4, 7], ['well', 9, 4], ['board', 8, 12], ['trophy_boar', 12, 4],
      ['tree', 13, 5], ['tree', 4, 0], ['pine', 0, 12], ['tree', 13, 9], ['pine', 0, 10], ['tree', 6, 0], ['pine', 13, 13],
    ],
  },
  {
    // 땅 4단계 (1~12): 드워프 장인 마을 — 대장간은 하나만
    id: 'hammer', name: '망치와 맥주', owner: '두린7', land: 4, like: 341,
    layout: [
      ['inn', 6, 4, 1, null], ['dungeon', 10, 1], ['smith', 2, 4, 1, 8], ['tavern', 9, 8, 2, 8], ['training', 2, 9],
      ['fire', 6, 9], ['fire', 1, 8], ['board', 5, 11], ['well', 5, 8],
      ['pine', 1, 1], ['pine', 2, 1], ['tree', 1, 12], ['pine', 12, 12], ['tree', 4, 1], ['pine', 12, 5],
    ],
  },
];
