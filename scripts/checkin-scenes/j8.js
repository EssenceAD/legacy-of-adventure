// CHECKIN §J8 건물 머리 위 상태 말풍선 — 다 자란 텃밭 · 축복 없는 예배당 · (저장 그대로의 원정·대장간·연못) · 텃밭 쪽으로 카메라
const P = window.__P, W = window.__world, V = window.__view;
const g = W.objs.find((o) => o.kind === 'garden');
if (g) { g.plots ??= []; while (g.plots.length < 3) g.plots.push({ crop: null, at: 0 }); g.plots[0].crop = 'carrot'; g.plots[0].at = 0; }
if (P.gs) P.gs.blessUntil = 0;
window.__S.gold = Math.max(window.__S.gold, 1e7);
window.__bld?.refresh();
const t = g ?? W.objs.find((o) => o.kind === 'inn');
const mid = 16, cx = t.tx + t.fw / 2, cy = t.ty + t.fh / 2;
V.cam.x = (cx - cy - 0) * 16 - 0; V.cam.y = (cx + cy - 2 * mid) * 8;
await new Promise((r) => setTimeout(r, 900));
