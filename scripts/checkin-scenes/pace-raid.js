// save: tests/fixtures/real_pace_meoribak.json
// PACE §1: 도전장으로 고른 2번째 보스 토벌 창 — 맨 위 「이번 주 2/3 · 다음: 도전장 고르기」 · 아래 「도전장 보스 · 금화·재료 ×0.5 · 랭킹엔 안 들어가요」 (전: 이번 주 보스 창 그대로)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
document.getElementById('bExp').click();
await T(900);
const c = document.querySelector('[data-chal]');
if (c) c.click();
else document.getElementById('rWeek')?.click();
await T(900);
