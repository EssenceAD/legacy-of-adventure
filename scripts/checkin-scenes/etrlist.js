// save: tests/fixtures/real_woongs3.json
// 웅스 건의 「강화 전수」 (enhTransfer · 목록만): [전수] → 목록 (이 장비가 받기 · 주기)
//  (보여 주려고 별빛 가루·부적을 비용만큼 채움 — 웅스 실세이브는 별빛 가루 4,410 · 부적 0 이라 실제론 「가루가 모자라요」)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const P = window.__P;
P.dust.a = Math.max(P.dust.a, 20000);
P.growth.charm = Math.max(P.growth.charm, 1);
const el = W.actors.find((a) => a.name === '엘리시아') ?? W.actors.filter((a) => !a.role && a.equip?.weapon != null).sort((a, b) => window.__power(b) - window.__power(a))[0];
window.__showObj(W.objs.find((o) => o.kind === 'smith'));
await T(500);
document.querySelector(`.smo-heroes [data-hc="${el.id}"]`)?.click();
await T(300);
document.querySelector('[data-sl="weapon"]')?.click();
await T(300);
document.getElementById('smoTf')?.click();
await T(400);

await T(600);
