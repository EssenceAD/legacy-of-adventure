// CHECKIN §J4 확인 시트: 보관함에 장식 하나 넣고 [팔기] 한 번 — 전: 「정말 팔기」 두 번 누르기 · 후(lab): 아래 확인 시트
const T = (ms) => new Promise((r) => setTimeout(r, ms));
const W = window.__world;
const o = W.objs.find((x) => !x.con && window.__def(x.kind).deco && !window.__def(x.kind).pioneerDeco && !window.__def(x.kind).levelDeco && !x.fromProp);
if (o) window.__store.putAway([o]);
window.__store.open();
await T(500);
[...document.querySelectorAll('#winB [data-sell]')].pop()?.click();
await T(500);
