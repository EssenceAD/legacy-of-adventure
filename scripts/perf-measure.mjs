// 핫픽스 11 §5: 마을 가만히 N초 — 초당 그린 프레임 수 · 프레임당 작업 ms (개발용 __stats)
// 실행: dist-bot(BOT_BUILD) 미리보기 4190 · node scripts/perf-measure.mjs [초=30] [라벨] [saver]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const SEC = +(process.argv[2] ?? 30);
const LABEL = process.argv[3] ?? '';
const SAVER = process.argv[4] === 'saver';
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addInitScript(
  ([s, saver]) => {
    if (sessionStorage.getItem('x')) return;
    sessionStorage.setItem('x', 1);
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    if (saver) localStorage.setItem('legacy-of-adventure-saver', 'true');
  },
  [save, SAVER],
);
const p = await ctx.newPage();
await p.goto('http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 20000 });
await p.waitForTimeout(1500);
await p.locator('#tCont').click();
await p.waitForTimeout(3500);
for (let i = 0; i < 30; i++) {
  const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
  if (st.d) await p.locator('#dlg').click().catch(() => {});
  else if (st.w) await p.locator('#winX').click().catch(() => {});
  else break;
  await p.waitForTimeout(300);
}
// 조용한 마을로: 원정·맡겨 둔 사냥 끄기 (돌아오는 보고서 대화가 측정에 섞이지 않게)
await p.evaluate(() => { window.__P.runs.length = 0; window.__P.hunt.auto = null; });
// 가만히: 한 번 재고 (입력 없음)
const snap = () => p.evaluate(() => ({ f: window.__stats.frames, w: window.__stats.work, t: performance.now() }));
const rows = [];
const a = await snap();
let prev = a;
for (let s = 10; s <= SEC; s += 10) {
  await p.waitForTimeout(10000);
  const c = await snap();
  const sec = (c.t - prev.t) / 1000;
  rows.push({ at: s, fps: +((c.f - prev.f) / sec).toFixed(1), msPerFrame: +((c.w - prev.w) / Math.max(1, c.f - prev.f)).toFixed(2), msPerSec: +((c.w - prev.w) / sec).toFixed(1) });
  prev = c;
}
console.log(JSON.stringify({ label: LABEL, saver: SAVER, rows }));
if (process.env.PROBE) console.log(JSON.stringify(await p.evaluate(() => window.__visual?.())));
await b.close();
