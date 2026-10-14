// HARVEST §1-5 수확제 교환소 (옛 빌드: 같은 자리 = 상점 창)
const W = (ms) => new Promise((r) => setTimeout(r, ms));
if (window.__hv) {
  window.__hv.now(Date.parse('2026-10-25T13:00:00+09:00'));
  window.__P.harvest.opened = true;
  window.__P.meta.duskFirst = true;
  window.__hv.ribbons(120);
  await W(300);
  window.__hv.shop();
} else window.__openMenu();
await W(500);
