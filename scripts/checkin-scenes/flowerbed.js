// save: tests/fixtures/real_lotte.json
// 꽃화단 그림 교체 (42×34 · 1칸) — 여관 근처 빈칸에 하나 놓고(배치 확정) 카메라
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const inn = window.__world.objs.find((x) => x.kind === 'inn');
let spot = null;
for (let r = 1; r < 8 && !spot; r++)
  for (let dy = -r; dy <= r && !spot; dy++)
    for (let dx = -r; dx <= r && !spot; dx++) {
      const x = inn.tx + inn.fw + dx, y = inn.ty + inn.fh + dy;
      if (window.__place('flowerbed', x, y) === 'ok') spot = [x, y];
    }
document.querySelector('#placeOk')?.click();
await W(400);
if (spot) window.__game.focusTile(spot[0] + 0.5, spot[1] + 0.5);
await W(800);
