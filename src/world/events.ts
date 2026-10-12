// 이벤트 줄: 단골 제안 · 케미 대화 · 영웅 등장 · 원정 보고서처럼 "대화창이나 창을 여는 일"을
// 한 번에 하나씩, 다른 창이 없을 때만 차례로 띄운다. (main 루프가 pumpEvents를 부른다)
const queue: { key?: string; run: () => void }[] = [];

/** key가 같으면 중복으로 넣지 않는다 */
export function queueEvent(run: () => void, key?: string) {
  if (key && queue.some((q) => q.key === key)) return;
  queue.push({ key, run });
}

export const pendingEvents = () => queue.length;
/** HOTFIX20 §2: 끊긴 제안은 대기열 맨 앞으로 (같은 키가 있으면 그걸 앞으로) */
export function queueEventFront(run: () => void, key?: string) {
  const i = key ? queue.findIndex((q) => q.key === key) : -1;
  if (i >= 0) queue.splice(i, 1);
  queue.unshift({ key, run });
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

/** busy가 아니면 하나 꺼내 실행 */
export function pumpEvents(busy: boolean) {
  if (busy || !queue.length) return;
  queue.shift()!.run();
}

export function clearEvents() {
  queue.length = 0;
}
