// 땅 개편 보고서 스크린샷: 달빛 쉼터(22×22) · 여관 Lv.3·5·8 · 주점 Lv.4 · 5단계 내 마을 · 새 건물 밤 창문 — SE/PC
//  시험 준비만 개발용 전역(금화·땅·레벨업). 실행: dist-bot 미리보기 4190 · node scripts/shot-land-extra.mjs [se|pc]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const name = process.argv[2] ?? 'pc';
const OUT = 'screenshots/land';
fs.mkdirSync(OUT, { recursive: true });
const save = fs.readFileSync('tests/fixtures/beta_town.json', 'utf8');
const DEV = { se: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, pc: { viewport: { width: 1280, height: 800 } } };
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(DEV[name]);
await ctx.addInitScript((s) => {
  try { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', 1); } catch { return; }
  localStorage.clear();
  localStorage.setItem('legacy-of-adventure-save', s);
  localStorage.setItem('legacy-of-adventure-teaserSeen', 'true');
  localStorage.setItem('legacy-of-adventure-lastVersion', '"99"');
}, save);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
const W = (ms) => p.waitForTimeout(ms);
const clear = async () => {
  for (let i = 0; i < 25; i++) {
    const st = await p.evaluate(() => ({ d: !document.querySelector('#dlg').hidden, w: document.querySelector('#win').classList.contains('on') }));
    if (st.d) await p.locator('#dlg').click().catch(() => {});
    else if (st.w) await p.locator('#winX').click().catch(() => {});
    else return;
    await W(300);
  }
};
await p.goto('http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__S, null, { timeout: 20000 });
await W(1500);
await p.locator('#tCont').click();
await W(3000);
await clear();
await p.evaluate(() => { window.__P.runs.length = 0; window.__P.hunt.auto = null; });
const shot = async (tag) => { await W(900); await p.screenshot({ path: `${OUT}/${name}_${tag}.png` }); };
const day = (d) => p.evaluate((d) => { window.__S.clock = d ? 6 * 60 : 17 * 60; window.__S.night = !d; window.__S.nightT = d ? 0 : 1; }, d);
// 5단계 내 마을 (옛 3단계 저장 + 땅 5단계로)
await p.evaluate(() => { window.__S.gold = 999999; window.__P.rep = 999999; });
for (const l of [4, 5]) {
  await p.evaluate((l) => window.__game.expandLand(l), l);
  await W(2600);
  await clear();
}
await day(true);
await shot('my_land5');
// 여관 Lv.3 · 5 · 8 (같은 자리에서) · 주점 Lv.4
const inn = () => p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'inn'); return `${o.lvl}:${o.sprite}:${o.fw}`; });
const upTo = async (k, lv) => {
  for (let i = 0; i < 12; i++) {
    const cur = await p.evaluate((k) => window.__world.objs.find((x) => x.kind === k)?.lvl ?? 0, k);
    if (cur >= lv) return;
    await p.evaluate((k) => window.__game.upgrade(window.__world.objs.find((x) => x.kind === k)), k);
    await W(300);
    await clear();
  }
};
const focusInn = () => p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'inn'); window.__game.focusTile(o.tx + o.fw / 2, o.ty + o.fh / 2); });
// 이 저장은 여관 앞에 모닥불이 있어 5×5로 커질 때 새 문을 막는다 → 시험 준비로 옆으로 옮겨 둔다
await p.evaluate(() => { const f = window.__world.objs.find((o) => o.kind === 'fire'); if (f) { f.tx = 12; f.ty = 20; } const l = window.__world.objs.find((o) => o.kind === 'lamppost'); if (l) { l.tx = 10; l.ty = 20; } window.__game.rebuild?.(); });
for (const lv of [3, 5, 8]) {
  await upTo('inn', lv);
  await focusInn();
  await day(true);
  await shot(`inn_lv${lv}`);
  console.log('여관', await inn());
}
await upTo('tavern', 4);
console.log('주점', await p.evaluate(() => { const o = window.__world.objs.find((x) => x.kind === 'tavern'); return o.lvl + ':' + o.sprite + ' @' + o.tx + ',' + o.ty + ' · ' + document.querySelector('#toast')?.textContent; }));
await day(false);
await W(1500);
await shot('night_inn8_tavern4');
await day(true);
// 달빛 쉼터 (이웃 22×22)
await p.evaluate(() => window.__game.visit(window.__neighbors.find((v) => v.id === 'moon')));
await W(2500);
await clear();
await shot('moon_day');
await day(false);
await W(1500);
await shot('moon_night');
console.log(errs.length ? '에러: ' + errs.join(' | ') : '에러 0');
await b.close();
