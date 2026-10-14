// save: tests/fixtures/real_woongs.json
// CHECKIN §J3 전투 결과 카드 (숲 1-3 직접 전투 → 안 쓰러지고 40초에 이긴 판): 후 = 별 1~3 · MVP 초상 + 한 마디 · 드랍 칸 · [다시 하기] [다음 1-4] · 보상은 §E 영수증
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P; P.hunt.auto = null; P.runs.length = 0;
for (const a of window.__world.actors) if (a.id) a.hp = 100;
window.__openHunt('forest');
await T(700);
document.querySelector('[data-s="3"]')?.click();
await T(700);
document.querySelector('#hMan')?.click();
for (let i = 0; i < 40 && !window.__combat.field(); i++) await T(150);
await T(800);
const f = window.__combat.field();
f.allies.forEach((u, i) => (u.dealt = 100 * (i + 1)));
f.downs = 0; f.time = 110; f.kills = 35; f.maxStreak = 12;
f.done = 'win'; f.doneT = 2;
window.__combat.advance(0.1);
for (let i = 0; i < 30 && document.querySelector('#cbRes')?.hidden !== false; i++) { window.__combat.advance(0.05); await T(100); }
await T(1200);
