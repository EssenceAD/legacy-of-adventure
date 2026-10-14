// RAIDWEAPON §2 전용 무기 (플래그 exWeapons) — 19자루 이름 표 (전설 14 + 다섯 별 5)
//  id = 그 영웅 키 (전설 legendId · 다섯 별 starId) — 그 영웅만 낄 수 있다 (무기 칸)
//  name = 아이템 이름 · short = 「★ 웅스의 양손 대검이 깨어났습니다!」에 쓰는 짧은 이름 (「·」 뒤 · 없으면 name)
//  아이콘: public/assets/weapons/ex_<id>.png (16×16 또는 32×32 · 투명 PNG) 를 넣으면 저절로 바뀐다 — 없으면 직업 무기 아이콘 + 금빛 테두리
//  숫자는 CONFIG.raidWeapon.ex · 규칙은 world/exWeapons.ts
export type ExOwner = 'legend' | 'star';
export interface ExWeaponDef {
  id: string;
  owner: ExOwner;
  name: string;
}

export const EX_WEAPONS: ExWeaponDef[] = [
  // 전설 14 (도감 순서)
  { id: 'elysia', owner: 'legend', name: '은빛 서약의 검' },
  { id: 'ceres', owner: 'legend', name: '왕실 맹세의 방패검' },
  { id: 'vael', owner: 'legend', name: '심연 가르개' },
  { id: 'scarlet', owner: 'legend', name: '홍염의 지팡이' },
  { id: 'luna', owner: 'legend', name: '은늑대 송곳니' },
  { id: 'grom', owner: 'legend', name: '대전사의 도끼' },
  { id: 'aria', owner: 'legend', name: '새벽 화관 지팡이' },
  { id: 'nyx', owner: 'legend', name: '그림자 바늘' },
  { id: 'leon', owner: 'legend', name: '사자왕의 대검' },
  { id: 'sylas', owner: 'legend', name: '바람결 장궁' },
  { id: 'ryuka', owner: 'legend', name: '용비늘 창' },
  { id: 'momo2', owner: 'legend', name: '별사탕 완드' },
  { id: 'vivian', owner: 'legend', name: '유령선 커틀러스' },
  { id: 'jin', owner: 'legend', name: '달그림자 도' },
  // 다섯 별 5 (장부 순서)
  { id: 'woongs', owner: 'star', name: '첫 번째 칼날 · 양손 대검' },
  { id: 'gonu', owner: 'star', name: '그림자 붓 · 쌍단검' },
  { id: 'ikamolly', owner: 'star', name: '첫 바람 · 바람개비 지팡이' },
  { id: 'walwal', owner: 'star', name: '밤길 · 발자국 성표' },
  { id: 'warmnight', owner: 'star', name: '지도 끝의 등불 · 장궁' },
];

export const exDef = (id: string | undefined | null): ExWeaponDef | undefined => (id ? EX_WEAPONS.find((d) => d.id === id) : undefined);
/** 알림용 짧은 이름 (「첫 번째 칼날 · 양손 대검」 → 「양손 대검」) */
export const exShort = (d: ExWeaponDef): string => d.name.split(' · ').pop()!;
/** 아이콘 파일 (public 아래 · BASE_URL 뒤에 붙인다) */
export const exIconPath = (id: string): string => `assets/weapons/ex_${id}.png`;
