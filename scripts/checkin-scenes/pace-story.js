// save: tests/fixtures/real_pace_meoribak.json
// PACE §3-1: 마을 화면 「다음 이야기」 줄 — 전 「40일차 (지금 33일차)」 → 후 「○일 뒤 (또는 40일차)」 (소식 띠면 그 칸이 돌 때까지 기다림)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 20; i++) {
  const band = document.querySelector('.newsband, #newsBand, #storyWait');
  if (band && /다음 이야기/.test(band.textContent)) break;
  await T(500);
}
