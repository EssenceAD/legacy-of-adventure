// 직업(색·얼굴·무기) — reference/core.js의 CLASSES 이식. 이름 목록과 케미 짝도 여기.
import type { StatKey, WeaponKind } from './items';
import { HUNTER_CHEM, HUNTER_LINES, HUNTER_NAMES } from './story/hunter';

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
  /** EASTER §5: 볼에 물감 한 점 */
  paint?: string;
}

export interface ClassDef {
  name: string;
  face: Face;
  hair: string;
  style: 'short' | 'long' | 'braid' | 'twin' | 'none' | 'bald';
  cloth: string;
  arm: string;
  pants: string;
  boots: string;
  accent: string;
  weapon: 'sword' | 'staff' | 'axe' | 'dagger' | 'book' | 'bow' | 'holy' | 'lantern' | 'pinwheel' | 'brush' | 'greatsword' | null;
  /** 리마스터: 등 뒤 망토 · 화살통 · 쌍단검 */
  cape?: string;
  quiver?: boolean;
  dual?: boolean;
  shield?: boolean;
  robe?: boolean;
  hat?: 'wizard' | 'feather' | 'beret';
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
  /** 끼운 무기 등급 색 (날·머리 부분) */
  weaponColor?: string;
  /** EASTER §5: 피부색 · 어깨 수건 · 안경 테 색 */
  skin?: string;
  towel?: string;
  glassesColor?: string;
  /** HERODOT 새 도트 모양 (heroDotV2 켜졌을 때만 · 1단계 기사·사제·도적) */
  dot2?: 'knight' | 'cleric' | 'rogue' | 'mage' | 'dwarf' | 'hunter' | 'keeper' | 'post' | 'hero';
  /** HERODOT 새 도트 앞치마 색 (나: 기준 그림의 초록 앞치마 · 있으면 셔츠는 arm 색) */
  apron2?: string;
  /** FIVESTARS ④ R21: 머리 크기 +px (고느끼 1) · 로브 아랫단 양쪽 −px (왈왈콩선생 1) */
  headPlus?: number;
  robeTrim?: number;
  /** R21 v3: 안경 윗변 가운데(코받침) 1px 빛 색 (이카몰리 금 #e8c070) */
  glassesGlint?: string;
  /** HERODOT 3: 전설(legendId)·이름 있는 영웅(heroId) 고정 겉모습 열쇠 · 신화 (heroDotV2 켰을 때 appearance()가 넣는다) */
  named?: string;
  mythic?: boolean;
  /** LUXE §1-3: 입은 의상 id (appearance()가 넣는다 · outfits 켰을 때만) · dress = 이름 있는 겉모습 위에 덮는 옷 색 (engine/outfitPaint.ts만 넣는다) */
  outfit?: string;
  dress?: Partial<ClassDef>;
}

export type ClassKey = 'knight' | 'mage' | 'dwarf' | 'rogue' | 'cleric' | 'hunter' | 'keeper' | 'post' | 'hero';

export const CLASSES: Record<ClassKey, ClassDef> = {
  knight: { name: '기사', face: { eyes: 'dot', brow: 'angry', mouth: 'flat', scar: true }, hair: '#7a4a2c', style: 'short', cloth: '#3f6fd1', arm: '#b9c3d6', pants: '#8e98ad', boots: '#6b4128', accent: '#e8b94a', weapon: 'sword', shield: true, dot2: 'knight' },
  mage: { name: '마법사', face: { eyes: 'calm', mouth: 'tiny', blush: false }, hair: '#dfe3f2', style: 'long', cloth: '#7b4bb8', arm: '#7b4bb8', pants: '#5a3590', boots: '#5b3a26', accent: '#f2c447', weapon: 'staff', robe: true, hat: 'wizard', hatc: '#6a3ea6', elf: true, dot2: 'mage' },
  dwarf: { name: '전사', face: { eyes: 'squint', brow: 'bushy', nose: 'big', mouth: 'none', brow2: 1 }, hair: '#e0702a', style: 'none', cloth: '#8a5a34', arm: '#9aa3b5', pants: '#5d4030', boots: '#4a2f20', accent: '#c9a04a', weapon: 'axe', dwarf: true, beard: '#e0702a', helm: '#a7afbf', dot2: 'dwarf' },
  rogue: { name: '도적', face: { eyes: 'sly', mouth: 'smirk', freckle: true }, hair: '#c98a4a', style: 'short', cloth: '#7a4a2a', arm: '#e8d4b0', pants: '#3a3040', boots: '#5b3a26', accent: '#b8873e', weapon: 'dagger', hood: '#4f8a3a', elf: true, dual: true, dot2: 'rogue' },
  cleric: { name: '사제', face: { eyes: 'sparkle', mouth: 'tiny', brow: 'up' }, hair: '#f3d36b', style: 'braid', cloth: '#f4f0e6', arm: '#f4f0e6', pants: '#d8cdb4', boots: '#8a6040', accent: '#e0a93a', weapon: 'holy', robe: true, cape: '#f8f4ec', dot2: 'cleric' },
  /** PARTY §1: 아래 HUNTER_DEF로 채운다 (같은 겉모습) */
  hunter: undefined as unknown as ClassDef,
  keeper: { name: '노주인', face: { eyes: 'happy', mouth: 'none', glasses: true, nose: 'big', blush: true }, hair: '#d8d8d8', style: 'bald', cloth: '#7a4a2c', arm: '#f2ead8', pants: '#4a3a30', boots: '#3e2a1e', accent: '#efe6cf', weapon: null, apron: '#efe6cf', stache: '#f4f4f4', dot2: 'keeper' },
  post: { name: '우체부', face: { eyes: 'round', mouth: 'o', freckle: true }, hair: '#d9542e', style: 'short', cloth: '#3f6fd1', arm: '#3f6fd1', pants: '#2f3f6a', boots: '#5b3a26', accent: '#e8b94a', weapon: null, bandana: '#2f57b0', dot2: 'post' },
  hero: { name: '나', face: { eyes: 'dot', brow: 'angry', mouth: 'grin', scar: true }, hair: '#5a3424', style: 'short', cloth: '#8a5a34', arm: '#efe0bf', pants: '#4a3f5a', boots: '#5b3a26', accent: '#4f9a4a', weapon: null, bandana: '#4f9a4a', apron: '#e9dcc0', dot2: 'hero', apron2: '#4f9a4a' },
};

/** 리마스터: 사냥꾼 겉모습 (활 + 화살통) — PARTY §1: 여섯 번째 손님 직업 「사냥꾼」도 이 겉모습 */
export const HUNTER_DEF: ClassDef = { name: '사냥꾼', face: { eyes: 'dot', mouth: 'grin', freckle: true }, hair: '#7a4a2a', style: 'short', cloth: '#4f6a3a', arm: '#e8d4b0', pants: '#5d4030', boots: '#5b3a26', accent: '#8a6040', weapon: 'bow', quiver: true, bandana: '#4f8a3a', dot2: 'hunter' };
CLASSES.hunter = HUNTER_DEF;

/** 손님으로 오는 직업 — PARTY §1: 사냥꾼까지 6개 (주인 출신과 같은 6개에서 닫는다) */
export const GUEST_KINDS = ['knight', 'dwarf', 'mage', 'rogue', 'cleric', 'hunter'] as const;
/** 처음 다섯 직업 (도감 비율·보상은 이 칸으로 — 새 직업 칸은 전투력 보너스만 더한다) */
export const BASE_GUEST_KINDS: readonly GuestKind[] = ['knight', 'dwarf', 'mage', 'rogue', 'cleric'];
export type GuestKind = (typeof GUEST_KINDS)[number];

export const NAMES: Record<GuestKind, string[]> = {
  knight: ['로이', '한스', '베른'],
  mage: ['실바나', '엘린', '미르'],
  dwarf: ['브롬', '두린', '토르'],
  rogue: ['피핀', '릭', '네모'],
  cleric: ['세레나', '마리엘', '루나'],
  hunter: HUNTER_NAMES.slice(0, 3),
};

/** 케미 짝: [A, B, A의 대사, B의 대답] */
export const CHEM: [GuestKind, GuestKind, string, string][] = [
  ['dwarf', 'rogue', '또 너야?', '술 한잔 어때?'],
  ['knight', 'cleric', '오늘도 무사히.', '제가 지켜드릴게요!'],
  ['mage', 'rogue', '내 지팡이 어디 갔지?', '…몰라요?'],
  ['dwarf', 'knight', '방패 좀 빌려줘', '갑옷이 더 단단해!'],
  ['cleric', 'mage', '차 한잔 해요', '좋지요~'],
  ...(HUNTER_CHEM as [GuestKind, GuestKind, string, string][]),
];

/** 대화창 이름표 */
export function speakerName(who: string, innName: string): string {
  if (who === 'hero') return innName ? innName + ' 주인' : '나';
  if (who === 'keeper') return '노주인 버나드';
  if (who === 'post') return '우체부 모모';
  return CLASSES[who as ClassKey]?.name ?? '';
}

// ═════════════ 2단계: 종족 · 희귀도 · 능력치 · 얼굴 ═════════════
export type Race = 'human' | 'elf' | 'dwarf' | 'halfling';
export const RACES: Race[] = ['human', 'elf', 'dwarf', 'halfling'];
export const RACE_NAME: Record<Race, string> = { human: '인간', elf: '엘프', dwarf: '드워프', halfling: '하플링' };

export type Rarity = 'common' | 'special' | 'legend';
export const RARITIES: Rarity[] = ['common', 'special', 'legend'];
export const RARITY_INFO: Record<Rarity, { name: string; color: string; mult: number }> = {
  common: { name: '평범', color: '#cfd8ff', mult: 1 },
  special: { name: '특별', color: '#6fb0ff', mult: 1.3 },
  legend: { name: '전설', color: '#ffb04a', mult: 1.7 },
};

/** 직업별 1레벨 기본 능력치 (평범 기준) */
export const CLASS_STATS: Record<GuestKind, Record<StatKey, number>> = {
  knight: { atk: 8, def: 12, mag: 2, agi: 5, luk: 3 },
  mage: { atk: 3, def: 4, mag: 13, agi: 5, luk: 5 },
  dwarf: { atk: 12, def: 8, mag: 1, agi: 5, luk: 4 },
  rogue: { atk: 7, def: 4, mag: 3, agi: 12, luk: 8 },
  cleric: { atk: 3, def: 7, mag: 10, agi: 4, luk: 6 },
  hunter: { atk: 10, def: 4, mag: 2, agi: 10, luk: 7 },
};
/** 직업별 기본 무기 (장비가 없을 때 그림) */
export const CLASS_WEAPON: Record<GuestKind, WeaponKind> = { knight: 'sword', mage: 'staff', dwarf: 'axe', rogue: 'dagger', cleric: 'book', hunter: 'bow' };

/** 직업마다 어울리는 종족 (방문 손님 뽑을 때 가중치) */
export const CLASS_RACES: Record<GuestKind, Race[]> = {
  knight: ['human', 'human', 'dwarf', 'halfling'],
  mage: ['elf', 'elf', 'human', 'halfling'],
  dwarf: ['dwarf', 'dwarf', 'human'],
  rogue: ['elf', 'halfling', 'human', 'halfling'],
  cleric: ['human', 'halfling', 'elf'],
  hunter: ['human', 'elf', 'elf', 'halfling'],
};

export const RACE_NAMES: Record<Race, string[]> = {
  human: ['로이', '한스', '베른', '세레나', '마리엘', '루카', '에단', '클라라', '토비', '아델'],
  elf: ['실바나', '엘린', '미르', '릭', '피핀', '아리엘', '탈리온', '세이라', '루엔', '피오라'],
  dwarf: ['브롬', '두린', '토르', '감리', '보르', '힐다', '그림', '브루나', '오린', '팔린'],
  halfling: ['네모', '루나', '포피', '빌보', '메리', '티미', '로지', '퍼디', '밀로', '체리'],
};

/** 얼굴 조합 (특별·전설은 무작위로 섞는다) */
export const FACE_POOL = {
  eyes: ['dot', 'calm', 'squint', 'sly', 'happy', 'round', 'sparkle'] as const,
  mouth: ['flat', 'tiny', 'none', 'smirk', 'o', 'grin'] as const,
  brow: [undefined, 'angry', 'bushy', 'up'] as const,
};
export const HAIR_COLORS = ['#7a4a2c', '#dfe3f2', '#e0702a', '#c98a4a', '#f3d36b', '#3a2a3a', '#b03a2a', '#5a7ac8', '#2f2a26', '#e8a0c8'];

/** PARTY §1: 직업별 말풍선 (손님 idle 대사에 섞는다 · 지금은 사냥꾼만) */
export const KIND_LINES: Partial<Record<string, string[]>> = { hunter: HUNTER_LINES };

/** 희귀 손님 고유 대사 */
export const RARE_LINES: Record<Rarity, string[]> = {
  common: [],
  special: ['이 여관, 소문대로네요', '오늘은 운이 좋은 날 같아', '내 검이 뭔가 느끼고 있어'],
  legend: ['…전설은 조용히 쉬는 법이지', '이 마을에서 오래된 기운이 느껴져', '내 이름을 들어 봤나?'],
};
