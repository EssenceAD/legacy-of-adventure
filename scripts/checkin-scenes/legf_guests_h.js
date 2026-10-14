// save: C:/projects/legacy-of-adventure/tests/fixtures/real_hyeongcheol.json
// legendFrame: 전설 영웅 4명(엘리시아·닉스·비비안·루나)이 있는 손님 창 「단골」 탭 — 닉스는 원정 중(흐린 초상화여도 금테·리본은 제 색)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
if (window.__LF_ON !== undefined) window.__flag('legendFrame', !!window.__LF_ON);
const W = window.__world;
const P = window.__P;
const nyx = W.actors.find((a) => a.legendId === 'nyx');
P.runs.push({ id: 9931, start: Date.now() - 60e3, end: Date.now() + 181e3, members: [nyx.id], quest: { id: 9931, region: 'forest', tier: 0, power: 10, minutes: 4, gold: [1, 1] } });
nyx.runId = 9931;
document.querySelector('#bGuest').click();
await T(900);
