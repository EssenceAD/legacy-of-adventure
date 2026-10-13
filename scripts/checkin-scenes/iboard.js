// save: C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad/gs3/save_03.json
// 게시판 레벨업: 의뢰 창 맨 위 「파티 n/m · 게시판 Lv.x」 줄 + [게시판 Lv.2 · 300 G] (파티 꽉 차면 반짝 · 안내 한 줄)
const W = window.__world;
const b = (W.home?.objs ?? W.objs).find((o) => o.kind === 'board');
if (b) b.lvl = 1;
window.__S.gold = Math.max(window.__S.gold, 5000);
window.__showObj(b ?? W.objs.find((o) => o.kind === 'dungeon'));
