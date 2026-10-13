// save: tests/fixtures/real_woongs.json
// CHECKIN §J6: 토벌 준비 (웅스) — 방문 중인 전설(엘리시아)이 동행으로 후보에 · 원정 중 · 쉬는 중은 흐리게 + 이유 · [추천 편성](후)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const P = window.__P;
const hs = W.actors.filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).sort((a, b) => window.__power(b) - window.__power(a));
P.runs.push({ id: 9903, start: Date.now() - 60e3, end: Date.now() + 181e3, members: [hs[1].id], quest: { id: 9903, region: 'forest', tier: 0, power: 10, minutes: 4, gold: [1, 1] } });
hs[1].runId = 9903;
hs[3].hp = 12;
await window.__openRaid();
await T(900);
document.querySelector('#rRec')?.click();
await T(1300);
