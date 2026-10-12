// TOWN T0: 땅 가장자리 소품이 바깥 숲에 가려지지 않는지 — 네 방향 가장자리에 우물·꽃밭·가로등을 두고 픽셀 비교
//  소품 모양(숲 없이 소품 있을 때 − 숲 없이 소품 없을 때)의 픽셀 중, 숲을 다시 넣었을 때 바뀐 픽셀 = 가려진 픽셀
//  실행: 미리보기(DEV) · URL=… node scripts/e2e-edge.mjs → screenshots/edge/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = JSON.parse(fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8'));
const dir = 'screenshots/edge';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 2400, height: 1500 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
await p.goto(process.env.URL ?? 'http://localhost:5181/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
for (let i = 0; i < 20; i++) {
  await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); else if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click(); });
  await W(200);
}
const res = await p.evaluate(async () => {
  const T = window.__town;
  const world = window.__world;
  const [a, b] = T.landBounds();
  const mid = Math.floor((a + b) / 2);
  const kinds = ['well', 'flowerbed', 'well', 'flowerbed'];
  // 네 가장자리: 앞-왼(y=b-1) · 앞-오른(x=b-1) · 뒤-왼(x=a) · 뒤-오른(y=a) — 가운데 근처 빈칸에
  const spots = [];
  const free = (x, y) => !world.objs.some((o) => x >= o.tx && x < o.tx + o.fw && y >= o.ty && y < o.ty + o.fh);
  const edgeLine = (fixed, isY) => {
    for (let d = 0; d < b - a; d++)
      for (const s of [1, -1]) {
        const t = mid + s * d;
        const [x, y] = isY ? [t, fixed] : [fixed, t];
        if (t >= a && t < b && free(x, y)) return [x, y];
      }
    return null;
  };
  const edges = { frontLeft: edgeLine(b - 1, true), frontRight: edgeLine(b - 1, false), backLeft: edgeLine(a, false), backRight: edgeLine(a, true) };
  const actors = world.actors.map((x) => [x, x.hidden]);
  for (const [x] of actors) x.hidden = true;
  const W = window.__view.LW;
  const H = window.__view.LH;
  const shot = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    T.renderFrame(g, 0);
    return g.getImageData(0, 0, W, H).data;
  };
  const results = [];
  const saved = { wild: T.ground.wild, front: T.ground.front };
  let ki = 0;
  for (const [name, at] of Object.entries(edges)) {
    if (!at) {
      results.push({ name, skip: true });
      continue;
    }
    const k = kinds[ki++ % kinds.length];
    // 숲 없이 소품 없음 → 숲 없이 소품 있음 → 숲 있고 소품 있음
    T.ground.wild = [];
    T.ground.front = null;
    const none = shot();
    const o = T.addObj(k, at[0], at[1]);
    const solo = shot();
    T.ground.wild = saved.wild;
    T.ground.front = saved.front;
    const full = shot();
    let mask = 0;
    let hid = 0;
    for (let i = 0; i < none.length; i += 4) {
      const inProp = none[i] !== solo[i] || none[i + 1] !== solo[i + 1] || none[i + 2] !== solo[i + 2];
      if (!inProp) continue;
      mask++;
      if (full[i] !== solo[i] || full[i + 1] !== solo[i + 1] || full[i + 2] !== solo[i + 2]) hid++;
    }
    results.push({ name, k, at, mask, hid, pct: mask ? Math.round((hid / mask) * 1000) / 10 : 0 });
    void o;
  }
  for (const [x, h] of actors) x.hidden = h;
  return results;
});
for (const r of res) {
  if (r.skip) ok(true, `${r.name}: 빈 가장자리 칸 없음 (건너뜀)`);
  else if (!r.mask) ok(r.name.startsWith('back'), `${r.name}: 화면 밖 (뒤쪽 가장자리는 숲이 소품 뒤라 가려질 일 없음)`);
  else ok(r.pct <= 1, `${r.name} ${r.k} (${r.at}) — 소품 ${r.mask}px 중 숲에 가려진 ${r.hid}px (${r.pct}%)`);
}
await p.screenshot({ path: `${dir}/edges.png` });
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify(out, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
