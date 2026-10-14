// save: C:/projects/legacy-of-adventure/tests/fixtures/real_hyeongcheol.json
// legendFrame: 원정 파티 고르기 — 위 자리 칸(작은 판 sm)에 전설 영웅 · 닉스는 원정 중(흐림)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
if (window.__LF_ON !== undefined) window.__flag('legendFrame', !!window.__LF_ON);
const W = window.__world;
const P = window.__P;
const nyx = W.actors.find((a) => a.legendId === 'nyx');
P.runs.push({ id: 9932, start: Date.now() - 60e3, end: Date.now() + 181e3, members: [nyx.id], quest: { id: 9932, region: 'forest', tier: 0, power: 10, minutes: 4, gold: [1, 1] } });
nyx.runId = 9932;
const el = document.createElement('button');
el.dataset.goboard = '1';
document.body.appendChild(el);
el.click();
el.remove();
await T(700);
(document.querySelector('.quest:not(.tut)') ?? document.querySelector('.quest')).click();
await T(700);
// 자리: 엘리시아 · 루나 · 오스윈(영웅) · 체리(전설 손님)
const pick = [W.actors.find((a) => a.legendId === 'elysia'), W.actors.find((a) => a.legendId === 'luna'), W.actors.find((a) => a.heroId === 'oswin'), W.actors.find((a) => a.name === '체리')];
for (const a of pick) {
  const c = document.querySelector(`#winB .hdk-grid .hcd[data-hc="${a.id}"]`);
  if (c) { c.click(); await T(250); }
}
await T(600);
