// FIRSTLOOK §5 오른쪽 버튼 줄 시트: 전(flSideRail 끔 = 지금) / 후(flSideRail 만 켬 — flags.json 가로채기, 다른 실험실 플래그는 그대로) · 360 · 412 · 1280
//  장면: ⓐ 새 세이브 첫 낮 ⓑ 큰 마을 낮 ⓒ 같은 마을 밤 + 후: 「⋯」 펼침(큰 마을 낮) · 빨간 점이 「⋯」에(안의 소리 버튼에 점을 얹어 봄)
//  실행: BOT_BUILD=1 npx vite build --outDir dist-bot-flrail && npx vite preview --outDir dist-bot-flrail --port 4351 --strictPort
//        URL=http://localhost:4351/ node scripts/sheet-flrail.mjs <큰 마을 저장> → reports/firstlook/rail/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const APP = process.env.URL ?? 'http://localhost:4351/';
const OUT = process.env.OUT ?? 'reports/firstlook/rail';
fs.mkdirSync(OUT, { recursive: true });
const big = JSON.parse(fs.readFileSync(process.argv[2] ?? 'tests/fixtures/real_woongs.json', 'utf8'));
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const br = await chromium.launch({ channel: 'chrome' });
const VER = JSON.stringify((await (await (await br.newContext()).request.get(APP + 'version.json')).json()).version);
const FLAGS = await (await (await br.newContext()).request.get(APP + 'flags.json')).json();
const errs = [];
let fail = 0;
const ok = (c, m) => {
  console.error((c ? '✓ ' : '✗ ') + m);
  if (!c) fail++;
};
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

/** 마을 열기: save = null 이면 새 세이브 · after = flSideRail 만 켬 */
async function open(width, after, save) {
  const ctx = await br.newContext(dev(width));
  await ctx.route('**/flags.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...FLAGS, flSideRail: after }) }));
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
/** 오른쪽 버튼 중 보이는 것 (위에서 아래로) */
const rightShown = (p) =>
  p.evaluate(() =>
    ['#bDN', '#bHarm', '#hSpk', '#bZoom', '#bEye', '#bRail']
      .map((s) => [s, document.querySelector(s)])
      .filter(([, e]) => e && e.checkVisibility({ visibilityProperty: true }) && e.getBoundingClientRect().width > 0)
      .sort((a, b) => a[1].getBoundingClientRect().top - b[1].getBoundingClientRect().top)
      .map(([s]) => s),
  );
const shots = {};
const shot = async (p, name) => {
  const f = `${OUT}/${name}.png`;
  await p.screenshot({ path: f });
  shots[name] = f;
  // 오른쪽 버튼 줄 확대용 (오른쪽 위 띠)
  const vw = p.viewportSize().width;
  const cw = vw >= 900 ? 120 : 84;
  await p.screenshot({ path: `${OUT}/crop_${name}.png`, clip: { x: vw - cw, y: 0, width: cw, height: 400 } });
  shots['crop_' + name] = `${OUT}/crop_${name}.png`;
  console.error('  ' + name + ' ' + JSON.stringify(await rightShown(p)));
};

const nightSave = { ...big, night: true };
const daySave = { ...big, night: false };
const bigJson = JSON.stringify(big);
const WIDTHS = [360, 412, 1280];
for (const width of WIDTHS) {
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
        await W(p, 600);
        await shot(p, `${scene}_${tag}`);
        const rs = await rightShown(p);
        if (after) ok(rs.length === 2 && rs[0] === '#bZoom' && rs[1] === '#bRail', `${scene} ${width} 후: 배율 + 「⋯」 두 개만 (${rs.join(' ')})`);
        else ok(!rs.includes('#bRail') && rs.length >= 4, `${scene} ${width} 전: 예전 버튼 줄 (${rs.join(' ')})`);
        if (after && scene === 'b_bigday') {
          // 「⋯」 펼침 (진짜 탭)
          await p.locator('#bRail').click();
          await W(p, 300);
          await shot(p, `d_expanded_${width}`);
          const ex = await rightShown(p);
          ok(['#bDN', '#bHarm', '#hSpk', '#bEye'].every((s) => ex.includes(s)), `펼침 ${width}: 낮밤·어울림·소리·구경 보임 (${ex.join(' ')})`);
          // 하나 고르기(소리) → 접힘 · 소리는 바뀜
          const m0 = await p.evaluate(() => document.querySelector('#hSpk').getAttribute('aria-label'));
          await p.locator('#hSpk').click();
          await W(p, 300);
          const m1 = await p.evaluate(() => document.querySelector('#hSpk').getAttribute('aria-label'));
          ok(m0 !== m1 && !(await p.evaluate(() => document.body.classList.contains('railopen'))), `소리 고르면 동작(${m0} → ${m1}) 뒤 접힘 ${width}`);
          await p.evaluate(() => document.querySelector('#hSpk').click()); // 원래대로
          // 바깥 탭 → 접힘
          await p.locator('#bRail').click();
          await W(p, 200);
          const vp = dev(width).viewport;
          await p.mouse.click(vp.width * 0.4, vp.height * 0.55);
          await W(p, 300);
          ok(!(await p.evaluate(() => document.body.classList.contains('railopen'))), `바깥 탭 → 접힘 ${width}`);
          await clear(p);
          // 빨간 점: 안의 항목(소리)에 점 → 「⋯」에 점
          await p.evaluate(() => document.querySelector('#hSpk').classList.add('rdot'));
          await W(p, 800);
          ok(await p.evaluate(() => document.querySelector('#bRail').classList.contains('rdot')), `안쪽 점 → 「⋯」 점 ${width}`);
          await shot(p, `e_dot_${width}`);
          await p.evaluate(() => document.querySelector('#hSpk').classList.remove('rdot'));
        }
      } catch (e) {
        errs.push(`${scene}_${tag} 못 찍음: ${String(e).slice(0, 300)}`);
      }
      await ctx?.close();
    }
  }
}
if (JSON.stringify(big) !== bigJson) errs.push('큰 마을 저장 파일 내용이 바뀜');

// ── 모아 보기 시트 (장면마다 한 장: 폭별 전/후 · 펼침·점은 한 장) ──
const NAME = { a_new: 'ⓐ 새 세이브 첫 낮', b_bigday: 'ⓑ 큰 마을 낮 (웅스)', c_bignight: 'ⓒ 같은 마을 밤' };
const img = (f, h) => (f ? `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="height:${h}px">` : '<i>없음</i>');
const pg = await (await br.newContext({ viewport: { width: 1800, height: 900 } })).newPage();
const style = '<style>body{background:#1b1d33;color:#e8e6ff;font:14px sans-serif;margin:12px}h1{font-size:18px}figure{display:inline-block;margin:6px;vertical-align:top}figcaption{font-size:12px;color:#aab}</style>';
for (const scene of Object.keys(NAME)) {
  let h = `${style}<h1>FIRSTLOOK §5 flSideRail — ${NAME[scene]} · 전(끔) / 후(flSideRail만 켬)</h1>`;
  for (const w of WIDTHS)
    for (const ba of ['before', 'after']) h += `<figure>${img(shots[`${scene}_${w}_${ba}`], w === 1280 ? 380 : 520)}<figcaption>${w} · ${ba === 'before' ? '전' : '후'}</figcaption></figure>`;
  h += '<br>';
  for (const w of WIDTHS) for (const ba of ['before', 'after']) h += `<figure>${img(shots[`crop_${scene}_${w}_${ba}`], 400)}<figcaption>${w} ${ba === 'before' ? '전' : '후'} 확대</figcaption></figure>`;
  await pg.setContent(h, { waitUntil: 'load' });
  await pg.screenshot({ path: `${OUT}/sheet_${scene}.png`, fullPage: true });
}
{
  let h = `${style}<h1>FIRSTLOOK §5 flSideRail 후 — 「⋯」 펼침 · 안쪽 점이 「⋯」에 (큰 마을 낮)</h1>`;
  for (const w of WIDTHS) h += `<figure>${img(shots[`d_expanded_${w}`], w === 1280 ? 380 : 520)}<figcaption>${w} · 펼침</figcaption></figure>`;
  h += '<br>';
  for (const w of WIDTHS) h += `<figure>${img(shots[`crop_d_expanded_${w}`], 400)}<figcaption>${w} 펼침 확대</figcaption></figure><figure>${img(shots[`crop_e_dot_${w}`], 400)}<figcaption>${w} 점 확대</figcaption></figure>`;
  h += '<br>';
  for (const w of WIDTHS) h += `<figure>${img(shots[`e_dot_${w}`], w === 1280 ? 380 : 520)}<figcaption>${w} · 점 (소리에 점 → 「⋯」)</figcaption></figure>`;
  await pg.setContent(h, { waitUntil: 'load' });
  await pg.screenshot({ path: `${OUT}/sheet_expanded_dot.png`, fullPage: true });
}
await br.close();
for (const e of errs) console.error('✗ ' + e);
console.error(fail || errs.length ? `실패 ${fail} · 오류 ${errs.length}` : '전부 통과');
process.exit(fail || errs.length ? 1 : 0);
