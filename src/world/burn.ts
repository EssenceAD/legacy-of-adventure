// RAIDWEAPON §6 (10/15 형철 정정) 오픈 기념 버닝 주말 — flag burnWeekend · 기간·배수 CONFIG.burn
//  판정은 「서버 시각」으로만: flags.json(부팅)·version.json(돌아올 때 · 10분마다) 응답의 HTTP Date 머리 → flags.serverAnchor()
//   · 기준점 + performance.now()로 흐른 시간 (기기 시계를 바꿔도 안 움직임)
//   · 기준점 + 기기 시계로 흐른 시간 (잠자기 동안 performance.now()가 멈추는 브라우저 대비)
//   → 두 추정이 모두 기간 안일 때만 켬. 기기 시계를 앞으로 돌리면 둘째가 틀어지고, 잠자기로 첫째가 뒤처지면 둘째가 막는다.
//  서버 시각을 한 번도 못 받았으면(오프라인 등) 꺼짐 — 기기 시계는 믿지 않는다 (기간 밖에서 켜질 일이 없게 · 다음 version.json 확인 때 다시 받음)
//   Date 머리는 초 단위 + 왕복 지연이라 오차는 몇 초 (1분 안)
//  방치(꺼져 있던 동안) 보상엔 안 붙는다 — 사냥 방치(idleHunt)는 배수 없음 · 의뢰는 「지금 버닝 중 + 그 의뢰가 기간 안에 끝남」일 때만
//  여기는 data·flags만 import한다 (hunt·expeditions·abyss·raid가 부른다)
import { CONFIG } from '../data/config';
import { flag, serverAnchor } from './flags';

export type BurnKind = 'exp' | 'gold' | 'mats' | 'riftFrags';

const B = () => CONFIG.burn;
const KST = 9 * 3600000;
/** 기간 [from, to) ms — end는 그 초까지 포함 */
export function burnWindow(): { from: number; to: number } {
  return { from: Date.parse(B().start), to: Date.parse(B().end) + 1000 };
}
const inWin = (t: number) => {
  const w = burnWindow();
  return t >= w.from && t < w.to;
};
const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** 서버 시각 추정 둘 (기준점이 없으면 null) */
function serverNows(): [number, number] | null {
  const a = serverAnchor();
  if (!a) return null;
  return [a.server + (perfNow() - a.perf), a.server + (Date.now() - a.wall)];
}
/** 지금 서버 시각 (화면 남은 시간용 · 둘 중 이른 쪽) · 모르면 null */
export function burnServerNow(): number | null {
  const n = serverNows();
  return n ? Math.min(n[0], n[1]) : null;
}

/** 버닝 중인가 — at(서버 시각 ms)을 주면 그 시각으로 (시험·균열 정산), 없으면 서버 시각 추정 둘 다 기간 안일 때만 */
export function burnOn(at?: number): boolean {
  if (!flag('burnWeekend')) return false;
  if (at != null) return inWin(at);
  const n = serverNows();
  return !!n && inWin(n[0]) && inWin(n[1]);
}
/** 배수 (꺼져 있으면 1) */
export function burnMult(kind: BurnKind, at?: number): number {
  if (!burnOn(at)) return 1;
  const C = B();
  return kind === 'mats' ? C.mats : kind === 'riftFrags' ? C.riftFrags : C.expGold;
}
/** 토벌 하루 도전 + (꺼져 있으면 0) */
export const burnRaidTries = (at?: number): number => (burnOn(at) ? B().raidTries : 0);
/** 경험치·금화 같은 큰 수: 반올림 */
export const burnRound = (n: number, kind: 'exp' | 'gold', at?: number): number => {
  const m = burnMult(kind, at);
  return m === 1 ? n : Math.round(n * m);
};
/** 재료 개수: ×1.5 · 소수점은 확률로 (1개 → 1 또는 2 · 기댓값 1.5) */
export function burnMats(n: number, rng: () => number = Math.random, at?: number): number {
  const m = burnMult('mats', at);
  if (m === 1 || n <= 0) return n;
  const x = n * m;
  const f = Math.floor(x);
  return f + (rng() < x - f ? 1 : 0);
}

/** 한국 시간 날짜(day: 'YYYY-MM-DD' 또는 'YYYY-M-D')가 기간과 겹치면 균열 조각 배수 (하늘 균열 정산이 부른다 · 플래그 꺼짐 = 1) */
export function burnRiftMult(day: string): number {
  if (!flag('burnWeekend')) return 1;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(day.trim());
  if (!m) return 1;
  const d0 = Date.UTC(+m[1], +m[2] - 1, +m[3]) - KST;
  const w = burnWindow();
  return d0 < w.to && d0 + 86400000 > w.from ? B().riftFrags : 1;
}

/** 남은 시간 글 (「1일 3시간」 · 「3시간 20분」 · 「12분」) · 꺼져 있으면 '' */
export function burnLeftText(at?: number): string {
  if (!burnOn(at)) return '';
  const now = at ?? burnServerNow() ?? Date.now();
  const ms = Math.max(0, burnWindow().to - now);
  const min = Math.ceil(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const mm = min % 60;
  if (d) return `${d}일 ${h}시간`;
  if (h) return `${h}시간 ${mm}분`;
  return `${Math.max(1, mm)}분`;
}
/** 소식 띠 글 (남은 시간은 burnLeftText — 띠는 따로 붙여 잘리지 않게) */
export const burnBandText = (at?: number): string => (burnOn(at) ? '🔥 오픈 기념 버닝 주말 · 경험치·골드 2배' : '');
