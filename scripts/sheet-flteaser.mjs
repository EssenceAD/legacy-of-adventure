// FIRSTLOOK §4 (flTeaserFit) 전/후 시트 — 폰 360 · 412 (isMobile+hasTouch) · PC 1280
//  장면: 「터치해서 시작」 · 티저 컷 11개 · 타이틀(저장 있음 · 저장 없음 두 번째 방문)
//  전 = flags.json 그대로 · 후 = flags.json 응답에 flTeaserFit: true 만 얹음 (다른 실험실 기능은 끈 채 — 이 섹션만 비교)
//  실행: BOT_BUILD=1 npx vite build --outDir dist-bot-flteaser · npx vite preview --outDir dist-bot-flteaser --port 4342 --strictPort
//        URL=http://localhost:4342/ node scripts/sheet-flteaser.mjs   → reports/firstlook/teaser/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4342/';
const OUT = 'reports/firstlook/teaser';
fs.mkdirSync(OUT, { recursive: true });
const SAVE = fs.existsSync('tests/fixtures/real_lotte.json') ? 'tests/fixtures/real_lotte.json' : 'tests/fixtures/beta_town.json';
const DEVS = {
  m360: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  m412: { viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  pc1280: { viewport: { width: 1280, height: 800 } },
};
const BEATS = [4, 4, 9, 4, 4, 4, 4, 4, 6, 7, 6];
const BEAT = 60 / 88;
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const errs = [];
const W = (p, ms) => p.waitForTimeout(ms);
const shots = {}; // scene → dev → before/after → file

async function ctxFor(dev, after, save, seen) {
  const ctx = await b.newContext(DEVS[dev]);
  if (after)
    await ctx.route(/flags\.json/, async (r) => {
      const res = await r.fetch();
      const j = await res.json();
      await r.fulfill({ response: res, json: { ...j, flTeaserFit: true } });
    });
  await ctx.addInitScript(([s, seen]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    if (s) localStorage.setItem('legacy-of-adventure-save', s);
    if (seen) localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
  }, [save ? fs.readFileSync(save, 'utf8') : '', seen]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${dev}${after ? ' 후' : ' 전'}: ${String(e).slice(0, 200)}`));
  return { ctx, p };
}
const shot = async (p, scene, dev, after) => {
  const f = `${OUT}/${scene}_${dev}_${after ? 'after' : 'before'}.png`;
  await p.screenshot({ path: f });
  ((shots[scene] ??= {})[dev] ??= {})[after ? 'after' : 'before'] = f;
};
/** 무대에서 검은 빈칸(거의 #000·#05060f) 줄의 비율 — 위·아래 가장자리부터 */
const blackBands = (p) =>
  p.evaluate(async () => {
    const r = document.querySelector('#teaser').getBoundingClientRect();
    const hasBody = document.body.classList.contains('flteaser');
    const cv = document.querySelector('#tStage .tcv');
    if (!cv) return null;
    const c = cv.getBoundingClientRect();
    return { top: Math.max(0, c.top - r.top) / r.height, bot: Math.max(0, r.bottom - c.bottom) / r.height, left: Math.max(0, c.left - r.left), bg: !!document.querySelector('#tStage canvas.tbg'), hasBody };
  });

for (const dev of Object.keys(DEVS)) {
  for (const after of [false, true]) {
    const tag = `${dev} ${after ? '후' : '전'}`;
    // ── 처음 실행: 「터치해서 시작」 → 티저 컷 11개 → 마지막 컷 [시작하기] ──
    {
      const { ctx, p } = await ctxFor(dev, after, null, false);
      await p.goto(URL, { waitUntil: 'networkidle' });
      await p.waitForSelector('#teaser.gate', { timeout: 30000 });
      await W(p, 1500);
      ok(await p.evaluate(() => document.body.classList.contains('flteaser')) === after, `${tag} body.flteaser = ${after} (flags.json 저장 불러오기 전에 읽힘)`);
      await shot(p, 'gate', dev, after);
      await p.mouse.click(DEVS[dev].viewport.width / 2, DEVS[dev].viewport.height / 2);
      for (let i = 0; i < BEATS.length; i++) {
        await p.waitForFunction((i) => window.__teaserCut?.() === i, i, { timeout: 30000 });
        await W(p, Math.round(BEATS[i] * BEAT * (i === BEATS.length - 1 ? 0.5 : 0.62) * 1000));
        if ([5, 6].includes(i)) {
          const bb = await blackBands(p);
          if (bb) ok(after ? bb.left <= 0 && (bb.top === 0 || bb.bg) : true, `${tag} 컷 ${i + 1} 캔버스 위 ${(bb.top * 100).toFixed(0)}% · 아래 ${(bb.bot * 100).toFixed(0)}% (흐린 배경 ${bb.bg ? '있음' : '없음'})`);
        }
        await shot(p, `cut${String(i + 1).padStart(2, '0')}`, dev, after);
      }
      ok(await p.evaluate(() => !!document.querySelector('#tGo')), `${tag} 마지막 컷 #tGo 있음`);
      await p.evaluate(() => document.querySelector('#tGo').click());
      await p.waitForFunction(() => window.__S?.started || !document.querySelector('#dlg').hidden, null, { timeout: 20000 }).then(() => ok(true, `${tag} [시작하기] → 새 게임`), () => ok(false, `${tag} [시작하기] → 새 게임`));
      await ctx.close();
    }
    // ── 두 번째 방문(저장 없음 · 이미 봄): 티저 없이 타이틀 ──
    {
      const { ctx, p } = await ctxFor(dev, after, null, true);
      await p.goto(URL, { waitUntil: 'networkidle' });
      await p.waitForFunction(() => !!document.querySelector('#tCont') && !document.querySelector('#loading'), null, { timeout: 30000 });
      await W(p, 1500);
      ok(await p.evaluate(() => document.querySelector('#teaser').hidden && !document.querySelector('#title').hidden), `${tag} 두 번째 방문: 티저 없이 타이틀`);
      await shot(p, 'title_new', dev, after);
      await ctx.close();
    }
    // ── 저장 있음: 타이틀 → 이어하기 (#tCont) ──
    {
      const { ctx, p } = await ctxFor(dev, after, SAVE, false);
      await p.goto(URL, { waitUntil: 'networkidle' });
      await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont') && !document.querySelector('#loading'), null, { timeout: 30000 });
      await W(p, 1500);
      ok(await p.evaluate(() => document.querySelector('#teaser').hidden), `${tag} 저장 있음: 티저 자동 재생 없음`);
      await shot(p, 'title', dev, after);
      const before = await p.evaluate(() => localStorage.getItem('legacy-of-adventure-save').length);
      await p.locator('#tCont').click();
      await p.waitForFunction(() => window.__S.started, null, { timeout: 20000 });
      await W(p, 800);
      const st = await p.evaluate(() => ({ inn: window.__S.innName, objs: window.__world.objs.length }));
      const want = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
      ok(st.inn === want.innName, `${tag} 이어하기 → 내 여관 「${st.inn}」 (건물 ${st.objs}) · 저장 길이 ${before}`);
      await ctx.close();
    }
  }
}
await b.close();

// ── 시트: 장면마다 한 장 (줄 = 기기 · 칸 = 전/후) ──
const b2 = await chromium.launch({ channel: 'chrome' });
const pg = await b2.newPage({ viewport: { width: 1400, height: 800 } });
const uri = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const NAME = { gate: '「터치해서 시작」', title: '타이틀 (저장 있음)', title_new: '타이틀 (저장 없음 · 두 번째 방문)' };
for (const [scene, byDev] of Object.entries(shots)) {
  const rows = Object.entries(byDev).map(([dev, s]) => `<tr><th>${dev}</th><td><img src="${uri(s.before)}"></td><td><img src="${uri(s.after)}"></td></tr>`).join('');
  await pg.setContent(`<style>body{margin:0;background:#14121c;color:#eee;font:14px sans-serif}h1{font-size:18px;margin:10px 14px}table{border-spacing:10px}th{writing-mode:vertical-rl;color:#cfd8ff}td img{display:block;max-height:520px;max-width:640px;box-shadow:0 0 0 2px #444}thead th{writing-mode:horizontal-tb}</style>
    <h1>FIRSTLOOK §4 flTeaserFit — ${NAME[scene] ?? '티저 컷 ' + scene.slice(3)} · 전(끔) / 후(flTeaserFit만 켬)</h1>
    <table><thead><tr><th></th><th>전</th><th>후</th></tr></thead>${rows}</table>`);
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${OUT}/sheet_${scene}.png`, fullPage: true });
}
// 한눈에: 412 폰 처음 60초 (전 줄 / 후 줄)
{
  const order = ['gate', ...BEATS.map((_, i) => `cut${String(i + 1).padStart(2, '0')}`), 'title'];
  const row = (k) => order.map((s) => `<img src="${uri(shots[s].m412[k])}">`).join('');
  await pg.setViewportSize({ width: 2400, height: 800 });
  await pg.setContent(`<style>body{margin:0;background:#14121c;color:#eee;font:14px sans-serif}h1{font-size:18px;margin:10px 14px}div{display:flex;gap:6px;margin:6px 14px}img{height:340px}</style>
    <h1>FIRSTLOOK §4 flTeaserFit — 412×860 폰 처음 60초 (위 = 전 · 아래 = 후)</h1><div>${row('before')}</div><div>${row('after')}</div>`);
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${OUT}/sheet_strip_412.png`, fullPage: true });
}
await b2.close();
if (errs.length) console.error('페이지 오류:\n' + errs.join('\n'));
console.error(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exitCode = fail ? 1 : 0;
