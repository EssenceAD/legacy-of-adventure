// UI_SKIN_SPEC: 창마다 재질 — 양피지(기록·편지·도감) · 코르크(원정 게시판) · 나무(건설·건물·가방·손님) · 돌+금테(사냥·토벌·랭킹·평가)
//  · 남색(메뉴·설정·계정·채팅·대화 = 지금 그대로). 창 제목으로 정하고, 건물 창처럼 제목이 제각각인 창은 openWin의 cls로 직접 준다.
//  창 제목 왼쪽 도트 아이콘도 같은 표에서.
import type { IconKey } from './kit';

export type Skin = 'parchment' | 'cork' | 'wood' | 'stone' | '';
const RULES: [RegExp, Skin, IconKey | null][] = [
  // 양피지
  [/^장부$/, 'parchment', 'm_dex'],
  [/^버나드의 장부/, 'parchment', 'm_quest'],
  [/^오늘의 목표/, 'parchment', 'm_quest'],
  [/^우편함/, 'parchment', 'm_mail'],
  [/^모모에게 편지/, 'parchment', 'm_letter'],
  [/업데이트$|^패치노트|^새 소식/, 'parchment', 'm_notice'],
  [/^도감/, 'parchment', 'm_dex'],
  [/^업적/, 'parchment', 'm_achieve'],
  [/^여관 운영 안내서|^안내서/, 'parchment', 'm_guide'],
  [/^인연/, 'parchment', 'm_bond'],
  // 코르크 게시판
  [/^원정 · 의뢰 게시판/, 'cork', 'm_expedition'],
  // 나무
  [/^건설/, 'wood', 'm_smith'],
  [/^대장간/, 'wood', 'm_smith'],
  [/^텃밭/, 'wood', 'm_garden'],
  [/^가방/, 'wood', 'm_bag'],
  [/^손님 \d+명/, 'wood', 'm_guests'],
  [/^땅 넓히기/, 'wood', 'm_smith'],
  // 돌 + 금테
  [/^사냥터|^사냥 |^소탕|^사냥 결과/, 'stone', 'm_hunt'],
  [/^토벌/, 'stone', 'm_raid'],
  [/^랭킹/, 'stone', 'm_rank'],
  [/^평가 결과|^여관 평가단/, 'stone', 'm_achieve'],
  // 남색 (아이콘만)
  [/^메뉴$/, '', 'm_settings'],
  [/^설정|^단축키/, '', 'm_settings'],
  [/계정|^복구 코드|^어느 마을로/, '', 'm_account'],
  [/^채팅/, '', 'm_chat'],
  [/^상점|^선물 가게|^떠돌이 상인/, '', 'm_shop'],
  [/^출석/, '', 'm_attendance'],
  [/^칭호/, '', 'm_title'],
  [/^엔딩|^만든 사람/, '', 'm_album'],
  [/^마을 · 이웃/, '', 'm_neighbor'],
  [/^주인 정보|^능력치|^당신은|^다음 세대|^누구와 떠날까요/, '', 'm_owner'],
  [/^원정 보고서|^그동안 마을에서는/, '', 'm_expedition'],
];

export function skinFor(title: string): { skin: Skin; icon: IconKey | null } {
  for (const [re, skin, icon] of RULES) if (re.test(title)) return { skin, icon };
  return { skin: '', icon: null };
}
/** openWin의 cls에 재질 클래스를 붙인다 (이미 있으면 그대로) */
export function skinClass(title: string, cls: string): string {
  if (/\bskin-/.test(cls)) return cls;
  const s = skinFor(title).skin;
  return s ? `${cls} skin-${s}`.trim() : cls;
}
