// HARVEST §1-3 · §K2: 수확제 중(10/25) 마을 입구 — 가을 자동 장식 · 왼쪽 아이콘 줄 (옛 빌드는 날짜 강제가 없어 그냥 마을)
const W = (ms) => new Promise((r) => setTimeout(r, ms));
if (window.__hv) {
  window.__hv.now(Date.parse('2026-10-25T13:00:00+09:00'));
  window.__P.harvest.opened = true;
  window.__P.meta.duskFirst = true;
}
const e = window.__ent();
const V = window.__view;
V.cam.x = (e[0] - e[1]) * 16;
V.cam.y = (e[0] + e[1] - 36) * 8;
await W(1500);
