// save: C:/projects/legacy-of-adventure/tests/fixtures/real_hyeongcheol.json
// legendFrame: 네 장 나란히 — 전설 영웅(엘리시아) / 신화(닉스 · DEV 씨앗) / 영웅(오스윈) / 전설 손님(체리) · 아래 줄 = 작은 판(sm) · 맨 아래 = 원정 중(흐림) 전설 영웅
const T = (ms) => new Promise((r) => setTimeout(r, ms));
if (window.__LF_ON !== undefined) window.__flag('legendFrame', !!window.__LF_ON);
const W = window.__world;
const P = window.__P;
const L = (k) => W.actors.find((a) => a.legendId === k);
window.__mythic.seed('nyx');
((P.story.mythic ??= {}).nyx ??= {}).met = true;
const four = [L('elysia'), L('nyx'), W.actors.find((a) => a.heroId === 'oswin'), W.actors.find((a) => a.name === '체리')];
const H = window.__heroCard;
const box = document.createElement('div');
box.id = 'lfStrip';
box.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#1e2132;padding:10px;display:flex;flex-direction:column;gap:12px';
const row = (html) => `<div style="display:grid;grid-template-columns:repeat(4,calc(44px * var(--k)));gap:10px">${html}</div>`;
box.innerHTML =
  row(four.map((a) => H(a, { auto: false, why: null })).join('')) +
  row(four.map((a) => `<div style="width:calc(30px * var(--k))">${H(a, { size: 'sm', auto: false, why: null })}</div>`).join('')) +
  row(H(L('luna'), { auto: false, why: '원정 중 3분' }) + `<div style="width:calc(30px * var(--k))">${H(L('luna'), { size: 'sm', auto: false, why: null, on: true })}</div>` + `<div style="width:calc(30px * var(--k))">${H(L('nyx'), { size: 'sm', auto: false, why: null, on: true })}</div>`);
document.body.appendChild(box);
await T(400);
