// CHECKIN §J8 확대(화면 배율 2 이상) — 말풍선 옆에 짧은 글 한 줄 · 장면은 j8 과 같음
const P = window.__P, W = window.__world, V = window.__view;
const g = W.objs.find((o) => o.kind === 'garden');
if (g) { g.plots ??= []; while (g.plots.length < 3) g.plots.push({ crop: null, at: 0 }); g.plots[0].crop = 'carrot'; g.plots[0].at = 0; }
if (P.gs) P.gs.blessUntil = 0;
window.__S.gold = Math.max(window.__S.gold, 1e7);
for (let i = 0; i < 4 && V.SC < 2; i++) { document.querySelector('#bZoom').click(); await new Promise((r) => setTimeout(r, 200)); }
window.__bld?.refresh();
const ch = W.objs.find((o) => o.kind === 'chapel') ?? g;
const mid = 16, cx = ch.tx + ch.fw / 2 - 2, cy = ch.ty + ch.fh / 2 - 2;
V.cam.x = (cx - cy) * 16; V.cam.y = (cx + cy - 2 * mid) * 8;
await new Promise((r) => setTimeout(r, 900));
