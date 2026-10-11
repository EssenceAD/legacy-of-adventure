// 오늘의 목표 (현실 날짜로 매일 3개). event는 world/progress.ts 의 track(event)와 같은 이름.
export type GoalEvent =
  | 'expeditionSent' | 'meal' | 'chem' | 'salvage' | 'enhance' | 'harvest' | 'guestArrive' | 'expeditionWin' | 'craft' | 'train'
  | 'buildFire' | 'guestTalk' | 'roof';

export interface GoalTemplate {
  id: string;
  event: GoalEvent;
  text: (n: number) => string;
  /** 목표 수 범위 */
  min: number;
  max: number;
  reward: { gold: number; dust?: number };
  /** 새 게임 첫날 전용 (첫 원정을 기다리는 동안 할 수 있는 것) */
  first?: boolean;
  /** 5단계: 이게 있어야 후보가 된다 (지은 건물 · 단골 2명) */
  needs?: 'tavern' | 'smith' | 'garden' | 'training' | 'regulars2';
  /** 「가기」 버튼이 여는 곳 */
  go: GoalGo;
}
export type GoalGo = 'board' | 'tavern' | 'smith' | 'garden' | 'training' | 'guests' | 'build' | 'inn' | 'village';

export const GOAL_TEMPLATES: GoalTemplate[] = [
  { id: 'send', event: 'expeditionSent', text: (n) => `의뢰 ${n}번 보내기`, min: 2, max: 4, reward: { gold: 150, dust: 20 }, go: 'board' },
  { id: 'win', event: 'expeditionWin', text: (n) => `의뢰 ${n}번 성공하기`, min: 1, max: 3, reward: { gold: 200 }, go: 'board' },
  { id: 'meal', event: 'meal', text: (n) => `주점에서 손님 ${n}명 식사`, min: 4, max: 8, reward: { gold: 120 }, needs: 'tavern', go: 'tavern' },
  { id: 'chem', event: 'chem', text: (n) => `케미 ${n}번 보기`, min: 1, max: 2, reward: { gold: 150 }, needs: 'regulars2', go: 'guests' },
  { id: 'salvage', event: 'salvage', text: (n) => `장비 ${n}개 분해하기`, min: 2, max: 5, reward: { gold: 80, dust: 40 }, needs: 'smith', go: 'smith' },
  { id: 'enhance', event: 'enhance', text: (n) => `장비 강화 ${n}번`, min: 1, max: 3, reward: { gold: 100, dust: 30 }, needs: 'smith', go: 'smith' },
  { id: 'harvest', event: 'harvest', text: (n) => `텃밭 ${n}번 수확하기`, min: 1, max: 3, reward: { gold: 100 }, needs: 'garden', go: 'garden' },
  { id: 'guest', event: 'guestArrive', text: (n) => `새 손님 ${n}명 맞이하기`, min: 2, max: 4, reward: { gold: 120 }, go: 'village' },
  { id: 'train', event: 'train', text: (n) => `훈련장에서 ${n}번 수련하기`, min: 3, max: 6, reward: { gold: 90 }, needs: 'training', go: 'training' },
  // 새 게임 첫날: 첫 원정을 기다리는 동안
  { id: 'fire1', event: 'buildFire', text: () => '모닥불 짓기 (건설 → 모닥불)', min: 1, max: 1, reward: { gold: 100 }, first: true, go: 'build' },
  { id: 'talk1', event: 'guestTalk', text: () => '손님 1명에게 말 걸기 (손님을 눌러요)', min: 1, max: 1, reward: { gold: 80 }, first: true, go: 'guests' },
  { id: 'roof1', event: 'roof', text: () => '지붕 색 바꾸기 (여관을 눌러요)', min: 1, max: 1, reward: { gold: 80 }, first: true, go: 'inn' },
];
