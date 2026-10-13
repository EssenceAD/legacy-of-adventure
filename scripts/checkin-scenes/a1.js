// CHECKIN §A1: 설정 창 「케미 알림」 옆 — 「단골 제안 받을 손님」 · 「곁이야기」 줄
const T = (ms) => new Promise((r) => setTimeout(r, ms));
window.__openMenu();
await T(400);
const tile = [...document.querySelectorAll('.mtile')].find((b) => b.textContent.trim() === '설정');
tile.click();
await T(500);
const row = document.querySelector('#mPropF') ?? document.querySelector('#mChem');
row.scrollIntoView({ block: 'center' });
await T(200);
