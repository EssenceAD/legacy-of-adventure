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
  /** REGIONS2: 붙어 있으면 아군 회복이 반으로 (길 잃은 마음) */
  noHeal?: boolean;
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
  // REGIONS2 §2: 지역 6~10 (Ninja Adventure 안 쓴 그림 · 체력 0.8~1.5 · 빠르기 1.0~2.4)
  m('na_fish', '등대 물고기', 'coast', 0.9, 1.0, 1.4),
  m('na_fishred', '붉은 쏨뱅이', 'coast', 0.8, 1.1, 2.3),
  m('na_kappa', '물갓파', 'coast', 1.05, 1.15, 1.5),
  m('na_mollusc', '소라게', 'coast', 1.45, 1.0, 1.0, { hitR: 0.74 }),
  m('na_octopusg', '해초 문어', 'coast', 1.2, 1.2, 1.2, { hitR: 0.78 }),
  m('na_lizard', '모래 도마뱀', 'dune', 0.95, 1.05, 1.7),
  m('na_snake3', '사막뱀', 'dune', 0.8, 1.2, 2.4),
  m('na_mouse', '유적 쥐', 'dune', 0.8, 0.95, 2.0),
  m('na_spiderred', '붉은 전갈거미', 'dune', 1.0, 1.25, 1.9),
  m('na_reptile', '돌비늘', 'dune', 1.5, 1.1, 1.0, { hitR: 0.76 }),
  m('na_flam2', '잿불 도깨비', 'ember', 0.85, 1.25, 2.1, { fly: true }),
  m('na_reptile2', '용암 비늘', 'ember', 1.15, 1.15, 1.4),
  m('na_mole2', '불두더지', 'ember', 1.0, 1.1, 1.7),
  m('na_trex', '잿불 공룡', 'ember', 1.5, 1.3, 1.0, { hitR: 0.8 }),
  m('na_slime3', '용암 슬라임', 'ember', 0.95, 1.05, 1.1, { hop: true, reach: 1.25 }),
  m('na_butterfly', '구름 나비', 'sky', 0.8, 1.0, 2.2, { fly: true }),
  m('na_butterflyb', '바람 나비', 'sky', 0.85, 1.1, 2.3, { fly: true }),
  m('na_owl', '하늘 부엉이', 'sky', 1.0, 1.15, 2.0, { fly: true }),
  m('na_lantern', '떠도는 등불', 'sky', 1.15, 1.2, 1.2, { fly: true }),
  m('na_heart', '길 잃은 마음', 'sky', 1.3, 1.1, 1.3, { hitR: 0.74, noHeal: true }),
  m('na_slime4', '그림자 슬라임', 'deep', 0.95, 1.1, 1.1, { hop: true, reach: 1.25 }),
  m('na_snake4', '별 삼킨 뱀', 'deep', 0.85, 1.25, 2.3),
  m('na_larva2', '심연 애벌레', 'deep', 1.5, 1.05, 0.9, { hitR: 0.74 }),
  m('na_mouseblack', '그림자 쥐', 'deep', 0.8, 1.0, 2.2),
  m('na_beast2', '잃어버린 짐승', 'deep', 1.25, 1.3, 1.6, { hitR: 0.78 }),
  m('na_cyclope2', '눈먼 외눈이', 'deep', 1.45, 1.35, 1.1, { hitR: 0.8 }),
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
  coast: { id: 'nb_squidg', name: '해초 크라켄', pats: ['먹물 돌진', '해일 찍기', '소라게 부르기'], r: 0.8, minion: 'na_mollusc' },
  dune: { id: 'nb_racoongold', name: '황금 너구리 파라오', pats: ['금화 굴리기', '모래 폭풍 찍기', '쥐 떼 부르기'], r: 0.7, minion: 'na_mouse' },
  ember: { id: 'nb_flam', name: '불꽃 거인', pats: ['화염 돌진', '분화 찍기', '도깨비 부르기'], r: 0.65, minion: 'na_flam2' },
  sky: { id: 'nb_tengub', name: '푸른 텐구', pats: ['돌풍 급강하', '회오리 찍기', '나비 부르기'], r: 0.75, minion: 'na_butterfly' },
  deep: { id: 'nb_deep', name: '별을 삼킨 것', pats: ['별빛 흡수', '어둠 내려찍기', '그림자 부르기'], r: 0.8, minion: 'na_slime4' },
};
/** 토벌 주간 보스 그림 (주마다 돌아가며) */
export const RAID_LOOKS: BossLook[] = [
  { id: 'nb_samurai', name: '붉은 무사', pats: ['베어 들기', '칼날 회오리', '졸개 부르기'], r: 0.8, minion: 'na_skull' },
  { id: 'nb_tengu', name: '붉은 텐구', pats: ['급강하', '깃털 폭풍', '까마귀 부르기'], r: 0.75, minion: 'na_owl2' },
  { id: 'nb_racoon', name: '거대 너구리', pats: ['몸통 박치기', '배 찍기', '너구리 부르기'], r: 0.7, minion: 'na_racoon' },
  { id: 'nb_slime', name: '왕슬라임', pats: ['굴러오기', '내려 앉기', '분열'], r: 0.75, minion: 'na_slime_green' },
  // 심연의 눈: 새 그림 4종에 없어 옛 그림 한 장 그대로 (전투에서도 같은 그림)
  { id: 'old_eye', name: '심연의 눈', pats: ['응시 돌진', '촉수 내려치기', '그림자 부르기'], r: 0.8, minion: 'na_spirit2' },
  // REGIONS2 §3: 패턴 4개 중 앞의 셋이 필드 패턴 (돌진 · 내려찍기 · 부하) — 넷째(특수)는 분노 때 이름으로
  { id: 'nb_dragong', name: '바다 용 렌', pats: ['물기둥 돌진', '꼬리 찍기', '크라켄 새끼'], r: 0.85, minion: 'na_octopusg' },
  { id: 'nb_samuraib', name: '모래의 검귀', pats: ['모래 베기', '칼날 폭풍', '미라 졸개'], r: 0.8, minion: 'na_reptile' },
  { id: 'nb_cyclop2', name: '용암 마귀', pats: ['용암 돌진', '분화', '불두더지'], r: 0.7, minion: 'na_mole2' },
  { id: 'nb_dragonb', name: '하늘 용', pats: ['급강하', '번개 숨결', '나비 떼'], r: 0.85, minion: 'na_butterflyb' },
];
/** 토벌 보스(옛 id) → 그림 (핫픽스 8: 주마다 돌리지 않고 보스마다 고정 — 이름·초상과 맞게) */
export const RAID_LOOK_OF: Record<string, string> = { boar: 'nb_racoon', mushroom: 'nb_slime', golem: 'nb_samurai', wyvern: 'nb_tengu', eye: 'old_eye', leviathan: 'nb_dragong', sandblade: 'nb_samuraib', magma: 'nb_cyclop2', skydragon: 'nb_dragonb' };
