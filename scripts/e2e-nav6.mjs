// hudV2 아래 메뉴줄 6칸: 손님 · 모험 · 대장간 · 건설 · 소식 · 메뉴 — 순서 · 글자 안 잘림(360·412) · 대장간 칸 = 대장간 창 · 없으면 잠금+토스트
//  실행: URL=http://localhost:4190/ node scripts/e2e-nav6.mjs   (flags.json에서 hudV2 켠 빌드)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const save = fs.readFileSync('tests/fixtures/real_woongs.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
for (const w of [360, 412, 1280]) {
  const ctx = await b.newContext(w === 1280 ? { viewport: { width: 1280, height: 800 } } : { viewport: { width: w, height: w === 360 ? 740 : 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => { try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; } localStorage.clear(); localStorage.setItem('legacy-of-adventure-save', s); localStorage.setItem('legacy-of-adventure-teaserSeen', 'true'); localStorage.setItem('legacy-of-adventure-lastVersion', '"99"'); localStorage.setItem('legacy-of-adventure-settleOff', 'true'); }, save);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
  await p.goto(URL); await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont')); await p.waitForTimeout(700); await p.locator('#tCont').click(); await p.waitForFunction(() => window.__S.started);
  await p.waitForTimeout(1500);
  await p.evaluate(async () => { for (let i = 0; i < 40; i++) { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); else if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click(); await new Promise((r) => setTimeout(r, 150)); } });
  await p.waitForTimeout(1200);
  await p.evaluate(async () => { for (let i = 0; i < 20; i++) { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); else if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click(); await new Promise((r) => setTimeout(r, 150)); } });
  const r = await p.evaluate(() => {
    const vis = [...document.querySelectorAll('nav.dk button')].filter((x) => getComputedStyle(x).display !== 'none' && x.getBoundingClientRect().width > 0).sort((a, c) => a.getBoundingClientRect().left - c.getBoundingClientRect().left);
    return { labels: vis.map((x) => x.textContent.trim()), clipped: vis.filter((x) => x.scrollWidth > x.clientWidth + 1 || x.getBoundingClientRect().height < 44).map((x) => x.id), w: vis.map((x) => Math.round(x.getBoundingClientRect().width)) };
  });
  ok(r.labels.join('·') === '손님·모험·대장간·건설·소식·메뉴', `${w}: 순서 ${r.labels.join('·')} (폭 ${r.w.join('/')})`);
  ok(r.clipped.length === 0, `${w}: 글자 안 잘림 · 44px 이상 ${r.clipped.join(',')}`);
  await p.screenshot({ path: `reports/checkin/nav6/after_${w}.png` });
  await p.locator('#bSmith').click();
  await p.waitForTimeout(700);
  ok(await p.evaluate(() => /대장간/.test(document.querySelector('#winT')?.textContent ?? '')), `${w}: 대장간 칸 → 대장간 창 (${await p.evaluate(() => document.querySelector('#winT')?.textContent)})`);
  if (w === 412) {
    await p.screenshot({ path: `reports/checkin/nav6/after_${w}_smith.png` });
    await p.evaluate(() => document.querySelector('#winX').click());
    await p.evaluate(() => { window.__world.objs = window.__world.objs.filter((o) => o.kind !== 'smith'); });
    await p.waitForTimeout(800);
    ok(await p.evaluate(() => document.querySelector('#bSmith').classList.contains('locked')), '대장간 없으면 회색 잠금');
    await p.locator('#bSmith').click();
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => /대장간을 지으면 열려요/.test(document.querySelector('#toast')?.textContent ?? '')), '누르면 「대장간을 지으면 열려요」');
  }
  ok(!errs.length, `${w}: 오류 0 ${errs.join('|')}`);
  await ctx.close();
}
await b.close();
console.error(fail ? `✗ ${fail}개 실패` : '✓ e2e-nav6 통과');
process.exit(fail ? 1 : 0);
