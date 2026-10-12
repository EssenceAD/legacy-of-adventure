// DIRECTION §2-1: 반영 크레딧 줄 — 「💌 제보: 웅스 · 고느끼」 (scripts/credits.mjs도 같은 모양으로 찍는다)

/** 버전 비교용: 앞 v · 뒤 -beta 떼기 */
export const normVer = (v: string) => String(v ?? '').trim().replace(/^v/i, '').replace(/-beta$/i, '');

/** 닉네임들 → 한 줄 (겹친 이름·빈 이름 빼고 처음 나온 순서) · 없으면 '' */
export function creditLine(names: readonly string[]): string {
  const seen: string[] = [];
  for (const n of names) {
    const t = String(n ?? '').trim();
    if (t && !seen.includes(t)) seen.push(t);
  }
  return seen.length ? `💌 제보: ${seen.join(' · ')}` : '';
}

/** 서버 행(ver_fixed · nickname) → 버전별 닉네임 */
export function creditsByVer(rows: readonly { ver_fixed: string; nickname: string }[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rows) {
    const v = normVer(r.ver_fixed);
    if (!v) continue;
    const l = m.get(v) ?? [];
    l.push(r.nickname);
    m.set(v, l);
  }
  return m;
}
