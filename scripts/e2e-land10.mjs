// LAND10 e2e: 웅스 저장(151채 · 땅 7) → 개발용 __setLand로 8·9·10단계 → 렌더 메모리(땅 7 vs 10 · 낮/밤) + 시트(412·1280 · 낮/밤 · 가장 멀리) + 땅 넓히기 창
//  실행: URL=http://localhost:4731/ node scripts/e2e-land10.mjs [저장 json] [mem|sheet|both]
//  결과: reports/land10/*.png · 메모리 숫자는 표준 출력(JSON 줄)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.URL ?? 'http://localhost:4731/';
const SCR = 'C:/Users/choly/AppData/Local/Temp/claude/C--Users-choly/aeed0df9-0ecc-49a1-923e-e1b70684cfba/scratchpad/woongs3/save_01.json';
const file = process.argv[2] && process.argv[2].endsWith('.json') ? process.argv[2] : fs.existsSync(SCR) ? SCR : 'tests/fixtures/real_woongs.json';
const mode = process.argv.find((a) => ['mem', 'sheet', 'both'].includes(a)) ?? 'both';
const raw = fs.readFileSync(file, 'utf8');
const OUT = 'reports/land10';
fs.mkdirSync(OUT, { recursive: true });
const PHONE = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true };
const PC = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
let fail = 0;
const ok = (c, m) => {
  console.error((c ? '✓ ' : '✗ ') + m);
  if (!c) fail++;
};
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });

async function open(dev) {
  const ctx = await b.newContext(dev);
  await ctx.addInitScript((s) => {
    const refs = [];
    const ce = Document.prototype.createElement;
    Document.prototype.createElement = function (tag, o) {
      const el = ce.call(this, tag, o);
      if (String(tag).toLowerCase() === 'canvas') refs.push(new WeakRef(el));
      return el;
    };
    window.__canvasRefs = refs;
    try {
      if (sessionStorage.getItem('x')) return;
      sessionStorage.setItem('x', 1);
    } catch {
      return;
    }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  }, raw);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  const W = (ms) => p.waitForTimeout(ms);
  const settle = async () => {
    for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
      const busy = await p.evaluate(() => {
        // 단골 제안 같은 고르기: 「보내 주기」(없으면 마지막 버튼)
        const bye = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(보내 주기|배웅해 드리기)$/.test(x.textContent.trim()));
        if (bye) return bye.click(), true;
        const ch = document.querySelector('#dChoice');
        if (ch && !ch.hidden && ch.lastElementChild) return ch.lastElementChild.click(), true;
        if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true;
        if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true;
        return false;
      });
      calm = busy ? 0 : calm + 1;
      await W(busy ? 200 : 500);
    }
  };
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__S, null, { timeout: 30000 });
  await W(1500);
  await p.locator('#tCont').click();
  await W(3000);
  await settle();
  const frames = (n) => p.evaluate((n) => new Promise((res) => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  /** 가장 멀리 (배율 목록 맨 앞) + 땅 가운데 */
  const zoomOut = async () => {
    for (let i = 0; i < 6; i++) {
      const z = await p.evaluate(() => window.__S.zoom);
      if (z === (dev === PC ? 1 : 0.5)) break;
      await p.evaluate(() => document.querySelector('#bZoom').click());
      await W(300);
    }
    await p.evaluate(() => window.__game.landCamera(false));
    await W(400);
  };
  const setLand = async (l) => {
    const r = await p.evaluate((l) => window.__setLand(l), l);
    await W(600);
    return r;
  };
  /** 낮(0) / 밤(1) 바로 */
  const setNight = async (night) => {
    await p.evaluate((night) => {
      const S = window.__S;
      if (S.night !== night) document.querySelector('#bDN').click();
      S.nightT = night ? 1 : 0;
    }, night);
    await frames(30);
    await p.evaluate((night) => void (window.__S.nightT = night ? 1 : 0), night);
    await W(500);
  };
  return { ctx, p, errs, W, settle, frames, zoomOut, setLand, setNight };
}

// ───────── 메모리: 땅 7 vs 10 · 낮/밤 (폰) ─────────
async function memRun() {
  const s = await open(PHONE);
  const { p, W, frames } = s;
  const cdp = await s.ctx.newCDPSession(p);
  await cdp.send('Performance.enable');
  const n = await p.evaluate(() => window.__world.objs.length);
  ok(n > 100, `큰 마을 ${n}채`);
  const rows = [];
  for (const L of [7, 10]) {
    const lb = await s.setLand(L);
    await s.zoomOut();
    for (const night of [false, true]) {
      await s.setNight(night);
      // 땅 위 9군데를 훑어서 캐시를 채운다
      const [a, bb] = lb;
      for (const fy of [0.15, 0.5, 0.85])
        for (const fx of [0.15, 0.5, 0.85]) {
          await p.evaluate(([x, y]) => {
            const v = window.__view;
            const N = window.__N;
            v.goal = null;
            v.cam.x = ((x - y) * 32) / 2;
            v.cam.y = ((x + y - N) * 16) / 2;
          }, [a + (bb - a) * fx, a + (bb - a) * fy]);
          await frames(20);
        }
      await p.evaluate(() => window.__game.landCamera(false));
      await frames(30);
      await cdp.send('HeapProfiler.collectGarbage');
      await W(300);
      const m = await p.evaluate(() => {
        let cn = 0;
        let px = 0;
        for (const r of window.__canvasRefs) {
          const c = r.deref();
          if (!c || !c.width) continue;
          cn++;
          px += c.width * c.height;
        }
        const v = window.__view;
        // 화면에 보이는 건물 그림 수 (땅 가운데 · 가장 멀리)
        let onScreen = 0;
        for (const o of window.__world.objs) {
          const r = window.__objRect?.(o);
          if (!r) continue;
          const [x, y, w, h] = r;
          if (x + w > 0 && y + h > 0 && x < v.LW && y < v.LH) onScreen++;
        }
        const mem = window.__renderMem();
        const g = window.__town.ground;
        const cv = document.querySelector('#view canvas') ?? document.querySelector('canvas');
        return {
          zoom: window.__S.zoom,
          land: window.__S.land,
          night: window.__S.night,
          groundCanvas: g.c ? `${g.c.width}x${g.c.height}` : null,
          groundPx: g.c ? g.c.width * g.c.height : 0,
          litPx: g.lit?.c ? g.lit.c.width * g.lit.c.height : 0,
          frontPx: g.front ? g.front.width * g.front.height : 0,
          groundCache: mem.lru.ground,
          tint: mem.lru.tint,
          recolor: mem.lru.recolor,
          hit: mem.lru.hit,
          red: mem.lru.red,
          frontTint: mem.lru.frontTint,
          canvases: cn,
          canvasMPx: Math.round(px / 1e4) / 100,
          sceneBacking: `${cv.width}x${cv.height}`,
          spritesOnScreen: onScreen,
          wild: g.wild.length,
          heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e5) / 10 : null,
        };
      });
      const fps = await p.evaluate(() => new Promise((res) => { let k = 0; const t0 = performance.now(); const f = () => { k++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(k / 2)); }; requestAnimationFrame(f); }));
      m.rafPerSec = fps;
      m.drawn = await p.evaluate(() => window.__stats?.frames ?? null);
      rows.push(m);
      console.log(JSON.stringify({ L, night, ...m }));
      for (const [k, c] of Object.entries({ tint: m.tint, recolor: m.recolor, hit: m.hit })) if (c?.cap != null) ok(c.n <= c.cap, `땅 ${L} ${night ? '밤' : '낮'}: 캐시 ${k} ${c.n} ≤ ${c.cap}`);
    }
  }
  const g7 = rows.find((r) => r.land === 7).groundPx;
  const g10 = rows.find((r) => r.land === 10).groundPx;
  ok(g7 === 1792 * 896, `땅 7 바닥 그림 1792×896 그대로 (${g7})`);
  ok(g10 === 2176 * 1088, `땅 10 바닥 그림 2176×1088 (${g10} · ×${Math.round((g10 / g7) * 100) / 100})`);
  ok(s.errs.length === 0, '페이지 오류 0 ' + s.errs.join(' | '));
  fs.writeFileSync(path.join(OUT, 'mem.json'), JSON.stringify(rows, null, 1));
  await s.ctx.close();
}

// ───────── 시트: 8·9·10 · 412/1280 · 낮/밤 · 가장 멀리 + 땅 넓히기 창 ─────────
async function sheetRun() {
  const shots = [];
  for (const [dn, dev] of [['412', PHONE], ['1280', PC]]) {
    const s = await open(dev);
    const { p, W } = s;
    await W(4000);
    await s.settle();
    for (const L of [8, 9, 10]) {
      await s.setLand(L);
      await s.zoomOut();
      for (const night of [false, true]) {
        await s.setNight(night);
        // 대화·창(전설 손님 도착 등)이 떠 있으면 닫고 찍는다
        await s.settle();
        await p.evaluate(() => window.__game.landCamera(false));
        await W(2500);
        const f = `${OUT}/village_L${L}_${dn}_${night ? 'night' : 'day'}.png`;
        await p.screenshot({ path: f });
        shots.push(f);
      }
    }
    // 땅 넓히기 창: 7단계에서 (다음 = 8단계 조건 줄) · 9단계에서 (다음 = 10단계)
    await s.setNight(false);
    for (const [L, setup] of [
      [7, { rep: 'max', abyss: 9, gold: 4_000_000 }],
      [9, { rep: 'max', abyss: 10, gold: 25_000_000, mats: 2000, eye: 40 }],
    ]) {
      await s.setLand(L);
      await p.evaluate((st) => {
        const P = window.__P;
        if (st.rep === 'max') P.rep = 99999;
        P.hunt.best.abyss = st.abyss;
        window.__S.gold = st.gold;
        if (st.mats) Object.assign(P.mats, { mine: st.mats, ice: st.mats, abyss: st.mats });
        if (st.eye) P.bossMats.eye = st.eye;
      }, setup);
      await p.evaluate(() => document.querySelector('#bBuild').click());
      await W(500);
      await p.evaluate(() => document.querySelector('#toLand').click());
      await W(600);
      const row = await p.evaluate((n) => document.querySelector(`.stp[data-l="${n}"]`)?.textContent ?? '', L + 1);
      console.log(`땅 넓히기 창 ${dn} · ${L} → ${L + 1}: ${row}`);
      ok(/평판 ★6/.test(row) && /장부 7장/.test(row), `${dn} ${L + 1}단계 조건 줄: ★6 · 장부 7장`);
      // 마지막 줄까지 보이게
      await p.evaluate(() => { const el = document.querySelector('.steps'); const last = el?.lastElementChild; last?.scrollIntoView({ block: 'end' }); });
      await W(300);
      const f = `${OUT}/landwin_${dn}_L${L}.png`;
      await p.screenshot({ path: f });
      shots.push(f);
      const allRows = await p.evaluate(() => [...document.querySelectorAll('.stp')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
      if (dn === '412' && L === 7) fs.writeFileSync(`${OUT}/landwin_rows.txt`, allRows.join('\n'));
      await p.evaluate(() => document.querySelector('#winX')?.click());
      await W(400);
    }
    ok(s.errs.length === 0, `${dn} 페이지 오류 0 ` + s.errs.join(' | '));
    await s.ctx.close();
  }
  // 한 장으로 모으기
  const ctx = await b.newContext({ viewport: { width: 1800, height: 1000 } });
  const p = await ctx.newPage();
  const img = (f, w) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="width:${w}px"><figcaption>${path.basename(f)}</figcaption></figure>`;
  const phone = shots.filter((f) => f.includes('_412_') && f.includes('village'));
  const pc = shots.filter((f) => f.includes('_1280_') && f.includes('village'));
  const win = shots.filter((f) => f.includes('landwin'));
  await p.setContent(`<style>body{background:#222;color:#ddd;font:13px sans-serif;margin:12px}h2{margin:14px 0 6px}div{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0}figcaption{font-size:11px}</style>
<h2>LAND10 · 412 (폰 · ×0.5 · 땅 8·9·10 · 낮/밤)</h2><div>${phone.map((f) => img(f, 200)).join('')}</div>
<h2>1280 (×1 · 땅 8·9·10 · 낮/밤)</h2><div>${pc.map((f) => img(f, 560)).join('')}</div>
<h2>땅 넓히기 창 (7→8 · 9→10)</h2><div>${win.map((f) => img(f, f.includes('_412_') ? 200 : 560)).join('')}</div>`);
  await p.screenshot({ path: `${OUT}/sheet.png`, fullPage: true });
  await ctx.close();
  console.log('시트:', `${OUT}/sheet.png`);
}

if (mode === 'mem' || mode === 'both') await memRun();
if (mode === 'sheet' || mode === 'both') await sheetRun();
await b.close();
console.error(fail ? `✗ 실패 ${fail}` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
