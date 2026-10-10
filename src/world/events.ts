// 이벤트 줄: 단골 제안 · 케미 대화 · 영웅 등장 · 원정 보고서처럼 "대화창이나 창을 여는 일"을
// 한 번에 하나씩, 다른 창이 없을 때만 차례로 띄운다. (main 루프가 pumpEvents를 부른다)
const queue: { key?: string; run: () => void }[] = [];

/** key가 같으면 중복으로 넣지 않는다 */
export function queueEvent(run: () => void, key?: string) {
  if (key && queue.some((q) => q.key === key)) return;
  queue.push({ key, run });
}

export const pendingEvents = () => queue.length;

/** busy가 아니면 하나 꺼내 실행 */
export function pumpEvents(busy: boolean) {
  if (busy || !queue.length) return;
  queue.shift()!.run();
}

export function clearEvents() {
  queue.length = 0;
}
