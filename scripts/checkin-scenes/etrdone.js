// save: tests/fixtures/real_woongs3.json
// 웅스 건의 「강화 전수」 (enhTransfer · 후만): 확인 시트 [전수하기] → 대장간으로 돌아와 받은 장비 칸에 도장 「쿵」 (+ 알림 한 줄)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const P = window.__P;
P.dust.a = Math.max(P.dust.a, 20000); // 웅스 실세이브 4,410 → 비용 7,440 보다 많게
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
document.querySelector('#tfGive [data-tgo]:not([disabled])')?.click();
await T(600);
document.getElementById('cshOk')?.click();
await T(150);
