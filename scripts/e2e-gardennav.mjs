// 10/17 gardenNav e2e (따스한밤 님 건의): 텃밭 1개 · 3개 · 공사 중 섞임 — ◀ ▶ 넘기기(창 안 쌓임) · ← → · 카메라 · 모두 수확 · 모두 심기
//  실행: URL=http://localhost:4190/ node scripts/e2e-gardennav.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const OUT = 'screenshots/gardennav';
fs.mkdirSync(OUT, { recursive: true });
const SAVE = fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

async function run(dev) {
  console.log(`[${dev}]`);
  const ctx = await b.newContext(dev === 'phone' ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((s) => {
    if (sessionStorage.getItem('x')) return;
    sessionStorage.setItem('x', 1);
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
  }, SAVE);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const W = (ms) => p.waitForTimeout(ms);
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 30000 });
  await W(800);
  await p.locator('#tCont').click();
  await W(3500);
  const clear = () => p.evaluate(async () => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
      let busy = false;
      if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
      else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
      calm = busy ? 0 : calm + 1;
      await T(busy ? 150 : 250);
    }
  });
  await clear();
  // 텃밭 n개 깔기 (빈자리 찾아서) · con=true면 마지막 하나는 새로 짓는 중
  const setGardens = (n, con) => p.evaluate(([n, con]) => {
    const w = window.__world;
    w.objs = w.objs.filter((o) => o.kind !== 'garden');
    const out = [];
    for (let y = 8; y < 42 && out.length < n; y++)
      for (let x = 8; x < 42 && out.length < n; x++) if (window.__canPlace({ kind: 'garden', tx: x, ty: y, fw: 3, fh: 3 })) {
        const g = window.__town.addObj('garden', x, y, { lvl: 4 });
        out.push(g);
        window.__town.rebuildPaths();
      }
    if (con) Object.assign(out[out.length - 1], { build: 1, con: { kind: 'new', end: Date.now() + 9e6, total: 120, to: 1, cut: 0, cost: 0 } });
    return out.map((g) => [g.tx, g.ty]);
  }, [n, con]);
  const openG = (i) => p.evaluate((i) => { const gs = window.__world.objs.filter((o) => o.kind === 'garden' && o.build === undefined).sort((a, b) => a.ty - b.ty || a.tx - b.tx); window.__showObj(gs[i]); }, i);
  const st = () => p.evaluate(() => ({
    title: document.getElementById('winT')?.textContent,
    on: document.getElementById('win').classList.contains('on'),
    nav: document.querySelector('#gNav b')?.textContent ?? null,
    harv: document.getElementById('gHarvAll')?.textContent, harvOff: document.getElementById('gHarvAll')?.disabled,
    plant: document.getElementById('gPlantAll')?.textContent, plantOff: document.getElementById('gPlantAll')?.disabled,
    hist: history.length, goal: window.__view.goal, cam: { ...window.__view.cam }, gold: window.__S.gold,
  }));

  // ① 텃밭 1개: 화살표 숨김 · 버튼은 있음
  await setGardens(1, false);
  await openG(0);
  await W(500);
  let s = await st();
  ok(s.title === '텃밭' && s.nav === null, `텃밭 1개: 화살표 없음 (${s.nav})`);
  ok(!!s.harv && s.harvOff, `익은 칸 없으면 「모두 수확」 흐림: ${s.harv}`);
  await clear();

  // ② 텃밭 4개 중 1개 공사 중 → 1/3
  const pos = await setGardens(4, true);
  console.log('   텃밭 자리', JSON.stringify(pos));
  await openG(0);
  await W(500);
  s = await st();
  ok(s.nav === '텃밭 1/3', `공사 중 하나 빼고 「${s.nav}」`);
  const h0 = s.hist;
  const seq = [];
  for (let i = 0; i < 3; i++) {
    await p.click('#gNext');
    await W(250);
    seq.push((await st()).nav);
  }
  ok(seq.join(',') === '텃밭 2/3,텃밭 3/3,텃밭 1/3', `▶ 세 번 = 끝에서 처음으로: ${seq.join(' → ')}`);
  await p.click('#gPrev');
  await W(250);
  s = await st();
  ok(s.nav === '텃밭 3/3', `◀ = 마지막으로: ${s.nav}`);
  ok(s.hist === h0 && s.title === '텃밭', `창 안 쌓임 (history ${h0} → ${s.hist})`);
  ok(!!s.goal || JSON.stringify(s.cam) !== JSON.stringify((await st()).cam) || true, `카메라 이동 목표 ${JSON.stringify(s.goal)}`);
  ok(!!s.goal, '카메라가 그 텃밭으로');
  await p.screenshot({ path: `${OUT}/${dev}_nav.png` });
  if (dev === 'pc') {
    await p.keyboard.press('ArrowRight');
    await W(250);
    s = await st();
    ok(s.nav === '텃밭 1/3', `→ 키: ${s.nav}`);
    await p.keyboard.press('ArrowLeft');
    await W(250);
    ok((await st()).nav === '텃밭 3/3', '← 키');
  }
  // 뒤로가기 한 번 = 창 닫힘 (텃밭이 차례로 다시 뜨지 않음)
  await p.keyboard.press('Escape');
  await W(400);
  s = await st();
  ok(!s.on, `Esc 한 번에 닫힘 (열림=${s.on})`);

  // ③ 모두 수확: 밭 두 곳 익히기
  await p.evaluate(() => {
    const gs = window.__world.objs.filter((o) => o.kind === 'garden' && o.build === undefined).sort((a, b) => a.ty - b.ty || a.tx - b.tx);
    for (const g of [gs[0], gs[2]]) for (const pl of g.plots ?? []) { pl.crop = 'carrot'; pl.at = 0; }
    const con = window.__world.objs.find((o) => o.kind === 'garden' && o.build !== undefined);
    con.plots = [{ crop: 'carrot', at: 0 }];
  });
  await openG(1);
  await W(500);
  s = await st();
  const n = +(s.harv.match(/\((\d+)\)/)?.[1] ?? -1);
  ok(n >= 6 && !s.harvOff, `「${s.harv}」 (공사 중 밭은 셈에서 빠짐)`);
  const crops0 = await p.evaluate(() => window.__P.crops.carrot ?? 0);
  await p.click('#gHarvAll');
  await W(400);
  s = await st();
  const crops1 = await p.evaluate(() => window.__P.crops.carrot ?? 0);
  ok(s.harvOff && /\(0\)/.test(s.harv), `수확 뒤 「${s.harv}」 흐림`);
  ok(crops1 > crops0, `당근 창고 ${crops0} → ${crops1}`);
  ok(s.title === '텃밭' && s.nav === '텃밭 2/3', '같은 창 그대로');

  // ④ 모두 심기: 금화 모자라면 살 수 있는 만큼
  await p.evaluate(() => (window.__S.gold = 25));
  await openG(0);
  await W(400);
  s = await st();
  ok(/빈 밭 모두 심기/.test(s.plant) && /G/.test(s.plant) && !s.plantOff, `「${s.plant}」`);
  const short = await p.evaluate(() => document.querySelector('#winB .note')?.textContent);
  console.log('   ', short);
  await p.click('#gPlantAll');
  await W(400);
  s = await st();
  ok(s.gold >= 0 && s.gold < 25, `금화 25 → ${s.gold} (모자란 만큼만 심음)`);
  await p.evaluate(() => (window.__S.gold = 100000));
  await openG(0);
  await W(300);
  await p.click('#gPlantAll');
  await W(400);
  s = await st();
  ok(s.plantOff, `빈 칸 없으면 「모두 심기」 흐림: ${s.plant}`);
  await p.screenshot({ path: `${OUT}/${dev}_bulk.png` });
  ok(!errs.length, '페이지 에러 없음 ' + errs.join(' | '));
  await ctx.close();
}
await run('phone');
await run('pc');
await b.close();
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
