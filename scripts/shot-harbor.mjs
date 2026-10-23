// 10/16 예시 마을 「별무리 항구」 사진 + 확인 — 이웃 창 추천 맨 위 🏆 줄 → 방문 · 소개 한 줄 · 전설 영웅 · 펫 · 에러 없음
//  사진: shots/showcase/harbor_412_day.png · harbor_412_night.png · harbor_pc_day.png
//  실행: URL=http://localhost:4190/ node scripts/shot-harbor.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const OUT = process.env.OUT ?? 'shots/showcase';
fs.mkdirSync(OUT, { recursive: true });
const SAVE = fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const DEVS = {
  412: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
  pc: { viewport: { width: 1440, height: 900 } },
};

async function run(dev, nights) {
  console.log(`[${dev}]`);
  const ctx = await b.newContext(DEVS[dev]);
  await ctx.addInitScript((s) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  }, SAVE);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  const W = (ms) => p.waitForTimeout(ms);
  const frames = (n) => p.evaluate((n) => new Promise((res) => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 30000 });
  await W(1000);
  await p.locator('#tCont').click();
  await W(3500);
  const clearAll = () => p.evaluate(async () => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
      let busy = false;
      if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
      else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
      calm = busy ? 0 : calm + 1;
      await T(busy ? 150 : 250);
    }
  });
  await clearAll();
  await p.evaluate(() => document.getElementById('bVillage')?.click());
  await W(500);
  await p.waitForFunction(() => !!document.querySelector('#win .stp.showcase'), null, { timeout: 15000 }).catch(() => {});
  const row = await p.evaluate(() => document.querySelector('#win .stp.showcase')?.innerText.replace(/\s+/g, ' '));
  ok(/별무리 항구/.test(row ?? ''), `추천 맨 위 🏆 줄: ${row}`);
  await p.evaluate(() => document.querySelector('#win .stp.showcase')?.click());
  await W(2600);
  const st = await p.evaluate(() => ({
    vis: window.__S.visiting?.id,
    note: document.getElementById('vNote')?.textContent,
    noteShown: !document.getElementById('vNote')?.hidden,
    legends: window.__world.actors.filter((a) => a.legendId).map((a) => a.name),
    objs: window.__world.objs.length,
  }));
  console.log('  ', JSON.stringify(st));
  ok(st.vis === 'harbor', '별무리 항구 방문');
  ok(st.noteShown && st.note === '땅 10단계 · 새 건물 7종과 🍂 가을 수확제 장식이 모두 있는 마을이에요', '맨 위 한 줄');
  ok(st.legends.length >= 3, `전설 영웅 ${st.legends.join(' ')}`);
  ok(st.objs > 200, `건물·장식 ${st.objs}`);
  // 가장 멀리 → 마을 전체
  for (let i = 0; i < 6; i++) {
    await p.evaluate(() => document.querySelector('#bZoom')?.click());
    await W(200);
  }
  const zMin = await p.evaluate(() => window.__S.zoom);
  const want = dev === 'pc' ? 1 : 0.5;
  for (let i = 0; i < 6 && (await p.evaluate(() => window.__S.zoom)) !== want; i++) {
    await p.evaluate(() => document.querySelector('#bZoom')?.click());
    await W(200);
  }
  await p.evaluate(() => window.__game?.landCamera?.(false));
  await W(800);
  for (const night of nights) {
    await p.evaluate((night) => {
      const S = window.__S;
      if (S.night !== night) document.querySelector('#bDN')?.click();
      S.nightT = night ? 1 : 0;
    }, night);
    await frames(40);
    await p.evaluate((night) => void (window.__S.nightT = night ? 1 : 0), night);
    await W(1200);
    await frames(30);
    await p.screenshot({ path: `${OUT}/harbor_${dev}_${night ? 'night' : 'day'}.png` });
    const ft = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => (++n >= 120 ? res((performance.now() - t0) / n) : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    console.log(`   프레임 ${ft.toFixed(1)}ms (${night ? '밤' : '낮'})`);
  }
  // PC: 구역별 확대 (시장 · 항구 · 축제) — 배율 2
  if (dev === 'pc') {
    for (let i = 0; i < 8 && (await p.evaluate(() => window.__S.zoom)) !== 2; i++) {
      await p.evaluate(() => document.querySelector('#bZoom')?.click());
      await W(200);
    }
    const ZONES = [['market', 15, 34], ['harbor', 7, 7], ['festival', 32, 33], ['harvest_plaza', 21, 24], ['harvest_farm', 33, 7], ['harvest_walk', 10, 27]];
    for (const [name, x, y] of ZONES) {
      await p.evaluate(([x, y]) => {
        const v = window.__view;
        const N = window.__N;
        v.goal = null;
        v.cam.x = ((x - y) * 32) / 2;
        v.cam.y = ((x + y - N) * 16) / 2;
      }, [x, y]);
      await frames(40);
      await W(500);
      await p.screenshot({ path: `${OUT}/harbor_zoom_${name}.png` });
    }
  }
  ok(!errs.length, '페이지 에러 없음 ' + errs.join(' | '));
  console.log('   zoom', zMin);
  await ctx.close();
}
await run('412', [false, true]);
await run('pc', [false]);
await b.close();
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
