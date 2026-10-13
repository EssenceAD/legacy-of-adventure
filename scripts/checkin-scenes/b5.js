// CHECKIN §B-5: 원정 보고서 (전리품 창) — 끝난 원정을 하나 만들어 게시판 「보고서 보기」 → 대화 넘김
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P, w = window.__world;
const a = w.actors.find((x) => (x.status === 'regular' || x.status === 'hero') && x.runId == null && !x.leaving);
const q = P.quests.list[0];
const id = 990001;
P.runs.push({ id, quest: q, members: [a.id], start: Date.now() - 120000, end: Date.now() - 500 });
a.runId = id;
for (let i = 0; i < 20 && !P.runs.find((r) => r.id === id)?.result; i++) await T(250);
P.guide.idx = 2; // c1_scout → 게시판
P.guide.cut = 99;
document.querySelector('#mission').click();
await T(500);
document.querySelector(`.run.done[data-run="${id}"]`)?.click();
await T(400);
for (let i = 0; i < 30 && !document.querySelector('#dlg').hidden; i++) { document.querySelector('#dlg').click(); await T(150); }
await T(300);
