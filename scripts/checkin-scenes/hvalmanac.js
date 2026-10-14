// CHECKIN §D2 여관 연감 시즌 1 (30칸 · 도장 13개 · 받은 칸 3) — 옛 빌드: 메뉴 격자
const W = (ms) => new Promise((r) => setTimeout(r, ms));
if (window.__hv) {
  window.__hv.now(Date.parse('2026-10-25T13:00:00+09:00'));
  window.__P.harvest.opened = true;
  window.__P.meta.duskFirst = true;
  const a = window.__hv.al();
  a.stamps = 13;
  a.claimed = [1, 2, 3];
  await W(300);
  window.__hv.almanac();
} else window.__openMenu();
await W(500);
