// §C5 가방: 「일반·희귀 한 번에 분해 (n개)」 버튼 (메뉴 → 가방)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
window.__openMenu();
await T(300);
[...document.querySelectorAll('.mtile')].find((b) => b.querySelector('span')?.textContent === '가방')?.click();
await T(400);
