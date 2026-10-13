// CHECKIN §B-3: 장비 임무 바로가기 — 낀 희귀 장비를 잠깐 빼서(미완료) · 손님 창을 「방문」 탭에 두고 닫은 뒤, 장부 「희귀 장비 장착하기」 카드를 누름
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P, w = window.__world;
for (const it of P.bag) if (it.owner != null && it.grade !== 'n') {
  const a = w.actors.find((x) => x.id === it.owner);
  if (a && a.equip?.[it.slot] === it.id) delete a.equip[it.slot];
  it.owner = null;
}
P.guide.idx = 4; // c1_equip
P.guide.cut = 99;
window.__openGuests();
await T(300);
document.querySelectorAll('#gT .tab')[1]?.click();
await T(300);
document.querySelector('#winX').click();
await T(500);
document.querySelector('#mission').click();
await T(500);
