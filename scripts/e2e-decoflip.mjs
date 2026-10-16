// 10/17 decoFlip e2e — 꾸미기에서 장식을 눌러 🔄 (그 자리에서 바로 · 2×1은 발판 1×2) · 막히면 「공간이 부족해요」 · 글자 있는 장식은 🔄 없음 · 건물은 예전 ↔
//  사진: screenshots/decoflip/{before,after}.png
//  실행: URL=http://localhost:4190/ node scripts/e2e-decoflip.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const URL = process.env.URL ?? 'http://localhost:4190/';
const OUT = 'screenshots/decoflip';
fs.mkdirSync(OUT, { recursive: true });
const SAVE = fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8');
const b = await chromium.launch({ channel: 'chrome' });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
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
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('#tCont', { state: 'visible', timeout: 60000 });
await W(600);
await p.locator('#tCont').click();
await W(3500);
const clearAll = () => p.evaluate(async () => {
  const T = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
    let busy = false;
    if (!document.querySelector('#dlg').hidden) { document.querySelector('#dlg').click(); busy = true; }
    else if (document.querySelector('#win').classList.contains('on')) { document.querySelector('#winX').click(); busy = true; }
    calm = busy ? 0 : calm + 1;
    await T(busy ? 150 : 250);
  }
});
await clearAll();
// 빈 자리에 천막 노점(2×1) · 상점 간판 하나씩 — 반전하면 1×2가 들어갈 칸도 비어 있는 곳
const spot = await p.evaluate(() => {
  const T = window.__town;
  const [a, b] = T.landBounds();
  const free = (x, y, w, h) => window.__canPlace({ kind: 'market_tent', tx: x, ty: y, fw: w, fh: h });
  for (let y = a + 2; y < b - 4; y++)
    for (let x = a + 2; x < b - 4; x++)
      if (free(x, y, 2, 2) && window.__canPlace({ kind: 'shop_board', tx: x + 4, ty: y, fw: 1, fh: 1 })) {
        T.addObj('market_tent', x, y);
        T.addObj('shop_board', x + 4, y);
        T.rebuildPaths();
        return [x, y];
      }
  return null;
});
ok(!!spot, `천막 노점 놓음 ${JSON.stringify(spot)}`);
const [tx, ty] = spot;
// 꾸미기 모드
await p.evaluate(() => document.getElementById('bBuild')?.click());
await W(500);
await p.evaluate(() => document.getElementById('toDecor')?.click());
await W(800);
ok(await p.evaluate(() => document.body.classList.contains('decor')), '꾸미기 모드');
// 배율 3 · 천막 가운데로
for (let i = 0; i < 6 && (await p.evaluate(() => window.__S.zoom)) !== 3; i++) { await p.evaluate(() => document.querySelector('#bZoom')?.click()); await W(200); }
await p.evaluate(([x, y]) => { const v = window.__view; const N = window.__N; v.goal = null; v.cam.x = ((x - y) * 32) / 2; v.cam.y = ((x + y - N) * 16) / 2; }, [tx + 1, ty + 0.5]);
await W(600);
await p.screenshot({ path: `${OUT}/before.png`, clip: { x: 56, y: 280, width: 300, height: 300 } });
const tap = async (x, y, up = 0) => {
  const [cx, cy] = await p.evaluate(([x, y]) => window.__decor.xy(x, y), [x, y]);
  await p.mouse.click(cx, cy - up);
  await W(500);
};
const st = () => p.evaluate(([x, y]) => {
  const o = window.__world.objs.find((b) => b.kind === 'market_tent' && b.tx === x && b.ty === y);
  const rot = document.getElementById('placeRot');
  return { flip: !!o?.flip, fw: o?.fw, fh: o?.fh, placing: !!window.__placing(), rot: rot && !rot.hidden ? rot.textContent : null, toast: document.getElementById('toast')?.textContent ?? '' };
}, [tx, ty]);
// ① 천막 누르기 → 🔄 → 그 자리에서 바로 · 발판 1×2
await tap(tx + 0.5, ty + 0.5);
let s = await st();
ok(s.placing && s.rot === '🔄', `천막을 누르면 🔄 (${s.rot})`);
await p.evaluate(() => document.getElementById('placeRot').click());
await W(600);
s = await st();
ok(s.flip && s.fw === 1 && s.fh === 2 && !s.placing, `🔄 → 그 자리에서 바로 반전 · 발판 1×2 (${JSON.stringify(s)})`);
await p.screenshot({ path: `${OUT}/after.png`, clip: { x: 56, y: 280, width: 300, height: 300 } });
// ② 다시 🔄 → 원래대로 (2×1)
await tap(tx + 0.5, ty + 0.5);
await p.evaluate(() => document.getElementById('placeRot').click());
await W(600);
s = await st();
ok(!s.flip && s.fw === 2 && s.fh === 1, `한 번 더 → 원래대로 (${s.fw}×${s.fh})`);
// ③ 반전 자리(아래 칸)를 막으면 「공간이 부족해요」
await p.evaluate(([x, y]) => { window.__town.addObj('crate_pile', x, y + 1); window.__town.rebuildPaths(); }, [tx, ty]);
await tap(tx + 1.5, ty + 0.5, 10);
console.log('  (③ 든 것:', await p.evaluate(() => JSON.stringify({ k: window.__placing()?.kind, tx: window.__placing()?.tx, ty: window.__placing()?.ty })), ')');
await p.evaluate(() => document.getElementById('placeRot').click());
await W(400);
s = await st();
ok(!s.flip && /공간이 부족해요/.test(s.toast), `막히면 반전 안 됨 · 「${s.toast}」`);
await p.evaluate(() => document.getElementById('placeNo')?.click());
await W(400);
// ④ 상점 간판(글자) → 🔄 없음
await tap(tx + 4.5, ty + 0.5, 40);
const sign = await p.evaluate(() => ({ placing: window.__placing()?.kind, hit: JSON.stringify(window.__placing()), rotHidden: document.getElementById('placeRot').hidden }));
ok(sign.placing === 'shop_board' && sign.rotHidden, `상점 간판은 🔄 없음 (${JSON.stringify(sign)})`);
await p.evaluate(() => document.getElementById('placeNo')?.click());
await W(400);
// ⑤ 건물: 눌러 들면 예전 ↔ (🔄 아님 — 건물은 간판 글자·입구 방향 때문에 장식만)
const bo = await p.evaluate(() => { const o = window.__world.objs.find((b) => ['tavern', 'smith', 'bath', 'chapel', 'library'].includes(b.kind) && !b.con); return o ? [o.kind, o.tx + o.fw / 2, o.ty + o.fh / 2] : null; });
if (bo) {
  await p.evaluate(([x, y]) => { const v = window.__view; const N = window.__N; v.goal = null; v.cam.x = ((x - y) * 32) / 2; v.cam.y = ((x + y - N) * 16) / 2; }, [bo[1], bo[2]]);
  await W(500);
  await tap(bo[1], bo[2], 30);
  const t = await p.evaluate(() => ({ k: window.__placing()?.kind, rot: document.getElementById('placeRot')?.textContent }));
  ok(t.k === bo[0] && t.rot !== '🔄', `건물 ${bo[0]}은 🔄가 아니라 예전 버튼 (${t.k} · ${t.rot})`);
  await p.evaluate(() => document.getElementById('placeNo')?.click());
}
ok(!errs.length, '페이지 에러 없음 ' + errs.join(' | '));
await b.close();
console.log(fail ? `✗ ${fail}개 실패` : '✓ 모두 통과');
process.exit(fail ? 1 : 0);
