// TOWN T1: 이웃 마을 5곳 스크린샷 (PC 마을 전체 · 폰) + 배치 그대로인지(배치 검사에서 빠진·옮겨진 것 0)
//  실행: 미리보기 · URL=… node scripts/shot-neighbors.mjs [pc|phone] → screenshots/neighbors/<기기>_<id>.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'pc';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = { pc: { viewport: { width: 2400, height: 1500 }, deviceScaleFactor: 1 }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const dir = 'screenshots/neighbors';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
  const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
  calm = busy ? 0 : calm + 1;
  await W(busy ? 200 : 600);
}
const ids = await p.evaluate(() => window.__neighbors.map((v) => v.id));
for (const id of ids) {
  await p.evaluate((id) => window.__game.visit(window.__neighbors.find((v) => v.id === id)), id);
  await W(2200);
  // 배치 그대로인가: 장부의 칸 수 = 실제 놓인 칸 수 · 자리
  const r = await p.evaluate((id) => {
    const v = window.__neighbors.find((x) => x.id === id);
    const objs = window.__world.objs;
    const miss = v.layout.filter(([k, x, y]) => !objs.some((o) => o.kind === k && o.tx === x && o.ty === y)).map(([k, x, y]) => `${k}@${x},${y}`);
    return { n: v.layout.length, placed: objs.length, miss };
  }, id);
  ok(r.miss.length === 0, `${id}: ${r.placed}/${r.n} 그대로${r.miss.length ? ' · 옮겨지거나 빠짐 ' + r.miss.join(' ') : ''}`);
  if (name === 'pc') await p.evaluate(() => { for (let i = 0; i < 6; i++) window.__view && (window.__S.zoom = Math.max(1, (window.__S.zoom ?? 2) - 1)); });
  await W(400);
  await p.screenshot({ path: `${dir}/${name}_${id}.png` });
}
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
