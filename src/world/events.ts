// 이벤트 줄: 단골 제안 · 케미 대화 · 영웅 등장 · 원정 보고서처럼 "대화창이나 창을 여는 일"을
// 한 번에 하나씩, 다른 창이 없을 때만 차례로 띄운다. (main 루프가 pumpEvents를 부른다)
// CHECKIN §A2 (플래그 storyInbox): 곁이야기(키 앞머리 SIDE_PREFIXES)는 「모아 두기」 — 하루 몇 개까지만 저절로, 나머지는 배지에서 하나씩
type Ev = { key?: string; run: () => void; alive?: () => boolean; now?: boolean };
const queue: Ev[] = [];

/** 모아 두기 대상: 단골 제안 · 케미 대화 · 인연(사이) 단계 · 주인 과거(불씨 독백·옛 인연 재회·앞 주인 편지) */
export const SIDE_PREFIXES = ['prop', 'chem:', 'tie:', 'ember', 'reunion:', 'letter'] as const;
export const isSideKey = (key?: string) => !!key && SIDE_PREFIXES.some((p) => key.startsWith(p));
const isSide = (e: Ev) => !e.now && isSideKey(e.key);

/**
 * 모아 보기 정책 (main이 켠다 · 기본 = 예전처럼 전부 바로)
 *  collect(): 지금 모아 두기인가 · shownToday(): 오늘 저절로 띄운 곁이야기 수 · markShown(): 하나 띄웠음 · cap(): 하루 최대
 */
export const eventPolicy = {
  collect: () => false,
  shownToday: () => 0,
  markShown: () => {},
  cap: () => 2,
};

/** key가 같으면 중복으로 넣지 않는다 · alive가 false가 되면(손님이 떠남 등) 모아 보기에서 조용히 빠진다 */
export function queueEvent(run: () => void, key?: string, alive?: () => boolean) {
  if (key && queue.some((q) => q.key === key)) return;
  queue.push({ key, run, alive });
}

/** 유효하지 않게 된 이벤트를 조용히 뺀다 (토스트 없음) */
function purge() {
  for (let i = queue.length - 1; i >= 0; i--) {
    const a = queue[i].alive;
    if (a && !a()) queue.splice(i, 1);
  }
}

export const pendingEvents = () => queue.length;
/** HOTFIX20 §2: 끊긴 제안은 대기열 맨 앞으로 (같은 키가 있으면 그걸 앞으로) — 이미 보던 것이라 모아 두지 않고 바로 다시 */
export function queueEventFront(run: () => void, key?: string) {
  const i = key ? queue.findIndex((q) => q.key === key) : -1;
  if (i >= 0) queue.splice(i, 1);
  queue.unshift({ key, run, now: true });
}
/** 키가 이 앞머리로 시작하는 대기 이벤트 수 */
export const pendingWith = (prefix: string) => queue.filter((q) => q.key?.startsWith(prefix)).length;
/** 그 앞머리의 첫 이벤트를 바로 실행 (배지 누르기) */
export function runFirstWith(prefix: string): boolean {
  const i = queue.findIndex((q) => q.key?.startsWith(prefix));
  if (i < 0) return false;
  queue.splice(i, 1)[0].run();
  return true;
}
/** 이 키의 이벤트가 대기 중인가 */
export const hasEvent = (key: string) => queue.some((q) => q.key === key);
/** 이 키의 이벤트를 조용히 뺀다 */
export function dropEvent(key: string) {
  const i = queue.findIndex((q) => q.key === key);
  if (i >= 0) queue.splice(i, 1);
}

/** §A2: 모아 둔 곁이야기 수 (배지 숫자) */
export function pendingSide(): number {
  purge();
  return queue.filter(isSide).length;
}
/** §A2: 배지 누르기 — 모아 둔 것 하나 보기 */
export function runFirstSide(): boolean {
  purge();
  const i = queue.findIndex(isSide);
  if (i < 0) return false;
  queue.splice(i, 1)[0].run();
  return true;
}

/** busy가 아니면 하나 꺼내 실행 (모아 보기: 바로 볼 것 먼저 · 곁이야기는 하루 cap개까지만 저절로) */
export function pumpEvents(busy: boolean) {
  if (busy || !queue.length) return;
  if (!eventPolicy.collect()) {
    queue.shift()!.run();
    return;
  }
  purge();
  const i = queue.findIndex((q) => !isSide(q));
  if (i >= 0) {
    queue.splice(i, 1)[0].run();
    return;
  }
  if (!queue.length || eventPolicy.shownToday() >= eventPolicy.cap()) return;
  eventPolicy.markShown();
  queue.shift()!.run();
}

export function clearEvents() {
  queue.length = 0;
}
