// K6 원정 보고서 [다시 보내기]: 끝난 원정 → 게시판 「보고서 보기」 (켜면 대화 없이 바로 카드)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P, w = window.__world;
const ms = w.actors.filter((x) => (x.status === 'regular' || x.status === 'hero') && x.runId == null && !x.leaving).slice(0, 3);
const q = P.quests.list.find((x) => !x.tutorial) ?? P.quests.list[0];
// 같은 지역·길이 의뢰가 하나 더 붙어 있게 (다시 보낼 곳)
P.quests.list.push({ ...q, id: 990100 });
const id = 990003;
P.runs.push({ id, quest: { ...q }, members: ms.map((a) => a.id), start: Date.now() - 120000, end: Date.now() - 500 });
for (const a of ms) { a.runId = id; a.hp = 100; }
for (let i = 0; i < 20 && !P.runs.find((r) => r.id === id)?.result; i++) await T(250);
for (const a of ms) a.hp = 100;
for (let i = 0; i < 30 && (!document.querySelector('#dlg').hidden || document.querySelector('#win').classList.contains('on')); i++) {
  if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click();
  else document.querySelector('#winX').click();
  await T(150);
}
document.querySelector('#bExp').click();
await T(500);
document.querySelector(`.run.done[data-run="${id}"]`)?.click();
await T(400);
for (let i = 0; i < 30 && !document.querySelector('#dlg').hidden; i++) { document.querySelector('#dlg').click(); await T(150); }
await T(300);
