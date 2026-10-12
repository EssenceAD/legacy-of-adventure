// 토벌전 보스 1차 5마리: 지역 · 권장 전투력 · 주간 체력 · 패턴 · 전용 재료 · 트로피
// 그림: sprites/boss_{id}.png (왼쪽을 봄, 발 기준 = 그림 아래 끝) · 전투 배경: sprites/raid_bg_{지역}.png
import type { GuestKind } from './classes';
import type { RegionId } from './items';

export interface BossDef {
  id: string;
  name: string;
  region: RegionId;
  /** 마을에 나타날 때 경보 대사 */
  alarm: string;
  /** 권장 전투력 (파티 3명 합) */
  power: number;
  /** 주간 총 체력 (주간 동안 누적해서 깎는다) */
  hp: number;
  /** 패턴 이름 (전투 화면 표시) — [돌진, 내려찍기(막기), 광역, 특수] */
  patterns: string[];
  /** 전용 재료 (그 지역 세트 제작 강화에 쓴다) */
  mat: string;
  /** 첫 처치 트로피 장식물 이름 · 칭호 */
  trophy: string;
  title: string;
  /** 상성: 이 직업은 피해 ×1.2 / 이 직업은 ×0.85 */
  weak: GuestKind[];
  resist: GuestKind[];
  /** 떠 있는 보스: 바닥에서 몇 px 띄워 위아래 둥실 (심연의 눈) */
  float?: number;
  /** 보상 기준 금화 (권장 전투력으로 한 판 했을 때) */
  gold: number;
  /** REGIONS2: 새 보스 (옛 그림 sprites/boss_{id}.png 없음 — 얼굴은 assets/mon/{그림}/face.png) */
  fresh?: boolean;
  /** 토벌 순환·떠돌이에 안 나온다 (별을 삼킨 것 — 엔딩 전용 · 사냥 x-10 보스 재료만) */
  noRaid?: boolean;
}

export const BOSSES: BossDef[] = [
  {
    // 핫픽스 8: 보이는 이름·설명·초상만 새 그림(Ninja Adventure)에 맞춤 — id·능력치·재료·트로피·칭호·기록은 그대로
    id: 'boar', name: '거대 너구리', region: 'forest', alarm: '숲에서 집채만 한 너구리가 나타났다! 도토리 창고가 털린다!',
    power: 300, hp: 120000, patterns: ['몸통 박치기', '배 찍기', '너구리 부르기', '포효'],
    mat: '너구리 송곳니', trophy: '거대 너구리 꼬리', title: '숲의 왕을 쓰러뜨린 자',
    weak: ['knight', 'rogue'], resist: ['mage'], gold: 600,
  },
  {
    id: 'mushroom', name: '왕슬라임', region: 'swamp', alarm: '늪에서 왕슬라임이 솟아올랐다! 끈적한 점액이 마을까지 번진다!',
    power: 660, hp: 260000, patterns: ['굴러오기', '내려 앉기', '분열', '점액 비'],
    mat: '왕슬라임 젤리', trophy: '왕슬라임 왕관', title: '늪의 포자를 걷어낸 자',
    weak: ['mage', 'cleric'], resist: ['rogue'], gold: 1500,
  },
  {
    id: 'golem', name: '붉은 무사', region: 'mine', alarm: '폐광 깊은 곳에서 붉은 무사가 깨어났다! 쌍검 부딪는 소리가 울린다!',
    power: 1450, hp: 580000, patterns: ['베어 들기', '칼날 회오리', '졸개 부르기', '기합'],
    mat: '무사의 칼날 조각', trophy: '붉은 무사 투구', title: '바위를 부순 자',
    weak: ['dwarf', 'mage'], resist: ['rogue', 'knight'], gold: 3750,
  },
  {
    id: 'wyvern', name: '붉은 텐구', region: 'ice', alarm: '협곡 위로 붉은 텐구가 날아올랐다! 깃털 폭풍이 몰아친다!',
    power: 3200, hp: 1280000, patterns: ['급강하', '깃털 폭풍', '까마귀 부르기', '변신'],
    mat: '텐구 깃털', trophy: '텐구 가면', title: '하늘을 얼린 용을 잡은 자',
    weak: ['rogue', 'cleric'], resist: ['dwarf'], gold: 9400,
  },
  {
    id: 'eye', name: '심연의 눈', region: 'abyss', alarm: '별의 심연이 열리고… 거대한 눈이 마을을 내려다본다!',
    power: 7000, hp: 2800000, patterns: ['응시 광선', '촉수 내려치기', '별빛 폭발', '시간 왜곡'],
    mat: '심연의 눈물', trophy: '심연의 눈 조각', title: '심연을 마주 본 자',
    weak: ['cleric', 'knight'], resist: ['mage'], float: 12, gold: 23500,
  },
  // REGIONS2 §3: 지역 6~9 주간 토벌 (패턴 4개 = 돌진 · 내려찍기 · 부하 · 특수 — 필드 전투는 앞의 셋)
  {
    id: 'leviathan', name: '바다 용 렌', region: 'coast', alarm: '가라앉은 등대 너머로 물기둥이 솟았다! 바다 용 렌이 해안을 휘감는다!',
    power: 15000, hp: 6000000, patterns: ['물기둥 돌진', '꼬리 찍기', '크라켄 새끼', '해일'],
    mat: '용의 비늘', trophy: '등대 불씨', title: '등대에 불을 다시 켠 자',
    weak: ['mage', 'cleric'], resist: ['rogue'], float: 6, gold: 50000, fresh: true,
  },
  {
    id: 'sandblade', name: '모래의 검귀', region: 'dune', alarm: '멈춘 모래시계 아래에서 칼 뽑는 소리가 났다! 모래의 검귀가 깨어났다!',
    power: 32000, hp: 12800000, patterns: ['모래 베기', '칼날 폭풍', '미라 졸개', '시간 멈춤'],
    mat: '녹슨 모래시계', trophy: '검귀의 가면', title: '멈춘 시간을 벤 자',
    weak: ['dwarf', 'knight'], resist: ['mage'], gold: 107000, fresh: true,
  },
  {
    id: 'magma', name: '용암 마귀', region: 'ember', alarm: '잿불 화산이 으르렁거린다! 용암 마귀가 분화구에서 기어 나왔다!',
    power: 68000, hp: 27000000, patterns: ['용암 돌진', '분화', '불두더지', '대폭발'],
    mat: '마귀의 뿔', trophy: '식은 용암 왕관', title: '화산을 잠재운 자',
    weak: ['knight', 'cleric'], resist: ['dwarf'], gold: 228000, fresh: true,
  },
  {
    id: 'skydragon', name: '하늘 용', region: 'sky', alarm: '구름 정원 위로 번개가 갈라졌다! 하늘 용이 날개를 펼쳤다!',
    power: 140000, hp: 56000000, patterns: ['급강하', '번개 숨결', '나비 떼', '폭풍'],
    mat: '하늘 용의 뿔', trophy: '구름 왕관', title: '하늘 끝에 닿은 자',
    weak: ['rogue', 'mage'], resist: ['knight'], float: 8, gold: 470000, fresh: true,
  },
  {
    // 지역 10 사냥 보스 (토벌 순환에 넣지 않는다 · 엔딩 전용) — 세트 제작·초월 보스 재료만 준다
    id: 'devourer', name: '별을 삼킨 것', region: 'deep', alarm: '',
    power: 300000, hp: 1, patterns: ['별빛 흡수', '어둠 내려찍기', '그림자 부르기'],
    mat: '그림자 껍질', trophy: '', title: '',
    weak: [], resist: [], gold: 0, fresh: true, noRaid: true,
  },
];
/** 토벌(주간·떠돌이)에 나오는 보스 */
export const RAID_BOSSES = BOSSES.filter((b) => !b.noRaid);

export const bossById = (id: string) => BOSSES.find((b) => b.id === id);
