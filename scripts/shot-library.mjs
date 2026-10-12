// 서재 새 그림 확인: 예배당 · 서재 · 연금술 공방(모두 3×3)을 나란히 → screenshots/feedback23/library_compare.png
//  실행: URL=… node scripts/shot-library.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = JSON.parse(fs.readFileSync('tests/fixtures/ttabam_real.json', 'utf8'));
const dir = 'screenshots/feedback23';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, JSON.stringify(save));
const p = await ctx.newPage();
const W = (ms) => p.waitForTimeout(ms);
await p.goto(process.env.URL ?? 'http://localhost:5194/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
  const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
  calm = busy ? 0 : calm + 1;
  await W(busy ? 200 : 600);
}
for (const [name, clock] of [['day', 6 * 60], ['night', (22 - 6) * 60 + 60]]) {
  const box = await p.evaluate((clock) => {
    const w = window.__world;
    window.__S.clock = clock;
    // 세 건물 자리: 땅 가운데 줄 — 다른 건물은 잠깐 치우고 나란히 (저장은 안 함)
    const [a, bb] = window.__town.landBounds();
    const m = Math.floor((a + bb) / 2);
    const y = m;
    const xs = [m - 6, m - 2, m + 2];
    w.objs = w.objs.filter((o) => o.kind === 'inn' && (o.ty + o.fh < y - 1 || o.ty > y + 4));
    w.actors.forEach((x) => (x.hidden = true));
    ['chapel', 'library', 'alchemy'].forEach((k, i) => window.__town.addObj(k, xs[i], y));
    window.__town.rebuildPaths();
    window.__game.focusTile(m - 1, y + 1.5);
    return [m - 6, y];
  }, clock);
  await W(1800);
  const sc = await p.evaluate(() => window.__view.SC);
  const [L] = await p.evaluate(([x, y]) => window.__decor.xy(x - 0.5, y + 2.5), box);
  const [R] = await p.evaluate(([x, y]) => window.__decor.xy(x + 10.5, y - 0.5), box);
  const [, B] = await p.evaluate(([x, y]) => window.__decor.xy(x + 10.5, y + 2.5), box);
  const clip = { x: Math.max(0, L - 10), y: Math.max(0, B - 150 * sc), width: R - L + 20, height: 160 * sc };
  await p.screenshot({ path: `${dir}/library_compare_${name}.png`, clip });
  console.error('✓ ' + `${dir}/library_compare_${name}.png`);
}
await b.close();
