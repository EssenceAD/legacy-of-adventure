// save: tests/fixtures/real_woongs.json
// CHECKIN §J7 대장간 「가방 정리」 (웅스): 전 = 예전 「분해」 탭 / 후 = [일반·희귀 한 번에 분해] · 자동 분해 · 분해 목록
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
window.__showObj(W.objs.find((o) => o.kind === 'smith'));
await T(500);
document.querySelector(`#winB .tabs .tab[data-t="${document.querySelector('.smo-heroes') ? 2 : 0}"]`)?.click();
await T(400);
