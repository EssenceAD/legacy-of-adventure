// CHECKIN §L1 T2: 화면 보호 그리기·CPU 재기 — 보통 마을 vs 화면 보호, 각각 SEC초 (입력 없음)
//  초당 그린 프레임(__stats.frames) · 그린 프레임 작업 ms 합(__stats.work = 규칙+그리기 JS 시간) · 캔버스 기기 픽셀
//  실행: URL=http://localhost:4361/ node scripts/perf-saver.mjs [초=60]   (BOT_BUILD · 실험실 켬)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4361/';
const SEC = +(process.argv[2] ?? 60);
const save = fs.readFileSync(fs.existsSync('tests/fixtures/real_ttabam.json') ? 'tests/fixtures/real_ttabam.json' : 'tests/fixtures/beta_town.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  if (sessionStorage.getItem('x')) return;
  sessionStorage.setItem('x', 1);
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  localStorage.setItem('legacy-of-adventure-visualLab', 'true');
  localStorage.setItem('legacy-of-adventure-ssAuto', '0');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, save);
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
await p.locator('#tCont').click();
await p.waitForFunction(() => window.__S.started, null, { timeout: 20000 });
for (let i = 0, calm = 0; i < 80 && calm < 4; i++) {
  const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
  if (st.d) await p.locator('#dlg').click().catch(() => {});
  else if (st.w) await p.locator('#winX').click().catch(() => {});
  calm = st.d || st.w ? 0 : calm + 1;
  await p.waitForTimeout(300);
}
await p.evaluate(() => { window.__P.runs.length = 0; });
// rAF 콜백 수도 같이 (그리기를 건너뛰어도 rAF는 돈다)
await p.evaluate(() => { window.__raf = 0; const f = () => { window.__raf++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
async function measure(label) {
  const a = await p.evaluate(() => ({ f: window.__stats.frames, w: window.__stats.work, r: window.__raf, t: performance.now(), cv: (() => { const c = document.querySelector('#scene'); return `${c.width}x${c.height}`; })() }));
  await p.waitForTimeout(SEC * 1000);
  const z = await p.evaluate(() => ({ f: window.__stats.frames, w: window.__stats.work, r: window.__raf, t: performance.now() }));
  const s = (z.t - a.t) / 1000;
  const row = { label, sec: Math.round(s), drawFps: +((z.f - a.f) / s).toFixed(2), workMsPerSec: +((z.w - a.w) / s).toFixed(1), workMsPerFrame: +((z.w - a.w) / Math.max(1, z.f - a.f)).toFixed(2), rafPerSec: +((z.r - a.r) / s).toFixed(1), canvas: a.cv };
  console.log(JSON.stringify(row));
  return row;
}
const n = await measure('보통 마을 (입력 없음)');
await p.evaluate(() => window.__ss.enter());
await p.waitForTimeout(1500);
const s = await measure('화면 보호');
await p.evaluate(() => window.__ss.exit());
await b.close();
console.log(`그린 프레임 ${n.drawFps} → ${s.drawFps}/초 · JS 작업 ${n.workMsPerSec} → ${s.workMsPerSec} ms/초 (${Math.round((1 - s.workMsPerSec / Math.max(0.01, n.workMsPerSec)) * 100)}% 줄음) · 캔버스 ${n.canvas} → ${s.canvas}`);
