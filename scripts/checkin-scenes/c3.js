// §C3 「다녀오셨어요」 카드: 8일 만에 들어온 것처럼 (오랜만 선물 상자 + 그동안 바뀐 것) — 끄면 예전 「그동안 마을에서는…」
const T = (ms) => new Promise((r) => setTimeout(r, ms));
window.__offline(8 * 86400);
await T(1200);
