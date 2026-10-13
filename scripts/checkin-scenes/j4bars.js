// CHECKIN §J4 남은 시간 막대: 주점(없으면 첫 건물)을 공사 중으로 두고 건물 창 — 전: 초록 막대 + 큰 글자 · 후(lab): 기본 막대 그림 + 작은 남은 시간
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const o = W.objs.find((x) => x.kind === 'tavern') ?? W.objs.find((x) => window.__def(x.kind).up && x.kind !== 'smith' && x.kind !== 'garden' && x.kind !== 'board');
o.con = { kind: 'up', end: Date.now() + 47 * 60 * 1000, total: 90 * 60, to: o.lvl + 1, cut: 0, cost: 1000 };
window.__showObj(o);
await T(600);
