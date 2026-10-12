// 「오늘의 목표」 알약 · 장부 카드 겹침 확인 (폭 360·390·412) → screenshots/goalcard/<TAG>_<폭>.png + 겹침 여부
//  실행: URL=http://localhost:5193/ TAG=after node scripts/shot-goalcard.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = fs.readFileSync('tests/fixtures/real_ttabam.json', 'utf8');
const tag = process.env.TAG ?? 'run';
const dir = 'screenshots/goalcard';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
for (const fstep of [0, 1, 2])
for (const [w, h, dpr] of [[360, 780, 3], [390, 844, 3], [412, 915, 2.625]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([s, fstep]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-fontStep', String(fstep));
  }, [save, fstep]);
  const p = await ctx.newPage();
  await p.goto(process.env.URL ?? 'http://localhost:5193/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 30000 });
  await p.waitForTimeout(1500);
  await p.locator('#tCont').click();
  await p.waitForTimeout(3000);
  for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
    const busy = await p.evaluate(() => {
      if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true;
      if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true;
      return false;
    });
    calm = busy ? 0 : calm + 1;
    await p.waitForTimeout(busy ? 200 : 500);
  }
  await p.waitForTimeout(800);
  for (const mode of ['eval', 'noeval', 'notdone', 'bigtext']) {
  // 삼성 인터넷 「글자 크기」(브라우저 설정)처럼 글자만 1.35배
  if (mode === 'bigtext')
    await p.evaluate(() => {
      document.querySelector('#evalbar').hidden = false;
      const r = document.documentElement.style;
      for (const k of [...r]) if (k.startsWith('--f-')) r.setProperty(k, Math.round(parseFloat(r.getPropertyValue(k)) * 1.35) + 'px');
    });
  if (mode === 'notdone') await p.evaluate(() => window.__P.goals.list.forEach((g) => ((g.claimed = false), (g.progress = 0))));
  if (mode === 'noeval' || mode === 'notdone') await p.evaluate(() => (document.querySelector('#evalbar').hidden = true));
  await p.waitForTimeout(mode === 'notdone' || mode === 'bigtext' ? 2300 : 300);
  if (mode === 'noeval' || mode === 'notdone') await p.evaluate(() => (document.querySelector('#evalbar').hidden = true));
  await p.waitForTimeout(200);
  const r = await p.evaluate(() => {
    const box = (el) => {
      if (!el || el.hidden || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') return null;
      const b = el.getBoundingClientRect();
      return b.width && b.height ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null;
    };
    const pill = box(document.querySelector('#goalPill'));
    // 오른쪽·왼쪽 위 HUD 카드들 중 알약과 겹치는 것
    const others = [...document.querySelectorAll('#hud > *, .top .stat, .top button')].filter((e) => !['goalPill', 'goalPanel', 'toast', 'pcard', 'hBanner'].includes(e.id) && !e.classList.contains('top')).map((e) => ({ id: e.id || e.className, bx: box(e) })).filter((x) => x.bx);
    const hits = pill ? others.filter(({ bx }) => bx.l < pill.r - 1 && bx.r > pill.l + 1 && bx.t < pill.b - 1 && bx.b > pill.t + 1).map((x) => x.id) : [];
    if (pill && pill.r > innerWidth) hits.push('화면 밖');
    return { pill, hits, text: document.querySelector('#goalPill')?.textContent };
  });
  console.log(w, 'font' + fstep, mode, JSON.stringify(r));
  if (r.hits.length) fail++;
  await p.screenshot({ path: `${dir}/${tag}_${w}_f${fstep}_${mode}.png`, clip: { x: 0, y: 0, width: w, height: 280 } });
  }
  await ctx.close();
}
await b.close();
console.error(fail ? `✗ 겹침 ${fail}곳` : '✓ 겹침 없음');
process.exit(fail ? 1 : 0);
