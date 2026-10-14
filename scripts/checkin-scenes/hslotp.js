// save: C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad/pace/save_01.json
// PACE §2 (huntSlots): 3칸 「+ 맡기기」 → 준비 창 — 다른 칸에 맡긴 손님은 흐리게 「맡겨 둔 사냥 n칸」 · 맡겨 두기 설명 「3칸에 맡겨요」
//  전(플래그 끔·옛 빌드): 같은 스테이지(해안 10) 준비 창 — 예전 그대로
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const P = window.__P;
P.runs.length = 0;
const W = window.__world;
for (const a of W.actors) if (a.id) { a.runId = null; a.hp = 100; }
const busy = new Set(P.hunt.auto ? P.hunt.auto.members : []);
const free = W.actors.filter((a) => a.id && !a.role && (a.status === 'regular' || a.status === 'hero') && !busy.has(a.id)).sort((a, b) => b.lvl - a.lvl);
P.hunt.autos = [P.hunt.auto, { region: 'coast', stage: 10, members: free.slice(0, 4).map((a) => a.id), n: 42, gold: 18350, mats: 61 }];
window.__openHunt('coast');
await T(800);
const add = document.querySelector('[data-hadd="2"]');
if (add) add.click();
else document.querySelector('.hst[data-s="10"]')?.click();
await T(1000);
