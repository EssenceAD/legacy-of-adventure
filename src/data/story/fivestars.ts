// FIVESTARS 대사 — 「다섯 별의 원정대」 — src/data/story/fivestars.ts
//
// ★ 지금 들어 있는 대사는 전부 자리만 잡아 둔 임시 문구다 (줄마다 「(임시)」). 형철이 같은 모양의 파일로 통째로 바꿔 넣는다.
//   실제 플레이 기록 숫자(플레이 시간 · 금화 · 강화 단계 등)는 넣지 않는다 — 성향만 은근히.
//
// 내보내는 모양 (형철 파일도 이 이름 · 이 모양 그대로 — 코드는 이것만 읽는다):
//   StarId                       'woongs' | 'gonu' | 'ikamolly' | 'walwal' | 'warmnight'
//   FIVE_CHAPTER                 { name: string; intro: string }                      장부 새 장 이름 · 장 머리 한 줄
//   FIVE_LETTER                  SLine[]                                              3막 편지 다음 모모 편지 (끝나면 장이 열린다)
//   FIVE_DREAM                   Record<StarId, string>                               2막부터 카메오 대사 끝에 한 줄 (복선)
//   FIVE_REQUEST                 Record<StarId, { title: string; text: string }>      장부 칸 제목 · 부탁 한마디 (진행 표시는 코드가 붙인다)
//   FIVE_JOIN                    Record<StarId, SLine[]>                              칸을 채우면: 찾아옴 → 신화 모습 → 합류 (짧게 3~5줄)
//   FIVE_SELF                    Record<StarId, string>                               본인 계정이면 합류 컷 끝에 한 줄 더
//   FIVE_FINAL                   SLine[]                                              다섯이 다 모였을 때 「다섯 별」 컷 (다섯이 한마디씩)
//   FIVE_SET_CUT                 string                                               세트 4명 첫 전투 1초 컷 글
//   FIVE_TITLE                   string                                               칭호 「다섯 별의 주인」
//   FIVE_SHARD                   string                                               별지기의 열쇠 조각 이름 (MYTHIC과 같은 주머니)
//
// SLine = [화자, 대사, { fx?, wait?, if? }?] (story/v1.ts) — 화자 키:
//   'post' 모모 · 'narr' 지문 · 'p_<id>' 개척자 카메오 초상 · 'star_<id>' 신화 모습 초상 · 'legend_oswin' 오스윈 · 'me' 주인
//   (그림이 아직 없으면 star_<id>는 카메오 초상으로, p_walwal은 사제 손님 초상으로 대신 보인다 — ui/fivestars.ts)
// fx: 'stars' 별가루 · 'fivestar' 무지갯빛 테두리 (화면 흔들림 없음)
import type { SLine } from './v1';

export type StarId = 'woongs' | 'gonu' | 'ikamolly' | 'walwal' | 'warmnight';

export const FIVE_CHAPTER = { name: '다섯 별의 원정대', intro: '(임시) 별 다섯 개가 다 다른 방향으로 떨어졌다. 다섯 여관 주인의 부탁을 들어 주자.' };

export const FIVE_LETTER: SLine[] = [
  ['post', '(임시) 주인님, 어젯밤 별 다섯 개가 한꺼번에 떨어졌어요. 다 다른 방향으로요.'],
  ['post', '(임시) 그런데요, 그 방향마다 우리 마을에 놀러 오던 여관 주인님들이 계세요. 이상하죠?', { fx: 'stars' }],
  ['narr', '(임시) 장부에 새 장 「다섯 별의 원정대」가 생겼다.', { fx: 'ledger' }],
];

export const FIVE_DREAM: Record<StarId, string> = {
  woongs: '(임시) …요즘 이상한 꿈을 꿔요. 제가 엄청 큰 칼을 들고 있더라고요?',
  gonu: '(임시) 꿈에서 저 그림자 속을 걸었어요. 손에 단검이… 붓 같았는데.',
  ikamolly: '(임시) 꿈속에서 바람이 길을 알려 줬어요. 지팡이 끝에서요.',
  walwal: '(임시) 밤길을 누군가와 같이 걷는 꿈을 꿨어요. 제가 다들 다치지 말라고 기도하고 있더라고요.',
  warmnight: '(임시) 꿈에서 등불 하나 들고 지도 끝까지 걸어갔어요. 활을 메고요.',
};

export const FIVE_REQUEST: Record<StarId, { title: string; text: string }> = {
  woongs: { title: '(임시) 무거운 대검', text: '(임시) 크게 강화한 장비를 낀 파티로 토벌 보스를 쓰러뜨려 줘. 대검은 무거울수록 좋거든!' },
  gonu: { title: '(임시) 아무도 못 본 것', text: '(임시) 구경거리 사건을 해결하고, 숨은 어울림을 새로 찾아 줘.' },
  ikamolly: { title: '(임시) 바람이 길을 계산했어', text: '(임시) 세트 장비 한 벌을 맞추고, 의뢰를 여러 번 성공시켜 줘.' },
  walwal: { title: '(임시) 밤길은 제가 책임질게요', text: '(임시) 밤에 떠난 원정대가 다치지 않고 돌아오게 해 주세요. 손님들에게 말도 걸어 주시고요.' },
  warmnight: { title: '(임시) 지도 끝까지 같이 걸어요', text: '(임시) 여러 지역을 고루 다녀오고, 텃밭도 챙겨 주세요.' },
};

const join = (id: StarId, name: string): SLine[] => [
  ['narr', `(임시) ${name}이(가) 여관 문을 열고 들어왔다. 어딘가 다른 눈빛이다.`, { fx: 'stars' }],
  [`p_${id}`, '(임시) 주인님… 꿈이 아니었어요. 다 기억났어요.'],
  ['narr', '(임시) 별가루가 흩날리고, 옷과 무기가 오래전 원정대의 모습으로 바뀌었다.', { fx: 'fivestar' }],
  [`star_${id}`, '(임시) 이번 생에도 같이 가요. 자리 하나 내 주실 거죠?'],
];
export const FIVE_JOIN: Record<StarId, SLine[]> = {
  woongs: join('woongs', '웅스'),
  gonu: join('gonu', '고느끼'),
  ikamolly: join('ikamolly', '이카몰리'),
  walwal: join('walwal', '왈왈콩선생'),
  warmnight: join('warmnight', '따뜻한밤'),
};

export const FIVE_SELF: Record<StarId, string> = {
  woongs: '(임시) …잠깐, 이거 거울이야?',
  gonu: '(임시) …어? 이 사람, 나랑 똑같이 생겼는데?',
  ikamolly: '(임시) …계산에 없던 일이네요. 저잖아요?',
  walwal: '(임시) …어라? 이분, 어디서 많이 뵌 분인데…?',
  warmnight: '(임시) …등불까지 똑같네. 나 맞지?',
};

export const FIVE_FINAL: SLine[] = [
  ['narr', '(임시) 그날 밤, 다섯이 처음으로 한자리에 섰다.', { fx: 'stars' }],
  ['star_woongs', '(임시) 다 모였네! 한 번 더 가자!'],
  ['star_gonu', '(임시) 다들 못 본 거, 내가 먼저 봤어.'],
  ['star_ikamolly', '(임시) 길은 계산해 뒀어요.'],
  ['star_walwal', '(임시) 다치면 제가 고쳐 드릴게요. 걱정 마세요.'],
  ['star_warmnight', '(임시) 등불은 내가 들게. 끝까지.'],
  ['narr', '(임시) 밤하늘에 별 다섯 개가 이어져 별자리가 되었다. 이제 밤마다 보인다.', { fx: 'fivestar' }],
];

export const FIVE_SET_CUT = '(임시) 다섯 별';
export const FIVE_TITLE = '다섯 별의 주인';
export const FIVE_SHARD = '다섯 별의 조각';
