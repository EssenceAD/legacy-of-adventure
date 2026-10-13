// §C4 빨간 점: 끝난 원정 · 안 읽은 편지 · 다 자란 텃밭 · 안 본 장식 — 마을 화면 아래 버튼
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P, w = window.__world;
const a = w.actors.find((x) => (x.status === 'regular' || x.status === 'hero') && x.runId == null && !x.leaving);
const id = 990002;
P.runs.push({ id, quest: { ...P.quests.list[0] }, members: [a.id], start: Date.now() - 120000, end: Date.now() - 500 });
a.runId = id;
P.meta.mail.unshift({ id: 99001, at: Date.now(), claimed: false, from: 'system', title: '안 읽은 편지', body: '시험', reward: {} });
const g = (w.home?.objs ?? w.objs).find((o) => o.kind === 'garden');
if (g?.plots?.[0]) Object.assign(g.plots[0], { crop: 'carrot', at: 1 });
for (let i = 0; i < 20 && !P.runs.find((r) => r.id === id)?.result; i++) await T(250);
// 저절로 뜨는 보고서 대화는 닫는다
for (let i = 0; i < 30 && (!document.querySelector('#dlg').hidden || document.querySelector('#win').classList.contains('on')); i++) {
  if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click();
  else document.querySelector('#winX').click();
  await T(150);
}
await T(1200);
