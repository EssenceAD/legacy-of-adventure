// C2 설정 창 (전: 한 줄 목록 · 후: 기본 / 알림 / 계정 3탭 — 기본 탭)
const W = (ms) => new Promise((r) => setTimeout(r, ms));
if (window.__openSettings) window.__openSettings(); else { window.__openMenu(); await W(300); [...document.querySelectorAll('[data-m]')].find((b) => b.textContent.includes('설정'))?.click(); }
await W(300);
