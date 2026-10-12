// DIRECTION §2-3: 소문 보내기 — 욕설·링크 거르기 (서버 submit_rumor도 같은 목록 + 채팅 금칙어로 다시 본다)
//  띄어쓰기·기호·숫자를 지우고 본다 (「시 1 발」 같은 것도 걸리게) · 흔한 낱말이 걸리지 않게 짧은 목록만

/** 금칙어 (소문자 · 띄어쓰기 없이) */
export const BAD_WORDS = [
  '시발', '씨발', '씨빨', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '븅신', '좆', '존나', '개새끼', '개색', '미친놈', '미친년', '느금', '니애미', '니애비', '엠창',
  'fuck', 'shit', 'bitch', 'asshole',
];

/** 비교용으로 고르기: 소문자 · 띄어쓰기·기호·숫자 지우기 */
export const normBad = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}0-9]/gu, '');

export function hasBadWord(s: string): boolean {
  const n = normBad(s);
  return BAD_WORDS.some((w) => n.includes(w));
}

const LINK = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|kr|io|gg|me)\b)/i;

/** 소문 한 줄 검사 → 문제가 있으면 안내 문구 (없으면 null) · 서버 오류 코드와 같은 말 */
export function rumorProblem(s: string, max = 40): string | null {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return '한 줄을 적어 주세요';
  if ([...t].length > max) return `${max}자까지 쓸 수 있어요`;
  if (LINK.test(t)) return '링크는 보낼 수 없어요';
  if (hasBadWord(t)) return '쓸 수 없는 말이 들어 있어요';
  return null;
}
