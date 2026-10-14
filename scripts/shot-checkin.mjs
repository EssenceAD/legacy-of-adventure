// CHECKIN ★품질 규칙 2: 보이는 것이 바뀌는 항목은 변경 전/후 스크린샷 — 폭 360 · 412 · 1280 × 낮 · 밤
//  장면 = scripts/checkin-scenes/<항목>.js : 저장을 불러 마을이 뜬 뒤 page 안에서 실행할 async 함수 본문
//    (window.__world · __P · __S · __openMenu · __showActor … BOT_BUILD 전역 사용 · 마지막에 창을 열어 두면 그 모습을 찍음)
//    첫 줄 주석 `// save: <파일 경로>` 로 저장을 바꿀 수 있다 (기본 tests/fixtures/real_ttabam.json · 없으면 real_lotte)
//  결과: reports/checkin/<항목>/<label>_<폭>_<낮|밤>.png
//  실행: node scripts/shot-checkin.mjs <항목> <before|after> <URL> [lab]   예) ... a1 before http://localhost:4310/
//    장면 안에선 LABEL(before|after) 을 읽을 수 있다 · 4번째 인자 lab = 「새 화면 미리 보기」를 켠 기기로 찍기 (형철 확인 전 꺼진 채 배포하는 항목의 after)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [item, label = 'after', URL = 'http://localhost:4190/', LAB] = process.argv.slice(2);
//  4번째 인자 `lab` = 「새 화면 미리 보기」(실험실) 켠 채로 찍기 (형철 확인 전 꺼진 기능의 「후」 사진)
if (!item) throw new Error('항목 이름을 주세요');
const scene = fs.readFileSync(`scripts/checkin-scenes/${item}.js`, 'utf8');
const saveFile = /^\/\/\s*save:\s*(\S+)/m.exec(scene)?.[1] ?? (fs.existsSync('tests/fixtures/real_ttabam.json') ? 'tests/fixtures/real_ttabam.json' : 'tests/fixtures/real_lotte.json');
const sv = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
const OUT = `reports/checkin/${item}`;
fs.mkdirSync(OUT, { recursive: true });
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const SIZES = {
  360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND },
  412: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AND },
  1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};
const b = await chromium.launch({ channel: 'chrome' });
const VER = await (async () => { const c = await b.newContext(); const v = (await (await c.request.get(URL + 'version.json')).json()).version; await c.close(); return JSON.stringify(v); })();
const errs = [];
for (const [w, dev] of Object.entries(SIZES))
  for (const night of [false, true]) {
    const save = JSON.stringify({ ...sv, clock: night ? 17 * 60 : 6 * 60, night });
    const ctx = await b.newContext(dev);
    await ctx.addInitScript(([s, ver, lab]) => {
      try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
      localStorage.clear();
      localStorage.setItem('legacy-of-adventure-save', s);
      localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
      localStorage.setItem('legacy-of-adventure-lastVersion', ver);
      localStorage.setItem('legacy-of-adventure-settleOff', 'true');
      localStorage.setItem('legacy-of-adventure-telemetry', 'false');
      if (lab) localStorage.setItem('legacy-of-adventure-visualLab', 'true');
      localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
    }, [save, VER, LAB === 'lab']);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`${w}/${night ? '밤' : '낮'}: ${String(e).slice(0, 160)}`));
    await p.goto(URL, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => !!window.__S && !!document.querySelector('#tCont'), null, { timeout: 30000 });
    await p.locator('#tCont').click();
    await p.waitForFunction(() => window.__S.started && !document.querySelector('#hud').hidden, null, { timeout: 20000 });
    const clear = () => p.evaluate(async () => {
      const T = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
        let busy = false;
        if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
        else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
        calm = busy ? 0 : calm + 1;
        await T(busy ? 120 : 250);
      }
    });
    await clear();
    await p.waitForTimeout(1000);
    await clear();
    try {
      await p.evaluate(`(async () => { const LABEL = ${JSON.stringify(label)};\n${scene}\n })()`);
    } catch (e) {
      errs.push(`${w}/${night ? '밤' : '낮'} 장면: ${String(e).slice(0, 200)}`);
    }
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/${label}_${w}_${night ? '밤' : '낮'}.png` });
    await ctx.close();
  }
await b.close();
console.error(errs.length ? '✗ ' + errs.join('\n') : `✓ ${OUT}/${label}_* 6장`);
process.exit(errs.length ? 1 : 0);
