// 렌더 메모리 측정 + 회귀 확인 (따밤 Galaxy Z Flip4 · 삼성 인터넷 dpr 2.6 「건물이 사라지고 그림자만」 신고)
//  · 따밤 실제 저장(tests/fixtures/real_ttabam.json, 저장 버전 7 → 게임이 옮김) · 땅 7단계로 올린 변형
//  · 412×915 · deviceScaleFactor 2.625 · 모바일 · 터치
//  · 모든 배율 × 지도 전체 훑기 × 밤 단계 0~10 → 살아 있는 캔버스 수·픽셀 · 마을 캔버스 크기 · JS 힙
//  · 확인: 마을 캔버스 기기 픽셀 ≤ CSS × 상한(2) · 그림 캐시 수 ≤ 상한 · 페이지 오류 0 · 건물이 실제로 그려짐 · 깨진 그림을 만나도 오류 없음
//  실행: URL=http://localhost:5193/ node scripts/e2e-render-mem.mjs [real|land7|both] [--measure-only]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const which = process.argv[2] ?? 'both';
const measureOnly = process.argv.includes('--measure-only');
const URL = process.env.URL ?? 'http://localhost:5193/';
const raw = JSON.parse(fs.readFileSync('tests/fixtures/real_ttabam.json', 'utf8'));
const DEV = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true };
const CAP_DPR = 2;
let fail = 0;
const ok = (c, m) => {
  console.error((c ? '✓ ' : '✗ ') + m);
  if (!c) fail++;
};

async function run(variant) {
  const save = { ...raw };
  if (variant === 'land7') save.land = 7;
  const b = await chromium.launch({ channel: 'chrome', args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const ctx = await b.newContext(DEV);
  await ctx.addInitScript((s) => {
    // 만들어진 캔버스를 모두 약한 참조로 기록 (어느 버전이든 같은 방식으로 센다)
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
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  }, JSON.stringify(save));
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Performance.enable');
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  const W = (ms) => p.waitForTimeout(ms);
  const settle = async () => {
    for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
      const busy = await p.evaluate(() => {
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
  if (variant === 'land7') {
    const l = await p.evaluate(() => window.__S.land);
    ok(l === 7, `land7 변형: S.land=${l}`);
  }

  const measure = async (label) => {
    await cdp.send('HeapProfiler.collectGarbage');
    await W(300);
    const m = await p.evaluate(() => {
      let n = 0;
      let px = 0;
      let lost = 0;
      for (const r of window.__canvasRefs) {
        const c = r.deref();
        if (!c) continue;
        n++;
        px += c.width * c.height;
        if (!c.width) lost++;
      }
      const cv = document.querySelector('#view canvas') ?? document.querySelector('canvas');
      const rc = cv.getBoundingClientRect();
      return {
        canvases: n,
        mpx: Math.round(px / 1e4) / 100,
        lost,
        backing: `${cv.width}x${cv.height}`,
        css: `${Math.round(rc.width)}x${Math.round(rc.height)}`,
        ratio: Math.round((cv.width / rc.width) * 1000) / 1000,
        zoom: window.__S.zoom,
        caches: window.__renderMem?.() ?? null,
        heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e5) / 10 : null,
      };
    });
    const pm = await cdp.send('Performance.getMetrics');
    const g = (k) => pm.metrics.find((x) => x.name === k)?.value ?? 0;
    m.cdpHeapMB = Math.round(g('JSHeapUsedSize') / 1e5) / 10;
    m.label = label;
    console.log(JSON.stringify({ variant, ...m }));
    return m;
  };

  const boot = await measure('boot');
  // 밤 색조 미리 만들기가 끝날 때까지 (예전 버전은 모든 그림 × 10단계를 만든다)
  for (let i = 0; i < 60; i++) {
    const done = await p.evaluate(() => (window.__tintPending ? !window.__tintPending() : true));
    if (done) break;
    await W(500);
  }
  await W(8000);
  const warmed = await measure('warm+8s');

  // 모든 배율 × 지도 전체 훑기 × 밤 단계
  const zooms = [];
  for (let i = 0; i < 6; i++) {
    const z = await p.evaluate(() => window.__S.zoom);
    if (zooms.includes(z)) break;
    zooms.push(z);
    let k = 0;
    const span = await p.evaluate(() => {
      const v = window.__view;
      const r = v.focus.size / 2 + 3;
      return { x: r * 16, y: r * 8, cy0: (v.focus.m - 16) * 16, LW: v.LW, LH: v.LH };
    });
    for (let y = span.cy0 - span.y; y <= span.cy0 + span.y + 1; y += Math.max(40, span.LH / 2))
      for (let x = -span.x; x <= span.x + 1; x += Math.max(40, span.LW / 2)) {
        await p.evaluate(([x, y, nt]) => {
          const v = window.__view;
          v.goal = null;
          v.cam.x = x;
          v.cam.y = y;
          window.__S.nightT = nt;
        }, [x, y, (k++ % 11) / 10]);
        await W(60);
      }
    await p.evaluate(() => document.querySelector('#bZoom').click());
    await W(400);
  }
  console.error('훑은 배율: ' + zooms.join(', '));
  const panned = await measure('pan all zooms');

  // 배율마다 마을 캔버스 크기 확인 (기기 픽셀 ≤ CSS × 2)
  const ratios = [];
  for (const z of zooms) {
    for (let i = 0; i < 6; i++) {
      if ((await p.evaluate(() => window.__S.zoom)) === z) break;
      await p.evaluate(() => document.querySelector('#bZoom').click());
      await W(300);
    }
    const r = await p.evaluate(() => {
      const cv = document.querySelector('#view canvas') ?? document.querySelector('canvas');
      const rc = cv.getBoundingClientRect();
      return { z: window.__S.zoom, w: cv.width, cssW: rc.width, h: cv.height, cssH: rc.height };
    });
    ratios.push(r);
  }

  let result = { boot, warmed, panned, ratios };
  if (!measureOnly) {
    // 배터리 절약: 상한 1.5 (×0.5에서도) — 개발 서버 모듈을 직접 불러 켠다
    const saver = await p.evaluate(async () => {
      // 앱이 실제로 불러온 주소 그대로 (HMR 뒤엔 ?t=… 가 붙어 다른 모듈이 된다)
      const url = (path) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(path)) ?? path;
      const fps = await import(url('/src/engine/fps.ts'));
      const hud = await import(url('/src/ui/hud.ts'));
      fps.setSaver(true);
      hud.setZoom(0.5);
      dispatchEvent(new Event('resize'));
      await new Promise((r) => setTimeout(r, 500));
      const cv = document.querySelector('#scene');
      const rc = cv.getBoundingClientRect();
      const out = { z: window.__S.zoom, w: cv.width, cssW: rc.width, h: cv.height, cssH: rc.height };
      fps.setSaver(false);
      dispatchEvent(new Event('resize'));
      await new Promise((r) => setTimeout(r, 400));
      return out;
    });
    ok(saver.w <= Math.ceil(saver.cssW * 1.5) + 1 && saver.h <= Math.ceil(saver.cssH * 1.5) + 1, `배터리 절약 ×${saver.z}: 마을 캔버스 ${saver.w}×${saver.h} ≤ CSS ${Math.round(saver.cssW)}×${Math.round(saver.cssH)} × 1.5`);
    for (const r of ratios) ok(r.w <= Math.ceil(r.cssW * CAP_DPR) + 1 && r.h <= Math.ceil(r.cssH * CAP_DPR) + 1, `×${r.z}: 마을 캔버스 ${r.w}×${r.h} ≤ CSS ${Math.round(r.cssW)}×${Math.round(r.cssH)} × ${CAP_DPR}`);
    const c = panned.caches;
    ok(!!c, '__renderMem 있음');
    if (c) for (const [k, v] of Object.entries(c.lru)) if (v.cap != null) ok(v.n <= v.cap, `캐시 ${k}: ${v.n} ≤ ${v.cap}`);
    ok(panned.lost === 0, `잃어버린(폭 0) 캔버스 없음: ${panned.lost}`);

    // 건물이 실제로 그려지는가: 가장 큰 건물을 화면 가운데로 → 그 자리 픽셀을 「건물 뺀 그림」과 비교
    await p.evaluate(() => document.querySelector('#bZoom').click());
    await W(400);
    const drawn = await p.evaluate(() => {
      const S = window.__S;
      const W = window.__world;
      const v = window.__view;
      const o = W.objs.filter((o) => o.sprite && !o.con && o.build === undefined).sort((a, b) => b.fw * b.fh - a.fw * a.fh)[0];
      if (!o) return { err: 'no building' };
      S.nightT = 1;
      v.goal = null;
      const N = window.__N ?? 32; // LAND10: 맵 44
      v.cam.x = ((o.tx + o.fw / 2 - (o.ty + o.fh / 2)) * 32) / 2;
      v.cam.y = ((o.tx + o.fw / 2 + o.ty + o.fh / 2 - N) * 16) / 2 - 20;
      v.OX = Math.round(v.LW / 2 - 0 - v.cam.x);
      v.OY = Math.round(v.LH * 0.5 - ((N / 2 + N / 2) * 16) / 2 - v.cam.y);
      const cv = document.querySelector('#view canvas') ?? document.querySelector('canvas');
      const g = cv.getContext('2d');
      const box = [Math.round(v.LW / 2) - 12, Math.round(v.LH / 2) - 30, 24, 24];
      window.__town.renderFrame(g, 0);
      const a = g.getImageData(...box).data;
      const i = W.objs.indexOf(o);
      W.objs.splice(i, 1);
      window.__town.renderFrame(g, 0);
      const b2 = g.getImageData(...box).data;
      W.objs.splice(i, 0, o);
      let diff = 0;
      for (let j = 0; j < a.length; j += 4) if (Math.abs(a[j] - b2[j]) + Math.abs(a[j + 1] - b2[j + 1]) + Math.abs(a[j + 2] - b2[j + 2]) > 24) diff++;
      return { kind: o.kind, diff, of: a.length / 4 };
    });
    ok(drawn.diff > drawn.of * 0.2, `건물이 그려짐 (${drawn.kind}: ${drawn.diff}/${drawn.of} 픽셀이 건물 없는 그림과 다름)`);
    result.drawn = drawn;

    // 깨진 그림: 건물 그림 하나를 디코드 실패한 <img>로 바꿔도 오류 없이 넘기고 다시 불러온다
    const broken = await p.evaluate(async () => {
      if (!window.__breakSprite) return { skip: true };
      const key = window.__breakSprite();
      const o = window.__world.objs.find((b) => b.sprite === key);
      const v = window.__view;
      for (let i = 0; i < 20; i++) {
        v.goal = null;
        v.cam.x = ((o.tx + o.fw / 2 - (o.ty + o.fh / 2)) * 32) / 2;
        v.cam.y = ((o.tx + o.fw / 2 + o.ty + o.fh / 2 - (window.__N ?? 32)) * 16) / 2;
        v.OX = Math.round(v.LW / 2 - v.cam.x);
        v.OY = Math.round(v.LH * 0.5 - 256 - v.cam.y);
        window.__town.renderFrame(document.querySelector('#view canvas').getContext('2d'), 0);
        await new Promise((r) => setTimeout(r, 150));
      }
      return { key, healed: window.__spriteOk(key), fails: window.__drawFails() };
    });
    ok(!broken.skip && broken.healed && broken.fails.includes(broken.key), `깨진 그림 넘기고 다시 불러옴: ${JSON.stringify(broken)}`);
    await W(500);
    ok(errs.length === 0, '페이지 오류 0: ' + errs.join(' | '));
  }
  await b.close();
  return result;
}

const out = {};
for (const v of which === 'both' ? ['real', 'land7'] : [which]) out[v] = await run(v);
fs.mkdirSync('screenshots/render-mem', { recursive: true });
fs.writeFileSync(`screenshots/render-mem/${process.env.TAG ?? 'run'}.json`, JSON.stringify(out, null, 1));
if (!measureOnly) {
  console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
  process.exit(fail ? 1 : 0);
}
