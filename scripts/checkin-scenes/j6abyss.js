// save: tests/fixtures/real_woongs.json
// CHECKIN §J6: 끝없는 심연 파티 (웅스) — 원정 중 · 지침 표시 · [추천 편성](후)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const P = window.__P;
P.hunt.best.deep = Math.max(10, P.hunt.best.deep ?? 0);
const hs = W.actors.filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).sort((a, b) => window.__power(b) - window.__power(a));
P.runs.push({ id: 9904, start: Date.now() - 60e3, end: Date.now() + 181e3, members: [hs[2].id], quest: { id: 9904, region: 'forest', tier: 0, power: 10, minutes: 4, gold: [1, 1] } });
hs[2].runId = 9904;
hs[5].hp = 12;
window.__abyss.open();
await T(500);
for (let i = 0; i < 5 && !document.querySelector('#dlg').hidden; i++) { document.querySelector('#dlg').click(); await T(300); }
await T(700);
document.querySelector('#abRec')?.click();
await T(1300);
