// HOTFIX14 §4: 운명의 별(별똥별)을 마우스로 진짜 클릭 — 데스크톱 1920×1080 · 1366×768 · 모바일 390×844
//  별 위치를 읽어 사람처럼 누름(누르고 ~90ms 뒤 뗌) · 별 경로 위를 무엇이 덮는지(elementFromPoint)도 기록
//  실행: dist-bot 미리보기 4190 · node scripts/e2e-star.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const SIZES = { d1920: { viewport: { width: 1920, height: 1080 } }, d1366: { viewport: { width: 1366, height: 768 } }, m390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } };
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
for (const [name, opt] of Object.entries(SIZES)) {
  const ctx = await b.newContext(opt);
  await ctx.addInitScript((s) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  }, save);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto('http://localhost:4190/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.locator('#tCont').click();
  await p.waitForTimeout(3000);
  for (let i = 0; i < 12; i++) {
    await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); else if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click(); });
    await p.waitForTimeout(250);
  }
  let caught = 0;
  const covers = new Set();
  const tries = 5;
  let valid = 0;
  for (let t = 0; t < 14 && valid < tries; t++) {
    // 창·대화가 떠 있으면 닫는다 (게임 이벤트가 끼어들 수 있음)
    for (let i = 0; i < 6; i++) await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); else if (document.querySelector('#win').classList.contains('on')) document.querySelector('#winX').click(); });
    // 밤 · 소문 난 전설 하나 · 오늘 아직 안 잡음
    await p.evaluate(() => {
      const P = window.__P, S = window.__S;
      S.night = true;
      S.clock = 16 * 60;
      P.starDay = '';
      P.starN = 0;
      P.legends.luna = { st: 'rumor', gauge: 0, ...(P.legends.luna ?? {}) };
      P.legends.luna.st = 'rumor';
    });
    // 별이 보일 때까지
    const pos = await p.waitForFunction(() => window.__star?.()?.on && window.__star().vis > 0.15 && window.__star().vis < 0.6 ? window.__star() : null, null, { timeout: 30000, polling: 30 }).then((h) => h.jsonValue(), () => null);
    if (!pos) continue;
    const cover = await p.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); if (!el) return null; const chain = []; for (let a = el; a && chain.length < 4; a = a.parentElement) chain.push(a.id || a.tagName + '.' + String(a.className).split(' ')[0]); return chain.join('<'); }, [pos.cx, pos.cy]);
    covers.add(cover);
    // 게임 창·대화가 마침 화면을 덮었으면(평가단 등 이벤트) 이번 판은 세지 않고 다시
    if (!/^scene/.test(cover ?? '')) continue;
    valid++;
    const g0 = await p.evaluate(() => window.__P.legends.luna.gauge);
    await p.mouse.move(pos.cx, pos.cy);
    await p.mouse.down();
    await p.waitForTimeout(90);
    await p.mouse.up();
    await p.waitForTimeout(300);
    const g1 = await p.evaluate(() => window.__P.legends.luna.gauge);
    if (g1 > g0) caught++;
    await p.waitForTimeout(200);
    for (let i = 0; i < 6; i++) await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) document.querySelector('#dlg').click(); });
  }
  ok(valid === tries && caught === tries, `${name}: 마우스로 별 잡기 ${caught}/${valid} (창이 덮은 판 제외) · 누른 곳 ${[...covers].join(', ')}`);
  ok(errs.length === 0, `${name}: 페이지 에러 0 ${errs.join(' | ')}`);
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
