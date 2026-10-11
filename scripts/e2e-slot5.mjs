// 핫픽스 12 §3: 원정 5번째 자리 — 모모 안내 · 파티 창 열림 표시 · 5명 출발 (진짜 클릭)
// 실행: dist-bot 미리보기 4190 · node scripts/e2e-party-scroll.mjs [se|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'se';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = { se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1280, height: 800 } } };
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
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const clear = async () => {
  for (let i = 0; i < 25; i++) {
    const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
    if (st.d) await p.locator('#dlg').click().catch(() => {});
    else if (st.w) await p.locator('#winX').click().catch(() => {});
    else return;
    await W(300);
  }
};
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await clear();
// 시험 준비: 단골 8명 더 (목록이 스크롤되게) · 원정 비우기
await p.evaluate(() => { window.__P.runs.length = 0; window.__P.hunt.auto = null; for (let i = 0; i < 8; i++) window.__arrive('regular'); for (const a of window.__world.actors) if (a.id) a.hp = 100; });
await W(2500);
await clear();
// 폐광 3번 성공 → 게시판 열면 모모 안내 → 파티 창 「5번째 자리 열림!」 → 5명 출발
await p.evaluate(() => { window.__P.counters.regionWins.mine = 3; });
await p.locator('#bExp').click();
await W(1200);
const momo = await p.evaluate(() => !document.querySelector('#dlg').hidden && document.querySelector('#dlg').textContent);
ok(/다섯 명/.test(momo || ''), '모모 안내: ' + (momo || '').slice(0, 40));
await clear();
await p.locator('#bExp').click();
await W(900);
await p.locator('.quest').first().click();
await W(900);
ok(/5번째 자리 열림/.test(await p.locator('#winB').textContent()), '파티 창 「5번째 자리 열림!」');
ok(/~5명/.test(await p.locator('#winB .sub').first().textContent()), '파티 ~5명');
for (let i = 0; i < 6; i++) { const b = p.locator('#winB .plist .pm:not([disabled]):not(.on)').first(); if (await b.count()) { await b.click(); await W(300); } }
const n = await p.locator('#winB .plist .pm.on').count();
ok(n === 5, '5명까지 고름 (6번째는 안 들어감): ' + n);
await p.locator('#pGo').click();
await W(800);
ok(await p.evaluate(() => window.__P.runs.some((r) => r.members.length === 5)), '5명 원정 출발');
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? "✗ " + fail + "개 실패" : "✓ 모두 통과");
await b.close();
process.exit(fail ? 1 : 0);
