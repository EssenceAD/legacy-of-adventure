// 땅 개편 확인: 새 게임 → 오프닝 → 울타리 반짝 안내 → 첫 건설 초록 → 땅 넓히기 1→2(나무 쓰러짐)→3 — 진짜 클릭
//  시험 준비만 개발용 전역으로 (금화·평판 별). 실행: dist-bot 미리보기 4190 · node scripts/shot-land-flow.mjs [se|phone|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'pc';
const OUT = 'screenshots/land';
fs.mkdirSync(OUT, { recursive: true });
const DEV = { se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1280, height: 800 } } };
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript(() => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
const W = (ms) => p.waitForTimeout(ms);
const out = [];
const vis = (s) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0; }, s);
const click = async (sel, ms = 600) => { try { await p.locator(sel).first().click({ timeout: 3000 }); await W(ms); return true; } catch { return false; } };
const talk = async (stopAt) => {
  for (let i = 0; i < 120; i++) {
    if (await vis('#namebox')) { await p.fill('#nameIn', '솔바람'); await click('#nameOk', 400); continue; }
    if (!(await vis('#dlg'))) return;
    if (stopAt && (await p.evaluate((t) => (document.querySelector('#dText')?.textContent ?? '').includes(t), stopAt))) return 'stop';
    if (await vis('#dChoice')) await click('#dChoice button', 400);
    else await click('#dlg', 250);
  }
};
await p.goto('http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tStart'), null, { timeout: 20000 });
await W(1500);
await click('#tStart', 1200);
await click('[data-j=warrior]', 600);
await p.fill('#cName', '루비');
await click('#cOk', 600);
await talk();
// 오프닝 끝 → 울타리 반짝 (2.6초)
await W(900);
await p.screenshot({ path: `${OUT}/${name}_1_fence_sparkle.png` });
await W(2400);
const momo = await talk('울타리 안은 전부');
out.push('모모 안내: ' + (momo === 'stop' ? '나옴' : '못 봄'));
await p.screenshot({ path: `${OUT}/${name}_2_momo.png` });
await talk();
for (let i = 0; i < 6; i++) { if (await p.evaluate(() => document.querySelector('#win').classList.contains('on'))) await click('#winX', 300); await talk(); }
// 첫 건설: 모닥불 → 배치 화면 (울타리 안 초록)
await click('#bBuild', 900);
await click('[data-k=fire]', 900);
await W(400);
await p.screenshot({ path: `${OUT}/${name}_3_first_build_green.png` });
out.push('첫 건설 초록: ' + (await p.evaluate(() => window.__landHint?.firstBuild ?? 'n/a')));
await click('#placeOk', 1500);
await talk();
for (let i = 0; i < 6; i++) { if (await p.evaluate(() => document.querySelector('#win').classList.contains('on'))) await click('#winX', 300); await talk(); }
// 땅 넓히기 1 → 2 (시험 준비: 금화·평판)
await p.evaluate(() => { window.__S.gold = 99999; window.__P.rep = 99999; });
await talk();
await click('#bBuild', 900);
await click('#toLand', 700);
out.push('2단계 버튼: ' + (await p.evaluate(() => document.querySelector('[data-l="2"]')?.disabled)));
await click('[data-l="2"]', 300);
await W(450);
await p.screenshot({ path: `${OUT}/${name}_4_felling.png` });
await W(1200);
await p.screenshot({ path: `${OUT}/${name}_5_land2.png` });
await W(1500);
const momo2 = await talk('숲이 땅이 됐어요');
out.push('넓힌 뒤 모모: ' + (momo2 === 'stop' ? '나옴' : '못 봄'));
await talk();
await W(800);
await click('#bBuild', 900);
await click('#toLand', 700);
await click('[data-l="3"]', 2600);
await talk();
await p.screenshot({ path: `${OUT}/${name}_6_land3.png` });
out.push('땅 ' + (await p.evaluate(() => window.__S.land)) + ' · 배율 ×' + (await p.evaluate(() => window.__S.zoom)));
console.log(out.join('\n'), errs.length ? '\n에러: ' + errs.join(' | ') : '');
await b.close();
