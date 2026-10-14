// save: tests/fixtures/real_woongs.json
// CHECKIN §E 체크아웃 영수증: 끝난 원정(희귀 이상 장비 확정 · 4시간 의뢰) → 대화를 넘기면 보고서 창 — 후 = 영수증 한 장(희귀 이상 줄 금빛) · 제목 「다녀오셨어요 · 지역」
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P, w = window.__world;
const ms = w.actors.filter((x) => (x.status === 'regular' || x.status === 'hero') && x.runId == null && !x.leaving).slice(0, 3);
const q = P.quests.list.find((x) => !x.tutorial && !x.guild) ?? P.quests.list[0];
const id = 990401;
P.runs.push({ id, quest: { ...q, tier: 5 }, members: ms.map((a) => a.id), start: Date.now() - 120000, end: Date.now() - 500 });
for (const a of ms) { a.runId = id; a.hp = 100; }
for (let i = 0; i < 40 && !P.runs.find((r) => r.id === id)?.result; i++) await T(250);
for (let i = 0; i < 60; i++) {
  const t = document.querySelector('#win.on #winT')?.textContent ?? '';
  if (/다녀오셨어요 ·|원정 보고서/.test(t)) break;
  if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click();
  else if (t) document.querySelector('#winX').click();
  await T(120);
}
await T(1200);
