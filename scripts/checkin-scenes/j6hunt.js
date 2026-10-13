// save: tests/fixtures/real_woongs.json
// CHECKIN §J6: 사냥 파티 고르기 (웅스) — 한 명은 원정 중 · 한 명은 지침(사냥은 갈 수 있음 「체력 n · 지쳤어요」)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const P = window.__P;
const hs = W.actors.filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).sort((a, b) => window.__power(b) - window.__power(a));
P.runs.push({ id: 9902, start: Date.now() - 60e3, end: Date.now() + 181e3, members: [hs[1].id], quest: { id: 9902, region: 'forest', tier: 0, power: 10, minutes: 4, gold: [1, 1] } });
hs[1].runId = 9902;
hs[4].hp = 12;
window.__openHunt('forest');
await T(700);
(document.querySelector('.hst.done[data-s="3"]') ?? document.querySelector('.hst[data-s]:not([disabled])')).click();
await T(1000);
