// 직업(색·얼굴·무기) — reference/core.js의 CLASSES 이식. 이름 목록과 케미 짝도 여기.

export interface Face {
  eyes?: 'dot' | 'calm' | 'squint' | 'sly' | 'happy' | 'round' | 'sparkle';
  brow?: 'angry' | 'bushy' | 'up';
  nose?: 'big';
  mouth?: 'flat' | 'tiny' | 'none' | 'smirk' | 'o' | 'grin';
  blush?: boolean;
  freckle?: boolean;
  scar?: boolean;
  glasses?: boolean;
  brow2?: number;
}

export interface ClassDef {
  name: string;
  face: Face;
  hair: string;
  style: 'short' | 'long' | 'braid' | 'none' | 'bald';
  cloth: string;
  arm: string;
  pants: string;
  boots: string;
  accent: string;
  weapon: 'sword' | 'staff' | 'axe' | 'dagger' | 'book' | null;
  shield?: boolean;
  robe?: boolean;
  hat?: 'wizard';
  hatc?: string;
  elf?: boolean;
  dwarf?: boolean;
  beard?: string;
  helm?: string;
  hood?: string;
  apron?: string;
  stache?: string;
  bandana?: string;
  brow?: string;
}

export type ClassKey = 'knight' | 'mage' | 'dwarf' | 'rogue' | 'cleric' | 'keeper' | 'post' | 'hero';

export const CLASSES: Record<ClassKey, ClassDef> = {
  knight: { name: '기사', face: { eyes: 'dot', brow: 'angry', mouth: 'flat', scar: true }, hair: '#7a4a2c', style: 'short', cloth: '#3f6fd1', arm: '#b9c3d6', pants: '#8e98ad', boots: '#6b4128', accent: '#e8b94a', weapon: 'sword', shield: true },
  mage: { name: '마법사', face: { eyes: 'calm', mouth: 'tiny', blush: false }, hair: '#dfe3f2', style: 'long', cloth: '#7b4bb8', arm: '#7b4bb8', pants: '#5a3590', boots: '#5b3a26', accent: '#f2c447', weapon: 'staff', robe: true, hat: 'wizard', hatc: '#6a3ea6', elf: true },
  dwarf: { name: '전사', face: { eyes: 'squint', brow: 'bushy', nose: 'big', mouth: 'none', brow2: 1 }, hair: '#e0702a', style: 'none', cloth: '#8a5a34', arm: '#9aa3b5', pants: '#5d4030', boots: '#4a2f20', accent: '#c9a04a', weapon: 'axe', dwarf: true, beard: '#e0702a', helm: '#a7afbf' },
  rogue: { name: '도적', face: { eyes: 'sly', mouth: 'smirk', freckle: true }, hair: '#c98a4a', style: 'short', cloth: '#7a4a2a', arm: '#e8d4b0', pants: '#3a3040', boots: '#5b3a26', accent: '#b8873e', weapon: 'dagger', hood: '#4f8a3a', elf: true },
  cleric: { name: '사제', face: { eyes: 'sparkle', mouth: 'tiny', brow: 'up' }, hair: '#f3d36b', style: 'braid', cloth: '#f4f0e6', arm: '#f4f0e6', pants: '#d8cdb4', boots: '#8a6040', accent: '#e0a93a', weapon: 'book', robe: true },
  keeper: { name: '노주인', face: { eyes: 'happy', mouth: 'none', glasses: true, nose: 'big', blush: true }, hair: '#d8d8d8', style: 'bald', cloth: '#7a4a2c', arm: '#f2ead8', pants: '#4a3a30', boots: '#3e2a1e', accent: '#efe6cf', weapon: null, apron: '#efe6cf', stache: '#f4f4f4' },
  post: { name: '우체부', face: { eyes: 'round', mouth: 'o', freckle: true }, hair: '#d9542e', style: 'short', cloth: '#3f6fd1', arm: '#3f6fd1', pants: '#2f3f6a', boots: '#5b3a26', accent: '#e8b94a', weapon: null, bandana: '#2f57b0' },
  hero: { name: '나', face: { eyes: 'dot', brow: 'angry', mouth: 'grin', scar: true }, hair: '#5a3424', style: 'short', cloth: '#8a5a34', arm: '#efe0bf', pants: '#4a3f5a', boots: '#5b3a26', accent: '#4f9a4a', weapon: null, bandana: '#4f9a4a', apron: '#e9dcc0' },
};

/** 손님으로 오는 직업 */
export const GUEST_KINDS = ['knight', 'dwarf', 'mage', 'rogue', 'cleric'] as const;
export type GuestKind = (typeof GUEST_KINDS)[number];

export const NAMES: Record<GuestKind, string[]> = {
  knight: ['로이', '한스', '베른'],
  mage: ['실바나', '엘린', '미르'],
  dwarf: ['브롬', '두린', '토르'],
  rogue: ['피핀', '릭', '네모'],
  cleric: ['세레나', '마리엘', '루나'],
};

/** 케미 짝: [A, B, A의 대사, B의 대답] */
export const CHEM: [GuestKind, GuestKind, string, string][] = [
  ['dwarf', 'rogue', '또 너야?', '술 한잔 어때?'],
  ['knight', 'cleric', '오늘도 무사히.', '제가 지켜드릴게요!'],
  ['mage', 'rogue', '내 지팡이 어디 갔지?', '…몰라요?'],
  ['dwarf', 'knight', '방패 좀 빌려줘', '갑옷이 더 단단해!'],
  ['cleric', 'mage', '차 한잔 해요', '좋지요~'],
];

/** 대화창 이름표 */
export function speakerName(who: string, innName: string): string {
  if (who === 'hero') return innName ? innName + ' 주인' : '나';
  if (who === 'keeper') return '노주인 버나드';
  if (who === 'post') return '우체부 모모';
  return CLASSES[who as ClassKey]?.name ?? '';
}
