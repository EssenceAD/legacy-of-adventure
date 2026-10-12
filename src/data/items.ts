// 아이템·옵션·세트·지역·재료 표. 숫자 배율은 config.ts (items/expedition), 여기엔 "무엇이 있는지"만.

export type Grade = 'n' | 'r' | 'e' | 'l' | 'a';
export type Slot = 'weapon' | 'armor' | 'acc';
export type StatKey = 'atk' | 'def' | 'mag' | 'agi' | 'luk';
export type RegionId = 'forest' | 'swamp' | 'mine' | 'ice' | 'abyss' | 'coast' | 'dune' | 'ember' | 'sky' | 'deep';
/** REGIONS2: 처음 다섯 지역 (그 뒤 6~10은 별의 심연 x-10 뒤에 하나씩 열린다 · 10곳에서 끝) */
export const BASE_REGIONS = 5;
export type WeaponKind = 'sword' | 'axe' | 'staff' | 'dagger' | 'book';

export const GRADES: Grade[] = ['n', 'r', 'e', 'l', 'a'];
export const GRADE_INFO: Record<Grade, { name: string; color: string; dark: string }> = {
  n: { name: '일반', color: '#9a9aa6', dark: '#4a4a56' },
  r: { name: '희귀', color: '#4f8fe0', dark: '#1f3f78' },
  e: { name: '영웅', color: '#a35bd6', dark: '#4a2470' },
  l: { name: '전설', color: '#f2a13a', dark: '#7a4210' },
  a: { name: '유물', color: '#bfe6ff', dark: '#3a4a8a' },
};

export const SLOTS: Slot[] = ['weapon', 'armor', 'acc'];
export const SLOT_NAME: Record<Slot, string> = { weapon: '무기', armor: '방어구', acc: '장신구' };

export const STATS: StatKey[] = ['atk', 'def', 'mag', 'agi', 'luk'];
export const STAT_NAME: Record<StatKey, string> = { atk: '공격', def: '방어', mag: '마력', agi: '민첩', luk: '행운' };

/** 부위별로 주로 붙는 능력치 (기본 능력치 2개) */
export const SLOT_STATS: Record<Slot, StatKey[]> = {
  weapon: ['atk', 'mag'],
  armor: ['def', 'agi'],
  acc: ['luk', 'mag'],
};

export interface Region {
  id: RegionId;
  name: string;
  /** 재료 이름 */
  mat: string;
  /** 소재 색 (아이콘) */
  color: string;
  /** 세트: 이름, 2세트·3세트 효과 */
  set: { name: string; two: OptRoll; three: OptRoll };
  /** 지역 전용 고유 효과 이름 (유물) */
  relic?: string;
}

export interface OptRoll {
  k: OptKey;
  v: number;
}

export type OptKey = 'atkPct' | 'timeCut' | 'goldPct' | 'hpSave' | 'regionDmg' | 'chemPct' | 'xpPct' | 'dmgCut' | 'enhPct' | 'critPct' | 'anyDmg';

export const OPT_INFO: Record<OptKey, { label: (v: number, r?: string) => string; min: number; max: number }> = {
  atkPct: { label: (v) => `전투력 +${v}%`, min: 2, max: 8 },
  timeCut: { label: (v) => `원정 시간 −${v}%`, min: 3, max: 10 },
  goldPct: { label: (v) => `금화 획득 +${v}%`, min: 4, max: 15 },
  hpSave: { label: (v) => `체력 소모 −${v}%`, min: 5, max: 20 },
  regionDmg: { label: (v, r) => `${r ?? '지역'} 피해 +${v}%`, min: 6, max: 18 },
  chemPct: { label: (v) => `케미 짝과 같이 가면 +${v}%`, min: 4, max: 12 },
  xpPct: { label: (v) => `경험치 +${v}%`, min: 5, max: 15 },
  // REGIONS2: 새 지역 세트에만 붙는 효과 (랜덤 옵션으로는 안 나온다 — ROLL_KEYS)
  dmgCut: { label: (v) => `받는 피해 −${v}%`, min: 0, max: 0 },
  enhPct: { label: (v) => `강화 성공 +${v}%`, min: 0, max: 0 },
  critPct: { label: (v) => `치명타 +${v}%`, min: 0, max: 0 },
  anyDmg: { label: (v) => `모든 지역 피해 +${v}%`, min: 0, max: 0 },
};
/** 장비 랜덤 옵션으로 굴리는 효과 (옛 7종 그대로) */
export const ROLL_KEYS: OptKey[] = ['atkPct', 'timeCut', 'goldPct', 'hpSave', 'regionDmg', 'chemPct', 'xpPct'];

export const REGIONS: Region[] = [
  { id: 'forest', name: '숲 동굴', mat: '이끼 덩굴', color: '#6fae45', set: { name: '이끼 순찰대', two: { k: 'timeCut', v: 5 }, three: { k: 'regionDmg', v: 15 } } },
  { id: 'swamp', name: '버섯 늪', mat: '빛버섯 포자', color: '#b06ad0', set: { name: '늪지 방랑자', two: { k: 'hpSave', v: 10 }, three: { k: 'goldPct', v: 15 } } },
  { id: 'mine', name: '폐광', mat: '녹슨 광석', color: '#c08a5a', set: { name: '광부의 맹세', two: { k: 'atkPct', v: 5 }, three: { k: 'regionDmg', v: 20 } } },
  { id: 'ice', name: '얼음 협곡', mat: '서리 결정', color: '#8fd0ff', set: { name: '설원 수호자', two: { k: 'hpSave', v: 15 }, three: { k: 'atkPct', v: 10 } } },
  { id: 'abyss', name: '별의 심연', mat: '별조각', color: '#f2e27a', set: { name: '심연을 본 자', two: { k: 'xpPct', v: 15 }, three: { k: 'atkPct', v: 15 } }, relic: '별빛의 가호' },
  // REGIONS2 §1: 6~10번 지역 (여기서 끝)
  { id: 'coast', name: '가라앉은 등대 해안', mat: '소금 진주', color: '#4fb3c8', set: { name: '등대지기의 약속', two: { k: 'dmgCut', v: 15 }, three: { k: 'goldPct', v: 20 } } },
  { id: 'dune', name: '모래시계 유적', mat: '금빛 모래', color: '#e0b45a', set: { name: '시간을 거스른 자', two: { k: 'timeCut', v: 10 }, three: { k: 'atkPct', v: 12 } } },
  { id: 'ember', name: '잿불 화산', mat: '식지 않는 잿불', color: '#e0603a', set: { name: '불꽃 대장장이', two: { k: 'enhPct', v: 3 }, three: { k: 'regionDmg', v: 25 } } },
  { id: 'sky', name: '구름 정원', mat: '바람 깃털', color: '#bfe3ff', set: { name: '하늘 순례자', two: { k: 'xpPct', v: 15 }, three: { k: 'critPct', v: 8 } } },
  { id: 'deep', name: '심연의 바닥', mat: '삼켜진 별빛', color: '#6a4fd0', set: { name: '별을 되찾은 자', two: { k: 'atkPct', v: 15 }, three: { k: 'anyDmg', v: 10 } }, relic: '별지기의 잔광' },
];
export const regionById = (id: RegionId) => REGIONS.find((r) => r.id === id)!;

/** 아이템 이름: 지역 × 부위 × (무기 종류) */
const WEAPON_NAMES: Record<WeaponKind, string> = { sword: '검', axe: '도끼', staff: '지팡이', dagger: '단검', book: '마도서' };
const ARMOR_NAMES = ['흉갑', '로브', '가죽옷', '갑옷'];
const ACC_NAMES = ['반지', '목걸이', '부적', '귀걸이'];
const REGION_ADJ: Record<RegionId, string[]> = {
  forest: ['이끼 낀', '덩굴', '숲지기의'],
  swamp: ['포자 묻은', '늪지기의', '버섯'],
  mine: ['녹슨', '광부의', '강철'],
  ice: ['서리', '빙결', '설원의'],
  abyss: ['별빛', '심연의', '별조각'],
  coast: ['소금기 밴', '등대의', '진주'],
  dune: ['모래시계', '유적의', '황금 모래'],
  ember: ['잿불', '화산의', '용암 식힌'],
  sky: ['구름', '바람결', '하늘 정원의'],
  deep: ['별을 삼킨', '심연 바닥의', '되찾은 별빛'],
};
export const WEAPON_KINDS: WeaponKind[] = ['sword', 'axe', 'staff', 'dagger', 'book'];

export function itemName(region: RegionId, slot: Slot, wkind: WeaponKind | undefined, seed: number): string {
  const adj = REGION_ADJ[region][seed % REGION_ADJ[region].length];
  if (slot === 'weapon') return `${adj} ${WEAPON_NAMES[wkind ?? 'sword']}`;
  const list = slot === 'armor' ? ARMOR_NAMES : ACC_NAMES;
  return `${adj} ${list[(seed >> 3) % list.length]}`;
}

/** 재료: 등급별 가루 + 지역 재료 */
export const DUST_NAME: Record<Grade, string> = { n: '잿빛 가루', r: '푸른 가루', e: '보랏빛 가루', l: '황금 가루', a: '별빛 가루' };
