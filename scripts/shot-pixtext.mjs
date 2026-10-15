// 10/16 pixText 전후 사진 — 실제 저장 · 폰 360/412 · PC 125%/150% · 마을 가운데(여관 간판·이름표)를 잘라 3배
//  실행: BEFORE=http://localhost:4190/ AFTER=http://localhost:4192/ node scripts/shot-pixtext.mjs [저장 json]
//  → reports/pixtext/<기기>.png (위 = 전 · 아래 = 후) · reports/pixtext/all.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BEFORE = process.env.BEFORE ?? 'http://localhost:4190/';
const AFTER = process.env.AFTER ?? 'http://localhost:4192/';
const SAVE = process.argv[2] ?? 'tests/fixtures/real_hyeongcheol.json';
const OUT = 'reports/pixtext';
const CW = +(process.env.CW ?? 220);
const CH = +(process.env.CH ?? 160);
fs.mkdirSync(OUT, { recursive: true });
const DEVS = {
  phone360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  phone412: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
  pc125: { viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1.25 },
  pc150: { viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1.5 },
};
const sv = fs.readFileSync(SAVE, 'utf8');
const b = await chromium.launch({ channel: 'chrome' });

async function shot(url, dev, clip0) {
  const rq = await b.newContext();
  const ver = await rq.request.get(url + 'version.json').then((r) => r.json()).then((j) => j.version).catch(() => '');
  await rq.close();
  const ctx = await b.newContext(DEVS[dev]);
  await ctx.addInitScript(([s, ver]) => {
    try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
    localStorage.clear();
    localStorage.setItem('legacy-of-adventure-save', s);
    localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
    localStorage.setItem('legacy-of-adventure-settleOff', 'true');
    localStorage.setItem('legacy-of-adventure-telemetry', 'false');
    localStorage.setItem('legacy-of-adventure-guestNames', 'true');
    localStorage.setItem('legacy-of-adventure-lastVersion', JSON.stringify(ver));
  }, [sv, ver]);
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#tCont', { state: 'visible', timeout: 60000 });
  await p.waitForTimeout(600);
  await p.locator('#tCont').click();
  await p.waitForTimeout(3500);
  await p.evaluate(async () => {
    const T = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
      let busy = false;
      if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
      else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
      calm = busy ? 0 : calm + 1;
      await T(busy ? 150 : 250);
    }
    // 같은 장면: 낮 · 시간 멈춤 · 여관 간판이 화면 가운데 위쪽
    if (window.__S) window.__S.paused = true;
  });
  await p.waitForTimeout(800);
  // 여관 간판이 그려진 자리(새 빌드의 시험 고리 __signAt) 둘레 CW×CH · 옛 빌드는 같은 자리
  const at = await p.evaluate(() => { const q = window.__tagAt ?? window.__signAt; if (!q) return null; const cv = document.querySelector('canvas'); const r = cv.getBoundingClientRect(); const k = r.width / cv.width; return { x: r.left + q.x * k, y: r.top + q.y * k }; });
  const vw = DEVS[dev].viewport;
  const clip = clip0 ?? (at ? { x: Math.max(0, Math.min(vw.width - CW, Math.round(at.x - (CW >> 1)))), y: Math.max(0, Math.min(vw.height - CH, Math.round(at.y - (CH >> 1) + 6))), width: CW, height: CH } : { x: Math.round(vw.width / 2 - (CW >> 1)), y: Math.round(vw.height / 2 - 120), width: CW, height: CH });
  const png = await p.screenshot({ clip });
  await ctx.close();
  return { png, clip };
}

const rows = [];
for (const dev of Object.keys(DEVS)) {
  const z = await shot(AFTER, dev);
  const a = await shot(BEFORE, dev, z.clip);
  rows.push([dev, a.png, z.png]);
  console.log('찍음', dev);
}
const page = await (await b.newContext({ viewport: { width: 1400, height: 800 } })).newPage();
const html = `<body style="margin:0;background:#111;color:#fff;font:15px sans-serif">${rows
  .map(([d, a, z]) => `<div style="display:flex;gap:8px;padding:6px;align-items:flex-start"><div style="width:90px">${d}</div>${[['전', a], ['후', z]].map(([t, im]) => `<div><div>${t}</div><img src="data:image/png;base64,${im.toString('base64')}" style="width:660px;image-rendering:pixelated"></div>`).join('')}</div>`)
  .join('')}</body>`;
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/all.png`, fullPage: true });
await b.close();
console.log('ok');
