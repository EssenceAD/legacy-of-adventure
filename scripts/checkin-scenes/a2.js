// CHECKIN §A2: 단골 제안 2명 — 전(바로 대화가 끼어듦) / 후(「📖 새 이야기 2」 배지 · 오늘 저절로 뜰 몫은 다 쓴 상태)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const vis = () => W.actors.filter((x) => !x.role && x.id && !x.leaving && !x.hidden && x.status === 'visitor' && !x.heroId && !x.legendId);
while (vis().length < 2) window.__arrive('visitor');
const gs = vis().slice(0, 2);
for (const g of gs) g.rarity = 'special';
if (window.__inbox) {
  const d = new Date();
  window.__P.inbox = { day: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, shown: 99 };
  for (const g of gs) window.__inbox.propose(g);
  await T(1200);
} else {
  window.__propose(gs[0]);
  await T(900);
}
