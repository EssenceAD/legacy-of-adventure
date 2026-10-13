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
};
export type FlagKey = keyof typeof FLAG_DEFAULTS;
const flags: Record<string, boolean> = { ...FLAG_DEFAULTS };
export const flag = (k: FlagKey): boolean => flags[k] !== false;
/** 부팅 때 한 번 (2초 안에 못 받으면 기본값) */
export async function loadFlags(base = import.meta.env.BASE_URL): Promise<void> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2000);
    const r = await fetch(`${base}flags.json?t=${Date.now()}`, { cache: 'no-store', signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return;
    const j = (await r.json()) as Record<string, unknown>;
    for (const [k, v] of Object.entries(j)) if (typeof v === 'boolean') flags[k] = v;
  } catch {
    /* 기본값 */
  }
}
/** 시험용 */
export const setFlag = (k: FlagKey, v: boolean) => (flags[k] = v);
