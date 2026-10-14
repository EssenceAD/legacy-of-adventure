// save: C:/projects/legacy-of-adventure/tests/fixtures/real_hyeongcheol.json
// legendFrame: 대장간 영웅 줄(smithOne · 작은 판) — 전설 영웅 금테 · 영웅 보라 · 전설 손님 주황
const T = (ms) => new Promise((r) => setTimeout(r, ms));
if (window.__LF_ON !== undefined) window.__flag('legendFrame', !!window.__LF_ON);
const W = window.__world;
const P = window.__P;
const L = (k) => W.actors.find((a) => a.legendId === k);
// 줄 앞쪽에 넷이 다 보이게 ★ (엘리시아 · 오스윈 · 루나 · 체리)
P.growth.favs = [L('elysia').id, W.actors.find((a) => a.heroId === 'oswin').id, L('luna').id, W.actors.find((a) => a.name === '체리').id];
window.__showObj(W.objs.find((o) => o.kind === 'smith'));
await T(500);
if (!document.querySelector('.smo-heroes')) document.querySelector('#winB .tabs .tab[data-t="1"]')?.click();
await T(400);
