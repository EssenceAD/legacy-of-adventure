// CHECKIN §B-2: 첫 원정 파티 창 — 원정 0번 상태로 돌려 장부 「30초 정찰」 카드 → 게시판 → ★ 첫 의뢰 (5번째 자리 아직 잠김)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P;
P.meta.slot5 = false;
P.meta.slot5Seen = false;
P.counters.regionWins.mine = 0;
P.hunt.best.mine = 0;
P.counters.expeditions = 0;
if (!P.quests.list.some((q) => q.tutorial)) P.quests.list.unshift({ id: P.quests.nextId++, region: 'forest', tier: 0, power: 30, minutes: 0.5, gold: [60, 60], tutorial: true, name: '30초 정찰' });
P.guide.idx = 2; // c1_scout
P.guide.cut = 99;
await T(700);
document.querySelector('#mission').click();
await T(500);
document.querySelector('.quest.tut')?.click();
await T(400);
