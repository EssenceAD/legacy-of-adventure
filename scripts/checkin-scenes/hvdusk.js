// HARVEST §2 노을: 게임 18시 (낮 사진) · 21시(밤 사진 자리 — 노을에서 밤으로 넘어가는 중) — 옛 빌드는 같은 시각에 노을 없음
const W = (ms) => new Promise((r) => setTimeout(r, ms));
if (window.__hv) {
  window.__hv.now(Date.parse('2026-10-25T13:00:00+09:00'));
  window.__P.harvest.opened = true;
  window.__P.meta.duskFirst = true;
}
window.__S.clock = window.__S.night ? 15 * 60 : 12 * 60;
window.__S.night = false;
await W(2500);
