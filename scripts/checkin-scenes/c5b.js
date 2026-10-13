// §C5 가방 → [일반·희귀 한 번에 분해] → 확인 창 하나 (끄면 [일괄 분해…] 창)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
window.__openMenu();
await T(300);
[...document.querySelectorAll('.mtile')].find((b) => b.querySelector('span')?.textContent === '가방')?.click();
await T(400);
(document.getElementById('bagTidy') ?? document.getElementById('salAll'))?.click();
await T(400);
