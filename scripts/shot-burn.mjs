// RAIDWEAPON §6 버닝 주말 시트: 412 · 큰 마을 낮 · flags.json 을 가로채 burnWeekend 켬 + 응답 Date 머리 = 기간 안 서버 시각 (기기 시계는 그대로 10/15)
//  실행: BOT_BUILD=1 npx vite build --outDir dist-bot-burn && npx vite preview --outDir dist-bot-burn --port 4337 --strictPort
//        URL=http://localhost:4337/ node scripts/shot-burn.mjs [저장] → reports/burn/burn_412.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const APP = process.env.URL ?? 'http://localhost:4337/';
const OUT = process.env.OUT ?? 'reports/burn';
const AT = process.env.AT ?? '2026-10-17T21:40:00+09:00';
fs.mkdirSync(OUT, { recursive: true });
const big = JSON.parse(fs.readFileSync(process.argv[2] ?? 'tests/fixtures/real_woongs.json', 'utf8'));
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const br = await chromium.launch({ channel: 'chrome' });
const VER = JSON.stringify((await (await (await br.newContext()).request.get(APP + 'version.json')).json()).version);
const W = (p, ms) => p.waitForTimeout(ms);
const ctx = await br.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND });
await ctx.route('**/flags.json*', async (route) => {
  const r = await route.fetch();
  const j = await r.json();
  j.burnWeekend = true;
  await route.fulfill({ response: r, json: j, headers: { ...r.headers(), date: new Date(AT).toUTCString() } });
});
await ctx.addInitScript(
  ([s, ver]) => {
    window.__conScale = 1 / 30;
    try {
      if (sessionStorage.getItem('x')) return;
      sessionStorage.setItem('x', '1');
    } catch {
      return;
    }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', ver);
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  },
  [JSON.stringify({ ...big, night: false }), VER],
);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await p.goto(APP, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
await W(p, 600);
await p.locator('#tCont').click();
for (let i = 0, calm = 0; i < 120 && calm < 6; i++) {
  const busy = await p.evaluate(() => {
    const dlg = document.querySelector('#dlg');
    if (dlg && !dlg.hidden) {
      const sk = document.querySelector('#dSkip');
      if (sk && sk.checkVisibility()) return sk.click(), true;
      const c = document.querySelector('#dChoice button');
      if (c && c.checkVisibility()) c.click();
      else dlg.click();
      return true;
    }
    if (document.querySelector('#win')?.classList.contains('on')) return document.querySelector('#winX').click(), true;
    return false;
  });
  calm = busy ? 0 : calm + 1;
  await W(p, busy ? 200 : 300);
}
await p.waitForFunction(() => window.__S.started, null, { timeout: 20000 });
// 띠가 버닝 소식을 보일 때까지 (4초마다 번갈아)
await p.waitForFunction(() => (document.querySelector('#newsBand')?.textContent ?? '').includes('버닝'), null, { timeout: 15000 }).catch(() => errs.push('band: 버닝 글 안 보임'));
// 찍기 직전에 뜬 대화·창도 닫기 (띠는 대화 중 숨음)
for (let i = 0; i < 40; i++) {
  const busy = await p.evaluate(() => {
    const dlg = document.querySelector('#dlg');
    if (dlg && !dlg.hidden) return (document.querySelector('#dSkip')?.checkVisibility() ? document.querySelector('#dSkip') : dlg).click(), true;
    if (document.querySelector('#win')?.classList.contains('on')) return document.querySelector('#winX').click(), true;
    return !(document.querySelector('#newsBand')?.textContent ?? '').includes('버닝');
  });
  if (!busy) break;
  await W(p, 400);
}
await W(p, 200);
await p.screenshot({ path: `${OUT}/burn_412.png` });
const info = await p.evaluate(() => ({ band: document.querySelector('#newsBand')?.textContent, pill: !!document.querySelector('#burnPill:not([hidden])'), now: Date.now() }));
console.error(JSON.stringify(info), errs);
await br.close();
