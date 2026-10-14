// CHECKIN §E 숙박부 도장: 오늘 첫 출석 → 메뉴 「출석」 창 — 후 = 받은 칸마다 작은 도장 · 오늘 칸에 「쿵」 찍힌 도장
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P;
P.meta.attend.last = '';
P.meta.attend.total = Math.max(3, (P.meta.attend.total ?? 0) - (P.meta.attend.total % 7) + 3);
window.__dailyAttend();
window.__openMenu();
await T(400);
[...document.querySelectorAll('#winB button, #winB [role=button]')].find((x) => /^\s*출석/.test(x.textContent ?? ''))?.click();
await T(900);
