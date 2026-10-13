// 텃밭 창 맨 위: 정보 한 줄(actionsTidy) · 「텃밭 Lv.x · 밭 n칸」 + [텃밭 Lv.x+1 · 비용] (gardenLevelUp)
const w = window.__world;
window.__S.gold = Math.max(window.__S.gold, 5000);
const g = (w.home?.objs ?? w.objs).find((o) => o.kind === 'garden');
if (g) window.__showObj(g);
