// save: tests/fixtures/real_woongs.json
// CHECKIN §J7 대장간 (웅스 · ★ = 전투력 1등 · 그 영웅 무기 +6): 전 = 예전 「강화」 탭 / 후 = 「장비 손질」(영웅 줄 → 장비 칸 → 행동 판)
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const P = window.__P;
const hs = W.actors.filter((a) => !a.role && (a.status === 'regular' || a.status === 'hero')).sort((a, b) => window.__power(b) - window.__power(a));
P.growth.favs = [hs[0].id, hs[2].id];
const wp = P.bag.find((it) => it.id === hs[0].equip.weapon);
if (wp) wp.enh = 6;
window.__showObj(W.objs.find((o) => o.kind === 'smith'));
await T(500);
if (!document.querySelector('.smo-heroes')) document.querySelector('#winB .tabs .tab[data-t="1"]')?.click();
await T(400);
