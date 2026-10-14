// CHECKIN §E 첫 원정 열쇠 건네기: 원정을 한 번도 안 보낸 것처럼 → 첫 의뢰 [출발] — 후 = 열쇠 그림이 건네지는 0.6초(흔들림 끔·기본 0.3초) (사진은 누른 지 약 0.15초)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P;
P.counters.expeditions = 0;
const el = document.createElement('button');
el.dataset.goboard = '1';
document.body.appendChild(el);
el.click();
el.remove();
await T(700);
(document.querySelector('.quest:not(.tut)') ?? document.querySelector('.quest')).click();
await T(700);
document.querySelector('#pRec')?.click();
await T(700);
setTimeout(() => document.querySelector('#pGo')?.click(), 550);
