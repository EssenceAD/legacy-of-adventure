// CHECKIN §D1 오늘의 장부 (6중3 · 탭: 오늘의 장부·오늘의 목표·마을 부탁·이번 주) — 옛 빌드: 메뉴 격자(오늘의 목표 칸)
const W = (ms) => new Promise((r) => setTimeout(r, ms));
if (window.__hv) {
  window.__hv.now(Date.parse('2026-10-25T13:00:00+09:00'));
  window.__P.harvest.opened = true;
  window.__P.meta.duskFirst = true;
  await W(300);
  window.__hv.book(0);
} else window.__openMenu();
await W(500);
