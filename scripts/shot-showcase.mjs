// SHOWCASE: 이웃 예시 마을 5곳 낮·밤 사진 (사진 모드 · 마을 전체가 들어오게)
//  실행: 미리보기(npx vite --port 5191) · URL=http://localhost:5191/ node scripts/shot-showcase.mjs [phone|pc] [id…]
//   → shots/showcase/<id>_day.png · <id>_night.png (폰 390×844) / <id>_day_pc.png · <id>_night_pc.png (PC 1366×768)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
const only = process.argv.slice(3);
const save = fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8');
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 } };
const dir = 'shots/showcase';
const CLOSE = process.env.CLOSE ? process.env.CLOSE.split(',').map(Number) : null; // 설계 확인용 가까이 보기: CLOSE=x,y
const suf = (name === 'pc' ? '_pc' : '') + (CLOSE ? '_close' : '');
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
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 600);
  }
};
await p.goto(process.env.URL ?? 'http://localhost:5191/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await settle();
await p.addStyleTag({ content: '#photoBar,#photoFrame{display:none!important}' });
const ids = await p.evaluate(() => window.__neighbors.map((v) => v.id));
for (const [i, id] of ids.entries()) {
  if (only.length && !only.includes(id)) continue;
  await p.evaluate(() => { window.__exitPhoto(); window.__S.night = false; if (window.__S.visiting) window.__game.goHome(); });
  await W(1500);
  await settle();
  await p.evaluate(() => document.querySelector('#bVillage').click());
  await W(800);
  await p.locator(`.stp[data-f="${i}"]`).click();
  await W(2500);
  await settle();
  // 마을 전체: 땅 가운데를 화면 가운데로 · 땅 너비가 화면에 들어오는 배율
  await p.evaluate(([pc, close]) => {
    const S = window.__S;
    const v = S.visiting;
    const [a, b] = window.__town.landBounds(v.land);
    const size = b - a;
    const w = innerWidth;
    const h = innerHeight;
    // 땅 너비가 화면에 들어오는 배율 (폰은 땅 모서리 나무가 조금 잘려도 됨 · 1.25배까지)
    const fit = Math.min((w * (pc ? 0.96 : 1.25)) / (size * 32), (h * 0.92) / (size * 16 + 60));
    // 배율(CSS px / 논리 px) — 기기 픽셀로 정수배가 되게 (도트가 흐려지지 않게)
    const dpr = devicePixelRatio;
    const sc = close ? (close[2] || 2) : Math.max(1, Math.floor(fit * dpr)) / dpr;
    const view = window.__view;
    const cv = document.getElementById('scene');
    const r = document.getElementById('view').getBoundingClientRect();
    view.SC = sc;
    view.LW = Math.ceil(r.width / sc);
    view.LH = Math.ceil(r.height / sc);
    cv.width = view.LW;
    cv.height = view.LH;
    cv.style.width = view.LW * sc + 'px';
    cv.style.height = view.LH * sc + 'px';
    cv.getContext('2d').imageSmoothingEnabled = false;
    window.__sc = sc;
    const m = (a + b) / 2;
    window.__view.cam.x = close ? (close[0] - close[1]) * 16 : 0;
    window.__view.cam.y = close ? (close[0] + close[1] - 32) * 8 : (m - 16) * 16 - 10;
    window.__view.goal = null;
    window.__enterPhoto();
  }, [name === 'pc', CLOSE]);
  await W(1200);
  await p.screenshot({ path: `${dir}/${id}_day${suf}.png` });
  await p.evaluate(() => { window.__S.night = true; });
  await W(2500);
  await p.screenshot({ path: `${dir}/${id}_night${suf}.png` });
  console.error(`✓ ${id} sc ${await p.evaluate(() => window.__sc)}`);
}
await p.evaluate(() => window.__exitPhoto());
console.log(errs.length ? '✗ 페이지 에러 ' + errs.join(' | ') : '✓ 페이지 에러 0');
await b.close();
