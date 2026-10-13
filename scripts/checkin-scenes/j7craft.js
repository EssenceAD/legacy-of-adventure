// save: tests/fixtures/real_woongs.json
// CHECKIN §J7 대장간 「제작」 탭 (웅스): 전 = 예전 제작 탭(맨 아래 레벨업) / 후 = 맨 위 설명·레벨업·지붕 색 + 제작
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
window.__showObj(W.objs.find((o) => o.kind === 'smith'));
await T(500);
document.querySelector(`#winB .tabs .tab[data-t="${document.querySelector('.smo-heroes') ? 1 : 2}"]`)?.click();
await T(400);
