// save: tests/fixtures/real_woongs.json
// CHECKIN §J3 의뢰 한 줄 카드: 게시판 — 진행 중 원정(진행 막대) · 돌아온 원정([받기]) · 오늘의 의뢰(아이콘 · 보상 칸 상자 + 금화)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P, w = window.__world;
const hs = w.actors.filter((x) => (x.status === 'regular' || x.status === 'hero') && x.runId == null && !x.leaving);
const q = P.quests.list.find((x) => !x.tutorial && !x.guild) ?? P.quests.list[0];
P.runs.push({ id: 990501, quest: { ...q }, members: [hs[0].id, hs[1].id], start: Date.now() - 60e3, end: Date.now() + 120e3 });
hs[0].runId = hs[1].runId = 990501;
const el = document.createElement('button');
el.dataset.goboard = '1';
document.body.appendChild(el);
el.click();
el.remove();
await T(900);
document.querySelector('#winB .qhd:nth-of-type(3), #winB .runs')?.scrollIntoView({ block: 'start' });
await T(300);
