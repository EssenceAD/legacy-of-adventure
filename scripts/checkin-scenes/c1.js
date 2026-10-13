// C1 전투 일시정지 시트 — 숲 1-10 직접 전투 → 오른쪽 위 ✕/⚙ (전: 「계속/포기」 카드 · 후: 소리·AUTO·흔들림·피해 숫자 + [계속] [포기])
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P; P.runs.length = 0; P.hunt.auto = null;
if (!P.guide.unlocked.includes('hunt')) P.guide.unlocked.push('hunt');
for (const a of window.__world.actors) if (a.id) a.hp = 100;
window.__openHunt('forest');
await W(700);
document.querySelector('[data-s="10"]')?.click();
await W(700);
document.querySelector('#hMan')?.click();
await W(2500);
document.querySelector('#cbQuit')?.click();
await W(400);
