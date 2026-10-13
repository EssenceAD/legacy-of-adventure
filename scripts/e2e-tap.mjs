// 핫픽스 v0.23.4: 모바일 짧게 누르기 — 안드로이드 크롬(에뮬) 실제 터치로
//  · 건물을 엄지로 톡(움직임 0 · 10px 흔들림, 150ms) → 건물 창 열림
//  · 크게 끌기(40px) → 창 안 열림(화면 끌기)
//  실행: URL=… node scripts/e2e-tap.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const save = fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-F721N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36' });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const clear = async () => {
  for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; const pm = document.querySelector('.pmenu'); if (pm) return pm.remove(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 400);
  }
};
const cdp = await ctx.newCDPSession(p);
const touch = async (x, y, dx, ms) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  const steps = 4;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / steps, y: y + (dx * i) / (2 * steps) }] });
    await W(ms / (steps + 1));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await clear();
// 건물 하나(여관 아닌 3×3) 화면 가운데로 · 그 바닥 가운데 화면 좌표
const pos = async () => p.evaluate(() => {
  const o = window.__world.objs.find((x) => ['tavern', 'smith', 'bath', 'training'].includes(x.kind) && x.build === undefined);
  window.__game.focusTile(o.tx + o.fw / 2, o.ty + o.fh / 2);
  return { kind: o.kind, tx: o.tx + o.fw / 2, ty: o.ty + o.fh / 2 };
});
const o = await pos();
await W(800);
const xy = await p.evaluate(([x, y]) => window.__decor.xy(x - 0.5, y - 0.5), [o.tx, o.ty]);
const winOpen = () => p.evaluate(() => document.querySelector('#win').classList.contains('on'));
for (const [dx, label] of [[0, '움직임 0'], [10, '엄지 흔들림 10px']]) {
  await clear();
  await touch(xy[0], xy[1], dx, 150);
  await W(500);
  ok(await winOpen(), `${o.kind}: 짧게 톡(${label}, 150ms) → 건물 창 열림`);
}
await clear();
await touch(xy[0], xy[1], 40, 200);
await W(500);
ok(!(await winOpen()), '40px 끌기 → 창 안 열림 (화면 끌기)');
ok(errs.length === 0, '오류 0 ' + errs.join(' | '));
await b.close();
process.exit(fail ? 1 : 0);
