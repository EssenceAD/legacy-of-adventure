// save: tests/fixtures/real_woongs3.json
// 웅스 건의 「강화 전수」 (enhTransfer): 전 = 대장간 장비 손질 판 (엘리시아 무기 a +15) / 후(lab) = 같은 판 아래 작은 [전수]
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const P = window.__P;
const el = W.actors.find((a) => a.name === '엘리시아') ?? W.actors.filter((a) => !a.role && a.equip?.weapon != null).sort((a, b) => window.__power(b) - window.__power(a))[0];
window.__showObj(W.objs.find((o) => o.kind === 'smith'));
await T(500);
document.querySelector(`.smo-heroes [data-hc="${el.id}"]`)?.click();
await T(300);
document.querySelector('[data-sl="weapon"]')?.click();
await T(300);
document.getElementById('smoPanel')?.scrollIntoView({ block: 'start' });
