// 오늘의 목표 (현실 날짜로 매일 3개). event는 world/progress.ts 의 track(event)와 같은 이름.
export type GoalEvent = 'expeditionSent' | 'meal' | 'chem' | 'salvage' | 'enhance' | 'harvest' | 'guestArrive' | 'expeditionWin' | 'craft' | 'train';

export interface GoalTemplate {
  id: string;
  event: GoalEvent;
  text: (n: number) => string;
  /** 목표 수 범위 */
  min: number;
  max: number;
  reward: { gold: number; dust?: number };
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  { id: 'send', event: 'expeditionSent', text: (n) => `원정 ${n}번 보내기`, min: 2, max: 4, reward: { gold: 150, dust: 20 } },
  { id: 'win', event: 'expeditionWin', text: (n) => `원정 ${n}번 성공하기`, min: 1, max: 3, reward: { gold: 200 } },
  { id: 'meal', event: 'meal', text: (n) => `주점에서 손님 ${n}명 식사`, min: 4, max: 8, reward: { gold: 120 } },
  { id: 'chem', event: 'chem', text: (n) => `케미 ${n}번 보기`, min: 1, max: 2, reward: { gold: 150 } },
  { id: 'salvage', event: 'salvage', text: (n) => `장비 ${n}개 분해하기`, min: 2, max: 5, reward: { gold: 80, dust: 40 } },
  { id: 'enhance', event: 'enhance', text: (n) => `장비 강화 ${n}번`, min: 1, max: 3, reward: { gold: 100, dust: 30 } },
  { id: 'harvest', event: 'harvest', text: (n) => `텃밭 ${n}번 수확하기`, min: 1, max: 3, reward: { gold: 100 } },
  { id: 'guest', event: 'guestArrive', text: (n) => `새 손님 ${n}명 맞이하기`, min: 2, max: 4, reward: { gold: 120 } },
  { id: 'train', event: 'train', text: (n) => `훈련장에서 ${n}번 수련하기`, min: 3, max: 6, reward: { gold: 90 } },
];
