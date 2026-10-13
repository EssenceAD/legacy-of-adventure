// §C3 「다녀오셨어요」 카드: 3시간 만 (선물 없이 4칸 + 모두 받기)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
window.__offline(3 * 3600);
await T(600);
