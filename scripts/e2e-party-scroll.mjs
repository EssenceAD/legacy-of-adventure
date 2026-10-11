// 핫픽스 12 §4: 파티 고를 때 목록 스크롤이 맨 위로 튀지 않는지 — 원정 파티 창 · 사냥 준비 창 (SE · 진짜 클릭)
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
const scrolls = () => p.evaluate(() => ({ list: document.querySelector('#winB .plist')?.scrollTop ?? -1, body: document.querySelector('#winB')?.scrollTop ?? -1, max: (() => { const e = document.querySelector('#winB .plist'); return e ? e.scrollHeight - e.clientHeight : 0; })() }));
const check = async (where) => {
  const s0 = await p.evaluate(() => { const e = document.querySelector('#winB .plist'); e.scrollTop = e.scrollHeight; return e.scrollTop; });
  ok(s0 > 20, `${where}: 목록이 스크롤됨 (${s0}px)`);
  const last = p.locator('#winB .plist .pm:not([disabled])').last();
  await last.scrollIntoViewIfNeeded();
  const before = await scrolls();
  await last.click();
  await W(400);
  const after = await scrolls();
  ok(Math.abs(after.list - before.list) <= 2 && Math.abs(after.body - before.body) <= 2, `${where}: 맨 아래 손님 선택 뒤 스크롤 그대로 (목록 ${before.list}→${after.list} · 창 ${before.body}→${after.body})`);
  ok(await p.evaluate(() => [...document.querySelectorAll('#winB .plist .pm')].some((x) => x.classList.contains('on'))), `${where}: 선택됨`);
};
// 원정 파티 창
await p.locator('#bExp').click();
await W(900);
await p.locator('.quest').first().click();
await W(900);
await check('원정');
await clear();
// 사냥 준비 창
await p.locator('#bExp').click();
await W(900);
await p.locator('#rHunt').click().catch(() => {});
await W(800);
await p.locator('[data-s="1"]').click();
await W(900);
await check('사냥');
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
