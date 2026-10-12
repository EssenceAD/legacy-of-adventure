// 안내서 v2 스샷 (폰) — 목록 + 쪽 몇 개 · 오류 0
//  실행: URL=… node scripts/shot-manual.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8');
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
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await p.goto(process.env.URL ?? 'http://localhost:5192/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.locator('#tCont').click().catch(() => {});
await p.waitForTimeout(3500);
for (let i = 0; i < 30; i++) { const busy = await p.evaluate(() => { const d = document.querySelector('#dlg'); if (d && !d.hidden) return d.click(), true; const w = document.querySelector('#win'); if (w && w.classList.contains('on')) return document.querySelector('#winX').click(), true; return false; }); if (!busy) break; await p.waitForTimeout(300); }
fs.mkdirSync('screenshots/manual', { recursive: true });
await p.evaluate(() => window.__openManual());
await p.waitForTimeout(600);
const n = await p.locator('.mtile').count();
console.error((n === 17 ? '✓' : '✗') + ' 안내서 ' + n + '쪽');
await p.screenshot({ path: 'screenshots/manual/list.png' });
for (const k of ['fishing', 'story', 'social']) {
  await p.locator(`[data-mn="${k}"]`).click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: `screenshots/manual/${k}.png` });
  await p.evaluate(() => window.__openManual());
  await p.waitForTimeout(300);
}
await p.evaluate(() => window.__openMenu());
await p.waitForTimeout(500);
await p.screenshot({ path: 'screenshots/manual/menu.png' });
const cols = await p.evaluate(() => getComputedStyle(document.querySelector('.mgrid')).gridTemplateColumns.split(' ').length);
console.error((cols >= 3 ? '✓' : '✗') + ' 메뉴 칸 ' + cols + '열');
console.error((errs.length ? '✗ ' : '✓ ') + '오류 ' + errs.length + ' ' + errs.join(' | '));
await b.close();
process.exit(n === 17 && !errs.length ? 0 : 1);
