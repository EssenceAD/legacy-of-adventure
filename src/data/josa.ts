// 한국어 조사: 이름 끝 글자 받침에 맞춰 이/가 · 은/는 · 을/를 · 와/과 · (으)로
const batchim = (w: string): number => {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return 0;
  return (c - 0xac00) % 28;
};

/** word 뒤에 붙일 조사. j는 아무 쪽이나 (예: '가', '이(가)', '로') */
export function josa(word: string, j: string): string {
  const b = batchim(word);
  if (j === '이' || j === '가' || j === '이(가)') return b ? '이' : '가';
  if (j === '은' || j === '는' || j === '은(는)') return b ? '은' : '는';
  if (j === '을' || j === '를' || j === '을(를)') return b ? '을' : '를';
  if (j === '와' || j === '과' || j === '과(와)' || j === '와(과)') return b ? '과' : '와';
  if (j === '으로' || j === '로' || j === '(으)로') return b && b !== 8 ? '으로' : '로';
  return j;
}

/** "{a}가 {b}와 …" 처럼 자리표시 뒤 조사까지 맞춰 채운다 */
export function fillNames(s: string, vals: Record<string, string>): string {
  return s.replace(/\{(\w+)\}(이\(가\)|은\(는\)|을\(를\)|과\(와\)|와\(과\)|\(으\)로|으로|이|가|은|는|을|를|와|과|로)?/g, (m, k: string, j?: string) => {
    const w = vals[k];
    if (w === undefined) return m;
    return w + (j ? josa(w, j) : '');
  });
}
