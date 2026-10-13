// L1 화면 보호 모드 (전: 그냥 마을 · 후: 아주 어두운 마을 + 가운데 작은 판)
const W = (ms) => new Promise((r) => setTimeout(r, ms));
window.__ss?.enter();
await W(2500);
