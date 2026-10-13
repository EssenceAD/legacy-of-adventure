// save: tests/fixtures/real_woongs.json
// CHECKIN §J6: 단골 제안 카드 — 제안하는 손님을 영웅 카드로 (특별 등급 · 자세히 모드)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const vis = () => W.actors.filter((x) => !x.role && x.id && !x.leaving && !x.hidden && x.status === 'visitor' && !x.heroId && !x.legendId);
while (vis().length < 1) window.__arrive('visitor');
const g = vis()[0];
g.rarity = 'special';
window.__propose(g);
await T(1200);
