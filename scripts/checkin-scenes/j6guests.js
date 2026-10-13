// save: tests/fixtures/real_woongs.json
// CHECKIN §J6: 손님 창 「단골」 탭 (웅스) — 전: 글자 줄 목록 / 후: 영웅 카드 격자 (원정 중 · 쉬는 중 흐리게 · ★)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const P = window.__P;
const hs = W.actors.filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).sort((a, b) => window.__power(b) - window.__power(a));
P.runs.push({ id: 9905, start: Date.now() - 60e3, end: Date.now() + 181e3, members: [hs[1].id], quest: { id: 9905, region: 'forest', tier: 0, power: 10, minutes: 4, gold: [1, 1] } });
hs[1].runId = 9905;
hs[6].hp = 12;
document.querySelector('#bGuest').click();
await T(900);
