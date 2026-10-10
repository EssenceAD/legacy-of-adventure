// 이웃 마을 (지금은 가짜 데이터 — 나중에 서버에서 받아온다)
import type { Kind } from './catalog';

export interface Neighbor {
  id: string;
  name: string;
  owner: string;
  land: number;
  like: number;
  /** [종류, x, y, 레벨, 지붕 hue] */
  layout: [Kind, number, number, number?, (number | null)?][];
}

export const NEIGHBORS: Neighbor[] = [
  {
    id: 'bear', name: '곰발바닥 여관', owner: '피핀아빠', land: 3, like: 128,
    layout: [['inn', 6, 4, 1, 8], ['dungeon', 10, 1], ['tavern', 9, 5, 1, 8], ['garden', 2, 6], ['tree', 4, 3], ['tree', 3, 10], ['fire', 7, 9], ['well', 5, 8]],
  },
  {
    id: 'moon', name: '달빛 쉼터', owner: '엘린느', land: 5, like: 902,
    layout: [['inn', 6, 4, 2, 265], ['dungeon', 10, 1], ['bath', 0, 0], ['tavern', 9, 5, 1, 100], ['garden', 2, 6], ['training', 2, 9], ['smith', 9, 9], ['cottage', 2, 3, 1, 265], ['fire', 7, 9], ['well', 5, 8], ['tree', 12, 12], ['tree', 0, 12], ['tree', 13, 7], ['pine', 1, 12]],
  },
  {
    id: 'hammer', name: '망치와 맥주', owner: '두린7', land: 4, like: 341,
    layout: [['inn', 6, 4, 1, null], ['dungeon', 10, 1], ['smith', 2, 6], ['smith', 9, 9], ['tavern', 9, 5, 1, 8], ['training', 2, 9], ['fire', 7, 9], ['pine', 1, 1], ['board', 8, 10], ['pine', 12, 12]],
  },
];
