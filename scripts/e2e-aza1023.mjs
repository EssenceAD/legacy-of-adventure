// 아자 10/23 e2e — ① 텃밭 ◀ ▶ 뒤 카메라 고정(목표가 카메라 한계 밖) → 끌면 움직이나 · ② 일괄 분해 「고유 장비 남기기」 · ③ 장비 고르기 옵션 한 줄
//  실행: URL=http://localhost:4190/ SAVE=<텃밭 2개 이상 저장> node scripts/e2e-aza1023.mjs   (BOT_BUILD 빌드)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const SAVE = process.env.SAVE ?? 'tests/fixtures/real_woongs.json';
const SHOT = process.env.SHOT ?? '';
const b = await chromium.launch({ channel: 'chrome' });
const errs = [];
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const VER = await (async () => { const cx = await b.newContext(); const v = (await (await cx.request.get(URL + 'version.json')).json()).version; await cx.close(); return JSON.stringify(v); })();
const sv = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(([s, ver]) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', ver);
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-telemetry', 'false');
}, [JSON.stringify({ ...sv, clock: 6 * 60, night: false }), VER]);
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
await p.locator('#tCont').click();
await p.waitForFunction(() => window.__S.started && !document.querySelector('#hud').hidden, null, { timeout: 20000 });
await p.evaluate(async () => {
  const T = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0, quiet = 0; i < 60 && quiet < 3; i++) {
    let busy = false;
    if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
    else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
    quiet = busy ? 0 : quiet + 1;
    await T(busy ? 120 : 250);
  }
});
const cam = () => p.evaluate(() => ({ x: window.__view.cam.x, y: window.__view.cam.y, goal: window.__view.goal }));
const drag = async () => {
  await p.mouse.move(200, 500);
  await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(200 - i * 15, 500 - i * 10); await W(30); }
  await p.mouse.up();
  await W(300);
};
// ① 텃밭 ◀ ▶
const gardens = await p.evaluate(() => window.__world.objs.filter((o) => o.kind === 'garden').length);
ok(gardens >= 2, `텃밭 ${gardens}개`);
await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'garden')));
await W(400);
for (let i = 0; i < gardens + 1; i++) { await p.evaluate(() => document.getElementById('gNext')?.click()); await W(500); }
await W(1500);
await p.evaluate(() => document.querySelector('#winX')?.click());
await W(300);
const c0 = await cam();
await drag();
const c1 = await cam();
ok(Math.abs(c1.x - c0.x) + Math.abs(c1.y - c0.y) > 5 && !c1.goal, `텃밭 넘긴 뒤 끌기 → 카메라 움직임 (${c0.x.toFixed(0)},${c0.y.toFixed(0)} → ${c1.x.toFixed(0)},${c1.y.toFixed(0)})`);
// 한계 밖 목표(아자 상황 그대로)도 놓는다
await p.evaluate(() => (window.__view.goal = { x: 99999, y: -99999 }));
await W(800);
const c2 = await cam();
ok(!c2.goal, '카메라 한계 밖 목표는 1초 안에 놓음');
await drag();
const c3 = await cam();
ok(Math.abs(c3.x - c2.x) + Math.abs(c3.y - c2.y) > 5, '그 뒤 끌기 → 움직임');
// ② 일괄 분해 「고유 장비 남기기」
await p.evaluate(() => document.querySelector('#bGuest').click());
await W(300);
await p.evaluate(() => document.querySelector('#gBag')?.click());
await W(300);
await p.evaluate(() => document.querySelector('#salAll')?.click());
await W(300);
const bk = await p.evaluate(() => ({ has: !!document.querySelector('#bkUniq'), on: document.querySelector('#bkUniq')?.checked, text: document.querySelector('#bkUniq')?.parentElement?.textContent ?? '' }));
ok(bk.has && bk.on, `일괄 분해 「고유 장비 남기기」 기본 켬 (${bk.text.trim()})`);
if (SHOT) await p.screenshot({ path: SHOT + '-bulk.png' });
// ③ 장비 고르기 옵션 한 줄
const aid = await p.evaluate(() => window.__world.actors.find((a) => (a.status === 'regular' || a.status === 'hero') && a.runId == null && a.equip?.weapon != null)?.id ?? null);
if (aid != null) {
  await p.evaluate((id) => window.__showActor(window.__world.actors.find((a) => a.id === id)), aid);
  await W(300);
  await p.evaluate(() => document.querySelector('.slot[data-s="weapon"]')?.click());
  await W(400);
  // 강화 창이 뜨면 그 안의 [바꾸기]로
  await p.evaluate(() => [...document.querySelectorAll('#win button')].find((b) => /바꾸기|다른 장비/.test(b.textContent))?.click());
  await W(400);
  const ol = await p.evaluate(() => ({ rows: document.querySelectorAll('.ilist .irow').length, lines: document.querySelectorAll('.irow .optln').length, over: [...document.querySelectorAll('.irow .optln')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length }));
  ok(ol.lines > 0 && ol.over === 0, `장비 고르기 옵션 한 줄 ${ol.lines}/${ol.rows}줄 · 화면 밖 ${ol.over}`);
  if (SHOT) await p.screenshot({ path: SHOT + '-pick.png' });
}
ok(errs.length === 0, `페이지 오류 ${errs.length}${errs.length ? ': ' + errs.join(' | ') : ''}`);
await b.close();
console.error(fail ? `\n✗ ${fail}개 실패` : '\n✓ 모두 통과');
process.exit(fail ? 1 : 0);
