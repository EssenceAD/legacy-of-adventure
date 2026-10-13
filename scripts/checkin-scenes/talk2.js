// 말 걸기·선물하기 한 함수: 인연 창 [선물하기] → 마을과 같은 선물 고르기 창 (끄면 인연 창 그대로)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
window.__P.gifts.tea = Math.max(2, window.__P.gifts.tea ?? 0);
window.__openMenu();
await T(300);
[...document.querySelectorAll('.mtile')].find((b) => b.querySelector('span')?.textContent === '인연')?.click();
await T(400);
document.querySelector('.tie:not(.lock)')?.click();
await T(400);
document.getElementById('tGift')?.click();
await T(400);
