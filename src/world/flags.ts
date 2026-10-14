// FASTSHIP: 원격 끄기 스위치 — public/flags.json을 부팅 때 한 번 읽는다 (실패하면 기본값 = 켬).
//  새 기능마다 플래그 하나. 문제가 생기면 json 한 줄 바꿔 배포(T0)로 끈다.
export const FLAG_DEFAULTS = {
  /** GOLDSINK §4 자동 사냥 금화 줄이기 */
  goldsinkAutoCap: true,
  /** GOLDSINK §1 금화 새로고침 */
  goldsinkRefresh: true,
  /** GOLDSINK §2 연금술 변환 */
  goldsinkConvert: true,
  /** GOLDSINK §3 예배당 축복 */
  goldsinkBless: true,
  /** GOLDSINK §5 마을 부탁 */
  villageFavors: true,
  /** GOLDSINK §6 다음 이야기 줄 */
  storyWaitHint: true,
  /** 우편함 읽은 편지 지우기 */
  mailDelete: true,
  /** GOLDSINK §7 끝없는 심연 */
  endlessAbyss: true,
  /** GOLDSINK §8 주사위 술내기 */
  diceGame: true,
  /** ROLES: 직업마다 체력·탱·힐·조합 (끄면 예전 전투) */
  rolesV2: true,
  /** 핫픽스: 모바일 짧게 누르기(탭) 판정 */
  tapV2: true,
  /** WAYFIND §1 처음 해 보기 「!」 말풍선 */
  wayfindBubbles: true,
  /** WAYFIND §2 결의 (같은 첫 돌파 판 연속 패배 보정) */
  huntResolve: true,
  /** WAYFIND §2 패배 결과 「막혔을 때」 카드 */
  stuckCard: true,
  /** WAYFIND §3 오늘 해 볼 만한 것 */
  todayPicks: true,
  /** v0.24.2 랭킹 기록에서 「전쟁의 소문」 바람 보정 빼기 */
  raidNoWind: true,
  /** v0.24.2 HARVEST §3 계정 삭제 */
  accountDelete: true,
  /** v0.24.2 여관·주점 레벨 장식을 진짜 장식으로 */
  innDecoObj: true,
  /** v0.24.4 AUTO·동료가 보스를 거리와 상관없이 노리고 · 근접은 덩치만큼 떨어져서도 친다 */
  aiBossTarget: true,
  /** v0.24.4 키캡에 Space·Shift·1·2·3 */
  keycapLabels: true,
  /** v0.24.4 화면에서 크기가 같은 줌 단계는 하나만 */
  zoomDedupe: true,
  /** v0.24.5 끝없는 심연: 나가도 그 층부터 무료로 이어가기 · 10층 체크포인트(입장료) */
  abyssResume: true,
  /** v0.24.6 자동 길 끔: 던전 길은 울타리 밖(숲) 칸만 · 입구 길도 지우개로 지울 수 있게 */
  autoPathStrict: true,
  /** VISUAL §1 팔레트 통일 — 실험실(기본 꺼짐 · 운영자 「새 화면 미리 보기」) */
  paletteV2: false,
  /** VISUAL §2 조용한 바닥 · 또렷한 사람 — 실험실(기본 꺼짐) */
  calmWorld: false,
  /** VISUAL §4 HUD 다시 짜기 (위 상태줄 · 소식 띠 · 아래 5칸) — 실험실(기본 꺼짐) */
  hudV2: false,
  /** VISUAL §5 창 틀 · 글자 3크기 · 버튼 3종 · 큰 수 줄임 — 실험실(기본 꺼짐) */
  uiKitV2: false,
  /** VISUAL 실험실 토글을 운영자 말고 모두에게 보이기 (테스터 공개 단계) */
  visualLabOpen: false,
  /** CHECKIN §A1 단골 제안 거르기 (형철 확인 전엔 꺼짐 · 「새 화면 미리 보기」로 켜 봄 — vis()) — 평범한 손님은 제안 없이 「다음에 또 올게요!」 · 설정 「단골 제안 받을 손님」 · 정산 카드 한 줄 */
  propFilter: false,
  /** CHECKIN §A2 이야기·관계 이벤트 모아 보기 (형철 확인 전엔 꺼짐 · 「새 화면 미리 보기」로 켜 봄 — vis()) — 곁이야기·단골 제안은 「📖 새 이야기 n」 배지에 (하루 2개까지만 저절로) · 설정 「곁이야기」 */
  storyInbox: false,
  /** v0.25.2 CHECKIN: 아래 넷은 형철 확인 전까지 꺼짐 — 「새 화면 미리 보기」(실험실)로만 켜 본다 (vis) */
  /** v0.25.2 §I #19 손님 목록 ★ 맨 위 고정 켜기/끄기 · ★ 묶음 구분 줄 · 지금 정렬 기준 한 줄 (끄면 예전: ★가 ★한 순서로 맨 위) */
  guestSortPin: false,
  /** v0.25.2 §I #20 자동 길 끔이면 자동 길을 하나도 안 깐다 (던전 길·바깥 길 포함 · 끄면 v0.24.6 autoPathStrict 그대로) */
  autoPathNone: false,
  /** v0.25.2 §I 게시판 레벨업 버튼 (의뢰 창 맨 위) · 파티 = 2 + 게시판 Lv (최대 4) · 꽉 찼을 때 안내 */
  boardLevelUp: false,
  /** v0.25.2 §H 신화 안내 한 줄 (도감 「신화」 탭 · 여정 지도 맨 위) */
  mythicGuide: false,
  /** v0.25.2 버그: 방문 중인 전설도 의뢰·사냥 파티에 「동행 · 방문 중」으로 (루나 부탁) — 단골 자리엔 안 셈 · 다녀와도 방문객 · 방문 시간은 계속 흐름 */
  legendCompanion: true,
  /** v0.25.2 CHECKIN §B 첫 30분 동선 — 실험실(기본 꺼짐 · 「새 화면 미리 보기」로 켬 · 형철 OK 뒤 true): 임무 건설 대상 맨 위+반짝 · 원정 파티 맨 위 추천·성공률·출발(5번째 자리 설명은 잠긴 칸 눌러야) · 장비 임무는 늘 단골 탭+반짝 · 보고서 버튼 「확인」 */
  firstFlowFix: false,
  /** v0.25.2b 구역 어울림 이름표(숲 속 오두막·별빛 숙소…)는 어울림 버튼을 눌렀을 때만 (형철 결정 · 끄면 예전처럼 늘 보임) */
  harmonyLabels: true,
  /** v0.25.3 K9 (고느끼 건의) 손님·영웅 상세 창에 [선물하기] — 마을 작은 메뉴와 같은 선물 고르기 */
  heroDetailGift: true,
  /** v0.25.4 K10 어울림 「모아 놨는데 안 생김」: 1칸 장식 개수 제한 없음 · 어울림마다 한 세트 먼저 · 구역은 이어진 덩어리 · 같은 이름 장식(술통 더미·장미 아치) 같은 물건 · 로드 때 재계산 (버그 수정 — 켬) */
  harmonyV2: true,
  /** v0.25.4 CHECKIN §J4 뒤로가기 한 규칙 (형철 확인 전엔 꺼짐 · vis) — 폰 뒤로가기·Esc·창 밖 누르기 = 맨 위 창(확인 시트·인물 메뉴·창) 하나만 닫기 · 창이 없으면 아무것도 안 함(게임 밖으로 안 나감 · 전투 중엔 일시정지) */
  backRule: false,
  /** v0.25.4 CHECKIN §J4 엄지 자리 (형철 확인 전엔 꺼짐 · vis) — 자주 누르는 버튼(모두 받기·출발)을 창 아래 버튼 줄(#winF)로 */
  thumbZone: false,
  /** v0.25.4 CHECKIN §J4 누르는 느낌 (형철 확인 전엔 꺼짐 · vis) — 버튼 0.08초 눌림 + 안드로이드 짧은 진동(설정 「진동」 haptics · 기본 켬) */
  pressFeel: false,
  /** v0.25.4 CHECKIN §J4 남은 시간 막대 (형철 확인 전엔 꺼짐 · vis) — 건설 공사 칸을 기존 막대 그림(bar_frame)으로 · 남은 시간은 작은 글자로 옆에 */
  timeBars: false,
  /** v0.25.4 CHECKIN §J4 되돌릴 수 없는 행동 확인 시트 하나 (형철 확인 전엔 꺼짐 · vis) — 판매·분해·재련·포기·철거·작별·계정 삭제를 아래에서 올라오는 시트로 */
  confirmSheet: false,
  /** v0.25.4 CHECKIN C: 아래 일곱은 형철 확인 전까지 꺼짐 — 「새 화면 미리 보기」(실험실)로만 켜 본다 (vis) */
  /** v0.25.4 §C3 「다녀오셨어요」 카드: 번 금화 · 다녀간 손님 · 끝난 원정 · 다 자란 것 + [모두 받기] 한 번 · 7일 이상 만이면 선물 상자(금화 = 하루 평균 수입×2 · 축복 30분) + 「그동안 바뀐 것」 3줄 */
  welcomeBack: false,
  /** v0.25.4 §C4 빨간 점 하나의 규칙: 받을 게 있는 곳에만 작은 빨간 점 (우편 안 읽음 · 원정 끝남 · 대장간 강화 가능 · 텃밭 다 자람 · 장부 받을 보상) · 숫자 배지는 새 이야기 하나만 */
  redDots: false,
  /** v0.25.4 §C5 가방: 「일반·희귀 한 번에 분해」 버튼 → 확인 창 하나 (잠금·끼운 것·강화·세트 빠짐 · 자동 분해 설정은 그대로) */
  bulkTidy: false,
  /** v0.25.4 K6 원정 보고서 [다시 보내기]: 같은 파티 · 같은 지역/길이 의뢰 (없으면 비슷한 의뢰 · 그것도 없으면 이유) · 게시판·진행 줄에서 연 보고서는 대화 없이 바로 */
  resendRun: false,
  /** v0.25.4 텃밭 레벨업 (형철 결정): 텃밭 창 맨 위 「텃밭 Lv.x · 밭 n칸」 줄 + [텃밭 Lv.x+1 · 비용 G] (공사 규칙은 다른 건물과 같게 game.upgrade) */
  gardenLevelUp: false,
  /** v0.25.4 K9 (형철 결정) 말 걸기·선물하기 한 함수: 마을 · 손님 상세 · 인연 창 어디서든 말 걸기 = 인연 대화 먼저(되면) → 아니면 그냥 한마디 · 선물하기 = 같은 선물 고르기 창 */
  personActionsV2: false,
  /** v0.25.4 actions.md 작은 것: 꾸미기 안내 「누르면 들어서 옮겨요」(짧게 눌러도 드는 지금 동작에 맞춤) · 「좌우 뒤집기」 이름 하나 · 텃밭·게시판 창 맨 위 정보 한 줄 */
  actionsTidy: false,
  /** v0.25.4 CHECKIN §C1 톱니바퀴 항상 (형철 확인 전엔 꺼짐 · 「새 화면 미리 보기」로 켜 봄 — vis()) — 오른쪽 위 ⚙ 하나(마을·창 위: 설정 창 · 전투: 일시정지 시트 = 소리·AUTO·흔들림·피해 숫자·[계속][포기]) */
  gearAlways: false,
  /** v0.25.4 CHECKIN §C2 설정 3탭 기본 / 알림 / 계정 (형철 확인 전엔 꺼짐 · vis()) — 진동 줄 · 설정값을 세이브(P.prefs)에도 넣어 폰·PC 같게 (불러올 때 둘 중 최근 것) */
  settingsTabs: false,
  /** v0.25.4 CHECKIN §K1 처음 켤 때 배경음악 70% (효과음은 원래 70%) — 소리 설정을 한 번도 안 바꾼 기기만 (형철 확인 전엔 꺼짐 · vis()) */
  sound70: false,
  /** v0.25.4 CHECKIN §L1 화면 보호 모드 (형철 확인 전엔 꺼짐 · vis()) — 아주 어두운 마을 · 초당 2번만 그림(dpr 1) · 가운데 작은 판(1분마다 자리 이동) · n분 손 안 대면 자동 · 누르면 「다녀오셨어요」 요약 */
  screenSaver: false,
  /** v0.25.4 CHECKIN §L2 UI 끄기 구경 모드 (형철 확인 전엔 꺼짐 · vis()) — 👁 버튼 → UI가 숨고 마을만 · 두 번 누르기·뒤로가기로 복귀 · [📷] 사진 모드로 · 숨긴 동안 대기 이벤트는 안 띄움 */
  uiHide: false,
  /** CHECKIN §J8 건물 머리 위 「상태 말풍선」 (형철 확인 전엔 꺼짐 · 「새 화면 미리 보기」로 켜 봄 — vis()) — 텃밭·예배당·대장간·게시판·연못 위 작은 아이콘 하나 · 최대 3개 · 누르면 그 건물 창 · 설정 「건물 알림 말풍선」 */
  bldStatus: false,
  /** v0.25.5 CHECKIN §J6 영웅 카드 — 손님 창 · 원정·사냥·토벌·심연 파티 고르기 · 단골 제안 카드를 초상 카드 격자로 (위 고정 = 파티 자리·역할·조합·추천 전투력 막대·[추천 편성][출발]) · 형철 확인 전 꺼짐(실험실로만) */
  heroCards: false,
  /** v0.25.5 CHECKIN §J6 파티 후보 한 규칙 (형철 결정 — 켬): 방문 중인 전설(동행)이 토벌에도 · 못 가는 사람은 흐리게 + 이유(원정 중 n분 · 쉬는 중) · 사냥·심연은 지쳐도 갈 수 있고 「체력 n · 지쳤어요」 · 추천 편성은 원정·사냥·토벌·심연 네 곳 모두 */
  partyRulesV2: true,
  /** HERODOT 영웅·손님 도트 리마스터 2 (1단계: 기사·사제·도적) — 형철 확인 전엔 꺼짐 · 「새 화면 미리 보기」(실험실)로만 켜 봄 (vis) */
  heroDotV2: false,
  /** CHECKIN §J7 대장간 「영웅 중심 한 화면」 (형철 확인 전 꺼짐 · 「새 화면 미리 보기」로 켜 봄 — vis()) — 탭 5개 → 장비 손질(강화·초월·재련) · 제작 · 가방 정리 · 맨 위 「지금 할 만한 것」 2개 · 영웅 카드 줄 → 장비 칸 → 행동 판 하나(망치 연출 + 숫자 튀어 오름) · [자동 장착] · 창 맨 위 설명·레벨업·지붕 색 */
  smithOne: false,
  /** CHECKIN §E 여관다운 보상 순간 (형철 확인 전 꺼짐 · 「새 화면 미리 보기」로 켜 봄 — vis()) — 버튼·알림 프런트 말투(reports/checkin/wording.md · 덜 분명해지는 줄은 원래 말) · 원정·사냥 결과 체크아웃 영수증(한 줄씩 찍힘 · 탭하면 다 찍힘 · 희귀 이상 금빛) · 숙박부 도장 「쿵」(출석 · 장부·연감은 stampFx) · 단골 되면 숙박 카드에 도장 · 첫 원정 열쇠 건네기 */
  checkinFx: false,
  /** CHECKIN §J3 글 대신 카드 (형철 확인 전 꺼짐 · vis()) — 전투 결과 별 1~3·MVP·드랍 칸 · 의뢰·부탁 한 줄 카드(아이콘·진행 막대·보상 칸) · 건설 그림 타일(못 지으면 어둡게 + 모자란 금화만 빨간 숫자) · 레벨업·해금 가운데 배너 1초 */
  uiCards: false,
  /** HARVEST §1 첫 번째 가을 수확제 (기간 한정 · 10/22 20:00 ~ 11/05 · 교환소 11/08까지 · 날짜는 서버 시각 world/harvest.ts) — 켜 둬도 기간 밖엔 아무것도 안 보인다 · 끄면 마을 가을 장식·호박 도깨비·교환소·수프·소문·컷 모두 숨김 (모은 리본·바꾼 장식·칭호는 그대로 남음) */
  harvestFest: true,
  /** HARVEST §2 노을 (영구 · 수확제 시작 시각부터): 게임 17:00~22:00 노을 색 → 밤 색조 · 19:00부터 등불이 서서히 · 손님 노을 말풍선 · 첫 노을 한 번 대사 — 끄면 예전처럼 22:00에 바로 밤 */
  sunset: true,
  /** CHECKIN §D1 오늘의 장부 (수확제 시작 시각부터 · 그 뒤 계속): 매일(한국 0시) 후보 6개 중 3개 · 하나마다 작은 보상 · 셋이면 연감 도장 3 + 상자 · 「오늘의 목표」·마을 부탁·이번 주 장부를 탭으로 — 끄면 오늘의 목표·부탁 예전 그대로 */
  ledgerDaily: true,
  /** CHECKIN §D2 여관 연감 시즌 1 = 수확제 (10/22 20:00 ~ 11/08 · 30칸 · 마지막 주 도장 ×2 · 다음 시즌으로 30%) — 기간 밖·끄면 안 보임 */
  almanac: true,
  /** CHECKIN §K2 왼쪽 가장자리 아이콘 줄 (새 HUD hudV2 안 · 오늘의 장부 · 수확제(기간 중) · 여관 연감(시즌 중) 최대 3 · 빨간 점 규칙) — 끄면 메뉴 칸으로만 */
  leftIcons: true,
};
export type FlagKey = keyof typeof FLAG_DEFAULTS;
const flags: Record<string, boolean> = { ...FLAG_DEFAULTS };
export const flag = (k: FlagKey): boolean => flags[k] !== false;
/**
 * HARVEST §1-1: 서버 시각 — flags.json 응답의 Date 머리(서비스워커를 거치지 않는 요청)로 기기 시계와의 차이를 잰다.
 *  2분 넘게 다를 때만 쓴다 (Date는 초 단위 · 오프라인이면 0 = 기기 시계)
 */
export let serverSkew = 0;
export function noteServerDate(h: string | null | undefined, now = Date.now()) {
  const t = h ? Date.parse(h) : NaN;
  if (!Number.isFinite(t)) return;
  const d = t - now;
  serverSkew = Math.abs(d) > 120000 ? d : 0;
}
/** 부팅 때 한 번 (2초 안에 못 받으면 기본값) */
export async function loadFlags(base = import.meta.env.BASE_URL): Promise<void> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2000);
    const r = await fetch(`${base}flags.json?t=${Date.now()}`, { cache: 'no-store', signal: ctl.signal });
    clearTimeout(t);
    noteServerDate(r.headers.get('date'));
    if (!r.ok) return;
    const j = (await r.json()) as Record<string, unknown>;
    for (const [k, v] of Object.entries(j)) if (typeof v === 'boolean') flags[k] = v;
  } catch {
    /* 기본값 */
  }
}
/** 시험용 */
export const setFlag = (k: FlagKey, v: boolean) => (flags[k] = v);
