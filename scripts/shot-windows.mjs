// 창 스크린샷 (모바일 부팅 겸): 장부·우편·공지·업적·게시판·건설·여관·가방·설정 — 창 재질이 없는지(남색 창) · 공지 탭 높이 · 페이지 에러 0
//  실행: dist-bot 미리보기 4190 · node scripts/shot-windows.mjs [se|pc] → screenshots/windows/<기기>_<창>.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'se';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = { se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } };
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  window.__conScale = 1;
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
p.on('dialog', (d) => d.accept());
const W = (ms) => p.waitForTimeout(ms);
const dir = 'screenshots/windows';
fs.mkdirSync(dir, { recursive: true });
let fail = 0;
const out = [];
const ok = (c, m) => { out.push((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const clear = async () => {
  for (let i = 0; i < 25; i++) {
    const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
    if (st.d) await p.locator('#dlg').click().catch(() => {});
    else if (st.w) await p.locator('#winX').click().catch(() => {});
    else return;
    await W(250);
  }
};
const shot = async (key) => {
  await W(500);
  await p.screenshot({ path: `${dir}/${name}_${key}.png` });
  const r = await p.evaluate(() => {
    const w = document.querySelector('#win');
    const tabs = [...document.querySelectorAll('#winB .tab')].map((t) => Math.round(t.getBoundingClientRect().height));
    return { on: w.classList.contains('on'), skin: [...w.classList].some((c) => c.startsWith('skin-')), tabMax: tabs.length ? Math.max(...tabs) : 0 };
  });
  ok(r.on && !r.skin && r.tabMax <= 48, `${key}: 창 ${r.on ? '열림' : '없음'} · 재질 ${r.skin ? '있음' : '없음'}${r.tabMax ? ` · 탭 높이 ${r.tabMax}px` : ''}`);
};
const menuTile = async (label) => {
  await clear();
  await p.locator('#bMenu2').click();
  await W(700);
  await p.locator('.mtile', { hasText: label }).first().click();
  await W(800);
};
await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3500);
await clear();
await W(1500);
await clear();
ok(await p.evaluate(() => window.__S.started), '부팅 → 마을');
await p.screenshot({ path: `${dir}/${name}_town.png` });
await menuTile('수입 장부');
await shot('ledger');
await menuTile('우편함');
await shot('mail');
await menuTile('공지');
await shot('notice');
await menuTile('업적');
await shot('achieve');
await clear();
await p.locator('#bExp').click();
await shot('board');
await clear();
await p.locator('#bBuild').click();
await shot('build');
await clear();
await p.evaluate(() => window.__showObj(window.__world.objs.find((o) => o.kind === 'inn')));
await shot('inn');
await clear();
await p.locator('#bGuest').click();
await W(600);
await p.locator('#gBag').click();
await shot('bag');
await menuTile('설정');
await shot('settings');
ok(errs.length === 0, '페이지 에러 0 ' + errs.join(' | '));
console.log(JSON.stringify({ [name]: out }, null, 1));
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
await b.close();
process.exit(fail ? 1 : 0);
