// 4단계 주인공: 전직 6개와 정해진 출신 (남/여는 호칭·초상화만 다르다) + 유산을 이은 세대의 출신 2개
// 초상화: assets/portraits/mc_{job}_{m|f}.png  (사냥꾼 = hunter)
import type { ClassDef } from './classes';

export type Job = 'knight' | 'warrior' | 'rogue' | 'mage' | 'priest' | 'hunter';
export const JOBS: Job[] = ['knight', 'warrior', 'rogue', 'mage', 'priest', 'hunter'];
export type Gender = 'm' | 'f';
/** 주인 능력치: 체력 · 요리 · 말솜씨 · 손재주 · 담력 · 마음 */
export type OStat = 'hp' | 'cook' | 'talk' | 'craft' | 'nerve' | 'heart';
export const OSTATS: OStat[] = ['hp', 'cook', 'talk', 'craft', 'nerve', 'heart'];
export const OSTAT_NAME: Record<OStat, string> = { hp: '체력', cook: '요리', talk: '말솜씨', craft: '손재주', nerve: '담력', heart: '마음' };
export const OSTAT_DESC: Record<OStat, string> = {
  hp: '하루 행동력 (말 걸기·선물) · 주인 보너스',
  cook: '주점 수입 · 식사 기분',
  talk: '의뢰 금화 · 단골이 되는 확률',
  craft: '제작 등급 · 강화 성공률',
  nerve: '주인 보너스(토벌·위험 원정)',
  heart: '인연 오르는 속도 · 선물 효과',
};

/** 출신마다 다른 시작 보너스 (world/owner.ts가 읽는다) */
export type OriginPerk = 'train' | 'raid' | 'trade' | 'enhance' | 'mood' | 'expTime' | 'legacy';

export interface OriginDef {
  key: string;
  job: Job;
  jobName: string;
  /** 출신 이름 [남, 여] */
  title: [string, string];
  past: string;
  /** 시작 능력치 (합계 60) */
  start: Record<OStat, number>;
  perk: OriginPerk;
  perkText: string;
  /** 연결된 영웅 (전설 키) — 소문 조건 70%, 인연 1.3배, 재회 대사 */
  linked: string[];
  /** 출신 이야기 컷 (주인공 혼잣말). {호칭}·{이름} 치환 */
  cut: string[];
  /** 오프닝에서 버나드가 출신을 알아보는 대사 */
  bernard: string;
  /** 방랑의 불씨 30 · 60 · 90 밤 독백 */
  embers: [string, string, string];
  /** 연결 영웅을 처음 만났을 때 (영웅 키 → 대사) */
  reunion: Record<string, string[]>;
}

const S = (hp: number, cook: number, talk: number, craft: number, nerve: number, heart: number) => ({ hp, cook, talk, craft, nerve, heart });

export const ORIGINS: OriginDef[] = [
  {
    key: 'knight', job: 'knight', jobName: '기사',
    title: ['몰락한 은빛 기사단의 마지막 종자', '몰락한 은빛 기사단의 마지막 여종자'],
    past: '북부 성채가 무너진 날 기사단을 잃고 검을 내려놓았다',
    start: S(10, 6, 8, 8, 18, 10), perk: 'train', perkText: '담력 +, 훈련장 효율 +10%',
    linked: ['elysia', 'ceres'],
    cut: [
      '북부 성채에 눈이 내리던 밤이었다.',
      '은빛 깃발이 하나씩 쓰러지고, 마지막까지 서 있던 건 나 하나였다.',
      '{호칭}. 그게 내 이름보다 먼저 불리던 이름이었다.',
      '검을 묻고 남쪽으로 내려왔다. 다시는 칼자루를 쥐지 않겠다고.',
    ],
    bernard: '그 걸음걸이… 기사단 종자 출신이로군. 칼은 내려놨어도 등은 아직 곧아.',
    embers: [
      '다락의 낡은 은빛 투구가 달빛에 반짝인다. …성채의 종소리가 들린 것 같다.',
      '북부로 가는 지도를 펼쳐 본다. 무너진 성채 자리에 누가 깃발을 세웠을까.',
      '꿈에서 단장님이 불렀다. "아직 끝나지 않았다, {이름}." 눈을 뜨니 손이 검을 찾고 있었다.',
    ],
    reunion: {
      elysia: ['>그 은빛 갑옷… 혹시 북부 기사단을 아시오?', '당신이 마지막 종자였군요. 살아 있었다니.'],
      ceres: ['>왕실 기사가 은빛 기사단을 기억한다니.', '기억하고말고요! 제 교본에 나오는 분들인걸요.'],
    },
  },
  {
    key: 'warrior', job: 'warrior', jobName: '전사',
    title: ['남부 투기장의 붉은 늑대', '남부 투기장의 붉은 늑대'],
    past: '무패 챔피언. 무릎을 다쳐 은퇴, 아직 관중 함성이 꿈에 나온다',
    start: S(18, 8, 8, 8, 10, 8), perk: 'raid', perkText: '체력 +, 토벌 피해 +5%',
    linked: ['grom', 'jin'],
    cut: [
      '모래 위로 피와 땀이 떨어지던 남부 투기장.',
      '"붉은 늑대! 붉은 늑대!" 관중들은 매일 밤 내 이름을 외쳤다.',
      '마흔아홉 번째 경기에서 무릎이 꺾였다. 무패는 그대로 남았지만, 다리는 아니었다.',
      '함성은 아직도 꿈에 나온다. 깨어 보면 조용한 여관 천장뿐이다.',
    ],
    bernard: '자네 그 무릎… 투기장 출신이지? 붉은 늑대 얘기는 여기까지 들렸다네.',
    embers: [
      '다락의 녹슨 투기장 팔찌가 달빛에 반짝인다. 함성이 귓가에 맴돈다.',
      '남부 지도를 펼쳐 본다. 투기장 말고, 진짜 싸움이 있는 곳은 어딜까.',
      '꿈에서 옛 맞수가 불렀다. "늑대가 우리에 갇혀 사는 꼴이라니." 무릎이 욱신거린다.',
    ],
    reunion: {
      grom: ['>그 주먹, 투기장에서 본 적 있는데!', '으하하! 붉은 늑대 아니냐! 한 판 붙자!'],
      jin: ['>그 검… 어디서 본 듯한데.', '투기장 마지막 경기, 관중석에 내가 있었소.'],
    },
  },
  {
    key: 'rogue', job: 'rogue', jobName: '도적',
    title: ['항구 뒷골목의 쥐', '항구 뒷골목의 쥐'],
    past: "해적과 도둑 사이에서 자랐다. 마지막 '한탕'이 틀어진 뒤 손을 씻었다",
    start: S(8, 8, 18, 10, 8, 8), perk: 'trade', perkText: '말솜씨 +, 의뢰 금화 +5%',
    linked: ['nyx', 'vivian'],
    cut: [
      '비린내 나는 항구, 젖은 골목. 거기서 자랐다.',
      '해적들은 날 「쥐」라고 불렀다. 작고, 빠르고, 어디든 들어가니까.',
      '마지막 한탕은 틀어졌다. 누군가 다쳤고, 그게 내 탓이었다.',
      '그날 이후 남의 주머니엔 손을 대지 않는다. 대신 장부를 쥐었다.',
    ],
    bernard: '손이 빠르군. 내 장부를 그리 빨리 넘기는 사람은… 항구 쪽 출신이지? 걱정 말게, 묻지 않겠네.',
    embers: [
      '다락의 낡은 단검이 달빛에 반짝인다. 손끝이 근질거린다.',
      '항구 지도를 펼쳐 본다. 그때 틀어진 한탕, 바로잡을 방법이 있을지도.',
      '꿈에서 옛 동료가 불렀다. "쥐는 구멍에 숨어 사는 게 아니야." 바다 냄새가 났다.',
    ],
    reunion: {
      nyx: ['…그 발소리. 항구의 쥐로군.', '>그림자 아가씨, 아직도 지붕 위로 다녀요?'],
      vivian: ['어머, 우리 쥐새끼가 여관 주인이 됐네?', '>선장님… 그 배에 다시 탈 일은 없을 줄 알았는데요.'],
    },
  },
  {
    key: 'mage', job: 'mage', jobName: '마법사',
    title: ['탑을 떠난 수습 마도사', '탑을 떠난 수습 마도사'],
    past: '금지된 불꽃 마법을 건드려 탑에서 쫓겨났다',
    start: S(8, 10, 8, 18, 8, 8), perk: 'enhance', perkText: '손재주 +, 강화 성공 +2%p',
    linked: ['scarlet', 'momo2'],
    cut: [
      '탑의 서고 맨 아래층, 봉인된 책이 있었다.',
      '딱 한 장만 넘겨 봤다. 손끝에서 피어난 불꽃은 아름다웠고, 무서웠다.',
      '그날로 탑에서 쫓겨났다. 수습 마도사의 망토도 빼앗겼다.',
      '지금은 그 불로 스튜를 끓인다. 이것도 나쁘지 않다고 생각하면서.',
    ],
    bernard: '아궁이 불을 손짓 하나로 붙이더군. 탑 출신인가? 허허, 여관에선 그것도 큰 재주지.',
    embers: [
      '다락의 그을린 마도서가 달빛에 반짝인다. 책장이 저절로 넘어간 것 같다.',
      '탑 너머 지도를 펼쳐 본다. 불꽃 마법을 아는 마녀가 산다는 곳이 있다.',
      '꿈에서 스승님이 불렀다. "불은 두려워할 게 아니라 다룰 것이다." 손끝이 따뜻했다.',
    ],
    reunion: {
      scarlet: ['어머, 그 손끝 냄새. 금지된 불꽃을 만졌구나?', '>…들켰네요. 탑에서 쫓겨난 이유예요.'],
      momo2: ['에헴! 탑에서 쫓겨난 선배님이시군요!', '>선배는 무슨… 넌 몇 살이니?'],
    },
  },
  {
    key: 'priest', job: 'priest', jobName: '사제',
    title: ['파문당한 순례자', '파문당한 순례자'],
    past: '신전의 명령 대신 눈앞의 아이를 살렸다가 파문당했다',
    start: S(8, 8, 8, 8, 10, 18), perk: 'mood', perkText: '마음 +, 손님 기분 +10%',
    linked: ['aria', 'vael'],
    cut: [
      '신전은 문을 닫으라고 했다. 역병이 도는 마을이었다.',
      '문밖에서 아이가 울고 있었다. 나는 문을 열었다.',
      '아이는 살았고, 나는 파문당했다. 순례자의 지팡이만 남았다.',
      '기도는 아직 한다. 다만 이제는 손님들의 지친 얼굴을 보며.',
    ],
    bernard: '자네가 오고 나서 손님들 얼굴이 편해졌어. 순례자였다지? 신전이 놓친 사람이로군.',
    embers: [
      '다락의 순례자 지팡이가 달빛에 반짝인다. 먼 종소리가 들린다.',
      '순례길 지도를 펼쳐 본다. 아직 문이 닫힌 마을이 많을 것이다.',
      '꿈에서 그 아이가 불렀다. 이제는 어른이 되어, 길 위에서 손을 흔들고 있었다.',
    ],
    reunion: {
      aria: ['신전을 떠난 분이 계시다고 들었어요.', '>성녀님께 그 얘기가 들어갔다니… 부끄럽네요.'],
      vael: ['파문당한 순례자라… 신전을 거스른 녀석이군.', '>아이 하나 살린 게 죄라면, 기꺼이요.'],
    },
  },
  {
    key: 'hunter', job: 'hunter', jobName: '사냥꾼',
    title: ['숲 경계의 파수꾼', '숲 경계의 파수꾼'],
    past: '숲을 지키던 마지막 파수꾼. 숲이 불탄 뒤 떠돌았다',
    start: S(10, 18, 8, 8, 8, 8), perk: 'expTime', perkText: '요리 +(사냥 요리), 원정 시간 -5%',
    linked: ['sylas', 'luna'],
    cut: [
      '숲의 경계에는 파수꾼의 오두막이 있었다.',
      '바람 냄새로 날씨를 읽고, 발자국으로 손님을 맞았다.',
      '그해 가을, 숲이 불탔다. 지킬 것이 사라진 파수꾼은 떠돌이가 되었다.',
      '지금은 사냥 요리로 손님을 맞는다. 고기 굽는 냄새만은 숲에서 배운 그대로다.',
    ],
    bernard: '이 스튜 냄새… 숲 사람이 끓인 거로군. 파수꾼 출신인가? 우리 주점이 살겠어.',
    embers: [
      '다락의 낡은 활이 달빛에 반짝인다. 시위가 저절로 우는 것 같다.',
      '숲 지도를 펼쳐 본다. 불탄 자리에 새싹이 났다는 소문이 있다.',
      '꿈에서 숲이 불렀다. 나뭇잎 하나하나가 내 이름을 속삭였다.',
    ],
    reunion: {
      sylas: ['파수꾼의 활 자국… 너였군. 숲이 불탄 날 사라진.', '>사일러스… 숲은, 다시 자라고 있나요?'],
      luna: ['킁킁! 이 냄새, 숲 경계 오두막 냄새야!', '>루나? 그 꼬마 늑대가 이렇게 컸구나.'],
    },
  },
];

/** 유산을 이은 다음 세대만 고를 수 있는 출신 (직업은 따로 고른다) */
export const LEGACY_ORIGINS = [
  {
    key: 'disciple', title: ['전 주인의 제자', '전 주인의 제자'] as [string, string], past: '앞 주인 곁에서 장부와 스튜를 배웠다',
    start: S(10, 12, 12, 10, 8, 8), perkText: '앞 주인의 연결 영웅을 이어받는다',
    cut: ['장부 넘기는 법, 스튜 간 보는 법, 손님 이름 외우는 법.', '전부 그 사람에게 배웠다.', '이제 그 사람이 떠난 자리에 내가 선다.'],
  },
  {
    key: 'child', title: ['전 주인의 아들', '전 주인의 딸'] as [string, string], past: '여관 다락에서 자라며 손님들의 무용담을 들었다',
    start: S(10, 8, 8, 8, 12, 14), perkText: '앞 주인의 연결 영웅을 이어받는다 · 마음 +',
    cut: ['어릴 적 다락은 내 성이었다. 손님들의 무용담이 자장가였다.', '부모님은 어느 날 옛 장비를 챙겨 떠났다.', '"여관을 부탁한다." 그 말 한마디를 남기고.'],
  },
];

export const originByKey = (k: string) => ORIGINS.find((o) => o.key === k);

/** 초상화 키 (PORTRAITS) */
export const mcPortrait = (job: Job, g: Gender) => `mc_${job}_${g}`;

/** 마을을 걷는 주인 도트: 직업별 옷 + 초상화에 맞춘 머리색 */
const HAIR: Record<Job, [string, string]> = {
  knight: ['#3a2a24', '#e8d49a'],
  warrior: ['#c8402a', '#c8402a'],
  rogue: ['#23243a', '#1c1c28'],
  mage: ['#2a2a30', '#8a5ab8'],
  priest: ['#7a4a2a', '#b0703a'],
  hunter: ['#7a4a2a', '#6a3a24'],
};
export function ownerLook(job: Job, g: Gender): ClassDef {
  const hair = HAIR[job][g === 'm' ? 0 : 1];
  const style = g === 'm' ? 'short' : job === 'knight' || job === 'priest' ? 'braid' : 'long';
  const base = { name: '나', hair, style, pants: '#4a3f5a', boots: '#5b3a26', apron: '#e9dcc0', weapon: null } as const;
  switch (job) {
    case 'knight':
      return { ...base, face: { eyes: 'dot', brow: 'up', mouth: 'flat' }, cloth: '#5a6a8a', arm: '#b9c3d6', accent: '#e8b94a' };
    case 'warrior':
      return { ...base, face: { eyes: 'squint', brow: 'angry', mouth: 'grin', scar: true }, cloth: '#8a3a2a', arm: '#efe0bf', accent: '#c9a04a' };
    case 'rogue':
      return { ...base, face: { eyes: 'sly', mouth: 'smirk' }, cloth: '#3a3040', arm: '#e8d4b0', accent: '#b8873e' };
    case 'mage':
      return { ...base, face: { eyes: 'calm', mouth: 'tiny', glasses: g === 'm' }, cloth: '#5a3a7a', arm: '#7b4bb8', accent: '#f2c447' };
    case 'priest':
      return { ...base, face: { eyes: 'happy', mouth: 'tiny', blush: true }, cloth: '#f4f0e6', arm: '#f4f0e6', accent: '#e0a93a' };
    case 'hunter':
      return { ...base, face: { eyes: 'dot', mouth: 'grin', freckle: true }, cloth: '#4f6a3a', arm: '#e8d4b0', accent: '#8a6040', bandana: '#4f8a3a' };
  }
}
