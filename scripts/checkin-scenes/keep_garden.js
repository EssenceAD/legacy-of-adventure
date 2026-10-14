// save: tests/fixtures/real_hyeongcheol.json
// 물약 재료 남겨 두기: 텃밭 창 창고 줄 「오늘 주점 −n」
const w = window.__world;
const P = window.__P;
Object.assign(P.crops, { herb: 30, starflower: 36, carrot: 10, pumpkin: 4, cabbage: 15, wheat: 10 });
const d = new Date();
P.tavernAte = { day: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, n: { carrot: 9, pumpkin: 12, cabbage: 20, wheat: 16 } };
const g = (w.home?.objs ?? w.objs).find((o) => o.kind === 'garden');
if (g) window.__showObj(g);
