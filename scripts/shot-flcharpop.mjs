// FIRSTLOOK §6 캐릭터가 눈에 띄게 시트: 전(flCharPop 끔 = 지금) / 후(flCharPop 켬 — flags.json 가로채기, 다른 플래그는 그대로) · 360 · 412 · 1280
//  장면: ⓐ 새 세이브 첫 낮 ⓑ 큰 마을 낮 ⓒ 같은 마을 밤 + 확대(×4) 「돌길 위 · 잔디 위 · 밤」 (전/후 나란히 · 걷는 사람 우선)
//  실행: BOT_BUILD=1 npx vite build --outDir dist-bot-flpop && npx vite preview --outDir dist-bot-flpop --port 4352 --strictPort
//        URL=http://localhost:4352/ node scripts/shot-flcharpop.mjs <큰 마을 저장> → reports/firstlook/pop/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const APP = process.env.URL ?? 'http://localhost:4352/';
const OUT = process.env.OUT ?? 'reports/firstlook/pop';
fs.mkdirSync(OUT, { recursive: true });
const big = JSON.parse(fs.readFileSync(process.argv[2] ?? 'tests/fixtures/real_woongs.json', 'utf8'));
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const br = await chromium.launch({ channel: 'chrome' });
const VER = JSON.stringify((await (await (await br.newContext()).request.get(APP + 'version.json')).json()).version);
const FLAGS = await (await (await br.newContext()).request.get(APP + 'flags.json')).json();
const errs = [];
const W = (p, ms) => p.waitForTimeout(ms);
const dev = (w) =>
  w === 1280 ? { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } : { viewport: { width: w, height: w === 360 ? 740 : 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND };

async function clear(p) {
  for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
    const busy = await p.evaluate(() => {
      const nb = document.querySelector('#namebox');
      if (nb && !nb.hidden) return document.querySelector('#nameSug button')?.click(), true;
      const dlg = document.querySelector('#dlg');
      if (dlg && !dlg.hidden) {
        const c = document.querySelector('#dChoice button');
        if (c && c.checkVisibility()) c.click();
        else dlg.click();
        return true;
      }
      if (document.querySelector('#win')?.classList.contains('on')) return document.querySelector('#winX').click(), true;
      return false;
    });
    calm = busy ? 0 : calm + 1;
    await W(p, busy ? 200 : 300);
  }
}

/** 마을 열기: save = null 이면 새 세이브 · after = flCharPop만 켬 */
async function open(width, after, save) {
  const ctx = await br.newContext(dev(width));
  await ctx.route('**/flags.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...FLAGS, flCharPop: after }) }));
  await ctx.addInitScript(
    ([s, ver]) => {
      window.__conScale = 1 / 30;
      try {
        if (sessionStorage.getItem('x')) return;
        sessionStorage.setItem('x', '1');
      } catch {
        return;
      }
      localStorage.clear();
      if (s) localStorage.setItem('legacy-of-adventure-save', s);
      localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
      localStorage.setItem('legacy-of-adventure-lastVersion', ver);
      localStorage.setItem('legacy-of-adventure-settleOff', 'true');
      localStorage.setItem('legacy-of-adventure-telemetry', 'false');
      localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    },
    [save ? JSON.stringify(save) : null, VER],
  );
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${width}/${after}: ${String(e).slice(0, 200)}`));
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tStart'), null, { timeout: 30000 });
  await W(p, 600);
  if (save) await p.locator('#tCont').click();
  else {
    await p.locator('#tStart').click();
    await W(p, 500);
    for (let i = 0; i < 5; i++) await p.locator('#dSkip').click({ force: true, timeout: 1000 }).catch(() => {});
  }
  await clear(p);
  await p.waitForFunction(() => window.__S.started, null, { timeout: 20000 });
  return { ctx, p };
}
const shot = async (p, name) => {
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.error('✓ ' + name + ' ' + JSON.stringify(await p.evaluate(() => ({ zoom: window.__S.zoom, night: window.__S.night, n: window.__world.actors.length }))));
};

/**
 * 확대 장면 고정 (전/후가 같은 사람 · 같은 자리 · 같은 프레임): 그리기 루프를 멈추고(rAF 끊기) S.T 고정 →
 *  손님 두 명(이름순 첫 두 명)만 남기고 숨김 → where('path' = 돌길 · 'grass' = 잔디) 칸 중 화면 가운데에 가까운 두 칸에 세움 →
 *  왼쪽 = 걷는 중(지나가는 발 프레임 = 통통 1px) · 오른쪽 = 서 있음 → renderFrame 한 번 → 두 사람 둘레 CSS 영역
 */
const stage = (p, where, force) =>
  p.evaluate(([where, force]) => {
    window.requestAnimationFrame = () => 0;
    const S = window.__S;
    const v = window.__view;
    const paint = window.__P.decor.paint || {};
    const auto = new Set(window.__autoTiles().map(([x, y]) => x + ',' + y));
    const MATS = ['stone', 'dirt', 'brick', 'deck', 'step'];
    const isPath = (x, y) => auto.has(x + ',' + y) || MATS.includes(paint[x + ',' + y]);
    const [lo, hi] = window.__town.landBounds();
    const busy = new Set();
    for (const o of window.__world.objs) for (let i = -1; i <= o.fw; i++) for (let j = -1; j <= o.fh; j++) busy.add(o.tx + i + ',' + (o.ty + j));
    const ok = (x, y) => x >= lo && y >= lo && x < hi && y < hi && !busy.has(x + ',' + y) && (where === 'path' ? isPath(x, y) : !isPath(x, y) && !paint[x + ',' + y]);
    const vw = innerWidth, vh = innerHeight;
    // 바닥 색 보기: 사람을 다 숨기고 한 번 그린 뒤 칸 가운데 둘레 색 (잔디 = 초록이 뚜렷)
    const people = window.__world.actors.filter((a) => !a.role && !a.cameo && a.fading === undefined).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const a of window.__world.actors) a.hidden = true;
    S.T = 1000;
    const cv = document.getElementById('scene');
    const cx2 = cv.getContext('2d');
    window.__town.renderFrame(cx2, 0);
    const rc = cv.getBoundingClientRect();
    const k = cv.width / rc.width;
    const green = (x, y) => {
      const [X, Y] = window.__decor.xy(x, y);
      const d = cx2.getImageData(Math.round((X - rc.left) * k) - 6, Math.round((Y + 8 * v.SC - rc.top) * k) - 4, 12, 5).data;
      let g = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 1] > d[i] + 12 && d[i + 1] > d[i + 2] + 12) g++;
      return g / (d.length / 4);
    };
    const floor = (x, y) => (where === 'path' ? green(x, y) < 0.1 : green(x, y) > 0.9);
    let best = force ? { x: force[0], y: force[1], d: 0 } : null;
    if (!force) for (let y = lo; y < hi; y++)
      for (let x = lo; x < hi - 1; x++) {
        if (!ok(x, y) || !ok(x + 1, y) || !ok(x, y - 1) || !ok(x + 1, y - 1)) continue;
        const [cx, cy] = window.__decor.xy(x + 0.5, y);
        if (cx < 120 || cx > vw - 120 || cy < 160 || cy > vh - 120) continue;
        if (!floor(x, y) || !floor(x + 1, y)) continue;
        const d = Math.hypot(cx - vw / 2, cy - vh / 2);
        if (!best || d < best.d) best = { x, y, d };
      }
    if (!best || people.length < 2) return null;
    const [A, B] = people;
    for (const a of window.__world.actors) a.hidden = a !== A && a !== B;
    S.T = 1000;
    Object.assign(A, { x: best.x + 0.5, y: best.y + 0.5, st: 'walk', ph: 0.2 + 1, dir: 1, back: false, pop: 0 }); // floor(8000 + 1.2) % 4 = 1 → 지나가는 발
    Object.assign(B, { x: best.x + 1.5, y: best.y + 0.5, st: 'idle', ph: 0.05, dir: -1, back: false, pop: 0 });
    window.__town.renderFrame(document.getElementById('scene').getContext('2d'), 0);
    const [ax, ay] = window.__decor.xy(best.x, best.y);
    const [bx] = window.__decor.xy(best.x + 1, best.y);
    const fy = ay + 8 * v.SC;
    const x0 = Math.min(ax, bx) - 18 * v.SC, x1 = Math.max(ax, bx) + 18 * v.SC;
    return { x: x0, y: fy - 44 * v.SC, w: x1 - x0, h: 50 * v.SC, a: A.name, b: B.name, sc: v.SC, tile: [best.x, best.y] };
  }, [where, force]);
const TILE = {};

const nightSave = { ...big, night: true };
const daySave = { ...big, night: false };
const bigJson = JSON.stringify(big);
const CROP = {};
for (const width of [360, 412, 1280]) {
  for (const after of [false, true]) {
    const tag = `${width}_${after ? 'after' : 'before'}`;
    for (const [scene, save] of [['a_new', null], ['b_bigday', daySave], ['c_bignight', nightSave]]) {
      let ctx;
      try {
        const o = await open(width, after, save);
        ctx = o.ctx;
        const p = o.p;
        await W(p, scene === 'a_new' ? 4000 : 2500);
        await clear(p);
        if (scene === 'c_bignight' && !(await p.evaluate(() => window.__S.night))) {
          await p.evaluate(() => document.querySelector('#bDN').click());
          await W(p, 2500);
          await clear(p);
        }
        await shot(p, `${scene}_${tag}`);
        // 확대 (1280에서만 · 큰 마을): 낮 = 돌길 위 · 잔디 위 / 밤 = 아무 데나(돌길 먼저)
        if (width === 1280 && scene !== 'a_new') {
          const kinds = scene === 'b_bigday' ? ['path', 'grass'] : ['night'];
          for (const k of kinds) {
            // 같은 판에서 두 번째 장면: 다시 열지 않고 다시 세운다 (루프는 이미 멈춤)
            const c = await stage(p, k === 'night' ? 'path' : k, TILE[k]);
            if (c) TILE[k] = c.tile; // 후(켬)도 전(끔)과 같은 칸
            if (!c) {
              errs.push(`확대 ${k} ${tag}: 고를 사람 없음`);
              continue;
            }
            const name = `zoom_${k}_${after ? 'after' : 'before'}`;
            await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x: c.x, y: c.y, width: c.w, height: c.h } });
            CROP[name] = c;
            console.error(`  ✓ ${name} ${c.a} 걷는 중 · ${c.b} 서 있음 · 칸 ${c.tile} · SC ${c.sc}`);
          }
        }
      } catch (e) {
        errs.push(`${scene}_${tag} 못 찍음: ${String(e).slice(0, 300)}`);
      }
      await ctx?.close();
    }
  }
}
if (JSON.stringify(big) !== bigJson) errs.push('큰 마을 저장 파일 내용이 바뀜');

// 묶음 시트
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(`${OUT}/${f}.png`).toString('base64');
const has = (f) => fs.existsSync(`${OUT}/${f}.png`);
const page = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const css = 'body{margin:0;background:#16141f;color:#eee;font:14px sans-serif;padding:12px}h2{margin:6px 0 10px}table{border-collapse:collapse}td{vertical-align:top;padding:6px}img{display:block;border:1px solid #444}small{color:#aaa}.px{image-rendering:pixelated}';
for (const [scene, title] of [['a_new', 'ⓐ 새 세이브 첫 낮'], ['b_bigday', 'ⓑ 큰 마을 낮'], ['c_bignight', 'ⓒ 큰 마을 밤']]) {
  const rows = [360, 412, 1280]
    .map((w) => `<tr><td><b>${w}</b></td>${['before', 'after'].map((m) => (has(`${scene}_${w}_${m}`) ? `<td><small>${m === 'before' ? '전 (flCharPop 끔 = 지금)' : '후 (flCharPop 켬)'}</small><img src="${b64(`${scene}_${w}_${m}`)}" style="width:${w === 1280 ? 640 : 300}px"></td>` : '<td>—</td>')).join('')}</tr>`)
    .join('');
  await page.setContent(`<style>${css}</style><h2>FIRSTLOOK §6 캐릭터가 눈에 띄게 — ${title}</h2><table>${rows}</table>`);
  await page.screenshot({ path: `${OUT}/SHEET_${scene}.png`, fullPage: true });
}
// 확대 ×4 (게임 도트 1칸 = 4px)
const zrow = (k, title) =>
  `<tr><td><b>${title}</b></td>${['before', 'after'].map((m) => {
    const n = `zoom_${k}_${m}`;
    const c = CROP[n];
    return has(n) && c ? `<td><small>${m === 'before' ? '전 (끔)' : '후 (flCharPop 켬)'} · 왼쪽 ${c.a} 걷는 중(지나가는 발) · 오른쪽 ${c.b} 서 있음</small><img class="px" src="${b64(n)}" style="width:${(c.w / c.sc) * 4}px;height:${(c.h / c.sc) * 4}px"></td>` : '<td>—</td>';
  }).join('')}</tr>`;
await page.setContent(`<style>${css}</style><h2>FIRSTLOOK §6 확대 ×4 — 전/후 (같은 사람 · 같은 자리 · 같은 프레임 · 다른 사람은 숨김)</h2><table>${zrow('path', '돌길 위')}${zrow('grass', '잔디 위')}${zrow('night', '밤')}</table>`);
await page.screenshot({ path: `${OUT}/SHEET_zoom.png`, fullPage: true });
await br.close();
console.error(errs.length ? '✗ 오류:\n' + errs.join('\n') : '✓ 페이지 오류 0');
process.exit(errs.length ? 1 : 0);
