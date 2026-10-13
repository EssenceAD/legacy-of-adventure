// 말 걸기·선물하기 한 함수: 주인 창 → 인연 → 한 사람 (켜면 [말 걸기][선물하기][선물 가게] — 선물은 같은 선물 고르기 창)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
window.__openMenu();
await T(300);
[...document.querySelectorAll('.mtile')].find((b) => b.querySelector('span')?.textContent === '인연')?.click();
await T(400);
document.querySelector('.tie:not(.lock)')?.click();
await T(400);
