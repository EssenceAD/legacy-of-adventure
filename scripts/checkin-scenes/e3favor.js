// CHECKIN §J3 부탁 한 줄 카드: 게시판 「마을 부탁」 탭 — 아이콘 · 진행 막대 · 보상 칸(선물 상자) · [받기]/[바꾸기]
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const el = document.createElement('button');
el.dataset.goboard = '1';
document.body.appendChild(el);
el.click();
el.remove();
await T(700);
document.querySelector('[data-bt="1"]')?.click();
await T(500);
for (let i = 0; i < 10 && !document.querySelector('#dlg').hidden; i++) { document.querySelector('#dlg').click(); await T(200); }
await T(500);
if (!document.querySelector('.fvrow')) { document.querySelector('[data-bt="1"]')?.click(); await T(600); }
