// 5단계 1장: 가이드 임무 「버나드의 장부」 — 40개, 7장. 늘 하나의 「다음 할 일」이 화면 왼쪽 위에.
// check(c) → [지금, 목표]. place = 카드를 누르면 열 곳(손가락이 가리킬 버튼). 대사는 노주인 버나드가 장부를 넘겨주며 가르치는 말투.
import type { Place } from '../ui/nav';
import type { Kind } from './catalog';

export interface GuideCtx {
  expeditions: number;
  quickRuns: number;
  equippedRare: boolean;
  has: (kind: string) => boolean;
  guestTalks: number;
  goalsClaimed: number;
  huntBest: (region: string) => number;
  huntAutoUsed: boolean;
  regulars: number;
  land: number;
  stars: number;
  /** 평판 점수 · ★n에 필요한 점수 (임무 카드가 점수로 움직이게) */
  rep: number;
  repFor: (star: number) => number;
  regionWins: (r: string) => number;
  salvaged: number;
  enhanceMax: number;
  crafted: number;
  raidTries: number;
  raidKills: number;
  heroes: number;
  chem: number;
  rumors: number;
  harvests: number;
  regularLv: (lv: number) => number;
  itemDex: number;
  /** 베타: 어울림 발견 수 · 숨은 어울림 발견 수 · 이번 시즌 평가 점수(최고 등급 포함) */
  harmonies: number;
  hiddenHarmonies: number;
  evalScore: number;
}

export interface Mission {
  id: string;
  title: string;
  check: (c: GuideCtx) => [number, number];
  place: Place;
  reward: { gold?: number; dust?: number; tokens?: number };
  /** 다 하고 받을 때 버나드 한마디 */
  line: string;
  /** 베타에 끼워 넣은 임무 (v5 저장: 이미 끝낸 장이면 받은 걸로) */
  beta?: boolean;
  /** 핫픽스 8: 건설 임무의 건물 — 자리가 없으면 카드에 「자리 부족」 */
  build?: Kind;
}

export interface Chapter {
  no: number;
  name: string;
  /** 장 시작 컷 2~3줄 */
  cut: string[];
  /** 장 보상: 여는 기능 · 마을 등급 */
  unlock: ('hunt' | 'smith' | 'shop' | 'raid' | 'garden' | 'cottage' | 'all')[];
  grade?: number;
  rewardText: string;
  missions: Mission[];
}

const b = (v: boolean): [number, number] => [v ? 1 : 0, 1];
const n = (cur: number, need: number): [number, number] => [Math.min(cur, need), need];

export const CHAPTERS: Chapter[] = [
  {
    no: 1, name: '낡은 간판', unlock: ['hunt'], rewardText: '사냥터 「숲 입구」가 열려요',
    cut: ['허허, 이 장부를 받게. 내가 여관을 하며 하나씩 적어 둔 「해야 할 일」이라네.', '첫 장은 간단해. 간판을 다시 달고, 손님을 맞을 준비를 하는 거지.'],
    missions: [
      { id: 'c1_scout', title: '첫 정찰 보내기', check: (c) => n(c.expeditions, 1), place: 'board', reward: { gold: 100 }, line: '잘했네. 단골들이 몸이 근질근질했을 거야.' },
      { id: 'c1_fire', title: '모닥불 짓기', check: (c) => b(c.has('fire')), build: 'fire', place: 'fire', reward: { gold: 80 }, line: '밤에 불이 있으면 손님들이 모여 이야기를 하지. 여관의 시작이야.' },
      { id: 'c1_talk', title: '손님에게 말 걸기', check: (c) => n(c.guestTalks, 1), place: 'guests', reward: { gold: 80 }, line: '손님 얼굴을 기억하는 주인. 그게 좋은 여관이야.' },
      { id: 'c1_equip', title: '희귀 장비 장착하기', check: (c) => b(c.equippedRare), place: 'guests', reward: { gold: 100 }, line: '좋은 장비 하나가 목숨을 살리지. 장부에 적어 두게.' },
      { id: 'c1_quick', title: '1분 의뢰 2번 보내기', check: (c) => n(c.quickRuns, 2), place: 'board', reward: { gold: 150, dust: 20 }, line: '짧은 의뢰는 자주, 긴 의뢰는 잘 때. 셈이 빠르군.' },
      { id: 'c1_goal', title: '오늘의 목표 하나 받기', check: (c) => n(c.goalsClaimed, 1), place: 'goals', reward: { gold: 100 }, line: '매일의 목표를 챙기면 금고가 마르지 않지.' },
    ],
  },
  {
    no: 2, name: '첫 손님들', unlock: [], grade: 1, rewardText: '마을 등급 「쉼터」',
    cut: ['숲 입구에 사냥터가 열렸네. 단골들을 데려가 몸을 풀게 하게.', '손님이 늘면 마을도 넓혀야지. 장부 둘째 장일세.'],
    missions: [
      { id: 'c2_well', title: '우물 짓기', check: (c) => b(c.has('well')), build: 'well', place: 'well', reward: { gold: 100 }, line: '물이 있어야 사람이 모이지. 우물은 마을의 심장이야.' },
      { id: 'c2_harm', title: '첫 어울림 발견하기', check: (c) => n(c.harmonies, 1), place: 'build', reward: { gold: 150 }, line: '우물가에 벤치 하나 놓았을 뿐인데 손님들이 수다를 떠는군. 그게 어울림일세.', beta: true },
      { id: 'c2_hunt1', title: '사냥 1-1 돌파', check: (c) => n(c.huntBest('forest'), 1), place: 'hunt', reward: { gold: 120 }, line: '슬라임 정도야 식은 죽 먹기지. 허허.' },
      { id: 'c2_auto', title: '사냥 맡겨 두기', check: (c) => b(c.huntAutoUsed), place: 'hunt', reward: { gold: 80 }, line: '깬 스테이지는 「맡겨 두기」를 눌러 두게. 자네가 장부를 볼 동안에도 단골들이 마을에서 계속 사냥을 하지.' },
      { id: 'c2_hunt5', title: '사냥 1-5 돌파', check: (c) => n(c.huntBest('forest'), 5), place: 'hunt', reward: { gold: 200, dust: 30 }, line: '숲 입구 절반을 정리했군. 마을 사람들이 고마워할 걸세.' },
      { id: 'c2_reg', title: '단골 3명 모으기', check: (c) => n(c.regulars, 3), place: 'guests', reward: { gold: 150 }, line: '세 명이면 파티가 되지. 이제 진짜 여관이야.' },
      { id: 'c2_land', title: '땅 2단계로 넓히기', check: (c) => n(c.land, 2), place: 'land', reward: { gold: 200 }, line: '숲을 베어 내니 땅이 됐군! 울타리 안은 전부 자네가 지을 수 있는 땅이야.' },
    ],
  },
  {
    no: 3, name: '소문이 난다', unlock: ['smith', 'shop'], rewardText: '대장간 · 상점이 열려요',
    cut: ['쉼터가 됐다는 소문이 벌써 옆 마을까지 났더군.', '손님이 많아지면 할 일도 많아지지. 게시판, 주점, 훈련장… 차례로 가 보세.'],
    missions: [
      { id: 'c3_star2', title: '평판 ★2 달성', check: (c) => n(c.rep, c.repFor(2)), place: 'goals', reward: { gold: 200 }, line: '별이 둘! 이 정도면 지나가던 모험가도 들르지.' },
      { id: 'c3_land3', title: '땅 3단계로 넓히기', check: (c) => n(c.land, 3), place: 'land', reward: { gold: 200 }, line: '넓은 땅엔 큰 건물이 들어서야지.' },
      { id: 'c3_board', title: '의뢰 게시판 짓기', check: (c) => b(c.has('board')), build: 'board', place: 'boardObj', reward: { gold: 150 }, line: '게시판이 있으면 파티를 하나 더 보낼 수 있지.' },
      { id: 'c3_tavern', title: '주점 짓기', check: (c) => b(c.has('tavern')), build: 'tavern', place: 'build', reward: { gold: 200 }, line: '스튜 냄새가 나야 여관이지. 허허, 배고프군.' },
      { id: 'c3_training', title: '훈련장 짓기', check: (c) => b(c.has('training')), build: 'training', place: 'build', reward: { gold: 200 }, line: '허수아비를 패는 소리가 듣기 좋구먼.' },
      { id: 'c3_hidden', title: '숨은 어울림 1개 발견하기', check: (c) => n(c.hiddenHarmonies, 1), place: 'dex', reward: { gold: 250, dust: 30 }, line: '도감에 없던 조합을 찾았군! 힌트는 하루마다 또렷해지니 잘 보게.', beta: true },
      { id: 'c3_boss', title: '사냥 1-10 (숲의 보스) 돌파', check: (c) => n(c.huntBest('forest'), 10), place: 'hunt', reward: { gold: 400, dust: 60, tokens: 1 }, line: '숲 입구의 주인을 쓰러뜨렸군! 대장장이들이 소문을 듣고 오겠어.' },
    ],
  },
  {
    no: 4, name: '대장간의 불', unlock: ['raid'], grade: 2, rewardText: '마을 등급 「마을」 · 토벌전이 열려요',
    cut: ['드디어 대장간일세. 장비는 원정에서만 얻는 게 아니야. 두드리고, 녹이고, 다시 만들지.', '불을 지피게. 뜨거울수록 좋은 쇠가 나오는 법이야.'],
    missions: [
      { id: 'c4_smith', title: '대장간 짓기', check: (c) => b(c.has('smith')), build: 'smith', place: 'build', reward: { gold: 300 }, line: '망치 소리! 이제 이 마을에도 불이 켜졌군.' },
      { id: 'c4_salvage', title: '장비 3개 분해하기', check: (c) => n(c.salvaged, 3), place: 'smith', reward: { dust: 60 }, line: '쓸모없는 장비도 가루가 되면 보물이지.' },
      { id: 'c4_enh', title: '장비 +3까지 강화하기', check: (c) => n(c.enhanceMax, 3), place: 'smith', reward: { gold: 200, dust: 40 }, line: '+3이면 벌써 반짝이는군. 망치질이 손에 익었어.' },
      { id: 'c4_craft', title: '세트 장비 1부위 제작하기', check: (c) => n(c.crafted, 1), place: 'smith', reward: { gold: 300 }, line: '재료를 모아 직접 만든 장비는 각별하지.' },
      { id: 'c4_wins', title: '의뢰 10번 성공하기', check: (c) => n(c.regionWins('all'), 10), place: 'board', reward: { gold: 300 }, line: '열 번이라! 이제 단골들 이름이 숲 너머까지 알려졌겠군.' },
      { id: 'c4_hunt2', title: '사냥 2-1 (버섯 늪) 돌파', check: (c) => n(c.huntBest('swamp'), 1), place: 'hunt', reward: { gold: 300 }, line: '늪은 질척하지만 보물도 많지. 장화를 단단히 신기게.' },
      { id: 'c4_eval', title: '평가단 점수 브론즈(300) 넘기기', check: (c) => n(c.evalScore, 300), place: 'eval', reward: { gold: 400 }, line: '『여행자 안내서』에 이름이 실리겠군! 일요일 저녁엔 마을을 깨끗이 해 두게.', beta: true },
    ],
  },
  {
    no: 5, name: '숲의 왕', unlock: ['garden', 'cottage'], rewardText: '텃밭 · 객실 별채가 열려요',
    cut: ['마을이 되자 숲의 왕이 눈을 떴다는구먼. 매주 커다란 녀석이 나타날 걸세.', '혼자서는 못 이겨. 영웅도 모으고, 단골도 키우게.'],
    missions: [
      { id: 'c5_raid', title: '주간 보스에 도전하기', check: (c) => n(c.raidTries, 1), place: 'raid', reward: { gold: 300, tokens: 1 }, line: '이기든 지든 덤빈 게 중요하지. 다음엔 더 깎을 걸세.' },
      { id: 'c5_swamp', title: '사냥 2-5 돌파', check: (c) => n(c.huntBest('swamp'), 5), place: 'hunt', reward: { gold: 300, dust: 60 }, line: '늪 한복판까지 갔군. 개구리들이 놀랐겠어.' },
      { id: 'c5_hero', title: '영웅 1명 영입하기', check: (c) => n(c.heroes, 1), place: 'dex', reward: { gold: 400 }, line: '영웅이 머무는 여관이라… 내가 하던 시절엔 꿈도 못 꿨지.' },
      { id: 'c5_reglv', title: 'Lv10 단골 1명 키우기', check: (c) => n(c.regularLv(10), 1), place: 'guests', reward: { gold: 300 }, line: '처음 왔을 땐 칼도 제대로 못 쥐던 녀석이었는데.' },
      { id: 'c5_swampwin', title: '버섯 늪에서 3번 이기기 (의뢰 성공·사냥 돌파)', check: (c) => n(c.regionWins('swamp') + c.huntBest('swamp'), 3), place: 'board', reward: { gold: 300 }, line: '늪을 건너면 폐광이 기다리지. 길이 하나 더 열렸어.' },
    ],
  },
  {
    no: 6, name: '이름난 여관', unlock: [], grade: 3, rewardText: '마을 등급 「고을」',
    cut: ['텃밭에 별채까지! 이젠 오래 묵는 손님도 받을 수 있겠군.', '이름난 여관이 되려면 이야기가 필요해. 케미, 소문, 전설…'],
    missions: [
      { id: 'c6_star3', title: '평판 ★3 달성', check: (c) => n(c.rep, c.repFor(3)), place: 'goals', reward: { gold: 400 }, line: '별 셋! 왕도의 여관들도 부러워하겠군.' },
      { id: 'c6_land4', title: '땅 4단계로 넓히기', check: (c) => n(c.land, 4), place: 'land', reward: { gold: 400 }, line: '이 땅이 내 시절의 두 배는 되겠어.' },
      { id: 'c6_chem', title: '케미 짝 1쌍 발견하기', check: (c) => n(c.chem, 1), place: 'guests', reward: { gold: 300 }, line: '손님끼리 친해지는 것만큼 좋은 일이 없지.' },
      { id: 'c6_harvest', title: '텃밭에서 3번 수확하기', check: (c) => n(c.harvests, 3), place: 'garden', reward: { gold: 300 }, line: '갓 딴 채소로 끓인 스튜. 손님들이 줄을 서겠군.' },
      { id: 'c6_rumor', title: '전설 영웅 소문 1개 듣기', check: (c) => n(c.rumors, 1), place: 'dex', reward: { gold: 500, tokens: 1 }, line: '전설의 소문이 이 여관에서 돈다니… 허허, 오래 살고 볼 일이야.' },
      { id: 'c6_dex', title: '아이템 도감 20칸 채우기', check: (c) => n(c.itemDex, 20), place: 'dex', reward: { gold: 400, dust: 80 }, line: '도감을 채우면 단골들도 더 강해지지. 기록은 힘이야.' },
      { id: 'c6_eval', title: '평가단 점수 골드(800) 넘기기', check: (c) => n(c.evalScore, 800), place: 'eval', reward: { gold: 1000, dust: 120 }, line: '골드라니! 왕도의 여관들도 이 마을 이름을 외우겠군.', beta: true },
    ],
  },
  {
    no: 7, name: '유산의 시작', unlock: ['all'], grade: 4, rewardText: '마을 등급 「도시」 · 업적·칭호 전부 열림',
    cut: ['장부도 마지막 장이군. 여기부터는 내가 해 본 적 없는 일들일세.', '이 여관이 자네의 유산이 되는 거야. 끝까지 가 보게.'],
    missions: [
      { id: 'c7_star4', title: '평판 ★4 달성', check: (c) => n(c.rep, c.repFor(4)), place: 'goals', reward: { gold: 600 }, line: '별 넷이면 전설의 문턱이지.' },
      { id: 'c7_land5', title: '땅 5단계로 넓히기', check: (c) => n(c.land, 5), place: 'land', reward: { gold: 600 }, line: '여기까지 넓힌 사람은 자네가 처음일세.' },
      { id: 'c7_bath', title: '온천 짓기', check: (c) => b(c.has('bath')), build: 'bath', place: 'build', reward: { gold: 500 }, line: '따뜻한 물에 몸을 담그면 늙은이 허리도 낫겠군.' },
      { id: 'c7_kill', title: '주간 보스 처치하기', check: (c) => n(c.raidKills, 1), place: 'raid', reward: { gold: 800, tokens: 2 }, line: '숲의 왕을 쓰러뜨렸다고?! 이 장부, 이제 자네 것이야.' },
      { id: 'c7_heroes', title: '영웅 3명 모으기', check: (c) => n(c.heroes, 3), place: 'dex', reward: { gold: 800, dust: 150 }, line: '…이제 내가 가르칠 건 없네. 자네의 여관을, 자네의 이야기로 채우게.' },
    ],
  },
];

export const MISSIONS = CHAPTERS.flatMap((c) => c.missions.map((m) => ({ ...m, ch: c.no })));
export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);
export const GRADE_NAMES = ['오두막', '쉼터', '마을', '고을', '도시'];
