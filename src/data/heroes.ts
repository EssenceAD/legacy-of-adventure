// 영웅 도감 「방랑자의 서」 1차 10명: 힌트·나타나는 조건·부탁·고유 기술
import type { GuestKind, Race } from './classes';
import type { OptKey, RegionId } from './items';

/** 조건 검사에 쓰는 마을 요약 (world/progress.ts가 만든다) */
export interface HeroCtx {
  night: boolean;
  land: number;
  stars: number;
  innLvl: number;
  hasBath: boolean;
  /** 지붕 색(hue)이 h인 건물 수 */
  roofCount: (h: number) => number;
  trees: number;
  fires: number;
  enhanceMax: number;
  campfireMax: number;
  regionWins: (r: RegionId) => number;
  tavernMeals: number;
  legendInBag: boolean;
  /** 친밀도 lv 이상인 짝 수 */
  pairsAtLeast: (lv: number) => number;
  chemFound: number;
  crafted: (r?: RegionId) => number;
  harvests: number;
  /** 레벨 lv 이상인 단골 수 */
  regularsAtLeast: (lv: number) => number;
  smithLvl: number;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  hint: string;
  kind: GuestKind;
  race: Race;
  hair: string;
  appear: (c: HeroCtx) => boolean;
  /** 동료가 되는 부탁 */
  request: { text: string; done: (c: HeroCtx) => boolean; prog?: (c: HeroCtx) => [number, number] };
  /** HOTFIX14 §6: 등장 조건을 말로 (의뢰 게시판 조건은 진행 수와 같이) */
  appearText?: string;
  appearProg?: (c: HeroCtx) => [number, number];
  /** 고유 기술 (원정 보너스) */
  skill: { name: string; k: OptKey; v: number; region?: RegionId };
  /** 등록 보상: 계정 전체 전투력 +% */
  bonus: number;
  /** 나타날 때 대사 */
  intro: string[];
}

export const HEROES: HeroDef[] = [
  {
    id: 'kael', name: '카엘', title: '붉은 단풍의 검사', hint: '따뜻한 물과 붉은 단풍을 좋아하는 검사', kind: 'knight', race: 'human', hair: '#b03a2a',
    appear: (c) => c.hasBath && c.roofCount(8) >= 2 && c.night,
    request: { text: '숲 동굴 의뢰를 3번 성공시켜 줘 (게시판)', done: (c) => c.regionWins('forest') >= 3, prog: (c) => [c.regionWins('forest'), 3] },
    skill: { name: '단풍 베기', k: 'atkPct', v: 12 }, bonus: 0.02,
    intro: ['단풍 지붕 아래 온천이라… 오래 찾아 헤맨 풍경이군.', '하룻밤 묵어 가도 되겠나? 대신 부탁이 하나 있네.'],
  },
  {
    id: 'brok', name: '브로크', title: '떠돌이 장인', hint: '망치 소리를 따라 떠도는 드워프', kind: 'dwarf', race: 'dwarf', hair: '#5a3424',
    appear: (c) => c.enhanceMax >= 7,
    request: { text: '대장간을 3레벨까지 올려 줘', done: (c) => c.smithLvl >= 3 },
    skill: { name: '장인의 손', k: 'goldPct', v: 15 }, bonus: 0.02,
    intro: ['+7이라고? 그 망치 소리, 산 너머까지 들렸다.', '여기 대장간이라면 내 솜씨를 펼칠 만하겠군.'],
  },
  {
    id: 'lira', name: '리라', title: '음유시인', hint: '모닥불 이야기를 좋아한다', kind: 'cleric', race: 'elf', hair: '#e8a0c8',
    appear: (c) => c.campfireMax >= 5,
    request: { text: '케미 짝 3가지를 발견해 줘', done: (c) => c.chemFound >= 3 },
    skill: { name: '용기의 노래', k: 'chemPct', v: 15 }, bonus: 0.02,
    intro: ['다섯 명이 한 불가에! 이건 노래가 될 이야기예요.', '제 노래에 들어갈 이야기를 더 모아 주실래요?'],
  },
  {
    id: 'morga', name: '모르가', title: '늪의 마녀', hint: '버섯 냄새가 나는 손님', kind: 'mage', race: 'halfling', hair: '#5a7ac8',
    appear: (c) => c.regionWins('swamp') >= 10,
    appearText: '버섯 늪 의뢰 10번 성공 (게시판)',
    appearProg: (c) => [c.regionWins('swamp'), 10],
    request: { text: '버섯 늪 세트 장비를 하나 만들어 줘', done: (c) => c.crafted('swamp') >= 1 },
    skill: { name: '포자 결계', k: 'hpSave', v: 20 }, bonus: 0.02,
    intro: ['늪을 열 번이나 건넌 녀석들이 여기서 묵는다지?', '킬킬, 마음에 드는구나. 내 부탁 하나 들어 보련?'],
  },
  {
    id: 'oswin', name: '오스윈', title: '은퇴한 성기사', hint: '노주인의 옛 동료', kind: 'knight', race: 'human', hair: '#d8d8d8',
    appear: (c) => c.innLvl >= 3 && c.stars >= 3,
    request: { text: '레벨 10 이상 단골을 3명 키워 줘', done: (c) => c.regularsAtLeast(10) >= 3 },
    skill: { name: '옛 맹세', k: 'atkPct', v: 10 }, bonus: 0.03,
    intro: ['버나드 녀석, 좋은 후계자를 뒀군.', '옛 동료로서 부탁하지. 젊은 모험가들을 키워 주게.'],
  },
  {
    id: 'pip', name: '핍', title: '꼬마 도둑', hint: '반짝이는 걸 좋아한다', kind: 'rogue', race: 'halfling', hair: '#c98a4a',
    appear: (c) => c.legendInBag,
    request: { text: '아이템을 10개 만들어 줘 (제작)', done: (c) => c.crafted() >= 10 },
    skill: { name: '반짝이 눈', k: 'goldPct', v: 20 }, bonus: 0.01,
    intro: ['우와, 저 가방 안에 엄청 반짝이는 거 있죠?', '훔칠 생각은 없어요! …정말로요. 대신 하나 만들어 줄래요?'],
  },
  {
    id: 'seril', name: '세릴', title: '엘프 공주', hint: '숲의 쉼터를 그리워한다', kind: 'mage', race: 'elf', hair: '#f3d36b',
    appear: (c) => c.roofCount(100) >= 4 && c.trees >= 10,
    request: { text: '텃밭에서 10번 수확해 줘', done: (c) => c.harvests >= 10 },
    skill: { name: '숲의 축복', k: 'xpPct', v: 15 }, bonus: 0.03,
    intro: ['초록 지붕과 나무들… 고향 숲 같아요.', '이곳이 더 푸르러지면, 여기 머물게요.'],
  },
  {
    id: 'harald', name: '하랄드', title: '술고래', hint: '주점의 단골', kind: 'dwarf', race: 'human', hair: '#7a4a2c',
    appear: (c) => c.tavernMeals >= 100,
    request: { text: '폐광 의뢰를 5번 성공시켜 줘 (게시판)', done: (c) => c.regionWins('mine') >= 5, prog: (c) => [c.regionWins('mine'), 5] },
    skill: { name: '취권', k: 'atkPct', v: 8 }, bonus: 0.01,
    intro: ['백 그릇째인가? 이 주점 스튜, 소문이 자자하더군!', '한 잔 사면 내 도끼를 빌려주지. 대신 일 하나 하자고.'],
  },
  {
    id: 'nova', name: '노바', title: '별 보는 학자', hint: '맑은 밤하늘을 좋아한다', kind: 'cleric', race: 'human', hair: '#3a2a3a',
    appear: (c) => c.night && c.land >= 5 && c.fires >= 2,
    request: { text: '얼음 협곡 의뢰를 1번 성공시켜 줘 (게시판)', done: (c) => c.regionWins('ice') >= 1, prog: (c) => [c.regionWins('ice'), 1] },
    skill: { name: '별자리 읽기', k: 'timeCut', v: 15 }, bonus: 0.02,
    intro: ['넓은 하늘, 두 개의 모닥불… 별 보기 딱 좋은 마을이네요.', '협곡 너머 별의 기록을 찾고 있어요. 도와주실래요?'],
  },
  {
    id: 'twins', name: '렌·린', title: '쌍둥이 용병', hint: '둘은 늘 같이 다닌다', kind: 'rogue', race: 'human', hair: '#2f2a26',
    appear: (c) => c.pairsAtLeast(5) >= 1,
    request: { text: '친밀도 3단계 이상 짝을 3쌍 만들어 줘', done: (c) => c.pairsAtLeast(3) >= 3 },
    skill: { name: '쌍검', k: 'chemPct', v: 20 }, bonus: 0.02,
    intro: ['저 둘, 우리만큼 붙어 다니네? / 그러게, 언니.', '이 여관 마음에 들어. 우리도 끼워 줘. 조건은 하나!'],
  },
];

/** 도감 세트: 다 모으면 큰 보너스 + 칭호 */
export const HERO_SETS = [
  { id: 'oldparty', name: '옛 용사 파티', members: ['oswin', 'kael', 'lira'], bonus: 0.05, title: '전설을 잇는 자' },
  { id: 'wild', name: '숲과 늪의 친구들', members: ['seril', 'morga', 'pip'], bonus: 0.04, title: '숲의 벗' },
  { id: 'wander', name: '떠돌이 셋', members: ['brok', 'harald', 'nova'], bonus: 0.04, title: '방랑자의 주인' },
];

export const heroById = (id: string) => HEROES.find((h) => h.id === id);
