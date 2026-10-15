// 대장간 화덕 불빛 사람 눈 확인: 로또1등 저장(tests/fixtures/real_hyeongcheol.json) · 폭 412 · 밤 · 대장간 2채 ×3 확대
// 실행: node scripts/shot-forgelight.mjs <URL> <접두어 before|after>   (BOT_BUILD 미리보기) → reports/forgelight/<접두어>_smith_*.png
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const URL = process.argv[2] ?? 'http://localhost:4291/';
const PRE = process.argv[3] ?? 'after';
const OUT = 'reports/forgelight';
fs.mkdirSync(OUT, { recursive: true });
const save = fs.readFileSync('tests/fixtures/real_hyeongcheol.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => {
  if (sessionStorage.getItem('x')) return;
  sessionStorage.setItem('x', 1);
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
}, save);
const p = await ctx.newPage();
const W = (ms) => p.waitForTimeout(ms);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 30000 });
await W(1500);
await p.locator('#tCont').click().catch(() => {});
await W(3000);
for (let i = 0; i < 20; i++) {
  const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg')?.hidden, w: document.querySelector('#win')?.classList.contains('on') }));
  if (st.d) await p.locator('#dlg').click().catch(() => {});
  else if (st.w) await p.locator('#winX').click().catch(() => {});
  else break;
  await W(300);
}
await p.evaluate(() => { window.__S.night = true; window.__S.nightT = 1; window.__world.actors = window.__world.actors.filter((a) => a.role); });
await W(1500);
const smiths = await p.evaluate(() => window.__world.objs.filter((o) => o.kind === 'smith').map((o) => ({ tx: o.tx, ty: o.ty, lvl: o.lvl, flip: !!o.flip })));
const shots = [];
for (const [i, s] of smiths.entries()) {
  // 대장간이 화면 가운데 오게 카메라(view.cam)를 옮긴다
  const r = await p.evaluate(async (s) => {
    const o = window.__world.objs.find((x) => x.kind === 'smith' && x.tx === s.tx && x.ty === s.ty);
    const v = window.__view, cv = document.querySelector('canvas').getBoundingClientRect();
    let rc = window.__objRect(o);
    const want = [cv.width / 2 / v.SC, cv.height / 2 / v.SC];
    v.cam.x -= want[0] - (rc[0] + rc[2] / 2);
    v.cam.y -= want[1] - (rc[1] + rc[3] / 2);
    await new Promise((ok) => setTimeout(ok, 600));
    rc = window.__objRect(o);
    return { x: cv.left + rc[0] * v.SC, y: cv.top + rc[1] * v.SC, w: rc[2] * v.SC, h: rc[3] * v.SC, sc: v.SC };
  }, s);
  const pad = 14 * r.sc;
  const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: Math.min(412, r.w + pad * 2), height: r.h + pad * 2 };
  clip.width = Math.min(clip.width, 412 - clip.x);
  const buf = await p.screenshot({ clip });
  const src = PNG.sync.read(buf), S = 3;
  const o = new PNG({ width: src.width * S, height: src.height * S });
  for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) src.data.copy(o.data, (y * o.width + x) * 4, (((y / S) | 0) * src.width + ((x / S) | 0)) * 4, (((y / S) | 0) * src.width + ((x / S) | 0)) * 4 + 4);
  const f = `${OUT}/${PRE}_smith_${i + 1}_lv${s.lvl}${s.flip ? '_flip' : ''}.png`;
  fs.writeFileSync(f, PNG.sync.write(o));
  shots.push(f);
}
await p.screenshot({ path: `${OUT}/${PRE}_village_412_night.png` });
console.log(JSON.stringify({ smiths, shots }));
await b.close();
