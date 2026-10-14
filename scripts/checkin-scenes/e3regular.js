// CHECKIN §E 단골 되는 순간: 단골 제안 → [열쇠 드릴게요]/[단골로 받기] — 후 = 숙박 카드(영웅 카드)에 도장 「쿵」 (사진은 누른 지 약 0.2초)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world, P = window.__P;
const a = W.actors.find((x) => x.status === 'visitor' && !x.leaving && !x.role);
if (a) {
  P.waitlist = [];
  window.__propose(a);
  await T(600);
  for (let i = 0; i < 8 && !document.querySelector('#dChoice button'); i++) { document.querySelector('#dlg')?.click(); await T(250); }
  const btn = [...document.querySelectorAll('#dChoice button')].find((b) => /열쇠 드릴게요|단골로 받기|대신/.test(b.textContent));
  setTimeout(() => btn?.click(), 480);
}
