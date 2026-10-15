// BUILDINGS2 e2e + 사진 — 웅스 저장(땅 7) → 땅 10 → 새 건물 7채 + 세트 장식을 새 땅에 모아 놓기 (412 폰)
//  · 건물 창마다 「✨ 효과」 줄 · 그림 못 그린 것 없음 · 페이지 에러 없음 · 건설 창에 새 건물·장식 · 옛 저장 그대로 열림
//  사진: reports/b2/b2_412_day.png · b2_412_night.png (가운데 = 모아 놓은 자리)
//  실행: URL=http://localhost:4190/ node scripts/e2e-b2.mjs [저장 json]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const SAVE = process.argv[2] ?? 'tests/fixtures/real_woongs.json';
const OUT = 'reports/b2';
fs.mkdirSync(OUT, { recursive: true });
const LIST = JSON.parse(fs.readFileSync('src/data/buildings2.json', 'utf8'));
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
const sv = fs.readFileSync(SAVE, 'utf8');
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-telemetry', 'false');
}, sv);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
const frames = (n) => p.evaluate((n) => new Promise((res) => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 30000 });
await W(1200);
await p.locator('#tCont').click();
await W(3500);
const clearAll = () => p.evaluate(async () => {
  const T = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    let busy = false;
    const ch = document.querySelector('#dChoice');
    if (ch && !ch.hidden && ch.lastElementChild) { ch.lastElementChild.click(); busy = true; }
    else if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
    else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
    calm = busy ? 0 : calm + 1;
    await T(busy ? 150 : 300);
  }
});
await clearAll();
const n0 = await p.evaluate(() => window.__world.objs.length);
ok(n0 > 30, `옛 저장 그대로 열림 (${n0}채)`);
const lb = await p.evaluate(() => window.__setLand(10));
await W(800);
ok(Array.isArray(lb), `땅 10 (${JSON.stringify(lb)})`);

// 새 땅(앞쪽 가장자리 근처)에 모아 놓기: 건물 하나 + 그 세트 장식을 건물 둘레에
const SETS = { general_store: '시장 거리', bard_stage: '축제 무대', grain_mill: '농촌', bakery: '농촌', fishing_dock: '물가', bank: '은행·광장', mage_academy: '마법' };
const plan = LIST.buildings.map((bd) => ({ key: bd.key, decos: LIST.decos.filter((d) => d.set === SETS[bd.key] && !d.hidden && (bd.key !== 'bakery' || ['bread_rack', 'stone_oven', 'milk_cans'].includes(d.key)) && (bd.key !== 'grain_mill' || !['bread_rack', 'stone_oven', 'milk_cans'].includes(d.key))).map((d) => d.key) }));
const placed = await p.evaluate(([plan, lb]) => {
  const T = window.__town;
  const [a, b] = lb;
  const size = (k) => window.__def(k).size;
  const spot = (k, cx, cy, R = 14) => {
    const [w, h] = size(k);
    for (let r = 0; r <= R; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const t = { kind: k, tx: cx + dx, ty: cy + dy, fw: w, fh: h };
          if (window.__canPlace(t)) return [t.tx, t.ty];
        }
    return null;
  };
  // 새로 열린 줄: 앞쪽(아래) 가장자리 왼쪽부터 — 건물 사이 6칸
  const out = { b: [], d: [], miss: [] };
  let cx = a + 4;
  const cy = b - 7;
  for (const g of plan) {
    const at = spot(g.key, cx, cy, 10);
    if (!at) { out.miss.push(g.key); continue; }
    const o = T.addObj(g.key, at[0], at[1]);
    out.b.push([g.key, o.tx, o.ty]);
    for (const k of g.decos) {
      const d = spot(k, o.tx + 1, o.ty + o.fh + 1, 5);
      if (d) { T.addObj(k, d[0], d[1]); out.d.push(k); } else out.miss.push(k);
    }
    cx += 6;
  }
  T.rebuildPaths();
  return out;
}, [plan, lb]);
console.log('  놓음:', JSON.stringify({ b: placed.b.length, d: placed.d.length, miss: placed.miss }));
ok(placed.b.length === 7, `새 건물 7채 놓음 (${placed.b.map((x) => x[0]).join(' ')})`);
ok(placed.d.length >= 20, `세트 장식 ${placed.d.length}개`);

// 건물 창: 효과 줄
for (const [k] of placed.b) {
  const fx = await p.evaluate(async (k) => {
    const o = window.__world.objs.find((x) => x.kind === k);
    window.__showObj(o);
    await new Promise((r) => setTimeout(r, 250));
    const t = document.querySelector('#win')?.innerText ?? '';
    document.querySelector('#winX')?.click();
    return (t.match(/✨[^\n]*/) ?? [''])[0] || 'NOFX: ' + t.replace(/\s+/g, ' ').slice(0, 200);
  }, k);
  // 꼭 골라야 하는 이야기 편지(모모의 편지)가 그 사이 떴으면 그 건물 확인은 건너뜀
  if (/^NOFX: ← 모모의 편지/.test(fx)) console.log(`  (${k}: 이야기 편지가 떠 있어 건너뜀)`);
  else ok(!!fx && !fx.startsWith('NOFX'), `${k}: ${fx}`);
  await W(150);
}
// 건설 창: 새 건물·장식 카드
const cards = await p.evaluate(async () => {
  document.getElementById('bBuild')?.click();
  await new Promise((r) => setTimeout(r, 500));
  const ks = [...document.querySelectorAll('#win .cat button[data-k]')].map((x) => x.dataset.k);
  document.querySelector('#winX')?.click();
  return ks;
});
ok(['market_tent', 'magic_circle', 'coin_fountain'].every((k) => cards.includes(k)) && !cards.includes('friend_bench'), `건설 창: 새 장식 카드 · 우정 상점은 숨김 (${cards.length}장)`);

// 사진: 새 건물 줄을 따라 세 곳 (배율 1) × 낮·밤 → 한 장 · 화면 위 글자·창은 가리고 마을만
await clearAll();
await W(4500);
await clearAll();
for (let i = 0; i < 6; i++) {
  const z = await p.evaluate(() => window.__S.zoom);
  if (z === 1) break;
  await p.evaluate(() => document.querySelector('#bZoom').click());
  await W(250);
}
await p.addStyleTag({ content: 'body > *:not(#view), #view > *:not(canvas) { visibility: hidden !important; }' });
const setNight = async (night) => {
  await p.evaluate((night) => {
    const S = window.__S;
    if (S.night !== night) document.querySelector('#bDN')?.click();
    S.nightT = night ? 1 : 0;
  }, night);
  await frames(30);
  await p.evaluate((night) => void (window.__S.nightT = night ? 1 : 0), night);
  await W(500);
};
const camAt = (x, y) => p.evaluate(([x, y]) => {
  const v = window.__view;
  const N = window.__N;
  v.goal = null;
  v.cam.x = ((x - y) * 32) / 2;
  v.cam.y = ((x + y - N) * 16) / 2;
}, [x, y]);
const spots = [[0, 1], [2, 4], [5, 6]].map(([i, j]) => {
  const A = placed.b[i];
  const B = placed.b[j] ?? A;
  return [(A[1] + B[1]) / 2 + 1.5, (A[2] + B[2]) / 2 + 1.5];
});
const shots = { day: [], night: [] };
for (const nt of [false, true]) {
  await setNight(nt);
  for (const [x, y] of spots) {
    await camAt(x, y);
    await frames(45);
    shots[nt ? 'night' : 'day'].push(await p.screenshot({ clip: { x: 0, y: 150, width: 412, height: 560 } }));
  }
}
const sheet = await (await b.newContext({ viewport: { width: 412 * 3 + 16, height: 1200 } })).newPage();
const rowHtml = (k) => `<div style="display:flex;gap:8px;padding:4px">${shots[k].map((s) => `<img src="data:image/png;base64,${s.toString('base64')}" style="width:412px">`).join('')}</div>`;
await sheet.setContent(`<body style="margin:0;background:#111">${rowHtml('day')}${rowHtml('night')}</body>`);
await sheet.waitForTimeout(300);
await sheet.screenshot({ path: `${OUT}/b2_412_sheet.png`, fullPage: true });
const fails = await p.evaluate(() => (window.__drawFails ? window.__drawFails() : null));
ok(!fails || !Object.keys(fails).some((k) => /general_store|bard_stage|grain_mill|bakery|fishing_dock|bank|mage_academy/.test(k)), `그림 못 그린 것 없음 ${fails ? JSON.stringify(fails).slice(0, 120) : ''}`);
ok(!errs.length, '페이지 에러 없음 ' + errs.join(' | '));
await b.close();
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
