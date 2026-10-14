// LUXE §3 마을 회관 꾸러미 대사 — ★ 형철이 다듬어 줄 자리 (「(임시)」가 붙은 줄은 아직 자리만)
//  화자: keeper(버나드) · post(모모) · legend_grom(그롬) · hero_morga(모르가) · hero_brok(브로크) · legend_luna(루나) · hero_harald(하랄드) · hero_oswin(오스윈) · narr
//  [화자, 대사, 이름표] — 이름표를 비우면 대화창이 화자 이름을 쓴다
export type BLine = [who: string, text: string, tag?: string];

/** 처음 열기: 무너진 회관 그림 + 버나드 한마디 (명세 3-3 그대로 · 형철이 다듬음) */
export const BUNDLE_FIRST: BLine[] = [
  ['keeper', '이 낡은 회관… 예전엔 마을 잔치가 여기서 열렸지. 조금씩 채워 보겠나?', '노주인 버나드'],
];

/** 방 완성마다 그 방 담당 한 줄 */
export const BUNDLE_ROOM: Record<string, BLine[]> = {
  kitchen: [['legend_grom', '(임시) 주방에 불이 다시 들어왔군. 오늘 저녁은 내가 산다!', '그롬']],
  pharmacy: [['hero_morga', '(임시) 약방 선반이 꽉 찼네~ 물약이 더 오래 갈 거야.', '모르가']],
  smithy: [['hero_brok', '(임시) 회관 대장간 화덕이 살아났어. 가루 좀 아껴 줄게.', '브로크']],
  water: [['legend_luna', '(임시) 물가 방에 물고기 그림이 걸렸어. 미끼 하나 더 챙겨 줄게.', '루나']],
  raid: [['hero_harald', '(임시) 전리품 방이라! 이거 보면서 한 잔 더 해야겠군.', '하랄드']],
  shelter: [['hero_oswin', '(임시) 모험가 쉼터… 버나드와 내가 쓰던 방이야. 다시 북적이겠군.', '오스윈']],
};

/** 꾸러미 하나 완성 (방 담당이 짧게 · 비우면 토스트만) */
export const BUNDLE_DONE_TOAST = '꾸러미 완성!';

/** 6방 전부: 회관 복원 컷 (마을 사람들 모임 · 모모·버나드) */
export const BUNDLE_FINAL: BLine[] = [
  ['narr', '(임시) 회관 지붕에 마지막 기와가 얹혔다. 마을 사람들이 하나둘 모여든다.'],
  ['post', '(임시) 사장님! 회관이 다 고쳐졌어요! 다들 사장님 덕분이래요!', '우체부 모모'],
  ['keeper', '(임시) …잔치 소리가 다시 들리는군. 고맙네. 이 회관, 자네 마을에 세우게.', '노주인 버나드'],
  ['narr', '「마을 회관」 건물을 보관함에 넣었어요 · 칭호 「마을을 되살린 사람」 · 「이번 주 명품」 무료 쿠폰 1장'],
];
