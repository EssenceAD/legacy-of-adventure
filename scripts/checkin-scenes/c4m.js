// §C4 빨간 점: 메뉴 격자 칸 (우편함 · 원정 · 텃밭 · 업적 …)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P, w = window.__world;
P.meta.mail.unshift({ id: 99001, at: Date.now(), claimed: false, from: 'system', title: '안 읽은 편지', body: '시험', reward: {} });
const g = (w.home?.objs ?? w.objs).find((o) => o.kind === 'garden');
if (g?.plots?.[0]) Object.assign(g.plots[0], { crop: 'carrot', at: 1 });
window.__openMenu();
await T(300);
