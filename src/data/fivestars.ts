// FIVESTARS §3 신화 영웅 데이터 — 「다섯 별의 원정대」 (대사는 data/story/fivestars.ts · 규칙은 world/fivestars.ts)
//  등급 신화(legendFrame 신화 규칙 그대로) · 능력치 = 전설 × CONFIG.fiveStars.statMult · heroId/legendId 와 겹치지 않는 새 키 starId
//  스킬은 전설과 같은 { name, k, v } (optSum이 그 사람에게 더한다) + 덧효과(also · 코드가 따로: 파티 배율 등)
import type { Face, GuestKind, Race } from './classes';
import type { OptKey } from './items';
import type { StarId } from './story/fivestars';

export type { StarId };
/** 장부 칸 순서 (§2 표) */
export const STAR_IDS: StarId[] = ['woongs', 'gonu', 'ikamolly', 'walwal', 'warmnight'];

export interface StarDef {
  id: StarId;
  name: string;
  /** 신화 직업 (능력치 = 이 클래스) */
  kind: GuestKind;
  race: Race;
  hair: string;
  face: Face;
  /** 무기 모양 키 — 웅스 'greatsword'는 아직 데이터만 (도트는 HERODOT 신화 단계에서 · 지금은 클래스 기본 무기로 그림) */
  weapon: string;
  /** 공격 궤적 색 (§4 · 도트 단계에서 씀) */
  trail: string;
  skill: { name: string; k: OptKey; v: number; desc: string };
}

export const STARS: Record<StarId, StarDef> = {
  // 웅스: dwarf 클래스 능력치 · 외형만 인간 (대검 전사)
  woongs: { id: 'woongs', name: '웅스', kind: 'dwarf', race: 'human', hair: '#1e1a1a', face: { eyes: 'dot', mouth: 'grin', brow: 'up' }, weapon: 'greatsword', trail: '#ffd36b', skill: { name: '딸깍 일격', k: 'atkPct', v: 15, desc: '공격 +15% · 무기 강화 단계 × 1% 추가 (최대 +20%)' } },
  gonu: { id: 'gonu', name: '고느끼', kind: 'rogue', race: 'halfling', hair: '#ef6f9a', face: { eyes: 'sparkle', mouth: 'o', blush: true }, weapon: 'dagger', trail: '#f4a3be', skill: { name: '그림자 붓질', k: 'critPct', v: 12, desc: '치명 +12% · 은밀 사건 확률 +20% (닉스와 같이 쌓임 · 최대 80%)' } },
  ikamolly: { id: 'ikamolly', name: '이카몰리', kind: 'mage', race: 'human', hair: '#8a4a2e', face: { eyes: 'calm', mouth: 'tiny', glasses: true }, weapon: 'staff', trail: '#8fc6e0', skill: { name: '첫 바람의 주문', k: 'atkPct', v: 12, desc: '공격 +12% · 의뢰 시간 −10%' } },
  walwal: { id: 'walwal', name: '왈왈콩선생', kind: 'cleric', race: 'human', hair: '#6b4a2e', face: { eyes: 'happy', mouth: 'grin', blush: true }, weapon: 'holy', trail: '#ffffff', skill: { name: '왈왈 응원', k: 'hpSave', v: 30, desc: '체력 소모 −30% · 밤 출발 원정 성공률 +10%' } },
  warmnight: { id: 'warmnight', name: '따뜻한밤', kind: 'hunter', race: 'human', hair: '#7a3f24', face: { eyes: 'happy', blush: true }, weapon: 'bow', trail: '#ffa040', skill: { name: '등불 화살', k: 'anyDmg', v: 10, desc: '공격 +10% · 모든 지역 피해 +10% · 떠돌이 보스 만날 확률 ×1.5' } },
};
export const isStarId = (v: unknown): v is StarId => typeof v === 'string' && (STAR_IDS as string[]).includes(v);
/** 초상화 키: 신화 모습 star_<id> (형철 그림 asset_raw/fivestars/star_<id>.png → public/portraits/) · 카메오 p_<id> */
export const starPortraitKey = (id: StarId) => 'star_' + id;
