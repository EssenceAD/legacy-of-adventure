// CHECKIN §B-1: 장부 임무 「모닥불 짓기」 카드를 눌러 건설 창이 열린 모습 (모닥불을 잠깐 치워 미완료 상태로)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P, w = window.__world;
for (let i = w.objs.length - 1; i >= 0; i--) if (w.objs[i].kind === 'fire') w.objs.splice(i, 1);
P.guide.idx = 1; // c1_fire
P.guide.cut = 99;
await T(700);
document.querySelector('#mission').click();
await T(400);
