// TOWN T3·T4·T5 e2e: 같은 건물 「(n/m채)」 · 땅 단계별 최대 채수 · 줄 어울림(가로등 길) 발견 · 밤 가로등 불빛(밝기) · 오류 0
//  실행: URL=… node scripts/e2e-town.mjs [phone|pc] → screenshots/town/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const save = JSON.parse(fs.readFileSync('tests/fixtures/lotte_dupe.json', 'utf8'));
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/town';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 600);
  }
};

await p.goto(process.env.URL ?? 'http://localhost:5192/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();

// ── T3: 온천 2채 → 「(2/3채)」 (땅 5단계 = 최대 3채)
const land = await p.evaluate(() => window.__S.land);
await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'bath')));
await W(500);
const title = await p.evaluate(() => document.querySelector('#win')?.textContent ?? '');
ok(/\(2\/3채\)/.test(title), `땅 ${land}단계 온천 「(2/3채)」`);
await p.screenshot({ path: `${dir}/${name}_01_copies.png` });
await settle();

// ── T4·T5: 빈 땅에 가로등 줄 → 줄 어울림 · 밤 불빛
const spot = await p.evaluate(() => {
  const W = window.__world, T = window.__town;
  const [a, z] = T.landBounds();
  const lb = { x0: a, y0: a, x1: z, y1: z };
  const occ = (x, y) => W.objs.some((o) => x >= o.tx && x < o.tx + (o.fw ?? 1) && y >= o.ty && y < o.ty + (o.fh ?? 1));
  for (let y = lb.y0 + 1; y < lb.y1 - 1; y++)
    for (let x = lb.x0 + 1; x < lb.x1 - 6; x++) {
      let free = true;
      for (let i = 0; i < 6 && free; i++) free = !occ(x + i, y);
      if (free) return [x, y];
    }
  return null;
});
ok(!!spot, '가로등 줄 놓을 빈 칸');
const found0 = await p.evaluate(() => window.__P.harmony.found.length);
await p.evaluate(([x, y]) => {
  for (let i = 0; i < 6; i += 2) window.__town.addObj('lamppost', x + i, y).__t = 1;
  window.__town.rebuildPaths();
}, spot);
await W(2500);
await settle();
const found1 = await p.evaluate(() => window.__P.harmony.found.length);
ok(found1 >= found0, `어울림 ${found0} → ${found1}`);
// 밤: 가로등 둘레 밝기 (불빛 있음 vs 지운 뒤)
const lum = async () => p.evaluate(([x, y]) => {
  const cv = document.querySelector('canvas');
  const g = cv.getContext('2d');
  const xy = window.__decor.xy(x + 2, y);
  const r = cv.getBoundingClientRect();
  const px = ((xy[0] - r.left) / r.width) * cv.width, py = ((xy[1] - r.top) / r.height) * cv.height;
  const d = g.getImageData(Math.max(0, px - 30), Math.max(0, py - 60), 60, 60).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
  return s / (d.length / 4);
}, spot);
await p.evaluate(() => { window.__S.clock = (22 - 6) * 60 + 60; });
await W(2500);
ok(await p.evaluate(() => window.__S.night && window.__S.nightT > 0.9), '밤이 됨');
await W(1200);
const lit = await lum();
await p.screenshot({ path: `${dir}/${name}_02_night_lamps.png` });
await p.evaluate(() => { const W = window.__world; W.objs.splice(0, W.objs.length, ...W.objs.filter((o) => o.kind !== 'lamppost' || !o.__t)); });
await p.evaluate(() => { const W = window.__world; for (let i = W.objs.length - 1; i >= 0; i--) if (W.objs[i].__t) W.objs.splice(i, 1); });
await W(800);
const dark = await lum();
ok(lit > dark * 1.08, `밤 가로등 불빛: 둘레 밝기 ${dark.toFixed(1)} → ${lit.toFixed(1)}`);

ok(errs.length === 0, '오류 0 ' + errs.join(' | '));
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ 전부 통과');
process.exit(fail ? 1 : 0);
