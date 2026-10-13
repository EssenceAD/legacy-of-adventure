// CHECKIN §J4 엄지 자리: 우편함 (받을 편지 3통) — 전: 「모두 받기」가 창 맨 위 · 후(lab): 창 아래 버튼 줄
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P;
const id0 = Math.max(0, ...P.meta.mail.map((m) => m.id)) + 1;
for (let i = 0; i < 3; i++) P.meta.mail.unshift({ id: id0 + i, from: 'system', title: `시험 편지 ${i + 1}`, body: '엄지 자리 확인용', reward: { gold: 100 }, at: Date.now(), claimed: false });
window.__openMenu();
await T(400);
[...document.querySelectorAll('#winB .mtile')].find((b) => /우편/.test(b.textContent))?.click();
await T(500);
