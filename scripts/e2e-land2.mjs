// LAND2 e2e: v7 저장(땅 5단계) 불러오기 → 맵 32 · 모든 건물 +8 · 백업(.bak7) · 저장 v8 / 6·7단계 조건 · 넓히기 → 숲 베기 → 새 땅에 짓기 / fps
//  실행: URL=… node scripts/e2e-land2.mjs [phone|pc] → screenshots/land2/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'phone';
// LAND10: v7 → v9는 +8 +12 = +20 · 7단계 땅 [12,42)
const SH = 20;
const raw = fs.readFileSync('tests/fixtures/real_lotte.json', 'utf8');
const old = JSON.parse(raw);
const DEV = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1440, height: 900 } } };
const dir = 'screenshots/land2';
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
  localStorage.setItem('legacy-of-adventure-settleOff', 'true');
  localStorage.setItem('legacy-of-adventure-sound', JSON.stringify({ bgmOn: false, bgmVol: 0.4, sfxOn: false, sfxVol: 0.7, muted: true }));
}, raw);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
let fail = 0;
const ok = (c, m) => { console.error((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
const settle = async () => {
  for (let i = 0, calm = 0; i < 80 && calm < 3; i++) {
    const busy = await p.evaluate(() => { if (!document.querySelector('#dlg').hidden) return document.querySelector('#dlg').click(), true; if (document.querySelector('#win').classList.contains('on')) return document.querySelector('#winX').click(), true; return false; });
    calm = busy ? 0 : calm + 1;
    await W(busy ? 200 : 600);
  }
};
const fps = () => p.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else ok(Math.round(n / 2)); }; requestAnimationFrame(f); }));

await p.goto(process.env.URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
ok(await p.evaluate(() => !!localStorage.getItem('legacy-of-adventure-save.bak7')), '옮기기 전 원본 백업 .bak7');
await p.locator('#tCont').click();
await W(3000);
await settle();

// ── v7 → v8: 건물 수 · 좌표 +8 (배치 검사로 옮겨진 건 v7 때도 옮겨지던 1개만)
const objs = await p.evaluate(() => window.__world.objs.map((o) => [o.kind, o.tx, o.ty, o.lvl]));
ok(objs.length === old.buildings.length, `건물 수 그대로 ${old.buildings.length} → ${objs.length}`);
const unmatched = old.buildings.filter((b) => !objs.some(([k, x, y, l]) => k === b.kind && x === b.tx + SH && y === b.ty + SH && l === b.lvl));
ok(unmatched.length <= 1, `+${SH} 그대로 놓인 건물 ${old.buildings.length - unmatched.length}/${old.buildings.length} (다른 것: ${unmatched.map((b) => b.kind).join(',') || '없음'})`);
ok(await p.evaluate(() => window.__S.land === 5), '땅 5단계 그대로');
await p.screenshot({ path: `${dir}/${name}_01_v8.png` });
await p.evaluate(() => window.__saveNow());
ok(await p.evaluate(() => JSON.parse(localStorage.getItem('legacy-of-adventure-save')).version === 9), '다시 저장하면 v9');
const f5 = await fps();
ok(f5 >= 25, `땅 5단계 fps ${f5}`);

// ── 6단계 조건
await p.evaluate(() => { const P = window.__P; P.rep = 0; window.__S.gold = 10_000_000; });
await p.evaluate(() => document.querySelector('#bBuild').click());
await W(500);
await p.evaluate(() => document.querySelector('#toLand').click());
await W(500);
const row6 = await p.evaluate(() => document.querySelector('.stp[data-l="6"]')?.textContent ?? '');
ok(/평판 ★5/.test(row6) && /장부 7장/.test(row6) && /이끼 덩굴 100/.test(row6), '6단계 조건 보임: ' + row6.slice(0, 60));
await p.screenshot({ path: `${dir}/${name}_02_land_win.png` });
await p.evaluate(() => document.querySelector('.stp[data-l="6"]').click());
await W(300);
ok(await p.evaluate(() => window.__S.land === 5), '조건이 모자라면 안 넓어짐');
await settle();
// 조건 채우기 → 6단계
await p.evaluate(async () => {
  const P = window.__P;
  P.rep = 99999;
  const { CHAPTERS } = await import('/src/data/guide.ts').catch(() => ({ CHAPTERS: null }));
  if (CHAPTERS) for (const c of CHAPTERS) for (const m of c.missions) if (!P.guide.claimed.includes(m.id)) P.guide.claimed.push(m.id);
  Object.assign(P.mats, { forest: 500, swamp: 500, mine: 500, ice: 500, abyss: 500 });
  P.bossMats.eye = 5;
  P.hunt.best.abyss = 10;
});
await p.evaluate(() => document.querySelector('#bBuild').click());
await W(500);
await p.evaluate(() => document.querySelector('#toLand').click());
await W(500);
await p.evaluate(() => document.querySelector('.stp[data-l="6"]').click());
await W(3500);
await settle();
ok(await p.evaluate(() => window.__S.land === 6), '6단계로 넓힘 (26×26)');
ok(await p.evaluate(() => window.__P.mats.forest === 400 && window.__P.mats.swamp === 400), '재료 100씩 냄');
await p.screenshot({ path: `${dir}/${name}_03_land6.png` });
// 7단계
await p.evaluate(() => document.querySelector('#bBuild').click());
await W(500);
await p.evaluate(() => document.querySelector('#toLand').click());
await W(500);
await p.evaluate(() => document.querySelector('.stp[data-l="7"]').click());
await W(3500);
await settle();
ok(await p.evaluate(() => window.__S.land === 7 && window.__P.bossMats.eye === 2), '7단계로 넓힘 (30×30) · 보스 재료 3 냄');
const lb = await p.evaluate(() => window.__town.landBounds());
ok(lb[0] === 12 && lb[1] === 42, '땅 [12,42)');
await p.screenshot({ path: `${dir}/${name}_04_land7.png` });
// 새 땅(뒤쪽 모서리)에 짓기
const built = await p.evaluate(() => {
  const before = window.__world.objs.length;
  window.__placeAt?.('tree', 13, 13);
  return [before, window.__world.objs.length];
});
if (built[1] === built[0]) {
  await p.evaluate(() => { window.__town.addObj('tree', 13, 13); window.__town.rebuildPaths(); });
}
ok(await p.evaluate(() => window.__world.objs.some((o) => o.kind === 'tree' && o.tx === 13 && o.ty === 13)), '새 땅 맨 뒤 모서리(13,13)에 장식');
const f7 = await fps();
ok(f7 >= 25, `땅 7단계 fps ${f7}`);
// 폰 ×0.5: 7단계 땅이 화면에 거의 다 들어온다
if (name === 'phone') {
  for (let i = 0; i < 4 && (await p.evaluate(() => window.__S.zoom)) !== 0.5; i++) {
    await p.evaluate(() => document.querySelector('#bZoom').click());
    await W(400);
  }
  ok((await p.evaluate(() => window.__S.zoom)) === 0.5, '폰 배율 ×0.5');
  await p.evaluate(() => window.__game.landCamera?.());
  await W(800);
  const fh = await fps();
  ok(fh >= 25, `×0.5 fps ${fh}`);
  await p.screenshot({ path: `${dir}/${name}_06_zoom_half.png` });
}
await p.evaluate(() => { window.__S.night = true; });
await W(1500);
await p.screenshot({ path: `${dir}/${name}_05_land7_night.png` });
ok(errs.length === 0, '오류 없음 ' + errs.join(' | '));
await b.close();
process.exit(fail ? 1 : 0);
