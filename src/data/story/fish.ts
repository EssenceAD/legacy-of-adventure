// GROWTH §4 연못 낚시 — 물고기 20종 (마을 연못 10 · 등대 해안 10). 아이콘: asset_raw/fish/{id}.png
// grade: n 흔함 · r 희귀 · e 영웅 · l 전설 / size: [최소, 최대] cm / win: 판정 창(초) / time: 잘 잡히는 때(없으면 아무 때)
// use: cook(주점 요리 재료) · gift(선물로 줄 수 있음) · trophy(박제 장식) / like: 이걸 좋아하는 인물(bond id)
export interface FishDef {
  id: string; name: string; where: 'pond' | 'sea'; grade: 'n' | 'r' | 'e' | 'l';
  size: [number, number]; win: number; time?: 'day' | 'night' | 'dawn'; price: number;
  use: ('cook' | 'gift' | 'trophy')[]; like?: string[]; text: string;
}

export const FISH: FishDef[] = [
  // ── 마을 연못 ──
  { id: 'minnow', name: '송사리', where: 'pond', grade: 'n', size: [3, 6], win: 0.6, price: 5, use: ['cook'], text: '연못의 터줏대감. 셀 수 없이 많다.' },
  { id: 'crucian', name: '황금 붕어', where: 'pond', grade: 'n', size: [12, 25], win: 0.6, price: 15, use: ['cook', 'gift'], like: ['luna'], text: '비늘이 노을빛. 구워 먹으면 고소하다.' },
  { id: 'koi', name: '비단잉어', where: 'pond', grade: 'r', size: [30, 60], win: 0.5, price: 60, use: ['gift'], like: ['leon', 'scarlet'], text: '주인장이 연못을 아낄수록 색이 진해진다는 소문.' },
  { id: 'catfish', name: '수염 메기', where: 'pond', grade: 'r', size: [35, 80], win: 0.5, time: 'night', price: 50, use: ['cook', 'gift'], like: ['grom'], text: '밤에만 수염을 쓰다듬으며 나온다.' },
  { id: 'loach', name: '푸른 미꾸라지', where: 'pond', grade: 'n', size: [8, 15], win: 0.55, price: 10, use: ['cook'], text: '손에서 쏙 빠져나간다. 낚아도 빠져나간다.' },
  { id: 'lotusfish', name: '연꽃 물고기', where: 'pond', grade: 'r', size: [10, 20], win: 0.45, time: 'dawn', price: 70, use: ['gift'], like: ['aria', 'sylas'], text: '연꽃이 필 때만 지느러미를 편다.' },
  { id: 'mudskipper', name: '통통 망둥이', where: 'pond', grade: 'n', size: [8, 14], win: 0.6, price: 8, use: ['cook', 'gift'], like: ['twins'], text: '물 밖에서도 잘 뛰어다닌다. 렌·린이 좋아한다.' },
  { id: 'moontrout', name: '달무늬 송어', where: 'pond', grade: 'e', size: [40, 70], win: 0.4, time: 'night', price: 180, use: ['cook', 'gift'], like: ['vael'], text: '보름달 아래에서만 무늬가 빛난다.' },
  { id: 'firefly', name: '반딧불 물고기', where: 'pond', grade: 'e', size: [4, 8], win: 0.35, time: 'night', price: 150, use: ['gift', 'trophy'], like: ['momo'], text: '물속의 반딧불. 모모가 몰래 이름을 붙여 줬다.' },
  { id: 'kingkoi', name: '왕관 쓴 황금 잉어', where: 'pond', grade: 'l', size: [90, 140], win: 0.3, price: 1200, use: ['trophy'], text: '연못의 왕. 백 년에 한 번 수면 위로 올라와 주인장을 본다고 한다.' },
  // ── 등대 해안 ──
  { id: 'sardine', name: '줄무늬 정어리', where: 'sea', grade: 'n', size: [10, 18], win: 0.6, price: 10, use: ['cook'], text: '떼로 다닌다. 한 마리 낚으면 열 마리가 구경 온다.' },
  { id: 'seabream', name: '붉은 도미', where: 'sea', grade: 'r', size: [30, 55], win: 0.5, price: 80, use: ['cook', 'gift'], like: ['harald', 'oswin'], text: '잔칫날 생선. 결혼식 상에 꼭 오른다.' },
  { id: 'mackerel', name: '푸른 고등어', where: 'sea', grade: 'n', size: [25, 40], win: 0.55, price: 20, use: ['cook', 'gift'], like: ['brok'], text: '등은 바다색, 배는 하늘색.' },
  { id: 'puffer', name: '가시 복어', where: 'sea', grade: 'r', size: [12, 25], win: 0.45, price: 60, use: ['gift'], like: ['pip'], text: '화나면 부풀어 오른다. 핍이 「나 같아!」라며 좋아한다.' },
  { id: 'babyocto', name: '아기 문어', where: 'sea', grade: 'r', size: [15, 30], win: 0.5, price: 55, use: ['cook'], text: '낚싯줄을 여덟 개 손으로 붙잡고 안 놓는다.' },
  { id: 'flounder', name: '납작 가자미', where: 'sea', grade: 'n', size: [20, 40], win: 0.55, price: 18, use: ['cook'], text: '모래인 척하는 게 특기.' },
  { id: 'eel', name: '찌릿 뱀장어', where: 'sea', grade: 'e', size: [60, 110], win: 0.4, time: 'night', price: 200, use: ['cook', 'gift'], like: ['morga'], text: '낚는 순간 손이 저릿하다. 모르가가 주문 재료로 탐낸다.' },
  { id: 'lanternfish', name: '등대 초롱아귀', where: 'sea', grade: 'e', size: [20, 35], win: 0.35, time: 'night', price: 220, use: ['gift', 'trophy'], like: ['nyx'], text: '머리 위 초롱으로 밤바다 길을 안다.' },
  { id: 'flyingfish', name: '무지개 날치', where: 'sea', grade: 'e', size: [25, 40], win: 0.35, time: 'day', price: 210, use: ['gift'], like: ['nova', 'lira'], text: '물 위로 날아오를 때 무지개가 생긴다.' },
  { id: 'starwhale', name: '아기 별고래', where: 'sea', grade: 'l', size: [150, 220], win: 0.28, time: 'night', price: 2000, use: ['trophy'], text: '등에 별이 박힌 아기 고래. 낚으면 꼭 놓아주고 싶어진다. (놓아주면 다음 날 모모 편지)' },
];

// 낚시 대사 (한 줄 토스트·말풍선)
export const FISH_LINES = {
  bite: ['찌가 흔들린다…!', '뭔가 문다!', '!'],
  miss: ['놓쳤다!', '앗, 미끼만 먹고 갔다…', '물고기가 웃으면서 가는 것 같다.'],
  legend: '수면이 금빛으로 일렁였다…!',
  release: '…잘 가. 엄마한테 가.',
  whaleLetter: ['post', '주인님, 오늘 아침 바다에서 고래 노랫소리가 들렸대요. 어부 아저씨들이 그러는데, 누가 고래를 놓아준 날에만 들리는 소리래요.'] as [string, string],
};
