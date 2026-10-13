// save: C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad/gs3/save_03.json
// 게시판 레벨업 · 파티가 꽉 찼을 때: 버튼 반짝 + 「파티가 꽉 찼어요 · 게시판을 Lv.2로 올리면 1파티 더」
const W = window.__world, P = window.__P;
const b = (W.home?.objs ?? W.objs).find((o) => o.kind === 'board');
if (b) b.lvl = 1;
window.__S.gold = Math.max(window.__S.gold, 5000);
const q = P.quests.list[0];
const now = Date.now();
while (P.runs.filter((r) => !r.result).length < 3) P.runs.push({ id: 9000 + P.runs.length, quest: { ...q }, members: [], start: now, end: now + 36e5 });
window.__showObj(b);
