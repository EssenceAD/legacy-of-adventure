// save: C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad/pace/save_01.json
// PACE §2 자동 사냥 여러 파티 (huntSlots): 사냥 창 맨 위 「맡겨 둔 사냥 n/3」 칸 카드 줄 — 0번 칸(세이브 그대로) + 1번 칸 해안 10 + 2번 칸 빈 칸(+ 맡기기)
//  전(플래그 끔·옛 빌드): 예전 한 줄 「맡겨 둔 사냥 · …」 · 1번 칸 값은 저장에만 있고 안 보임
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P;
P.runs.length = 0;
const W = window.__world;
for (const a of W.actors) if (a.id) { a.runId = null; a.hp = 100; }
const busy = new Set(P.hunt.auto ? P.hunt.auto.members : []);
const free = W.actors.filter((a) => a.id && !a.role && (a.status === 'regular' || a.status === 'hero') && !busy.has(a.id)).sort((a, b) => b.lvl - a.lvl);
P.hunt.autos = [P.hunt.auto, { region: 'coast', stage: 10, members: free.slice(0, 4).map((a) => a.id), n: 42, gold: 18350, mats: 61 }];
window.__openHunt('ice');
await T(800);
