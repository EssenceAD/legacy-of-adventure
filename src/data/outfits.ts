// LUXE §1-3 영웅 의상실 — 색 바꾸기 의상 표 v1 (asset_raw/luxe/outfits.md 그대로 · 이름·색은 형철 것 — 바꾸지 않는다)
//  의상 하나 = { cloth 윗옷 · pants 아래 · accent 장식·테두리 · extra 그 직업의 망토/두건/모자(cape·hood·hatc 중 있는 것 · '—'면 없음) }
//  ① = 인연 「친구」 단계 보상(무료) · ② = 명품관(값은 data/luxe_cfg.ts LUXE_OUTFITS)
//  적용(한 함수)은 engine/outfitPaint.ts · 저장·얻기·입기는 world/outfits.ts

export type OutfitTier = 'hero' | 'legend' | 'star';
export interface OutfitDef {
  /** `${char}_${n}` */
  id: string;
  /** 캐릭터 키: 영웅 heroId · 전설 legendId · 다섯 별 starId */
  char: string;
  n: 1 | 2;
  name: string;
  cloth: string;
  pants: string;
  accent: string;
  extra?: string;
}
export interface OutfitChar {
  char: string;
  name: string;
  tier: OutfitTier;
}

type Row = [char: string, name: string, o1: [string, string], o2: [string, string]];
/** 'cloth / pants / accent / extra' (extra '—' = 없음) */
const RAW: Record<OutfitTier, Row[]> = {
  hero: [
    ['kael', '카엘', ['가을 산책복', '#c8742e / #5a3a2a / #f0c860 / —'], ['눈꽃 기사복', '#e8f0f8 / #8aa0c0 / #7ab8e8 / —']],
    ['brok', '브로크', ['장인 앞치마', '#6a4a30 / #3e2e24 / #d8b070 / —'], ['축제 연미복', '#2a2a40 / #1e1e2a / #e0b040 / —']],
    ['lira', '리라', ['들꽃 드레스', '#f0b8c8 / #e898b0 / #8ad08a / #fff0f4'], ['밤하늘 무대복', '#3a2a6a / #2a1e50 / #f0d870 / #6a5ab0']],
    ['morga', '모르가', ['이끼 망토', '#5a7a4a / #3e5236 / #c8d870 / #4a6a3a'], ['호박 마녀복', '#e0782a / #3a2a3a / #8a4ab8 / #2a1e2a']],
    ['oswin', '오스윈', ['정원사 조끼', '#7a8a5a / #5a4a3a / #e8d8a0 / —'], ['황금 성기사', '#f0d070 / #c8a040 / #ffffff / —']],
    ['pip', '핍', ['줄무늬 셔츠', '#e8e0d0 / #3a4a6a / #d84a3a / #c84a3a'], ['꼬마 신사', '#2a3a5a / #2a2a3a / #e8c040 / #3a2a2a']],
    ['seril', '세릴', ['숲 산책 드레스', '#9ad0a0 / #6aa070 / #f8f0d0 / #d0f0d8'], ['달빛 무도회', '#c8d8f8 / #8aa0d8 / #f8f8ff / #e8eaff']],
    ['harald', '하랄드', ['줄무늬 잠옷', '#a8c8e8 / #6a8ab8 / #f8f8f8 / —'], ['맥주 축제', '#2a6a3a / #e8e0c8 / #e0b040 / —']],
    ['nova', '노바', ['별무늬 잠옷', '#2a3a6a / #1e2a50 / #f8e070 / #3a4a8a'], ['천문대 로브', '#e8e8f8 / #a8a8d0 / #7a5ad8 / #c8c8f0']],
    ['twins', '렌·린', ['바닷가 셔츠', '#58b8d8 / #e8d8b0 / #f8f8f8 / #3a8ab8'], ['흑백 쌍둥이', '#f8f8f8 / #1e1e24 / #d83a4a / #1e1e24']],
  ],
  legend: [
    ['elysia', '엘리시아', ['승마복', '#4a6a9a / #e8e0d0 / #e0c060 / —'], ['장미 기사', '#c83a5a / #8a2a40 / #f8d070 / —']],
    ['ceres', '세레스', ['도서관 교복', '#3a4a7a / #5a5a6a / #f0e0a0 / —'], ['봄꽃 드레스', '#f8d8e0 / #e8b0c0 / #a8d898 / —']],
    ['vael', '바엘', ['흰 셔츠 차림', '#f0f0f4 / #2a2a34 / #8a8aa8 / —'], ['진홍 흑기사', '#2a1e2a / #1a141e / #c82a3a / —']],
    ['scarlet', '스칼렛', ['카페 앞치마', '#f0e6d8 / #6a3a2a / #d8402a / #a83020'], ['은하 마녀', '#2a1e5a / #1a1440 / #f0c8f8 / #5a3ab8']],
    ['luna', '루나', ['털모자 겨울옷', '#d8e0f0 / #6a7aa0 / #e86a6a / #f8f8ff'], ['달밤 무사', '#1e2a4a / #141e36 / #e8e8f8 / #3a4a7a']],
    ['grom', '그롬', ['하와이안 셔츠', '#e86a4a / #f0e0b0 / #4ab8a0 / —'], ['검투사 왕', '#c89a40 / #6a3a2a / #f8e8b0 / —']],
    ['aria', '아리아', ['꽃집 원피스', '#f8e8c0 / #e8c8a0 / #f09ab0 / #fff8ec'], ['새벽 사제', '#f8c8a0 / #e89a7a / #ffffff / #fde8d8']],
    ['nyx', '닉스', ['고양이 후드', '#3a3a48 / #2a2a34 / #f0a8c8 / #4a4a5a'], ['달빛 무희', '#5a3a8a / #3a2a5a / #e0e0f8 / #8a6ac0']],
    ['leon', '레온', ['사냥 재킷', '#8a5a2a / #5a4030 / #e8d0a0 / —'], ['백금 사자', '#f0f0f4 / #c8c8d8 / #e0a030 / —']],
    ['sylas', '사일러스', ['가을 숲 망토', '#c87a3a / #5a4a2a / #f0d070 / #a85a2a'], ['새벽 사수', '#e8f0f8 / #8ab0d0 / #f0c8e0 / #c8e0f0']],
    ['ryuka', '류카', ['용 잠옷', '#8ad8a0 / #5ab078 / #f8f0a0 / —'], ['흑룡 공주', '#2a2a3a / #1a1a24 / #e04a4a / —']],
    ['momo2', '미미', ['우비', '#f8d84a / #e8b830 / #4a8ad8 / #f8d84a'], ['별사탕 마법사', '#f8c8e0 / #c8a8f0 / #fff4a0 / #e898c8']],
    ['vivian', '비비안', ['휴가 선장', '#f8f8f0 / #4a8ab8 / #e8483a / —'], ['유령선 선장', '#3a4a4a / #2a3434 / #8af0c8 / —']],
    ['jin', '진', ['찻집 도포', '#d8e0d0 / #8a9a8a / #6a4a3a / —'], ['벚꽃 검객', '#f8d8e0 / #4a3a4a / #e86a8a / —']],
  ],
  star: [
    ['woongs', '웅스', ['대장장이 셔츠', '#6a6a74 / #3a3a44 / #e8a040 / —'], ['별빛 양손검사', '#1e2a5a / #141e40 / #f8e070 / —']],
    ['gonu', '고느끼', ['화가 앞치마', '#e8e0d0 / #4a4a5a / #e86a8a / #4a7ab8'], ['먹빛 그림자', '#1e1e24 / #141418 / #c8c8d8 / #2a2a34']],
    ['ikamolly', '이카몰리', ['바람 산책복', '#c8e8e0 / #7ab0a8 / #f8f8f8 / #a8d8d0'], ['첫 바람 대마법사', '#3a6ad8 / #2a4aa0 / #f8f0b0 / #5a8af0']],
    ['walwal', '왈왈콩선생', ['밤산책 가디건', '#e8c8a0 / #6a5a7a / #f8e8a0 / #c8a880'], ['밤길 등불 사제', '#2a2a5a / #1e1e40 / #f8d060 / #fff4c8']],
    ['warmnight', '따뜻한밤', ['모닥불 후드', '#c85a3a / #4a3a2a / #f8c860 / #a84a30'], ['은하 사냥꾼', '#2a3a6a / #1e2a50 / #a8f0f8 / #3a5a9a']],
  ],
};

const parse = (char: string, n: 1 | 2, [name, cols]: [string, string]): OutfitDef => {
  const [cloth, pants, accent, extra] = cols.split('/').map((s) => s.trim());
  return { id: `${char}_${n}`, char, n, name, cloth, pants, accent, ...(extra && extra !== '—' ? { extra } : {}) };
};

export const OUTFIT_CHARS: OutfitChar[] = [];
export const OUTFITS: Record<string, OutfitDef> = {};
for (const tier of ['hero', 'legend', 'star'] as OutfitTier[])
  for (const [char, name, o1, o2] of RAW[tier]) {
    OUTFIT_CHARS.push({ char, name, tier });
    for (const o of [parse(char, 1, o1), parse(char, 2, o2)]) OUTFITS[o.id] = o;
  }
export const OUTFIT_IDS = Object.keys(OUTFITS);
export const charInfo = (char: string) => OUTFIT_CHARS.find((c) => c.char === char);
export const outfitsOf = (char: string): OutfitDef[] => [OUTFITS[char + '_1'], OUTFITS[char + '_2']].filter(Boolean);
export const isOutfitId = (v: unknown): v is string => typeof v === 'string' && v in OUTFITS;
