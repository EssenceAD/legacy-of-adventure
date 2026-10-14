// HARVEST §1 · CHECKIN §D 저장 칸 기본값 (state.ts가 freshProgress에 넣는다 — 다른 world 모듈을 import하지 않는다)
//  옛 저장엔 없음 → mergeProgress가 기본값으로 채우고, 각 모듈의 ~State()가 빠진 칸을 바로잡는다

/** HARVEST §1-4 수확제 기록: P.harvest */
export function freshHarvest() {
  return {
    /** 지금 가진 리본 · 지금까지 모은 리본(쓴 것 포함 · 칭호 기준) */
    ribbons: 0,
    earned: 0,
    /** 잡은 호박 도깨비 · 쓰러뜨린 황금 호박 대왕 · 대왕이 나온 수(누적 15마리마다 1) */
    pumpkins: 0,
    king: 0,
    kingUsed: 0,
    /** 교환소에서 바꾼 장식 수 · 종류별 산 수 */
    deco: 0,
    buy: {} as Record<string, number>,
    /** 여는 컷을 봤나 · 마지막 밤: 0 아직 · 1 봄 · 2 놓침(연대기만) */
    opened: false,
    finale: 0,
    /** 첫 호박 도깨비 한 줄을 봤나 · 칭호를 받았나 · 교환소를 연 뒤 리본 수 (빨간 점) */
    bark: false,
    title: false,
    seen: 0,
  };
}
export type HarvestState = ReturnType<typeof freshHarvest>;

/** CHECKIN §D1 오늘의 장부: P.daybook */
export interface DaybookCand {
  id: string;
  target: number;
  /** 뽑았을 때 기록 값 (진행 = 지금 − base) */
  base: number;
  claimed: boolean;
}
export function freshDaybook() {
  return {
    /** 한국 시간 날짜 · 후보 6 · 고른 번호(비면 앞의 3개) · 셋 다 한 상자 받았나 */
    day: '',
    cands: [] as DaybookCand[],
    picked: [] as number[],
    box: false,
    /** 한국 시간 주 · 이번 주 완료 수 · 받은 주간 상자(7·14·21) */
    week: '',
    weekN: 0,
    weekBox: [] as number[],
    /** 장부용 누적 기록 (손님 맞이·원정 보내기·강화·장식 놓기 — progress.track이 센다) */
    cnt: {} as Record<string, number>,
  };
}
export type DaybookState = ReturnType<typeof freshDaybook>;

/** CHECKIN §D2 여관 연감: P.almanac */
export function freshAlmanac() {
  return {
    /** 시즌 id · 모은 도장 · 받은 칸(1~30) · 지난 시즌에서 넘어온 도장(다음 시즌 시작 때 더함) */
    season: '',
    stamps: 0,
    claimed: [] as number[],
    carry: 0,
    /** 시즌을 닫았나(넘길 도장 계산 · 못 받은 칸 우편) · 30칸 칭호 */
    closed: '',
    title: false,
    /** 받은 업적 수 (시즌 중 업적 도장 · 같은 업적을 두 번 세지 않게 id) */
    ach: [] as string[],
  };
}
export type AlmanacState = ReturnType<typeof freshAlmanac>;
