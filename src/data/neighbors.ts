// 이웃 마을 (지금은 가짜 데이터 — 나중에 서버에서 받아온다)
// 그릴 때 world/town.ts의 placeLayout()이 내 마을과 같은 배치 검사를 한 번 더 한다.
import type { Kind } from './catalog';
import { CONFIG } from './config';

export interface Neighbor {
  id: string;
  /** 실제 유저 마을이면 그 사람 id (3단계 2차) */
  uid?: string;
  /** 대표 영웅 초상화 키 */
  repHero?: string | null;
  /** LUXE §1-3: 대표 영웅이 입은 의상 id (없으면 기본 옷) */
  repOutfit?: string | null;
  /** 5단계 마을 등급 (0 오두막 ~ 4 도시) · 주인 칭호 */
  grade?: number;
  title?: string;
  name: string;
  owner: string;
  land: number;
  like: number;
  /** FEEDBACK23 §5: 옮긴 마을 입구 x (없으면 자동) */
  ent?: number;
  /** LUXE §2: 그 마을에 꺼내 둔 펫 id (최대 3 · 플래그 pets가 켜졌을 때만 그린다) */
  pets?: string[];
  /** [종류, x, y, 레벨, 지붕 hue, 좌우 반전] */
  layout: [Kind, number, number, number?, (number | null)?, boolean?][];
}

// LAND2 (맵 32): 땅 s단계 = [from, 30) — from = 22·19·16·12·8·4·0. 던전은 (29,18) 3×3 고정 (땅 오른쪽 앞 가장자리).
//  LAND10: 아래 좌표는 그대로 (맵 32 기준) — 맨 아래 toV4가 +12 (땅 [from+12, 42) · 던전 (41,30))
// SHOWCASE: 「와, 나도 이렇게 꾸미고 싶다」 — 예시 마을 5곳은 같은 규칙으로 꾸민다 (SHOWCASE_SPEC §0)
//  초점 하나 · 입구(앞 가장자리 y=29) → 여관 큰길 하나 + 구역으로 갈라지는 오솔길 · 울타리로 감싼 구역 3~4개(문 하나씩)
//  · 가운데 촘촘 가장자리 성기게 · 나무 액자(입구 쪽은 열기) · 빈 잔디 20%+ · 이야기 장면 4~5개 · 지붕 hue 하나 · 조명 12+
//  길은 건물 문 → 여관 문으로 저절로 깔리므로(rebuildPaths) 건물 자리와 빈 통로(울타리 틈)로 길 모양을 잡는다.
type Entry = Neighbor['layout'][number];
/** 울타리·담 한 줄 — y 고정(화면 오른쪽 아래로 뻗음). 산울타리·돌담·흰 울타리·장미 아치 그림은 x 고정 방향이 기본이라 반전 */
const rowX = (k: Kind, y: number, xs: number[]): Entry[] => xs.map((x) => [k, x, y, 1, null, true]);
/** 울타리·담 한 줄 — x 고정(화면 왼쪽 아래로 뻗음) */
const rowY = (k: Kind, x: number, ys: number[]): Entry[] => ys.map((y) => [k, x, y]);
/** a~b (빼는 칸 skip) */
const span = (a: number, b: number, skip: number[] = []) => Array.from({ length: b - a + 1 }, (_, i) => a + i).filter((v) => !skip.includes(v));
/** 나무·꽃 줄: 종류를 돌려 가며 (반복은 리듬으로) */
const cycle = (kinds: Kind[], at: [number, number][]): Entry[] => at.map(([x, y], i) => [kinds[i % kinds.length], x, y]);
const alongX = (y: number, xs: number[]) => xs.map((x) => [x, y] as [number, number]);
const alongY = (x: number, ys: number[]) => ys.map((y) => [x, y] as [number, number]);

const MOON: Neighbor = {
  // 쇼케이스 (땅 7단계 30×30 · 남색 265 · 남색·은색·흰 꽃 · 소나무·벚나무): 입구(14,29) → 큰길 x=14 → 중앙 광장 별빛 정원(둘레 길) → 여관 본관
  //  구역: 뒤 왼쪽 별채 주택가(산울타리 · 흰 울타리 문) · 뒤 오른쪽 공방 골목(돌담 · 흰 울타리 문) · 앞 왼쪽 연못 정원(산울타리 · 장미 아치) · 앞 오른쪽 주점 마당(흰 울타리 · 장미 아치)
  //  + 광장 동쪽 달맞이 뜰(정자 · 흰 꽃)
  //  장면: ① 광장 서쪽 가로등 아래 장미 벤치 + 고양이 상자 ② 텃밭 + 수확 수레 + 허수아비 ③ 공방 골목 화로 + 술통 더미 + 과녁 ④ 연못가 아치 다리 + 새 물그릇 ⑤ 시계탑 앞 이정표 + 꽃 수레
  id: 'moon', name: '달빛 쉼터', owner: '엘린느', land: 7, like: 1240, grade: 4,
  layout: [
    ['inn', 12, 4, 8, 265], ['dungeon', 29, 18],
    // 중앙 광장: 별빛 정원(초점) · 둘레 한 칸은 길 · 모서리 쌍가로등 · 흰 꽃
    ['star_garden', 13, 14], ['double_lamp', 11, 13], ['double_lamp', 17, 13], ['double_lamp', 11, 17], ['double_lamp', 17, 17],
    ['flowerbed', 12, 12], ['flowerbed', 16, 12], ['flowerbed', 12, 18], ['flowerbed', 16, 18], ['tulip_box', 11, 14], ['tulip_box', 11, 16], ['tulip_box', 17, 14], ['tulip_box', 17, 16],
    // 여관 앞 큰길
    ['double_lamp', 13, 10], ['double_lamp', 15, 10], ['topiary', 13, 11], ['topiary', 15, 11],
    // 달맞이 뜰 (광장 동쪽): 정자 + 흰 꽃
    ['gazebo', 19, 14], ['rose_bench', 19, 16], ['tulip_box', 21, 14], ['tulip_box', 21, 15], ['lamppost', 21, 16],
    // 공방 골목 돌담 앞 나무 줄
    ...cycle(['pine', 'cherry', 'pine'], alongX(13, span(23, 28))),
    ['flowerbed', 24, 14], ['flowerbed', 26, 15], ['flowerbed', 25, 16], ['well', 27, 15], ['bench', 23, 15],
    // ① 가로등 아래 장미 벤치 + 고양이 상자
    ['lamppost', 8, 14], ['rose_bench', 8, 15], ['cat_crate', 7, 15], ['flowerbed', 8, 16], ['tulip_box', 7, 17],
    // 주택가 산울타리 앞 나무 줄
    ...cycle(['cherry', 'pine', 'pine'], alongX(12, [1, 2, 3, 5, 6, 7, 9])),
    // 큰길 남쪽: 튤립 ×3 → 가로등 → 꽃 ×2 → 쌍가로등 (양쪽 엇갈려)
    ['tulip_box', 13, 19], ['tulip_box', 13, 20], ['tulip_box', 13, 21], ['lamppost', 13, 22], ['flowerbed', 13, 24], ['flowerbed', 13, 25], ['double_lamp', 13, 26],
    ['double_lamp', 15, 20], ['tulip_box', 15, 21], ['tulip_box', 15, 22], ['lamppost', 15, 27], ['flowerbed', 13, 28], ['flowerbed', 12, 28],
    // 입구: 정문 + 쌍가로등 둘 + 이정표
    ['gate', 14, 28], ['double_lamp', 13, 29], ['double_lamp', 16, 29], ['signpost', 16, 28],
    // ⑤ 시계탑 앞 이정표 + 꽃 수레
    ['clock_tower', 16, 23], ['signpost', 15, 23], ['flower_cart', 16, 22], ['tulip_box', 17, 24],
    // 별채 주택가 (뒤 왼쪽) — ② 텃밭 + 수확 수레 + 허수아비
    ['cottage', 2, 2, 1, 265], ['cottage', 5, 2, 1, 265], ['cottage', 8, 2, 1, 265], ['cottage', 6, 6, 1, 265], ['cottage', 9, 6, 1, 265],
    ['garden', 2, 6], ['hay_scarecrow', 1, 7], ['harvest_cart', 5, 8], ['pumpkins', 1, 9], ['beehives', 1, 4], ['dog_house', 10, 4], ['lamppost', 4, 5], ['lamppost', 8, 9], ['flowerbed', 7, 4], ['chicken_coop', 4, 10],
    ...rowX('hedge', 11, span(1, 10)), ['picket_gate', 11, 10], ['hedge', 11, 11],
    // 공방 골목 (뒤 오른쪽) — ③ 화로 + 술통 더미 + 과녁
    ['smith', 20, 2, 1, 265], ['alchemy', 24, 2, 1, 265], ['training', 20, 7], ['tower', 26, 7, 1, 265],
    ['barrel_stack', 23, 2], ['barrel_stack', 23, 3], ['brazier', 23, 4], ['target', 24, 8], ['target', 24, 9], ['banner', 19, 2], ['lamppost', 19, 6], ['brazier', 28, 4], ['double_lamp', 25, 10],
    ['barrels', 27, 2], ['banner', 28, 6], ['board', 23, 9], ['pine', 28, 10],
    ...rowY('stonewall2', 18, span(1, 8)), ['picket_gate', 18, 10], ['stonewall2', 18, 11], ...rowX('stonewall2', 12, span(19, 28)),
    // 연못 정원 (앞 왼쪽) — ④ 연못가 아치 다리 + 새 물그릇 · 예배당
    ['koi_pond', 3, 21], ['foot_bridge', 5, 21], ['lily_pond', 6, 21], ['bird_bath', 5, 23], ['rose_bench', 3, 23], ...cycle(['pine', 'cherry'], alongX(20, span(1, 8))), ['flowerbed', 7, 23], ['flowerbed', 6, 24],
    ['chapel', 3, 25, 1, null, true], ['lamppost', 9, 22], ['lamppost', 9, 26], ['tulip_box', 4, 24], ['flowerbed', 2, 28], ['tulip_box', 1, 21],
    ...rowX('hedge', 19, span(1, 8)), ['rose_arch', 9, 19, 1, null, true], ...rowY('hedge', 11, span(19, 29)),
    // 주점 마당 (앞 오른쪽) — 모닥불 둘레 벤치
    ['tavern', 21, 21, 4, 265], ['string_lights', 20, 24], ['string_lights', 25, 24], ['barrel_stack', 25, 21], ['barrel_stack', 25, 22], ['bench', 20, 22], ['windmill', 26, 26], ['fruit_stall', 21, 27], ['stall', 22, 27],
    ['fire', 27, 23], ['bench', 28, 23], ['bench', 27, 22],
    ...rowX('picket_gate', 19, span(18, 28)), ...rowY('picket_gate', 18, [20, 21, 22, 23, 26, 27, 28]), ['rose_arch', 18, 24],
    // 나무 액자: 뒤쪽 두 가장자리 (소나무·벚나무 — 남색·은색 테마라 주황 잎 나무는 쓰지 않는다) · 앞쪽은 성기게
    ...cycle(['pine', 'pine', 'cherry'], [...alongX(0, span(0, 29)), ...alongY(0, span(1, 29))]),
    ...cycle(['pine', 'cherry'], [...alongX(29, [3, 6, 9, 20, 27]), ...alongY(29, [3, 6, 10, 14, 23, 27])]),
  ],
};

const PETAL: Neighbor = {
  // 꽃잎 언덕 (땅 6단계 26×26 · 분홍 330 · 분홍·흰색·연두 · 벚나무): 장미 아치 대문(16,29) → 큰길 x=16 꽃길 → 연꽃 연못 위 무지개 다리(초점) → 여관
  //  구역: 뒤 왼쪽 별채(산울타리 · 흰 울타리 문) · 뒤 오른쪽 예배당 꽃 정원(흰 울타리 · 장미 아치) · 앞 왼쪽 꽃밭 언덕(산울타리 · 장미 아치) · 앞 오른쪽 벌통 텃밭(흰 울타리 · 문)
  //  + 다리 동쪽 벚꽃 뜰
  //  장면: ① 꽃밭 가운데 피크닉 + 그네 ② 예배당 꽃 정원 + 여신상 ③ 벌통 + 새집 + 꽃밭 ④ 장미 아치 터널(아치 3개 연속) ⑤ 꽃 수레 + 튤립 화단 줄
  id: 'petal', name: '꽃잎 언덕', owner: '로즈마리', land: 6, like: 640, grade: 3,
  layout: [
    ['inn', 14, 7, 5, 330], ['dungeon', 29, 18],
    // 초점: 연꽃 연못 두 개 사이 무지개 다리 + 다리 양끝 장미 아치
    ['lily_pond', 19, 16], ['rainbow_bridge', 19, 18], ['lily_pond', 19, 19], ['rose_arch', 18, 18], ['rose_arch', 21, 18],
    ['flowerbed', 21, 16], ['tulip_box', 21, 17], ['tulip_box', 21, 19], ['flowerbed', 21, 20], ['flowerbed', 18, 16], ['flowerbed', 18, 20], ['cherry', 22, 15], ['cherry', 22, 21],
    // 큰길 꽃길: 꽃 ×3 → 가로등 (양쪽 엇갈려) · 틈(14·22·26)으로 오솔길이 갈라진다
    ['double_lamp', 15, 13], ['flowerbed', 15, 14], ['tulip_box', 15, 15], ['flowerbed', 15, 16], ['lamppost', 15, 18], ['tulip_box', 15, 19], ['flowerbed', 15, 20], ['tulip_box', 15, 23], ['double_lamp', 15, 24], ['flowerbed', 15, 25], ['tulip_box', 15, 27],
    ['tulip_box', 17, 13], ['double_lamp', 17, 15], ['flowerbed', 17, 21], ['lamppost', 17, 22], ['tulip_box', 17, 23], ['flowerbed', 17, 24], ['double_lamp', 17, 27],
    // 꽃길 양옆 한 줄 더 (흐드러지게) · 오솔길 자리(14,22 · 17~18,26 · 18,27)는 비움
    ...cycle(['flowerbed', 'tulip_box', 'flowerbed', 'tulip_box'], [[14, 13], ...alongY(14, [14, 15, 16, 18, 19, 20, 21, 23, 24, 26, 27]), [15, 17], [15, 21], [15, 28]]), ['cherry', 14, 17], ['cherry', 14, 25],
    ...cycle(['tulip_box', 'flowerbed', 'flowerbed', 'tulip_box'], [...alongY(17, [14, 16, 17, 18, 19, 20, 25]), ...alongY(18, [13, 14, 15, 17, 19, 21, 22, 23, 24, 25])]),
    // 장미 아치 대문 + 쌍가로등 둘 + 이정표
    ['rose_arch', 15, 29, 1, null, true], ['rose_arch', 17, 29, 1, null, true], ['double_lamp', 14, 29], ['double_lamp', 18, 29], ['signpost', 14, 28],
    // 별채 (뒤 왼쪽)
    ['cottage', 6, 6, 1, 330], ['cottage', 9, 6, 1, 330], ['cottage', 6, 10, 1, 330], ['cottage', 9, 10, 1, 330],
    ['flowerbed', 5, 8], ['tulip_box', 8, 6], ['tulip_box', 8, 7], ['flowerbed', 5, 12], ['lamppost', 11, 9], ['cherry', 12, 6], ['flowerbed', 12, 7], ['tulip_box', 8, 11],
    ...rowY('hedge', 13, span(5, 10)), ['picket_gate', 13, 11], ...rowY('hedge', 13, [13, 14, 15]), ...rowX('hedge', 14, span(5, 12)),
    // 예배당 꽃 정원 (뒤 오른쪽) — ② 여신상
    ['chapel', 23, 7], ['statue', 24, 12], ['tulip_box', 22, 7], ['tulip_box', 22, 8], ['flowerbed', 22, 9], ['tulip_box', 26, 7], ['tulip_box', 26, 8], ['flowerbed', 26, 9],
    ['flowerbed', 23, 12], ['flowerbed', 25, 12], ['cherry', 27, 11], ['cherry', 21, 6], ['lamppost', 21, 11], ['double_lamp', 26, 11],
    ...rowY('picket_gate', 19, span(5, 10)), ['rose_arch', 19, 11], ['picket_gate', 19, 13], ...rowX('picket_gate', 14, span(20, 28)),
    // 벚꽃 뜰 (다리 동쪽)
    ['cherry', 24, 16], ['cherry', 26, 15], ['cherry', 27, 18], ['cherry', 24, 20], ['cherry', 28, 20], ['flowerbed', 25, 17], ['tulip_box', 23, 18], ['rose_bench', 25, 19], ['well', 26, 17], ['lamppost', 23, 17], ['flowerbed', 27, 16],
    // 꽃밭 언덕 (앞 왼쪽) — ① 피크닉 + 그네 · ④ 장미 아치 터널
    ['picnic', 8, 19], ['swing', 10, 18], ['cherry', 5, 18], ['cherry', 12, 17], ['cherry', 9, 22],
    ['flowerbed', 6, 16], ['tulip_box', 7, 16], ['flowerbed', 8, 16], ['tulip_box', 5, 20], ['flowerbed', 6, 20], ['flowerbed', 11, 20], ['tulip_box', 12, 20],
    ['flowerbed', 6, 23], ['tulip_box', 7, 23], ['flowerbed', 8, 23], ['lamppost', 12, 19], ['double_lamp', 9, 25],
    ['rose_arch', 6, 26], ['rose_arch', 7, 26], ['rose_arch', 8, 26], ['flowerbed', 5, 26], ['tulip_box', 5, 27], ['flowerbed', 9, 27],
    ['cottage', 10, 23, 1, 330],
    ...rowY('hedge', 13, span(16, 28, [21, 22])), ['rose_arch', 13, 21],
    // 벌통 텃밭 (앞 오른쪽) — ③ 벌통 + 새집 + 꽃밭 · ⑤ 꽃 수레 + 튤립 줄
    ['garden', 22, 24], ['beehives', 26, 24], ['beehives', 26, 25], ['birdhouse', 27, 23], ['flowerbed', 27, 25], ['flowerbed', 26, 26], ['lamppost', 25, 27], ['cherry', 28, 27], ['tulip_box', 20, 24], ['flowerbed', 20, 25],
    ['flower_cart', 19, 28], ['tulip_box', 20, 28], ['tulip_box', 21, 28], ['tulip_box', 22, 28], ['flowerbed', 24, 28],
    ...rowX('picket_gate', 22, span(20, 28)), ...rowY('picket_gate', 19, [23, 24, 25]), ['picket_gate', 19, 26],
    // 나무 액자: 벚나무·자작나무 (뒤 두 가장자리) · 앞쪽 성기게
    ...cycle(['cherry', 'cherry', 'birch'], [...alongX(4, span(4, 29)), ...alongY(4, span(5, 29))]),
    ...cycle(['cherry', 'birch'], [...alongX(29, [7, 10, 26]), ...alongY(29, [7, 11, 15, 23, 26])]),
  ],
};

const MARKET: Neighbor = {
  // 금화 거리 (땅 7단계 30×30 · 적갈색 20 · 금색·적갈색 · 단풍): 입구(14,29) → 노점이 줄 선 큰길 x=14 → 황금 분수·대형 시계탑 광장(초점) → 여관
  //  구역: 뒤 왼쪽 길드 거리(돌담 · 흰 울타리 문) · 뒤 오른쪽 우체국 거리(흰 울타리) · 앞 왼쪽 주점·대장간 골목(돌담 · 흰 울타리 문) · 앞 오른쪽 장터 마당(산울타리 · 장미 아치)
  //  + 광장 동쪽 상인 별채 줄
  //  장면: ① 노점·과일 수레 줄 + 전구 기둥 ② 우체국 앞 간판 기둥 + 이정표 ③ 주점 앞 술통 더미 + 화로 ④ 길드 회관 앞 깃발 + 의뢰 게시판 ⑤ 여관 앞 간판 기둥 + 쌍가로등
  //  (사치 장식은 초점 둘만 — 황금 분수 · 대형 시계탑. 여관 금빛 간판 대신 간판 기둥)
  id: 'market', name: '금화 거리', owner: '상인조합장', land: 7, like: 980, grade: 4,
  layout: [
    ['inn', 12, 2, 8, 20], ['dungeon', 29, 18],
    // ⑤ 여관 앞 간판 기둥 + 쌍가로등
    ['double_lamp', 13, 8], ['double_lamp', 15, 8], ['shop_sign', 13, 9], ['banner', 15, 9],
    // 광장(초점): 황금 분수 + 대형 시계탑 · 둘레 쌍가로등 · 화분 나무 · 꽃
    ['gold_fountain', 11, 14], ['grand_clock', 16, 13], ['double_lamp', 10, 13], ['double_lamp', 10, 16], ['double_lamp', 18, 13], ['double_lamp', 18, 16],
    ['topiary', 11, 13], ['topiary', 12, 13], ['topiary', 11, 16], ['topiary', 12, 16], ['flowerbed', 16, 15], ['flowerbed', 17, 15], ['flowerbed', 10, 14], ['flowerbed', 10, 15],
    // 큰길 북쪽 노점: 노점 → 과일 수레 → 전구 기둥
    ['stall', 11, 10], ['fruit_stall', 13, 11], ['string_lights', 13, 12], ['stall', 16, 10], ['flower_cart', 15, 11], ['string_lights', 15, 12],
    // 큰길 남쪽 — ① 노점·과일 수레 줄 + 전구 기둥 (노점 2 → 수레 → 전구, 양쪽 엇갈려)
    ['stall', 11, 18], ['fruit_stall', 13, 18], ['string_lights', 13, 20], ['stall', 11, 21], ['flower_cart', 13, 22], ['stall', 11, 26], ['string_lights', 13, 25], ['shop_sign', 13, 27], ['double_lamp', 13, 29],
    ['barrel_stack', 15, 18], ['stall', 16, 19], ['string_lights', 15, 21], ['fruit_stall', 15, 23], ['stall', 16, 23], ['string_lights', 15, 26], ['stall', 16, 26],
    // 입구: 정문 + 쌍가로등 둘 + 이정표
    ['gate', 14, 28], ['double_lamp', 16, 29], ['signpost', 16, 28],
    // 상인 별채 줄 (광장 동쪽)
    ['cottage', 20, 14, 1, 20], ['cottage', 23, 14, 1, 20], ['cottage', 26, 14, 1, 20], ['shop_sign', 22, 14], ['shop_sign', 25, 14], ['maple', 28, 14], ['flowerbed', 20, 13], ['flowerbed', 23, 13], ['lamppost', 25, 17],
    // 길드 거리 (뒤 왼쪽) — ④ 깃발 + 의뢰 게시판
    ['guild', 3, 3, 1, 20], ['smith', 7, 2, 1, 20], ['board', 4, 8], ['banner', 2, 8], ['banner', 7, 8], ['knight_statue', 9, 7], ['double_lamp', 8, 10], ['maple', 1, 2], ['barrel_stack', 10, 2], ['banner', 10, 5],
    ...rowX('stonewall2', 11, span(1, 9)), ['picket_gate', 10, 11],
    // 우체국 거리 (뒤 오른쪽) — ② 간판 기둥 + 이정표
    ['postoffice', 20, 3, 1, 20], ['shop_sign', 19, 6], ['signpost', 22, 6], ['cottage', 24, 2, 1, 20], ['cottage', 24, 6, 1, 20], ['cottage', 27, 4, 1, 20], ['lamppost', 20, 9], ['maple', 27, 8], ['flower_cart', 22, 3], ['flowerbed', 26, 9],
    ...rowY('picket_gate', 18, span(2, 9)), ['picket_gate', 18, 11], ...rowX('picket_gate', 12, span(19, 28)),
    // 주점·대장간 골목 (앞 왼쪽) — ③ 술통 더미 + 화로
    ['tavern', 4, 20, 6, 20], ['barrel_stack', 8, 21], ['barrel_stack', 8, 22], ['brazier', 8, 24], ['bench', 3, 25], ['bench', 5, 25], ['fire', 4, 26],
    ['smith', 3, 14, 1, 20], ['cottage', 7, 14, 1, 20], ['brazier', 2, 17], ['barrels', 9, 15], ['maple', 1, 22], ['maple', 2, 28], ['maple', 8, 27],
    ...rowY('stonewall2', 10, span(18, 28, [23, 24])), ['picket_gate', 10, 23],
    // 장터 마당 (앞 오른쪽)
    ['stall', 20, 21], ['fruit_stall', 22, 21], ['stall', 23, 21], ['barrel_stack', 25, 21], ['stable', 21, 25, 1, 20], ['windmill', 26, 25], ['string_lights', 20, 20], ['string_lights', 25, 20], ['flower_cart', 19, 27], ['pumpkins', 25, 23], ['harvest_cart', 26, 23], ['fire', 27, 21],
    ...rowX('hedge', 19, span(19, 28)), ...rowY('hedge', 18, [20, 21, 22, 26, 27, 28]), ['rose_arch', 18, 23],
    // 나무 액자 (단풍·소나무) · 앞쪽 성기게
    ...cycle(['maple', 'pine', 'pine'], [...alongX(0, span(0, 29)), ...alongY(0, span(1, 29))]),
    ...cycle(['pine', 'maple'], [...alongX(29, [3, 7, 22, 25]), ...alongY(29, [3, 7, 11, 15, 24, 27])]),
  ],
};

const MOSS: Neighbor = {
  // 이끼 은신처 (땅 3단계 14×14 · 초록 120 · 초록·갈색·파란 버섯빛): 작은 땅도 예쁠 수 있다 — 입구(21,29) → 큰길 x=21 → 여관
  //  초점: 큰 나무 아래 연꽃 연못. 구역: 뒤 왼쪽 텃밭(산울타리) · 뒤 오른쪽 별채(나무 줄) · 앞 왼쪽 모닥불 쉼터(나무 줄)
  //  장면: ① 이끼 바위 옆 모닥불 + 빛나는 버섯 ② 새집 + 새 물그릇 ③ 텃밭 + 펌프 ④ 버섯 둘레 벤치
  id: 'moss', name: '이끼 은신처', owner: '숲지기', land: 3, like: 260, grade: 1,
  layout: [
    ['inn', 19, 17, 3, 120], ['dungeon', 29, 18],
    // 초점: 큰 나무 + 연꽃 연못 + 빛나는 버섯
    ['tree', 24, 22], ['lily_pond', 24, 23], ['mushroom_lamp', 23, 25], ['mushroom_dark', 26, 24], ['mushroom_lamp', 26, 23],
    // ③ 텃밭 + 펌프 (뒤 왼쪽)
    ['garden', 16, 18], ['water_pump', 16, 22], ['pumpkins', 18, 22], ...rowX('hedge', 23, [16, 17]), ['picket_gate', 18, 23],
    // 별채 (뒤 오른쪽) — ② 새집 + 새 물그릇
    ['cottage', 24, 17, 1, 120], ['birdhouse', 27, 17], ['bird_bath', 27, 18], ['mushroom_lamp', 23, 18], ...cycle(['pine', 'birch'], alongX(21, [26, 27, 28])),
    // ① 이끼 바위 옆 모닥불 + 빛나는 버섯 (앞 왼쪽)
    ['rock_fall', 16, 25], ['fire', 18, 26], ['mushroom_lamp', 18, 25], ['mushroom_dark', 17, 27], ['mushroom_lamp', 19, 28], ['bench', 18, 27],
    // ④ 버섯 둘레 벤치 (앞 오른쪽)
    ['mushroom_dark', 26, 27], ['bench', 25, 27], ['bench', 27, 27], ['bench', 26, 28], ['mushroom_lamp', 28, 26],
    // 큰길 등불
    ['mushroom_lamp', 20, 22], ['brazier', 22, 25], ['mushroom_dark', 20, 28],
    // 숲 액자
    ...cycle(['pine', 'pine', 'birch', 'tree'], [...alongX(16, span(16, 29, [21])), ...alongY(16, [17, 21, 27, 28, 29])]),
    ...cycle(['pine', 'birch'], [[29, 23], [29, 27], [27, 29]]),
    // 입구: 장미 아치 둘 + 쌍가로등 둘 + 이정표
    ['rose_arch', 20, 29, 1, null, true], ['rose_arch', 22, 29, 1, null, true], ['double_lamp', 19, 29], ['double_lamp', 23, 29], ['signpost', 22, 28],
  ],
};

const SPA: Neighbor = {
  // 달무리 온천 (땅 6단계 26×26 · 하늘색 200 · 하늘색·나무색·흰색 · 소나무·자작나무, 단풍은 정자 둘레만): 입구(16,29) → 화로·쌍가로등 둘레길 x=16 → 온천 + 바위 폭포 + 잉어 연못(초점) → 여관
  //  구역: 뒤 왼쪽 정자 단풍 정원(산울타리 · 장미 아치) · 뒤 오른쪽 주점·예배당(돌담 · 흰 울타리 문) · 앞 왼쪽 개울 건너 별채(흰 울타리 · 문) · 앞 오른쪽 노천탕 평상(산울타리 · 장미 아치)
  //  장면: ① 수건 걸린 평상(벤치 + 술통) ② 화로·쌍가로등 둘레길 ③ 정자 + 단풍 ④ 아치 다리 건너 별채
  id: 'spa', name: '달무리 온천', owner: '온천냥', land: 6, like: 470, grade: 3, pets: ['otter', 'slime', 'starcat'],
  layout: [
    ['inn', 14, 6, 5, 200], ['dungeon', 29, 18],
    // 초점: 온천 + 바위 폭포 + 잉어 연못 · 화로
    ['bath', 18, 14], ['rock_fall', 21, 14], ['koi_pond', 21, 16], ['brazier', 20, 18], ['brazier', 23, 15], ['flowerbed', 23, 16], ['tulip_box', 23, 17], ['pine', 23, 13], ['flowerbed', 21, 13], ['flowerbed', 22, 18],
    // ② 둘레길: 화로 → 꽃 → 쌍가로등 (양쪽 엇갈려)
    ['double_lamp', 15, 12], ['double_lamp', 17, 12], ['brazier', 15, 15], ['tulip_box', 15, 16], ['double_lamp', 17, 19], ['flowerbed', 17, 20], ['brazier', 15, 20], ['tulip_box', 15, 21],
    ['double_lamp', 17, 24], ['flowerbed', 17, 25], ['brazier', 15, 26], ['flowerbed', 15, 27], ['double_lamp', 17, 28], ['flowerbed', 15, 13], ['flowerbed', 17, 13],
    // 입구: 장미 아치 둘 + 쌍가로등 둘 + 이정표
    ['rose_arch', 15, 29, 1, null, true], ['rose_arch', 17, 29, 1, null, true], ['double_lamp', 14, 29], ['double_lamp', 18, 29], ['signpost', 14, 28],
    // ③ 정자 + 단풍 (뒤 왼쪽)
    ['gazebo', 8, 8], ['maple', 6, 6], ['maple', 10, 6], ['maple', 6, 10], ['maple', 11, 9], ['maple', 9, 11], ['rose_bench', 7, 8], ['rose_bench', 10, 8], ['tulip_box', 8, 6], ['tulip_box', 9, 6], ['lamppost', 11, 11], ['bird_bath', 5, 8], ['flowerbed', 7, 11],
    ...rowX('hedge', 13, span(5, 11)), ['rose_arch', 12, 13, 1, null, true], ...rowY('hedge', 13, span(5, 11)),
    // 주점·예배당 (뒤 오른쪽)
    ['tavern', 21, 6, 2, 200], ['chapel', 26, 6], ['barrel_stack', 25, 7], ['barrel_stack', 25, 8], ['bench', 22, 11], ['bench', 23, 11], ['lamppost', 25, 11], ['brazier', 19, 5], ['pine', 28, 11],
    ...rowY('stonewall2', 20, span(5, 9)), ['picket_gate', 20, 11], ...rowX('stonewall2', 12, span(23, 28)),
    // 돌담 앞 소나무 줄 (온천 동쪽)
    ...cycle(['pine', 'birch', 'pine'], alongX(13, span(24, 28))), ['bench', 26, 16], ['lamppost', 25, 18], ['flowerbed', 27, 14],
    // ④ 개울(연못 줄) 위 아치 다리 건너 별채 (앞 왼쪽)
    ['koi_pond', 5, 17], ['lily_pond', 7, 17], ['foot_bridge', 9, 17], ['flowerbed', 9, 18], ['lily_pond', 10, 17], ['koi_pond', 12, 17], ['pine', 5, 16],
    ['cottage', 6, 20, 1, 200], ['cottage', 9, 21, 1, 200], ['cottage', 6, 24, 1, 200], ['cottage', 10, 25, 1, 200],
    ['lamppost', 8, 23], ['double_lamp', 12, 22], ['tulip_box', 5, 22], ['birch', 5, 27], ['flowerbed', 8, 27], ['birch', 12, 28],
    ...rowY('picket_gate', 13, span(19, 28, [23, 24])), ['picket_gate', 13, 23],
    // ① 노천탕 + 수건 걸린 평상(벤치 + 술통) (앞 오른쪽)
    ['bath', 22, 22], ['bench', 21, 26], ['barrel_stack', 22, 26], ['bench', 23, 26], ['rose_bench', 25, 22], ['brazier', 26, 22], ['pine', 26, 24], ['fire', 24, 27], ['lamppost', 26, 26], ['birch', 28, 25], ['tulip_box', 25, 23],
    ...rowX('hedge', 20, span(19, 28, [20, 21])), ['rose_arch', 21, 20, 1, null, true], ...rowY('hedge', 19, span(21, 28)),
    // 나무 액자: 소나무·자작나무 · 앞쪽 성기게
    ...cycle(['pine', 'birch', 'pine', 'pine'], [...alongX(4, span(4, 29)), ...alongY(4, span(5, 29))]),
    ...cycle(['birch', 'pine'], [...alongX(29, [8, 11, 21, 24]), ...alongY(29, [7, 11, 15, 23, 27])]),
  ],
};

/** LAND10: 위 배치표는 LAND2(맵 32) 좌표 그대로 적어 두고, 맵 44에 맞게 +12 해서 내보낸다 (이웃 모습 v3 → v4와 같은 규칙) */
const toV4 = (v: Neighbor): Neighbor => ({
  ...v,
  ...(typeof v.ent === 'number' ? { ent: v.ent + CONFIG.v8.shift } : {}),
  layout: v.layout.map((e) => [e[0], e[1] + CONFIG.v8.shift, e[2] + CONFIG.v8.shift, ...e.slice(3)] as Entry),
});
export const NEIGHBORS: Neighbor[] = [MOON, PETAL, MARKET, MOSS, SPA].map(toV4);
