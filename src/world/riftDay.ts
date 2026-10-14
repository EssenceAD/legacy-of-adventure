// RAIDWEAPON §3' 하늘 균열의 「하루」 — 한국 시각에서 5시간을 뺀 날짜 (05:00 KST 에 바뀜 · 서버 world_day 와 같은 규칙)
//  가져오는 것 없음 (meta.ts 칭호 · world/rift.ts · net 이 같이 쓴다)

/** 'YYYY-MM-DD' — t 시각(ms)이 속한 균열의 하루 */
export function riftDay(t: number): string {
  const d = new Date(t + 9 * 3600000 - 5 * 3600000);
  return d.toISOString().slice(0, 10);
}
/** 다음 05:00 KST (ms) */
export function nextRiftReset(t: number): number {
  const day = riftDay(t);
  return Date.parse(`${day}T05:00:00+09:00`) + 864e5;
}
