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
