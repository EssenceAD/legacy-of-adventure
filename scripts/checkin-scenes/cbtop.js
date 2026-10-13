// 전투 상단 「접기 · 접으면 평가 보너스 없음 · 처치 n/24」 겹침 (v0.25.2b) — 숲 1-10 직접 전투
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
