// HOTFIX14 §3: 새 지역 열림 — 잠긴 지역 탭을 누르면 무엇을 깨면 열리는지 · 1-10 첫 돌파 → 결과 화면 「새 지역이 열렸어요! ✨ 버섯 늪」 → [바로 가기] → 사냥 창 버섯 늪 탭
//  실행: dist-bot 미리보기 4190 · node scripts/e2e-region.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = JSON.parse(fs.readFileSync('tests/fixtures/beta_town.json', 'utf8'));
save.progress.hunt.best = { forest: 9 };
save.progress.hunt.firstClear = save.progress.hunt.firstClear.filter((k) => k !== 'forest-10');
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, JSON.stringify(save));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const clear = async () => {
  for (let i = 0; i < 20; i++) {
    const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
    if (st.d) await p.locator('#dlg').click().catch(() => {});
    else if (st.w) await p.locator('#winX').click().catch(() => {});
    else return;
    await W(250);
  }
};
await p.goto('http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3500);
await clear();
await p.evaluate(() => { window.__P.runs.length = 0; window.__P.hunt.auto = null; for (const a of window.__world.actors) if (a.id) { a.runId = null; a.hp = 100; } });
await p.evaluate(() => window.__openHunt());
await W(700);
await p.locator('.tab[data-r="swamp"]').click();
await W(300);
const t1 = await p.evaluate(() => document.querySelector('#toast')?.textContent ?? '');
ok(/숲 동굴 10\(보스\)을 깨면 열려요/.test(t1), `잠긴 탭 누르면 안내: 「${t1}」`);
// 1-10 직접 사냥 → 강제로 이김
await p.locator('[data-s="10"]').click();
await W(800);
await p.locator('#hMan').click();
await W(2500);
await p.evaluate(() => { const f = window.__combat.field(); f.done = 'win'; f.doneT = 0.1; });
await p.waitForSelector('#cGoReg', { timeout: 15000 }).catch(() => {});
const banner = await p.evaluate(() => document.querySelector('.newreg')?.textContent ?? '');
ok(/새 지역이 열렸어요!.*버섯 늪/.test(banner), `결과 배너: ${banner}`);
await p.locator('#cGoReg').click().catch(() => {});
await W(1200);
const onTab = await p.evaluate(() => document.querySelector('.tab.on[data-r]')?.dataset.r);
ok(onTab === 'swamp', `바로 가기 → 사냥 창 「${onTab}」 탭`);
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify(out, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
