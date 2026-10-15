// 10/16 이카몰리 「펫이름 작성에 에러」 — 한글 IME 조합 중 Enter
//  조합 중 Enter(isComposing · keyCode 229)는 「글자 확정」이지 「보내기」가 아니다.
//  예전: 펫 이름 칸이 조합 중 Enter에도 저장 → 마지막 글자 빠짐 · 저장이 두 번 돌아 두 번째엔 칸이 사라져 기본 이름으로 되돌아감
//  · isImeEnter: 조합 중 Enter인가 · submitEnter: 보내도 되는 Enter인가
//  · installImeGuard: <form> 안 입력 칸에서 조합 중 Enter로 폼이 제출되지 않게 (사파리는 확정 Enter에 바로 submit)

/** 한글 등 IME 조합 중에 눌린 Enter */
export const isImeEnter = (e: KeyboardEvent): boolean => e.key === 'Enter' && (e.isComposing || e.keyCode === 229);
/** 보내기로 받아도 되는 Enter (조합 확정 Enter는 아님) */
export const submitEnter = (e: KeyboardEvent): boolean => e.key === 'Enter' && !isImeEnter(e);

let installed = false;
export function installImeGuard() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener(
    'keydown',
    (e) => {
      if (!isImeEnter(e)) return;
      const t = e.target as HTMLElement | null;
      // 폼의 암묵적 제출(Enter)만 막는다 — 조합 확정 자체는 브라우저가 그대로 한다
      if (t && (t as HTMLInputElement).form) e.preventDefault();
    },
    true,
  );
}

/** 글자 수 (한글·이모지 한 글자 = 1) */
export const charLen = (s: string) => [...s].length;
