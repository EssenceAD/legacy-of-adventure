// 토벌전 보스 1차 5마리: 지역 · 권장 전투력 · 주간 체력 · 패턴 · 전용 재료 · 트로피
// 그림은 지금 멧돼지 왕(sprites/boss_boar.png) 하나뿐 → 나머지는 색·크기를 바꿔 임시로 쓴다 (그림이 오면 sprite만 바꾸면 된다)
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
  /** 임시 그림: 색상 회전(도) · 배율 · 배경 색조 */
  hue: number;
  scale: number;
  bgTint: string | null;
  /** 보상 기준 금화 (권장 전투력으로 한 판 했을 때) */
  gold: number;
}

export const BOSSES: BossDef[] = [
  {
    id: 'boar', name: '멧돼지 왕', region: 'forest', alarm: '숲에서 거대한 멧돼지 왕이 나타났다!',
    power: 300, hp: 120000, patterns: ['돌진', '송곳니 찍기', '흙먼지', '포효'],
    mat: '멧돼지 송곳니', trophy: '멧돼지 왕 머리', title: '숲의 왕을 쓰러뜨린 자',
    weak: ['knight', 'rogue'], resist: ['mage'], hue: 0, scale: 1, bgTint: null, gold: 600,
  },
  {
    id: 'mushroom', name: '버섯 거인', region: 'swamp', alarm: '늪에서 버섯 거인이 걸어 나왔다! 포자가 마을까지 날린다!',
    power: 660, hp: 260000, patterns: ['몸통 박치기', '갓 내려치기', '독 포자', '분열'],
    mat: '거인의 갓', trophy: '버섯 거인 갓', title: '늪의 포자를 걷어낸 자',
    weak: ['mage', 'cleric'], resist: ['rogue'], hue: 280, scale: 1.05, bgTint: 'rgba(80,40,120,.35)', gold: 1500,
  },
  {
    id: 'golem', name: '폐광 골렘', region: 'mine', alarm: '폐광 깊은 곳에서 골렘이 깨어났다! 땅이 흔들린다!',
    power: 1450, hp: 580000, patterns: ['굴러오기', '바위 주먹', '낙석', '단단해지기'],
    mat: '골렘 핵', trophy: '골렘 주먹', title: '바위를 부순 자',
    weak: ['dwarf', 'mage'], resist: ['rogue', 'knight'], hue: 200, scale: 1.1, bgTint: 'rgba(60,50,40,.45)', gold: 3750,
  },
  {
    id: 'wyvern', name: '얼음 와이번', region: 'ice', alarm: '협곡 위로 얼음 와이번이 날아올랐다! 하늘이 얼어붙는다!',
    power: 3200, hp: 1280000, patterns: ['급강하', '꼬리 찍기', '얼음 숨결', '눈보라'],
    mat: '와이번 비늘', trophy: '얼음 와이번 뿔', title: '하늘을 얼린 용을 잡은 자',
    weak: ['rogue', 'cleric'], resist: ['dwarf'], hue: 170, scale: 1.15, bgTint: 'rgba(120,180,255,.35)', gold: 9400,
  },
  {
    id: 'eye', name: '심연의 눈', region: 'abyss', alarm: '별의 심연이 열리고… 거대한 눈이 마을을 내려다본다!',
    power: 7000, hp: 2800000, patterns: ['응시 광선', '촉수 내려치기', '별빛 폭발', '시간 왜곡'],
    mat: '심연의 눈물', trophy: '심연의 눈 조각', title: '심연을 마주 본 자',
    weak: ['cleric', 'knight'], resist: ['mage'], hue: 240, scale: 1.2, bgTint: 'rgba(40,20,90,.55)', gold: 23500,
  },
];

export const bossById = (id: string) => BOSSES.find((b) => b.id === id);
