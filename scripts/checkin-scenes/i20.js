// save: tests/fixtures/real_gonu.json
// #20 자동 길 끔(고느끼): 던전 입구를 마을 안으로 옮겨도 자동 길 0칸 · 바깥 길(입구 아래)도 없음 — 마을 화면 그대로 찍음
const W = window.__world;
const dg = W.objs.find((o) => o.kind === 'dungeon');
window.__game.focusTile(dg.tx + 1, dg.ty + 1);
