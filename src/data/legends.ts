// 전설 영웅 14명 (3단계 8장): 소문 조건 → 인연 게이지(인연 활동) → 방문 → 부탁 → 영입 → 인연의 증표로 ★1~5
// 초상화: assets/portraits/legend_{key}.png (64px). 마을 그림은 직업·종족·머리색으로 코드에서 그린다.
import type { GuestKind, Race } from './classes';
import type { OptKey, RegionId } from './items';

/** 소문 조건 검사용 마을 요약 (world/legends.ts가 만든다) */
export interface LegendCtx {
  stars: number;
  land: number;
  trees: number;
  smithLvl: number;
  trainingLvl: number;
  bathLvl: number;
  gardenLvl: number;
  enhanceMax: number;
  forestSends: number;
  moodTopDays: number;
  goldTotal: number;
  itemDexRatio: number;
  relicEver: boolean;
  /** 보스 처치 수 (id 없으면 전체) */
  bossKills: (id?: string) => number;
  heroOwned: (id: string) => boolean;
  heroStars: (id: string) => number;
  /** 기사 손님이 낀 친밀도 lv 이상 짝이 있나 */
  knightBondAtLeast: (lv: number) => boolean;
  /** 주간 토벌 랭킹 상위 30%에 든 주 수 (주가 끝날 때 내 순위 ÷ 전체 수로 판정, 로그인 필요) */
  topRankWeeks: number;
  /** 4단계: 주인 출신의 연결 영웅이면 필요 수치 70% (need(n) = n × 배율, 올림) */
  scale: number;
  need: (n: number) => number;
}

/** 인연 활동 (이 일이 일어날 때마다 그 영웅의 게이지 +1~3%) */
export type BondEvent =
  | 'train' | 'serveKnight' | 'runWithOswin' | 'nightRun' | 'enhanceTry' | 'forestRun' | 'raidTry' | 'bathUse'
  | 'dawnLogin' | 'serveRogue' | 'repGain' | 'harvest' | 'treasure' | 'itemDexNew' | 'goldEarn' | 'blockSuccess';

/** 부탁 진행 이벤트 (방문 중에만 센다) */
export type RequestEvent =
  | 'raidRankS' | 'longRunWin' | 'offer' | 'lunaTreasure' | 'raidPersonalBest' | 'tiredRecovered' | 'stealthSuccess'
  | 'newCrop' | 'showRelic' | 'itemDexNew' | 'goldEarned' | 'blockStreak5' | 'check';

export interface LegendDef {
  key: string;
  name: string;
  title: string;
  charm: string;
  kind: GuestKind;
  race: Race;
  hair: string;
  /** 도감 실루엣 옆 한 줄 힌트 · [소문] 채널 대사 */
  hint: string;
  rumor: string;
  rumorWhen: (c: LegendCtx) => boolean;
  /** 소문 조건 설명 (도감 ??? 칸) */
  rumorText: string;
  bond: BondEvent[];
  bondText: string;
  request: { text: string; event: RequestEvent; need: number };
  intro: string[];
  recruit: string;
  /** 고유 기술 (원정·토벌 보너스) */
  skill: { name: string; k: OptKey; v: number; region?: RegionId };
}

export const LEGENDS: LegendDef[] = [
  {
    key: 'elysia', name: '엘리시아', title: '은빛 기사', charm: '도도한 귀족 여기사. 칭찬에 약하다', kind: 'knight', race: 'human', hair: '#f3e08a',
    hint: '은빛 갑옷의 여기사가 이 마을의 무용담을 묻고 다닌대', rumor: '은빛 머리 여기사가 「주간 보스를 쓰러뜨린 여관」을 찾고 있대…',
    rumorWhen: (c) => c.bossKills() >= 1 && c.stars >= c.need(4), rumorText: '주간 보스 첫 처치 + 평판 ★4',
    bond: ['train', 'serveKnight'], bondText: '훈련장 이용 · 기사 손님 접대',
    request: { text: '토벌 직접 조작에서 S등급 1회 — "제 앞에서 증명해 보시죠"', event: 'raidRankS', need: 1 },
    intro: ['여기가 보스를 쓰러뜨렸다는 여관인가요? …생각보다 아담하군요.', '말로만 듣던 실력, 제 앞에서 증명해 보시죠.'],
    recruit: '…인정하죠. 당신 곁이라면 검을 맡겨도 좋겠어요. 칭찬은, 조금만 해 주세요.',
    skill: { name: '은빛 서약', k: 'atkPct', v: 15 },
  },
  {
    key: 'ceres', name: '세레스', title: '왕실 기사', charm: '땋은 왕관 머리의 수줍은 모범생', kind: 'knight', race: 'human', hair: '#f6e6a8',
    hint: '왕실 문장을 단 기사가 오스윈 경의 소식을 묻는대', rumor: '왕관처럼 머리를 땋은 기사가 옛 성기사 오스윈을 찾는대…',
    rumorWhen: (c) => c.knightBondAtLeast(c.need(5)) && c.heroOwned('oswin'), rumorText: '기사 손님 친밀도 5단계 + 오스윈 보유',
    bond: ['runWithOswin'], bondText: '오스윈과 함께 원정',
    request: { text: '기사 손님 3명이 동시에 기분 80 이상', event: 'check', need: 1 },
    intro: ['저, 저기… 오스윈 경께서 여기 계신다고 들어서요!', '기사의 예법을 아는 여관이라면… 저도 머물고 싶어요.'],
    recruit: '기사님들이 모두 웃고 계시네요. 저도 이곳의 기사가 될게요!',
    skill: { name: '왕실 방패', k: 'hpSave', v: 25 },
  },
  {
    key: 'vael', name: '바엘', title: '어둠의 검사', charm: '은발 엘프 미남. 냉소적, 검은 갑옷', kind: 'knight', race: 'elf', hair: '#d8dce8',
    hint: '심연을 본 자만 찾아오는 검은 갑옷의 엘프가 있대', rumor: '심연의 눈이 쓰러진 날, 검은 갑옷 엘프가 숲길에 나타났대…',
    rumorWhen: (c) => c.bossKills('eye') >= 1, rumorText: '심연의 눈 처치',
    bond: ['nightRun'], bondText: '밤(20~04시) 원정 출발',
    request: { text: '8시간 원정을 무사히 성공 3회', event: 'longRunWin', need: 3 },
    intro: ['심연을 닫은 게 이 촌구석 여관이라고? 흥.', '긴 밤을 버티는 법을 아는지 보자.'],
    recruit: '…나쁘지 않군. 어둠 속에서도 돌아오는 녀석들이라니. 잠시 머물러 주지.',
    skill: { name: '심연 베기', k: 'regionDmg', v: 30, region: 'abyss' },
  },
  {
    key: 'scarlet', name: '스칼렛', title: '홍염의 마녀', charm: '붉은 머리의 요염한 마녀', kind: 'mage', race: 'human', hair: '#d8402a',
    hint: '대장간 불꽃이 아홉 번 빛나면 붉은 마녀가 온대', rumor: '붉은 머리 마녀가 「+9 강화의 불꽃」 냄새를 맡았대…',
    rumorWhen: (c) => c.smithLvl >= c.need(7) && c.enhanceMax >= c.need(9), rumorText: '대장간 Lv7 + 장비 강화 +9',
    bond: ['enhanceTry'], bondText: '강화 시도 (성공·실패 모두)',
    request: { text: '옵션 붙은 영웅 등급 이상 장비 하나 바치기', event: 'offer', need: 1 },
    intro: ['어머, 좋은 불꽃이네. 망치질 소리가 여기까지 들렸어.', '선물 하나 줘 봐. 불꽃이 담긴 걸로.'],
    recruit: '후후, 마음에 들어. 당신 대장간, 내가 좀 더 뜨겁게 해 줄게.',
    skill: { name: '홍염', k: 'atkPct', v: 12 },
  },
  {
    key: 'luna', name: '루나', title: '은늑대', charm: '늑대 귀 은발 수인 소녀. 장난꾸러기', kind: 'rogue', race: 'halfling', hair: '#e8ecf4',
    hint: '숲 동굴 길에 은빛 늑대 발자국이 찍혀 있대', rumor: '숲 동굴을 50번 드나든 모험가들 뒤로 은빛 꼬리가 따라다닌대…',
    rumorWhen: (c) => c.forestSends >= c.need(50), rumorText: '숲 원정 누적 50회',
    bond: ['forestRun'], bondText: '숲 지역 원정',
    request: { text: '루나와 숲 원정 → 보물 상자 발견', event: 'lunaTreasure', need: 1 },
    intro: ['킁킁… 여기서 숲 냄새가 제일 많이 나!', '나랑 숲에 가자! 보물 냄새 맡아 줄게!'],
    recruit: '헤헤, 보물 찾았다! 여기 내 집 할래. 꼬리 만지면 안 돼!',
    skill: { name: '은빛 코', k: 'timeCut', v: 15 },
  },
  {
    key: 'grom', name: '그롬', title: '대전사', charm: '근육 대머리 수염. 확실한 마초', kind: 'dwarf', race: 'human', hair: '#5a3424',
    hint: '허수아비가 부서지는 소리를 좋아하는 거한이 있대', rumor: '훈련장 허수아비가 매일 부서지는 마을을 찾는 거한이 있대…',
    rumorWhen: (c) => c.trainingLvl >= c.need(8), rumorText: '훈련장 Lv8',
    bond: ['raidTry'], bondText: '토벌 도전',
    request: { text: '토벌 한 판 피해량 개인 최고 기록 경신', event: 'raidPersonalBest', need: 1 },
    intro: ['으하하! 좋은 훈련장이다! 허수아비가 울고 있군!', '진짜 싸움을 보여 줘라. 네 최고 기록을 넘어 봐!'],
    recruit: '좋다! 그 주먹이면 같이 싸울 만하지. 맥주는 네가 사라!',
    skill: { name: '대전사의 함성', k: 'atkPct', v: 18 },
  },
  {
    key: 'aria', name: '아리아', title: '성녀', charm: '금발 화관의 온화한 성녀', kind: 'cleric', race: 'human', hair: '#f6e0a0',
    hint: '손님들이 오래 웃는 온천 마을에 성녀가 머문대', rumor: '한 달 내내 손님이 웃는 온천 마을에 화관 쓴 성녀가 온대…',
    rumorWhen: (c) => c.bathLvl >= c.need(5) && c.moodTopDays >= c.need(30), rumorText: '온천 Lv5 + 손님 기분 최고 누적 30일',
    bond: ['bathUse'], bondText: '온천 이용 손님 수',
    request: { text: '지친 손님(체력 30 미만) 10명 회복', event: 'tiredRecovered', need: 10 },
    intro: ['따뜻한 물 냄새… 이곳 사람들은 참 편안해 보여요.', '지친 분들을 함께 돌봐 주시겠어요?'],
    recruit: '모두 웃고 있어요. 이곳이 제가 기도할 자리예요.',
    skill: { name: '성녀의 기도', k: 'hpSave', v: 30 },
  },
  {
    key: 'nyx', name: '닉스', title: '그림자', charm: '흑발 단발 암살자. 매혹적', kind: 'rogue', race: 'human', hair: '#2a2030',
    hint: '꼬마 도둑 핍이 무서워하는 그림자가 있대', rumor: '핍이 별 셋을 달자 그림자 하나가 마을 지붕 위를 지나갔대…',
    rumorWhen: (c) => c.heroStars('pip') >= c.need(3), rumorText: '핍 ★3',
    bond: ['dawnLogin', 'serveRogue'], bondText: '새벽(0~5시) 접속 · 도적 손님 접대',
    request: { text: '원정 중 「은밀」 사건 성공 3회', event: 'stealthSuccess', need: 3 },
    intro: ['…쉿. 핍 녀석이 꽤 컸더군.', '그림자처럼 움직일 수 있는 녀석들인지 보자.'],
    recruit: '흔적 없이 해냈군. 좋아, 당분간 네 그림자가 되어 주지.',
    skill: { name: '그림자 걸음', k: 'goldPct', v: 20 },
  },
  {
    key: 'leon', name: '레온', title: '사자왕', charm: '금발 갈기머리 황금 갑옷 미남', kind: 'knight', race: 'human', hair: '#e0a030',
    hint: '별 다섯 여관에만 묵는다는 황금 갑옷의 왕이 있대', rumor: '별 다섯 여관 소문을 들은 사자왕이 길을 나섰대…',
    rumorWhen: (c) => c.stars >= c.need(5) && c.land >= c.need(4), rumorText: '평판 ★5 + 땅 4단계',
    bond: ['repGain'], bondText: '평판 얻기',
    request: { text: '마을 장식 점수 40 이상 (나무·우물·모닥불·트로피…)', event: 'check', need: 1 },
    intro: ['하하! 소문대로 빛나는 여관이로군!', '왕이 머물 만큼 아름다운지, 마을을 보여 다오.'],
    recruit: '훌륭하다! 이 마을을 내 두 번째 왕국으로 삼겠다!',
    skill: { name: '사자왕의 위엄', k: 'chemPct', v: 20 },
  },
  {
    key: 'sylas', name: '사일러스', title: '숲의 사수', charm: '금발 장발 엘프 궁수 미남', kind: 'rogue', race: 'elf', hair: '#f0e0a0',
    hint: '나무 서른 그루 마을에 숲의 사수가 활을 내려놓는대', rumor: '정원이 무성한 마을에 엘프 사수가 쉬어 간대…',
    rumorWhen: (c) => c.gardenLvl >= c.need(6) && c.trees >= c.need(30), rumorText: '텃밭 Lv6 + 나무 30그루',
    bond: ['harvest'], bondText: '텃밭 수확',
    request: { text: '작물 3종(당근·호박·양배추) 모두 수확', event: 'newCrop', need: 3 },
    intro: ['…좋은 숲이다. 인간 마을치고는.', '흙이 살아 있는지, 수확으로 보여 줄 수 있나?'],
    recruit: '세 가지 결실이 다 맺혔군. 이 숲을 지키는 활이 되어 주지.',
    skill: { name: '바람 화살', k: 'xpPct', v: 25 },
  },
  {
    key: 'ryuka', name: '류카', title: '용의 딸', charm: '청록 머리 작은 뿔. 귀여운 용족', kind: 'dwarf', race: 'human', hair: '#40b0a8',
    hint: '붉은 텐구가 쓰러진 날 용의 딸이 반짝이는 걸 찾으러 온대', rumor: '텐구를 잡고 유물을 가진 여관이 있다고 용의 딸이 꼬리를 흔들었대…',
    rumorWhen: (c) => c.bossKills('wyvern') >= 1 && c.relicEver, rumorText: '붉은 텐구 처치 + 유물 등급 장비 획득',
    bond: ['treasure'], bondText: '원정에서 보물(영웅 이상 장비) 얻기',
    request: { text: '유물 등급 장비 1개 보여 주기 (소모 안 됨)', event: 'showRelic', need: 1 },
    intro: ['우와아, 반짝이는 냄새! 여기 유물 있지? 있지?', '보여 줘! 만지기만 할게, 진짜로!'],
    recruit: '예쁘다아… 좋아, 여기서 같이 반짝이는 거 모을래!',
    skill: { name: '용의 숨결', k: 'regionDmg', v: 30, region: 'ice' },
  },
  {
    key: 'momo2', name: '미미', title: '꼬마 대마법사', charm: '큰 모자 동그란 안경 꼬마. 귀여움', kind: 'mage', race: 'halfling', hair: '#f0c0d0',
    hint: '노바와 모르가가 모인 마을에 아주 작은 대마법사가 온대', rumor: '별 학자와 늪 마녀가 한 마을에 산다니, 꼬마 대마법사가 가방을 쌌대…',
    rumorWhen: (c) => c.heroOwned('nova') && c.heroOwned('morga') && c.itemDexRatio >= 0.5 * c.scale, rumorText: '노바 + 모르가 보유 + 아이템 도감 50%',
    bond: ['itemDexNew'], bondText: '아이템 도감 새 칸 등록',
    request: { text: '아이템 도감 5칸 새로 채우기', event: 'itemDexNew', need: 5 },
    intro: ['에헴! 나는 대마법사 미미다! …키는 상관없어!', '도감을 다섯 칸 더 채우면 제자로 받아 줄게!'],
    recruit: '훌륭해! 오늘부터 이 여관은 미미의 연구소다!',
    skill: { name: '대마법 연구', k: 'xpPct', v: 20 },
  },
  {
    key: 'vivian', name: '비비안', title: '해적 선장', charm: '갈색 웨이브 안대 선장. 섹시', kind: 'rogue', race: 'human', hair: '#6a4028',
    hint: '금화 백만 냥 냄새를 맡은 해적 선장이 있대', rumor: '금고에 금화 백만 냥이 쌓인 여관이 있다고 해적 선장이 웃었대…',
    rumorWhen: (c) => c.goldTotal >= c.need(1_000_000), rumorText: '누적 금화 100만',
    bond: ['goldEarn'], bondText: '금화 벌기 (원정·장사)',
    request: { text: '사흘 안에 금화 5만 벌기', event: 'goldEarned', need: 50000 },
    intro: ['이 동네에서 제일 돈 냄새 나는 곳이 여기라며?', '사흘 안에 5만 냥. 해낸다면 내 배를 여기 대지.'],
    recruit: '하하! 진짜 해냈네? 좋아, 이 여관이 내 항구야!',
    skill: { name: '해적의 셈', k: 'goldPct', v: 25 },
  },
  {
    key: 'jin', name: '진', title: '떠돌이 검객', charm: '흑발 상투 동양 검객 미남', kind: 'knight', race: 'human', hair: '#1c1c24',
    hint: '보스 앞에서 물러서지 않는 여관을 찾는 검객이 있대', rumor: '보스를 세 번 쓰러뜨린 여관에 떠돌이 검객이 들른다는데…',
    rumorWhen: (c) => c.topRankWeeks >= c.need(3), rumorText: '주간 토벌 랭킹 상위 30% 3회 (로그인 필요)',
    bond: ['blockSuccess'], bondText: '직접 조작 막기 성공',
    request: { text: '토벌 직접 조작에서 막기 5번 연속 성공', event: 'blockStreak5', need: 1 },
    intro: ['…검이 부딪히는 소리를 따라왔소.', '막는 법을 아는지 보여 주시오. 다섯 번, 연달아.'],
    recruit: '훌륭한 막기였소. 이 검, 당분간 이곳에 맡기겠소.',
    skill: { name: '일섬', k: 'atkPct', v: 14 },
  },
];

export const legendByKey = (k: string) => LEGENDS.find((l) => l.key === k);
