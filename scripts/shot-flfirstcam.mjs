// FIRSTLOOK §1 첫 화면 카메라 시트: 전(flFirstCam 끔 = 지금) / 후(flFirstCam 켬 — flags.json 가로채기, 다른 실험실 플래그는 그대로 꺼 둠) · 360 · 412 · 1280
//  장면: ⓐ 새 세이브 첫 낮(저장 없음 → 시작하기 → 오프닝 건너뛰기 → 추천 이름) ⓑ 큰 마을 낮(옛 저장 = 그대로여야 함) ⓒ 같은 마을 밤
//        + 물러나기 순간(412 · 새 세이브 → 땅 처음 넓히기: 직전 · 0.15 · 0.3 · 0.45 · 0.8초)
//  실행: BOT_BUILD=1 npx vite build --outDir dist-bot-flcam && npx vite preview --outDir dist-bot-flcam --port 4341 --strictPort
//        URL=http://localhost:4341/ node scripts/shot-flfirstcam.mjs <큰 마을 저장> → reports/firstlook/cam/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const APP = process.env.URL ?? 'http://localhost:4341/';
const OUT = process.env.OUT ?? 'reports/firstlook/cam';
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

/** 마을 열기: save = null 이면 새 세이브 */
async function open(width, after, save) {
  const ctx = await br.newContext(dev(width));
  await ctx.route('**/flags.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...FLAGS, flFirstCam: after }) }));
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
const info = (p) => p.evaluate(() => ({ zoom: window.__S.zoom, day: window.__S.day, night: window.__S.night, gold: window.__S.gold, land: window.__S.land, fc: window.__P.firstCam, cam: [Math.round(window.__view.cam.x), Math.round(window.__view.cam.y)] }));
const shot = async (p, name) => {
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.error('✓ ' + name + ' ' + JSON.stringify(await info(p)));
};

const nightSave = { ...big, night: true };
const daySave = { ...big, night: false };
const bigJson = JSON.stringify(big);
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
      } catch (e) {
        errs.push(`${scene}_${tag} 못 찍음: ${String(e).slice(0, 300)}`);
      }
      await ctx?.close();
    }
  }
}
if (JSON.stringify(big) !== bigJson) errs.push('큰 마을 저장 파일 내용이 바뀜');

// 팻말 글씨 (1280 · 팻말이 화면 안)
for (const after of [false, true]) {
  let ctx;
  try {
    const o = await open(1280, after, null);
    ctx = o.ctx;
    const p = o.p;
    await W(p, 3000);
    await clear(p);
    // 땅 2단계 조건 채우기 (금화 · 평판) — 팻말 글씨 50% 규칙도 같이: 100G(글씨 없음) → 150G(글씨)
    await p.evaluate(() => (window.__S.gold = 100));
    await W(p, 400);
    await shot(p, `sign_${after ? 'after' : 'before'}_100g`);
    await p.evaluate(() => (window.__S.gold = 150));
    await W(p, 400);
    await shot(p, `sign_${after ? 'after' : 'before'}_150g`);
  } catch (e) {
    errs.push(`sign ${after} 못 찍음: ${String(e).slice(0, 300)}`);
  }
  await ctx?.close();
}

const PULLT = {};
// 물러나기 순간 (412 · 새 세이브 → 땅 처음 넓히기)
for (const after of [false, true]) {
  let ctx;
  try {
    const o = await open(412, after, null);
    ctx = o.ctx;
    const p = o.p;
    await W(p, 3000);
    await clear(p);
    await p.evaluate(() => {
      window.__S.gold = 5000;
      window.__P.rep = Math.max(window.__P.rep, 999);
    });
    await shot(p, `pull_${after ? 'after' : 'before'}_0`);
    const t0 = Date.now();
    const [why, tf] = await p.evaluate(() => {
      window.__game.expandLand(2);
      return [window.__S.land, getComputedStyle(document.querySelector('#scene')).transform];
    });
    if (why !== 2) errs.push(`땅 넓히기 안 됨 (land ${why})`);
    console.error('   넓힌 직후 캔버스 transform: ' + tf);
    for (const i of [1, 2, 3, 4]) {
      if (i === 4) await W(p, 500);
      const ms = Date.now() - t0;
      await shot(p, `pull_${after ? 'after' : 'before'}_${i}`);
      PULLT[`${after}_${i}`] = ms;
    }
  } catch (e) {
    errs.push(`pull ${after} 못 찍음: ${String(e).slice(0, 300)}`);
  }
  await ctx?.close();
}

// 묶음 시트
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(`${OUT}/${f}.png`).toString('base64');
const has = (f) => fs.existsSync(`${OUT}/${f}.png`);
const page = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const css = 'body{margin:0;background:#16141f;color:#eee;font:14px sans-serif;padding:12px}h2{margin:6px 0 10px}table{border-collapse:collapse}td{vertical-align:top;padding:6px}img{display:block;border:1px solid #444}small{color:#aaa}';
for (const [scene, title] of [['a_new', 'ⓐ 새 세이브 첫 낮'], ['b_bigday', 'ⓑ 큰 마을 낮 (옛 저장 — 같아야 함)'], ['c_bignight', 'ⓒ 큰 마을 밤 (옛 저장 — 같아야 함)']]) {
  const rows = [360, 412, 1280]
    .map((w) => `<tr><td><b>${w}</b></td>${['before', 'after'].map((m) => (has(`${scene}_${w}_${m}`) ? `<td><small>${m === 'before' ? '전 (flFirstCam 끔 = 지금)' : '후 (flFirstCam 켬)'}</small><img src="${b64(`${scene}_${w}_${m}`)}" style="width:${w === 1280 ? 640 : 300}px"></td>` : '<td>—</td>')).join('')}</tr>`)
    .join('');
  await page.setContent(`<style>${css}</style><h2>FIRSTLOOK §1 첫 화면 카메라 — ${title}</h2><table>${rows}</table>`);
  await page.screenshot({ path: `${OUT}/SHEET_${scene}.png`, fullPage: true });
}
const strip = (m) => [0, 1, 2, 3, 4].filter((i) => has(`pull_${m}_${i}`)).map((i) => `<td><small>${i ? `넓힌 뒤 ${((PULLT[`${m === 'after'}_${i}`] ?? 0) / 1000).toFixed(2)}초` : '직전'}</small><img src="${b64(`pull_${m}_${i}`)}" style="width:200px"></td>`).join('');
const sign = (m) => ['100g', '150g'].filter((g) => has(`sign_${m}_${g}`)).map((g) => `<td><small>금화 ${g.replace('g', 'G')} (300G의 ${g === '100g' ? '33' : '50'}%)</small><img src="${b64(`sign_${m}_${g}`)}" style="width:420px"></td>`).join('');
await page.setContent(`<style>${css}</style><h2>물러나기 순간 — 412 새 세이브 · 땅 처음 넓히기 (「땅이 넓어졌어요!」)</h2><table><tr><td><b>전</b></td>${strip('before')}</tr><tr><td><b>후</b></td>${strip('after')}</tr></table><h2>「땅 넓히기 ○G」 팻말 글씨 (금화 50% 규칙)</h2><table><tr><td><b>전</b></td>${sign('before')}</tr><tr><td><b>후</b></td>${sign('after')}</tr></table>`);
await page.screenshot({ path: `${OUT}/SHEET_pull.png`, fullPage: true });
await br.close();
console.error(errs.length ? '✗ 오류:\n' + errs.join('\n') : '✓ 페이지 오류 0');
process.exit(errs.length ? 1 : 0);
