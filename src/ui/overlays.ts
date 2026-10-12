// HOTFIX20 §1: 화면 전환(사냥·토벌·이웃 방문·사진 모드·컷신) 때 남은 오버레이를 한 번에 정리
//  각 오버레이(단골 제안 카드 등)가 정리 함수를 등록하고, 전환하는 쪽은 clearOverlays()만 부른다
const cleaners = new Set<(why: string) => void>();
export function onClearOverlays(fn: (why: string) => void) {
  cleaners.add(fn);
}
/** 전환 화면이 뜨는 동안(불러오는 중) 대기 이벤트가 다시 튀어나오지 않게 잠깐 붙잡는다 */
let holdUntil = 0;
export const overlayHold = () => Date.now() < holdUntil;
export function clearOverlays(why = 'switch') {
  holdUntil = Date.now() + 3000;
  for (const f of cleaners) {
    try {
      f(why);
    } catch {
      /* 하나가 실패해도 나머지는 정리 */
    }
  }
}
