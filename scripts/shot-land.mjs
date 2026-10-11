// 땅 개편 확인 스크린샷: 옛 저장(3단계, v6) 불러오기 → 새 땅에서 · SE/PC
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'pc';
const file = process.argv[3] ?? 'tests/fixtures/beta_town.json';
const tag = process.argv[4] ?? 'old3';
const OUT = 'screenshots/land';
fs.mkdirSync(OUT, { recursive: true });
const save = fs.readFileSync(file, 'utf8');
const DEV = { se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1280, height: 800 } } };
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await p.waitForTimeout(1500);
await p.locator('#tCont').click();
await p.waitForTimeout(3000);
for (let i = 0; i < 20; i++) {
  const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
  if (st.d) await p.locator('#dlg').click().catch(() => {});
  else if (st.w) await p.locator('#winX').click().catch(() => {});
  else break;
  await p.waitForTimeout(300);
}
await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/${name}_${tag}.png` });
// NIGHT: 밤 화면도
await p.evaluate(() => { window.__S.night = true; window.__S.nightT = 1; });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/${name}_${tag}_night.png` });
const info = await p.evaluate(() => ({ land: window.__S.land, zoom: window.__S.zoom, objs: window.__world.objs.map((o) => `${o.kind}@${o.tx},${o.ty}`).join(' '), wild: 0 }));
console.log(JSON.stringify(info), errs.join(' | '));
await b.close();
