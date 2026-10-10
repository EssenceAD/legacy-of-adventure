// 전투 2차: 몬스터·정예·보스 표 — 그림은 Ninja Adventure (CC0, pixel-boy) · 1배 크기 그대로 (키우지 않는다)
import type { RegionId } from '../data/items';

export interface MonDef {
  id: string;
  name: string;
  region: RegionId | 'any';
  /** 체력 배율 · 공격 배율 · 빠르기(타일/초 기준) · 몸 반지름 */
  hp: number;
  atk: number;
  speed: number;
  r: number;
  /** 통통 튀며 다가온다 (슬라임류) · 날아다닌다 (그림자를 작게) */
  hop?: boolean;
  fly?: boolean;
  /** 공격 사거리 · 예고 원 반지름 */
  reach: number;
  hitR: number;
}

const m = (id: string, name: string, region: RegionId | 'any', hp: number, atk: number, speed: number, o: Partial<MonDef> = {}): MonDef => ({
  id, name, region, hp, atk, speed, r: 0.3, reach: 1.15, hitR: 0.66, ...o,
});

/** 지역마다 나오는 순서 (앞쪽부터 열리고, 스테이지가 오르면 섞인다) */
export const MONS: MonDef[] = [
  m('na_slime_green', '초록 슬라임', 'forest', 0.85, 0.9, 1.0, { hop: true, reach: 1.25, hitR: 0.62 }),
  m('na_racoon', '너구리', 'forest', 1.0, 1.0, 1.7),
  m('na_bamboo', '대나무 도깨비', 'forest', 1.25, 1.1, 1.2, { hitR: 0.72 }),
  m('na_spideryellow', '노랑 거미', 'forest', 0.8, 1.15, 2.2),
  m('na_mushroom', '버섯', 'swamp', 0.9, 0.9, 1.2),
  m('na_axolot', '늪 우파루파', 'swamp', 0.85, 1.0, 1.0, { hop: true, reach: 1.25 }),
  m('na_snake', '늪뱀', 'swamp', 0.8, 1.2, 2.2),
  m('na_mushroom2', '독버섯', 'swamp', 1.1, 1.15, 1.2, { hitR: 0.76 }),
  m('na_larva', '애벌레', 'swamp', 1.45, 1.0, 0.8),
  m('na_mole', '두더지', 'mine', 1.0, 1.0, 1.6),
  m('na_bluebat', '파랑 박쥐', 'mine', 0.75, 1.0, 2.4, { fly: true }),
  m('na_skull', '해골', 'mine', 1.1, 1.15, 1.4),
  m('na_cyclope', '외눈이', 'mine', 1.5, 1.25, 1.0, { hitR: 0.78 }),
  m('na_slime', '얼음 슬라임', 'ice', 0.9, 0.95, 1.0, { hop: true, reach: 1.25 }),
  m('na_owl2', '눈 부엉이', 'ice', 0.8, 1.05, 2.2, { fly: true }),
  m('na_spirit', '눈 정령', 'ice', 1.0, 1.15, 1.5, { fly: true }),
  m('na_eye2', '얼음 눈알', 'ice', 1.3, 1.2, 1.1),
  m('na_eye', '심연 눈알', 'abyss', 1.0, 1.1, 1.3),
  m('na_flam', '불꽃 도깨비', 'abyss', 0.85, 1.25, 2.0, { fly: true }),
  m('na_skullblue', '푸른 해골', 'abyss', 1.15, 1.2, 1.5),
  m('na_octopus2', '심연 문어', 'abyss', 1.35, 1.15, 1.1, { hitR: 0.8 }),
  m('na_spirit2', '그림자 정령', 'abyss', 1.0, 1.3, 1.9, { fly: true }),
  // 1차 코드 그림 (예비)
  m('slime', '슬라임', 'any', 0.9, 0.9, 0.95, { hop: true, reach: 1.25, hitR: 0.62 }),
  m('goblin', '고블린', 'any', 1.15, 1.1, 1.9, { r: 0.32, hitR: 0.72 }),
];
export const monDef = (id: string) => MONS.find((x) => x.id === id) ?? MONS[MONS.length - 2];
export const regionMons = (r: string) => MONS.filter((x) => x.region === r);

/** 스테이지마다 나오는 종류: 1~2 → 2종 · 3~5 → 3종 · 6~ → 전부 */
export function stageMons(r: string, s: number): MonDef[] {
  const all = regionMons(r);
  const n = s <= 2 ? 2 : s <= 5 ? 3 : all.length;
  return all.slice(0, Math.max(1, Math.min(all.length, n)));
}

// ───────── 보스 (그림이 1.5~3배로 크다 · 1배 그대로) ─────────

export interface BossLook {
  id: string;
  name: string;
  /** 패턴 이름: [직선 돌진, 원형 내려찍기, 부하 소환] */
  pats: [string, string, string];
  r: number;
  /** 부하로 부르는 몬스터 */
  minion: string;
}
/** 지역 보스 (사냥 x-10) */
export const REGION_BOSS: Record<RegionId, BossLook> = {
  forest: { id: 'nb_bamboo', name: '대나무 거인', pats: ['죽순 돌진', '대지 찍기', '숲의 부름'], r: 0.7, minion: 'na_slime_green' },
  swamp: { id: 'nb_frog', name: '늪 두꺼비 왕', pats: ['혀 돌진', '배치기', '올챙이 부르기'], r: 0.6, minion: 'na_axolot' },
  mine: { id: 'nb_cyclop', name: '외눈 마귀', pats: ['돌진', '주먹 찍기', '박쥐 부르기'], r: 0.65, minion: 'na_bluebat' },
  ice: { id: 'nb_spirit', name: '얼음 정령왕', pats: ['눈보라 돌진', '얼음 폭발', '정령 부르기'], r: 0.65, minion: 'na_spirit' },
  abyss: { id: 'nb_squid', name: '심연 오징어', pats: ['먹물 돌진', '촉수 내려치기', '문어 부르기'], r: 0.8, minion: 'na_octopus2' },
};
/** 토벌 주간 보스 그림 (주마다 돌아가며) */
export const RAID_LOOKS: BossLook[] = [
  { id: 'nb_samurai', name: '붉은 무사', pats: ['베어 들기', '칼날 회오리', '졸개 부르기'], r: 0.8, minion: 'na_skull' },
  { id: 'nb_tengu', name: '붉은 텐구', pats: ['급강하', '깃털 폭풍', '까마귀 부르기'], r: 0.75, minion: 'na_owl2' },
  { id: 'nb_racoon', name: '거대 너구리', pats: ['몸통 박치기', '배 찍기', '너구리 부르기'], r: 0.7, minion: 'na_racoon' },
  { id: 'nb_slime', name: '거대 슬라임', pats: ['굴러오기', '내려 앉기', '분열'], r: 0.75, minion: 'na_slime_green' },
];
