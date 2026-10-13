// save: tests/fixtures/real_woongs.json
// CHECKIN §J6: 원정 파티 고르기 (웅스 · 단골·영웅 19명) — 한 명은 원정 중(흐린 카드 「원정 중 3분」) · 한 명은 지침(「쉬는 중」) · [추천 편성] 누른 뒤
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const P = window.__P;
const hs = W.actors.filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).sort((a, b) => window.__power(b) - window.__power(a));
const away = hs[2];
P.runs.push({ id: 9901, start: Date.now() - 60e3, end: Date.now() + 181e3, members: [away.id], quest: { id: 9901, region: 'forest', tier: 0, power: 10, minutes: 4, gold: [1, 1] } });
away.runId = 9901;
hs[hs.length - 1].hp = 12;
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
