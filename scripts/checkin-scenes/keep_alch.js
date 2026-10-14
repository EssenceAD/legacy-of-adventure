// save: tests/fixtures/real_hyeongcheol.json
// 물약 재료 남겨 두기: 연금술 공방 창 (로또1등 여관 · 채소 0 · 오늘 주점이 먹은 수)
const w = window.__world;
const P = window.__P;
Object.assign(P.crops, { herb: 30, starflower: 36, carrot: 0, pumpkin: 1, cabbage: 0, wheat: 0 });
const d = new Date();
P.tavernAte = { day: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, n: { carrot: 9, pumpkin: 12, cabbage: 20, wheat: 16 } };
const a = (w.home?.objs ?? w.objs).find((o) => o.kind === 'alchemy');
if (a) window.__showObj(a);
