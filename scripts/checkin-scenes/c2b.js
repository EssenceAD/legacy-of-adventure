// C2 설정 창 「알림」 탭 (전: 같은 설정 창 아래쪽까지 스크롤)
const W = (ms) => new Promise((r) => setTimeout(r, ms));
if (window.__openSettings) window.__openSettings(); else { window.__openMenu(); await W(300); [...document.querySelectorAll('[data-m]')].find((b) => b.textContent.includes('설정'))?.click(); }
await W(300);
const t = document.querySelector('[data-stab="noti"]');
if (t) t.click(); else document.querySelector('#winB').scrollTop = 400;
await W(300);
