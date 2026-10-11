// 5단계 4장: 업적 60개 (첫 ○○, ○○ 100번 …) — 보상 금화·가루·칭호. 숨김 업적은 장부 7장(유산의 시작)에서 모두 보인다
export interface AchCtx {
  get: (k: AchStat) => number;
}
export type AchStat =
  | 'expeditions' | 'wins' | 'huntBest' | 'huntClears' | 'raidTries' | 'bossKills' | 'regulars' | 'heroes' | 'chem' | 'dexGuests' | 'dexItems'
  | 'enhance' | 'crafted' | 'harvests' | 'meals' | 'gold' | 'land' | 'stars' | 'ties5' | 'endings' | 'attend' | 'guide' | 'gifts' | 'shop' | 'talks' | 'grade' | 'harmony' | 'events' | 'evalBest' | 'innLv';

export interface AchDef {
  id: string;
  name: string;
  desc: string;
  stat: AchStat;
  need: number;
  reward: { gold?: number; dust?: number; title?: string };
  /** 숨김: 이룰 때까지(또는 장부 7장까지) ??? */
  hidden?: boolean;
}

const A = (id: string, name: string, desc: string, stat: AchStat, need: number, reward: AchDef['reward'], hidden = false): AchDef => ({ id, name, desc, stat, need, reward, hidden });

export const ACHIEVEMENTS: AchDef[] = [
  // 원정 (6)
  A('exp1', '첫 원정', '원정을 처음 보내요', 'expeditions', 1, { gold: 100 }),
  A('exp10', '게시판 단골', '원정 10번 보내기', 'expeditions', 10, { gold: 300 }),
  A('exp100', '의뢰 중개인', '원정 100번 보내기', 'expeditions', 100, { gold: 1500, title: '의뢰 중개인' }),
  A('exp500', '원정의 달인', '원정 500번 보내기', 'expeditions', 500, { gold: 5000, dust: 300 }, true),
  A('win10', '돌아온 영웅들', '원정 10번 성공', 'wins', 10, { gold: 300 }),
  A('win100', '백전백승', '원정 100번 성공', 'wins', 100, { gold: 2000, title: '백전의 여관' }),
  // 사냥 (7)
  A('hunt1', '첫 사냥', '사냥 스테이지를 처음 돌파', 'huntBest', 1, { gold: 100 }),
  A('hunt10', '숲의 사냥꾼', '사냥 10스테이지 돌파 (지역 합)', 'huntBest', 10, { gold: 500, dust: 50 }),
  A('hunt25', '늪 건너기', '사냥 25스테이지 돌파', 'huntBest', 25, { gold: 1500 }),
  A('hunt50', '모든 길의 끝', '사냥 50스테이지 모두 돌파', 'huntBest', 50, { gold: 8000, dust: 500, title: '사냥의 왕' }, true),
  A('hc50', '부지런한 사냥', '사냥 50판', 'huntClears', 50, { gold: 400 }),
  A('hc300', '쉬지 않는 활', '사냥 300판', 'huntClears', 300, { gold: 1500 }),
  A('hc2000', '전설의 사냥터', '사냥 2000판', 'huntClears', 2000, { gold: 6000, title: '끝없는 사냥꾼' }, true),
  // 토벌 (6)
  A('raid1', '첫 토벌', '주간 보스에 처음 도전', 'raidTries', 1, { gold: 200 }),
  A('raid30', '보스 사냥 단골', '토벌 30번 도전', 'raidTries', 30, { gold: 1200 }),
  A('raid100', '토벌대장', '토벌 100번 도전', 'raidTries', 100, { gold: 4000, title: '토벌대장' }),
  A('kill1', '거인 쓰러뜨리기', '보스를 처음 처치', 'bossKills', 1, { gold: 800 }),
  A('kill5', '다섯 머리', '보스 5번 처치', 'bossKills', 5, { gold: 2500, dust: 200 }),
  A('kill20', '보스의 악몽', '보스 20번 처치', 'bossKills', 20, { gold: 8000, title: '보스의 악몽' }, true),
  // 손님·영웅 (9)
  A('reg3', '첫 파티', '단골 3명', 'regulars', 3, { gold: 150 }),
  A('reg6', '북적이는 여관', '단골 6명', 'regulars', 6, { gold: 600 }),
  A('reg10', '모험가의 둥지', '단골 10명', 'regulars', 10, { gold: 2000, title: '둥지지기' }),
  A('hero1', '첫 영웅', '영웅·전설 1명 영입', 'heroes', 1, { gold: 500 }),
  A('hero5', '영웅의 숙소', '영웅·전설 5명', 'heroes', 5, { gold: 2000 }),
  A('hero15', '전설이 머무는 곳', '영웅·전설 15명', 'heroes', 15, { gold: 6000, title: '전설의 집주인' }, true),
  A('chem1', '첫 케미', '케미 짝 1쌍 발견', 'chem', 1, { gold: 200 }),
  A('chem5', '중매쟁이', '케미 짝 5쌍', 'chem', 5, { gold: 1000, title: '중매쟁이' }),
  A('talk20', '수다쟁이 주인', '손님에게 20번 말 걸기', 'talks', 20, { gold: 300 }),
  // 도감 (5)
  A('dg10', '손님 기록가', '손님 도감 10칸', 'dexGuests', 10, { gold: 300 }),
  A('dg30', '손님 박사', '손님 도감 30칸', 'dexGuests', 30, { gold: 1200 }),
  A('dg60', '모든 얼굴', '손님 도감 60칸 (전부)', 'dexGuests', 60, { gold: 5000, title: '손님 박사' }, true),
  A('di20', '장비 수집가', '아이템 도감 20칸', 'dexItems', 20, { gold: 500 }),
  A('di60', '보물 창고', '아이템 도감 60칸', 'dexItems', 60, { gold: 3000, title: '보물 창고지기' }),
  // 대장간·텃밭·주점 (9)
  A('enh3', '첫 망치질', '장비 +3 강화', 'enhance', 3, { dust: 30 }),
  A('enh7', '불꽃 장인', '장비 +7 강화', 'enhance', 7, { dust: 150 }),
  A('enh10', '전설의 대장장이', '장비 +10 강화', 'enhance', 10, { dust: 500, title: '전설의 대장장이' }, true),
  A('cr1', '첫 작품', '세트 장비 1부위 제작', 'crafted', 1, { gold: 300 }),
  A('cr20', '세트 장인', '세트 장비 20부위 제작', 'crafted', 20, { gold: 2500 }),
  A('hv10', '초보 농부', '텃밭 10번 수확', 'harvests', 10, { gold: 300 }),
  A('hv100', '풍년', '텃밭 100번 수확', 'harvests', 100, { gold: 1500, title: '풍년 농부' }),
  A('ml100', '스튜 백 그릇', '주점 식사 100번', 'meals', 100, { gold: 400 }),
  A('ml1000', '미식의 여관', '주점 식사 1000번', 'meals', 1000, { gold: 3000, title: '스튜 장인' }),
  // 여관 성장 (10)
  A('g10k', '첫 금고', '금화 누적 1만', 'gold', 10_000, { gold: 500 }),
  A('g100k', '부자 여관', '금화 누적 10만', 'gold', 100_000, { gold: 3000 }),
  A('g1m', '황금 여관', '금화 누적 100만', 'gold', 1_000_000, { gold: 20000, title: '황금 여관주인' }, true),
  A('land3', '울타리 밀기', '땅 3단계', 'land', 3, { gold: 500 }),
  A('land5', '최대 크기', '땅 5단계', 'land', 5, { gold: 3000, title: '대지주' }),
  A('star3', '별 셋', '평판 ★3', 'stars', 3, { gold: 1000 }),
  A('star5', '별 다섯 여관', '평판 ★5', 'stars', 5, { gold: 6000, title: '별 다섯 여관' }),
  A('gr2', '이제는 마을', '마을 등급 「마을」', 'grade', 2, { gold: 1000 }),
  A('gr4', '도시의 여관', '마을 등급 「도시」', 'grade', 4, { gold: 5000, title: '도시의 주인' }),
  A('guide40', '장부를 덮다', '버나드의 장부 40개 완료', 'guide', 40, { gold: 5000, dust: 300, title: '장부의 후계자' }),
  // 주인·인연·유산 (6)
  A('gift10', '선물하는 주인', '선물 10번', 'gifts', 10, { gold: 300 }),
  A('ties1', '평생의 인연', '인연 5단계 1명', 'ties5', 1, { gold: 1500, title: '맺어진 인연' }),
  A('ties5', '인연 부자', '인연 5단계 5명', 'ties5', 5, { gold: 5000 }, true),
  A('end1', '첫 엔딩', '엔딩 1개 보기', 'endings', 1, { gold: 1000, title: '유산을 남긴 자' }),
  A('end10', '이야기 수집가', '엔딩 10개 보기', 'endings', 10, { gold: 6000 }, true),
  // 베타: 어울림 · 평가단 · 구경거리 (8)
  A('harm1', '첫 어울림', '어울림 1개 발견', 'harmony', 1, { gold: 200 }),
  A('harm6', '배치의 감', '어울림 6개 발견', 'harmony', 6, { gold: 800 }),
  A('harm12', '마을 설계가', '어울림 12개 발견', 'harmony', 12, { gold: 2000, title: '마을 설계가' }),
  A('harm24', '완벽한 조화', '어울림 24개 모두 발견', 'harmony', 24, { gold: 8000, dust: 500, title: '조화의 여관' }, true),
  A('evt10', '구경꾼 사절', '구경거리 사건 10번 해결', 'events', 10, { gold: 500 }),
  A('evt50', '마을의 해결사', '구경거리 사건 50번 해결', 'events', 50, { gold: 2500, title: '마을의 해결사' }),
  A('eval1', '평가단의 눈', '여관 평가단 브론즈', 'evalBest', 1, { gold: 500 }),
  A('eval3', '안내서의 별', '여관 평가단 골드', 'evalBest', 3, { gold: 3000, title: '안내서의 별' }),
  // 출석·상점 (3)
  A('att7', '일주일 개근', '출석 7일', 'attend', 7, { gold: 500 }),
  A('att28', '한 달 개근', '출석 28일', 'attend', 28, { gold: 3000, title: '개근 여관주인' }),
  A('shop10', '단골 손님(상점)', '상점에서 10번 사기', 'shop', 10, { gold: 300 }),
  // 땅 개편: 여관을 계속 키우는 맛
  A('inn5', '종탑이 선 여관', '여관 본관 Lv.5', 'innLv', 5, { gold: 1500 }),
  A('inn10', '전설의 여관', '여관 본관 Lv.10', 'innLv', 10, { gold: 8000, title: '전설의 여관주인' }),
];
