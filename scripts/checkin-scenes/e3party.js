// save: tests/fixtures/real_woongs.json
// CHECKIN §E 말투: 원정 파티 고르기(영웅 카드 덱) 맨 위 [출발!] → [보내드릴게요] — 폭 360에서 안 꺾이는지
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const el = document.createElement('button');
el.dataset.goboard = '1';
document.body.appendChild(el);
el.click();
el.remove();
await T(700);
(document.querySelector('.quest:not(.tut)') ?? document.querySelector('.quest')).click();
await T(700);
document.querySelector('#pRec')?.click();
await T(1300);
