// 케미 짝 표: 처음엔 모두 ??? — 공개 5쌍(1단계의 직업 짝) + 숨은 12쌍.
// 짝은 "누구와 누구"가 아니라 "어떤 조합"이고, 친밀도(1~5단계)는 실제 두 손님 사이에 쌓인다.
import type { GuestKind, Race, Rarity } from './classes';

export interface Who {
  kind: GuestKind;
  race: Race;
  rarity: Rarity;
}

export interface ChemPair {
  id: string;
  name: string;
  /** 처음부터 짝 이름이 보이는가 (숨은 쌍은 발견 전까지 ???) */
  open: boolean;
  /** 이 조합인가 (순서 상관없이 검사한다) */
  match: (a: Who, b: Who) => boolean;
  /** 마을에서 마주쳤을 때 대사 [A, B] */
  meet: [string, string];
  /** 친밀도 2~5단계로 오를 때 짧은 대화 (A, B 번갈아) */
  talks: [string, string][];
  hint: string;
}

const cls = (x: GuestKind, y: GuestKind) => (a: Who, b: Who) => (a.kind === x && b.kind === y) || (a.kind === y && b.kind === x);
const race = (x: Race, y: Race) => (a: Who, b: Who) => (a.race === x && b.race === y) || (a.race === y && b.race === x);

export const CHEM_PAIRS: ChemPair[] = [
  // ── 공개 5쌍 (1단계의 직업 짝) ──
  {
    id: 'dwarf-rogue', name: '술친구', open: true, match: cls('dwarf', 'rogue'), meet: ['또 너야?', '술 한잔 어때?'], hint: '전사와 도적',
    talks: [['지난번 술값 네가 낸 거 맞지?', '…기억이 안 나는데?'], ['너 덕분에 함정에서 살았다', '도끼 값은 받을게~'], ['다음 원정도 같이 가자', '술은 네가 사!'], ['평생 술친구다', '평생 외상이다!']],
  },
  {
    id: 'knight-cleric', name: '수호의 맹세', open: true, match: cls('knight', 'cleric'), meet: ['오늘도 무사히.', '제가 지켜드릴게요!'], hint: '기사와 사제',
    talks: [['방패 뒤에 서요', '치유는 맡겨 주세요'], ['당신이 있어서 든든합니다', '저도요, 기사님'], ['이번엔 제가 먼저 막겠습니다', '그럼 전 먼저 기도할게요'], ['끝까지 함께하겠습니다', '맹세할게요']],
  },
  {
    id: 'mage-rogue', name: '사라진 지팡이', open: true, match: cls('mage', 'rogue'), meet: ['내 지팡이 어디 갔지?', '…몰라요?'], hint: '마법사와 도적',
    talks: [['지팡이 돌려줘', '빌린 거예요, 빌린 거'], ['이번엔 반지야?', '반짝여서 그만…'], ['네 손재주, 쓸 만하더라', '칭찬 맞죠?'], ['내 연구실 열쇠, 맡길게', '…진짜요?']],
  },
  {
    id: 'dwarf-knight', name: '강철 형제', open: true, match: cls('dwarf', 'knight'), meet: ['방패 좀 빌려줘', '갑옷이 더 단단해!'], hint: '전사와 기사',
    talks: [['누가 더 많이 막나 내기하자', '좋다!'], ['네 방패, 내가 손봤다', '고맙다, 형제'], ['앞줄은 우리 둘이면 충분해', '뒤는 걱정 마라'], ['강철은 녹슬지 않는다', '우리처럼!']],
  },
  {
    id: 'cleric-mage', name: '찻잔 친구', open: true, match: cls('cleric', 'mage'), meet: ['차 한잔 해요', '좋지요~'], hint: '사제와 마법사',
    talks: [['오늘은 허브차예요', '향이 좋네요'], ['마나가 다 떨어졌을 때 고마웠어요', '서로 돕는 거죠'], ['새 주문을 같이 연구해요', '책은 제가 가져올게요'], ['우리 찻잔, 이 여관에 두고 가요', '다시 올 테니까요']],
  },
  // ── 숨은 12쌍 ──
  {
    id: 'dwarf-elf', name: '앙숙에서 친구로', open: false, match: race('dwarf', 'elf'), meet: ['귀가 뾰족하군', '수염이 무성하네요'], hint: '수염과 뾰족 귀',
    talks: [['엘프는 맥주 맛을 몰라', '드워프는 숲 냄새를 모르죠'], ['…네 활, 나쁘지 않았다', '당신 도끼도요'], ['같이 한잔?', '이번만이에요'], ['우린 이제 친구다', '앙숙이었던 친구요']],
  },
  {
    id: 'rival', name: '라이벌', open: false, match: (a, b) => a.kind === b.kind, meet: ['또 너냐', '이번엔 내가 이긴다'], hint: '같은 직업 둘',
    talks: [['오늘 수련, 내가 더 많이 했다', '숫자 세는 게 수련이냐'], ['이번 원정은 네 덕이다', '…알면 됐어'], ['다음엔 같은 편으로 싸우자', '좋아, 대신 앞은 내가'], ['최고의 라이벌이다', '최고의 동료지']],
  },
  {
    id: 'cleric-rogue', name: '갱생 이야기', open: false, match: cls('cleric', 'rogue'), meet: ['또 뭘 훔쳤나요?', '안 훔쳤어요! …아직'], hint: '사제와 도적',
    talks: [['오늘은 착한 일 하나 해 봐요', '…빵 하나 나눠 줬어요'], ['당신 손은 남을 도울 수 있어요', '그런 말 처음 들어 봐요'], ['자물쇠 따는 법, 구조에 쓰면 어때요?', '…해 볼게요'], ['이제 당신은 우리 편이에요', '네, 진짜로요']],
  },
  {
    id: 'halfling-knight', name: '꼬마 기사단', open: false, match: (a, b) => (a.race === 'halfling' && b.kind === 'knight') || (b.race === 'halfling' && a.kind === 'knight'), meet: ['기사님 방패 커요!', '네가 작은 거란다'], hint: '작은 발과 큰 방패',
    talks: [['저도 기사가 될 수 있어요?', '마음만 크면 된단다'], ['방패 뒤에 숨어도 돼요?', '언제든지'], ['오늘은 제가 지켜 드릴게요!', '든든하구나'], ['꼬마 기사단 결성!', '단장은 너다']],
  },
  {
    id: 'elf-elf', name: '숲의 노래', open: false, match: race('elf', 'elf'), meet: ['바람에서 고향 냄새가 나', '같이 노래할까?'], hint: '뾰족 귀 둘',
    talks: [['고향 숲은 잘 있을까', '나무들이 기억할 거야'], ['이 마을에도 나무를 심자', '노래로 키우자'], ['너와 부르면 숲이 대답해', '진짜 들려'], ['여기가 우리의 새 숲이야', '노래가 끝나지 않는 곳']],
  },
  {
    id: 'human-halfling', name: '모험 동료', open: false, match: race('human', 'halfling'), meet: ['짐 들어 줄까?', '제 짐은 제가 들어요!'], hint: '키 큰 사람과 작은 사람',
    talks: [['길 잃으면 나 찾아', '제가 찾아갈 거예요'], ['간식 나눠 먹자', '두 번째 아침이에요!'], ['네 발은 빠르구나', '키는 작아도요'], ['다음 모험도 같이', '평생 같이요']],
  },
  {
    id: 'warrior-mage', name: '근육과 마법', open: false, match: cls('dwarf', 'mage'), meet: ['주문은 왜 이렇게 길어?', '도끼는 왜 그렇게 무거워요?'], hint: '전사와 마법사',
    talks: [['힘으로 안 되는 게 있더군', '마법으로 안 되는 것도요'], ['내가 앞을 막을게', '제가 뒤에서 태울게요'], ['너 주문 외울 때 지켜 주마', '든든하네요'], ['최강의 조합이다', '근육과 마법!']],
  },
  {
    id: 'legend-any', name: '전설의 그림자', open: false, match: (a, b) => a.rarity === 'legend' || b.rarity === 'legend', meet: ['당신이 그 전설…?', '그냥 여행자일 뿐이야'], hint: '전설과 누군가',
    talks: [['어떻게 그렇게 강해졌어요?', '매일 조금씩'], ['저도 전설이 될 수 있을까요', '이미 되어 가고 있어'], ['당신 이야기를 듣고 싶어요', '모닥불 앞에서 해 주지'], ['이제 네가 내 이야기의 일부다', '영광이에요']],
  },
  {
    id: 'halfling-halfling', name: '작은 발 클럽', open: false, match: race('halfling', 'halfling'), meet: ['두 번째 아침 먹었어?', '세 번째도!'], hint: '작은 발 둘',
    talks: [['파이 굽는 날이야', '난 잼 가져올게'], ['키 큰 사람들은 몰라', '식탁 밑의 즐거움을'], ['오늘은 우리가 원정 대장!', '간식 가방 챙겨!'], ['작은 발 클럽 영원히', '간식도 영원히']],
  },
  {
    id: 'dwarf-dwarf', name: '맥주 형제', open: false, match: race('dwarf', 'dwarf'), meet: ['수염 멋지군', '네 것도'], hint: '수염 둘',
    talks: [['고향 맥주가 그립다', '여기 것도 나쁘지 않아'], ['네 망치 소리, 듣기 좋더라', '네 노래도'], ['같이 대장간 차리자', '이름은 우리 수염으로'], ['맥주 형제여, 건배!', '건배!!']],
  },
  {
    id: 'elf-human', name: '두 세계', open: false, match: race('elf', 'human'), meet: ['인간은 참 바쁘게 사네요', '엘프는 너무 느긋해요'], hint: '엘프와 인간',
    talks: [['하루가 그렇게 짧나요?', '그래서 더 소중하죠'], ['당신 덕에 시간이 빨리 가요', '그건 칭찬이죠?'], ['당신 이야기를 오래 기억할게요', '제 손주한테도 해 주세요'], ['두 세계가 만났네요', '이 여관에서요']],
  },
  {
    id: 'cleric-warrior', name: '치유와 분노', open: false, match: cls('cleric', 'dwarf'), meet: ['또 다쳤어요?', '긁힌 거다!'], hint: '사제와 전사',
    talks: [['붕대 감을 테니 가만히 있어요', '…알았다'], ['왜 늘 앞에서 다쳐요?', '네가 뒤에 있으니까'], ['오늘은 안 다쳤네요', '네 기도 덕이다'], ['당신 분노는 제가 치유할게요', '네 미소는 내가 지킨다']],
  },
];

export const pairById = (id: string) => CHEM_PAIRS.find((p) => p.id === id);

/** 두 손님에게 맞는 짝 조합 (여러 개면 첫 번째). 공개 짝 우선 */
export function matchPair(a: Who, b: Who): ChemPair | undefined {
  return CHEM_PAIRS.find((p) => p.match(a, b));
}
