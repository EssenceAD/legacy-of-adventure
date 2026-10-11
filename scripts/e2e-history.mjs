// 핫픽스 11 §7: 시작할 때 창(방치 요약·패치노트·출석)을 빠르게 닫다가 게임 페이지 밖으로 나가는지 — 20번
// 실행: dist-bot 미리보기 4190 · node scripts/e2e-history.mjs [URL]   (나감 0 / 20 이어야 통과)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL0 = process.argv[2] ?? 'http://localhost:4190/';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
let hits = 0;
for (let k = 0; k < 20; k++) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; } localStorage.clear(); localStorage.setItem('legacy-of-adventure-save', s); localStorage.setItem('legacy-of-adventure-teaserSeen', 'true'); localStorage.setItem('legacy-of-adventure-lastVersion', '"99"'); }, save);
  const p = await ctx.newPage();
  p.setDefaultTimeout(3000);
  const log = [];
  p.on('framenavigated', (f) => { if (f === p.mainFrame() && !f.url().startsWith('http://localhost')) log.push('NAV→ ' + f.url()); });
  await p.goto(URL0, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.locator('#tCont').click();
  await p.waitForTimeout(3000);
  for (let j = 0; j < 20; j++) {
    const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg')?.hidden, w: !!document.querySelector('#win')?.classList.contains('on'), t: document.querySelector('#winT')?.textContent, hl: history.length, hs: JSON.stringify(history.state) })).catch((e) => ({ err: String(e).slice(0, 50) }));
    log.push(JSON.stringify(st));
    if (st.err) break;
    if (st.d) await p.locator('#dlg').click().catch(() => {});
    else if (st.w) await p.locator('#winX').click().catch(() => {});
    else break;
    await p.waitForTimeout(300);
  }
  const out = !p.url().startsWith('http://localhost');
  if (out || log.some((l) => l.startsWith('NAV'))) { hits++; console.log('#' + k, p.url(), '\n ' + log.join('\n ')); }
  await ctx.close();
}
console.log('나감', hits, '/ 20');
process.exitCode = hits ? 1 : 0;
await b.close();
