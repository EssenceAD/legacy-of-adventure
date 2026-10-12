// GROWTH §6: 별채 지붕 색 전/후 — 실제 저장(로또1등 여관)을 넣고 별채 둘레 확대 스샷
//  실행: SAVE=<저장 json> URL=… node scripts/shot-roof.mjs <이름>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const tag = process.argv[2] ?? 'after';
const save = fs.readFileSync(process.env.SAVE, 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
}, save);
const p = await ctx.newPage();
await p.goto(process.env.URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await p.locator('#tCont').click().catch(() => {});
await p.waitForTimeout(4000);
for (let i = 0; i < 30; i++) {
  const busy = await p.evaluate(() => { const d = document.querySelector('#dlg'); if (d && !d.hidden) return d.click(), true; const w = document.querySelector('#win'); if (w && w.classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
  if (!busy) break;
  await p.waitForTimeout(300);
}
await p.waitForTimeout(3500);
for (let i = 0; i < 20; i++) { const busy = await p.evaluate(() => { const d = document.querySelector('#dlg'); if (d && !d.hidden) return d.click(), true; const w = document.querySelector('#win'); if (w && w.classList.contains('on')) return document.querySelector('#winX').click(), true; return false; }); if (!busy) break; await p.waitForTimeout(300); }
await p.evaluate(() => { const g = window.__game; const o = window.__world?.objs.find((x) => x.kind === 'cottage' && x.hue != null); if (g && o) { g.focusTile(o.tx + 1, o.ty + 1); window.__S.zoom = 3; } });
await p.waitForTimeout(1500);
fs.mkdirSync('screenshots/roof', { recursive: true });
await p.screenshot({ path: `screenshots/roof/${tag}_town.png` });
await b.close();
